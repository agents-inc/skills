# URQL GraphQL Client Best Practices Research (2025/2026)

> **Research Date:** January 2026
> **URQL Version:** v4.x / v5.x
> **Focus:** Modern patterns, exchange architecture, caching strategies, TypeScript integration

---

## Executive Summary

URQL is a highly customizable and versatile GraphQL client that emphasizes simplicity, extensibility, and small bundle size. Unlike Apollo Client's monolithic approach, URQL uses an exchange-based architecture that allows developers to add features incrementally as needed.

**Key Differentiators from Apollo:**
- **Bundle size:** ~12-17KB gzipped vs Apollo's ~30KB+
- **Architecture:** Middleware-style exchanges vs monolithic client
- **Caching:** Document caching by default, normalized cache opt-in via Graphcache
- **Philosophy:** Start minimal, add complexity as needed

---

## Core Philosophy

URQL follows the principle of progressive enhancement. The core package provides document caching and basic fetching, while advanced features like normalized caching, authentication, and offline support are added through exchanges.

**Three Architectural Layers:**
1. **Bindings** - Framework integrations (React, Vue, Svelte, Solid)
2. **Client** - Core engine managing operations and coordinating exchanges
3. **Exchanges** - Plugins providing functionality (caching, fetching, auth)

**Stream-Based Architecture:**
All operations in URQL are treated as Observable streams using the Wonka library. This enables:
- Multiple results per query (cache updates trigger new emissions)
- Asynchronous event handling
- Concurrent operation processing

---

## 1. Client Setup and Configuration

### Basic Client Setup

```typescript
// lib/urql-client.ts
import { Client, cacheExchange, fetchExchange } from "urql";

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql";

const client = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
});

export { client };
```

### Provider Setup (React)

```typescript
// app/providers.tsx
import { Provider } from "urql";
import { client } from "@/lib/urql-client";
import type { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

function Providers({ children }: ProvidersProps) {
  return <Provider value={client}>{children}</Provider>;
}

export { Providers };
```

### Advanced Client with Multiple Exchanges

```typescript
// lib/urql-client.ts
import {
  Client,
  cacheExchange,
  fetchExchange,
  mapExchange,
  subscriptionExchange,
} from "urql";
import { authExchange } from "@urql/exchange-auth";
import { retryExchange } from "@urql/exchange-retry";
import { createClient as createWSClient } from "graphql-ws";

const GRAPHQL_HTTP_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL || "";
const GRAPHQL_WS_URL = process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || "";

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// WebSocket client for subscriptions
const wsClient = createWSClient({
  url: GRAPHQL_WS_URL,
  connectionParams: () => ({
    authToken: localStorage.getItem("token"),
  }),
});

const client = new Client({
  url: GRAPHQL_HTTP_URL,
  exchanges: [
    // Error handling (must be before authExchange)
    mapExchange({
      onError(error) {
        const isAuthError = error.graphQLErrors.some(
          (e) => e.extensions?.code === "FORBIDDEN"
        );
        if (isAuthError) {
          // Handle logout
          localStorage.removeItem("token");
          window.location.href = "/login";
        }
      },
    }),
    // Document cache (synchronous - must come before async exchanges)
    cacheExchange,
    // Authentication
    authExchange(async (utils) => {
      let token = localStorage.getItem("token");
      let refreshToken = localStorage.getItem("refreshToken");

      return {
        addAuthToOperation(operation) {
          if (!token) return operation;
          return utils.appendHeaders(operation, {
            Authorization: `Bearer ${token}`,
          });
        },
        didAuthError(error) {
          return error.graphQLErrors.some(
            (e) => e.extensions?.code === "UNAUTHORIZED"
          );
        },
        async refreshAuth() {
          const result = await utils.mutate(REFRESH_TOKEN_MUTATION, {
            refreshToken,
          });
          if (result.data?.refreshToken) {
            token = result.data.refreshToken.token;
            refreshToken = result.data.refreshToken.refreshToken;
            localStorage.setItem("token", token);
            localStorage.setItem("refreshToken", refreshToken);
          } else {
            localStorage.clear();
            window.location.href = "/login";
          }
        },
      };
    }),
    // Retry failed requests
    retryExchange({
      maxNumberAttempts: MAX_RETRY_ATTEMPTS,
      initialDelayMs: INITIAL_RETRY_DELAY_MS,
      retryIf: (error) => !!(error.networkError),
    }),
    // HTTP requests
    fetchExchange,
    // WebSocket subscriptions
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
  ],
});

export { client };
```

