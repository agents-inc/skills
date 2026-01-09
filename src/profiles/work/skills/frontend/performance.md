---
name: Performance
description: MobX computed, observer, WebGL cleanup for Photoroom webapp
---

# Frontend Performance Patterns - Photoroom Webapp

> **Quick Guide:** Use MobX computed for derived state (NOT useMemo). Use `observer()` for fine-grained reactivity. Use `.lazy.tsx` suffix for route code-splitting. Always call `stage.destroy()` for WebGL cleanup. Dispose MobxQuery instances to prevent memory leaks. Avoid premature optimization - measure first.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase components, named exports, import ordering, `import type`, named constants)

**(You MUST use MobX `computed` getters for derived state - NOT `useMemo` in components)**

**(You MUST wrap ALL components reading MobX observables with `observer()` for fine-grained reactivity)**

**(You MUST call `stage.destroy()` in useEffect cleanup for WebGL resources - prevents memory leaks)**

**(You MUST dispose MobxQuery instances when stores are disposed - prevents subscription leaks)**

**(You MUST use `.lazy.tsx` suffix for route code-splitting - TanStack Router convention)**

</critical_requirements>

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

#### Computed Implementation

```typescript
// ✅ Good Example - Computed value in store
import { makeAutoObservable } from "mobx";

export class ItemsStore {
  items: Item[] = [];
  filterText = "";

  constructor() {
    makeAutoObservable(this);
  }

  // Computed - automatically cached, recalculates only when items or filterText changes
  get filteredItems() {
    return this.items.filter(item =>
      item.name.toLowerCase().includes(this.filterText.toLowerCase())
    );
  }

  get activeItems() {
    return this.items.filter(item => item.isActive);
  }

  // Computed can depend on other computed
  get activeFilteredItems() {
    return this.activeItems.filter(item =>
      item.name.toLowerCase().includes(this.filterText.toLowerCase())
    );
  }
}
```

**Why good:** MobX tracks dependencies automatically, computed values are cached until dependencies change, no dependency array to maintain, chain of computed values works correctly

```typescript
// ❌ Bad Example - useMemo for MobX derived state
import { useMemo } from "react";
import { observer } from "mobx-react-lite";

import { stores } from "stores";

export const ItemList = observer(() => {
  const { itemsStore } = stores;

  // BAD: Redundant memoization - MobX already caches computed values
  const filteredItems = useMemo(() => {
    return itemsStore.items.filter(item =>
      item.name.toLowerCase().includes(itemsStore.filterText.toLowerCase())
    );
  }, [itemsStore.items, itemsStore.filterText]);

  return <ul>{filteredItems.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
});
```

**Why bad:** Creates redundant memoization layer, dependency array can get out of sync with actual dependencies, logic belongs in store not component, harder to test than store computed

**When to use:** Any value derived from observable state that may be accessed multiple times.

---

### Pattern 2: observer() for Fine-Grained Reactivity

The `observer()` wrapper enables fine-grained reactivity - components only re-render when their specific observed values change, not when any store property changes.

#### Fine-Grained Updates

```typescript
// ✅ Good Example - observer enables fine-grained updates
import { observer } from "mobx-react-lite";

import { stores } from "stores";

// Only re-renders when authStore.displayName changes
export const UserGreeting = observer(() => {
  const { authStore } = stores;

  return <span>Hello, {authStore.displayName}</span>;
});

UserGreeting.displayName = "UserGreeting";

// Only re-renders when entitlementsStore.remainingCredits changes
export const CreditsDisplay = observer(() => {
  const { entitlementsStore } = stores;

  return <span>{entitlementsStore.remainingCredits} credits</span>;
});

CreditsDisplay.displayName = "CreditsDisplay";
```

**Why good:** Each component only re-renders when its specific dependencies change, MobX tracks exactly which properties are read during render, enables minimal re-renders without manual optimization

```typescript
// ❌ Bad Example - Missing observer wrapper
import { stores } from "stores";

export const UserGreeting = () => {
  const { authStore } = stores;

  // BUG: Component NEVER re-renders when displayName changes!
  return <span>Hello, {authStore.displayName}</span>;
};
```

**Why bad:** Without `observer()`, React has no way to know MobX observables changed, component shows stale data indefinitely, common source of "my UI doesn't update" bugs

**When to use:** Every React component that reads MobX observable state.

