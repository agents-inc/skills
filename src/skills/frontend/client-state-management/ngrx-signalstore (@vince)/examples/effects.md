# NgRx SignalStore - Effects Examples

Side effect patterns using rxMethod for RxJS integration and async operations.

**Prerequisites:** Understand [core.md](core.md) (signalStore basics) first.

**Related examples:**
- [entities.md](entities.md) - withEntities, CRUD operations
- [features.md](features.md) - signalStoreFeature, custom features
- [testing.md](testing.md) - Unit tests, mocking strategies

---

## Pattern 1: Basic rxMethod for HTTP Requests

### Good Example - rxMethod with switchMap

```typescript
// stores/search.store.ts
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';

const SEARCH_API_URL = '/api/search';
const DEBOUNCE_MS = 300;

interface SearchResult {
  id: string;
  title: string;
  description: string;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
}

export const SearchStore = signalStore(
  { providedIn: 'root' },
  withState<SearchState>({
    query: '',
    results: [],
    isLoading: false,
    error: null,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      // rxMethod for reactive search with debounce
      search: rxMethod<string>(
        pipe(
          tap((query) => {
            patchState(store, { query, isLoading: true, error: null });
          }),
          debounceTime(DEBOUNCE_MS),
          distinctUntilChanged(),
          switchMap((query) => {
            if (!query.trim()) {
              return of([]);
            }
            return http
              .get<SearchResult[]>(`${SEARCH_API_URL}?q=${encodeURIComponent(query)}`)
              .pipe(
                catchError((err) => {
                  patchState(store, {
                    error: err.message ?? 'Search failed',
                    isLoading: false,
                  });
                  return of([]);
                })
              );
          }),
          tap((results) => {
            patchState(store, { results, isLoading: false });
          })
        )
      ),

      clearSearch() {
        patchState(store, {
          query: '',
          results: [],
          error: null,
        });
      },
    };
  })
);

// Add missing imports at top
import { debounceTime, distinctUntilChanged } from 'rxjs';
```

**Why good:** rxMethod for reactive search, debounceTime prevents excessive API calls, switchMap cancels pending requests, error handling with catchError, named constants

### Bad Example - async/await Without Cancellation

```typescript
// WRONG - No cancellation, no debounce
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export const SearchStore = signalStore(
  withState({
    query: '',
    results: [] as any[],
    isLoading: false,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      // WRONG: No debounce, no cancellation
      async search(query: string) {
        patchState(store, { query, isLoading: true });

        // WRONG: Each keystroke triggers a request
        // Previous requests not cancelled
        const results = await firstValueFrom(
          http.get<any[]>(`/api/search?q=${query}`)
        );

        patchState(store, { results, isLoading: false });
      },
    };
  })
);
```

**Why bad:** No debounce causes excessive API calls, async/await doesn't cancel previous requests, race conditions when responses arrive out of order

---

## Pattern 2: rxMethod with Signal Input

### Good Example - Connecting Signal to rxMethod

```typescript
// stores/flight.store.ts
import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  pipe,
  tap,
  switchMap,
  filter,
  debounceTime,
  catchError,
  of,
} from 'rxjs';

const FLIGHTS_API_URL = '/api/flights';
const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 300;

interface Flight {
  id: string;
  from: string;
  to: string;
  date: string;
  price: number;
}

interface Criteria {
  from: string;
  to: string;
}

interface FlightState {
  from: string;
  to: string;
  flights: Flight[];
  isLoading: boolean;
  error: string | null;
}

export const FlightStore = signalStore(
  { providedIn: 'root' },
  withState<FlightState>({
    from: '',
    to: '',
    flights: [],
    isLoading: false,
    error: null,
  }),
  withComputed(({ from, to }) => ({
    criteria: computed<Criteria>(() => ({ from: from(), to: to() })),
    isValidCriteria: computed(
      () => from().length >= MIN_QUERY_LENGTH && to().length >= MIN_QUERY_LENGTH
    ),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      updateFrom(from: string) {
        patchState(store, { from });
      },

      updateTo(to: string) {
        patchState(store, { to });
      },

      // rxMethod accepts Observable, Signal, or static value
      loadFlights: rxMethod<Criteria>(
        pipe(
          filter(
            (c) =>
              c.from.length >= MIN_QUERY_LENGTH &&
              c.to.length >= MIN_QUERY_LENGTH
          ),
          tap(() => patchState(store, { isLoading: true, error: null })),
          debounceTime(SEARCH_DEBOUNCE_MS),
          switchMap((criteria) =>
            http
              .get<Flight[]>(FLIGHTS_API_URL, {
                params: { from: criteria.from, to: criteria.to },
              })
              .pipe(
                catchError((err) => {
                  patchState(store, {
                    error: err.message ?? 'Failed to load flights',
                    isLoading: false,
                  });
                  return of([]);
                })
              )
          ),
          tap((flights) => {
            patchState(store, { flights, isLoading: false });
          })
        )
      ),
    };
  }),
  withHooks({
    onInit({ loadFlights, criteria }) {
      // Connect computed signal to rxMethod
      // Automatically triggers when criteria changes
      loadFlights(criteria);
    },
  })
);
```

