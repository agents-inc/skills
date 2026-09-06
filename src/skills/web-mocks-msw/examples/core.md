# MSW - Core Examples

> Fixtures, variant handlers, server setup, per-test overrides, runtime switching and latency. See [browser.md](browser.md) for the browser worker, and [../SKILL.md](../SKILL.md) for the decisions behind these patterns.

---

## Pattern 1: Response Bodies in Their Own Module

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

**Why good:** the generated response type checks the fixture, so an API change breaks the build rather than an assertion; and one body serves every handler and test that needs it.

```typescript
// BAD: body inlined in the handler
import { http, HttpResponse } from "msw";

export const getFeaturesHandler = http.get("api/v1/features", () =>
  HttpResponse.json({
    features: [{ id: "1", name: "Dark mode", status: "done" }],
  }),
);
```

**Why bad:** nothing checks the shape against the API, and a second scenario means a second copy of the same object.

---

## Pattern 2: Variant Handlers

```typescript
// handlers/features/get-features.ts
import { http, HttpResponse } from "msw";
import { mockVariantsByEndpoint } from "../../manage-mock-selection";
import { defaultFeatures, emptyFeatures } from "../../mocks/features";

const ENDPOINT = "api/v1/features";

const defaultResponse = () => HttpResponse.json(defaultFeatures);
const emptyResponse = () => HttpResponse.json(emptyFeatures);
const errorResponse = () => new HttpResponse("General error", { status: 500 });

// The default handler reads the variant map at request time, for development
const defaultHandler = () =>
  http.get(ENDPOINT, () => {
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

export const getFeaturesHandlers = {
  defaultHandler,
  emptyHandler: () => http.get(ENDPOINT, () => emptyResponse()),
  errorHandler: () => http.get(ENDPOINT, () => errorResponse()),
};
```

**Why good:** the scenarios are named and exported, so a test asks for one by name while the dev server flips between them at runtime through the same module.

```typescript
// BAD: one hardcoded handler
export const getFeaturesHandler = http.get("api/v1/features", () =>
  HttpResponse.json({ features: [] }),
);
```

**Why bad:** the only scenario is whatever this file happens to return, so a test wanting an error has to write its own handler and its own body.

---

## Pattern 3: Server Setup and Test Lifecycle

```typescript
// server-worker.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```typescript
// test-setup.ts — registered as your runner's setup file
import { server } from "./server-worker";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Why good:** interception starts once for the whole suite, overrides are discarded between tests, and the request layer is restored at the end.

```typescript
// BAD: no reset
beforeAll(() => server.listen());
afterAll(() => server.close());
```

**Why bad:** every `server.use()` outlives its test, so the suite's result depends on file order and passes when a single test is run alone.

---

## Pattern 4: Per-Test Overrides

```typescript
import { getFeaturesHandlers } from "./handlers";
import { server } from "./server-worker";

it("renders the list", async () => {
  renderApp();
  await expect(findByText("Dark mode")).resolves.toBeInTheDocument();
});

it("renders the empty state", async () => {
  server.use(getFeaturesHandlers.emptyHandler());
  renderApp();
  await expect(findByText("No features found")).resolves.toBeInTheDocument();
});

it("renders the error state", async () => {
  server.use(getFeaturesHandlers.errorHandler());
  renderApp();
  await expect(findByText(/error/i)).resolves.toBeInTheDocument();
});
```

**Why good:** `server.use()` prepends the override for one test only, and the handler's name says which scenario is under test without a body inline.

---

## Pattern 5: Runtime Variant Switching

For development, so a UI state can be reached without editing code. Tests use `server.use()` instead — this map is shared mutable state that survives whoever set it.

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

**Why good:** the union rejects a misspelt variant, and the handler in Pattern 2 reads the map per request, so a change applies without a reload.

---

## Pattern 6: Simulated Latency

```typescript
import { http, HttpResponse, delay } from "msw";

const slowHandler = () =>
  http.get(ENDPOINT, async () => {
    await delay(500);
    return HttpResponse.json(defaultFeatures);
  });
```

**Why good:** the wait is long enough to make a loading state observable, and `delay` is cancelled with the request rather than left running.

**Gotcha:** `delay()` with no argument waits a random 100–400ms in the browser and is negated in Node to keep suites fast — pass a duration when a test depends on the pause.

---

_See also: [browser.md](browser.md) for the browser worker and app integration._
