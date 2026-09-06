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
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import {
  pipe,
  tap,
  switchMap,
  catchError,
  of,
  debounceTime,
  distinctUntilChanged,
} from "rxjs";

const SEARCH_API_URL = "/api/search";
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
  { providedIn: "root" },
  withState<SearchState>({
    query: "",
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
              .get<
                SearchResult[]
              >(`${SEARCH_API_URL}?q=${encodeURIComponent(query)}`)
              .pipe(
                catchError((err) => {
                  patchState(store, {
                    error: err.message ?? "Search failed",
                    isLoading: false,
                  });
                  return of([]);
                }),
              );
          }),
          tap((results) => {
            patchState(store, { results, isLoading: false });
          }),
        ),
      ),

      clearSearch() {
        patchState(store, {
          query: "",
          results: [],
          error: null,
        });
      },
    };
  }),
);
```

**Why good:** `switchMap` unsubscribes from the previous request when a new query arrives, which is what stops an earlier response landing after a later one and overwriting it — `debounceTime` reduces how often that happens but cannot prevent it.

Two placements are deliberate. The first `tap` sits _before_ `debounceTime`, so the input reflects the keystroke immediately while the request waits. And `catchError` is inside the `switchMap`, on the inner request: an error allowed to reach the outer pipe completes it, and the `rxMethod` then silently ignores every later call for the life of the store.

### Bad Example - async/await Without Cancellation

```typescript
// WRONG - No cancellation, no debounce
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

export const SearchStore = signalStore(
  withState({
    query: "",
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
          http.get<any[]>(`/api/search?q=${query}`),
        );

        patchState(store, { results, isLoading: false });
      },
    };
  }),
);
```

**Why bad:** Nothing cancels the in-flight request, so typing "ab" leaves two responses racing and whichever returns last wins — which is frequently the one for "a". The bug is intermittent and depends on network timing, so it survives manual testing and appears in production.

---

## Pattern 2: rxMethod with Signal Input

### Good Example - Connecting Signal to rxMethod

```typescript
// stores/flight.store.ts
import { computed, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import {
  pipe,
  tap,
  switchMap,
  filter,
  debounceTime,
  catchError,
  of,
} from "rxjs";

const FLIGHTS_API_URL = "/api/flights";
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
  { providedIn: "root" },
  withState<FlightState>({
    from: "",
    to: "",
    flights: [],
    isLoading: false,
    error: null,
  }),
  withComputed(({ from, to }) => ({
    criteria: computed<Criteria>(() => ({ from: from(), to: to() })),
    isValidCriteria: computed(
      () =>
        from().length >= MIN_QUERY_LENGTH && to().length >= MIN_QUERY_LENGTH,
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
              c.to.length >= MIN_QUERY_LENGTH,
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
                    error: err.message ?? "Failed to load flights",
                    isLoading: false,
                  });
                  return of([]);
                }),
              ),
          ),
          tap((flights) => {
            patchState(store, { flights, isLoading: false });
          }),
        ),
      ),
    };
  }),
  withHooks({
    onInit({ loadFlights, criteria }) {
      // Connect computed signal to rxMethod
      // Automatically triggers when criteria changes
      loadFlights(criteria);
    },
  }),
);
```

**Why good:** Passing a signal wires it up once — `loadFlights(criteria)` in `onInit` subscribes to the computed, and every later change to `from` or `to` re-runs the pipe with no call site involved. The store's methods only write state; the fetch follows from the state changing.

The `filter` sits ahead of the loading `tap` on purpose: a criteria change that fails the length check should not flip `isLoading` on for a request that will never be made.

---

## Pattern 3: rxMethod with Retry and Error Recovery

### Good Example - Retry Logic with exponentialBackoff

```typescript
// stores/data-sync.store.ts
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import {
  pipe,
  tap,
  switchMap,
  retry,
  catchError,
  of,
  timer,
  delayWhen,
} from "rxjs";

const SYNC_API_URL = "/api/sync";
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface SyncState {
  lastSyncTime: Date | null;
  isSyncing: boolean;
  syncError: string | null;
  retryCount: number;
}

