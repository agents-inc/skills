---
name: web-state-zustand
description: Zustand stores, client state patterns. Use when deciding between Zustand vs useState, managing global state, or avoiding Context misuse.
---

# Zustand Patterns

> **Quick Guide:** Zustand owns state two or more components read; `useState` owns state one component reads; the URL owns filters and search; Context injects singletons and holds no state. Zustand v5 changes three things: `useShallow` from `zustand/react/shallow` replaces the old equality-function second argument, selectors must return stable references or they loop, and `persist` no longer captures initial state at creation.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — store setup, atomic selectors, `useShallow`, the Context anti-pattern, URL state
- [reference.md](reference.md) — middleware lookup, v5 migration notes, peer-dependency requirements

---

<critical_requirements>

## Before writing Zustand code

**Move a value into a store as soon as a second component reads it.** Passing it down instead couples every component on the path, and relocating it later means unpicking that chain.

**Select one value per `useStore` call.** The component then re-renders when that value changes and at no other time; a call with no selector subscribes to the whole store.

**Return a stable reference from every selector.** An object or function built inside the selector is a new reference on each call, which in v5 re-renders without end.

**Persist preferences and nothing else, through `partialize`.** Transient UI restored from storage — a modal that reopens itself, a sidebar that remembers being closed — reads as a bug.

**Keep server data out of the store.** Cached, invalidated, refetched data wants a layer built for it; a store gives you a copy that goes stale silently.

</critical_requirements>

---

**Auto-detection:** `create` from `zustand`, `zustand/middleware`, `zustand/react/shallow`, `useShallow`, `createWithEqualityFn`, `zustand/traditional`, `persist`, `partialize`, `devtools`, store slices

**Applies to:**

- Choosing between a store, `useState`, the URL and Context for a given value
- Setting up a store with `devtools` and `persist`
- Selector shape and re-render behaviour
- Splitting state across focused stores

**Handled elsewhere:**

- Server data — caching, invalidation and refetching belong to whatever owns the network, and a store is not that thing
- Routing mechanics — this skill says which state belongs in the URL, not how a given router reads or writes it
- Form field state — a form library owns its own field values while the form is open

---

<philosophy>

Zustand is a subscription primitive with a hook attached. Its performance comes entirely from the selector: the store notifies every subscriber on every change, and the selector is what decides whether that notification becomes a render. So store design is selector design.

- **Small stores over one large one** — a store is the unit of subscription as well as the unit of code
- **Business logic in actions** — components call `toggleSidebar()`; the store decides what toggling means
- **Export hooks, not the creator** — the raw store is a mutable global, and exporting it invites writes from anywhere
- **Atomic selectors first** — a single value needs no comparison function at all

</philosophy>

---

<decision_framework>

## Where a value belongs

| The value                     | Belongs in     | Because                                                      |
| ----------------------------- | -------------- | ------------------------------------------------------------ |
| Read by 2+ components         | a store        | selective re-renders, and no prop chain to unpick later      |
| Read by 1 component           | `useState`     | nothing else can observe it, so nothing else needs to        |
| A filter, query, page or sort | the URL        | shareable, bookmarkable, and the back button works           |
| A singleton set at startup    | Context        | it never changes, so the re-render cost never arises         |
| Fetched from an API           | not this skill | it needs caching and invalidation, which a store has none of |

Context is the row people get wrong. It is a transport for a value that does not change, and using it for state that does re-renders every consumer on every change with no way to opt out.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Store Setup

`devtools` for inspection, `persist` for the fields that should outlive the tab, `partialize` to keep everything else out of storage.

```typescript
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        theme: DEFAULT_THEME,
        sidebarOpen: true,
        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      }),
      { name: UI_STORAGE_KEY, partialize: (state) => ({ theme: state.theme }) },
    ),
  ),
);
```

Full code: [examples/core.md](examples/core.md#pattern-1-store-setup)

### Pattern 2: Atomic Selectors

One value per call is the default, and the reason the store is fast.

```typescript
const toggleSidebar = useUIStore((state) => state.toggleSidebar);
const isOpen = useUIStore((state) => state.sidebarOpen);
```

Full code: [examples/core.md](examples/core.md#pattern-2-atomic-selectors)

### Pattern 3: useShallow for Multiple Values

At three or more values from one store, one `useShallow` call beats three subscriptions.

```typescript
import { useShallow } from "zustand/react/shallow";

const { sidebarOpen, theme } = useUIStore(
  useShallow((state) => ({
    sidebarOpen: state.sidebarOpen,
    theme: state.theme,
  })),
);
```

Full code: [examples/core.md](examples/core.md#pattern-3-useshallow-for-multiple-values)

### Pattern 4: Context for Injection, Not State

Context carries a value that never changes — a client, a connection, a configuration read at startup.

```typescript
const DatabaseContext = createContext<Database | null>(null);
```

Full code: [examples/core.md](examples/core.md#pattern-4-context-for-injection-not-state)

### Pattern 5: URL State for Shareable Filters

Filters, search, pagination and sort live in the URL, where they survive a reload and a paste into a colleague's chat.

```typescript
const searchParams = new URLSearchParams(window.location.search);
const category = searchParams.get("category") ?? undefined;
```

Full code: [examples/core.md](examples/core.md#pattern-5-url-state-for-shareable-filters)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A selector returning an inline object or function — new reference every call, so v5 re-renders without end. Hoist the fallback to a module constant.
- `create()` called with a second equality-function argument — removed in v5, so the argument is ignored and the comparison silently never happens. Use `useShallow`, or `createWithEqualityFn` from `zustand/traditional`.
- Reading a computed initial value back out of a persisted store immediately after creation — v5's `persist` did not store it. Set it with `setState` after creation.

**Surprising behaviour:**

- `useStore()` with no selector subscribes to the entire store, so the component re-renders on changes to fields it never reads.
- Two atomic selectors returning equal values still render separately if either changes; `useShallow` compares the object, not the individual reads.
- Context re-renders every consumer whenever the provider's value object is rebuilt, which is every render unless the value is memoised — and even memoised, a change to one field re-renders readers of all of them.
- Search params are strings. `?page=2` reads back as `"2"`, and `?open=false` is truthy until parsed.
- One large store means one large subscription surface: every component reading from it competes with every write to it.

</red_flags>
