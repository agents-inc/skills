# NgRx SignalStore - Core Examples

> Store composition, state updates, hooks, DI and `withProps`. See [SKILL.md](../SKILL.md) for the decision trees and red flags, and [reference.md](../reference.md) for the feature lookup and migration steps.

**Related examples:**

- [entities.md](entities.md) - withEntities, CRUD operations
- [effects.md](effects.md) - rxMethod, side effects
- [features.md](features.md) - signalStoreFeature, custom features
- [testing.md](testing.md) - Unit tests, mocking strategies
- [migration.md](migration.md) - Migration from traditional NgRx

---

## Pattern 1: Basic Store with signalStore

### Good Example - Store with withState, withComputed, withMethods

```typescript
// stores/counter.store.ts
import { computed, inject } from "@angular/core";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from "@ngrx/signals";

const INITIAL_COUNT = 0;
const INCREMENT_STEP = 1;
const DECREMENT_STEP = 1;

interface CounterState {
  count: number;
  lastUpdated: Date | null;
}

export const CounterStore = signalStore(
  { providedIn: "root" },
  withState<CounterState>({
    count: INITIAL_COUNT,
    lastUpdated: null,
  }),
  withComputed(({ count }) => ({
    doubleCount: computed(() => count() * 2),
    isPositive: computed(() => count() > 0),
    isNegative: computed(() => count() < 0),
  })),
  withMethods((store) => ({
    increment() {
      patchState(store, (state) => ({
        count: state.count + INCREMENT_STEP,
        lastUpdated: new Date(),
      }));
    },
    decrement() {
      patchState(store, (state) => ({
        count: state.count - DECREMENT_STEP,
        lastUpdated: new Date(),
      }));
    },
    reset() {
      patchState(store, {
        count: INITIAL_COUNT,
        lastUpdated: new Date(),
      });
    },
    setCount(count: number) {
      patchState(store, { count, lastUpdated: new Date() });
    },
  })),
);
```

**Why good:** Declaring the state interface is what gives `withComputed` and `withMethods` their parameter types further down the chain, since each feature is typed from the accumulated store above it. `providedIn` settles the lifetime at the declaration rather than at each injection site, and every write goes through `patchState`, so the signals notify and the DevTools timeline has an entry.

### Bad Example - Writing to the Signals Directly

```typescript
import { signalStore, withState, withMethods } from "@ngrx/signals";

export const CounterStore = signalStore(
  withState({ count: 0 }),
  withMethods((store) => ({
    increment() {
      store.count.set(store.count() + 1);
    },
    setCount(count: number) {
      store.count.set(count);
    },
  })),
);
```

**Why bad:** `set` on the individual signal goes around the store's update path, so the change is not a state transition — nothing records it and the protection added in v18 rejects it outright. `patchState(store, ...)` is the single write path, which is what makes every change one notification and one DevTools entry.

---

## Pattern 2: Store with patchState Updaters

### Good Example - Multiple patchState Patterns

```typescript
// stores/user-preferences.store.ts
import { computed } from "@angular/core";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from "@ngrx/signals";

const DEFAULT_THEME = "light" as const;
const DEFAULT_NOTIFICATIONS = true;
const DEFAULT_LOCALE = "en-US";
const DEFAULT_FONT_SIZE = 16;

type Theme = "light" | "dark" | "system";

interface UserPreferencesState {
  theme: Theme;
  notifications: boolean;
  locale: string;
  fontSize: number;
}

export const UserPreferencesStore = signalStore(
  { providedIn: "root" },
  withState<UserPreferencesState>({
    theme: DEFAULT_THEME,
    notifications: DEFAULT_NOTIFICATIONS,
    locale: DEFAULT_LOCALE,
    fontSize: DEFAULT_FONT_SIZE,
  }),
  withComputed(({ theme }) => ({
    isDarkMode: computed(() => theme() === "dark"),
  })),
  withMethods((store) => ({
    // Partial state update - simple object
    setTheme(theme: Theme) {
      patchState(store, { theme });
    },

    // Partial state update - updater function
    toggleNotifications() {
      patchState(store, (state) => ({
        notifications: !state.notifications,
      }));
    },

    // Multiple properties at once
    updateSettings(settings: Partial<UserPreferencesState>) {
      patchState(store, settings);
    },

    // Multiple updaters in single call
    resetToDefaults() {
      patchState(
        store,
        { theme: DEFAULT_THEME },
        { notifications: DEFAULT_NOTIFICATIONS },
        { locale: DEFAULT_LOCALE },
      );
    },
  })),
);
```