---

### Pattern 3: Lazy Route Loading

Use `.lazy.tsx` suffix for route files to enable code-splitting. TanStack Router automatically code-splits lazy routes into separate bundles.

#### Lazy Route File Structure

```
src/routes/
├── __root.tsx              # Root layout - NOT lazy (always needed)
├── index.tsx               # / route - NOT lazy (entry point)
├── create.lazy.tsx         # /create - LAZY loaded
├── batch.lazy.tsx          # /batch - LAZY loaded
├── brand-kit.lazy.tsx      # /brand-kit - LAZY loaded
├── edit.$templateId.tsx    # /edit/:templateId - NOT lazy (core route)
└── onboarding-quiz.lazy.tsx # /onboarding-quiz - LAZY loaded
```

#### Lazy Route Definition

```typescript
// ✅ Good Example - Lazy route file: create.lazy.tsx
import { createLazyFileRoute } from "@tanstack/react-router";

import { CreatePage } from "containers/CreatePage";

export const Route = createLazyFileRoute("/create")({
  component: CreatePage,
});
```

**Why good:** Route component bundled separately and loaded on-demand, reduces initial bundle size, faster initial page load, TanStack Router handles loading automatically

```typescript
// ❌ Bad Example - Non-lazy route for large feature
// File: create.tsx (missing .lazy suffix)
import { createFileRoute } from "@tanstack/react-router";

import { CreatePage } from "containers/CreatePage";

export const Route = createFileRoute("/create")({
  component: CreatePage,
});
```

**Why bad:** Entire CreatePage and all its imports included in initial bundle, slower initial page load, wasted bandwidth if user never visits route

**When to use:** Secondary routes that are not part of the critical user path.

**When not to use:** Root layout, primary entry routes, routes with data requirements in loader.

---

### Pattern 4: WebGL Resource Cleanup

WebGL contexts consume GPU memory. Always call `stage.destroy()` in useEffect cleanup to prevent memory leaks. Unreleased WebGL resources cause memory growth and eventual browser crashes.

#### Stage Cleanup Pattern

```typescript
// ✅ Good Example - WebGL cleanup in useEffect
import { useEffect, useRef } from "react";

import { Stage } from "lib/editor/rendering/Stage";

export const EditorCanvas = observer(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = new Stage({ canvas });

    // Setup stage...

    return () => {
      stage.destroy(); // Free WebGL resources
    };
  }, []);

  return <canvas ref={canvasRef} />;
});

EditorCanvas.displayName = "EditorCanvas";
```

**Why good:** `stage.destroy()` frees WebGL resources on unmount, prevents GPU memory leaks, cleanup function runs when component unmounts or deps change

```typescript
// ❌ Bad Example - Missing WebGL cleanup
import { useEffect, useRef } from "react";

import { Stage } from "lib/editor/rendering/Stage";

export const EditorCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = new Stage({ canvas });
    // Missing cleanup - memory leak!
  }, []);

  return <canvas ref={canvasRef} />;
};
```

**Why bad:** WebGL context never freed, GPU memory accumulates on each mount/unmount cycle, eventually causes browser to crash or become unresponsive

**When to use:** Any component that creates Stage or other WebGL resources.

---

### Pattern 5: MobxQuery Disposal

MobxQuery instances create React Query subscriptions that must be disposed when no longer needed. Failure to dispose causes memory leaks and stale subscriptions.

#### MobxQuery Disposal Pattern

```typescript
// ✅ Good Example - MobxQuery with disposal
import { makeAutoObservable, runInAction } from "mobx";

import { MobxQuery } from "./utils/mobx-query";
import { teamsQueryIdentifier } from "lib/query-keys";

export class TeamsStore {
  #dependencies: TeamsStoreDependencies;

  allTeams: Team[] = [];
  teamsAreLoading = false;

  // MobxQuery instance
  #teamsQuery: MobxQuery;

  constructor(dependencies: TeamsStoreDependencies) {
    this.#dependencies = dependencies;
    makeAutoObservable(this);

    this.#teamsQuery = new MobxQuery(
      {
        queryKey: [teamsQueryIdentifier],
        queryFn: this.#dependencies.fetchTeams,
      },
      ({ isLoading, data }) => {
        runInAction(() => {
          this.teamsAreLoading = isLoading;
          if (data) {
            this.allTeams = data;
          }
        });
      }
    );
  }

  startQuery = () => {
    this.#teamsQuery.query();
  };

  // MUST call dispose when store is disposed
  dispose = () => {
    this.#teamsQuery.dispose();
  };
}
```

