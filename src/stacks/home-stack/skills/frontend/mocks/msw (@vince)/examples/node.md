# MSW Server Worker Examples

> Server worker setup for Node.js test environment. Reference from [SKILL.md](../SKILL.md).

**Related examples:**
- [core.md](core.md) - Package configuration, mock data, variant handlers
- [browser.md](browser.md) - Browser worker for development
- [testing.md](testing.md) - Per-test handler overrides
- [advanced.md](advanced.md) - Variant switching, network latency

---

## Server Worker Setup

```typescript
// packages/api-mocks/src/server-worker.ts
// Good Example
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const serverWorker = setupServer(...handlers);
```

**Why good:** Uses `setupServer` from `msw/node` for Node environment, matches browser worker pattern for consistency

```typescript
// Bad Example
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const serverWorker = setupWorker(...handlers);
```

**Why bad:** `setupWorker` requires browser APIs (service worker) that don't exist in Node causing test failures, will throw "navigator is not defined" errors in test environment

---

## Test Setup

```typescript
// apps/client-react/src/setup-tests.ts
// Good Example
import { serverWorker } from "@repo/api-mocks/serverWorker";

// Use your test runner's lifecycle hooks
beforeAll(() => serverWorker.listen());
afterEach(() => serverWorker.resetHandlers());
afterAll(() => serverWorker.close());
```

**Why good:** `beforeAll` starts server once for all tests (performance), `afterEach` resets handlers preventing test pollution from overrides, `afterAll` cleans up resources, follows MSW recommended lifecycle

```typescript
// Bad Example - Missing resetHandlers
import { serverWorker } from "@repo/api-mocks/serverWorker";

beforeAll(() => serverWorker.listen());
afterAll(() => serverWorker.close());
// Missing: afterEach(() => serverWorker.resetHandlers());
```

**Why bad:** Missing `resetHandlers` in `afterEach` means handler overrides from one test leak into subsequent tests causing flaky failures, tests become order-dependent breaking test isolation

---

_Related examples: [core.md](core.md) | [browser.md](browser.md) | [testing.md](testing.md) | [advanced.md](advanced.md)_
