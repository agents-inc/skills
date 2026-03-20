# React Query + hey-api - Core Examples

> Core code examples for API client patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Extended examples:**

- [error-handling.md](error-handling.md) - Component-level errors, global handlers, retry logic, error boundaries

---

## Pattern 1: hey-api Code Generation

### Configuration

```typescript
// openapi-ts.config.ts
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.yaml",
  output: "src/api-client",
  plugins: [
    "@hey-api/typescript", // Generates types (types.gen.ts)
    "@hey-api/sdk", // Generates service functions (sdk.gen.ts)
    "@tanstack/react-query", // React Query options (@tanstack/react-query.gen.ts)
    // "@hey-api/client-fetch" -- optional, Fetch is the default client since v0.73
  ],
});
```

### Generated Output Structure

```
src/api-client/
├── client.gen.ts                       # Fetch client with setConfig() (bundled by default)
├── sdk.gen.ts                          # Service functions (getFeatures, etc.)
├── types.gen.ts                        # TypeScript types from OpenAPI schemas
└── @tanstack/react-query.gen.ts        # Query options (getFeaturesOptions, etc.)
```

### Generated Types (Auto-Generated)

```typescript
// src/api-client/types.gen.ts (AUTO-GENERATED - do not edit)
export type Feature = {
  id: string;
  name: string;
  description: string;
  status: string;
};

export type GetFeaturesResponse = {
  features?: Feature[];
};
```

### Generated React Query Options (Auto-Generated)

```typescript
// src/api-client/@tanstack/react-query.gen.ts (AUTO-GENERATED - do not edit)
import type { Options } from "./sdk.gen";

export const getFeaturesOptions = () => ({
  queryKey: getFeaturesQueryKey(),
  queryFn: () => getFeatures(),
});

export const getFeaturesQueryKey = () => ["getFeatures"] as const;
```

### Bad Example - Manual Types and Custom Hooks

```typescript
// BAD: Manual type definition - duplicates OpenAPI schema
interface Feature {
  id: string;
  name: string;
  // Missing 'description' and 'status' - causes runtime errors!
}

// BAD: Custom React Query hook - should use generated getFeaturesOptions
function useFeatures() {
  return useQuery({
    queryKey: ["features"], // Manual key prone to typos
    queryFn: async () => {
      const res = await fetch("/api/v1/features"); // Magic URL string
      return res.json();
    },
  });
}
```

**Why bad:** Manual types drift from OpenAPI schema causing silent runtime errors, custom hooks duplicate generated code and create inconsistent patterns, magic URL strings cause refactoring mistakes

---

## Pattern 2: Client Configuration

### Basic Provider Setup

```typescript
// lib/query-provider.tsx
"use client"; // Required in RSC frameworks (Next.js, etc.) -- omit for SPA

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "./api-client/client.gen";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: FIVE_MINUTES_MS,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  client.setConfig({
    baseUrl: process.env.API_BASE_URL ?? "",
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Authentication via auth Option

```typescript
// hey-api v0.73+ supports auth option directly
client.setConfig({
  baseUrl: process.env.API_BASE_URL ?? "",
  auth: () => getAuthToken(), // Called on every request
});
```

### Authentication via Interceptors

```typescript
import { client } from "./api-client/client.gen";

// Add auth header via request interceptor
client.interceptors.request.use((request) => {
  const token = getAuthToken();
  if (token) {
    request.headers.set("Authorization", `Bearer ${token}`);
  }
  return request;
});
```

### Dynamic Auth with React

```typescript
import { useEffect } from "react";
import type { ReactNode } from "react";
import { client } from "./api-client/client.gen";
import { useAuth } from "./hooks/use-auth";

export function AuthenticatedApp({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      client.setConfig({
        auth: () => token,
      });
    }
  }, [token]);

  return <>{children}</>;
}
```

### Environment-Specific Configuration

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ZERO_MS = 0;
const DEFAULT_RETRY_ATTEMPTS = 3;
const isDevelopment = process.env.NODE_ENV === "development";

const [queryClient] = useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: isDevelopment ? ZERO_MS : FIVE_MINUTES_MS,
          refetchOnWindowFocus: !isDevelopment,
          retry: isDevelopment ? false : DEFAULT_RETRY_ATTEMPTS,
        },
        mutations: {
          retry: false, // Don't retry mutations
        },
      },
    }),
);
```

### Bad Example - Hardcoded Values

```typescript
// BAD: Magic numbers for timeouts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // What is this?
      retry: 3, // Why 3?
    },
  },
});

// BAD: Hardcoded URL
client.setConfig({
  baseUrl: "http://localhost:3000/api/v1", // Breaks in production
});
```

**Why bad:** Magic numbers require code diving to understand meaning, hardcoded URLs break when deploying to different environments

---

## Pattern 3: Using Generated Query Options

### Basic Usage in Components

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "./api-client/@tanstack/react-query.gen";

export function FeaturesPage() {
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

### Customizing Generated Options

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "./api-client/@tanstack/react-query.gen";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;

export function Features() {
  const someCondition = true;

  const { data } = useQuery({
    ...getFeaturesOptions(),
    staleTime: TEN_MINUTES_MS,
    refetchInterval: THIRTY_SECONDS_MS,
    enabled: someCondition,
  });

  return <div>{/* render data */}</div>;
}
```

### Type Safety with Generated Types

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "./api-client/@tanstack/react-query.gen";
import type { Feature } from "./api-client/types.gen";

export function FeaturesPage() {
  const { data } = useQuery(getFeaturesOptions());

  // data is typed as GetFeaturesResponse | undefined
  // data.features is typed as Feature[] | undefined
  const features: Feature[] | undefined = data?.features;

  return (
    <ul>
      {features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>
      ))}
    </ul>
  );
}
```

### Bad Example - Custom Hooks

```typescript
// BAD: Custom React Query hook - should use generated options
function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: async () => {
      const res = await fetch("/api/v1/features");
      return res.json();
    },
    staleTime: 600000, // Magic number
  });
}
```

**Why bad:** Custom hooks create inconsistent patterns, manual query keys cause cache key collisions, magic URLs break on API changes, magic numbers hide caching policy

---

## Pattern 4: Timeout Configuration with Abort Controller

### Custom Fetch with Timeout

```typescript
const DEFAULT_TIMEOUT_MS = 10_000;

const fetchWithTimeout = (timeoutMs: number = DEFAULT_TIMEOUT_MS) => {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId); // Always cleanup to prevent memory leak
    }
  };
};

// Pass to hey-api client
client.setConfig({
  baseUrl: process.env.API_BASE_URL ?? "",
  fetch: fetchWithTimeout(DEFAULT_TIMEOUT_MS),
});
```

### Bad Example - No Cleanup

```typescript
// BAD: No cleanup on success path - memory leak
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000); // Magic number, no clearTimeout
```

**Why bad:** Magic timeout makes policy changes require grep, missing clearTimeout leaks timers

**When not to use:** Don't set aggressive timeouts for file uploads, large downloads, or long-polling connections.

---

_Extended examples: [error-handling.md](error-handling.md)_
