# NgRx SignalStore - Custom Features Examples

Custom feature patterns using signalStoreFeature for reusable store logic.

**Prerequisites:** Understand [core.md](core.md) (signalStore basics) first.

**Related examples:**

- [entities.md](entities.md) - withEntities, CRUD operations
- [effects.md](effects.md) - rxMethod, side effects
- [testing.md](testing.md) - Unit tests, mocking strategies

---

## Pattern 1: Basic signalStoreFeature

### Good Example - Reusable Loading State Feature

```typescript
// features/with-loading.ts
import { computed } from "@angular/core";
import {
  signalStoreFeature,
  withState,
  withComputed,
  withMethods,
  patchState,
} from "@ngrx/signals";

type LoadingStatus = "idle" | "loading" | "loaded" | "error";

interface LoadingState {
  status: LoadingStatus;
  error: string | null;
}

export function withLoading() {
  return signalStoreFeature(
    withState<LoadingState>({
      status: "idle",
      error: null,
    }),
    withComputed(({ status }) => ({
      isLoading: computed(() => status() === "loading"),
      isLoaded: computed(() => status() === "loaded"),
      hasError: computed(() => status() === "error"),
      isIdle: computed(() => status() === "idle"),
    })),
    withMethods((store) => ({
      setLoading() {
        patchState(store, { status: "loading", error: null });
      },
      setLoaded() {
        patchState(store, { status: "loaded", error: null });
      },
      setError(error: string) {
        patchState(store, { status: "error", error });
      },
      resetStatus() {
        patchState(store, { status: "idle", error: null });
      },
    })),
  );
}

// Usage in store
// stores/user.store.ts
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { withLoading } from "../features/with-loading";

interface User {
  id: string;
  name: string;
}

export const UserStore = signalStore(
  { providedIn: "root" },
  withLoading(),
  withState({
    user: null as User | null,
  }),
  withMethods((store) => ({
    async loadUser(id: string) {
      store.setLoading();
      try {
        const response = await fetch(`/api/users/${id}`);
        const user = await response.json();
        patchState(store, { user });
        store.setLoaded();
      } catch (err) {
        store.setError(err instanceof Error ? err.message : "Failed to load");
      }
    },
  })),
);
```

**Why good:** The feature is a function returning `signalStoreFeature(...)`, so calling it in a store's feature list splices its state, computeds and methods into that store's type. Four stores get the same `isLoading` without four copies, and widening `LoadingStatus` later widens all of them at once.

---

## Pattern 2: withCallState from ngrx-toolkit

### Good Example - Using ngrx-toolkit withCallState

```typescript
// stores/product.store.ts
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { withEntities, setAllEntities } from "@ngrx/signals/entities";
import {
  withCallState,
  setLoading,
  setLoaded,
  setError,
} from "@angular-architects/ngrx-toolkit";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, tap, switchMap, catchError, of } from "rxjs";

const PRODUCTS_API_URL = "/api/products";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

export const ProductStore = signalStore(
  { providedIn: "root" },
  // withCallState adds: callState, loading, loaded, error
  withCallState(),
  withEntities<Product>(),
  withState({
    selectedCategory: null as string | null,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      loadProducts: rxMethod<void>(
        pipe(
          tap(() => patchState(store, setLoading())),
          switchMap(() =>
            http.get<Product[]>(PRODUCTS_API_URL).pipe(
              catchError((err) => {
                patchState(store, setError(err));
                return of([]);
              }),
            ),
          ),
          tap((products) => {
            patchState(store, setAllEntities(products), setLoaded());
          }),
        ),
      ),

      selectCategory(category: string | null) {
        patchState(store, { selectedCategory: category });
      },
    };
  }),
);

// Template usage
@Component({
  template: `
    @if (store.loading()) {
      <app-spinner />
    }

    @if (store.error(); as error) {
      <app-error [message]="error.message" />
    }

    @if (store.loaded()) {
      <app-product-list [products]="store.entities()" />
    }
  `,
})
export class ProductListComponent {
  readonly store = inject(ProductStore);
}
```

