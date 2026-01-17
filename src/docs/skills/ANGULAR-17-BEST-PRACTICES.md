# Angular 17+ Best Practices Research

> Research compiled: January 2025
> Angular versions covered: 17, 18, 19, 20, 21
> Purpose: Atomic skill creation for Claude agents

---

## Table of Contents

1. [Standalone Components](#1-standalone-components)
2. [Signals](#2-signals)
3. [Control Flow](#3-control-flow)
4. [Defer Blocks](#4-defer-blocks)
5. [NgRx SignalStore](#5-ngrx-signalstore)
6. [Angular Router](#6-angular-router)
7. [Dependency Injection](#7-dependency-injection)
8. [Angular Forms](#8-angular-forms)
9. [Testing Patterns](#9-testing-patterns)
10. [Performance Optimization](#10-performance-optimization)

---

## 1. Standalone Components

### Core Patterns

Standalone components are self-contained and don't require inclusion in an NgModule. They are now the default and recommended approach in Angular 17+.

```typescript
// standalone-button.component.ts
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true, // Default in Angular 17+, can be omitted in newer versions
  imports: [CommonModule], // Import dependencies directly
  template: `
    <button
      [class]="variant()"
      [disabled]="disabled()"
      (click)="clicked.emit()"
    >
      <ng-content />
    </button>
  `,
  styleUrl: './button.component.scss'
})
export class ButtonComponent {
  // Signal-based inputs (Angular 17+)
  variant = input<'primary' | 'secondary'>('primary');
  disabled = input<boolean>(false);

  // Signal-based outputs
  clicked = output<void>();
}
```

```typescript
// app.config.ts - Bootstrap without NgModule
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ]
};
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
```

### Lazy Loading Standalone Components

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component')
      .then(m => m.DashboardComponent)
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes')
      .then(m => m.ADMIN_ROUTES)
  }
];
```

### Anti-Patterns

```typescript
// BAD: Unnecessary NgModule wrapper
@NgModule({
  declarations: [MyComponent], // Don't declare standalone components
  imports: [CommonModule],
  exports: [MyComponent]
})
export class MyModule {}

// BAD: Importing entire modules when you only need one thing
@Component({
  standalone: true,
  imports: [SharedModule] // Too broad - import specific components
})

// GOOD: Import only what you need
@Component({
  standalone: true,
  imports: [ButtonComponent, CardComponent, DatePipe]
})
```

### When to Use

| Use Standalone | Use NgModule |
|----------------|--------------|
| All new projects (Angular 17+) | Legacy codebases not yet migrated |
| New features in existing apps | Library development requiring compatibility |
| Micro-frontends | When you need entry components (rare) |

### Migration Command

```bash
# Migrate existing project to standalone
ng generate @angular/core:standalone
```

---

## 2. Signals

### Core Primitives

```typescript
import {
  signal,
  computed,
  effect,
  untracked,
  Signal,
  WritableSignal
} from '@angular/core';

// Writable signal - holds mutable state
const count: WritableSignal<number> = signal(0);

// Read the value
console.log(count()); // 0

// Update methods
count.set(5);           // Direct set
count.update(c => c + 1); // Based on previous value

// Computed signal - derived state (read-only, lazy, memoized)
const doubleCount: Signal<number> = computed(() => count() * 2);

// Effect - side effects when signals change
effect(() => {
  console.log(`Count changed to: ${count()}`);
  // Cleanup function (optional)
  return () => console.log('Cleaning up...');
});
```

### Signal-Based Component APIs

```typescript
import {
  Component,
  input,
  output,
  model,
  viewChild,
  viewChildren,
  contentChild,
  contentChildren
} from '@angular/core';

@Component({
  selector: 'app-user-form',
  standalone: true,
  template: `
    <input #nameInput [value]="name()" (input)="name.set($event.target.value)" />
    <button (click)="submitted.emit(name())">Submit</button>
  `
})
export class UserFormComponent {
  // Signal inputs (replaces @Input())
  initialName = input<string>('');           // Optional with default
  userId = input.required<string>();          // Required input

  // Input with transform
  disabled = input(false, {
    transform: (value: boolean | string) =>
      typeof value === 'string' ? value !== 'false' : value
  });

  // Model input for two-way binding (replaces @Input() + @Output())
  name = model<string>('');

  // Signal outputs (replaces @Output())
  submitted = output<string>();

  // Signal queries (replaces @ViewChild/@ContentChild)
  nameInput = viewChild<ElementRef>('nameInput');
  nameInputRequired = viewChild.required<ElementRef>('nameInput');

  items = viewChildren(ItemComponent);
  projectedContent = contentChild(ContentDirective);
}
```

### Resource API for Async Data

```typescript
import { resource, Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { httpResource } from '@angular/common/http';

@Component({...})
export class UserProfileComponent {
  userId = input.required<string>();

  // Promise-based resource (uses fetch)
  userResource = resource({
    request: () => ({ id: this.userId() }),
    loader: async ({ request, abortSignal }) => {
      const response = await fetch(`/api/users/${request.id}`, {
        signal: abortSignal
      });
      return response.json();
    }
  });

  // Observable-based resource (for RxJS integration)
  userRxResource = rxResource({
    request: () => this.userId(),
    loader: ({ request }) => this.http.get<User>(`/api/users/${request}`)
  });

  // HttpClient-based resource (Angular 19+, uses interceptors)
  userHttpResource = httpResource<User>({
    url: () => `/api/users/${this.userId()}`,
    defaultValue: null
  });

  // Access resource state
  template = `
    @if (userResource.isLoading()) {
      <loading-spinner />
    } @else if (userResource.error()) {
      <error-message [error]="userResource.error()" />
    } @else {
      <user-profile [user]="userResource.value()" />
    }
  `;
}
```

### Signals + RxJS Interop

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

@Component({...})
export class SearchComponent {
  // Convert Observable to Signal
  private route = inject(ActivatedRoute);
  queryParam = toSignal(this.route.queryParams.pipe(
    map(params => params['q'])
  ), { initialValue: '' });

  // Convert Signal to Observable
  searchTerm = signal('');
  searchTerm$ = toObservable(this.searchTerm);

  // Use in effects
  constructor() {
    // Debounced search
    this.searchTerm$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => this.searchService.search(term))
    ).subscribe(results => this.results.set(results));
  }
}
```

### Anti-Patterns

```typescript
// BAD: Mutating signal values directly
const users = signal<User[]>([]);
users()[0].name = 'John'; // Won't trigger reactivity!

// GOOD: Create new reference
users.update(list =>
  list.map((u, i) => i === 0 ? { ...u, name: 'John' } : u)
);

// BAD: Side effects in computed
const data = computed(() => {
  this.http.get('/api').subscribe(); // Never do this!
  return someValue();
});

// GOOD: Use effect for side effects
effect(() => {
  const value = someSignal();
  this.analyticsService.track('value-changed', value);
});

// BAD: Overusing effects for derived state
effect(() => {
  this.derivedValue.set(this.baseValue() * 2); // Use computed instead!
});

// GOOD: Use computed for derived state
derivedValue = computed(() => this.baseValue() * 2);

// BAD: Reading signals in untracked contexts
setTimeout(() => {
  console.log(this.count()); // Not reactive!
}, 1000);
```

### When to Use

| Signals | RxJS Observables |
|---------|------------------|
| Synchronous state | Async event streams |
| UI state (form values, toggles) | HTTP requests (without resource) |
| Derived/computed values | Complex async pipelines |
| Component local state | WebSocket streams |
| Cross-component state | Debounce/throttle/buffer |

---

## 3. Control Flow

### @if Syntax

```html
<!-- Basic @if -->
@if (user()) {
  <user-profile [user]="user()" />
}

<!-- @if with @else -->
@if (isLoggedIn()) {
  <dashboard />
} @else {
  <login-form />
}

<!-- @if with @else if chain -->
@if (status() === 'loading') {
  <loading-spinner />
} @else if (status() === 'error') {
  <error-message [error]="error()" />
} @else if (status() === 'empty') {
  <empty-state />
} @else {
  <data-table [data]="data()" />
}

<!-- Saving expression result with 'as' -->
@if (user()?.profile?.settings?.theme; as theme) {
  <theme-preview [theme]="theme" />
}

<!-- Complex condition with alias -->
@if (items().length > 0 && !isFiltering(); as hasItems) {
  <item-list [items]="items()" />
}
```

### @for Syntax

```html
<!-- Basic @for with required track -->
@for (item of items(); track item.id) {
  <item-card [item]="item" />
}

<!-- With index and other context variables -->
@for (item of items(); track item.id; let i = $index, first = $first, last = $last) {
  <item-row
    [item]="item"
    [index]="i"
    [class.first]="first"
    [class.last]="last"
  />
}

<!-- Available context variables:
  $index  - zero-based index
  $first  - true for first item
  $last   - true for last item
  $even   - true for even indices
  $odd    - true for odd indices
  $count  - total number of items
-->

<!-- With @empty block -->
@for (notification of notifications(); track notification.id) {
  <notification-item [notification]="notification" />
} @empty {
  <div class="empty-state">
    <p>No notifications yet</p>
  </div>
}

<!-- Nested @for -->
@for (category of categories(); track category.id) {
  <h3>{{ category.name }}</h3>
  @for (product of category.products; track product.id) {
    <product-card [product]="product" />
  }
}
```

### @switch Syntax

```html
<!-- Basic @switch -->
@switch (userRole()) {
  @case ('admin') {
    <admin-dashboard />
  }
  @case ('editor') {
    <editor-dashboard />
  }
  @case ('viewer') {
    <viewer-dashboard />
  }
  @default {
    <guest-view />
  }
}

<!-- With complex expressions -->
@switch (status().type) {
  @case ('success') {
    <success-message [data]="status().data" />
  }
  @case ('error') {
    <error-message [error]="status().error" />
  }
  @default {
    <loading-indicator />
  }
}
```

### Anti-Patterns

```html
<!-- BAD: Missing track in @for -->
@for (item of items()) {  <!-- ERROR: track is required -->
  <item-card [item]="item" />
}

<!-- BAD: Using $index as track for mutable lists -->
@for (item of items(); track $index) {  <!-- Poor performance on mutations -->
  <item-card [item]="item" />
}

<!-- GOOD: Track by unique identifier -->
@for (item of items(); track item.id) {
  <item-card [item]="item" />
}

<!-- BAD: Complex logic in template -->
@if (items().filter(i => i.active).length > 0 && !loading()) {
  ...
}

<!-- GOOD: Move logic to computed signal -->
// Component
hasActiveItems = computed(() =>
  this.items().some(i => i.active) && !this.loading()
);

// Template
@if (hasActiveItems()) {
  ...
}
```

### Migration

```bash
# Auto-migrate from *ngIf, *ngFor, *ngSwitch
ng generate @angular/core:control-flow
```

### When to Use

| New Control Flow (@if, @for) | Structural Directives (*ngIf, *ngFor) |
|------------------------------|---------------------------------------|
| All new code | Legacy templates during migration |
| Better type narrowing needed | Third-party components requiring them |
| @else if chains | Never for new code (deprecated in v20) |
| @empty blocks for lists | |

---

## 4. Defer Blocks

### Core Syntax

```html
<!-- Basic defer - loads on browser idle (default) -->
@defer {
  <heavy-chart-component [data]="chartData()" />
}

<!-- With placeholder shown until loading starts -->
@defer {
  <heavy-component />
} @placeholder {
  <div class="skeleton-loader"></div>
}

<!-- With loading indicator during fetch -->
@defer {
  <heavy-component />
} @placeholder {
  <lightweight-placeholder />
} @loading {
  <loading-spinner />
}

<!-- With error handling -->
@defer {
  <heavy-component />
} @error {
  <error-message>Failed to load component</error-message>
}

<!-- Complete with all blocks and timing -->
@defer {
  <heavy-component />
} @placeholder (minimum 500ms) {
  <skeleton-loader />
} @loading (after 100ms; minimum 500ms) {
  <loading-spinner />
} @error {
  <error-fallback />
}
```

### Trigger Types

```html
<!-- on idle (default) - loads when browser is idle -->
@defer (on idle) {
  <analytics-widget />
}

<!-- on viewport - loads when placeholder enters viewport -->
@defer (on viewport) {
  <comment-section />
} @placeholder {
  <div style="height: 200px;">Comments loading...</div>
}

<!-- on interaction - loads on click/keydown -->
@defer (on interaction) {
  <rich-text-editor />
} @placeholder {
  <simple-textarea placeholder="Click to load editor..." />
}

<!-- on hover - loads when user hovers -->
@defer (on hover) {
  <tooltip-content />
} @placeholder {
  <span>Hover for details</span>
}

<!-- on immediate - loads immediately but in separate chunk -->
@defer (on immediate) {
  <above-fold-hero />
}

<!-- on timer - loads after specified time -->
@defer (on timer(2s)) {
  <promotional-banner />
}

<!-- Reference-based triggers -->
<button #loadBtn>Load Component</button>
@defer (on interaction(loadBtn); on hover(loadBtn)) {
  <lazy-panel />
}
```

### Prefetching

```html
<!-- Prefetch on idle, render on interaction -->
@defer (on interaction; prefetch on idle) {
  <editor-component />
} @placeholder {
  <button>Open Editor</button>
}

<!-- Prefetch when viewport is near, render when visible -->
@defer (on viewport; prefetch on viewport) {
  <image-gallery />
}

<!-- Conditional prefetch -->
@defer (when showEditor(); prefetch when userAuthenticated()) {
  <premium-editor />
}
```

### When Trigger (Conditional)

```html
<!-- Load based on condition -->
@defer (when tabActive() === 'analytics') {
  <analytics-dashboard />
}

<!-- Combined triggers -->
@defer (on viewport; when dataReady()) {
  <data-visualization />
}
```

### Anti-Patterns

```typescript
// BAD: Non-standalone component in @defer (won't lazy load)
@Component({
  standalone: false, // This will be eagerly loaded!
  template: '...'
})
export class NotLazyComponent {}

// Template using it:
@defer {
  <not-lazy-component /> <!-- Won't actually lazy load! -->
}

// BAD: Referencing deferred component outside @defer
@Component({
  template: `
    @defer {
      <my-chart />
    }
    <my-chart /> <!-- This reference prevents lazy loading! -->
  `
})

// BAD: ViewChild query on deferred component
@ViewChild(MyChartComponent) chart!: MyChartComponent; // Prevents lazy loading!

// BAD: Nested defers with same trigger (cascade loading)
@defer (on idle) {
  @defer (on idle) {       <!-- Both load together, defeating purpose -->
    @defer (on idle) {
      <deep-component />
    }
  }
}

// GOOD: Different triggers for nested defers
@defer (on idle) {
  <wrapper>
    @defer (on viewport) {
      <inner-component />
    }
  </wrapper>
}
```

### Requirements for True Lazy Loading

```typescript
// 1. Component MUST be standalone
@Component({
  standalone: true,  // REQUIRED for lazy loading
  imports: [CommonModule],
  template: '...'
})
export class LazyComponent {}

// 2. Component must NOT be referenced outside @defer in same file
// 3. Component must NOT be in ViewChild/ContentChild queries
// 4. All imports in the deferred component should also be standalone
```

### When to Use

| Use @defer | Don't Use @defer |
|------------|------------------|
| Heavy components (charts, editors) | Small/simple components |
| Below-the-fold content | Above-the-fold critical content |
| Rarely accessed features | Always-visible UI |
| Tab content not initially visible | Components needed immediately |
| Comments/reviews sections | Navigation elements |

---

## 5. NgRx SignalStore

### Basic SignalStore

```typescript
// user.store.ts
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState
} from '@ngrx/signals';
import { computed, inject } from '@angular/core';

interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  loading: false,
  error: null
};

export const UserStore = signalStore(
  // Provide at root level (or component level)
  { providedIn: 'root' },

  // Define state
  withState(initialState),

  // Computed signals
  withComputed((store) => ({
    isLoggedIn: computed(() => store.user() !== null),
    userName: computed(() => store.user()?.name ?? 'Guest'),
    canEdit: computed(() => store.user()?.role === 'admin')
  })),

  // Methods (actions)
  withMethods((store, userService = inject(UserService)) => ({
    async loadUser(id: string) {
      patchState(store, { loading: true, error: null });
      try {
        const user = await userService.getUser(id);
        patchState(store, { user, loading: false });
      } catch (error) {
        patchState(store, {
          error: 'Failed to load user',
          loading: false
        });
      }
    },

    updateUser(updates: Partial<User>) {
      patchState(store, (state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      }));
    },

    logout() {
      patchState(store, initialState);
    }
  })),

  // Lifecycle hooks
  withHooks({
    onInit(store) {
      // Called when store is initialized
      console.log('UserStore initialized');
    },
    onDestroy(store) {
      // Called when store is destroyed
      console.log('UserStore destroyed');
    }
  })
);
```

### Using the Store in Components

```typescript
@Component({
  standalone: true,
  template: `
    @if (store.loading()) {
      <loading-spinner />
    } @else if (store.error()) {
      <error-message>{{ store.error() }}</error-message>
    } @else if (store.isLoggedIn()) {
      <p>Welcome, {{ store.userName() }}!</p>
      <button (click)="store.logout()">Logout</button>
    } @else {
      <login-form (login)="onLogin($event)" />
    }
  `
})
export class UserProfileComponent {
  readonly store = inject(UserStore);

  onLogin(credentials: Credentials) {
    this.store.loadUser(credentials.userId);
  }
}
```

### Entity Management with withEntities

```typescript
// products.store.ts
import {
  signalStore,
  withState,
  withMethods
} from '@ngrx/signals';
import {
  withEntities,
  addEntity,
  updateEntity,
  removeEntity,
  setAllEntities
} from '@ngrx/signals/entities';

interface ProductsState {
  loading: boolean;
  selectedId: string | null;
}

export const ProductsStore = signalStore(
  { providedIn: 'root' },

  withState<ProductsState>({
    loading: false,
    selectedId: null
  }),

  // Entity adapter for Product collection
  withEntities<Product>(),

  withComputed((store) => ({
    selectedProduct: computed(() => {
      const id = store.selectedId();
      return id ? store.entityMap()[id] : null;
    }),
    productCount: computed(() => store.ids().length)
  })),

  withMethods((store, productService = inject(ProductService)) => ({
    async loadProducts() {
      patchState(store, { loading: true });
      const products = await productService.getAll();
      patchState(store, setAllEntities(products), { loading: false });
    },

    addProduct(product: Product) {
      patchState(store, addEntity(product));
    },

    updateProduct(id: string, changes: Partial<Product>) {
      patchState(store, updateEntity({ id, changes }));
    },

    removeProduct(id: string) {
      patchState(store, removeEntity(id));
    },

    selectProduct(id: string | null) {
      patchState(store, { selectedId: id });
    }
  }))
);
```

### SignalState for Simpler Cases

```typescript
// For component-level state, use signalState
import { signalState, patchState } from '@ngrx/signals';

@Component({...})
export class FilterComponent {
  state = signalState({
    searchTerm: '',
    category: 'all',
    sortBy: 'name',
    ascending: true
  });

  updateSearch(term: string) {
    patchState(this.state, { searchTerm: term });
  }

  toggleSort() {
    patchState(this.state, (s) => ({ ascending: !s.ascending }));
  }
}
```

### Anti-Patterns

```typescript
// BAD: Mutating state directly
withMethods((store) => ({
  badUpdate() {
    store.user().name = 'New Name'; // Won't trigger reactivity!
  }
}))

// GOOD: Use patchState
withMethods((store) => ({
  goodUpdate(name: string) {
    patchState(store, (state) => ({
      user: state.user ? { ...state.user, name } : null
    }));
  }
}))

// BAD: Async logic without proper state management
withMethods((store) => ({
  async loadData() {
    const data = await fetch('/api'); // No loading state!
    patchState(store, { data });
  }
}))

// GOOD: Track loading/error states
withMethods((store) => ({
  async loadData() {
    patchState(store, { loading: true, error: null });
    try {
      const data = await fetch('/api').then(r => r.json());
      patchState(store, { data, loading: false });
    } catch (e) {
      patchState(store, { error: e.message, loading: false });
    }
  }
}))

// BAD: Feature order dependency issues
signalStore(
  withHooks({
    onInit(store) {
      store.loadData(); // Error: loadData doesn't exist yet!
    }
  }),
  withMethods((store) => ({
    loadData() { ... }
  }))
)

// GOOD: Correct feature order
signalStore(
  withMethods((store) => ({
    loadData() { ... }
  })),
  withHooks({
    onInit(store) {
      store.loadData(); // Works: withMethods came first
    }
  })
)
```

### When to Use

| SignalStore | signalState | Traditional NgRx |
|-------------|-------------|------------------|
| Feature-level state | Component-local state | Very large apps |
| Shared across components | Form state | Time-travel debugging needed |
| CRUD operations | UI state (filters, toggles) | Redux DevTools required |
| Medium complexity | Simple state | Existing NgRx codebase |

---

## 6. Angular Router

### Modern Route Configuration

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { inject } from '@angular/core';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component')
      .then(m => m.DashboardComponent),
    title: 'Dashboard' // Sets document title
  },
  {
    path: 'users',
    loadChildren: () => import('./users/users.routes')
      .then(m => m.USER_ROUTES),
    canMatch: [() => inject(AuthService).isAuthenticated()]
  },
  {
    path: 'product/:id',
    loadComponent: () => import('./product/product.component')
      .then(m => m.ProductComponent),
    resolve: {
      product: (route: ActivatedRouteSnapshot) =>
        inject(ProductService).getProduct(route.params['id'])
    }
  },
  {
    path: '**',
    loadComponent: () => import('./not-found/not-found.component')
      .then(m => m.NotFoundComponent)
  }
];
```

### Functional Guards

```typescript
// auth.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn, CanMatchFn } from '@angular/router';

// CanActivate - runs after route is matched
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to login with return URL
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

// CanMatch - runs before lazy loading (prevents unnecessary downloads)
export const adminMatchGuard: CanMatchFn = (route, segments) => {
  const authService = inject(AuthService);
  return authService.hasRole('admin');
};

// CanDeactivate - prevent leaving with unsaved changes
export const unsavedChangesGuard: CanDeactivateFn<{ hasUnsavedChanges: () => boolean }> =
  (component) => {
    if (component.hasUnsavedChanges()) {
      return confirm('You have unsaved changes. Leave anyway?');
    }
    return true;
  };

// Async guard (Angular 20+)
export const asyncAuthGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  await authService.checkSession(); // Async validation
  return authService.isAuthenticated();
};
```

### Functional Resolvers

```typescript
// product.resolver.ts
import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';

export const productResolver: ResolveFn<Product> = (route) => {
  const productService = inject(ProductService);
  const productId = route.params['id'];
  return productService.getProduct(productId);
};

// With error handling
export const safeProductResolver: ResolveFn<Product | null> = async (route) => {
  const productService = inject(ProductService);
  const productId = route.params['id'];

  try {
    return await productService.getProduct(productId);
  } catch (error) {
    console.error('Failed to load product:', error);
    return null;
  }
};
```

### Route Configuration with Guards

```typescript
export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
    canMatch: [adminMatchGuard], // Check before loading
    canActivate: [authGuard],    // Check after loading
  },
  {
    path: 'editor/:id',
    loadComponent: () => import('./editor/editor.component')
      .then(m => m.EditorComponent),
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
    resolve: { document: documentResolver }
  }
];
```

### Router Input Binding

```typescript
// app.config.ts - Enable input binding
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding())
  ]
};

// product.component.ts - Receive route params as inputs
@Component({...})
export class ProductComponent {
  // Route param :id becomes input
  id = input.required<string>();

  // Query param ?category becomes input
  category = input<string>();

  // Resolver data becomes input
  product = input<Product>();

  // Or with traditional @Input
  @Input() id!: string;
  @Input() category?: string;
  @Input() product?: Product;
}
```

### Anti-Patterns

```typescript
// BAD: Class-based guards (deprecated)
@Injectable({ providedIn: 'root' })
export class OldAuthGuard implements CanActivate {
  canActivate() { ... }
}

// GOOD: Functional guards
export const authGuard: CanActivateFn = () => { ... };

// BAD: CanLoad (deprecated, use CanMatch)
canLoad: [loadGuard]  // Deprecated!

// GOOD: CanMatch
canMatch: [matchGuard]

// BAD: Hardcoded routes in components
this.router.navigate(['/users/123/profile']);

// GOOD: Use relative navigation or route constants
const ROUTES = {
  userProfile: (id: string) => ['/users', id, 'profile']
} as const;
this.router.navigate(ROUTES.userProfile(userId));

// BAD: Heavy logic in resolvers
export const badResolver: ResolveFn<Data> = async () => {
  // Don't make users wait for all this!
  const data1 = await service1.getData();
  const data2 = await service2.getData();
  const data3 = await service3.getData();
  return { data1, data2, data3 };
};

// GOOD: Load essential data only, rest via component
export const essentialResolver: ResolveFn<Data> = () => {
  return inject(DataService).getEssentialData();
};
```

### When to Use

| Guard Type | Use Case |
|------------|----------|
| canMatch | Gate access before lazy loading (saves bandwidth) |
| canActivate | Verify access after route matched |
| canActivateChild | Protect child routes uniformly |
| canDeactivate | Prevent leaving with unsaved changes |
| resolve | Pre-load essential data before rendering |

---

## 7. Dependency Injection

### Modern inject() Function

```typescript
import { inject, Injectable, InjectionToken } from '@angular/core';

// Service injection
@Component({...})
export class UserComponent {
  // Modern pattern (Angular 14+)
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // With options
  private optionalService = inject(OptionalService, { optional: true });
  private parentService = inject(ParentService, { skipSelf: true });
  private selfService = inject(SelfService, { self: true });
}

// Creating injection tokens
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => 'https://api.example.com'
});

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS');

