# Frontend Mocking Patterns (Photoroom Webapp)

> **Quick Guide:** Use Sinon sandbox pattern for test isolation. Create mock store factories with partial dependencies via dependency injection. Use TestFirebaseAuth for auth mocking, ampliMock for analytics, and MobX `when()` for async assertions. Always restore sandbox in afterEach.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

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

#### Test Structure

```typescript
// src/tests/MyStore.test.ts
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

```typescript
// ❌ Bad Example - Missing sandbox cleanup
describe("MyStore", () => {
  it("should work", () => {
    sinon.stub(api, "fetch").resolves({ data: "test" });
    // Missing restore - pollutes other tests!
  });

  it("another test", () => {
    // api.fetch is still stubbed from previous test!
  });
});

// ❌ Bad Example - Cleanup in wrong place
describe("MyStore", () => {
  const sandbox = sinon.createSandbox();

  afterAll(() => {
    sandbox.restore(); // Too late! Should be afterEach
  });
});
```

**Why bad:** Missing restore leaves stubs active for subsequent tests causing flaky failures, afterAll cleanup isolates the suite but not individual tests within it

---

### Pattern 2: Mock Store Factories with Partial Dependencies

Create factory functions that accept partial dependencies and provide sensible defaults. This enables focused testing of specific behaviors.

#### Factory Implementation

```typescript
// src/tests/AuthStore.test.ts
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

```typescript
// ❌ Bad Example - Inline store creation with all dependencies
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

// ❌ Bad Example - Reusing store instances
const sharedStore = makeTestAuthStore();

it("test 1", () => {
  sharedStore.setValue("value1"); // Modifies shared state
});

it("test 2", () => {
  // sharedStore still has "value1" from previous test!
});
```

**Why bad:** Inline creation with all dependencies is verbose and obscures test intent, shared store instances cause test pollution and ordering dependencies

---

### Pattern 3: TestFirebaseAuth for Authentication Testing

Use TestFirebaseAuth class to simulate Firebase auth states without the real Firebase SDK.

#### TestFirebaseAuth Implementation

```typescript
// src/tests/mocks/TestFirebaseAuth.ts
import type { TFirebaseAuth, FirebaseUser } from "stores/FirebaseAuth";

type AuthStateCallback = (user: FirebaseUser | null) => void;

export class TestFirebaseAuth implements TFirebaseAuth {
  #currentUser: FirebaseUser | null = null;
  #listeners: AuthStateCallback[] = [];
  #initialized = false;

  // Simulate auth state listener
  onAuthStateChanged = (callback: AuthStateCallback): (() => void) => {
    this.#listeners.push(callback);

    // Firebase fires immediately with current state
    if (this.#initialized) {
      callback(this.#currentUser);
    } else {
      // Simulate async initialization
      setTimeout(() => {
        this.#initialized = true;
        callback(this.#currentUser);
      }, 0);
    }

    // Return unsubscribe function
    return () => {
      this.#listeners = this.#listeners.filter((l) => l !== callback);
    };
  };

  // Test helper: simulate sign in
  simulateSignIn = (user: Partial<FirebaseUser> & { uid: string }) => {
    this.#currentUser = {
      uid: user.uid,
      email: user.email ?? `${user.uid}@test.com`,
      displayName: user.displayName ?? "Test User",
      isAnonymous: user.isAnonymous ?? false,
      getIdToken: async () => `firebase-token-${user.uid}`,
      ...user,
    } as FirebaseUser;
    this.#initialized = true;
    this.#notifyListeners();
  };

  // Test helper: simulate sign out
  simulateSignOut = () => {
    this.#currentUser = null;
    this.#notifyListeners();
  };

  // Test helper: simulate anonymous user
  simulateAnonymousUser = (uid: string = "anon-123") => {
    this.simulateSignIn({ uid, isAnonymous: true });
  };

  signOut = async () => {
    this.simulateSignOut();
  };

  signInWithPopup = async () => {
    this.simulateSignIn({ uid: "google-user-123" });
    return { user: this.#currentUser };
  };

  #notifyListeners = () => {
    this.#listeners.forEach((callback) => callback(this.#currentUser));
  };
}
```

#### Usage in Tests

