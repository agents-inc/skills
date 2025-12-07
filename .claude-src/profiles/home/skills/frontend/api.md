# API Client Architecture

> **Quick Guide:** Using OpenAPI? Need type safety? Integrating with React Query? Use hey-api for automatic client generation with type-safe React Query hooks.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

**(You MUST use generated query options from @hey-api - NEVER write custom React Query hooks)**

**(You MUST regenerate client code (`bun run build` in packages/api) when OpenAPI schema changes)**

**(You MUST use named constants for ALL timeout/retry values - NO magic numbers)**

**(You MUST configure API client base URL via environment variables)**

**(You MUST use named exports only - NO default exports in libraries)**

</critical_requirements>

---

**Auto-detection:** OpenAPI schema, hey-api code generation, generated React Query hooks, API client configuration

**When to use:**

- Setting up hey-api to generate client from OpenAPI specs
- Using generated React Query query options (getFeaturesOptions pattern)
- Troubleshooting API type generation or regeneration

**Key patterns covered:**

- OpenAPI-first development with hey-api (@hey-api/openapi-ts)
- Generated React Query hooks and query options (never custom hooks)
- Type safety from generated types (never manual type definitions)

---

<philosophy>

## Philosophy

OpenAPI-first development ensures a single source of truth for your API contract. The hey-api code generator (@hey-api/openapi-ts) transforms your OpenAPI schema into fully typed client code, React Query hooks, and query options—eliminating manual type definitions and reducing bugs.

**When to use this approach:**

- Backend provides OpenAPI/Swagger specification
- Need type-safe API client with automatic React Query integration
- Want centralized API mocking for development and testing
- Require consistent patterns across all API calls

**When NOT to use:**

- No OpenAPI spec available (consider writing one or using tRPC)
- GraphQL API (use Apollo or urql instead)
- Real-time WebSocket APIs (use socket.io or similar)
- Simple REST APIs where manual fetch calls suffice

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: OpenAPI Schema Definition and Code Generation

Define your API contract in OpenAPI format, then use hey-api to generate TypeScript client code, types, and React Query hooks.

#### Constants

```typescript
// packages/api/openapi-ts.config.ts
const OUTPUT_PATH = "./src/apiClient";
```

#### OpenAPI Schema

```yaml
# packages/api/openapi.yaml
openapi: 3.1.0
info:
  title: Side project features API
  description: API for managing side project features
  version: 0.0.1

servers:
  - url: /api/v1
    description: API routes

components:
  schemas:
    Feature:
      type: object
      properties:
        id:
          type: string
          description: Auto-generated ID for the feature
        name:
          type: string
          description: Name of the feature
        description:
          type: string
          description: Description of the feature
        status:
          type: string
          description: Status 'not started' | 'in progress' | 'done'
      required: [id, name, description, status]

paths:
  /features:
    get:
      summary: Get features
      responses:
        "200":
          description: Features
          content:
            application/json:
              schema:
                type: object
                properties:
                  features:
                    type: array
                    items:
                      $ref: "#/components/schemas/Feature"
```

#### Configuration

```typescript
// packages/api/openapi-ts.config.ts
import { defaultPlugins, defineConfig } from "@hey-api/openapi-ts";

const OUTPUT_PATH = "./src/apiClient";

export default defineConfig({
  input: "./openapi.yaml",
  output: {
    format: "prettier",
    lint: "eslint",
    path: OUTPUT_PATH,
  },
  // Generate both fetch client AND React Query hooks
  plugins: [...defaultPlugins, "@hey-api/client-fetch", "@tanstack/react-query"],
});
```

#### Package Configuration

```json
// packages/api/package.json
{
  "name": "@repo/api",
  "scripts": {
    "build": "openapi-ts"
  },
  "exports": {
    "./types": "./src/apiClient/types.gen.ts",
    "./client": "./src/apiClient/services.gen.ts",
    "./reactQueries": "./src/apiClient/@tanstack/react-query.gen.ts"
  },
  "devDependencies": {
    "@hey-api/openapi-ts": "^0.59.2",
    "@hey-api/client-fetch": "^0.3.3",
    "@tanstack/react-query": "^5.62.11"
  }
}
```

