# SWR Data Fetching - Reference

> Decision frameworks, anti-patterns, and integration guides. See [SKILL.md](SKILL.md) for core concepts.

---

<decision_framework>

## Decision Framework

### When to Use SWR vs Alternatives

```
Need data fetching in React?
├─ Is it GraphQL?
│   └─ YES → Use Apollo Client or urql
├─ Is it tRPC?
│   └─ YES → Use tRPC (built on React Query)
├─ Need complex mutation workflows?
│   ├─ YES → Use React Query (more mutation features)
│   └─ NO → Continue...
├─ Bundle size critical?
│   ├─ YES → Use SWR (5.3KB vs 16KB)
│   └─ NO → Either works
├─ Need DevTools?
│   ├─ YES → Use React Query (built-in DevTools)
│   └─ NO → SWR is fine
├─ Using Next.js?
│   └─ YES → SWR (same team, seamless integration) ✓
└─ Simple read-heavy app?
    └─ YES → SWR ✓
```

### SWR vs React Query Feature Comparison

| Feature | SWR | React Query |
|---------|-----|-------------|
| Bundle size | 5.3KB | 16.2KB |
| DevTools | Yes (v2+, browser extension) | Yes (built-in) |
| Request cancellation | Manual | Built-in |
| Mutations | useSWRMutation | useMutation (more features) |
| Infinite queries | useSWRInfinite | useInfiniteQuery |
| Optimistic updates | Yes | Yes |
| Suspense | Yes | Yes |
| SSR support | Yes | Yes |
| Cache granularity | Route-level | Component-level |

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
│   └─ Disable all revalidation
└─ Manual refresh only?
    └─ Disable auto-revalidation, use mutate()
```

### Choosing Mutation Approach

```
Need to modify server data?
├─ Simple POST/PUT/DELETE?
│   └─ useSWRMutation ✓
├─ Need optimistic UI?
│   └─ useSWRMutation with optimisticData ✓
├─ Need to update related cache?
│   └─ Use mutate() to invalidate related keys
└─ Complex multi-step mutation?
    └─ Consider React Query (more mutation control)
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

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Next.js App Router**: Use SWRConfig fallback for SSR data hydration
- **Next.js Pages Router**: Use getStaticProps/getServerSideProps with fallback
- **axios**: Create axios fetcher for interceptors and auth
- **TypeScript**: Full generic support for typed data and errors
- **Error boundaries**: Throw errors in fetcher to trigger error boundaries

**Replaces / Conflicts with:**

- **React Query (@tanstack/react-query)**: Both solve same problem - pick one
- **Redux Toolkit Query (RTK Query)**: Another data fetching solution - pick one
- **Custom useEffect + fetch**: SWR provides caching, deduplication, revalidation

**Framework Integration:**

- **Next.js SSR**: Use fallback prop in SWRConfig for pre-fetched data
- **Next.js ISR**: SWR revalidation complements ISR for dynamic updates
- **React Suspense**: Enable suspense: true in options

</integration>

---

<anti_patterns>

## Anti-Patterns

### Unstable Keys

Keys that change on every render cause infinite request loops.

```typescript
// BAD: Object creates new reference every render
const { data } = useSWR({ url: '/api/users', page: 1 }, fetcher);

// BAD: Array without stable reference
const { data } = useSWR(['/api/users', { page: 1 }], fetcher);

// GOOD: String key is stable
const { data } = useSWR(`/api/users?page=1`, fetcher);

// GOOD: Stable array with primitives
const { data } = useSWR(['/api/users', page], fetcher);
```

### Confusing isLoading and isValidating

Showing loading spinner during background revalidation hides content unnecessarily.

```typescript
// BAD: Shows spinner even with cached data
function UserProfile({ userId }) {
  const { data, isValidating } = useSWR(`/api/users/${userId}`, fetcher);

  if (isValidating) return <Spinner />; // Hides existing data!

  return <Profile user={data} />;
}

// GOOD: Show data with refresh indicator
function UserProfile({ userId }) {
  const { data, isLoading, isValidating } = useSWR(`/api/users/${userId}`, fetcher);

  if (isLoading) return <Spinner />; // Only on initial load

  return (
    <div>
      {isValidating && <RefreshIndicator />}
      <Profile user={data} />
    </div>
  );
}
```

### Using useSWR for Mutations

useSWR is for reads. Mutations should use useSWRMutation.

```typescript
// BAD: useSWR for POST
const { data } = useSWR('/api/posts', () =>
  fetch('/api/posts', { method: 'POST', body: JSON.stringify(newPost) })
);

// GOOD: useSWRMutation for POST
const { trigger, isMutating } = useSWRMutation('/api/posts', createPost);
await trigger(newPost);
```

### Magic Numbers in Configuration

Hard-coded numbers make code unmaintainable.