export const DataSyncStore = signalStore(
  { providedIn: "root" },
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
                  const delayMs =
                    INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
                  console.log(
                    `Retry ${retryCount}/${MAX_RETRY_ATTEMPTS} in ${delayMs}ms`,
                  );
                  return timer(delayMs);
                },
              }),
              catchError((err) => {
                patchState(store, {
                  syncError: `Sync failed after ${MAX_RETRY_ATTEMPTS} attempts: ${err.message}`,
                  isSyncing: false,
                });
                return of(null);
              }),
            ),
          ),
          tap((result) => {
            if (result) {
              patchState(store, {
                lastSyncTime: new Date(result.timestamp),
                isSyncing: false,
                retryCount: 0,
              });
            }
          }),
        ),
      ),

      clearError() {
        patchState(store, { syncError: null });
      },
    };
  }),
);
```

**Why good:** `retry` takes a `delay` function returning an observable, so returning `timer(delayMs)` is what makes the wait asynchronous and cancellable rather than a blocking sleep. Backing off exponentially matters because the usual cause of a failed sync is a server under load, and retrying at a fixed interval adds to it.

`retry` sits inside the `switchMap` and above `catchError`, so the retries are exhausted before the error is handled — the other order would catch the first failure and never retry at all.

---

## Pattern 4: Multiple rxMethods with Coordination

### Good Example - Coordinated Effects

```typescript
// stores/dashboard.store.ts
import { computed, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import {
  pipe,
  tap,
  switchMap,
  forkJoin,
  catchError,
  of,
  merge,
  map,
  interval,
} from "rxjs";

const API_BASE = "/api/dashboard";
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
  { providedIn: "root" },
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
              }),
            ),
          ),
          tap((stats) => {
            if (stats) {
              patchState(store, { stats, isLoadingStats: false });
            }
          }),
        ),
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
              }),
            ),
          ),
          tap((activity) => {
            patchState(store, {
              recentActivity: activity,
              isLoadingActivity: false,
            });
          }),
        ),
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
              }),
            ),
          ),
        ),
      ),
    };
  }),
);
```

**Why good:** Two effects with two loading flags means each panel renders as its own data arrives, and a combined computed still gives the page a single "anything in flight" signal. `loadAll` starts both without waiting, because each `rxMethod` owns its own subscription.

`startAutoRefresh` uses `switchMap` over `interval` so calling it twice replaces the timer instead of stacking a second one — the failure that otherwise doubles the request rate every time a component remounts.

---

## Pattern 5: rxMethod with Polling and Cancellation

### Good Example - Polling with Stop Capability

```typescript
// stores/notifications.store.ts
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
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
} from "rxjs";

const NOTIFICATIONS_API_URL = "/api/notifications";
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
  { providedIn: "root" },
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
                http
                  .get<Notification[]>(NOTIFICATIONS_API_URL)
                  .pipe(catchError(() => of([]))),
              ),
              tap((notifications) => {
                patchState(store, {
                  notifications,
                  lastPollTime: new Date(),
                });
              }),
            ),
          ),
          tap({
            complete: () => patchState(store, { isPolling: false }),
          }),
        ),
      ),

      stopPolling() {
        stopPolling$.next();
        patchState(store, { isPolling: false });
      },

      markAsRead(id: string) {
        patchState(store, (state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        }));
      },
    };
  }),
);
```

**Why good:** `interval` waits a full period before its first emission, so `startWith(0)` is what stops the panel sitting empty for the whole interval on open. `takeUntil(stopPolling$)` gives an explicit stop that does not depend on the store being destroyed, which is what a "pause updates" control needs.

The inner `catchError` returns `of([])` rather than rethrowing, so one failed poll does not end the interval — the distinction that separates a poller that recovers from one that stops at the first blip.

The `Subject` belongs in `withProps` or the method closure rather than in state: it mutates itself, and the v19 development freeze would reject it.

---

## Pattern 6: rxMethod Input Types

### Good Example - Different Input Types

```typescript
// stores/api.store.ts
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { signal } from "@angular/core";
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, tap, switchMap, of } from "rxjs";

interface ApiState {
  data: unknown | null;
  isLoading: boolean;
}

