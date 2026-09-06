---
name: web-framework-solidjs
description: SolidJS fine-grained reactivity — signals, effects, memos, stores, resources, control-flow components. Load when writing Solid components or reactive state.
---

# SolidJS Patterns

> **Quick Guide:** A signal is read by calling it — `count()`, never `count` — and a component body runs once, so everything that must change over time is an expression inside JSX rather than a re-render. Props are a live proxy: destructuring them freezes their values. Conditionals and lists go through `<Show>`, `<For>`, `<Index>` and `<Switch>` so Solid can update the DOM node rather than the subtree.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — signals, effects, `on()`, memos, `batch`
- [examples/components.md](examples/components.md) — `splitProps`, `mergeProps`, control flow, refs, component types, `<Dynamic>`
- [examples/stores.md](examples/stores.md) — `createStore`, `produce`, `reconcile`, context
- [examples/resources.md](examples/resources.md) — `createResource`, and `createAsync` + `query` under SolidStart
- [reference.md](reference.md) — decision trees, the anti-pattern routing table, import cheat sheet, review checklists

---

## Which path applies

- **Plain SolidJS** — async data goes through `createResource`, read under `<Suspense>`. Follow [examples/resources.md](examples/resources.md) from the top.
- **SolidStart with `@solidjs/router`** — `createAsync` + `query` replace `createResource`, because they deduplicate and serialise across the server boundary. Same file, second half. Everything else on this page is unchanged.

---

<critical_requirements>

## Before writing SolidJS code

**Call a signal to read it — `count()`.** The call is what subscribes the surrounding computation; the bare reference is just a function object, and nothing warns.

**Reach into props rather than destructuring them — `props.name`, or `splitProps()` when you need a subset.** Props are a getter proxy, so a destructured value is a snapshot taken once at creation.

**Express conditionals and lists with `<Show>`, `<For>`, `<Index>` and `<Switch>`.** These update the affected node; a ternary or `.map()` rebuilds the subtree because the component body will not run again to fix it.

**Register an `onCleanup()` beside anything an effect opens.** It runs before the next execution as well as on disposal, so one call covers both re-runs and unmount.

**Fetch through `createResource` (or `createAsync` under SolidStart) and read it under `<Suspense>`.** Both carry loading and error state and cancel superseded requests.

</critical_requirements>

---

**Auto-detection:** SolidJS, solid-js, createSignal, createEffect, createMemo, createStore, createResource, createAsync, splitProps, mergeProps, onCleanup, onMount, untrack, batch, produce, reconcile, Show, For, Index, Switch, Match, Dynamic, @solidjs/router, SolidStart

**Applies to:**

- Signals, memos and effects, and which of the three a value belongs in
- Component props, refs, component types and polymorphic elements
- Control-flow components and list keying
- Stores for nested state, and context built on top of one
- Async data with `createResource`, `createAsync` and `query`

**Handled elsewhere:**

- Styling — components bind a `class` attribute and settle nothing about what fills it
- Client state libraries beyond signals and stores, and server-state caching layers
- Routing itself — this skill covers only the data primitives a route loads with
- Test doubles for the network

---

<philosophy>

## Philosophy

Solid tracks dependencies at the expression level. A component function runs once, at creation; what re-runs afterwards is each reactive expression that read a changed signal, and what updates is the single DOM node that expression produced. There is no virtual DOM and no diff.

Two consequences drive every pattern here. First, reading is subscribing: `count()` inside a computation registers a dependency, and the same read in an event handler does not, because handlers are outside any tracking scope. Second, anything captured as a plain value has left the graph — a destructured prop, a variable assigned from `store.field`, a value read before an `await` — so reactivity is lost silently rather than loudly.

Three habits carried in from re-rendering frameworks have no counterpart here, and none of them needs a replacement. `createEffect` and `createMemo` take no dependency array — both discover what they read as they run it. There is nothing to memoise at the component level, because a component is never re-invoked and so there is no re-render to skip. And there is no rule about _where_ a primitive may be called — `createSignal` inside a branch or a loop is legal, since the primitives run at creation rather than on every render. What takes that rule's place is ownership: a primitive is disposed by the reactive owner it was created under, so one created outside any owner is never cleaned up.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Signals

`createSignal` returns a getter and a setter. The getter is called to read; the setter takes a value or a function of the previous one.

