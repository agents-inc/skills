# Testing Examples - Mock Stores

> Mock store factories and test setup patterns. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand Chai assertion syntax and Sinon sandbox pattern from [core.md](core.md) first.

---

## Pattern 1: Mock Store Factories

### Factory Pattern with Partial Dependencies

```typescript
// Good Example - Mock store factory with partial dependencies
import { AuthStore, type AuthStoreDependencies } from "stores/AuthStore";
import { NotificationsStore } from "@photoroom/ui/src/components/status/Notification/NotificationsStore";
import type { Ampli } from "@photoroom/shared";

// Test implementation of Firebase auth
class TestFirebaseAuth {
  #authStateCallback?: (user: FirebaseUser | null) => void;
  currentUser: FirebaseUser | null = null;

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    this.#authStateCallback = callback;
    // Immediately call with null (logged out state)
    setTimeout(() => callback(this.currentUser), 0);
    return () => {};
  }

  // Test helper to simulate login
  simulateLogin(user: FirebaseUser) {
    this.currentUser = user;
    this.#authStateCallback?.(user);
  }

  async signOut() {
    this.currentUser = null;
    this.#authStateCallback?.(null);
  }
}

// Mock ampli for analytics
const ampliMock = {
  identify: () => {},
  track: () => {},
  logEvent: () => {},
} as unknown as Ampli;

// Factory function with partial dependencies
const makeTestAuthStore = (
  partialDependencies: Partial<AuthStoreDependencies> = {}
): AuthStore => {
  return new AuthStore({
    firebaseAuth: partialDependencies.firebaseAuth ?? new TestFirebaseAuth(),
    fetchAppStartup:
      partialDependencies.fetchAppStartup ??
      (async () => ({ courierToken: "test-courier-token" })),
    fetchMagicCode:
      partialDependencies.fetchMagicCode ??
      (async () => ({ token: "test-magic-code", expiresAt: "2025-01-01" })),
    ampli: partialDependencies.ampli ?? ampliMock,
    notificationsStore: new NotificationsStore({
      logEvent: () => {},
      logNotificationEvent: () => {},
    }),
  });
};

// Usage in tests
describe("AuthStore", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("state is in sync with Firebase SDK", async () => {
    const firebaseAuth = new TestFirebaseAuth();
    const authStore = makeTestAuthStore({ firebaseAuth });

    expect(authStore.isLoading).to.be.true;
    expect(authStore.isLoggedIn).to.be.false;
    expect(authStore.firebaseUser).to.be.null;

    // Wait for loading to complete
    await when(() => !authStore.isLoading);

    expect(authStore.isLoading).to.be.false;
    expect(authStore.isLoggedIn).to.be.false;
  });

  it("updates state when user logs in", async () => {
    const firebaseAuth = new TestFirebaseAuth();
    const authStore = makeTestAuthStore({ firebaseAuth });

    await when(() => !authStore.isLoading);

    // Simulate Firebase login
    firebaseAuth.simulateLogin({
      uid: "test-uid",
      email: "test@example.com",
      isAnonymous: false,
    } as FirebaseUser);

    expect(authStore.isLoggedIn).to.be.true;
    expect(authStore.firebaseUid).to.equal("test-uid");
  });
});
```

**Why good:** Factory accepts partial dependencies so tests only provide what they need, default implementations for all dependencies prevent test setup boilerplate, TestFirebaseAuth provides control over auth state for testing, `when()` from MobX waits for observable conditions

```typescript
// Bad Example - Hardcoded dependencies
describe("AuthStore", () => {
  it("should work", () => {
    // BAD: Must provide ALL dependencies every time
    const authStore = new AuthStore({
      firebaseAuth: new TestFirebaseAuth(),
      fetchAppStartup: async () => ({ courierToken: "token" }),
      fetchMagicCode: async () => ({ token: "code", expiresAt: "2025-01-01" }),
      ampli: mockAmpli,
      notificationsStore: new NotificationsStore({ ... }),
    });
  });
});
```

**Why bad:** Every test must provide all dependencies even if irrelevant, changes to AuthStore constructor break all tests, no reuse of common test setup

---

## Pattern 2: Test Setup with WASM and QueryClient

### Global Test Setup

```typescript
// src/tests/setup.ts
import { WASM } from "photoroom_engine_web";
import { queryClient } from "lib/query-client";

// Paths to WASM modules
const webgpuWasmPath = "./photoroom_engine_web/photoroom_engine_web_bg.wasm";
const webglWasmPath = "./photoroom_engine_web/photoroom_engine_webgl_bg.wasm";

// Initialize WASM once before all tests
before(async () => {
  await WASM.initialize({
    gpuBackend: "webgl",
    webgpuWasmModuleOrPath: webgpuWasmPath,
    webglWasmModuleOrPath: webglWasmPath,
  });
});

// Clear React Query cache before each test
beforeEach(async () => {
  queryClient.clear();
});
```

**Why good:** WASM initialization is expensive so done once in `before`, queryClient.clear() prevents test pollution from cached data, each test starts with fresh query state

### Individual Test Setup

```typescript
// Good Example - Test file with proper setup
import { expect } from "chai";
import sinon from "sinon";
import { when } from "mobx";
import { queryClient } from "lib/query-client";

describe("TeamsStore", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    queryClient.clear(); // Clear any cached team data
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should fetch teams on initialization", async () => {
    const fetchTeams = sandbox.stub().resolves([
      { id: "1", name: "Team 1" },
      { id: "2", name: "Team 2" },
    ]);

    const teamsStore = makeTestTeamsStore({ fetchTeams });
    teamsStore.startTeamsQuery();

    await when(() => !teamsStore.teamsAreLoading);

    expect(teamsStore.allTeams).to.have.length(2);
    expect(fetchTeams).to.have.been.calledOnce;
  });
});
```

**Why good:** Sandbox created fresh each test, queryClient cleared to prevent stale data, `when()` awaits MobX observable conditions, explicit assertions on both data and mock calls

---

_See [core.md](core.md) for foundational patterns: Chai Assertion Syntax, Sinon Sandbox with Cleanup._
