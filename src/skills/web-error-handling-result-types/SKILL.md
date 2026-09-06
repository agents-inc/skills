---
name: web-error-handling-result-types
description: TypeScript Result/Either types for type-safe error handling, railway-oriented programming patterns, error as values
---

# TypeScript Result Type Patterns

> **Quick Guide:** A `Result<T, E>` is a discriminated union on `ok`, so TypeScript refuses to read `value` until the caller has checked. That moves a function's failure modes into its signature, where an exception hides them. Use it for expected failures — validation, parsing, requests — and keep exceptions for bugs and for conditions nothing downstream can act on. A custom implementation is about forty lines and the recommended default; the whole surface is in this skill.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — the Result module, typed error definitions, wrapping throwing code, pattern matching
- [examples/async.md](examples/async.md) — `Promise<Result>`, async chaining, retry, converting a promise
- [examples/combining.md](examples/combining.md) — fail-fast, collect-all, object and sequential combination
- [reference.md](reference.md) — operation lookup, what Results do not catch, error-type templates

---

## Which path applies

- **Nothing exists yet** — write the module: the union, `ok`, `err`, `map`, `flatMap`, `match`,
  `tryCatch`. [examples/core.md](examples/core.md) is the whole file.
- **A library owns the type** — the operations are named differently but compose identically;
  [reference.md](reference.md) maps the names.
- **The failing operation is async** — the type is `Promise<Result<T, E>>` and the awaiting is the
  caller's; see [examples/async.md](examples/async.md).

---

<critical_requirements>

## Before writing Result code

**Check `result.ok` before reading `value` or `error`.** The union narrows only through that check, so TypeScript will refuse either access until it is made — and a runtime `undefined` is what a bypassed check produces.

**Wrap every throwing call inside a Result-returning function in `tryCatch`.** `JSON.parse` and its kin throw past the return type, so one unwrapped call makes the signature a lie and the caller's exhaustive handling incomplete.

**Give each error a discriminant field — `code` or `type` — rather than typing it as `Error` or `string`.** The discriminant is what lets the caller `switch` and lets TypeScript check the switch is exhaustive; a bare message can only be displayed.

**Chain with `flatMap` where each step returns a Result.** The error type unions itself and the first failure short-circuits the rest, which is what nested `if (result.ok)` blocks are reimplementing by hand.

**Do something with every Result you receive.** A discarded one is a failure that never happened as far as the rest of the program is concerned, and no type error marks it.

</critical_requirements>

---

**Auto-detection:** Result type, Either type, ok err, railway-oriented programming, error as value, flatMap andThen, tryCatch, unwrapOr, combineWithAllErrors, discriminated union error, typed errors

**Applies to:**

- Expected, recoverable failures — validation, parsing, requests, business rules
- Function signatures that have to name every way they can fail
- Chaining fallible steps so the first failure skips the rest
- Collecting every failure at once, as form validation needs

**Handled elsewhere:**

- Render-phase failures — a component that throws is caught by whatever wraps it, and a Result never reaches that path.
- Transport and caching — a Result describes the outcome of a request; issuing, retrying and caching it belong to whatever fetches.
- Schema validation — a validator that reports issues has its own result shape; wrap it at the boundary and carry its report as your error payload.
- Turning a failure into a response — the status code an error maps to is the API layer's rule, and this skill only guarantees the error arrives typed.

---

<philosophy>

## Philosophy

An exception is invisible control flow: it leaves no trace in the type, so the only way to know a
function throws is to read it or to be surprised in production. A Result puts the same information in
the signature, where the compiler enforces it.

The cost is real — every caller handles or propagates, and the error union grows as a chain
lengthens. That is why the boundary matters: convert throwing code to Results on the way in, and
convert Results to whatever the outside world wants on the way out. In between, nothing throws.

**The railway:** success runs the main line, and the first error switches to the parallel one, where
every later step is skipped until something explicitly handles it.

```
     parseNumber     validatePositive     double
OK   ─────────────────────────────────────────────> success
                  ↘                  ↘
ERR                 ────────────────────────────> failure
```

</philosophy>

---

<decision_framework>

## Result, exception, or nullable

```
Can the caller do something about this failure?
├─ NO — it is a bug or a condition nothing can act on → throw
│   ├─ Index out of bounds, invalid internal state
│   └─ Missing startup configuration, unreachable database at boot
└─ YES → What does the failure need to carry?
    ├─ Nothing but its own absence → T | null
    ├─ A reason the caller branches on → Result<T, E>
    └─ Several distinct reasons → Result<T, E> with a discriminated E
```

