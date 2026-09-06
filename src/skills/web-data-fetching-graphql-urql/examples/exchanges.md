# URQL — Exchange Examples

> The pipeline, Graphcache, auth, retry and custom exchanges. See [SKILL.md](../SKILL.md) for the
> decisions and [reference.md](../reference.md) for the exchange catalogue.

---

## How an operation travels

```
Out:  Component → mapExchange → cacheExchange → authExchange → retryExchange → fetchExchange → server
Back: server → fetchExchange → retryExchange → authExchange → cacheExchange → mapExchange → component
```

Each exchange sees the operation on the way out and the result on the way back, and can answer,
rewrite or forward either. An exchange can only act on what has already reached it, which is the
whole reason order matters.

The default stack is `[cacheExchange, fetchExchange]`. Deduplication needs no exchange — it moved
into the core client in v5, when `dedupExchange` was removed.

---

## Pattern 1: A full pipeline

```typescript
// lib/urql-client.ts
import { Client, cacheExchange, fetchExchange, mapExchange } from "urql";
import { authExchange } from "@urql/exchange-auth";
import { retryExchange } from "@urql/exchange-retry";
import { authConfig } from "./exchanges/auth-exchange"; // Pattern 4

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_URL || "";
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const TOKEN_STORAGE_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

const client = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [
    // First, so it sees failures from every exchange after it — including a refresh that failed
    mapExchange({
      onError(error) {
        const refreshAlreadyFailed = error.graphQLErrors.some(
          (e) => e.extensions?.code === "FORBIDDEN",
        );
        if (refreshAlreadyFailed) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          window.location.href = "/login";
        }
      },
    }),
    cacheExchange, // synchronous: answers without ever reaching the exchanges below
    authExchange(authConfig),
    retryExchange({
      maxNumberAttempts: MAX_RETRY_ATTEMPTS,
      initialDelayMs: INITIAL_RETRY_DELAY_MS,
      retryIf: (error) => !!error.networkError,
    }),
    fetchExchange, // last, always
  ],
});

export { client };
```

`retryIf` tests `networkError` alone: a GraphQL error is a considered answer from the server, and
sending the same request again produces the same answer.

---

## Pattern 2: Graphcache

The document cache treats each query plus its variables as one opaque result. Graphcache splits
responses into entities stored once and referenced everywhere, which is what makes precise cache
edits and optimistic updates possible.

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

### Preserving fields in an optimistic response

An optimistic object replaces the entity wholesale, so a field it omits is a field every watching
query loses until the server answers. Read the current entity and spread it:

```typescript
optimistic: {
  updateTodo: (args, cache) => {
    const existing = cache.readFragment(TODO_FRAGMENT, { id: args.id });
    return { __typename: "Todo", ...existing, ...args.input };
  },
}
```

---

## Pattern 3: A custom exchange

An exchange is a function over the operation stream. This one logs both directions and changes
nothing.

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
      }),
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
      }),
    );
  };
};

export { loggingExchange };
```

### Installing it

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

Spreading a conditional array keeps the exchange out of the production bundle's array entirely,
rather than installing a no-op.

---

## Pattern 4: Authentication with token refresh

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

const authConfig = async (utils) => {
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
        (e) => e.extensions?.code === "UNAUTHORIZED",
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
};

export { authConfig };
```

`willAuthError` is the optimization: it inspects the token before the request leaves, so an expired
token is refreshed once rather than costing a failed request first. `didAuthError` is still needed —
a token can be revoked while it still looks valid.

---

## Pattern 5: Retry

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

`randomDelay` spreads the retries out: without it, every client that failed on the same outage
retries at the same instant and the recovering server takes a second wave.

---

## Pattern 6: TTL-based policy upgrades

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

This buys stale-while-revalidate without changing any query: entries older than the TTL are served
from cache and refreshed behind the render, and anything newer is served from cache alone.

The exchanges available and the packages they come from are catalogued in
[reference.md](../reference.md).
