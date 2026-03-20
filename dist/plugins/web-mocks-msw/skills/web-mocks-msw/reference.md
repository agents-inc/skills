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

Each anti-pattern below has a full good/bad code example in the linked example file.

- **Wrong MSW API for environment** -- `setupWorker` in Node or `setupServer` in browser causes cryptic runtime errors. See [browser.md Pattern 7](examples/browser.md).
- **Missing handler reset between tests** -- Omitting `afterEach(() => server.resetHandlers())` causes test pollution and order-dependent failures. See [core.md Pattern 3](examples/core.md).
- **Mock data embedded in handlers** -- Data inside handlers cannot be reused or type-checked against API schema. See [core.md Pattern 1](examples/core.md).
- **Rendering before MSW ready** -- Missing `await` on `browserWorker.start()` causes race conditions. See [browser.md Pattern 8](examples/browser.md).
