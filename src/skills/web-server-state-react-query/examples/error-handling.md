# React Query + hey-api - Error Handling Examples

> Error handling patterns for React Query. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 2: Client Configuration](core.md#pattern-2-client-configuration) from core examples first.

---

## Pattern 5: Component-Level Error Handling

### Constants

```typescript
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const EXPONENTIAL_BASE = 2;
```

### Good Example - Complete State Handling

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "../api-client/@tanstack/react-query.gen";

export function FeaturesPage() {
  const { data, isPending, error, isSuccess } = useQuery(getFeaturesOptions());

  if (isPending) return <LoadingSkeleton />;

  if (error) {
    return <ErrorMessage message={`Failed to load features: ${error.message}`} />;
  }

  if (isSuccess && !data?.features?.length) {
    return <EmptyState message="No features found" />;
  }

  return (
    <ul>
      {data?.features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>
      ))}
    </ul>
  );
}
```

---

## Pattern 6: Global Error Handling

> **v5 Pattern:** Use `QueryCache` and `MutationCache` for global error handling. The `onError` callback on queries was removed in v5, but mutations still support it.

```typescript
"use client"; // Required in RSC frameworks (Next.js, etc.) -- omit for SPA

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { client } from "../api-client/client.gen";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const isDevelopment = process.env.NODE_ENV === "development";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Only show notification for queries that already had data
            // Prevents notifications for initial load failures (handled by component)
            if (query.state.data !== undefined) {
              showNotification(`Something went wrong: ${error.message}`);
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            console.error("Mutation error:", error);
            showNotification("Something went wrong. Please try again.");
          },
        }),
        defaultOptions: {
          queries: {
            retry: !isDevelopment,
            staleTime: FIVE_MINUTES_MS,
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

---

## Pattern 7: Per-Query Retry with Exponential Backoff

> **Note:** In React Query v5, `onError`, `onSuccess`, and `onSettled` callbacks were **removed** from `useQuery`. Use `useEffect` for component-level side effects or `QueryCache.onError` for global handling.

```typescript
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "../api-client/@tanstack/react-query.gen";

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const EXPONENTIAL_BASE = 2;

export function Features() {
  const { data, error } = useQuery({
    ...getFeaturesOptions(),
    retry: MAX_RETRY_ATTEMPTS,
    retryDelay: (attemptIndex) =>
      Math.min(
        INITIAL_RETRY_DELAY_MS * EXPONENTIAL_BASE ** attemptIndex,
        MAX_RETRY_DELAY_MS,
      ),
  });

  // v5 pattern: Use useEffect for error side effects
  useEffect(() => {
    if (error) {
      console.error("Failed to load features:", error);
      showNotification("Failed to load features");
    }
  }, [error]);

  return <div>{/* render data */}</div>;
}
```

### Bad Example - v4 Callbacks and Magic Numbers

```typescript
// BAD: Magic numbers in retry logic
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000);

// BAD: Using onError callback (REMOVED in v5)
// This will cause a TypeScript error in React Query v5
useQuery({
  ...getFeaturesOptions(),
  onError: (error) => {
    // This option no longer exists!
    toast.error(error.message);
  },
});

// BAD: Swallowing errors silently
useEffect(() => {
  if (error) {
    console.log(error); // Logging without user feedback
  }
}, [error]);
```

**Why bad:** Magic numbers obscure retry policy, `onError` was removed in v5 and will not compile, logging without user feedback leaves users confused

**When not to use:** For global error handling across all queries, use `QueryCache.onError` instead of per-component `useEffect`.

---

## Pattern 8: Error Boundaries with QueryErrorResetBoundary

```typescript
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import type { ReactNode } from "react";

export function QueryErrorBoundaryWrapper({ children }: { children: ReactNode }) {
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
```

**Why good:** `QueryErrorResetBoundary` resets failed queries when the error boundary resets, giving users a clean retry experience without stale error state

---

_Related: [core.md](core.md)_