#### Generated Types (Auto-Generated)

```typescript
// packages/api/src/apiClient/types.gen.ts
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

#### Generated React Query Options (Auto-Generated)

```typescript
// packages/api/src/apiClient/@tanstack/react-query.gen.ts
import type { QueryObserverOptions } from "@tanstack/react-query";
import { getFeaturesQueryKey, getFeatures } from "./services.gen";
import type { GetFeaturesResponse } from "./types.gen";

// Auto-generated query options
export const getFeaturesOptions = (): QueryObserverOptions<GetFeaturesResponse> => ({
  queryKey: getFeaturesQueryKey(),
  queryFn: () => getFeatures(),
});
```

#### Usage in Apps

```typescript
// apps/client-next/app/features.tsx
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

export function FeaturesPage() {
  // Use generated query options - fully typed!
  const { data, isPending, error } = useQuery(getFeaturesOptions());

  if (isPending) return <Skeleton />;
  if (error) return <Error message={error.message} />;

  return (
    <ul>
      {data?.features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>
      ))}
    </ul>
  );
}

// Named export (project convention)
export { FeaturesPage };
```

**Why good:** Single source of truth in OpenAPI eliminates type drift, automatic code generation removes manual typing errors, generated React Query hooks enforce consistent patterns, named exports enable tree-shaking

**Why bad (Anti-pattern):**

```typescript
// ❌ Manual type definition - duplicates OpenAPI schema
interface Feature {
  id: string;
  name: string;
}

// ❌ Custom React Query hook - should use generated getFeaturesOptions
function useFeatures() {
  return useQuery({
    queryKey: ["features"], // Manual key prone to typos
    queryFn: async () => {
      const res = await fetch("/api/v1/features"); // Magic string
      return res.json();
    },
  });
}

// ❌ Default export
export default FeaturesPage;
```

**Why bad:** Manual types drift from OpenAPI schema causing runtime errors, custom hooks create inconsistent patterns across the codebase, magic strings cause refactoring mistakes, default exports prevent tree-shaking

**When to use:** Always when backend provides OpenAPI specification.

---

### Pattern 2: Client Configuration with Environment Variables

Configure the API client base URL and global settings before React Query initialization using environment variables and named constants.

#### Constants

```typescript
// apps/client-next/lib/query-provider.tsx
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
```

#### Environment Variables

```bash
# apps/client-next/.env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# apps/client-next/.env.production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

#### Basic Setup

```typescript
// apps/client-next/lib/query-provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "@repo/api/client";

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

  // Configure API client ONCE on initialization
  client.setConfig({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "",
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Named export (project convention)
export { QueryProvider };
```

#### Usage in Layout

```typescript
// apps/client-next/app/layout.tsx
import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query-provider";

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

// Named export
export { RootLayout };
```

**Why good:** Environment variables enable different URLs per environment without code changes, named constants make timeouts self-documenting, single configuration point prevents scattered setConfig calls, client configures before any queries run

**Why bad (Anti-pattern):**

```typescript
// ❌ Magic numbers for timeouts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // What's this?
      refetchOnWindowFocus: false,
    },
  },
});

// ❌ Hardcoded URL
client.setConfig({
  baseUrl: "http://localhost:3000/api/v1", // Breaks in production
});
```

**Why bad:** Magic numbers require code diving to understand meaning, hardcoded URLs break when deploying to different environments, causes bugs when promoting code through environments

---

### Pattern 3: Advanced Configuration (Headers, Auth, Environment-Specific Settings)

Configure global headers, authentication, and environment-specific behavior using named constants and conditional logic.