**Why good:** rxMethod accepts Signal input, auto-triggers on signal change, filter prevents invalid searches, criteria computed for reactive composition, onInit connects signal to effect

---

## Pattern 3: rxMethod with Retry and Error Recovery

### Good Example - Retry Logic with exponentialBackoff

```typescript
// stores/data-sync.store.ts
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  pipe,
  tap,
  switchMap,
  retry,
  catchError,
  of,
  timer,
  delayWhen,
} from 'rxjs';

const SYNC_API_URL = '/api/sync';
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface SyncState {
  lastSyncTime: Date | null;
  isSyncing: boolean;
  syncError: string | null;
  retryCount: number;
}

export const DataSyncStore = signalStore(
  { providedIn: 'root' },
  withState<SyncState>({
    lastSyncTime: null,
    isSyncing: false,
    syncError: null,
    retryCount: 0,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      sync: rxMethod<void>(
        pipe(
          tap(() => {
            patchState(store, {
              isSyncing: true,
              syncError: null,
              retryCount: 0,
            });
          }),
          switchMap(() =>
            http.post<{ timestamp: string }>(SYNC_API_URL, {}).pipe(
              // Retry with exponential backoff
              retry({
                count: MAX_RETRY_ATTEMPTS,
                delay: (error, retryCount) => {
                  patchState(store, { retryCount });
                  const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
                  console.log(`Retry ${retryCount}/${MAX_RETRY_ATTEMPTS} in ${delayMs}ms`);
                  return timer(delayMs);
                },
              }),
              catchError((err) => {
                patchState(store, {
                  syncError: `Sync failed after ${MAX_RETRY_ATTEMPTS} attempts: ${err.message}`,
                  isSyncing: false,
                });
                return of(null);
              })
            )
          ),
          tap((result) => {
            if (result) {
              patchState(store, {
                lastSyncTime: new Date(result.timestamp),
                isSyncing: false,
                retryCount: 0,
              });
            }
          })
        )
      ),

      clearError() {
        patchState(store, { syncError: null });
      },
    };
  })
);
```

**Why good:** Retry with exponential backoff, retry count tracked in state, proper error handling, timer for delay, named constants for configuration

---

## Pattern 4: Multiple rxMethods with Coordination

### Good Example - Coordinated Effects

