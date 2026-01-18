# Error Boundaries - React 19+ Error Hooks

> React 19 error handling patterns with `createRoot` options and `captureOwnerStack()`. See [core.md](core.md) for basic error boundary patterns.

**Prerequisites**: Understand basic error boundaries from [core.md](core.md) first. These patterns complement, not replace, error boundaries.

**React Version**: These patterns require React 19+.

---

## Pattern 1: createRoot Error Options

React 19 introduces three error handler options for `createRoot` and `hydrateRoot`. These provide centralized error logging separate from error boundary fallback UI.

### Three Error Handlers Explained

| Handler | Triggered When | Typical Action |
|---------|----------------|----------------|
| `onCaughtError` | Error caught by an ErrorBoundary | Log to monitoring, handled gracefully |
| `onUncaughtError` | Error NOT caught by any boundary | Log as fatal, show error overlay |
| `onRecoverableError` | React auto-recovers (hydration mismatch, suspended promise rejection) | Log warning, usually non-critical |

### Good Example - Complete Setup

```typescript
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

const ROOT_ELEMENT_ID = "root";

// Error logging function
function reportError(
  type: "caught" | "uncaught" | "recoverable",
  error: Error,
  errorInfo: { componentStack?: string | null }
) {
  const payload = {
    type,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  // Send to your error tracking service
  if (process.env.NODE_ENV === "production") {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Fail silently - don't let error reporting cause more errors
    });
  } else {
    console.group(`React ${type} error`);
    console.error("Error:", error);
    console.error("Component Stack:", errorInfo.componentStack);
    console.groupEnd();
  }
}

const container = document.getElementById(ROOT_ELEMENT_ID);
if (!container) {
  throw new Error(`Root element #${ROOT_ELEMENT_ID} not found`);
}

const root = createRoot(container, {
  // Called when an ErrorBoundary catches an error
  onCaughtError: (error, errorInfo) => {
    reportError("caught", error, errorInfo);
  },

  // Called when an error is NOT caught by any boundary
  onUncaughtError: (error, errorInfo) => {
    reportError("uncaught", error, errorInfo);
  },

  // Called when React auto-recovers from an error
  onRecoverableError: (error, errorInfo) => {
    reportError("recoverable", error, errorInfo);
  },
});

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Why good:** Centralized error reporting for all error types, different handling per error severity, production-safe with silent fallback for reporting failures, development-friendly console grouping

---

## Pattern 2: Integration with Sentry

Sentry SDK v8.6.0+ provides `reactErrorHandler()` for seamless integration.

### Good Example - Sentry Integration

```typescript
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { App } from "./app";

const ROOT_ELEMENT_ID = "root";
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

// Initialize Sentry first
Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

const container = document.getElementById(ROOT_ELEMENT_ID);
if (!container) throw new Error("Root element not found");

const root = createRoot(container, {
  // Sentry.reactErrorHandler() wraps your custom callback
  onCaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    // Optional: Add custom tags or context
    Sentry.setTag("error.type", "caught");
    console.warn("Error caught by boundary:", error.message);
  }),

  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    Sentry.setTag("error.type", "uncaught");
    Sentry.setTag("error.severity", "fatal");
    console.error("Uncaught error:", error.message);
  }),

  // No custom callback needed for recoverable errors
  onRecoverableError: Sentry.reactErrorHandler(),
});

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Why good:** `Sentry.reactErrorHandler()` automatically captures React-specific context, can wrap custom callbacks for additional handling, single configuration point for error monitoring

---

## Pattern 3: captureOwnerStack() for Enhanced Debugging

React 19 provides `captureOwnerStack()` to capture the "owner stack" - the chain of components that created the current element. Available only in development.

### Owner Stack vs Component Stack

| Stack Type | What It Shows | Example |
|------------|---------------|---------|
| Component Stack | All components in the tree | `App > Layout > Page > ErrorBoundary > Widget` |
| Owner Stack | Components that "created" the element | `App > Page > Widget` (skips pass-through components) |

### Good Example - Custom Console Error Overlay

```typescript
// src/utils/error-overlay.ts
import * as React from "react";

interface ErrorOverlayEntry {
  message: string;
  componentStack?: string | null;
  ownerStack?: string | null;
  timestamp: string;
}

const errorLog: ErrorOverlayEntry[] = [];

