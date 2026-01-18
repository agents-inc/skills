# MobX Reactions

> Side effect patterns using reaction() in stores. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 5: Reactions for Side Effects

### Good Example - Reaction in store constructor

```typescript
export class AuthStore {
  #dependencies: AuthStoreDependencies;
  courierToken: string | null = null;

  constructor(dependencies: AuthStoreDependencies) {
    makeAutoObservable(this);
    this.#dependencies = dependencies;

    // Reaction: when firebaseUid changes, fetch courier token
    reaction(
      () => this.firebaseUid, // What to track
      (uid) => {
        // What to do when it changes
        runInAction(() => {
          this.courierToken = null;
        });

        if (!uid) return;

        this.#dependencies
          .fetchAppStartup()
          .then((res) => {
            runInAction(() => {
              // Guard against stale responses
              if (this.firebaseUid === uid) {
                this.courierToken = res.courierToken;
              }
            });
          })
          .catch((error) => {
            logger.error("Failed to fetch app startup", {}, error);
          });
      },
      { fireImmediately: true } // Run on initialization
    );
  }

  get firebaseUid() {
    return this.state.type === "initialized" ? this.state.uid : null;
  }
}
```

**Why good:** Side effects live in stores not components, `fireImmediately: true` runs on initialization, stale response guard prevents race conditions, centralizes business logic in one place

### Bad Example - useEffect in component for MobX state

```typescript
import { useEffect } from "react";
import { stores } from "stores";

const MyComponent = observer(() => {
  const { authStore } = stores;

  // BAD: Reacting to MobX state with useEffect
  useEffect(() => {
    if (authStore.isLoggedIn) {
      fetchUserData();
    }
  }, [authStore.isLoggedIn]); // Breaks MobX tracking

  return <div>...</div>;
});
```

**Why bad:** Creates duplicate reactive systems (React + MobX), useEffect dependency arrays don't track MobX observables correctly, business logic scattered in components instead of stores, harder to test and maintain

---

## Reaction Disposal Pattern

### Good Example - Disposing reactions to prevent memory leaks

```typescript
import { makeAutoObservable, reaction } from "mobx";

export class SearchStore {
  #dependencies: SearchStoreDependencies;
  #disposers: (() => void)[] = [];

  searchQuery = "";
  results: SearchResult[] = [];

  constructor(dependencies: SearchStoreDependencies) {
    makeAutoObservable(this);
    this.#dependencies = dependencies;

    // Store the disposer returned by reaction
    const disposeSearchReaction = reaction(
      () => this.searchQuery,
      (query) => {
        if (query.length > 2) {
          this.performSearch(query);
        }
      },
      { delay: 300 } // Debounce
    );

    // Track all disposers for cleanup
    this.#disposers.push(disposeSearchReaction);
  }

  // Call this when the store is no longer needed
  dispose = () => {
    this.#disposers.forEach((dispose) => dispose());
    this.#disposers = [];
  };

  setSearchQuery = (query: string) => {
    this.searchQuery = query;
  };

  private performSearch = async (query: string) => {
    // ... search logic
  };
}
```

**Why good:** Reactions are properly disposed preventing memory leaks, disposers array pattern scales to multiple reactions, dispose method provides clean cleanup API

### Good Example - Disposal in React component with useLocalObservable

```typescript
import { observer, useLocalObservable } from "mobx-react-lite";
import { reaction } from "mobx";
import { useEffect } from "react";

const SearchComponent = observer(() => {
  const store = useLocalObservable(() => ({
    query: "",
    results: [] as SearchResult[],
    setQuery(q: string) {
      this.query = q;
    },
  }));

  // Setup and dispose reaction in useEffect
  useEffect(() => {
    const dispose = reaction(
      () => store.query,
      (query) => {
        // Perform search...
      }
    );

    // Return disposer for cleanup
    return dispose;
  }, [store]);

  return <input value={store.query} onChange={(e) => store.setQuery(e.target.value)} />;
});
```

**Why good:** useEffect cleanup function calls the reaction disposer, prevents memory leaks when component unmounts, reaction tied to component lifecycle
