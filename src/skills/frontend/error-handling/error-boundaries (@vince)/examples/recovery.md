# Error Boundaries - Recovery Patterns

> Advanced recovery patterns including retry limits and error classification. See [core.md](core.md) for basic patterns.

**Prerequisites**: Understand the basic ErrorBoundary component and reset functionality from core examples first.

---

## Pattern 10: Retry Limit Boundaries

### Good Example - Retry Tracking Boundary

```typescript
// src/components/error-boundary/retry-limited-boundary.tsx
import { useState, useCallback, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

const MAX_RETRY_COUNT = 3;

interface RetryLimitedBoundaryProps {
  children: ReactNode;
  maxRetries?: number;
  onMaxRetriesReached?: (error: Error) => void;
}

export function RetryLimitedBoundary({
  children,
  maxRetries = MAX_RETRY_COUNT,
  onMaxRetriesReached,
}: RetryLimitedBoundaryProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  const handleError = useCallback((error: Error) => {
    setLastError(error);
  }, []);

  const handleReset = useCallback(() => {
    const newCount = retryCount + 1;
    setRetryCount(newCount);

    if (newCount >= maxRetries && lastError) {
      onMaxRetriesReached?.(lastError);
    }
  }, [retryCount, maxRetries, lastError, onMaxRetriesReached]);

  if (retryCount >= maxRetries) {
    return (
      <div role="alert">
        <h3>Unable to load</h3>
        <p>We tried {maxRetries} times but couldn't load this content.</p>
        <p>Please refresh the page or try again later.</p>
        <button onClick={() => window.location.reload()}>Refresh page</button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={handleError}
      onReset={handleReset}
      fallbackRender={({ error, resetErrorBoundary }: FallbackProps) => (
        <div role="alert">
          <p>Something went wrong</p>
          <p>Attempt {retryCount + 1} of {maxRetries}</p>
          <button onClick={resetErrorBoundary}>Try again</button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
```

**Why good:** Prevents infinite retry loops, provides escalation path after max retries, tracks retry count for user feedback

---

### Good Example - Exponential Backoff Retry

```typescript
// src/components/error-boundary/backoff-retry-boundary.tsx
import { useState, useCallback, useRef, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const MAX_RETRIES = 5;

interface BackoffRetryBoundaryProps {
  children: ReactNode;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export function BackoffRetryBoundary({
  children,
  maxRetries = MAX_RETRIES,
  baseDelayMs = BASE_DELAY_MS,
  maxDelayMs = MAX_DELAY_MS,
}: BackoffRetryBoundaryProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const calculateDelay = useCallback(
    (attempt: number): number => {
      const delay = baseDelayMs * Math.pow(2, attempt);
      return Math.min(delay, maxDelayMs);
    },
    [baseDelayMs, maxDelayMs]
  );

  const handleRetry = useCallback(
    (resetErrorBoundary: () => void) => {
      const delay = calculateDelay(retryCount);
      setIsWaiting(true);

      timeoutRef.current = setTimeout(() => {
        setIsWaiting(false);
        setRetryCount((prev) => prev + 1);
        resetErrorBoundary();
      }, delay);
    },
    [retryCount, calculateDelay]
  );

  if (retryCount >= maxRetries) {
    return (
      <div role="alert">
        <h3>Maximum retries reached</h3>
        <p>Please try again later or contact support.</p>
        <button onClick={() => window.location.reload()}>Refresh page</button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }: FallbackProps) => {
        const nextDelay = calculateDelay(retryCount);
        const nextDelaySeconds = Math.round(nextDelay / 1000);

        return (
          <div role="alert">
            <p>Something went wrong: {error.message}</p>
            <p>Retry {retryCount + 1} of {maxRetries}</p>
            {isWaiting ? (
              <p>Retrying in {nextDelaySeconds} seconds...</p>
            ) : (
              <button onClick={() => handleRetry(resetErrorBoundary)}>
                Retry (wait {nextDelaySeconds}s)
              </button>
            )}
          </div>
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

**Why good:** Exponential backoff prevents server overload, shows wait time to user, respects max delay cap

---

## Pattern 11: Error Classification

### Good Example - Classified Error Handling

```typescript
// src/components/error-boundary/classified-boundary.tsx
import { ErrorBoundary } from "react-error-boundary";
import type { ReactNode } from "react";
import type { FallbackProps } from "react-error-boundary";

