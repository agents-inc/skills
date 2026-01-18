# NgRx SignalStore - Core Examples

Core code examples for NgRx SignalStore setup with signalStore, withState, withComputed, withMethods, and withHooks.

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
import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';

const INITIAL_COUNT = 0;
const INCREMENT_STEP = 1;
const DECREMENT_STEP = 1;

interface CounterState {
  count: number;
  lastUpdated: Date | null;
}

export const CounterStore = signalStore(
  { providedIn: 'root' },
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
  }))
);
```

**Why good:** Typed state interface, named constants for all numbers, providedIn for DI, computed signals for derived state, patchState for immutable updates, clear method names, all named exports

### Bad Example - Direct Mutation and Magic Numbers

```typescript
// WRONG - Direct mutation, magic numbers, default export
import { signalStore, withState, withMethods } from '@ngrx/signals';

const CounterStore = signalStore(
  withState({ count: 0 }),
  withMethods((store) => ({
    increment() {
      // WRONG: Magic number, should be named constant
      store.count.set(store.count() + 1);
    },
    setCount(count: number) {
      // WRONG: Direct assignment
      store.count.set(count);
    },
  }))
);

export default CounterStore; // WRONG: default export
```

**Why bad:** Direct signal mutation bypasses store update mechanism, magic number `1` should be named constant, default export violates conventions, no TypeScript interface for state

---

## Pattern 2: Store with patchState Updaters

### Good Example - Multiple patchState Patterns

```typescript
// stores/user-preferences.store.ts
import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';

const DEFAULT_THEME = 'light' as const;
const DEFAULT_NOTIFICATIONS = true;
const DEFAULT_LOCALE = 'en-US';

type Theme = 'light' | 'dark' | 'system';

interface UserPreferencesState {
  theme: Theme;
  notifications: boolean;
  locale: string;
  fontSize: number;
}

export const UserPreferencesStore = signalStore(
  { providedIn: 'root' },
  withState<UserPreferencesState>({
    theme: DEFAULT_THEME,
    notifications: DEFAULT_NOTIFICATIONS,
    locale: DEFAULT_LOCALE,
    fontSize: 16,
  }),
  withComputed(({ theme }) => ({
    isDarkMode: computed(() => theme() === 'dark'),
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
        { locale: DEFAULT_LOCALE }
      );
    },
  }))
);
```

**Why good:** Multiple patchState patterns shown, updater function for computed updates, partial updates, multiple updaters in single call, all numbers are named constants

---

## Pattern 3: Store with withHooks

### Good Example - Lifecycle Hooks for Initialization

```typescript
// stores/app-settings.store.ts
import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';

const STORAGE_KEY = 'app-settings';

interface AppSettingsState {
  initialized: boolean;
  sidebarCollapsed: boolean;
  lastSyncTime: Date | null;
}

