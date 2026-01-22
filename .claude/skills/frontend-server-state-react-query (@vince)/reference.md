# API Integration - Reference

> Decision frameworks, anti-patterns, and integration guides. See [skill.md](skill.md) for core concepts.

---

<decision_framework>

## Decision Framework

### When to Use Generated vs Custom

```
Need API integration?
├─ Is OpenAPI spec available?
│   ├─ YES → Use hey-api code generation ✓
│   │   └─ Use generated query options (getFeaturesOptions)
│   └─ NO → Do you control the backend?
│       ├─ YES → Write OpenAPI spec, then use hey-api
│       └─ NO → Consider tRPC or manual fetch with Zod
└─ Is it GraphQL?
    └─ Use Apollo or urql (not this skill)
```

### Configuration Strategy

```
Need to configure client?
├─ Global config (base URL, default headers)?
│   └─ Use client.setConfig() in QueryProvider ✓
├─ Per-request override?
│   └─ Use query meta options ✓
└─ Dynamic auth headers?
    └─ Use useEffect to update client.setConfig() ✓
```

### Error Handling Strategy

```
How to handle errors?
├─ Component-level?
│   └─ Use isPending, error states from useQuery ✓
├─ Global query errors?
│   └─ Use QueryCache.onError in QueryClient constructor (v5) ✓
├─ Global mutation errors?
│   └─ Use MutationCache.onError in QueryClient constructor (v5) ✓
└─ Browser APIs (localStorage)?
    └─ Wrap in try/catch with context logging ✓
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **React Query (@tanstack/react-query)**: Generated query options integrate directly with useQuery/useMutation hooks for automatic data fetching and caching
- **API mocking solutions**: Mock handlers can use generated types from `@repo/api/types` ensuring mocks match API contract
- **TypeScript**: Generated types provide end-to-end type safety from OpenAPI schema to UI components
- **Next.js**: Environment variables (NEXT_PUBLIC_API_URL) configure client per deployment environment

**Replaces / Conflicts with:**

- **Axios**: hey-api uses fetch-based client, no interceptors available—use React Query middleware instead
- **Custom API hooks**: Generated query options replace manual useQuery wrappers
- **Manual type definitions**: OpenAPI types replace hand-written interfaces
- **Redux for server state**: React Query handles server state; use a client state management solution for client-only state

</integration>

---

<anti_patterns>

## Anti-Patterns

### ❌ Manual Type Definitions

Do not write manual TypeScript interfaces for API responses. They drift from the backend schema and cause runtime errors.

```typescript
// ❌ WRONG - Manual types drift from backend
interface Feature {
  id: string;
  name: string;
  // Missing fields = runtime errors
}

// ✅ CORRECT - Use generated types
import type { Feature } from "@repo/api";
```

### ❌ Custom React Query Hooks

Do not write custom useQuery wrappers for API calls. Use generated query options from hey-api.

```typescript
// ❌ WRONG - Custom hook duplicates generated code
function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: () => fetch("/api/v1/features"),
  });
}

// ✅ CORRECT - Use generated query options
import { getFeaturesOptions } from "@repo/api";
const { data } = useQuery(getFeaturesOptions());
```

### ❌ Hardcoded API URLs

Do not hardcode API URLs. Use environment variables.

```typescript
// ❌ WRONG - Hardcoded URL
client.setConfig({ baseUrl: "http://localhost:3000" });

// ✅ CORRECT - Environment variable
client.setConfig({ baseUrl: process.env.NEXT_PUBLIC_API_URL });
```

### ❌ Magic Numbers for Timeouts

Do not use raw numbers for timeouts, retries, or intervals. Use named constants.

```typescript
// ❌ WRONG - Magic number
staleTime: 300000,

// ✅ CORRECT - Named constant
const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes
staleTime: STALE_TIME_MS,
```

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **Manual API type definitions** - should be generated from OpenAPI schema, causes type drift and runtime errors
- ❌ **Custom React Query hooks for API calls** - should use generated query options like getFeaturesOptions(), creates inconsistent patterns
- ❌ **Magic numbers for timeouts/retries** - use named constants (FIVE_MINUTES_MS, DEFAULT_RETRY_ATTEMPTS), makes policy opaque
- ❌ **Hardcoded API URLs** - should use environment variables (NEXT_PUBLIC_API_URL), breaks multi-environment deploys
- ❌ **Default exports in libraries** - should use named exports, prevents tree-shaking
- ❌ **kebab-case violations** - file names must be kebab-case (features-page.tsx not FeaturesPage.tsx)

**Medium Priority Issues:**

- ⚠️ **Not using `import type` for type-only imports** - increases bundle size unnecessarily
- ⚠️ **Incorrect import order** - should be React → external → @repo/\* → relative → styles
- ⚠️ **Mutating global client config in query functions** - causes race conditions, use per-request meta instead
- ⚠️ **Missing error boundaries** - unhandled errors crash entire app, wrap with QueryErrorResetBoundary
- ⚠️ **No try/catch around localStorage** - crashes in private browsing mode

**Common Mistakes:**

- Forgetting to regenerate client after OpenAPI schema changes (`bun run build` in packages/api)
- Using `retry: true` in development with mocks (should be `false` to fail fast)
- Not cleaning up AbortController timeout (memory leak)
- Using generic error messages ("Error occurred" instead of "Failed to load features")

**Gotchas & Edge Cases:**

- When using API mocks, they must start before React Query provider mounts
- `NEXT_PUBLIC_` prefix required for client-side env variables in Next.js
- `client.setConfig()` merges with existing config, doesn't replace it
- Generated query keys are immutable tuples (safe for React Query key equality)
- Fetch timeout is different from React Query's staleTime/gcTime (renamed from cacheTime in v5)
- Generated types change when OpenAPI schema changes—commit generated files to catch breaking changes in code review

**React Query v5 Breaking Changes:**

- ❌ `onSuccess`, `onError`, `onSettled` callbacks **removed** from `useQuery` (still available in `useMutation`)
- ⚠️ `cacheTime` renamed to `gcTime` (garbage collection time)
- ⚠️ `isLoading` renamed to `isPending` for queries
- ⚠️ `keepPreviousData` replaced with `placeholderData: (prev) => prev`
- ⚠️ `useInfiniteQuery` now requires `initialPageParam` option
- ⚠️ Server-side retry defaults to 0 (was 3 in v4)
- ✅ New `useSuspenseQuery`, `useSuspenseInfiniteQuery`, `useSuspenseQueries` hooks
- ✅ New `useMutationState` hook for accessing mutation state across components
- ✅ New `queryOptions` helper for type-safe shared query definitions
- ✅ New `maxPages` option for infinite queries to limit cached pages
- ✅ New `experimental_createPersister` plugin for fine-grained query persistence
- ✅ Requires React 18.0+

</red_flags>