#### Constants

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
```

#### Headers and Authentication

```typescript
// apps/client-next/lib/query-provider.tsx
"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "@repo/api/client";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const CLIENT_VERSION = "1.0.0";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: FIVE_MINUTES_MS,
            refetchOnWindowFocus: false,
            retry: DEFAULT_RETRY_ATTEMPTS,
          },
          mutations: {
            retry: false, // Don't retry mutations
          },
        },
      })
  );

  // Configure client with base URL and headers
  client.setConfig({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Version": CLIENT_VERSION,
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Named export
export { QueryProvider };
```

#### Dynamic Authentication Headers

```typescript
// apps/client-next/components/authenticated-app.tsx
import { useEffect } from "react";
import type { ReactNode } from "react";
import { client } from "@repo/api/client";
import { useAuth } from "@/hooks/use-auth";

export function AuthenticatedApp({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  useEffect(() => {
    // Update client config when auth token changes
    if (token) {
      client.setConfig({
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  }, [token]);

  return <div>{children}</div>;
}

// Named export
export { AuthenticatedApp };
```

#### Environment-Specific Configuration

```typescript
// apps/client-next/lib/query-provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "@repo/api/client";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const ZERO_MS = 0;
const isDevelopment = process.env.NODE_ENV === "development";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // No cache in dev for fresh data, 5min in prod
            staleTime: isDevelopment ? ZERO_MS : FIVE_MINUTES_MS,
            refetchOnWindowFocus: !isDevelopment,
            // No retry in dev (fail fast), retry in prod
            retry: isDevelopment ? false : DEFAULT_RETRY_ATTEMPTS,
          },
        },
      })
  );

  // Configure API client
  client.setConfig({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "",
    // Development-specific settings
    ...(isDevelopment && {
      headers: {
        "X-Debug": "true",
      },
    }),
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Named export
export { QueryProvider };
```

**Why good:** Named constants make configuration values self-documenting, environment-aware settings optimize for dev speed and prod performance, dynamic auth headers update when token changes without app restart, merge behavior preserves existing config

**Why bad (Anti-pattern):**

```typescript
// ❌ Magic numbers everywhere
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // What is this?
      retry: 3, // Why 3?
    },
  },
});

// ❌ Hardcoded values
client.setConfig({
  headers: {
    "X-Client-Version": "1.0.0", // Should be const
  },
});
```

**Why bad:** Magic numbers obscure intent requiring code archaeology, hardcoded versions get stale during refactoring, makes A/B testing timeout values impossible

---

### Pattern 4: Per-Request Configuration Override

Override client configuration for specific requests without affecting global settings.

#### Constants

```typescript
const DEFAULT_TIMEOUT_MS = 10000;
```

#### Per-Request Override

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

const ALTERNATIVE_BASE_URL = "https://different-api.example.com/api/v1";

export function Features() {
  const { data } = useQuery({
    ...getFeaturesOptions(),
    // Override client for this request only
    meta: {
      client: {
        baseUrl: ALTERNATIVE_BASE_URL,
      },
    },
  });

  return <div>{/* ... */}</div>;
}

// Named export
export { Features };
```

**Why good:** Request-specific config doesn't affect other requests, clean separation between global and per-request settings, type-safe config options, named constants prevent magic URLs

**Why bad (Anti-pattern):**

```typescript
// ❌ Mutating global config for single request
function SpecialFeature() {
  const { data } = useQuery({
    queryKey: ["special"],
    queryFn: async () => {
      client.setConfig({
        baseUrl: "https://other-api.com", // Affects ALL subsequent requests!
      });
      return client.get({ url: "/data" });
    },
  });
}
```

**Why bad:** Mutating global config creates race conditions in concurrent requests, causes flaky tests, breaks other components making API calls simultaneously

**When to use:** Rarely needed—most apps use single API base URL. Useful for gradual API migrations or multi-tenant systems.

**When not to use:** Don't use for auth headers (use global config with useEffect) or for retry/timeout (use query options).

---

### Pattern 5: Timeout Configuration with Abort Controller

Configure request timeout at the fetch level using AbortController with named constants.

#### Constants

```typescript
const DEFAULT_TIMEOUT_MS = 10000;
const THIRTY_SECONDS_MS = 30 * 1000;
```

#### Implementation

