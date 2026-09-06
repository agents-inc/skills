# Error Boundaries — Recovery Patterns

> Retry limits, backoff and error classification. See [core.md](core.md) for the boundary itself.

**Prerequisites:** the boundary and its reset callback, from [core.md](core.md).

---

## Pattern 8: Retry limit

An unconditional retry button on a permanent failure is a loop the user drives. Count the attempts
and change what the fallback offers once they run out.

```typescript
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

  const handleError = useCallback((error: Error) => setLastError(error), []);

  const handleReset = useCallback(() => {
    const nextCount = retryCount + 1;
    setRetryCount(nextCount);
    if (nextCount >= maxRetries && lastError) onMaxRetriesReached?.(lastError);
  }, [retryCount, maxRetries, lastError, onMaxRetriesReached]);

  if (retryCount >= maxRetries) {
    return (
      <div role="alert">
        <h3>Unable to load</h3>
        <p>We tried {maxRetries} times and could not load this content.</p>
        <button onClick={() => window.location.reload()}>Refresh page</button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={handleError}
      onReset={handleReset}
      fallbackRender={({ resetErrorBoundary }: FallbackProps) => (
        <div role="alert">
          <p>Something went wrong</p>
          <p>
            Attempt {retryCount + 1} of {maxRetries}
          </p>
          <button onClick={resetErrorBoundary}>Try again</button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
```

**Why good:** the count lives outside the boundary, so it survives the reset the boundary performs;
telling the user which attempt they are on is what makes the eventual escalation read as reasonable.

---

## Pattern 9: Exponential backoff

Immediate retries against a struggling server are the retry storm that keeps it struggling. Double
the wait each attempt and cap it.

```typescript
import { useState, useCallback, useRef, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculateDelay = useCallback(
    (attempt: number) => Math.min(baseDelayMs * 2 ** attempt, maxDelayMs),
    [baseDelayMs, maxDelayMs],
  );

  const handleRetry = useCallback(
    (resetErrorBoundary: () => void) => {
      setIsWaiting(true);
      timeoutRef.current = setTimeout(() => {
        setIsWaiting(false);
        setRetryCount((previous) => previous + 1);
        resetErrorBoundary();
      }, calculateDelay(retryCount));
    },
    [retryCount, calculateDelay],
  );

  if (retryCount >= maxRetries) {
    return (
      <div role="alert">
        <h3>Maximum retries reached</h3>
        <button onClick={() => window.location.reload()}>Refresh page</button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }: FallbackProps) => {
        const waitSeconds = Math.round(calculateDelay(retryCount) / 1_000);

        return (
          <div role="alert">
            <p>Something went wrong: {error.message}</p>
            <p>
              Retry {retryCount + 1} of {maxRetries}
            </p>
            {isWaiting ? (
              <p>Retrying in {waitSeconds} seconds…</p>
            ) : (
              <button onClick={() => handleRetry(resetErrorBoundary)}>
                Retry (wait {waitSeconds}s)
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

**Why good:** the wait is shown before it is spent, so the delay reads as deliberate rather than as
the page hanging; the cap stops the sixth attempt landing half a minute out.

---

## Pattern 10: Classifying the error

One fallback for every failure means the retry button appears on errors retrying cannot fix. Classify
first, then choose the recovery the class allows.

```typescript
interface HttpError extends Error {
  status: number;
  statusText: string;
}

export function isHttpError(error: Error): error is HttpError {
  return "status" in error && typeof (error as HttpError).status === "number";
}

export type HttpErrorCategory =
  | "client-error"
  | "server-error"
  | "network-error"
  | "timeout-error";

export interface CategorizedHttpError {
  category: HttpErrorCategory;
  retryable: boolean;
  userMessage: string;
  technicalDetails: string;
}

const RATE_LIMIT_STATUS = 429;
const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  400: "Invalid request. Please check your input.",
  401: "Please log in to continue.",
  403: "You do not have permission to access this.",
  404: "The requested resource was not found.",
  422: "The submitted data is invalid.",
  429: "Too many requests. Please wait a moment.",
};

export function categorizeHttpError(error: Error): CategorizedHttpError {
  if (!isHttpError(error)) {
    if (error.name === "AbortError" || error.message.includes("timeout")) {
      return {
        category: "timeout-error",
        retryable: true,
        userMessage: "Request timed out. Please try again.",
        technicalDetails: error.message,
      };
    }

    return {
      category: "network-error",
      retryable: true,
      userMessage: "Unable to connect. Please check your internet connection.",
      technicalDetails: error.message,
    };
  }

  const { status, statusText } = error;
  const technicalDetails = `HTTP ${status}: ${statusText}`;

  if (status >= 500) {
    return {
      category: "server-error",
      retryable: true,
      userMessage: "Server error. Please try again in a moment.",
      technicalDetails,
    };
  }

  return {
    category: "client-error",
    // A rate limit is the only 4xx that the same request can clear
    retryable: status === RATE_LIMIT_STATUS,
    userMessage:
      CLIENT_ERROR_MESSAGES[status] ?? `Request failed: ${statusText}`,
    technicalDetails,
  };
}
```

**Why good:** `retryable` is derived once, from the status rather than from the wording of a message;
the user-facing string and the technical one are separate fields, so neither has to serve both
audiences.

```typescript
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";
import { categorizeHttpError } from "./error-classification";

const isDevelopment = process.env.NODE_ENV !== "production";

function ClassifiedFallback({ error, resetErrorBoundary }: FallbackProps) {
  const { category, retryable, userMessage, technicalDetails } = categorizeHttpError(error);

  return (
    <div role="alert">
      <p>{userMessage}</p>
      {isDevelopment && (
        <details>
          <summary>Technical details</summary>
          <pre>{technicalDetails}</pre>
        </details>
      )}
      {retryable && <button onClick={resetErrorBoundary}>Try again</button>}
      {category === "client-error" && <a href="/login">Log in again</a>}
    </div>
  );
}
```

**Why good:** the retry button is absent on failures a retry cannot fix, which is the difference
between an honest fallback and one that invites the user to press a button five times.

**Retrying without being asked:** a `retryable` classification can also drive the first attempt or
two automatically, combining this with the count from Pattern 8. Schedule that retry from an effect
in the fallback, never from its render — calling `setTimeout` and `setState` while rendering is the
phase violation `getDerivedStateFromError` exists to avoid, and it fires again on every render the
fallback performs. Tell the user it is happening; a fallback that silently reloads itself reads as a
flicker.
