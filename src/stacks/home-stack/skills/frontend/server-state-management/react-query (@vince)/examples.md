# API Integration - Code Examples

> All code examples for API client patterns. See [skill.md](skill.md) for core concepts.

---

## Pattern 1: OpenAPI Schema Definition and Code Generation

### Generated Types (Auto-Generated)

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

### Generated React Query Options (Auto-Generated)

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

### Usage in Apps

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

### ❌ Bad Example - Anti-pattern

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

---

## Pattern 2: Client Configuration with Environment Variables

### ✅ Good Example - Basic Setup

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

### Usage in Layout

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

### ❌ Bad Example - Anti-pattern

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

## Pattern 3: Advanced Configuration (Headers, Auth, Environment-Specific Settings)

### Constants

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
```

### ✅ Good Example - Headers and Authentication

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

### Dynamic Authentication Headers

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

### Environment-Specific Configuration

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

### ❌ Bad Example - Anti-pattern

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

## Pattern 4: Per-Request Configuration Override

### Constants

```typescript
const DEFAULT_TIMEOUT_MS = 10000;
```

### ✅ Good Example - Per-Request Override

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

### ❌ Bad Example - Anti-pattern

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

## Pattern 5: Timeout Configuration with Abort Controller

### Constants

```typescript
const DEFAULT_TIMEOUT_MS = 10000;
const THIRTY_SECONDS_MS = 30 * 1000;
```

### ✅ Good Example - Implementation

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

### Per-Query Timeout

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

### ❌ Bad Example - Anti-pattern

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

## Pattern 6: Type Safety with Generated Types

### Generated Types (Auto-Generated)

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

### ✅ Good Example - Usage with Type Inference

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

### ❌ Bad Example - Anti-pattern

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

## Pattern 7: Error Handling with React Query

### Constants

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
```

### ✅ Good Example - Component-Level Error Handling

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

### Global Error Handling

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

### Per-Query Error Handling with Retry

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

### ❌ Bad Example - Anti-pattern

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

## Pattern 8: Integration with React Query Generated Hooks

### Customizing Generated Options

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

### ❌ Bad Example - Anti-pattern

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

## Pattern 9: Client-Side Error Handling for Browser APIs

### Constants

```typescript
const DEFAULT_VALUE = "";
```

### ✅ Good Example - localStorage Wrapper

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

### Error Boundaries

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

### Custom Error Classes

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

### ❌ Bad Example - Anti-pattern

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

---

## Pattern 10: useDebounce Integration with React Query

### Constants

```typescript
const DEBOUNCE_DELAY_MS = 500;
const MIN_SEARCH_LENGTH = 0;
```

### Implementation

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const DEBOUNCE_DELAY_MS = 500;
const MIN_SEARCH_LENGTH = 0;

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY_MS);

  const { data } = useQuery({
    queryKey: ["search", debouncedSearchTerm],
    queryFn: () => searchAPI(debouncedSearchTerm),
    enabled: debouncedSearchTerm.length > MIN_SEARCH_LENGTH,
  });

  return <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />;
}

// Named export
export { SearchComponent };
```

**Why good:** debounce prevents excessive API calls on every keystroke, named constants for delay and minimum length make values self-documenting, enabled option prevents unnecessary queries for empty search terms, query key includes debounced term for proper cache management

### Bad Example - No Debounce

```typescript
// BAD: Fetches on every keystroke
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data } = useQuery({
    queryKey: ["search", searchTerm], // Changes on every keystroke
    queryFn: () => searchAPI(searchTerm),
  });

  return <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />;
}
```

**Why bad:** triggers a new API request on every keystroke creating excessive network traffic, wastes server resources, creates poor UX with flickering results, can cause race conditions where older results arrive after newer ones
