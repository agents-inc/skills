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
│   ├─ YES → Per-test handler overrides with server.use()
│   └─ NO → Default handlers sufficient
├─ Need to change mock behavior without restarting?
│   ├─ YES → Variant switching + runtime control
│   └─ NO → Static handlers fine
└─ Need realistic network conditions?
    ├─ YES → Add delay() to handlers
    └─ NO → Instant responses
```

**Choosing between approaches:**

- **Handler variants**: Use when testing multiple scenarios (empty, error states)
- **Per-test overrides**: Use when specific tests need different responses
- **Runtime switching**: Use in development for UI exploration
- **Network delay**: Use when testing loading states or race conditions

---

## RED FLAGS

**High Priority Issues:**

- ❌ **Using `setupWorker` in Node tests or `setupServer` in browser** - Wrong API for environment causes cryptic failures
- ❌ **Not resetting handlers between tests** - Test pollution and order-dependent failures
- ❌ **Mixing handlers and mock data in same file** - Reduces reusability and violates separation of concerns
- ❌ **Missing `await` when starting browser worker before render** - Race conditions cause intermittent failures

**Medium Priority Issues:**

- ⚠️ **Only testing happy path (missing empty/error variants)** - Incomplete test coverage
- ⚠️ **Hardcoded HTTP status codes (magic numbers)** - Use named constants
- ⚠️ **Top-level import of browser worker in SSR frameworks** - Build failures due to service worker APIs
- ⚠️ **No `onUnhandledRequest` configuration** - Unclear which requests are mocked vs real

**Gotchas & Edge Cases:**

- `delay()` with no arguments applies a random 100-400ms delay in the browser, but is automatically negated in Node.js to avoid slowing tests. Use an explicit duration if you actually need delay in tests.
- Handler overrides with `server.use()` persist until `resetHandlers()` is called -- they do NOT reset automatically between tests.
- Browser worker doesn't work in Node environment and vice versa -- check your imports.
- Dynamic imports are required for browser-only code in SSR frameworks to avoid server bundling issues.
- `http.all()` intercepts any HTTP method on a path -- useful for catch-all handlers but can mask bugs if overused.
- The `once: true` option on a handler makes it match only the first request, useful for testing sequential responses.

---

## Anti-Patterns

### Wrong MSW API for Environment

```typescript
// ❌ setupServer in browser
import { setupServer } from "msw/node";
export const browserWorker = setupServer(...handlers);

// ❌ setupWorker in Node tests
import { setupWorker } from "msw/browser";
export const server = setupWorker(...handlers);
```

**Why it's wrong:** `setupWorker` requires browser service worker APIs, `setupServer` requires Node APIs -- wrong API causes cryptic runtime errors.

---

### Missing Handler Reset Between Tests

```typescript
// ❌ No resetHandlers
beforeAll(() => server.listen());
afterAll(() => server.close());
// Missing: afterEach(() => server.resetHandlers());
```

**Why it's wrong:** Handler overrides from one test leak into subsequent tests causing flaky failures and order-dependent behavior.

---

### Mock Data Embedded in Handlers

```typescript
// ❌ Data inside handler
export const getFeaturesHandler = http.get("api/v1/features", () => {
  return HttpResponse.json({
    features: [{ id: "1", name: "Dark mode" }],
  });
});
```

**Why it's wrong:** Mock data cannot be reused in other tests or handlers, no type checking against API schema.

---

### Rendering Before MSW Ready

```typescript
// ❌ Missing await
if (import.meta.env.DEV) {
  browserWorker.start({ onUnhandledRequest: "bypass" }); // No await!
}
createRoot(document.getElementById("root")!).render(<App />);
```

**Why it's wrong:** Race condition where app renders before MSW is ready causes first requests to fail unpredictably.
