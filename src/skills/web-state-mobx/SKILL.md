---
name: web-state-mobx
description: MobX observable state management patterns with mobx-react-lite. Use when implementing reactive client state with observables, computed values, actions, and the observer HOC.
---

# MobX Patterns

> **Quick Guide:** MobX suits client state with many derived values, where fine-grained tracking beats manual subscription. `makeAutoObservable` builds stores, `observer` from `mobx-react-lite` makes components reactive, and `flow` or `runInAction` carries state changes across an `await`. Three facts decide most of the debugging: MobX tracks property reads inside tracked functions rather than values, code after an `await` is no longer inside its action, and every reaction returns a disposer that has to be called.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — store creation with `makeAutoObservable` and `makeObservable`, factory stores, `observer`, `useLocalObservable`
- [examples/advanced.md](examples/advanced.md) — computed values, actions, async with `flow` and `runInAction`, reactions
- [examples/architecture.md](examples/architecture.md) — root store, TypeScript annotations, performance

---

<critical_requirements>

## Before writing MobX code

**Call `makeAutoObservable(this)` in the constructor of every store class.** Without it the properties stay plain JavaScript and nothing re-renders — the store looks correct and simply never notifies.

**Reach for `makeObservable` with explicit annotations wherever inheritance is involved.** `makeAutoObservable` throws on any class that extends another, so a base class and its subclasses both annotate by hand.

**Wrap every component that reads an observable in `observer()` from `mobx-react-lite`.** That wrapper is what records the reads; an unwrapped component renders once with the initial value and then stops.

**Carry state changes across an `await` in `runInAction()`, or write the whole operation as a `flow` generator.** Code after an `await` runs in a later tick, outside the action that started it, and `enforceActions` rejects it.

**Call the disposer every reaction returns.** `autorun`, `reaction` and `when` all keep running — and keep their closure alive — until disposed.

</critical_requirements>

---

**Auto-detection:** `makeAutoObservable`, `makeObservable`, `observable`, `computed`, `action`, `flow`, `flowResult`, `runInAction`, `observer`, `mobx-react-lite`, `useLocalObservable`, `autorun`, `reaction`, `when`, `toJS`, `autoBind`

**Applies to:**

- Class, factory and local component stores built on observables
- Computed derivations, and when to prefer one over a reaction
- Making React components reactive, and keeping the re-render granular
- Async state updates, cancellation, and reaction lifetimes

**Handled elsewhere:**

- Server data — caching, invalidation and refetching belong to whatever owns the network; an observable holds a copy that nothing refreshes
- Single-value component state — a boolean toggle wants React's own state hook, not an observable
- State that should survive a paste of the URL — filters and pagination belong in the address bar

---

<philosophy>

**Anything derivable from state should be derived, automatically.** MobX tracks which observables a function read while it ran, and re-runs exactly the computations and components that depend on what changed. Nothing subscribes explicitly and nothing lists its dependencies.

Two consequences shape everything else. State is mutable, so there is no reducer, no action type and no immutable update to write. And tracking is on **property access inside a tracked function** — a component, a computed, a reaction. Read an observable anywhere else and MobX sees nothing, which is why a value dereferenced above a component, or inside a `setTimeout`, silently stops updating.

MobX pays off with a rich domain model and many derivations. With a handful of flat values and no derived state, the reactivity has little to track and lighter tools do the same job.

</philosophy>

---

<decision_framework>

### makeAutoObservable vs makeObservable

```
Does the class extend another, or get extended?
|-- YES --> makeObservable, annotating each member
|-- NO --> makeAutoObservable
```

### flow vs runInAction

```
Multiple awaits, or does the operation need cancelling?
|-- YES --> flow (generator, and the returned promise has .cancel())
|-- NO --> runInAction around the mutations after the single await
```

### Which reaction

```
Does the effect need to run immediately and on every change?
|-- YES --> autorun
|-- NO --> Should it run only when a specific value changes?
    |-- YES --> reaction (data function + effect function)
    |-- NO --> Should it run once, when a condition first holds?
        |-- YES --> when
        |-- NO --> a computed value probably fits better than a reaction
```

