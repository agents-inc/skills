# NgRx SignalStore - Testing Examples

Testing patterns for NgRx SignalStore including unit tests, mocking strategies, and component integration.

**Prerequisites:** Understand [core.md](core.md) (signalStore basics) first.

**Related examples:**
- [entities.md](entities.md) - withEntities, CRUD operations
- [effects.md](effects.md) - rxMethod, side effects
- [features.md](features.md) - signalStoreFeature, custom features

---

## Pattern 1: Basic Store Unit Tests

### Good Example - Testing Store Methods with Vitest

```typescript
// stores/counter.store.ts
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

const INITIAL_COUNT = 0;
const INCREMENT_STEP = 1;

export const CounterStore = signalStore(
  withState({ count: INITIAL_COUNT }),
  withMethods((store) => ({
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

// stores/counter.store.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, runInInjectionContext } from '@angular/core/testing';
import { CounterStore } from './counter.store';

const INITIAL_COUNT = 0;
const TEST_COUNT = 42;

describe('CounterStore', () => {
  let store: InstanceType<typeof CounterStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CounterStore],
    });

    store = runInInjectionContext(TestBed.inject(Injector), () =>
      TestBed.inject(CounterStore)
    );
  });

  it('should have initial count of 0', () => {
    expect(store.count()).toBe(INITIAL_COUNT);
  });

  it('should increment count', () => {
    store.increment();
    expect(store.count()).toBe(1);

    store.increment();
    expect(store.count()).toBe(2);
  });

  it('should decrement count', () => {
    store.setCount(5);
    store.decrement();
    expect(store.count()).toBe(4);
  });

  it('should reset count to initial value', () => {
    store.setCount(TEST_COUNT);
    expect(store.count()).toBe(TEST_COUNT);

    store.reset();
    expect(store.count()).toBe(INITIAL_COUNT);
  });

  it('should set count to specific value', () => {
    store.setCount(TEST_COUNT);
    expect(store.count()).toBe(TEST_COUNT);
  });
});

// Add missing import
import { Injector } from '@angular/core';
```

**Why good:** TestBed for Angular DI, runInInjectionContext for store instantiation, named constants for test values, clean test structure

---

## Pattern 2: Testing Store with Mocked Services

### Good Example - Mocking HttpClient in Store Tests

```typescript
// stores/user.store.ts
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';

const USERS_API_URL = '/api/users';

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
    const http = inject(HttpClient);

    return {
      loadUsers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            http.get<User[]>(USERS_API_URL).pipe(
              catchError((err) => {
                patchState(store, {
                  error: err.message ?? 'Failed to load users',
                  isLoading: false,
                });
                return of([]);
              })
            )
          ),
          tap((users) => {
            patchState(store, { users, isLoading: false });
          })
        )
      ),
    };
  })
);

// stores/user.store.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { UserStore } from './user.store';

const MOCK_USERS = [
  { id: '1', name: 'Alice', email: 'alice@test.com' },
  { id: '2', name: 'Bob', email: 'bob@test.com' },
];

describe('UserStore', () => {
  let store: InstanceType<typeof UserStore>;
  let httpMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpMock = {
      get: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        UserStore,
        { provide: HttpClient, useValue: httpMock },
      ],
    });

    store = TestBed.inject(UserStore);
  });

  it('should have empty initial state', () => {
    expect(store.users()).toEqual([]);
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('should load users successfully', fakeAsync(() => {
    httpMock.get.mockReturnValue(of(MOCK_USERS));

    store.loadUsers();
    tick();

    expect(store.users()).toEqual(MOCK_USERS);
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBeNull();
  }));

  it('should handle loading state', fakeAsync(() => {
    httpMock.get.mockReturnValue(of(MOCK_USERS));

    // Before load completes
    store.loadUsers();
    expect(store.isLoading()).toBe(true);

    tick();
    expect(store.isLoading()).toBe(false);
  }));

  it('should handle error', fakeAsync(() => {
    const errorMessage = 'Network error';
    httpMock.get.mockReturnValue(throwError(() => new Error(errorMessage)));

    store.loadUsers();
    tick();

    expect(store.users()).toEqual([]);
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBe(errorMessage);
  }));
});
```

