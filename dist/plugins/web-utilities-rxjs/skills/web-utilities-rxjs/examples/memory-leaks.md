# RxJS Memory Leak Prevention Examples

> Unsubscription patterns, takeUntil, and cleanup strategies. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand Observable creation and subscription from core examples first.

---

## The takeUntil Pattern

The standard approach for cleaning up multiple subscriptions with a single destroy signal.

### Good Example - Service with Multiple Subscriptions

```typescript
import { Subject, interval, fromEvent, merge } from "rxjs";
import {
  takeUntil,
  switchMap,
  debounceTime,
  map,
  filter,
} from "rxjs/operators";

const POLL_INTERVAL_MS = 30000;
const RESIZE_DEBOUNCE_MS = 200;

class DashboardController {
  private readonly destroy$ = new Subject<void>();

  initialize(): void {
    // All subscriptions share the same destroy signal
    interval(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.fetchData()),
        takeUntil(this.destroy$), // LAST in pipe
      )
      .subscribe((data) => this.updateDashboard(data));

    fromEvent(window, "resize")
      .pipe(
        debounceTime(RESIZE_DEBOUNCE_MS),
        map(() => ({ width: window.innerWidth, height: window.innerHeight })),
        takeUntil(this.destroy$), // LAST in pipe
      )
      .subscribe((size) => this.handleResize(size));

    this.websocketMessages$
      .pipe(
        filter((msg) => msg.type === "update"),
        takeUntil(this.destroy$), // LAST in pipe
      )
      .subscribe((msg) => this.handleUpdate(msg));
  }

  cleanup(): void {
    this.destroy$.next(); // signals all takeUntil operators
    this.destroy$.complete(); // prevents further use
  }
}
```

**Why good:** single `destroy$` Subject cleans up ALL subscriptions at once, `takeUntil` is always last in the pipe chain

---

## Critical: takeUntil Placement

### Good Example - takeUntil AFTER Higher-Order Operators

```typescript
// ✅ CORRECT: takeUntil AFTER switchMap
source$
  .pipe(
    switchMap((id) => this.fetchDetails(id)), // inner Observable
    takeUntil(this.destroy$), // cleans up BOTH outer and inner
  )
  .subscribe();
```

**Why good:** `takeUntil` after `switchMap` unsubscribes from both the outer source and any active inner Observable

### Bad Example - takeUntil BEFORE Higher-Order Operators

```typescript
// ❌ WRONG: takeUntil BEFORE switchMap
source$
  .pipe(
    takeUntil(this.destroy$), // only unsubscribes outer source
    switchMap((id) => this.longRunningRequest(id)), // inner Observable survives!
  )
  .subscribe();
```

**Why bad:** the inner Observable created by `switchMap` is NOT affected by `takeUntil` because `takeUntil` only operates on what comes before it in the pipe chain -- the inner subscription continues running after cleanup

---

## Subscription Collection

Alternative approach when you need fine-grained control.

### Good Example - Subscription Object

```typescript
import { Subscription, interval, fromEvent } from "rxjs";

const POLL_INTERVAL_MS = 5000;

class WidgetController {
  private readonly subscriptions = new Subscription();

  initialize(): void {
    // .add() collects subscriptions for batch unsubscribe
    this.subscriptions.add(
      interval(POLL_INTERVAL_MS).subscribe(() => this.refresh()),
    );

    this.subscriptions.add(
      fromEvent(this.element, "click").subscribe(() => this.handleClick()),
    );
  }

  cleanup(): void {
    this.subscriptions.unsubscribe(); // unsubscribes all collected
  }
}
```

**Why good:** `Subscription.add()` collects multiple subscriptions, single `.unsubscribe()` cleans up all

---

## Auto-Completing Operators

Some operators automatically complete the Observable, removing the need for manual cleanup.

### Good Example - Self-Completing Patterns

```typescript
import { interval, fromEvent, timer } from "rxjs";
import { take, first, takeWhile } from "rxjs/operators";

const MAX_ITEMS = 10;
const INTERVAL_MS = 1000;
const TIMEOUT_MS = 5000;

// take(n) - complete after N emissions
interval(INTERVAL_MS).pipe(take(MAX_ITEMS)).subscribe(); // auto-completes after 10 emissions

// first() - complete after first emission (or first matching)
fromEvent(document, "click").pipe(first()).subscribe(); // auto-completes after first click

// first with predicate - complete on first match
fromEvent<KeyboardEvent>(document, "keydown")
  .pipe(first((e) => e.key === "Enter"))
  .subscribe(); // auto-completes on first Enter press

// takeWhile - complete when predicate becomes false
const countdown$ = interval(INTERVAL_MS).pipe(
  takeWhile((count) => count < MAX_ITEMS),
);

// timer - single emission then completes
timer(TIMEOUT_MS).subscribe(); // emits 0 after 5s, then completes
```

**Why good:** auto-completing operators eliminate the need for manual unsubscription, reducing cleanup code

---

## Observables That Don't Need Unsubscription

Not all Observables need explicit cleanup:

```typescript
// ✅ These auto-complete (safe without unsubscribe):
of(1, 2, 3); // finite values, completes after last
from([1, 2, 3]); // finite iterable, completes after last
from(fetch("/api/data")); // HTTP request, completes after response
timer(1000); // single emission, completes
ajax("/api/data"); // single HTTP response, completes

// ❌ These run forever (MUST unsubscribe):
interval(1000); // emits every second forever
fromEvent(el, "click"); // listens forever
new Subject(); // never completes unless you call .complete()
webSocket("ws://..."); // stays connected
```

**Why good:** knowing which Observables auto-complete saves unnecessary cleanup code while ensuring infinite streams are always cleaned up
