---
name: web-data-fetching-graphql-apollo
description: Apollo Client GraphQL patterns - useQuery, useMutation, cache management, optimistic updates, subscriptions
---

# Apollo Client GraphQL Patterns

> **Quick Guide:** Use Apollo Client for GraphQL APIs. Provides automatic normalized caching, optimistic updates, and real-time subscriptions. Always use GraphQL Codegen for type safety. Configure `keyFields` on every entity type for proper cache normalization. Use `errorPolicy: "all"` for graceful degradation. **v3.9+** adds Suspense hooks; **v4.0** moves React imports to `@apollo/client/react` and adds `dataState` for type-safe query state.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

**(You MUST use GraphQL Codegen for type generation - NEVER write manual TypeScript types for GraphQL)**

**(You MUST include `__typename` and `id` in all optimistic responses for cache normalization)**

**(You MUST configure type policies with appropriate `keyFields` for every entity type)**

**(You MUST use named constants for ALL timeout, retry, and polling values - NO magic numbers)**

</critical_requirements>

---

**Auto-detection:** Apollo Client, useQuery, useMutation, useSubscription, useSuspenseQuery, useLoadableQuery, useBackgroundQuery, useFragment, ApolloClient, InMemoryCache, gql, GraphQL, optimistic updates, cache policies, createQueryPreloader

**When to use:**

- Fetching data from GraphQL APIs
- Real-time updates with GraphQL subscriptions
- Complex cache management with normalized data
- Optimistic UI updates for mutations
- Applications already using a GraphQL server

**When NOT to use:**

- REST APIs (use your data fetching solution instead)
- Simple APIs without caching needs (consider fetch directly)
- When GraphQL Codegen cannot be integrated

**Key patterns covered:**

- Client setup with InMemoryCache and type policies
- useQuery / useLazyQuery for queries with loading, error, and data states
- useMutation with optimistic updates, cache.modify, and cache.evict
- useSubscription for real-time WebSocket data
- Pagination with fetchMore and relayStylePagination
- Fragment colocation and useFragment
- Reactive variables for local client state
- Suspense hooks: useSuspenseQuery, useLoadableQuery, useBackgroundQuery, createQueryPreloader

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Client setup, useQuery, useMutation with cache updates
- [examples/pagination.md](examples/pagination.md) - Infinite scroll, relay pagination type policies
- [examples/fragments.md](examples/fragments.md) - Fragment definitions, composition, colocation
- [examples/error-handling.md](examples/error-handling.md) - Component-level and global error handling
- [examples/subscriptions.md](examples/subscriptions.md) - WebSocket link setup, useSubscription with cache updates
- [examples/testing.md](examples/testing.md) - MockedProvider, component tests, schema-based testing
- [examples/suspense.md](examples/suspense.md) - v3.9+ Suspense hooks (useSuspenseQuery, useLoadableQuery, useBackgroundQuery)
- [reference.md](reference.md) - Decision frameworks, API reference tables, anti-patterns

---

<philosophy>

## Philosophy

Apollo Client is a comprehensive GraphQL client that provides intelligent normalized caching, reducing redundant network requests and keeping your UI consistent across components.

**Core Principles:**

1. **Normalized Cache**: Data is stored once by type and ID, referenced everywhere - update in one place, UI reflects everywhere
2. **Declarative Data Fetching**: Components declare what data they need via GraphQL, Apollo handles caching, deduplication, and network
3. **Optimistic UI**: Show expected results immediately, rollback automatically on server error
4. **Type Safety**: GraphQL Codegen generates TypeScript types from your schema - never write response types manually

**Data Flow:**

1. Component requests data via useQuery/useMutation
2. Apollo checks InMemoryCache (normalized by `__typename` + `keyFields`)
3. If cache miss or stale, fetches from network
4. Response is normalized and stored in cache
5. All components watching that data re-render automatically

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client Setup and Configuration