A `Result<User, NotFoundError>` whose error carries only `code: "NOT_FOUND"` is a nullable wearing a
costume. Reach for the Result when the caller's next action differs by reason.

**Fail fast or collect everything:** one invalid field in a form is not a reason to hide the other
four, so form validation collects; a chain where step two consumes step one's output has nothing to
collect and short-circuits.

Returning a value also costs far less than throwing one, because a thrown error captures a stack
trace and unwinds; [reference.md](reference.md) carries the measured comparison. That is a tiebreaker
on a hot path rather than a reason on its own.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: The type and its constructors

`ok` as the discriminant, `readonly` throughout, `never` on the other side so inference stays clean.

```typescript
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: `map` and `mapError`

Each transforms one side and passes the other through untouched, which is what makes them safe to
apply to a Result you have not checked.

```typescript
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => (result.ok ? ok(fn(result.value)) : result);

export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> => (result.ok ? result : err(fn(result.error)));
```

`mapError` is where context is added — the operation that failed, the input that caused it.

### Pattern 3: `flatMap` for chaining

The step returns a Result of its own, so the error types union and the first failure ends the chain.

```typescript
export const flatMap = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => (result.ok ? fn(result.value) : result);

const parsed = flatMap(parseNumber(input), validatePositive);
// Result<number, ParseError | ValidationError>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 4: `tryCatch` at the boundary

Throwing code is converted where it enters, and the error is mapped to this domain's type in the
same call.

```typescript
export const tryCatch = <T, E>(
  fn: () => T,
  onError: (error: unknown) => E,
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(onError(error));
  }
};

const parsed = tryCatch(
  () => JSON.parse(json) as Config,
  (error): ParseError => ({
    code: "PARSE_ERROR",
    message: String(error),
    input: json,
  }),
);
```

A `JSON.parse` left unwrapped inside a Result-returning function is the commonest way the signature
stops being true.

Full code: [examples/core.md](examples/core.md)

### Pattern 5: `match` for exhaustive handling

Both sides answered in one expression, which is what makes it the natural converter at an outbound
boundary.

```typescript
export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => U; err: (error: E) => U },
): U => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));

const response = match(loadUser(id), {
  ok: (user) => ({ status: 200, body: user }),
  err: (error) => toHttpResponse(error),
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 6: Discriminated error unions

Each variant carries what its own handler needs, and the union names every way the function fails.

```typescript
type UserError =
  | { readonly code: "NOT_FOUND"; readonly userId: string }
  | {
      readonly code: "VALIDATION_ERROR";
      readonly field: string;
      readonly message: string;
    }
  | { readonly code: "NETWORK_ERROR"; readonly statusCode: number };

if (!result.ok) {
  switch (result.error.code) {
    case "NOT_FOUND":
      return showMissing(result.error.userId);
    case "VALIDATION_ERROR":
      return highlightField(result.error.field);
    case "NETWORK_ERROR":
      return offerRetry();
  }
}
```

Adding a variant reddens every switch that does not handle it, which is the whole return on the
discriminant.

Full code: [examples/core.md](examples/core.md)

### Pattern 7: Combining several Results

Fail-fast returns the first error; collect-all returns every one.

```typescript
export const combine = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
};
```

Full code: [examples/combining.md](examples/combining.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Reading `result.value` without checking `ok` — `undefined` at the point of use, and a non-null assertion or a cast is what got it past the compiler.
- A throwing call left unwrapped inside a Result-returning function — the exception escapes a caller who was told there was nothing to catch.
- Treating an error object as `instanceof Error` — a plain discriminated object is not one, so an `instanceof` check silently takes the wrong branch.

**Surprising behaviour:**

- Discarding a Result compiles cleanly. Nothing in the type system marks the failure you dropped.
- `map` with a function that itself returns a Result gives `Result<Result<T, F>, E>` — it type-checks, and the caller has to unwrap twice to reach anything. That doubling is what `flatMap` exists to prevent.
- `flatMap` unions error types, so a long chain ends with an error union nobody wants to handle — narrow it with `mapError` at the point the extra variants stop mattering.
- `Result<void, E>` rather than `Result<undefined, E>` for an operation with no success value; the second forces callers to name a value that does not exist.
- A `Promise<Result<T, E>>` is truthy while it is pending, so an unawaited one passes an `ok` check that means nothing.
- Rethrowing at a boundary throws the typed error away — the reason the caller could have branched on becomes a string.
- `combineWithAllErrors` returning an array whose first element is all anyone displays wastes the work; either show them all or fail fast.
- A pre-created error constant saves an allocation and loses the context that would have gone in it.

</red_flags>
