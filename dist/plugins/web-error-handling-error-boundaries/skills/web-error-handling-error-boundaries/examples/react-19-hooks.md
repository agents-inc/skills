# Error Boundaries — React 19 Root Error Options

> Full code for Pattern 7 in [SKILL.md](../SKILL.md). Requires React 19. See [core.md](core.md) for the boundaries themselves.

**Prerequisites:** the boundary patterns in [core.md](core.md). These handlers report; they never
render.

---

## Pattern 7: `createRoot` error options

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

const ROOT_ELEMENT_ID = "root";
const isProduction = process.env.NODE_ENV === "production";

type ErrorKind = "caught" | "uncaught" | "recoverable";

function reportError(
  kind: ErrorKind,
  error: Error,
  errorInfo: { componentStack?: string | null },
) {
  const payload = {
    kind,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    url: window.location.href,
  };

  if (isProduction) {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Reporting must never throw its own error into the handler
    });
    return;
  }

  console.group(`React ${kind} error`);
  console.error(error);
  console.error("Component stack:", errorInfo.componentStack);
  console.groupEnd();
}

const container = document.getElementById(ROOT_ELEMENT_ID);
if (!container) throw new Error(`Root element #${ROOT_ELEMENT_ID} not found`);

const root = createRoot(container, {
  onCaughtError: (error, info) => reportError("caught", error, info),
  onUncaughtError: (error, info) => reportError("uncaught", error, info),
  onRecoverableError: (error, info) => reportError("recoverable", error, info),
});

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Why good:** one reporting function for all three kinds, with the kind carried as data so severity
is decided downstream; the reporting `fetch` swallows its own failure, because an error thrown
inside an error handler is unrecoverable.

Most monitoring SDKs expose a wrapper that returns handlers of exactly this shape — pass those in
place of `reportError` rather than calling the SDK from inside a boundary.

---

## Filtering known errors

```typescript
const IGNORED_ERROR_MESSAGES = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
] as const;

const shouldIgnore = (error: Error) =>
  IGNORED_ERROR_MESSAGES.some((message) => error.message.includes(message));

const root = createRoot(container, {
  onCaughtError: (error, info) => {
    if (shouldIgnore(error)) return;
    reportError("caught", error, info);
  },
  // Uncaught errors are fatal — never filtered
  onUncaughtError: (error, info) => reportError("uncaught", error, info),
  onRecoverableError: (error, info) => {
    if (shouldIgnore(error)) return;
    reportError("recoverable", error, info);
  },
});
```

**Why good:** the browser quirks that generate the most noise are filtered by message, and the
uncaught channel deliberately is not — an error nothing caught is always worth seeing.

---

## `captureOwnerStack()`

Added in React 19.1 and exported only from development builds. The owner stack names the components
that **created** the element, where the component stack names
its position in the tree. `App > Layout > Page > ErrorBoundary > Widget` against `App > Page > Widget`
— the second is usually the one that tells you which call site is wrong.

```typescript
import * as React from "react";

function enhancedErrorLog(
  error: Error,
  errorInfo: { componentStack?: string | null },
) {
  // Optional call: the export is development-only, so it is `undefined` in a
  // production build and on any React before 19.1
  const ownerStack = isProduction
    ? null
    : (React.captureOwnerStack?.() ?? null);

  console.group("React error");
  console.error(error.message);
  console.error("Component stack:", errorInfo.componentStack);
  if (ownerStack) console.error("Owner stack:", ownerStack);
  console.groupEnd();
}
```

**Why good:** the owner stack is what finds a bad prop passed three levels up; guarding on the
environment keeps the call out of production, where `react` does not export it at all.

---

## `hydrateRoot`

`hydrateRoot` takes the same three options. Hydration mismatches arrive through
`onRecoverableError`, not `onUncaughtError`.

```typescript
import { hydrateRoot } from "react-dom/client";
import { App } from "./app";

const HYDRATION_MISMATCH_ALERT_THRESHOLD = 5;
let hydrationMismatchCount = 0;

hydrateRoot(container, <App />, {
  onCaughtError: (error, info) => reportError("caught", error, info),
  onUncaughtError: (error, info) => reportError("uncaught", error, info),
  onRecoverableError: (error, info) => {
    if (!error.message.includes("Hydration")) {
      reportError("recoverable", error, info);
      return;
    }

    hydrationMismatchCount += 1;
    if (hydrationMismatchCount >= HYDRATION_MISMATCH_ALERT_THRESHOLD) {
      reportError("uncaught", error, info);
    }
  },
});
```

**Why good:** a single mismatch is noise and a systematic one is a server/client divergence worth
paging on, so the threshold is what separates them.

---

## Using both together

Root handlers and boundaries answer different questions, so a real application wires both.

```
createRoot({ onCaughtError, onUncaughtError, onRecoverableError })   ← reporting
    └── App
        └── ErrorBoundary            ← page-level fallback
            └── Feature
                └── ErrorBoundary    ← feature-level fallback with retry
```

| Need                           | Boundary           | Root option          |
| ------------------------------ | ------------------ | -------------------- |
| Show fallback UI               | Yes                | No                   |
| Report a caught error          | Optional `onError` | `onCaughtError`      |
| Report an error nothing caught | Cannot             | `onUncaughtError`    |
| Track hydration mismatches     | Cannot             | `onRecoverableError` |
