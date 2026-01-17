# API Integration - Error Handling

> Error handling patterns for React Query. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 2: Client Configuration](core.md#pattern-2-client-configuration-with-environment-variables) from core examples first.

---

## Pattern 7: Error Handling with React Query

### Constants

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
```

### Good Example - Component-Level Error Handling

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

### Bad Example - Anti-pattern

```typescript
// BAD: Magic numbers in retry logic
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000);

// BAD: Swallowing errors silently
onError: () => {}, // User has no feedback!

// BAD: Using retry: false in production
retry: false, // Fails on transient network errors
```

**Why bad:** Magic numbers obscure retry policy making tuning difficult, silent errors leave users confused, disabling retry in production causes failures from temporary network blips

**When not to use:** Don't use global onError for queries (handle at component level for better UX).

---

## Pattern 9: Client-Side Error Handling for Browser APIs

### Constants

```typescript
const DEFAULT_VALUE = "";
```

### Good Example - localStorage Wrapper

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

### Bad Example - Anti-pattern

```typescript
// BAD: No error handling - crashes in private browsing
const value = JSON.parse(localStorage.getItem(key));

// BAD: Silent error - user has no feedback
try {
  localStorage.setItem(key, value);
} catch {}

// BAD: Generic error message
console.error(error); // What operation failed?
```

**Why bad:** Unhandled localStorage crashes app in private browsing, silent catch blocks hide bugs, generic logs make debugging impossible in production

---

_Related: [core.md](core.md) | [configuration.md](configuration.md)_