**Why good:** The object form suffices when the new value does not depend on the old; the function form is required when it does, because reading `store.x()` and writing back separately can interleave with another write. Several updaters in one `patchState` apply as a single transition, so readers never observe the store half-updated — `resetToDefaults` cannot leave the theme reset and the locale stale.

---

## Pattern 3: Store with withHooks

### Good Example - Lifecycle Hooks for Initialization

```typescript
// stores/app-settings.store.ts
import { computed, inject } from "@angular/core";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from "@ngrx/signals";

const STORAGE_KEY = "app-settings";

interface AppSettingsState {
  initialized: boolean;
  sidebarCollapsed: boolean;
  lastSyncTime: Date | null;
}

export const AppSettingsStore = signalStore(
  { providedIn: "root" },
  withState<AppSettingsState>({
    initialized: false,
    sidebarCollapsed: false,
    lastSyncTime: null,
  }),
  withComputed(({ lastSyncTime }) => ({
    formattedSyncTime: computed(
      () => lastSyncTime()?.toLocaleString() ?? "Never",
    ),
  })),
  withMethods((store) => ({
    toggleSidebar() {
      patchState(store, (state) => ({
        sidebarCollapsed: !state.sidebarCollapsed,
      }));
    },
    loadFromStorage() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettingsState>;
        patchState(store, parsed);
      }
      patchState(store, { initialized: true });
    },
    saveToStorage() {
      const state = {
        sidebarCollapsed: store.sidebarCollapsed(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      patchState(store, { lastSyncTime: new Date() });
    },
  })),
  withHooks({
    onInit({ loadFromStorage }) {
      // Load persisted settings on store creation
      loadFromStorage();
    },
    onDestroy({ saveToStorage, sidebarCollapsed }) {
      // Save settings when store is destroyed
      saveToStorage();
      console.log("Settings store destroyed, sidebar was:", sidebarCollapsed());
    },
  }),
);
```

**Why good:** Both hooks are destructured from the store, so they reach the methods and signals declared above them — which is why `withHooks` comes last. `onDestroy` fires when the injector is destroyed, so a `providedIn: "root"` store like this one only saves on page teardown; a component-scoped store would save on every unmount.

Loading in `onInit` means the store is populated before any component reads it, at the cost of running in every test that injects it.

---

## Pattern 4: Store with Injection Context

### Good Example - Injecting Services in withMethods

```typescript
// stores/user.store.ts
import { computed, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from "@ngrx/signals";
import { firstValueFrom } from "rxjs";

const API_BASE_URL = "/api/users";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

interface UserState {
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
}

export const UserStore = signalStore(
  { providedIn: "root" },
  withState<UserState>({
    currentUser: null,
    isLoading: false,
    error: null,
  }),
  withComputed(({ currentUser }) => ({
    isLoggedIn: computed(() => currentUser() !== null),
    isAdmin: computed(() => currentUser()?.role === "admin"),
    displayName: computed(() => currentUser()?.name ?? "Guest"),
  })),
  withMethods((store) => {
    // Injection context - inject services here
    const http = inject(HttpClient);

    return {
      async loadCurrentUser() {
        patchState(store, { isLoading: true, error: null });

        try {
          const user = await firstValueFrom(
            http.get<User>(`${API_BASE_URL}/me`),
          );
          patchState(store, { currentUser: user ?? null, isLoading: false });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to load user";
          patchState(store, { error: message, isLoading: false });
        }
      },

      logout() {
        patchState(store, {
          currentUser: null,
          error: null,
        });
      },
    };
  }),
);
```

**Why good:** `withMethods` runs inside the store's injection context, so `inject(HttpClient)` works there and the reference is captured once in the closure rather than resolved per call. Plain `async`/`await` is the right weight here — loading the current user happens once, on demand, with nothing to cancel and no stream to debounce.

Both the success and failure paths clear `isLoading`, which is the half that gets forgotten and leaves a spinner running after a failed request.

---

## Pattern 5: Component Usage

### Good Example - Using Store in Component

