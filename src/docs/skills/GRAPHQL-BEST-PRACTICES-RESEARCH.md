# GraphQL Best Practices Research

> **Purpose**: Comprehensive research for creating atomic GraphQL skills covering Apollo Client, URQL, codegen, caching, and testing patterns.
> **Status**: COMPLETE
> **Last Updated**: 2026-01-15
> **Target Skills**: frontend/graphql-apollo, frontend/graphql-urql, frontend/graphql-codegen, frontend/graphql-testing

---

## Table of Contents

1. [Apollo Client Patterns](#section-1-apollo-client-patterns)
2. [URQL Patterns](#section-2-urql-patterns)
3. [GraphQL Codegen Patterns](#section-3-graphql-codegen-patterns)
4. [Fragment Colocation Patterns](#section-4-fragment-colocation-patterns)
5. [Cache Management Patterns](#section-5-cache-management-patterns)
6. [Optimistic Updates](#section-6-optimistic-updates)
7. [Error Handling Patterns](#section-7-error-handling-patterns)
8. [Pagination Patterns](#section-8-pagination-patterns)
9. [TypeScript Integration](#section-9-typescript-integration)
10. [Testing GraphQL Clients](#section-10-testing-graphql-clients)

---

## Section 1: Apollo Client Patterns

### 1.1 Core Setup Pattern

```typescript
// lib/apollo-client.ts
import { ApolloClient, InMemoryCache, HttpLink, from, ApolloLink } from "@apollo/client";
import { onError } from "@apollo/client/link/error";

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql";
const DEFAULT_FETCH_POLICY = "cache-first" as const;

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL Error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        { operation: operation.operationName, extensions }
      );
    });
  }
  if (networkError) {
    console.error(`[Network Error]: ${networkError.message}`);
  }
});

// HTTP link with credentials
const httpLink = new HttpLink({
  uri: GRAPHQL_ENDPOINT,
  credentials: "include", // For cookie-based auth
});

// Auth link for token-based auth
const authLink = new ApolloLink((operation, forward) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }));

  return forward(operation);
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Field-level cache policies
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: DEFAULT_FETCH_POLICY,
      errorPolicy: "all",
    },
    query: {
      fetchPolicy: DEFAULT_FETCH_POLICY,
      errorPolicy: "all",
    },
    mutate: {
      errorPolicy: "all",
    },
  },
});

export { apolloClient };
```

### 1.2 Provider Setup Pattern

```typescript
// app/providers.tsx
"use client";

import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "@/lib/apollo-client";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ApolloProvider client={apolloClient}>
      {children}
    </ApolloProvider>
  );
}

export { Providers };
```

### 1.3 Query Pattern with Generated Hooks

```typescript
// features/users/hooks/use-users.ts
import { useUsersQuery, UsersQueryVariables } from "@/generated/graphql";

const DEFAULT_PAGE_SIZE = 20;

interface UseUsersOptions {
  pageSize?: number;
  skip?: boolean;
}

export function useUsers(options: UseUsersOptions = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE, skip = false } = options;

  const { data, loading, error, refetch, fetchMore } = useUsersQuery({
    variables: { first: pageSize },
    skip,
    notifyOnNetworkStatusChange: true, // For loading states during fetchMore
  });

  return {
    users: data?.users.edges.map(edge => edge.node) ?? [],
    pageInfo: data?.users.pageInfo,
    isLoading: loading,
    error,
    refetch,
    fetchMore,
  };
}

export { useUsers };
```

### 1.4 Mutation Pattern

```typescript
// features/users/hooks/use-create-user.ts
import { useCreateUserMutation, UsersDocument, CreateUserInput } from "@/generated/graphql";

interface UseCreateUserOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useCreateUser(options: UseCreateUserOptions = {}) {
  const [createUserMutation, { loading, error }] = useCreateUserMutation({
    // Refetch queries to update cache
    refetchQueries: [{ query: UsersDocument }],
    // Or use cache update for better performance
    update(cache, { data }) {
      if (!data?.createUser) return;

      cache.modify({
        fields: {
          users(existingUsers = { edges: [] }) {
            const newUserRef = cache.writeFragment({
              data: data.createUser,
              fragment: gql`
                fragment NewUser on User {
                  id
                  name
                  email
                }
              `,
            });

            return {
              ...existingUsers,
              edges: [{ node: newUserRef }, ...existingUsers.edges],
            };
          },
        },
      });
    },
    onCompleted: () => options.onSuccess?.(),
    onError: (err) => options.onError?.(err),
  });

  const createUser = async (input: CreateUserInput) => {
    return createUserMutation({ variables: { input } });
  };

  return {
    createUser,
    isLoading: loading,
    error,
  };
}

export { useCreateUser };
```

### 1.5 Subscription Pattern

```typescript
// features/notifications/hooks/use-notifications-subscription.ts
import { useNotificationsSubscription } from "@/generated/graphql";
import { useCallback } from "react";

export function useNotificationsSubscription(userId: string) {
  const { data, loading, error } = useNotificationsSubscription({
    variables: { userId },
    // Handle subscription data updates
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.notification) {
        // Handle new notification (e.g., show toast)
        console.log("New notification:", subscriptionData.data.notification);
      }
    },
  });

  return {
    notification: data?.notification,
    isConnected: !loading && !error,
    error,
  };
}

export { useNotificationsSubscription };
```

### 1.6 Apollo Client Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Creating client on every render
function App() {
  const client = new ApolloClient({ /* config */ }); // Creates new instance!
  return <ApolloProvider client={client}>{/* ... */}</ApolloProvider>;
}

// ✅ CORRECT: Create client once, outside component
const client = new ApolloClient({ /* config */ });
function App() {
  return <ApolloProvider client={client}>{/* ... */}</ApolloProvider>;
}

// ❌ WRONG: Ignoring error states
function Users() {
  const { data } = useUsersQuery(); // No error handling!
  return <ul>{data?.users.map(/* ... */)}</ul>;
}

// ✅ CORRECT: Handle all states
function Users() {
  const { data, loading, error } = useUsersQuery();
  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <ul>{data?.users.map(/* ... */)}</ul>;
}

// ❌ WRONG: Using no-cache everywhere
const { data } = useUsersQuery({ fetchPolicy: "no-cache" }); // Wastes bandwidth!

// ✅ CORRECT: Use cache-first, override only when needed
const { data } = useUsersQuery(); // Uses default cache-first
const { data: fresh } = useUsersQuery({ fetchPolicy: "network-only" }); // When fresh data required

// ❌ WRONG: Refetching entire query list after mutation
const [createUser] = useCreateUserMutation({
  refetchQueries: [{ query: UsersDocument }], // Refetches ALL users!
});

// ✅ CORRECT: Update cache directly for better performance
const [createUser] = useCreateUserMutation({
  update(cache, { data }) {
    // Surgically update only what changed
  },
});

// ❌ WRONG: Inline queries without generated types
const { data } = useQuery(gql`query { users { id name } }`); // No type safety!

// ✅ CORRECT: Use generated hooks from codegen
const { data } = useUsersQuery(); // Fully typed
```

### 1.7 When to Use Apollo Client

**Use Apollo When:**
- Building a complex application with significant caching needs
- Need normalized cache for entity deduplication
- Using subscriptions extensively
- Team is familiar with Apollo ecosystem
- Need advanced features like local state management, optimistic UI
- Enterprise support is required

**Don't Use Apollo When:**
- Simple application with few queries
- Bundle size is critical (Apollo is ~45KB gzipped)
- Server-side rendering without SSR-specific setup
- Prefer simpler mental model (consider URQL)
- Using React Query for REST and want consistency

---

## Section 2: URQL Patterns

### 2.1 Core Setup Pattern

```typescript
// lib/urql-client.ts
import { createClient, cacheExchange, fetchExchange, subscriptionExchange } from "urql";
import { createClient as createWSClient } from "graphql-ws";
import { devtoolsExchange } from "@urql/devtools";
import { authExchange } from "@urql/exchange-auth";

const GRAPHQL_HTTP_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql";
const GRAPHQL_WS_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || "ws://localhost:4000/graphql";

// WebSocket client for subscriptions
const wsClient = typeof window !== "undefined"
  ? createWSClient({
      url: GRAPHQL_WS_ENDPOINT,
      connectionParams: () => ({
        authToken: localStorage.getItem("authToken"),
      }),
    })
  : null;

export const urqlClient = createClient({
  url: GRAPHQL_HTTP_ENDPOINT,
  exchanges: [
    devtoolsExchange, // Optional: for URQL devtools
    cacheExchange, // Document cache (not normalized by default)
    authExchange(async (utils) => ({
      addAuthToOperation(operation) {
        const token = localStorage.getItem("authToken");
        if (!token) return operation;

        return utils.appendHeaders(operation, {
          Authorization: `Bearer ${token}`,
        });
      },
      didAuthError(error) {
        return error.graphQLErrors.some(
          (e) => e.extensions?.code === "UNAUTHENTICATED"
        );
      },
      async refreshAuth() {
        // Implement token refresh logic
        localStorage.removeItem("authToken");
        window.location.href = "/login";
      },
    })),
    fetchExchange,
    // Add subscription exchange if WebSocket client exists
    ...(wsClient
      ? [
          subscriptionExchange({
            forwardSubscription(request) {
              const input = { ...request, query: request.query || "" };
              return {
                subscribe(sink) {
                  const unsubscribe = wsClient.subscribe(input, sink);
                  return { unsubscribe };
                },
              };
            },
          }),
        ]
      : []),
  ],
  requestPolicy: "cache-first",
});

export { urqlClient };
```

### 2.2 Provider Setup Pattern

```typescript
// app/providers.tsx
"use client";

import { Provider } from "urql";
import { urqlClient } from "@/lib/urql-client";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Provider value={urqlClient}>
      {children}
    </Provider>
  );
}

export { Providers };
```

### 2.3 Query Pattern with Generated Hooks

```typescript
// features/users/hooks/use-users.ts
import { useUsersQuery } from "@/generated/graphql";

const DEFAULT_PAGE_SIZE = 20;

interface UseUsersOptions {
  pageSize?: number;
  pause?: boolean;
}

export function useUsers(options: UseUsersOptions = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE, pause = false } = options;

  const [result, reexecute] = useUsersQuery({
    variables: { first: pageSize },
    pause,
  });

  return {
    users: result.data?.users.edges.map(edge => edge.node) ?? [],
    pageInfo: result.data?.users.pageInfo,
    isLoading: result.fetching,
    isStale: result.stale,
    error: result.error,
    refetch: () => reexecute({ requestPolicy: "network-only" }),
  };
}

export { useUsers };
```

### 2.4 Mutation Pattern

```typescript
// features/users/hooks/use-create-user.ts
import { useCreateUserMutation, CreateUserInput } from "@/generated/graphql";

interface UseCreateUserOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useCreateUser(options: UseCreateUserOptions = {}) {
  const [result, executeMutation] = useCreateUserMutation();

  const createUser = async (input: CreateUserInput) => {
    const response = await executeMutation({ input });

    if (response.error) {
      options.onError?.(response.error);
      return null;
    }

    options.onSuccess?.();
    return response.data?.createUser;
  };

  return {
    createUser,
    isLoading: result.fetching,
    error: result.error,
  };
}

export { useCreateUser };
```

### 2.5 Normalized Cache with Graphcache

```typescript
// lib/urql-client-graphcache.ts
import { createClient, fetchExchange } from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";
import schema from "@/generated/introspection.json";

export const urqlClient = createClient({
  url: process.env.NEXT_PUBLIC_GRAPHQL_URL!,
  exchanges: [
    cacheExchange({
      schema, // Generated introspection for automatic cache updates
      keys: {
        // Custom key resolution for types without id
        PageInfo: () => null, // PageInfo is not an entity
      },
      resolvers: {
        Query: {
          // Field resolvers for cache reads
          user: (_, args) => ({ __typename: "User", id: args.id }),
        },
      },
      updates: {
        Mutation: {
          createUser(result, _args, cache) {
            // Update users list in cache after mutation
            cache.invalidate("Query", "users");
          },
          deleteUser(_result, args, cache) {
            // Remove user from cache
            cache.invalidate({ __typename: "User", id: args.id });
          },
        },
      },
      optimistic: {
        // Optimistic updates
        updateUser(args, cache) {
          return {
            __typename: "User",
            id: args.id,
            ...args.input,
          };
        },
      },
    }),
    fetchExchange,
  ],
});

export { urqlClient };
```

### 2.6 URQL Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Not handling stale state
function Users() {
  const [result] = useUsersQuery();
  return <ul>{result.data?.users.map(/* ... */)}</ul>; // Ignores stale indicator!
}

// ✅ CORRECT: Handle stale state
function Users() {
  const [result] = useUsersQuery();
  return (
    <div className={result.stale ? "opacity-50" : ""}>
      <ul>{result.data?.users.map(/* ... */)}</ul>
    </div>
  );
}

// ❌ WRONG: Using network-only everywhere
const [result] = useUsersQuery({ requestPolicy: "network-only" }); // Defeats caching!

// ✅ CORRECT: Use cache-and-network for fresh-but-fast
const [result] = useUsersQuery({ requestPolicy: "cache-and-network" });

// ❌ WRONG: Not invalidating cache after mutations (without Graphcache)
const [, executeMutation] = useCreateUserMutation();
await executeMutation({ input }); // Cache is now stale!

// ✅ CORRECT: Reexecute query after mutation
const [, executeMutation] = useCreateUserMutation();
const [, reexecuteUsersQuery] = useUsersQuery({ pause: true });
await executeMutation({ input });
reexecuteUsersQuery({ requestPolicy: "network-only" });

// ❌ WRONG: Using document cache for complex apps
import { cacheExchange } from "urql"; // Document cache, no normalization!

// ✅ CORRECT: Use Graphcache for normalization
import { cacheExchange } from "@urql/exchange-graphcache";
```

### 2.7 When to Use URQL

**Use URQL When:**
- Prefer smaller bundle size (~13KB gzipped vs Apollo's ~45KB)
- Want simpler API and mental model
- Building smaller to medium applications
- Team prefers explicit over implicit behavior
- Need extensibility through exchanges
- Server-side rendering with Next.js (better SSR support)

**Don't Use URQL When:**
- Need Apollo's advanced local state management
- Require enterprise support
- Team is already invested in Apollo ecosystem
- Need advanced cache features without Graphcache setup

---

## Section 3: GraphQL Codegen Patterns

### 3.1 Basic Codegen Configuration

```typescript
// codegen.ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const SCHEMA_URL = process.env.GRAPHQL_SCHEMA_URL || "http://localhost:4000/graphql";

const config: CodegenConfig = {
  schema: SCHEMA_URL,
  documents: ["src/**/*.graphql", "src/**/*.tsx"],
  ignoreNoDocuments: true,
  generates: {
    "./src/generated/graphql.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-react-apollo", // Or "typescript-urql" for URQL
      ],
      config: {
        // TypeScript configuration
        strictScalars: true,
        scalars: {
          DateTime: "string",
          JSON: "Record<string, unknown>",
          UUID: "string",
        },
        // Naming conventions
        enumsAsTypes: true, // Use union types instead of enums
        constEnums: true,
        // React hooks configuration
        withHooks: true,
        withHOC: false,
        withComponent: false,
        // Mutation hook options
        addDocBlocks: true,
        dedupeFragments: true,
      },
    },
    // Separate file for fragment types (for Fragment Matcher)
    "./src/generated/fragment-matcher.ts": {
      plugins: ["fragment-matcher"],
    },
    // Introspection for Graphcache
    "./src/generated/introspection.json": {
      plugins: ["introspection"],
      config: {
        minify: true,
      },
    },
  },
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
};

export default config;
```

### 3.2 Near-Operation-File Preset (Colocated Types)

```typescript
// codegen.ts - Colocated types near GraphQL files
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "http://localhost:4000/graphql",
  documents: "src/**/*.graphql",
  generates: {
    // Generate types next to .graphql files
    "src/": {
      preset: "near-operation-file",
      presetConfig: {
        extension: ".generated.ts",
        baseTypesPath: "~@/generated/types",
      },
      plugins: ["typescript-operations", "typescript-react-apollo"],
      config: {
        withHooks: true,
      },
    },
    // Base types in central location
    "./src/generated/types.ts": {
      plugins: ["typescript"],
      config: {
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
```

### 3.3 Client Preset (Recommended for New Projects)

```typescript
// codegen.ts - Modern client preset
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "http://localhost:4000/graphql",
  documents: "src/**/*.tsx",
  generates: {
    "./src/generated/": {
      preset: "client",
      presetConfig: {
        gqlTagName: "gql", // Or "graphql" for graphql-tag
        fragmentMasking: { unmaskFunctionName: "getFragmentData" },
      },
      config: {
        enumsAsTypes: true,
        strictScalars: true,
        scalars: {
          DateTime: "string",
          UUID: "string",
        },
      },
    },
  },
};

export default config;
```

### 3.4 Watch Mode Script

```json
// package.json
{
  "scripts": {
    "codegen": "graphql-codegen",
    "codegen:watch": "graphql-codegen --watch",
    "dev": "concurrently \"npm run codegen:watch\" \"next dev\""
  }
}
```

### 3.5 Codegen Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Not using strict scalars
config: {
  // Missing strictScalars: true
  // DateTime, JSON become "any"
}

// ✅ CORRECT: Enable strict scalars with explicit mappings
config: {
  strictScalars: true,
  scalars: {
    DateTime: "string", // Or use branded type
    JSON: "Record<string, unknown>",
  },
}

// ❌ WRONG: Generating enums (causes bundle bloat and poor tree-shaking)
config: {
  enumsAsTypes: false, // Default generates TypeScript enums
}

// ✅ CORRECT: Use union types instead of enums
config: {
  enumsAsTypes: true, // Generates: type Status = "ACTIVE" | "INACTIVE"
}

// ❌ WRONG: Committing generated files without review
// .gitignore
src/generated/

// ✅ CORRECT: Commit generated files to catch breaking changes
// Generated files show API changes in code review

// ❌ WRONG: Using deprecated plugins
plugins: [
  "typescript-react-query", // Deprecated!
]

// ✅ CORRECT: Use maintained alternatives
plugins: [
  "@graphql-codegen/client-preset", // Modern, maintained
]

// ❌ WRONG: Not setting up pre-commit hook
// No codegen validation before commit

// ✅ CORRECT: Validate in CI and pre-commit
// .husky/pre-commit
// npm run codegen && git diff --exit-code src/generated/
```

### 3.6 When to Use Codegen

**Always Use Codegen When:**
- Working with GraphQL (no exceptions)
- Need type-safe queries and mutations
- Want autocomplete for GraphQL operations
- Team is using TypeScript

**Codegen Configuration Choices:**

| Feature | When to Use |
|---------|-------------|
| `client` preset | New projects, modern codebases |
| `near-operation-file` | Large teams, colocated patterns |
| `enumsAsTypes: true` | Always (better tree-shaking) |
| `strictScalars: true` | Always (type safety) |
| `withHooks: true` | React projects |
| Fragment masking | Large apps with fragment colocation |

---

## Section 4: Fragment Colocation Patterns

### 4.1 Basic Fragment Colocation

```typescript
// features/users/components/user-card.tsx
import { gql } from "@apollo/client";
import type { UserCardFragment } from "@/generated/graphql";

// Fragment colocated with component that uses it
export const USER_CARD_FRAGMENT = gql`
  fragment UserCard on User {
    id
    name
    email
    avatarUrl
  }
`;

interface UserCardProps {
  user: UserCardFragment;
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div className="user-card">
      <img src={user.avatarUrl} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

export { UserCard, USER_CARD_FRAGMENT };
```

### 4.2 Composing Fragments

```typescript
// features/users/components/user-profile.tsx
import { gql } from "@apollo/client";
import { USER_CARD_FRAGMENT, UserCard } from "./user-card";
import { USER_STATS_FRAGMENT, UserStats } from "./user-stats";
import type { UserProfileFragment } from "@/generated/graphql";

// Compose fragments from child components
export const USER_PROFILE_FRAGMENT = gql`
  fragment UserProfile on User {
    ...UserCard
    ...UserStats
    bio
    website
    joinedAt
  }
  ${USER_CARD_FRAGMENT}
  ${USER_STATS_FRAGMENT}
`;

interface UserProfileProps {
  user: UserProfileFragment;
}

export function UserProfile({ user }: UserProfileProps) {
  return (
    <div className="user-profile">
      <UserCard user={user} />
      <UserStats user={user} />
      <p>{user.bio}</p>
      <a href={user.website}>{user.website}</a>
    </div>
  );
}

export { UserProfile, USER_PROFILE_FRAGMENT };
```

### 4.3 Query Using Composed Fragments

```typescript
// features/users/queries/get-user.ts
import { gql } from "@apollo/client";
import { USER_PROFILE_FRAGMENT } from "../components/user-profile";

export const GET_USER_QUERY = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      ...UserProfile
    }
  }
  ${USER_PROFILE_FRAGMENT}
`;
```

### 4.4 Fragment Masking Pattern (Type Safety)

```typescript
// With client preset and fragment masking enabled

// features/users/components/user-card.tsx
import { graphql, FragmentType, useFragment } from "@/generated";

export const UserCardFragment = graphql(`
  fragment UserCard on User {
    id
    name
    email
    avatarUrl
  }
`);

interface UserCardProps {
  user: FragmentType<typeof UserCardFragment>;
}

export function UserCard(props: UserCardProps) {
  // Must explicitly unmask the fragment data
  const user = useFragment(UserCardFragment, props.user);

  return (
    <div className="user-card">
      <img src={user.avatarUrl} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

export { UserCard, UserCardFragment };
```

### 4.5 Fragment Colocation Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Defining fragments far from components
// queries/fragments.ts - Centralized fragments file
export const USER_FRAGMENT = gql`...`;
export const POST_FRAGMENT = gql`...`;

// ✅ CORRECT: Colocate fragments with components
// features/users/components/user-card.tsx
export const USER_CARD_FRAGMENT = gql`...`;

// ❌ WRONG: Over-fetching by including unused fields
const USER_FRAGMENT = gql`
  fragment User on User {
    id
    name
    email
    bio
    website
    createdAt
    updatedAt
    # ...20 more fields this component doesn't use
  }
`;

// ✅ CORRECT: Only include fields the component needs
const USER_CARD_FRAGMENT = gql`
  fragment UserCard on User {
    id
    name
    avatarUrl
  }
`;

// ❌ WRONG: Duplicating fragment definitions
// user-card.tsx
const FRAGMENT = gql`fragment UserCard on User { id name }`;
// user-list.tsx
const FRAGMENT = gql`fragment UserCard on User { id name }`; // Duplicate!

// ✅ CORRECT: Export and reuse fragments
import { USER_CARD_FRAGMENT } from "./user-card";

// ❌ WRONG: Not typing fragment props
function UserCard({ user }: { user: any }) { // No type safety!
  return <div>{user.name}</div>;
}

// ✅ CORRECT: Use generated fragment types
function UserCard({ user }: { user: UserCardFragment }) {
  return <div>{user.name}</div>;
}

// ❌ WRONG: Accessing fragment data without useFragment (with masking)
function UserCard({ user }: UserCardProps) {
  return <div>{user.name}</div>; // TypeScript error with masking!
}

// ✅ CORRECT: Unmask fragment data
function UserCard(props: UserCardProps) {
  const user = useFragment(UserCardFragment, props.user);
  return <div>{user.name}</div>;
}
```

### 4.6 When to Use Fragment Colocation

**Always Use Fragment Colocation When:**
- Building component-based UI
- Teams larger than 2-3 developers
- Components have clear data requirements
- Want to prevent over-fetching

**Use Fragment Masking When:**
- Large codebase with many fragments
- Need strict encapsulation
- Want to prevent accidental data access
- Components should only access their declared data

**Skip Fragment Masking When:**
- Small projects with few components
- Team finds it too verbose
- Rapid prototyping phase

---

## Section 5: Cache Management Patterns

### 5.1 Apollo Normalized Cache Configuration

```typescript
// lib/apollo-cache.ts
import { InMemoryCache, makeVar } from "@apollo/client";

// Reactive variables for local state
export const cartItemsVar = makeVar<string[]>([]);
export const themeVar = makeVar<"light" | "dark">("light");

export const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Local-only field (not from server)
        cartItems: {
          read() {
            return cartItemsVar();
          },
        },
        theme: {
          read() {
            return themeVar();
          },
        },
        // Pagination field policy
        users: {
          keyArgs: ["filter", "sortBy"], // Cache separately per filter/sort
          merge(existing = { edges: [] }, incoming, { args }) {
            if (!args?.after) {
              // First page, replace cache
              return incoming;
            }
            // Subsequent pages, append
            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            };
          },
        },
      },
    },
    User: {
      // Custom cache key
      keyFields: ["id"],
      fields: {
        fullName: {
          // Computed field
          read(_, { readField }) {
            const firstName = readField<string>("firstName");
            const lastName = readField<string>("lastName");
            return `${firstName} ${lastName}`;
          },
        },
      },
    },
    // Type without ID
    PageInfo: {
      keyFields: false, // Embedded object, not a normalized entity
    },
  },
});

export { cache };
```

### 5.2 Cache Read and Write Patterns

```typescript
// Direct cache manipulation

import { useApolloClient } from "@apollo/client";
import { UserDocument, UserFragment } from "@/generated/graphql";

export function useCacheOperations() {
  const client = useApolloClient();

  // Read from cache
  const readUser = (id: string) => {
    return client.readFragment<UserFragment>({
      id: `User:${id}`,
      fragment: gql`
        fragment UserRead on User {
          id
          name
          email
        }
      `,
    });
  };

  // Write to cache
  const writeUser = (user: UserFragment) => {
    client.writeFragment({
      id: `User:${user.id}`,
      fragment: gql`
        fragment UserWrite on User {
          id
          name
          email
        }
      `,
      data: user,
    });
  };

  // Evict from cache
  const evictUser = (id: string) => {
    client.cache.evict({ id: `User:${id}` });
    client.cache.gc(); // Garbage collect unreachable refs
  };

  // Modify field in cache
  const updateUserEmail = (id: string, newEmail: string) => {
    client.cache.modify({
      id: `User:${id}`,
      fields: {
        email() {
          return newEmail;
        },
      },
    });
  };

  return { readUser, writeUser, evictUser, updateUserEmail };
}

export { useCacheOperations };
```

### 5.3 URQL Graphcache Configuration

```typescript
// lib/urql-cache.ts
import { cacheExchange } from "@urql/exchange-graphcache";
import schema from "@/generated/introspection.json";

export const graphcacheExchange = cacheExchange({
  schema,
  keys: {
    PageInfo: () => null, // Not an entity
    UserStats: (data) => data.userId as string, // Custom key
  },
  resolvers: {
    Query: {
      // Resolve from cache by ID
      user: (_, args) => ({ __typename: "User", id: args.id }),
    },
  },
  updates: {
    Mutation: {
      createUser(result, _args, cache) {
        // Invalidate users list
        cache.invalidate("Query", "users");
      },
      updateUser(result, args, cache) {
        // Cache updates automatically via normalization
      },
      deleteUser(_result, args, cache) {
        // Remove from cache
        cache.invalidate({ __typename: "User", id: args.id });
      },
    },
    Subscription: {
      userUpdated(result, _args, cache) {
        // Subscription updates cache automatically
      },
    },
  },
});

export { graphcacheExchange };
```

### 5.4 Cache Invalidation Strategies

```typescript
// Strategy 1: Refetch Queries (Simple but inefficient)
const [createUser] = useCreateUserMutation({
  refetchQueries: [
    { query: UsersDocument },
    { query: UserStatsDocument },
  ],
  awaitRefetchQueries: true, // Wait for refetch before returning
});

// Strategy 2: Cache Update (Efficient but complex)
const [createUser] = useCreateUserMutation({
  update(cache, { data }) {
    cache.modify({
      fields: {
        users(existingRef, { toReference }) {
          const newRef = toReference(data.createUser);
          return { ...existingRef, edges: [{ node: newRef }, ...existingRef.edges] };
        },
      },
    });
  },
});

// Strategy 3: Eviction + Refetch (Balanced)
const [createUser] = useCreateUserMutation({
  update(cache) {
    cache.evict({ fieldName: "users" });
    cache.gc();
  },
  refetchQueries: [{ query: UsersDocument }],
});

// Strategy 4: Reactive Variables (Local state)
import { cartItemsVar } from "@/lib/apollo-cache";

function addToCart(itemId: string) {
  cartItemsVar([...cartItemsVar(), itemId]);
}
```

### 5.5 Cache Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Not providing keyFields for types with non-standard IDs
typePolicies: {
  Product: {
    // Missing keyFields - Apollo assumes "id"
    // But Product uses "sku" as identifier!
  }
}

// ✅ CORRECT: Specify keyFields for custom identifiers
typePolicies: {
  Product: {
    keyFields: ["sku"],
  }
}

// ❌ WRONG: Using no-cache to "fix" stale data
const { data } = useUsersQuery({ fetchPolicy: "no-cache" });

// ✅ CORRECT: Fix cache configuration instead
typePolicies: {
  Query: {
    fields: {
      users: {
        merge(existing, incoming) {
          return incoming; // Proper merge strategy
        },
      },
    },
  },
}

// ❌ WRONG: Forgetting to garbage collect after evict
cache.evict({ id: `User:${id}` });
// Orphaned references may remain!

// ✅ CORRECT: Always gc() after evict()
cache.evict({ id: `User:${id}` });
cache.gc();

// ❌ WRONG: Modifying cache without broadcasting
cache.writeQuery({
  query: UsersDocument,
  data: newData,
  broadcast: false, // Components won't re-render!
});

// ✅ CORRECT: Let broadcast happen (default behavior)
cache.writeQuery({
  query: UsersDocument,
  data: newData,
});

// ❌ WRONG: Not handling pagination merge correctly
typePolicies: {
  Query: {
    fields: {
      users: {
        merge(existing = [], incoming) {
          return [...existing, ...incoming]; // Duplicates on refetch!
        },
      },
    },
  },
}

// ✅ CORRECT: Check for first page vs subsequent pages
merge(existing = { edges: [] }, incoming, { args }) {
  if (!args?.after) return incoming; // First page replaces
  return { ...incoming, edges: [...existing.edges, ...incoming.edges] };
}
```

### 5.6 When to Use Different Cache Strategies

| Scenario | Strategy | Reason |
|----------|----------|--------|
| Simple CRUD | `refetchQueries` | Easy to implement |
| Real-time updates | Cache update | Immediate UI update |
| List pagination | Field policy + merge | Handles cursor/offset |
| Local UI state | Reactive variables | No server roundtrip |
| Complex relationships | Normalized cache | Automatic consistency |
| Simple app | Document cache | Less complexity |

---

## Section 6: Optimistic Updates

### 6.1 Apollo Optimistic Response Pattern

```typescript
// features/todos/hooks/use-toggle-todo.ts
import { useToggleTodoMutation, TodoFragment } from "@/generated/graphql";

export function useToggleTodo() {
  const [toggleTodo] = useToggleTodoMutation();

  const toggle = (todo: TodoFragment) => {
    return toggleTodo({
      variables: { id: todo.id },
      // Optimistic response - applied immediately before server responds
      optimisticResponse: {
        __typename: "Mutation",
        toggleTodo: {
          __typename: "Todo",
          id: todo.id,
          completed: !todo.completed, // Optimistic new value
          // Include all fields that might be read from cache
          title: todo.title,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  return { toggle };
}

export { useToggleTodo };
```

### 6.2 Optimistic Update with Cache Modification

```typescript
// features/todos/hooks/use-create-todo.ts
import { useCreateTodoMutation, TodosDocument } from "@/generated/graphql";
import { v4 as uuidv4 } from "uuid";

export function useCreateTodo() {
  const [createTodo] = useCreateTodoMutation();

  const create = (title: string) => {
    const tempId = `temp-${uuidv4()}`; // Temporary ID for optimistic update

    return createTodo({
      variables: { input: { title } },
      optimisticResponse: {
        __typename: "Mutation",
        createTodo: {
          __typename: "Todo",
          id: tempId,
          title,
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      update(cache, { data }) {
        const newTodo = data?.createTodo;
        if (!newTodo) return;

        cache.modify({
          fields: {
            todos(existingTodos = []) {
              const newTodoRef = cache.writeFragment({
                data: newTodo,
                fragment: gql`
                  fragment NewTodo on Todo {
                    id
                    title
                    completed
                    createdAt
                    updatedAt
                  }
                `,
              });
              return [newTodoRef, ...existingTodos];
            },
          },
        });
      },
    });
  };

  return { create };
}

export { useCreateTodo };
```

### 6.3 URQL Graphcache Optimistic Updates

```typescript
// lib/urql-cache.ts
import { cacheExchange } from "@urql/exchange-graphcache";

export const graphcacheExchange = cacheExchange({
  optimistic: {
    toggleTodo(args, cache, info) {
      // Read current todo from cache
      const todo = cache.readFragment(
        gql`
          fragment _ on Todo {
            id
            completed
            title
          }
        `,
        { id: args.id }
      );

      if (!todo) return null;

      // Return optimistic result
      return {
        __typename: "Todo",
        id: args.id,
        completed: !todo.completed,
        title: todo.title,
        updatedAt: new Date().toISOString(),
      };
    },
    createTodo(args, cache, info) {
      return {
        __typename: "Todo",
        id: `temp-${Date.now()}`, // Temporary ID
        title: args.input.title,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    deleteTodo(args) {
      // Return null to indicate deletion
      return {
        __typename: "Todo",
        id: args.id,
        // Graphcache will remove this from lists
      };
    },
  },
  updates: {
    Mutation: {
      createTodo(result, args, cache) {
        // Update todos list after server responds
        cache.invalidate("Query", "todos");
      },
    },
  },
});
```

### 6.4 Rollback Handling Pattern

```typescript
// features/todos/hooks/use-toggle-todo-with-rollback.ts
import { useToggleTodoMutation, TodoFragment } from "@/generated/graphql";
import { useCallback, useState } from "react";

interface ToggleState {
  isOptimistic: boolean;
  error: Error | null;
}

export function useToggleTodoWithRollback() {
  const [toggleTodo] = useToggleTodoMutation();
  const [state, setState] = useState<ToggleState>({
    isOptimistic: false,
    error: null,
  });

  const toggle = useCallback(async (todo: TodoFragment) => {
    setState({ isOptimistic: true, error: null });

    try {
      await toggleTodo({
        variables: { id: todo.id },
        optimisticResponse: {
          __typename: "Mutation",
          toggleTodo: {
            __typename: "Todo",
            id: todo.id,
            completed: !todo.completed,
            title: todo.title,
            updatedAt: new Date().toISOString(),
          },
        },
        // Error handling automatically rolls back optimistic update
        onError(error) {
          setState({ isOptimistic: false, error });
          // Show toast notification
          console.error("Failed to toggle todo:", error);
        },
      });

      setState({ isOptimistic: false, error: null });
    } catch (error) {
      // Optimistic response automatically rolled back by Apollo
      setState({ isOptimistic: false, error: error as Error });
    }
  }, [toggleTodo]);

  return { toggle, ...state };
}

export { useToggleTodoWithRollback };
```

### 6.5 Optimistic Update Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Optimistic response missing required fields
optimisticResponse: {
  __typename: "Mutation",
  toggleTodo: {
    __typename: "Todo",
    id: todo.id,
    completed: !todo.completed,
    // Missing title, updatedAt - cache may have stale data!
  },
}

// ✅ CORRECT: Include all fields that components read
optimisticResponse: {
  __typename: "Mutation",
  toggleTodo: {
    __typename: "Todo",
    id: todo.id,
    completed: !todo.completed,
    title: todo.title,
    updatedAt: new Date().toISOString(),
  },
}

// ❌ WRONG: No error handling for optimistic updates
const [toggleTodo] = useToggleTodoMutation();
await toggleTodo({ variables, optimisticResponse });
// If mutation fails, user sees rollback without explanation!

// ✅ CORRECT: Handle errors gracefully
const [toggleTodo] = useToggleTodoMutation({
  onError(error) {
    toast.error("Failed to update. Please try again.");
  },
});

// ❌ WRONG: Using real IDs for new items
optimisticResponse: {
  createTodo: {
    id: "1", // What if server returns different ID?
  },
}

// ✅ CORRECT: Use temporary IDs that won't conflict
optimisticResponse: {
  createTodo: {
    id: `temp-${uuidv4()}`, // Will be replaced by server response
  },
}

// ❌ WRONG: Not updating cache after optimistic mutation
const [createTodo] = useCreateTodoMutation();
await createTodo({
  optimisticResponse: { ... },
  // Missing update function - new item not in list!
});

// ✅ CORRECT: Update cache to reflect optimistic change
await createTodo({
  optimisticResponse: { ... },
  update(cache, { data }) {
    // Add new item to list cache
  },
});
```

### 6.6 When to Use Optimistic Updates

**Use Optimistic Updates When:**
- Action has high success rate (>99%)
- UI feedback is important (toggles, likes, favorites)
- Network latency is noticeable
- User expects immediate response
- Rollback is acceptable UX

**Don't Use Optimistic Updates When:**
- Action may frequently fail (validation, permissions)
- Data integrity is critical (payments, transfers)
- Rollback would confuse users
- Server-side logic may modify data unexpectedly
- Complex multi-step operations

---

## Section 7: Error Handling Patterns

### 7.1 Global Error Link (Apollo)

```typescript
// lib/apollo-error-link.ts
import { onError } from "@apollo/client/link/error";
import { ServerError } from "@apollo/client";

const UNAUTHORIZED_CODE = "UNAUTHENTICATED";
const FORBIDDEN_CODE = "FORBIDDEN";
const NETWORK_ERROR_RETRY_COUNT = 3;

export const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  // Handle GraphQL errors
  if (graphQLErrors) {
    for (const error of graphQLErrors) {
      const { message, locations, path, extensions } = error;

      // Log error details
      console.error(
        `[GraphQL Error]: ${message}`,
        { operation: operation.operationName, path, locations, extensions }
      );

      // Handle authentication errors
      if (extensions?.code === UNAUTHORIZED_CODE) {
        // Clear auth token and redirect to login
        localStorage.removeItem("authToken");
        window.location.href = "/login";
        return;
      }

      // Handle authorization errors
      if (extensions?.code === FORBIDDEN_CODE) {
        // Show permission denied message
        window.dispatchEvent(new CustomEvent("permission-denied", { detail: { path } }));
        return;
      }
    }
  }

  // Handle network errors
  if (networkError) {
    const serverError = networkError as ServerError;

    console.error(`[Network Error]: ${networkError.message}`, {
      operation: operation.operationName,
      statusCode: serverError.statusCode,
    });

    // Handle specific status codes
    if (serverError.statusCode === 401) {
      localStorage.removeItem("authToken");
      window.location.href = "/login";
      return;
    }

    if (serverError.statusCode === 503) {
      // Service unavailable - could implement retry logic
      window.dispatchEvent(new CustomEvent("service-unavailable"));
    }
  }
});

