# API Mocking with MSW

> **Quick Guide:** Centralized mocks in `@repo/api-mocks`. Handlers with variant switching (default, empty, error). Shared between browser (dev) and Node (tests). Type-safe using generated types from `@repo/api/types`.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

**(You MUST separate mock data from handlers - handlers in `handlers/`, data in `mocks/`)**

**(You MUST use `setupWorker` for browser/development and `setupServer` for Node/tests - NEVER swap them)**

**(You MUST reset handlers after each test with `serverWorker.resetHandlers()` in `afterEach`)**

**(You MUST use generated types from `@repo/api/types` - NEVER manually define API response types)**

**(You MUST use named constants for HTTP status codes and delays - NO magic numbers)**

</critical_requirements>

---

**Auto-detection:** MSW setup, mock handlers, mock data, API mocking, testing mocks, development mocks, setupWorker, setupServer

**When to use:**

- Setting up MSW for development and testing
- Creating centralized mock handlers with variant switching
- Sharing mocks between browser (dev) and Node (tests)
- Testing different API scenarios (success, empty, error)
- Simulating network latency and error conditions

**When NOT to use:**

- Integration tests that need real backend validation (use test database instead)
- Production builds (MSW should never ship to production)
- Simple unit tests of pure functions (no network calls to mock)
- When you need to test actual network failure modes (use test containers)

**Key patterns covered:**

- Centralized mock package structure with handlers and data separation
- Variant-based handlers (default, empty, error scenarios)
- Browser worker for development, server worker for tests
- Per-test handler overrides for specific scenarios
- Runtime variant switching for UI development

---

<philosophy>

## Philosophy

MSW (Mock Service Worker) intercepts network requests at the service worker level, providing realistic API mocking without changing application code. This skill enforces a centralized approach where mocks live in a dedicated package (`@repo/api-mocks`), enabling consistent behavior across development and testing environments.

**When to use MSW:**

- Developing frontend features before backend API is ready
- Testing different API response scenarios (success, empty, error states)
- Simulating network conditions (latency, timeouts)
- Creating a consistent development environment across team
- End-to-end testing with controlled API responses

**When NOT to use MSW:**

- Integration tests that need real backend validation (use test database)
- Production builds (MSW should never ship to production)
- Simple unit tests of pure functions (no network calls)
- When you need to test actual network failure modes (use test containers)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Centralized Mock Package Structure

Organize all mocks in a dedicated workspace package with clear separation between handlers (MSW request handlers) and mock data (static response data).

#### Package Structure

```
packages/api-mocks/
├── src/
│   ├── handlers/
│   │   ├── index.ts              # Export all handlers
│   │   └── features/
│   │       └── get-features.ts   # MSW handlers with variants
│   ├── mocks/
│   │   ├── index.ts              # Export all mock data
│   │   └── features.ts           # Mock data
│   ├── browser-worker.ts         # Browser MSW worker (development)
│   ├── server-worker.ts          # Node.js MSW server (tests)
│   └── manage-mock-selection.ts  # Variant switching logic
└── package.json
```

#### Package Configuration

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

### Pattern 2: Separate Mock Data from Handlers

Define mock data as typed constants in `mocks/` directory, completely separate from MSW handlers.

#### Mock Data Definition

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

**When not to use:** When mock data is truly one-off and specific to a single test case (use inline data in the test instead).

---

### Pattern 3: Handlers with Variant Switching

Create handlers that support multiple response scenarios (default, empty, error) with runtime switching for development and explicit overrides for testing.

#### Handler Implementation

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

### Pattern 4: Browser Worker for Development

Set up MSW browser worker to intercept requests during development, enabling the app to work without a real backend.

#### Browser Worker Setup

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

#### App Integration (Vite/React)

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

#### App Integration (Next.js App Router)

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

**Why good:** Dynamic import in Next.js prevents server-side bundling of browser-only code, awaiting in async component ensures MSW ready before render, named constants for magic strings

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

### Pattern 5: Server Worker for Tests

Set up MSW server worker for Node.js test environment with proper lifecycle management.

#### Server Worker Setup

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

#### Test Setup

