# Observability - Sentry Error Boundaries

> React error boundary patterns with Sentry integration. Back to [SKILL.md](../SKILL.md) | See [core.md](core.md) for foundational patterns.

**Related**: See [sentry-config.md](sentry-config.md) for user context and error filtering.

---

## Pattern: Error Boundary Component

**File: `apps/client-next/components/error-boundary.tsx`**

```typescript
"use client";

import { useEffect } from "react";
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
    // Report to Sentry with component stack
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
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

_See [core.md](core.md) for foundational patterns: Log Levels, Structured Logging._
