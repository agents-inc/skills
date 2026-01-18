# Apollo Client GraphQL - Reference

> Decision frameworks, anti-patterns, and integration guides. See [SKILL.md](SKILL.md) for core concepts.

---

<decision_framework>

## Decision Framework

### When to Use Apollo Client

```
Is your API GraphQL?
├─ YES → Apollo Client is a good choice ✓
│   └─ Does your app need real-time updates?
│       ├─ YES → Configure subscriptions with graphql-ws
│       └─ NO → HTTP-only setup is sufficient
└─ NO → Is it REST?
    └─ Use your REST data fetching solution instead
```

### Fetch Policy Selection

```
How should this query fetch data?
├─ Need freshest data always?
│   └─ fetchPolicy: "network-only"
├─ Show cached, refresh in background?
│   └─ fetchPolicy: "cache-and-network" ✓ (recommended default)
├─ Fast response, cache is reliable?
│   └─ fetchPolicy: "cache-first"
├─ Only use cache, never fetch?
│   └─ fetchPolicy: "cache-only"
└─ Fetch once, never refetch?
    └─ fetchPolicy: "no-cache"
```

### Cache Update Strategy After Mutation

```
How to update cache after mutation?
├─ Simple add/update to single entity?
│   └─ Optimistic response + automatic normalization ✓
├─ Need to add to a list?
│   ├─ List is small/critical?
│   │   └─ Use update function with cache.modify ✓
│   └─ List is large/paginated?
│       └─ Use refetchQueries for consistency
├─ Need to remove from list?
│   └─ Use cache.evict + cache.gc in update function ✓
└─ Complex changes across multiple queries?
    └─ Use refetchQueries (simpler but costs network request)
```

### Type Policy keyFields Selection

```
How to identify this type in cache?
├─ Has unique `id` field?
│   └─ keyFields: ["id"] (default, often implicit)
├─ Has different unique identifier?
│   └─ keyFields: ["sku"] or ["slug"] or custom
├─ Composite key needed?
│   └─ keyFields: ["authorId", "postId"]
├─ Singleton object (only one instance)?
│   └─ keyFields: [] (query field level)
└─ Should not be normalized (embedded)?
    └─ keyFields: false
```

### Local State Solution

```
Need client-side state with Apollo?
├─ Simple global state (theme, auth)?
│   └─ Reactive variables (makeVar) ✓
├─ Need to query local state with GraphQL?
│   └─ Type policies with read functions + reactive vars
├─ Complex derived state?
│   └─ Consider your client state management solution
└─ Form state?
    └─ Component state (useState) - not Apollo's job
```

### Error Policy Selection

```
How to handle GraphQL errors?
├─ Errors are critical, data is invalid?
│   └─ errorPolicy: "none" (default)
├─ Want partial data even with errors?
│   └─ errorPolicy: "all" ✓ (recommended for UX)
└─ Ignore errors, use whatever data returned?
    └─ errorPolicy: "ignore"
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **GraphQL Codegen**: Generates TypeScript types from your schema and operations, providing end-to-end type safety from server to UI
- **graphql-ws**: WebSocket library for GraphQL subscriptions, required for real-time features
- **React**: Apollo's hooks (useQuery, useMutation, useSubscription) integrate with React lifecycle
- **Testing libraries**: MockedProvider enables isolated component testing without network

**Domain boundaries:**

- **GraphQL schema design**: Defer to backend skills for schema definition, resolvers, and server implementation
- **REST APIs**: Use your REST data fetching solution - Apollo Client is specifically for GraphQL
- **Complex client state**: For state that doesn't map to GraphQL queries, use your client state management solution

**Not a replacement for:**

- Client state management solutions (for complex non-GraphQL state)
- Form libraries (for form state and validation)
- Error tracking services (Apollo's error link integrates with them)

</integration>

---

<anti_patterns>

## Anti-Patterns

### Manual Type Definitions

Write types manually for GraphQL responses. Use GraphQL Codegen to generate types from your schema.

```typescript
// ❌ WRONG - Manual types drift from schema
interface User {
  id: string;
  name: string;
  // Missing fields cause runtime errors
}

// ✅ CORRECT - Use generated types
import type { User, GetUsersQuery } from "@/generated/graphql";
```

### Missing __typename in Optimistic Responses

Omit `__typename` from optimistic responses. Apollo uses `__typename` and `id` together to normalize data in cache.

```typescript
// ❌ WRONG - Missing __typename
optimisticResponse: {
  createUser: {
    id: "temp-123",
    name: "New User",
  },
}

// ✅ CORRECT - Include __typename
optimisticResponse: {
  createUser: {
    __typename: "User",
    id: "temp-123",
    name: "New User",
    email: "new@example.com",
  },
}
```

### Missing keyArgs in Type Policies

Configure pagination merge functions without keyArgs. Different filter combinations will overwrite each other in cache.

```typescript
// ❌ WRONG - All filters share same cache
typePolicies: {
  Query: {
    fields: {
      users: {
        merge(existing = [], incoming) {
          return [...existing, ...incoming];
        },
      },
    },
  },
}