// Using tokens
@Component({...})
export class ApiComponent {
  private apiUrl = inject(API_URL);
  private features = inject(FEATURE_FLAGS);
}
```

### Provider Patterns

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    // Class provider (default)
    UserService,

    // useClass - different implementation
    { provide: Logger, useClass: ConsoleLogger },

    // useValue - static values
    { provide: API_URL, useValue: 'https://api.example.com' },

    // useFactory - dynamic creation
    {
      provide: HttpClient,
      useFactory: () => {
        const platform = inject(PLATFORM_ID);
        return isPlatformBrowser(platform)
          ? inject(BrowserHttpClient)
          : inject(ServerHttpClient);
      }
    },

    // useExisting - alias
    { provide: AbstractLogger, useExisting: ConsoleLogger },

    // Multi providers
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true }
  ]
};
```

### Component-Level Providers

```typescript
@Component({
  selector: 'app-feature',
  standalone: true,
  // Component-scoped instance (not singleton)
  providers: [FeatureStateService],
  template: `...`
})
export class FeatureComponent {
  private state = inject(FeatureStateService);
}

// Or with viewProviders (not available to content children)
@Component({
  selector: 'app-panel',
  standalone: true,
  viewProviders: [PanelService], // Only for view, not projected content
  template: `<ng-content></ng-content>`
})
export class PanelComponent {}
```

