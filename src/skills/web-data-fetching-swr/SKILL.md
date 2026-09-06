---
name: web-data-fetching-swr
description: SWR data fetching patterns — keys and fetchers, isLoading vs isValidating, revalidation strategy, useSWRMutation, useSWRInfinite, conditional fetching
---

# SWR Patterns

> **Quick Guide:** SWR renders the cached value immediately and revalidates behind it, so the cache
> key is the whole identity of a request and an unstable key is the single most expensive mistake
> here. `isLoading` covers the first fetch only and `isValidating` covers every fetch, which is why
> using the second as a spinner hides the data SWR exists to show. Reads are `useSWR`, writes are
> `useSWRMutation`, and a `null` key is how a request is skipped without breaking the rules of hooks.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — fetchers, key shapes, state handling, `SWRConfig`
- [examples/mutations.md](examples/mutations.md) — `useSWRMutation`, optimistic updates, `populateCache`, global `mutate`
- [examples/caching.md](examples/caching.md) — revalidation strategies, prefetching, cache persistence
- [examples/pagination.md](examples/pagination.md) — `useSWRInfinite`, infinite scroll, offset and filtered paging
- [examples/conditional.md](examples/conditional.md) — the null key, dependent queries, function keys
- [examples/error-handling.md](examples/error-handling.md) — retry policy, status-specific handling, offline
- [examples/suspense.md](examples/suspense.md) — suspense mode and server-rendered fallback data
- [reference.md](reference.md) — every config option with its default, and the hook return shapes

---

## Which path applies

- **Reading a resource** — `useSWR`, which fetches on mount and keeps the value fresh. Patterns 1–3.
- **Writing** — `useSWRMutation`, which does nothing until `trigger()` is called. Pattern 4.
- **A list that grows** — `useSWRInfinite`, whose `getKey(pageIndex, previousPage)` both builds each
  page's key and signals the end by returning `null`. Pattern 7.
- **Suspense instead of loading branches** — `suspense: true` makes the component suspend and `data`
  non-null; see [examples/suspense.md](examples/suspense.md). Everything else here still applies.

---

<critical_requirements>

## Before writing SWR code

**Give each request a key that is stable across renders — a string, or an array of primitives.** The
key is the cache identity and the dependency: an object or array literal is a new reference every
render, so SWR sees a new key, fetches again, re-renders, and repeats.

**Throw from the fetcher on a non-OK response.** SWR's error state is driven by a rejected promise,
so a fetcher that returns `res.json()` unconditionally hands the error body over as `data` and no
error branch ever runs.

**Branch on `isLoading` for the first fetch and `isValidating` for a refresh in progress.**
`isLoading` is true only when there is no data yet, which is exactly when a skeleton is right;
`isValidating` is true during background revalidation, when there is data on screen to keep.

**Reach for `useSWRMutation` for anything that writes.** `useSWR` fires on mount, so a POST written
as a `useSWR` fetcher sends itself as soon as the component renders.

</critical_requirements>

---

**Auto-detection:** `useSWR`, `useSWRMutation`, `useSWRInfinite`, `useSWRImmutable`, `SWRConfig`,
`useSWRConfig`, `mutate`, `trigger`, `isValidating`, `revalidateOnFocus`, `dedupingInterval`,
`keepPreviousData`, `fallbackData`, `optimisticData`, `rollbackOnError`, `populateCache`, `preload`,
`swr/mutation`, `swr/infinite`, `swr/immutable`

**Applies to:**

- Cache keys, fetchers and the shape of what a hook returns
- Revalidation policy: focus, reconnect, interval, stale, and disabling all of it
- Writes, optimistic updates and cache invalidation after them
- Cursor and offset pagination that accumulates pages
- Conditional and dependent fetching
- Retry policy and hydrating from server-rendered data

**Handled elsewhere:**

- Client state that never came from a server — this skill caches responses
- The transport itself; a fetcher is any function returning a promise, and what it uses is open
- How an error boundary is built — this skill settles which option throws an error into one
- APIs addressed through a graph query language, whose clients cache normalised entities rather than
  whole responses under a key

---

<philosophy>

## Philosophy

The name is the algorithm: return what is cached, revalidate behind it, re-render if the answer
changed. A component therefore has data at nearly every moment of its life, and the interesting
states are not "loading or loaded" but "is this being checked" and "is this out of date".

Everything else follows. The key is a global identity, so two components asking for the same key
share one request and one cache entry with no coordination between them. Revalidation is triggered
by events the user causes — refocusing the tab, reconnecting — rather than by timers, because those
are the moments the data on screen is most likely to be stale.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: The fetcher

```typescript
interface FetchError extends Error {
  info: unknown;
  status: number;
}

const fetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error("Fetch failed") as FetchError;
    error.info = await response.json().catch(() => null);
    error.status = response.status;
    throw error;
  }
  return response.json();
};
```

Attaching `status` is what lets a component tell a 404 from a 500, and lets a retry policy decline
to retry either. Define the fetcher at module scope — one created inside a component is a new
reference on every render.

Full code: [examples/core.md](examples/core.md) — client-based and multi-argument fetchers

---

### Pattern 2: isLoading vs isValidating

```typescript
// data: undefined, isLoading: true,  isValidating: true   — first fetch
// data: T,         isLoading: false, isValidating: false  — settled
// data: T,         isLoading: false, isValidating: true   — revalidating behind the value
// error: Error,    isLoading: false, isValidating: false  — failed with nothing cached
// data: T, error: Error, isLoading: false                 — failed with a cached value to show
```

```typescript
if (isLoading) return <Skeleton />;

return (
  <div>
    {isValidating && <RefreshIndicator />}
    {error && data && <Banner>Showing cached data; the last refresh failed</Banner>}
    <Content data={data} />
  </div>
);
```

