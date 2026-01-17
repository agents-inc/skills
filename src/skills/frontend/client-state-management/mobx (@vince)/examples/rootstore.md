# MobX RootStore Pattern

> Store orchestration, private dependencies, and type interfaces. See [SKILL.md](../SKILL.md) for concepts.

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