```typescript
// apps/client-react/src/setup-tests.ts
// ✅ Good Example
import { afterAll, afterEach, beforeAll } from "vitest";
import { serverWorker } from "@repo/api-mocks/serverWorker";

beforeAll(() => serverWorker.listen());
afterEach(() => serverWorker.resetHandlers());
afterAll(() => serverWorker.close());
```

**Why good:** `beforeAll` starts server once for all tests (performance), `afterEach` resets handlers preventing test pollution from overrides, `afterAll` cleans up resources, follows MSW recommended lifecycle

```typescript
// ❌ Bad Example - Missing resetHandlers
import { afterAll, beforeAll } from "vitest";
import { serverWorker } from "@repo/api-mocks/serverWorker";

beforeAll(() => serverWorker.listen());
afterAll(() => serverWorker.close());
```

**Why bad:** Missing `resetHandlers` in `afterEach` means handler overrides from one test leak into subsequent tests causing flaky failures, tests become order-dependent breaking test isolation

---

### Pattern 6: Per-Test Handler Overrides

Override default handlers in specific tests to simulate different API scenarios.

#### Test Implementation

```typescript
// apps/client-react/src/__tests__/features.test.tsx
// ✅ Good Example
import { expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { getFeaturesHandlers } from "@repo/api-mocks/handlers";
import { serverWorker } from "@repo/api-mocks/serverWorker";

it("should render features", async () => {
  // Uses default handler
  renderApp();
  await expect(screen.findByText("Dark mode")).resolves.toBeInTheDocument();
});

it("should render empty state", async () => {
  // Override with empty handler for this test
  serverWorker.use(getFeaturesHandlers.emptyHandler());
  renderApp();

  await expect(screen.findByText("No features found")).resolves.toBeInTheDocument();
});

it("should handle errors", async () => {
  // Override with error handler for this test
  serverWorker.use(getFeaturesHandlers.errorHandler());
  renderApp();

  await expect(screen.findByText(/error/i)).resolves.toBeInTheDocument();
});
```

**Why good:** `serverWorker.use()` scoped to individual test for isolation, explicit handler names make test intent clear, tests all scenarios (success, empty, error) for comprehensive coverage, `afterEach` reset ensures overrides don't leak

```typescript
// ❌ Bad Example - Only testing happy path
import { expect, it } from "vitest";
import { screen } from "@testing-library/react";

it("should render features", async () => {
  renderApp();
  await expect(screen.findByText("Dark mode")).resolves.toBeInTheDocument();
});
```

**Why bad:** Only tests default success scenario, empty and error states go untested causing bugs to reach production, no validation that error handling works, incomplete test coverage

**When not to use:** For integration tests that need real backend validation (use test database instead of mocks).

---

### Pattern 7: Runtime Variant Switching for Development

Enable developers to switch between mock variants (default, empty, error) at runtime without code changes.

#### Variant Management

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

### Pattern 8: Simulating Network Latency

Add realistic delays to mock responses to test loading states and race conditions.

#### Implementation

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

</patterns>

---

<decision_framework>

## Decision Framework

```
Need API mocking?
├─ Is it for development?
│   ├─ YES → Browser worker + variant switching
│   └─ NO → Server worker in tests
├─ Testing different scenarios?
│   ├─ YES → Per-test handler overrides
│   └─ NO → Default handlers sufficient
├─ Need to change mock behavior without restarting?
│   ├─ YES → Variant switching + runtime control
│   └─ NO → Static handlers fine
└─ Need realistic network conditions?
    ├─ YES → Add delay() to handlers
    └─ NO → Instant responses
```

**Choosing between approaches:**

- **Centralized package**: Always use for shared mocks across apps
- **Handler variants**: Use when testing multiple scenarios (empty, error states)
- **Per-test overrides**: Use when specific tests need different responses
- **Runtime switching**: Use in development for UI exploration
- **Network delay**: Use when testing loading states or race conditions

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **React Query / TanStack Query**: MSW intercepts fetch calls, React Query sees normal responses
- **Vitest**: Server worker integrates via test setup file (`setup-tests.ts`)
- **React Testing Library**: Works seamlessly, no special configuration needed
- **Vite/Next.js**: Browser worker integrates via app entry point

**Configuration with other tools:**