// Only available in development
function getOwnerStack(): string | null {
  if (process.env.NODE_ENV !== "production") {
    return React.captureOwnerStack?.() ?? null;
  }
  return null;
}

// Patch console.error to capture owner stacks
const originalConsoleError = console.error;
console.error = function patchedConsoleError(...args: unknown[]) {
  originalConsoleError.apply(console, args);

  const ownerStack = getOwnerStack();
  if (ownerStack) {
    errorLog.push({
      message: String(args[0]),
      ownerStack,
      timestamp: new Date().toISOString(),
    });
  }
};

export function getErrorLog(): readonly ErrorOverlayEntry[] {
  return errorLog;
}

export function clearErrorLog(): void {
  errorLog.length = 0;
}
```

**Why good:** Owner stack shows which component CREATED the error, not just where it appeared, invaluable for debugging prop-drilling issues, only runs in development (no production overhead)

### Good Example - Using captureOwnerStack in Error Handlers

```typescript
// src/main.tsx
import * as React from "react";
import { createRoot } from "react-dom/client";

const ROOT_ELEMENT_ID = "root";

function enhancedErrorLog(
  error: Error,
  errorInfo: { componentStack?: string | null }
) {
  const ownerStack =
    process.env.NODE_ENV !== "production"
      ? React.captureOwnerStack?.()
      : null;

  console.group("React Error Report");
  console.error("Error:", error.message);
  console.error("Component Stack:", errorInfo.componentStack);
  if (ownerStack) {
    console.error("Owner Stack:", ownerStack);
  }
  console.groupEnd();
}

const container = document.getElementById(ROOT_ELEMENT_ID);
if (!container) throw new Error("Root element not found");

const root = createRoot(container, {
  onCaughtError: enhancedErrorLog,
  onUncaughtError: enhancedErrorLog,
  onRecoverableError: enhancedErrorLog,
});
```

**Why good:** Combines both stacks for complete debugging picture, conditionally includes owner stack only in development, structured console output for easy reading

---

## Pattern 4: Filtering Known Errors

Sometimes you want to ignore certain expected errors in your error handlers.

### Good Example - Error Filtering

```typescript
// src/main.tsx
import { createRoot } from "react-dom/client";

const ROOT_ELEMENT_ID = "root";

// Errors to ignore (expected, handled elsewhere)
const IGNORED_ERROR_MESSAGES = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Network request failed", // Handled by React Query
] as const;

function shouldIgnoreError(error: Error): boolean {
  return IGNORED_ERROR_MESSAGES.some((msg) =>
    error.message.includes(msg)
  );
}

const container = document.getElementById(ROOT_ELEMENT_ID);
if (!container) throw new Error("Root element not found");

const root = createRoot(container, {
  onCaughtError: (error, errorInfo) => {
    if (shouldIgnoreError(error)) return;
    // Log to monitoring
    reportToMonitoring("caught", error, errorInfo);
  },

  onUncaughtError: (error, errorInfo) => {
    // Never ignore uncaught errors - they're fatal
    reportToMonitoring("uncaught", error, errorInfo);
  },

  onRecoverableError: (error, errorInfo) => {
    if (shouldIgnoreError(error)) return;
    // Log at warning level
    reportToMonitoring("recoverable", error, errorInfo);
  },
});
```

**Why good:** Reduces noise from known browser quirks (ResizeObserver), keeps monitoring focused on actionable errors, named constant for ignored messages

---

## Pattern 5: Combining with ErrorBoundary Components

The `createRoot` handlers and `ErrorBoundary` components serve different purposes and should be used together.

### Architecture

```
createRoot({
  onCaughtError,    ← Logging/monitoring (all caught errors)
  onUncaughtError,  ← Fatal error handling
  onRecoverableError
})
    │
    └── App
        └── ErrorBoundary  ← User-facing fallback UI
            └── Feature
                └── ErrorBoundary  ← Feature-specific fallback
                    └── Widget
```

### Good Example - Complete Error Strategy

```typescript
// src/main.tsx
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

const ROOT_ELEMENT_ID = "root";

// Root-level logging (separate from UI)
const root = createRoot(container, {
  onCaughtError: (error) => sendToMonitoring(error),
  onUncaughtError: (error) => sendToMonitoring(error),
  onRecoverableError: (error) => sendToMonitoring(error),
});

