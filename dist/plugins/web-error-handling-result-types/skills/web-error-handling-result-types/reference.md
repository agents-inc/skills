# Result Types Reference

> Operation lookup, coverage tables and templates. Decisions and red flags are in [SKILL.md](SKILL.md); code is in [examples/](examples/).

---

## Operations

| Operation                       | Purpose                         | Example                                             |
| ------------------------------- | ------------------------------- | --------------------------------------------------- |
| `ok(value)`                     | Create success                  | `ok(42)`                                            |
| `err(error)`                    | Create failure                  | `err({ code: "NOT_FOUND" })`                        |
| `map(result, fn)`               | Transform success value         | `map(result, (x) => x * 2)`                         |
| `mapError(result, fn)`          | Transform error value           | `mapError(result, (e) => ({ ...e, step: "load" }))` |
| `flatMap(result, fn)`           | Chain a fallible step           | `flatMap(result, validate)`                         |
| `unwrapOr(result, fallback)`    | Extract with a default          | `unwrapOr(result, 0)`                               |
| `unwrapOrElse(result, fn)`      | Default computed from the error | `unwrapOrElse(result, (e) => e.fallback)`           |
| `match(result, handlers)`       | Handle both sides               | `match(result, { ok, err })`                        |
| `tryCatch(fn, onError)`         | Wrap throwing code              | `tryCatch(() => JSON.parse(s), toParseError)`       |
| `fromNullable(value, error)`    | Lift a nullable                 | `fromNullable(found, notFound)`                     |
| `combine(results)`              | Fail-fast combine               | `combine([a, b, c])`                                |
| `combineWithAllErrors(results)` | Collect every error             | `combineWithAllErrors(validations)`                 |
| `traverse(items, fn)`           | Map a list, short-circuiting    | `traverse(rows, parseRow)`                          |

Libraries that ship a Result type use different names for the same operations — `andThen` or
`chain` for `flatMap`, `mapErr` for `mapError`, `Right`/`Left` or `Ok`/`Err` for the constructors.
The composition is identical, so a pattern here transfers by renaming.

## What a Result does not catch

A Result is a return value, so nothing it wraps is automatic — every throwing path needs converting.

| Situation                        | Covered? | Conversion                   |
| -------------------------------- | -------- | ---------------------------- |
| Return from a sync function      | Yes      | `err()`                      |
| Return from an async function    | Yes      | `err()`                      |
| `JSON.parse` throwing            | No       | `tryCatch`                   |
| A failed `fetch`                 | No       | `tryCatchAsync`              |
| A rejected promise               | No       | `fromPromise`                |
| A `setTimeout` callback throwing | No       | `tryCatch` in the callback   |
| An event handler throwing        | No       | `try`/`catch` in the handler |

## Cost of throwing

Measured over one million iterations of the same operation:

| Approach              | Time      | Relative      |
| --------------------- | --------- | ------------- |
| Returning a Result    | ~3 ms     | 1× (baseline) |
| Creating an exception | ~1,100 ms | ~350× slower  |
| Throwing and catching | ~1,200 ms | ~400× slower  |

The cost is stack-trace capture, message formatting and unwinding to the `catch`. It matters on a
hot path and nowhere else — correctness is the reason to reach for a Result, and this is a tiebreaker.

## Error type template

```typescript
interface DomainError {
  readonly code: "SPECIFIC_CODE";
  readonly message: string;
  // whatever this variant's handler needs, and nothing else
}
```

Keep `code` machine-readable and `message` human-readable, and let each variant carry only its own
fields — an optional field present on every variant is a sign the union should have been narrower.

## Type-narrowing settings

`strict` and `noUncheckedIndexedAccess` are what make the union do its job: without them a missed
`ok` check and an out-of-range index both compile.
