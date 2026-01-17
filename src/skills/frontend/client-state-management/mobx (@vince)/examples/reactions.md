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
