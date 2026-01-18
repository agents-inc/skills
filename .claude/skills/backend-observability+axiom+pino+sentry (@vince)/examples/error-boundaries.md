# Observability - Sentry Error Boundaries

> React error boundary patterns with Sentry integration. Back to [SKILL.md](../SKILL.md) | See [core.md](core.md) for foundational patterns.

**Related**: See [sentry-config.md](sentry-config.md) for user context and error filtering.

---

## Pattern: Sentry Built-in ErrorBoundary (Recommended)

Use Sentry's built-in ErrorBoundary component for automatic error capturing.

```typescript
"use client";

import * as Sentry from "@sentry/nextjs";

export function JobsPage() {
  return (
    <div>
      <h1>Available Jobs</h1>
      <Sentry.ErrorBoundary
        fallback={({ error, resetError }) => (
          <div role="alert">
            <p>Failed to load jobs: {error.message}</p>
            <button onClick={resetError}>Retry</button>
          </div>
        )}
      >
        <JobList />
      </Sentry.ErrorBoundary>
    </div>
  );
}
```

**Why good:** Automatic error reporting to Sentry, built-in reset capability, properly typed fallback props

---

## Pattern: React 19+ Error Hooks (v8.6.0+)

React 19 exposes error hooks on `createRoot` and `hydrateRoot`. Use `Sentry.reactErrorHandler()` to capture errors at the root level.

**File: `apps/client-next/app/root.tsx`**

```typescript
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";

const container = document.getElementById("app");

const root = createRoot(container!, {
  // Errors NOT caught by any ErrorBoundary
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn("Uncaught error", error, errorInfo.componentStack);
  }),
  // Errors caught by an ErrorBoundary
  onCaughtError: Sentry.reactErrorHandler(),
  // Automatic recovery errors
  onRecoverableError: Sentry.reactErrorHandler(),
});

root.render(<App />);
```

**Why good:** Captures errors at React root level before they propagate, works with React 19's new error handling model, provides centralized error processing

**Note:** For finer-grained control, use only `onUncaughtError` and `onRecoverableError` at root level, then use ErrorBoundary components for caught errors.

---

## Pattern: Custom Error Boundary with captureReactException (v9.8.0+)

For custom error boundaries, use `Sentry.captureReactException` instead of `captureException` to get proper React component stack traces.

**File: `apps/client-next/components/error-boundary.tsx`**

```typescript
"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";

import type { ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // v9.8.0+: Use captureReactException for proper component stack
    Sentry.captureReactException(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.reset,
        });
      }

      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}

// Default fallback component
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

**Why good:** `captureReactException` (v9.8.0+) provides better React-specific error context than generic `captureException`, properly captures component stack for debugging

---

## Pattern: Global Error Handler for App Router

**File: `apps/client-next/app/global-error.tsx`**

```typescript
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
    // Report to Sentry
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

**Why good:** Class component required for error boundaries (hooks can't catch render errors), Sentry receives component stack for debugging, reset capability allows recovery, custom fallback prop enables branded error UI

---

## Pattern: Using Error Boundaries

```typescript
import { ErrorBoundary } from "@/components/error-boundary";
import { JobList } from "@/components/job-list";

export function JobsPage() {
  return (
    <div>
      <h1>Available Jobs</h1>
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <div>
            <p>Failed to load jobs: {error.message}</p>
            <button onClick={reset}>Retry</button>
          </div>
        )}
      >
        <JobList />
      </ErrorBoundary>
    </div>
  );
}
```

---

## Sentry SDK Version Reference

| Feature | Minimum Version | Notes |
|---------|-----------------|-------|
| `Sentry.ErrorBoundary` | v7.x | Built-in component |
| `reactErrorHandler()` | v8.6.0 | For React 19 hooks |
| `captureReactException()` | v9.8.0 | For custom boundaries |
| `onRequestError` | v8.28.0 | For Next.js 15 |

---

_See [core.md](core.md) for foundational patterns: Log Levels, Structured Logging._
