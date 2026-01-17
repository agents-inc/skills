# Performance Examples - Core MobX Patterns

> Essential MobX patterns for performance: computed values for derived state and observer wrapper for fine-grained reactivity. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**For additional patterns**: See topic-specific files in this folder:
- [cleanup.md](cleanup.md) - WebGL and MobxQuery resource cleanup
- [routing.md](routing.md) - Lazy route loading for code-splitting
- [optimization.md](optimization.md) - Virtualization, shallow observables, avoiding premature optimization

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
