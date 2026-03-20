---
name: web-data-fetching-graphql-urql
description: URQL GraphQL client patterns - useQuery, useMutation, exchange architecture, caching strategies, subscriptions
---

# URQL GraphQL Client Patterns

> **Quick Guide:** Use URQL for GraphQL APIs when you need a lightweight, customizable client with exchange-based architecture. Start minimal with document caching, add normalized caching via Graphcache when needed. Bundle size is ~12KB gzipped (core), ~20KB with Graphcache. Exchange order is critical: synchronous exchanges before asynchronous, fetchExchange always last. v6+ defaults to GET for small queries - set `preferGetMethod: false` if your server only supports POST. **Current version: @urql/core v6.0.1 (urql v5.0.1)**

---

<critical_requirements>

## CRITICAL: Before Using This Skill

**(You MUST configure exchange order correctly - synchronous exchanges (cacheExchange) before asynchronous (fetchExchange))**

**(You MUST include `__typename` in optimistic responses for Graphcache cache normalization)**

**(You MUST set `preferGetMethod: false` if your GraphQL server does NOT support GET requests - v6+ defaults to GET for queries under 2048 characters)**

</critical_requirements>

---

**Auto-detection:** URQL, urql, useQuery, useMutation, useSubscription, cacheExchange, fetchExchange, Graphcache, exchanges, gql, Client

**When to use:**

- Fetching data from GraphQL APIs
- Applications needing lightweight GraphQL client (~12KB core)
- Projects requiring customizable middleware via exchanges
- Progressive enhancement: start simple, add complexity as needed
- Real-time updates with GraphQL subscriptions

**When NOT to use:**

- REST APIs (use your data fetching solution instead)
- When team already has Apollo Client expertise and no bundle concerns
- Simple APIs without caching needs (consider fetch directly)

**Key patterns covered:**

- Client setup with exchange pipeline
- useQuery for queries with loading, error, and data states
- useMutation with optimistic updates via Graphcache
- useSubscription for real-time WebSocket data
- Exchange architecture and custom exchanges
- Document caching vs normalized caching (Graphcache)
- Request policies and caching strategies
- Authentication with authExchange

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Client setup, useQuery, useMutation, error handling
- [examples/exchanges.md](examples/exchanges.md) - Exchange architecture, Graphcache, auth, retry
- [examples/subscriptions.md](examples/subscriptions.md) - Real-time WebSocket subscriptions
- [examples/v6-features.md](examples/v6-features.md) - v6 breaking changes, GET behavior, migration
- [reference.md](reference.md) - Decision frameworks, anti-patterns, API reference

---

<philosophy>

## Philosophy

URQL follows the principle of **progressive enhancement**. The core package provides document caching and basic fetching, while advanced features like normalized caching, authentication, and offline support are added through exchanges.

**Core Principles:**

1. **Minimal by Default**: Start with ~12KB core, add features as needed
2. **Exchange-Based Architecture**: Middleware-style plugins for extensibility
3. **Stream-Based Operations**: All operations are Observable streams via Wonka
4. **Document Caching Default**: Simple query+variables hash caching, opt-in normalized cache

**URQL's Data Flow:**

1. Component requests data via useQuery/useMutation
2. Operation flows through exchange pipeline (cache -> auth -> retry -> fetch)
3. Each exchange can inspect, modify, or short-circuit the operation
4. Results flow back through exchanges in reverse
5. Multiple results can emit over time (cache update triggers new emission)

**Three Architectural Layers:**

1. **Bindings** - Framework integrations (React, Vue, Svelte, Solid)
2. **Client** - Core engine managing operations and coordinating exchanges
3. **Exchanges** - Plugins providing functionality (caching, fetching, auth)

</philosophy>

---

<patterns>

## Core Patterns

### Client Setup

Configure the Client with exchanges in the correct order. Sync exchanges (cacheExchange) before async (fetchExchange).

```typescript
import { Client, cacheExchange, fetchExchange } from "urql";

const client = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
});
```

Wrap your app with `<Provider value={client}>` to enable hooks. See [examples/core.md](examples/core.md) for full setup.

---

### useQuery

Returns a `[result, reexecuteQuery]` tuple. Always handle all states: `fetching`, `error`, `data`.

```typescript
const [result, reexecuteQuery] = useQuery<UsersData, UsersVariables>({
  query: USERS_QUERY,
  variables: { limit: DEFAULT_PAGE_SIZE },
  requestPolicy: "cache-and-network",
});

const { data, fetching, error, stale } = result;

if (fetching && !data) return <Skeleton />; // Initial load only
if (error && !data) return <Error message={error.message} />;
```

Key: check `fetching && !data` for initial load vs background refresh. Use `pause: !userId` for conditional queries. See [examples/core.md](examples/core.md) for full examples.

---

### useMutation

Returns a `[result, executeMutation]` tuple. The execute function returns a Promise.

