# RxJS Quick Reference

> Decision frameworks, operator cheat sheet, and anti-patterns. See [SKILL.md](SKILL.md) for core concepts.

---

## Operator Quick Reference

### Creation Operators

| Operator     | Purpose                              | Auto-completes? |
| ------------ | ------------------------------------ | --------------- |
| `of`         | Emit fixed values                    | Yes             |
| `from`       | Array, iterable, Promise, Observable | Yes             |
| `fromEvent`  | DOM or Node.js events                | No              |
| `interval`   | Emit incrementing number on timer    | No              |
| `timer`      | Delay then emit (single or interval) | Single: Yes     |
| `defer`      | Lazy factory per subscriber          | Depends         |
| `EMPTY`      | Complete immediately                 | Yes             |
| `NEVER`      | Never emit, never complete           | No              |
| `throwError` | Emit error immediately               | N/A (errors)    |

### Transformation Operators

| Operator     | Purpose                                            |
| ------------ | -------------------------------------------------- |
| `map`        | Transform each value                               |
| `scan`       | Running accumulator (like reduce + emit each step) |
| `reduce`     | Accumulate to single value on complete             |
| `pluck`      | Extract property (deprecated v7.5 -- use `map`)    |
| `toArray`    | Collect all values into array on complete          |
| `buffer`     | Collect values until notifier emits                |
| `bufferTime` | Collect values for a time window                   |

### Filtering Operators

| Operator               | Purpose                         |
| ---------------------- | ------------------------------- |
| `filter`               | Keep values matching predicate  |
| `take`                 | Take first N, then complete     |
| `takeUntil`            | Take until notifier emits       |
| `takeWhile`            | Take while predicate true       |
| `skip`                 | Skip first N values             |
| `first`                | First value (or first matching) |
| `last`                 | Last value before complete      |
| `debounceTime`         | Wait for silence, emit last     |
| `throttleTime`         | Limit emission rate             |
| `distinctUntilChanged` | Skip consecutive duplicates     |
| `auditTime`            | Emit latest after each interval |
| `sampleTime`           | Sample at regular intervals     |

### Higher-Order Mapping

| Operator     | Inner Subscription Behavior   | Use Case                   |
| ------------ | ----------------------------- | -------------------------- |
| `switchMap`  | Cancel previous inner         | Search, navigation, latest |
| `mergeMap`   | All run in parallel           | Uploads, batch ops         |
| `concatMap`  | Queue, one at a time          | Sequential saves, ordering |
| `exhaustMap` | Ignore new while current runs | Login, form submit         |

### Combination Operators

| Operator         | Behavior                                         | Completes When        |
| ---------------- | ------------------------------------------------ | --------------------- |
| `combineLatest`  | Latest from each on any emission                 | All complete          |
| `forkJoin`       | Last value from each, only on all complete       | All complete          |
| `merge`          | Interleave emissions from all                    | All complete          |
| `concat`         | Sequential subscription                          | Last source completes |
| `race`           | First to emit wins, others unsubscribed          | Winner completes      |
| `zip`            | Pair Nth emission from each source               | Any completes         |
| `withLatestFrom` | Combine primary emission with latest from others | Primary completes     |

### Error Handling

| Operator     | Purpose                                    |
| ------------ | ------------------------------------------ |
| `catchError` | Catch and replace with fallback Observable |
| `retry`      | Re-subscribe on error (count or config)    |
| `finalize`   | Run cleanup on complete OR error           |
| `timeout`    | Error if no emission within time           |

---

## Flattening Operator Cheat Sheet

```
switchMap  = Cancel + Switch   → "I only care about the latest"
mergeMap   = Merge + Keep All  → "Process everything in parallel"
concatMap  = Queue + Wait      → "One at a time, in order"
exhaustMap = Ignore + Busy     → "Ignore until I'm done"
```

**Real-World Mapping:**

| Scenario            | Operator       | Why                                     |
| ------------------- | -------------- | --------------------------------------- |
| Type-ahead search   | `switchMap`    | Cancel previous search on new keystroke |
| Route navigation    | `switchMap`    | Cancel previous route's data load       |
| File upload (batch) | `mergeMap(,3)` | Upload in parallel with limit           |
| Logging/analytics   | `mergeMap`     | Fire-and-forget, order irrelevant       |
| Form auto-save      | `concatMap`    | Saves must complete in order            |
| Chat message send   | `concatMap`    | Messages must arrive in order           |
| Login button        | `exhaustMap`   | Ignore clicks while authenticating      |
| Refresh button      | `exhaustMap`   | Ignore while data is loading            |

---

## Common Anti-Patterns

### Nested Subscriptions

```typescript
// ❌ NEVER nest .subscribe() calls
outer$.subscribe((a) => {
  inner$.subscribe((b) => {
    // Memory leak: inner never cleaned up
  });
});

// ✅ Use flattening operators
outer$.pipe(
  switchMap((a) => inner$.pipe(map((b) => ({ a, b }))),
).subscribe(({ a, b }) => { /* ... */ });
```

### Subscribing Just to Assign

```typescript
// ❌ Unnecessary subscription
let value: string;
source$.subscribe((v) => {
  value = v;
});

// ✅ Use firstValueFrom for one-shot
const value = await firstValueFrom(source$);

// ✅ Or keep it reactive
const value$ = source$.pipe(shareReplay(1));
```

### Missing Error Handling

```typescript
// ❌ One error kills the stream
source$.pipe(switchMap(() => riskyOperation())).subscribe(); // unhandled error = dead stream

// ✅ Handle errors inside inner Observable
source$
  .pipe(
    switchMap(() => riskyOperation().pipe(catchError(() => of(fallbackValue)))),
  )
  .subscribe();
```

---

## Version Notes

- **RxJS 7.8.x** (current stable): Pipeable operators only, improved TypeScript types, ~50% smaller bundles via tree-shaking
- **RxJS 8** (in development): Native Signal/Observable interop, further bundle size reductions
- v7 deprecated: `toPromise()` (use `firstValueFrom`/`lastValueFrom`), `pluck` (use `map`), `retryWhen` (use `retry` with config), prototype operators (use pipeable)
- Import paths: `"rxjs"` for creation functions and operators (v7.2+), or `"rxjs/operators"` for operators only