The last row is the one to design for: a failed refresh over good data is a banner, not an error
page.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Global configuration

```typescript
const ERROR_RETRY_COUNT = 3;
const DEDUP_INTERVAL_MS = 2000;

<SWRConfig
  value={{
    fetcher,
    errorRetryCount: ERROR_RETRY_COUNT,
    dedupingInterval: DEDUP_INTERVAL_MS,
    keepPreviousData: true,
    fallback, // keys pre-filled from a server render
  }}
>
  {children}
</SWRConfig>;
```

A nested `SWRConfig` overrides its parent, which is how one static section opts out of revalidation
without every hook in it repeating the options. Every option and its default is in
[reference.md](reference.md).

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Writes

```typescript
import useSWRMutation from "swr/mutation";

async function createPost(
  url: string,
  { arg }: { arg: CreatePostInput },
): Promise<Post> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!response.ok) throw new Error("Failed to create post");
  return response.json();
}

const { trigger, isMutating, error, reset } = useSWRMutation(
  "/api/posts",
  createPost,
);
await trigger({ title, content });
```

The mutation fetcher's second parameter is `{ arg }` — whatever `trigger()` was called with.
`trigger` returns a promise, so the success path stays in the handler that called it.

Full code: [examples/mutations.md](examples/mutations.md)

---

### Pattern 5: Optimistic updates

```typescript
const { trigger } = useSWRMutation(`/api/todos/${todo.id}`, toggleTodo, {
  optimisticData: (current: Todo) => ({
    ...current,
    completed: !current.completed,
  }),
  rollbackOnError: true,
  revalidate: true,
});
```

`optimisticData` writes to the cache before the request leaves; `rollbackOnError` puts the previous
value back when it fails. Where the response already contains the new state, `populateCache` writes
it directly and `revalidate: false` skips the confirming round trip.

Full code: [examples/mutations.md](examples/mutations.md)

---

### Pattern 6: Conditional fetching with a null key

```typescript
// null key: the hook runs, the request does not
const { data } = useSWR(userId ? `/api/users/${userId}` : null, fetcher);

// dependent: the second key does not exist until the first resolves
const { data: user } = useSWR(`/api/users/${userId}`, fetcher);
const { data: posts } = useSWR(
  user ? `/api/users/${user.id}/posts` : null,
  fetcher,
);
```

A key can also be a function returning `null`, which suits several conditions at once. What it must
never be is a conditionally called hook.

Full code: [examples/conditional.md](examples/conditional.md)

---

### Pattern 7: Pagination

```typescript
import useSWRInfinite from "swr/infinite";

const getKey = (pageIndex: number, previousPageData: PostsResponse | null) => {
  if (previousPageData && !previousPageData.hasMore) return null; // stop
  if (pageIndex === 0) return `/api/posts?limit=${PAGE_SIZE}`;
  return `/api/posts?limit=${PAGE_SIZE}&cursor=${previousPageData?.nextCursor}`;
};

const { data, size, setSize } = useSWRInfinite<PostsResponse>(getKey, fetcher, {
  revalidateFirstPage: false,
});

const posts = data?.flatMap((page) => page.posts) ?? [];
```

`data` is an array of pages, so `flatMap` rather than `map`. `getKey` returning `null` is the only
thing that ends the list — without it `setSize` keeps requesting.

Full code: [examples/pagination.md](examples/pagination.md)

---

### Pattern 8: Revalidation strategy

```typescript
const POLL_INTERVAL_MS = 10 * 1000;

// live: poll, but not into a hidden tab
useSWR(key, fetcher, {
  refreshInterval: POLL_INTERVAL_MS,
  refreshWhenHidden: false,
});

// default: on focus and on reconnect, both already true
useSWR(key, fetcher);

// static: fetch once and leave it
import useSWRImmutable from "swr/immutable";
useSWRImmutable(key, fetcher);
```

`useSWRImmutable` is the three revalidation options turned off, under one name.

Full code: [examples/caching.md](examples/caching.md) — plus `preload()` and cache persistence

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- An object or array literal as the key — a new reference each render means a new key each render,
  and the fetch loop never settles.
- A fetcher that does not throw — the error body is stored as `data`, `error` stays undefined, and
  the failure renders as content.
- `useSWR` used for a write — it fires on mount, so the request is sent before any user acts.
- A hook called inside a condition — use a `null` key instead; the hook must run every render.
- `suspense: true` with no `Suspense` boundary above it — the thrown promise reaches the error
  boundary or the top of the tree.
- `optimisticData` without `rollbackOnError` — a failed write leaves the invented value in the cache
  until something else revalidates.

**Surprising behaviour:**

- `null` skips the request but `undefined` does not — it is interpolated, and the request goes to
  `/api/users/undefined`.
- A bound `mutate()` revalidates its own key; the global `mutate()` with no filter revalidates the
  entire cache.
- `revalidateOnFocus` fires on every tab focus regardless of freshness — `focusThrottleInterval`
  bounds it.
- `keepPreviousData: true` on a search box shows the previous query's results under the new query.
- `fallback` keys are matched exactly, so `/api/users/1` and `/api/users/1/` hydrate separately.
- `revalidateAll: true` on `useSWRInfinite` refetches every loaded page on each revalidation.
- `refreshInterval: 0` disables polling, which is what omitting it does.
- Default retry does not know which failures are worth retrying — it will retry a 404 and a 401
  unless `onErrorRetry` says otherwise.
- `Error` objects do not survive JSON serialization, so a persisted cache needs a structured error
  shape.
- Nothing cancels an in-flight request. A response that is no longer wanted is discarded rather than
  aborted — a fetcher that must actually stop work in flight has to carry its own `AbortController`.

</red_flags>
