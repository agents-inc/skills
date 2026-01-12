# Testing Reference

> Decision frameworks, anti-patterns, and red flags. Reference from [SKILL.md](SKILL.md).

---

## Decision Framework

### Unit Test vs E2E Test

```
What am I testing?

Is it a user flow across multiple pages?
|-- YES --> E2E test with Playwright
|-- NO --> Is it testing API integration in the browser?
    |-- YES --> E2E test
    |-- NO --> Is it a store action or computed property?
        |-- YES --> Unit test
        |-- NO --> Is it a utility function?
            |-- YES --> Unit test
            |-- NO --> Is it a hook with complex logic?
                |-- YES --> Unit test with mock dependencies
                |-- NO --> Consider if test is needed
```

### Assertion Syntax Decision

```
Which assertion syntax should I use?

Am I in a unit test file (.test.ts)?
|-- YES --> Chai syntax: expect(x).to.equal(y)
|-- NO --> Am I in an E2E test file (.e2e.ts)?
    |-- YES --> Playwright expect: await expect(locator).toBeVisible()
    |-- NO --> Check file type and use appropriate syntax
```

### Mock Strategy Decision

```
How should I mock this dependency?

Is it a store dependency?
|-- YES --> Use mock store factory with partial dependencies
|-- NO --> Is it a module function?
    |-- YES --> Use sandbox.stub(module, "functionName")
    |-- NO --> Is it an external service?
        |-- YES --> Create test implementation class (like TestFirebaseAuth)
        |-- NO --> Use sandbox.stub() with appropriate return value
```

### E2E Test Organization

```
Where should this E2E test live?

Is it testing a specific feature area?
|-- YES --> Create/use feature-specific file (auth.e2e.ts, editor.e2e.ts)
|-- NO --> Is it a cross-cutting flow?
    |-- YES --> Create flow-specific file (onboarding.e2e.ts)
    |-- NO --> Add to relevant existing file
```

---

## File Organization Reference

### Test File Locations

```
src/
  stores/
    AuthStore.ts
    AuthStore.test.ts         # Co-located unit test
    AppVersionStore.ts
    AppVersionStore.test.ts   # Co-located unit test
  utils/
    url.ts
    url.test.ts               # Co-located utility test
  lib/
    editor/
      helpers/
        color.ts
        color.test.ts         # Co-located helper test
      models/
        Concept.ts
        Concept.test.ts       # Co-located model test
  tests/
    setup.ts                  # Global test setup
    AuthStore.test.ts         # Integration test
    TeamsStore.test.ts        # Integration test

e2e/
  fixtures/
    index.ts                  # Fixture exports
    auth.ts                   # Auth fixtures
  pom/
    index.ts                  # POM exports
    webapp.ts                 # Main webapp POM
    CreatePage.ts             # Create page POM
    Editor.ts                 # Editor POM
    BrandKitPage.ts           # Brand kit POM
  auth.e2e.ts                 # Auth E2E tests
  editor.e2e.ts               # Editor E2E tests
  batch.e2e.ts                # Batch E2E tests
```

**Why good:** Co-located tests are easy to find next to source, `src/tests/` for complex integration tests, E2E tests in dedicated `e2e/` directory, POM classes organized in `e2e/pom/`

### File Naming Convention

```
AuthStore.ts          --> AuthStore.test.ts     (unit test)
url.ts                --> url.test.ts           (unit test)
color.ts              --> color.test.ts         (unit test)

auth.e2e.ts           (E2E test)
editor.e2e.ts         (E2E test)
batch.e2e.ts          (E2E test)
```

**Pattern:**

- `*.test.ts` for unit tests (Karma + Mocha + Chai)
- `*.e2e.ts` for E2E tests (Playwright)
- Test file mirrors implementation filename

---

## Anti-Patterns to Avoid

### Using Jest/Vitest Assertion Syntax

Jest/Vitest assertions will fail with Karma + Chai. Use Chai syntax exclusively.

```typescript
// Avoid - Jest/Vitest syntax
expect(value).toBe("expected");
expect(mockFn).toHaveBeenCalled();
expect(obj).toEqual({ key: "value" });

// Use instead - Chai syntax
expect(value).to.equal("expected");
expect(mockFn).to.have.been.called;
expect(obj).to.deep.equal({ key: "value" });
```

---

### Direct Sinon Stubs Without Sandbox

Stubs without sandbox leak between tests, causing flaky failures.

```typescript
// Avoid - Direct stub without cleanup
it("test 1", () => {
  sinon.stub(api, "fetch"); // Leaks to test 2
});

it("test 2", () => {
  api.fetch(); // Still stubbed from test 1!
});

// Use instead - Sandbox pattern
let sandbox: sinon.SinonSandbox;

beforeEach(() => {
  sandbox = sinon.createSandbox();
});

afterEach(() => {
  sandbox.restore();
});

it("test 1", () => {
  sandbox.stub(api, "fetch"); // Cleaned up after test
});
```

---

### Importing Directly from @playwright/test

Bypasses custom auth fixtures and configuration.

```typescript
// Avoid - Direct Playwright import
import { test, expect } from "@playwright/test";

// Use instead - Custom fixtures
import { test, expect } from "fixtures";
```