export { errorLink };
```

### 7.2 Component-Level Error Handling

```typescript
// features/users/components/users-list.tsx
import { useUsersQuery } from "@/generated/graphql";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorMessage } from "@/components/error-message";

export function UsersList() {
  const { data, loading, error, refetch } = useUsersQuery();

  if (loading) {
    return <UsersListSkeleton />;
  }

  if (error) {
    // Handle specific error types
    if (error.networkError) {
      return (
        <ErrorMessage
          title="Network Error"
          message="Unable to connect to the server. Please check your internet connection."
          action={{ label: "Retry", onClick: () => refetch() }}
        />
      );
    }

    if (error.graphQLErrors.length > 0) {
      const firstError = error.graphQLErrors[0];

      if (firstError.extensions?.code === "NOT_FOUND") {
        return <EmptyState message="No users found" />;
      }

      return (
        <ErrorMessage
          title="Error Loading Users"
          message={firstError.message}
          action={{ label: "Try Again", onClick: () => refetch() }}
        />
      );
    }

    // Generic error fallback
    return (
      <ErrorMessage
        title="Something went wrong"
        message="An unexpected error occurred. Please try again later."
        action={{ label: "Retry", onClick: () => refetch() }}
      />
    );
  }

  return (
    <ul>
      {data?.users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// Wrap with error boundary for unexpected errors
export function UsersListWithBoundary() {
  return (
    <ErrorBoundary fallback={<ErrorMessage title="Component crashed" />}>
      <UsersList />
    </ErrorBoundary>
  );
}

export { UsersList, UsersListWithBoundary };
```

### 7.3 Error Boundary with Query Reset

```typescript
// components/graphql-error-boundary.tsx
import { QueryErrorResetBoundary } from "@apollo/client";
import { ErrorBoundary } from "react-error-boundary";

interface GraphQLErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function GraphQLErrorBoundary({ children, fallback }: GraphQLErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="error-boundary">
              <h2>Something went wrong</h2>
              <pre>{error.message}</pre>
              <button onClick={resetErrorBoundary}>Try again</button>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

export { GraphQLErrorBoundary };
```

### 7.4 Mutation Error Handling Pattern

```typescript
// features/users/hooks/use-create-user.ts
import { useCreateUserMutation, CreateUserInput } from "@/generated/graphql";

interface CreateUserError {
  type: "validation" | "conflict" | "network" | "unknown";
  message: string;
  field?: string;
}

export function useCreateUser() {
  const [createUserMutation, { loading }] = useCreateUserMutation();

  const createUser = async (input: CreateUserInput): Promise<{
    success: boolean;
    data?: any;
    error?: CreateUserError;
  }> => {
    try {
      const result = await createUserMutation({
        variables: { input },
        // Handle partial errors
        errorPolicy: "all",
      });

      // Check for GraphQL errors in response
      if (result.errors?.length) {
        const error = result.errors[0];

        if (error.extensions?.code === "BAD_USER_INPUT") {
          return {
            success: false,
            error: {
              type: "validation",
              message: error.message,
              field: error.extensions?.field as string,
            },
          };
        }

        if (error.extensions?.code === "CONFLICT") {
          return {
            success: false,
            error: {
              type: "conflict",
              message: "A user with this email already exists",
            },
          };
        }

        return {
          success: false,
          error: {
            type: "unknown",
            message: error.message,
          },
        };
      }

      return { success: true, data: result.data?.createUser };
    } catch (error) {
      // Network or unexpected errors
      return {
        success: false,
        error: {
          type: "network",
          message: "Unable to create user. Please check your connection.",
        },
      };
    }
  };

  return { createUser, isLoading: loading };
}

export { useCreateUser };
```

### 7.5 URQL Error Handling

```typescript
// lib/urql-error-exchange.ts
import { pipe, tap } from "wonka";
import { Exchange, CombinedError } from "urql";

const UNAUTHORIZED_CODE = "UNAUTHENTICATED";

export const errorExchange: Exchange = ({ forward }) => (ops$) => {
  return pipe(
    forward(ops$),
    tap(({ error }) => {
      if (!error) return;

      // Handle GraphQL errors
      if (error.graphQLErrors.length > 0) {
        for (const graphQLError of error.graphQLErrors) {
          // Handle authentication errors
          if (graphQLError.extensions?.code === UNAUTHORIZED_CODE) {
            localStorage.removeItem("authToken");
            window.location.href = "/login";
            return;
          }

          console.error("[GraphQL Error]:", graphQLError.message, {
            path: graphQLError.path,
            extensions: graphQLError.extensions,
          });
        }
      }

      // Handle network errors
      if (error.networkError) {
        console.error("[Network Error]:", error.networkError.message);

        // Optionally dispatch event for global handling
        window.dispatchEvent(
          new CustomEvent("network-error", { detail: error.networkError })
        );
      }
    })
  );
};

export { errorExchange };
```

### 7.6 Error Handling Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Ignoring errors entirely
function Users() {
  const { data } = useUsersQuery();
  return <ul>{data?.users.map(/* ... */)}</ul>; // What if error occurs?
}

// ✅ CORRECT: Handle all states
function Users() {
  const { data, loading, error } = useUsersQuery();
  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <ul>{data?.users.map(/* ... */)}</ul>;
}

// ❌ WRONG: Showing technical errors to users
if (error) {
  return <div>Error: {error.message}</div>; // "Cannot read property 'x' of null"
}

// ✅ CORRECT: User-friendly error messages
if (error) {
  return <ErrorMessage title="Unable to load users" action={{ label: "Retry", onClick: refetch }} />;
}

// ❌ WRONG: Not distinguishing error types
if (error) {
  return <div>Something went wrong</div>; // Is it network? Auth? Validation?
}

// ✅ CORRECT: Handle different error types appropriately
if (error.networkError) {
  return <NetworkErrorMessage onRetry={refetch} />;
}
if (error.graphQLErrors.some(e => e.extensions?.code === "UNAUTHENTICATED")) {
  return <Redirect to="/login" />;
}

// ❌ WRONG: Silently swallowing mutation errors
await createUser({ variables: { input } }); // Fire and forget!

// ✅ CORRECT: Handle mutation errors
const result = await createUser({ variables: { input } });
if (result.errors) {
  toast.error("Failed to create user");
}

// ❌ WRONG: Using try/catch for GraphQL errors
try {
  const { data } = await client.query({ query: UsersDocument });
} catch (e) {
  // GraphQL errors don't throw by default!
}

// ✅ CORRECT: Check result.errors
const result = await client.query({ query: UsersDocument, errorPolicy: "all" });
if (result.errors) {
  // Handle GraphQL errors
}
```

### 7.7 Error Handling Decision Framework

```
Error occurred?
├─ Is it a network error?
│   ├─ YES → Show "Check your connection" + Retry button
│   └─ NO → Continue checking
├─ Is it an authentication error (401/UNAUTHENTICATED)?
│   ├─ YES → Clear auth state → Redirect to login
│   └─ NO → Continue checking
├─ Is it an authorization error (403/FORBIDDEN)?
│   ├─ YES → Show "Permission denied" message
│   └─ NO → Continue checking
├─ Is it a validation error (400/BAD_USER_INPUT)?
│   ├─ YES → Show field-specific error messages
│   └─ NO → Continue checking
├─ Is it a not found error (404/NOT_FOUND)?
│   ├─ YES → Show 404 page or empty state
│   └─ NO → Continue checking
└─ Unknown error?
    └─ Show generic "Something went wrong" + Retry + Report button
```

---

## Section 8: Pagination Patterns

### 8.1 Cursor-Based Pagination (Relay Style)

```typescript
// Schema
/*
type Query {
  users(first: Int, after: String, last: Int, before: String): UserConnection!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  cursor: String!
  node: User!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
*/

// Query
const USERS_QUERY = gql`
  query Users($first: Int!, $after: String) {
    users(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          email
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;
```

### 8.2 Apollo Cursor Pagination Hook

```typescript
// features/users/hooks/use-paginated-users.ts
import { useUsersQuery, UsersQueryVariables } from "@/generated/graphql";
import { useCallback } from "react";

const DEFAULT_PAGE_SIZE = 20;

interface UsePaginatedUsersOptions {
  pageSize?: number;
}

export function usePaginatedUsers(options: UsePaginatedUsersOptions = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE } = options;

  const { data, loading, error, fetchMore } = useUsersQuery({
    variables: { first: pageSize },
    notifyOnNetworkStatusChange: true,
  });

  const loadMore = useCallback(async () => {
    if (!data?.users.pageInfo.hasNextPage || loading) return;

    await fetchMore({
      variables: {
        first: pageSize,
        after: data.users.pageInfo.endCursor,
      },
    });
  }, [data, loading, fetchMore, pageSize]);

  return {
    users: data?.users.edges.map((edge) => edge.node) ?? [],
    pageInfo: data?.users.pageInfo,
    totalCount: data?.users.totalCount,
    isLoading: loading,
    error,
    loadMore,
    hasMore: data?.users.pageInfo.hasNextPage ?? false,
  };
}

export { usePaginatedUsers };
```

### 8.3 Apollo Cache Field Policy for Pagination

```typescript
// lib/apollo-cache.ts
import { InMemoryCache } from "@apollo/client";

const DEFAULT_PAGE_SIZE = 20;

export const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        users: {
          // Cache separately based on filter/search criteria
          keyArgs: ["filter", "searchTerm", "sortBy"],

          // Merge pagination results
          merge(existing = { edges: [], pageInfo: {} }, incoming, { args }) {
            // If fetching first page (no cursor), replace cache
            if (!args?.after) {
              return incoming;
            }

            // Append new edges to existing
            return {
              ...incoming,
              edges: [...existing.edges, ...incoming.edges],
            };
          },
        },
      },
    },
  },
});