// ✅ CORRECT - Separate cache per filter
typePolicies: {
  Query: {
    fields: {
      users: {
        keyArgs: ["filter", "sortBy"],
        merge(existing = [], incoming) {
          return [...existing, ...incoming];
        },
      },
    },
  },
}
```

### Over-fetching with refetchQueries

Use refetchQueries for every mutation. Update the cache directly when possible to avoid unnecessary network requests.

```typescript
// ❌ INEFFICIENT - Refetches entire list
const [createUser] = useMutation(CREATE_USER, {
  refetchQueries: [{ query: GET_ALL_USERS }],
});

// ✅ EFFICIENT - Update cache directly
const [createUser] = useMutation(CREATE_USER, {
  update(cache, { data }) {
    cache.modify({
      fields: {
        users(existingRefs = [], { toReference }) {
          return [...existingRefs, toReference(data.createUser)];
        },
      },
    });
  },
});
```

### Not Handling Loading and Error States

Assume data is always available. Handle all query states explicitly.

```typescript
// ❌ WRONG - Crashes if data undefined
function UserList() {
  const { data } = useQuery(GET_USERS);
  return data.users.map(u => <li key={u.id}>{u.name}</li>);
}

// ✅ CORRECT - Handle all states
function UserList() {
  const { data, loading, error } = useQuery(GET_USERS);

  if (loading) return <Skeleton />;
  if (error) return <Error message={error.message} />;
  if (!data?.users?.length) return <EmptyState />;

  return data.users.map(u => <li key={u.id}>{u.name}</li>);
}
```

### Using network-only Without Reason

Set fetchPolicy to "network-only" for all queries. Use "cache-and-network" for better UX with stale-while-revalidate behavior.

```typescript
// ❌ OFTEN WRONG - Slow, always waits for network
const { data } = useQuery(GET_USER, {
  fetchPolicy: "network-only",
});

