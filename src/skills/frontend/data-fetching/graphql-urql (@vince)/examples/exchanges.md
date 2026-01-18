# URQL GraphQL Client - Exchange Examples

> Exchange architecture, custom exchanges, authentication patterns. See [SKILL.md](../SKILL.md) for concepts.

---

## Exchange Architecture Overview

Exchanges are middleware-style plugins that process operations and results:

```
Request Flow:    Component → Cache → Auth → Retry → Fetch → Server
Response Flow:   Server → Fetch → Retry → Auth → Cache → Component
```

**Default Exchange Stack (v4+):**
1. `cacheExchange` - Document caching (query + variables hash)
2. `fetchExchange` - HTTP requests to GraphQL API

> **Note:** Deduplication is built into the core client since v5. The `dedupExchange` was removed in v5.0.0.

---

## Pattern 1: Advanced Client with Multiple Exchanges

```typescript
// lib/urql-client.ts
import {
  Client,
  cacheExchange,
  fetchExchange,
  mapExchange,
} from "urql";
import { authExchange } from "@urql/exchange-auth";
import { retryExchange } from "@urql/exchange-retry";

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || "";
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const TOKEN_STORAGE_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      refreshToken
    }
  }
`;

const client = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [
    // Error handling (must be before authExchange to catch unrecoverable errors)
    mapExchange({
      onError(error) {
        const isAuthError = error.graphQLErrors.some(
          (e) => e.extensions?.code === "FORBIDDEN"
        );
        if (isAuthError) {
          // Auth refresh already failed - force logout
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          window.location.href = "/login";
        }
      },
    }),
    // Document cache (synchronous - must come before async exchanges)
    cacheExchange,
    // Authentication
    authExchange(async (utils) => {
      let token = localStorage.getItem(TOKEN_STORAGE_KEY);
      let refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

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
          if (!refreshToken) {
            localStorage.clear();
            window.location.href = "/login";
            return;
          }

          const result = await utils.mutate(REFRESH_TOKEN_MUTATION, {
            refreshToken,
          });

          if (result.data?.refreshToken) {
            token = result.data.refreshToken.token;
            refreshToken = result.data.refreshToken.refreshToken;
            localStorage.setItem(TOKEN_STORAGE_KEY, token);
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          } else {
            localStorage.clear();
            window.location.href = "/login";
          }
        },
      };
    }),
    // Retry failed requests (network errors only)
    retryExchange({
      maxNumberAttempts: MAX_RETRY_ATTEMPTS,
      initialDelayMs: INITIAL_RETRY_DELAY_MS,
      retryIf: (error) => !!(error.networkError),
    }),
    // HTTP requests (must be last)
    fetchExchange,
  ],
});

export { client };
```

**Why good:** Exchange order is correct (mapExchange → cacheExchange → authExchange → retryExchange → fetchExchange), named constants for configuration, retry only on network errors not GraphQL errors

---

## Pattern 2: Normalized Caching with Graphcache

Document caching (default) treats each query+variables as a unique cached document. Graphcache provides normalized caching where entities are stored once and referenced everywhere.

```typescript
// lib/urql-client-graphcache.ts
import { Client, fetchExchange } from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";

const TODOS_QUERY = `
  query GetTodos {
    todos {
      id
      title
      completed
      dueDate
    }
  }
`;

