# NgRx SignalStore - Reference

> The feature lookup, anti-pattern code, TypeScript recipes and migration steps. The decision trees and the red flags are in [SKILL.md](SKILL.md).

---

## Feature lookup

| Use Case              | Solution               | Why                                  |
| --------------------- | ---------------------- | ------------------------------------ |
| Entity collections    | `withEntities()`       | Normalized state, CRUD operations    |
| Derived data          | `withComputed()`       | Memoized, reactive                   |
| State updates         | `patchState()`         | Immutable, type-safe                 |
| RxJS side effects     | `rxMethod()`           | Operators, cancellation              |
| Reusable logic        | `signalStoreFeature()` | Composition, DRY                     |
| Loading states        | `withCallState()`      | Consistent patterns                  |
| DevTools              | `withDevtools()`       | Debugging, inspection                |
| Signal-only effects   | `signalMethod()`       | No RxJS dependency (v19+)            |
| Non-reactive props    | `withProps()`          | Mutable objects, observables (v19+)  |
| Context-aware feature | `withFeature()`        | Feature needing store methods (v20+) |
| Derived linked state  | `withLinkedState()`    | Auto-computed reactive state (v20+)  |

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
}));

// CORRECT - Using patchState
withMethods((store) => ({
  addItem(item: Item) {
    patchState(store, (state) => ({
      items: [...state.items, item],
    }));
  },
}));
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
        todos: state.todos.map((t) => (t.id === id ? { ...t, ...changes } : t)),
      }));
    },
  })),
);

// CORRECT - Using withEntities
export const TodoStore = signalStore(
  withEntities<Todo>(),
  withMethods((store) => ({
    updateTodo(id: string, changes: Partial<Todo>) {
      // O(1) lookup, built-in updater
      patchState(store, updateEntity({ id, changes }));
    },
  })),
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
}));

// CORRECT - Using rxMethod
withMethods((store, http = inject(HttpClient)) => ({
  search: rxMethod<string>(
    pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term) => http.get(`/search?q=${term}`)),
      tap((results) => patchState(store, { results })),
    ),
  ),
}));
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
  withState({ items: [] }),
);

// CORRECT - withState first
export const Store = signalStore(
  withState({ items: [] as Item[] }),
  withComputed(({ items }) => ({
    total: computed(() => items().length),
  })),
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
  })),
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
  from: "",
  to: "",
  flights: [],
});

// 3. Entity type with generic
withEntities<Flight>();

// 4. Collection with type helper
withEntities({ entity: type<Flight>(), collection: "flight" });

// 5. Custom feature with type constraints
signalStoreFeature(
  { state: type<{ loading: boolean }>() },
  withMethods((store) => ({
    // store.loading() is typed
  })),
);
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

The concept-for-concept table and the ordered migration steps are in
[examples/migration.md](examples/migration.md), alongside the worked before-and-after code for each
one.

---

## DevTools Usage

Redux DevTools integration via `@angular-architects/ngrx-toolkit` provides state inspection, action tracking, time-travel debugging, and state diffs. Add `withDevtools('name')` before `withState` in your store definition.

Note: DevTools don't activate until you open the browser extension and select the "NgRx Signal Store" tab.

See [examples/features.md](examples/features.md) Pattern 5 for full implementation.
