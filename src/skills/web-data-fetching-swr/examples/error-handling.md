# SWR - Error Handling Examples

> Retry configuration and error boundaries. See [core.md](core.md) for basic patterns.

---

## Fetcher Error Handling

### Typed Error Fetcher

```typescript
// lib/fetcher.ts
interface FetchError extends Error {
  info: unknown;
  status: number;
}

const fetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = new Error("An error occurred") as FetchError;

    // Try to parse error body
    try {
      error.info = await response.json();
    } catch {
      error.info = { message: response.statusText };
    }

    error.status = response.status;
    throw error;
  }

  return response.json();
};

export { fetcher };
export type { FetchError };
```

**Why good:** Error includes status for conditional handling, info captures server error response, typed error enables TypeScript inference

---

## Error Retry Configuration

### Global Retry Settings

```typescript
// providers/swr-provider.tsx
import { SWRConfig } from "swr";

const ERROR_RETRY_COUNT = 3;
const ERROR_RETRY_INTERVAL_MS = 5000;
const MAX_RETRY_INTERVAL_MS = 30000;

function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Enable error retry
        shouldRetryOnError: true,

        // Maximum retry attempts
        errorRetryCount: ERROR_RETRY_COUNT,

        // Fixed interval between retries
        errorRetryInterval: ERROR_RETRY_INTERVAL_MS,

        // Custom retry logic with exponential backoff
        onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
          // Never retry on 404
          if (error.status === 404) return;

          // Never retry on 401/403 (auth errors)
          if (error.status === 401 || error.status === 403) return;

          // Only retry up to max count
          if (retryCount >= ERROR_RETRY_COUNT) return;

          // Exponential backoff with max
          const delay = Math.min(
            ERROR_RETRY_INTERVAL_MS * Math.pow(2, retryCount),
            MAX_RETRY_INTERVAL_MS
          );

          setTimeout(() => revalidate({ retryCount }), delay);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { SWRProvider };
```

### Per-Query Retry Override

```typescript
// components/critical-data.tsx
import useSWR from "swr";

const CRITICAL_RETRY_COUNT = 5;
const CRITICAL_RETRY_INTERVAL_MS = 2000;

function CriticalData() {
  const { data, error, isLoading } = useSWR("/api/critical-data", fetcher, {
    // More aggressive retry for critical data
    errorRetryCount: CRITICAL_RETRY_COUNT,
    errorRetryInterval: CRITICAL_RETRY_INTERVAL_MS,

    // Custom retry logic
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Always retry critical data (except auth errors)
      if (error.status === 401) return;
      if (retryCount >= CRITICAL_RETRY_COUNT) return;

      setTimeout(() => revalidate({ retryCount }), CRITICAL_RETRY_INTERVAL_MS);
    },
  });

  if (error && !data) {
    return (
      <CriticalErrorBanner>
        <p>Failed to load critical data after {CRITICAL_RETRY_COUNT} attempts</p>
        <button onClick={() => mutate()}>Retry Now</button>
      </CriticalErrorBanner>
    );
  }

  return <DataView data={data} />;
}

export { CriticalData };
```

**Why good:** Named constants for retry config, custom onErrorRetry enables exponential backoff, different retry strategies for different data importance

---

## Component-Level Error Handling

### Error States in Component

```typescript
// components/user-data.tsx
import useSWR from "swr";
import type { FetchError } from "../lib/fetcher";

interface User {
  id: string;
  name: string;
}

function UserData({ userId }: { userId: string }) {
  const { data, error, isLoading, mutate } = useSWR<User, FetchError>(
    `/api/users/${userId}`,
    fetcher
  );

  // Loading state
  if (isLoading) {
    return <Skeleton />;
  }

  // Error handling by status code
  if (error) {
    switch (error.status) {
      case 401:
        return (
          <ErrorCard variant="warning">
            <p>Your session has expired</p>
            <a href="/login">Log in again</a>
          </ErrorCard>
        );

      case 403:
        return (
          <ErrorCard variant="warning">
            <p>You don't have permission to view this user</p>
          </ErrorCard>
        );

      case 404:
        return (
          <ErrorCard variant="info">
            <p>User not found</p>
            <a href="/users">View all users</a>
          </ErrorCard>
        );

      case 429:
        return (
          <ErrorCard variant="warning">
            <p>Too many requests. Please wait a moment.</p>
            <button onClick={() => mutate()}>Retry</button>
          </ErrorCard>
        );

      default:
        return (
          <ErrorCard variant="error">
            <p>Failed to load user: {error.message}</p>
            <button onClick={() => mutate()}>Retry</button>
          </ErrorCard>
        );
    }
  }

  // No data after loading (shouldn't happen, but handle it)
  if (!data) {
    return <p>No data available</p>;
  }

  // Success
  return (
    <div>
      <h1>{data.name}</h1>
    </div>
  );
}

export { UserData };
```

### Stale Data with Error

```typescript
// components/stale-with-error.tsx
import useSWR from "swr";

function StaleWithError({ endpoint }: { endpoint: string }) {
  const { data, error, isValidating, mutate } = useSWR(endpoint, fetcher);

  // Show stale data with error banner
  if (error && data) {
    return (
      <div>
        <WarningBanner>
          <p>Showing cached data. Latest update failed: {error.message}</p>
          <button onClick={() => mutate()} disabled={isValidating}>
            {isValidating ? "Retrying..." : "Retry"}
          </button>
        </WarningBanner>
        <DataView data={data} />
      </div>
    );
  }

  // Error with no data
  if (error && !data) {
    return (
      <ErrorBanner>
        <p>Failed to load: {error.message}</p>
        <button onClick={() => mutate()}>Retry</button>
      </ErrorBanner>
    );
  }

  // Success
  return <DataView data={data} />;
}

export { StaleWithError };
```

