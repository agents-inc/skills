# MobX Configuration

> makeAutoObservable vs makeObservable patterns. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 9: makeAutoObservable vs makeObservable

### Good Example - makeAutoObservable for most stores

```typescript
export class SimpleStore {
  value = "";
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  setValue = (v: string) => {
    this.value = v;
  };

  get upperValue() {
    return this.value.toUpperCase();
  }
}
```

**Why good:** Automatically infers observables (properties), actions (methods), and computeds (getters), less boilerplate, good default for most stores

### Good Example - makeObservable for fine-grained control

```typescript
export class PerformanceStore {
  items: Item[] = [];
  selectedId: string | null = null;

  constructor() {
    makeObservable(this, {
      items: observable.shallow, // Performance: don't deep-observe items
      selectedId: observable,
      addItem: action,
      selectedItem: computed,
      setExternalValue: false, // Exclude from observability
    });
  }

  addItem = (item: Item) => {
    this.items.push(item);
  };

  get selectedItem() {
    return this.items.find((i) => i.id === this.selectedId);
  }

  // Not an action - called from external non-MobX code
  setExternalValue(value: string) {
    // ...
  }
}
```

**Why good:** `observable.shallow` prevents deep observation for performance, can exclude specific methods from observability, explicit annotations document intent