**Why this pattern works:**
- Exchange order matters: synchronous exchanges (cacheExchange) before async (fetchExchange)
- mapExchange for global error handling placed before authExchange
- retryExchange only retries network errors, not GraphQL errors
- Named constants for retry configuration

---

## 2. Exchange Architecture

### Default Exchanges

URQL's default exchange stack:

1. **dedupExchange** - Deduplicates identical in-flight requests
2. **cacheExchange** - Document caching (query + variables hash)
3. **fetchExchange** - HTTP requests to GraphQL API

### Exchange Interface

```typescript
import type { Exchange, Operation, OperationResult } from "urql";
import { pipe, tap, filter, merge } from "wonka";

// Basic exchange structure
const loggingExchange: Exchange = ({ forward }) => {
  return (operations$) => {
    // Inspect/modify operations going forward
    const processedOps$ = pipe(
      operations$,
      tap((operation) => {
        console.log("[GraphQL Request]", operation.kind, operation.key);
      })
    );

    // Forward to next exchange and get results
    const results$ = forward(processedOps$);

    // Inspect/modify results coming back
    return pipe(
      results$,
      tap((result) => {
        console.log("[GraphQL Response]", result.operation.key, result.data);
      })
    );
  };
};

export { loggingExchange };
```

### Custom Exchange: Offline Mutation Queue

```typescript
import type { Exchange } from "urql";
import { pipe, filter, merge, map } from "wonka";
import { makeErrorResult } from "urql";

const offlineMutationExchange: Exchange = ({ forward }) => {
  const pendingMutations: Operation[] = [];

  return (operations$) => {
    const isOnline = () => navigator.onLine;

    // Split operations: offline mutations vs everything else
    const [offlineMutations$, onlineOps$] = pipe(
      operations$,
      filter((op) => {
        if (op.kind === "mutation" && !isOnline()) {
          pendingMutations.push(op);
          return false; // Don't forward offline mutations
        }
        return true;
      })
    );

    // Create error results for offline mutations
    const offlineResults$ = pipe(
      offlineMutations$,
      map((op) =>
        makeErrorResult(op, new Error("Mutation queued - device offline"))
      )
    );

    // Forward online operations normally
    const onlineResults$ = forward(onlineOps$);

    return merge([onlineResults$, offlineResults$]);
  };
};

export { offlineMutationExchange };
```

### Available First-Party Exchanges

| Exchange | Purpose |
|----------|---------|
| `cacheExchange` | Document caching (default) |
| `fetchExchange` | HTTP requests (default) |
| `@urql/exchange-graphcache` | Normalized caching |
| `@urql/exchange-auth` | Authentication flow |
| `@urql/exchange-retry` | Retry failed requests |
| `@urql/exchange-persisted` | Persisted queries/APQ |
| `@urql/exchange-request-policy` | TTL-based policy upgrades |
| `mapExchange` | Inspect/modify operations and results |
| `ssrExchange` | Server-side rendering support |
| `subscriptionExchange` | WebSocket subscriptions |

---

## 3. Caching Strategies

### Document Caching (Default)

Document caching treats each unique query + variables combination as a cached document.

```typescript
import { Client, cacheExchange, fetchExchange } from "urql";

const client = new Client({
  url: "/graphql",
  exchanges: [cacheExchange, fetchExchange],
  // Default request policy
  requestPolicy: "cache-first",
});
```

**Request Policies:**

| Policy | Behavior |
|--------|----------|
| `cache-first` | Return cached data if available, else fetch (default) |
| `cache-only` | Only return cached data, never fetch |
| `network-only` | Always fetch, skip cache read |
| `cache-and-network` | Return cached immediately, then fetch and update |

### Normalized Caching with Graphcache