```typescript
describe("AuthStore", () => {
  it("should handle sign out", async () => {
    const firebaseAuth = new TestFirebaseAuth();
    const authStore = makeTestAuthStore({ firebaseAuth });

    // Start signed in
    firebaseAuth.simulateSignIn({ uid: "user-123" });
    await when(() => authStore.isLoggedIn);

    expect(authStore.isLoggedIn).to.be.true;

    // Sign out
    await authStore.logOut();

    expect(authStore.isLoggedIn).to.be.false;
    expect(authStore.firebaseUser).to.be.null;
  });

  it("should identify anonymous users", async () => {
    const firebaseAuth = new TestFirebaseAuth();
    const authStore = makeTestAuthStore({ firebaseAuth });

    firebaseAuth.simulateAnonymousUser();
    await when(() => !authStore.isLoading);

    expect(authStore.isAnonymous).to.be.true;
    expect(authStore.isLoggedIn).to.be.false; // Anonymous != logged in
  });
});
```

**Why good:** TestFirebaseAuth provides full control over auth state, simulateSignIn/simulateSignOut allow testing state transitions, implements same interface as real Firebase auth, no need to mock complex Firebase SDK internals

```typescript
// ❌ Bad Example - Stubbing Firebase SDK directly
it("should work", () => {
  sandbox.stub(firebase.auth(), "onAuthStateChanged").callsFake((cb) => {
    cb({ uid: "123" }); // Incomplete user object
    return () => {};
  });
  // Complex, fragile, incomplete
});

// ❌ Bad Example - Not waiting for async auth
it("should handle login", () => {
  const firebaseAuth = new TestFirebaseAuth();
  const authStore = makeTestAuthStore({ firebaseAuth });

  firebaseAuth.simulateSignIn({ uid: "123" });

  // BUG: Auth state may not have propagated yet!
  expect(authStore.isLoggedIn).to.be.true; // May fail randomly
});
```

**Why bad:** Direct SDK stubbing is fragile and requires deep knowledge of Firebase internals, not waiting for async state propagation causes flaky tests

---

### Pattern 4: ampliMock for Analytics Testing

Use ampliMock to verify analytics events without sending real data.

#### ampliMock Implementation

```typescript
// src/tests/mocks/ampliMock.ts
import type { Ampli } from "@photoroom/shared";

type EventCall = {
  name: string;
  properties?: Record<string, unknown>;
};

export const createAmpliMock = (): Ampli & {
  getCalls: () => EventCall[];
  reset: () => void;
} => {
  const calls: EventCall[] = [];

  return {
    // Common event methods
    track: (name: string, properties?: Record<string, unknown>) => {
      calls.push({ name, properties });
    },

    identify: (userId: string, properties?: Record<string, unknown>) => {
      calls.push({ name: "identify", properties: { userId, ...properties } });
    },

    // Add other Ampli methods as needed...

    // Test helpers
    getCalls: () => [...calls],
    reset: () => {
      calls.length = 0;
    },
  } as Ampli & { getCalls: () => EventCall[]; reset: () => void };
};

// Default singleton for simple cases
export const ampliMock = createAmpliMock();
```

#### Usage in Tests

```typescript
describe("UserStore", () => {
  const sandbox = sinon.createSandbox();
  let ampli: ReturnType<typeof createAmpliMock>;

  beforeEach(() => {
    ampli = createAmpliMock();
  });

  afterEach(() => {
    sandbox.restore();
    ampli.reset();
  });

  it("should track sign up event", async () => {
    const userStore = makeTestUserStore({ ampli });

    await userStore.signUp({ email: "test@example.com" });

    const calls = ampli.getCalls();
    expect(calls).to.have.length(1);
    expect(calls[0].name).to.equal("user_signed_up");
    expect(calls[0].properties).to.deep.equal({
      email: "test@example.com",
      method: "email",
    });
  });

  it("should track multiple events in order", async () => {
    const userStore = makeTestUserStore({ ampli });

    await userStore.completeOnboarding();

    const calls = ampli.getCalls();
    expect(calls.map((c) => c.name)).to.deep.equal([
      "onboarding_started",
      "onboarding_step_completed",
      "onboarding_finished",
    ]);
  });
});
```

**Why good:** ampliMock captures event calls for verification, getCalls() returns copy preventing mutation, reset() in afterEach ensures clean state, verifies event order and properties

