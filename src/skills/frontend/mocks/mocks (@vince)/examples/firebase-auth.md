# TestFirebaseAuth Pattern

> Test double for Firebase Authentication - simulates auth states without the real Firebase SDK. Reference from [SKILL.md](../SKILL.md).

**Related examples:**
- [core.md](core.md) - Dependency injection, Sinon sandbox, mock store factories
- [analytics-mocking.md](analytics-mocking.md) - ampliMock for analytics testing
- [async-testing.md](async-testing.md) - MobX when() and NotificationsStore mocking
- [complete-example.md](complete-example.md) - Full AuthStore test reference

---

## TestFirebaseAuth Implementation

```typescript
// src/tests/mocks/TestFirebaseAuth.ts
// Good Example
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

---

## Usage in Tests

```typescript
// Good Example
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

---

## Bad Examples

```typescript
// Bad Example - Stubbing Firebase SDK directly
it("should work", () => {
  sandbox.stub(firebase.auth(), "onAuthStateChanged").callsFake((cb) => {
    cb({ uid: "123" }); // Incomplete user object
    return () => {};
  });
  // Complex, fragile, incomplete
});

// Bad Example - Not waiting for async auth
it("should handle login", () => {
  const firebaseAuth = new TestFirebaseAuth();
  const authStore = makeTestAuthStore({ firebaseAuth });

  firebaseAuth.simulateSignIn({ uid: "123" });

  // BUG: Auth state may not have propagated yet!
  expect(authStore.isLoggedIn).to.be.true; // May fail randomly
});
```

**Why bad:** Direct SDK stubbing is fragile and requires deep knowledge of Firebase internals, not waiting for async state propagation causes flaky tests