export { cache };
```

### 8.4 Offset-Based Pagination

```typescript
// Query
const USERS_QUERY = gql`
  query Users($limit: Int!, $offset: Int!) {
    users(limit: $limit, offset: $offset) {
      items {
        id
        name
        email
      }
      total
      hasMore
    }
  }
`;

// Hook
export function usePaginatedUsers() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, loading, error } = useUsersQuery({
    variables: {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
  });

  const totalPages = data ? Math.ceil(data.users.total / pageSize) : 0;

  return {
    users: data?.users.items ?? [],
    isLoading: loading,
    error,
    page,
    totalPages,
    hasNext: data?.users.hasMore ?? false,
    hasPrev: page > 1,
    goToPage: setPage,
    nextPage: () => setPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
  };
}
```

### 8.5 Infinite Scroll Implementation

```typescript
// features/users/components/users-infinite-list.tsx
import { useEffect, useRef, useCallback } from "react";
import { usePaginatedUsers } from "../hooks/use-paginated-users";

export function UsersInfiniteList() {
  const { users, isLoading, hasMore, loadMore, error } = usePaginatedUsers();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, isLoading, loadMore]);

  if (error) {
    return <ErrorMessage error={error} />;
  }

  return (
    <div className="users-list">
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}

      {/* Sentinel element for intersection observer */}
      <div ref={sentinelRef} className="sentinel" />

      {isLoading && <LoadingSpinner />}

      {!hasMore && users.length > 0 && (
        <p className="end-message">No more users to load</p>
      )}
    </div>
  );
}