```typescript
// ❌ Bad Example - Not verifying analytics
it("should sign up user", async () => {
  const userStore = makeTestUserStore({ ampli: ampliMock });
  await userStore.signUp({ email: "test@example.com" });
  expect(userStore.isSignedUp).to.be.true;
  // Missing: analytics verification!
});

// ❌ Bad Example - Not resetting between tests
it("test 1", async () => {
  await store.action1();
  expect(ampliMock.getCalls()).to.have.length(1);
});

it("test 2", async () => {
  await store.action2();
  // BUG: getCalls() returns 2 because test 1's call is still there!
  expect(ampliMock.getCalls()).to.have.length(1); // Fails!
});
```

**Why bad:** Skipping analytics verification misses tracking bugs that break product metrics, not resetting mock between tests causes false positives/negatives

---

### Pattern 5: MobX when() for Async Assertions

Use MobX `when()` to wait for observable conditions instead of arbitrary timeouts.

#### Correct Async Testing

```typescript
import { when } from "mobx";

describe("TeamsStore", () => {
  it("should load teams", async () => {
    const fetchTeams = sandbox.stub().resolves([
      { id: "team-1", name: "Team One" },
      { id: "team-2", name: "Team Two" },
    ]);
    const teamsStore = makeTestTeamsStore({ fetchTeams });

    // Start loading
    teamsStore.loadTeams();
    expect(teamsStore.isLoading).to.be.true;

    // Wait for loading to complete using when()
    await when(() => !teamsStore.isLoading);

    expect(teamsStore.teams).to.have.length(2);
    expect(teamsStore.teams[0]?.name).to.equal("Team One");
  });

  it("should handle error state", async () => {
    const fetchTeams = sandbox.stub().rejects(new Error("Network error"));
    const teamsStore = makeTestTeamsStore({ fetchTeams });

    teamsStore.loadTeams();

    // Wait for error state
    await when(() => teamsStore.error !== null);

    expect(teamsStore.error).to.equal("Network error");
    expect(teamsStore.isLoading).to.be.false;
  });

  it("should wait with timeout", async () => {
    const teamsStore = makeTestTeamsStore({
      fetchTeams: () => new Promise((resolve) => setTimeout(resolve, 5000)),
    });

    teamsStore.loadTeams();

    // when() with timeout option
    try {
      await when(() => !teamsStore.isLoading, { timeout: 100 });
      expect.fail("Should have timed out");
    } catch (error) {
      expect(error.message).to.include("WHEN_TIMEOUT");
    }
  });
});
```

**Why good:** when() waits for exact observable condition, no arbitrary delays or flaky timing, timeout option catches stuck states, works naturally with MobX reactivity

```typescript
// ❌ Bad Example - Using setTimeout
it("should load teams", async () => {
  teamsStore.loadTeams();

  // BAD: Arbitrary delay - flaky!
  await new Promise((r) => setTimeout(r, 100));

  expect(teamsStore.teams).to.have.length(2); // May fail if load takes > 100ms
});

// ❌ Bad Example - Polling with setInterval
it("should load teams", async () => {
  teamsStore.loadTeams();

  // BAD: Polling - wasteful and still flaky
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!teamsStore.isLoading) {
        clearInterval(interval);
        resolve();
      }
    }, 10);
  });
});

// ❌ Bad Example - Missing async/await
it("should load teams", () => {
  teamsStore.loadTeams();
  when(() => !teamsStore.isLoading); // Missing await - test passes immediately!
  expect(teamsStore.teams).to.have.length(0); // Wrong assertion passes
});
```

**Why bad:** setTimeout-based waits are flaky and slow (must wait worst-case time), polling is wasteful and still subject to timing issues, missing await causes test to pass before async operation completes

---

### Pattern 6: NotificationsStore Mocking

Create fresh NotificationsStore instances for each test to verify user feedback.

#### Implementation

```typescript
import { NotificationsStore } from "@photoroom/ui/src/components/status/Notification/NotificationsStore";

describe("ExportStore", () => {
  it("should show success notification", async () => {
    const notificationsStore = new NotificationsStore({
      defaultDuration: 3000,
      maxNotifications: 5,
    });
    const exportStore = makeTestExportStore({ notificationsStore });

    await exportStore.exportImage();

    expect(notificationsStore.notifications).to.have.length(1);
    expect(notificationsStore.notifications[0]?.type).to.equal("success");
    expect(notificationsStore.notifications[0]?.label).to.include("export");
  });

  it("should show error notification on failure", async () => {
    const notificationsStore = new NotificationsStore({
      defaultDuration: 3000,
      maxNotifications: 5,
    });
    const exportStore = makeTestExportStore({
      notificationsStore,
      exportApi: sandbox.stub().rejects(new Error("Export failed")),
    });

    await exportStore.exportImage();

    expect(notificationsStore.notifications).to.have.length(1);
    expect(notificationsStore.notifications[0]?.type).to.equal("danger");
  });
});
```

