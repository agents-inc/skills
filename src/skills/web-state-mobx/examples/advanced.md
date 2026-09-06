# MobX - Advanced Examples

> Computed values, actions, async operations and reactions. See [SKILL.md](../SKILL.md) for the decision frameworks and red flags.

**Additional Examples:**

- [Core Patterns](core.md) - Store creation, observer, useLocalObservable
- [Architecture Patterns](architecture.md) - Root store, TypeScript, performance

---

## Pattern 6: Computed Values

### Good Example - Chained Derivations

```typescript
// stores/shopping-cart-store.ts
import { makeAutoObservable } from "mobx";

const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 50;
const STANDARD_SHIPPING_COST = 5.99;

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

  get subtotal(): number {
    return this.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  }

  get tax(): number {
    return this.subtotal * TAX_RATE;
  }

  get shippingCost(): number {
    return this.subtotal >= FREE_SHIPPING_THRESHOLD
      ? 0
      : STANDARD_SHIPPING_COST;
  }

  get total(): number {
    return this.subtotal + this.tax + this.shippingCost;
  }

  get itemCount(): number {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  addItem(item: Omit<CartItem, "quantity">): void {
    const existing = this.items.find((i) => i.id === item.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.items.push({ ...item, quantity: 1 });
    }
  }

  removeItem(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }
}

export { ShoppingCartStore };
```

**Why good:** `total` reads three computeds, each of which reads `items`. Pushing an item recalculates the chain once and notifies once, and nothing here needs memoising by hand.

### Bad Example - Derived State Stored as Observable

```typescript
class BrokenCartStore {
  items: CartItem[] = [];
  subtotal = 0;
  total = 0;

  constructor() {
    makeAutoObservable(this);
  }

  addItem(item: CartItem): void {
    this.items.push(item);
    this.subtotal = this.items.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0,
    );
    this.total = this.subtotal * 1.08 + 5.99;
  }
}
```

**Why bad:** Every action that touches `items` now owes a recalculation, and `removeItem` forgetting it leaves a total that disagrees with the cart. A computed cannot be forgotten.

### Good Example - computed.struct

```typescript
// stores/filter-store.ts
import { makeAutoObservable, computed } from "mobx";

interface FilterResult {
  category: string;
  priceRange: { min: number; max: number };
}

class FilterStore {
  category = "all";
  minPrice = 0;
  maxPrice = Infinity;

  constructor() {
    makeAutoObservable(this, { activeFilters: computed.struct });
  }

  get activeFilters(): FilterResult {
    return {
      category: this.category,
      priceRange: { min: this.minPrice, max: this.maxPrice },
    };
  }

  setPriceRange(min: number, max: number): void {
    this.minPrice = min;
    this.maxPrice = max;
  }
}

export { FilterStore };
```

**Why good:** The getter builds a new object on every evaluation, so reference comparison always reports a change. `computed.struct` compares the contents instead, and observers stay put when the values are the same.

---

## Pattern 7: Actions and runInAction

### Good Example - Batched Mutations

```typescript
// stores/user-profile-store.ts
import { makeAutoObservable } from "mobx";

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

class UserProfileStore {
  profile: UserProfile | null = null;
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  updateProfile(updates: Partial<UserProfile>): void {
    if (!this.profile) return;
    this.profile = { ...this.profile, ...updates };
    this.error = null;
  }

  resetProfile(): void {
    this.profile = null;
    this.isLoading = false;
    this.error = null;
  }
}

export { UserProfileStore };
```

**Why good:** `resetProfile` assigns three times and notifies once, so no observer ever sees the half-reset state.

### Bad Example - Mutating Outside an Action

```typescript
import { configure } from "mobx";

configure({ enforceActions: "always" });

const store = new UserProfileStore();
store.profile = { name: "Bob", email: "bob@example.com", avatar: "" };
// [MobX] Since strict-mode is enabled, changing observed observable
// values without using an action is not allowed.
```

**Why bad:** Under `enforceActions: "always"` this throws. Without it the assignment lands but is unbatched, so each write fires reactions on its own.

---

## Pattern 8: Async Patterns (flow and runInAction)

### Good Example - runInAction After Await

```typescript
// stores/user-store.ts
import { makeAutoObservable, runInAction } from "mobx";
import type { ApiClient } from "../api-client";

interface User {
  id: string;
  name: string;
  email: string;
}

class UserStore {
  users: User[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(private apiClient: ApiClient) {
    makeAutoObservable(this, { apiClient: false });
  }

  async fetchUsers(): Promise<void> {
    this.isLoading = true; // still inside the action
    this.error = null;
    try {
      const users = await this.apiClient.getUsers();
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
}

export { UserStore };
```

**Why good:** The method is an action, but only up to the first `await`. Both continuations — success and failure — get their own `runInAction`, which is the half people forget.

### Good Example - flow with Cancellation