export { UsersInfiniteList };
```

### 8.6 Pagination Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Using offset pagination for real-time data
const { data } = useUsersQuery({
  variables: { limit: 20, offset: page * 20 },
  // If items are added/removed, pages shift!
});

// ✅ CORRECT: Use cursor pagination for real-time data
const { data } = useUsersQuery({
  variables: { first: 20, after: cursor },
  // Cursors are stable regardless of insertions/deletions
});

// ❌ WRONG: Not using keyArgs for filtered pagination
typePolicies: {
  Query: {
    fields: {
      users: {
        // Missing keyArgs - different filters share cache!
        merge(existing, incoming) { ... },
      },
    },
  },
}

// ✅ CORRECT: Separate cache by filter criteria
typePolicies: {
  Query: {
    fields: {
      users: {
        keyArgs: ["filter", "sortBy", "searchTerm"],
        merge(existing, incoming, { args }) { ... },
      },
    },
  },
}

// ❌ WRONG: Fetching all data then paginating client-side
const { data } = useUsersQuery(); // Fetches ALL users!
const pagedUsers = data?.users.slice(offset, offset + limit);

// ✅ CORRECT: Paginate server-side
const { data } = useUsersQuery({
  variables: { first: 20, after: cursor },
});

// ❌ WRONG: Not handling loading state during fetchMore
function Users() {
  const { data, fetchMore } = useUsersQuery();
  return (
    <>
      {data?.users.map(/* ... */)}
      <button onClick={() => fetchMore()}>Load More</button>
      {/* No loading indicator during fetchMore! */}
    </>
  );
}

// ✅ CORRECT: Track loading state with notifyOnNetworkStatusChange
const { data, loading, fetchMore } = useUsersQuery({
  notifyOnNetworkStatusChange: true, // loading becomes true during fetchMore
});

// ❌ WRONG: Replacing cache on every page load
merge(existing, incoming) {
  return incoming; // Loses previous pages!
}

// ✅ CORRECT: Check if it's first page or subsequent
merge(existing, incoming, { args }) {
  if (!args?.after) return incoming; // First page
  return { ...incoming, edges: [...existing.edges, ...incoming.edges] };
}
```

