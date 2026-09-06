# RxJS Subject Examples

> The four Subject types and multicasting with `shareReplay`. See [SKILL.md](../SKILL.md) for
> choosing between them and [memory-leaks.md](memory-leaks.md) for ending them.

A Subject never completes on its own, so every one of these needs a `complete()` or a subscription
that ends some other way.

---

## Subject — events with no past

```typescript
import { Subject, filter } from "rxjs";

interface AppEvent {
  type: string;
  payload: unknown;
}

const events$ = new Subject<AppEvent>();

events$.pipe(filter((e) => e.type === "notification")).subscribe(show);
events$.pipe(filter((e) => e.type === "error")).subscribe(logError);

events$.next({ type: "notification", payload: "File saved" });
```

Values emitted before a subscriber arrives are gone. That is correct for events — a notification
nobody was listening for should not fire late — and wrong for state, where a late subscriber needs
the current value.

---

## BehaviorSubject — state with a current value

```typescript
import { BehaviorSubject, map, distinctUntilChanged } from "rxjs";

type Theme = "light" | "dark";

const theme$ = new BehaviorSubject<Theme>("light");

theme$.subscribe((theme) => apply(theme)); // fires immediately with "light"
theme$.next("dark"); // subscriber receives "dark"

const isDark$ = theme$.pipe(
  map((theme) => theme === "dark"),
  distinctUntilChanged(),
);
```

`theme$.getValue()` reads the current value synchronously. It is the escape hatch, and each use is
a place where the code stopped being reactive — a `getValue()` inside a callback is usually a
`withLatestFrom` waiting to be written.

Expose a `BehaviorSubject` as `theme$.asObservable()` where callers should not be able to `next()`
into it.

---

## ReplaySubject — history for late subscribers

```typescript
import { ReplaySubject } from "rxjs";

interface ChatMessage {
  user: string;
  text: string;
  timestamp: Date;
}

const messages$ = new ReplaySubject<ChatMessage>(50);
messages$.subscribe(render); // receives the last 50 immediately

// Bounded by time as well as count — the second argument is a window in ms
const recent$ = new ReplaySubject<Event>(100, 30_000);
```

The buffer is held for the lifetime of the Subject, so an unbounded `new ReplaySubject()` on a
high-frequency source retains every value ever emitted. Give it a count, a window, or both.

---

## AsyncSubject — one final value

```typescript
import { AsyncSubject } from "rxjs";

const result$ = new AsyncSubject<number>();

result$.subscribe(console.log); // silent so far
result$.next(10);
result$.next(20);
result$.complete(); // now: 20
```

Nothing is emitted without the `complete()`, which makes a forgotten `complete()` an invisible
hang rather than an error.

---

## shareReplay — one execution, many subscribers

```typescript
import { defer, from, shareReplay, map } from "rxjs";

const config$ = defer(() =>
  from(fetch("/api/config").then((r) => r.json())),
).pipe(shareReplay({ bufferSize: 1, refCount: true }));

config$.pipe(map((c) => c.theme)).subscribe(applyTheme);
config$.pipe(map((c) => c.locale)).subscribe(setLocale); // same response, no second request
```

```typescript
// ❌ The shorthand defaults refCount to false
const config$ = source$.pipe(shareReplay(1));
// The source stays subscribed after the last subscriber leaves — for an
// `interval` or a socket, it keeps running for the lifetime of the process
```

The trade `refCount: true` makes is that once every subscriber leaves, the next one re-runs the
source. For a config fetch that is usually right. Where the value must be fetched exactly once and
cached forever, `refCount: false` is the deliberate choice rather than the default you forgot to
change.