```typescript
// apps/client-next/lib/query-provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "@repo/api/client";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10000;

// Custom fetch with timeout
const fetchWithTimeout = (timeoutMs: number = DEFAULT_TIMEOUT_MS) => {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: FIVE_MINUTES_MS,
          },
        },
      })
  );

  // Configure client with custom fetch
  client.setConfig({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "",
    fetch: fetchWithTimeout(DEFAULT_TIMEOUT_MS),
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Named export
export { QueryProvider };
```

#### Per-Query Timeout

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

const FIVE_SECONDS_MS = 5 * 1000;

export function Features() {
  const { data } = useQuery({
    ...getFeaturesOptions(),
    // React Query timeout (different from fetch timeout)
    meta: {
      timeout: FIVE_SECONDS_MS,
    },
  });

  return <div>{/* ... */}</div>;
}

// Named export
export { Features };
```

**Why good:** Prevents hanging requests from degrading UX, AbortController properly cancels in-flight requests, named constants make timeout policy clear, cleanup prevents memory leaks

**Why bad (Anti-pattern):**

```typescript
// ❌ Magic timeout number
setTimeout(() => controller.abort(), 10000); // Why 10 seconds?

// ❌ No cleanup
const controller = new AbortController();
setTimeout(() => controller.abort(), timeout);
// Missing clearTimeout on success path - memory leak!
```

**Why bad:** Magic timeout makes policy changes require grep, missing cleanup leaks timers causing performance degradation, timeout without abort just delays error without freeing resources

**When not to use:** Don't set aggressive timeouts for file uploads, large downloads, or long-polling connections.

---

### Pattern 6: Type Safety with Generated Types

All types are auto-generated from OpenAPI schema using @hey-api/openapi-ts—never write manual type definitions.

#### Generated Types (Auto-Generated)

```typescript
// packages/api/src/apiClient/types.gen.ts (AUTO-GENERATED)
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

#### Usage with Type Inference

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";
import type { Feature } from "@repo/api/types";

export function FeaturesPage() {
  const { data } = useQuery(getFeaturesOptions());

  // data is typed as GetFeaturesResponse | undefined
  // data.features is typed as Feature[] | undefined
  const features: Feature[] | undefined = data?.features;

  return (
    <ul>
      {features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li> // Full autocomplete!
      ))}
    </ul>
  );
}

// Named export
export { FeaturesPage };
```

**Why good:** Zero manual typing eliminates drift, types match backend exactly, breaking changes detected via TypeScript errors at compile time, full IDE autocomplete prevents typos

**Why bad (Anti-pattern):**

```typescript
// ❌ Manual type definition - drifts from backend
interface Feature {
  id: string;
  name: string;
  // Missing 'description' and 'status' - causes runtime errors!
}

// ❌ Using 'any' - loses all type safety
const features: any = data?.features;
```

**Why bad:** Manual types drift from backend causing silent runtime errors, missing fields break UI, 'any' defeats TypeScript purpose creating production bugs

---

### Pattern 7: Error Handling with React Query

Handle errors at the component level using React Query's built-in error handling with exponential backoff retry logic.

#### Constants

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
```

#### Component-Level Error Handling

```typescript
// apps/client-next/app/features/page.tsx
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";
import { Info } from "@repo/ui/info";
import { Skeleton } from "@repo/ui/skeleton";

export function FeaturesPage() {
  const { data, isPending, error, isSuccess } = useQuery(getFeaturesOptions());

  // Handle pending state
  if (isPending) {
    return <Skeleton />;
  }

  // Handle error state
  if (error) {
    return <Info variant="error" message={`An error has occurred: ${error.message}`} />;
  }

  // Handle empty state
  if (isSuccess && !data?.features?.length) {
    return <Info variant="info" message="No features found" />;
  }

  // Handle success state
  return (
    <ul>
      {data?.features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>
      ))}
    </ul>
  );
}

// Named export
export { FeaturesPage };
```

#### Global Error Handling