### Injection Context

```typescript
// inject() must be called in injection context
// Valid contexts:
// 1. Constructor
// 2. Field initializer
// 3. Factory functions

// BAD: inject() outside injection context
@Component({...})
export class BadComponent {
  service!: UserService;

  ngOnInit() {
    this.service = inject(UserService); // ERROR!
  }
}

// GOOD: inject() in field initializer
@Component({...})
export class GoodComponent {
  private service = inject(UserService); // Works!
}

// For callbacks, use runInInjectionContext
import { runInInjectionContext, Injector } from '@angular/core';

@Component({...})
export class CallbackComponent {
  private injector = inject(Injector);

  laterCallback() {
    runInInjectionContext(this.injector, () => {
      const service = inject(UserService); // Works!
    });
  }
}
```

### Hierarchical Injection

```typescript
// Root level (singleton)
@Injectable({ providedIn: 'root' })
export class GlobalService {}

// Platform level (shared across apps)
@Injectable({ providedIn: 'platform' })
export class PlatformService {}

// Route level (scoped to route and children)
export const routes: Routes = [{
  path: 'feature',
  providers: [FeatureService], // New instance per route activation
  loadComponent: () => import('./feature.component')
}];

// Component level (scoped to component tree)
@Component({
  providers: [ComponentScopedService]
})
export class ParentComponent {}
```