Configure ApolloClient with InMemoryCache, type policies for cache normalization, and link chain for error handling and auth. Environment variables should use your framework's convention for the GraphQL endpoint.

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    User: { keyFields: ["id"] },
    Product: { keyFields: ["sku"] }, // Non-default identifier
    CartItem: { keyFields: false }, // Embed in parent, don't normalize
    Query: {
      fields: {
        usersConnection: relayStylePagination(["filter"]),
      },
    },
  },
});
```

**Key decisions:** `keyFields` determines how entities are identified in cache. Use `["id"]` (default), custom field like `["sku"]`, composite `["authorId", "postId"]`, or `false` for embedded types.

See [examples/core.md](examples/core.md) Pattern 1 for complete client setup with auth link, error link, and codegen configuration.

---

### Pattern 2: useQuery for Data Fetching

Declare data requirements with `useQuery`. Always handle loading, error, and empty states. Use `cache-and-network` for stale-while-revalidate behavior.

```typescript
const { data, loading, error, refetch } = useQuery<GetUsersQuery, GetUsersQueryVariables>(
  GET_USERS,
  {
    variables: { limit: DEFAULT_PAGE_SIZE },
    fetchPolicy: "cache-and-network",
    skip: !shouldFetch,
  }
);

if (loading && !data) return <Skeleton />;
if (error) return <Error message={error.message} onRetry={() => refetch()} />;
if (!data?.users?.length) return <EmptyState />;
```

**Why this pattern:** `loading && !data` shows skeleton only on initial load (not background refetch). `cache-and-network` shows cached data immediately while refreshing from network.

See [examples/core.md](examples/core.md) Pattern 2 for complete useQuery and useLazyQuery examples.

---

### Pattern 3: useMutation with Optimistic Updates and Cache Updates

For mutations, decide between three cache update strategies: optimistic response (instant UI), `update` callback with `cache.modify` (manual cache update), or `refetchQueries` (simple but costs a network request).

```typescript
const [createPost] = useMutation(CREATE_POST, {
  optimisticResponse: {
    createPost: {
      __typename: "Post", // REQUIRED for normalization
      id: `temp-${Date.now()}`, // Temporary ID, replaced by server response
      title,
      content,
    },
  },
  update(cache, { data }) {
    cache.modify({
      fields: {
        posts(existing = [], { toReference }) {
          return [toReference(data.createPost), ...existing];
        },
      },
    });
  },
});
```

**Critical:** Always include `__typename` and `id` in optimistic responses. For deletes, use `cache.evict()` + `cache.gc()`. For simple cases, `refetchQueries` is fine.

See [examples/core.md](examples/core.md) Pattern 3 for create, update, and delete mutation examples.

---

### Pattern 4: Cache Type Policies

Type policies control how Apollo normalizes and retrieves cached data. This is where you configure cache identifiers, computed fields, pagination merging, and local state.

```typescript
typePolicies: {
  User: {
    keyFields: ["id"],
    fields: {
      fullName: {
        read(_, { readField }) {
          return `${readField("firstName")} ${readField("lastName")}`;
        },
      },
    },
  },
  Query: {
    fields: {
      isLoggedIn: { read() { return isLoggedInVar(); } },
    },
  },
}
```

**Key patterns:** `keyFields` for identification, `merge` for pagination, `read` for computed/local fields, `keyArgs` for separating cache entries per filter.

See [examples/core.md](examples/core.md) Pattern 1 and [examples/pagination.md](examples/pagination.md) for type policy examples.

---

### Pattern 5: Pagination with fetchMore

Two approaches: **Relay-style** (cursor-based, use `relayStylePagination`) and **offset-based** (custom merge/read functions). Both require type policies for merging.

```typescript
const { data, fetchMore } = useQuery(GET_USERS_CONNECTION, {
  variables: { first: PAGE_SIZE },
});

const loadMore = () =>
  fetchMore({
    variables: { after: data.usersConnection.pageInfo.endCursor },
  });
```

**Key requirement:** `keyArgs` must be set to separate cache entries per filter. Without it, different filtered queries overwrite each other.

See [examples/pagination.md](examples/pagination.md) for infinite scroll with IntersectionObserver and custom offset pagination type policies.

---

### Pattern 6: Fragment Colocation

Colocate data requirements with components using fragments. Parent queries include child fragments, so component changes don't require updating parent queries.

```typescript
const USER_CARD_FRAGMENT = gql`
  fragment UserCard on User {
    id
    name
    email
    avatar
  }
`;

