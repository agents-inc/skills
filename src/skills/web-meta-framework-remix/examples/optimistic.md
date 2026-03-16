# Remix - Optimistic UI Examples

> Patterns for useFetcher with optimistic updates and debounced search.

---

## Todo Toggle with Optimistic UI

```typescript
// app/routes/todos.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";

type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const todos = await db.todo.findMany({ orderBy: { createdAt: "desc" } });
  return json({ todos });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const todoId = formData.get("todoId") as string;
  const completed = formData.get("completed") === "true";

  await db.todo.update({
    where: { id: todoId },
    data: { completed },
  });

  return json({ success: true });
}

function TodoItem({ todo }: { todo: Todo }) {
  const fetcher = useFetcher();

  // Optimistic UI: show expected state while request is in flight
  const isCompleted = fetcher.formData
    ? fetcher.formData.get("completed") === "true"
    : todo.completed;

  return (
    <li>
      <fetcher.Form method="post">
        <input type="hidden" name="todoId" value={todo.id} />
        <input type="hidden" name="completed" value={String(!isCompleted)} />
        <label>
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          <span style={{ textDecoration: isCompleted ? "line-through" : "none" }}>
            {todo.title}
          </span>
        </label>
      </fetcher.Form>
    </li>
  );
}

export default function Todos() {
  const { todos } = useLoaderData<typeof loader>();

  return (
    <ul>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

**Why good:** Checkbox triggers form submission immediately, optimistic UI shows expected state before server responds, no navigation on toggle, each todo has its own fetcher instance

---

## Debounced Search with useFetcher

```typescript
// app/routes/search.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

const DEBOUNCE_DELAY_MS = 300;
const MIN_SEARCH_LENGTH = 2;

type SearchResult = {
  id: string;
  title: string;
  type: "product" | "category" | "user";
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  if (query.length < MIN_SEARCH_LENGTH) {
    return json({ results: [] as SearchResult[] });
  }

  const results = await db.$queryRaw<SearchResult[]>`
    SELECT id, title, type FROM search_index
    WHERE title ILIKE ${`%${query}%`}
    LIMIT 10
  `;

  return json({ results });
}

export default function SearchPage() {
  const fetcher = useFetcher<typeof loader>();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (query.length < MIN_SEARCH_LENGTH) return;

    const timeoutId = setTimeout(() => {
      fetcher.load(`/search?q=${encodeURIComponent(query)}`);
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        aria-label="Search"
      />

      {fetcher.state === "loading" && <p>Searching...</p>}

      {fetcher.data?.results && fetcher.data.results.length > 0 && (
        <ul>
          {fetcher.data.results.map((result) => (
            <li key={result.id}>
              <span>{result.type}:</span> {result.title}
            </li>
          ))}
        </ul>
      )}

      {fetcher.data?.results?.length === 0 && query.length >= MIN_SEARCH_LENGTH && (
        <p>No results found</p>
      )}
    </div>
  );
}
```

**Why good:** Debounced search prevents excessive requests, minimum query length avoids useless searches, loading state feedback, typed fetcher data, no results message

---

## useFetcher Key Concepts

### Fetcher States

| State        | Description             |
| ------------ | ----------------------- |
| `idle`       | No active submission    |
| `submitting` | Form is being submitted |
| `loading`    | Data is being loaded    |

### Optimistic Update Pattern

```typescript
// Read from formData if submitting, otherwise use server data
const optimisticValue = fetcher.formData
  ? fetcher.formData.get("fieldName")
  : serverValue;
```

### When to Use useFetcher vs Form

| Use Case                   | Component               |
| -------------------------- | ----------------------- |
| Navigation after submit    | `<Form>`                |
| Stay on same page          | `<fetcher.Form>`        |
| Multiple independent forms | `useFetcher()` per form |
| Inline editing             | `useFetcher()`          |
