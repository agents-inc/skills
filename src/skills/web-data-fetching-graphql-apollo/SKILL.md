---
name: web-data-fetching-graphql-apollo
description: Apollo Client GraphQL patterns — normalized cache and type policies, queries, mutations with optimistic updates, pagination, fragments, subscriptions, and Suspense hooks
---

# Apollo Client Patterns

> **Quick Guide:** Apollo stores every entity once, keyed by `__typename` plus its `keyFields`, and
> re-renders everything watching it. Most of the difficulty is in the cache rather than the hooks:
> `keyFields` decides identity, `keyArgs` decides how many cache entries a paginated field gets, and
> an optimistic response missing `__typename` fails to normalize without saying so. v3.9 added the
> Suspense hooks; v4 moved the React hooks to `@apollo/client/react` and typed the error classes.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — codegen config, client and link chain, `useQuery`, `useLazyQuery`, mutations with cache updates
- [examples/pagination.md](examples/pagination.md) — `fetchMore` with an observer, relay and offset type policies
- [examples/fragments.md](examples/fragments.md) — fragment definition, composition and use in queries
- [examples/error-handling.md](examples/error-handling.md) — partial data rendering, global error link
- [examples/subscriptions.md](examples/subscriptions.md) — split link over `graphql-ws`, `useSubscription` writing to cache
- [examples/suspense.md](examples/suspense.md) — `useSuspenseQuery`, `useLoadableQuery`, `useBackgroundQuery`, `createQueryPreloader`
- [examples/testing.md](examples/testing.md) — `MockedProvider`, mock shapes, asserting cache updates, schema-based testing
- [reference.md](reference.md) — fetch/error policy, network status and cache method tables, v3 → v4 migration

---

## Which path applies

- **Apollo Client v4** — React hooks come from `@apollo/client/react`, links are constructed with
  `new HttpLink()`, `uri` on the client is gone, and errors are `CombinedGraphQLErrors` /
  `ServerError` rather than one `ApolloError`. The full map is in
  [reference.md](reference.md); `npx @apollo/client-codemod-migrate-3-to-4` does the mechanical part.
- **Suspense loading** — the component suspends instead of returning `loading`, and errors throw to
  the nearest error boundary. Pattern 9, then [examples/suspense.md](examples/suspense.md).
- **Classic hooks** — `useQuery` returns `loading`, `error` and `data`, and the component renders
  each state itself. Patterns 2 onward.

---

<critical_requirements>

## Before writing Apollo code

**Generate the operation types from the schema.** A hand-written response type is a second copy of
the schema that nothing keeps in step, and it goes wrong silently — the field the backend added is
absent from the type and absent from every render that needed it.

**Put `__typename` and the identifying field in every optimistic response.** Without them the entry
cannot be normalized, so the optimistic write lands nowhere and the UI does not move until the
server answers.

**Give every entity type a `keyFields` policy.** It is what decides whether two responses are the
same entity, and the default `["id"]` is wrong for anything keyed on `sku`, a slug, or a pair.

</critical_requirements>

---

**Auto-detection:** `ApolloClient`, `InMemoryCache`, `ApolloProvider`, `useQuery`, `useLazyQuery`,
`useMutation`, `useSubscription`, `useFragment`, `useSuspenseQuery`, `useLoadableQuery`,
`useBackgroundQuery`, `useReadQuery`, `createQueryPreloader`, `typePolicies`, `keyFields`,
`keyArgs`, `cache.modify`, `cache.evict`, `relayStylePagination`, `makeVar`, `gql`

**Applies to:**

- Normalized caching, type policies and cache identity
- Queries, mutations, optimistic responses and cache updates after a write
- Cursor and offset pagination through `fetchMore`
- Fragment colocation and reading a fragment straight from the cache
- Real-time data over a subscription link
- Suspense-based loading and route preloading

**Handled elsewhere:**

- APIs addressed over REST — this client speaks one query language
- Designing the schema and its resolvers; this skill consumes a schema
- Client state that does not correspond to any server field — reactive variables cover the simple
  cases here, and anything derived or complex belongs to whatever owns client state
