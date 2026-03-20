# SWR Data Fetching - Reference

> Decision frameworks and configuration reference. See [SKILL.md](SKILL.md) for core concepts and red flags.

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

## Configuration Reference

### SWRConfig Options

| Option                  | Default | Description                                    |
| ----------------------- | ------- | ---------------------------------------------- |
| `fetcher`               | -       | Default fetcher function                       |
| `revalidateOnFocus`     | `true`  | Revalidate when window gains focus             |
| `revalidateOnReconnect` | `true`  | Revalidate when network reconnects             |
| `revalidateIfStale`     | `true`  | Revalidate if data is stale                    |
| `revalidateOnMount`     | -       | Revalidate when component mounts               |
| `refreshInterval`       | `0`     | Polling interval (0 = disabled)                |
| `refreshWhenHidden`     | `false` | Poll when tab is hidden                        |
| `refreshWhenOffline`    | `false` | Poll when offline                              |
| `shouldRetryOnError`    | `true`  | Retry on error                                 |
| `errorRetryCount`       | -       | Max retry attempts (unlimited if unset)        |
| `errorRetryInterval`    | `5000`  | Retry interval (ms)                            |
| `dedupingInterval`      | `2000`  | Deduplication window (ms)                      |
| `focusThrottleInterval` | `5000`  | Focus revalidation throttle (ms)               |
| `loadingTimeout`        | `3000`  | Timeout before onLoadingSlow (ms)              |
| `keepPreviousData`      | `false` | Keep data when key changes                     |
| `suspense`              | `false` | Enable Suspense mode                           |
| `throwOnError`          | `false` | Throw errors to error boundary (v2+)           |
| `fallback`              | `{}`    | Pre-fetched data for SSR                       |
| `fallbackData`          | -       | Per-hook fallback data                         |
| `onLoadingSlow`         | -       | Callback when request exceeds `loadingTimeout` |
| `onSuccess`             | -       | Callback on successful fetch                   |
| `onError`               | -       | Callback on fetch error                        |
| `onErrorRetry`          | -       | Custom error retry handler                     |
| `onDiscarded`           | -       | Callback when request is discarded             |
| `isPaused()`            | -       | Function to pause revalidation                 |
| `compare`               | -       | Custom comparison function for data            |
| `use`                   | -       | Middleware array                               |

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
