# MobX Examples

> Complete code examples for MobX store patterns. See [SKILL.md](SKILL.md) for core concepts.

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

## Pattern 4: Computed Properties for Derived State

### Good Example - Computed properties

```typescript
export class EntitlementsStore {
  #dependencies: EntitlementsStoreDependencies;
  currentSpaceEntitlement: Entitlement | null = null;

  constructor(dependencies: EntitlementsStoreDependencies) {
    makeAutoObservable(this);
    this.#dependencies = dependencies;
  }

  // Computed - automatically recalculates when currentSpaceEntitlement changes
  get isPro() {
    return !!this.currentSpaceEntitlement?.isPro;
  }

  get canUsePremiumFeatures() {
    return this.isPro || this.currentSpaceEntitlement?.hasTrial;
  }

  get remainingCredits() {
    return this.currentSpaceEntitlement?.credits ?? 0;
  }
}
```

**Why good:** Computed values are cached and only recalculate when dependencies change, no manual synchronization needed, clean declarative API, MobX tracks dependencies automatically

### Bad Example - Manual sync instead of computed

```typescript
export class EntitlementsStore {
  isPro = false; // Manually synced state

  updateEntitlement = (entitlement: Entitlement) => {
    this.currentSpaceEntitlement = entitlement;
    // BAD: Manual sync can get out of sync
    this.isPro = !!entitlement?.isPro;
  };
}
```

**Why bad:** Manual synchronization can get out of sync with source data, requires remembering to update in all places, no automatic caching, more code to maintain

---

## Pattern 5: Reactions for Side Effects

### Good Example - Reaction in store constructor

```typescript
export class AuthStore {
  #dependencies: AuthStoreDependencies;
  courierToken: string | null = null;

  constructor(dependencies: AuthStoreDependencies) {
    makeAutoObservable(this);
    this.#dependencies = dependencies;

    // Reaction: when firebaseUid changes, fetch courier token
    reaction(
      () => this.firebaseUid, // What to track
      (uid) => {
        // What to do when it changes
        runInAction(() => {
          this.courierToken = null;
        });

        if (!uid) return;

        this.#dependencies
          .fetchAppStartup()
          .then((res) => {
            runInAction(() => {
              // Guard against stale responses
              if (this.firebaseUid === uid) {
                this.courierToken = res.courierToken;
              }
            });
          })
          .catch((error) => {
            logger.error("Failed to fetch app startup", {}, error);
          });
      },
      { fireImmediately: true } // Run on initialization
    );
  }

  get firebaseUid() {
    return this.state.type === "initialized" ? this.state.uid : null;
  }
}
```

**Why good:** Side effects live in stores not components, `fireImmediately: true` runs on initialization, stale response guard prevents race conditions, centralizes business logic in one place

### Bad Example - useEffect in component for MobX state

```typescript
import { useEffect } from "react";
import { stores } from "stores";

const MyComponent = observer(() => {
  const { authStore } = stores;

  // BAD: Reacting to MobX state with useEffect
  useEffect(() => {
    if (authStore.isLoggedIn) {
      fetchUserData();
    }
  }, [authStore.isLoggedIn]); // Breaks MobX tracking

  return <div>...</div>;
});
```

**Why bad:** Creates duplicate reactive systems (React + MobX), useEffect dependency arrays don't track MobX observables correctly, business logic scattered in components instead of stores, harder to test and maintain

---

## Pattern 6: RootStore Pattern

### Good Example - RootStore Structure