```typescript
// stores/project-store.ts
import { makeAutoObservable, flowResult } from "mobx";
import type { CancellablePromise } from "mobx";
import type { ApiClient } from "../api-client";

interface Project {
  id: string;
  name: string;
  description: string;
}

class ProjectStore {
  projects: Project[] = [];
  isLoading = false;
  error: string | null = null;
  private currentFetch: CancellablePromise<void> | null = null;

  constructor(private apiClient: ApiClient) {
    makeAutoObservable(this, { apiClient: false, currentFetch: false });
  }

  // Inferred as `flow`, so every resumption is already in action context
  *fetchProjects(): Generator<Promise<Project[]>, void, Project[]> {
    this.isLoading = true;
    this.error = null;
    try {
      const projects = yield this.apiClient.getProjects();
      this.projects = projects;
      this.isLoading = false;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Fetch failed";
      this.isLoading = false;
    }
  }

  startFetch(): void {
    this.currentFetch?.cancel();
    this.currentFetch = flowResult(this.fetchProjects());
  }
}

export { ProjectStore };
```

**Why good:** `yield` hands control back inside the action, so no assignment here needs wrapping — including the ones in `catch`. `flowResult` gives TypeScript the `CancellablePromise` the flow actually returns, which is what makes `.cancel()` reachable without a double cast.

### Bad Example - Assigning After Await Unwrapped

```typescript
async fetchUsers(): Promise<void> {
  this.isLoading = true;  // fine: before the await
  try {
    const users = await fetch("/api/users").then((r) => r.json());
    this.users = users;         // new tick, outside the action
    this.isLoading = false;
  } catch {
    this.isLoading = false;     // also outside the action
  }
}
```

**Why bad:** Both continuations run in a later microtask, outside the action that started them. Under `enforceActions: "always"` they throw; otherwise each assignment notifies separately, so observers can see `users` populated while `isLoading` is still true.

---

## Pattern 9: Reactions (autorun, reaction, when)

### Good Example - autorun for Side Effects

```typescript
// effects/persistence-effect.ts
import { autorun } from "mobx";
import type { SettingsStore } from "../stores/settings-store";

const SETTINGS_STORAGE_KEY = "app-settings";

function setupSettingsPersistence(settingsStore: SettingsStore): () => void {
  return autorun(() => {
    const settings = {
      theme: settingsStore.theme,
      language: settingsStore.language,
      notifications: settingsStore.notifications,
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  });
}

export { setupSettingsPersistence };
```

**Why good:** The dependency list is whatever the body read — all three fields — and it is re-derived on every run, so adding a field to the object subscribes to it with no other change. Running immediately means the stored copy is correct from the start.

### Good Example - reaction for Targeted Side Effects

```typescript
// effects/search-effect.ts
import { reaction } from "mobx";
import type { SearchStore } from "../stores/search-store";

const SEARCH_DEBOUNCE_MS = 300;

function setupSearchSync(searchStore: SearchStore): () => void {
  return reaction(
    () => searchStore.query,
    (query) => {
      if (query.length > 0) {
        searchStore.performSearch(query);
      } else {
        searchStore.clearResults();
      }
    },
    { delay: SEARCH_DEBOUNCE_MS },
  );
}

export { setupSearchSync };
```

**Why good:** Only the data function is tracked, so the effect can touch anything without subscribing to it. It does not fire on setup, which is what stops a search running against an empty query at startup, and `delay` debounces without a timer to manage.

### Good Example - when for a One-Time Trigger

```typescript
// effects/onboarding-effect.ts
import { when } from "mobx";
import type { UserStore } from "../stores/user-store";

function setupOnboardingTrigger(userStore: UserStore): () => void {
  return when(
    () => userStore.isAuthenticated && !userStore.hasCompletedOnboarding,
    () => userStore.showOnboardingWizard(),
  );
}

export { setupOnboardingTrigger };
```

**Why good:** Disposes itself once the effect has run, and still returns a disposer for the case where the caller goes away before the predicate ever holds.

### Good Example - when as an Awaitable

```typescript
// utils/wait-for-auth.ts
import { when } from "mobx";
import type { AuthStore } from "../stores/auth-store";

const AUTH_TIMEOUT_MS = 10000;

async function waitForAuthentication(authStore: AuthStore): Promise<void> {
  await when(() => authStore.isAuthenticated, { timeout: AUTH_TIMEOUT_MS });
}

export { waitForAuthentication };
```

**Why good:** With no effect function `when` returns a promise, so a condition on the reactive graph becomes something async code can wait on. `timeout` rejects rather than hanging.

### Good Example - Disposal from a Component

```typescript
// components/auto-save-form.tsx
import { useEffect } from "react";
import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { formStore } from "../stores/form-store";

export const AutoSaveForm = observer(function AutoSaveForm() {
  useEffect(() => {
    return autorun(() => {
      if (formStore.isDirty) {
        formStore.saveDraft();
      }
    });
  }, []);

  return <form>{/* form fields */}</form>;
});
```

**Why good:** The disposer is the cleanup function, so the two cannot drift apart.

### Bad Example - Never Disposed

```typescript
import { autorun } from "mobx";
import { settingsStore } from "../stores/settings-store";

autorun(() => {
  localStorage.setItem("settings", JSON.stringify(settingsStore.theme));
});
```

**Why bad:** The disposer is discarded, so the reaction runs for the lifetime of the process and holds `settingsStore` alive with it. There is no handle left to stop it.
