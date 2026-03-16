# MSW Core Examples

> Core handler patterns, test setup, and advanced techniques. See [browser.md](browser.md) for browser worker integration.

---

## Pattern 1: Mock Data Separation

```typescript
// mocks/features.ts
import type { GetFeaturesResponse } from "./api-types";

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
// BAD: Data embedded in handler
import { http, HttpResponse } from "msw";

export const getFeaturesHandler = http.get("api/v1/features", () => {
  return HttpResponse.json({
    features: [{ id: "1", name: "Dark mode", status: "done" }],
  });
});
```

**Why bad:** Mock data cannot be reused in other tests or handlers, no type checking against API schema, harder to test edge cases with different data variants

---

## Pattern 2: Variant Handlers

```typescript
// handlers/features/get-features.ts
import { http, HttpResponse } from "msw";
import { mockVariantsByEndpoint } from "../../manage-mock-selection";
import { defaultFeatures, emptyFeatures } from "../../mocks/features";

const API_ENDPOINT = "api/v1/features";
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

// Response factories
const defaultResponse = () =>
  HttpResponse.json(defaultFeatures, { status: HTTP_STATUS_OK });
const emptyResponse = () =>
  HttpResponse.json(emptyFeatures, { status: HTTP_STATUS_OK });
const errorResponse = () =>
  new HttpResponse("General error", {
    status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
  });

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

**Why good:** Named constants eliminate magic numbers, response factories reduce duplication, variant switching enables UI development without code changes, explicit handler exports allow per-test overrides

```typescript
// BAD: Single hardcoded handler
import { http, HttpResponse } from "msw";

export const getFeaturesHandler = http.get("api/v1/features", () => {
  return HttpResponse.json({ features: [] }, { status: 200 });
});
```

**Why bad:** Hardcoded 200 is a magic number, only supports one scenario, no variant switching, single export prevents flexible test scenarios

---

## Pattern 3: Server Worker Setup and Test Lifecycle

```typescript
// server-worker.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```typescript
// test-setup.ts (configure in your test runner's setup file)
import { server } from "./server-worker";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Why good:** `beforeAll` starts server once for performance, `afterEach` resets handler overrides preventing test pollution, `afterAll` cleans up resources

```typescript
// BAD: Missing resetHandlers
beforeAll(() => server.listen());
afterAll(() => server.close());
// Missing: afterEach(() => server.resetHandlers());
```

**Why bad:** Handler overrides from one test leak into subsequent tests, tests become order-dependent and flaky

---

## Pattern 4: Per-Test Handler Overrides

```typescript
import { getFeaturesHandlers } from "./handlers";
import { server } from "./server-worker";

it("should render features", async () => {
  // Uses default handler from setup
  renderApp();
  await expect(findByText("Dark mode")).resolves.toBeInTheDocument();
});

it("should render empty state", async () => {
  server.use(getFeaturesHandlers.emptyHandler());
  renderApp();
  await expect(findByText("No features found")).resolves.toBeInTheDocument();
});

it("should handle errors", async () => {
  server.use(getFeaturesHandlers.errorHandler());
  renderApp();
  await expect(findByText(/error/i)).resolves.toBeInTheDocument();
});
```

**Why good:** `server.use()` scoped to individual test, explicit handler names make intent clear, tests all scenarios (success, empty, error), `afterEach` reset ensures overrides don't leak

```typescript
// BAD: Only testing happy path
it("should render features", async () => {
  renderApp();
  await expect(findByText("Dark mode")).resolves.toBeInTheDocument();
});
// Missing: tests for empty and error scenarios
```

**Why bad:** Only tests default success, empty and error states untested, incomplete coverage

---

## Pattern 5: Runtime Variant Switching

Use in development to change mock behavior without restarting the app. Do NOT use in tests (use explicit handler overrides instead).

```typescript
// manage-mock-selection.ts
export type MockVariant = "default" | "empty" | "error";

export const mockVariantsByEndpoint: Record<string, MockVariant> = {
  features: "default",
  users: "default",
};

export function setMockVariant(endpoint: string, variant: MockVariant) {
  mockVariantsByEndpoint[endpoint] = variant;
}
```

**Why good:** Type-safe variant names prevent typos, centralized state for all endpoint variants, mutation function allows runtime changes without app restart

```typescript
// BAD: No type safety
export const mockVariants = {
  features: "default",
  users: "defualt", // Typo not caught at compile time
};

export function setMockVariant(endpoint, variant) {
  mockVariants[endpoint] = variant;
}
```

**Why bad:** No TypeScript validation allows typos to slip through, untyped parameters accept anything

---

## Pattern 6: Simulating Network Latency

```typescript
import { http, HttpResponse, delay } from "msw";

const MOCK_NETWORK_LATENCY_MS = 500;
const HTTP_STATUS_OK = 200;

const slowHandler = () =>
  http.get(API_ENDPOINT, async () => {
    await delay(MOCK_NETWORK_LATENCY_MS);
    return HttpResponse.json(defaultFeatures, { status: HTTP_STATUS_OK });
  });
```

**Why good:** Named constant makes latency configurable, MSW's `delay()` utility is clean and cancellable, reveals loading state bugs during development

**When not to use:** In tests where speed matters more than loading state validation (omit delay for faster execution).

**Gotcha:** `delay()` with no arguments applies a random 100-400ms "realistic" delay in the browser, but in Node.js the implicit delay is automatically negated to avoid slowing tests. Use an explicit duration if you need delay in tests.

---

_See also: [browser.md](browser.md) for SPA and SSR app integration_
