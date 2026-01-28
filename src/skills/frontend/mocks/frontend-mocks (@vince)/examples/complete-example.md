# Complete Test Structure

> Full example combining all mocking patterns - reference implementation for AuthStore tests. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) - Dependency injection, Sinon sandbox, mock store factories
- [firebase-auth.md](firebase-auth.md) - TestFirebaseAuth implementation and usage
- [analytics-mocking.md](analytics-mocking.md) - ampliMock for analytics testing
- [async-testing.md](async-testing.md) - MobX when() and NotificationsStore mocking

---

## Complete Example

```typescript
// src/tests/AuthStore.test.ts
// Good Example
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
  partialDependencies: Partial<AuthStoreDependencies> = {},
): AuthStore => {
  return new AuthStore({
    firebaseAuth: partialDependencies.firebaseAuth ?? new TestFirebaseAuth(),
    fetchAppStartup:
      partialDependencies.fetchAppStartup ??
      (async () => ({ courierToken: "test-courier-token" })),
    fetchMagicCode:
      partialDependencies.fetchMagicCode ??
      (async () => ({ token: "test-magic-code", expiresAt: "2025-12-31" })),
    ampli: partialDependencies.ampli ?? (createAmpliMock() as Ampli),
    notificationsStore:
      partialDependencies.notificationsStore ??
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

      firebaseAuth.simulateSignIn({
        uid: "user-123",
        email: "test@example.com",
      });

      await when(() => authStore.isLoggedIn);

      expect(authStore.isLoggedIn).to.be.true;
      expect(authStore.firebaseUser?.email).to.equal("test@example.com");
    });

    it("should fetch app startup data on sign in", async () => {
      const firebaseAuth = new TestFirebaseAuth();
      const fetchAppStartup = sandbox
        .stub()
        .resolves({ courierToken: "token-abc" });
      const authStore = makeTestAuthStore({ firebaseAuth, fetchAppStartup });

      firebaseAuth.simulateSignIn({ uid: "user-123" });

      await when(() => authStore.courierToken !== null);

      expect(fetchAppStartup).to.have.been.calledOnce;
      expect(authStore.courierToken).to.equal("token-abc");
    });

    it("should track sign in analytics", async () => {
      const firebaseAuth = new TestFirebaseAuth();
      const ampli = createAmpliMock();
      const authStore = makeTestAuthStore({
        firebaseAuth,
        ampli: ampli as Ampli,
      });

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
      const fetchAppStartup = sandbox
        .stub()
        .rejects(new Error("Network error"));
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
