# URQL GraphQL Client - Reference

> Decision frameworks, anti-patterns, and integration guides. See [SKILL.md](SKILL.md) for core concepts.

---

<decision_framework>

## Decision Framework

### When to Use URQL vs Alternatives

```
Is your API GraphQL?
├─ NO → Use your REST data fetching solution
└─ YES → Consider these factors:
    ├─ Bundle size critical? (~12KB core vs ~30KB+)
    │   └─ YES → URQL is lighter
    ├─ Need highly customizable middleware?
    │   └─ YES → URQL exchanges are more flexible
    ├─ Team already experienced with Apollo?
    │   └─ YES → Apollo may be faster to adopt
    ├─ Want to start simple, add complexity later?
    │   └─ YES → URQL's progressive enhancement fits
    └─ Need normalized caching from day one?
        └─ YES → Apollo has this by default (URQL needs Graphcache)
```

### Request Policy Selection

```
How should this query fetch data?
├─ Need freshest data always?
│   └─ requestPolicy: "network-only"
├─ Show cached, refresh in background?
│   └─ requestPolicy: "cache-and-network" (recommended)
├─ Fast response, cache is reliable?
│   └─ requestPolicy: "cache-first" (default)
├─ Only use cache, never fetch?
│   └─ requestPolicy: "cache-only"
└─ Fetch once, never refetch?
    └─ requestPolicy: "no-cache"
```

### Caching Strategy Selection

```
What caching do you need?
├─ Simple query caching (query + variables = cache key)?
│   └─ cacheExchange (default)
├─ Need normalized cache (entities stored once)?
│   └─ Graphcache - adds ~8KB to core
├─ Need offline support with persistence?
│   └─ offlineExchange from Graphcache
└─ No caching needed?
    └─ Remove cacheExchange, use fetchExchange only
```

### Exchange Selection

```
What functionality do you need?
├─ Authentication with token refresh?
│   └─ @urql/exchange-auth
├─ Retry failed network requests?
│   └─ @urql/exchange-retry
├─ Persisted queries / APQ?
│   └─ @urql/exchange-persisted
├─ TTL-based cache policy upgrades?
│   └─ @urql/exchange-request-policy
├─ WebSocket subscriptions?
│   └─ subscriptionExchange (built-in)
├─ Server-side rendering?
│   └─ ssrExchange (built-in)
└─ Custom logging/monitoring?
    └─ Create custom exchange or use mapExchange
```

### Cache Update Strategy After Mutation

```
How to update cache after mutation?
├─ Using document cache (default cacheExchange)?
│   └─ Cache auto-invalidates queries with matching __typename
├─ Using Graphcache (normalized)?
│   ├─ Simple entity update?
│   │   └─ Automatic normalization handles it
│   ├─ Need to add to list?
│   │   └─ Use updates config with cache.updateQuery
│   ├─ Need to remove from list?
│   │   └─ Use cache.invalidate in updates config
│   └─ Want instant UI feedback?
│       └─ Use optimistic config with __typename
└─ Complex cross-query updates?
    └─ Combine updates + optimistic configs
```

</decision_framework>

---

<anti_patterns>

## Anti-Patterns

### Wrong Exchange Order

Place synchronous exchanges before asynchronous. fetchExchange must be last.

```typescript
// WRONG - fetchExchange before cacheExchange
const client = new Client({
  url: "/graphql",
  exchanges: [fetchExchange, cacheExchange],
});

// CORRECT - cacheExchange before fetchExchange
const client = new Client({
  url: "/graphql",
  exchanges: [cacheExchange, fetchExchange],
});
```

### Missing Provider (v4+)

URQL v4+ requires Provider wrapper. Without it, hooks throw errors.

```typescript
// WRONG - hooks fail without Provider
function App() {
  return <UserList />;
}

// CORRECT - wrap with Provider
function App() {
  return (
    <Provider value={client}>
      <UserList />
    </Provider>
  );
}
```

### Missing __typename in Optimistic Responses

Graphcache needs `__typename` to normalize optimistic data correctly.

