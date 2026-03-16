---
name: web-error-handling-error-boundaries
description: Error boundary patterns, fallback UI, reset/retry, react-error-boundary library, React 19 createRoot error hooks
---

# React Error Boundaries

> **Quick Guide:** Error boundaries catch JavaScript errors in component trees and display fallback UI. Use `react-error-boundary` library (v6+) for production apps. Place boundaries strategically around features, not just root. Boundaries do NOT catch event handler, async, or SSR errors -- use `showBoundary()` hook for async. **React 19+**: Use `createRoot` options (`onCaughtError`, `onUncaughtError`, `onRecoverableError`) for centralized error logging.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `getDerivedStateFromError` for rendering fallback UI - it runs during render phase)**

**(You MUST use `componentDidCatch` for side effects like logging - it runs during commit phase)**

**(You MUST wrap error boundaries around feature sections, not just the app root)**

**(You MUST provide reset/retry functionality for recoverable errors)**

**(You MUST use `role="alert"` on fallback UI for accessibility)**

</critical_requirements>

---

**Auto-detection:** error boundary, ErrorBoundary, getDerivedStateFromError, componentDidCatch, fallback UI, react-error-boundary, useErrorBoundary, showBoundary, error recovery, error fallback, onCaughtError, onUncaughtError, onRecoverableError, captureOwnerStack, FallbackProps, resetKeys

**When to use:**

- Catching and displaying fallback UI for render errors
- Implementing retry/reset functionality after errors
- Preventing entire app crashes from component failures
- Creating isolated failure domains for different features

**Key patterns covered:**

- Class-based error boundary implementation
- `react-error-boundary` library patterns (v6+)
- `useErrorBoundary` hook with `showBoundary()` for async errors
- Fallback UI with reset functionality and `role="alert"`
- Strategic boundary placement (granular vs coarse)
- `resetKeys` for automatic boundary reset
- **React 19+**: `createRoot` error options for centralized logging
- **React 19+**: `captureOwnerStack()` for enhanced debugging

**When NOT to use:**

- Event handler errors (use try/catch)
- Async code errors outside components (use try/catch or showBoundary)
- Server-side rendering errors (handle at framework level)
- API request errors (handle in your data fetching layer)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Complete boundary implementations, library usage, granular placement
- [examples/react-19-hooks.md](examples/react-19-hooks.md) - createRoot error options, captureOwnerStack, error filtering
- [examples/recovery.md](examples/recovery.md) - Retry limits, exponential backoff, error classification
- [examples/testing.md](examples/testing.md) - Testing boundaries, async errors, resetKeys
- [reference.md](reference.md) - Decision frameworks, anti-patterns, checklists

---

<philosophy>

## Philosophy

Error boundaries provide **graceful degradation** -- when one component fails, the rest of the application continues working. The key principle is **isolation**: wrap distinct features in separate boundaries so failures are contained. Error boundaries are the ONLY way to catch errors during React rendering; they complement try/catch for imperative code.

**Core principles:**

1. **Isolation over global handling** - Multiple granular boundaries beat one root boundary
2. **Recovery over failure** - Provide reset/retry when possible
3. **User feedback over silent failure** - Show meaningful, accessible fallback UI
4. **Logging integration** - Pass errors to monitoring via `onError` callback
5. **Centralized observability (React 19+)** - Use `createRoot` error options for unified error tracking

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Class-Based Error Boundary (Native React)

Error boundaries MUST be class components -- `getDerivedStateFromError` and `componentDidCatch` have no hook equivalents.

#### Two Lifecycle Methods

| Method                     | Phase  | Purpose                       | Side Effects |
| -------------------------- | ------ | ----------------------------- | ------------ |
| `getDerivedStateFromError` | Render | Update state to show fallback | NOT allowed  |
| `componentDidCatch`        | Commit | Log errors, call callbacks    | Allowed      |

```typescript
// ✅ Good - Complete error boundary with reset
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (typeof fallback === "function") return fallback(error, this.handleReset);
      if (fallback) return fallback;
      return (
        <div role="alert">
          <h2>Something went wrong</h2>
          <button onClick={this.handleReset}>Try again</button>
        </div>
      );
    }
    return children;
  }
}
```

**Why good:** Render-phase/commit-phase separation, reset capability, flexible fallback API, onError enables logging without coupling to specific tools

