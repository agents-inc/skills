---
name: frontend/mocks (@vince)
description: Sinon sandbox, mock stores, TestFirebaseAuth, ampliMock for Photoroom webapp testing
---

# Frontend Mocking Patterns (Photoroom Webapp)

> **Quick Guide:** Use Sinon sandbox pattern for test isolation. Create mock store factories with partial dependencies via dependency injection. Use TestFirebaseAuth for auth mocking, ampliMock for analytics, and MobX `when()` for async assertions. Always restore sandbox in afterEach.

**Detailed Resources:**

- For code examples, see [examples/](examples/) folder:
  - [core.md](examples/core.md) - Dependency injection, Sinon sandbox, mock store factories
  - [firebase-auth.md](examples/firebase-auth.md) - TestFirebaseAuth implementation and usage
  - [analytics-mocking.md](examples/analytics-mocking.md) - ampliMock for analytics testing
  - [async-testing.md](examples/async-testing.md) - MobX when() and NotificationsStore mocking
  - [complete-example.md](examples/complete-example.md) - Full AuthStore test reference
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase stores, named exports, import ordering, `import type`, named constants)

**(You MUST create a Sinon sandbox in describe scope and call sandbox.restore() in afterEach - prevents test pollution)**

**(You MUST use mock store factories with partial dependencies - never instantiate stores directly in tests)**

**(You MUST use TestFirebaseAuth for Firebase auth mocking - never mock Firebase SDK directly)**

**(You MUST use MobX when() for async assertions - never use arbitrary timeouts or setTimeout)**

**(You MUST use Chai assertion syntax (to.equal, to.be.true) - NOT Jest syntax (toBe, toEqual))**

</critical_requirements>

---

**Auto-detection:** sinon sandbox, mock store, TestFirebaseAuth, ampliMock, test factory, MobX when, NotificationsStore mock, dependency injection testing

**When to use:**

- Writing unit tests for MobX stores
- Mocking Firebase authentication in tests
- Creating test doubles for analytics (ampli)
- Testing stores with injected dependencies
- Waiting for async MobX state changes in tests
- Isolating tests with sandbox pattern

**When NOT to use:**

- E2E tests (use Playwright fixtures instead)
- Testing React components with DOM (use React Testing Library)
- Integration tests with real backend (use test environment)

**Key patterns covered:**

- Sinon sandbox pattern for stub isolation
- Mock store factories with partial dependencies
- TestFirebaseAuth for Firebase auth testing
- ampliMock for analytics mocking
- NotificationsStore mocking
- MobX when() for async state assertions
- Cleanup patterns (sandbox.restore())
- Dependency injection enabling testability

---

<philosophy>

## Philosophy

The Photoroom webapp testing approach leverages **dependency injection** in MobX stores to enable clean mocking. Each store receives its dependencies via constructor, making it easy to inject test doubles.

**Core Testing Principles:**

1. **Sandbox Isolation**: Every test suite creates a Sinon sandbox. Stubs are restored in afterEach to prevent cross-test pollution.
2. **Factory Pattern**: Mock store factories accept partial dependencies, providing sensible defaults for unmocked dependencies.
3. **Test Doubles Over Mocking SDK**: Use pre-built test doubles (TestFirebaseAuth, ampliMock) instead of stubbing complex SDKs.
4. **Async Assertions with when()**: MobX `when()` waits for observable conditions, eliminating flaky timeout-based tests.

**Why Dependency Injection Matters:**

Testable stores receive dependencies via constructor, allowing tests to inject mocks. This pattern enables focused testing of specific behaviors without complex SDK stubbing.

For implementation details, see [examples/core.md](examples/core.md).

**When to mock:**

- External services (Firebase, Analytics)
- API calls (provide mock functions)
- Side effects (notifications, logging)
- Time-dependent operations

**When NOT to mock:**

- The code under test itself
- Simple utility functions
- MobX reactivity (let it work naturally)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Sinon Sandbox for Test Isolation

Create a Sinon sandbox at describe scope. Call sandbox.restore() in afterEach to clean up stubs between tests.

Key principles:

- Sandbox groups related stubs for easy cleanup
- afterEach ensures stubs are restored even if test fails
- Prevents test pollution where one test's stubs affect another