export const ApiStore = signalStore(
  { providedIn: "root" },
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
        tap((data) => patchState(store, { data, isLoading: false })),
      ),
    );

    return {
      fetchData,

      // Example usages:
      // 1. Static value
      fetchUsers() {
        fetchData("/api/users");
      },

      // 2. Signal value
      fetchFromSignal() {
        const url = signal("/api/products");
        fetchData(url); // Reacts to signal changes
      },

      // 3. Observable value
      fetchFromObservable() {
        const url$ = of("/api/orders");
        fetchData(url$);
      },
    };
  }),
);
```

**Why good:** One definition serves three call shapes because `rxMethod` normalises its argument into a stream. The difference that matters is lifetime: a static value runs the pipe once, while a signal or an observable keeps a live subscription that re-runs it on every emission until the store is destroyed.

That makes `fetchFromSignal` misleading as written — the signal is created inside the method, so nothing else can update it and the subscription outlives the call for no benefit. A signal passed in is what makes this shape useful.

---

## Pattern 7: signalMethod for Signal-Only Side Effects (v19+)

### Good Example - Using signalMethod Without RxJS

```typescript
// stores/theme.store.ts
import { effect, signal } from "@angular/core";
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { signalMethod } from "@ngrx/signals";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "app-theme";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
}

export const ThemeStore = signalStore(
  { providedIn: "root" },
  withState<ThemeState>({
    theme: "system",
    resolvedTheme: "light",
  }),
  withMethods((store) => ({
    // signalMethod for simple side effects (v19+)
    // No RxJS required, works with signals or static values
    applyTheme: signalMethod<Theme>((theme) => {
      // Side effect: update DOM and localStorage
      const resolved =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;

      document.documentElement.setAttribute("data-theme", resolved);
      localStorage.setItem(STORAGE_KEY, theme);

      // Update store state
      patchState(store, { theme, resolvedTheme: resolved });
    }),

    // Can call with static value
    setDarkMode() {
      this.applyTheme("dark");
    },

    // Or connect to a signal for reactive updates
    connectToSystemTheme() {
      const systemTheme = signal<Theme>("system");
      // Automatically re-runs when systemTheme changes
      this.applyTheme(systemTheme);
    },

    loadSavedTheme() {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved) {
        this.applyTheme(saved);
      }
    },
  })),
);
```

**Why good:** Applying a theme is synchronous and cannot race, so it needs none of what `rxMethod` provides and skips the RxJS dependency. `signalMethod` also runs outside an injection context, which is what lets `loadSavedTheme` call it from anywhere rather than only during construction.

Only the argument is tracked. Reading `store.theme()` inside the processor would not re-run it — the parameter is the sole trigger, which is what keeps a method that also writes state from re-triggering itself.

### When to Use signalMethod vs rxMethod

```typescript
// stores/comparison.store.ts
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { signalMethod } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, switchMap, debounceTime, tap } from "rxjs";

const DEBOUNCE_MS = 300;

export const ComparisonStore = signalStore(
  { providedIn: "root" },
  withState({
    localData: "",
    searchResults: [] as string[],
    isSearching: false,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      // USE signalMethod: Simple side effect, no async, no RxJS operators
      updateLocalData: signalMethod<string>((data) => {
        // Simple sync update + side effect
        console.log("Data updated:", data);
        patchState(store, { localData: data });
      }),

      // USE rxMethod: Need debounce, cancellation, RxJS operators
      search: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isSearching: true })),
          debounceTime(DEBOUNCE_MS),
          switchMap((query) => http.get<string[]>(`/api/search?q=${query}`)),
          tap((results) =>
            patchState(store, { searchResults: results, isSearching: false }),
          ),
        ),
      ),
    };
  }),
);
```

**Why good:** The two sit side by side in one store, which is the realistic arrangement — the choice is per effect, not per store. `updateLocalData` cannot race, so it costs nothing to keep simple; `search` can, so it takes the operator pipeline.

### Important: Race Conditions with signalMethod

```typescript
// CAUTION: signalMethod does NOT handle race conditions
// stores/unsafe-search.store.ts

// BAD: Using signalMethod for async operations
const unsafeSearch = signalMethod<string>(async (query) => {
  patchState(store, { isLoading: true });
  // Race condition! Multiple calls can resolve out of order
  const results = await fetch(`/api/search?q=${query}`).then((r) => r.json());
  patchState(store, { results, isLoading: false }); // May overwrite newer results
});

// GOOD: Use rxMethod with switchMap for async operations
const safeSearch = rxMethod<string>(
  pipe(
    tap(() => patchState(store, { isLoading: true })),
    switchMap((query) => http.get(`/api/search?q=${query}`)),
    tap((results) => patchState(store, { results, isLoading: false })),
  ),
);
```

**Why important:** `signalMethod` does not cancel previous operations - use `rxMethod` with `switchMap` for cancellable async requests