**Why good:** Fresh NotificationsStore per test prevents notification leakage, can verify notification type, label, and count, tests user feedback not just internal state

```typescript
// ❌ Bad Example - Using shared notification store
const sharedNotifications = new NotificationsStore({ ... });

it("test 1", async () => {
  await store1.action();
  expect(sharedNotifications.notifications).to.have.length(1);
});

it("test 2", async () => {
  await store2.action();
  // BUG: Has 2 notifications (1 from test 1 + 1 from test 2)!
  expect(sharedNotifications.notifications).to.have.length(1); // Fails
});

// ❌ Bad Example - Not verifying notifications
it("should handle error", async () => {
  await store.failingAction();
  expect(store.error).to.exist;
  // Missing: Did user get feedback about the error?
});
```

**Why bad:** Shared notification store accumulates notifications across tests, not verifying notifications means users might see silent failures in production

---

### Pattern 7: Complete Test File Structure

Following the established patterns, here's a complete test file structure:

#### Complete Example

```typescript
// src/tests/AuthStore.test.ts
import sinon from "sinon";
import { expect } from "chai";
import { when } from "mobx";

import { AuthStore } from "stores/AuthStore";
import type { AuthStoreDependencies } from "stores/AuthStore";
import { TestFirebaseAuth } from "tests/mocks/TestFirebaseAuth";
import { createAmpliMock } from "tests/mocks/ampliMock";
import { NotificationsStore } from "@photoroom/ui/src/components/status/Notification/NotificationsStore";

import type { Ampli } from "@photoroom/shared";

// Factory with defaults
const makeTestAuthStore = (
  partialDependencies: Partial<AuthStoreDependencies> = {}
): AuthStore => {
  return new AuthStore({
    firebaseAuth: partialDependencies.firebaseAuth ?? new TestFirebaseAuth(),
    fetchAppStartup: partialDependencies.fetchAppStartup ??
      (async () => ({ courierToken: "test-courier-token" })),
    fetchMagicCode: partialDependencies.fetchMagicCode ??
      (async () => ({ token: "test-magic-code", expiresAt: "2025-12-31" })),
    ampli: partialDependencies.ampli ?? (createAmpliMock() as Ampli),
    notificationsStore: partialDependencies.notificationsStore ??
      new NotificationsStore({ defaultDuration: 3000, maxNotifications: 5 }),
  });
};

describe("AuthStore", () => {
  // Sandbox at describe scope
  const sandbox = sinon.createSandbox();

  // Clean up after each test
  afterEach(() => {
    sandbox.restore();
  });

  describe("initialization", () => {
    it("should start in loading state", () => {
      const authStore = makeTestAuthStore();

      expect(authStore.isLoading).to.be.true;
      expect(authStore.isLoggedIn).to.be.false;
    });

    it("should sync with Firebase auth state", async () => {
      const firebaseAuth = new TestFirebaseAuth();
      const authStore = makeTestAuthStore({ firebaseAuth });

      // Wait for initialization
      await when(() => !authStore.isLoading);

      expect(authStore.isLoading).to.be.false;
      expect(authStore.firebaseUser).to.be.null;
    });
  });

  describe("sign in", () => {
    it("should update state when user signs in", async () => {
      const firebaseAuth = new TestFirebaseAuth();
      const authStore = makeTestAuthStore({ firebaseAuth });

      firebaseAuth.simulateSignIn({ uid: "user-123", email: "test@example.com" });

      await when(() => authStore.isLoggedIn);

      expect(authStore.isLoggedIn).to.be.true;
      expect(authStore.firebaseUser?.email).to.equal("test@example.com");
    });

    it("should fetch app startup data on sign in", async () => {
      const firebaseAuth = new TestFirebaseAuth();
      const fetchAppStartup = sandbox.stub().resolves({ courierToken: "token-abc" });
      const authStore = makeTestAuthStore({ firebaseAuth, fetchAppStartup });

      firebaseAuth.simulateSignIn({ uid: "user-123" });

      await when(() => authStore.courierToken !== null);

      expect(fetchAppStartup).to.have.been.calledOnce;
      expect(authStore.courierToken).to.equal("token-abc");
    });

    it("should track sign in analytics", async () => {
      const firebaseAuth = new TestFirebaseAuth();
      const ampli = createAmpliMock();
      const authStore = makeTestAuthStore({ firebaseAuth, ampli: ampli as Ampli });

      firebaseAuth.simulateSignIn({ uid: "user-123" });

      await when(() => authStore.isLoggedIn);

      const calls = ampli.getCalls();
      expect(calls.some((c) => c.name === "user_signed_in")).to.be.true;
    });
  });

  describe("sign out", () => {
    it("should clear state on sign out", async () => {
      const firebaseAuth = new TestFirebaseAuth();
      const authStore = makeTestAuthStore({ firebaseAuth });

      // Start signed in
      firebaseAuth.simulateSignIn({ uid: "user-123" });
      await when(() => authStore.isLoggedIn);

      // Sign out
      await authStore.logOut();

      expect(authStore.isLoggedIn).to.be.false;
      expect(authStore.firebaseUser).to.be.null;
      expect(authStore.courierToken).to.be.null;
    });
  });

  describe("error handling", () => {
    it("should handle fetchAppStartup failure", async () => {
      const firebaseAuth = new TestFirebaseAuth();
      const notificationsStore = new NotificationsStore({
        defaultDuration: 3000,
        maxNotifications: 5,
      });
      const fetchAppStartup = sandbox.stub().rejects(new Error("Network error"));
      const authStore = makeTestAuthStore({
        firebaseAuth,
        notificationsStore,
        fetchAppStartup,
      });

      firebaseAuth.simulateSignIn({ uid: "user-123" });

      // Wait for error handling
      await when(() => !authStore.isLoading);

      // User should still be logged in despite API error
      expect(authStore.isLoggedIn).to.be.true;
      // Courier token should remain null
      expect(authStore.courierToken).to.be.null;
    });
  });
});
```