```typescript
// Vitest config
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ["./src/setup-tests.ts"], // Loads serverWorker
  },
});
```

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **Using `setupWorker` in Node tests or `setupServer` in browser** - Wrong API for environment causes cryptic failures
- ❌ **Manual API type definitions instead of generated types** - Types drift from real API schema causing runtime errors
- ❌ **Not resetting handlers between tests** - Test pollution and order-dependent failures
- ❌ **Mixing handlers and mock data in same file** - Reduces reusability and violates separation of concerns
- ❌ **Missing `await` when starting browser worker before render** - Race conditions cause intermittent failures

**Medium Priority Issues:**

- ⚠️ **Only testing happy path (missing empty/error variants)** - Incomplete test coverage
- ⚠️ **Hardcoded HTTP status codes (magic numbers)** - Use named constants
- ⚠️ **Top-level import of browser worker in Next.js** - SSR build failures
- ⚠️ **No `onUnhandledRequest` configuration** - Unclear which requests are mocked vs real

**Common Mistakes:**

- Forgetting to call `serverWorker.resetHandlers()` in `afterEach`
- Using default exports instead of named exports
- Embedding mock data inside handlers instead of separating into `mocks/` directory
- Not providing variant handlers (only `defaultHandler`)

**Gotchas & Edge Cases:**

- MSW requires async/await for browser worker start - rendering before ready causes race conditions
- Handler overrides with `serverWorker.use()` persist until `resetHandlers()` is called
- Browser worker doesn't work in Node environment and vice versa - check your imports
- Dynamic imports in Next.js are required for browser-only code to avoid SSR bundling issues

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Wrong MSW API for Environment

```typescript
// ❌ ANTI-PATTERN: setupServer in browser
import { setupServer } from "msw/node";
export const browserWorker = setupServer(...handlers);

// ❌ ANTI-PATTERN: setupWorker in Node tests
import { setupWorker } from "msw/browser";
export const serverWorker = setupWorker(...handlers);
```

**Why it's wrong:** `setupWorker` requires browser service worker APIs, `setupServer` requires Node APIs - wrong API causes cryptic runtime errors.

**What to do instead:** Use `setupWorker` from `msw/browser` for browser, `setupServer` from `msw/node` for tests.

---

### Missing Handler Reset Between Tests

```typescript
// ❌ ANTI-PATTERN: No resetHandlers
import { afterAll, beforeAll } from "vitest";
import { serverWorker } from "@repo/api-mocks/serverWorker";

beforeAll(() => serverWorker.listen());
afterAll(() => serverWorker.close());
// Missing: afterEach(() => serverWorker.resetHandlers());
```

**Why it's wrong:** Handler overrides from one test leak into subsequent tests causing flaky failures, tests become order-dependent.

**What to do instead:** Always include `afterEach(() => serverWorker.resetHandlers())`.

---

### Mock Data Embedded in Handlers

```typescript
// ❌ ANTI-PATTERN: Data inside handler
export const getFeaturesHandler = http.get("api/v1/features", () => {
  return HttpResponse.json({
    features: [{ id: "1", name: "Dark mode" }],
  });
});
```

**Why it's wrong:** Mock data cannot be reused in other tests or handlers, no type checking against API schema.

**What to do instead:** Separate mock data into `mocks/` directory with proper types from `@repo/api/types`.

---

### Rendering Before MSW Ready

```typescript
// ❌ ANTI-PATTERN: Missing await
if (import.meta.env.DEV) {
  browserWorker.start({ onUnhandledRequest: "bypass" }); // No await!
}
createRoot(document.getElementById("root")!).render(<App />);
```

**Why it's wrong:** Race condition where app renders before MSW is ready causes first requests to fail unpredictably.

**What to do instead:** Await worker start before rendering: `await browserWorker.start(...)`.

</anti_patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

**(You MUST separate mock data from handlers - handlers in `handlers/`, data in `mocks/`)**

**(You MUST use `setupWorker` for browser/development and `setupServer` for Node/tests - NEVER swap them)**

**(You MUST reset handlers after each test with `serverWorker.resetHandlers()` in `afterEach`)**

**(You MUST use generated types from `@repo/api/types` - NEVER manually define API response types)**

**(You MUST use named constants for HTTP status codes and delays - NO magic numbers)**

**Failure to follow these rules will cause test pollution, type drift from real API, environment-specific failures, and hard-to-debug race conditions.**

</critical_reminders>
