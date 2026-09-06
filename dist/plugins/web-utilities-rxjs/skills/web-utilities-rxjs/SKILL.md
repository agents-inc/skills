---
name: web-utilities-rxjs
description: Reactive programming with RxJS - Observables, operators, Subjects, error handling, and memory leak prevention
---

# RxJS Reactive Programming Patterns

> **Quick Guide:** RxJS composes async work as streams. Observables are lazy — nothing runs until
> `subscribe()` — and operators inside `pipe()` describe a pipeline rather than execute one. Three
> decisions carry most of the weight: which flattening operator (`switchMap` cancels, `mergeMap`
> parallelises, `concatMap` queues, `exhaustMap` ignores), where `catchError` sits (inside the inner
> pipe, or an error kills the outer stream permanently), and how the subscription ends. Suffix
> observable variables with `$`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — creation, lazy execution with `defer`, transformation, error recovery, Promise interop
- [examples/higher-order.md](examples/higher-order.md) — `switchMap`, `mergeMap`, `concatMap`, `exhaustMap` worked through
- [examples/subjects.md](examples/subjects.md) — the four Subject types, multicasting, `shareReplay`
- [examples/combination.md](examples/combination.md) — `combineLatest`, `forkJoin`, `merge`, `concat`, `race`
- [examples/memory-leaks.md](examples/memory-leaks.md) — the `takeUntil` pattern, subscription collections, self-completing streams
- [reference.md](reference.md) — operator tables, scenario-to-operator lookup, deprecations

---

## Which path applies

Cleanup is the branch, and it is decided by whether the source ends on its own.

- **The source completes by itself** — `of`, `from`, a wrapped Promise, `timer(n)`, a single HTTP response. Nothing to unsubscribe; go straight to [examples/core.md](examples/core.md).
- **The source runs until stopped** — `fromEvent`, `interval`, any `Subject`, a WebSocket. Every subscription needs an ending, and the shapes are in [examples/memory-leaks.md](examples/memory-leaks.md).
- **You need one value out of a stream** — `firstValueFrom` / `lastValueFrom` bridge to `await` and settle the lifetime for you. In [examples/core.md](examples/core.md).

---

<critical_requirements>

## Before writing RxJS code

**Give every long-lived subscription an ending** — `takeUntil` with a destroy Subject, a
`Subscription` collection, or a self-completing operator such as `take` or `first`. A `fromEvent`
or `interval` subscription with no ending outlives whatever created it, holding its closure alive.

**Put `takeUntil` last in the pipe.** Operators only see what precedes them, so a `takeUntil` above
a `switchMap` ends the outer source and leaves the inner Observable running — a leak that looks
like correct cleanup code.

**Put `catchError` inside the inner pipe, not the outer one.** An error propagates to the
subscriber and terminates the chain for good; recovering inside the inner Observable keeps the
outer stream alive for the next value.

**Pick the flattening operator from the concurrency you want** — cancel previous (`switchMap`),
run in parallel (`mergeMap`), queue (`concatMap`), ignore while busy (`exhaustMap`). Defaulting to
`mergeMap` for a search box is how stale responses overwrite fresh ones.

</critical_requirements>

---

**Auto-detection:** RxJS, rxjs, Observable, Subject, BehaviorSubject, ReplaySubject, AsyncSubject,
subscribe, pipe, switchMap, mergeMap, concatMap, exhaustMap, combineLatest, forkJoin,
withLatestFrom, fromEvent, defer, interval, timer, catchError, retry, debounceTime, throttleTime,
distinctUntilChanged, takeUntil, shareReplay, firstValueFrom, lastValueFrom, Subscription

**Applies to:**

- Event streams that need composition — debounce, throttle, buffer, distinct
- Coordinating several async sources — combine, fork-join, race, sequence
- Cancellable work, where a new input should abandon the request in flight
- Real-time data arriving over time — sockets, server-sent events, polling
- Retry and backoff policies expressed as part of the pipeline

**Handled elsewhere:**

- A single request with no stream semantics — `async`/`await` says it in one line, and wrapping it in an Observable buys nothing
- Local component state — a stream is the wrong shape for a value that is simply read and written
- Application state ownership — RxJS carries values between places; deciding where they live is a separate concern
- Framework binding — converting a stream into whatever the view layer renders is that layer's own API

---

<philosophy>

Everything is a stream: clicks, responses, timers, socket frames. An Observable is a description of
work rather than the work itself, so a `pipe()` chain builds a pipeline and `subscribe()` is what
starts it — which is why a `pipe` with no subscriber does nothing at all, and why the same
Observable subscribed twice usually does its work twice.

That laziness is also the source of the most common surprise: anything eager placed inside the
chain (a `fetch` call evaluated at construction time rather than inside `defer`) escapes the model
and runs once, shared, whether anyone subscribed or not.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Creation, and keeping it lazy

Match the creation function to the source, and wrap anything eager in `defer` so each subscriber
gets its own execution.

