# NgRx SignalStore - Migration Examples

Migration patterns from traditional NgRx (actions, reducers, effects, selectors) to NgRx SignalStore.

**Prerequisites:** Understand [core.md](core.md) (signalStore basics) and [effects.md](effects.md) first.

**Related examples:**
- [entities.md](entities.md) - withEntities, CRUD operations
- [features.md](features.md) - signalStoreFeature, custom features
- [testing.md](testing.md) - Unit tests, mocking strategies

---

## Pattern 1: Migrating Actions to Methods

### Traditional NgRx - Actions

```typescript
// Before: Traditional NgRx actions
// store/counter/counter.actions.ts
import { createAction, props } from '@ngrx/store';

export const increment = createAction('[Counter] Increment');
export const decrement = createAction('[Counter] Decrement');
export const reset = createAction('[Counter] Reset');
export const setCount = createAction(
  '[Counter] Set Count',
  props<{ count: number }>()
);
```

### SignalStore - Methods

```typescript
// After: SignalStore methods replace actions
// stores/counter.store.ts
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

const INITIAL_COUNT = 0;
const INCREMENT_STEP = 1;

export const CounterStore = signalStore(
  { providedIn: 'root' },
  withState({ count: INITIAL_COUNT }),
  withMethods((store) => ({
    // Actions become methods
    increment() {
      patchState(store, (state) => ({ count: state.count + INCREMENT_STEP }));
    },
    decrement() {
      patchState(store, (state) => ({ count: state.count - INCREMENT_STEP }));
    },
    reset() {
      patchState(store, { count: INITIAL_COUNT });
    },
    setCount(count: number) {
      patchState(store, { count });
    },
  }))
);

// Component usage
// Before: this.store.dispatch(increment());
// After: this.store.increment();
```

**Why better:** No action boilerplate, no action type strings, no separate action files, direct method calls

---

## Pattern 2: Migrating Reducers to patchState

### Traditional NgRx - Reducer

```typescript
// Before: Traditional NgRx reducer
// store/todos/todos.reducer.ts
import { createReducer, on } from '@ngrx/store';
import * as TodoActions from './todos.actions';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodosState {
  items: Todo[];
  loading: boolean;
  error: string | null;
}

const initialState: TodosState = {
  items: [],
  loading: false,
  error: null,
};

export const todosReducer = createReducer(
  initialState,
  on(TodoActions.loadTodos, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(TodoActions.loadTodosSuccess, (state, { todos }) => ({
    ...state,
    items: todos,
    loading: false,
  })),
  on(TodoActions.loadTodosFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false,
  })),
  on(TodoActions.addTodo, (state, { todo }) => ({
    ...state,
    items: [...state.items, todo],
  })),
  on(TodoActions.toggleTodo, (state, { id }) => ({
    ...state,
    items: state.items.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ),
  }))
);
```

### SignalStore - withState and patchState

```typescript
// After: SignalStore with patchState
// stores/todo.store.ts
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';

const TODOS_API_URL = '/api/todos';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodosState {
  items: Todo[];
  loading: boolean;
  error: string | null;
}

export const TodoStore = signalStore(
  { providedIn: 'root' },
  withState<TodosState>({
    items: [],
    loading: false,
    error: null,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      // loadTodos, loadTodosSuccess, loadTodosFailure combined
      loadTodos: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            http.get<Todo[]>(TODOS_API_URL).pipe(
              catchError((err) => {
                patchState(store, {
                  error: err.message,
                  loading: false,
                });
                return of([]);
              })
            )
          ),
          tap((items) => patchState(store, { items, loading: false }))
        )
      ),

      // addTodo with patchState
      addTodo(title: string) {
        const todo: Todo = {
          id: crypto.randomUUID(),
          title,
          completed: false,
        };
        patchState(store, (state) => ({
          items: [...state.items, todo],
        }));
      },

      // toggleTodo with patchState
      toggleTodo(id: string) {
        patchState(store, (state) => ({
          items: state.items.map((t) =>
            t.id === id ? { ...t, completed: !t.completed } : t
          ),
        }));
      },
    };
  })
);
```

**Why better:** No reducer boilerplate, no action matching, single source of truth, rxMethod handles async loading pattern

---

## Pattern 3: Migrating Selectors to withComputed

### Traditional NgRx - Selectors

```typescript
// Before: Traditional NgRx selectors
// store/todos/todos.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';

interface TodosState {
  items: Todo[];
  filter: 'all' | 'active' | 'completed';
}

const selectTodosState = createFeatureSelector<TodosState>('todos');

export const selectAllTodos = createSelector(
  selectTodosState,
  (state) => state.items
);

export const selectFilter = createSelector(
  selectTodosState,
  (state) => state.filter
);

export const selectFilteredTodos = createSelector(
  selectAllTodos,
  selectFilter,
  (todos, filter) => {
    switch (filter) {
      case 'active':
        return todos.filter((t) => !t.completed);
      case 'completed':
        return todos.filter((t) => t.completed);
      default:
        return todos;
    }
  }
);

export const selectCompletedCount = createSelector(
  selectAllTodos,
  (todos) => todos.filter((t) => t.completed).length
);

export const selectActiveCount = createSelector(
  selectAllTodos,
  (todos) => todos.filter((t) => !t.completed).length
);
```

