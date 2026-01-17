---
name: frontend/state-mobx (@vince)
description: MobX stores, RootStore pattern for Photoroom webapp
---

# MobX Client State Management Patterns

> **Quick Guide:** Use MobX for reactive client state management. RootStore pattern for orchestration. Arrow function methods for `this` binding. `makeAutoObservable` by default. `runInAction` after all `await` calls. `observer()` on ALL components reading MobX state. Use your data fetching solution for server data.

**Detailed Resources:**
- For code examples, see [examples/](examples/) (core, computed, reactions, rootstore, mobx-query, configuration)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase stores, named exports, import ordering, `import type`, named constants)

**(You MUST use arrow functions for ALL public store methods - regular methods lose `this` when destructured)**

**(You MUST wrap ALL state mutations after `await` in `runInAction()` - MobX loses action context after async boundaries)**

**(You MUST wrap ALL components reading MobX observables with `observer()` - components won't re-render on changes otherwise)**

**(You MUST use `reaction()` in stores for side effects - NOT `useEffect` in components)**

**(You MUST use a data fetching solution for server/API data - NOT MobX stores)**

</critical_requirements>

---

**Auto-detection:** MobX store, makeAutoObservable, runInAction, reaction, observer, RootStore, client state, observable state

**When to use:**

- Creating new MobX stores for client state
- Modifying existing store actions and computed properties
- Setting up reactive side effects in stores
- Integrating server data with MobX via MobxQuery bridge
- Understanding RootStore dependency injection pattern

**Key patterns covered:**

- RootStore pattern with dependency injection
- Store class structure with private dependencies (`#`)
- Arrow function methods for `this` binding (CRITICAL)
- `makeAutoObservable` vs `makeObservable`
- Computed properties for derived state
- Reactions for side effects (NOT useEffect)
- `runInAction` after all `await` calls
- MobxQuery bridge for data fetching integration
- Store access via `stores` singleton

**When NOT to use:**

- Server/API data (use data fetching solution instead)
- Simple component-local state (use useState)
- URL-shareable state like filters (use URL params)

---

<philosophy>

## Philosophy

MobX follows the principle that "anything that can be derived from application state should be derived automatically." It uses observables and reactions to automatically track dependencies and update only what changed.

In the Photoroom webapp, MobX manages **client-side state** while a data fetching solution handles **server data**. This separation ensures optimal caching for API data while providing reactive updates for UI state.

**When to use MobX:**

- Complex client state with computed values (derived data)
- State shared across multiple components
- UI state that needs reactive side effects
- Integration layer between data fetching and MobX via MobxQuery

**When NOT to use MobX:**

- Server/API data (use data fetching solution - it handles caching, refetch, sync)
- Simple component-local state (use useState - simpler)
- URL-shareable state like filters (use URL params - bookmarkable)
- Form state (use controlled components or form library)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Store Class Structure

Every store follows a consistent structure with private dependencies, observable state, constructor with DI and reactions, arrow function actions, and computed getters.

See [examples/core.md](examples/core.md#pattern-1-store-class-structure) for complete store template and implementation.

---

### Pattern 2: Arrow Function Methods (CRITICAL)

Store methods MUST be arrow functions to preserve `this` binding when destructured in React components.

**When to use:** ALL public store methods that may be destructured in components.

**When not to use:** Private helper methods called only internally (though arrow functions are still fine).

See [examples/core.md](examples/core.md#pattern-2-arrow-function-methods-critical) for good/bad examples.

---

### Pattern 3: runInAction After Await

MobX requires `runInAction()` for ALL state mutations after `await` calls because the action context is lost at async boundaries.

**When to use:** Every state mutation that occurs after an `await` statement.

See [examples/core.md](examples/core.md#pattern-3-runinaction-after-await) for correct async patterns.

---

### Pattern 4: Computed Properties for Derived State

Use `get` accessors for derived state instead of manual updates. MobX automatically caches computed values and only recalculates when dependencies change.

**When to use:** Any value that can be derived from other observable state.

See [examples/computed.md](examples/computed.md#pattern-4-computed-properties-for-derived-state) for implementation examples.

---

### Pattern 5: Reactions for Side Effects

Use `reaction()` or `autorun()` in store constructors for side effects. NEVER use `useEffect` in components to react to MobX state changes.

**When to use:** Any side effect that should happen when observable state changes.

**When not to use:** Valid uses of useEffect: URL parameter handling, focus management, integration with non-MobX libraries, cleanup of external resources.

See [examples/reactions.md](examples/reactions.md#pattern-5-reactions-for-side-effects) for reaction patterns.

---

### Pattern 6: RootStore Pattern

All stores are orchestrated through a centralized `RootStore` with dependency injection. Never import stores directly.

See [examples/rootstore.md](examples/rootstore.md#pattern-6-rootstore-pattern) for RootStore structure and store access patterns.

---

### Pattern 7: Private Dependencies with # Prefix

Use ES private fields (`#`) for store dependencies to hide implementation details and make API surface clear.

See [examples/rootstore.md](examples/rootstore.md#pattern-7-private-dependencies-with--prefix) for implementation.

---

### Pattern 8: MobxQuery Bridge

Use `MobxQuery` to bridge your data fetching layer with MobX stores. This allows stores to consume server data reactively.

See [examples/mobx-query.md](examples/mobx-query.md#pattern-8-mobxquery-bridge) for MobxQuery implementation.

---

### Pattern 9: makeAutoObservable vs makeObservable

Use `makeAutoObservable` by default. Use `makeObservable` only when you need fine-grained control.

**When to use makeObservable:** Large arrays/objects where shallow observation improves performance, methods that should not be actions, legacy codebases with specific requirements.

See [examples/configuration.md](examples/configuration.md#pattern-9-makeautoobservable-vs-makeobservable) for comparison examples.

---

### Pattern 10: observer Wrapper for Components

ALL components reading MobX observables MUST be wrapped with `observer()`. Without it, components won't re-render when observables change.

**When to use:** Every React component that reads MobX observable state.

See [examples/core.md](examples/core.md#pattern-10-observer-wrapper-for-components) for implementation.

---

### Pattern 11: Store Type Interfaces

Export interfaces for stores used by other stores. This enables type-safe dependency injection and easier testing.

See [examples/rootstore.md](examples/rootstore.md#pattern-11-store-type-interfaces) for interface patterns.

</patterns>

---

<integration>

## Integration Guide

**Integrates with:**

- **Data fetching solutions**: Server data fetching and caching. MobX stores consume via MobxQuery bridge.
- **URL router**: URL state management. Use URL params for shareable filters.
- **observer (mobx-react-lite)**: Wraps components to make them reactive to observables.
- **Validation libraries**: Validate API responses before storing in MobX.

**Store Initialization Order:**

```
Auth -> Experiments -> Engine -> [Teams + UserDetails] -> Entitlements
```

Dependencies must be initialized before dependents. RootStore manages this order.

**Never use:**

- Context for state management (use MobX stores instead)
- useEffect to react to MobX state (use reaction() in stores)
- Direct store imports (use stores singleton)
- Prop drilling for stores (access via stores singleton)

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (PascalCase stores, named exports, import ordering, `import type`, named constants)

**(You MUST use arrow functions for ALL public store methods - regular methods lose `this` when destructured)**

**(You MUST wrap ALL state mutations after `await` in `runInAction()` - MobX loses action context after async boundaries)**

**(You MUST wrap ALL components reading MobX observables with `observer()` - components won't re-render on changes otherwise)**

**(You MUST use `reaction()` in stores for side effects - NOT `useEffect` in components)**

**(You MUST use a data fetching solution for server/API data - NOT MobX stores)**

**Failure to follow these rules will cause undefined `this` errors, broken reactivity, stale UIs, and duplicate reactive systems.**

</critical_reminders>