**Why good:** Clear organization with describe blocks, each test creates fresh dependencies, sandbox.restore() in afterEach, when() for all async assertions, verifies both state and side effects (analytics, notifications)

</patterns>

---

<anti_patterns>

## Anti-Patterns

### ❌ Missing Sandbox Cleanup

Stubs created without sandbox cleanup leak to other tests, causing flaky failures that are difficult to diagnose.

```typescript
// ❌ Anti-pattern
describe("MyStore", () => {
  it("test one", () => {
    sinon.stub(api, "fetch").resolves({ data: "test" });
    // No restore - stub persists!
  });

  it("test two", () => {
    // api.fetch still stubbed from test one!
    // Test may pass or fail depending on execution order
  });
});
```

**Correct approach:** Create sandbox at describe scope, call sandbox.restore() in afterEach.

---

### ❌ setTimeout-Based Async Assertions

Using arbitrary timeouts for async assertions creates flaky tests that pass locally but fail in CI, or vice versa.

```typescript
// ❌ Anti-pattern
it("should load data", async () => {
  store.loadData();
  await new Promise((r) => setTimeout(r, 100)); // Arbitrary delay
  expect(store.data).to.exist; // May fail if load takes > 100ms
});
```

**Correct approach:** Use MobX `when()` to wait for observable conditions.

---

### ❌ Shared Store Instances

Reusing store instances between tests causes state leakage and order-dependent test failures.

```typescript
// ❌ Anti-pattern
const sharedStore = makeTestStore(); // Created once

it("test 1", () => {
  sharedStore.setValue("a");
  expect(sharedStore.value).to.equal("a");
});

it("test 2", () => {
  // sharedStore still has "a" from test 1!
  expect(sharedStore.value).to.be.undefined; // Fails
});
```

**Correct approach:** Create fresh store instances within each test using factory functions.

---

### ❌ Direct Firebase SDK Mocking

Stubbing Firebase SDK internals is fragile, incomplete, and requires deep knowledge of Firebase implementation details.

```typescript
// ❌ Anti-pattern
sandbox.stub(firebase.auth(), "onAuthStateChanged").callsFake((cb) => {
  cb({ uid: "123" }); // Incomplete user object
  return () => {};
});
```

**Correct approach:** Use TestFirebaseAuth test double that implements the same interface.

---

### ❌ Jest Syntax in Karma/Mocha Tests

Using Jest assertion syntax (toBe, toEqual, jest.fn()) in a Karma/Mocha/Chai environment causes compilation errors.