```typescript
// lib/urql-client.ts
import { Client, fetchExchange } from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";

const client = new Client({
  url: "/graphql",
  exchanges: [
    cacheExchange({
      // Custom key generation
      keys: {
        // Use SKU instead of id for Product type
        Product: (data) => data.sku as string,
        // Non-keyable type (embedded in parent)
        GeoLocation: () => null,
      },
      // Local resolvers
      resolvers: {
        Query: {
          // Resolve single todo from cache using ID
          todo: (_, args) => ({ __typename: "Todo", id: args.id }),
        },
        Todo: {
          // Computed field
          isOverdue: (parent) => {
            const dueDate = new Date(parent.dueDate as string);
            return dueDate < new Date();
          },
        },
      },
      // Cache updates for mutations
      updates: {
        Mutation: {
          // Add new todo to list
          createTodo: (result, _args, cache) => {
            cache.updateQuery({ query: TODOS_QUERY }, (data) => {
              if (!data || !result.createTodo) return data;
              return {
                ...data,
                todos: [...data.todos, result.createTodo],
              };
            });
          },
          // Remove deleted todo from list
          deleteTodo: (_result, args, cache) => {
            cache.invalidate({ __typename: "Todo", id: args.id as string });
          },
        },
      },
      // Optimistic updates
      optimistic: {
        toggleTodo: (args, _cache) => ({
          __typename: "Todo",
          id: args.id,
          completed: args.completed,
        }),
      },
    }),
    fetchExchange,
  ],
});

export { client };
```

**Key Graphcache Concepts:**

1. **Keys** - How entities are identified (default: `id` or `_id`)
2. **Resolvers** - Override how fields are read from cache
3. **Updates** - Manual cache modifications after mutations
4. **Optimistic** - Predict mutation results for instant UI feedback

### Offline Support with Graphcache

```typescript
import { offlineExchange } from "@urql/exchange-graphcache";
import { makeDefaultStorage } from "@urql/exchange-graphcache/default-storage";

const storage = makeDefaultStorage({
  idbName: "my-app-cache",
  maxAge: 7, // Days to keep cached data
});

const client = new Client({
  url: "/graphql",
  exchanges: [
    offlineExchange({
      storage,
      keys: { /* ... */ },
      resolvers: { /* ... */ },
      updates: { /* ... */ },
      optimistic: { /* ... */ },
    }),
    fetchExchange,
  ],
});
```

---

## 4. Query Patterns

### Basic Query with useQuery

```typescript
// components/user-list.tsx
import { useQuery, gql } from "urql";

const USERS_QUERY = gql`
  query GetUsers($limit: Int!, $offset: Int) {
    users(limit: $limit, offset: $offset) {
      id
      name
      email
      avatar
    }
  }
`;

const DEFAULT_PAGE_SIZE = 20;
const INITIAL_OFFSET = 0;

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface UsersData {
  users: User[];
}

interface UsersVariables {
  limit: number;
  offset?: number;
}

function UserList() {
  const [result, reexecuteQuery] = useQuery<UsersData, UsersVariables>({
    query: USERS_QUERY,
    variables: {
      limit: DEFAULT_PAGE_SIZE,
      offset: INITIAL_OFFSET,
    },
    // Override default request policy
    requestPolicy: "cache-and-network",
  });

  const { data, fetching, error, stale } = result;

  if (fetching && !data) {
    return <Skeleton />;
  }

  if (error) {
    return (
      <Error
        message={error.message}
        onRetry={() => reexecuteQuery({ requestPolicy: "network-only" })}
      />
    );
  }

  if (!data?.users?.length) {
    return <EmptyState message="No users found" />;
  }

  return (
    <div>
      {stale && <span className="stale-indicator">Updating...</span>}
      <ul>
        {data.users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}

export { UserList };
```

**Key Observations:**
- `reexecuteQuery` triggers refetch with optional policy override
- `stale` indicates cached data is being revalidated
- Check `fetching && !data` for initial load vs background refresh

### Conditional/Dependent Queries

```typescript
import { useQuery } from "urql";

function UserProfile({ userId }: { userId: string | null }) {
  const [result] = useQuery({
    query: USER_QUERY,
    variables: { id: userId },
    // Pause query when userId is null
    pause: !userId,
  });

  // ...
}
```

### Query with Context Options

```typescript
const [result] = useQuery({
  query: USERS_QUERY,
  variables: { limit: 10 },
  context: {
    // Custom fetch options
    fetchOptions: {
      headers: {
        "X-Custom-Header": "value",
      },
    },
    // Override URL for this query
    url: "https://other-api.example.com/graphql",
    // Request policy
    requestPolicy: "network-only",
  },
});
```

---

## 5. Mutation Patterns

### Basic Mutation with useMutation

```typescript
// components/create-todo-form.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, gql } from "urql";

const CREATE_TODO = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      id
      title
      completed
      createdAt
    }
  }
`;

