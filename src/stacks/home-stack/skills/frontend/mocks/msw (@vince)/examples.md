# MSW Mocking Examples

> All code examples for API mocking with MSW. Good/bad comparisons for each pattern.

---

## Package Configuration

```json
// packages/api-mocks/package.json
// ✅ Good Example
{
  "name": "@repo/api-mocks",
  "exports": {
    "./handlers": "./src/handlers/index.ts",
    "./mocks": "./src/mocks/index.ts",
    "./browserWorker": "./src/browser-worker.ts",
    "./serverWorker": "./src/server-worker.ts"
  }
}
```

**Why good:** Separate entry points prevent bundling unnecessary code (browser worker won't bundle in tests), explicit exports make dependencies clear, kebab-case file names follow project conventions

```json
// ❌ Bad Example
{
  "name": "@repo/api-mocks",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

**Why bad:** Single entry point bundles everything together causing browser worker to load in Node tests (performance hit), mixing concerns violates separation of environments, harder to tree-shake unused code

---

## Mock Data Separation

### Mock Data Definition

```typescript
// packages/api-mocks/src/mocks/features.ts
// ✅ Good Example
import type { GetFeaturesResponse } from "@repo/api/types";

export const defaultFeatures: GetFeaturesResponse = {
  features: [
    {
      id: "1",
      name: "Dark mode",
      description: "Toggle dark mode",
      status: "done",
    },
    {
      id: "2",
      name: "User authentication",
      description: "JWT-based auth",
      status: "in progress",
    },
  ],
};

export const emptyFeatures: GetFeaturesResponse = {
  features: [],
};
```

**Why good:** Type safety from generated API types catches schema mismatches at compile time, reusable across multiple handlers, easy to update centrally when API changes, `import type` optimizes bundle size

```typescript
// ❌ Bad Example
import { http, HttpResponse } from "msw";

export const getFeaturesHandler = http.get("api/v1/features", () => {
  return HttpResponse.json({
    features: [
      { id: "1", name: "Dark mode", description: "Toggle dark mode", status: "done" },
    ],
  });
});
```

**Why bad:** Mock data embedded in handler cannot be reused in other tests or handlers, no type checking against API schema causes runtime errors when schema changes, harder to test edge cases with different data variants

---

## Variant Handlers

### Handler Implementation

```typescript
// packages/api-mocks/src/handlers/features/get-features.ts
// ✅ Good Example
import { http, HttpResponse } from "msw";
import type { GetFeaturesResponse } from "@repo/api/types";
import { mockVariantsByEndpoint } from "../../manage-mock-selection";
import { defaultFeatures, emptyFeatures } from "../../mocks/features";

const API_ENDPOINT = "api/v1/features";
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// Response factories
const defaultResponse = () => HttpResponse.json(defaultFeatures, { status: HTTP_STATUS_OK });
const emptyResponse = () => HttpResponse.json(emptyFeatures, { status: HTTP_STATUS_OK });
const errorResponse = () => new HttpResponse("General error", { status: HTTP_STATUS_INTERNAL_SERVER_ERROR });

// Default handler with variant switching (for development)
const defaultHandler = () =>
  http.get(API_ENDPOINT, async () => {
    switch (mockVariantsByEndpoint.features) {
      case "empty": {
        return emptyResponse();
      }
      case "error": {
        return errorResponse();
      }
      default: {
        return defaultResponse();
      }
    }
  });

// Export handlers for different scenarios
export const getFeaturesHandlers = {
  defaultHandler,
  emptyHandler: () => http.get(API_ENDPOINT, async () => emptyResponse()),
  errorHandler: () => http.get(API_ENDPOINT, async () => errorResponse()),
};
```

**Why good:** Named constants eliminate magic numbers for maintainability, response factories reduce duplication and ensure consistency, variant switching enables UI development without code changes, explicit handler exports allow per-test overrides

```typescript
// ❌ Bad Example
import { http, HttpResponse } from "msw";

export const getFeaturesHandler = http.get("api/v1/features", () => {
  return HttpResponse.json({ features: [] }, { status: 200 });
});
```

**Why bad:** Hardcoded 200 status is a magic number, only supports one scenario (empty) making error state testing impossible, no variant switching forces code changes to test different states, single export prevents flexible test scenarios

---

## Browser Worker

### Browser Worker Setup

```typescript
// packages/api-mocks/src/browser-worker.ts
// ✅ Good Example
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const browserWorker = setupWorker(...handlers);
```

**Why good:** Uses `setupWorker` from `msw/browser` for browser environment, spreads handlers array for clean syntax, single responsibility (just worker setup)

```typescript
// ❌ Bad Example - Wrong MSW API for environment
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const browserWorker = setupServer(...handlers);
```

**Why bad:** `setupServer` is for Node.js environment and will fail in browser, causes cryptic runtime errors about service worker not being available

### App Integration (SPA/Client-Side)

```typescript
// apps/client-react/src/main.tsx
// ✅ Good Example
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
// ❌ Bad Example - Rendering before mocking ready
import { createRoot } from "react-dom/client";
import { browserWorker } from "@repo/api-mocks/browserWorker";
import { App } from "./app";

if (import.meta.env.DEV) {
  browserWorker.start({ onUnhandledRequest: "bypass" }); // Missing await
}

createRoot(document.getElementById("root")!).render(<App />);
```

**Why bad:** Race condition where app renders before MSW is ready causes first requests to fail, no async/await means initial API calls might bypass mocks unpredictably, hard-to-debug intermittent failures in development

### App Integration (SSR Framework)

```typescript
// apps/client-next/app/layout.tsx
// ✅ Good Example
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
// ❌ Bad Example - Importing browser worker at top level
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

## Server Worker

### Server Worker Setup

```typescript
// packages/api-mocks/src/server-worker.ts
// ✅ Good Example
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const serverWorker = setupServer(...handlers);
```

**Why good:** Uses `setupServer` from `msw/node` for Node environment, matches browser worker pattern for consistency

```typescript
// ❌ Bad Example
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const serverWorker = setupWorker(...handlers);
```

**Why bad:** `setupWorker` requires browser APIs (service worker) that don't exist in Node causing test failures, will throw "navigator is not defined" errors in test environment

### Test Setup

```typescript
// apps/client-react/src/setup-tests.ts
// ✅ Good Example
import { serverWorker } from "@repo/api-mocks/serverWorker";

// Use your test runner's lifecycle hooks
beforeAll(() => serverWorker.listen());
afterEach(() => serverWorker.resetHandlers());
afterAll(() => serverWorker.close());
```

**Why good:** `beforeAll` starts server once for all tests (performance), `afterEach` resets handlers preventing test pollution from overrides, `afterAll` cleans up resources, follows MSW recommended lifecycle

```typescript
// ❌ Bad Example - Missing resetHandlers
import { serverWorker } from "@repo/api-mocks/serverWorker";

beforeAll(() => serverWorker.listen());
afterAll(() => serverWorker.close());
// Missing: afterEach(() => serverWorker.resetHandlers());
```

**Why bad:** Missing `resetHandlers` in `afterEach` means handler overrides from one test leak into subsequent tests causing flaky failures, tests become order-dependent breaking test isolation

---

## Per-Test Handler Overrides

### Test Implementation

```typescript
// apps/client-react/src/__tests__/features.test.tsx
// ✅ Good Example
import { getFeaturesHandlers } from "@repo/api-mocks/handlers";
import { serverWorker } from "@repo/api-mocks/serverWorker";

it("should render features", async () => {
  // Uses default handler
  renderApp();
  // Assert using your component testing library
  await expect(findByText("Dark mode")).resolves.toBeInTheDocument();
});

it("should render empty state", async () => {
  // Override with empty handler for this test
  serverWorker.use(getFeaturesHandlers.emptyHandler());
  renderApp();

  await expect(findByText("No features found")).resolves.toBeInTheDocument();
});

it("should handle errors", async () => {
  // Override with error handler for this test
  serverWorker.use(getFeaturesHandlers.errorHandler());
  renderApp();

  await expect(findByText(/error/i)).resolves.toBeInTheDocument();
});
```

**Why good:** `serverWorker.use()` scoped to individual test for isolation, explicit handler names make test intent clear, tests all scenarios (success, empty, error) for comprehensive coverage, `afterEach` reset ensures overrides don't leak

```typescript
// ❌ Bad Example - Only testing happy path
it("should render features", async () => {
  renderApp();
  await expect(findByText("Dark mode")).resolves.toBeInTheDocument();
});
// Missing: tests for empty and error scenarios
```

**Why bad:** Only tests default success scenario, empty and error states go untested causing bugs to reach production, no validation that error handling works, incomplete test coverage

---

## Runtime Variant Switching

### Variant Management

```typescript
// packages/api-mocks/src/manage-mock-selection.ts
// ✅ Good Example
export type MockVariant = "default" | "empty" | "error";

export const mockVariantsByEndpoint: Record<string, MockVariant> = {
  features: "default",
  users: "default",
  // Add more endpoints as needed
};

// Optional: UI for switching variants in development
export function setMockVariant(endpoint: string, variant: MockVariant) {
  mockVariantsByEndpoint[endpoint] = variant;
}
```

**Why good:** Type-safe variant names prevent typos, centralized state for all endpoint variants, mutation function allows runtime changes, enables testing UI states without restarting app

```typescript
// ❌ Bad Example - Using strings without type safety
export const mockVariants = {
  features: "default",
  users: "defualt", // Typo not caught
};

export function setMockVariant(endpoint, variant) {
  mockVariants[endpoint] = variant;
}
```

**Why bad:** No TypeScript validation allows typos ("defualt") to slip through, any parameters accept anything causing runtime errors, no autocomplete or IDE support for variant names

**When not to use:** In test environment (use explicit handler overrides instead for deterministic behavior).

---

## Simulating Network Latency

### Implementation

```typescript
// ✅ Good Example
import { http, HttpResponse, delay } from "msw";

const MOCK_NETWORK_LATENCY_MS = 500;
const HTTP_STATUS_OK = 200;

const defaultHandler = () =>
  http.get(API_ENDPOINT, async () => {
    await delay(MOCK_NETWORK_LATENCY_MS);
    return HttpResponse.json(defaultFeatures, { status: HTTP_STATUS_OK });
  });
```

**Why good:** Named constant makes latency configurable and self-documenting, realistic delay reveals loading state bugs, using MSW's `delay` utility is clean and cancellable

```typescript
// ❌ Bad Example
import { http, HttpResponse } from "msw";

const defaultHandler = () =>
  http.get(API_ENDPOINT, async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return HttpResponse.json(defaultFeatures, { status: 200 });
  });
```

**Why bad:** Magic number 300ms without context or configurability, manual Promise wrapper instead of MSW utility, magic number 200 status code repeated, harder to disable delay when needed

**When not to use:** In tests where speed matters more than loading state validation (omit delay for faster test execution).
