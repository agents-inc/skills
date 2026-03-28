# MSW Browser Worker Examples

> Browser worker setup and app integration for development. See [core.md](core.md) for handler and mock data patterns.

---

## Pattern 7: Browser Worker Setup

```typescript
// browser-worker.ts
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const browserWorker = setupWorker(...handlers);
```

**Why good:** Uses `setupWorker` from `msw/browser` for browser environment, spreads handlers array for clean syntax, single responsibility

```typescript
// BAD: Wrong MSW API for environment
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const browserWorker = setupServer(...handlers);
```

**Why bad:** `setupServer` is for Node.js and will fail in browser with cryptic runtime errors about missing APIs

---

## Pattern 8: App Integration (SPA/Client-Side)

```typescript
// main.ts (your app entry point)
import { browserWorker } from "./browser-worker";

const UNHANDLED_REQUEST_STRATEGY = "bypass";

async function enableMocking() {
  if (process.env.NODE_ENV === "development") {
    await browserWorker.start({
      onUnhandledRequest: UNHANDLED_REQUEST_STRATEGY,
    });
  }
}

// Await mocking setup BEFORE rendering your app
enableMocking().then(() => {
  // Initialize your app/framework here
  renderApp();
});
```

**Why good:** Awaits worker start before rendering to prevent race conditions, `onUnhandledRequest: "bypass"` allows unmocked requests through, only runs in development, named constant for configuration

```typescript
// BAD: Rendering before mocking ready
if (process.env.NODE_ENV === "development") {
  browserWorker.start({ onUnhandledRequest: "bypass" }); // Missing await!
}

// App renders before MSW is ready
renderApp();
```

**Why bad:** Race condition where app renders before MSW is ready causes first requests to fail unpredictably

---

## Pattern 9: App Integration (SSR Framework)

When using an SSR framework, dynamically import the browser worker to avoid bundling browser-only code in the server build.

```typescript
// layout.tsx (or equivalent entry point)
const UNHANDLED_REQUEST_STRATEGY = "bypass";

async function enableMocking() {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const { browserWorker } = await import("./browser-worker");
    return browserWorker.start({
      onUnhandledRequest: UNHANDLED_REQUEST_STRATEGY,
    });
  }
}
```

**Why good:** Dynamic import prevents server-side bundling of browser-only code, `typeof window` guard ensures browser-only execution, awaiting ensures MSW ready before render

```typescript
// BAD: Top-level import in SSR
import { browserWorker } from "./browser-worker";

// This import bundles browser service worker code in the server build,
// causing SSR build failures
```

**Why bad:** Top-level import bundles browser-only service worker code in server bundle causing build failures

---

_See also: [core.md](core.md) for handler patterns and test setup_