### Anti-Patterns

```typescript
// BAD: Constructor injection (verbose)
@Component({...})
export class OldComponent {
  constructor(
    private userService: UserService,
    private router: Router,
    private http: HttpClient
  ) {}
}

// GOOD: inject() function (concise)
@Component({...})
export class NewComponent {
  private userService = inject(UserService);
  private router = inject(Router);
  private http = inject(HttpClient);
}

// BAD: Service locator anti-pattern
@Injectable()
export class BadService {
  constructor(private injector: Injector) {}

  doSomething() {
    const dep = this.injector.get(SomeDep); // Hidden dependency!
  }
}

// GOOD: Explicit dependencies
@Injectable()
export class GoodService {
  private dep = inject(SomeDep); // Visible at class level

  doSomething() {
    this.dep.action();
  }
}

// BAD: providedIn: 'root' for everything
@Injectable({ providedIn: 'root' }) // Creates singleton even if unused!
export class RarelyUsedService {}

// GOOD: Provide where needed
@Injectable() // No providedIn
export class RarelyUsedService {}

// Provide in route or component
{ path: 'rare', providers: [RarelyUsedService], ... }
```

### When to Use

| Pattern | Use Case |
|---------|----------|
| `providedIn: 'root'` | Global singletons (AuthService, HttpClient wrappers) |
| Route providers | Feature-scoped state that resets on navigation |
| Component providers | Component-tree scoped state (form state, UI state) |
| `useFactory` | Dynamic/conditional dependencies |
| InjectionToken | Configuration values, interfaces |

