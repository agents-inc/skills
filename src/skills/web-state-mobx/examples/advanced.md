# MobX - Advanced Examples

> Advanced patterns for computed values, actions, async operations, and reactions. See [SKILL.md](../SKILL.md) for concepts and decision frameworks.

**Additional Examples:**

- [Core Patterns](core.md) - Store creation, observer, useLocalObservable
- [Architecture Patterns](architecture.md) - Root store, TypeScript, performance

---

## Pattern 6: Computed Values

### Good Example - Derived State with Computed

```typescript
// stores/shopping-cart-store.ts
import { makeAutoObservable } from "mobx";

const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 50;
const STANDARD_SHIPPING_COST = 5.99;
const EMPTY_CART_SIZE = 0;
const FREE_SHIPPING_COST = 0;
const INITIAL_QUANTITY = 1;

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

class ShoppingCartStore {
  items: CartItem[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  // Computed: only recalculates when items array changes
  get subtotal(): number {
    return this.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  }

  // Computed: depends on subtotal (another computed) - MobX chains them
  get tax(): number {
    return this.subtotal * TAX_RATE;
  }

  // Computed: depends on subtotal
  get shippingCost(): number {
    return this.subtotal >= FREE_SHIPPING_THRESHOLD
      ? FREE_SHIPPING_COST
      : STANDARD_SHIPPING_COST;
  }

  // Computed: depends on subtotal, tax, and shippingCost (all computed)
  get total(): number {
    return this.subtotal + this.tax + this.shippingCost;
  }

  // Computed: simple derived boolean
  get isEmpty(): boolean {
    return this.items.length === EMPTY_CART_SIZE;
  }

  // Computed: counts total number of items
  get itemCount(): number {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  addItem(item: Omit<CartItem, "quantity">): void {
    const existing = this.items.find((i) => i.id === item.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.items.push({ ...item, quantity: INITIAL_QUANTITY });
    }
  }

  removeItem(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }

  clearCart(): void {
    this.items = [];
  }
}

export { ShoppingCartStore };
```

**Why good:** Computed values chain naturally (total depends on subtotal + tax + shippingCost), each computed only recalculates when its specific dependencies change, named constants for all business rules, no manual memoization needed

### Bad Example - Computing Values in Actions

```typescript
// stores/broken-cart-store.ts
import { makeAutoObservable } from "mobx";

class BrokenCartStore {
  items: CartItem[] = [];
  subtotal = 0; // BAD: storing derived state as observable
  total = 0; // BAD: storing derived state as observable

  constructor() {
    makeAutoObservable(this);
  }

  addItem(item: CartItem): void {
    this.items.push(item);
    // BAD: manually recalculating derived state in action
    this.subtotal = this.items.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );
    this.total = this.subtotal * 1.08 + 5.99; // BAD: magic numbers
  }
}

export { BrokenCartStore };
```

**Why bad:** Derived state stored as observable instead of computed means it can become stale if another action modifies items, manual recalculation in every action is error-prone, magic numbers `1.08` and `5.99` make business rules unclear

### Good Example - Computed with Structural Comparison

```typescript
// stores/filter-store.ts
import { makeAutoObservable, computed } from "mobx";

const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_PRICE = Infinity;

interface FilterResult {
  category: string;
  priceRange: { min: number; max: number };
}

class FilterStore {
  category = "all";
  minPrice = DEFAULT_MIN_PRICE;
  maxPrice = DEFAULT_MAX_PRICE;

  constructor() {
    makeAutoObservable(this, {
      // Use computed.struct: only notifies observers when the
      // STRUCTURE of the result changes, not just the reference
      activeFilters: computed.struct,
    });
  }

  get activeFilters(): FilterResult {
    return {
      category: this.category,
      priceRange: { min: this.minPrice, max: this.maxPrice },
    };
  }

  setCategory(category: string): void {
    this.category = category;
  }

  setPriceRange(min: number, max: number): void {
    this.minPrice = min;
    this.maxPrice = max;
  }
}

export { FilterStore };
```

