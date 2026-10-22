# React Query — Mutation Examples

> `useMutation`, invalidation after a write, and optimistic updates. See [core.md](core.md) for
> setup and query options.

**Prerequisites**: [Pattern 3: Consuming and overriding query options](core.md#pattern-3-consuming-and-overriding-query-options).

---

## Pattern 9: useMutation and invalidation

The writes below all touch the list these options read, so its key is declared once.

```typescript
// todos/api.ts
import { queryOptions } from "@tanstack/react-query";

export type Todo = { id: string; title: string; done: boolean };
export type NewTodo = Pick<Todo, "title">;
export type TodoPatch = Pick<Todo, "id"> & Partial<Omit<Todo, "id">>;

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const sendJson = (url: string, method: "POST" | "PATCH", body: unknown) =>
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const createTodo = async (input: NewTodo) =>
  readJson<Todo>(await sendJson("/api/todos", "POST", input));

export const updateTodo = async ({ id, ...patch }: TodoPatch) =>
  readJson<Todo>(await sendJson(`/api/todos/${id}`, "PATCH", patch));

export const todosOptions = () =>
  queryOptions({
    queryKey: ["todos"],
    queryFn: async ({ signal }) =>
      readJson<Todo[]>(await fetch("/api/todos", { signal })),
  });

export const todoOptions = (id: string) =>
  queryOptions({
    queryKey: ["todos", id],
    queryFn: async ({ signal }) =>
      readJson<Todo>(await fetch(`/api/todos/${id}`, { signal })),
  });
```

Invalidation matches by prefix: `["todos"]` reaches the list and every `["todos", id]` entry, and
`exact: true` narrows it to the list alone.

```typescript
// todos/add-todo-form.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { createTodo, todosOptions } from "./api";

export function AddTodoForm() {
  const queryClient = useQueryClient();

  const addTodo = useMutation({
    mutationFn: createTodo,
    // Returned, so isPending stays true until the refetched list has landed
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todosOptions().queryKey }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = new FormData(form).get("title");
    if (typeof title !== "string" || !title.trim()) return;

    // UI work goes on mutate(): it is skipped if the form unmounts before the write settles
    addTodo.mutate({ title }, { onSuccess: () => form.reset() });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" disabled={addTodo.isPending} />
      <button type="submit" disabled={addTodo.isPending}>
        {addTodo.isPending ? "Adding..." : "Add"}
      </button>
      {addTodo.isError && <p role="alert">{addTodo.error.message}</p>}
    </form>
  );
}
```

Cache work belongs on `useMutation`, which runs it for every call. Callbacks passed to `mutate()`
run for the latest call only, and only while the component is mounted.

### Writing the response instead of refetching it

```typescript
// todos/use-rename-todo.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { todoOptions, todosOptions, updateTodo } from "./api";

export function useRenameTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTodo,
    onSuccess: (updated) => {
      // The response is the new item, so its own entry needs no round trip
      queryClient.setQueryData(todoOptions(updated.id).queryKey, updated);
      // exact: the list still shows the old title, the entry just written does not
      return queryClient.invalidateQueries({
        queryKey: todosOptions().queryKey,
        exact: true,
      });
    },
  });
}
```

The key from `queryOptions` carries its data type, so `setQueryData` rejects anything that is not a
`Todo`.

### Bad example

```typescript
const addTodo = useMutation({
  mutationFn: createTodo,
  onSuccess: () => {
    // BAD: not returned — isPending turns false while the list still shows the old data
    queryClient.invalidateQueries({ queryKey: todosOptions().queryKey });
  },
});

const save = async (title: string) => {
  // BAD: mutateAsync rejects on failure, and nothing catches it — use mutate, or try/catch
  await addTodo.mutateAsync({ title });
  closeDialog();
};
```

---

## Pattern 10: Optimistic updates

Show a write before the server confirms it only where failures are rare and the result is
predictable. A server-assigned id or sort order is better served by a pending state.

### Via the UI

Where the pending item shows in one place, render the mutation's `variables` while it is pending.
Nothing is written to the cache, so nothing needs rolling back.

```typescript
// todos/todo-list.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTodo, todosOptions } from "./api";

export function TodoList({ draftTitle }: { draftTitle: string }) {
  const queryClient = useQueryClient();
  const { data: todos } = useQuery(todosOptions());

  const addTodo = useMutation({
    mutationFn: createTodo,
    // Returned, so the pending row stays until the refetched list holds the real one
    onSettled: () => queryClient.invalidateQueries({ queryKey: todosOptions().queryKey }),
  });

  return (
    <>
      <ul>
        {todos?.map((todo) => <li key={todo.id}>{todo.title}</li>)}
        {addTodo.isPending && <li style={{ opacity: 0.5 }}>{addTodo.variables.title}</li>}
        {addTodo.isError && (
          <li role="alert">
            {addTodo.variables.title}
            <button onClick={() => addTodo.mutate(addTodo.variables)}>Retry</button>
          </li>
        )}
      </ul>
      <button onClick={() => addTodo.mutate({ title: draftTitle })}>Add</button>
    </>
  );
}
```

### Via the cache, with rollback

Where several components read the entry, write the optimistic value into the cache, keep what it
replaced, and restore that on failure.

```typescript
// todos/use-toggle-todo.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { todosOptions, updateTodo } from "./api";
import type { Todo } from "./api";

const toggleTodoKey = ["todos", "toggle"] as const;

export function useToggleTodo() {
  const queryClient = useQueryClient();
  const { queryKey } = todosOptions();

  return useMutation({
    mutationKey: toggleTodoKey,
    mutationFn: (todo: Todo) => updateTodo({ id: todo.id, done: !todo.done }),
    onMutate: async (todo) => {
      // A refetch already in flight would land after the optimistic write and undo it
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData(queryKey); // Todo[] | undefined, read off the key
      queryClient.setQueryData(queryKey, (old) =>
        old?.map((item) =>
          item.id === todo.id ? { ...item, done: !item.done } : item,
        ),
      );
      return { previous };
    },
    // The third argument is whatever onMutate returned
    onError: (_error, _todo, onMutateResult) => {
      queryClient.setQueryData(queryKey, onMutateResult?.previous);
    },
    onSettled: async () => {
      // Another toggle still in flight refetches when it settles; refetching now would replace
      // its optimistic write with a response that predates it
      if (queryClient.isMutating({ mutationKey: toggleTodoKey }) === 1) {
        await queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
```

`isMutating` still counts the mutation whose `onSettled` is running, so `1` means no other toggle is
in flight.

### Bad example

```typescript
onMutate: async (todo) => {
  // BAD: no cancelQueries — a refetch already in flight lands afterwards and reverts the toggle
  const previous = queryClient.getQueryData(queryKey);
  queryClient.setQueryData(queryKey, (old) =>
    old?.map((item) => {
      // BAD: edits the cached object, which `previous` also holds — the rollback then restores
      // the toggle it was meant to undo
      if (item.id === todo.id) item.done = !item.done;
      return item;
    }),
  );
  return { previous };
},
```

---

_Related: [core.md](core.md), [error-handling.md](error-handling.md)_