**Why good:** Mock HttpClient with vi.fn(), fakeAsync/tick for async tests, tests loading, success, and error states, named constants for mock data

---

## Pattern 3: Testing with unprotected() Utility

### Good Example - Using unprotected for State Access (v19.1+)

```typescript
// stores/cart.store.ts
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isCheckingOut: boolean;
}

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>({
    items: [],
    isCheckingOut: false,
  }),
  withMethods((store) => ({
    addItem(item: Omit<CartItem, 'quantity'>) {
      const existing = store.items().find((i) => i.id === item.id);
      if (existing) {
        patchState(store, (state) => ({
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }));
      } else {
        patchState(store, (state) => ({
          items: [...state.items, { ...item, quantity: 1 }],
        }));
      }
    },
    startCheckout() {
      patchState(store, { isCheckingOut: true });
    },
    clearCart() {
      patchState(store, { items: [], isCheckingOut: false });
    },
  }))
);

// stores/cart.store.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { unprotected } from '@ngrx/signals/testing';
import { patchState } from '@ngrx/signals';
import { CartStore } from './cart.store';

const MOCK_ITEM = { id: '1', name: 'Test Product' };
const MOCK_CART_ITEMS = [
  { id: '1', name: 'Product 1', quantity: 2 },
  { id: '2', name: 'Product 2', quantity: 1 },
];

describe('CartStore', () => {
  let store: InstanceType<typeof CartStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CartStore],
    });

    store = TestBed.inject(CartStore);
  });

  describe('addItem', () => {
    it('should add new item with quantity 1', () => {
      store.addItem(MOCK_ITEM);

      expect(store.items()).toHaveLength(1);
      expect(store.items()[0]).toEqual({ ...MOCK_ITEM, quantity: 1 });
    });

    it('should increment quantity for existing item', () => {
      store.addItem(MOCK_ITEM);
      store.addItem(MOCK_ITEM);

      expect(store.items()).toHaveLength(1);
      expect(store.items()[0].quantity).toBe(2);
    });
  });

  describe('using unprotected() for test setup', () => {
    it('should allow direct state modification in tests', () => {
      // Use unprotected() to bypass state protection for test setup
      patchState(unprotected(store), { items: MOCK_CART_ITEMS });

      expect(store.items()).toHaveLength(2);
      expect(store.items()[0].quantity).toBe(2);
    });

    it('should test checkout with pre-populated cart', () => {
      // Setup: Pre-populate cart using unprotected
      patchState(unprotected(store), { items: MOCK_CART_ITEMS });

      // Action
      store.startCheckout();

      // Assert
      expect(store.isCheckingOut()).toBe(true);
      expect(store.items()).toHaveLength(2);
    });

    it('should clear cart correctly', () => {
      // Setup
      patchState(unprotected(store), {
        items: MOCK_CART_ITEMS,
        isCheckingOut: true,
      });

      // Action
      store.clearCart();

      // Assert
      expect(store.items()).toHaveLength(0);
      expect(store.isCheckingOut()).toBe(false);
    });
  });
});
```

**Why good:** unprotected() bypasses state protection for test setup, allows setting initial state for specific test scenarios, cleaner test arrangement

---

## Pattern 4: Testing Entity Store

### Good Example - Testing withEntities Store