```typescript
// src/stores/RootStore.ts
import { makeObservable, observable, computed } from "mobx";

import { AuthStore } from "./AuthStore";
import { TeamsStore } from "./TeamsStore";
import { EntitlementsStore } from "./EntitlementsStore";

type Stores = {
  authStore: AuthStore;
  teamsStore: TeamsStore;
  entitlementsStore: EntitlementsStore;
  // ... other stores
};

export class RootStore {
  _stores?: Stores;

  constructor() {
    makeObservable(this, {
      _stores: observable,
      isLoading: computed,
    });
  }

  get isLoading() {
    return !this._stores;
  }

  // Getters for individual stores
  get authStore() {
    if (!this._stores) throw new Error("Stores not initialized");
    return this._stores.authStore;
  }

  get teamsStore() {
    if (!this._stores) throw new Error("Stores not initialized");
    return this._stores.teamsStore;
  }

  initialize = async () => {
    // Initialize stores in dependency order:
    // Auth -> Experiments -> Engine -> [Teams + UserDetails] -> Entitlements
    const authStore = new AuthStore({ /* dependencies */ });
    await when(() => !authStore.isLoading);

    const teamsStore = new TeamsStore({
      authStore,
      /* other dependencies */
    });

    const entitlementsStore = new EntitlementsStore({
      authStore,
      teamsStore,
      /* other dependencies */
    });

    runInAction(() => {
      this._stores = {
        authStore,
        teamsStore,
        entitlementsStore,
      };
    });
  };
}

// Singleton instance
export const stores = new RootStore();
```

**Why good:** Centralized dependency injection makes stores testable, initialization order respects dependency graph, prevents circular dependencies, stores accessed via getters with initialization guards

### Good Example - Store Access in Components

```typescript
import { observer } from "mobx-react-lite";
import { stores } from "stores";

export const UserStatus = observer(() => {
  const { authStore, teamsStore } = stores;

  return (
    <div>
      {authStore.isLoggedIn && <span>Team: {teamsStore.currentTeam?.name}</span>}
    </div>
  );
});
```

**Why good:** Single source of truth for store access, observer wrapper enables reactivity, stores accessed via singleton not props

### Bad Example - Passing stores as props

```typescript
const Parent = () => {
  return <Child authStore={stores.authStore} teamsStore={stores.teamsStore} />;
};

const Child = ({ authStore, teamsStore }: ChildProps) => {
  // Props-based access
};
```

**Why bad:** Props drilling for stores adds boilerplate, harder to test (must mock props), breaks MobX reactive chain in some cases, inconsistent with rest of codebase

---

## Pattern 7: Private Dependencies with # Prefix

### Good Example - Private dependencies

```typescript
type BatchStoreDependencies = {
  engineStore: EngineStore;
  entitlementsStore: EntitlementsStore;
  modalStore: ModalStore;
};

export class BatchStore {
  // Private - not accessible from outside
  #dependencies: Required<BatchStoreDependencies>;

  // Public observable state
  items: BatchItem[] = [];
  isProcessing = false;

  constructor(dependencies: BatchStoreDependencies) {
    this.#dependencies = dependencies;
    makeAutoObservable(this);
  }

  // Dependencies accessed internally only
  processItems = async () => {
    const { engineStore, entitlementsStore } = this.#dependencies;

    if (!entitlementsStore.canUseBatch) {
      this.#dependencies.modalStore.openUpgrade();
      return;
    }

    await engineStore.processBatch(this.items);
  };
}
```

**Why good:** `#` prefix makes dependencies truly private (not accessible via `store.#dependencies`), clear separation between public API and internal implementation, TypeScript enforces privacy at compile time

### Bad Example - Public dependencies

```typescript
export class BatchStore {
  dependencies: BatchStoreDependencies; // Accessible externally

  constructor(dependencies: BatchStoreDependencies) {
    this.dependencies = dependencies; // Can be mutated from outside
  }
}

// External code can do this:
batchStore.dependencies.engineStore = hackedStore; // Bad!
```

**Why bad:** Public dependencies can be accessed and mutated from outside, unclear what the public API surface is, implementation details leak to consumers

---

## Pattern 8: MobxQuery Bridge

### Good Example - MobxQuery Implementation

```typescript
// src/stores/TeamsStore.ts
import { makeAutoObservable, runInAction } from "mobx";
import { MobxQuery } from "./utils/mobx-query";
import { teamsQueryIdentifier } from "lib/query-keys";

export class TeamsStore {
  #dependencies: TeamsStoreDependencies;

  allTeams: Team[] = [];
  teamsAreLoading = false;

  // MobxQuery instance bridges data fetching with store
  #teamsQuery = new MobxQuery(
    {
      queryKey: [teamsQueryIdentifier],
      queryFn: this.#dependencies.fetchTeams,
      refetchInterval: 60000, // Refetch every minute
    },
    ({ isLoading, data, error }) => {
      runInAction(() => {
        this.teamsAreLoading = isLoading;
        if (data) {
          this.allTeams = data;
        }
      });
    }
  );

  constructor(dependencies: TeamsStoreDependencies) {
    this.#dependencies = dependencies;
    makeAutoObservable(this);
  }

  // Start query when needed
  startTeamsQuery = () => {
    this.#teamsQuery.query();
  };

  // Cleanup
  dispose = () => {
    this.#teamsQuery.dispose();
  };

  get currentTeam() {
    return this.allTeams.find((t) => t.id === this.#dependencies.authStore.currentTeamId);
  }
}
```