export const AppSettingsStore = signalStore(
  { providedIn: 'root' },
  withState<AppSettingsState>({
    initialized: false,
    sidebarCollapsed: false,
    lastSyncTime: null,
  }),
  withComputed(({ lastSyncTime }) => ({
    formattedSyncTime: computed(() =>
      lastSyncTime()?.toLocaleString() ?? 'Never'
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
      console.log('Settings store destroyed, sidebar was:', sidebarCollapsed());
    },
  })
);
```

**Why good:** onInit for initialization logic, onDestroy for cleanup, hooks have access to store methods and state, persistence pattern demonstrated

---

## Pattern 4: Store with Injection Context

### Good Example - Injecting Services in withMethods

```typescript
// stores/user.store.ts
import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';

const API_BASE_URL = '/api/users';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface UserState {
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
}

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState<UserState>({
    currentUser: null,
    isLoading: false,
    error: null,
  }),
  withComputed(({ currentUser }) => ({
    isLoggedIn: computed(() => currentUser() !== null),
    isAdmin: computed(() => currentUser()?.role === 'admin'),
    displayName: computed(() => currentUser()?.name ?? 'Guest'),
  })),
  withMethods((store) => {
    // Injection context - inject services here
    const http = inject(HttpClient);

    return {
      async loadCurrentUser() {
        patchState(store, { isLoading: true, error: null });

        try {
          const user = await http
            .get<User>(`${API_BASE_URL}/me`)
            .toPromise();
          patchState(store, { currentUser: user ?? null, isLoading: false });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load user';
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
  })
);
```

**Why good:** inject() used in injection context, HttpClient injected properly, async/await for simple operations, proper error handling, loading state management

---

## Pattern 5: Component Usage

### Good Example - Using Store in Component

```typescript
// components/counter.component.ts
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CounterStore } from '../stores/counter.store';

@Component({
  selector: 'app-counter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="counter">
      <h2>Count: {{ store.count() }}</h2>
      <p>Double: {{ store.doubleCount() }}</p>
      <p>Last updated: {{ store.lastUpdated()?.toLocaleString() ?? 'Never' }}</p>

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

**Why good:** OnPush change detection (signals handle updates), inject() for DI, direct template signal access with `()`, readonly store reference, disabled binding uses computed signal

### Bad Example - Subscribing and Manual Change Detection

```typescript
// WRONG - Manual subscription, change detection
import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CounterStore } from '../stores/counter.store';
import { effect } from '@angular/core';

@Component({
  selector: 'app-counter',
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

**Why bad:** Unnecessary effect subscription, manual change detection not needed with signals, stores local copy instead of using signal directly, violates signal patterns

---

## Pattern 6: withProps for Non-State Properties

### Good Example - Sharing Observables with withProps (v19+)

```typescript
// stores/search.store.ts
import { computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withProps,
  patchState,
} from '@ngrx/signals';

const DEBOUNCE_MS = 300;

interface SearchState {
  query: string;
  results: string[];
  isSearching: boolean;
}

export const SearchStore = signalStore(
  { providedIn: 'root' },
  withState<SearchState>({
    query: '',
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
  }))
);
```

**Why good:** withProps for non-signal properties, toObservable bridges signals to RxJS, constants exposed as props, clear separation of concerns

---

## Component-Level Stores

### Good Example - Scoped Store with Component Lifecycle

```typescript
// stores/modal.store.ts
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

interface ModalState {
  isOpen: boolean;
  title: string;
  content: string;
}

// NOT providedIn: 'root' - component will provide
export const ModalStore = signalStore(
  withState<ModalState>({
    isOpen: false,
    title: '',
    content: '',
  }),
  withMethods((store) => ({
    open(title: string, content: string) {
      patchState(store, { isOpen: true, title, content });
    },
    close() {
      patchState(store, { isOpen: false });
    },
  }))
);

// components/modal-container.component.ts
import { Component, inject } from '@angular/core';
import { ModalStore } from '../stores/modal.store';

@Component({
  selector: 'app-modal-container',
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

**Why good:** Component-scoped store (no providedIn), providers array for DI, store destroyed with component, each instance independent

---

## Pattern 7: withProps for Mutable Objects (v19+ Deep Freeze Migration)

### Good Example - FormGroup with withProps (v19+ Breaking Change)

In v19+, state values are recursively frozen with `Object.freeze`. Use `withProps()` for mutable objects like Angular's FormGroup.

```typescript
// stores/form.store.ts - v19+ CORRECT approach
import { inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  signalStore,
  withState,
  withMethods,
  withProps,
  patchState,
} from '@ngrx/signals';

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
  { providedIn: 'root' },
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
        name: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
      }),
    };
  }),
  withMethods((store) => ({
    async submit() {
      if (store.formGroup.invalid) return;

      patchState(store, { isSubmitting: true, submitError: null });

      try {
        const data = store.formGroup.value as UserFormData;
        await fetch('/api/users', {
          method: 'POST',
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
          submitError: err instanceof Error ? err.message : 'Submit failed',
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
  }))
);
```

**Why good:** FormGroup in `withProps` (mutable, not frozen), reactive state in `withState` (immutable), clear separation of mutable vs immutable data

### Bad Example - FormGroup in withState (v19+ Breaking Change)

```typescript
// WRONG - FormGroup in withState will be frozen in v19+
import { FormGroup, FormControl } from '@angular/forms';
import { signalStore, withState, withMethods } from '@ngrx/signals';

export const BrokenFormStore = signalStore(
  // ERROR in v19+: "object is not extensible"
  withState({
    formGroup: new FormGroup({
      name: new FormControl(''),
    }),
  }),
  withMethods((store) => ({
    addField() {
      // This will FAIL in v19+ due to deep freeze
      store.formGroup().addControl('email', new FormControl(''));
    },
  }))
);
```

**Why bad:** v19+ applies `Object.freeze` recursively to state - FormGroup mutations will throw "object is not extensible" error

### withState vs withProps Decision Guide

| Use Case | Feature | Reason |
|----------|---------|--------|
| Primitive values | `withState` | Reactive, immutable |
| Simple objects | `withState` | Reactive, frozen |
| Arrays | `withState` | Reactive, use entity updaters |
| FormGroup/FormControl | `withProps` | Needs mutation |
| Services | `withProps` | Not state |
| Observables | `withProps` | Not reactive state |
| Constants | `withProps` | Static values |