```typescript
// stores/todo.store.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { unprotected } from '@ngrx/signals/testing';
import { patchState } from '@ngrx/signals';
import { setAllEntities } from '@ngrx/signals/entities';
import { TodoStore } from './todo.store';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

const MOCK_TODOS: Todo[] = [
  { id: '1', title: 'First todo', completed: false },
  { id: '2', title: 'Second todo', completed: true },
  { id: '3', title: 'Third todo', completed: false },
];

describe('TodoStore', () => {
  let store: InstanceType<typeof TodoStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TodoStore],
    });

    store = TestBed.inject(TodoStore);
  });

  describe('entity operations', () => {
    it('should set all todos', () => {
      store.setTodos(MOCK_TODOS);

      expect(store.entities()).toHaveLength(3);
      expect(store.ids()).toEqual(['1', '2', '3']);
    });

    it('should add a new todo', () => {
      store.addTodo('New todo');

      expect(store.entities()).toHaveLength(1);
      expect(store.entities()[0].title).toBe('New todo');
      expect(store.entities()[0].completed).toBe(false);
    });

    it('should toggle todo completion', () => {
      store.setTodos(MOCK_TODOS);

      store.toggleTodo('1');

      const todo = store.entities().find((t) => t.id === '1');
      expect(todo?.completed).toBe(true);
    });

    it('should remove todo', () => {
      store.setTodos(MOCK_TODOS);

      store.removeTodo('2');

      expect(store.entities()).toHaveLength(2);
      expect(store.ids()).not.toContain('2');
    });
  });

  describe('computed signals', () => {
    beforeEach(() => {
      // Setup todos using unprotected
      patchState(unprotected(store), setAllEntities(MOCK_TODOS));
    });

    it('should compute completed count', () => {
      expect(store.completedCount()).toBe(1);
    });

    it('should compute active count', () => {
      expect(store.activeCount()).toBe(2);
    });

    it('should filter by status', () => {
      store.setFilter('completed');
      expect(store.filteredTodos()).toHaveLength(1);

      store.setFilter('active');
      expect(store.filteredTodos()).toHaveLength(2);

      store.setFilter('all');
      expect(store.filteredTodos()).toHaveLength(3);
    });
  });
});
```

**Why good:** Tests entity operations (add, update, remove), tests computed signals, uses unprotected for setup, named constants for mock data

---

## Pattern 5: Component Integration Tests

### Good Example - Testing Component with Store

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
      <span data-testid="count">{{ store.count() }}</span>
      <button data-testid="increment" (click)="store.increment()">+</button>
      <button data-testid="decrement" (click)="store.decrement()">-</button>
      <button data-testid="reset" (click)="store.reset()">Reset</button>
    </div>
  `,
})
export class CounterComponent {
  readonly store = inject(CounterStore);
}

// components/counter.component.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CounterComponent } from './counter.component';
import { CounterStore } from '../stores/counter.store';

describe('CounterComponent', () => {
  let fixture: ComponentFixture<CounterComponent>;
  let component: CounterComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CounterComponent],
      providers: [CounterStore],
    }).compileComponents();

    fixture = TestBed.createComponent(CounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display initial count', () => {
    const countEl = fixture.debugElement.query(By.css('[data-testid="count"]'));
    expect(countEl.nativeElement.textContent).toBe('0');
  });

  it('should increment count when + button clicked', () => {
    const incrementBtn = fixture.debugElement.query(
      By.css('[data-testid="increment"]')
    );

    incrementBtn.nativeElement.click();
    fixture.detectChanges();

    const countEl = fixture.debugElement.query(By.css('[data-testid="count"]'));
    expect(countEl.nativeElement.textContent).toBe('1');
  });

  it('should decrement count when - button clicked', () => {
    // Setup: increment first
    component.store.increment();
    component.store.increment();
    fixture.detectChanges();

    const decrementBtn = fixture.debugElement.query(
      By.css('[data-testid="decrement"]')
    );
    decrementBtn.nativeElement.click();
    fixture.detectChanges();

    const countEl = fixture.debugElement.query(By.css('[data-testid="count"]'));
    expect(countEl.nativeElement.textContent).toBe('1');
  });

  it('should reset count when Reset button clicked', () => {
    // Setup
    component.store.setCount(42);
    fixture.detectChanges();

    const resetBtn = fixture.debugElement.query(
      By.css('[data-testid="reset"]')
    );
    resetBtn.nativeElement.click();
    fixture.detectChanges();

    const countEl = fixture.debugElement.query(By.css('[data-testid="count"]'));
    expect(countEl.nativeElement.textContent).toBe('0');
  });
});
```

