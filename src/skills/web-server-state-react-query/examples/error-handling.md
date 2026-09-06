# React Query — Error Handling Examples

> Full code for error handling. See [core.md](core.md) for setup and query options.

**Prerequisites**: [Pattern 2: Client and cache configuration](core.md#pattern-2-client-and-cache-configuration).

---

## Pattern 5: Component-level states

`isPending`, `error` and an explicit empty case are four renders, not two — a successful response
with nothing in it is not a loading state.

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "../api-client/@tanstack/react-query.gen";

export function FeaturesPage() {
  const { data, isPending, error, isSuccess } = useQuery(getFeaturesOptions());

  if (isPending) return <LoadingSkeleton />;
  if (error) return <ErrorMessage message={`Failed to load features: ${error.message}`} />;
  if (isSuccess && !data?.features?.length) return <EmptyState message="No features found" />;

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

## Pattern 6: Global handlers

`QueryCache` and `MutationCache` are the v5 home for cross-cutting failure handling, since
`useQuery` no longer takes `onError`.

```typescript
import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const isDevelopment = process.env.NODE_ENV === "development";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Only when the query already held data: a first-load failure is the component's
            // to render, and notifying as well shows the user the same error twice.
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
          queries: { retry: !isDevelopment, staleTime: FIVE_MINUTES_MS },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

---

## Pattern 7: Retry with exponential backoff

```typescript
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const EXPONENTIAL_BASE = 2;

export function Features() {
  const { data, error } = useQuery({
    ...getFeaturesOptions(),
    retry: MAX_RETRY_ATTEMPTS,
    retryDelay: (attemptIndex) =>
      Math.min(INITIAL_RETRY_DELAY_MS * EXPONENTIAL_BASE ** attemptIndex, MAX_RETRY_DELAY_MS),
  });

  // v5 has no onError on useQuery — side effects run from the rendered error
  useEffect(() => {
    if (error) {
      console.error("Failed to load features:", error);
      showNotification("Failed to load features");
    }
  }, [error]);

  return <div>{/* render data */}</div>;
}
```

### Bad example

```typescript
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000); // policy is unreadable

useQuery({
  ...getFeaturesOptions(),
  onError: (error) => toast.error(error.message), // removed in v5 — a type error, and never fires
});

useEffect(() => {
  if (error) console.log(error); // logged for a developer, invisible to the user
}, [error]);
```

**When not to use:** for every query at once, `QueryCache.onError` costs one handler instead of a
`useEffect` per component.

---

## Pattern 8: Resetting after a thrown error

`QueryErrorResetBoundary` clears the failed queries when the boundary resets, so "Try again"
refetches instead of re-rendering the same error.

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

---

_Related: [core.md](core.md)_