### 8.7 Cursor vs Offset Decision Framework

```
Choosing pagination strategy?
├─ Is data real-time / frequently changing?
│   ├─ YES → Cursor pagination
│   └─ NO → Either works
├─ Do users need to jump to specific page?
│   ├─ YES → Offset pagination
│   └─ NO → Cursor pagination preferred
├─ Is the dataset very large (>100k items)?
│   ├─ YES → Cursor pagination (better performance)
│   └─ NO → Either works
├─ Do you need stable URLs for pages?
│   ├─ YES → Offset pagination (page numbers in URL)
│   └─ NO → Cursor pagination preferred
└─ Using infinite scroll?
    ├─ YES → Cursor pagination
    └─ NO → Offset pagination for page numbers
```

---

## Section 9: TypeScript Integration

### 9.1 Strict Scalar Configuration

```typescript
// codegen.ts
const config: CodegenConfig = {
  generates: {
    "./src/generated/graphql.ts": {
      config: {
        strictScalars: true,
        scalars: {
          // Map GraphQL scalars to TypeScript types
          DateTime: "string",
          Date: "string",
          Time: "string",
          JSON: "Record<string, unknown>",
          JSONObject: "Record<string, unknown>",
          UUID: "string",
          Upload: "File",
          Void: "void",
          BigInt: "bigint",
          // Custom branded types for extra safety
          EmailAddress: "string & { readonly brand: unique symbol }",
          URL: "string & { readonly brand: unique symbol }",
        },
      },
    },
  },
};
```