---

### Missing queryClient.clear() for React Query Tests

Cached data from previous tests causes false positives.

```typescript
// Avoid - No cache clearing
describe("TeamsStore", () => {
  it("should fetch teams", async () => {
    // May pass due to cached data from previous test
  });
});

// Use instead - Clear cache each test
beforeEach(() => {
  queryClient.clear();
});
```

---

### Hardcoded Dependencies Instead of Factories

Requires full dependency setup for every test.

```typescript
// Avoid - Full dependency specification
const store = new AuthStore({
  firebaseAuth: new TestFirebaseAuth(),
  fetchAppStartup: async () => ({ courierToken: "token" }),
  fetchMagicCode: async () => ({ token: "code", expiresAt: "date" }),
  ampli: mockAmpli,
  notificationsStore: mockNotifications,
});

// Use instead - Factory with defaults
const store = makeTestAuthStore({ fetchAppStartup: customStub });
```

---

### Raw Selectors Instead of POM

Duplicated selectors across tests, harder to maintain.

```typescript
// Avoid - Raw selectors in test
await page.click('[data-testid="upload-button"]');
await page.click('[data-testid="template-grid"] button:first-child');

// Use instead - POM methods
await webapp.createPage.uploadButton.click();
await webapp.createPage.selectTemplate("Portrait");
```

---

### Forgetting to Await MobX when()

Causes race conditions or requires arbitrary setTimeout.

```typescript
// Avoid - Not awaiting when()
when(() => !store.isLoading);
expect(store.data).to.exist; // May fail - loading not complete

// Use instead - Await the condition
await when(() => !store.isLoading);
expect(store.data).to.exist;
```

---

## RED FLAGS

**High Priority Issues:**

- Using Jest/Vitest assertion syntax (`.toBe()`, `.toEqual()`, `.toHaveBeenCalled()`) - tests will fail
- Missing `sandbox.restore()` in `afterEach` - causes test pollution and flaky tests
- Importing `test`/`expect` from `@playwright/test` in E2E files - bypasses custom fixtures
- Missing `queryClient.clear()` for React Query tests - stale cached data causes false positives

**Medium Priority Issues:**

- Direct `sinon.stub()` without sandbox - harder to clean up, potential leaks
- Not using `when()` for MobX conditions - may need arbitrary setTimeout
- Hardcoded test data instead of factories - brittle tests
- Missing `await` for async assertions - tests pass incorrectly
- Not using POM for E2E tests - duplicated selectors, harder to maintain

**Common Mistakes:**

- `expect(value).toBe("x")` instead of `expect(value).to.equal("x")`
- `expect(fn).toHaveBeenCalled()` instead of `expect(fn).to.have.been.called`
- Forgetting to await `when()` for MobX observables
- Not closing browser contexts in E2E fixtures
- Using `page` fixture when `proPage` needed for auth

**Gotchas & Edge Cases:**

- Chai uses `.to.be.true` not `.to.be(true)` - the boolean without parentheses
- `to.have.been.called` not `to.be.called` for sinon-chai spy assertions
- `when()` returns a promise - must be awaited
- Playwright's `expect` is different from Chai's `expect` - check file type
- E2E auth state files must exist before running tests (`./e2e/.auth/pro.json`)
- WASM initialization is async - must complete before engine-related tests

---

## Integration Guide

**Works with:**

- **MobX**: Use `when()` to await observable conditions in tests
- **React Query**: Clear `queryClient` in `beforeEach` to prevent stale data
- **Sinon**: Primary mocking library with sandbox pattern
- **Chai**: Assertion library with natural language syntax
- **Playwright**: E2E testing with custom fixtures

**Test Commands:**

```bash
# Unit tests
cd apps/webapp
pnpm run test           # Run all unit tests
pnpm run test:watch     # Watch mode

# E2E tests
pnpm run e2e            # Run E2E tests
pnpm run e2e:headed     # Run with browser visible
pnpm run e2e:debug      # Debug mode
pnpm run e2e:ui         # Playwright UI mode
```

**Running Specific Tests:**

```bash
# Unit test by file
pnpm run test -- --grep "AuthStore"

# E2E test by file
pnpm run e2e auth.e2e.ts

# E2E test by test name
pnpm run e2e -g "should redirect"
```

**Replaces / Conflicts with:**

- **Jest/Vitest**: NOT used for webapp unit tests - use Chai assertions
- **React Testing Library**: NOT used for component tests - use Storybook or E2E
- **Cypress**: NOT used - Playwright is the E2E framework

---

## Key Testing Patterns Summary

**Unit Test Patterns:**

- Chai assertion syntax (`.to.equal()`, `.to.deep.equal()`)
- Sinon sandbox with mandatory cleanup
- Mock store factories with partial dependencies
- `when()` from MobX to await observable conditions

**E2E Test Patterns:**

- Import from `fixtures` not `@playwright/test`
- Use auth fixtures (`proPage`, `freePage`)
- Page Object Model for maintainability
- `openApp()` helper for consistent setup

**Test Setup Patterns:**

- WASM initialization once in global `before`
- `queryClient.clear()` in each test's `beforeEach`
- `sandbox.restore()` in each test's `afterEach`
