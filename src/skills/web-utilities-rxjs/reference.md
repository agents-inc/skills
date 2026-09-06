# RxJS Reference

> Operator tables, the scenario-to-operator lookup, and deprecations. See [SKILL.md](SKILL.md) for
> the decisions and red flags, and [examples/](examples/) for full code.

Operators and creation functions are both exported from `"rxjs"` (since v7.2). The
`"rxjs/operators"` path still resolves but is no longer the documented import.

---

## Creation

| Function      | Emits                                        | Completes on its own |
| ------------- | -------------------------------------------- | -------------------- |
| `of`          | The arguments given                          | Yes                  |
| `from`        | An array, iterable, Promise or Observable    | Yes                  |
| `fromEvent`   | Every event on a target                      | No                   |
| `interval`    | An incrementing number, on a timer           | No                   |
| `timer(n)`    | `0`, once, after `n` ms                      | Yes                  |
| `timer(n, p)` | `0, 1, 2…`, every `p` ms after `n`           | No                   |
| `defer`       | Whatever the factory returns, per subscriber | Depends              |
| `EMPTY`       | Nothing                                      | Yes, immediately     |
| `NEVER`       | Nothing                                      | No                   |
| `throwError`  | An error                                     | N/A                  |

---

## Transformation

| Operator     | Behaviour                                        |
| ------------ | ------------------------------------------------ |
| `map`        | Transform each value                             |
| `scan`       | Accumulate, emitting each intermediate result    |
| `reduce`     | Accumulate, emitting once on completion          |
| `toArray`    | Collect everything into one array, on completion |
| `buffer`     | Collect until a notifier emits                   |
| `bufferTime` | Collect for a time window                        |
| `pairwise`   | Emit `[previous, current]`                       |

---

## Filtering and Rate

| Operator               | Behaviour                                              |
| ---------------------- | ------------------------------------------------------ |
| `filter`               | Keep values matching a predicate                       |
| `take` / `takeWhile`   | Take N, or take while a predicate holds, then complete |
| `takeUntil`            | Take until a notifier emits                            |
| `first` / `last`       | One value; `first` errors on an empty source           |
| `skip`                 | Drop the first N                                       |
| `debounceTime`         | Emit the last value after a period of silence          |
| `throttleTime`         | Emit the first value of each window, drop the rest     |
| `auditTime`            | Emit the latest value at the end of each window        |
| `sampleTime`           | Emit whatever is current, at a fixed interval          |
| `distinctUntilChanged` | Drop a value equal to the one before it                |

`debounceTime` waits for a pause and suits input; `throttleTime` caps a rate and suits scroll and
resize; `auditTime` also caps the rate but emits the _latest_ rather than the first, which is
usually what a position readout wants.

---

## Flattening

| Operator     | On a new outer value while the inner is running   | Reach for it when        |
| ------------ | ------------------------------------------------- | ------------------------ |
| `switchMap`  | Unsubscribes the inner, subscribes the new one    | Only the latest matters  |
| `mergeMap`   | Subscribes alongside, up to the concurrency limit | Order is irrelevant      |
| `concatMap`  | Queues until the current inner completes          | Order is the requirement |
| `exhaustMap` | Drops the outer value                             | Re-entry is the bug      |

| Scenario              | Operator         | Why                                              |
| --------------------- | ---------------- | ------------------------------------------------ |
| Type-ahead search     | `switchMap`      | The previous query's answer is now noise         |
| Route data load       | `switchMap`      | The previous route is gone                       |
| Batch upload          | `mergeMap(fn,3)` | Parallel, bounded                                |
| Analytics, logging    | `mergeMap`       | Fire and forget                                  |
| Form auto-save        | `concatMap`      | A later save must not land before an earlier one |
| Chat message send     | `concatMap`      | Order is the meaning                             |
| Submit / login button | `exhaustMap`     | The second click is a double-submit              |
| Refresh button        | `exhaustMap`     | The second press is impatience                   |

---

## Combination

| Function         | Emits                                       | Completes when         |
| ---------------- | ------------------------------------------- | ---------------------- |
| `combineLatest`  | The latest of each, whenever any emits      | All complete           |
| `forkJoin`       | The last of each, once                      | All complete           |
| `merge`          | Every value, in arrival order               | All complete           |
| `concat`         | Each source in turn                         | The last one completes |
| `race`           | Only the first source to emit               | The winner completes   |
| `zip`            | The Nth value of each, paired               | Any completes          |
| `withLatestFrom` | The primary's value plus the others' latest | The primary completes  |

`combineLatest` and `withLatestFrom` both wait for every source to have emitted once.
`forkJoin` waits for every source to _complete_, which a `Subject` never does.

---

## Error Handling

| Operator     | Behaviour                                                     |
| ------------ | ------------------------------------------------------------- |
| `catchError` | Replace the errored stream with the Observable you return     |
| `retry`      | Re-subscribe to the source, by count or by `{ count, delay }` |
| `timeout`    | Error when no value arrives inside the window                 |
| `finalize`   | Run teardown on complete, error _and_ unsubscribe             |

---

## Deprecations

| Retired                      | Use instead                            |
| ---------------------------- | -------------------------------------- |
| `.toPromise()`               | `firstValueFrom` / `lastValueFrom`     |
| `retryWhen`                  | `retry({ count, delay })`              |
| `pluck`                      | `map((x) => x.a.b)`                    |
| Prototype operators          | Pipeable operators inside `.pipe()`    |
| `subscribe(next, err, done)` | `subscribe({ next, error, complete })` |

The behavioural difference worth knowing when migrating: `.toPromise()` resolved `undefined` for an
Observable that completed without emitting, where `firstValueFrom` and `lastValueFrom` reject.
Both accept a `{ defaultValue }` second argument where empty is a legitimate outcome.