const client = new Client({
  url: "/graphql",
  exchanges: [
    cacheExchange({
      // Custom key generation for entities
      keys: {
        // Use SKU instead of id for Product type
        Product: (data) => data.sku as string,
        // Non-keyable type (embedded in parent, not normalized)
        GeoLocation: () => null,
      },

      // Local resolvers - override how fields are read from cache
      resolvers: {
        Query: {
          // Resolve single todo from cache using ID
          todo: (_, args) => ({ __typename: "Todo", id: args.id }),
        },
        Todo: {
          // Computed field - derived from cached data
          isOverdue: (parent) => {
            const dueDate = new Date(parent.dueDate as string);
            return dueDate < new Date();
          },
        },
      },

      // Cache updates after mutations
      updates: {
        Mutation: {
          // Add new todo to the list
          createTodo: (result, _args, cache) => {
            cache.updateQuery({ query: TODOS_QUERY }, (data) => {
              if (!data || !result.createTodo) return data;
              return {
                ...data,
                todos: [...data.todos, result.createTodo],
              };
            });
          },
          // Remove deleted todo from cache
          deleteTodo: (_result, args, cache) => {
            cache.invalidate({ __typename: "Todo", id: args.id as string });
          },
        },
      },

      // Optimistic updates - instant UI feedback
      optimistic: {
        toggleTodo: (args, _cache) => ({
          __typename: "Todo",
          id: args.id,
          completed: args.completed,
        }),
        // For creates, generate temporary ID
        createTodo: (args, _cache) => ({
          __typename: "Todo",
          id: `temp-${Date.now()}`,
          title: args.input.title,
          completed: false,
          dueDate: null,
        }),
      },
    }),
    fetchExchange,
  ],
});

export { client };
```

**Why good:** Normalized cache prevents data duplication, optimistic updates include `__typename` for proper normalization, computed fields derived from cached data, cache invalidation for deletions

---

## Pattern 3: Custom Logging Exchange

Create custom exchanges to inspect or modify operations and results.

```typescript
// lib/exchanges/logging-exchange.ts
import type { Exchange, Operation, OperationResult } from "urql";
import { pipe, tap } from "wonka";

const loggingExchange: Exchange = ({ forward }) => {
  return (operations$) => {
    // Inspect operations going forward
    const processedOps$ = pipe(
      operations$,
      tap((operation: Operation) => {
        console.log("[GraphQL Request]", {
          kind: operation.kind,
          key: operation.key,
          query: operation.query.definitions[0]?.name?.value || "anonymous",
          variables: operation.variables,
        });
      })
    );

    // Forward to next exchange and get results
    const results$ = forward(processedOps$);

    // Inspect results coming back
    return pipe(
      results$,
      tap((result: OperationResult) => {
        console.log("[GraphQL Response]", {
          key: result.operation.key,
          data: result.data,
          error: result.error?.message,
        });
      })
    );
  };
};

export { loggingExchange };
```

### Using the Custom Exchange

```typescript
// lib/urql-client.ts
import { Client, cacheExchange, fetchExchange } from "urql";
import { loggingExchange } from "./exchanges/logging-exchange";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

const client = new Client({
  url: "/graphql",
  exchanges: [
    // Only add logging in development
    ...(IS_DEVELOPMENT ? [loggingExchange] : []),
    cacheExchange,
    fetchExchange,
  ],
});

export { client };
```

**Why good:** Custom exchanges follow the exchange interface, conditional inclusion based on environment, type-safe with proper imports

---

## Pattern 4: Authentication Exchange with Token Refresh

```typescript
// lib/exchanges/auth-exchange.ts
import { authExchange } from "@urql/exchange-auth";

const TOKEN_STORAGE_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const TOKEN_EXPIRY_BUFFER_MS = 10000; // Refresh 10s before expiry

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      token
      refreshToken
    }
  }
`;

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000 - TOKEN_EXPIRY_BUFFER_MS;
  } catch {
    return true;
  }
}

function logout() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.location.href = "/login";
}

const auth = authExchange(async (utils) => {
  let token = localStorage.getItem(TOKEN_STORAGE_KEY);
  let refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

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

    // Predict auth errors before sending (optional optimization)
    willAuthError(_operation) {
      if (!token) return true;
      return isTokenExpired(token);
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
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      } else {
        logout();
      }
    },
  };
});

export { auth as authExchangeConfig };
```

