# API & Data Fetching - MobX Bridge

> MobxQuery for bridging React Query data into MobX stores. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand React Query configuration from [core.md](core.md) first.

**Related Examples:**
- [mutations.md](mutations.md) - useMutation hooks with notifications
- [validation.md](validation.md) - Zod schema validation
- [error-handling.md](error-handling.md) - Logger error tracking

---

## Pattern 6: MobxQuery Bridge for Store Integration

Use MobxQuery to bridge React Query data into MobX stores for reactive updates.

### MobxQuery Setup

```typescript
// src/stores/utils/mobx-query.ts
import { QueryObserver } from "@tanstack/react-query";
import type { QueryObserverOptions, QueryObserverResult, QueryKey } from "@tanstack/react-query";
import { queryClient } from "lib/queryClient";

export class MobxQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> {
  private observer?: QueryObserver<TQueryFnData, TError, TData, TQueryData, TQueryKey>;
  private unsubscribe?: () => void;

  constructor(
    private options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    private onResultChange?: (result: QueryObserverResult<TData, TError>) => void
  ) {}

  query = () => {
    if (this.observer) return;

    this.observer = new QueryObserver(queryClient, this.options);
    this.unsubscribe = this.observer.subscribe((result) => {
      this.onResultChange?.(result);
    });
  };

  dispose = () => {
    this.unsubscribe?.();
    this.observer = undefined;
    this.unsubscribe = undefined;
  };
}
```

### Usage in Store

```typescript
// src/stores/TeamsStore.ts
import { makeAutoObservable, runInAction } from "mobx";
import { MobxQuery } from "stores/utils/mobx-query";
import { teamsQueryIdentifier } from "constants/queryKeys";
import { fetchTeams } from "lib/teamApi";
import type { Team } from "@customTypes/team";

export class TeamsStore {
  teams: Team[] = [];
  isLoading = true;

  #teamsQuery: MobxQuery<Team[]>;

  constructor() {
    makeAutoObservable(this);

    this.#teamsQuery = new MobxQuery(
      {
        queryKey: [teamsQueryIdentifier],
        queryFn: fetchTeams,
      },
      (result) => {
        runInAction(() => {
          this.isLoading = result.isLoading;
          if (result.data) {
            this.teams = result.data;
          }
        });
      }
    );
  }

  initialize = () => {
    this.#teamsQuery.query();
  };

  // CRITICAL: Dispose on cleanup
  dispose = () => {
    this.#teamsQuery.dispose();
  };

  get activeTeam() {
    return this.teams.find((team) => team.isActive);
  }
}
```

**Why good:** MobxQuery enables MobX reactivity for server data, runInAction ensures MobX tracks mutations correctly, dispose prevents memory leaks, computed getters derive state automatically

```typescript
// BAD Example - Missing runInAction after subscribe callback
this.#teamsQuery = new MobxQuery(
  { queryKey: [teamsQueryIdentifier], queryFn: fetchTeams },
  (result) => {
    // MobX warning! Mutating outside action
    this.teams = result.data ?? [];
  }
);

// BAD Example - Missing dispose
class Store {
  #query = new MobxQuery(...);
  // No dispose method - memory leak!
}

// BAD Example - Using regular method instead of arrow function
dispose() {
  this.#teamsQuery.dispose(); // `this` is undefined when called externally
}
```

**Why bad:** Missing runInAction causes MobX warnings and broken reactivity, undisposed queries leak memory and cause stale updates, regular methods lose `this` binding when destructured

---