// Error classification types
type ErrorCategory = "network" | "auth" | "validation" | "unknown";

interface ClassifiedError extends Error {
  category?: ErrorCategory;
  retryable?: boolean;
}

function classifyError(error: Error): ClassifiedError {
  const classified = error as ClassifiedError;

  // Classify based on error characteristics
  if (error.message.includes("fetch") || error.message.includes("network")) {
    classified.category = "network";
    classified.retryable = true;
  } else if (error.message.includes("401") || error.message.includes("403")) {
    classified.category = "auth";
    classified.retryable = false;
  } else if (error.message.includes("validation")) {
    classified.category = "validation";
    classified.retryable = false;
  } else {
    classified.category = "unknown";
    classified.retryable = true;
  }

  return classified;
}

function ClassifiedFallback({ error, resetErrorBoundary }: FallbackProps) {
  const classified = classifyError(error);

  switch (classified.category) {
    case "network":
      return (
        <div role="alert">
          <h3>Connection Issue</h3>
          <p>Please check your internet connection.</p>
          <button onClick={resetErrorBoundary}>Retry</button>
        </div>
      );

    case "auth":
      return (
        <div role="alert">
          <h3>Session Expired</h3>
          <p>Please log in again to continue.</p>
          <button onClick={() => window.location.href = "/login"}>
            Go to Login
          </button>
        </div>
      );

    case "validation":
      return (
        <div role="alert">
          <h3>Invalid Data</h3>
          <p>There was a problem with the data. Please try again.</p>
        </div>
      );

    default:
      return (
        <div role="alert">
          <h3>Something went wrong</h3>
          <p>An unexpected error occurred.</p>
          {classified.retryable && (
            <button onClick={resetErrorBoundary}>Try again</button>
          )}
        </div>
      );
  }
}

interface ClassifiedBoundaryProps {
  children: ReactNode;
  onError?: (error: ClassifiedError) => void;
}

