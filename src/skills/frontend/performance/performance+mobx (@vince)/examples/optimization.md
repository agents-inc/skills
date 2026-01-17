# Performance Examples - Optimization Patterns

> Avoiding premature optimization, list virtualization, and shallow observables for large collections. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related patterns**: See other files in this folder:
- [core.md](core.md) - Essential MobX computed and observer patterns
- [cleanup.md](cleanup.md) - WebGL and MobxQuery resource cleanup
- [routing.md](routing.md) - Lazy route loading for code-splitting

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
