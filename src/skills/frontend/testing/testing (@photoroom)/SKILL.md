---
name: frontend/testing (@photoroom)
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

- For code examples, see [examples.md](examples.md)
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

See [examples.md](examples.md#chai-assertion-syntax) for complete syntax reference.

---

### Pattern 2: Sinon Sandbox with Cleanup

Use Sinon sandbox for all mocking. Create sandbox in test setup, restore in `afterEach`.

- Create sandbox in `beforeEach`
- Restore sandbox in `afterEach` (mandatory)
- Use `sandbox.stub()` not `sinon.stub()` directly
- Enables stubbing module methods like `logger.error`

See [examples.md](examples.md#sinon-sandbox-with-cleanup) for implementation.

---

### Pattern 3: Mock Store Factories

Create test store factories that accept partial dependencies for flexible testing.

- Factory accepts partial dependencies
- Default implementations for all dependencies
- Test-specific implementations (e.g., TestFirebaseAuth)
- Use `when()` from MobX to await observable conditions

See [examples.md](examples.md#mock-store-factories) for factory pattern implementation.

---

### Pattern 4: Test Setup with WASM and QueryClient

Tests requiring the engine need WASM initialization. Tests using React Query need `queryClient.clear()`.

- WASM initialization once in `before` (expensive operation)
- `queryClient.clear()` in `beforeEach` (prevents test pollution)
- Each test starts with fresh query state

See [examples.md](examples.md#test-setup-with-wasm-and-queryclient) for setup code.

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

See [examples.md](examples.md#playwright-e2e-configuration) for config file.

---

### Pattern 7: Custom Auth Fixtures

E2E tests use custom fixtures for authenticated states. Import from `fixtures`, not `@playwright/test`.

- `proContext` / `proPage` for Pro user
- `freeContext` / `freePage` for Free user
- Clipboard permissions for export tests
- Proper cleanup with `context.close()`

See [examples.md](examples.md#custom-auth-fixtures) for fixture implementation.

---

### Pattern 8: E2E Test Structure

E2E tests import from fixtures and use Page Object Model for interactions.

- Import from `fixtures` not `@playwright/test`
- Use fixture pages (`proPage`, `freePage`, `page`)
- Use POM helpers (`openApp`, `webapp.editor.selectTool`)
- Await network responses with `page.waitForResponse()`

See [examples.md](examples.md#e2e-test-structure) for test examples.

---

### Pattern 9: Page Object Model (POM)

Encapsulate page interactions in POM classes for maintainability and reuse.

- Webapp class composes page-specific POMs
- Locators defined once in constructor
- Async methods for actions
- Helper function `openApp()` reduces boilerplate

See [examples.md](examples.md#page-object-model-pom) for POM implementation.

</patterns>

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
