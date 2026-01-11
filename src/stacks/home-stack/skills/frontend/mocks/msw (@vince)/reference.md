# MSW Mocking Reference

> Decision frameworks, red flags, and anti-patterns for API mocking with MSW.

---

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

---

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
- ⚠️ **Top-level import of browser worker in SSR frameworks** - Build failures due to service worker APIs
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
- Dynamic imports in SSR frameworks are required for browser-only code to avoid server bundling issues

---

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
import { serverWorker } from "@repo/api-mocks/serverWorker";

// In your test setup file
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