interface CreateTodoInput {
  title: string;
  description?: string;
}

interface CreateTodoData {
  createTodo: {
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
  };
}

function CreateTodoForm() {
  const [title, setTitle] = useState("");
  const [result, executeMutation] = useMutation<CreateTodoData>(CREATE_TODO);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const input: CreateTodoInput = { title: title.trim() };
    const response = await executeMutation({ input });

    if (response.error) {
      console.error("Failed to create todo:", response.error);
      return;
    }

    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter todo title"
        disabled={result.fetching}
      />
      <button type="submit" disabled={result.fetching || !title.trim()}>
        {result.fetching ? "Creating..." : "Create Todo"}
      </button>
    </form>
  );
}

export { CreateTodoForm };
```

### Optimistic Updates with Graphcache

```typescript
// Configure optimistic updates in cache exchange
const cacheConfig = {
  optimistic: {
    toggleTodo: (args, cache) => {
      // Return predicted result shape
      return {
        __typename: "Todo",
        id: args.id,
        completed: args.completed,
      };
    },
    // For creating items, generate temporary ID
    createTodo: (args, cache) => ({
      __typename: "Todo",
      id: `temp-${Date.now()}`,
      title: args.input.title,
      completed: false,
      createdAt: new Date().toISOString(),
    }),
  },
  updates: {
    Mutation: {
      createTodo: (result, args, cache) => {
        // Update queries that list todos
        cache.updateQuery({ query: TODOS_QUERY }, (data) => {
          if (!data || !result.createTodo) return data;
          return {
            ...data,
            todos: [...data.todos, result.createTodo],
          };
        });
      },
    },
  },
};
```

**Important Notes on Optimistic Updates:**
- Optimistic data is stored in a separate "layer" and never pollutes real cache data
- Must provide all fields that queries use to avoid cache misses
- Multiple concurrent optimistic updates stack and are reverted together
- Real API results always replace optimistic data

---

## 6. Subscription Patterns

### Setting Up Subscriptions

```typescript
// lib/urql-client.ts
import { Client, fetchExchange, subscriptionExchange } from "urql";
import { createClient as createWSClient } from "graphql-ws";

const wsClient = createWSClient({
  url: "wss://api.example.com/graphql",
  connectionParams: () => ({
    authToken: localStorage.getItem("token"),
  }),
  // Reconnection options
  retryAttempts: 5,
  shouldRetry: () => true,
});

const client = new Client({
  url: "https://api.example.com/graphql",
  exchanges: [
    cacheExchange,
    fetchExchange,
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
  ],
});
```

### Using useSubscription

```typescript
// components/live-notifications.tsx
import { useSubscription, gql } from "urql";

const NOTIFICATION_SUBSCRIPTION = gql`
  subscription OnNotification($userId: ID!) {
    notificationReceived(userId: $userId) {
      id
      type
      message
      createdAt
    }
  }
`;

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

interface NotificationData {
  notificationReceived: Notification;
}

function LiveNotifications({ userId }: { userId: string }) {
  const [result] = useSubscription<NotificationData>({
    query: NOTIFICATION_SUBSCRIPTION,
    variables: { userId },
    pause: !userId,
  });

  const { data, error } = result;

  if (error) {
    return <div>Subscription error: {error.message}</div>;
  }

  if (data?.notificationReceived) {
    return (
      <div className="notification">
        <strong>{data.notificationReceived.type}:</strong>
        <p>{data.notificationReceived.message}</p>
      </div>
    );
  }

  return <div>Listening for notifications...</div>;
}

export { LiveNotifications };
```

### Subscription with Data Accumulation

```typescript
import { useSubscription } from "urql";
import { useMemo, useReducer } from "react";

interface Message {
  id: string;
  content: string;
  author: string;
}

function LiveChat({ roomId }: { roomId: string }) {
  const [messages, addMessage] = useReducer(
    (state: Message[], newMessage: Message) => [...state, newMessage],
    []
  );

  const handleSubscription = useMemo(
    () => (_prev: Message[] | undefined, response: { newMessage: Message }) => {
      if (response.newMessage) {
        addMessage(response.newMessage);
      }
      return messages;
    },
    [messages]
  );

  useSubscription(
    {
      query: NEW_MESSAGE_SUBSCRIPTION,
      variables: { roomId },
    },
    handleSubscription
  );

  return (
    <ul>
      {messages.map((msg) => (
        <li key={msg.id}>
          <strong>{msg.author}:</strong> {msg.content}
        </li>
      ))}
    </ul>
  );
}
```

---

## 7. Server-Side Rendering (SSR)

### Next.js App Router (v13+)

```typescript
// lib/urql.ts
import { Client, cacheExchange, fetchExchange, ssrExchange } from "urql";
import { registerUrql } from "@urql/next/rsc";

