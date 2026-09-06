---
name: web-data-fetching-graphql-urql
description: URQL GraphQL client patterns — the exchange pipeline, document and normalized caching, queries, mutations, subscriptions, and authentication
---

# URQL Patterns

> **Quick Guide:** URQL is a small core plus a pipeline of exchanges, and almost every configuration
> question is really a question about that pipeline's order — synchronous exchanges before
> asynchronous ones, error handlers before what they catch, `fetchExchange` last. Caching is
> document-based by default, keyed on the query and its variables; normalized caching is an opt-in
> exchange. Hooks return a `[result, execute]` tuple, and the loading flag is `fetching`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — client and provider, `useQuery`, mutations, error handling, per-query context
- [examples/exchanges.md](examples/exchanges.md) — the full pipeline, Graphcache config, auth with refresh, retry, custom exchanges
- [examples/subscriptions.md](examples/subscriptions.md) — websocket setup, accumulating events, presence, cache updates from a subscription
- [examples/v6-features.md](examples/v6-features.md) — the GET default, `preferGetMethod`, and the v4 → v6 migration steps
- [reference.md](reference.md) — request policy and cache method tables, `CombinedError` shape, exchange catalogue

---

## Which path applies

- **Document caching** — the default `cacheExchange` from `urql`. A query plus its variables is one
  cache entry, and a mutation invalidates every entry whose result shared a `__typename` with it.
  Nothing to configure, and no way to edit the cache by hand.
- **Normalized caching** — the `cacheExchange` from `@urql/exchange-graphcache`, replacing the
  default one. Entities are stored once by key, so `keys`, `updates`, `resolvers` and `optimistic`
  become available and mutations can edit the cache precisely. Adds roughly 8KB.

Start with the document cache. Move to Graphcache when a mutation needs to change a list the server
did not return, or when you want optimistic updates.

---

<critical_requirements>

## Before writing URQL code

**Order the exchanges: error handling, then synchronous, then asynchronous, with `fetchExchange`
last.** An operation passes through them in array order, so a cache placed after a network exchange
never sees a request, and an error handler placed after `authExchange` never sees a failed refresh.

**Put `__typename` in every optimistic response, along with every field a query reads.** Graphcache
normalizes on `__typename` plus the key, and a field the optimistic object omits is a field the
watching query cannot render.

**Set `preferGetMethod` to what the server accepts.** From v6 the client sends queries under 2048
characters as GET; `false` forces POST for everything, and `"force"` sends GET regardless of length.

</critical_requirements>

---

**Auto-detection:** `urql`, `@urql/core`, `@urql/exchange-graphcache`, `cacheExchange`,
`fetchExchange`, `subscriptionExchange`, `mapExchange`, `ssrExchange`, `authExchange`,
`retryExchange`, `useQuery`, `useMutation`, `useSubscription`, `requestPolicy`, `preferGetMethod`,
`reexecuteQuery`, `CombinedError`, `wonka`

**Applies to:**

- The exchange pipeline, its order, and writing an exchange
- Document caching and normalized caching through Graphcache
- Queries, mutations, optimistic updates and cache edits after a write
- Real-time data over a subscription exchange
- Authentication with token refresh, and retry policy

**Handled elsewhere:**

- APIs addressed over REST — this client speaks one query language
- Designing the schema and its resolvers; this skill consumes a schema
- Client state that corresponds to no server field
- Where errors are shipped once `mapExchange` has caught them

---

<philosophy>

## Philosophy

The client itself does almost nothing: it turns a hook call into an operation and pushes it into a
stream. Everything that looks like a feature — caching, auth, retries, deduplication, subscriptions,
server rendering — is an exchange sitting in that stream, and every exchange sees the operation on
the way out and the result on the way back.

Two things follow. Behaviour is added by installing an exchange rather than by configuring the
client, so a project pays only for what it installs. And order is semantic rather than cosmetic: an
exchange can only act on what has already reached it.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Client setup

```typescript
import { Client, cacheExchange, fetchExchange } from "urql";

const client = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
  requestPolicy: "cache-first",
});
```

`<Provider value={client}>` above the tree is what the hooks read; without it they throw at the
first render rather than falling back to anything.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Queries

```typescript
const [result, reexecuteQuery] = useQuery<UsersData, UsersVariables>({
  query: USERS_QUERY,
  variables: { limit: DEFAULT_PAGE_SIZE },
  requestPolicy: "cache-and-network",
});

const { data, fetching, error, stale } = result;

if (fetching && !data) return <Skeleton />;
if (error && !data) return <Error message={error.message} />;
```

`fetching` is true for the first load and for every background refresh, so `fetching && !data` is
what distinguishes them. `stale` marks cached data being revalidated — an "updating" hint rather
than a spinner. `pause: !userId` holds a query back until its variables are real.

