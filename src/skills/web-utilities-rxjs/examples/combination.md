# RxJS Combination Examples

> `combineLatest`, `forkJoin`, `merge`, `concat`, `race` and `withLatestFrom`. See
> [SKILL.md](../SKILL.md) for the decisions and [reference.md](../reference.md) for the
> completion-semantics table.

---

## combineLatest — latest from each, on any emission

```typescript
import { combineLatest, map } from "rxjs";

const dashboard$ = combineLatest([currentUser$, notifications$, stats$]).pipe(
  map(([user, notifications, stats]) => ({ user, notifications, stats })),
);
```

Nothing is emitted until _every_ source has emitted at least once, so one source that starts silent
stalls the whole combination — and it does so without an error, which makes a blank dashboard the
only symptom. `BehaviorSubject` sources, or `startWith` on the quiet one, are the two fixes.

Every emission from any source produces an output, so a fast source drives re-computation of the
whole tuple. `distinctUntilChanged` on the mapped result, or `auditTime` before the map, is what
keeps that in hand.

---

## forkJoin — parallel, then once

```typescript
import { forkJoin, defer, from, of, catchError } from "rxjs";

const pageData$ = forkJoin({
  user: defer(() => from(fetch("/api/user").then((r) => r.json()))),
  posts: defer(() => from(fetch("/api/posts").then((r) => r.json()))),
  comments: defer(() => from(fetch("/api/comments").then((r) => r.json()))),
});
```

The object form names the results, which beats destructuring a positional array of three unrelated
things. `Promise.all` is the accurate analogy, including the failure mode: one source erroring
loses the results of the others. Per-source recovery is the fix.

```typescript
const resilient$ = forkJoin({
  user: userRequest$.pipe(catchError(() => of(null))),
  posts: postsRequest$.pipe(catchError(() => of([]))),
});
```

`forkJoin` waits for completion, not emission. A `Subject`, a `fromEvent` or an `interval` in the
list means it never emits at all.

---

## merge — interleave as they arrive

```typescript
import { merge, fromEvent, map } from "rxjs";

const activity$ = merge(
  fromEvent(document, "keydown").pipe(map(() => "keyboard" as const)),
  fromEvent(document, "mousemove").pipe(map(() => "mouse" as const)),
  fromEvent(document, "touchstart").pipe(map(() => "touch" as const)),
);
```

All sources are subscribed at once and values pass through in arrival order. Mapping each branch to
a discriminated shape before merging is what keeps the result usable — otherwise the subscriber
cannot tell which source a value came from.

---

## concat — one source at a time

```typescript
import { concat, of, defer, from, EMPTY, catchError, take } from "rxjs";

const data$ = concat(
  defer(() => of(readCache(key))).pipe(catchError(() => EMPTY)),
  defer(() => from(fetch("/api/data").then((r) => r.json()))).pipe(
    catchError(() => EMPTY),
  ),
  of({ fallback: true }),
).pipe(take(1));
```

Each source is subscribed only after the previous completes, so `catchError(() => EMPTY)` turns a
failure into "move on" and `take(1)` stops at the first success. The `defer` on each tier is what
prevents the later ones from running before their turn.

A source that never completes blocks everything after it permanently.

---

## race — first to emit wins

```typescript
import { race, timer, defer, from, map } from "rxjs";

const withTimeout$ = race(
  defer(() => from(fetch("/api/slow").then((r) => r.json()))),
  timer(5000).pipe(map(() => ({ error: "timeout" as const, data: null }))),
);
```

The losing sources are unsubscribed. Compared with the `timeout` operator this returns a value
instead of throwing, which suits a fallback; `timeout` suits a genuine error path.

---

## withLatestFrom — one primary, others as context

```typescript
import { withLatestFrom, map } from "rxjs";

const submit$ = saveClicks$.pipe(
  withLatestFrom(formValue$, currentUser$),
  map(([, form, user]) => ({ ...form, updatedBy: user.id })),
);
```

Only the primary source triggers an emission; the others contribute their most recent value. This
is the operator to reach for whenever a `getValue()` was about to be written inside a callback —
and like `combineLatest`, it emits nothing until every secondary source has produced a value.
