# TanStack Router -- Data Loading Examples

> Route loaders, beforeLoad middleware, external data fetching integration, prefetching, and SWR caching. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Core Setup & Configuration](core.md) -- router context setup
- [Auth & Context](auth-and-context.md) -- beforeLoad for auth guards, context enrichment
- [Error Handling](error-handling.md) -- errorComponent, pendingComponent, notFoundComponent

---

## Basic Loader

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/")({
  loader: async () => {
    const posts = await fetchPosts();
    return { posts };
  },
  component: PostsPage,
});

function PostsPage() {
  // Data is guaranteed available - loader resolved before render
  const { posts } = Route.useLoaderData();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

**Why:** `useLoaderData()` is fully typed from the loader return type. Data is available on first render (no loading spinners in the component). Loader errors are caught by the route's `errorComponent`.

---

## Loader with Params, Context, and Abort Signal

```typescript
import { createFileRoute } from "@tanstack/react-router";

const STALE_TIME_MS = 60_000; // 1 minute

export const Route = createFileRoute("/posts/$postId/")({
  staleTime: STALE_TIME_MS,
  loader: async ({ params, context, abortController }) => {
    const post = await context.apiClient.getPost(params.postId, {
      signal: abortController.signal,
    });
    return { post };
  },
  component: PostDetail,
});

function PostDetail() {
  const { post } = Route.useLoaderData();
  return <article>{post.title}</article>;
}
```

**Why:** `params.postId` is typed from the route path. `context.apiClient` is injected via router context (no global imports). `abortController.signal` cancels fetch on navigation away. `staleTime` enables SWR-style caching to avoid redundant fetches.

---

## beforeLoad vs loader

`beforeLoad` runs first and sequentially (parent before child). `loader` runs after `beforeLoad` and in parallel with sibling loaders.

```typescript
export const Route = createFileRoute("/dashboard/")({
  // beforeLoad: runs first, sequentially, blocks loaders
  // Use for: auth checks, redirects, adding to context
  beforeLoad: async ({ context }) => {
    const user = await context.auth.getUser();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    // Return value merges into context for child routes and loader
    return { user };
  },

  // loader: runs after beforeLoad, in parallel with sibling loaders
  // Use for: fetching data the component needs
  loader: async ({ context }) => {
    // context.user is available from beforeLoad above
    const stats = await fetchDashboardStats(context.user.id);
    return { stats };
  },

  component: Dashboard,
});
```

**Why:** Separation of concerns: `beforeLoad` handles auth/redirects, `loader` handles data. `beforeLoad` return value automatically merges into context for the loader and child routes. Parallel execution of sibling loaders prevents waterfalls.

### Decision: Where to Put Logic

```
What does the logic do?
  +-- Auth check / permission guard?
  |   -> beforeLoad (blocks everything, runs first)
  +-- Redirect based on conditions?
  |   -> beforeLoad (throw redirect())
  +-- Add data to context for children?
  |   -> beforeLoad (return value merges into context)
  +-- Fetch data for the component?
  |   -> loader (runs in parallel with siblings)
  +-- Prefetch data for an external cache?
  |   -> loader (prefetch via context-injected client, runs in parallel)
```

---

## External Data Fetching Integration: Prefetch in Loader

When using an external data fetching library with a cache, prefetch in the loader so data is cached before the component renders. Inject the client via router context.

```typescript
// src/routes/posts/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/")({
  loader: async ({ context }) => {
    // Prefetch ensures data is in cache before component renders
    // Use your data fetching library's prefetch method via context
    await context.dataClient.prefetchData(postsQueryOptions);
  },
  component: PostsPage,
});

function PostsPage() {
  // Component reads from the external cache (prefetched in loader)
  // Use your data fetching library's hook to read cached data
  // The data was already prefetched by the loader above
  const posts = usePostsFromCache();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

**Why:** Prefetching in loaders ensures data is available before the component mounts. The loader uses context-injected clients (not direct imports) for testability. The component reads from the shared cache, subscribing to background updates.

---

## Non-Blocking Prefetch (Critical + Non-Critical Data)

```typescript
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/posts/$postId/")({
  loader: async ({ context, params }) => {
    // Critical: await this (blocks render until resolved)
    const post = await context.dataClient.fetchData(
      postQueryOptions(params.postId),
    );
    if (!post) throw notFound();

    // Non-critical: start fetch but don't block render (fire-and-forget)
    context.dataClient.prefetchData(commentsQueryOptions(params.postId));

    return { post };
  },
  component: PostDetailPage,
});

function PostDetailPage() {
  const { post } = Route.useLoaderData();

  // Non-critical data - use your data fetching library's hook
  // This data was fire-and-forget prefetched in the loader
  const { comments, isLoading } = useCommentsFromCache(post.id);

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>

      <section>
        <h2>Comments</h2>
        {isLoading ? (
          <p>Loading comments...</p>
        ) : (
          <ul>
            {comments?.map((comment) => (
              <li key={comment.id}>{comment.text}</li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
```

**Why:** Critical data blocks render via `await` ensuring it is available immediately via `useLoaderData`. Non-critical data starts fetching in parallel without blocking. The component can show a loading state for non-critical data while critical data is immediate.

---

## Data Loading Strategy Decision

```
How to load data?
  +-- Simple app, no shared cache needs?
  |   -> Built-in route loaders with staleTime
  +-- Complex app with shared server state cache?
  |   -> External data fetching library + prefetch in loaders
  +-- Data needed only for this component?
  |   -> Route loader (useLoaderData)
  +-- Data shared across many components?
  |   -> External data fetching library (client in context)
```

---

## SWR Caching Configuration

```typescript
const STALE_TIME_MS = 30_000; // 30 seconds
const GC_TIME_MS = 300_000; // 5 minutes

// Router-level defaults
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultStaleTime: STALE_TIME_MS,
  defaultGcTime: GC_TIME_MS,
});

// Per-route override
export const Route = createFileRoute("/posts/")({
  staleTime: STALE_TIME_MS,
  loader: async () => {
    const posts = await fetchPosts();
    return { posts };
  },
  component: PostsPage,
});
```

| Property           | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `staleTime`        | How long cached data is considered fresh (skips re-fetch)    |
| `gcTime`           | How long stale data stays in cache before garbage collection |
| `preloadStaleTime` | Separate stale time for preloaded data                       |
