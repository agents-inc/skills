# NgRx SignalStore - Reference

Decision frameworks, red flags, and anti-patterns for NgRx SignalStore state management.

---

## Decision Framework

### When to Use SignalStore vs Alternatives

```
What kind of state do I have?

Is it server data (from API)?
├─ YES → Use HTTP service + cache in SignalStore with rxMethod
│        (SignalStore provides caching, HTTP service fetches)
└─ NO → Is it shared across components?
    ├─ YES → SignalStore
    │   └─ Is it entity collection?
    │       ├─ YES → withEntities
    │       └─ NO → withState
    └─ NO → Angular signal in component (ref/computed)
```

### signalStore vs Traditional NgRx

```
Should I use SignalStore or traditional NgRx?

Is this a new Angular 17+ project?
├─ YES → SignalStore (recommended for new projects)
└─ NO → Is the existing NgRx codebase large?
    ├─ YES → Consider gradual migration
    │   - New features: SignalStore
    │   - Existing features: Keep NgRx, migrate incrementally
    └─ NO → Migrate to SignalStore
```

### withState vs withEntities

```
How should I model this state?

Is it a collection of items with unique IDs?
├─ YES → withEntities
│   - Provides normalized { ids, entityMap } structure
│   - Built-in CRUD updaters
│   - Efficient O(1) lookups by ID
└─ NO → withState
    - Simple object or primitive values
    - Custom structure
    - Nested data
```

### rxMethod vs async/await in Methods

```
How should I handle async operations?

Do I need RxJS operators (debounce, switchMap, retry)?
├─ YES → rxMethod
│   - Cancellation support
│   - Complex operator chains
│   - Reactive input (signal/observable)
└─ NO → Do I need to react to signal changes?
    ├─ YES → signalMethod (v19+)
    │   - No RxJS dependency
    │   - Signal reactivity
    │   - Manual race condition handling
    └─ NO → async/await in withMethods
        - Simple fetch operations
        - Sequential calls
        - Try/catch error handling
```

### Quick Reference Table

| Use Case | Solution | Why |
|----------|----------|-----|
| Entity collections | `withEntities()` | Normalized state, CRUD operations |
| Derived data | `withComputed()` | Memoized, reactive |
| State updates | `patchState()` | Immutable, type-safe |
| RxJS side effects | `rxMethod()` | Operators, cancellation |
| Reusable logic | `signalStoreFeature()` | Composition, DRY |
| Loading states | `withCallState()` | Consistent patterns |
| DevTools | `withDevtools()` | Debugging, inspection |
| Signal-only effects | `signalMethod()` | No RxJS dependency (v19+) |
| Non-reactive props | `withProps()` | Mutable objects, observables (v19+) |
| Derived linked state | `withLinkedState()` | Auto-computed reactive state (v20+) |

---

## RED FLAGS

**High Priority Issues:**

- **Mutating state directly instead of using patchState** - breaks reactivity and causes unpredictable behavior
- **Using arrays instead of withEntities for collections** - misses normalized state benefits, O(n) lookups
- **Not wrapping async RxJS flows in rxMethod** - loses cancellation and proper cleanup
- **Default exports in store files** - violates Angular conventions, breaks tree-shaking
- **Accessing store state outside of computed/template** - may not trigger updates

**Medium Priority Issues:**

- Not using `withDevtools()` for debugging in development
- Missing error handling in rxMethod pipelines
- Deeply nested state (flatten with multiple state slices)
- Not using `entityConfig()` for custom entity IDs (v18+)
- Magic numbers instead of named constants

**Common Mistakes:**

- Forgetting feature ordering (withState must come first)
- Not returning state/computed/methods from signalStoreFeature
- Using `resource()` API in stores (experimental, incomplete)
- Circular dependencies between stores
- Mutating entity objects instead of using updateEntity

**Gotchas & Edge Cases:**

- `withHooks.onInit()` runs during store instantiation - be careful with side effects in tests
- `patchState` with entity updaters requires collection option when using named collections
- `rxMethod` auto-unsubscribes on destroy - don't manually unsubscribe
- Protected state (v18+) prevents external `patchState` calls by default
- Feature execution order matters - later features can access earlier ones
- **v19+ Deep Freeze**: State values are recursively frozen with `Object.freeze` in development mode - use `withProps()` for mutable objects like FormGroup
- `signalMethod` does not handle race conditions - use `rxMethod` with `switchMap` for cancellable requests

---

## Anti-Patterns

### Direct State Mutation

Mutating state objects instead of using patchState.

```typescript
// WRONG - Direct mutation
withMethods((store) => ({
  addItem(item: Item) {
    store.items().push(item); // Mutation!
  },
}))

// CORRECT - Using patchState
withMethods((store) => ({
  addItem(item: Item) {
    patchState(store, (state) => ({
      items: [...state.items, item],
    }));
  },
}))
```

### Array Instead of withEntities

Using plain arrays for entity collections.