**Why good:** Status-specific error handling, stale data shown with warning instead of hiding, manual retry available

---

## Global Error Handler

### Centralized Error Logging

```typescript
// providers/swr-provider.tsx
import { SWRConfig } from "swr";

function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        onError: (error, key) => {
          // Don't log expected errors
          if (error.status === 404) return;
          if (error.status === 401) {
            // Redirect to login
            window.location.href = "/login";
            return;
          }

          // Log to console in development
          console.error(`SWR Error [${key}]:`, error);

          // Report to error tracking service
          if (process.env.NODE_ENV === "production") {
            errorTracker.captureException(error, {
              extra: {
                swrKey: key,
                status: error.status,
                info: error.info,
              },
            });
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { SWRProvider };
```

**Why good:** Centralized error logging, auth errors handled globally, production error tracking integration

---

## Error Boundaries Integration

### React Error Boundary with SWR

```typescript
// components/error-boundary.tsx
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
```

### SWR with Error Boundary

```typescript
// components/data-with-boundary.tsx
import useSWR from "swr";
import { ErrorBoundary } from "./error-boundary";

function DataLoader() {
  const { data, error } = useSWR("/api/data", fetcher, {
    // Throw errors to be caught by boundary
    suspense: true,
  });

  // With suspense: true, errors are thrown
  return <DataView data={data} />;
}

function DataWithBoundary() {
  return (
    <ErrorBoundary
      fallback={
        <ErrorCard>
          <p>Something went wrong loading data</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </ErrorCard>
      }
    >
      <DataLoader />
    </ErrorBoundary>
  );
}

export { DataWithBoundary };
```

**Why good:** Error boundary catches thrown errors, suspense mode enables error boundary integration, clean fallback UI

---

## Disable Retry Patterns

### Never Retry Certain Errors

```typescript
// providers/smart-retry-provider.tsx
import { SWRConfig } from "swr";

const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404, 422];
const DEFAULT_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 5000;

function SmartRetryProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
          // Never retry client errors
          if (NON_RETRYABLE_STATUS_CODES.includes(error.status)) {
            return;
          }

          // Limit retries
          if (retryCount >= DEFAULT_RETRY_COUNT) {
            return;
          }

          // Retry server errors
          if (error.status >= 500) {
            setTimeout(() => revalidate({ retryCount }), RETRY_DELAY_MS);
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { SmartRetryProvider };
```

### Disable All Retry

```typescript
// components/no-retry-data.tsx
import useSWR from "swr";

function NoRetryData() {
  const { data, error } = useSWR("/api/one-shot", fetcher, {
    shouldRetryOnError: false,
    errorRetryCount: 0,
  });

  return <DataView data={data} error={error} />;
}

export { NoRetryData };
```

**Why good:** Non-retryable errors identified by status code, server errors (5xx) retried, client errors (4xx) not retried

---

## Network Error Detection

### Online/Offline Handling

```typescript
// components/network-aware.tsx
import useSWR from "swr";
import { useState, useEffect } from "react";

function NetworkAwareData() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const { data, error, mutate } = useSWR("/api/data", fetcher, {
    // Don't revalidate when offline
    revalidateOnFocus: isOnline,
    revalidateOnReconnect: true,
  });

  if (!isOnline && !data) {
    return (
      <OfflineBanner>
        <p>You're offline. Data will load when connection is restored.</p>
      </OfflineBanner>
    );
  }

  if (!isOnline && data) {
    return (
      <div>
        <OfflineBanner>
          <p>You're offline. Showing cached data.</p>
        </OfflineBanner>
        <DataView data={data} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBanner>
        <p>Failed to load: {error.message}</p>
        <button onClick={() => mutate()}>Retry</button>
      </ErrorBanner>
    );
  }

  return <DataView data={data} />;
}

export { NetworkAwareData };
```

**Why good:** Network status detection, cached data shown when offline, revalidation disabled when offline to prevent unnecessary errors

---

## Anti-Pattern Examples

```typescript
// BAD: Fetcher doesn't throw on error
const fetcher = (url) => fetch(url).then(r => r.json());
// Returns error response body as "data" instead of triggering error state

// BAD: Not handling specific error codes
if (error) {
  return <p>Something went wrong</p>; // No specific handling for 401, 404, etc.
}

// BAD: Hiding stale data on error
if (error) {
  return <Error />; // Hides potentially useful cached data
}

// BAD: Magic numbers for retry
errorRetryCount: 3,
errorRetryInterval: 5000,
```

```typescript
// GOOD: Fetcher throws on error
const fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Fetch failed');
    error.status = res.status;
    throw error;
  }
  return res.json();
};

// GOOD: Handle specific error codes
if (error) {
  if (error.status === 404) return <NotFound />;
  if (error.status === 401) return <LoginPrompt />;
  return <GenericError message={error.message} />;
}

// GOOD: Show stale data with error banner
if (error && data) {
  return (
    <>
      <WarningBanner>Update failed</WarningBanner>
      <DataView data={data} />
    </>
  );
}

// GOOD: Named constants
const ERROR_RETRY_COUNT = 3;
const ERROR_RETRY_INTERVAL_MS = 5000;
errorRetryCount: ERROR_RETRY_COUNT,
errorRetryInterval: ERROR_RETRY_INTERVAL_MS,
```

**Why bad examples fail:** Non-throwing fetcher returns errors as data, generic error messages confuse users, hiding stale data provides worse UX, magic numbers are unmaintainable
