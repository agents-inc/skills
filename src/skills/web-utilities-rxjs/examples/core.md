# RxJS Core Examples

> Creation and laziness, transformation, error recovery, and Promise interop. See
> [SKILL.md](../SKILL.md) for the decisions, [memory-leaks.md](memory-leaks.md) for ending
> subscriptions, [higher-order.md](higher-order.md) for flattening.

Everything here imports from `"rxjs"`. Since v7.2 operators are exported from the package root, so
the separate `"rxjs/operators"` path is no longer needed.

---

## Laziness and defer

```typescript
import { defer, from } from "rxjs";

// Fresh request per subscriber
const users$ = defer(() => from(fetch("/api/users").then((r) => r.json())));

users$.subscribe((data) => console.log("A:", data));
users$.subscribe((data) => console.log("B:", data)); // second, independent request
```

```typescript
// ❌ The fetch has already fired by the time this line finishes evaluating
const users$ = from(fetch("/api/users").then((r) => r.json()));

users$.subscribe((data) => console.log("A:", data));
users$.subscribe((data) => console.log("B:", data)); // same settled promise
```

The second form is not merely inefficient — it breaks the model. `retry` cannot re-run it, a
`switchMap` cannot cancel it, and it runs whether or not anyone ever subscribes.

---

## Transformation

`scan` emits every intermediate accumulation; `reduce` emits once, on completion. On a source that
never completes, `reduce` never emits at all.

```typescript
import { from, scan, reduce, filter } from "rxjs";

interface Transaction {
  amount: number;
  type: "credit" | "debit";
}

const transactions$ = from<Transaction[]>([
  { amount: 100, type: "credit" },
  { amount: 30, type: "debit" },
  { amount: 50, type: "credit" },
]);

// Running balance — one emission per transaction
const balance$ = transactions$.pipe(
  scan(
    (total, tx) =>
      tx.type === "credit" ? total + tx.amount : total - tx.amount,
    0,
  ),
);
// 100, 70, 120

// Final total — one emission, on complete
const credits$ = transactions$.pipe(
  filter((tx) => tx.type === "credit"),
  reduce((total, tx) => total + tx.amount, 0),
);
// 150
```

---

## Error Recovery

```typescript
import {
  defer,
  from,
  of,
  timer,
  EMPTY,
  catchError,
  retry,
  switchMap,
} from "rxjs";

// Fall back to a usable value
const config$ = defer(() =>
  from(fetch("/api/config").then((r) => r.json())),
).pipe(
  retry(3),
  catchError(() => of({ theme: "default", lang: "en" })),
);

// Exponential backoff, then give up quietly
const data$ = defer(() => from(fetch("/api/data"))).pipe(
  retry({
    count: 3,
    delay: (_error, attempt) => timer(1000 * 2 ** (attempt - 1)), // 1s, 2s, 4s
  }),
  catchError(() => EMPTY), // completes without emitting
);

// The important one: recover inside the inner pipe
const search$ = query$.pipe(
  switchMap((query) =>
    defer(() => from(search(query))).pipe(
      catchError(() => of({ results: [], failed: true })),
    ),
  ),
);
```

Move that inner `catchError` outside the `switchMap` and the first network failure ends `search$`
for the lifetime of the page — no error, no further searches, nothing in the console.

`retry` re-subscribes to the source, so the source must be safe to run again. A `defer` wrapping a
`POST` will re-send it.

---

## Utility Operators

```typescript
import { tap, timeout, finalize } from "rxjs";

const data$ = source$.pipe(
  tap({
    next: (value) => console.log("value", value),
    error: (error) => console.error(error), // tap sees errors without handling them
  }),
  timeout(10_000), // throws TimeoutError if 10s pass with no emission
  finalize(() => setLoading(false)), // runs on complete, error and unsubscribe
);
```

`finalize` is the only one of the three that runs on unsubscription as well as completion, which
makes it the right place for teardown that must happen however the stream ended.

---

## Promise Interop

```typescript
import { firstValueFrom, lastValueFrom, toArray } from "rxjs";

// First emission, then unsubscribe
const user = await firstValueFrom(loadUser(id));

// Everything, once the stream completes
const allLogs = await lastValueFrom(logStream$.pipe(toArray()));

// Both reject when the Observable completes without emitting.
// Supply a default rather than catching, where empty is legitimate:
const settings = await firstValueFrom(settings$, { defaultValue: DEFAULTS });
```

`lastValueFrom` on a source that never completes never settles — the promise simply hangs, holding
the subscription open. Use `firstValueFrom`, or bound the stream with `take`.

The deprecated `.toPromise()` resolved `undefined` for an empty Observable rather than rejecting,
so a codebase migrating from it gains a rejection where it previously got a silent `undefined`.