For code examples, see [examples/core.md](examples/core.md#sinon-sandbox-pattern).

---

### Pattern 2: Mock Store Factories with Partial Dependencies

Create factory functions that accept partial dependencies and provide sensible defaults. This enables focused testing of specific behaviors.

Key principles:

- Partial dependencies allow tests to override only what they need
- Defaults provide working test doubles for unrelated dependencies
- Each test gets fresh instances preventing state leakage
- Factory pattern centralizes test setup logic

For implementation examples, see [examples/core.md](examples/core.md#mock-store-factories).

---

### Pattern 3: TestFirebaseAuth for Authentication Testing

Use TestFirebaseAuth class to simulate Firebase auth states without the real Firebase SDK.

Key principles:

- Full control over auth state via simulateSignIn/simulateSignOut
- Implements same interface as real Firebase auth
- No need to mock complex Firebase SDK internals
- Always await async state propagation with when()

For code examples, see [examples/firebase-auth.md](examples/firebase-auth.md).

---

### Pattern 4: ampliMock for Analytics Testing

Use ampliMock to verify analytics events without sending real data.

Key principles:

- Captures event calls for verification
- getCalls() returns copy preventing mutation
- Reset in afterEach ensures clean state
- Verifies event order and properties

For implementation examples, see [examples/analytics-mocking.md](examples/analytics-mocking.md).

---

### Pattern 5: MobX when() for Async Assertions

Use MobX `when()` to wait for observable conditions instead of arbitrary timeouts.

Key principles:

- Waits for exact observable condition
- No arbitrary delays or flaky timing
- Timeout option catches stuck states
- Works naturally with MobX reactivity
- Always await when() calls

For code examples, see [examples/async-testing.md](examples/async-testing.md#mobx-when-for-async-assertions).

---

### Pattern 6: NotificationsStore Mocking

Create fresh NotificationsStore instances for each test to verify user feedback.

Key principles:

- Fresh store per test prevents notification leakage
- Can verify notification type, label, and count
- Tests user feedback not just internal state

For implementation examples, see [examples/async-testing.md](examples/async-testing.md#notificationsstore-mocking).

---

### Pattern 7: Complete Test File Structure

Following the established patterns, a complete test file structure combines sandbox isolation, factory functions, and async assertions.

For complete example, see [examples/complete-example.md](examples/complete-example.md).

</patterns>

---

<integration>

## Integration Guide

**Works with:**

- **MobX Stores**: Test stores via dependency injection; use when() for async assertions
- **Sinon**: sandbox.stub() for function mocking; sandbox.restore() for cleanup
- **Chai**: Assertion library with to.equal, to.be.true syntax (NOT Jest)
- **Firebase Auth**: TestFirebaseAuth simulates auth state changes
- **Analytics (Ampli)**: ampliMock captures event calls for verification
- **NotificationsStore**: Fresh instances per test to verify user feedback

**Test Framework:**

- **Karma + Mocha**: Test runner (NOT Jest/Vitest)
- **Chai**: Assertions (to.equal NOT toBe)
- **Sinon**: Mocking (createSandbox NOT jest.fn())

**Common Test Imports:**

```typescript
import sinon from "sinon";
import { expect } from "chai";
import { when } from "mobx";
```

**Use these patterns:**

- Chai assertion syntax (to.equal, to.be.true)
- MobX when() for async assertions
- Fresh store instances per test
- TestFirebaseAuth for auth testing

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (PascalCase stores, named exports, import ordering)

**(You MUST create a Sinon sandbox in describe scope and call sandbox.restore() in afterEach - prevents test pollution)**

**(You MUST use mock store factories with partial dependencies - never instantiate stores directly in tests)**

**(You MUST use TestFirebaseAuth for Firebase auth mocking - never mock Firebase SDK directly)**

**(You MUST use MobX when() for async assertions - never use arbitrary timeouts or setTimeout)**

**(You MUST use Chai assertion syntax (to.equal, to.be.true) - NOT Jest syntax (toBe, toEqual))**

**Failure to follow these rules will cause flaky tests, test pollution, and false positives/negatives.**

</critical_reminders>