### 9.2 Branded Types for Type Safety

```typescript
// types/scalars.ts

// Branded type pattern for nominal typing
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

// Define branded scalar types
export type EmailAddress = Brand<string, "EmailAddress">;
export type URL = Brand<string, "URL">;
export type UserId = Brand<string, "UserId">;
export type ISO8601DateTime = Brand<string, "ISO8601DateTime">;

// Type guards for runtime validation
export function isEmail(value: string): value is EmailAddress {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isURL(value: string): value is URL {
  try {
    new globalThis.URL(value);
    return true;
  } catch {
    return false;
  }
}

// Helper functions to create branded types
export function createEmail(value: string): EmailAddress {
  if (!isEmail(value)) {
    throw new Error(`Invalid email: ${value}`);
  }
  return value as EmailAddress;
}
```

### 9.3 Type-Safe Variables Pattern

```typescript
// features/users/hooks/use-user.ts
import { useUserQuery, UserQueryVariables, Exact } from "@/generated/graphql";

// Variables are fully typed
export function useUser(id: string) {
  // TypeScript ensures correct variable types
  const variables: Exact<UserQueryVariables> = { id };

  const { data, loading, error } = useUserQuery({
    variables,
    skip: !id,
  });

  return {
    user: data?.user,
    isLoading: loading,
    error,
  };
}

// Type-safe mutation input
import { CreateUserMutationVariables, CreateUserInput } from "@/generated/graphql";

export function useCreateUser() {
  const [createUser] = useCreateUserMutation();

  // Input is typed from GraphQL schema
  const submit = async (input: CreateUserInput) => {
    const variables: CreateUserMutationVariables = { input };
    return createUser({ variables });
  };

  return { submit };
}
```