**Why good:** `dispose()` method cleans up React Query subscription, prevents memory leaks and stale callbacks, callback uses `runInAction` for MobX state mutations

```typescript
// ❌ Bad Example - MobxQuery without disposal
export class TeamsStore {
  #teamsQuery = new MobxQuery({
    queryKey: [teamsQueryIdentifier],
    queryFn: fetchTeams,
  });

  // Missing dispose method - subscription leaks!
}
```

**Why bad:** Query subscription never cleaned up, callbacks continue firing after store should be disposed, memory leak and potential errors from stale references

**When to use:** Every store that creates MobxQuery instances.

---

### Pattern 6: Avoiding Premature Optimization

Measure actual performance before optimizing. React and MobX are fast by default - optimization often adds complexity without measurable benefit.

#### Measure First Approach

```typescript
// ✅ Good Example - Simple, readable code first
import { observer } from "mobx-react-lite";

import { stores } from "stores";

export const ItemList = observer(() => {
  const { itemsStore } = stores;

  // Simple filter - fine for most lists
  const items = itemsStore.items.filter(item => item.isActive);

  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});

ItemList.displayName = "ItemList";
```

**Why good:** Simple, readable code that's easy to maintain, MobX already provides efficient reactivity, optimize only when profiling shows a bottleneck

```typescript
// ❌ Bad Example - Premature optimization
import { useMemo, useCallback, memo } from "react";
import { observer } from "mobx-react-lite";

import { stores } from "stores";

// BAD: Over-optimized without evidence of need
const MemoizedItem = memo(({ item, onClick }: ItemProps) => (
  <li onClick={onClick}>{item.name}</li>
));

export const ItemList = observer(() => {
  const { itemsStore } = stores;

  // BAD: useMemo when observer already handles reactivity
  const items = useMemo(
    () => itemsStore.items.filter(item => item.isActive),
    [itemsStore.items]
  );

  // BAD: useCallback for simple handler
  const handleClick = useCallback((id: string) => {
    itemsStore.selectItem(id);
  }, []);

  return (
    <ul>
      {items.map(item => (
        <MemoizedItem key={item.id} item={item} onClick={() => handleClick(item.id)} />
      ))}
    </ul>
  );
});
```

**Why bad:** `memo`, `useMemo`, `useCallback` add complexity without proven benefit, MobX `observer` already handles efficient re-renders, inline arrow function in `onClick` defeats `memo` anyway

**When to use:** After profiling shows actual performance issues.

---

### Pattern 7: List Virtualization for Large Lists

For lists with hundreds or thousands of items, use virtualization to render only visible items. This prevents DOM bloat and scroll jank.

#### Virtualization Decision

```typescript
// ✅ Good Example - When to consider virtualization
// If list has < 100 items: Simple map is fine
// If list has 100-500 items: Monitor performance, virtualize if jank
// If list has > 500 items: Use virtualization

import { observer } from "mobx-react-lite";

import { stores } from "stores";

const ITEM_COUNT_THRESHOLD = 100;

export const ItemList = observer(() => {
  const { itemsStore } = stores;
  const items = itemsStore.filteredItems;

  // Simple list for small counts
  if (items.length < ITEM_COUNT_THRESHOLD) {
    return (
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    );
  }

  // For large lists, use a virtualization library
  // Example with @tanstack/react-virtual or react-window
  return <VirtualizedItemList items={items} />;
});

ItemList.displayName = "ItemList";
```

**Why good:** Simple approach for small lists, virtualization only when needed, threshold constant makes decision clear

**When to use:** Lists with more than ~100 items that show performance issues.

**When not to use:** Small lists, lists with complex item interactions that don't virtualize well.

---

### Pattern 8: observable.shallow for Large Collections

When storing large arrays or objects that don't need deep observation, use `observable.shallow` to prevent MobX from recursively observing all nested properties.

#### Shallow Observable Pattern

