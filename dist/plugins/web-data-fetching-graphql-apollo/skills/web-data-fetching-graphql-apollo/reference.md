# Apollo Client — Reference

> Lookup tables and the v3 → v4 map. See [SKILL.md](SKILL.md) for the decisions and the red flags,
> and [examples/](examples/) for full code.

---

## Fetch policies

| Policy              | Network request | Cache read         | For                      |
| ------------------- | --------------- | ------------------ | ------------------------ |
| `cache-first`       | Only on a miss  | Yes, first         | Default for most queries |
| `cache-and-network` | Always          | Yes, shown at once | Stale-while-revalidate   |
| `network-only`      | Always          | After the response | Data that must be fresh  |
| `no-cache`          | Always          | Never              | One-off reads            |
| `cache-only`        | Never           | Yes                | Offline or pre-seeded    |
| `standby`           | Manual only     | Yes                | Dependent queries        |

## Error policies

| Policy           | GraphQL errors      | Partial data | For                      |
| ---------------- | ------------------- | ------------ | ------------------------ |
| `none` (default) | Thrown              | Discarded    | Strict data requirements |
| `all`            | In the `error` prop | Kept         | Graceful degradation     |
| `ignore`         | Dropped             | Kept         | Non-critical errors      |

## Network status

| Status         | Value | Meaning               |
| -------------- | ----- | --------------------- |
| `loading`      | 1     | Initial load          |
| `setVariables` | 2     | Variables changed     |
| `fetchMore`    | 3     | Fetching another page |
| `refetch`      | 4     | Refetching            |
| `poll`         | 6     | Polling update        |
| `ready`        | 7     | Complete              |
| `error`        | 8     | Failed                |

Reaching these requires `notifyOnNetworkStatusChange: true` — the v3 default is `false`, the v4
default is `true`.

## Cache methods

| Method                | Does                               | Typical use                |
| --------------------- | ---------------------------------- | -------------------------- |
| `cache.readQuery`     | Reads a whole query result         | Get the current list       |
| `cache.writeQuery`    | Replaces a whole query result      | Seed a cache in a test     |
| `cache.readFragment`  | Reads one entity                   | Get one user               |
| `cache.writeFragment` | Writes one entity                  | Patch one user             |
| `cache.modify`        | Edits named fields in place        | Add to or filter a list    |
| `cache.evict`         | Drops an entry                     | Delete an entity           |
| `cache.gc`            | Collects orphaned references       | Always, after an evict     |
| `cache.identify`      | Returns the cache id, `"User:123"` | Build an argument to evict |

---

<migration_notice>

## v3 → v4

Released September 2025. `npx @apollo/client-codemod-migrate-3-to-4` performs the mechanical part.

| Area                          | v3                      | v4                                                         |
| ----------------------------- | ----------------------- | ---------------------------------------------------------- |
| React hook imports            | `@apollo/client`        | `@apollo/client/react`                                     |
| Client endpoint               | `uri` on the client     | An explicit `HttpLink`                                     |
| Client awareness              | `name` / `version`      | `clientAwareness: { name, version }`                       |
| `notifyOnNetworkStatusChange` | Defaults `false`        | Defaults `true`                                            |
| Errors                        | `ApolloError`           | `CombinedGraphQLErrors`, `ServerError`, `ServerParseError` |
| Observables                   | `zen-observable`        | `rxjs`, as a peer dependency                               |
| Link creation                 | `createHttpLink()`      | `new HttpLink()`                                           |
| Link composition              | `from`/`concat`/`split` | The same names as statics on `ApolloLink`                  |
| Devtools                      | `connectToDevTools`     | `devtools: { enabled: true }`                              |
| Local resolvers               | `resolvers` on client   | A `LocalState` instance                                    |

`useMutation` also enforces required variables at the call site in v4.

### `dataState`

```typescript
const { data, dataState } = useQuery(GET_USER);
// "empty" | "partial" | "streaming" | "complete" — narrows `data` where it is "complete"
```

### Error type guards

```typescript
import { CombinedGraphQLErrors, ServerError } from "@apollo/client";

if (CombinedGraphQLErrors.is(error))
  error.errors.forEach(({ message }) => report(message));
if (ServerError.is(error)) report(`Server responded with ${error.statusCode}`);
```

</migration_notice>

---

## Sources

- [Apollo Client documentation](https://www.apollographql.com/docs/react/)
- [Apollo Client 4 migration guide](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration)
- [Advanced caching topics](https://www.apollographql.com/docs/react/caching/advanced-topics)
- [Optimistic UI](https://www.apollographql.com/docs/react/performance/optimistic-ui)
- [Cursor-based pagination](https://www.apollographql.com/docs/react/pagination/cursor-based)
- [Mutations](https://www.apollographql.com/docs/react/data/mutations)
- [Subscriptions](https://www.apollographql.com/docs/react/data/subscriptions)
- [Local state with reactive variables](https://www.apollographql.com/blog/apollo-client/caching/local-state-management-with-reactive-variables/)
- [Fragment colocation](https://www.apollographql.com/blog/optimizing-data-fetching-with-apollo-client-leveraging-usefragment-and-colocated-fragments)
- [Suspense](https://www.apollographql.com/docs/react/data/suspense)
- [Code generation](https://www.apollographql.com/docs/react/development-testing/graphql-codegen)
