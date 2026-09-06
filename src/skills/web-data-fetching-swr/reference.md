# SWR — Reference

> Every option with its default, and the hook return shapes. See [SKILL.md](SKILL.md) for the
> decisions and the red flags, and [examples/](examples/) for full code.

---

## SWRConfig options

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

## useSWR return values

| Value          | Type                 | Description                       |
| -------------- | -------------------- | --------------------------------- |
| `data`         | `T \| undefined`     | Fetched data                      |
| `error`        | `Error \| undefined` | Error if request failed           |
| `isLoading`    | `boolean`            | True on initial load with no data |
| `isValidating` | `boolean`            | True when any request in-flight   |
| `mutate`       | `function`           | Bound mutate for this key         |

## useSWRMutation return values

| Value        | Type                 | Description                  |
| ------------ | -------------------- | ---------------------------- |
| `data`       | `T \| undefined`     | Mutation response data       |
| `error`      | `Error \| undefined` | Error if mutation failed     |
| `isMutating` | `boolean`            | True when mutation in-flight |
| `trigger`    | `function`           | Function to trigger mutation |
| `reset`      | `function`           | Reset data and error state   |

## useSWRMutation options

| Option            | Default | Description                              |
| ----------------- | ------- | ---------------------------------------- |
| `optimisticData`  | -       | Update cache optimistically before fetch |
| `revalidate`      | `true`  | Revalidate cache after mutation          |
| `populateCache`   | `false` | Write mutation result to cache           |
| `rollbackOnError` | `true`  | Revert optimistic data on error          |
| `throwOnError`    | `true`  | Whether trigger() throws on error        |
| `onSuccess`       | -       | Callback on success                      |
| `onError`         | -       | Callback on error                        |

## useSWRInfinite options

| Option                | Default | Description                              |
| --------------------- | ------- | ---------------------------------------- |
| `initialSize`         | `1`     | Number of pages to load initially        |
| `revalidateAll`       | `false` | Revalidate every loaded page on trigger  |
| `revalidateFirstPage` | `true`  | Revalidate first page on focus/reconnect |
| `persistSize`         | `false` | Persist page count across unmounts       |
| `parallel`            | `false` | Fetch pages in parallel                  |

---

## Sources

- [SWR documentation](https://swr.vercel.app/)
- [SWR 2.0 announcement](https://swr.vercel.app/blog/swr-v2)
- [SWR repository](https://github.com/vercel/swr)
- [SWR DevTools](https://swr-devtools.vercel.app/)
