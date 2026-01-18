# MobX Computed Properties

> Derived state patterns using computed getters. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 4: Computed Properties for Derived State

### Good Example - Computed properties

```typescript
export class EntitlementsStore {
  #dependencies: EntitlementsStoreDependencies;
  currentSpaceEntitlement: Entitlement | null = null;

  constructor(dependencies: EntitlementsStoreDependencies) {
    makeAutoObservable(this);
    this.#dependencies = dependencies;
  }

  // Computed - automatically recalculates when currentSpaceEntitlement changes
  get isPro() {
    return !!this.currentSpaceEntitlement?.isPro;
  }

  get canUsePremiumFeatures() {
    return this.isPro || this.currentSpaceEntitlement?.hasTrial;
  }

  get remainingCredits() {
    return this.currentSpaceEntitlement?.credits ?? 0;
  }
}
```

**Why good:** Computed values are cached and only recalculate when dependencies change, no manual synchronization needed, clean declarative API, MobX tracks dependencies automatically

### Bad Example - Manual sync instead of computed

```typescript
export class EntitlementsStore {
  isPro = false; // Manually synced state

  updateEntitlement = (entitlement: Entitlement) => {
    this.currentSpaceEntitlement = entitlement;
    // BAD: Manual sync can get out of sync
    this.isPro = !!entitlement?.isPro;
  };
}
```

**Why bad:** Manual synchronization can get out of sync with source data, requires remembering to update in all places, no automatic caching, more code to maintain

---

## Pattern 14: Computed Value Options

Computed values support advanced options for performance optimization.

### Good Example - Using equals Comparers

```typescript
import { makeAutoObservable, computed, comparer } from "mobx";

export class FilterStore {
  filters: FilterConfig = { status: "all", tags: [] };

  constructor() {
    makeAutoObservable(this, {
      // Use structural comparison for complex objects
      activeFilters: computed({ equals: comparer.structural }),
    });
  }

  // Without equals: comparer.structural, this would notify observers
  // even when the array contents are identical (different reference)
  get activeFilters() {
    return this.filters.tags.filter((tag) => tag.active);
  }

  setFilters = (filters: FilterConfig) => {
    this.filters = filters;
  };
}
```

**Why good:** `comparer.structural` performs deep comparison, prevents unnecessary re-renders when computed returns equivalent objects/arrays, useful for filtering/mapping operations that create new references

### Available Comparers

```typescript
import { comparer } from "mobx";

// Built-in comparers
comparer.identity;    // === comparison (default)
comparer.default;     // === but treats NaN === NaN
comparer.structural;  // Deep comparison using deepEqual
comparer.shallow;     // Shallow object/array comparison

// Custom comparer
const myComparer = (a, b) => a.id === b.id;
```

### Good Example - keepAlive for Expensive Computations

```typescript
import { makeAutoObservable, computed } from "mobx";

const SEARCH_THRESHOLD_MS = 100;

export class SearchStore {
  items: Item[] = [];
  searchQuery = "";

  constructor() {
    makeAutoObservable(this, {
      // keepAlive: true prevents suspension when not observed
      searchResults: computed({ keepAlive: true }),
    });
  }

  // Expensive computation that should stay cached
  get searchResults() {
    if (!this.searchQuery) return this.items;

    // Expensive fuzzy search
    return this.items.filter((item) =>
      fuzzyMatch(item.name, this.searchQuery)
    );
  }
}
```

**Why good:** Keeps computed value cached even when no observers, useful for expensive computations accessed intermittently

**WARNING:** `keepAlive: true` can cause memory leaks if the computed references large data structures. Only use when the performance benefit outweighs memory cost.

### Good Example - requiresReaction for Debugging

```typescript
import { makeAutoObservable, computed } from "mobx";

export class AnalyticsStore {
  events: Event[] = [];

  constructor() {
    makeAutoObservable(this, {
      // Throws if accessed outside reactive context
      expensiveMetrics: computed({ requiresReaction: true }),
    });
  }

  // Expensive computation - should only be used in reactions/observer components
  get expensiveMetrics() {
    return this.events.reduce((acc, event) => {
      // Complex aggregation...
      return acc;
    }, {});
  }
}

// Usage
const store = new AnalyticsStore();

// This would throw an error - accessed outside reactive context
// console.log(store.expensiveMetrics);

// This works - inside observer component
const Component = observer(() => {
  return <div>{JSON.stringify(store.expensiveMetrics)}</div>;
});
```

**Why good:** Catches accidental expensive computation access outside reactive contexts, helps identify performance issues during development

### Computed Setters (Inverse Derivation)

```typescript
import { makeAutoObservable } from "mobx";

export class TemperatureStore {
  celsius = 20;

  constructor() {
    makeAutoObservable(this);
  }

  get fahrenheit() {
    return this.celsius * 1.8 + 32;
  }

  // Computed setter - inverse derivation
  set fahrenheit(value: number) {
    this.celsius = (value - 32) / 1.8;
  }
}

const store = new TemperatureStore();
store.fahrenheit = 68; // Sets celsius to 20
```

**Why good:** Allows bidirectional binding to computed values, setter is automatically marked as action, maintains single source of truth (celsius)