**Why good:** Token expiry check prevents unnecessary refresh attempts, logout helper centralizes cleanup, named constants for storage keys

---

## Pattern 5: Retry Exchange Configuration

```typescript
// lib/urql-client.ts
import { Client, cacheExchange, fetchExchange } from "urql";
import { retryExchange } from "@urql/exchange-retry";

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15000;
const RANDOM_DELAY_ENABLED = true;

const client = new Client({
  url: "/graphql",
  exchanges: [
    cacheExchange,
    retryExchange({
      // Maximum number of retry attempts
      maxNumberAttempts: MAX_RETRY_ATTEMPTS,
      // Initial delay between retries
      initialDelayMs: INITIAL_RETRY_DELAY_MS,
      // Maximum delay (with exponential backoff)
      maxDelayMs: MAX_RETRY_DELAY_MS,
      // Add randomness to prevent thundering herd
      randomDelay: RANDOM_DELAY_ENABLED,
      // Only retry network errors, not GraphQL errors
      retryIf: (error) => {
        // Network errors should be retried
        if (error.networkError) return true;
        // Don't retry GraphQL errors (they won't succeed on retry)
        return false;
      },
    }),
    fetchExchange,
  ],
});

export { client };
```

**Why good:** Only retries network errors (not GraphQL errors which won't succeed), exponential backoff with jitter prevents thundering herd, all timing values as named constants

---

## Pattern 6: Request Policy Exchange (TTL-Based Cache Upgrades)

```typescript
// lib/urql-client.ts
import { Client, cacheExchange, fetchExchange } from "urql";
import { requestPolicyExchange } from "@urql/exchange-request-policy";

const CACHE_TTL_MS = 60 * 1000; // 1 minute

const client = new Client({
  url: "/graphql",
  exchanges: [
    // Upgrade cache-first to cache-and-network after TTL
    requestPolicyExchange({
      ttl: CACHE_TTL_MS,
      // Only upgrade queries (not mutations)
      shouldUpgrade: (operation) => operation.kind === "query",
    }),
    cacheExchange,
    fetchExchange,
  ],
});

export { client };
```

**Why good:** Automatic stale-while-revalidate behavior, TTL as named constant, only upgrades queries

---

## Exchange Quick Reference

| Exchange | Package | Purpose |
|----------|---------|---------|
| `cacheExchange` | `urql` | Document caching (default) |
| `fetchExchange` | `urql` | HTTP requests (default) |
| `@urql/exchange-graphcache` | Separate | Normalized caching |
| `@urql/exchange-auth` | Separate | Authentication flow |
| `@urql/exchange-retry` | Separate | Retry failed requests |
| `@urql/exchange-persisted` | Separate | Persisted queries/APQ |
| `@urql/exchange-request-policy` | Separate | TTL-based policy upgrades |
| `mapExchange` | `urql` | Inspect/modify operations and results |
| `ssrExchange` | `urql` | Server-side rendering support |
| `subscriptionExchange` | `urql` | WebSocket subscriptions |

---

## Exchange Order Rules

**CRITICAL: Exchange order matters!**

```typescript
// CORRECT ORDER
exchanges: [
  mapExchange,           // 1. Error handling (catches all errors)
  cacheExchange,         // 2. Sync cache (fast path)
  authExchange,          // 3. Auth headers
  retryExchange,         // 4. Retry logic
  fetchExchange,         // 5. Network requests (always last)
]

// WRONG ORDER - cacheExchange after async exchange
exchanges: [
  fetchExchange,         // Network first = cache never used!
  cacheExchange,
]

// WRONG ORDER - mapExchange after authExchange
exchanges: [
  cacheExchange,
  authExchange,
  mapExchange,           // Won't catch auth refresh failures!
  fetchExchange,
]
```

**Rule:** Synchronous exchanges (cacheExchange) before asynchronous exchanges (fetchExchange). Error handlers (mapExchange) before the exchanges whose errors they need to catch.