- Form state and validation
- Where errors are shipped once the error link has caught them

---

<philosophy>

## Philosophy

The cache is the product. A response is not stored as a response — it is split into entities keyed
by `__typename` plus `keyFields`, and every hook watching one of those entities re-renders when it
changes. So one mutation updates every list, detail view and badge showing that entity, without any
of them refetching.

The corollary is that everything which can go wrong with Apollo is an identity question: two
responses that should have been one entry, one entry that should have been two, or a write the cache
could not place because it did not know what it was.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Client setup and type policies

Build the cache with a type policy per entity, and compose the link chain so auth and error handling
sit in front of the transport.

```typescript
const cache = new InMemoryCache({
  typePolicies: {
    User: { keyFields: ["id"] },
    Product: { keyFields: ["sku"] }, // identity is not always "id"
    CartItem: { keyFields: false }, // embed in the parent, never its own entry
    Query: { fields: { usersConnection: relayStylePagination(["filter"]) } },
  },
});
```

`keyFields` takes `["id"]`, another single field, a composite like `["authorId", "postId"]`, `[]` for
a singleton, or `false` to embed.

Full code: [examples/core.md](examples/core.md) — codegen config, auth link, error link, client
singleton

---

### Pattern 2: Queries

```typescript
const { data, loading, error, refetch } = useQuery<GetUsersQuery, GetUsersQueryVariables>(
  GET_USERS,
  { variables: { limit: DEFAULT_PAGE_SIZE }, fetchPolicy: "cache-and-network", skip: !shouldFetch },
);

if (loading && !data) return <Skeleton />;
if (error) return <Error message={error.message} onRetry={() => refetch()} />;
if (!data?.users?.length) return <EmptyState />;
```

`loading && !data` shows the skeleton on first load only, so a background refetch does not blank the
screen. `cache-and-network` renders the cached value immediately and revalidates behind it.

Full code: [examples/core.md](examples/core.md) — also `useLazyQuery` for user-triggered fetches

---

### Pattern 3: Mutations and cache updates

Three ways to make the cache agree with a write, in ascending cost: an optimistic response that
normalizes on its own, an `update` callback using `cache.modify`, or `refetchQueries`, which is the
simplest and costs a round trip.

```typescript
const [createPost] = useMutation(CREATE_POST, {
  optimisticResponse: {
    createPost: {
      __typename: "Post",
      id: `temp-${Date.now()}`,
      title,
      content,
    },
  },
  update(cache, { data }) {
    cache.modify({
      fields: {
        posts: (existing = [], { toReference }) => [
          toReference(data.createPost),
          ...existing,
        ],
      },
    });
  },
});
```

An optimistic response carries every field the mutation returns — a partial one writes holes into the
cache. It needs no rollback code: Apollo keeps optimistic writes in a separate layer and discards
that layer when the mutation fails. Deleting takes `cache.evict()` followed by `cache.gc()`; the
evict alone leaves dangling references behind. `refetchQueries` earns its round trip on a large paginated list, where a local
edit cannot know where the new row sorts, and on a write that changes several queries at once.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Computed and local fields

A field policy's `read` function invents a field that no server returns, from other cached fields or
from a reactive variable.

```typescript
User: {
  fields: {
    fullName: {
      read: (_, { readField }) => `${readField("firstName")} ${readField("lastName")}`,
    },
  },
},
Query: { fields: { isLoggedIn: { read: () => isLoggedInVar() } } },
```

Use `readField` rather than property access — a cached field may hold a `Reference` rather than a
value.

---

### Pattern 5: Pagination

Cursor pages go through `relayStylePagination`; offset pages need a `merge` and a `read` written by
hand. Both live in the type policy, not in the component.

```typescript
const { data, fetchMore } = useQuery(GET_USERS_CONNECTION, {
  variables: { first: PAGE_SIZE },
});

const loadMore = () =>
  fetchMore({ variables: { after: data.usersConnection.pageInfo.endCursor } });
```

`keyArgs` is what separates one filter's pages from another's. Without it every filter merges into
one entry and the list shows the wrong rows.

Full code: [examples/pagination.md](examples/pagination.md)