```typescript
// WRONG - missing __typename
optimistic: {
  updateTodo: (args) => ({
    id: args.id,
    completed: args.completed,
  }),
}

// CORRECT - include __typename
optimistic: {
  updateTodo: (args) => ({
    __typename: "Todo",
    id: args.id,
    completed: args.completed,
  }),
}
```

### Incomplete Optimistic Response Fields

Optimistic responses must include all fields that queries use.

```typescript
// WRONG - queries may use title, but optimistic is missing it
optimistic: {
  updateTodo: (args) => ({
    __typename: "Todo",
    id: args.id,
    completed: args.completed,
    // Missing title - queries using title won't update!
  }),
}

// CORRECT - include all fields queries might use
optimistic: {
  updateTodo: (args, cache) => {
    // Read existing data to preserve fields
    const existing = cache.readFragment(TODO_FRAGMENT, { id: args.id });
    return {
      __typename: "Todo",
      ...existing,
      ...args.input,
    };
  },
}
```

### mapExchange After authExchange

mapExchange needs to be before authExchange to catch auth refresh failures.

```typescript
// WRONG - mapExchange won't catch auth failures
exchanges: [
  cacheExchange,
  authExchange(/* ... */),
  mapExchange({ onError: /* ... */ }), // Too late!
  fetchExchange,
]

// CORRECT - mapExchange catches all errors including auth
exchanges: [
  mapExchange({ onError: /* ... */ }),
  cacheExchange,
  authExchange(/* ... */),
  fetchExchange,
]
```

### Not Handling All Query States

Always handle loading, error, and empty states explicitly.

```typescript
// WRONG - crashes when data is undefined
function BadUserList() {
  const [result] = useQuery({ query: USERS_QUERY });
  return result.data.users.map((u) => <li key={u.id}>{u.name}</li>);
}

// CORRECT - handle all states
function GoodUserList() {
  const [result] = useQuery({ query: USERS_QUERY });
  const { data, fetching, error } = result;

  if (fetching && !data) return <Skeleton />;
  if (error && !data) return <Error message={error.message} />;
  if (!data?.users?.length) return <EmptyState />;

  return data.users.map((u) => <li key={u.id}>{u.name}</li>);
}
```

### Ignoring Partial Errors

GraphQL allows partial data with errors. Don't discard useful data.

```typescript
// WRONG - ignores partial data
if (error) {
  return <ErrorPage />;
}

// CORRECT - show partial data with warning
if (error && !data) {
  return <ErrorPage />;
}
if (error && data) {
  return (
    <>
      <WarningBanner message="Some data unavailable" />
      <DataDisplay data={data} />
    </>
  );
}
```

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **fetchExchange before cacheExchange** - Cache is bypassed, all requests hit network
- **Missing Provider wrapper** - All hooks throw runtime errors (v4+)
- **Missing `__typename` in optimistic responses** - Graphcache normalization fails
- **Magic numbers for timeouts/retries** - Use named constants like `MAX_RETRY_ATTEMPTS`
- **Default exports** - Use named exports for tree-shaking

**Medium Priority Issues:**

- **mapExchange after authExchange** - Auth refresh failures not caught
- **Missing `pause` for conditional queries** - Unnecessary network requests
- **Not using `cache-and-network`** - Missing stale-while-revalidate UX
- **Incomplete optimistic response fields** - Queries may not update correctly
- **Not handling loading and error states** - Causes crashes and poor UX

**Common Mistakes:**

