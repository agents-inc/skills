---
name: web-mocks-msw
description: MSW handlers, browser/server workers, test data. Use when setting up API mocking for development or testing, creating mock handlers with variants, or sharing mocks between browser and Node environments.
---

# MSW Patterns

> **Quick Guide:** MSW intercepts requests at the network layer, so application code never learns it is mocked. One handler set serves both environments — `setupWorker` from `msw/browser` in development, `setupServer` from `msw/node` in tests — and the two are not interchangeable. Keep response bodies in their own module so each variant (default, empty, error) is reusable and typed against your API's generated types.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — mock data modules, variant handlers, server setup and test lifecycle, per-test overrides, runtime variant switching, simulated latency
- [examples/browser.md](examples/browser.md) — browser worker setup and app integration for client-rendered and server-rendered entry points

---

## Which path applies

Handlers are shared; only the setup module and the lifecycle differ.

- **Browser, during development** — `setupWorker` from `msw/browser`, awaited before the app renders, with runtime variant switching to walk the UI through its states. Follow [examples/browser.md](examples/browser.md).
- **Node, in tests** — `setupServer` from `msw/node`, listening for the suite and reset between tests, with `server.use()` for one-test overrides. Follow [examples/core.md](examples/core.md).

---

<critical_requirements>

## Before writing MSW code

**Match the setup function to the environment.** `setupWorker` needs service worker APIs and `setupServer` patches Node's request layer, so each fails in the other with an error that names a missing global rather than the swap.

**Reset handlers in `afterEach` with `server.resetHandlers()`**, so a `server.use()` override cannot decide the outcome of the next test.

**Await `worker.start()` before rendering.** Requests fired before the worker is ready reach the real network, which makes the first render of a suite intermittently different from the rest.

**Keep response bodies in their own module**, typed against your API's generated types — one fixture then serves several handlers, and a schema change fails at compile time instead of inside an assertion.

</critical_requirements>

---

**Auto-detection:** msw, setupWorker, setupServer, msw/browser, msw/node, http.get, http.all, HttpResponse.json, server.use, resetHandlers, onUnhandledRequest, mockServiceWorker.js, delay()

**Applies to:**

- Mocking HTTP responses in development before the backend exists
- Exercising empty, error and slow responses without changing application code
- Sharing one handler set between a dev server and a test suite
- Overriding a single endpoint for a single test

**Handled elsewhere:**

- Test runner configuration and lifecycle hooks — this skill says what goes inside `beforeAll` and `afterEach`, not which runner provides them
- Rendering components and querying the result
- Integration against a real backend, where the server's own behaviour is the thing under test

---

<philosophy>

MSW mocks the network, not the code that calls it. Nothing in the application is injected, wrapped or swapped, so what runs in a test is what runs in production — and the same handlers can drive a dev server, a test suite and a demo build.

That only holds while the handler set stays a description of the API rather than of one test's needs. Data lives in fixtures, handlers pick a fixture, and anything a single test needs differently arrives through an override that is thrown away afterwards.

</philosophy>

---

<decision_framework>

## Which mechanism for changing a response

| You want                                | Use                                                      |
| --------------------------------------- | -------------------------------------------------------- |
| A scenario several tests share          | A named variant handler exported beside the default      |
| One test to see something different     | `server.use(variant())` — discarded by `resetHandlers()` |
| To flip states by hand while developing | A variant map the default handler reads at request time  |
| A response the code under test waits on | `delay(ms)` with an explicit duration                    |

Runtime variant switching belongs to development only. In a test it is shared mutable state that survives the test that set it, where `server.use()` is scoped and self-cleaning.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Response Bodies in Their Own Module

Fixtures live apart from handlers, typed against the API's generated types, so one body serves several handlers and a schema change surfaces as a type error.

```typescript
// mocks/features.ts
import type { GetFeaturesResponse } from "./api-types";

export const defaultFeatures: GetFeaturesResponse = {
  features: [{ id: "1", name: "Dark mode", status: "done" }],
};

export const emptyFeatures: GetFeaturesResponse = { features: [] };
```

Data genuinely specific to one test stays inline in that test.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Variant Handlers

Export the default handler and each alternative scenario from one module, so tests and the dev server pick a variant by name.

```typescript
import { http, HttpResponse } from "msw";

export const getFeaturesHandlers = {
  defaultHandler: () =>
    http.get(ENDPOINT, () => HttpResponse.json(defaultFeatures)),
  emptyHandler: () =>
    http.get(ENDPOINT, () => HttpResponse.json(emptyFeatures)),
  errorHandler: () =>
    http.get(ENDPOINT, () => new HttpResponse("Server error", { status: 500 })),
};
```

`HttpResponse.json` sets the JSON content type and answers 200 unless `init.status` says otherwise, so only the error variant states a code. A non-JSON body — plain text, an empty error — goes through `new HttpResponse(body, init)`.

Full code, including a default handler that reads a variant map at request time: [examples/core.md](examples/core.md)

---

### Pattern 3: One Handler Set, Two Setups

The handler array is shared; the module that consumes it is chosen by environment.

```typescript
// browser-worker.ts
import { setupWorker } from "msw/browser";
export const browserWorker = setupWorker(...handlers);

// server-worker.ts
import { setupServer } from "msw/node";
export const server = setupServer(...handlers);
```

Full code, with app integration: [examples/browser.md](examples/browser.md)

---

### Pattern 4: Test Lifecycle and Per-Test Overrides

Listen once, reset between tests, close at the end. `server.use()` prepends a handler that `resetHandlers()` then removes.

```typescript
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("renders the empty state", async () => {
  server.use(getFeaturesHandlers.emptyHandler());
  renderApp();
});
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `setupServer` in a browser bundle, or `setupWorker` in Node — the error names a missing global, so it reads as an environment problem rather than a swapped import
- `worker.start()` without `await` — the first requests race the worker and reach the real network, which shows up as an intermittent failure in whichever spec runs first
- A top-level import of the browser worker in a server-rendered entry point — service worker code lands in the server bundle and the build fails; import it dynamically behind a `typeof window` check
- No `resetHandlers()` in `afterEach` — an override outlives its test, so a suite passes alone and fails in a different order
- A `worker.start()` that is not behind an environment guard — the service worker registers in the production bundle and real users are served fixtures

**Surprising behaviour:**

- `delay()` with no argument is a random 100–400ms wait in the browser and is negated in Node, so a test that needs a pause has to pass an explicit duration
- `server.use()` overrides persist until `resetHandlers()`; they do not expire when the test that added them ends
- `http.all()` matches every method on a path, so a request sent with the wrong verb still gets a successful response
- `once: true` makes a handler match a single request and then stop, which is what sequential responses need and what makes a later request fall through unnoticed
- Without `onUnhandledRequest` on `start`/`listen`, a request nobody wrote a handler for passes through quietly, so a missing mock looks like a backend fault — it takes `"bypass"`, `"warn"` or `"error"`, which is the difference between silent, noisy and fatal

</red_flags>
