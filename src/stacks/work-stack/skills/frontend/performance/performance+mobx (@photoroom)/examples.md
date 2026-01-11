# Performance Examples

> Complete code examples for all performance patterns. Each example includes good/bad comparisons with explanations.

---

## Pattern 1: MobX Computed for Derived State

### Good: Computed value in store

```typescript
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

### Bad: useMemo for MobX derived state

```typescript
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

## Pattern 2: observer() for Fine-Grained Reactivity

### Good: observer enables fine-grained updates

```typescript
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

### Bad: Missing observer wrapper

```typescript
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

## Pattern 3: Lazy Route Loading

### Good: Lazy route file

```typescript
// File: create.lazy.tsx
import { createLazyFileRoute } from "@tanstack/react-router";

import { CreatePage } from "containers/CreatePage";

export const Route = createLazyFileRoute("/create")({
  component: CreatePage,
});
```

**Why good:** Route component bundled separately and loaded on-demand, reduces initial bundle size, faster initial page load, TanStack Router handles loading automatically

### Bad: Non-lazy route for large feature

```typescript
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

## Pattern 4: WebGL Resource Cleanup

### Good: WebGL cleanup in useEffect

```typescript
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

### Bad: Missing WebGL cleanup

```typescript
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

## Pattern 5: MobxQuery Disposal

### Good: MobxQuery with disposal

```typescript
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

### Bad: MobxQuery without disposal

```typescript
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

## Pattern 6: Avoiding Premature Optimization

### Good: Simple, readable code first

```typescript
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

### Bad: Premature optimization

```typescript
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

## Pattern 7: List Virtualization for Large Lists

### Good: When to consider virtualization

```typescript
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

## Pattern 8: observable.shallow for Large Collections

### Good: Shallow observation for performance

```typescript
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

### Bad: Deep observation on large collection

```typescript
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
