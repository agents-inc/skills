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
