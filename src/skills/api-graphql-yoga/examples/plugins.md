# Envelop Plugin System

> Plugin lifecycle hooks, custom plugins, Yoga-specific plugins. Referenced from [SKILL.md](../SKILL.md).

---

## Pattern 1: Plugin Lifecycle Hooks

Yoga plugins have access to both HTTP-level and GraphQL execution-level hooks. HTTP hooks fire first and can short-circuit before any GraphQL processing.

```typescript
import { createYoga, type Plugin } from "graphql-yoga";

function useRequestTiming(): Plugin {
  return {
    // HTTP-level hooks (fire for ALL requests, including non-GraphQL)
    onRequest({ request }) {
      const start = performance.now();
      // Store timing data on the request for later
      (request as any).__startTime = start;
    },
    onResponse({ request, response }) {
      const start = (request as any).__startTime;
      if (start) {
        const duration = performance.now() - start;
        response.headers.set("X-Response-Time", `${duration.toFixed(2)}ms`);
      }
    },

    // GraphQL execution-level hooks
    onExecute({ args }) {
      const operationName = args.operationName ?? "anonymous";
      console.info(`Executing: ${operationName}`);
    },
  };
}

const yoga = createYoga({
  schema,
  plugins: [useRequestTiming()],
});
```

**Why good:** HTTP hooks can modify response headers, short-circuit with `endResponse`, or perform auth before parsing

---

## Pattern 2: Auth Plugin with HTTP Short-Circuit

Use `onRequest` to reject unauthenticated requests before any GraphQL processing occurs.

```typescript
import { createYoga, type Plugin } from "graphql-yoga";

const UNAUTHORIZED_STATUS = 401;

function useAuth(): Plugin {
  return {
    onRequest({ request, fetchAPI, endResponse }) {
      // Skip auth for GraphiQL and health checks
      const url = new URL(request.url);
      if (request.method === "GET" && url.searchParams.has("query") === false) {
        return;
      }

      const authHeader = request.headers.get("authorization");
      if (!authHeader) {
        endResponse(
          new fetchAPI.Response(JSON.stringify({ error: "Unauthorized" }), {
            status: UNAUTHORIZED_STATUS,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
    },
  };
}
```

**Why good:** `endResponse` short-circuits the entire pipeline -- no parsing, validation, or execution occurs for unauthenticated requests

---

## Pattern 3: All Available Hooks

```typescript
import type { Plugin } from "graphql-yoga";

function useAllHooks(): Plugin {
  return {
    // --- HTTP Layer ---
    onRequest({ request, fetchAPI, endResponse, url }) {
      // Fires for every HTTP request
      // Call endResponse(Response) to short-circuit
    },
    onResponse({ request, response, serverContext }) {
      // Fires after response is built, before sending
      // Modify response headers, log timing, etc.
    },

    // --- GraphQL Request Layer ---
    onRequestParse({ request, url, setRequestParser }) {
      // Before parsing GraphQL params from the HTTP request
    },
    onParams({ params, request, setParams, setResult }) {
      // After params are parsed (query, variables, operationName)
      // Call setResult() to skip execution entirely (e.g. cache hit)
    },

    // --- GraphQL Execution Layer ---
    onParse({ params, parseFn, setParseFn, setParsedDocument }) {
      // Before/after GraphQL document parsing
    },
    onValidate({ params, addValidationRule, setResult }) {
      // Before/after document validation
    },
    onContextBuilding({ context, extendContext }) {
      // Before context is finalized -- extend context here
    },
    onExecute({ args, setExecuteFn, setResultAndStopExecution }) {
      // Before query/mutation execution
      // Return { onExecuteDone } for post-execution hook
    },
    onSubscribe({ args, setSubscribeFn }) {
      // Before subscription initialization
      // Return { onSubscribeResult } for result handling
    },

    // --- Result Processing ---
    onExecutionResult({ result, setResult }) {
      // Called for each execution result
    },
    onResultProcess({
      result,
      request,
      acceptableMediaTypes,
      setResultProcessor,
    }) {
      // Before result is serialized to HTTP response
    },

    // --- Lifecycle ---
    onDispose() {
      // Server shutdown -- cleanup connections, flush logs
    },
  };
}
```

---

## Pattern 4: Using Yoga-Specific Plugins

Always prefer Yoga-specific plugins over Envelop equivalents. Yoga plugins hook into the HTTP layer and can skip the entire GraphQL execution pipeline.

#### Response Caching

```typescript
import { useResponseCache } from "@graphql-yoga/plugin-response-cache";

const CACHE_TTL_MS = 5_000;
const USER_TTL_MS = 1_000;

const yoga = createYoga({
  schema,
  plugins: [
    useResponseCache({
      session: (request) => request.headers.get("authorization"),
      ttl: CACHE_TTL_MS,
      ttlPerType: {
        User: USER_TTL_MS,
      },
    }),
  ],
});
```

#### Persisted Operations

```typescript
import { usePersistedOperations } from "@graphql-yoga/plugin-persisted-operations";

const store: Record<string, string> = {
  "sha256:abc123": "query { me { id name } }",
  "sha256:def456": "mutation { logout }",
};

const yoga = createYoga({
  schema,
  plugins: [
    usePersistedOperations({
      getPersistedOperation(sha256Hash) {
        return store[sha256Hash] ?? null;
      },
    }),
  ],
});
```

#### CSRF Prevention

```typescript
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";

const yoga = createYoga({
  schema,
  plugins: [
    useCSRFPrevention({
      requestHeaders: ["x-graphql-yoga-csrf"],
    }),
  ],
});
```

#### Defer/Stream

```typescript
import { useDeferStream } from "@graphql-yoga/plugin-defer-stream";

const yoga = createYoga({
  schema,
  plugins: [useDeferStream()],
});
```

---

## Pattern 5: Combining Multiple Plugins

Plugins execute in order. Place auth before caching to avoid caching unauthenticated responses.

```typescript
import { createYoga } from "graphql-yoga";
import { useResponseCache } from "@graphql-yoga/plugin-response-cache";
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";

const CACHE_TTL_MS = 10_000;

const yoga = createYoga({
  schema,
  plugins: [
    // 1. CSRF prevention (rejects requests without custom header)
    useCSRFPrevention({
      requestHeaders: ["x-graphql-yoga-csrf"],
    }),
    // 2. Auth (rejects unauthenticated requests)
    useAuth(),
    // 3. Caching (only caches authenticated, CSRF-safe requests)
    useResponseCache({
      session: (request) => request.headers.get("authorization"),
      ttl: CACHE_TTL_MS,
    }),
  ],
});
```

**Why good:** plugin order ensures security checks happen before caching, prevents caching error responses