```typescript
// apps/client-next/lib/query-provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "@repo/api/client";
import { toast } from "@repo/ui/toast";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const isDevelopment = process.env.NODE_ENV === "development";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: !isDevelopment, // No retry in dev (fail fast)
            staleTime: FIVE_MINUTES_MS,
          },
          mutations: {
            onError: (error) => {
              // Global error handling for mutations
              console.error("Mutation error:", error);
              toast.error("Something went wrong. Please try again.");
            },
          },
        },
      })
  );

  client.setConfig({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "",
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Named export
export { QueryProvider };
```

#### Per-Query Error Handling with Retry

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";
import { toast } from "@repo/ui/toast";

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30 * 1000;
const EXPONENTIAL_BASE = 2;

export function Features() {
  const { data, error } = useQuery({
    ...getFeaturesOptions(),
    retry: MAX_RETRY_ATTEMPTS,
    retryDelay: (attemptIndex) =>
      Math.min(INITIAL_RETRY_DELAY_MS * EXPONENTIAL_BASE ** attemptIndex, MAX_RETRY_DELAY_MS),
    onError: (error) => {
      console.error("Failed to load features:", error);
      toast.error("Failed to load features");
    },
  });

  return <div>{/* ... */}</div>;
}

// Named export
export { Features };
```

**Why good:** React Query handles retry with exponential backoff automatically, component-level control lets each UI decide error presentation, global defaults ensure consistency, no interceptors needed simplifies architecture, named constants make retry policy auditable

**Why bad (Anti-pattern):**

```typescript
// ❌ Magic numbers in retry logic
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000);

// ❌ Swallowing errors silently
onError: () => {}, // User has no feedback!

// ❌ Using retry: false in production
retry: false, // Fails on transient network errors
```

**Why bad:** Magic numbers obscure retry policy making tuning difficult, silent errors leave users confused, disabling retry in production causes failures from temporary network blips

**When not to use:** Don't use global onError for queries (handle at component level for better UX).

---

### Pattern 8: Integration with React Query Generated Hooks

Use generated query options directly—never write custom React Query hooks.

#### Generated Query Options (Auto-Generated)

```typescript
// packages/api/src/apiClient/@tanstack/react-query.gen.ts (AUTO-GENERATED)
import type { QueryObserverOptions } from "@tanstack/react-query";
import { getFeaturesQueryKey, getFeatures } from "./services.gen";
import type { GetFeaturesResponse } from "./types.gen";

export const getFeaturesOptions = (): QueryObserverOptions<GetFeaturesResponse> => ({
  queryKey: getFeaturesQueryKey(),
  queryFn: () => getFeatures(),
});

// Query key is also generated
export function getFeaturesQueryKey() {
  return ["api", "v1", "features"] as const;
}
```

#### Customizing Generated Options

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;

export function Features() {
  const someCondition = true; // Your condition

  const { data } = useQuery({
    ...getFeaturesOptions(),
    // Override defaults
    staleTime: TEN_MINUTES_MS,
    refetchInterval: THIRTY_SECONDS_MS,
    enabled: someCondition, // Conditional fetching
  });

  return <div>{/* ... */}</div>;
}

// Named export
export { Features };
```

**Why good:** Zero boilerplate eliminates custom hook bugs, type-safe options prevent runtime errors, consistent patterns across all API calls, query keys automatically namespaced, easy to customize by spreading, named constants make policies visible

**Why bad (Anti-pattern):**

```typescript
// ❌ Custom React Query hook - should use generated options
function useFeatures() {
  return useQuery({
    queryKey: ["features"], // Manual key prone to typos
    queryFn: async () => {
      const res = await fetch("/api/v1/features"); // Magic URL
      return res.json();
    },
    staleTime: 600000, // Magic number
  });
}
```

**Why bad:** Custom hooks create inconsistent patterns, manual query keys cause cache key collisions, magic URLs break on API changes, magic numbers hide caching policy

---

### Pattern 9: Client-Side Error Handling for Browser APIs

Wrap browser APIs (localStorage, sessionStorage, IndexedDB) in try/catch—they fail in private browsing, storage limits, or SSR.

#### Constants

```typescript
const DEFAULT_VALUE = "";
```

#### localStorage Wrapper

```typescript
// hooks/use-local-storage.ts
import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Try/catch around localStorage access
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      // Log with context
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}

// Named export
export { useLocalStorage };
```

