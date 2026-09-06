# SolidJS Reference

> Decision trees, the anti-pattern routing table, the import cheat sheet and review checklists. See [SKILL.md](SKILL.md) for the patterns and red flags, and [examples/](examples/) for full code.

---

## Decision trees

### Signal, store or context

```
What is being held?
├─ A primitive (string, number, boolean) → createSignal
├─ An object or array updated in place → createStore
├─ State several distant components read → context over a store
└─ Data from the server → createResource, or createAsync under SolidStart
```

### Memo or effect

```
Deriving a value?
├─ YES → createMemo (cached, recomputed only when a dependency changes)
└─ NO  → Acting on the outside world — DOM, network, storage, logging?
    ├─ YES → createEffect, with onCleanup for anything it opens
    └─ NO  → Neither; a plain expression in JSX is already reactive
```

### For or Index

```
What changes in the list?
├─ Items added, removed or reordered → <For> (keys by reference, rows survive a move)
└─ Length fixed, values change in place → <Index> (keys by position, item is a signal)
```

### Show or Switch/Match

```
How many branches?
├─ One condition, optionally with a fallback → <Show>
└─ Several exclusive conditions, or nested ones → <Switch>/<Match>
```

### createResource or createAsync

```
Is the router present?
├─ SolidStart with @solidjs/router → createAsync + query
└─ Plain SolidJS → createResource
```

The `cache` API was replaced by `query` in Solid Router v0.15.0.

### What needs onCleanup

An effect that adds an event listener, starts a timer, opens a subscription or creates an `AbortController` registers the matching teardown in the same effect. An effect that only reads and computes needs none.

---

## Anti-pattern routing table

Each row names where the corrected good/bad pair lives.

| Anti-pattern                    | What goes wrong                                  | Where the fix is                                                                   |
| ------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Destructuring props**         | Values captured once, never update               | `props.name` or `splitProps()` ([components.md](examples/components.md))           |
| **Ternary or `.map()`**         | Subtree rebuilt instead of a node updated        | `<Show>`, `<For>`, `<Switch>` ([components.md](examples/components.md))            |
| **Missing signal parentheses**  | Renders the function, tracks nothing             | `count()` ([core.md](examples/core.md))                                            |
| **Missing `onCleanup`**         | One leaked listener or timer per effect run      | `onCleanup(() => …)` inside the effect ([core.md](examples/core.md))               |
| **Side effect in `createMemo`** | Runs on an unpredictable schedule                | `createEffect` for the effect ([core.md](examples/core.md))                        |
| **Signals read after `await`**  | Tracking scope ended at the `await`              | Read dependencies first, or use a resource ([resources.md](examples/resources.md)) |
| **`createEffect` for fetching** | No cancellation, no `<Suspense>`, races on input | `createResource` or `createAsync` ([resources.md](examples/resources.md))          |
| **Direct store mutation**       | Assignment bypasses the proxy                    | `setStore` path syntax, or `produce` ([stores.md](examples/stores.md))             |

---

## Import cheat sheet

```typescript
import {
  createSignal,
  createEffect,
  createMemo,
  createResource,
  createContext,
  useContext,
  createUniqueId,
  batch,
  untrack,
  on,
  onMount,
  onCleanup,
  Show,
  For,
  Index,
  Switch,
  Match,
  Suspense,
  ErrorBoundary,
  lazy,
} from "solid-js";

import { Portal, Dynamic } from "solid-js/web";
import { createStore, produce, reconcile, unwrap } from "solid-js/store";

import type {
  Component,
  ParentComponent,
  VoidComponent,
  FlowComponent,
  JSX,
} from "solid-js";
```

---

## When to reach for a performance primitive

| Situation                         | Primitive       |
| --------------------------------- | --------------- |
| An expensive derivation           | `createMemo`    |
| Several setters in one handler    | `batch()`       |
| A route or panel loaded on demand | `lazy()`        |
| A read that must not subscribe    | `untrack()`     |
| A non-urgent update               | `useTransition` |

---

## Review checklists

### Reactivity

- [ ] Every signal read is a call — `count()`
- [ ] Updates that depend on the previous value use the function form — `setCount((c) => c + 1)`
- [ ] Derived values are memos, not effects
- [ ] `on()` used where an effect must ignore some of what it reads
- [ ] Every listener, timer, subscription and controller has an `onCleanup`

### Components

- [ ] Props reached through `props.x`, or split with `splitProps`
- [ ] Defaults applied with `mergeProps`
- [ ] Component type matches the children contract — `VoidComponent`, `ParentComponent`, `Component`
- [ ] Refs passed as plain props

### Control flow and data

- [ ] `<For>` for reorderable lists, `<Index>` for fixed positions
- [ ] `<Switch>`/`<Match>` rather than nested `<Show>`
- [ ] Async reads sit under `<Suspense>`, with `<ErrorBoundary>` above it
- [ ] Store updates go through `setStore` paths, `produce` or `reconcile`