**Why good:** `computed.struct` performs deep structural comparison on the returned object, observers only re-render when actual filter values change (not just when a new object reference is created), prevents unnecessary re-renders from reference inequality

---

## Pattern 7: Actions and runInAction

### Good Example - Actions with Batched Mutations

```typescript
// stores/user-profile-store.ts
import { makeAutoObservable } from "mobx";

const INITIAL_LOADING_STATE = false;
const INITIAL_ERROR_STATE = null;

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

class UserProfileStore {
  profile: UserProfile | null = null;
  isLoading = INITIAL_LOADING_STATE;
  error: string | null = INITIAL_ERROR_STATE;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // Action: all mutations inside are batched into one transaction
  // Observers will NOT see intermediate states
  updateProfile(updates: Partial<UserProfile>): void {
    if (!this.profile) return;
    // All of these mutations are batched - observers see ONE update
    this.profile = { ...this.profile, ...updates };
    this.error = INITIAL_ERROR_STATE;
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  setError(error: string | null): void {
    this.error = error;
  }

  resetProfile(): void {
    // Multiple mutations in one action = one re-render
    this.profile = null;
    this.isLoading = INITIAL_LOADING_STATE;
    this.error = INITIAL_ERROR_STATE;
  }
}

export { UserProfileStore };
```

**Why good:** Actions batch multiple mutations into one transaction, observers see only the final state (not intermediate states), `autoBind` ensures methods are safe as callbacks, named constants for initial states

### Bad Example - Mutating State Outside Actions

```typescript
// BAD: Direct mutation outside an action
import { configure } from "mobx";

// With enforceActions enabled (recommended for production)
configure({ enforceActions: "always" });

// This will THROW: modifying observable outside an action
const store = new UserProfileStore();
store.profile = { name: "Bob", email: "bob@example.com", avatar: "" };
// Error: [MobX] Since strict-mode is enabled, changing observed
// observable values without using an action is not allowed.
```

**Why bad:** MobX strict mode (`enforceActions: "always"`) prevents state mutation outside actions, this catches bugs where state is modified from unexpected places, always use actions to modify state

---

## Pattern 8: Async Patterns (flow and runInAction)

### Good Example - runInAction After Await

```typescript
// stores/user-store.ts
import { makeAutoObservable, runInAction } from "mobx";
import type { ApiClient } from "../api-client";

const INITIAL_LOADING_STATE = false;

interface User {
  id: string;
  name: string;
  email: string;
}

class UserStore {
  users: User[] = [];
  isLoading = INITIAL_LOADING_STATE;
  error: string | null = null;

  constructor(private apiClient: ApiClient) {
    makeAutoObservable(this, {
      apiClient: false, // Exclude from observability
    });
  }

  // The method itself is an action (inferred by makeAutoObservable)
  // But code AFTER await runs in a NEW tick - NOT part of this action
  async fetchUsers(): Promise<void> {
    this.isLoading = true; // OK: still in the action
    this.error = null; // OK: still in the action
    try {
      const users = await this.apiClient.getUsers();
      // MUST wrap in runInAction: this code runs AFTER the await
      // and is therefore outside the original action
      runInAction(() => {
        this.users = users;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Unknown error";
        this.isLoading = false;
      });
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await this.apiClient.deleteUser(id);
      runInAction(() => {
        this.users = this.users.filter((u) => u.id !== id);
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Delete failed";
      });
    }
  }
}

export { UserStore };
```

**Why good:** State mutations before `await` are fine (still in the action), state mutations after `await` are properly wrapped in `runInAction`, error handling also wrapped in `runInAction`, apiClient excluded from observability

### Good Example - flow with Generator Functions (Recommended)