---

### Pattern 2: react-error-boundary Library (v6+)

Production-ready error boundary with hooks support, resetKeys, and `useErrorBoundary`.

```bash
npm install react-error-boundary
```

| Prop                | Type                    | Purpose                         |
| ------------------- | ----------------------- | ------------------------------- |
| `fallback`          | `ReactNode`             | Static fallback UI              |
| `FallbackComponent` | `ComponentType`         | Component that renders fallback |
| `fallbackRender`    | `(props) => ReactNode`  | Render prop for fallback        |
| `onError`           | `(error, info) => void` | Error logging callback          |
| `onReset`           | `(details) => void`     | Called when boundary resets     |
| `resetKeys`         | `unknown[]`             | Dependencies that trigger reset |

```typescript
// ✅ Good - FallbackComponent pattern
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        // Send to your error monitoring service
        console.error("Boundary caught:", error, info);
      }}
    >
      <Dashboard />
    </ErrorBoundary>
  );
}
```

**Why good:** Reusable FallbackComponent, onError decouples logging, onReset enables state cleanup

> See [examples/core.md](examples/core.md) for resetKeys, useErrorBoundary, and granular placement examples.

---

### Pattern 3: useErrorBoundary Hook (Async Errors)

Error boundaries don't catch async errors. Use `showBoundary()` from `useErrorBoundary` to manually trigger the nearest boundary.

```typescript
// ❌ This async error is NOT caught by error boundary
async function handleClick() {
  throw new Error("API failed"); // Lost - boundary doesn't see it
}
```

```typescript
// ✅ Good - showBoundary propagates async errors
import { useErrorBoundary } from "react-error-boundary";

function DataLoader() {
  const { showBoundary } = useErrorBoundary();

  const handleLoadData = async () => {
    try {
      const response = await fetch("/api/data");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // ... handle success
    } catch (error) {
      showBoundary(error); // Manually trigger nearest boundary
    }
  };

  return <button onClick={handleLoadData}>Load Data</button>;
}
```

**Why good:** Propagates async errors to boundary, consistent error UI across sync/async failures

**Use showBoundary for:** Async operations, event handlers, effects that should show fallback UI on failure.
**Do NOT use for:** Errors handled locally with inline UI, validation errors needing field-level feedback.

---

### Pattern 4: resetKeys for Automatic Reset

Use `resetKeys` to auto-reset the boundary when certain values change (e.g., route, selected item).

```typescript
// ✅ Good - Reset boundary on route change
<ErrorBoundary
  FallbackComponent={ErrorFallback}
  resetKeys={[location.pathname]}
>
  <Routes />
</ErrorBoundary>
```

| Pattern        | Use Case                          |
| -------------- | --------------------------------- |
| `[pathname]`   | Reset on route change             |
| `[selectedId]` | Reset when viewing different item |
| `[retryCount]` | Reset after programmatic retry    |

**Gotcha:** `resetKeys` comparison is shallow -- objects/arrays need stable references.

---

### Pattern 5: Granular Boundary Placement

```
App
├─ ErrorBoundary (root - last-resort catch-all)
│   ├─ Header
│   ├─ ErrorBoundary (sidebar)
│   │   └─ Sidebar
│   ├─ ErrorBoundary (main content)
│   │   ├─ ErrorBoundary (widget A)
│   │   │   └─ ChartWidget
│   │   └─ ErrorBoundary (widget B)
│   │       └─ TableWidget
│   └─ Footer
```

```typescript
// ✅ Good - Granular boundaries isolate failures
function Dashboard() {
  return (
    <div>
      <ErrorBoundary fallback={<div>Chart unavailable</div>} onError={logError}>
        <ChartWidget />
      </ErrorBoundary>
      <ErrorBoundary fallback={<div>Table unavailable</div>} onError={logError}>
        <DataTable />
      </ErrorBoundary>
    </div>
  );
}
```

**Why good:** One widget failing doesn't crash the dashboard, each feature has contextual fallback

```typescript
// ❌ Bad - Single boundary for everything
<ErrorBoundary fallback={<div>Dashboard error</div>}>
  <ChartWidget />
  <DataTable />
  <StatsPanel />
</ErrorBoundary>
```

**Why bad:** One failing widget crashes entire dashboard, users lose access to working features