### SignalStore - withComputed

```typescript
// After: SignalStore with computed signals
// stores/todo.store.ts
import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

type TodoFilter = 'all' | 'active' | 'completed';

export const TodoStore = signalStore(
  { providedIn: 'root' },
  withState({
    items: [] as Todo[],
    filter: 'all' as TodoFilter,
  }),
  // Selectors become computed signals
  withComputed(({ items, filter }) => ({
    filteredTodos: computed(() => {
      const allItems = items();
      const currentFilter = filter();

      switch (currentFilter) {
        case 'active':
          return allItems.filter((t) => !t.completed);
        case 'completed':
          return allItems.filter((t) => t.completed);
        default:
          return allItems;
      }
    }),
    completedCount: computed(() =>
      items().filter((t) => t.completed).length
    ),
    activeCount: computed(() =>
      items().filter((t) => !t.completed).length
    ),
    totalCount: computed(() => items().length),
  })),
  withMethods((store) => ({
    setFilter(filter: TodoFilter) {
      patchState(store, { filter });
    },
    // Other methods...
  }))
);

// Component usage
// Before: this.store.select(selectFilteredTodos)
// After: this.store.filteredTodos()
```

**Why better:** No selector factory boilerplate, automatic memoization, direct signal access in templates, no need for async pipe

---

## Pattern 4: Migrating Effects to rxMethod

### Traditional NgRx - Effects

```typescript
// Before: Traditional NgRx effects
// store/users/users.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, switchMap, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as UserActions from './users.actions';
import { UserService } from '../../services/user.service';

@Injectable()
export class UserEffects {
  loadUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.loadUsers),
      switchMap(() =>
        this.userService.getUsers().pipe(
          map((users) => UserActions.loadUsersSuccess({ users })),
          catchError((error) => of(UserActions.loadUsersFailure({ error })))
        )
      )
    )
  );

  searchUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.searchUsers),
      debounceTime(300),
      distinctUntilChanged((prev, curr) => prev.query === curr.query),
      switchMap(({ query }) =>
        this.userService.searchUsers(query).pipe(
          map((users) => UserActions.searchUsersSuccess({ users })),
          catchError((error) => of(UserActions.searchUsersFailure({ error })))
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private userService: UserService
  ) {}
}
```

### SignalStore - rxMethod

```typescript
// After: SignalStore with rxMethod
// stores/user.store.ts
import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  pipe,
  tap,
  switchMap,
  catchError,
  of,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs';
import { UserService } from '../services/user.service';

const SEARCH_DEBOUNCE_MS = 300;

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserState {
  users: User[];
  isLoading: boolean;
  error: string | null;
}

export const UserStore = signalStore(
  { providedIn: 'root' },
  withState<UserState>({
    users: [],
    isLoading: false,
    error: null,
  }),
  withMethods((store) => {
    const userService = inject(UserService);

    return {
      // loadUsers effect becomes rxMethod
      loadUsers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            userService.getUsers().pipe(
              catchError((err) => {
                patchState(store, { error: err.message, isLoading: false });
                return of([]);
              })
            )
          ),
          tap((users) => patchState(store, { users, isLoading: false }))
        )
      ),

      // searchUsers effect with debounce
      searchUsers: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          debounceTime(SEARCH_DEBOUNCE_MS),
          distinctUntilChanged(),
          switchMap((query) =>
            userService.searchUsers(query).pipe(
              catchError((err) => {
                patchState(store, { error: err.message, isLoading: false });
                return of([]);
              })
            )
          ),
          tap((users) => patchState(store, { users, isLoading: false }))
        )
      ),
    };
  })
);
```

**Why better:** No separate effects class, no action dispatching, direct patchState calls, service injected in context, cleaner async flow

---

## Pattern 5: Migrating Entity State

### Traditional NgRx - Entity Adapter

```typescript
// Before: Traditional NgRx with @ngrx/entity
// store/products/products.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { createEntityAdapter, EntityState } from '@ngrx/entity';
import * as ProductActions from './products.actions';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface ProductsState extends EntityState<Product> {
  loading: boolean;
  error: string | null;
}

const adapter = createEntityAdapter<Product>({
  selectId: (product) => product.id,
  sortComparer: (a, b) => a.name.localeCompare(b.name),
});

const initialState: ProductsState = adapter.getInitialState({
  loading: false,
  error: null,
});

export const productsReducer = createReducer(
  initialState,
  on(ProductActions.loadProductsSuccess, (state, { products }) =>
    adapter.setAll(products, { ...state, loading: false })
  ),
  on(ProductActions.addProduct, (state, { product }) =>
    adapter.addOne(product, state)
  ),
  on(ProductActions.updateProduct, (state, { update }) =>
    adapter.updateOne(update, state)
  ),
  on(ProductActions.removeProduct, (state, { id }) =>
    adapter.removeOne(id, state)
  )
);

// Selectors
export const {
  selectAll: selectAllProducts,
  selectEntities: selectProductEntities,
  selectIds: selectProductIds,
  selectTotal: selectTotalProducts,
} = adapter.getSelectors();
```

