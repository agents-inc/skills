# URQL — Reference

> Lookup tables and API shapes. See [SKILL.md](SKILL.md) for the decisions and the red flags, and
> [examples/](examples/) for full code.

---

## Request policies

| Policy              | Cache read         | Network request       | For                     |
| ------------------- | ------------------ | --------------------- | ----------------------- |
| `cache-first`       | Yes, first         | Only on a miss        | The default             |
| `cache-and-network` | Yes, shown at once | Always, in background | Stale-while-revalidate  |
| `network-only`      | After the response | Always                | Data that must be fresh |
| `cache-only`        | Yes                | Never                 | Offline-first           |

Force a refresh with `reexecuteQuery({ requestPolicy: "network-only" })`.

## Exchanges

| Exchange                | From                            | Does                                           |
| ----------------------- | ------------------------------- | ---------------------------------------------- |
| `cacheExchange`         | `urql`                          | Document caching                               |
| `fetchExchange`         | `urql`                          | HTTP requests — always last                    |
| `subscriptionExchange`  | `urql`                          | Routes subscriptions to a socket               |
| `mapExchange`           | `urql`                          | Inspects or rewrites operations and results    |
| `ssrExchange`           | `urql`                          | Server rendering and hydration                 |
| `cacheExchange`         | `@urql/exchange-graphcache`     | Normalized caching, replacing the document one |
| `offlineExchange`       | `@urql/exchange-graphcache`     | Persistence and offline replay                 |
| `authExchange`          | `@urql/exchange-auth`           | Auth headers and token refresh                 |
| `retryExchange`         | `@urql/exchange-retry`          | Retries with backoff                           |
| `persistedExchange`     | `@urql/exchange-persisted`      | Persisted queries / APQ                        |
| `requestPolicyExchange` | `@urql/exchange-request-policy` | Upgrades a policy after a TTL                  |

## Graphcache methods

| Method                | Does                           | Typical use                  |
| --------------------- | ------------------------------ | ---------------------------- |
| `cache.updateQuery`   | Rewrites a whole query result  | Add an item to a list        |
| `cache.readFragment`  | Reads one entity               | Fill in an optimistic object |
| `cache.writeFragment` | Writes one entity              | Patch fields                 |
| `cache.invalidate`    | Drops an entity                | After a delete               |
| `cache.inspectFields` | Lists the cached fields        | Debugging                    |
| `cache.resolve`       | Resolves one field's value     | Read a computed field        |
| `cache.link`          | Reads a link to another entity | Walk a relation              |

---

## CombinedError

```typescript
interface CombinedError extends Error {
  networkError?: Error; // the request did not complete
  graphQLErrors: GraphQLError[]; // the response arrived carrying failures
  response?: Response;
}
```

Both can be populated at once, and `data` can be populated alongside them — GraphQL returns partial
results.

## Hook return shape

```typescript
const [{ data, fetching, error, stale }, reexecuteQuery] = useQuery({
  query: QUERY,
});
```

A tuple rather than an object; `fetching` rather than `loading`; `stale` for a cache-and-network
refresh in progress.

## Characteristics

| Feature          | URQL                                     |
| ---------------- | ---------------------------------------- |
| Bundle size      | ~12KB core, ~20KB with Graphcache        |
| Default cache    | Document, keyed on query + variables     |
| Architecture     | Exchange middleware over streams (wonka) |
| Normalized cache | Opt-in, through Graphcache               |
| Offline support  | Graphcache `offlineExchange`             |
| Suspense         | First-class                              |
| Bindings         | React, Vue, Svelte, Solid                |

---

## Sources

- [URQL documentation](https://nearform.com/open-source/urql/)
- [URQL repository](https://github.com/urql-graphql/urql)
- [Graphcache](https://nearform.com/open-source/urql/docs/graphcache/)
- [Architecture](https://github.com/urql-graphql/urql/blob/main/docs/architecture.md)
- [Authentication](https://nearform.com/open-source/urql/docs/advanced/authentication/)
- [Server-side rendering](https://nearform.com/open-source/urql/docs/advanced/server-side-rendering/)
- [Testing](https://nearform.com/open-source/urql/docs/advanced/testing/)
- [Authoring exchanges](https://nearform.com/open-source/urql/docs/advanced/authoring-exchanges/)