// App-level fallback for fatal errors
function AppFallback() {
  return (
    <div role="alert">
      <h1>Application Error</h1>
      <p>Please refresh the page.</p>
      <button onClick={() => window.location.reload()}>Refresh</button>
    </div>
  );
}

// Feature-level fallback with retry
function FeatureFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Feature unavailable</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

// App structure
function App() {
  return (
    <ErrorBoundary FallbackComponent={AppFallback}>
      <Layout>
        <ErrorBoundary FallbackComponent={FeatureFallback}>
          <Dashboard />
        </ErrorBoundary>
      </Layout>
    </ErrorBoundary>
  );
}

root.render(<App />);
```

**Why good:** Separation of concerns - root handlers for logging, boundaries for UI, granular fallbacks at different levels, both systems work together

---

## Pattern 6: hydrateRoot Error Options

For server-side rendered apps, `hydrateRoot` accepts the same error options.

### Good Example - SSR Hydration with Error Handling

```typescript
// src/entry-client.tsx
import { hydrateRoot } from "react-dom/client";
import { App } from "./app";

const ROOT_ELEMENT_ID = "root";
const HYDRATION_MISMATCH_THRESHOLD = 5;

let hydrationMismatchCount = 0;

const container = document.getElementById(ROOT_ELEMENT_ID);
if (!container) throw new Error("Root element not found");

hydrateRoot(container, <App />, {
  onCaughtError: (error, errorInfo) => {
    reportToMonitoring("caught", error, errorInfo);
  },

  onUncaughtError: (error, errorInfo) => {
    reportToMonitoring("uncaught", error, errorInfo);
  },

  onRecoverableError: (error, errorInfo) => {
    // Track hydration mismatches specifically
    if (error.message.includes("Hydration")) {
      hydrationMismatchCount++;
      console.warn(`Hydration mismatch #${hydrationMismatchCount}`);

      // Alert if too many mismatches (indicates SSR/client mismatch)
      if (hydrationMismatchCount >= HYDRATION_MISMATCH_THRESHOLD) {
        reportToMonitoring("hydration-critical", error, {
          ...errorInfo,
          mismatchCount: hydrationMismatchCount,
        });
      }
    } else {
      reportToMonitoring("recoverable", error, errorInfo);
    }
  },
});
```

**Why good:** Same API as createRoot, specific handling for hydration mismatches, threshold-based alerting prevents noise while catching systematic issues

---

## When to Use Each

### Decision Framework

```
Need to LOG/REPORT errors?
├─ YES → Use createRoot options (onCaughtError, onUncaughtError, onRecoverableError)
└─ NO → Skip createRoot options

Need to DISPLAY fallback UI?
├─ YES → Use ErrorBoundary components
└─ NO → Skip ErrorBoundary

Error type?
├─ Render/lifecycle error → ErrorBoundary catches, onCaughtError logs
├─ Async error (fetch, event handler) → useErrorBoundary + showBoundary()
├─ Fatal (no boundary catches) → onUncaughtError logs
└─ Hydration/recovery → onRecoverableError logs
```

### Summary Table

| Scenario | ErrorBoundary | createRoot Options |
|----------|---------------|-------------------|
| Show fallback UI | ✅ Required | Not involved |
| Log caught errors | Optional `onError` | ✅ `onCaughtError` |
| Log uncaught errors | Cannot catch | ✅ `onUncaughtError` |
| Track hydration issues | Cannot catch | ✅ `onRecoverableError` |

---

## Gotchas

1. **`captureOwnerStack()` is development-only** - Returns `null` in production, always check `process.env.NODE_ENV`

2. **Error handlers run AFTER boundary catches** - `onCaughtError` runs after the boundary's `componentDidCatch`, not before

3. **React 19 consolidates error messages** - Instead of duplicate console.error calls, React 19 logs a single error message with all relevant info

4. **`onRecoverableError` includes original error** - The `error` parameter may have `error.cause` containing the original thrown error

5. **SSR hydration errors are "recoverable"** - They trigger `onRecoverableError`, not `onUncaughtError`

6. **These options don't exist on React 18** - Check React version before using, or the options will be silently ignored

---

> **See also:**
> - [core.md](core.md) - Basic error boundary patterns
> - [testing.md](testing.md) - Testing error boundaries
> - [nested-boundaries.md](nested-boundaries.md) - Multi-level boundary architecture