**Why good:** `setLoading()`, `setLoaded()` and `setError()` are updaters, so they compose into a `patchState` call alongside an entity updater — `setAllEntities(products), setLoaded()` lands both in one notification rather than rendering an empty loaded list first.

---

## Pattern 3: Named Collection withCallState

### Good Example - Multiple Call States

```typescript
// stores/dashboard.store.ts
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { signalStore, withMethods, patchState } from "@ngrx/signals";
import { withEntities, setAllEntities, type } from "@ngrx/signals/entities";
import {
  withCallState,
  setLoading,
  setLoaded,
  setError,
} from "@angular-architects/ngrx-toolkit";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, tap, switchMap, catchError, of } from "rxjs";

interface User {
  id: string;
  name: string;
}

interface Order {
  id: string;
  total: number;
}

export const DashboardStore = signalStore(
  { providedIn: "root" },
  // Multiple named call states
  withCallState({ collections: ["users", "orders"] }),
  withEntities({ entity: type<User>(), collection: "user" }),
  withEntities({ entity: type<Order>(), collection: "order" }),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      loadUsers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, setLoading("users"))),
          switchMap(() =>
            http.get<User[]>("/api/users").pipe(
              catchError((err) => {
                patchState(store, setError(err, "users"));
                return of([]);
              }),
            ),
          ),
          tap((users) => {
            patchState(
              store,
              setAllEntities(users, { collection: "user" }),
              setLoaded("users"),
            );
          }),
        ),
      ),

      loadOrders: rxMethod<void>(
        pipe(
          tap(() => patchState(store, setLoading("orders"))),
          switchMap(() =>
            http.get<Order[]>("/api/orders").pipe(
              catchError((err) => {
                patchState(store, setError(err, "orders"));
                return of([]);
              }),
            ),
          ),
          tap((orders) => {
            patchState(
              store,
              setAllEntities(orders, { collection: "order" }),
              setLoaded("orders"),
            );
          }),
        ),
      ),
    };
  }),
);

// Template usage
// store.usersLoading(), store.usersLoaded(), store.usersError()
// store.ordersLoading(), store.ordersLoaded(), store.ordersError()
```

**Why good:** Each collection name generates its own prefixed signals — `usersLoading`, `ordersLoading` — so a dashboard renders each panel's spinner independently instead of blocking on the slowest request. The name given to `withCallState` is passed to every updater, and an omitted one writes the store-wide call state rather than the collection's.

---

## Pattern 4: Custom Feature with Type Constraints

### Good Example - Feature Requiring Specific State

```typescript
// features/with-pagination.ts
import { computed } from "@angular/core";
import {
  signalStoreFeature,
  withState,
  withComputed,
  withMethods,
  patchState,
  type,
} from "@ngrx/signals";

const DEFAULT_PAGE_SIZE = 20;
const FIRST_PAGE = 1;

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

interface PaginationComputed {
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

// Feature with type constraints
export function withPagination<T>(itemsKey: keyof T = "items" as keyof T) {
  return signalStoreFeature(
    // Type constraint: store must have items array
    { state: type<{ items: unknown[] }>() },
    withState<PaginationState>({
      currentPage: FIRST_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      totalItems: 0,
    }),
    withComputed(({ currentPage, pageSize, totalItems }) => ({
      totalPages: computed(() => Math.ceil(totalItems() / pageSize())),
      hasNextPage: computed(
        () => currentPage() < Math.ceil(totalItems() / pageSize()),
      ),
      hasPreviousPage: computed(() => currentPage() > FIRST_PAGE),
      startIndex: computed(() => (currentPage() - FIRST_PAGE) * pageSize()),
      endIndex: computed(() =>
        Math.min(currentPage() * pageSize(), totalItems()),
      ),
    })),
    withMethods((store) => ({
      setPage(page: number) {
        const maxPage = Math.ceil(store.totalItems() / store.pageSize());
        const validPage = Math.max(FIRST_PAGE, Math.min(page, maxPage));
        patchState(store, { currentPage: validPage });
      },

      nextPage() {
        if (store.hasNextPage()) {
          this.setPage(store.currentPage() + 1);
        }
      },

      previousPage() {
        if (store.hasPreviousPage()) {
          this.setPage(store.currentPage() - 1);
        }
      },

      setPageSize(pageSize: number) {
        patchState(store, { pageSize, currentPage: FIRST_PAGE });
      },

      setTotalItems(totalItems: number) {
        patchState(store, { totalItems });
      },
    })),
  );
}

// Usage
// stores/paginated-list.store.ts
import {
  signalStore,
  withState,
  withComputed,
  patchState,
} from "@ngrx/signals";
import { withPagination } from "../features/with-pagination";

interface ListItem {
  id: string;
  name: string;
}

export const PaginatedListStore = signalStore(
  { providedIn: "root" },
  withState({
    items: [] as ListItem[],
  }),
  withPagination<{ items: ListItem[] }>(),
  withComputed((store) => ({
    // Paginated items
    paginatedItems: computed(() =>
      store.items().slice(store.startIndex(), store.endIndex()),
    ),
  })),
);
```

