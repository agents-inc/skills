# MSW Browser Worker Examples

> Browser worker setup and app integration for development. Reference from [SKILL.md](../SKILL.md).

**Related examples:**
- [core.md](core.md) - Package configuration, mock data, variant handlers
- [node.md](node.md) - Server worker for tests
- [testing.md](testing.md) - Per-test handler overrides
- [advanced.md](advanced.md) - Variant switching, network latency

---

## Browser Worker Setup

```typescript
// packages/api-mocks/src/browser-worker.ts
// Good Example
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const browserWorker = setupWorker(...handlers);
```

**Why good:** Uses `setupWorker` from `msw/browser` for browser environment, spreads handlers array for clean syntax, single responsibility (just worker setup)

```typescript
// Bad Example - Wrong MSW API for environment
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const browserWorker = setupServer(...handlers);
```

**Why bad:** `setupServer` is for Node.js environment and will fail in browser, causes cryptic runtime errors about service worker not being available

---

## App Integration (SPA/Client-Side)

```typescript
// apps/client-react/src/main.tsx
// Good Example
import { createRoot } from "react-dom/client";
import { browserWorker } from "@repo/api-mocks/browserWorker";
import { App } from "./app";

const UNHANDLED_REQUEST_STRATEGY = "bypass";

async function enableMocking() {
  if (import.meta.env.DEV) {
    await browserWorker.start({
      onUnhandledRequest: UNHANDLED_REQUEST_STRATEGY, // Allow real requests to pass through
    });
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
```

**Why good:** Awaits worker start before rendering prevents race conditions, `onUnhandledRequest: "bypass"` allows unmocked requests to real APIs, only runs in development (no production impact), named constant for configuration clarity

```typescript
// Bad Example - Rendering before mocking ready
import { createRoot } from "react-dom/client";
import { browserWorker } from "@repo/api-mocks/browserWorker";
import { App } from "./app";

if (import.meta.env.DEV) {
  browserWorker.start({ onUnhandledRequest: "bypass" }); // Missing await
}

createRoot(document.getElementById("root")!).render(<App />);
```

**Why bad:** Race condition where app renders before MSW is ready causes first requests to fail, no async/await means initial API calls might bypass mocks unpredictably, hard-to-debug intermittent failures in development

---

## App Integration (SSR Framework)

```typescript
// apps/client-next/app/layout.tsx
// Good Example
import type { ReactNode } from "react";

const UNHANDLED_REQUEST_STRATEGY = "bypass";
const NODE_ENV_DEVELOPMENT = "development";

async function enableMocking() {
  if (process.env.NODE_ENV === NODE_ENV_DEVELOPMENT) {
    const { browserWorker } = await import("@repo/api-mocks/browserWorker");
    return browserWorker.start({
      onUnhandledRequest: UNHANDLED_REQUEST_STRATEGY,
    });
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === NODE_ENV_DEVELOPMENT) {
    await enableMocking();
  }

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Why good:** Dynamic import prevents server-side bundling of browser-only code, awaiting ensures MSW ready before render, named constants for magic strings

```typescript
// Bad Example - Importing browser worker at top level
import type { ReactNode } from "react";
import { browserWorker } from "@repo/api-mocks/browserWorker";

export default function RootLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "development") {
    browserWorker.start({ onUnhandledRequest: "bypass" });
  }

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Why bad:** Top-level import bundles browser-only service worker code in server bundle causing SSR build failures, sync function cannot await worker start causing race conditions, magic string "development" instead of named constant

---

_Related examples: [core.md](core.md) | [node.md](node.md) | [testing.md](testing.md) | [advanced.md](advanced.md)_