---

## 8. Angular Forms

### Reactive Forms (Recommended for Complex Forms)

```typescript
// user-form.component.ts
import { Component, inject } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormControl,
  FormArray,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div>
        <label for="name">Name</label>
        <input id="name" formControlName="name" />
        @if (form.controls.name.errors?.['required'] && form.controls.name.touched) {
          <span class="error">Name is required</span>
        }
      </div>

      <div>
        <label for="email">Email</label>
        <input id="email" formControlName="email" type="email" />
        @if (form.controls.email.errors?.['email']) {
          <span class="error">Invalid email format</span>
        }
      </div>

      <div formGroupName="address">
        <input formControlName="street" placeholder="Street" />
        <input formControlName="city" placeholder="City" />
      </div>

      <div formArrayName="phones">
        @for (phone of phonesArray.controls; track $index) {
          <input [formControlName]="$index" placeholder="Phone {{ $index + 1 }}" />
          <button type="button" (click)="removePhone($index)">Remove</button>
        }
        <button type="button" (click)="addPhone()">Add Phone</button>
      </div>

      <button type="submit" [disabled]="form.invalid">Submit</button>
    </form>
  `
})
export class UserFormComponent {
  private fb = inject(FormBuilder);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    address: this.fb.group({
      street: [''],
      city: ['', Validators.required]
    }),
    phones: this.fb.array([
      this.fb.control('', Validators.pattern(/^\d{10}$/))
    ])
  });

  get phonesArray(): FormArray {
    return this.form.controls.phones;
  }

  addPhone(): void {
    this.phonesArray.push(this.fb.control(''));
  }

  removePhone(index: number): void {
    this.phonesArray.removeAt(index);
  }

  onSubmit(): void {
    if (this.form.valid) {
      console.log(this.form.value);
    }
  }
}
```

### Typed Reactive Forms (Angular 14+)

```typescript
// Strongly typed form
interface UserForm {
  name: FormControl<string>;
  email: FormControl<string>;
  age: FormControl<number | null>;
  address: FormGroup<{
    street: FormControl<string>;
    city: FormControl<string>;
  }>;
  tags: FormArray<FormControl<string>>;
}