### 9.4 Discriminated Union for Results

```typescript
// types/result.ts
import { ApolloError } from "@apollo/client";

// Discriminated union pattern for query results
type QueryResult<T> =
  | { status: "loading" }
  | { status: "error"; error: ApolloError }
  | { status: "success"; data: T };

// Hook using discriminated union
export function useUserResult(id: string): QueryResult<User> {
  const { data, loading, error } = useUserQuery({ variables: { id } });

  if (loading) {
    return { status: "loading" };
  }

  if (error) {
    return { status: "error", error };
  }

  if (!data?.user) {
    return { status: "error", error: new ApolloError({ errorMessage: "User not found" }) };
  }

  return { status: "success", data: data.user };
}

// Usage with exhaustive checking
function UserProfile({ id }: { id: string }) {
  const result = useUserResult(id);

  switch (result.status) {
    case "loading":
      return <Skeleton />;
    case "error":
      return <ErrorMessage error={result.error} />;
    case "success":
      return <UserCard user={result.data} />;
    // TypeScript ensures all cases are handled
  }
}
```

### 9.5 Generic Query Wrapper

```typescript
// hooks/use-typed-query.ts
import { DocumentNode, useQuery, QueryHookOptions, TypedDocumentNode } from "@apollo/client";

// Generic wrapper with better typing
export function useTypedQuery<TData, TVariables extends Record<string, unknown>>(
  query: TypedDocumentNode<TData, TVariables>,
  options?: QueryHookOptions<TData, TVariables>
) {
  const result = useQuery(query, options);

  return {
    ...result,
    // Type-safe data access
    data: result.data as TData | undefined,
    // Helper for checking empty state
    isEmpty: !result.loading && !result.error && !result.data,
  };
}

// Usage
const { data, isEmpty } = useTypedQuery(UsersDocument, {
  variables: { first: 20 }, // Fully typed
});
```

### 9.6 TypeScript Integration Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Using "any" for GraphQL data
const { data } = useQuery(USERS_QUERY);
const users = data?.users as any[]; // Lost all type safety!

// ✅ CORRECT: Use generated types
const { data } = useUsersQuery();
const users = data?.users; // Fully typed

// ❌ WRONG: Not using strictScalars
config: {
  // Missing strictScalars: true
  // DateTime becomes "any"
}

// ✅ CORRECT: Enable strict scalars
config: {
  strictScalars: true,
  scalars: {
    DateTime: "string",
    JSON: "Record<string, unknown>",
  },
}

// ❌ WRONG: Manual type assertions
const user = data?.user as User; // Dangerous!

// ✅ CORRECT: Let codegen provide types
const user = data?.user; // Type is inferred

// ❌ WRONG: Ignoring null/undefined
function UserName({ data }: { data: UsersQuery }) {
  return <span>{data.user.name}</span>; // user might be null!
}

// ✅ CORRECT: Handle null/undefined
function UserName({ data }: { data: UsersQuery }) {
  return <span>{data.user?.name ?? "Unknown"}</span>;
}

// ❌ WRONG: Using enums from codegen (causes issues)
if (user.status === UserStatus.ACTIVE) { ... }
// Enums can cause tree-shaking and bundle issues

// ✅ CORRECT: Use enumsAsTypes for string unions
if (user.status === "ACTIVE") { ... }
// Works better with type narrowing

// ❌ WRONG: Not validating input at boundaries
function createUser(input: unknown) {
  createUserMutation({ variables: { input } }); // Type unsafe!
}

// ✅ CORRECT: Validate with Zod at boundaries
import { createUserInputSchema } from "@/schemas/user";

function createUser(input: unknown) {
  const validInput = createUserInputSchema.parse(input);
  createUserMutation({ variables: { input: validInput } });
}
```

---

## Section 10: Testing GraphQL Clients

### 10.1 MSW Handler Setup

```typescript
// mocks/handlers/users.ts
import { graphql, HttpResponse } from "msw";
import { UsersDocument, CreateUserDocument } from "@/generated/graphql";
import { mockUsers, mockUser } from "../data/users";

