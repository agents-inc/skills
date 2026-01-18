# API Integration - Configuration

> Advanced configuration patterns. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 2: Client Configuration](core.md#pattern-2-client-configuration-with-environment-variables) from core examples first.

---

## Pattern 3: Advanced Configuration (Headers, Auth, Environment-Specific Settings)

### Constants

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;
const DEFAULT_RETRY_ATTEMPTS = 3;
```

### Good Example - Headers and Authentication

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

### Bad Example - Anti-pattern

```typescript
// BAD: Magic numbers everywhere
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // What is this?
      retry: 3, // Why 3?
    },
  },
});

// BAD: Hardcoded values
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

### Good Example - Per-Request Override

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

### Bad Example - Anti-pattern

```typescript
// BAD: Mutating global config for single request
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

**When to use:** Rarely needed - most apps use single API base URL. Useful for gradual API migrations or multi-tenant systems.

**When not to use:** Don't use for auth headers (use global config with useEffect) or for retry/timeout (use query options).

---

## Pattern 5: Timeout Configuration with Abort Controller

### Constants

```typescript
const DEFAULT_TIMEOUT_MS = 10000;
const THIRTY_SECONDS_MS = 30 * 1000;
```

### Good Example - Implementation

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

### Bad Example - Anti-pattern

```typescript
// BAD: Magic timeout number
setTimeout(() => controller.abort(), 10000); // Why 10 seconds?

// BAD: No cleanup
const controller = new AbortController();
setTimeout(() => controller.abort(), timeout);
// Missing clearTimeout on success path - memory leak!
```

**Why bad:** Magic timeout makes policy changes require grep, missing cleanup leaks timers causing performance degradation, timeout without abort just delays error without freeing resources

**When not to use:** Don't set aggressive timeouts for file uploads, large downloads, or long-polling connections.

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

---

_Related: [core.md](core.md) | [error-handling.md](error-handling.md)_