@Component({...})
export class TypedFormComponent {
  form: FormGroup<UserForm> = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    age: new FormControl<number | null>(null),
    address: new FormGroup({
      street: new FormControl('', { nonNullable: true }),
      city: new FormControl('', { nonNullable: true })
    }),
    tags: new FormArray([new FormControl('', { nonNullable: true })])
  });

  // Type-safe access
  getName(): string {
    return this.form.controls.name.value; // Type: string (not string | null)
  }
}
```

### Custom Validators

```typescript
// Sync validator
export function forbiddenNameValidator(forbidden: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const isForbidden = control.value === forbidden;
    return isForbidden ? { forbiddenName: { value: control.value } } : null;
  };
}

// Async validator
export function uniqueEmailValidator(
  userService: UserService
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    return userService.checkEmailExists(control.value).pipe(
      map(exists => exists ? { emailTaken: true } : null),
      catchError(() => of(null))
    );
  };
}

// Cross-field validator
export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirm = control.get('confirmPassword');

  if (password?.value !== confirm?.value) {
    return { passwordMismatch: true };
  }
  return null;
}

// Usage
form = this.fb.group({
  username: ['', [Validators.required, forbiddenNameValidator('admin')]],
  email: ['', [Validators.required], [uniqueEmailValidator(this.userService)]],
  password: ['', Validators.required],
  confirmPassword: ['', Validators.required]
}, { validators: passwordMatchValidator });
```

### Template-Driven Forms (Simple Cases Only)

```typescript
// simple-form.component.ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-simple-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form #userForm="ngForm" (ngSubmit)="onSubmit(userForm)">
      <input
        name="name"
        [(ngModel)]="user.name"
        required
        minlength="2"
        #name="ngModel"
      />
      @if (name.invalid && name.touched) {
        <span class="error">Name is required (min 2 chars)</span>
      }

      <input
        name="email"
        [(ngModel)]="user.email"
        email
        required
      />

      <button type="submit" [disabled]="userForm.invalid">Submit</button>
    </form>
  `
})
export class SimpleFormComponent {
  user = {
    name: '',
    email: ''
  };

  onSubmit(form: NgForm): void {
    if (form.valid) {
      console.log(this.user);
    }
  }
}
```

### Anti-Patterns

```typescript
// BAD: Mixing reactive and template-driven
@Component({
  template: `
    <form [formGroup]="form">
      <input formControlName="name" [(ngModel)]="name" /> <!-- Don't mix! -->
    </form>
  `
})

// BAD: Accessing form controls with string keys
this.form.get('address.street')?.value; // Not type-safe

// GOOD: Use typed controls
this.form.controls.address.controls.street.value;

// BAD: Subscribing to valueChanges without unsubscribing
ngOnInit() {
  this.form.valueChanges.subscribe(v => console.log(v)); // Memory leak!
}

// GOOD: Use takeUntilDestroyed or DestroyRef
private destroyRef = inject(DestroyRef);

ngOnInit() {
  this.form.valueChanges.pipe(
    takeUntilDestroyed(this.destroyRef)
  ).subscribe(v => console.log(v));
}

// BAD: Complex validation in template
@if (form.controls.email.errors?.['required'] ||
     form.controls.email.errors?.['email'] ||
     form.controls.email.errors?.['emailTaken']) {
  ...
}

// GOOD: Create computed error messages
emailError = computed(() => {
  const errors = this.form.controls.email.errors;
  if (errors?.['required']) return 'Email is required';
  if (errors?.['email']) return 'Invalid email format';
  if (errors?.['emailTaken']) return 'Email already in use';
  return null;
});
```

### When to Use

| Reactive Forms | Template-Driven Forms |
|----------------|----------------------|
| Complex validation | Simple contact forms |
| Dynamic fields (add/remove) | Quick prototypes |
| Cross-field validation | Minimal validation |
| Async validation | Learning Angular |
| Unit testing forms | < 5 fields |
| Type safety needed | |

---

## 9. Testing Patterns

### Component Testing with TestBed

```typescript
// user-profile.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { UserProfileComponent } from './user-profile.component';
import { UserService } from './user.service';

describe('UserProfileComponent', () => {
  let component: UserProfileComponent;
  let fixture: ComponentFixture<UserProfileComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent], // Standalone component
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UserService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensure no outstanding requests
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display user name after loading', () => {
    // Trigger initial data load
    fixture.detectChanges();

    // Mock the HTTP response
    const req = httpMock.expectOne('/api/user/1');
    req.flush({ id: '1', name: 'John Doe' });

    // Trigger change detection after data arrives
    fixture.detectChanges();

    const nameElement = fixture.nativeElement.querySelector('.user-name');
    expect(nameElement.textContent).toContain('John Doe');
  });

  it('should show error on failed load', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/user/1');
    req.error(new ErrorEvent('Network error'));

    fixture.detectChanges();

    const errorElement = fixture.nativeElement.querySelector('.error-message');
    expect(errorElement).toBeTruthy();
  });
});
```

### Component Harness Pattern

```typescript
// button.component.harness.ts
import { ComponentHarness, HarnessPredicate } from '@angular/cdk/testing';

export class ButtonHarness extends ComponentHarness {
  static hostSelector = 'app-button';

  // Locators for internal elements
  private button = this.locatorFor('button');
  private spinner = this.locatorForOptional('.spinner');

  // Filter factory for querying
  static with(options: { text?: string; disabled?: boolean } = {}):
    HarnessPredicate<ButtonHarness> {
    return new HarnessPredicate(ButtonHarness, options)
      .addOption('text', options.text, (harness, text) =>
        HarnessPredicate.stringMatches(harness.getText(), text)
      )
      .addOption('disabled', options.disabled, async (harness, disabled) =>
        (await harness.isDisabled()) === disabled
      );
  }

  async click(): Promise<void> {
    return (await this.button()).click();
  }

  async getText(): Promise<string> {
    return (await this.button()).text();
  }

  async isDisabled(): Promise<boolean> {
    return (await this.button()).getProperty('disabled');
  }

  async isLoading(): Promise<boolean> {
    return (await this.spinner()) !== null;
  }
}

// Using the harness in tests
describe('ButtonComponent', () => {
  let loader: HarnessLoader;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  it('should find button by text', async () => {
    const button = await loader.getHarness(
      ButtonHarness.with({ text: 'Submit' })
    );
    expect(await button.getText()).toBe('Submit');
  });

  it('should be clickable when enabled', async () => {
    const button = await loader.getHarness(
      ButtonHarness.with({ disabled: false })
    );
    await button.click();
    // Assert click handler was called
  });
});
```

