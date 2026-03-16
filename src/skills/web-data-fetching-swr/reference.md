# SWR Data Fetching - Reference

> Decision frameworks, configuration reference, and anti-patterns. See [SKILL.md](SKILL.md) for core concepts.

---

<decision_framework>

## Decision Framework

### Choosing Revalidation Strategy

```
How fresh does data need to be?
├─ Real-time (< 10s stale)?
│   └─ Use refreshInterval with polling
├─ Fresh when user returns?
│   └─ Use revalidateOnFocus: true (default)
├─ Fresh when reconnected?
│   └─ Use revalidateOnReconnect: true (default)
├─ Static/config data?
│   └─ Use useSWRImmutable or disable all revalidation
└─ Manual refresh only?
    └─ Disable auto-revalidation, use mutate()
```

### Choosing Mutation Approach

```
Need to modify server data?
├─ Simple POST/PUT/DELETE?
│   └─ useSWRMutation with trigger() ✓
├─ Need optimistic UI?
│   └─ useSWRMutation with optimisticData + rollbackOnError ✓
├─ Need to update related cache after mutation?
│   └─ Use global mutate() to invalidate related keys
├─ Want to skip revalidation after mutation?
│   └─ Use populateCache + revalidate: false
└─ Need to update list after item mutation?
    └─ Invalidate list key in onSuccess callback
```

### Key Pattern Selection

```
What should the cache key be?
├─ Simple GET with path params?
│   └─ `/api/users/${userId}` ✓
├─ GET with query params?
│   └─ `/api/users?status=${status}&page=${page}` ✓
├─ Need multiple arguments?
│   └─ Use array key: ['/api/users', userId, filter]
├─ POST body affects response?
│   └─ Use array key: ['/api/search', searchBody]
└─ Need to skip request?
    └─ Return null from key
```

### Pagination Pattern Selection

```
What kind of pagination?
├─ Infinite scroll / "load more"?
│   └─ useSWRInfinite with getKey function
├─ Traditional page numbers?
│   └─ useSWR with page in key + keepPreviousData: true
├─ Cursor-based API?
│   └─ useSWRInfinite with cursor in getKey
└─ Offset-based API?
    └─ useSWRInfinite with offset calculation
```

</decision_framework>

---

<anti_patterns>

## Anti-Patterns

### Unstable Keys

Keys that change on every render cause infinite request loops.

```typescript
// BAD: Object creates new reference every render
const { data } = useSWR({ url: "/api/users", page: 1 }, fetcher);

// BAD: Array with object element (unstable reference)
const { data } = useSWR(["/api/users", { page: 1 }], fetcher);

// GOOD: String key is stable
const { data } = useSWR(`/api/users?page=1`, fetcher);

// GOOD: Stable array with primitives
const { data } = useSWR(["/api/users", page], fetcher);
```

### Confusing isLoading and isValidating

Showing loading spinner during background revalidation hides content unnecessarily.

```typescript
// BAD: Shows spinner even with cached data
if (isValidating) return <Spinner />; // Hides existing data!

// GOOD: Show data with refresh indicator
if (isLoading) return <Spinner />; // Only on initial load
return (
  <div>
    {isValidating && <RefreshIndicator />}
    <Profile user={data} />
  </div>
);
```

### Using useSWR for Mutations

useSWR fires on mount. Mutations should use useSWRMutation.

```typescript
// BAD: useSWR for POST -- fires immediately on mount!
const { data } = useSWR("/api/posts", () =>
  fetch("/api/posts", { method: "POST", body: JSON.stringify(newPost) }),
);

// GOOD: useSWRMutation fires on demand
const { trigger, isMutating } = useSWRMutation("/api/posts", createPost);
await trigger(newPost);
```

### Magic Numbers in Configuration

Hard-coded numbers make code unmaintainable.