```typescript
// components/counter.component.ts
import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { CounterStore } from "../stores/counter.store";

@Component({
  selector: "app-counter",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="counter">
      <h2>Count: {{ store.count() }}</h2>
      <p>Double: {{ store.doubleCount() }}</p>
      <p>
        Last updated: {{ store.lastUpdated()?.toLocaleString() ?? "Never" }}
      </p>

      <div class="actions">
        <button (click)="store.decrement()" [disabled]="!store.isPositive()">
          Decrement
        </button>
        <button (click)="store.increment()">Increment</button>
        <button (click)="store.reset()">Reset</button>
      </div>
    </div>
  `,
})
export class CounterComponent {
  readonly store = inject(CounterStore);
}
```

**Why good:** Calling the signals in the template is what registers the dependency, so `OnPush` is safe without a single manual check — the signal reads schedule the re-render themselves. The component holds no state of its own; it is a projection of the store plus event handlers, which is why there is nothing to keep in sync.

### Bad Example - Subscribing and Manual Change Detection

```typescript
// WRONG - Manual subscription, change detection
import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from "@angular/core";
import { CounterStore } from "../stores/counter.store";
import { effect } from "@angular/core";

@Component({
  selector: "app-counter",
  template: `<h2>Count: {{ count }}</h2>`,
})
export class CounterComponent implements OnInit, OnDestroy {
  store = inject(CounterStore);
  cdr = inject(ChangeDetectorRef);
  count = 0;

  ngOnInit() {
    // WRONG: Manual subscription to signal
    effect(() => {
      this.count = this.store.count();
      this.cdr.markForCheck(); // WRONG: Unnecessary
    });
  }

  ngOnDestroy() {
    // Cleanup logic...
  }
}
```

**Why bad:** Copying the signal into a plain field discards the tracking that makes it useful — the template now reads a number, so Angular has no way to know when to re-render and the `markForCheck` is there to paper over that. Reading `store.count()` in the template instead registers the dependency and the copy, the effect and the manual change detection all become unnecessary.

---

## Pattern 6: withProps for Non-State Properties

### Good Example - Sharing Observables with withProps (v19+)

```typescript
// stores/search.store.ts
import { computed, inject } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withProps,
  patchState,
} from "@ngrx/signals";

const DEBOUNCE_MS = 300;

interface SearchState {
  query: string;
  results: string[];
  isSearching: boolean;
}

export const SearchStore = signalStore(
  { providedIn: "root" },
  withState<SearchState>({
    query: "",
    results: [],
    isSearching: false,
  }),
  withComputed(({ query, results }) => ({
    hasResults: computed(() => results().length > 0),
    resultCount: computed(() => results().length),
  })),
  // withProps for non-reactive properties (observables, constants)
  withProps(({ query }) => ({
    // Expose query as observable for RxJS interop
    query$: toObservable(query),
    debounceMs: DEBOUNCE_MS,
  })),
  withMethods((store) => ({
    setQuery(query: string) {
      patchState(store, { query });
    },
    setResults(results: string[]) {
      patchState(store, { results, isSearching: false });
    },
    startSearch() {
      patchState(store, { isSearching: true });
    },
  })),
);
```

**Why good:** `withProps` members are plain values on the store rather than state, so they are neither patched nor frozen. `toObservable` needs an injection context, and `withProps` supplies one — which is what makes this the place to build the bridge rather than the component. Exposing `query$` lets an RxJS consumer subscribe without reaching back into the signal.

---

## Component-Level Stores

### Good Example - Scoped Store with Component Lifecycle

```typescript
// stores/modal.store.ts
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";

interface ModalState {
  isOpen: boolean;
  title: string;
  content: string;
}

// NOT providedIn: 'root' - component will provide
export const ModalStore = signalStore(
  withState<ModalState>({
    isOpen: false,
    title: "",
    content: "",
  }),
  withMethods((store) => ({
    open(title: string, content: string) {
      patchState(store, { isOpen: true, title, content });
    },
    close() {
      patchState(store, { isOpen: false });
    },
  })),
);

// components/modal-container.component.ts
import { Component, inject } from "@angular/core";
import { ModalStore } from "../stores/modal.store";