**Why good:** Bridges data fetching caching/refetching with MobX reactivity, stores become source of truth for UI, callback uses runInAction for state mutations, dispose method prevents memory leaks

### MobxQuery Utility

```typescript
// src/stores/utils/mobx-query.ts
import { QueryObserver, type QueryObserverOptions, type QueryObserverResult } from "@tanstack/react-query";
import { queryClient } from "lib/query-client";

export class MobxQuery<TQueryFnData, TError, TData, TQueryData, TQueryKey> {
  private observer?: QueryObserver;
  private unsubscribe?: () => void;
  private options: QueryObserverOptions;
  private onResultChange?: (result: QueryObserverResult) => void;

  constructor(
    options: QueryObserverOptions,
    onResultChange?: (result: QueryObserverResult) => void
  ) {
    this.options = options;
    this.onResultChange = onResultChange;
  }

  query() {
    if (this.observer) return;

    this.observer = new QueryObserver(queryClient, this.options);
    this.unsubscribe = this.observer.subscribe((result) => {
      this.onResultChange?.(result);
    });
  }

  dispose() {
    this.unsubscribe?.();
    this.observer = undefined;
  }
}
```

**Why good:** Encapsulates query observer subscription, provides dispose for cleanup, prevents duplicate subscriptions with guard

---

## Pattern 9: makeAutoObservable vs makeObservable

### Good Example - makeAutoObservable for most stores

```typescript
export class SimpleStore {
  value = "";
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  setValue = (v: string) => {
    this.value = v;
  };

  get upperValue() {
    return this.value.toUpperCase();
  }
}
```

**Why good:** Automatically infers observables (properties), actions (methods), and computeds (getters), less boilerplate, good default for most stores

### Good Example - makeObservable for fine-grained control

```typescript
export class PerformanceStore {
  items: Item[] = [];
  selectedId: string | null = null;

  constructor() {
    makeObservable(this, {
      items: observable.shallow, // Performance: don't deep-observe items
      selectedId: observable,
      addItem: action,
      selectedItem: computed,
      setExternalValue: false, // Exclude from observability
    });
  }

  addItem = (item: Item) => {
    this.items.push(item);
  };

  get selectedItem() {
    return this.items.find((i) => i.id === this.selectedId);
  }

  // Not an action - called from external non-MobX code
  setExternalValue(value: string) {
    // ...
  }
}
```

**Why good:** `observable.shallow` prevents deep observation for performance, can exclude specific methods from observability, explicit annotations document intent

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

---

## Pattern 11: Store Type Interfaces

### Good Example - Type interface for external consumers

```typescript
export type TAuthStore = {
  // Public observable state
  isLoading: boolean;
  isLoggedIn: boolean;
  firebaseUser: FirebaseUser | null;

  // Public actions
  logOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;

  // Public computed
  firebaseUid: string | null;
  displayName: string | null;
};

export class AuthStore implements TAuthStore {
  // Full implementation including private members
  #dependencies: AuthStoreDependencies;
  #unsubscribe?: () => void;

  // ... implementation
}
```

**Why good:** Interface defines public API contract, other stores depend on interface not implementation, enables mocking for tests, hides internal implementation details

### Good Example - Usage in dependent store

```typescript
type TeamsStoreDependencies = {
  authStore: TAuthStore; // Depends on interface, not class
  // ...
};

export class TeamsStore {
  #dependencies: Required<TeamsStoreDependencies>;
  // ...
}
```

**Why good:** TeamsStore doesn't depend on AuthStore implementation details, can inject mock TAuthStore in tests, clear contract between stores
