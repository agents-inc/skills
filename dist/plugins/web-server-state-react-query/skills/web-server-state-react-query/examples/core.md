# React Query — Core Examples

> Full code for the core patterns. See [SKILL.md](../SKILL.md) for the decisions.

**Extended examples:**

- [error-handling.md](error-handling.md) — component states, global handlers, retry logic, error boundaries

---

## Pattern 1: Generated query options

### Configuration

```typescript
// openapi-ts.config.ts
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.yaml",
  output: "src/api-client",
  plugins: [
    "@hey-api/typescript", // types.gen.ts
    "@hey-api/sdk", // sdk.gen.ts — service functions
    "@tanstack/react-query", // @tanstack/react-query.gen.ts — query options
    // A fetch client is bundled since v0.73; name "@hey-api/client-fetch" only to configure it.
  ],
});
```

### Generated output

```
src/api-client/
├── client.gen.ts                       # fetch client, carries setConfig()
├── sdk.gen.ts                          # service functions (getFeatures, ...)
├── types.gen.ts                        # types from the schema
└── @tanstack/react-query.gen.ts        # query options (getFeaturesOptions, ...)
```

```typescript
// types.gen.ts (generated — do not edit)
export type Feature = {
  id: string;
  name: string;
  description: string;
  status: string;
};
export type GetFeaturesResponse = { features?: Feature[] };

// @tanstack/react-query.gen.ts (generated — do not edit)
export const getFeaturesQueryKey = () => ["getFeatures"] as const;
export const getFeaturesOptions = () => ({
  queryKey: getFeaturesQueryKey(),
  queryFn: () => getFeatures(),
});
```

### Bad example — hand-written types and a hand-written hook

```typescript
// BAD: duplicates the schema, and drifts from it
interface Feature {
  id: string;
  name: string;
  // 'description' and 'status' are missing — every render that needs them gets undefined
}

// BAD: a second cache entry for an endpoint that already has generated options
function useFeatures() {
  return useQuery({
    queryKey: ["features"], // a different key from getFeaturesQueryKey() — invalidation misses it
    queryFn: async () => {
      const res = await fetch("/api/v1/features"); // the URL is now in two places
      return res.json();
    },
  });
}
```

---

## Pattern 2: Client and cache configuration

### Provider setup

```typescript
// lib/query-provider.tsx
"use client"; // needed in frameworks that render Server Components — omit in a client-only SPA

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "./api-client/client.gen";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState, not a module constant: one cache per mount, never swapped on re-render
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: FIVE_MINUTES_MS, refetchOnWindowFocus: false },
        },
      })
  );

  client.setConfig({ baseUrl: process.env.API_BASE_URL ?? "" });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### Auth

```typescript
// Static, or read fresh on every request
client.setConfig({
  baseUrl: process.env.API_BASE_URL ?? "",
  auth: () => getAuthToken(),
});
```

```typescript
// Or via a request interceptor, when the header is not a bearer token
client.interceptors.request.use((request) => {
  const token = getAuthToken();
  if (token) request.headers.set("Authorization", `Bearer ${token}`);
  return request;
});
```

```typescript
// A token that arrives after mount: setConfig merges, so this adds auth without
// clearing the baseUrl set above.
export function AuthenticatedApp({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  useEffect(() => {
    if (token) client.setConfig({ auth: () => token });
  }, [token]);

  return <>{children}</>;
}
```

### Environment-specific defaults

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ZERO_MS = 0;
const DEFAULT_RETRY_ATTEMPTS = 3;
const isDevelopment = process.env.NODE_ENV === "development";

new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: isDevelopment ? ZERO_MS : FIVE_MINUTES_MS,
      refetchOnWindowFocus: !isDevelopment,
      retry: isDevelopment ? false : DEFAULT_RETRY_ATTEMPTS, // fail fast against local doubles
    },
    mutations: { retry: false }, // retrying a non-idempotent write duplicates it
  },
});
```

### Bad example

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // five minutes, but only after arithmetic
      retry: 3, // no record of why three
    },
  },
});

client.setConfig({ baseUrl: "http://localhost:3000/api/v1" }); // ships to production as-is
```

---

## Pattern 3: Consuming and overriding query options

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "./api-client/@tanstack/react-query.gen";

export function FeaturesPage() {
  // data: GetFeaturesResponse | undefined, data.features: Feature[] | undefined
  const { data, isPending, error } = useQuery(getFeaturesOptions());

  if (isPending) return <LoadingSkeleton />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <ul>
      {data?.features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>
      ))}
    </ul>
  );
}
```

### Overriding one call site

```typescript
const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;

const { data } = useQuery({
  ...getFeaturesOptions(),
  staleTime: TEN_MINUTES_MS,
  refetchInterval: THIRTY_SECONDS_MS,
  enabled: someCondition,
});
```

Spreading keeps the generated `queryKey`, so the override shares the cache entry rather than opening
a second one.

---

## Pattern 4: Request timeouts

```typescript
const DEFAULT_TIMEOUT_MS = 10_000;

const fetchWithTimeout =
  (timeoutMs: number = DEFAULT_TIMEOUT_MS) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId); // also on the success path, or the timer holds the closure
    }
  };

client.setConfig({
  baseUrl: process.env.API_BASE_URL ?? "",
  fetch: fetchWithTimeout(DEFAULT_TIMEOUT_MS),
});
```

**When not to use:** file uploads, large downloads and long-polling connections, where a fixed
deadline aborts a request that was working.

---

_Extended examples: [error-handling.md](error-handling.md)_
