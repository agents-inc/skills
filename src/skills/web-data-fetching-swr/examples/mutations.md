# SWR — Mutation Examples

> `useSWRMutation`, optimistic updates and cache invalidation. See [core.md](core.md) for the
> fetcher and key shapes.

---

## useSWRMutation

The mutation fetcher takes the key and `{ arg }` — whatever `trigger()` was called with.

```typescript
// components/create-post-form.tsx
import useSWRMutation from "swr/mutation";
import { useState } from "react";
import type { FormEvent } from "react";

interface Post {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
}

interface CreatePostInput {
  title: string;
  content: string;
}

async function createPost(url: string, { arg }: { arg: CreatePostInput }): Promise<Post> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!response.ok) throw new Error("Failed to create post");
  return response.json();
}

function CreatePostForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { trigger, isMutating, error, reset } = useSWRMutation("/api/posts", createPost);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // trigger rejects on failure as well as populating `error`, so either style works
    await trigger({ title, content });
    setTitle("");
    setContent("");
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="error">
          <span>{error.message}</span>
          <button type="button" onClick={reset}>
            Dismiss
          </button>
        </div>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isMutating} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} disabled={isMutating} />
      <button type="submit" disabled={isMutating || !title.trim()}>
        {isMutating ? "Creating..." : "Create Post"}
      </button>
    </form>
  );
}
```

`reset()` clears `data` and `error`, which is what a dismissable failure banner needs — without it
the error stays until the next successful trigger.

### Other methods

The shape is the same; only the request differs. A mutation with no argument omits `{ arg }`.

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  avatar?: string;
}

async function updateUser(url: string, { arg }: { arg: UpdateUserInput }) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!response.ok) throw new Error("Update failed");
  return response.json();
}

async function deletePost(url: string) {
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) throw new Error("Delete failed");
  return response.json();
}

const { trigger, isMutating } = useSWRMutation(
  `/api/posts/${postId}`,
  deletePost,
  {
    onSuccess: () => onDeleted?.(),
  },
);
```

---

## Optimistic updates

`Post` here is the one declared above.

```typescript
// components/like-button.tsx
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { fetcher } from "../lib/fetcher";

async function toggleLike(url: string) {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) throw new Error("Like failed");
  return response.json();
}

function LikeButton({ postId }: { postId: string }) {
  const { data: post } = useSWR<Post>(`/api/posts/${postId}`, fetcher);

  const { trigger, isMutating } = useSWRMutation(`/api/posts/${postId}/like`, toggleLike, {
    optimisticData: (current: Post) => ({
      ...current,
      likes: current.likedByMe ? current.likes - 1 : current.likes + 1,
      likedByMe: !current.likedByMe,
    }),
    rollbackOnError: true,
    revalidate: true,
  });

  if (!post) return null;

  return (
    <button onClick={() => trigger()} disabled={isMutating}>
      {post.likedByMe ? "Unlike" : "Like"} ({post.likes})
    </button>
  );
}
```

The optimistic value has to move both fields together — writing `likedByMe` without `likes` shows a
filled heart above an unchanged count, which reads as a bug rather than as latency.

### Also updating the list the item belongs to

`optimisticData` applies to the mutation's own key. Anything else that changed is invalidated
separately.

```typescript
const { mutate } = useSWRConfig();

const { trigger } = useSWRMutation(`/api/todos/${todo.id}`, toggleTodo, {
  optimisticData: () => ({ ...todo, completed: !todo.completed }),
  rollbackOnError: true,
  onSuccess: () => mutate("/api/todos"),
});
```

---

## Cache updates after a write

### Invalidating what the write affected

```typescript
const { mutate } = useSWRConfig();

const { trigger, isMutating } = useSWRMutation(
  `/api/posts/${postId}/comments`,
  createComment,
  {
    onSuccess: () => {
      mutate(`/api/posts/${postId}/comments`); // the list itself
      mutate(`/api/posts/${postId}`); // and the comment count on the post
      setContent("");
    },
  },
);
```

### Writing the response into the cache instead

```typescript
const { trigger } = useSWRMutation(`/api/users/${userId}`, updateUser, {
  // the response already holds the new state, so merge it in
  populateCache: (result: User, current: User) => ({ ...current, ...result }),
  // and skip the confirming round trip
  revalidate: false,
});
```

This trades a request for trust in the response. Keep `revalidate: true` where the server derives
fields the client cannot predict.

---

## mutate

### Bound to one key

```typescript
const { data, mutate, isValidating } = useSWR("/api/data", fetcher);

<button onClick={() => mutate()} disabled={isValidating}>
  Refresh
</button>;
```

### With an updater, for an optimistic write outside useSWRMutation

```typescript
interface Counter {
  value: number;
}

const { data, mutate } = useSWR<Counter>("/api/counter", fetcher);

const increment = () =>
  mutate(
    async () =>
      (await fetch("/api/counter/increment", { method: "POST" })).json(),
    {
      optimisticData: (current) => ({ value: (current?.value ?? 0) + 1 }),
      rollbackOnError: true,
      revalidate: true,
    },
  );
```

### Global, by pattern

```typescript
// lib/cache-utils.ts
import { mutate } from "swr";

// Everything under one prefix
const invalidateUserQueries = () =>
  mutate(
    (key) => typeof key === "string" && key.startsWith("/api/users"),
    undefined,
    {
      revalidate: true,
    },
  );

// Everything, without refetching — the shape to use on logout, so the next user
// never sees the previous one's cached data
const clearCache = () => mutate(() => true, undefined, { revalidate: false });
```

The filter form is the reason keys are worth designing as paths: a prefix is then a group.