// Parent query includes child fragment
const GET_USERS = gql`
  query GetUsers {
    users {
      ...UserCard
    }
  }
  ${UserCard.fragments.user}
`;
```

See [examples/fragments.md](examples/fragments.md) for fragment composition and [examples/core.md](examples/core.md) Pattern 2 for fragments in queries.

---

### Pattern 7: Subscriptions for Real-Time Data

Requires split link configuration: WebSocket for subscriptions, HTTP for queries/mutations. Use `graphql-ws` (not the deprecated `subscriptions-transport-ws`).

```typescript
const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return (
      def.kind === "OperationDefinition" && def.operation === "subscription"
    );
  },
  wsLink,
  httpLink,
);
```

**Important:** Only create `wsLink` on the client side (`typeof window !== "undefined"`). Update cache in `onData` callback.

See [examples/subscriptions.md](examples/subscriptions.md) for complete WebSocket setup and useSubscription with cache updates.

---

### Pattern 8: Local State with Reactive Variables

Use `makeVar` for simple client-side state that integrates with Apollo's reactivity system. Suitable for theme, auth status, cart items - not complex state.

```typescript
const cartItemsVar = makeVar<string[]>([]);
const addToCart = (id: string) => cartItemsVar([...cartItemsVar(), id]);

// Component reacts automatically
const cartItems = useReactiveVar(cartItemsVar);
```

**When to use reactive vars vs external state management:** Reactive vars for simple Apollo-integrated state. For complex non-GraphQL state, use your client state management solution.

---

### Pattern 9: Suspense Hooks (v3.9+)

Four Suspense-enabled hooks for different loading patterns:

| Hook                   | Trigger          | Use Case                     |
| ---------------------- | ---------------- | ---------------------------- |
| `useSuspenseQuery`     | Component mount  | Standard data loading        |
| `useLoadableQuery`     | User interaction | Hover/click prefetch         |
| `useBackgroundQuery`   | Parent mount     | Parent triggers, child reads |
| `createQueryPreloader` | Route transition | Router loader integration    |

**Key difference from useQuery:** No `loading` state - component suspends instead. Errors throw to Error Boundary.

See [examples/suspense.md](examples/suspense.md) for complete examples of all four patterns.

---

### Pattern 10: useFragment for Data Masking (v3.8+)

Read fragment data directly from cache with automatic updates. Useful for components that only need a subset of cached entity data.

```typescript
const { data: user, complete } = useFragment({
  fragment: USER_CARD_FRAGMENT,
  from: userRef,
});
if (!complete) return <Skeleton />;
```

**Why useful:** Reads directly from cache without additional queries, `complete` flag indicates if all fragment fields are available.

</patterns>

---

<version_migration>

## Apollo Client v4 Migration Notes

**Apollo Client v4** (released September 2025, latest v4.1.6) introduces significant breaking changes. A codemod handles most mechanical changes: `npx @apollo/client-codemod-migrate-3-to-4`

### Breaking Changes Summary

| Change                        | v3                    | v4                                                         |
| ----------------------------- | --------------------- | ---------------------------------------------------------- |
| React hook imports            | `@apollo/client`      | `@apollo/client/react`                                     |
| Client `uri` option           | Allowed directly      | Must use explicit `HttpLink`                               |
| `name`/`version`              | Top-level on client   | `clientAwareness: { name, version }`                       |
| `notifyOnNetworkStatusChange` | Default `false`       | Default `true`                                             |
| Error classes                 | `ApolloError`         | `CombinedGraphQLErrors`, `ServerError`, `ServerParseError` |
| Observable library            | `zen-observable`      | `rxjs` (peer dependency)                                   |
| Link creation                 | `createHttpLink()`    | `new HttpLink()` (class-based)                             |
| `from()`/`concat()`/`split()` | Standalone functions  | `ApolloLink.from()` static methods                         |
| `connectToDevTools`           | Client option         | Replaced by `devtools: { enabled: true }`                  |
| Local resolvers               | `resolvers` on client | Explicit `LocalState` class                                |

### New: `dataState` Property (v4)

```typescript
const { data, dataState } = useQuery(GET_USER);
// dataState: "empty" | "partial" | "streaming" | "complete"
if (dataState === "complete") {
  // TypeScript knows data is fully populated
}
```

### New: Error Type Guards (v4)

```typescript
import { CombinedGraphQLErrors, ServerError } from "@apollo/client";

