# Error Handling and Monitoring Best Practices

> Research document for creating atomic skills around error handling patterns.

---

## Table of Contents

1. [Error Boundary Patterns (React)](#1-error-boundary-patterns-react)
2. [Global Error Handling](#2-global-error-handling)
3. [API Error Handling Patterns](#3-api-error-handling-patterns)
4. [User-Facing Error Messages](#4-user-facing-error-messages)
5. [Error Logging and Reporting](#5-error-logging-and-reporting)
6. [Retry Patterns](#6-retry-patterns)
7. [Graceful Degradation](#7-graceful-degradation)
8. [Offline Handling](#8-offline-handling)
9. [Error Recovery UI Patterns](#9-error-recovery-ui-patterns)
10. [TypeScript Error Handling](#10-typescript-error-handling-result-types-discriminated-unions)

---

## 1. Error Boundary Patterns (React)

### Core Patterns

Error boundaries are React class components that catch JavaScript errors in their child component tree, log those errors, and display a fallback UI.

#### Pattern 1A: Basic Error Boundary with Retry

```typescript
import { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to error tracking service
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });

    // Call optional callback
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

ErrorBoundary.displayName = "ErrorBoundary";
```

#### Pattern 1B: React Query Error Reset Boundary Integration

```typescript
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

export function QueryBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div role="alert">
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

#### Pattern 1C: Next.js App Router Global Error

```typescript
// app/global-error.tsx
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="global-error">
          <h1>Something went wrong!</h1>
          <p>We've been notified and are working on a fix.</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: No error boundary at all
function App() {
  return <MainContent />; // One error crashes entire app
}

// ANTI-PATTERN 2: Catching errors in render without boundary
function Component() {
  try {
    return <RiskyComponent />;
  } catch (e) {
    // This WON'T catch render errors!
    return <Fallback />;
  }
}

// ANTI-PATTERN 3: Single boundary at root only
function App() {
  return (
    <ErrorBoundary>
      <Header />
      <MainContent />
      <Footer />
    </ErrorBoundary>
  ); // Header error crashes entire page
}
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| Wrapping feature sections that can fail independently | For event handler errors (use try/catch) |
| Around data-fetching components | For async errors outside render |
| At route/page level for isolated failures | For server-side rendering errors |
| Around third-party components | For errors in static content |

---

## 2. Global Error Handling

### Core Patterns

#### Pattern 2A: Window Error Handler

```typescript
// lib/global-error-handler.ts
import * as Sentry from "@sentry/nextjs";

const IGNORED_ERRORS = [
  "ResizeObserver loop",
  "Script error.",
  "AbortError",
  "cancelled",
];

export function initGlobalErrorHandler() {
  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason;

    if (shouldIgnoreError(error)) {
      event.preventDefault();
      return;
    }

    Sentry.captureException(error, {
      tags: { type: "unhandledrejection" },
    });
  });

  // Uncaught errors
  window.addEventListener("error", (event) => {
    if (shouldIgnoreError(event.error || event.message)) {
      return;
    }

    Sentry.captureException(event.error || new Error(event.message), {
      tags: { type: "uncaught" },
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });
}

function shouldIgnoreError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return IGNORED_ERRORS.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}
```

#### Pattern 2B: Hono Global Error Handler Middleware

```typescript
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "@/lib/logger";

const HTTP_STATUS_INTERNAL_ERROR = 500;

export const globalErrorHandler = (err: Error, c: Context) => {
  const correlationId = c.get("correlationId") || "unknown";

  // Log with full context
  logger.error({
    correlationId,
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  }, "Unhandled error");

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json({
      error: "http_error",
      message: err.message,
      statusCode: err.status,
    }, err.status);
  }

  // Generic error response (don't leak internals)
  return c.json({
    error: "internal_error",
    message: "An unexpected error occurred",
    statusCode: HTTP_STATUS_INTERNAL_ERROR,
  }, HTTP_STATUS_INTERNAL_ERROR);
};

// Register in app
app.onError(globalErrorHandler);
```

#### Pattern 2C: Process-Level Error Handling (Node.js)

```typescript
// server/error-handlers.ts
import { logger } from "@/lib/logger";

export function initProcessErrorHandlers() {
  process.on("uncaughtException", (error) => {
    logger.fatal({ error: error.message, stack: error.stack }, "Uncaught exception");
    // Give time for logs to flush
    setTimeout(() => process.exit(1), 1000);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "Unhandled rejection");
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    // Cleanup connections, finish pending requests
  });
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Silent error swallowing
window.onerror = () => true; // Suppresses all errors!

// ANTI-PATTERN 2: No error filtering (alert fatigue)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // No beforeSend - sends EVERYTHING including expected errors
});

// ANTI-PATTERN 3: Synchronous exit on uncaught exception
process.on("uncaughtException", () => {
  process.exit(1); // Logs don't flush!
});
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| Setting up application infrastructure | Already have framework-level handling (Next.js) |
| Need centralized error filtering | For component-specific error handling |
| Collecting unhandled errors for monitoring | As replacement for proper try/catch |

---

## 3. API Error Handling Patterns

### Core Patterns

#### Pattern 3A: Standardized Error Response Schema

```typescript
import { z } from "zod";

// Define error codes as constants (not magic strings)
export const ErrorCodes = {
  VALIDATION_ERROR: "validation_error",
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  CONFLICT: "conflict",
  RATE_LIMITED: "rate_limited",
  INTERNAL_ERROR: "internal_error",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  details: z.any().optional(),
  correlationId: z.string().optional(),
}).openapi("ErrorResponse");

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

#### Pattern 3B: Route-Level Error Handler

```typescript
import type { Context } from "hono";
import { z } from "zod";

const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export function handleRouteError(error: unknown, c: Context): Response {
  const correlationId = c.get("correlationId");

  // Log with context
  console.error("Route error:", { error, correlationId, path: c.req.path });

  // Zod validation errors
  if (error instanceof z.ZodError) {
    return c.json({
      error: ErrorCodes.VALIDATION_ERROR,
      message: "Validation failed",
      statusCode: HTTP_STATUS_UNPROCESSABLE_ENTITY,
      details: error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
      correlationId,
    }, HTTP_STATUS_UNPROCESSABLE_ENTITY);
  }

  // Database constraint violations
  if (error instanceof Error && error.message.includes("unique constraint")) {
    return c.json({
      error: ErrorCodes.CONFLICT,
      message: "Resource already exists",
      statusCode: HTTP_STATUS_CONFLICT,
      correlationId,
    }, HTTP_STATUS_CONFLICT);
  }

  // Generic error
  return c.json({
    error: ErrorCodes.INTERNAL_ERROR,
    message: error instanceof Error ? error.message : "Unknown error",
    statusCode: HTTP_STATUS_INTERNAL_ERROR,
    correlationId,
  }, HTTP_STATUS_INTERNAL_ERROR);
}
```

#### Pattern 3C: Custom API Error Class

```typescript
// lib/errors.ts
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: ErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = "APIError";
  }

  static notFound(resource: string): APIError {
    return new APIError(
      `${resource} not found`,
      404,
      ErrorCodes.NOT_FOUND
    );
  }

  static unauthorized(message = "Authentication required"): APIError {
    return new APIError(message, 401, ErrorCodes.UNAUTHORIZED);
  }

  static forbidden(message = "Access denied"): APIError {
    return new APIError(message, 403, ErrorCodes.FORBIDDEN);
  }

  static validation(details: unknown): APIError {
    return new APIError(
      "Validation failed",
      422,
      ErrorCodes.VALIDATION_ERROR,
      details
    );
  }

  toJSON(): ErrorResponse {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}
```

#### Pattern 3D: Client-Side API Error Handling

```typescript
// lib/api-client.ts
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));

    switch (response.status) {
      case HTTP_STATUS_UNAUTHORIZED:
        // Redirect to login
        window.location.href = "/auth/sign-in";
        throw new APIError("Session expired", 401, "unauthorized");

      case HTTP_STATUS_FORBIDDEN:
        throw new APIError("Access denied", 403, "forbidden");

      case HTTP_STATUS_NOT_FOUND:
        throw new APIError(errorBody.message || "Resource not found", 404, "not_found");

      case HTTP_STATUS_TOO_MANY_REQUESTS:
        throw new APIError(
          `Rate limited. Retry after ${response.headers.get("Retry-After")}s`,
          429,
          "rate_limited"
        );

      default:
        throw new APIError(
          errorBody.message || "Request failed",
          response.status,
          "internal_error"
        );
    }
  }

  return response.json();
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Inconsistent error shapes
app.get("/a", () => c.json({ error: "failed" }, 500));
app.get("/b", () => c.json({ message: "error" }, 500));
app.get("/c", () => c.json({ err: { msg: "bad" }}, 500));

// ANTI-PATTERN 2: Leaking internal errors
return c.json({ error: err.stack }, 500); // Exposes internals!

// ANTI-PATTERN 3: Magic status codes
return c.json({ error: "Bad" }, 422); // What's 422?

// ANTI-PATTERN 4: Silent error swallowing
try {
  await riskyOperation();
} catch {} // What happened?
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| All API routes need consistent error format | Internal microservice communication (use structured errors) |
| Client needs to programmatically handle errors | Simple scripts or CLIs |
| Building public APIs | Prototyping (add later) |

---

## 4. User-Facing Error Messages

### Core Patterns

#### Pattern 4A: Error Message Mapping

```typescript
// lib/error-messages.ts
const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  invalid_credentials: "Incorrect email or password. Please try again.",
  session_expired: "Your session has expired. Please sign in again.",
  account_locked: "Account temporarily locked. Try again in 15 minutes.",

  // Validation errors
  validation_error: "Please check your input and try again.",
  email_invalid: "Please enter a valid email address.",
  password_too_short: "Password must be at least 8 characters.",

  // Resource errors
  not_found: "The requested resource could not be found.",
  conflict: "This resource already exists.",

  // Rate limiting
  rate_limited: "Too many requests. Please wait a moment and try again.",

  // Generic
  internal_error: "Something went wrong. Our team has been notified.",
  network_error: "Unable to connect. Please check your internet connection.",
};

export function getUserMessage(errorCode: string): string {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.internal_error;
}
```

#### Pattern 4B: Field-Level Validation Messages

```typescript
// components/form-field.tsx
import type { FieldError } from "react-hook-form";

const FIELD_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  email: {
    required: "Email is required",
    pattern: "Please enter a valid email address",
  },
  password: {
    required: "Password is required",
    minLength: "Password must be at least 8 characters",
    pattern: "Password must contain a number and special character",
  },
  name: {
    required: "Name is required",
    maxLength: "Name cannot exceed 100 characters",
  },
};

export function getFieldErrorMessage(
  fieldName: string,
  error: FieldError | undefined
): string | undefined {
  if (!error) return undefined;

  const fieldMessages = FIELD_ERROR_MESSAGES[fieldName];
  if (fieldMessages && error.type in fieldMessages) {
    return fieldMessages[error.type];
  }

  // Fallback to generic message
  return error.message || "Invalid input";
}
```

#### Pattern 4C: Toast Notifications for Async Errors

```typescript
// hooks/use-mutation-with-toast.ts
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { toast } from "@repo/ui/toast";

interface MutationMessages {
  loading?: string;
  success?: string;
  error?: string | ((error: Error) => string);
}

export function useMutationWithToast<TData, TVariables>(
  options: UseMutationOptions<TData, Error, TVariables>,
  messages: MutationMessages = {}
) {
  return useMutation({
    ...options,
    onMutate: async (variables) => {
      if (messages.loading) {
        toast.loading(messages.loading);
      }
      return options.onMutate?.(variables);
    },
    onSuccess: (data, variables, context) => {
      toast.dismiss();
      if (messages.success) {
        toast.success(messages.success);
      }
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      toast.dismiss();
      const errorMessage = typeof messages.error === "function"
        ? messages.error(error)
        : messages.error || getUserMessage(error.message);
      toast.error(errorMessage);
      options.onError?.(error, variables, context);
    },
  });
}

// Usage
const { mutate } = useMutationWithToast(
  { mutationFn: createJob },
  {
    loading: "Creating job...",
    success: "Job created successfully!",
    error: (err) => `Failed to create job: ${getUserMessage(err.message)}`,
  }
);
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Technical jargon
toast.error("ECONNREFUSED: Connection refused at 127.0.0.1:5432");

// ANTI-PATTERN 2: Exposing internal details
toast.error(`SQL Error: duplicate key violates unique constraint "users_email_key"`);

// ANTI-PATTERN 3: Generic unhelpful messages
toast.error("Error"); // What error?

// ANTI-PATTERN 4: Blaming the user
toast.error("You made an error"); // Don't blame!
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| Displaying errors to end users | Logging for developers |
| Form validation feedback | Server-side error handling |
| API error responses need human text | Internal error propagation |

---

## 5. Error Logging and Reporting

### Core Patterns

#### Pattern 5A: Structured Logging with Context

```typescript
// lib/logger.ts
import pino from "pino";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level: LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["password", "token", "apiKey", "secret", "authorization"],
    censor: "[REDACTED]",
  },
});

// Create child logger with request context
export function createRequestLogger(correlationId: string, userId?: string) {
  return logger.child({
    correlationId,
    userId,
    service: "api",
  });
}
```

#### Pattern 5B: Error Context Enrichment

```typescript
// middleware/request-logger.ts
import type { Context, Next } from "hono";
import { logger, createRequestLogger } from "@/lib/logger";

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export const requestLoggerMiddleware = async (c: Context, next: Next) => {
  const correlationId = c.get("correlationId");
  const userId = c.get("userId");
  const log = createRequestLogger(correlationId, userId);

  const startTime = performance.now();

  log.info({
    event: "request_start",
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header("user-agent"),
  });

  await next();

  const duration = Math.round(performance.now() - startTime);
  const status = c.res.status;

  const logData = {
    event: "request_end",
    method: c.req.method,
    path: c.req.path,
    status,
    duration,
  };

  if (status >= HTTP_STATUS_INTERNAL_ERROR) {
    log.error(logData);
  } else if (status >= HTTP_STATUS_BAD_REQUEST) {
    log.warn(logData);
  } else {
    log.info(logData);
  }
};
```

#### Pattern 5C: Sentry Configuration with Filtering

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

const IGNORED_ERRORS = [
  "AbortError",
  "cancelled",
  "Failed to fetch",
  "NetworkError",
  "ResizeObserver loop",
  "Script error.",
];

const IGNORED_STATUS_CODES = [401, 403, 404];

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  beforeSend(event, hint) {
    const error = hint.originalException;

    // Filter known non-errors
    if (error instanceof Error) {
      const isIgnored = IGNORED_ERRORS.some((pattern) =>
        error.message.toLowerCase().includes(pattern.toLowerCase())
      );
      if (isIgnored) return null;
    }

    // Filter expected HTTP status codes
    const statusCode = event.contexts?.response?.status_code;
    if (statusCode && IGNORED_STATUS_CODES.includes(statusCode)) {
      return null;
    }

    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    // Filter noisy console.log breadcrumbs
    if (breadcrumb.category === "console" && breadcrumb.level === "log") {
      return null;
    }
    return breadcrumb;
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

#### Pattern 5D: Error Tracking User Context

```typescript
// lib/sentry-user.ts
import * as Sentry from "@sentry/nextjs";

interface User {
  id: string;
  email: string;
  name?: string;
  subscriptionTier?: string;
}

export function setSentryUser(user: User) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
    subscription: user.subscriptionTier,
  });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export function setSentryContext(key: string, data: Record<string, unknown>) {
  Sentry.setContext(key, data);
}

// Usage in auth flow
useEffect(() => {
  if (isAuthenticated && user) {
    setSentryUser(user);
  } else {
    clearSentryUser();
  }
}, [isAuthenticated, user]);
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Unstructured logging
console.log("Error:", error); // Can't search or filter

// ANTI-PATTERN 2: Logging sensitive data
logger.info({ user: { password: "secret123" } }); // PII leak!

// ANTI-PATTERN 3: No context
logger.error("Something failed"); // What failed? Where?

// ANTI-PATTERN 4: Wrong log levels
logger.error("User logged in"); // This is info, not error!

// ANTI-PATTERN 5: No error filtering in Sentry
Sentry.init({ dsn: "..." }); // Sends EVERYTHING
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| All production applications | Local development only scripts |
| Need to debug distributed systems | Simple synchronous programs |
| Regulatory compliance requires audit trails | Prototyping |

---

## 6. Retry Patterns

### Core Patterns

#### Pattern 6A: Exponential Backoff with Jitter

```typescript
// lib/retry.ts
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const EXPONENTIAL_BASE = 2;

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelay = INITIAL_DELAY_MS,
    maxDelay = MAX_DELAY_MS,
    shouldRetry = isRetryableError,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries || !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      onRetry?.(lastError, attempt);

      // Exponential backoff with jitter
      const baseDelay = Math.min(
        initialDelay * EXPONENTIAL_BASE ** attempt,
        maxDelay
      );
      const jitter = Math.random() * baseDelay * 0.1;
      const delay = baseDelay + jitter;

      await sleep(delay);
    }
  }

  throw lastError!;
}

function isRetryableError(error: Error): boolean {
  // Network errors
  if (error.name === "TypeError" && error.message.includes("fetch")) {
    return true;
  }
  // Rate limiting
  if (error.message.includes("429") || error.message.includes("rate limit")) {
    return true;
  }
  // Server errors (5xx)
  if (/5\d{2}/.test(error.message)) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

#### Pattern 6B: React Query Retry Configuration

```typescript
// lib/query-provider.tsx
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const EXPONENTIAL_BASE = 2;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry 4xx errors (client errors)
        if (error instanceof Error && /4\d{2}/.test(error.message)) {
          return false;
        }
        return failureCount < MAX_RETRY_ATTEMPTS;
      },
      retryDelay: (attemptIndex) =>
        Math.min(
          INITIAL_RETRY_DELAY_MS * EXPONENTIAL_BASE ** attemptIndex,
          MAX_RETRY_DELAY_MS
        ),
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});
```

#### Pattern 6C: Abort Controller with Timeout

```typescript
// lib/fetch-with-timeout.ts
const DEFAULT_TIMEOUT_MS = 10000;

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number }
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchInit } = init || {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(input, {
    ...fetchInit,
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}
```

#### Pattern 6D: Circuit Breaker Pattern

```typescript
// lib/circuit-breaker.ts
const FAILURE_THRESHOLD = 5;
const RECOVERY_TIMEOUT_MS = 30000;

type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureTime = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > RECOVERY_TIMEOUT_MS) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= FAILURE_THRESHOLD) {
      this.state = "open";
    }
  }
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Infinite retries
while (true) {
  try { return await fn(); }
  catch { /* retry forever */ }
}

// ANTI-PATTERN 2: No backoff
for (let i = 0; i < 3; i++) {
  try { return await fn(); }
  catch { /* immediate retry */ }
}

// ANTI-PATTERN 3: Retrying non-idempotent operations
retryMutation(() => createUser(data)); // May create duplicates!

// ANTI-PATTERN 4: No jitter (thundering herd)
const delay = 1000 * 2 ** attempt; // All clients retry at same time
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| Network requests that may fail transiently | Non-idempotent mutations (POST without idempotency key) |
| External service calls | Local operations |
| Rate-limited APIs | Client validation errors (4xx) |
| Database connection failures | Business logic errors |

---

## 7. Graceful Degradation

### Core Patterns

#### Pattern 7A: Feature Flags for Degradation

```typescript
// lib/feature-degradation.ts
import { posthog } from "@/lib/posthog";

export function isFeatureHealthy(featureName: string): boolean {
  // Check PostHog feature flag for manual degradation
  return posthog.isFeatureEnabled(`${featureName}_enabled`) ?? true;
}

export function withDegradation<T>(
  primary: () => Promise<T>,
  fallback: () => T,
  featureName: string
): Promise<T> {
  if (!isFeatureHealthy(featureName)) {
    return Promise.resolve(fallback());
  }

  return primary().catch(() => fallback());
}

// Usage
const recommendations = await withDegradation(
  () => fetchRecommendations(userId),
  () => DEFAULT_RECOMMENDATIONS,
  "recommendations"
);
```

#### Pattern 7B: Fallback UI Components

```typescript
// components/async-content.tsx
interface AsyncContentProps<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  children: (data: T) => ReactNode;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode | ((error: Error) => ReactNode);
  emptyFallback?: ReactNode;
}

export function AsyncContent<T>({
  data,
  isLoading,
  error,
  children,
  loadingFallback = <Skeleton />,
  errorFallback,
  emptyFallback = <EmptyState />,
}: AsyncContentProps<T>) {
  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (error) {
    if (typeof errorFallback === "function") {
      return <>{errorFallback(error)}</>;
    }
    return <>{errorFallback || <DefaultErrorFallback error={error} />}</>;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return <>{emptyFallback}</>;
  }

  return <>{children(data)}</>;
}
```

#### Pattern 7C: Service Health Checks

```typescript
// lib/health-check.ts
const HEALTH_CHECK_TIMEOUT_MS = 5000;

interface ServiceHealth {
  database: "connected" | "disconnected" | "degraded";
  cache: "connected" | "disconnected" | "degraded";
  external: "connected" | "disconnected" | "degraded";
}

export async function checkServiceHealth(): Promise<ServiceHealth> {
  const [dbHealth, cacheHealth, externalHealth] = await Promise.allSettled([
    checkDatabaseHealth(),
    checkCacheHealth(),
    checkExternalServiceHealth(),
  ]);

  return {
    database: dbHealth.status === "fulfilled" ? dbHealth.value : "disconnected",
    cache: cacheHealth.status === "fulfilled" ? cacheHealth.value : "disconnected",
    external: externalHealth.status === "fulfilled" ? externalHealth.value : "disconnected",
  };
}

async function checkDatabaseHealth(): Promise<"connected" | "degraded"> {
  const start = Date.now();
  await db.execute("SELECT 1");
  const latency = Date.now() - start;
  return latency > HEALTH_CHECK_TIMEOUT_MS / 2 ? "degraded" : "connected";
}
```

#### Pattern 7D: Cache-First with Stale Data

```typescript
// hooks/use-cache-first.ts
const STALE_WHILE_REVALIDATE_MS = 60000;

export function useCacheFirst<T>(
  queryKey: string[],
  fetcher: () => Promise<T>,
  options: { staleTime?: number } = {}
) {
  const { staleTime = STALE_WHILE_REVALIDATE_MS } = options;

  return useQuery({
    queryKey,
    queryFn: fetcher,
    staleTime,
    // Return stale data while fetching new
    placeholderData: (previousData) => previousData,
    // Don't show error if we have stale data
    useErrorBoundary: (error, query) => !query.state.data,
  });
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: All-or-nothing rendering
if (error) {
  return <FullPageError />; // Entire page blank
}

// ANTI-PATTERN 2: No fallback for optional features
const { data: recommendations } = useQuery(/*...*/);
return <Sidebar>{recommendations.map(/*...*/)}</Sidebar>; // Crashes if undefined

// ANTI-PATTERN 3: Hiding errors completely
try {
  return await primaryService();
} catch {
  return null; // User sees nothing, no indication of issue
}
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| Non-critical features can fail independently | Critical functionality must work |
| Default/cached data is acceptable | Fresh data is required |
| User can complete task without feature | Feature is core to user journey |

---

## 8. Offline Handling

### Core Patterns

#### Pattern 8A: Network Status Detection

```typescript
// hooks/use-network-status.ts
import { useState, useEffect } from "react";

interface NetworkStatus {
  isOnline: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  }));

  useEffect(() => {
    const updateStatus = () => {
      const connection = (navigator as any).connection;
      setStatus({
        isOnline: navigator.onLine,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
      });
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    const connection = (navigator as any).connection;
    connection?.addEventListener("change", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      connection?.removeEventListener("change", updateStatus);
    };
  }, []);

  return status;
}
```

#### Pattern 8B: Offline Banner Component

```typescript
// components/offline-banner.tsx
import { useNetworkStatus } from "@/hooks/use-network-status";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="offline-banner"
    >
      <span>You're offline. Some features may be unavailable.</span>
    </div>
  );
}
```

#### Pattern 8C: Optimistic Updates with Offline Queue

```typescript
// lib/offline-queue.ts
interface QueuedMutation {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

const STORAGE_KEY = "offline_mutation_queue";

export function queueMutation(mutation: Omit<QueuedMutation, "id" | "timestamp">) {
  const queue = getQueue();
  const newMutation: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  queue.push(newMutation);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function getQueue(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export async function flushQueue(): Promise<void> {
  const queue = getQueue();

  for (const mutation of queue) {
    try {
      await processMutation(mutation);
      removeFromQueue(mutation.id);
    } catch (error) {
      console.error("Failed to process queued mutation:", mutation.id);
      break; // Stop on first failure to maintain order
    }
  }
}

// Auto-flush when coming back online
window.addEventListener("online", () => {
  flushQueue();
});
```

#### Pattern 8D: React Query Offline Configuration

```typescript
// lib/query-client.ts
import { onlineManager, QueryClient } from "@tanstack/react-query";

// Sync with browser online status
onlineManager.setEventListener((setOnline) => {
  const handleOnline = () => setOnline(true);
  const handleOffline = () => setOnline(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Use stale data when offline
      networkMode: "offlineFirst",
      // Keep data cached for offline use
      gcTime: Infinity,
    },
    mutations: {
      // Pause mutations when offline
      networkMode: "offlineFirst",
    },
  },
});
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: No offline detection
const { data } = useQuery({ queryFn: fetchData });
// User sees loading spinner forever when offline

// ANTI-PATTERN 2: Losing user input
async function saveForm(data) {
  await api.save(data); // Throws when offline, data lost!
}

// ANTI-PATTERN 3: No feedback
try {
  await submitForm();
} catch {
  // Silent failure, user doesn't know it didn't save
}
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| Mobile-first applications | Real-time collaboration features |
| Form submissions that can be queued | Transactions requiring server validation |
| Read-heavy applications with cacheable data | Highly dynamic/time-sensitive data |

---

## 9. Error Recovery UI Patterns

### Core Patterns

#### Pattern 9A: Error State with Retry Action

```typescript
// components/error-state.tsx
interface ErrorStateProps {
  error: Error;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
  retryLabel = "Try again",
}: ErrorStateProps) {
  return (
    <div role="alert" className="error-state">
      <AlertCircle className="error-icon" aria-hidden />
      <h3>{title}</h3>
      <p>{getUserMessage(error.message)}</p>
      {onRetry && (
        <button onClick={onRetry} type="button">
          <RefreshCw aria-hidden />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
```

#### Pattern 9B: Inline Error with Dismiss

```typescript
// components/inline-error.tsx
interface InlineErrorProps {
  error: Error | null;
  onDismiss?: () => void;
  className?: string;
}

export function InlineError({ error, onDismiss, className }: InlineErrorProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={className}
    >
      <span>{getUserMessage(error.message)}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          type="button"
        >
          <X aria-hidden />
        </button>
      )}
    </div>
  );
}
```

#### Pattern 9C: Form Error Recovery

```typescript
// components/form-with-recovery.tsx
export function FormWithRecovery() {
  const [error, setError] = useState<Error | null>(null);
  const [savedData, setSavedData] = useState<FormData | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: submitForm,
    onError: (err, variables) => {
      setError(err);
      // Save form data for retry
      setSavedData(variables);
      // Also persist to localStorage in case user navigates away
      localStorage.setItem("form_draft", JSON.stringify(variables));
    },
    onSuccess: () => {
      setError(null);
      setSavedData(null);
      localStorage.removeItem("form_draft");
    },
  });

  const handleRetry = () => {
    if (savedData) {
      setError(null);
      mutate(savedData);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutate(formData); }}>
      {error && (
        <InlineError
          error={error}
          onDismiss={() => setError(null)}
        />
      )}
      {/* Form fields */}
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save"}
      </button>
      {error && savedData && (
        <button type="button" onClick={handleRetry}>
          Retry
        </button>
      )}
    </form>
  );
}
```

#### Pattern 9D: Progressive Error Escalation

```typescript
// components/data-loader.tsx
interface DataLoaderProps<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  children: (data: T) => ReactNode;
}

export function DataLoader<T>({
  queryKey,
  queryFn,
  children,
}: DataLoaderProps<T>) {
  const {
    data,
    error,
    isLoading,
    isError,
    refetch,
    failureCount,
  } = useQuery({
    queryKey,
    queryFn,
    retry: 3,
  });

  if (isLoading) {
    return <Skeleton />;
  }

  if (isError && failureCount < 3) {
    // Transient error - show inline retry
    return (
      <InlineError
        error={error}
        onRetry={refetch}
        message="Having trouble loading. Retrying..."
      />
    );
  }

  if (isError) {
    // Persistent error - show full error state
    return (
      <ErrorState
        error={error}
        title="Unable to load"
        onRetry={refetch}
        showContactSupport
      />
    );
  }

  return <>{children(data as T)}</>;
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: No recovery option
if (error) {
  return <p>Error!</p>; // User stuck, no way to retry
}

// ANTI-PATTERN 2: Full page error for partial failures
if (headerError || contentError || footerError) {
  return <FullPageError />; // Overkill - only one section failed
}

// ANTI-PATTERN 3: Losing user context on error
if (formError) {
  return <Navigate to="/error" />; // User loses all form progress!
}

// ANTI-PATTERN 4: Technical error messages
<ErrorState message={error.stack} /> // Users don't need stack traces
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| User can meaningfully retry the action | Error is unrecoverable |
| Error affects only part of the UI | Entire app is broken |
| User has invested effort (forms) | Quick read-only views |

---

## 10. TypeScript Error Handling (Result Types, Discriminated Unions)

### Core Patterns

#### Pattern 10A: Result Type (Either Pattern)

```typescript
// lib/result.ts
type Success<T> = {
  success: true;
  data: T;
};

type Failure<E> = {
  success: false;
  error: E;
};

export type Result<T, E = Error> = Success<T> | Failure<E>;

// Factory functions
export function ok<T>(data: T): Success<T> {
  return { success: true, data };
}

export function err<E>(error: E): Failure<E> {
  return { success: false, error };
}

// Usage
async function parseConfig(path: string): Promise<Result<Config, ConfigError>> {
  try {
    const content = await readFile(path);
    const config = JSON.parse(content);
    return ok(config);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return err({ code: "PARSE_ERROR", message: e.message });
    }
    return err({ code: "READ_ERROR", message: String(e) });
  }
}

// Consumer (type-safe!)
const result = await parseConfig("config.json");
if (result.success) {
  console.log(result.data.apiKey); // TypeScript knows data exists
} else {
  console.error(result.error.code); // TypeScript knows error exists
}
```

#### Pattern 10B: Discriminated Union for API Responses

```typescript
// types/api-response.ts
interface SuccessResponse<T> {
  status: "success";
  data: T;
}

interface ErrorResponse {
  status: "error";
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

interface LoadingResponse {
  status: "loading";
}

export type APIResponse<T> = SuccessResponse<T> | ErrorResponse | LoadingResponse;

// Usage with exhaustive checking
function renderResponse<T>(response: APIResponse<T>, render: (data: T) => ReactNode) {
  switch (response.status) {
    case "loading":
      return <Spinner />;
    case "error":
      return <ErrorDisplay error={response.error} />;
    case "success":
      return render(response.data);
    default:
      // TypeScript error if we miss a case
      const _exhaustive: never = response;
      return _exhaustive;
  }
}
```

#### Pattern 10C: Safe Async Operations

```typescript
// lib/safe-async.ts
type AsyncResult<T> = Promise<Result<T, Error>>;

export async function safeAsync<T>(
  fn: () => Promise<T>
): AsyncResult<T> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// Wrapper for fetch
export async function safeFetch<T>(
  url: string,
  options?: RequestInit
): AsyncResult<T> {
  return safeAsync(async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  });
}

// Usage
const result = await safeFetch<User>("/api/user/123");
if (!result.success) {
  console.error("Failed:", result.error.message);
  return;
}
console.log("User:", result.data.name);
```

#### Pattern 10D: Typed Error Codes

```typescript
// types/errors.ts
const ErrorCodes = {
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

interface TypedError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

// Exhaustive error handling
function handleError(error: TypedError): void {
  switch (error.code) {
    case ErrorCodes.VALIDATION:
      showValidationErrors(error.details);
      break;
    case ErrorCodes.NOT_FOUND:
      redirectTo404();
      break;
    case ErrorCodes.UNAUTHORIZED:
      redirectToLogin();
      break;
    case ErrorCodes.FORBIDDEN:
      showAccessDenied();
      break;
    case ErrorCodes.RATE_LIMITED:
      showRateLimitMessage();
      break;
    case ErrorCodes.INTERNAL:
      showGenericError();
      break;
    default:
      // TypeScript ensures we handle all cases
      const _exhaustive: never = error.code;
  }
}
```

#### Pattern 10E: Zod Parse Results

```typescript
// lib/validation.ts
import { z } from "zod";

export function safeParse<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): Result<z.infer<T>, z.ZodError> {
  const result = schema.safeParse(data);

  if (result.success) {
    return ok(result.data);
  }

  return err(result.error);
}

// Usage
const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const result = safeParse(UserSchema, formData);
if (!result.success) {
  // Type-safe access to Zod errors
  result.error.errors.forEach((err) => {
    console.log(`${err.path.join(".")}: ${err.message}`);
  });
  return;
}

// result.data is fully typed as { name: string; email: string }
createUser(result.data);
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Throwing when returning Result is better
function parseConfig(data: string): Config {
  try {
    return JSON.parse(data);
  } catch {
    throw new Error("Parse failed"); // Caller forced to try/catch
  }
}

// ANTI-PATTERN 2: Using any for error
function handleError(error: any) { // No type safety
  console.log(error.message); // Might crash if not Error
}

// ANTI-PATTERN 3: Non-exhaustive switch
switch (response.status) {
  case "success": return response.data;
  case "error": return null;
  // Missing "loading" case - no TypeScript error!
}

// ANTI-PATTERN 4: Magic strings for error codes
if (error.code === "not_found") { // Typo-prone
  // ...
}
```

### When to Use vs When Not to Use

| Use When | Don't Use When |
|----------|----------------|
| Function can fail in expected ways | Truly exceptional errors (out of memory) |
| Caller needs to handle different error cases | Simple operations unlikely to fail |
| Building library/SDK code | Internal helper functions |
| Want compile-time exhaustiveness checking | Quick prototyping |

---

## Summary: Decision Tree

```
Is it a render error?
├─ YES → Error Boundary
└─ NO → Is it an API error?
    ├─ YES → Is it client or server?
    │   ├─ CLIENT → Custom error class + type-safe handling
    │   └─ SERVER → Standardized error response schema
    └─ NO → Is the operation async?
        ├─ YES → Result type or try/catch with proper typing
        └─ NO → Discriminated union for state management
```

---

## References

- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- React Query Error Handling: https://tanstack.com/query/latest/docs/react/guides/query-errors
- Sentry JavaScript SDK: https://docs.sentry.io/platforms/javascript/
- Pino Logger: https://getpino.io/
- Zod Validation: https://zod.dev/