```typescript
// ✅ Good Example - Shallow observation for performance
import { makeObservable, observable, action, computed } from "mobx";

export class LargeDataStore {
  // Shallow - only observes array reference, not item properties
  items: LargeItem[] = [];

  selectedId: string | null = null;

  constructor() {
    makeObservable(this, {
      items: observable.shallow, // Performance: don't deep-observe items
      selectedId: observable,
      setItems: action,
      selectedItem: computed,
    });
  }

  setItems = (items: LargeItem[]) => {
    this.items = items;
  };

  get selectedItem() {
    return this.items.find(item => item.id === this.selectedId);
  }
}
```

**Why good:** `observable.shallow` only tracks array reference changes, not item property changes, significantly reduces MobX overhead for large collections, still triggers re-render when array is replaced

```typescript
// ❌ Bad Example - Deep observation on large collection
import { makeAutoObservable } from "mobx";

export class LargeDataStore {
  // BAD: makeAutoObservable deeply observes all 10,000 items
  items: LargeItem[] = [];

  constructor() {
    makeAutoObservable(this); // Every item property becomes observable
  }
}
```

**Why bad:** MobX creates proxies for every item and nested property, significant memory and CPU overhead for large collections, most items' properties never actually need reactivity

**When to use:** Collections with 100+ items where you only need to track array changes, not item property changes.

</patterns>

---

<anti_patterns>

## Anti-Patterns

### ❌ useMemo for MobX-Derived State

Using `useMemo` to memoize values derived from MobX observables creates redundant caching. MobX computed getters already provide automatic caching with dependency tracking.

```typescript
// ❌ Anti-pattern
const filtered = useMemo(
  () => store.items.filter(i => i.active),
  [store.items]
);

// ✅ Correct approach - computed in store
get filteredItems() {
  return this.items.filter(i => i.active);
}
```

**Why it's harmful:** Duplicates MobX's caching, dependency array can drift from actual dependencies, makes testing harder.

---

### ❌ React.memo on observer() Components

Wrapping `observer()` components with `React.memo()` provides no benefit - `observer()` already prevents unnecessary re-renders by tracking observable access.

```typescript
// ❌ Anti-pattern
const MyComponent = memo(observer(() => {
  return <div>{store.value}</div>;
}));

// ✅ Correct approach - observer alone is sufficient
const MyComponent = observer(() => {
  return <div>{store.value}</div>;
});
```

**Why it's harmful:** Adds unnecessary wrapper, false sense of optimization, `observer()` already handles re-render prevention.

---

### ❌ Missing Resource Cleanup

Creating WebGL contexts (Stage) or MobxQuery instances without cleanup functions causes memory leaks that accumulate over time.

```typescript
// ❌ Anti-pattern
useEffect(() => {
  const stage = new Stage({ canvas });
  // No cleanup!
}, []);

// ✅ Correct approach - always clean up
useEffect(() => {
  const stage = new Stage({ canvas });
  return () => stage.destroy();
}, []);
```

**Why it's harmful:** GPU memory grows until browser crashes, subscriptions fire on disposed stores causing errors.

---

### ❌ Optimizing Before Measuring

Adding `memo`, `useMemo`, or `useCallback` without first profiling to identify actual bottlenecks adds complexity without proven benefit.

```typescript
// ❌ Anti-pattern - premature optimization
const MemoizedRow = memo(({ item }) => <Row item={item} />);
const handleClick = useCallback(() => doThing(), []);
const filtered = useMemo(() => items.filter(x => x), [items]);

// ✅ Correct approach - simple first, optimize if needed
const Row = ({ item }) => <Row item={item} />;
const handleClick = () => doThing();
const filtered = items.filter(x => x);
```

**Why it's harmful:** Adds cognitive overhead, makes code harder to read, often provides no measurable benefit.

---

### ❌ Deep Observation on Large Collections

Using `makeAutoObservable` on stores with large arrays causes MobX to create proxies for every nested property, even when only array-level changes matter.

```typescript
// ❌ Anti-pattern
class Store {
  items: Item[] = []; // 10,000 items
  constructor() {
    makeAutoObservable(this); // Deeply observes all items
  }
}

// ✅ Correct approach - shallow observation
class Store {
  items: Item[] = [];
  constructor() {
    makeObservable(this, {
      items: observable.shallow, // Only tracks array reference
    });
  }
}
```

**Why it's harmful:** Significant memory overhead, slower store initialization, unnecessary reactivity tracking.

---

### ❌ Missing observer() Wrapper