```typescript
// BAD: What do these numbers mean?
const { data } = useSWR('/api/data', fetcher, {
  refreshInterval: 30000,
  errorRetryInterval: 5000,
  dedupingInterval: 2000,
});

// GOOD: Self-documenting constants
const POLL_INTERVAL_MS = 30 * 1000;
const ERROR_RETRY_MS = 5 * 1000;
const DEDUP_INTERVAL_MS = 2 * 1000;

const { data } = useSWR('/api/data', fetcher, {
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
// BAD: Doesn't throw on error
const fetcher = async (url) => {
  const response = await fetch(url);
  return response.json(); // Returns error body as "data"!
};

// GOOD: Throws on error
const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error('Fetch failed');
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

- **Unstable key causing infinite requests** - Keys must be stable; use strings or stable array references
- **isValidating used as loading state** - Shows spinner during background refresh, hiding cached data
- **useSWR for mutations** - Use useSWRMutation for POST/PUT/DELETE
- **Magic numbers** - All intervals/timeouts must be named constants
- **Default exports** - Use named exports per project conventions

**Medium Priority Issues:**

- **Missing null key for conditional fetch** - Leads to conditional hook calls
- **Not using optimisticData for mutations** - UI feels slow without immediate feedback
- **Missing error handling in fetcher** - Non-throwing fetcher returns error body as data
- **Missing error retry configuration** - Default retry may not be appropriate for all APIs
- **Not using SWRConfig** - Duplicated configuration across components

**Common Mistakes:**

- Forgetting to include credentials in fetcher for authenticated APIs
- Using keepPreviousData for search (shows stale results)
- Not handling error state when data exists (stale data with error)
- Creating fetcher inside component (creates new function each render)
- Not using type generics with useSWR

**Gotchas & Edge Cases:**

- `null` key stops fetching, `undefined` key still fetches (undefined becomes string)
- `mutate()` without arguments revalidates all keys (use specific key)
- `refreshInterval: 0` disables polling (omit option instead of 0)
- `revalidateOnFocus` fires on tab focus even if data is fresh
- Multiple useSWR with same key share cache and dedupe requests
- `fallback` in SWRConfig must use exact key strings
- useSWRInfinite revalidates all pages by default (can be slow)
- Error objects don't serialize well - use structured error type

</red_flags>

---

## Configuration Reference

### SWRConfig Options

| Option | Default | Description |
|--------|---------|-------------|
| `fetcher` | - | Default fetcher function |
| `revalidateOnFocus` | `true` | Revalidate when window gains focus |
| `revalidateOnReconnect` | `true` | Revalidate when network reconnects |
| `revalidateIfStale` | `true` | Revalidate if data is stale |
| `refreshInterval` | `0` | Polling interval (0 = disabled) |
| `refreshWhenHidden` | `false` | Poll when tab is hidden |
| `refreshWhenOffline` | `false` | Poll when offline |
| `shouldRetryOnError` | `true` | Retry on error |
| `errorRetryCount` | `5` | Max retry attempts |
| `errorRetryInterval` | `5000` | Retry interval (ms) |
| `dedupingInterval` | `2000` | Deduplication window (ms) |
| `focusThrottleInterval` | `5000` | Focus revalidation throttle (ms) |
| `keepPreviousData` | `false` | Keep data when key changes |
| `suspense` | `false` | Enable Suspense mode |
| `throwOnError` | `false` | Throw errors to error boundary (v2+) |
| `fallback` | `{}` | Pre-fetched data for SSR |

### useSWR Return Values

| Value | Type | Description |
|-------|------|-------------|
| `data` | `T \| undefined` | Fetched data |
| `error` | `Error \| undefined` | Error if request failed |
| `isLoading` | `boolean` | True on initial load with no data |
| `isValidating` | `boolean` | True when any request in-flight |
| `mutate` | `function` | Bound mutate for this key |

### useSWRMutation Return Values

| Value | Type | Description |
|-------|------|-------------|
| `data` | `T \| undefined` | Mutation response data |
| `error` | `Error \| undefined` | Error if mutation failed |
| `isMutating` | `boolean` | True when mutation in-flight |
| `trigger` | `function` | Function to trigger mutation |
| `reset` | `function` | Reset data and error state |

---

## Comparison: SWR vs React Query

### Bundle Size
- **SWR**: 5.3KB (minified + gzipped)
- **React Query**: 16.2KB (roughly 3x larger)

### DevTools
- **SWR**: SWR DevTools browser extension (zero setup for v2+)
- **React Query**: Built-in DevTools component with rich debugging UI

### API Philosophy
- **SWR**: Minimal API, convention over configuration
- **React Query**: Feature-rich, more options for fine-grained control

### Cache Strategy
- **SWR**: Stale-while-revalidate by default, route-level caching
- **React Query**: Fine-grained control, component-level caching, query invalidation

### Mutations
- **SWR**: useSWRMutation with optimisticData, rollbackOnError
- **React Query**: useMutation with more lifecycle callbacks, better cancellation

### When SWR Wins
- Smaller bundle requirement
- Simpler read-heavy applications
- Next.js projects (same team)
- Less configuration preferred

### When React Query Wins
- Complex mutation workflows
- Request cancellation required
- Component-level cache control needed
- More lifecycle hooks for mutations needed

---

## Sources

- [SWR Documentation](https://swr.vercel.app/)
- [SWR 2.0 Announcement](https://swr.vercel.app/blog/swr-v2)
- [SWR GitHub Repository](https://github.com/vercel/swr)
- [SWR DevTools](https://swr-devtools.vercel.app/)
- [React Query vs SWR Comparison](https://tanstack.com/query/v4/docs/framework/react/comparison)
- [Data Fetching in Next.js with useSWR](https://blog.logrocket.com/handling-data-fetching-next-js-useswr/)