```typescript
const [result, executeMutation] = useMutation<CreatePostData>(CREATE_POST);

const response = await executeMutation({ input });
if (response.error) {
  // Handle error
  return;
}
```

Disable form inputs during `result.fetching`. See [examples/core.md](examples/core.md) for create/update/delete patterns.

---

### Exchange Pipeline

Exchanges are middleware that process operations and results. Order matters critically.

```typescript
exchanges: [
  mapExchange, // 1. Error handling (catches all errors)
  cacheExchange, // 2. Sync cache (fast path)
  authExchange, // 3. Auth headers
  retryExchange, // 4. Retry logic
  fetchExchange, // 5. Network (always last)
];
```

See [examples/exchanges.md](examples/exchanges.md) for auth, retry, Graphcache, and custom exchange patterns.

---

### Graphcache (Normalized Caching)

Upgrade from document cache to normalized cache when you need automatic entity deduplication, optimistic updates, or cache manipulation after mutations.

```typescript
import { cacheExchange } from "@urql/exchange-graphcache";

cacheExchange({
  keys: { Product: (data) => data.sku as string },
  updates: {
    Mutation: {
      createTodo: (result, _args, cache) => {
        /* update list */
      },
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

Always include `__typename` in optimistic responses. See [examples/exchanges.md](examples/exchanges.md) for full Graphcache configuration.

---

### Request Policies

| Policy              | Behavior                                         | Use Case               |
| ------------------- | ------------------------------------------------ | ---------------------- |
| `cache-first`       | Return cached if available, else fetch (default) | Most queries           |
| `cache-only`        | Only return cached, never fetch                  | Offline-first          |
| `network-only`      | Always fetch, skip cache read                    | Critical fresh data    |
| `cache-and-network` | Return cached immediately, then fetch and update | Stale-while-revalidate |

Use `cache-and-network` for best UX in most cases. Force refetch with `reexecuteQuery({ requestPolicy: "network-only" })`.

---

### Subscriptions

Real-time data via WebSocket using `subscriptionExchange` with `graphql-ws`.

```typescript
const [result] = useSubscription<NotificationData>({
  query: NOTIFICATION_SUBSCRIPTION,
  variables: { userId },
  pause: !userId,
});
```

Subscriptions auto-unsubscribe on unmount. Accumulate events with a reducer and memoized handler. See [examples/subscriptions.md](examples/subscriptions.md) for setup and advanced patterns.

---

### Error Handling

URQL wraps all errors in `CombinedError`, which can contain both `networkError` and `graphQLErrors`. GraphQL allows partial data with errors - don't discard useful data.

```typescript
if (error?.networkError) {
  // Network failed entirely - show retry
}
if (error?.graphQLErrors.length) {
  // Some fields failed, data may be partial
}
if (data && error) {
  // Show partial data with warning banner
}
```

See [examples/core.md](examples/core.md) for component-level error handling patterns.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **fetchExchange before cacheExchange** - Cache is bypassed, all requests hit network
- **Missing Provider wrapper** - All hooks throw runtime errors (v4+)
- **Missing `__typename` in optimistic responses** - Graphcache normalization fails silently
- **mapExchange after authExchange** - Auth refresh failures not caught by error handler

**Medium Priority Issues:**

- **Missing `pause` for conditional queries** - Unnecessary network requests with undefined variables
- **Not using `cache-and-network`** - Missing stale-while-revalidate UX benefit
- **Incomplete optimistic response fields** - Queries referencing missing fields won't update
- **Not handling all query states** - Crashes when `data` is undefined

**Gotchas & Edge Cases:**

- `fetching` is true during both initial load AND background refresh - check `fetching && !data` for initial load only
- `stale` indicates cached data is being revalidated - show "updating" indicator, don't show spinner
- Document cache uses query + variables hash - same query with different variables = different cache entry
- Graphcache stores entities by `id` or `_id` by default - configure `keys` for custom identifiers
- Optimistic responses are stored in a separate layer - never pollute real cache
- Subscriptions auto-unsubscribe on component unmount - no manual cleanup needed
- `pollInterval` is not built-in - use `requestPolicyExchange` for TTL-based refresh
- Retrying GraphQL errors is pointless (they won't succeed on retry) - only retry network errors
- **v6 BREAKING:** Default uses GET for queries under 2048 characters - set `preferGetMethod: false` if server only supports POST
- **v6.0.1:** Fixed `preferGetMethod: false` being ignored (nullish coalescing fix)
- **v5 BREAKING:** `dedupExchange` removed - deduplication is built into the core client (just remove from exchanges array)

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

**(You MUST configure exchange order correctly - synchronous exchanges (cacheExchange) before asynchronous (fetchExchange))**

**(You MUST include `__typename` in optimistic responses for Graphcache cache normalization)**

**(You MUST set `preferGetMethod: false` if your GraphQL server does NOT support GET requests - v6+ defaults to GET for queries under 2048 characters)**

**Failure to follow these rules will cause cache corruption, stale data, and production bugs.**

</critical_reminders>