---

### Pattern 6: Fragment colocation

A component declares the fields it needs; the parent query spreads that fragment. Changing what the
child renders then changes one file rather than every query that contains it.

```typescript
const USER_CARD_FRAGMENT = gql`
  fragment UserCard on User {
    id
    name
    avatar
  }
`;

const GET_USERS = gql`
  query GetUsers {
    users {
      ...UserCard
    }
  }
  ${USER_CARD_FRAGMENT}
`;
```

Full code: [examples/fragments.md](examples/fragments.md)

---

### Pattern 7: Subscriptions

Route subscriptions to a websocket link and everything else to HTTP, with `split`.

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

Construct `wsLink` only where `window` exists, or a server render opens a socket. Write the payload
into the cache from `onData`, or the subscription updates nothing.

Full code: [examples/subscriptions.md](examples/subscriptions.md)

---

### Pattern 8: Reactive variables for local state

```typescript
const cartItemsVar = makeVar<string[]>([]);
const addToCart = (id: string) => cartItemsVar([...cartItemsVar(), id]);

const cartItems = useReactiveVar(cartItemsVar);
```

A reactive variable is readable from a field policy's `read`, which is what lets local state be
queried alongside server data. It holds a value and notifies — anything needing derivation,
middleware or history belongs to a state solution instead.

---

### Pattern 9: Suspense hooks

| Hook                   | Fetch starts on  | For                          |
| ---------------------- | ---------------- | ---------------------------- |
| `useSuspenseQuery`     | component mount  | ordinary loading             |
| `useLoadableQuery`     | user interaction | hover or click prefetch      |
| `useBackgroundQuery`   | parent mount     | parent triggers, child reads |
| `createQueryPreloader` | route transition | router loaders               |

None of them return `loading` — the component suspends, and errors throw to the error boundary. The
last three hand back a `queryRef` that `useReadQuery` consumes inside a `Suspense` boundary.

Full code: [examples/suspense.md](examples/suspense.md)

---

### Pattern 10: Reading a fragment from the cache

```typescript
const { data: user, complete } = useFragment({ fragment: USER_CARD_FRAGMENT, from: userRef });
if (!complete) return <Skeleton />;
```

No query is issued: the fields are read from the cache and re-read whenever they change. `complete`
is false when some fragment field was never cached.

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- An optimistic response without `__typename`, or missing a field the mutation returns —
  normalization fails silently and the cache holds a hole.
- A paginated field policy with no `keyArgs` — every filter shares one entry, so switching filters
  shows the previous filter's rows.
- A paginated field with no `merge` — `fetchMore` replaces the list instead of extending it.
- A query that does not select the entity's key field — the response cannot be normalized, so it
  lands under the parent field and a mutation updating that entity leaves this query untouched.
- `cache.evict()` without `cache.gc()` — the entity is gone but references to it are not.
- (v4) React hooks imported from `@apollo/client` — they live at `@apollo/client/react`.
- (v4) `uri` passed to `ApolloClient` — construct an `HttpLink` and pass `link`.
- (v4) `rxjs` not installed — it is a required peer dependency, replacing `zen-observable`.
- Rendering `data` with no `loading` or `error` branch — the first render has neither.

**Surprising behaviour:**

- `refetchQueries` runs after the `update` callback, not before.
- `cache.writeQuery` replaces the whole query result, where `cache.modify` edits one field — reach
  for `writeQuery` and a list becomes exactly what you just wrote.
- `update` fires for cache changes and `onCompleted` for side effects; navigating from `update`
  fires it again on every optimistic pass.
- `errorPolicy` defaults to `none`, which discards partial data — `"all"` keeps it and reports the
  errors alongside.
- Loading states for `refetch` and `fetchMore` need `notifyOnNetworkStatusChange`, which defaults to
  `false` in v3 and `true` in v4.
- `pollInterval: 0` disables polling; omitting the option is the same thing and reads better.
- A `queryRef` is bound to the variables it was loaded with — new variables need a new
  `loadQuery` call.
- `createQueryPreloader` runs outside the React tree, so it cannot be called from a component.

</red_flags>
