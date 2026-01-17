# MobX Query Bridge

> Bridging data fetching with MobX stores. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 8: MobxQuery Bridge

### Good Example - MobxQuery Implementation

```typescript
// src/stores/TeamsStore.ts
import { makeAutoObservable, runInAction } from "mobx";
import { MobxQuery } from "./utils/mobx-query";
import { teamsQueryIdentifier } from "lib/query-keys";

export class TeamsStore {
  #dependencies: TeamsStoreDependencies;

  allTeams: Team[] = [];
  teamsAreLoading = false;

  // MobxQuery instance bridges data fetching with store
  #teamsQuery = new MobxQuery(
    {
      queryKey: [teamsQueryIdentifier],
      queryFn: this.#dependencies.fetchTeams,
      refetchInterval: 60000, // Refetch every minute
    },
    ({ isLoading, data, error }) => {
      runInAction(() => {
        this.teamsAreLoading = isLoading;
        if (data) {
          this.allTeams = data;
        }
      });
    }
  );

  constructor(dependencies: TeamsStoreDependencies) {
    this.#dependencies = dependencies;
    makeAutoObservable(this);
  }

  // Start query when needed
  startTeamsQuery = () => {
    this.#teamsQuery.query();
  };

  // Cleanup
  dispose = () => {
    this.#teamsQuery.dispose();
  };

  get currentTeam() {
    return this.allTeams.find((t) => t.id === this.#dependencies.authStore.currentTeamId);
  }
}
```

**Why good:** Bridges data fetching caching/refetching with MobX reactivity, stores become source of truth for UI, callback uses runInAction for state mutations, dispose method prevents memory leaks

### MobxQuery Utility

```typescript
// src/stores/utils/mobx-query.ts
import { QueryObserver, type QueryObserverOptions, type QueryObserverResult } from "@tanstack/react-query";
import { queryClient } from "lib/query-client";

export class MobxQuery<TQueryFnData, TError, TData, TQueryData, TQueryKey> {
  private observer?: QueryObserver;
  private unsubscribe?: () => void;
  private options: QueryObserverOptions;
  private onResultChange?: (result: QueryObserverResult) => void;

  constructor(
    options: QueryObserverOptions,
    onResultChange?: (result: QueryObserverResult) => void
  ) {
    this.options = options;
    this.onResultChange = onResultChange;
  }

  query() {
    if (this.observer) return;

    this.observer = new QueryObserver(queryClient, this.options);
    this.unsubscribe = this.observer.subscribe((result) => {
      this.onResultChange?.(result);
    });
  }

  dispose() {
    this.unsubscribe?.();
    this.observer = undefined;
  }
}
```

**Why good:** Encapsulates query observer subscription, provides dispose for cleanup, prevents duplicate subscriptions with guard