const makeClient = () => {
  return new Client({
    url: process.env.NEXT_PUBLIC_GRAPHQL_URL || "",
    exchanges: [cacheExchange, fetchExchange],
  });
};

const { getClient } = registerUrql(makeClient);

export { getClient };
```

```typescript
// app/users/page.tsx (Server Component)
import { getClient } from "@/lib/urql";
import { gql } from "urql";

const USERS_QUERY = gql`
  query GetUsers {
    users {
      id
      name
      email
    }
  }
`;

async function UsersPage() {
  const result = await getClient().query(USERS_QUERY, {});

  if (result.error) {
    return <div>Error: {result.error.message}</div>;
  }

  return (
    <ul>
      {result.data?.users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

export default UsersPage;
```

### Next.js Client Components with SSR Hydration

```typescript
// app/providers.tsx
"use client";

import { useMemo } from "react";
import { UrqlProvider, ssrExchange, cacheExchange, fetchExchange, createClient } from "@urql/next";
import type { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

function Providers({ children }: ProvidersProps) {
  const [client, ssr] = useMemo(() => {
    const ssr = ssrExchange({
      isClient: typeof window !== "undefined",
    });
    const client = createClient({
      url: process.env.NEXT_PUBLIC_GRAPHQL_URL || "",
      exchanges: [cacheExchange, ssr, fetchExchange],
      suspense: true,
    });
    return [client, ssr];
  }, []);

  return (
    <UrqlProvider client={client} ssr={ssr}>
      {children}
    </UrqlProvider>
  );
}

export { Providers };
```

### Legacy Next.js Pages Router

```typescript
// pages/_app.tsx
import { withUrqlClient } from "next-urql";
import { cacheExchange, fetchExchange } from "urql";
import type { AppProps } from "next/app";

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default withUrqlClient(
  (ssrExchange) => ({
    url: process.env.NEXT_PUBLIC_GRAPHQL_URL || "",
    exchanges: [cacheExchange, ssrExchange, fetchExchange],
  }),
  { ssr: true }
)(MyApp);
```

---

## 8. Authentication Patterns

### Auth Exchange Configuration

```typescript
import { authExchange } from "@urql/exchange-auth";

const auth = authExchange(async (utils) => {
  // Initialize from storage
  let token = localStorage.getItem("token");
  let refreshToken = localStorage.getItem("refreshToken");

  return {
    // Add auth headers to operations
    addAuthToOperation(operation) {
      if (!token) return operation;
      return utils.appendHeaders(operation, {
        Authorization: `Bearer ${token}`,
      });
    },

    // Detect auth errors in responses
    didAuthError(error, _operation) {
      return error.graphQLErrors.some(
        (e) => e.extensions?.code === "UNAUTHORIZED"
      );
    },

    // Predict auth errors before sending (optional)
    willAuthError(_operation) {
      // Check if token is expired
      if (!token) return true;
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const EXPIRY_BUFFER_MS = 10000;
        return Date.now() >= payload.exp * 1000 - EXPIRY_BUFFER_MS;
      } catch {
        return true;
      }
    },

    // Refresh tokens when auth error occurs
    async refreshAuth() {
      if (!refreshToken) {
        logout();
        return;
      }

      const result = await utils.mutate(REFRESH_TOKEN_MUTATION, {
        refreshToken,
      });

      if (result.data?.refreshToken) {
        token = result.data.refreshToken.token;
        refreshToken = result.data.refreshToken.refreshToken;
        localStorage.setItem("token", token);
        localStorage.setItem("refreshToken", refreshToken);
      } else {
        // Refresh failed - logout
        localStorage.clear();
        logout();
      }
    },
  };
});
```

### Handling Logout with mapExchange

```typescript
const client = new Client({
  url: "/graphql",
  exchanges: [
    // Must be BEFORE authExchange to catch unrecoverable errors
    mapExchange({
      onError(error, _operation) {
        const isAuthError = error.graphQLErrors.some(
          (e) => e.extensions?.code === "FORBIDDEN"
        );
        if (isAuthError) {
          // Auth refresh already failed - force logout
          localStorage.clear();
          window.location.href = "/login";
        }
      },
    }),
    cacheExchange,
    authExchange(/* ... */),
    fetchExchange,
  ],
});
```

---

## 9. Error Handling

### CombinedError Structure

URQL uses `CombinedError` to unify network and GraphQL errors:

```typescript
interface CombinedError extends Error {
  // Network-level error (fetch failed, timeout, etc.)
  networkError?: Error;
  // GraphQL errors from API response
  graphQLErrors: GraphQLError[];
  // Original response (if available)
  response?: Response;
}
```

**Important:** Errors and data can coexist. GraphQL allows partial failures where some fields succeed while others error.

### Error Handling in Components

```typescript
function UserProfile({ userId }: { userId: string }) {
  const [result] = useQuery({
    query: USER_QUERY,
    variables: { id: userId },
  });

  const { data, error, fetching } = result;

  // Handle network errors
  if (error?.networkError) {
    return (
      <ErrorBanner
        type="network"
        message="Unable to connect. Please check your internet connection."
        onRetry={() => {/* reexecute */}}
      />
    );
  }

  // Handle GraphQL errors
  if (error?.graphQLErrors.length) {
    const notFound = error.graphQLErrors.some(
      (e) => e.extensions?.code === "NOT_FOUND"
    );
    if (notFound) {
      return <NotFoundPage />;
    }
    return <ErrorBanner message={error.message} />;
  }

  // Partial data with errors
  if (data && error) {
    return (
      <>
        <WarningBanner message="Some data could not be loaded" />
        <UserProfileContent user={data.user} />
      </>
    );
  }

  // ...
}
```

### Global Error Handling with mapExchange

```typescript
const errorExchange = mapExchange({
  onError(error, operation) {
    // Log all errors
    console.error(`[GraphQL Error] ${operation.kind}:`, error);

    // Track in error monitoring service
    Sentry.captureException(error, {
      extra: {
        operationName: operation.context.meta?.operationName,
        variables: operation.variables,
      },
    });
  },
});
```

---

## 10. Pagination Patterns

### Relay-Style Cursor Pagination

```typescript
// Configure Graphcache with relayPagination
import { cacheExchange } from "@urql/exchange-graphcache";
import { relayPagination } from "@urql/exchange-graphcache/extras";

const cache = cacheExchange({
  resolvers: {
    Query: {
      usersConnection: relayPagination(),
    },
  },
});
```

```typescript
// components/paginated-users.tsx
import { useQuery, gql } from "urql";

const USERS_CONNECTION = gql`
  query GetUsersConnection($first: Int!, $after: String) {
    usersConnection(first: $first, after: $after) {
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
    }
  }
`;

const PAGE_SIZE = 20;

function PaginatedUserList() {
  const [result, reexecuteQuery] = useQuery({
    query: USERS_CONNECTION,
    variables: { first: PAGE_SIZE },
  });

  const { data, fetching, error } = result;

  const loadMore = () => {
    if (!data?.usersConnection?.pageInfo?.hasNextPage) return;

    reexecuteQuery({
      variables: {
        first: PAGE_SIZE,
        after: data.usersConnection.pageInfo.endCursor,
      },
    });
  };

  const users = data?.usersConnection?.edges?.map((edge) => edge.node) || [];
  const hasNextPage = data?.usersConnection?.pageInfo?.hasNextPage || false;

  return (
    <div>
      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
      {hasNextPage && (
        <button onClick={loadMore} disabled={fetching}>
          {fetching ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}

export { PaginatedUserList };
```

### Offset Pagination with simplePagination

```typescript
import { simplePagination } from "@urql/exchange-graphcache/extras";

const cache = cacheExchange({
  resolvers: {
    Query: {
      users: simplePagination({
        limitArgument: "limit",
        offsetArgument: "offset",
      }),
    },
  },
});
```

---

## 11. Testing Patterns

### Mock Client Setup

```typescript
// test/utils/urql-mock.ts
import { Provider } from "urql";
import { never, fromValue, makeSubject } from "wonka";
import type { Client } from "urql";

interface MockClientOptions {
  executeQuery?: jest.Mock;
  executeMutation?: jest.Mock;
  executeSubscription?: jest.Mock;
}

function createMockClient(options: MockClientOptions = {}): Client {
  return {
    executeQuery: options.executeQuery || jest.fn(() => never),
    executeMutation: options.executeMutation || jest.fn(() => never),
    executeSubscription: options.executeSubscription || jest.fn(() => never),
  } as unknown as Client;
}

function createMockProvider(client: Client) {
  return function MockProvider({ children }: { children: React.ReactNode }) {
    return <Provider value={client}>{children}</Provider>;
  };
}

export { createMockClient, createMockProvider };
```

### Testing Queries

```typescript
// components/user-list.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { fromValue } from "wonka";
import { createMockClient, createMockProvider } from "@/test/utils/urql-mock";
import { UserList } from "./user-list";

describe("UserList", () => {
  it("renders loading state", () => {
    const mockClient = createMockClient();
    const MockProvider = createMockProvider(mockClient);

    render(
      <MockProvider>
        <UserList />
      </MockProvider>
    );

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("renders users when data loads", async () => {
    const mockClient = createMockClient({
      executeQuery: jest.fn(() =>
        fromValue({
          data: {
            users: [
              { id: "1", name: "John Doe", email: "john@example.com" },
              { id: "2", name: "Jane Doe", email: "jane@example.com" },
            ],
          },
        })
      ),
    });
    const MockProvider = createMockProvider(mockClient);

    render(
      <MockProvider>
        <UserList />
      </MockProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    const mockClient = createMockClient({
      executeQuery: jest.fn(() =>
        fromValue({
          error: { message: "Network error" },
        })
      ),
    });
    const MockProvider = createMockProvider(mockClient);

    render(
      <MockProvider>
        <UserList />
      </MockProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Mutations

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { fromValue, empty } from "wonka";
import { createMockClient, createMockProvider } from "@/test/utils/urql-mock";
import { CreateTodoForm } from "./create-todo-form";

describe("CreateTodoForm", () => {
  it("calls mutation with correct variables", async () => {
    const executeMutation = jest.fn(() =>
      fromValue({
        data: {
          createTodo: { id: "1", title: "Test Todo", completed: false },
        },
      })
    );

    const mockClient = createMockClient({ executeMutation });
    const MockProvider = createMockProvider(mockClient);

    render(
      <MockProvider>
        <CreateTodoForm />
      </MockProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/enter todo/i), {
      target: { value: "Test Todo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(executeMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { input: { title: "Test Todo" } },
        }),
        expect.anything()
      );
    });
  });
});
```

### Testing with MSW (Mock Service Worker)

```typescript
// mocks/handlers.ts
import { graphql } from "msw";

const handlers = [
  graphql.query("GetUsers", (req, res, ctx) => {
    return res(
      ctx.data({
        users: [
          { id: "1", name: "John Doe", email: "john@example.com" },
        ],
      })
    );
  }),
  graphql.mutation("CreateTodo", (req, res, ctx) => {
    const { input } = req.variables;
    return res(
      ctx.data({
        createTodo: {
          id: "new-id",
          title: input.title,
          completed: false,
        },
      })
    );
  }),
];

export { handlers };
```

```typescript
// test/setup.ts
import "@testing-library/jest-dom";
import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## 12. Anti-Patterns to Avoid

### 1. Forgetting Exchange Order

```typescript
// BAD: async exchange before sync exchange
const client = new Client({
  exchanges: [fetchExchange, cacheExchange], // Wrong order!
});

// GOOD: sync exchanges first, then async
const client = new Client({
  exchanges: [cacheExchange, fetchExchange],
});
```

### 2. Missing Provider

```typescript
// BAD: v4+ throws error without Provider
function App() {
  // Error: No urql Client found!
  return <UserList />;
}

// GOOD: Always wrap with Provider
function App() {
  return (
    <Provider value={client}>
      <UserList />
    </Provider>
  );
}
```

### 3. Insufficient Optimistic Response Fields

```typescript
// BAD: Missing fields causes cache miss
optimistic: {
  updateTodo: (args) => ({
    __typename: "Todo",
    id: args.id,
    // Missing title, completed - queries may not update!
  }),
}

// GOOD: Include all fields your queries use
optimistic: {
  updateTodo: (args, cache) => {
    const existing = cache.readFragment(TODO_FRAGMENT, { id: args.id });
    return {
      __typename: "Todo",
      ...existing,
      ...args.input,
    };
  },
}
```

### 4. Wrong authExchange Placement

```typescript
// BAD: mapExchange after authExchange won't catch refresh failures
exchanges: [
  cacheExchange,
  authExchange(/* ... */),
  mapExchange({ onError: /* ... */ }), // Too late!
  fetchExchange,
]

// GOOD: mapExchange before authExchange catches unrecoverable errors
exchanges: [
  mapExchange({ onError: /* ... */ }),
  cacheExchange,
  authExchange(/* ... */),
  fetchExchange,
]
```

### 5. Polling Without cleanup

```typescript
// BAD: Memory leak - polling continues after unmount
function PollingComponent() {
  const [result] = useQuery({
    query: DATA_QUERY,
    pollInterval: 5000, // Continues forever!
  });
}

// GOOD: Component unmount automatically stops polling in URQL
// But be careful with manual setInterval patterns
```

### 6. Not Handling Partial Errors

```typescript
// BAD: Ignoring partial data when errors exist
if (error) {
  return <ErrorPage />;
}

// GOOD: Show partial data with error indicator
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

---

## 13. Performance Considerations

### Bundle Size Optimization

| Configuration | Approximate Size (gzipped) |
|---------------|---------------------------|
| Core only (document cache) | ~12KB |
| + Graphcache (normalized) | ~20KB |
| + Auth exchange | ~22KB |
| Apollo Client equivalent | ~30KB+ |

### Request Deduplication

URQL automatically deduplicates identical in-flight requests via `dedupExchange` (included in defaults).

### Cache-and-Network Strategy

Use `cache-and-network` for the best UX - shows cached data immediately while fetching fresh data in background:

```typescript
const [result] = useQuery({
  query: USERS_QUERY,
  requestPolicy: "cache-and-network",
});

// Show stale indicator while revalidating
{result.stale && <span>Updating...</span>}
```

### Request Policy Exchange for TTL

```typescript
import { requestPolicyExchange } from "@urql/exchange-request-policy";

const TTL_MS = 60 * 1000; // 1 minute

const client = new Client({
  exchanges: [
    requestPolicyExchange({
      ttl: TTL_MS,
      // Upgrade cache-first to cache-and-network after TTL
    }),
    cacheExchange,
    fetchExchange,
  ],
});
```

---

## 14. Migration from Apollo Client

### Key Differences

| Feature | Apollo Client | URQL |
|---------|--------------|------|
| Default cache | Normalized | Document |
| Architecture | Monolithic | Exchange-based |
| Bundle size | ~30KB | ~12KB |
| Suspense | Experimental | First-class |
| Offline | Apollo Offline | Graphcache offline |

### Hook Mapping

```typescript
// Apollo
const { data, loading, error, refetch } = useQuery(QUERY);

// URQL
const [{ data, fetching, error, stale }, reexecuteQuery] = useQuery({ query: QUERY });
```

### Cache Access

```typescript
// Apollo
client.readQuery({ query: QUERY });
client.writeQuery({ query: QUERY, data: newData });

// URQL (with Graphcache)
// Use cache.updateQuery in updates config
// Or use cache.readFragment/writeFragment
```

---

## Sources

- [URQL Official Documentation](https://nearform.com/open-source/urql/)
- [URQL GitHub Repository](https://github.com/urql-graphql/urql)
- [URQL v4 Migration Guide](https://github.com/urql-graphql/urql/issues/3114)
- [Graphcache Documentation](https://nearform.com/open-source/urql/docs/graphcache/)
- [URQL Architecture Documentation](https://github.com/urql-graphql/urql/blob/main/docs/architecture.md)
- [Authentication Guide](https://nearform.com/open-source/urql/docs/advanced/authentication/)
- [Server-Side Rendering Guide](https://nearform.com/open-source/urql/docs/advanced/server-side-rendering/)
- [Testing Guide](https://nearform.com/open-source/urql/docs/advanced/testing/)
- [Authoring Exchanges Guide](https://nearform.com/open-source/urql/docs/advanced/authoring-exchanges/)
- [Exploring GraphQL Clients: Apollo vs Relay vs URQL (Hasura)](https://hasura.io/blog/exploring-graphql-clients-apollo-client-vs-relay-vs-urql)
- [From Apollo to Urql Migration Experience](https://medium.com/sesame-engineering/from-apollo-to-urql-part-2-3ea41fa22bc5)
- [How to GraphQL - React URQL Tutorial](https://www.howtographql.com/react-urql/0-introduction/)
