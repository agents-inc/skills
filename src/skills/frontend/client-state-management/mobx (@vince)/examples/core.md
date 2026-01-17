# MobX Core Patterns

> Core store patterns: class structure, arrow functions, runInAction, and observer wrapper. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 1: Store Class Structure

### Good Example - Complete Store Template

```typescript
// src/stores/MyStore.ts
import { makeAutoObservable, reaction, runInAction } from "mobx";

import type { TAuthStore } from "./AuthStore";
import type { TNotificationsStore } from "./NotificationsStore";

type MyStoreDependencies = {
  authStore: TAuthStore;
  notificationsStore: TNotificationsStore;
  fetchData: () => Promise<Data>;
};

export class MyStore {
  // 1. Private dependencies (use # prefix)
  #dependencies: Required<MyStoreDependencies>;

  // 2. Observable state
  data: Data | null = null;
  isLoading = false;
  error: string | null = null;

  // 3. Constructor with DI and reactions
  constructor(dependencies: MyStoreDependencies) {
    makeAutoObservable(this, {
      // Exclude specific methods from observability if needed
      setExternalValue: false,
    });

    this.#dependencies = {
      ...dependencies,
      // Provide defaults for optional dependencies if needed
    };

    // Setup reactions for side effects
    reaction(
      () => this.#dependencies.authStore.isLoggedIn,
      (isLoggedIn) => {
        if (isLoggedIn) {
          this.fetchData();
        } else {
          this.clearData();
        }
      },
      { fireImmediately: true }
    );
  }

  // 4. Arrow function actions (CRITICAL - preserves `this` binding)
  fetchData = async () => {
    this.isLoading = true;
    this.error = null;

    try {
      const result = await this.#dependencies.fetchData();

      // MUST wrap state mutations after await in runInAction
      runInAction(() => {
        this.data = result;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Unknown error";
        this.isLoading = false;
      });
    }
  };

  clearData = () => {
    this.data = null;
    this.error = null;
  };

  // 5. Computed getters for derived state
  get hasData() {
    return this.data !== null;
  }

  get isReady() {
    return !this.isLoading && !this.error;
  }
}

export { MyStore };
```

**Why good:** Arrow functions preserve `this` when destructured in components, private `#` prefix hides internal dependencies from external access, `runInAction` ensures MobX tracks state mutations after async boundaries, computed getters automatically cache derived values, reaction in constructor keeps side effects in store not components

### Bad Example - Regular methods lose `this` binding

```typescript
export class MyStore {
  data: Data | null = null;

  // BAD: Regular method loses `this` when destructured
  async fetchData() {
    this.isLoading = true; // Error: `this` is undefined
    const result = await api.fetch();
    this.data = result; // BAD: Not in runInAction
  }
}

// In component:
const { fetchData } = myStore;
fetchData(); // `this` is undefined!
```

**Why bad:** Regular methods lose `this` binding when destructured, state mutation after await without `runInAction` breaks MobX reactivity and triggers warnings, no error handling for async operations

---

## Pattern 2: Arrow Function Methods (CRITICAL)

### Good Example - Arrow function preserves `this`

```typescript
export class AuthStore {
  isLoading = false;

  // Arrow function - `this` is lexically bound
  logOut = async () => {
    this.isLoading = true;
    await this.#dependencies.firebaseAuth.signOut();
    runInAction(() => {
      this.isLoading = false;
    });
  };
}

// In component - works correctly
const { logOut } = authStore;
logOut(); // `this` is correctly bound to authStore
```

**Why good:** Arrow functions capture `this` lexically at definition time, destructuring in components works correctly, no need for `.bind()` calls

### Bad Example - Regular method loses `this`

```typescript
export class AuthStore {
  isLoading = false;

  // Regular method - `this` depends on call site
  async logOut() {
    this.isLoading = true; // Error when destructured!
    await this.#dependencies.firebaseAuth.signOut();
  }
}

// In component - BREAKS
const { logOut } = authStore;
logOut(); // TypeError: Cannot read property 'isLoading' of undefined
```

**Why bad:** Regular methods determine `this` at call time not definition time, destructuring breaks the binding, React components commonly destructure store methods

---

## Pattern 3: runInAction After Await

### Good Example - runInAction after await

```typescript
export class TeamsStore {
  teams: Team[] = [];
  isLoading = false;
  error: string | null = null;

  fetchTeams = async () => {
    // Before await - still in action context, OK
    this.isLoading = true;
    this.error = null;

    try {
      const response = await this.#dependencies.fetchTeams();

      // After await - MUST use runInAction
      runInAction(() => {
        this.teams = response.data;
        this.isLoading = false;
      });
    } catch (err) {
      // Error path also needs runInAction
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to fetch teams";
        this.isLoading = false;
      });
    }
  };
}
```

**Why good:** `runInAction` creates an implicit action for state mutations, prevents MobX warnings about modifying state outside actions, ensures reactivity works correctly after async boundaries

### Bad Example - Missing runInAction

```typescript
export class TeamsStore {
  fetchTeams = async () => {
    this.isLoading = true;
    const response = await this.#dependencies.fetchTeams();

    // BAD: State mutation outside action context
    this.teams = response.data; // MobX warning, may break reactivity
    this.isLoading = false;
  };
}
```

**Why bad:** After `await`, execution resumes outside the action context, MobX cannot track mutations reliably, causes "[mobx] Since strict-mode is enabled..." warnings

---

## Pattern 10: observer Wrapper for Components

### Good Example - observer wrapper

```typescript
import { observer } from "mobx-react-lite";
import { stores } from "stores";

export const UserStatus = observer(() => {
  const { authStore } = stores;

  // Component re-renders when isLoggedIn or displayName changes
  return (
    <div>
      {authStore.isLoggedIn ? (
        <span>Welcome, {authStore.displayName}</span>
      ) : (
        <span>Please log in</span>
      )}
    </div>
  );
});

UserStatus.displayName = "UserStatus";
```

**Why good:** `observer` makes component reactive to observable changes, only re-renders when accessed observables change, displayName helps React DevTools debugging

### Bad Example - Missing observer

```typescript
import { stores } from "stores";

export const UserStatus = () => {
  const { authStore } = stores;

  // BUG: Component NEVER re-renders when authStore changes!
  return (
    <div>
      {authStore.isLoggedIn ? "Logged in" : "Logged out"}
    </div>
  );
};
```

**Why bad:** Without `observer`, React has no way to know observables changed, component shows stale data indefinitely, common source of "my UI doesn't update" bugs