**Why good:** `{ state: type<{ items: unknown[] }>() }` declares what the host store must already provide. Applying this feature to a store with no `items` is a compile error at the store definition, rather than an `undefined` read at runtime — and it is also what lets the feature's own computeds resolve their types.

---

## Pattern 5: DevTools Integration with withDevtools

### Good Example - Redux DevTools Support

```typescript
// stores/cart.store.ts
import { computed, inject } from "@angular/core";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from "@ngrx/signals";
import {
  withEntities,
  addEntity,
  removeEntity,
  updateEntity,
} from "@ngrx/signals/entities";
import { withDevtools, updateState } from "@angular-architects/ngrx-toolkit";

const TAX_RATE = 0.08;

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartMeta {
  couponCode: string | null;
  discountPercent: number;
}

export const CartStore = signalStore(
  { providedIn: "root" },
  // DevTools integration - name appears in Redux DevTools
  withDevtools("cart"),
  withEntities<CartItem>(),
  withState<CartMeta>({
    couponCode: null,
    discountPercent: 0,
  }),
  withComputed(({ entities, discountPercent }) => ({
    subtotal: computed(() =>
      entities().reduce((sum, item) => sum + item.price * item.quantity, 0),
    ),
    discount: computed(() => {
      const subtotal = entities().reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      return subtotal * (discountPercent() / 100);
    }),
    tax: computed(() => {
      const subtotal = entities().reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const discount = subtotal * (discountPercent() / 100);
      return (subtotal - discount) * TAX_RATE;
    }),
    total: computed(() => {
      const subtotal = entities().reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const discount = subtotal * (discountPercent() / 100);
      const tax = (subtotal - discount) * TAX_RATE;
      return subtotal - discount + tax;
    }),
    itemCount: computed(() =>
      entities().reduce((sum, item) => sum + item.quantity, 0),
    ),
  })),
  withMethods((store) => ({
    addItem(product: { id: string; name: string; price: number }) {
      const existingItem = store
        .entities()
        .find((item) => item.productId === product.id);

      if (existingItem) {
        // Update quantity
        patchState(
          store,
          updateEntity({
            id: existingItem.id,
            changes: { quantity: existingItem.quantity + 1 },
          }),
        );
      } else {
        // Add new item
        const cartItem: CartItem = {
          id: crypto.randomUUID(),
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        };
        patchState(store, addEntity(cartItem));
      }
    },

    removeItem(id: string) {
      patchState(store, removeEntity(id));
    },

    updateQuantity(id: string, quantity: number) {
      if (quantity <= 0) {
        patchState(store, removeEntity(id));
      } else {
        patchState(store, updateEntity({ id, changes: { quantity } }));
      }
    },

    applyCoupon(code: string, discountPercent: number) {
      patchState(store, { couponCode: code, discountPercent });
    },

    clearCart() {
      const ids = store.ids();
      ids.forEach((id) => patchState(store, removeEntity(id)));
      patchState(store, { couponCode: null, discountPercent: 0 });
    },
  })),
);
```