**Why good:** Tests component with real store, uses data-testid for reliable selectors, tests user interactions, fixture.detectChanges() after state changes

---

## Pattern 6: Testing rxMethod Effects

### Good Example - Testing Async Effects

```typescript
// stores/search.store.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, delay } from 'rxjs';
import { SearchStore } from './search.store';

const DEBOUNCE_MS = 300;
const MOCK_RESULTS = [
  { id: '1', title: 'Result 1' },
  { id: '2', title: 'Result 2' },
];

describe('SearchStore', () => {
  let store: InstanceType<typeof SearchStore>;
  let httpMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpMock = {
      get: vi.fn().mockReturnValue(of(MOCK_RESULTS)),
    };

    TestBed.configureTestingModule({
      providers: [
        SearchStore,
        { provide: HttpClient, useValue: httpMock },
      ],
    });

    store = TestBed.inject(SearchStore);
  });

  describe('search rxMethod', () => {
    it('should debounce search queries', fakeAsync(() => {
      // Rapid searches
      store.search('a');
      store.search('ab');
      store.search('abc');

      // Before debounce
      expect(httpMock.get).not.toHaveBeenCalled();

      // After debounce
      tick(DEBOUNCE_MS);

      // Only last query should be sent
      expect(httpMock.get).toHaveBeenCalledTimes(1);
      expect(httpMock.get).toHaveBeenCalledWith(
        expect.stringContaining('q=abc')
      );
    }));

    it('should not search empty query', fakeAsync(() => {
      store.search('');
      tick(DEBOUNCE_MS);

      expect(httpMock.get).not.toHaveBeenCalled();
      expect(store.results()).toEqual([]);
    }));

    it('should update results after search', fakeAsync(() => {
      store.search('test');
      tick(DEBOUNCE_MS);

      expect(store.results()).toEqual(MOCK_RESULTS);
      expect(store.isLoading()).toBe(false);
    }));

    it('should handle duplicate queries', fakeAsync(() => {
      store.search('test');
      tick(DEBOUNCE_MS);

      store.search('test'); // Same query
      tick(DEBOUNCE_MS);

      // distinctUntilChanged should prevent duplicate API calls
      expect(httpMock.get).toHaveBeenCalledTimes(1);
    }));
  });
});
```

**Why good:** Tests debounce behavior with fakeAsync/tick, tests distinctUntilChanged, mock HttpClient, named constant for debounce timing

---

## Pattern 7: Testing with withOptionalHooks

### Good Example - Avoiding onInit Side Effects in Tests

```typescript
// Alternative approach: disable hooks during testing
// stores/data.store.ts
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';

export const DataStore = signalStore(
  { providedIn: 'root' },
  withState({
    data: [] as string[],
    initialized: false,
  }),
  withMethods((store) => ({
    load() {
      // Load logic
      patchState(store, { initialized: true });
    },
  })),
  withHooks({
    onInit({ load }) {
      // This runs immediately - can cause issues in tests
      load();
    },
  })
);

// Test approach 1: Override the store
// stores/data.store.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

// Create test-specific store WITHOUT hooks
const TestDataStore = signalStore(
  withState({
    data: [] as string[],
    initialized: false,
  }),
  withMethods((store) => ({
    load() {
      patchState(store, { initialized: true });
    },
  }))
  // No withHooks!
);

describe('DataStore (without hooks)', () => {
  let store: InstanceType<typeof TestDataStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestDataStore],
    });

    store = TestBed.inject(TestDataStore);
  });

  it('should not auto-initialize', () => {
    // Without hooks, store starts uninitialized
    expect(store.initialized()).toBe(false);
  });

  it('should initialize when load is called', () => {
    store.load();
    expect(store.initialized()).toBe(true);
  });
});
```

**Why good:** Shows how to handle onInit side effects in tests, test-specific store without hooks, isolates behavior for testing