export function ClassifiedBoundary({ children, onError }: ClassifiedBoundaryProps) {
  const handleError = (error: Error) => {
    const classified = classifyError(error);
    onError?.(classified);
  };

  return (
    <ErrorBoundary
      FallbackComponent={ClassifiedFallback}
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
}
```

**Why good:** Different recovery actions based on error type, user-friendly messages per category, programmatic error classification

---

### Good Example - HTTP Status-Based Classification

```typescript
// src/utils/error-classification.ts

interface HttpError extends Error {
  status: number;
  statusText: string;
}

export function isHttpError(error: Error): error is HttpError {
  return "status" in error && typeof (error as HttpError).status === "number";
}

export type HttpErrorCategory =
  | "client-error"      // 4xx
  | "server-error"      // 5xx
  | "network-error"     // No response
  | "timeout-error";    // Request timeout

export interface CategorizedHttpError {
  category: HttpErrorCategory;
  retryable: boolean;
  userMessage: string;
  technicalDetails: string;
}

const RETRY_DELAY_MS = 5000;

export function categorizeHttpError(error: Error): CategorizedHttpError {
  if (!isHttpError(error)) {
    // Network error - no response received
    if (error.message.includes("NetworkError") || error.message.includes("fetch")) {
      return {
        category: "network-error",
        retryable: true,
        userMessage: "Unable to connect. Please check your internet connection.",
        technicalDetails: error.message,
      };
    }

    // Timeout
    if (error.message.includes("timeout") || error.name === "AbortError") {
      return {
        category: "timeout-error",
        retryable: true,
        userMessage: "Request timed out. Please try again.",
        technicalDetails: error.message,
      };
    }

    // Unknown error
    return {
      category: "client-error",
      retryable: false,
      userMessage: "An unexpected error occurred.",
      technicalDetails: error.message,
    };
  }

  const { status, statusText } = error;

  // 4xx Client errors
  if (status >= 400 && status < 500) {
    const messages: Record<number, string> = {
      400: "Invalid request. Please check your input.",
      401: "Please log in to continue.",
      403: "You don't have permission to access this.",
      404: "The requested resource was not found.",
      422: "The submitted data is invalid.",
      429: `Too many requests. Please wait ${RETRY_DELAY_MS / 1000} seconds.`,
    };

    return {
      category: "client-error",
      retryable: status === 429, // Only rate limit is retryable
      userMessage: messages[status] || `Request failed: ${statusText}`,
      technicalDetails: `HTTP ${status}: ${statusText}`,
    };
  }

  // 5xx Server errors
  if (status >= 500) {
    return {
      category: "server-error",
      retryable: true,
      userMessage: "Server error. Please try again in a moment.",
      technicalDetails: `HTTP ${status}: ${statusText}`,
    };
  }

  return {
    category: "client-error",
    retryable: false,
    userMessage: "An unexpected error occurred.",
    technicalDetails: `HTTP ${status}: ${statusText}`,
  };
}
```

**Why good:** HTTP-aware classification, appropriate retry logic per status code, clear separation of user vs technical messages

---

### Good Example - Combined Classification and Retry

```typescript
// src/components/error-boundary/smart-recovery-boundary.tsx
import { useState, useCallback, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";
import { categorizeHttpError, type CategorizedHttpError } from "@/utils/error-classification";

const MAX_AUTO_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

interface SmartRecoveryBoundaryProps {
  children: ReactNode;
  onError?: (categorized: CategorizedHttpError) => void;
}

export function SmartRecoveryBoundary({
  children,
  onError,
}: SmartRecoveryBoundaryProps) {
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [categorized, setCategorized] = useState<CategorizedHttpError | null>(null);

  const handleError = useCallback(
    (error: Error) => {
      const result = categorizeHttpError(error);
      setCategorized(result);
      onError?.(result);
    },
    [onError]
  );

  const handleReset = useCallback(() => {
    setAutoRetryCount(0);
    setCategorized(null);
  }, []);

  return (
    <ErrorBoundary
      onError={handleError}
      onReset={handleReset}
      fallbackRender={({ resetErrorBoundary }: FallbackProps) => {
        if (!categorized) {
          return <div role="alert">An error occurred</div>;
        }

        const canAutoRetry =
          categorized.retryable && autoRetryCount < MAX_AUTO_RETRIES;

        // Auto-retry for retryable errors
        if (canAutoRetry) {
          setTimeout(() => {
            setAutoRetryCount((prev) => prev + 1);
            resetErrorBoundary();
          }, RETRY_DELAY_MS);

          return (
            <div role="alert">
              <p>{categorized.userMessage}</p>
              <p>Retrying automatically... (Attempt {autoRetryCount + 1}/{MAX_AUTO_RETRIES})</p>
            </div>
          );
        }

        return (
          <div role="alert">
            <p>{categorized.userMessage}</p>
            {process.env.NODE_ENV === "development" && (
              <details>
                <summary>Technical Details</summary>
                <pre>{categorized.technicalDetails}</pre>
              </details>
            )}
            {categorized.retryable && (
              <button onClick={resetErrorBoundary}>Try Again</button>
            )}
            {categorized.category === "client-error" && (
              <button onClick={() => window.location.href = "/login"}>
                Return to Login
              </button>
            )}
          </div>
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

**Why good:** Combines classification with intelligent retry, auto-retries for transient errors, appropriate actions per error category

---
