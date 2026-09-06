# RxJS Subscription Lifetime Examples

> Ending subscriptions: `takeUntil`, subscription collections, and the streams that end themselves.
> See [SKILL.md](../SKILL.md) for which path applies.

---

## Which Sources Need an Ending

```typescript
// Complete on their own — nothing to clean up
of(1, 2, 3);
from([1, 2, 3]);
from(fetch("/api/data")); // one response, then complete
timer(1000); // one emission, then complete

// Run until stopped — every subscription needs an ending
interval(1000);
fromEvent(element, "click");
new Subject(); // until .complete()
webSocket("wss://…");
```

A `take`, `first`, `takeWhile` or `takeUntil` anywhere in the pipe moves a source from the second
list to the first, which is why the cheapest cleanup is often an operator rather than a teardown
hook.

---

## The takeUntil Pattern

One destroy signal ends every subscription that pipes through it.

```typescript
import {
  Subject,
  interval,
  fromEvent,
  takeUntil,
  switchMap,
  debounceTime,
  map,
} from "rxjs";

class DashboardController {
  private readonly destroy$ = new Subject<void>();

  start(): void {
    interval(30_000)
      .pipe(
        switchMap(() => this.fetchData()),
        takeUntil(this.destroy$), // last
      )
      .subscribe((data) => this.update(data));

    fromEvent(window, "resize")
      .pipe(
        debounceTime(200),
        map(() => ({ width: window.innerWidth, height: window.innerHeight })),
        takeUntil(this.destroy$), // last
      )
      .subscribe((size) => this.resize(size));
  }

  stop(): void {
    this.destroy$.next(); // every takeUntil above completes
    this.destroy$.complete(); // and the Subject itself is released
  }
}
```

The `complete()` matters as much as the `next()`: without it the Subject stays alive holding
references, and a later `next()` on a controller that has already stopped silently does nothing.

---

## Placement Is the Whole Trick

```typescript
// ✅ takeUntil last — the outer source AND the inner Observable both end
source$
  .pipe(
    switchMap((id) => this.fetchDetails(id)),
    takeUntil(this.destroy$),
  )
  .subscribe();

// ❌ takeUntil first — the outer source ends, the inner request runs to completion
source$
  .pipe(
    takeUntil(this.destroy$),
    switchMap((id) => this.longRunningRequest(id)),
  )
  .subscribe();
```

An operator only sees what precedes it. In the second form `takeUntil` unsubscribes from
`source$` and never learns that `switchMap` created a subscription downstream of it — so the
request completes, its handler runs, and it does so against a controller that has already torn
down. Nothing errors, which is why this survives review.

The rule generalises: `takeUntil` goes after every higher-order operator in the chain, which in
practice means last.

---

## Subscription Collections

```typescript
import { Subscription, interval, fromEvent } from "rxjs";

class WidgetController {
  private readonly subscriptions = new Subscription();

  start(): void {
    this.subscriptions.add(interval(5000).subscribe(() => this.refresh()));
    this.subscriptions.add(
      fromEvent(this.element, "click").subscribe(() => this.click()),
    );
  }

  stop(): void {
    this.subscriptions.unsubscribe();
  }
}
```

Equivalent in effect, and it does not need a `takeUntil` on each pipe. The catch is that a
`Subscription` cannot be reused: after `unsubscribe()`, anything added to it is unsubscribed
immediately, so a controller that restarts needs a fresh one.

---

## Self-Completing Operators

```typescript
import { interval, fromEvent, take, first, takeWhile } from "rxjs";

interval(1000).pipe(take(10)).subscribe(); // ends after 10 emissions
fromEvent(document, "click").pipe(first()).subscribe(); // ends after the first click

fromEvent<KeyboardEvent>(document, "keydown")
  .pipe(first((event) => event.key === "Enter"))
  .subscribe();

interval(1000)
  .pipe(takeWhile((count) => count < 10))
  .subscribe();
```

`first()` errors with `EmptyError` when the source completes before matching, where `take(1)`
simply completes. Where "no match" is a normal outcome, `take(1)` is the one that does not need a
handler.