if (CombinedGraphQLErrors.is(error)) {
  error.errors.forEach(({ message }) => console.error(message));
}
if (ServerError.is(error)) {
  console.error(`Server responded with ${error.statusCode}`);
}
```

See [Apollo Client 4 Migration Guide](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration) for complete details.

</version_migration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Manual GraphQL type definitions** - Use GraphQL Codegen; manual types drift from schema causing runtime errors
- **Missing `__typename` in optimistic responses** - Cache normalization fails silently
- **Missing `id` in query responses** - Apollo cannot normalize data without identifiers
- **Missing `keyArgs` in paginated type policies** - Different filters overwrite each other in cache
- **(v4) Importing React hooks from `@apollo/client`** - Must use `@apollo/client/react` in v4
- **(v4) Using `uri` option directly on ApolloClient** - Must use explicit `HttpLink` in v4

**Medium Priority Issues:**

- **Not using `errorPolicy: "all"`** - Partial data is often better UX than complete failure
- **`refetchQueries` for simple updates** - Direct cache updates with `cache.modify` are more efficient
- **`network-only` for all queries** - `cache-and-network` provides better UX (stale-while-revalidate)
- **Not typing `useQuery`/`useMutation` generics** - Loses type safety benefits
- **Missing loading/error state handling** - Causes crashes when data is undefined and poor UX

**Common Mistakes:**

- Forgetting to run `graphql-codegen` after schema changes
- Not including all required fields in optimistic responses (every field the mutation returns must be present)
- Using `cache.writeQuery` when `cache.modify` is more appropriate (writeQuery replaces entire query result)
- Mixing up `update` callback (for cache updates) with `onCompleted` callback (for side effects like navigation)
- Not using `notifyOnNetworkStatusChange` when showing refetch/fetchMore loading states

**Gotchas & Edge Cases:**

- `fetchMore` pagination requires type policy merge functions - without them, new data replaces old
- `cache.evict` must be followed by `cache.gc()` to clean up orphaned references
- `readField` in type policies is safer than direct property access (handles References)
- Optimistic responses are discarded automatically on error - no manual rollback needed
- `refetchQueries` runs after `update` callback, not before
- `pollInterval: 0` disables polling; omit the option entirely for no polling
- Type policies with `keyFields: false` embed objects in parent (no separate cache entry)
- Subscriptions require separate WebSocket link with `split` - queries/mutations stay on HTTP
- `useSuspenseQuery` has no `loading` state - it suspends; errors throw to Error Boundary
- `queryRef` from `useLoadableQuery` must be passed to `useReadQuery` inside a Suspense boundary
- `createQueryPreloader` must be called outside the React tree (e.g., router loaders)
- (v4) `notifyOnNetworkStatusChange` defaults to `true` - may cause unexpected re-renders
- (v4) `rxjs` is a required peer dependency - must install explicitly
- (v4) `ApolloError` class removed - use `CombinedGraphQLErrors.is()` and `ServerError.is()` for type-checking
- (v4) `from()`, `concat()`, `split()` are static methods on `ApolloLink`, not standalone functions
- (v4) `createHttpLink()` removed - use `new HttpLink()` constructor instead
- (v4) `useMutation` types now enforce required variables at the call site

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

**(You MUST use GraphQL Codegen for type generation - NEVER write manual TypeScript types for GraphQL)**

**(You MUST include `__typename` and `id` in all optimistic responses for cache normalization)**

**(You MUST configure type policies with appropriate `keyFields` for every entity type)**

**(You MUST use named constants for ALL timeout, retry, and polling values - NO magic numbers)**

**(For v4: You MUST import React hooks from `@apollo/client/react` - NOT from `@apollo/client`)**

**Failure to follow these rules will cause cache inconsistencies, type drift, and production bugs.**

</critical_reminders>
