# RxJS Core Examples

> Observable creation, subscription, basic operators, and error handling. See [SKILL.md](../SKILL.md) for core concepts.

---

## Observable Creation

### Good Example - defer for Lazy Execution

```typescript
import { defer, from, of, timer, EMPTY } from "rxjs";
import { switchMap, catchError, retry } from "rxjs/operators";

const MAX_RETRIES = 3;

// defer ensures a fresh fetch per subscriber
const users$ = defer(() => from(fetch("/api/users").then((r) => r.json())));

// Each subscription triggers a new HTTP request
users$.subscribe((data) => console.log("Subscriber A:", data));
users$.subscribe((data) => console.log("Subscriber B:", data)); // independent request
```

**Why good:** `defer` wraps the factory so each subscriber gets a fresh `fetch` call, no shared/stale promises

### Bad Example - Shared Promise

```typescript
// BAD: fetch fires immediately when Observable is created
const users$ = from(fetch("/api/users").then((r) => r.json()));

// Both subscribers share the same promise result
users$.subscribe((data) => console.log("A:", data));
users$.subscribe((data) => console.log("B:", data)); // same stale data
```

**Why bad:** `from(promise)` evaluates the promise eagerly, both subscribers get the same cached result

---

## Subscription Management

### Good Example - Explicit Unsubscribe

```typescript
import { interval } from "rxjs";

const POLL_INTERVAL_MS = 5000;
const poll$ = interval(POLL_INTERVAL_MS);

const subscription = poll$.subscribe((count) => {
  console.log("Poll:", count);
});

// Later: clean up
subscription.unsubscribe();
```

**Why good:** explicit unsubscription prevents the interval from running forever

### Good Example - Using take for Auto-Complete

```typescript
import { interval } from "rxjs";
import { take } from "rxjs/operators";

const EMISSION_COUNT = 5;
const INTERVAL_MS = 1000;

// Automatically completes after 5 emissions -- no manual unsubscribe needed
const fiveValues$ = interval(INTERVAL_MS).pipe(take(EMISSION_COUNT));

fiveValues$.subscribe({
  next: (v) => console.log(v), // 0, 1, 2, 3, 4
  complete: () => console.log("Done"),
});
```

**Why good:** `take` auto-completes the Observable, no cleanup code required

---

## Transformation Operators

### Good Example - map, filter, scan

```typescript
import { from } from "rxjs";
import { map, filter, scan, reduce } from "rxjs/operators";

interface Transaction {
  amount: number;
  type: "credit" | "debit";
}

const INITIAL_BALANCE = 0;

const transactions$ = from<Transaction[]>([
  { amount: 100, type: "credit" },
  { amount: 30, type: "debit" },
  { amount: 50, type: "credit" },
  { amount: 20, type: "debit" },
]);

// Running balance with scan (emits each intermediate value)
const balance$ = transactions$.pipe(
  scan((balance, tx) => {
    return tx.type === "credit" ? balance + tx.amount : balance - tx.amount;
  }, INITIAL_BALANCE),
);
// Emits: 100, 70, 120, 100

// Final total with reduce (emits only final value on complete)
const total$ = transactions$.pipe(
  filter((tx) => tx.type === "credit"),
  reduce((sum, tx) => sum + tx.amount, INITIAL_BALANCE),
);
// Emits: 150 (then completes)
```

**Why good:** `scan` for running accumulation (reactive), `reduce` for final value, clear type annotations

---

## Error Handling

### Good Example - catchError with Recovery

```typescript
import { of, from, defer, timer, EMPTY } from "rxjs";
import { catchError, retry, switchMap } from "rxjs/operators";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Pattern 1: Fallback value
const withFallback$ = defer(() => from(fetch("/api/config"))).pipe(
  retry(MAX_RETRIES),
  catchError((error) => {
    console.error("Config fetch failed:", error);
    return of({ theme: "default", lang: "en" }); // fallback config
  }),
);

// Pattern 2: Exponential backoff retry
const withBackoff$ = defer(() => from(fetch("/api/data"))).pipe(
  retry({
    count: MAX_RETRIES,
    delay: (_error, retryCount) =>
      timer(RETRY_DELAY_MS * Math.pow(2, retryCount - 1)),
  }),
  catchError(() => EMPTY), // silently complete on exhausted retries
);

// Pattern 3: Error in inner Observable (most common)
const search$ = searchQuery$.pipe(
  switchMap((query) =>
    defer(() => from(fetch(`/api/search?q=${query}`))).pipe(
      catchError((error) => {
        console.error("Search failed:", error);
        return of({ results: [], error: true }); // inner fallback
      }),
    ),
  ),
);
```

**Why good:** `catchError` inside the inner Observable keeps the outer stream alive, exponential backoff prevents server hammering

### Bad Example - Error Kills the Stream

```typescript
// BAD: no error handling -- one failure terminates everything
const search$ = searchQuery$.pipe(
  switchMap((query) => from(fetch(`/api/search?q=${query}`))),
);
// After first network error, search$ is dead forever -- no more searches
```

**Why bad:** unhandled error in the Observable chain causes permanent termination, subsequent emissions are silently dropped

---

## Utility Operators

### Good Example - tap, delay, finalize

```typescript
import { tap, delay, finalize, timeout } from "rxjs/operators";

const REQUEST_TIMEOUT_MS = 10000;

const data$ = source$.pipe(
  tap((v) => console.log("Before transform:", v)), // side effect: logging
  map((v) => v * 2),
  timeout(REQUEST_TIMEOUT_MS), // throw TimeoutError if no emission in 10s
  finalize(() => console.log("Stream completed or errored")), // always runs
);
```

**Why good:** `tap` for logging without affecting the stream, `timeout` prevents hanging streams, `finalize` for guaranteed cleanup regardless of how stream ends

---

## firstValueFrom and lastValueFrom

### Good Example - Converting Observable to Promise

```typescript
import { firstValueFrom, lastValueFrom } from "rxjs";

// When you need a single value from an Observable (e.g., in async/await code)
async function getUser(id: string): Promise<User> {
  return firstValueFrom(userService.getUser(id));
  // Rejects if Observable completes without emitting
}

// Last emitted value before completion
async function getAllLogs(): Promise<string[]> {
  return lastValueFrom(logStream$.pipe(toArray()));
}
```

**Why good:** `firstValueFrom`/`lastValueFrom` (v7+) bridge Observable to Promise for interop with `async`/`await`, reject on empty Observable unlike deprecated `.toPromise()`

### Bad Example - Using Deprecated toPromise

```typescript
// BAD: toPromise is deprecated in RxJS 7, resolves undefined for empty Observable
const data = await source$.toPromise();
```

**Why bad:** `.toPromise()` is deprecated, resolves `undefined` if Observable completes empty instead of rejecting