```typescript
// stores/project-store.ts
import { makeAutoObservable } from "mobx";
import type { ApiClient } from "../api-client";

const INITIAL_LOADING_STATE = false;

// CancellablePromise is not publicly exported from MobX - define inline
type CancellablePromise<T> = Promise<T> & { cancel(): void };

interface Project {
  id: string;
  name: string;
  description: string;
}

class ProjectStore {
  projects: Project[] = [];
  isLoading = INITIAL_LOADING_STATE;
  error: string | null = null;
  // Store reference to the cancellable promise
  private currentFetch: CancellablePromise<void> | null = null;

  constructor(private apiClient: ApiClient) {
    makeAutoObservable(this, {
      apiClient: false,
      currentFetch: false,
    });
  }

  // Generator function -> automatically inferred as `flow` by makeAutoObservable
  // No need to wrap state mutations in runInAction!
  // The flow wrapper ensures ALL yields resume within an action context
  *fetchProjects(): Generator<Promise<Project[]>, void, Project[]> {
    this.isLoading = true;
    this.error = null;
    try {
      // yield instead of await - MobX wraps the continuation in an action
      const projects = yield this.apiClient.getProjects();
      // This runs in action context automatically - no runInAction needed!
      this.projects = projects;
      this.isLoading = false;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Fetch failed";
      this.isLoading = false;
    }
  }

  // Cancel an in-progress fetch
  cancelFetch(): void {
    if (this.currentFetch) {
      this.currentFetch.cancel();
      this.currentFetch = null;
    }
  }

  // Start fetch with cancellation support
  startFetch(): void {
    this.cancelFetch(); // Cancel any previous fetch
    this.currentFetch =
      this.fetchProjects() as unknown as CancellablePromise<void>;
  }
}

export { ProjectStore };
```

**Why good:** Generator function auto-inferred as `flow` by `makeAutoObservable`, no `runInAction` wrapping needed (flow handles it), `CancellablePromise` type defined inline (not a public MobX export), cancellable promise from flow for request cancellation, cleaner than async/await + runInAction for complex async operations

### Bad Example - State Mutation After Await Without Wrapping

```typescript
// stores/broken-user-store.ts
import { makeAutoObservable } from "mobx";

class BrokenUserStore {
  users: User[] = [];
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchUsers(): Promise<void> {
    this.isLoading = true; // OK: before await, in original action
    try {
      const users = await fetch("/api/users").then((r) => r.json());
      // BAD: After await, this code runs in a NEW tick!
      // NOT inside the original action anymore
      // Will THROW with enforceActions: "always"
      this.users = users;
      this.isLoading = false;
    } catch (err) {
      this.isLoading = false; // Also BAD: after await
    }
  }
}

export { BrokenUserStore };
```

**Why bad:** Code after `await` executes in a new microtask, outside the original action context, will throw with `enforceActions: "always"`, intermediate state visible to observers between ticks causing flicker

---

## Pattern 9: Reactions (autorun, reaction, when)

### Good Example - autorun for Side Effects

```typescript
// effects/persistence-effect.ts
import { autorun } from "mobx";
import type { SettingsStore } from "../stores/settings-store";

const SETTINGS_STORAGE_KEY = "app-settings";

// autorun runs immediately AND whenever any read observable changes
function setupSettingsPersistence(settingsStore: SettingsStore): () => void {
  const disposer = autorun(() => {
    // MobX tracks: settingsStore.theme, settingsStore.language,
    // settingsStore.notifications
    const settings = {
      theme: settingsStore.theme,
      language: settingsStore.language,
      notifications: settingsStore.notifications,
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  });

  // Return disposer for cleanup
  return disposer;
}

export { setupSettingsPersistence };
```

**Why good:** `autorun` automatically tracks all observable reads inside the callback, runs on initialization (persists initial state) and on every change, returns disposer for cleanup, named constant for storage key

### Good Example - reaction for Targeted Side Effects