```typescript
// BAD: What do these numbers mean?
const { data } = useSWR("/api/data", fetcher, {
  refreshInterval: 30000,
  errorRetryInterval: 5000,
  dedupingInterval: 2000,
});

// GOOD: Self-documenting constants
const POLL_INTERVAL_MS = 30 * 1000;
const ERROR_RETRY_MS = 5 * 1000;
const DEDUP_INTERVAL_MS = 2 * 1000;

const { data } = useSWR("/api/data", fetcher, {
  refreshInterval: POLL_INTERVAL_MS,
  errorRetryInterval: ERROR_RETRY_MS,
  dedupingInterval: DEDUP_INTERVAL_MS,
});
```

### Not Handling All States

Assuming data exists without checking loading/error states.

```typescript
// BAD: Crashes if data is undefined
function UserList() {
  const { data } = useSWR('/api/users', fetcher);
  return data.map(user => <li key={user.id}>{user.name}</li>);
}

// GOOD: Handle all states
function UserList() {
  const { data, error, isLoading } = useSWR('/api/users', fetcher);

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;
  if (!data?.length) return <EmptyState />;

  return data.map(user => <li key={user.id}>{user.name}</li>);
}
```

### Conditional Hook Calls

React hooks must be called unconditionally.

```typescript
// BAD: Conditional hook call breaks Rules of Hooks
function UserProfile({ userId }) {
  if (!userId) return <SelectUser />;
  const { data } = useSWR(`/api/users/${userId}`, fetcher); // Conditional!
  return <Profile user={data} />;
}

// GOOD: Use null key for conditional fetching
function UserProfile({ userId }) {
  const { data, isLoading } = useSWR(
    userId ? `/api/users/${userId}` : null, // Null key skips fetch
    fetcher
  );

  if (!userId) return <SelectUser />;
  if (isLoading) return <Skeleton />;
  return <Profile user={data} />;
}
```

### Missing Error Handling in Fetcher

Fetcher that doesn't throw on error returns invalid data.

```typescript
// BAD: Doesn't throw on error -- error body becomes "data"
const fetcher = async (url) => {
  const response = await fetch(url);
  return response.json(); // Returns error body as "data"!
};

// GOOD: Throws on error -- triggers SWR error state
const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error("Fetch failed");
    error.status = response.status;
    throw error;
  }
  return response.json();
};
```

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Unstable key causing infinite requests** -- Keys must be stable; use strings or stable array references
- **isValidating used as loading state** -- Shows spinner during background refresh, hiding cached data
- **useSWR for mutations** -- Use useSWRMutation for POST/PUT/DELETE
- **Magic numbers** -- All intervals/timeouts must be named constants
- **Default exports** -- Use named exports per project conventions

**Medium Priority Issues:**

- **Missing null key for conditional fetch** -- Leads to conditional hook calls
- **Not using optimisticData for mutations** -- UI feels slow without immediate feedback
- **Missing error handling in fetcher** -- Non-throwing fetcher returns error body as data
- **Missing error retry configuration** -- Default retry may not be appropriate for all APIs
- **Not using SWRConfig** -- Duplicated configuration across components

**Common Mistakes:**

- Forgetting to include credentials in fetcher for authenticated APIs
- Using keepPreviousData for search (shows stale results from different query)
- Not handling error state when data exists (stale data with error)
- Creating fetcher inside component (creates new function each render)
- Not using type generics with useSWR

**Gotchas & Edge Cases:**

- `null` key stops fetching, `undefined` key still fetches (coerced to string)
- `mutate()` without arguments revalidates bound key; global `mutate()` without filter revalidates all
- `refreshInterval: 0` disables polling (same as omitting it)
- `revalidateOnFocus` fires on tab focus even if data is fresh (use `focusThrottleInterval`)
- Multiple useSWR with same key share cache and dedupe requests
- `fallback` in SWRConfig must use exact key strings
- useSWRInfinite revalidates all pages by default (can be slow)
- Error objects don't serialize well -- use structured error types
- `useSWRImmutable` in v2.4+ properly overrides global `refreshInterval` (fixed from earlier)

</red_flags>

---