---

### Pattern 6: Fallback UI

Fallback UI must include `role="alert"` for accessibility, retry button for recovery, and hide error details in production.

```typescript
// ✅ Good - Environment-aware fallback with accessibility
function DetailedFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isDev = process.env.NODE_ENV === "development";
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      {isDev && (
        <details>
          <summary>Error details</summary>
          <pre>{error.message}</pre>
        </details>
      )}
      <button onClick={resetErrorBoundary}>Try again</button>
      <button onClick={() => window.location.reload()}>Refresh page</button>
    </div>
  );
}
```

**Why good:** `role="alert"` announces to screen readers, dev-only details, multiple recovery options

```typescript
// ❌ Bad - Missing accessibility, raw errors in production
<div>
  <pre>{error.stack}</pre>
  <span onClick={reset}>Retry</span> {/* Not keyboard accessible */}
</div>
```

**Why bad:** No `role="alert"`, exposes internals to users, `span` not keyboard-accessible

---

### Pattern 7: React 19+ createRoot Error Options

React 19 adds three root-level error handlers for centralized logging. These complement (not replace) ErrorBoundary components.

| Handler              | When Called                      | Use Case                                  |
| -------------------- | -------------------------------- | ----------------------------------------- |
| `onCaughtError`      | Error caught by an ErrorBoundary | Log handled errors                        |
| `onUncaughtError`    | Error NOT caught by any boundary | Log fatal errors                          |
| `onRecoverableError` | React auto-recovers from error   | Log hydration mismatches, suspense errors |

```typescript
// ✅ Good - Centralized error logging with createRoot
import { createRoot } from "react-dom/client";

const ROOT_ELEMENT_ID = "root";
const container = document.getElementById(ROOT_ELEMENT_ID);
if (!container) throw new Error("Root element not found");

const root = createRoot(container, {
  onCaughtError: (error, errorInfo) => {
    reportToMonitoring("caught", error, errorInfo.componentStack);
  },
  onUncaughtError: (error, errorInfo) => {
    reportToMonitoring("uncaught", error, errorInfo.componentStack);
  },
  onRecoverableError: (error, errorInfo) => {
    reportToMonitoring("recoverable", error, errorInfo.componentStack);
  },
});
root.render(<App />);
```

**Why good:** Single configuration point for all React error logging, catches errors that escape all boundaries

> See [examples/react-19-hooks.md](examples/react-19-hooks.md) for `captureOwnerStack()`, error filtering, and hydrateRoot patterns.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority:**

- Missing error boundaries entirely -- app crashes on any render error
- Single root boundary only -- no isolation between features
- No reset/retry functionality -- users must refresh page
- Missing `role="alert"` on fallback -- screen readers don't announce errors
- Side effects in `getDerivedStateFromError` -- violates React phase rules

**Medium Priority:**

- Not using `showBoundary()` for async errors -- they silently fail
- Same fallback for all boundaries -- no context about what failed
- No `onError` callback -- errors not reported to monitoring
- Overly granular boundaries (every component) -- unnecessary overhead

**Gotchas & Edge Cases:**

- `getDerivedStateFromError` runs during render -- no side effects allowed
- Error boundaries don't catch errors in **themselves** -- only children
- Nested boundaries: **innermost** boundary catches first
- Hot reload can trigger boundaries in development (expected behavior)
- `resetKeys` comparison is shallow -- objects/arrays need stable references
- SSR hydration errors may not be caught by client-side boundaries
- **React 19:** `captureOwnerStack()` returns `null` in production
- **React 19:** `onCaughtError` runs AFTER boundary's `componentDidCatch`, not before
- **React 19:** `onRecoverableError` may have `error.cause` with the original thrown error
- **React 19:** These options are silently ignored on React 18

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `getDerivedStateFromError` for rendering fallback UI - it runs during render phase)**

**(You MUST use `componentDidCatch` for side effects like logging - it runs during commit phase)**

**(You MUST wrap error boundaries around feature sections, not just the app root)**

**(You MUST provide reset/retry functionality for recoverable errors)**

**(You MUST use `role="alert"` on fallback UI for accessibility)**

**Failure to follow these rules will result in poor error handling, inaccessible UIs, or unrecoverable error states.**

</critical_reminders>
