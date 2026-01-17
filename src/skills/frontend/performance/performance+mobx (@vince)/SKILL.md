---
name: frontend/performance+mobx (@vince)
description: MobX computed, observer, WebGL cleanup for Photoroom webapp
---

# Frontend Performance Patterns - Photoroom Webapp

> **Quick Guide:** Use MobX computed for derived state (NOT useMemo). Use `observer()` for fine-grained reactivity. Use `.lazy.tsx` suffix for route code-splitting. Always call `stage.destroy()` for WebGL cleanup. Dispose MobxQuery instances to prevent memory leaks. Avoid premature optimization - measure first.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase components, named exports, import ordering, `import type`, named constants)

**(You MUST use MobX `computed` getters for derived state - NOT `useMemo` in components)**

**(You MUST wrap ALL components reading MobX observables with `observer()` for fine-grained reactivity)**

**(You MUST call `stage.destroy()` in useEffect cleanup for WebGL resources - prevents memory leaks)**

**(You MUST dispose MobxQuery instances when stores are disposed - prevents subscription leaks)**

**(You MUST use `.lazy.tsx` suffix for route code-splitting - TanStack Router convention)**

</critical_requirements>

---

**Detailed Resources:**
- For code examples, see [examples/](examples/) folder:
  - [core.md](examples/core.md) - Essential MobX computed and observer patterns
  - [cleanup.md](examples/cleanup.md) - WebGL and MobxQuery resource cleanup
  - [routing.md](examples/routing.md) - Lazy route loading for code-splitting
  - [optimization.md](examples/optimization.md) - Virtualization, shallow observables, avoiding premature optimization
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

**Auto-detection:** performance, optimization, memory leak, lazy loading, code splitting, computed, useMemo, observer, Stage destroy, WebGL cleanup, MobxQuery dispose, virtualization

**When to use:**

- Optimizing rendering performance in React components
- Implementing route-level code splitting
- Managing WebGL resources and preventing memory leaks
- Creating computed values for derived state
- Cleaning up subscriptions and observers
- Implementing list virtualization for large datasets

**When NOT to use:**

- Simple state that doesn't need caching
- Small lists (under 100 items) - virtualization adds complexity
- One-time calculations that don't need memoization

**Key patterns covered:**

- MobX computed for cached derived state (NOT useMemo)
- `observer()` for fine-grained component reactivity
- Lazy route loading with `.lazy.tsx` suffix
- WebGL resource cleanup with `stage.destroy()`
- MobxQuery disposal pattern
- List virtualization for large lists
- Avoiding premature optimization
- `observable.shallow` for large collections

---

<philosophy>

## Philosophy

Performance optimization in the Photoroom webapp follows a **measure-first** approach. Premature optimization adds complexity without proven benefit. When optimization is needed, leverage MobX's built-in reactivity system rather than fighting it with React hooks.

**Core principles:**

1. **Measure before optimizing** - Identify actual bottlenecks with profiling
2. **Let MobX do the work** - Use computed values, not useMemo
3. **Fine-grained reactivity** - `observer()` enables minimal re-renders
4. **Clean up resources** - WebGL contexts and subscriptions leak if not disposed
5. **Code-split routes** - Lazy loading reduces initial bundle size

**When to optimize:**

- Profiling shows actual performance issues
- Large lists causing scroll jank (virtualization)
- Complex derived calculations repeated frequently (computed)
- Route bundles are too large (lazy loading)
- Memory usage grows over time (cleanup leaks)

**When NOT to optimize:**

- "It might be slow" - measure first
- Simple calculations that run once
- Small lists that render quickly
- Premature bundle size concerns

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: MobX Computed for Derived State

Use MobX `computed` getters in stores for derived state. MobX automatically caches computed values and only recalculates when dependencies change. For MobX-derived state, always use computed getters in stores rather than useMemo in components.

For detailed examples, see [examples/core.md](examples/core.md#pattern-1-mobx-computed-for-derived-state).

---

### Pattern 2: observer() for Fine-Grained Reactivity

The `observer()` wrapper enables fine-grained reactivity - components only re-render when their specific observed values change, not when any store property changes.

For detailed examples, see [examples/core.md](examples/core.md#pattern-2-observer-for-fine-grained-reactivity).

---

### Pattern 3: Lazy Route Loading

Use `.lazy.tsx` suffix for route files to enable code-splitting. TanStack Router automatically code-splits lazy routes into separate bundles.

**Lazy Route File Structure:**

```
src/routes/
  __root.tsx              # Root layout - NOT lazy (always needed)
  index.tsx               # / route - NOT lazy (entry point)
  create.lazy.tsx         # /create - LAZY loaded
  batch.lazy.tsx          # /batch - LAZY loaded
  brand-kit.lazy.tsx      # /brand-kit - LAZY loaded
  edit.$templateId.tsx    # /edit/:templateId - NOT lazy (core route)
  onboarding-quiz.lazy.tsx # /onboarding-quiz - LAZY loaded
```

For code examples, see [examples/routing.md](examples/routing.md#pattern-3-lazy-route-loading).

---

### Pattern 4: WebGL Resource Cleanup

WebGL contexts consume GPU memory. Always call `stage.destroy()` in useEffect cleanup to prevent memory leaks. Unreleased WebGL resources cause memory growth and eventual browser crashes.

For detailed examples, see [examples/cleanup.md](examples/cleanup.md#pattern-4-webgl-resource-cleanup).

---

### Pattern 5: MobxQuery Disposal

MobxQuery instances create React Query subscriptions that must be disposed when no longer needed. Failure to dispose causes memory leaks and stale subscriptions.

For detailed examples, see [examples/cleanup.md](examples/cleanup.md#pattern-5-mobxquery-disposal).

---

### Pattern 6: Avoiding Premature Optimization

Measure actual performance before optimizing. React and MobX are fast by default - optimization often adds complexity without measurable benefit.

For detailed examples, see [examples/optimization.md](examples/optimization.md#pattern-6-avoiding-premature-optimization).

---

### Pattern 7: List Virtualization for Large Lists

For lists with hundreds or thousands of items, use virtualization to render only visible items. This prevents DOM bloat and scroll jank.

For detailed examples, see [examples/optimization.md](examples/optimization.md#pattern-7-list-virtualization-for-large-lists).

---

### Pattern 8: observable.shallow for Large Collections

When storing large arrays or objects that don't need deep observation, use `observable.shallow` to prevent MobX from recursively observing all nested properties.

For detailed examples, see [examples/optimization.md](examples/optimization.md#pattern-8-observableshallow-for-large-collections).

</patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use MobX `computed` getters for derived state - NOT `useMemo` in components)**

**(You MUST wrap ALL components reading MobX observables with `observer()` for fine-grained reactivity)**

**(You MUST call `stage.destroy()` in useEffect cleanup for WebGL resources - prevents memory leaks)**

**(You MUST dispose MobxQuery instances when stores are disposed - prevents subscription leaks)**

**(You MUST use `.lazy.tsx` suffix for route code-splitting - TanStack Router convention)**

**Failure to follow these rules will cause memory leaks, stale UIs, bloated bundles, and redundant memoization.**

</critical_reminders>