export const usersHandlers = [
  // Query handler
  graphql.query("Users", ({ variables }) => {
    const { first = 10, after } = variables;

    // Simulate pagination
    const startIndex = after ? mockUsers.findIndex((u) => u.id === after) + 1 : 0;
    const users = mockUsers.slice(startIndex, startIndex + first);
    const hasNextPage = startIndex + first < mockUsers.length;

    return HttpResponse.json({
      data: {
        users: {
          edges: users.map((user) => ({
            cursor: user.id,
            node: user,
          })),
          pageInfo: {
            hasNextPage,
            endCursor: users[users.length - 1]?.id ?? null,
          },
          totalCount: mockUsers.length,
        },
      },
    });
  }),

  // Single user query
  graphql.query("User", ({ variables }) => {
    const user = mockUsers.find((u) => u.id === variables.id);

    if (!user) {
      return HttpResponse.json({
        data: null,
        errors: [
          {
            message: "User not found",
            extensions: { code: "NOT_FOUND" },
          },
        ],
      });
    }

    return HttpResponse.json({
      data: { user },
    });
  }),

  // Mutation handler
  graphql.mutation("CreateUser", ({ variables }) => {
    const newUser = {
      id: `user-${Date.now()}`,
      ...variables.input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockUsers.push(newUser);

    return HttpResponse.json({
      data: { createUser: newUser },
    });
  }),
];

export { usersHandlers };
```

### 10.2 Apollo MockedProvider Testing

```typescript
// features/users/components/__tests__/users-list.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { UsersList } from "../users-list";
import { UsersDocument, UsersQuery } from "@/generated/graphql";

// Mock data
const mockUsersResponse: MockedResponse<UsersQuery> = {
  request: {
    query: UsersDocument,
    variables: { first: 20 },
  },
  result: {
    data: {
      users: {
        edges: [
          { cursor: "1", node: { id: "1", name: "Alice", email: "alice@test.com" } },
          { cursor: "2", node: { id: "2", name: "Bob", email: "bob@test.com" } },
        ],
        pageInfo: { hasNextPage: false, endCursor: "2" },
        totalCount: 2,
      },
    },
  },
};

const mockUsersError: MockedResponse = {
  request: {
    query: UsersDocument,
    variables: { first: 20 },
  },
  error: new Error("Network error"),
};

describe("UsersList", () => {
  it("renders loading state initially", () => {
    render(
      <MockedProvider mocks={[mockUsersResponse]}>
        <UsersList />
      </MockedProvider>
    );

    expect(screen.getByTestId("users-skeleton")).toBeInTheDocument();
  });

  it("renders users after loading", async () => {
    render(
      <MockedProvider mocks={[mockUsersResponse]}>
        <UsersList />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("renders error state on failure", async () => {
    render(
      <MockedProvider mocks={[mockUsersError]}>
        <UsersList />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### 10.3 MSW Integration Testing

```typescript
// features/users/components/__tests__/users-list.integration.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "@/lib/apollo-client";
import { UsersList } from "../users-list";
import { server } from "@/mocks/server";
import { graphql, HttpResponse } from "msw";

// Use MSW server (setupTests.ts should start server)
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("UsersList Integration", () => {
  const renderWithApollo = (ui: React.ReactElement) => {
    return render(<ApolloProvider client={apolloClient}>{ui}</ApolloProvider>);
  };

  it("loads and displays users from API", async () => {
    renderWithApollo(<UsersList />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });

  it("handles API errors gracefully", async () => {
    // Override handler for this test
    server.use(
      graphql.query("Users", () => {
        return HttpResponse.json({
          errors: [{ message: "Server error", extensions: { code: "INTERNAL_ERROR" } }],
        });
      })
    );

    renderWithApollo(<UsersList />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it("loads more users on scroll", async () => {
    const user = userEvent.setup();
    renderWithApollo(<UsersList />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("User 1")).toBeInTheDocument();
    });

    // Trigger load more
    const loadMoreButton = screen.getByRole("button", { name: /load more/i });
    await user.click(loadMoreButton);

    // Wait for more users
    await waitFor(() => {
      expect(screen.getByText("User 21")).toBeInTheDocument();
    });
  });
});
```

### 10.4 URQL Testing with Mocked Client

```typescript
// features/users/components/__tests__/users-list.urql.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { Provider, createClient, fetchExchange } from "urql";
import { fromValue, never, pipe, map } from "wonka";
import { UsersList } from "../users-list";

// Create a mocked client
const mockClient = (executeQuery: any) =>
  createClient({
    url: "/graphql",
    exchanges: [
      () => (ops$) => pipe(ops$, map(executeQuery)),
    ],
  });

describe("UsersList (URQL)", () => {
  it("renders loading state initially", () => {
    const client = mockClient(() => never); // Never resolves

    render(
      <Provider value={client}>
        <UsersList />
      </Provider>
    );

    expect(screen.getByTestId("users-skeleton")).toBeInTheDocument();
  });

  it("renders users after loading", async () => {
    const client = mockClient(() =>
      fromValue({
        data: {
          users: {
            edges: [
              { cursor: "1", node: { id: "1", name: "Alice", email: "alice@test.com" } },
            ],
            pageInfo: { hasNextPage: false, endCursor: "1" },
            totalCount: 1,
          },
        },
      })
    );

    render(
      <Provider value={client}>
        <UsersList />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });

  it("renders error state on failure", async () => {
    const client = mockClient(() =>
      fromValue({
        error: new Error("Network error"),
      })
    );

    render(
      <Provider value={client}>
        <UsersList />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### 10.5 Testing Custom Hooks

```typescript
// features/users/hooks/__tests__/use-create-user.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { useCreateUser } from "../use-create-user";
import { CreateUserDocument } from "@/generated/graphql";

const mockCreateUserSuccess = {
  request: {
    query: CreateUserDocument,
    variables: {
      input: { name: "Test User", email: "test@example.com" },
    },
  },
  result: {
    data: {
      createUser: {
        id: "new-user-id",
        name: "Test User",
        email: "test@example.com",
      },
    },
  },
};

const mockCreateUserError = {
  request: {
    query: CreateUserDocument,
    variables: {
      input: { name: "Test", email: "invalid-email" },
    },
  },
  result: {
    errors: [
      {
        message: "Invalid email format",
        extensions: { code: "BAD_USER_INPUT", field: "email" },
      },
    ],
  },
};

describe("useCreateUser", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={[mockCreateUserSuccess, mockCreateUserError]}>
      {children}
    </MockedProvider>
  );

  it("creates user successfully", async () => {
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    const response = await result.current.createUser({
      name: "Test User",
      email: "test@example.com",
    });

    expect(response.success).toBe(true);
    expect(response.data?.id).toBe("new-user-id");
  });

  it("handles validation errors", async () => {
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    const response = await result.current.createUser({
      name: "Test",
      email: "invalid-email",
    });

    expect(response.success).toBe(false);
    expect(response.error?.type).toBe("validation");
    expect(response.error?.field).toBe("email");
  });
});
```

### 10.6 Testing Anti-Patterns

```typescript
// ANTI-PATTERNS

// ❌ WRONG: Not waiting for async operations
it("renders users", () => {
  render(
    <MockedProvider mocks={[mock]}>
      <UsersList />
    </MockedProvider>
  );
  expect(screen.getByText("Alice")).toBeInTheDocument(); // Fails! Still loading
});

// ✅ CORRECT: Wait for loading to complete
it("renders users", async () => {
  render(
    <MockedProvider mocks={[mock]}>
      <UsersList />
    </MockedProvider>
  );
  await waitFor(() => {
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});

// ❌ WRONG: Testing implementation details
it("calls useQuery with correct variables", () => {
  // Testing internal hook calls, not behavior!
});

// ✅ CORRECT: Test behavior, not implementation
it("displays filtered users when filter is applied", async () => {
  // Test what user sees
});

// ❌ WRONG: Not resetting MSW handlers between tests
afterEach(() => {
  // Missing: server.resetHandlers()
});

// ✅ CORRECT: Reset handlers to prevent test pollution
afterEach(() => {
  server.resetHandlers();
});

// ❌ WRONG: Not clearing Apollo cache between tests
beforeEach(() => {
  // Missing cache clear
});

// ✅ CORRECT: Clear cache for isolation
beforeEach(() => {
  apolloClient.clearStore();
});

// ❌ WRONG: Hardcoding mock data inline
const mock = {
  result: {
    data: {
      users: [{ id: "1", name: "Alice", email: "alice@test.com", createdAt: "2024-01-01" }],
    },
  },
};

// ✅ CORRECT: Use factories for mock data
import { userFactory, usersQueryFactory } from "@/mocks/factories/users";
const mock = usersQueryFactory.build({ count: 3 });

// ❌ WRONG: Not testing error states
describe("UsersList", () => {
  it("renders users", async () => { /* ... */ });
  // Missing error state tests!
});

// ✅ CORRECT: Test all states
describe("UsersList", () => {
  it("renders loading state", () => { /* ... */ });
  it("renders users after loading", async () => { /* ... */ });
  it("renders error state on failure", async () => { /* ... */ });
  it("renders empty state when no users", async () => { /* ... */ });
});
```

### 10.7 Testing Decision Framework

```
What should I test?
├─ Is it a query component?
│   ├─ Loading state
│   ├─ Success state with data
│   ├─ Error state (network, GraphQL)
│   └─ Empty state (no data)
├─ Is it a mutation component?
│   ├─ Form submission triggers mutation
│   ├─ Success callback fires
│   ├─ Error handling (validation, server)
│   └─ Optimistic update appears immediately
├─ Is it a custom hook?
│   ├─ Return values are correct
│   ├─ Loading/error states exposed
│   └─ Refetch/fetchMore work correctly
└─ Is it pagination?
    ├─ Initial page loads
    ├─ Load more works
    ├─ End of list handled
    └─ Cache merges correctly

What testing approach?
├─ Unit test (MockedProvider / mocked client)?
│   └─ Use for isolated component tests
├─ Integration test (MSW)?
│   └─ Use for testing real network layer
└─ E2E test (Playwright)?
    └─ Use for critical user flows
```

---

## Summary: Skill Architecture Recommendations

Based on this research, the following atomic skills should be created:

### Recommended Skills

| Skill ID | Focus Area | Priority |
|----------|------------|----------|
| `frontend/graphql-apollo` | Apollo Client setup, queries, mutations, subscriptions | High |
| `frontend/graphql-urql` | URQL setup, exchanges, Graphcache | Medium |
| `frontend/graphql-codegen` | GraphQL codegen configuration, presets | High |
| `frontend/graphql-fragments` | Fragment colocation, masking | Medium |
| `frontend/graphql-cache` | Cache configuration, field policies, normalization | High |
| `frontend/graphql-pagination` | Cursor/offset pagination, infinite scroll | Medium |
| `frontend/graphql-testing` | MSW handlers, MockedProvider, hook testing | High |

### Cross-Cutting Concerns

Each skill should reference:
- **TypeScript integration**: Strict scalars, branded types, type-safe variables
- **Error handling**: Global error links, component-level handling, mutation errors
- **Optimistic updates**: When applicable (mutations)

### Skill Dependencies

```
graphql-codegen (base requirement)
    ├── graphql-apollo OR graphql-urql (client choice)
    │       ├── graphql-fragments (colocation)
    │       ├── graphql-cache (advanced caching)
    │       ├── graphql-pagination (data loading)
    │       └── graphql-testing (quality assurance)
```

---

_Research completed: 2026-01-15_
_Researcher: Claude Opus 4.5_
