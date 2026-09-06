# React Query — Reference

> Lookup for configuration and error strategy, plus the v4 → v5 map. See [SKILL.md](SKILL.md) for
> the decisions and the red flags.

---

<decision_framework>

## Configuration strategy

| Need                                  | Where it goes                                         |
| ------------------------------------- | ----------------------------------------------------- |
| Base URL, default headers             | `client.setConfig()` in the provider                  |
| Static token                          | `client.setConfig({ auth: () => token })`             |
| Token that changes during the session | `useEffect` on the token, calling `setConfig()` again |
| One request differing from the rest   | Options passed to the service function                |
| Request timeout                       | A custom `fetch` on `setConfig({ fetch })`            |
| Freshness and eviction                | `staleTime` and `gcTime` in `defaultOptions.queries`  |

## Error strategy

| Need                                   | Where it goes                                                 |
| -------------------------------------- | ------------------------------------------------------------- |
| Loading and failure UI for one query   | `isPending` and `error` from the hook                         |
| A side effect on failure (toast, log)  | `useEffect` on `error` — v5 removed `onError` from `useQuery` |
| Every query's failures in one place    | `QueryCache.onError` in the QueryClient constructor           |
| Every mutation's failures in one place | `MutationCache.onError` in the QueryClient constructor        |
| Recovery from a thrown render          | `QueryErrorResetBoundary` wrapping an error boundary          |

</decision_framework>

---

<migration_notice>

## v4 → v5

**Removed:** `onSuccess`, `onError`, `onSettled` on `useQuery`. They remain on `useMutation`.

**Renamed:**

| v4                 | v5                                |
| ------------------ | --------------------------------- |
| `cacheTime`        | `gcTime`                          |
| `isLoading`        | `isPending`                       |
| `keepPreviousData` | `placeholderData: (prev) => prev` |

**New requirements:** `useInfiniteQuery` takes `initialPageParam`; server-side retry defaults to `0`
(was `3`); React 18.0+.

**Added:** `useSuspenseQuery`, `useSuspenseInfiniteQuery`, `useSuspenseQueries`, `useMutationState`,
the `queryOptions` helper for sharing a typed definition, and `maxPages` to cap what an infinite
query keeps.

</migration_notice>