@Component({
  selector: "app-modal-container",
  standalone: true,
  // Component-level provider - new instance per component
  providers: [ModalStore],
  template: `
    @if (store.isOpen()) {
      <div class="modal-backdrop" (click)="store.close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ store.title() }}</h2>
          <p>{{ store.content() }}</p>
          <button (click)="store.close()">Close</button>
        </div>
      </div>
    }
  `,
})
export class ModalContainerComponent {
  readonly store = inject(ModalStore);
}
```

**Why good:** Listing the store in `providers` rather than declaring `providedIn: "root"` gives each component instance its own store, destroyed with the component — so two modals on a page do not share an open flag, and no state survives to the next time this one mounts. Any `rxMethod` subscription in the store ends at the same moment, with no cleanup code in the component.

---

## Pattern 7: withProps for Mutable Objects (v19+ Deep Freeze Migration)

### Good Example - FormGroup with withProps (v19+ Breaking Change)

In v19+, state values are recursively frozen with `Object.freeze`. Use `withProps()` for mutable objects like Angular's FormGroup.

```typescript
// stores/form.store.ts - v19+ CORRECT approach
import { inject } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import {
  signalStore,
  withState,
  withMethods,
  withProps,
  patchState,
} from "@ngrx/signals";

interface UserFormData {
  name: string;
  email: string;
}

interface FormState {
  isSubmitting: boolean;
  submitError: string | null;
  lastSavedData: UserFormData | null;
}

export const UserFormStore = signalStore(
  { providedIn: "root" },
  // Reactive state (will be frozen)
  withState<FormState>({
    isSubmitting: false,
    submitError: null,
    lastSavedData: null,
  }),
  // Mutable objects go in withProps (NOT frozen)
  withProps(() => {
    const fb = inject(FormBuilder);

    return {
      // FormGroup is mutable - use withProps
      formGroup: fb.group({
        name: ["", [Validators.required, Validators.minLength(2)]],
        email: ["", [Validators.required, Validators.email]],
      }),
    };
  }),
  withMethods((store) => ({
    async submit() {
      if (store.formGroup.invalid) return;

      patchState(store, { isSubmitting: true, submitError: null });

      try {
        const data = store.formGroup.value as UserFormData;
        await fetch("/api/users", {
          method: "POST",
          body: JSON.stringify(data),
        });

        patchState(store, {
          isSubmitting: false,
          lastSavedData: data,
        });
        store.formGroup.reset();
      } catch (err) {
        patchState(store, {
          isSubmitting: false,
          submitError: err instanceof Error ? err.message : "Submit failed",
        });
      }
    },

    resetForm() {
      store.formGroup.reset();
      patchState(store, { submitError: null });
    },

    loadData(data: UserFormData) {
      store.formGroup.patchValue(data);
    },
  })),
);
```

**Why good:** The `FormGroup` manages its own values and mutates itself, so it is not state in this store's sense — `withProps` holds it as a plain reference, out of reach of both `patchState` and the freeze. What _is_ state is the surrounding status: `isSubmitting` and `submitError` are what the template branches on, and those stay signals.

### Bad Example - FormGroup in withState (v19+ Breaking Change)

```typescript
// WRONG - FormGroup in withState will be frozen in v19+
import { FormGroup, FormControl } from "@angular/forms";
import { signalStore, withState, withMethods } from "@ngrx/signals";

export const BrokenFormStore = signalStore(
  // ERROR in v19+: "object is not extensible"
  withState({
    formGroup: new FormGroup({
      name: new FormControl(""),
    }),
  }),
  withMethods((store) => ({
    addField() {
      // This will FAIL in v19+ due to deep freeze
      store.formGroup().addControl("email", new FormControl(""));
    },
  })),
);
```

**Why bad:** v19+ applies `Object.freeze` recursively to state - FormGroup mutations will throw "object is not extensible" error

### withState vs withProps — worked comparison

| Use Case              | Feature     | Reason                        |
| --------------------- | ----------- | ----------------------------- |
| Primitive values      | `withState` | Reactive, immutable           |
| Simple objects        | `withState` | Reactive, frozen              |
| Arrays                | `withState` | Reactive, use entity updaters |
| FormGroup/FormControl | `withProps` | Needs mutation                |
| Services              | `withProps` | Not state                     |
| Observables           | `withProps` | Not reactive state            |
| Constants             | `withProps` | Static values                 |