```typescript
import {
  of,
  from,
  fromEvent,
  interval,
  timer,
  defer,
  EMPTY,
  throwError,
} from "rxjs";

of(1, 2, 3); // fixed values, then completes
from([1, 2, 3]); // any iterable, then completes
fromEvent(element, "click"); // never completes
interval(1000); // never completes
timer(2000); // one value, then completes

defer(() => from(fetch("/api/users"))); // fresh request per subscriber
from(fetch("/api/users")); // ❌ fires at construction, shared by all
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Operators in a pipe, never a nested subscribe

```typescript
const adults$ = users$.pipe(
  filter((user) => user.age >= 18),
  map((user) => user.name),
  distinctUntilChanged(),
  tap((name) => console.log(name)), // side effects live in tap
);
```

A `.subscribe()` inside a `.subscribe()` creates a subscription nothing holds a reference to, so
nothing can end it — the flattening operators exist to replace exactly this shape.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Error recovery with catchError

```typescript
const results$ = query$.pipe(
  switchMap((query) =>
    defer(() => from(search(query))).pipe(
      retry({ count: 3, delay: (_, n) => timer(1000 * 2 ** (n - 1)) }),
      catchError(() => of({ results: [], failed: true })), // inner — outer survives
    ),
  ),
);
```

`catchError` must return an Observable, and where it sits decides what survives: inside the inner
pipe the outer stream continues, outside it the whole chain ends on the first failure.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Rate limiting

```typescript
// Wait for a pause — user input
input$.pipe(debounceTime(300), distinctUntilChanged());

// Cap the rate — continuous events
fromEvent(window, "scroll").pipe(throttleTime(200));
```

`debounceTime` emits the last value after silence; `throttleTime` emits the first value of each
window and drops the rest. `distinctUntilChanged` after a debounce is what stops a
type-then-undo from re-issuing the same request.

Full code: [examples/higher-order.md](examples/higher-order.md), inside the search pipeline.
Operator comparison: [reference.md](reference.md)

---

### Pattern 5: Flattening operators

The decision is what should happen when a new outer value arrives while the inner Observable is
still running.

```
Cancel the previous inner and switch    → switchMap    (search, navigation)
Run the new one alongside               → mergeMap     (uploads, fire-and-forget)
Queue it until the previous finishes    → concatMap    (ordered saves, message send)
Ignore it until the current one ends    → exhaustMap   (submit, login, refresh)
```

```typescript
query$.pipe(switchMap((q) => search(q)));
files$.pipe(mergeMap((file) => upload(file), 3)); // 3 = concurrency limit
saves$.pipe(concatMap((data) => save(data)));
clicks$.pipe(exhaustMap(() => submit()));
```

Full code: [examples/higher-order.md](examples/higher-order.md)

---

### Pattern 6: Subjects

A Subject is both Observable and Observer, which makes it the way to multicast — and the way to
push values in from imperative code.

```typescript
new Subject<T>(); // no initial value, no replay
new BehaviorSubject<T>(initial); // always has a current value; .getValue()
new ReplaySubject<T>(n, windowMs); // replays the last n (optionally, recent ones)
new AsyncSubject<T>(); // the final value only, and only on complete()
```

`BehaviorSubject` for state that always has a value, `ReplaySubject` for history a late subscriber
needs, `Subject` for events with no past, `AsyncSubject` for one final result.

Full code: [examples/subjects.md](examples/subjects.md)

---

### Pattern 7: Cleanup with takeUntil

```typescript
class Controller {
  private readonly destroy$ = new Subject<void>();

  start(): void {
    source$
      .pipe(
        switchMap((id) => this.load(id)),
        takeUntil(this.destroy$), // last — ends the inner subscription too
      )
      .subscribe((data) => this.render(data));
  }

  stop(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

One `destroy$` ends every subscription that pipes through it. Full code:
[examples/memory-leaks.md](examples/memory-leaks.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- An unhandled error terminates the chain permanently. Every subsequent emission is dropped silently, and the stream cannot be revived — only re-subscribed.
- `catchError` returning a plain value rather than an Observable is a type error; `of(fallback)` is the fix.
- `takeUntil` placed before a higher-order operator ends the outer source and leaves the inner subscription running. The cleanup code reads as correct and the leak is silent.
- Nested `.subscribe()` calls produce subscriptions with no reference, multiplying with each outer emission.
- `firstValueFrom` rejects when the Observable completes without emitting — the deprecated `.toPromise()` resolved `undefined` instead, so a migration changes the failure mode.

**Surprising behaviour:**

- `from(promise)` runs the promise at construction, not at subscription, and every subscriber gets the same settled result. `defer(() => from(promise))` restores laziness.
- `shareReplay(1)` defaults `refCount` to `false`, so the source stays subscribed after the last subscriber leaves. `shareReplay({ bufferSize: 1, refCount: true })` is almost always what was meant.
- `combineLatest` emits nothing until every source has emitted at least once — one silent source stalls the whole combination.
- `forkJoin` emits only when every source _completes_, so a `Subject` or an `interval` in the list means it never emits.
- `retry` re-subscribes to the source from the top, so a non-idempotent source runs its side effects again.
- `interval(0)` is still asynchronous — it schedules, it does not emit synchronously.
- `BehaviorSubject.getValue()` reads the current value without subscribing, which quietly turns reactive code into a poll.
- `mergeMap` where `switchMap` was meant produces a race: responses land out of order and the slowest one wins.

</red_flags>
