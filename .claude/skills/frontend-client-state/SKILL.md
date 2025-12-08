# MobX Client State Management Patterns

> **Quick Guide:** Use MobX for reactive client state management. RootStore pattern for orchestration. Arrow function methods for `this` binding. `makeAutoObservable` by default. `runInAction` after all `await` calls. `observer()` on ALL components reading MobX state. React Query for server data only.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase stores, named exports, import ordering, `import type`, named constants)

**(You MUST use arrow functions for ALL public store methods - regular methods lose `this` when destructured)**

**(You MUST wrap ALL state mutations after `await` in `runInAction()` - MobX loses action context after async boundaries)**

**(You MUST wrap ALL components reading MobX observables with `observer()` - components won't re-render on changes otherwise)**

**(You MUST use `reaction()` in stores for side effects - NOT `useEffect` in components)**

**(You MUST use React Query for server/API data - NOT MobX stores)**

</critical_requirements>

---

**Auto-detection:** MobX store, makeAutoObservable, runInAction, reaction, observer, RootStore, client state, observable state

**When to use:**

- Creating new MobX stores for client state
- Modifying existing store actions and computed properties
- Setting up reactive side effects in stores
- Integrating React Query data with MobX via MobxQuery
- Understanding RootStore dependency injection pattern

**Key patterns covered:**

- RootStore pattern with dependency injection
- Store class structure with private dependencies (`#`)
- Arrow function methods for `this` binding (CRITICAL)
- `makeAutoObservable` vs `makeObservable`
- Computed properties for derived state
- Reactions for side effects (NOT useEffect)
- `runInAction` after all `await` calls
- MobxQuery bridge for React Query integration
- Store access via `stores` singleton

**When NOT to use:**

- Server/API data (use React Query instead)
- Simple component-local state (use useState)
- URL-shareable state like filters (use URL params)

---

<philosophy>

## Philosophy

MobX follows the principle that "anything that can be derived from application state should be derived automatically." It uses observables and reactions to automatically track dependencies and update only what changed.

In the Photoroom webapp, MobX manages **client-side state** while React Query handles **server data**. This separation ensures optimal caching for API data while providing reactive updates for UI state.

**When to use MobX:**

- Complex client state with computed values (derived data)
- State shared across multiple components
- UI state that needs reactive side effects
- Integration layer between React Query and MobX via MobxQuery

**When NOT to use MobX:**

- Server/API data (use React Query - it handles caching, refetch, sync)
- Simple component-local state (use useState - simpler)
- URL-shareable state like filters (use URL params - bookmarkable)
- Form state (use controlled components or react-hook-form)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Store Class Structure

Every store follows a consistent structure with private dependencies, observable state, constructor with DI and reactions, arrow function actions, and computed getters.

#### Store Template

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

```typescript
// BAD Example - Regular methods lose `this` binding
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

### Pattern 2: Arrow Function Methods (CRITICAL)

Store methods MUST be arrow functions to preserve `this` binding when destructured in React components.

#### Why Arrow Functions Matter

```typescript
// Good Example - Arrow function preserves `this`
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

```typescript
// BAD Example - Regular method loses `this`
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

**When to use:** ALL public store methods that may be destructured in components.

**When not to use:** Private helper methods called only internally (though arrow functions are still fine).

---

### Pattern 3: runInAction After Await

MobX requires `runInAction()` for ALL state mutations after `await` calls because the action context is lost at async boundaries.

#### Correct Async Pattern

```typescript
// Good Example - runInAction after await
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

```typescript
// BAD Example - Missing runInAction
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

**When to use:** Every state mutation that occurs after an `await` statement.

---

### Pattern 4: Computed Properties for Derived State

Use `get` accessors for derived state instead of manual updates. MobX automatically caches computed values and only recalculates when dependencies change.

#### Implementation

```typescript
// Good Example - Computed properties
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

```typescript
// BAD Example - Manual sync instead of computed
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

**When to use:** Any value that can be derived from other observable state.

---

### Pattern 5: Reactions for Side Effects

Use `reaction()` or `autorun()` in store constructors for side effects. NEVER use `useEffect` in components to react to MobX state changes.

#### Reaction Pattern

```typescript
// Good Example - Reaction in store constructor
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

```typescript
// BAD Example - useEffect in component for MobX state
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

**When to use:** Any side effect that should happen when observable state changes.

**When not to use:** Valid uses of useEffect: URL parameter handling, focus management, integration with non-MobX libraries, cleanup of external resources.

---

### Pattern 6: RootStore Pattern

All stores are orchestrated through a centralized `RootStore` with dependency injection. Never import stores directly.

#### RootStore Structure

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

#### Store Access in Components

```typescript
// Good Example - Access via stores singleton
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

```typescript
// BAD Example - Passing stores as props
const Parent = () => {
  return <Child authStore={stores.authStore} teamsStore={stores.teamsStore} />;
};

const Child = ({ authStore, teamsStore }: ChildProps) => {
  // Props-based access
};
```

**Why bad:** Props drilling for stores adds boilerplate, harder to test (must mock props), breaks MobX reactive chain in some cases, inconsistent with rest of codebase

---

### Pattern 7: Private Dependencies with # Prefix

Use ES private fields (`#`) for store dependencies to hide implementation details and make API surface clear.

#### Implementation

```typescript
// Good Example - Private dependencies
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

```typescript
// BAD Example - Public dependencies
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

### Pattern 8: MobxQuery Bridge

Use `MobxQuery` to bridge React Query with MobX stores. This allows stores to consume React Query data reactively.

#### Implementation

```typescript
// src/stores/TeamsStore.ts
import { makeAutoObservable, runInAction } from "mobx";
import { MobxQuery } from "./utils/mobx-query";
import { teamsQueryIdentifier } from "lib/query-keys";

export class TeamsStore {
  #dependencies: TeamsStoreDependencies;

  allTeams: Team[] = [];
  teamsAreLoading = false;

  // MobxQuery instance bridges React Query with store
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

**Why good:** Bridges React Query's caching/refetching with MobX reactivity, stores become source of truth for UI, callback uses runInAction for state mutations, dispose method prevents memory leaks

#### MobxQuery Utility

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

**Why good:** Encapsulates React Query observer subscription, provides dispose for cleanup, prevents duplicate subscriptions with guard

---

### Pattern 9: makeAutoObservable vs makeObservable

Use `makeAutoObservable` by default. Use `makeObservable` only when you need fine-grained control.

#### Default: makeAutoObservable

```typescript
// Good Example - makeAutoObservable for most stores
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

#### Fine-grained: makeObservable

```typescript
// Good Example - makeObservable for fine-grained control
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

**When to use makeObservable:** Large arrays/objects where shallow observation improves performance, methods that should not be actions, legacy codebases with specific requirements.

---

### Pattern 10: observer Wrapper for Components

ALL components reading MobX observables MUST be wrapped with `observer()`. Without it, components won't re-render when observables change.

#### Implementation

```typescript
// Good Example - observer wrapper
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

```typescript
// BAD Example - Missing observer
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

**When to use:** Every React component that reads MobX observable state.

---

### Pattern 11: Store Type Interfaces

Export interfaces for stores used by other stores. This enables type-safe dependency injection and easier testing.

#### Implementation

```typescript
// Good Example - Type interface for external consumers
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

```typescript
// Usage in dependent store
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

</patterns>

---

<decision_framework>

## Decision Framework

### State Management Decision Tree

```
What kind of state do I have?

Is it server data (from API)?
|-- YES --> React Query (NOT MobX stores)
|-- NO --> Is it URL-appropriate (filters, search)?
    |-- YES --> URL params (searchParams)
    |-- NO --> Is it shared across components?
        |-- YES --> MobX store
        |-- NO --> Is it truly component-local?
            |-- YES --> useState
            |-- NO --> MobX store (if complex) or useState (if simple)
```

### Store Method Decision

```
Is this a public method that may be destructured?
|-- YES --> Arrow function (preserves `this`)
|-- NO --> Is it called after await?
    |-- YES --> Wrap state mutations in runInAction()
    |-- NO --> Regular action
```

### makeAutoObservable vs makeObservable

```
Do you need fine-grained control?
|-- YES --> Is it for performance (shallow observation)?
|   |-- YES --> makeObservable with observable.shallow
|   |-- NO --> Is it to exclude specific methods?
|       |-- YES --> makeObservable with explicit annotations
|       |-- NO --> makeAutoObservable (with exclusions parameter)
|-- NO --> makeAutoObservable (default choice)
```

### Side Effect Location Decision

```
Where should this side effect live?
|
Is it reacting to MobX observable changes?
|-- YES --> reaction() in store constructor
|-- NO --> Is it synchronizing with external system (URL, DOM API)?
    |-- YES --> useEffect in component (valid use)
    |-- NO --> Is it business logic triggered by data changes?
        |-- YES --> reaction() in store
        |-- NO --> Component lifecycle (useEffect for setup/cleanup)
```

### Quick Reference Table

| Use Case | Solution | Why |
|----------|----------|-----|
| Server/API data | React Query | Caching, synchronization, refetch |
| Complex client state | MobX store | Reactive, computed values, actions |
| Simple component state | useState | Simpler, no store needed |
| URL-shareable state | URL params | Bookmarkable, browser navigation |
| Side effects on state change | reaction() in store | Centralized, testable |
| External system sync | useEffect in component | React lifecycle |

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **React Query**: Server data fetching and caching. MobX stores consume via MobxQuery bridge.
- **TanStack Router**: URL state management. Use URL params for shareable filters.
- **observer (mobx-react-lite)**: Wraps components to make them reactive to observables.
- **Zod**: Validate API responses before storing in MobX.

**Store Initialization Order:**

```
Auth -> Experiments -> Engine -> [Teams + UserDetails] -> Entitlements
```

Dependencies must be initialized before dependents. RootStore manages this order.

**Never use:**

- Context for state management (use MobX stores instead)
- useEffect to react to MobX state (use reaction() in stores)
- Direct store imports (use stores singleton)
- Prop drilling for stores (access via stores singleton)

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Regular methods instead of arrow functions for public store methods - `this` is undefined when destructured
- Missing `runInAction()` after `await` calls - breaks MobX reactivity, causes warnings
- Missing `observer()` wrapper on components reading MobX state - components never re-render
- Using `useEffect` to react to MobX state changes - creates duplicate reactive systems
- Storing server/API data in MobX instead of React Query - loses caching, refetch, sync benefits

**Medium Priority Issues:**

- Using `useMemo` for derived MobX state (use computed getters in stores)
- Passing stores as props instead of using stores singleton
- Not disposing MobxQuery instances (memory leaks)
- Accessing stores before RootStore.isLoading is false
- Creating new stores without adding to RootStore

**Common Mistakes:**

- Forgetting `{ fireImmediately: true }` on reactions that should run on init
- Not guarding against stale async responses in reactions
- Mutating observables in computed getters (should be read-only)
- Not using `Required<>` for dependencies type when providing defaults
- Missing displayName on observer components

**Gotchas & Edge Cases:**

- Code after `await` is NOT part of the action - always use `runInAction()`
- `observer()` must wrap the component, not be called inside
- Destructuring observables breaks reactivity - destructure at render time only
- `reaction()` runs once on setup with `fireImmediately: true`
- `observable.shallow` only observes array/object reference, not contents
- Private `#` fields are not observable - use for dependencies only

</red_flags>

---

<anti_patterns>

## Anti-Patterns

### Regular Methods for Public Store Actions

Regular methods lose `this` binding when destructured. Use arrow functions.

```typescript
// BAD - Regular method
class Store {
  async fetchData() {
    this.isLoading = true; // undefined when destructured
  }
}

// GOOD - Arrow function
class Store {
  fetchData = async () => {
    this.isLoading = true; // works when destructured
  };
}
```

### Missing runInAction After Await

State mutations after await are outside action context.

```typescript
// BAD - State mutation outside action
fetchData = async () => {
  const data = await api.fetch();
  this.data = data; // MobX warning, reactivity may break
};

// GOOD - Wrapped in runInAction
fetchData = async () => {
  const data = await api.fetch();
  runInAction(() => {
    this.data = data;
  });
};
```

### useEffect to React to MobX State

Creates duplicate reactive systems. Use reaction() in stores.

```typescript
// BAD - useEffect for MobX state
useEffect(() => {
  if (store.isLoaded) doSomething();
}, [store.isLoaded]);

// GOOD - reaction in store
reaction(
  () => this.isLoaded,
  (isLoaded) => {
    if (isLoaded) doSomething();
  }
);
```

### Missing observer Wrapper

Components won't re-render without observer.

```typescript
// BAD - No observer
const Component = () => {
  return <div>{store.value}</div>; // Never updates
};

// GOOD - observer wrapper
const Component = observer(() => {
  return <div>{store.value}</div>; // Reactively updates
});
```

### Passing Stores as Props

Breaks the stores singleton pattern. Access via stores singleton.

```typescript
// BAD - Props drilling
<Child authStore={stores.authStore} />

// GOOD - Direct access
const Child = observer(() => {
  const { authStore } = stores;
});
```

</anti_patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (PascalCase stores, named exports, import ordering, `import type`, named constants)

**(You MUST use arrow functions for ALL public store methods - regular methods lose `this` when destructured)**

**(You MUST wrap ALL state mutations after `await` in `runInAction()` - MobX loses action context after async boundaries)**

**(You MUST wrap ALL components reading MobX observables with `observer()` - components won't re-render on changes otherwise)**

**(You MUST use `reaction()` in stores for side effects - NOT `useEffect` in components)**

**(You MUST use React Query for server/API data - NOT MobX stores)**

**Failure to follow these rules will cause undefined `this` errors, broken reactivity, stale UIs, and duplicate reactive systems.**

</critical_reminders>