## Configuration Reference

### SWRConfig Options

| Option                  | Default | Description                          |
| ----------------------- | ------- | ------------------------------------ |
| `fetcher`               | -       | Default fetcher function             |
| `revalidateOnFocus`     | `true`  | Revalidate when window gains focus   |
| `revalidateOnReconnect` | `true`  | Revalidate when network reconnects   |
| `revalidateIfStale`     | `true`  | Revalidate if data is stale          |
| `revalidateOnMount`     | -       | Revalidate when component mounts     |
| `refreshInterval`       | `0`     | Polling interval (0 = disabled)      |
| `refreshWhenHidden`     | `false` | Poll when tab is hidden              |
| `refreshWhenOffline`    | `false` | Poll when offline                    |
| `shouldRetryOnError`    | `true`  | Retry on error                       |
| `errorRetryCount`       | `5`     | Max retry attempts                   |
| `errorRetryInterval`    | `5000`  | Retry interval (ms)                  |
| `dedupingInterval`      | `2000`  | Deduplication window (ms)            |
| `focusThrottleInterval` | `5000`  | Focus revalidation throttle (ms)     |
| `loadingTimeout`        | `3000`  | Timeout before onLoadingSlow (ms)    |
| `keepPreviousData`      | `false` | Keep data when key changes           |
| `suspense`              | `false` | Enable Suspense mode                 |
| `throwOnError`          | `false` | Throw errors to error boundary (v2+) |
| `fallback`              | `{}`    | Pre-fetched data for SSR             |
| `fallbackData`          | -       | Per-hook fallback data               |
| `isPaused()`            | -       | Function to pause revalidation       |
| `compare`               | -       | Custom comparison function for data  |
| `use`                   | -       | Middleware array                     |

### useSWR Return Values

| Value          | Type                 | Description                       |
| -------------- | -------------------- | --------------------------------- |
| `data`         | `T \| undefined`     | Fetched data                      |
| `error`        | `Error \| undefined` | Error if request failed           |
| `isLoading`    | `boolean`            | True on initial load with no data |
| `isValidating` | `boolean`            | True when any request in-flight   |
| `mutate`       | `function`           | Bound mutate for this key         |

### useSWRMutation Return Values

| Value        | Type                 | Description                  |
| ------------ | -------------------- | ---------------------------- |
| `data`       | `T \| undefined`     | Mutation response data       |
| `error`      | `Error \| undefined` | Error if mutation failed     |
| `isMutating` | `boolean`            | True when mutation in-flight |
| `trigger`    | `function`           | Function to trigger mutation |
| `reset`      | `function`           | Reset data and error state   |

### useSWRMutation Options

| Option            | Default | Description                              |
| ----------------- | ------- | ---------------------------------------- |
| `optimisticData`  | -       | Update cache optimistically before fetch |
| `revalidate`      | `true`  | Revalidate cache after mutation          |
| `populateCache`   | `false` | Write mutation result to cache           |
| `rollbackOnError` | `true`  | Revert optimistic data on error          |
| `throwOnError`    | `true`  | Whether trigger() throws on error        |
| `onSuccess`       | -       | Callback on success                      |
| `onError`         | -       | Callback on error                        |

### useSWRInfinite Options

| Option                | Default | Description                              |
| --------------------- | ------- | ---------------------------------------- |
| `initialSize`         | `1`     | Number of pages to load initially        |
| `revalidateAll`       | `false` | Revalidate all pages on trigger          |
| `revalidateFirstPage` | `true`  | Revalidate first page on focus/reconnect |
| `persistSize`         | `false` | Persist page count across unmounts       |
| `parallel`            | `false` | Fetch pages in parallel                  |

---

## Sources

- [SWR Documentation](https://swr.vercel.app/)
- [SWR 2.0 Announcement](https://swr.vercel.app/blog/swr-v2)
- [SWR GitHub Repository](https://github.com/vercel/swr)
- [SWR DevTools](https://swr-devtools.vercel.app/)