### SignalStore - withEntities

```typescript
// After: SignalStore with withEntities
// stores/product.store.ts
import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  withEntities,
  setAllEntities,
  addEntity,
  updateEntity,
  removeEntity,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';

const PRODUCTS_API_URL = '/api/products';

interface Product {
  id: string;
  name: string;
  price: number;
}

export const ProductStore = signalStore(
  { providedIn: 'root' },
  // withEntities replaces createEntityAdapter
  withEntities<Product>(),
  withState({
    loading: false,
    error: null as string | null,
  }),
  // Computed replaces adapter selectors
  withComputed(({ entities }) => ({
    sortedProducts: computed(() =>
      [...entities()].sort((a, b) => a.name.localeCompare(b.name))
    ),
    totalValue: computed(() =>
      entities().reduce((sum, p) => sum + p.price, 0)
    ),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      loadProducts: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            http.get<Product[]>(PRODUCTS_API_URL).pipe(
              catchError((err) => {
                patchState(store, { error: err.message, loading: false });
                return of([]);
              })
            )
          ),
          tap((products) => {
            // setAllEntities replaces adapter.setAll
            patchState(store, setAllEntities(products), { loading: false });
          })
        )
      ),

      addProduct(product: Product) {
        // addEntity replaces adapter.addOne
        patchState(store, addEntity(product));
      },

      updateProduct(id: string, changes: Partial<Product>) {
        // updateEntity replaces adapter.updateOne
        patchState(store, updateEntity({ id, changes }));
      },

      removeProduct(id: string) {
        // removeEntity replaces adapter.removeOne
        patchState(store, removeEntity(id));
      },
    };
  })
);

// Component usage
// Before: this.store.select(selectAllProducts)
// After: this.store.entities() or this.store.sortedProducts()
```

**Why better:** No adapter setup, built-in entity signals (ids, entityMap, entities), entity updaters work with patchState, computed for derived data

---

## Pattern 6: Gradual Migration Strategy

### Good Example - Hybrid Approach During Migration

```typescript
// During migration: Both systems can coexist

// 1. Keep existing NgRx for complex features
// store/auth/auth.module.ts (existing NgRx)
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { authReducer } from './auth.reducer';
import { AuthEffects } from './auth.effects';

@NgModule({
  imports: [
    StoreModule.forFeature('auth', authReducer),
    EffectsModule.forFeature([AuthEffects]),
  ],
})
export class AuthStoreModule {}

// 2. New features use SignalStore
// stores/notifications.store.ts (new SignalStore)
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

export const NotificationStore = signalStore(
  { providedIn: 'root' },
  withState({
    notifications: [] as Notification[],
  }),
  withMethods((store) => ({
    // New SignalStore implementation
  }))
);

// 3. Component can inject both
// components/dashboard.component.ts
import { Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectCurrentUser } from '../store/auth/auth.selectors';
import { NotificationStore } from '../stores/notifications.store';

@Component({
  selector: 'app-dashboard',
  template: `
    <!-- NgRx with async pipe -->
    <app-user-card [user]="currentUser$ | async" />

    <!-- SignalStore with direct access -->
    <app-notification-list [items]="notificationStore.notifications()" />
  `,
})
export class DashboardComponent {
  // Traditional NgRx
  private ngRxStore = inject(Store);
  currentUser$ = this.ngRxStore.select(selectCurrentUser);

  // New SignalStore
  notificationStore = inject(NotificationStore);
}
```

**Why useful:** Allows gradual migration, no big-bang rewrite, teams can migrate feature by feature, both systems work together

---

## Migration Checklist

| Traditional NgRx | SignalStore Equivalent | Notes |
|------------------|----------------------|-------|
| `createAction()` | Method in `withMethods()` | No action types needed |
| `createReducer()` | `patchState()` in methods | No case matching |
| `createSelector()` | `withComputed()` | Auto-memoized |
| `createEffect()` | `rxMethod()` | In store, not separate class |
| `createEntityAdapter()` | `withEntities()` | Built-in CRUD |
| `provideMockStore()` | `unprotected()` + TestBed | Different testing approach |
| `dispatch(action)` | `store.method()` | Direct method call |
| `select(selector)` | `store.computed()` | Signal access |
| `StoreModule.forFeature()` | `{ providedIn: 'root' }` | Or component providers |

**Migration Steps:**

1. Create SignalStore alongside existing NgRx feature
2. Migrate state shape to `withState()` / `withEntities()`
3. Convert selectors to `withComputed()`
4. Convert effects to `rxMethod()`
5. Convert actions/reducers to `withMethods()` + `patchState()`
6. Update components to use SignalStore
7. Remove old NgRx feature files
8. Update tests