// ✅ USUALLY BETTER - Shows cached data while refreshing
const { data } = useQuery(GET_USER, {
  fetchPolicy: "cache-and-network",
});
```

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Manual GraphQL type definitions** - Use GraphQL Codegen; manual types drift from schema causing runtime errors
- **Missing `__typename` in optimistic responses** - Cache normalization fails without it
- **Missing `id` in query responses** - Apollo cannot normalize data without identifiers
- **Missing keyArgs in paginated type policies** - Different filters overwrite each other in cache
- **Default exports** - Use named exports for tree-shaking
- **Magic numbers for polling/timeouts** - Use named constants like `POLL_INTERVAL_MS`
- **(v4) Importing React hooks from `@apollo/client`** - Must use `@apollo/client/react` in v4
- **(v4) Using `uri` option directly on ApolloClient** - Must use explicit `HttpLink` in v4

**Medium Priority Issues:**

- **Not using errorPolicy: "all"** - Partial data is often better UX than complete failure
- **refetchQueries for simple updates** - Direct cache updates are more efficient
- **network-only for all queries** - cache-and-network provides better UX
- **Not typing useQuery/useMutation generics** - Loses type safety benefits
- **Missing loading/error state handling** - Causes crashes and poor UX

**Common Mistakes:**

- Forgetting to run `graphql-codegen` after schema changes
- Not including all required fields in optimistic responses
- Using `cache.writeQuery` when `cache.modify` is more appropriate
- Mixing up `update` callback (for cache) with `onCompleted` callback (for side effects)
- Not using `notifyOnNetworkStatusChange` when showing refetch states

**Gotchas & Edge Cases:**

- Subscriptions require separate WebSocket link configuration with `split`
- `fetchMore` pagination requires type policy merge functions to work
- `cache.evict` must be followed by `cache.gc()` to clean up orphaned references
- `readField` in type policies is safer than direct property access (handles References)
- Optimistic responses are discarded on error - no manual rollback needed
- `refetchQueries` runs after `update` callback, not before
- `pollInterval: 0` disables polling; omit the option entirely for no polling
- Type policies with `keyFields: false` embed objects in parent (no separate cache entry)

**v3.9+ Suspense Gotchas:**

- `useSuspenseQuery` has no `loading` state - it suspends instead
- Suspense errors throw to Error Boundaries, not returned as `error` prop
- `queryRef` from `useLoadableQuery` must be passed to `useReadQuery` in a Suspense boundary
- `createQueryPreloader` requires being called outside React tree (router loaders)

**v4 Migration Gotchas:**

- `notifyOnNetworkStatusChange` defaults to `true` in v4 (was `false` in v3)
- `ApolloError` class removed - use `CombinedGraphQLErrors.is()` for type checking
- `useMutation` types now enforce required variables at call site
- `rxjs` is a peer dependency in v4 - must install explicitly
- `defaultOptions` removed from `useQuery` - use global client defaults instead

</red_flags>

---

## Fetch Policy Reference

| Policy | Network Request | Cache Read | Use Case |
|--------|-----------------|------------|----------|
| `cache-first` | Only on miss | Yes, first | Default for most queries |
| `cache-and-network` | Always | Yes, show immediately | Stale-while-revalidate |
| `network-only` | Always | After response | Critical fresh data |
| `no-cache` | Always | Never | One-time data |
| `cache-only` | Never | Yes | Offline or pre-cached |
| `standby` | Manual only | Yes | Dependent queries |

---

## Error Policy Reference

| Policy | GraphQL Errors | Data Returned | Use Case |
|--------|----------------|---------------|----------|
| `none` (default) | Thrown | Partial discarded | Strict data requirements |
| `all` | In `error` prop | Partial available | Graceful degradation |
| `ignore` | Ignored | All available | Non-critical errors |

---

## Network Status Reference

| Status | Value | Meaning |
|--------|-------|---------|
| `loading` | 1 | Initial load |
| `setVariables` | 2 | Variables changed |
| `fetchMore` | 3 | Fetching more (pagination) |
| `refetch` | 4 | Refetching |
| `poll` | 6 | Polling update |
| `ready` | 7 | Complete |
| `error` | 8 | Error state |

Use `notifyOnNetworkStatusChange: true` to receive these status updates.

---

## Cache Methods Reference

| Method | Purpose | Example |
|--------|---------|---------|
| `cache.readQuery` | Read data from cache | Get current list |
| `cache.writeQuery` | Write entire query result | Replace list |
| `cache.readFragment` | Read single entity | Get one user |
| `cache.writeFragment` | Write single entity | Update one user |
| `cache.modify` | Modify existing cache data | Add/remove from list |
| `cache.evict` | Remove from cache | Delete entity |
| `cache.gc` | Garbage collect | Clean orphans after evict |
| `cache.identify` | Get cache ID | Get "User:123" format |

---

## Quick Reference: Common Patterns

### Add to List (after create mutation)

```typescript
update(cache, { data }) {
  cache.modify({
    fields: {
      users(existing = [], { toReference }) {
        return [...existing, toReference(data.createUser)];
      },
    },
  });
}
```

### Remove from List (after delete mutation)

```typescript
update(cache) {
  cache.modify({
    fields: {
      users(existing, { readField }) {
        return existing.filter(ref => readField("id", ref) !== deletedId);
      },
    },
  });
  cache.evict({ id: cache.identify({ __typename: "User", id: deletedId }) });
  cache.gc();
}
```

### Optimistic Response Template

```typescript
optimisticResponse: {
  __typename: "Mutation",
  createUser: {
    __typename: "User",
    id: `temp-${Date.now()}`,
    // Include ALL fields returned by mutation
    name: inputName,
    email: inputEmail,
    createdAt: new Date().toISOString(),
  },
}
```

### Relay Pagination Type Policy

```typescript
typePolicies: {
  Query: {
    fields: {
      usersConnection: relayStylePagination(["filter"]),
    },
  },
}
```

---

## Sources

- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
- [GraphQL Codegen Documentation](https://www.apollographql.com/docs/react/development-testing/graphql-codegen)
- [Advanced Caching Topics](https://www.apollographql.com/docs/react/caching/advanced-topics)
- [Optimistic UI](https://www.apollographql.com/docs/react/performance/optimistic-ui)
- [Cursor-based Pagination](https://www.apollographql.com/docs/react/pagination/cursor-based)
- [Mutations Best Practices](https://www.apollographql.com/docs/react/data/mutations)
- [Subscriptions](https://www.apollographql.com/docs/react/data/subscriptions)
- [Local State with Reactive Variables](https://www.apollographql.com/blog/apollo-client/caching/local-state-management-with-reactive-variables/)
- [Fragment Colocation](https://www.apollographql.com/blog/optimizing-data-fetching-with-apollo-client-leveraging-usefragment-and-colocated-fragments)
- [Apollo Client 3.9 Announcement](https://www.apollographql.com/blog/whats-new-in-apollo-client-3-9)
- [Apollo Client 3.10 Announcement](https://www.apollographql.com/blog/whats-new-in-apollo-client-3-10)
- [Apollo Client 4.0 Announcement](https://www.apollographql.com/blog/announcing-apollo-client-4-0)
- [Apollo Client 4 Migration Guide](https://www.apollographql.com/docs/react/migrating/apollo-client-4-migration)
- [Suspense Documentation](https://www.apollographql.com/docs/react/data/suspense)
- [useFragment Documentation](https://www.apollographql.com/docs/react/api/react/hooks/#usefragment)
