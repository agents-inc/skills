# RxJS Combination Operator Examples

> combineLatest, forkJoin, merge, concat, race, zip patterns. See [core.md](core.md) for basics.

**Prerequisites**: Understand Observable creation and pipe operators from core examples first.

---

## combineLatest - Latest from Each Source

Emits an array of the latest value from each source whenever ANY source emits. Requires all sources to emit at least once.

### Good Example - Dashboard with Multiple Data Sources

```typescript
import { combineLatest } from "rxjs";
import { map, distinctUntilChanged } from "rxjs/operators";

interface DashboardData {
  user: User;
  notifications: Notification[];
  stats: Stats;
}

const dashboard$ = combineLatest([currentUser$, notifications$, stats$]).pipe(
  map(
    ([user, notifications, stats]): DashboardData => ({
      user,
      notifications,
      stats,
    }),
  ),
);
// Emits whenever ANY source updates, with latest values from all sources
```

**Why good:** `combineLatest` reacts to changes from any source while keeping the full picture, ideal for derived views

### Bad Example - combineLatest with One-Shot Sources

```typescript
// BAD: combineLatest waits for ALL sources to emit at least once
const data$ = combineLatest([
  from(fetch("/api/a")), // completes after 1 emission
  from(fetch("/api/b")), // completes after 1 emission
]);
// Works, but forkJoin is semantically correct for one-shot sources
```

**Why bad:** `combineLatest` is designed for ongoing streams; for one-shot parallel requests, `forkJoin` is the correct choice

---

## forkJoin - Wait for All to Complete

Emits the last value from each source, only when ALL complete. Like `Promise.all`.

### Good Example - Parallel API Requests

```typescript
import { forkJoin, from, defer } from "rxjs";
import { catchError, map } from "rxjs/operators";

interface PageData {
  user: User;
  posts: Post[];
  comments: Comment[];
}

const pageData$ = forkJoin({
  user: defer(() => from(fetch("/api/user").then((r) => r.json()))),
  posts: defer(() => from(fetch("/api/posts").then((r) => r.json()))),
  comments: defer(() => from(fetch("/api/comments").then((r) => r.json()))),
}).pipe(
  map((data): PageData => data),
  catchError((error) => {
    console.error("Failed to load page data:", error);
    return of({ user: null, posts: [], comments: [] });
  }),
);
// Emits { user, posts, comments } when ALL three complete
```

**Why good:** `forkJoin` with object syntax provides named results, all requests run in parallel, single emission with all data

### Bad Example - Sequential Instead of Parallel

```typescript
// BAD: fetching sequentially wastes time
const data$ = from(fetch("/api/user")).pipe(
  switchMap((user) =>
    from(fetch("/api/posts")).pipe(
      switchMap((posts) =>
        from(fetch("/api/comments")).pipe(
          map((comments) => ({ user, posts, comments })),
        ),
      ),
    ),
  ),
);
// Takes sum of all request times instead of max
```

**Why bad:** sequential calls take 3x longer than parallel calls, and nested `switchMap` is hard to read

---

## merge - Interleaved Emissions

Subscribes to all sources simultaneously, emitting values from each as they arrive.

### Good Example - Multiple Event Sources

```typescript
import { merge, fromEvent } from "rxjs";
import { map } from "rxjs/operators";

type InputSource = "keyboard" | "mouse" | "touch";

interface UserActivity {
  source: InputSource;
  timestamp: number;
}

const activity$ = merge(
  fromEvent(document, "keydown").pipe(
    map((): UserActivity => ({ source: "keyboard", timestamp: Date.now() })),
  ),
  fromEvent(document, "mousemove").pipe(
    map((): UserActivity => ({ source: "mouse", timestamp: Date.now() })),
  ),
  fromEvent(document, "touchstart").pipe(
    map((): UserActivity => ({ source: "touch", timestamp: Date.now() })),
  ),
);
// Emits from whichever source fires, interleaved
```

**Why good:** `merge` combines multiple event streams into one, preserving emission order by arrival time

---

## concat - Sequential Subscription

Subscribes to sources one at a time, in order. Next source starts only when previous completes.

### Good Example - Fallback Chain

```typescript
import { concat, of, defer, from, EMPTY } from "rxjs";
import { catchError, take } from "rxjs/operators";

// Try cache first, then API, then default
const data$ = concat(
  defer(() => of(getFromCache("key"))).pipe(
    catchError(() => EMPTY), // skip to next on cache miss
  ),
  defer(() => from(fetch("/api/data").then((r) => r.json()))).pipe(
    catchError(() => EMPTY), // skip to next on API failure
  ),
  of({ fallback: true }), // guaranteed final fallback
).pipe(
  take(1), // take first successful result
);
```

**Why good:** `concat` with `take(1)` creates a priority chain, each source is tried only if the previous fails/completes empty

---

## race - First to Emit Wins

Mirrors the first source to emit, unsubscribes from the rest.

### Good Example - Timeout Fallback

```typescript
import { race, timer, defer, from } from "rxjs";
import { map, switchMap } from "rxjs/operators";

const TIMEOUT_MS = 5000;

const withTimeout$ = race(
  defer(() => from(fetch("/api/slow-endpoint").then((r) => r.json()))),
  timer(TIMEOUT_MS).pipe(map(() => ({ error: "timeout", data: null }))),
);
// If fetch resolves first, use its result; if timer fires first, use timeout fallback
```

**Why good:** `race` provides clean timeout logic without `timeout` operator's error throw

---

## Combination Operator Decision Framework

```
Need to combine multiple Observables?
│
├── Need latest value from each whenever ANY emits?
│   └── combineLatest (dashboard, derived state, form validation)
│
├── Need all to complete, then get final values?
│   └── forkJoin (parallel API calls, batch initialization)
│
├── Need all emissions interleaved as they arrive?
│   └── merge (multiple event sources, concurrent streams)
│
├── Need sequential subscription (one after another)?
│   └── concat (fallback chains, ordered operations)
│
├── Need first to emit, ignore the rest?
│   └── race (timeout patterns, fastest source wins)
│
└── Need paired values from each source in order?
    └── zip (coordinate lockstep emissions -- rarely needed)
```
