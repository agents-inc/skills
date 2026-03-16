---
name: web-server-state-react-query
description: React Query server state, hey-api OpenAPI codegen, type-safe data fetching
---

# React Query + hey-api Patterns

> **Quick Guide:** Generate type-safe React Query hooks from OpenAPI specs using hey-api. Never write custom query hooks or manual type definitions -- use generated query options (`getFeaturesOptions()` pattern) and generated types. Configure the client once via environment variables. All timeouts/retries use named constants.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use generated query options from hey-api -- NEVER write custom React Query hooks)**

**(You MUST regenerate client code when OpenAPI schema changes)**

**(You MUST use named constants for ALL timeout/retry values -- NO magic numbers)**

**(You MUST configure API client base URL via environment variables)**

</critical_requirements>

---

**Auto-detection:** OpenAPI schema, hey-api, openapi-ts, generated React Query hooks, query options, getFeaturesOptions, useQuery, useMutation, QueryClient, QueryClientProvider, staleTime, gcTime, queryKey

**When to use:**

- Generating type-safe API client from OpenAPI specs with hey-api
- Using generated React Query query options in components
- Configuring QueryClient defaults, error handling, retry policies
- Debouncing queries, handling dependent/conditional fetching

**When NOT to use:**

- No OpenAPI spec available (consider writing one or using tRPC)
- GraphQL API (use a GraphQL client)
- Real-time WebSocket APIs (use a WebSocket solution)
- Simple one-off fetches where React Query overhead isn't justified

---

<philosophy>

## Philosophy

OpenAPI-first development ensures a single source of truth for your API contract. The hey-api code generator (`@hey-api/openapi-ts`) transforms your OpenAPI schema into fully typed client code, React Query hooks, and query options -- eliminating manual type definitions and reducing bugs.

**Core Principles:**

1. **Single source of truth** -- OpenAPI schema drives types, client code, and mocks
2. **Zero manual typing** -- Generated code eliminates type drift
3. **Consistent patterns** -- All API calls use generated query options, never custom hooks
4. **Centralized configuration** -- One place to configure client behavior

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: hey-api Code Generation

Configure `@hey-api/openapi-ts` to generate TypeScript client code and React Query hooks from your OpenAPI spec. Since v0.73.0, client packages are bundled -- no separate installation needed.

```typescript
// openapi-ts.config.ts
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.yaml",
  output: "src/api-client",
  plugins: [
    "@hey-api/typescript",
    "@hey-api/sdk",
    "@hey-api/client-fetch",
    "@tanstack/react-query",
  ],
});
```

**Key points:** `@hey-api/typescript` generates types (renamed from `@hey-api/types`), `@hey-api/sdk` generates service functions (renamed from `@hey-api/services`). Run generation via `npx openapi-ts` or add as a build script.

See [examples/core.md](examples/core.md) Pattern 1 for generated output structure and usage.

---

### Pattern 2: Client Configuration

Configure the API client base URL and QueryClient defaults **once** in a provider component. Use environment variables for the base URL so it works across environments without code changes.

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;

// In your provider component:
const [queryClient] = useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: { staleTime: FIVE_MINUTES_MS, refetchOnWindowFocus: false },
      },
    }),
);

client.setConfig({ baseUrl: process.env.API_BASE_URL ?? "" });
```

**Key points:** hey-api's `client.setConfig()` merges with existing config (doesn't replace). Named constants for all time values. Set `auth` option or use interceptors for auth headers.

See [examples/core.md](examples/core.md) Pattern 2 for full provider setup and auth configuration.

---

### Pattern 3: Using Generated Query Options

Use generated query options directly -- never write custom React Query hooks. Options are fully typed and include generated query keys.

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "./api-client/@tanstack/react-query.gen";

// Direct usage -- fully typed
const { data, isPending, error } = useQuery(getFeaturesOptions());

// With overrides -- spread and customize
const TEN_MINUTES_MS = 10 * 60 * 1000;
const { data } = useQuery({
  ...getFeaturesOptions(),
  staleTime: TEN_MINUTES_MS,
  enabled: someCondition,
});
```

**Why good:** Zero boilerplate, type-safe, consistent patterns, query keys auto-namespaced, easy to customize by spreading

See [examples/core.md](examples/core.md) Pattern 3 for component examples and bad patterns to avoid.

---

### Pattern 4: Error Handling

React Query v5 removed `onError`/`onSuccess`/`onSettled` callbacks from `useQuery`. Use component-level `isPending`/`error` states, `useEffect` for error side effects, or global handlers via `QueryCache`/`MutationCache`.

```typescript
// Global error handling (v5 pattern)
new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        showNotification(`Something went wrong: ${error.message}`);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      showNotification("Operation failed. Please try again.");
    },
  }),
});
```

See [examples/error-handling.md](examples/error-handling.md) for component-level handling, retry with exponential backoff, and error boundaries.

---

### Pattern 5: Debounced Queries

Debounce search/filter queries to prevent excessive API calls on every keystroke.

```typescript
const DEBOUNCE_DELAY_MS = 500;
const MIN_SEARCH_LENGTH = 0;

const debouncedTerm = useDebounce(searchTerm, DEBOUNCE_DELAY_MS);
const { data } = useQuery({
  queryKey: ["search", debouncedTerm],
  queryFn: () => searchAPI(debouncedTerm),
  enabled: debouncedTerm.length > MIN_SEARCH_LENGTH,
});
```

**Why good:** Prevents excessive API calls, query key includes debounced term for proper cache management, `enabled` prevents empty queries

</patterns>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Code generation, client setup, auth, query options usage
- [examples/error-handling.md](examples/error-handling.md) - Error boundaries, retry logic, global handlers
- [reference.md](reference.md) - Decision frameworks, anti-patterns, React Query v5 changes

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Writing custom React Query hooks instead of using generated query options -- creates inconsistent patterns and loses type safety
- Manual TypeScript interfaces for API responses -- drift from OpenAPI schema causes runtime errors
- Magic numbers for timeouts/retries -- use named constants (`FIVE_MINUTES_MS`, `MAX_RETRY_ATTEMPTS`)
- Hardcoded API URLs -- use environment variables for multi-environment deploys
- Using `onError`/`onSuccess` callbacks on `useQuery` -- removed in React Query v5

**Medium Priority Issues:**

- Mutating global client config inside query functions -- causes race conditions in concurrent requests
- Missing error boundaries -- unhandled query errors crash entire component tree
- `retry: true` in development with mocks -- should be `false` to fail fast
- Not cleaning up AbortController timeouts -- memory leak

**Gotchas & Edge Cases:**

- `cacheTime` was renamed to `gcTime` in v5 (garbage collection time)
- `isLoading` was renamed to `isPending` in v5
- `keepPreviousData` replaced with `placeholderData: (prev) => prev`
- `useInfiniteQuery` now requires `initialPageParam` option
- Server-side retry defaults to 0 in v5 (was 3 in v4)
- `client.setConfig()` merges with existing config, doesn't replace it
- Generated query keys are immutable tuples (safe for React Query key equality)
- Fetch timeout is different from React Query's `staleTime`/`gcTime`
- Generated types change when OpenAPI schema changes -- commit generated files to catch breaking changes in review
- React Query v5 requires React 18.0+

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use generated query options from hey-api -- NEVER write custom React Query hooks)**

**(You MUST regenerate client code when OpenAPI schema changes)**

**(You MUST use named constants for ALL timeout/retry values -- NO magic numbers)**

**(You MUST configure API client base URL via environment variables)**

**Failure to follow these rules will cause type drift, inconsistent patterns, and production bugs.**

</critical_reminders>
