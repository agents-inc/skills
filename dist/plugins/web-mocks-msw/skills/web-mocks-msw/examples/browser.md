# MSW - Browser Worker Examples

> Browser worker setup and app integration for development. See [core.md](core.md) for handlers, fixtures and test setup.

---

## Pattern 7: Browser Worker Setup

```typescript
// browser-worker.ts
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const browserWorker = setupWorker(...handlers);
```

**Why good:** `msw/browser` is the entry point that registers the service worker; the handler array is the same one the Node setup consumes.

```typescript
// BAD: the Node setup in a browser bundle
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const browserWorker = setupServer(...handlers);
```

**Why bad:** `setupServer` patches Node's request layer, so in a browser it fails on a global that does not exist — an error that names neither MSW nor the swapped import.

---

## Pattern 8: App Integration (Client-Rendered Entry)

```typescript
// main.ts — your app entry point
import { browserWorker } from "./browser-worker";

async function enableMocking() {
  if (process.env.NODE_ENV !== "development") return;
  await browserWorker.start({ onUnhandledRequest: "bypass" });
}

enableMocking().then(() => {
  renderApp();
});
```

**Why good:** rendering waits for the worker, so no request escapes to the network before interception starts; `onUnhandledRequest: "bypass"` lets assets and unmocked endpoints through; and the guard keeps the worker out of production bundles.

```typescript
// BAD: rendering without awaiting the worker
if (process.env.NODE_ENV === "development") {
  browserWorker.start({ onUnhandledRequest: "bypass" });
}

renderApp();
```

**Why bad:** whichever requests the first render fires race the worker's registration, so early calls sometimes hit the real backend and the failure moves between reloads.

---

## Pattern 9: App Integration (Server-Rendered Entry)

An entry point that also runs on the server imports the worker dynamically, so browser-only code never reaches the server bundle.

```typescript
// layout.tsx, or your framework's equivalent entry
async function enableMocking() {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;

  const { browserWorker } = await import("./browser-worker");
  return browserWorker.start({ onUnhandledRequest: "bypass" });
}
```

**Why good:** the dynamic import is evaluated only in the branch that has a `window`, so the server build never resolves the service worker module.

```typescript
// BAD: static import in a module the server also evaluates
import { browserWorker } from "./browser-worker";
```

**Why bad:** the import is hoisted and resolved wherever the module is loaded, so service worker code is pulled into the server bundle and the build fails before any guard runs.

---

_See also: [core.md](core.md) for handlers, fixtures and test setup._
