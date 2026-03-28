---
name: web-testing-vitest
description: Vitest test runner - configuration, assertions, mocking (vi.fn, vi.mock, vi.spyOn), fake timers, snapshot testing, coverage, workspace projects
---

# Vitest Test Runner Patterns

> **Quick Guide:** Vitest is a fast, Vite-native test runner. Use `describe`/`it`/`expect` for test structure, `vi.fn()` for mocks, `vi.mock()` for module mocking, `vi.spyOn()` for spying. Co-locate tests with code. Use network-level API mocking over module-level mocks. Vitest v4 is current stable (requires Vite 6+, Node 20+).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST co-locate tests with code in feature-based structure - NOT in separate test directories)**

**(You MUST use network-level API mocking - NOT module-level mocks where possible)**

**(You MUST use named constants for test data - no magic strings or numbers in test files)**

**(You MUST use `vi.fn()` for mocks and `vi.spyOn()` for spying - NEVER manually replace functions)**

**(You MUST use the v3+ test options syntax: `test("name", { timeout: 10_000 }, () => {})` - NOT as third argument)**

</critical_requirements>

---

**Auto-detection:** Vitest, vi.fn, vi.mock, vi.spyOn, describe, it, expect, test, beforeEach, afterEach, vi.useFakeTimers, vitest.config, defineConfig, coverage, snapshot, mockResolvedValue, mockRejectedValue

**When to use:**

- Configuring and running tests with Vitest
- Writing unit tests for pure functions
- Writing integration tests with network-level mocking
- Mocking modules, functions, and timers
- Snapshot testing
- Configuring coverage, workspaces, and projects

**When NOT to use:**

- E2E browser testing (use your E2E testing tool)
- Component rendering and querying (use your component testing library)
- Testing third-party library behavior (library already has tests)
- Testing TypeScript compile-time guarantees (TypeScript already enforces)

**Key patterns covered:**

- Test structure and organization (describe, it, expect)
- Mocking (vi.fn, vi.mock, vi.spyOn, vi.mockObject)
- Fake timers (vi.useFakeTimers, vi.advanceTimersByTime)
- Network-level API mocking for integration tests
- Feature-based test organization (co-located with code)
- Configuration (vitest.config, projects, coverage)
- Vitest v3/v4 migration and breaking changes

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Unit test examples, pure functions
- [examples/integration.md](examples/integration.md) - Integration tests with network-level mocking
- [examples/anti-patterns.md](examples/anti-patterns.md) - What NOT to test
- [reference.md](reference.md) - Vitest v3/v4 migration notes, decision frameworks

---

<philosophy>

## Philosophy

Vitest is a Vite-native test runner designed for speed and developer experience. It provides Jest-compatible APIs with native ESM support, TypeScript out of the box, and Vite's transform pipeline.

**Core Principles:**

1. **Co-locate tests with code** - Tests live next to the code they test for discoverability and maintenance
2. **Network-level mocking over module mocking** - Mock at the HTTP boundary, not at import boundaries
3. **Named constants for all test data** - No magic strings or numbers in test files
4. **Test behavior, not implementation** - Focus on inputs and outputs, not internal state
5. **Fast feedback loops** - Leverage Vitest's HMR-based watch mode for instant re-runs

**When to use Vitest:**

- Unit testing pure functions (business logic, utilities, formatters)
- Integration testing with network-level API mocking
- Snapshot testing for serializable outputs
- Any test that doesn't require a real browser

**When NOT to use Vitest:**

- Browser-based E2E testing (use your E2E testing tool)
- Visual regression testing (use your visual testing tool)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Unit Testing Pure Functions

Write unit tests for pure functions with no side effects. Focus on clear input/output behavior.

**What to test:**

- Pure functions with clear input -> output
- Business logic calculations (pricing, taxes, discounts)
- Data transformations and formatters
- Edge cases and boundary conditions

See [examples/core.md](examples/core.md) for pure function test examples.

---

### Pattern 2: Integration Testing with Network-Level Mocking

Use Vitest with network-level API mocking to test components with their API integration layer.

**When Integration Tests Make Sense:**

- Component behavior in isolation (form validation, UI state)
- Testing edge cases that are hard to reproduce in E2E
- Development workflow (faster than spinning up full stack)

**Key Pattern:**

- Tests in `__tests__/` directories co-located with code
- Network-level API mocking (intercepts HTTP requests)
- Centralized mock data in shared package
- Test all states: loading, empty, error, success

See [examples/integration.md](examples/integration.md) for integration test examples.

---

### Pattern 3: Feature-Based Test Organization

Co-locate tests with code in feature-based structure. Tests live next to what they test.

**Direct Co-location (Recommended):**

```
src/
  features/
    auth/
      components/
        login-form.tsx
        login-form.test.tsx        # Test next to component
      hooks/
        use-auth.ts
        use-auth.test.ts           # Test next to hook
```

**Alternative: `__tests__/` Subdirectories:**

```
src/features/auth/
  components/
    login-form.tsx
    __tests__/
      login-form.test.tsx
```

**E2E Test Organization:**

```
tests/
  e2e/
    auth/
      login-flow.spec.ts
      register-flow.spec.ts
    checkout/
      checkout-flow.spec.ts
```

**File Naming Convention:**

- `*.test.tsx` / `*.test.ts` for unit and integration tests

**Choose one pattern and be consistent across the codebase.**

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Module-level mocking (`vi.mock`) instead of network-level - breaks when import structure changes, doesn't test serialization
- Only testing happy paths - error states go untested until users report them
- Not using named constants for test data - magic strings and numbers make tests unreadable

**Medium Priority Issues:**

- Mocks that don't match real API - tests pass but production fails because mocks drifted
- Complex mocking setup - simplify or test at a higher level
- Not resetting mocks between tests - causes cross-test pollution

**Gotchas & Edge Cases:**

- Network mock handlers are typically global - reset handlers after each test to prevent pollution
- **Vitest v3+:** Test options must be second argument: `test("name", { timeout: 10_000 }, () => {})` NOT `test("name", () => {}, { timeout: 10_000 })`
- **Vitest v4:** Multiple mock behavior changes (getMockName, restoreAllMocks, automocked getters) - see [reference.md](reference.md) for full v4 migration notes
- `vi.fn().mock.invocationCallOrder` starts at `1` in v4 instead of `0`
- `vi.restoreAllMocks()` only affects manual spies in v4, not automocks - use `vi.resetAllMocks()` for full reset

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST co-locate tests with code in feature-based structure - NOT in separate test directories)**

**(You MUST use network-level API mocking - NOT module-level mocks where possible)**

**(You MUST use named constants for test data - no magic strings or numbers in test files)**

**(You MUST use `vi.fn()` for mocks and `vi.spyOn()` for spying - NEVER manually replace functions)**

**(You MUST use the v3+ test options syntax: `test("name", { timeout: 10_000 }, () => {})` - NOT as third argument)**

**Failure to follow these rules will result in fragile tests that break on refactoring and false confidence from poorly structured test suites.**

</critical_reminders>