Default policy is `cache-first`; `cache-and-network` is the stale-while-revalidate one. The full
table is in [reference.md](reference.md).

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Mutations

```typescript
const [result, executeMutation] = useMutation<CreatePostData>(CREATE_POST);

const response = await executeMutation({ input });
if (response.error) return;
```

The execute function returns a promise carrying the result, so the error is handled at the call site
rather than in a callback. `result.fetching` is what disables the form while it is in flight.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: The exchange pipeline

```typescript
exchanges: [
  mapExchange, // errors, before anything whose failures it must see
  cacheExchange, // synchronous, so it can answer without a request
  authExchange, // headers, and refresh on a 401
  retryExchange, // network failures only
  fetchExchange, // always last
];
```

Full code: [examples/exchanges.md](examples/exchanges.md) — auth with token refresh, retry
configuration, TTL-based policy upgrades, and a custom exchange

---

### Pattern 5: Graphcache

```typescript
import { cacheExchange } from "@urql/exchange-graphcache";

cacheExchange({
  keys: { Product: (data) => data.sku as string },
  updates: {
    Mutation: {
      createTodo: (result, _args, cache) =>
        cache.updateQuery(/* add to the list */),
    },
  },
  optimistic: {
    toggleTodo: (args) => ({
      __typename: "Todo",
      id: args.id,
      completed: args.completed,
    }),
  },
});
```

Four keys, four jobs: `keys` says what identifies an entity, `updates` edits the cache after a
mutation or a subscription event, `resolvers` invents fields on read, and `optimistic` writes a
provisional entity into a separate layer that is discarded when the real result lands.

Full code: [examples/exchanges.md](examples/exchanges.md)

---

### Pattern 6: Subscriptions

```typescript
const [result] = useSubscription<NotificationData>({
  query: NOTIFICATION_SUBSCRIPTION,
  variables: { userId },
  pause: !userId,
});
```

Each event replaces `data` — accumulating a list takes the second argument, a handler that receives
the previous value and the new event. Unsubscription happens on unmount without any cleanup.

Full code: [examples/subscriptions.md](examples/subscriptions.md)

---

### Pattern 7: Error handling

`CombinedError` carries both kinds at once, and they mean different things: `networkError` is a
request that never completed, `graphQLErrors` is a response that arrived carrying failures.

```typescript
if (error?.networkError) {
  // nothing came back — offer a retry
}
if (error?.graphQLErrors.length) {
  // some fields failed; `data` may still hold the rest
}
if (data && error) {
  // render what arrived, with a warning
}
```

A single `if (error)` branch throws away a page that mostly worked.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 8: Per-query context

```typescript
const [result] = useQuery({
  query: ADMIN_DATA_QUERY,
  context: {
    fetchOptions: {
      headers: { "X-Admin-Token": process.env.ADMIN_TOKEN ?? "" },
    },
    url: process.env.ADMIN_GRAPHQL_URL ?? "",
    requestPolicy: "network-only",
  },
});
```

`context` overrides the client's own settings for one operation — including the URL, which is how a
second endpoint is reached without a second client.

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Hooks used with no `Provider` above them — they throw rather than degrading.
- `fetchExchange` before `cacheExchange` — every operation reaches the network and the cache is
  never read.
- `mapExchange` after `authExchange` — a failed token refresh passes it and reaches no handler.
- An optimistic response without `__typename` — normalization fails silently and the UI does not
  move.
- Rendering `data` with no `fetching` or `error` branch — the first render has neither.
- A server that rejects GET, on v6 with `preferGetMethod` left at its default — short queries fail
  and long ones succeed, which reads as an intermittent fault.

**Surprising behaviour:**

- `fetching` covers background refreshes too, so a bare `if (fetching)` blanks the screen on every
  revalidation.
- Document cache entries are keyed on query plus variables, so the same query with two variable sets
  is two entries that never share anything.
- Graphcache keys entities on `id` or `_id` — anything else needs a `keys` entry, and without one
  the entity is not normalized at all.
- An optimistic response missing a field some query reads leaves that query unable to render the
  entity.
- Retrying a GraphQL error achieves nothing, since the same request produces the same failure —
  `retryIf` should test `networkError`.
- There is no `pollInterval` option; TTL-based refresh comes from `requestPolicyExchange`.
- A subscription handler recreated on every render resubscribes on every render — memoize it.
- (v6) Queries under 2048 characters go out as GET, which puts the query text in URLs and logs.
- (v6.0.1) Fixed `preferGetMethod: false` being ignored — on 6.0.0 the opt-out does not take.
- (v5) `dedupExchange` was removed and deduplication moved into the core client; delete it from the
  array rather than replacing it.

</red_flags>
