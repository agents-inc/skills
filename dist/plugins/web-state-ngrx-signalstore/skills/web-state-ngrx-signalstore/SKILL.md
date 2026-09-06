---
name: web-state-ngrx-signalstore
description: NgRx SignalStore patterns for Angular state management. Use when managing client state with Angular Signals, composing store features, handling entities, or integrating RxJS effects.
---

# NgRx SignalStore Patterns

> **Quick Guide:** A SignalStore is an Angular service assembled from features — `withState`, `withComputed`, `withMethods`, `withHooks` — applied in that order, since each one sees only what came before it. Every update goes through `patchState`; state is protected from outside writes from v18 and deep-frozen in development from v19, which is why a `FormGroup` or any other mutable object belongs in `withProps` rather than in state.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — `signalStore`, `withState`, `withComputed`, `withMethods`, `withProps`, DI and component-scoped stores
- [examples/entities.md](examples/entities.md) — `withEntities`, the CRUD updaters, `prependEntity` / `upsertEntity` (v20+)
- [examples/effects.md](examples/effects.md) — `rxMethod`, `signalMethod` (v19+), side effects
- [examples/features.md](examples/features.md) — `signalStoreFeature`, custom features, call state, DevTools
- [examples/testing.md](examples/testing.md) — unit tests, `unprotected()`, mocking strategies
- [examples/migration.md](examples/migration.md) — migrating from actions, reducers and effects
- [reference.md](reference.md) — comparison tables, anti-pattern code, TypeScript recipes, migration steps

---

## Which path applies

- **A store scoped to the whole app** — `signalStore({ providedIn: "root" })`; follow [examples/core.md](examples/core.md).
- **A store scoped to a component** — listed in the component's `providers`, so it is destroyed with the component and its `rxMethod` subscriptions go with it; follow [examples/core.md](examples/core.md).
- **A collection keyed by id** — `withEntities` rather than an array in state; follow [examples/entities.md](examples/entities.md).

---

<critical_requirements>

## Before writing SignalStore code

**Update state through `patchState()`.** It produces a new state object and notifies the signals; assigning into the existing one changes a value nothing is watching — and from v18 the state is protected, so the assignment is rejected outright.

**Order the features so each one has what it needs.** A feature can only see members declared before it, so `withState` precedes `withComputed`, which precedes the `withMethods` that reads it.

**Hold collections in `withEntities()`.** It maintains an `entityMap` and an `ids` array, giving lookup by id in constant time and the CRUD updaters; an array in state gives a scan per lookup and update logic written by hand.

**Put mutable objects in `withProps()`, not in state.** From v19 development builds freeze state recursively, so a `FormGroup` or a class instance stored there throws on its first internal write.

**Drive cancellable async through `rxMethod()`.** It ties the subscription to the store's lifetime and gives `switchMap` somewhere to live, which is what makes a superseded request stop rather than land late.

</critical_requirements>

---

**Auto-detection:** `signalStore`, `signalStoreFeature`, `withState`, `withComputed`, `withMethods`, `withHooks`, `withProps`, `withEntities`, `withFeature`, `withLinkedState`, `patchState`, `rxMethod`, `signalMethod`, `entityConfig`, `unprotected`, `@ngrx/signals`

**Applies to:**

- Composing a store out of features, and the order they go in
- State updates, computed values and entity collections
- Side effects, whether they need RxJS operators or not
- Reusable features, lifecycle hooks and call-state tracking
- Testing a store, and moving one over from actions and reducers

**Handled elsewhere:**

- Fetching over the network — the request itself belongs to a service; this skill covers holding, deriving and cancelling around it
- Values one component reads — a plain signal in the component is less machinery
- Filters, search and pagination — those belong in the route's query, where they survive a reload and can be shared

---

<philosophy>

A store is a list of features applied left to right, each one adding members to the store the next one receives. That is the whole model: no actions, no reducers, no selectors, and no registry — the store's type is the accumulated result of the features, so a member that is not there is a compile error rather than an `undefined`.