```typescript
// stores/dashboard.store.ts
import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  pipe,
  tap,
  switchMap,
  forkJoin,
  catchError,
  of,
  merge,
  map,
} from 'rxjs';

const API_BASE = '/api/dashboard';
const REFRESH_INTERVAL_MS = 30000;

interface Stats {
  users: number;
  orders: number;
  revenue: number;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: Date;
}

interface DashboardState {
  stats: Stats | null;
  recentActivity: Activity[];
  isLoadingStats: boolean;
  isLoadingActivity: boolean;
  error: string | null;
}

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState<DashboardState>({
    stats: null,
    recentActivity: [],
    isLoadingStats: false,
    isLoadingActivity: false,
    error: null,
  }),
  withComputed(({ isLoadingStats, isLoadingActivity }) => ({
    isLoading: computed(() => isLoadingStats() || isLoadingActivity()),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      // Load stats
      loadStats: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoadingStats: true, error: null })),
          switchMap(() =>
            http.get<Stats>(`${API_BASE}/stats`).pipe(
              catchError((err) => {
                patchState(store, {
                  error: err.message,
                  isLoadingStats: false,
                });
                return of(null);
              })
            )
          ),
          tap((stats) => {
            if (stats) {
              patchState(store, { stats, isLoadingStats: false });
            }
          })
        )
      ),

      // Load activity
      loadActivity: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoadingActivity: true })),
          switchMap(() =>
            http.get<Activity[]>(`${API_BASE}/activity`).pipe(
              catchError((err) => {
                patchState(store, {
                  error: err.message,
                  isLoadingActivity: false,
                });
                return of([]);
              })
            )
          ),
          tap((activity) => {
            patchState(store, {
              recentActivity: activity,
              isLoadingActivity: false,
            });
          })
        )
      ),

      // Parallel load - triggers both effects
      loadAll() {
        this.loadStats();
        this.loadActivity();
      },

      // Auto-refresh with interval
      startAutoRefresh: rxMethod<void>(
        pipe(
          switchMap(() =>
            interval(REFRESH_INTERVAL_MS).pipe(
              tap(() => {
                this.loadStats();
                this.loadActivity();
              })
            )
          )
        )
      ),
    };
  })
);

// Add missing import
import { interval } from 'rxjs';
```

**Why good:** Multiple independent rxMethods, coordinated via wrapper method, auto-refresh with interval, separate loading states, computed for combined loading state

---

## Pattern 5: rxMethod with Polling and Cancellation

### Good Example - Polling with Stop Capability

```typescript
// stores/notifications.store.ts
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  pipe,
  tap,
  switchMap,
  interval,
  takeUntil,
  Subject,
  startWith,
  catchError,
  of,
} from 'rxjs';

const NOTIFICATIONS_API_URL = '/api/notifications';
const POLL_INTERVAL_MS = 10000;

interface Notification {
  id: string;
  message: string;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  isPolling: boolean;
  lastPollTime: Date | null;
}

export const NotificationStore = signalStore(
  { providedIn: 'root' },
  withState<NotificationState>({
    notifications: [],
    isPolling: false,
    lastPollTime: null,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);
    // Subject for stopping polling
    const stopPolling$ = new Subject<void>();

    return {
      // Start polling
      startPolling: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isPolling: true })),
          switchMap(() =>
            interval(POLL_INTERVAL_MS).pipe(
              startWith(0), // Immediate first fetch
              takeUntil(stopPolling$),
              switchMap(() =>
                http.get<Notification[]>(NOTIFICATIONS_API_URL).pipe(
                  catchError(() => of([]))
                )
              ),
              tap((notifications) => {
                patchState(store, {
                  notifications,
                  lastPollTime: new Date(),
                });
              })
            )
          ),
          tap({
            complete: () => patchState(store, { isPolling: false }),
          })
        )
      ),

      stopPolling() {
        stopPolling$.next();
        patchState(store, { isPolling: false });
      },

      markAsRead(id: string) {
        patchState(store, (state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },
    };
  })
);
```

**Why good:** Polling with interval, takeUntil for cancellation, Subject for stop signal, startWith for immediate first fetch, proper cleanup

---

## Pattern 6: rxMethod Input Types

### Good Example - Different Input Types

```typescript
// stores/api.store.ts
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, of } from 'rxjs';

interface ApiState {
  data: unknown | null;
  isLoading: boolean;
}

export const ApiStore = signalStore(
  { providedIn: 'root' },
  withState<ApiState>({
    data: null,
    isLoading: false,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);

    // rxMethod accepts T, Signal<T>, or Observable<T>
    const fetchData = rxMethod<string>(
      pipe(
        tap(() => patchState(store, { isLoading: true })),
        switchMap((url) => http.get(url)),
        tap((data) => patchState(store, { data, isLoading: false }))
      )
    );

    return {
      fetchData,

      // Example usages:
      // 1. Static value
      fetchUsers() {
        fetchData('/api/users');
      },

      // 2. Signal value
      fetchFromSignal() {
        const url = signal('/api/products');
        fetchData(url); // Reacts to signal changes
      },

      // 3. Observable value
      fetchFromObservable() {
        const url$ = of('/api/orders');
        fetchData(url$);
      },
    };
  })
);
```

**Why good:** Demonstrates rxMethod flexibility - accepts static values, signals, or observables as input
