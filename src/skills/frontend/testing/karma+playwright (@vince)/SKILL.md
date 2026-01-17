---
name: frontend/testing+karma+playwright (@vince)
description: Karma, Mocha, Chai, Sinon for unit tests, Playwright E2E with custom fixtures and Page Object Model
---

# Frontend Testing Patterns - Photoroom Webapp

> **Quick Guide:** Unit tests use Karma + Mocha + Chai (NOT Jest/Vitest). Use Chai assertion syntax (`to.equal`, `to.deep.equal`, `to.have.been.called`). Sinon for mocking with mandatory sandbox cleanup. Mock store factories for dependency injection. E2E tests use Playwright with custom fixtures and Page Object Model. Import from `fixtures` not `@playwright/test`.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase test files matching source, named exports, import ordering, `import type`, named constants)

**(You MUST use Chai assertion syntax - NOT Jest/Vitest syntax (`.toBe()` vs `.to.equal()`))**

**(You MUST use Sinon sandbox with cleanup in `afterEach` - NEVER use `sinon.stub()` directly)**

**(You MUST call `queryClient.clear()` in `beforeEach` for tests using React Query)**

**(You MUST import `test` and `expect` from `fixtures` in E2E tests - NOT from `@playwright/test`)**

**(You MUST use Page Object Model (POM) pattern for E2E test interactions)**

</critical_requirements>

---

**Auto-detection:** Karma, Mocha, Chai, Sinon, unit test, test file, `.test.ts`, sandbox, mock store, Playwright, E2E, end-to-end, `.e2e.ts`, fixtures, POM, page object

**When to use:**

- Writing unit tests for stores, utilities, or hooks
- Setting up test mocks with Sinon sandbox
- Creating mock store factories for dependency injection
- Writing Playwright E2E tests with custom auth fixtures
- Using Page Object Model for E2E interactions

**When NOT to use:**

- Integration testing (use E2E instead)
- Component rendering tests (use Storybook for visual testing)
- API endpoint testing (use apps/image-editing-api patterns)

**Key patterns covered:**

- Karma + Mocha + Chai test framework (NOT Jest/Vitest)
- Chai assertion syntax (`to.equal`, `to.deep.equal`, `to.have.been.called`)
- Sinon sandbox pattern with mandatory cleanup
- Mock store factories with partial dependencies
- Test setup (WASM initialization, queryClient.clear)
- Playwright E2E configuration and custom fixtures
- Page Object Model (POM) pattern
- Auth state fixtures (proContext, proPage)

**Detailed Resources:**

- For code examples, see [examples/core.md](examples/core.md) (always load first)
  - [examples/mock-stores.md](examples/mock-stores.md) - Mock store factories, test setup
  - [examples/playwright-config.md](examples/playwright-config.md) - E2E configuration, auth fixtures
  - [examples/page-objects.md](examples/page-objects.md) - E2E structure, Page Object Model
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

Testing in the Photoroom webapp follows a clear separation: **unit tests** for stores, utilities, and isolated logic; **E2E tests** for user flows and integration. The codebase uses Karma + Mocha + Chai for unit tests (NOT Jest/Vitest) and Playwright for E2E tests.

**Unit Testing Principles:**

1. **Chai assertions** - Use `.to.equal()`, `.to.deep.equal()`, `.to.have.been.called`
2. **Sinon sandboxes** - Always use sandbox for mocking with cleanup in `afterEach`
3. **Mock store factories** - Create test stores with partial dependency injection
4. **Isolated tests** - Clear queryClient and sandbox between tests

**E2E Testing Principles:**

1. **Custom fixtures** - Import from `fixtures`, not `@playwright/test`
2. **Page Object Model** - Encapsulate page interactions in POM classes
3. **Auth state fixtures** - Use `proContext`/`proPage` for authenticated tests
4. **Parallel execution** - Tests run in parallel with worker isolation

**When to use unit tests:**

- MobX store actions and computed properties
- Utility functions and helpers
- Hooks with complex logic
- State machine transitions

**When to use E2E tests:**

- User authentication flows
- Critical user journeys (create, edit, export)
- Cross-page navigation
- API integration verification

</philosophy>

---

<decision_framework>

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

See [reference.md](reference.md) for Mock Strategy and E2E Test Organization decision trees.

</decision_framework>

---

<patterns>

## Core Patterns

### Pattern 1: Chai Assertion Syntax

The webapp uses Chai assertions with Mocha. Use Chai syntax exclusively for unit tests.

Key differences from Jest/Vitest:
- Equality: `to.equal()` not `toBe()`
- Deep equality: `to.deep.equal()` not `toEqual()`
- Boolean checks: `to.be.true` / `to.be.false`
- Null/undefined: `to.be.null` / `to.be.undefined`
- Function calls (sinon-chai): `to.have.been.called` / `to.have.been.calledWith()`