Two consequences follow. The composition is linear, so ordering is semantic rather than stylistic — a `withComputed` placed above the `withState` it reads cannot see it. And a store is an Angular service, so its lifetime is a DI question: `providedIn: "root"` for one instance, a component's `providers` for one per component, destroyed with it.

</philosophy>

---

<decision_framework>

### withState or withEntities

```
Is it a collection of items with unique ids?
├─ NO → withState
└─ YES → Are items looked up or updated individually?
    ├─ YES → withEntities — entityMap for O(1) reads, updaters for writes
    └─ NO  → withState with an array, if it is only ever read in bulk
```

### withState or withProps

```
Does the value participate in reactivity?
├─ YES → withState — signals, patchState, and the dev-mode freeze
└─ NO → withProps — services, subjects, form groups, anything that mutates itself
```

### rxMethod or signalMethod

|                                         | `rxMethod`                        | `signalMethod`   |
| --------------------------------------- | --------------------------------- | ---------------- |
| Needs RxJS                              | yes                               | no               |
| Operators — `debounceTime`, `switchMap` | yes                               | no               |
| Superseded calls cancelled              | built in                          | yours to handle  |
| Accepts                                 | `T`, `Signal<T>`, `Observable<T>` | `T`, `Signal<T>` |
| Injection context                       | required                          | not required     |

Anything that can race — a search-as-you-type, a request keyed on a changing id — wants `rxMethod` with `switchMap`. A side effect that only reacts to a signal wants `signalMethod` and no RxJS dependency.

A plain `async` method in `withMethods` is the third option, and a legitimate one for a single fetch triggered by an explicit user action, where there is nothing to cancel and no stream to react to. It buys `try`/`catch` and costs the cancellation — so the question to settle first is whether two of these can ever be in flight at once.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Store Composition

Features apply in order: state, then values derived from it, then the methods that change it, then the hooks.

```typescript
export const CounterStore = signalStore(
  { providedIn: "root" },
  withState({ count: 0 }),
  withComputed(({ count }) => ({ doubled: computed(() => count() * 2) })),
  withMethods((store) => ({
    increment: () => patchState(store, { count: store.count() + 1 }),
  })),
);
```

