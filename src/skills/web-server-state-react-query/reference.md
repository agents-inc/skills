# React Query + hey-api - Reference

> Decision frameworks and anti-patterns. See [SKILL.md](SKILL.md) for core concepts.

---

<decision_framework>

## Decision Framework

### When to Use Generated vs Custom

```
Need API integration?
├─ Is OpenAPI spec available?
│   ├─ YES → Use hey-api code generation
│   │   └─ Use generated query options (getFeaturesOptions)
│   └─ NO → Do you control the backend?
│       ├─ YES → Write OpenAPI spec, then use hey-api
│       └─ NO → Manual fetch with Zod validation at parse boundary
└─ Is it GraphQL?
    └─ Use a GraphQL client (not this skill)
```

### Configuration Strategy

```
Need to configure client?
├─ Global config (base URL, default headers)?
│   └─ Use client.setConfig() in provider
├─ Authentication?
│   ├─ Static token → client.setConfig({ auth: () => token })
│   └─ Dynamic token → useEffect + client.setConfig() or interceptors
├─ Per-request override?
│   └─ Pass options directly to SDK functions
└─ Custom timeout?
    └─ Pass custom fetch to client.setConfig({ fetch: ... })
```

### Error Handling Strategy

```
How to handle errors?
├─ Component-level?
│   └─ Use isPending, error states from useQuery
├─ Error side effects (toast, logging)?
│   └─ useEffect watching error (v5 removed onError from useQuery)
├─ Global query errors?
│   └─ QueryCache.onError in QueryClient constructor
├─ Global mutation errors?
│   └─ MutationCache.onError in QueryClient constructor
└─ Crash recovery?
    └─ QueryErrorResetBoundary + ErrorBoundary
```

</decision_framework>

---

<anti_patterns>

## Anti-Patterns

### Manual Type Definitions

Do not write manual TypeScript interfaces for API responses. They drift from the backend schema and cause runtime errors.

```typescript
// BAD - Manual types drift from backend
interface Feature {
  id: string;
  name: string;
  // Missing fields = runtime errors!
}

// GOOD - Use generated types
import type { Feature } from "./api-client/types.gen";
```

### Custom React Query Hooks

Do not write custom useQuery wrappers for API calls. Use generated query options from hey-api.

```typescript
// BAD - Custom hook duplicates generated code
function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: () => fetch("/api/v1/features"),
  });
}

// GOOD - Use generated query options
import { getFeaturesOptions } from "./api-client/@tanstack/react-query.gen";
const { data } = useQuery(getFeaturesOptions());
```

### Hardcoded API URLs

Do not hardcode API URLs. Use environment variables.

```typescript
// BAD - Hardcoded URL
client.setConfig({ baseUrl: "http://localhost:3000" });

// GOOD - Environment variable
client.setConfig({ baseUrl: process.env.API_BASE_URL });
```

### Magic Numbers for Timeouts

Do not use raw numbers for timeouts, retries, or intervals.

```typescript
// BAD - Magic number
staleTime: 300000,

// GOOD - Named constant
const STALE_TIME_MS = 5 * 60 * 1000;
staleTime: STALE_TIME_MS,
```

### Mutating Global Config in Query Functions

Do not call `client.setConfig()` inside query functions -- it mutates global state and causes race conditions.

```typescript
// BAD - Race condition
queryFn: async () => {
  client.setConfig({ baseUrl: "https://other.com" }); // Affects ALL requests!
  return client.get({ url: "/data" });
},

// GOOD - Per-request via SDK function options or separate client instance
```

</anti_patterns>

---

<react_query_v5>

## React Query v5 Breaking Changes

**Removed:**

- `onSuccess`, `onError`, `onSettled` callbacks from `useQuery` (still available on `useMutation`)

**Renamed:**

- `cacheTime` -> `gcTime` (garbage collection time)
- `isLoading` -> `isPending` for queries
- `keepPreviousData` -> `placeholderData: (prev) => prev`

**New Requirements:**

- `useInfiniteQuery` requires `initialPageParam` option
- Server-side retry defaults to 0 (was 3 in v4)
- Requires React 18.0+

**New Features:**

- `useSuspenseQuery`, `useSuspenseInfiniteQuery`, `useSuspenseQueries` hooks
- `useMutationState` hook for accessing mutation state across components
- `queryOptions` helper for type-safe shared query definitions
- `maxPages` option for infinite queries to limit cached pages

</react_query_v5>