Components that read MobX observables without the `observer()` wrapper will never re-render when those observables change, showing stale data.

```typescript
// ❌ Anti-pattern
const UserName = () => {
  return <span>{store.userName}</span>; // Never updates!
};

// ✅ Correct approach
const UserName = observer(() => {
  return <span>{store.userName}</span>;
});
```

**Why it's harmful:** UI shows stale data, common source of "my component doesn't update" bugs.

</anti_patterns>

---

<decision_framework>

## Decision Framework

### Derived State: computed vs useMemo

```
Is the value derived from MobX observable state?
├─ YES → Use computed getter in store ✓
│   └─ MobX automatically caches and tracks dependencies
└─ NO → Is it derived from React props/state?
    ├─ YES → Is the calculation expensive (>1ms)?
    │   ├─ YES → Consider useMemo
    │   └─ NO → Calculate inline (no memoization needed)
    └─ NO → Calculate inline
```

### Route Lazy Loading

```
Is this a secondary route (not primary user path)?
├─ YES → Use .lazy.tsx suffix ✓
└─ NO → Is the route bundle very large (>100KB)?
    ├─ YES → Consider splitting, use .lazy.tsx
    └─ NO → Non-lazy route is fine
```

### Optimization Decision

```
Is there a measured performance problem?
├─ YES → Profile to identify bottleneck
│   ├─ Rendering too slow → Check observer(), computed
│   ├─ List scroll jank → Consider virtualization
│   ├─ Memory growing → Check cleanup (Stage, MobxQuery)
│   └─ Bundle too large → Add lazy loading
└─ NO → Keep code simple (premature optimization harms maintainability)
```

### Shallow vs Deep Observable

```
Is this a large collection (100+ items)?
├─ YES → Do you need to observe individual item property changes?
│   ├─ YES → Use default observable (deep)
│   └─ NO → Use observable.shallow ✓
└─ NO → Use default observable (makeAutoObservable)
```

### Quick Reference Table

| Scenario | Solution | Why |
|----------|----------|-----|
| Derived MobX state | `computed` getter in store | Automatic caching and dependency tracking |
| Component reactivity | `observer()` wrapper | Fine-grained re-renders |
| Secondary routes | `.lazy.tsx` suffix | Code-split bundle |
| WebGL resources | `stage.destroy()` in cleanup | Prevent GPU memory leaks |
| MobxQuery instances | `dispose()` method | Prevent subscription leaks |
| Large lists | Virtualization | Prevent DOM bloat |
| Large collections | `observable.shallow` | Reduce MobX overhead |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `useMemo` for MobX-derived state - redundant, use computed in store instead
- Missing `observer()` wrapper - component won't re-render on MobX changes
- Missing `stage.destroy()` in cleanup - WebGL memory leak
- Missing MobxQuery disposal - subscription memory leak
- Premature optimization with `memo`/`useMemo`/`useCallback` - adds complexity without proof of need

**Medium Priority Issues:**

- Non-lazy routes for large secondary features (bloats initial bundle)
- Deep observation on large collections (use `observable.shallow`)
- Manual dependency tracking when MobX computed would handle it
- Missing displayName on observer components (DevTools debugging)

**Common Mistakes:**

- Adding React.memo to observer components (observer already optimizes)
- Using useCallback for handlers passed to observer children (observer handles it)
- Virtualizing small lists (<100 items) when simple map works fine
- Optimizing without profiling first

**Gotchas & Edge Cases:**

- `observable.shallow` only tracks reference changes, not item mutations
- Lazy routes can't have synchronous loaders (use non-lazy for data loading)
- Stage.destroy() must be called even if component errors during render
- MobxQuery dispose should be called even if query was never started
- Computed values are lazily evaluated - only calculated when accessed

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use MobX `computed` getters for derived state - NOT `useMemo` in components)**

**(You MUST wrap ALL components reading MobX observables with `observer()` for fine-grained reactivity)**

**(You MUST call `stage.destroy()` in useEffect cleanup for WebGL resources - prevents memory leaks)**

**(You MUST dispose MobxQuery instances when stores are disposed - prevents subscription leaks)**

**(You MUST use `.lazy.tsx` suffix for route code-splitting - TanStack Router convention)**

**Failure to follow these rules will cause memory leaks, stale UIs, bloated bundles, and redundant memoization.**

</critical_reminders>