See [examples/core.md](examples/core.md#pattern-1-chai-assertion-syntax) for complete syntax reference.

---

### Pattern 2: Sinon Sandbox with Cleanup

Use Sinon sandbox for all mocking. Create sandbox in test setup, restore in `afterEach`.

- Create sandbox in `beforeEach`
- Restore sandbox in `afterEach` (mandatory)
- Use `sandbox.stub()` not `sinon.stub()` directly
- Enables stubbing module methods like `logger.error`

See [examples/core.md](examples/core.md#pattern-2-sinon-sandbox-with-cleanup) for implementation.

---

### Pattern 3: Mock Store Factories

Create test store factories that accept partial dependencies for flexible testing.

- Factory accepts partial dependencies
- Default implementations for all dependencies
- Test-specific implementations (e.g., TestFirebaseAuth)
- Use `when()` from MobX to await observable conditions

See [examples/mock-stores.md](examples/mock-stores.md#pattern-1-mock-store-factories) for factory pattern implementation.

---

### Pattern 4: Test Setup with WASM and QueryClient

Tests requiring the engine need WASM initialization. Tests using React Query need `queryClient.clear()`.

- WASM initialization once in `before` (expensive operation)
- `queryClient.clear()` in `beforeEach` (prevents test pollution)
- Each test starts with fresh query state

See [examples/mock-stores.md](examples/mock-stores.md#pattern-2-test-setup-with-wasm-and-queryclient) for setup code.

---

### Pattern 5: Test File Organization

Tests live in two locations: co-located with source files or in `src/tests/` for integration tests.

```
src/
  stores/
    AuthStore.ts
    AuthStore.test.ts         # Co-located unit test
  utils/
    url.ts
    url.test.ts               # Co-located utility test
  tests/
    setup.ts                  # Global test setup
    AuthStore.test.ts         # Integration test

e2e/
  fixtures/
    index.ts                  # Fixture exports
    auth.ts                   # Auth fixtures
  pom/
    index.ts                  # POM exports
    webapp.ts                 # Main webapp POM
  auth.e2e.ts                 # Auth E2E tests
  editor.e2e.ts               # Editor E2E tests
```

---

### Pattern 6: Playwright E2E Configuration

E2E tests use Playwright with specific configuration for the webapp.

Key configuration:
- Named constants for timeouts (3 minutes test, 60 seconds expect)
- CI-specific retry and failure behavior
- Screenshot thresholds for visual regression
- Parallel execution with worker limits
- Trace on failure for debugging

See [examples/playwright-config.md](examples/playwright-config.md#pattern-1-playwright-e2e-configuration) for config file.

---

### Pattern 7: Custom Auth Fixtures

E2E tests use custom fixtures for authenticated states. Import from `fixtures`, not `@playwright/test`.

- `proContext` / `proPage` for Pro user
- `freeContext` / `freePage` for Free user
- Clipboard permissions for export tests
- Proper cleanup with `context.close()`

See [examples/playwright-config.md](examples/playwright-config.md#pattern-2-custom-auth-fixtures) for fixture implementation.

---

### Pattern 8: E2E Test Structure

E2E tests import from fixtures and use Page Object Model for interactions.

- Import from `fixtures` not `@playwright/test`
- Use fixture pages (`proPage`, `freePage`, `page`)
- Use POM helpers (`openApp`, `webapp.editor.selectTool`)
- Await network responses with `page.waitForResponse()`

See [examples/page-objects.md](examples/page-objects.md#pattern-1-e2e-test-structure) for test examples.

---

### Pattern 9: Page Object Model (POM)

Encapsulate page interactions in POM classes for maintainability and reuse.

- Webapp class composes page-specific POMs
- Locators defined once in constructor
- Async methods for actions
- Helper function `openApp()` reduces boilerplate

See [examples/page-objects.md](examples/page-objects.md#pattern-2-page-object-model-pom) for POM implementation.

</patterns>

---

<red_flags>

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
- Not using POM for E2E tests - duplicated selectors, harder to maintain

**Common Mistakes:**

- `expect(value).toBe("x")` instead of `expect(value).to.equal("x")`
- `expect(fn).toHaveBeenCalled()` instead of `expect(fn).to.have.been.called`
- Forgetting to await `when()` for MobX observables
- Using `page` fixture when `proPage` needed for auth

**Gotchas & Edge Cases:**

- Chai uses `.to.be.true` not `.to.be(true)` - the boolean without parentheses
- `to.have.been.called` not `to.be.called` for sinon-chai spy assertions
- `when()` returns a promise - must be awaited
- Playwright's `expect` is different from Chai's `expect` - check file type
- E2E auth state files must exist before running tests (`./e2e/.auth/pro.json`)

See [reference.md](reference.md) for comprehensive anti-patterns and integration guide.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Chai assertion syntax - NOT Jest/Vitest syntax (`.toBe()` vs `.to.equal()`))**

**(You MUST use Sinon sandbox with cleanup in `afterEach` - NEVER use `sinon.stub()` directly)**

**(You MUST call `queryClient.clear()` in `beforeEach` for tests using React Query)**

**(You MUST import `test` and `expect` from `fixtures` in E2E tests - NOT from `@playwright/test`)**

**(You MUST use Page Object Model (POM) pattern for E2E test interactions)**

**Failure to follow these rules will cause test failures, flaky tests from pollution, and missing auth fixtures in E2E tests.**

</critical_reminders>