```typescript
// ❌ Anti-pattern
expect(value).toBe(5);        // Jest syntax
expect(array).toEqual([1,2]); // Jest syntax
const mock = jest.fn();       // Jest mocking
```

**Correct approach:** Use Chai assertions (to.equal, to.deep.equal) and Sinon for mocking.

---

### ❌ Missing await with when()

Forgetting to await MobX `when()` causes tests to pass before async operations complete, leading to false positives.

```typescript
// ❌ Anti-pattern
it("should load", () => {
  store.loadData();
  when(() => store.isLoaded); // Missing await!
  expect(store.data).to.exist; // Runs immediately, likely fails
});
```

**Correct approach:** Always await when() calls.

</anti_patterns>

---

<decision_framework>

## Decision Framework

### What to Mock

```
What am I testing?
|
+-- External service (Firebase, Analytics)?
|   |
|   +-- Use dedicated test double (TestFirebaseAuth, ampliMock)
|
+-- API call?
|   |
|   +-- Inject mock function via factory
|   |   sandbox.stub().resolves({ ... })
|
+-- Store dependency?
|   |
|   +-- Create via factory, provide partial overrides
|
+-- Side effect (notifications, logging)?
    |
    +-- Create fresh instance per test
    +-- Verify calls/state after action
```

### Async Assertion Strategy

```
Waiting for async behavior?
|
+-- Is it MobX observable state?
|   |
|   +-- YES --> Use when(() => condition)
|   |
|   +-- NO --> Is it a Promise?
|       |
|       +-- YES --> await the Promise directly
|       |
|       +-- NO --> Is it a callback?
|           |
|           +-- Use sinon.stub().callsFake()
```

### Stub vs Spy vs Mock

```
What behavior do I need?
|
+-- Replace implementation entirely?
|   |
|   +-- sandbox.stub().resolves({ ... })
|
+-- Track calls but keep original?
|   |
|   +-- sandbox.spy(object, "method")
|
+-- Verify specific call pattern?
    |
    +-- sandbox.stub() with expect().to.have.been.calledWith()
```

### Test Isolation

```
Creating test instance?
|
+-- Is it a store?
|   |
|   +-- Use factory function with partial dependencies
|   +-- Create fresh instance in each test
|
+-- Is it a mock?
|   |
|   +-- Create in beforeEach or inside test
|   +-- Reset/restore in afterEach
|
+-- Is it a stub?
    |
    +-- Create via sandbox.stub()
    +-- sandbox.restore() handles cleanup
```

</decision_framework>

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

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing sandbox.restore() in afterEach - stubs leak to other tests causing flaky failures
- Using setTimeout for async assertions - flaky tests that pass/fail randomly
- Missing await with when() - test passes before async operation completes
- Jest assertion syntax (toBe, toEqual) - wrong test framework, tests won't compile

**Medium Priority Issues:**

- Shared store instances between tests - state leakage causes order-dependent tests
- Not resetting ampliMock between tests - event counts accumulate incorrectly
- Not verifying notifications in error paths - silent failures in production
- Direct Firebase SDK stubbing - fragile, incomplete mocks

**Common Mistakes:**

- Forgetting to await async store methods before assertions
- Not providing all required dependencies to factory (check for undefined errors)
- Using regular methods instead of arrow functions in test stores
- Not cleaning up MobxQuery in store dispose (memory leaks in tests)

**Gotchas & Edge Cases:**

- TestFirebaseAuth fires onAuthStateChanged async - first callback is delayed via setTimeout(0)
- when() with timeout throws error, must wrap in try/catch
- Sinon stubs on class methods need the class instance, not prototype
- NotificationsStore maxNotifications affects test assertions
- ampliMock.getCalls() returns copy - safe to filter/map without mutation

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (PascalCase stores, named exports, import ordering)

**(You MUST create a Sinon sandbox in describe scope and call sandbox.restore() in afterEach - prevents test pollution)**

**(You MUST use mock store factories with partial dependencies - never instantiate stores directly in tests)**

**(You MUST use TestFirebaseAuth for Firebase auth mocking - never mock Firebase SDK directly)**

**(You MUST use MobX when() for async assertions - never use arbitrary timeouts or setTimeout)**

**(You MUST use Chai assertion syntax (to.equal, to.be.true) - NOT Jest syntax (toBe, toEqual))**

**Failure to follow these rules will cause flaky tests, test pollution, and false positives/negatives.**

</critical_reminders>