Full code: [examples/core.md](examples/core.md#pattern-1-basic-store-with-signalstore)

### Pattern 2: State Updates with patchState

Takes a partial object, an updater function, or several of either in one call — applied as a single notification.

```typescript
patchState(store, { isLoading: true });
patchState(store, (state) => ({ count: state.count + 1 }));
patchState(store, setAllEntities(users), { isLoading: false });
```

Full code: [examples/core.md](examples/core.md#pattern-2-store-with-patchstate-updaters)

### Pattern 3: Entity Collections with withEntities

Normalised storage plus updaters: `setAllEntities`, `addEntity`/`addEntities`, `setEntity`/`setEntities`, `updateEntity`/`updateEntities`, `removeEntity`/`removeEntities`.

```typescript
export const UserStore = signalStore(
  withEntities<User>(),
  withMethods((store) => ({
    add: (user: User) => patchState(store, addEntity(user)),
  })),
);
```

`entityConfig()` names the id field where it is not `id`, and named collections need that name passed to every updater.

Full code: [examples/entities.md](examples/entities.md)

### Pattern 4: RxJS Side Effects with rxMethod

Accepts a value, a signal or an observable; the factory pipes the stream and the subscription ends with the store.

```typescript
const search = rxMethod<string>(
  pipe(
    debounceTime(SEARCH_DEBOUNCE_MS),
    switchMap((term) => api.search(term)),
    tap((results) => patchState(store, { results })),
  ),
);
```

An error reaching the outer stream ends it for good, so the `catchError` goes inside the `switchMap`.

Full code: [examples/effects.md](examples/effects.md)

### Pattern 5: signalMethod for Signal-Only Effects (v19+)

The same reactive trigger with no RxJS and no injection context, for effects that cannot race.

```typescript
const logSelection = signalMethod<string>((id) => {
  analytics.track("selected", id);
});
```

Only the parameter signal is tracked; signals read inside the processor are not.

Full code: [examples/effects.md](examples/effects.md)

### Pattern 6: Reusable Features with signalStoreFeature

A named group of features, applied to any store that satisfies its declared shape.

```typescript
export function withLoading() {
  return signalStoreFeature(
    withState({ isLoading: false }),
    withMethods((store) => ({
      setLoading: (isLoading: boolean) => patchState(store, { isLoading }),
    })),
  );
}
```

The `type<...>()` helper declares what the host store must already provide, which is what makes the feature's own types resolve.

Full code: [examples/features.md](examples/features.md)

### Pattern 7: Lifecycle with withHooks

`onInit` runs as the store is constructed and `onDestroy` when its injector is destroyed — so a component-scoped store cleans up on the component's own timeline.

Full code: [examples/core.md](examples/core.md#pattern-3-store-with-withhooks)

### Pattern 8: Call State

One feature carrying `loading` / `loaded` / `error` for a store or a named collection, so every async surface reports the same three states. A community feature library ships one; the shape is short enough to write in-house.

Full code: [examples/features.md](examples/features.md)

### Pattern 9: Context-Aware Features with withFeature (v20+)

Where `signalStoreFeature` composes blind, `withFeature` receives the store, so a generic feature can call a method that store already has.

```typescript
// withEntityLoader here is a feature you wrote, not an NgRx export:
// it takes a fetch function and returns signalStoreFeature(...)
export const ProductStore = signalStore(
  { providedIn: "root" },
  withMethods((store) => ({ load: rxMethod<string>(/* ... */) })),
  withFeature((store) =>
    withEntityLoader((id) => firstValueFrom(store.load(id))),
  ),
);
```

`withFeature` is what makes that possible: the fetch function closes over `store.load`, which does not exist until the `withMethods` above it has been applied.

Full code: [examples/features.md](examples/features.md)

### Pattern 10: withLinkedState (v20+)

State that derives from a source signal and is still writable — a selection that follows the data by default and holds when the user picks something.

```typescript
export const FilterStore = signalStore(
  withState({ items: [] as Item[] }),
  withLinkedState(({ items }) => ({
    selectedId: () => items()[0]?.id ?? null,
  })),
);
```

`withComputed` would give the same default and refuse the write.

Full code: [examples/features.md](examples/features.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- **Assigning into state instead of calling `patchState`** — rejected by the protection from v18, and before that it changed a value no signal was watching.
- **A `FormGroup`, a class instance or anything else self-mutating held in `withState`** — the v19 development freeze is recursive, so the object throws the first time it updates itself. `withProps` is where it belongs.
- **A feature reading a member declared after it** — the composition is left to right, so the member does not exist yet and the store does not compile.
- **`catchError` outside the inner `switchMap` in an `rxMethod`** — the error reaches the outer stream, which completes, and the method silently stops working for the rest of the store's life.
- **An entity updater used against a named collection without its `collection` option** — it operates on the default collection instead, so the write lands somewhere nothing reads.
- **A `signalStoreFeature` that does not return its composed features** — it type-checks as a function and contributes nothing, so the members it was meant to add are simply absent.
- **Two stores injecting each other** — a construction cycle, which surfaces as a store whose members are undefined rather than as a clear DI error.

**Surprising behaviour:**

- `rxMethod` unsubscribes on store destroy by itself; an extra manual unsubscribe is at best redundant.
- `withHooks.onInit` runs during construction, so a store that fetches on init fetches in every test that injects it.
- `signalMethod` tracks only the signal passed as its parameter — signals read inside the processor are untracked, deliberately.
- `signalMethod` has no cancellation, so two async calls in flight resolve in whatever order they finish and the later write wins regardless of which was requested last.
- A component-scoped store is a new instance per component instance, which is the point — and the reason state does not survive navigation away and back.
- Deeply nested state makes every `patchState` rebuild the whole path; several flat slices update independently.
- Mutating an entity object in place skips `updateEntity`, so the `entityMap` reference never changes and nothing reading it re-renders.
- `entityConfig()` is what points `withEntities` at an id field that is not called `id`; without it the updaters key on `undefined`.

</red_flags>
