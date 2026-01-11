# Mocking Examples (Photoroom Webapp)

> All code examples for frontend mocking patterns. Good/bad comparisons for each pattern.

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
// ✅ Good Example
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

## Mock Store Factories

### Factory Implementation

```typescript
// src/tests/AuthStore.test.ts
// ✅ Good Example
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

## TestFirebaseAuth

### TestFirebaseAuth Implementation

```typescript
// src/tests/mocks/TestFirebaseAuth.ts
// ✅ Good Example
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

### Usage in Tests

```typescript
// ✅ Good Example
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

## ampliMock

### ampliMock Implementation

```typescript
// src/tests/mocks/ampliMock.ts
// ✅ Good Example
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

### Usage in Tests

```typescript
// ✅ Good Example
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

## MobX when() Async

### Correct Async Testing

```typescript
// ✅ Good Example
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

## NotificationsStore Mocking

### Implementation

```typescript
// ✅ Good Example
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

## Complete Test Structure

### Complete Example

```typescript
// src/tests/AuthStore.test.ts
// ✅ Good Example
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
