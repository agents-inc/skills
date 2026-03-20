# RxJS Subjects Examples

> Subject types, multicasting, and state sharing. See [core.md](core.md) for basics.

**Prerequisites**: Understand Observable creation and subscription from core examples first.

---

## Subject

A plain Subject has no initial value and does not replay past emissions to new subscribers.

### Good Example - Event Bus

```typescript
import { Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

interface AppEvent {
  type: string;
  payload: unknown;
}

// Event bus pattern -- multicast events to multiple listeners
const eventBus$ = new Subject<AppEvent>();

// Listener A: only notification events
eventBus$
  .pipe(filter((e) => e.type === "notification"))
  .subscribe((e) => showNotification(e.payload as string));

// Listener B: only error events
eventBus$
  .pipe(filter((e) => e.type === "error"))
  .subscribe((e) => logError(e.payload));

// Emit events
eventBus$.next({ type: "notification", payload: "File saved" });
eventBus$.next({ type: "error", payload: new Error("Network timeout") });
```

**Why good:** Subject acts as central event hub, subscribers filter for relevant events, decouples producers from consumers

---

## BehaviorSubject

Stores current value, replays latest to new subscribers, requires initial value.

### Good Example - Current State Holder

```typescript
import { BehaviorSubject } from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";

type Theme = "light" | "dark";
const DEFAULT_THEME: Theme = "light";

const theme$ = new BehaviorSubject<Theme>(DEFAULT_THEME);

// New subscribers immediately get the current value
theme$.subscribe((t) => console.log("Theme:", t)); // immediately: "light"

// Update
theme$.next("dark"); // subscriber receives: "dark"

// Synchronous access (use sparingly -- prefer reactive subscription)
const currentTheme = theme$.getValue(); // "dark"

// Derived observable
const isDark$ = theme$.pipe(
  map((t) => t === "dark"),
  distinctUntilChanged(),
);
```

**Why good:** `BehaviorSubject` guarantees new subscribers always get a value immediately, perfect for state that always has a current value

### Bad Example - Subject for State

```typescript
// BAD: Subject has no initial value -- late subscribers miss current state
const theme$ = new Subject<Theme>();
theme$.next("dark"); // emitted before anyone subscribes
theme$.subscribe((t) => console.log("Theme:", t)); // silence! missed the emission
```

**Why bad:** new subscribers to a plain `Subject` miss all past emissions, cannot get current state

---

## ReplaySubject

Replays the last N values to new subscribers.

### Good Example - Chat Message History

```typescript
import { ReplaySubject } from "rxjs";

const HISTORY_SIZE = 50;

interface ChatMessage {
  user: string;
  text: string;
  timestamp: Date;
}

const messages$ = new ReplaySubject<ChatMessage>(HISTORY_SIZE);

// Messages arrive over time
messages$.next({ user: "Alice", text: "Hello", timestamp: new Date() });
messages$.next({ user: "Bob", text: "Hi!", timestamp: new Date() });

// Late subscriber gets the last 50 messages replayed immediately
messages$.subscribe((msg) => {
  renderMessage(msg);
});
```

**Why good:** `ReplaySubject` with buffer size replays recent history to late joiners, ideal for chat, logs, or activity feeds

### Good Example - Time-Windowed ReplaySubject

```typescript
import { ReplaySubject } from "rxjs";

const BUFFER_SIZE = 100;
const WINDOW_MS = 30000; // 30 seconds

// Only replay messages from the last 30 seconds (up to 100)
const recentEvents$ = new ReplaySubject<Event>(BUFFER_SIZE, WINDOW_MS);
```

**Why good:** time window prevents unbounded memory growth for high-frequency streams

---

## AsyncSubject

Emits only the last value, and only when the Observable completes.

### Good Example - Final Computation Result

```typescript
import { AsyncSubject } from "rxjs";

const result$ = new AsyncSubject<number>();

result$.subscribe((v) => console.log("Result:", v)); // nothing yet

result$.next(10); // no emission
result$.next(20); // no emission
result$.next(30); // no emission
result$.complete(); // NOW subscriber receives: 30
```

**Why good:** `AsyncSubject` is useful when only the final value matters (similar to a Promise that resolves once)

---

## Multicasting with shareReplay

### Good Example - Shared HTTP Response

```typescript
import { defer, from } from "rxjs";
import { shareReplay, map } from "rxjs/operators";

const CACHE_SIZE = 1;

// Without shareReplay: each subscriber triggers a separate HTTP request
// With shareReplay: one request, result shared to all subscribers
const config$ = defer(() =>
  from(fetch("/api/config").then((r) => r.json())),
).pipe(shareReplay({ bufferSize: CACHE_SIZE, refCount: true }));

// Both subscribers share the same HTTP response
config$.pipe(map((c) => c.theme)).subscribe((theme) => applyTheme(theme));
config$.pipe(map((c) => c.locale)).subscribe((locale) => setLocale(locale));
```

**Why good:** `shareReplay` prevents duplicate HTTP requests, `refCount: true` ensures the source is unsubscribed when all subscribers leave

### Bad Example - shareReplay without refCount

```typescript
// BAD: without refCount, the source is never unsubscribed
const config$ = source$.pipe(
  shareReplay(1), // shorthand -- refCount defaults to false!
);
// Even after all subscribers unsubscribe, the source Observable keeps running
```

**Why bad:** without `refCount: true`, the source subscription persists indefinitely, causing memory leaks for long-lived sources

---

## Subject Type Decision Framework

```
Need to multicast values?
│
├── Need an initial/current value always available?
│   └── YES → BehaviorSubject (state, settings, current user)
│
├── Need to replay N past values to late subscribers?
│   └── YES → ReplaySubject (chat history, event log, recent notifications)
│
├── Only need the FINAL value after completion?
│   └── YES → AsyncSubject (final computation, aggregated result)
│
└── No replay, no initial value needed?
    └── Subject (event bus, action dispatcher, one-way notifications)
```