### Testing with Jest (Recommended)

```typescript
// jest.config.js
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.(ts|html)$': ['jest-preset-angular', {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.html$'
    }]
  }
};

// user.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should fetch user by id', () => {
    const mockUser = { id: '1', name: 'John' };

    service.getUser('1').subscribe(user => {
      expect(user).toEqual(mockUser);
    });

    const req = httpMock.expectOne('/api/users/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);
  });
});
```

### Testing Signals

```typescript
// counter.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

describe('CounterComponent with Signals', () => {
  let component: CounterComponent;
  let fixture: ComponentFixture<CounterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CounterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should increment count', () => {
    expect(component.count()).toBe(0);

    component.increment();

    expect(component.count()).toBe(1);
  });

  it('should compute double count', () => {
    component.count.set(5);

    expect(component.doubleCount()).toBe(10);
  });

  it('should update DOM when signal changes', () => {
    component.count.set(42);
    fixture.detectChanges();

    const countDisplay = fixture.nativeElement.querySelector('.count');
    expect(countDisplay.textContent).toContain('42');
  });
});
```

### Testing SignalStore

```typescript
// user.store.spec.ts
import { TestBed } from '@angular/core/testing';
import { UserStore } from './user.store';

describe('UserStore', () => {
  let store: InstanceType<typeof UserStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserStore,
        { provide: UserService, useValue: mockUserService }
      ]
    });

    store = TestBed.inject(UserStore);
  });

  it('should start with initial state', () => {
    expect(store.user()).toBeNull();
    expect(store.loading()).toBeFalse();
    expect(store.isLoggedIn()).toBeFalse();
  });

  it('should load user', async () => {
    mockUserService.getUser.mockResolvedValue({ id: '1', name: 'John' });

    await store.loadUser('1');

    expect(store.user()).toEqual({ id: '1', name: 'John' });
    expect(store.isLoggedIn()).toBeTrue();
  });

  it('should handle load error', async () => {
    mockUserService.getUser.mockRejectedValue(new Error('Not found'));

    await store.loadUser('invalid');

    expect(store.error()).toBe('Failed to load user');
    expect(store.loading()).toBeFalse();
  });
});
```

### Anti-Patterns

```typescript
// BAD: Testing implementation details
it('should call private method', () => {
  (component as any).privateMethod(); // Don't test private methods!
});

// GOOD: Test public behavior
it('should update display after action', () => {
  component.performAction();
  expect(fixture.nativeElement.textContent).toContain('Updated');
});

// BAD: Not using async utilities properly
it('should load data', () => {
  component.loadData();
  expect(component.data).toBeDefined(); // Race condition!
});

// GOOD: Wait for async operations
it('should load data', async () => {
  await component.loadData();
  expect(component.data()).toBeDefined();
});

// Or with fakeAsync
it('should load data', fakeAsync(() => {
  component.loadData();
  tick(); // Advance virtual time
  expect(component.data()).toBeDefined();
}));

// BAD: Forgetting fixture.detectChanges()
it('should show user name', () => {
  component.userName.set('John');
  // Missing fixture.detectChanges()!
  const element = fixture.nativeElement.querySelector('.name');
  expect(element.textContent).toContain('John'); // Fails!
});

// BAD: Testing too much in one test
it('should do everything', async () => {
  // Loading, validation, submission, navigation... too much!
});

// GOOD: One assertion per test (or closely related assertions)
it('should show validation error when email invalid', () => { ... });
it('should enable submit when form valid', () => { ... });
it('should navigate on successful submit', () => { ... });
```

### When to Use

| Test Type | Use Case |
|-----------|----------|
| Unit tests | Pure functions, services, stores |
| Component tests | Component logic and rendering |
| Component harness | Reusable component test utilities |
| Integration tests | Component + service interaction |
| E2E tests | Critical user flows |

---

## 10. Performance Optimization

### Zoneless Change Detection (Angular 19+)

```typescript
// app.config.ts - Enable zoneless mode
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(), // Enable zoneless
    provideRouter(routes)
  ]
};

// angular.json - Remove zone.js from polyfills
{
  "build": {
    "options": {
      "polyfills": [
        // Remove: "zone.js"
      ]
    }
  }
}
```

### OnPush Change Detection (Pre-zoneless)

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-optimized',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // Only check on input changes
  template: `
    <div>{{ data().name }}</div>
    <child-component [item]="selectedItem()" />
  `
})
export class OptimizedComponent {
  data = input.required<Data>();
  selectedItem = computed(() => this.data().items[0]);
}
```

### Strategic @defer Usage

```typescript
@Component({
  template: `
    <!-- Critical above-the-fold content loads immediately -->
    <header>
      <nav-menu />
    </header>

    <main>
      <hero-section [data]="heroData()" />

      <!-- Heavy chart deferred until idle -->
      @defer (on idle; prefetch on idle) {
        <analytics-chart [data]="chartData()" />
      } @placeholder {
        <chart-skeleton />
      }

      <!-- Comments load when scrolled into view -->
      @defer (on viewport; prefetch on idle) {
        <comments-section [postId]="postId()" />
      } @placeholder {
        <div style="min-height: 400px">
          <p>Scroll to load comments...</p>
        </div>
      }

      <!-- Heavy editor loads on interaction -->
      @defer (on interaction; prefetch on hover) {
        <rich-text-editor />
      } @placeholder {
        <button>Click to edit</button>
      }
    </main>
  `
})
export class OptimizedPageComponent {}
```

### Signal-Based Reactivity

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Only this expression re-evaluates when count changes -->
    <div>Count: {{ count() }}</div>

    <!-- This computed only recalculates when count changes -->
    <div>Double: {{ doubleCount() }}</div>

    <!-- List only re-renders when items actually change -->
    @for (item of items(); track item.id) {
      <item-card [item]="item" />
    }
  `
})
export class ReactiveComponent {
  count = signal(0);
  doubleCount = computed(() => this.count() * 2);
  items = signal<Item[]>([]);

  // Efficient updates
  addItem(item: Item) {
    this.items.update(list => [...list, item]);
  }

  // BAD: This triggers full re-render
  // this.items().push(item); // Don't mutate!
}
```

### Lazy Loading Strategies

```typescript
// Route-based lazy loading
export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component')
      .then(m => m.DashboardComponent)
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes')
      .then(m => m.ADMIN_ROUTES),
    canMatch: [() => inject(AuthService).isAdmin()] // Don't load if not admin
  }
];