**Why good:** The name passed to `withDevtools` is what labels this store in the Redux DevTools panel, so several stores stay tellable apart in one timeline.

**`withDevtools` goes before `withState`.** Features apply in order and it instruments the state features that follow it, so a `withState` placed above it is not tracked and its updates never reach the panel.

**Sibling computeds cannot read each other**, which is why `subtotal` is recomputed inside `discount`, `tax` and `total` rather than reused. The callback receives the members declared _before_ this `withComputed`, and the ones in the same object literal do not exist yet. Chaining them means a second `withComputed`:

```typescript
withComputed(({ entities }) => ({
  subtotal: computed(() =>
    entities().reduce((sum, item) => sum + item.price * item.quantity, 0),
  ),
})),
withComputed(({ subtotal, discountPercent }) => ({
  discount: computed(() => subtotal() * (discountPercent() / 100)),
})),
```

---

## Pattern 6: Feature Composition

### Good Example - Combining Multiple Custom Features

```typescript
// features/with-selection.ts
import { computed } from "@angular/core";
import {
  signalStoreFeature,
  withState,
  withComputed,
  withMethods,
  patchState,
  type,
} from "@ngrx/signals";

interface SelectionState {
  selectedIds: Set<string>;
}

export function withSelection() {
  return signalStoreFeature(
    // Requires entities
    { state: type<{ ids: string[] }>() },
    withState<SelectionState>({
      selectedIds: new Set<string>(),
    }),
    withComputed(({ selectedIds, ids }) => ({
      hasSelection: computed(() => selectedIds().size > 0),
      selectionCount: computed(() => selectedIds().size),
      isAllSelected: computed(
        () => ids().length > 0 && selectedIds().size === ids().length,
      ),
    })),
    withMethods((store) => ({
      select(id: string) {
        patchState(store, (state) => ({
          selectedIds: new Set([...state.selectedIds, id]),
        }));
      },

      deselect(id: string) {
        patchState(store, (state) => {
          const newSet = new Set(state.selectedIds);
          newSet.delete(id);
          return { selectedIds: newSet };
        });
      },

      toggle(id: string) {
        if (store.selectedIds().has(id)) {
          this.deselect(id);
        } else {
          this.select(id);
        }
      },

      selectAll() {
        patchState(store, { selectedIds: new Set(store.ids()) });
      },

      deselectAll() {
        patchState(store, { selectedIds: new Set<string>() });
      },

      isSelected(id: string): boolean {
        return store.selectedIds().has(id);
      },
    })),
  );
}

// Usage: Combining features
// stores/selectable-list.store.ts
import { signalStore, withMethods, patchState } from "@ngrx/signals";
import {
  withEntities,
  setAllEntities,
  removeEntities,
} from "@ngrx/signals/entities";
import { withLoading } from "../features/with-loading";
import { withSelection } from "../features/with-selection";
import { withDevtools } from "@angular-architects/ngrx-toolkit";

interface Item {
  id: string;
  name: string;
}

export const SelectableListStore = signalStore(
  { providedIn: "root" },
  withDevtools("selectable-list"),
  withEntities<Item>(),
  withLoading(),
  withSelection(),
  withMethods((store) => ({
    async loadItems() {
      store.setLoading();
      try {
        const response = await fetch("/api/items");
        const items = await response.json();
        patchState(store, setAllEntities(items));
        store.setLoaded();
      } catch (err) {
        store.setError(err instanceof Error ? err.message : "Failed");
      }
    },

    deleteSelected() {
      const selectedIds = [...store.selectedIds()];
      patchState(store, removeEntities(selectedIds));
      store.deselectAll();
    },
  })),
);
```

**Why good:** `withSelection` constrains on `{ ids: string[] }`, which `withEntities` supplies — so it must be listed after it, and the order in this store is a requirement rather than a preference. The features stay independent because each declares what it needs instead of assuming the store around it.

Note the `Set` is replaced rather than mutated on every change. A `Set` added to in place is the same reference, so no signal reading `selectedIds` would see a change.