#### Error Boundaries

```typescript
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import type { ReactNode } from "react";

export function App({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div>
              <p>Something went wrong: {error.message}</p>
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

// Named export
export { App };
```

#### Custom Error Classes

```typescript
// lib/errors.ts
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

// Named export
export { APIError };

// Usage
import { APIError } from "@/lib/errors";

try {
  const response = await fetch("/api/users/123");
  if (!response.ok) {
    throw new APIError("User not found", response.status, "/api/users/123");
  }
} catch (error) {
  if (error instanceof APIError) {
    console.error(`API Error [${error.statusCode}] ${error.endpoint}:`, error.message);
  }
}
```

**Why good:** Try/catch prevents crashes in private browsing mode, error context aids debugging, error boundaries prevent white screens, custom error classes provide structured error info, named exports follow project conventions

**Why bad (Anti-pattern):**

```typescript
// ❌ No error handling - crashes in private browsing
const value = JSON.parse(localStorage.getItem(key));

// ❌ Silent error - user has no feedback
try {
  localStorage.setItem(key, value);
} catch {}

// ❌ Generic error message
console.error(error); // What operation failed?
```

**Why bad:** Unhandled localStorage crashes app in private browsing, silent catch blocks hide bugs, generic logs make debugging impossible in production

</patterns>

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
├─ Global mutations?
│   └─ Use onError in QueryClient defaultOptions ✓
└─ Browser APIs (localStorage)?
    └─ Wrap in try/catch with context logging ✓
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **React Query (@tanstack/react-query)**: Generated query options integrate directly with useQuery/useMutation hooks for automatic data fetching and caching
- **MSW (@repo/api-mocks)**: Mock handlers use generated types from `@repo/api/types` ensuring mocks match API contract (see API Mocking skill for MSW setup)
- **TypeScript**: Generated types provide end-to-end type safety from OpenAPI schema to UI components
- **Next.js**: Environment variables (NEXT_PUBLIC_API_URL) configure client per deployment environment

**Replaces / Conflicts with:**

- **Axios**: hey-api uses fetch-based client, no interceptors available—use React Query middleware instead
- **Custom API hooks**: Generated query options replace manual useQuery wrappers
- **Manual type definitions**: OpenAPI types replace hand-written interfaces
- **Redux for server state**: React Query handles server state, use Zustand for client state only

</integration>

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
- ⚠️ **Incorrect import order** - should be React → external → @repo/* → relative → styles
- ⚠️ **Mutating global client config in query functions** - causes race conditions, use per-request meta instead
- ⚠️ **Missing error boundaries** - unhandled errors crash entire app, wrap with QueryErrorResetBoundary
- ⚠️ **No try/catch around localStorage** - crashes in private browsing mode

**Common Mistakes:**

- Forgetting to regenerate client after OpenAPI schema changes (`bun run build` in packages/api)
- Using `retry: true` in development with mocks (should be `false` to fail fast)
- Not cleaning up AbortController timeout (memory leak)
- Using generic error messages ("Error occurred" instead of "Failed to load features")

**Gotchas & Edge Cases:**

- When using MSW mocks, they must start before React Query provider mounts (see API Mocking skill)
- `NEXT_PUBLIC_` prefix required for client-side env variables in Next.js
- `client.setConfig()` merges with existing config, doesn't replace it
- Generated query keys are immutable tuples (safe for React Query key equality)
- Fetch timeout is different from React Query's staleTime/cacheTime
- Generated types change when OpenAPI schema changes—commit generated files to catch breaking changes in code review

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

**(You MUST use generated query options from @hey-api - NEVER write custom React Query hooks)**

**(You MUST regenerate client code (`bun run build` in packages/api) when OpenAPI schema changes)**

**(You MUST use named constants for ALL timeout/retry values - NO magic numbers)**

**(You MUST configure API client base URL via environment variables)**

**(You MUST use named exports only - NO default exports in libraries)**

**Failure to follow these rules will cause type drift, bundle bloat, and production bugs.**

</critical_reminders>
