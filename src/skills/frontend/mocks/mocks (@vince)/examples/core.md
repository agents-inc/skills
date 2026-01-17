# Core Mocking Patterns

> Essential patterns for all Photoroom webapp tests: dependency injection, Sinon sandbox, and mock store factories. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**
- [firebase-auth.md](firebase-auth.md) - TestFirebaseAuth implementation and usage
- [analytics-mocking.md](analytics-mocking.md) - ampliMock for analytics testing
- [async-testing.md](async-testing.md) - MobX when() and NotificationsStore mocking
- [complete-example.md](complete-example.md) - Full AuthStore test reference

---

## Dependency Injection Pattern

The foundation of testable stores - receive dependencies via constructor.

```typescript
// Testable: dependencies injected via constructor
class AuthStore {
  constructor(dependencies: AuthStoreDependencies) {
    this.#dependencies = dependencies;
  }
}

// In tests: inject mocks
const authStore = new AuthStore({
  firebaseAuth: new TestFirebaseAuth(), // Test double
  fetchAppStartup: async () => ({ courierToken: "test-token" }), // Mock function
});
```

---

## Sinon Sandbox Pattern

### Test Structure

```typescript
// src/tests/MyStore.test.ts
// Good Example
import sinon from "sinon";
import { expect } from "chai";
import { when } from "mobx";

import { MyStore } from "stores/MyStore";

describe("MyStore", () => {
  // Create sandbox at describe scope
  const sandbox = sinon.createSandbox();

  // Clean up after each test
  afterEach(() => {
    sandbox.restore();
  });

  it("should handle async operation", async () => {
    const fetchStub = sandbox.stub().resolves({ data: "test" });
    const store = new MyStore({ fetch: fetchStub });

    await store.loadData();

    expect(fetchStub).to.have.been.calledOnce;
    expect(store.data).to.equal("test");
  });

  it("should track calls with args", () => {
    const callbackStub = sandbox.stub();
    const store = new MyStore({ callback: callbackStub });

    store.doSomething("arg1", "arg2");

    expect(callbackStub).to.have.been.calledWith("arg1", "arg2");
  });
});
```

**Why good:** Sandbox groups related stubs for easy cleanup, afterEach ensures stubs are restored even if test fails, prevents test pollution where one test's stubs affect another

### Bad Examples

```typescript
// Bad Example - Missing sandbox cleanup
describe("MyStore", () => {
  it("should work", () => {
    sinon.stub(api, "fetch").resolves({ data: "test" });
    // Missing restore - pollutes other tests!
  });

  it("another test", () => {
    // api.fetch is still stubbed from previous test!
  });
});

// Bad Example - Cleanup in wrong place
describe("MyStore", () => {
  const sandbox = sinon.createSandbox();

  afterAll(() => {
    sandbox.restore(); // Too late! Should be afterEach
  });
});
```

**Why bad:** Missing restore leaves stubs active for subsequent tests causing flaky failures, afterAll cleanup isolates the suite but not individual tests within it

---

## Mock Store Factories

### Factory Implementation

```typescript
// src/tests/AuthStore.test.ts
// Good Example
import { when } from "mobx";
import { expect } from "chai";

import { AuthStore } from "stores/AuthStore";
import type { AuthStoreDependencies } from "stores/AuthStore";
import { TestFirebaseAuth } from "tests/mocks/TestFirebaseAuth";
import { ampliMock } from "tests/mocks/ampliMock";
import { NotificationsStore } from "@photoroom/ui/src/components/status/Notification/NotificationsStore";

import type { Ampli } from "@photoroom/shared";

// Factory accepts partial dependencies
const makeTestAuthStore = (
  partialDependencies: Partial<AuthStoreDependencies> = {}
): AuthStore => {
  return new AuthStore({
    // Default test doubles for external services
    firebaseAuth: partialDependencies.firebaseAuth ?? new TestFirebaseAuth(),

    // Default mock functions for API calls
    fetchAppStartup: partialDependencies.fetchAppStartup ??
      (async () => ({ courierToken: "test-courier-token" })),

    fetchMagicCode: partialDependencies.fetchMagicCode ??
      (async () => ({ token: "test-magic-code", expiresAt: "2025-12-31" })),

    // Default mocks for services
    ampli: partialDependencies.ampli ?? (ampliMock as Ampli),

    // Create fresh notification store for each test
    notificationsStore: partialDependencies.notificationsStore ??
      new NotificationsStore({
        defaultDuration: 3000,
        maxNotifications: 5,
      }),
  });
};

describe("AuthStore", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("state is in sync with Firebase SDK", async () => {
    // Use default test doubles
    const firebaseAuth = new TestFirebaseAuth();
    const authStore = makeTestAuthStore({ firebaseAuth });

    // Initial state
    expect(authStore.isLoading).to.be.true;
    expect(authStore.isLoggedIn).to.be.false;
    expect(authStore.firebaseUser).to.be.null;

    // Wait for async initialization
    await when(() => !authStore.isLoading);

    expect(authStore.isLoading).to.be.false;
  });

  it("calls fetchAppStartup on login", async () => {
    const fetchAppStartup = sandbox.stub().resolves({ courierToken: "token-123" });
    const firebaseAuth = new TestFirebaseAuth();
    const authStore = makeTestAuthStore({ firebaseAuth, fetchAppStartup });

    // Simulate user login
    firebaseAuth.simulateSignIn({ uid: "user-123", isAnonymous: false });

    await when(() => authStore.courierToken !== null);

    expect(fetchAppStartup).to.have.been.calledOnce;
    expect(authStore.courierToken).to.equal("token-123");
  });
});
```

**Why good:** Partial dependencies allow tests to override only what they need, defaults provide working test doubles for unrelated dependencies, each test gets fresh instances preventing state leakage, factory pattern centralizes test setup logic

### Bad Examples

```typescript
// Bad Example - Inline store creation with all dependencies
it("should work", () => {
  // Must specify ALL dependencies even if not relevant to test
  const store = new AuthStore({
    firebaseAuth: new TestFirebaseAuth(),
    fetchAppStartup: async () => ({ courierToken: "token" }),
    fetchMagicCode: async () => ({ token: "code", expiresAt: "2025" }),
    ampli: ampliMock,
    notificationsStore: new NotificationsStore({ ... }),
    // 10 more dependencies...
  });
});

// Bad Example - Reusing store instances
const sharedStore = makeTestAuthStore();

it("test 1", () => {
  sharedStore.setValue("value1"); // Modifies shared state
});

it("test 2", () => {
  // sharedStore still has "value1" from previous test!
});
```

**Why bad:** Inline creation with all dependencies is verbose and obscures test intent, shared store instances cause test pollution and ordering dependencies