- Forgetting to run `graphql-codegen` after schema changes (if using codegen)
- Retrying GraphQL errors (they won't succeed on retry - only retry network errors)
- Using `network-only` for all queries (defeats caching benefits)
- Mixing up `stale` (background refresh) with `fetching` (any request in progress)
- Not using `reexecuteQuery` for user-triggered refresh

**Gotchas & Edge Cases:**

- `fetching` is true during both initial load AND background refresh - check `fetching && !data` for initial load only
- `stale` indicates cached data is being revalidated - show "updating" indicator
- Document cache uses query + variables hash - same query with different variables = different cache entry
- Graphcache stores entities by `id` or `_id` by default - configure `keys` for custom identifiers
- Optimistic responses are stored in separate layer - never pollute real cache
- Subscriptions auto-unsubscribe on component unmount - no manual cleanup needed
- `pollInterval` is not built-in - use `requestPolicyExchange` for TTL-based refresh
- Exchange order determines data flow - sync exchanges process operations first
- **v6.0.0 BREAKING:** Default behavior uses GET for queries under 2048 characters - set `preferGetMethod: false` if your server doesn't support GET (see [examples/v6-features.md](examples/v6-features.md))
- **v6.0.1:** Fixed `preferGetMethod: false` handling - now properly uses POST when explicitly set to false
- **v5.0.0 BREAKING:** `dedupExchange` was removed - deduplication is now built into the core client (no migration needed, just remove from exchanges array)

</red_flags>

---

## Request Policy Reference

| Policy | Cache Read | Network Request | Use Case |
|--------|------------|-----------------|----------|
| `cache-first` | Yes, first | Only on miss | Default for most queries |
| `cache-and-network` | Yes, show immediately | Always, in background | Stale-while-revalidate UX |
| `network-only` | After response | Always | Critical fresh data |
| `cache-only` | Yes | Never | Offline-first apps |

---

## CombinedError Structure

URQL unifies network and GraphQL errors:

```typescript
interface CombinedError extends Error {
  // Network-level error (fetch failed, timeout, etc.)
  networkError?: Error;
  // GraphQL errors from API response
  graphQLErrors: GraphQLError[];
  // Original response (if available)
  response?: Response;
}

// Both can coexist - GraphQL allows partial failures
if (error?.networkError) {
  // Network failed entirely
}
if (error?.graphQLErrors.length) {
  // Some fields failed, data may be partial
}
```

---

## Graphcache Cache Methods Reference

| Method | Purpose | Example |
|--------|---------|---------|
| `cache.updateQuery` | Update entire query result | Add item to list |
| `cache.readFragment` | Read single entity | Get current entity state |
| `cache.writeFragment` | Write single entity | Update entity fields |
| `cache.invalidate` | Remove entity from cache | Delete entity |
| `cache.inspectFields` | List cached fields | Debug cache state |
| `cache.resolve` | Resolve field value | Read computed fields |
| `cache.link` | Read entity reference | Get linked entities |

---

## URQL vs Apollo Quick Comparison

| Feature | URQL | Apollo Client |
|---------|------|---------------|
| Bundle size | ~12KB (core), ~20KB (+ Graphcache) | ~30KB+ |
| Default cache | Document (hash-based) | Normalized |
| Architecture | Exchange-based middleware | Monolithic with links |
| Philosophy | Start simple, add features | Full-featured from start |
| Normalized cache | Opt-in via Graphcache | Built-in |
| Offline support | Graphcache offlineExchange | Apollo Offline |
| Suspense support | First-class | Experimental |
| Framework bindings | React, Vue, Svelte, Solid | React (primary) |

---

## Hook Comparison: URQL vs Apollo

```typescript
// Apollo
const { data, loading, error, refetch } = useQuery(QUERY);

// URQL
const [{ data, fetching, error, stale }, reexecuteQuery] = useQuery({ query: QUERY });

// Key differences:
// - URQL uses tuple return [result, reexecute]
// - URQL uses `fetching` instead of `loading`
// - URQL adds `stale` for cache-and-network
// - Apollo uses `refetch`, URQL uses `reexecuteQuery`
```

---

## Sources

- [URQL Official Documentation](https://nearform.com/open-source/urql/)
- [URQL GitHub Repository](https://github.com/urql-graphql/urql)
- [Graphcache Documentation](https://nearform.com/open-source/urql/docs/graphcache/)
- [URQL Architecture Documentation](https://github.com/urql-graphql/urql/blob/main/docs/architecture.md)
- [Authentication Guide](https://nearform.com/open-source/urql/docs/advanced/authentication/)
- [Server-Side Rendering Guide](https://nearform.com/open-source/urql/docs/advanced/server-side-rendering/)
- [Testing Guide](https://nearform.com/open-source/urql/docs/advanced/testing/)
- [Authoring Exchanges Guide](https://nearform.com/open-source/urql/docs/advanced/authoring-exchanges/)
- [Exploring GraphQL Clients: Apollo vs Relay vs URQL (Hasura)](https://hasura.io/blog/exploring-graphql-clients-apollo-client-vs-relay-vs-urql)