// Preloading strategy
import { PreloadAllModules } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes,
      withPreloading(PreloadAllModules) // Preload after initial load
    )
  ]
};

// Custom preloading strategy
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    if (route.data?.['preload']) {
      return load();
    }
    return of(null);
  }
}
```

### TrackBy for Lists

```html
<!-- ALWAYS use track for optimal performance -->
@for (user of users(); track user.id) {
  <user-card [user]="user" />
}

<!-- For simple arrays without IDs, use $index carefully -->
@for (name of names(); track $index) {
  <span>{{ name }}</span>
}
<!-- Note: $index is less efficient for mutations, prefer unique IDs -->
```

### Bundle Optimization

```typescript
// Import only what you need from large libraries
// BAD
import * as lodash from 'lodash';

// GOOD
import debounce from 'lodash/debounce';

// Use Angular's built-in utilities when possible
// BAD
import { cloneDeep } from 'lodash';
const copy = cloneDeep(obj);

// GOOD - Use structuredClone (native)
const copy = structuredClone(obj);

// Or for signals
const items = signal<Item[]>([]);
items.update(list => [...list, newItem]); // Creates new reference
```

### Performance Monitoring

```typescript
// Enable Angular DevTools profiler
// In development, open DevTools > Angular > Profiler

// Manual performance marks
@Component({...})
export class MonitoredComponent {
  ngOnInit() {
    performance.mark('component-init-start');
  }

  ngAfterViewInit() {
    performance.mark('component-init-end');
    performance.measure(
      'component-initialization',
      'component-init-start',
      'component-init-end'
    );
  }
}
```

### Anti-Patterns

```typescript
// BAD: Function calls in template (recalculated every check)
@Component({
  template: `<div>{{ getFullName() }}</div>` // Called on every CD cycle!
})
export class BadComponent {
  getFullName() {
    return `${this.firstName} ${this.lastName}`;
  }
}

// GOOD: Use computed signal
@Component({
  template: `<div>{{ fullName() }}</div>`
})
export class GoodComponent {
  firstName = signal('');
  lastName = signal('');
  fullName = computed(() => `${this.firstName()} ${this.lastName()}`);
}

// BAD: Large bundles from barrel imports
import { SomeComponent, AnotherComponent } from '@my-lib'; // Imports entire lib

// GOOD: Deep imports
import { SomeComponent } from '@my-lib/some-component';

// BAD: Synchronous heavy computation blocking main thread
@Component({...})
export class SlowComponent {
  processData() {
    // Blocks UI for 500ms!
    const result = heavyComputation(this.data());
    return result;
  }
}

// GOOD: Use web workers or defer
@Component({...})
export class FastComponent {
  result = computed(() => {
    // For heavy computation, consider:
    // 1. Web Worker
    // 2. requestIdleCallback
    // 3. Breaking into chunks
    return this.data(); // Keep template computations light
  });
}

// BAD: Not cleaning up subscriptions
ngOnInit() {
  this.data$.subscribe(d => this.process(d)); // Memory leak!
}

// GOOD: Use takeUntilDestroyed or signals
private destroyRef = inject(DestroyRef);

ngOnInit() {
  this.data$.pipe(
    takeUntilDestroyed(this.destroyRef)
  ).subscribe(d => this.process(d));
}

// BETTER: Use toSignal
data = toSignal(this.data$, { initialValue: null });
```

### Performance Checklist

| Optimization | Impact | Effort |
|--------------|--------|--------|
| Enable zoneless (Angular 19+) | High | Low |
| Use OnPush change detection | High | Medium |
| Use signals for state | High | Medium |
| Strategic @defer blocks | High | Low |
| Route-based lazy loading | High | Low |
| Track by unique ID in @for | Medium | Low |
| Avoid template function calls | Medium | Low |
| Deep imports vs barrel imports | Medium | Low |
| Preload critical routes | Medium | Low |

---

## Summary: Decision Trees

### State Management

```
Is it async data from API?
├─ YES → Use resource()/rxResource()/httpResource()
│        or React Query-like patterns
└─ NO → Is it shared across many components?
    ├─ YES → NgRx SignalStore
    └─ NO → Is it component-local?
        ├─ YES → Signals (signal(), computed())
        └─ NO → signalState() for complex local state
```

### Component Design

```
Is this a new component?
├─ YES → Use standalone: true (or omit, it's default)
│        Use signal inputs: input(), input.required()
│        Use signal outputs: output()
│        Use model() for two-way binding
└─ NO (legacy) → Migrate incrementally
    ├─ Start with standalone conversion
    ├─ Then migrate to signal inputs
    └─ Finally adopt new control flow
```

### Change Detection

```
Angular 19+?
├─ YES → Consider zoneless with provideZonelessChangeDetection()
│        Use signals throughout
└─ NO → Use OnPush + signals
        Manual detectChanges() only when absolutely necessary
```

### Forms

```
Is the form complex?
├─ YES (dynamic fields, cross-field validation, >5 fields)
│   └─ Use Reactive Forms with FormBuilder
└─ NO (simple, <5 fields, basic validation)
    └─ Template-driven Forms acceptable
```

---

## Sources

- [Angular 2025 Guide: Mastering Standalone Components](https://www.ismaelramos.dev/blog/angular-2025-guide-mastering-standalone-components/)
- [Angular Signals: Complete Guide](https://blog.angular-university.io/angular-signals/)
- [Best Practices for Using Angular Signals in 2025](https://medium.com/@AmnaJavaid/best-practices-for-using-angular-signals-in-2025-2f4d4088a1d2)
- [Angular Control Flow](https://angular.dev/guide/templates/control-flow)
- [Angular @defer: Complete Guide](https://blog.angular-university.io/angular-defer/)
- [NgRx SignalStore](https://ngrx.io/guide/signals/signal-store)
- [Angular State Management for 2025](https://nx.dev/blog/angular-state-management-2025)
- [Control Route Access with Guards](https://angular.dev/guide/routing/route-guards)
- [Mastering Dependency Injection in Angular 2025](https://dev.to/codewithrajat/mastering-dependency-injection-in-angular-2025-the-complete-developer-guide-33m4)
- [Angular Forms Overview](https://angular.dev/guide/forms)
- [Using Component Harnesses in Tests](https://angular.dev/guide/testing/using-component-harnesses)
- [Zoneless Change Detection](https://angular.dev/guide/zoneless)
- [Angular Signal Components Guide](https://blog.angular-university.io/angular-signal-components/)
- [Async Reactivity with Resources](https://angular.dev/guide/signals/resource)