```typescript
// effects/search-effect.ts
import { reaction } from "mobx";
import type { SearchStore } from "../stores/search-store";

const SEARCH_DEBOUNCE_MS = 300;

// reaction: only runs when the DATA FUNCTION return value changes
// Does NOT run on initialization (unlike autorun)
function setupSearchSync(searchStore: SearchStore): () => void {
  const disposer = reaction(
    // Data function: returns the value to track
    () => searchStore.query,
    // Effect function: runs when data function return value changes
    (query) => {
      if (query.length > 0) {
        searchStore.performSearch(query);
      } else {
        searchStore.clearResults();
      }
    },
    {
      delay: SEARCH_DEBOUNCE_MS, // Debounce the effect
    },
  );

  return disposer;
}

export { setupSearchSync };
```

**Why good:** `reaction` separates what to track (data function) from what to do (effect), does NOT fire on initialization (unlike autorun), `delay` option provides built-in debouncing, disposer returned for cleanup

### Good Example - when for One-Time Effects

```typescript
// effects/onboarding-effect.ts
import { when } from "mobx";
import type { UserStore } from "../stores/user-store";

const ONBOARDING_TOAST_DELAY_MS = 500;

// when: runs effect ONCE when predicate becomes true, then auto-disposes
function setupOnboardingTrigger(userStore: UserStore): () => void {
  const disposer = when(
    // Predicate: wait until this returns true
    () => userStore.isAuthenticated && !userStore.hasCompletedOnboarding,
    // Effect: runs once, then reaction auto-disposes
    () => {
      setTimeout(() => {
        userStore.showOnboardingWizard();
      }, ONBOARDING_TOAST_DELAY_MS);
    },
  );

  // Can still manually dispose if component unmounts before trigger
  return disposer;
}

export { setupOnboardingTrigger };
```

**Why good:** `when` auto-disposes after the effect runs (no manual cleanup needed for the reaction itself), predicate clearly states the trigger condition, still returns disposer for early cleanup if needed

### Good Example - when as a Promise (Awaitable)

```typescript
// utils/wait-for-auth.ts
import { when } from "mobx";
import type { AuthStore } from "../stores/auth-store";

const AUTH_TIMEOUT_MS = 10000;

// when() without an effect function returns a Promise
async function waitForAuthentication(authStore: AuthStore): Promise<void> {
  try {
    await when(() => authStore.isAuthenticated, {
      timeout: AUTH_TIMEOUT_MS, // Rejects after timeout
    });
    console.log("User is now authenticated");
  } catch {
    console.error("Authentication timed out");
  }
}

export { waitForAuthentication };
```

**Why good:** `when` without effect returns a Promise, can be awaited in async code, `timeout` option rejects the promise if condition is not met in time, cleaner than polling

### Good Example - Cleanup in React useEffect

```typescript
// components/auto-save-form.tsx
import { useEffect } from "react";
import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { formStore } from "../stores/form-store";

export const AutoSaveForm = observer(function AutoSaveForm() {
  useEffect(() => {
    // autorun returns a disposer function
    // Returning it from useEffect ensures cleanup on unmount
    const disposer = autorun(() => {
      if (formStore.isDirty) {
        formStore.saveDraft();
      }
    });

    return disposer; // Cleanup: dispose reaction on unmount
  }, []);

  return <form>{/* form fields */}</form>;
});
```

**Why good:** Reaction disposer returned directly as useEffect cleanup, ensures no memory leak on unmount, empty dependency array means reaction is set up once, `observer` tracks observable reads in JSX

### Bad Example - Missing Disposal

```typescript
// effects/broken-persistence.ts
import { autorun } from "mobx";
import { settingsStore } from "../stores/settings-store";

// BAD: autorun creates a reaction that is NEVER disposed
// This will leak memory and keep running even after the
// component/module that set it up is no longer needed
autorun(() => {
  localStorage.setItem("settings", JSON.stringify(settingsStore.theme));
});

// No disposer captured, no cleanup function, memory leak guaranteed
```

**Why bad:** Reaction is never disposed, will keep running for the lifetime of the application, causes memory leaks, impossible to stop once started, reactions should always be disposed when no longer needed