Reach for a computed before a reaction. A computed is a value the graph pulls; a reaction is a side effect the graph pushes, and a reaction that only assigns to another observable is a computed written the long way.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Store Creation with makeAutoObservable

Infers the annotations: properties become `observable`, getters `computed`, methods `action`, generators `flow`.

```typescript
class TodoStore {
  todos: Todo[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  get activeTodos(): Todo[] {
    return this.todos.filter((todo) => todo.status === ACTIVE_STATUS);
  }

  addTodo(title: string): void {
    this.todos.push({ id: crypto.randomUUID(), title, status: ACTIVE_STATUS });
  }
}
```

`autoBind: true` binds the methods so they survive being passed as callbacks. The second argument excludes members from observability — injected clients and connections belong there.

Full code: [examples/core.md](examples/core.md#pattern-1-store-creation-with-makeautoobservable)

### Pattern 2: Store Creation with makeObservable

The explicit form, and the only one that works with `extends`.

```typescript
class BaseEntityStore<T extends Entity> {
  entities: T[] = [];

  constructor() {
    makeObservable(this, {
      entities: observable,
      entityCount: computed,
      addEntity: action,
    });
  }
}
```

A subclass replacing a parent member annotates it `override`.

Full code: [examples/core.md](examples/core.md#pattern-2-store-creation-with-makeobservable)

### Pattern 3: Factory Function Stores

No `this` to bind and no `new` at the call site; a closure hides what the returned interface does not name.

```typescript
function createTimerStore(): TimerStore {
  return makeAutoObservable({
    secondsPassed: INITIAL_SECONDS,
    get minutesPassed(): number {
      return Math.floor(this.secondsPassed / SECONDS_PER_MINUTE);
    },
    tick(): void {
      this.secondsPassed++;
    },
  });
}
```

Full code: [examples/core.md](examples/core.md#pattern-3-factory-function-stores)

### Pattern 4: React Integration with observer

`observer` records the observables read during render and re-renders on those alone. It applies `React.memo` itself.

```typescript
const TodoList = observer(function TodoList() {
  return (
    <ul>
      {todoStore.filteredTodos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
});
```

Pass the observable object down, not a value read off it. Reading `todo.title` in the parent moves the subscription to the parent, and every row re-renders when any row changes.

Full code: [examples/core.md](examples/core.md#pattern-4-react-integration-with-observer)

### Pattern 5: useLocalObservable for Local Component State

An observable scoped to one component, worth its overhead once there are computed values to derive.

```typescript
const formState = useLocalObservable(() => ({
  currentStep: FIRST_STEP,
  get progress(): number {
    return ((this.currentStep + 1) / TOTAL_STEPS) * PERCENTAGE_MAX;
  },
  nextStep(): void {
    this.currentStep++;
  },
}));
```

Full code: [examples/core.md](examples/core.md#pattern-5-uselocalobservable-for-local-component-state)

### Pattern 6: Computed Values

Cached derivations that recalculate when a dependency changes and not otherwise. They stay pure — a side effect inside one runs at unpredictable times.

```typescript
get subtotal(): number {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
get total(): number {
  return this.subtotal + this.tax + this.shippingCost; // computeds chain
}
```

`computed.struct` compares the output structurally, for a derivation returning a fresh object each time.

Full code: [examples/advanced.md](examples/advanced.md#pattern-6-computed-values)

### Pattern 7: Actions and runInAction

Actions batch their mutations into one transaction, so reactions fire once after the outermost action returns rather than after each assignment.

Full code: [examples/advanced.md](examples/advanced.md#pattern-7-actions-and-runinaction)

### Pattern 8: Async with flow and runInAction

```typescript
// runInAction: fine for a single await
async fetchUsers(): Promise<void> {
  this.isLoading = true;            // still inside the action
  const users = await this.api.getUsers();
  runInAction(() => { this.users = users; this.isLoading = false; });
}

// flow: the generator body runs in action context throughout
*fetchUsers() {
  this.isLoading = true;
  this.users = yield this.api.getUsers();
  this.isLoading = false;
}
```

`flow` returns a cancellable promise, and `makeAutoObservable` infers generator methods as flows. `flowResult()` gives TypeScript the resolved return type; `CancellablePromise` is imported from `"mobx"`.

Full code: [examples/advanced.md](examples/advanced.md#pattern-8-async-patterns-flow-and-runinaction)

### Pattern 9: Reactions — autorun, reaction, when

Reactions are the bridge from the reactive graph to imperative side effects, and each returns a disposer.

- **`autorun`** — runs immediately, then on every change to anything it read
- **`reaction`** — a data function and an effect function; the effect runs when the data function's result changes, and not on initialisation
- **`when`** — runs once when the predicate first holds, then disposes itself; with no effect function it returns a promise

All three track synchronous reads only. An observable read inside a `setTimeout`, a `.then()` or after an `await` is invisible to them.

Full code: [examples/advanced.md](examples/advanced.md#pattern-9-reactions-autorun-reaction-when)

### Pattern 10: Root Store

One coordinator holding the domain and UI stores, each given the root so they can reach each other.

```typescript
class RootStore {
  userStore: UserStore;
  todoStore: TodoStore;

  constructor(transportLayer: TransportLayer) {
    this.userStore = new UserStore(this, transportLayer);
    this.todoStore = new TodoStore(this, transportLayer);
  }
}
```

The root reaches components through Context — as injection, since the reference never changes.

Full code: [examples/architecture.md](examples/architecture.md#pattern-10-root-store-pattern)

### Pattern 11: TypeScript Annotations

Class stores infer their own types. `makeAutoObservable<Store, "privateField">` names private members that would otherwise be unreachable to the annotation type, and factory stores return a declared interface.

Full code: [examples/architecture.md](examples/architecture.md#pattern-11-typescript-integration)

### Pattern 12: Render Granularity

Fine-grained reactivity is bounded by component structure: MobX re-renders the smallest `observer` that read the value, so many small observers beat one large one. Dereference as late as possible — pass the object, read the property in the leaf.

Full code: [examples/architecture.md](examples/architecture.md#pattern-12-performance-optimization)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- **A component reading observables without `observer`** — it renders once and never updates. The most common MobX bug, and it presents as stale data rather than as an error.
- **State assigned after an `await` without `runInAction`** — that code is outside the action, and `enforceActions` throws. Wrap it, or use `flow`.
- **`makeAutoObservable` on a class that extends another** — throws at construction.
- **A store class with no `makeAutoObservable` or `makeObservable` call** — every property stays plain, so nothing ever notifies.
- **A reaction whose disposer is never called** — `autorun`, `reaction` and `when` keep running, holding their closure and everything it captured.
- **Mutating an observable outside an action** — rejected under `enforceActions`, and unbatched everywhere else, so each assignment fires reactions separately.

**Surprising behaviour:**

- MobX tracks property **access inside tracked functions**, not values. A value read into a variable above a component, or inside a `setTimeout`, a `.then()` or after an `await`, is a plain snapshot that never updates again.
- `observer` already applies `React.memo`; wrapping an observer component in `memo` adds nothing.
- Computed values suspend when nothing observes them, so reading one outside a reaction recalculates on every access. `keepAlive` prevents that at the cost of a value that is never collected.
- `reaction` does not run on initialisation the way `autorun` does — `fireImmediately: true` where that is wanted.
- `makeAutoObservable` infers generator methods as `flow`, so wrapping them in `flow()` as well is redundant. Some transpiler outputs hide the generator, and the annotation then has to be explicit.
- `autoBind` and `action.bound` are not equivalent to arrow-function class fields: an arrow field cannot be overridden in a subclass. `flow.bound` behaves the same way for generators.
- Rest-destructuring an observable (`{ ...store }`) touches every property, so the component becomes reactive to all of them.
- Reactions accept `signal: AbortSignal`, which ties the reaction's lifetime to an `AbortController` instead of a stored disposer.
- Passing observables to a library that knows nothing about MobX needs `toJS()` — the proxies are otherwise visible to it.
- `mobx-react` carries class-component support that `mobx-react-lite` leaves out; the lite package is the one to reach for in a hooks codebase.

</red_flags>