```typescript
import { createSignal } from "solid-js";

const [count, setCount] = createSignal(0);
const [user, setUser] = createSignal<User | null>(null);

count(); // read — and subscribe, inside a tracking scope
setCount(5);
setCount((prev) => prev + 1);
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Effects

An effect re-runs when any signal it read changes; there is no dependency array. `onCleanup` inside it runs before each re-run and on disposal.

```typescript
createEffect(() => {
  const handler = () => report(count());
  window.addEventListener("click", handler);
  onCleanup(() => window.removeEventListener("click", handler));
});
```

`on()` narrows that to named dependencies and gives you the previous value, so reads inside the callback no longer subscribe.

```typescript
createEffect(on(count, (value, prev) => report(prev, value)));
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Memos

`createMemo` caches a derived value and recomputes it only when a dependency changes. Memos chain, so a filter feeding a sort recomputes only the stage that was invalidated.

```typescript
const filtered = createMemo(() =>
  items().filter((item) => item.name.includes(filter())),
);
const sorted = createMemo(() =>
  [...filtered()].sort((a, b) => a.name.localeCompare(b.name)),
);
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Props

`mergeProps` applies defaults and `splitProps` separates your own props from the ones destined for a DOM element — both preserving the getters that destructuring would flatten.

```typescript
const Button: Component<ButtonProps> = (rawProps) => {
  const props = mergeProps({ variant: "primary" as const }, rawProps);
  const [local, buttonProps] = splitProps(props, ["variant", "loading"]);

  return <button {...buttonProps} data-variant={local.variant} disabled={local.loading} />;
};
```

Type the component by what it does with children: `VoidComponent` refuses them, `ParentComponent` requires them, `Component` leaves them optional.

Full code: [examples/components.md](examples/components.md)

---

### Pattern 5: Control flow

```typescript
<Show when={user()} fallback={<LoginForm />}>
  {(user) => <Dashboard user={user()} />}
</Show>

<For each={items()} fallback={<p>No items</p>}>
  {(item, index) => <li>{index()}: {item.name}</li>}
</For>

<Switch fallback={<p>Unknown</p>}>
  <Match when={status() === "loading"}><Spinner /></Match>
  <Match when={status() === "error"}><ErrorMessage error={error()} /></Match>
</Switch>
```

The callback form of `<Show>` narrows the value to non-null. `<For>` keys by item reference, so rows survive reordering; `<Index>` keys by position and hands each item as a signal, which suits a fixed-length list whose values change.

Full code: [examples/components.md](examples/components.md)

---

### Pattern 6: Refs

A ref is an ordinary prop — assignment or a callback, and no wrapper component in either direction.

```typescript
let inputRef: HTMLInputElement;

onMount(() => inputRef.focus());

<input ref={inputRef!} />
<input ref={(el) => observe(el)} />
```

Full code: [examples/components.md](examples/components.md)

---

### Pattern 7: Context over a store

A context value built from a store needs getters on its fields; a plain property read would copy the value out of the graph at creation.

```typescript
const AuthContext = createContext<AuthContextValue>();

const AuthProvider: ParentComponent = (props) => {
  const [store, setStore] = createStore<{ user: User | null }>({ user: null });
  const signIn = (user: User) => setStore("user", user);
  const value = { get user() { return store.user; }, signIn };
  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
};

function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

Full code: [examples/stores.md](examples/stores.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A signal read without its parentheses — `{count}` renders the function's source and tracks nothing
- Destructured props — the value is captured once and never updates again
- A store mutated in place, `store.field = x` — the assignment goes around the proxy, so nothing is notified; use `setStore` path syntax or `produce`
- An effect that opens a listener, timer or subscription without `onCleanup` — it leaks one per re-run, not just one per component
- Signals read after an `await` inside an effect — the tracking scope ended at the `await`, so those reads register no dependency; read them first
- `createEffect` used to fetch — no cancellation, no `<Suspense>`, and a race whenever the input changes faster than the response returns

**Surprising behaviour:**

- A component body runs once, so a `console.log` there fires at creation and never again
- `<Index>` hands each item as a signal (`item()`) while `<For>` hands the value directly — swapping one for the other compiles and renders nothing useful
- `props.children` is a getter; iterating it more than once needs the `children()` helper
- Signal reads inside an event handler are untracked, because a handler is outside any reactive scope
- A store tracks property access, not the store object, so passing `store` somewhere and reading it there subscribes to nothing
- A side effect inside `createMemo` runs on an unpredictable schedule — a memo is meant to be pure

</red_flags>