```typescript
// WRONG - Array in state
export const TodoStore = signalStore(
  withState({
    todos: [] as Todo[], // Array!
  }),
  withMethods((store) => ({
    updateTodo(id: string, changes: Partial<Todo>) {
      // O(n) lookup, manual immutable update
      patchState(store, (state) => ({
        todos: state.todos.map((t) =>
          t.id === id ? { ...t, ...changes } : t
        ),
      }));
    },
  }))
);

// CORRECT - Using withEntities
export const TodoStore = signalStore(
  withEntities<Todo>(),
  withMethods((store) => ({
    updateTodo(id: string, changes: Partial<Todo>) {
      // O(1) lookup, built-in updater
      patchState(store, updateEntity({ id, changes }));
    },
  }))
);
```

### Async Without rxMethod

Using async/await when RxJS operators are needed.

```typescript
// WRONG - Loses debounce/cancellation
withMethods((store) => ({
  async search(term: string) {
    // No debounce, no cancellation
    const results = await http.get(`/search?q=${term}`);
    patchState(store, { results });
  },
}))

// CORRECT - Using rxMethod
withMethods((store, http = inject(HttpClient)) => ({
  search: rxMethod<string>(
    pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term) => http.get(`/search?q=${term}`)),
      tap((results) => patchState(store, { results }))
    )
  ),
}))
```

### Wrong Feature Order

Placing features in incorrect order.

```typescript
// WRONG - withComputed before withState
export const Store = signalStore(
  withComputed(() => ({
    // Error: can't access state that doesn't exist yet
    total: computed(() => store.items().length),
  })),
  withState({ items: [] })
);

// CORRECT - withState first
export const Store = signalStore(
  withState({ items: [] as Item[] }),
  withComputed(({ items }) => ({
    total: computed(() => items().length),
  }))
);
```

### External State Modification

Trying to modify protected state from outside the store.

```typescript
// WRONG - External patchState (blocked in v18+)
@Component({})
export class MyComponent {
  readonly store = inject(MyStore);

  reset() {
    // Error: state is protected by default
    patchState(this.store, { count: 0 });
  }
}

// CORRECT - Expose method in store
export const MyStore = signalStore(
  withState({ count: 0 }),
  withMethods((store) => ({
    reset() {
      patchState(store, { count: 0 });
    },
  }))
);

// Component calls exposed method
@Component({})
export class MyComponent {
  readonly store = inject(MyStore);

  reset() {
    this.store.reset();
  }
}
```

---

## TypeScript Integration Best Practices

### Type Inference Strategy

```typescript
// 1. Define interfaces for state
interface FlightState {
  from: string;
  to: string;
  flights: Flight[];
}

// 2. Use typed withState
withState<FlightState>({
  from: '',
  to: '',
  flights: [],
})

// 3. Entity type with generic
withEntities<Flight>()

// 4. Collection with type helper
withEntities({ entity: type<Flight>(), collection: 'flight' })

// 5. Custom feature with type constraints
signalStoreFeature(
  { state: type<{ loading: boolean }>() },
  withMethods((store) => ({
    // store.loading() is typed
  }))
)
```

### Store Type Export

```typescript
// Export store type for component typing
export const FlightStore = signalStore(/* ... */);
export type FlightStoreType = InstanceType<typeof FlightStore>;

// Use in components
@Component({})
export class FlightComponent {
  readonly store: FlightStoreType = inject(FlightStore);
}
```

---

## Performance Considerations

### Signal Granularity

- Each state slice is a signal - fine-grained reactivity
- Components only re-render when accessed signals change
- Use `withComputed()` for derived state to avoid recalculation

### Entity Lookups

- `withEntities()` provides O(1) ID lookups via entityMap
- Array state requires O(n) iteration
- Use `selectId` in entityConfig for non-standard ID fields

### rxMethod Cleanup

- `rxMethod` subscriptions auto-cleanup on store destroy
- Use `takeUntilDestroyed()` for component-level subscriptions
- `switchMap` cancels previous requests automatically

---

## Migration Guide

### From Traditional NgRx to SignalStore

| NgRx Concept | SignalStore Equivalent |
|--------------|----------------------|
| `createAction()` | Method in `withMethods()` |
| `createReducer()` | `patchState()` in methods |
| `createSelector()` | `withComputed()` |
| `createEffect()` | `rxMethod()` |
| `createEntityAdapter()` | `withEntities()` |
| `provideMockStore()` | `unprotected()` + TestBed |

### Step-by-Step Migration

1. **Create SignalStore alongside existing NgRx**
2. **Migrate one feature at a time**
3. **Use rxMethod for effects that need RxJS**
4. **Replace selectors with withComputed**
5. **Replace entity adapter with withEntities**
6. **Remove NgRx feature when fully migrated**

For detailed migration examples, see [examples/migration.md](examples/migration.md).

---

## DevTools Usage

Redux DevTools integration via ngrx-toolkit provides:

- **State inspection** - View current store state
- **Action tracking** - See state changes over time
- **Time-travel** - Jump to previous states
- **State diff** - Compare state before/after updates

```typescript
import { withDevtools } from '@angular-architects/ngrx-toolkit';

export const Store = signalStore(
  { providedIn: 'root' },
  withDevtools('store-name'),
  withState({ /* ... */ })
);
```

Note: DevTools don't activate until you open the extension and select "NgRx Signal Store" tab.
