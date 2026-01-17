# TypeScript Result Type Patterns: Best Practices Research (2025/2026)

> **Research Document** - Comprehensive analysis of Result/Either type patterns for type-safe error handling in TypeScript

---

## Table of Contents

1. [Why Result Types](#why-result-types)
2. [Core Concepts](#core-concepts)
3. [Essential Patterns](#essential-patterns)
4. [Library Comparison](#library-comparison)
5. [Async Integration](#async-integration)
6. [Combining Multiple Results](#combining-multiple-results)
7. [Pattern Matching](#pattern-matching)
8. [When to Use Result vs Exceptions](#when-to-use-result-vs-exceptions)
9. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
10. [Performance Considerations](#performance-considerations)
11. [ESLint Integration](#eslint-integration)
12. [Migration Strategy](#migration-strategy)

---

## Why Result Types

### The Problem with Traditional Error Handling

Traditional JavaScript/TypeScript error handling relies on `try-catch` and exceptions, which has several significant drawbacks:

**1. No Type Safety for Thrown Errors**

```typescript
// TypeScript cannot tell you what errors this function might throw
function parseUser(json: string): User {
  const data = JSON.parse(json); // Throws SyntaxError
  if (!data.name) throw new Error("Missing name"); // Throws Error
  if (data.age < 0) throw new RangeError("Invalid age"); // Throws RangeError
  return data as User;
}

// Caller has no idea what to catch
try {
  const user = parseUser(input);
} catch (e) {
  // e is 'unknown' - we have to guess what errors are possible
}
```

**2. Hidden Control Flow**

Exceptions create invisible control flow paths that bypass normal function return, making code harder to reason about.

**3. Easy to Forget Error Handling**

Nothing forces callers to handle errors - they can simply ignore them:

```typescript
// No error handling - will crash at runtime if parseUser throws
const user = parseUser(input);
console.log(user.name);
```

**4. Performance Overhead**

Benchmark results show Result types are **~300-350x faster** than throwing exceptions:
- Exception creation: 1,113 ms (1M iterations)
- Exception throwing: 1,172 ms (1M iterations)
- Error object return: 3.3 ms (1M iterations)

The overhead comes from stack trace generation, message formatting, and stack unwinding.

### The Result Type Solution

The Result pattern makes errors **explicit in the type system**, forcing callers to handle both success and failure cases:

```typescript
function parseUser(json: string): Result<User, ParseError> {
  // Error handling is now visible in the return type
}

// TypeScript FORCES you to check the result
const result = parseUser(input);
if (result.ok) {
  console.log(result.value.name); // TypeScript knows this is User
} else {
  console.error(result.error.message); // TypeScript knows this is ParseError
}
```

---

## Core Concepts

### Basic Result Type Definition

The simplest Result type uses a discriminated union:

```typescript
// Minimal implementation - no dependencies
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helper functions
function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

### Discriminated Union Pattern

The `ok` boolean acts as a **discriminant**, enabling TypeScript to narrow types:

```typescript
function processResult<T, E>(result: Result<T, E>): void {
  if (result.ok) {
    // TypeScript knows: result.value is T
    console.log(result.value);
  } else {
    // TypeScript knows: result.error is E
    console.error(result.error);
  }
}
```

### Alternative: Tagged Union with `_tag`

Some libraries use a `_tag` or `kind` field for more explicit discrimination:

```typescript
type Result<T, E> =
  | { _tag: "Success"; value: T }
  | { _tag: "Failure"; error: E };

// Or with 'kind'
type Result<T, E> =
  | { kind: "success"; value: T }
  | { kind: "failure"; error: E };
```

### Typed Error Objects

Define specific error types for different failure scenarios:

```typescript
// Define typed errors
interface ValidationError {
  code: "VALIDATION_ERROR";
  field: string;
  message: string;
}

interface NotFoundError {
  code: "NOT_FOUND";
  resource: string;
  id: string;
}

interface NetworkError {
  code: "NETWORK_ERROR";
  statusCode: number;
  message: string;
}

// Union of all possible errors
type UserError = ValidationError | NotFoundError | NetworkError;

// Function signature makes errors explicit
function fetchUser(id: string): Promise<Result<User, UserError>> {
  // Implementation
}
```

---

## Essential Patterns

### Pattern 1: Basic Result Usage

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Success and error constructors
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Example function
interface DivisionError {
  code: "DIVISION_BY_ZERO";
  message: string;
}

function divide(a: number, b: number): Result<number, DivisionError> {
  if (b === 0) {
    return err({
      code: "DIVISION_BY_ZERO",
      message: "Cannot divide by zero",
    });
  }
  return ok(a / b);
}

// Usage - TypeScript forces handling both cases
const result = divide(10, 2);
if (result.ok) {
  console.log(`Result: ${result.value}`); // 5
} else {
  console.error(`Error: ${result.error.message}`);
}
```

### Pattern 2: Mapping Success Values

Transform the success value without affecting errors:

```typescript
function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

// Usage
const doubled = map(divide(10, 2), (n) => n * 2);
// Result<number, DivisionError> with value 10
```

### Pattern 3: Mapping Error Values

Transform the error without affecting success:

```typescript
function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (result.ok) {
    return result;
  }
  return err(fn(result.error));
}

// Usage - convert specific error to general error
const generalizedResult = mapError(divide(10, 0), (e) => ({
  code: "MATH_ERROR" as const,
  original: e,
}));
```

### Pattern 4: Chaining Operations (flatMap/andThen)

Chain operations that each return Results:

```typescript
function flatMap<T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>
): Result<U, E | F> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

// Example: Parse, validate, then transform
interface ParseError {
  code: "PARSE_ERROR";
  message: string;
}

interface ValidationError {
  code: "VALIDATION_ERROR";
  field: string;
}

function parseNumber(input: string): Result<number, ParseError> {
  const num = Number(input);
  if (isNaN(num)) {
    return err({ code: "PARSE_ERROR", message: `Invalid number: ${input}` });
  }
  return ok(num);
}

function validatePositive(num: number): Result<number, ValidationError> {
  if (num <= 0) {
    return err({ code: "VALIDATION_ERROR", field: "number" });
  }
  return ok(num);
}

// Chain operations
const input = "42";
const result = flatMap(parseNumber(input), validatePositive);
// Result<number, ParseError | ValidationError>
```

### Pattern 5: Unwrapping with Default Value

```typescript
function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

// Usage
const value = unwrapOr(divide(10, 0), 0); // Returns 0 on error
```

### Pattern 6: Wrapping Throwable Functions

Convert exception-throwing code to Result-returning code:

```typescript
function tryCatch<T, E>(
  fn: () => T,
  onError: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(onError(error));
  }
}

// Usage with JSON.parse
interface JsonParseError {
  code: "JSON_PARSE_ERROR";
  message: string;
}

function safeJsonParse<T>(json: string): Result<T, JsonParseError> {
  return tryCatch(
    () => JSON.parse(json) as T,
    (error) => ({
      code: "JSON_PARSE_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  );
}

const parsed = safeJsonParse<{ name: string }>('{"name": "John"}');
```

---

## Library Comparison

### Overview Matrix

| Library | Bundle Size | Maintenance | Learning Curve | Async Support | Pattern Matching |
|---------|-------------|-------------|----------------|---------------|------------------|
| **Custom Implementation** | 0 KB | Self | Low | Manual | Manual |
| **neverthrow** | ~2 KB | Low* | Low-Medium | ResultAsync | .match() |
| **ts-results** | ~2 KB | Medium | Low | Limited | Pattern-based |
| **fp-ts** | ~30 KB | Active | High | TaskEither | fold/match |
| **Effect** | ~50 KB | Active | Very High | Built-in | Effect.match |
| **@praha/byethrow** | ~1 KB | Active | Low | Yes | Manual |

*Note: neverthrow has reduced maintenance activity as of 2025

### neverthrow

The most popular choice for type-safe error handling without full FP commitment.

```typescript
import { ok, err, Result, ResultAsync } from "neverthrow";

interface User {
  id: string;
  name: string;
  email: string;
}

interface FetchError {
  code: "FETCH_ERROR";
  statusCode: number;
}

interface ValidationError {
  code: "VALIDATION_ERROR";
  field: string;
}

// Synchronous Result
function validateEmail(email: string): Result<string, ValidationError> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return err({ code: "VALIDATION_ERROR", field: "email" });
  }
  return ok(email);
}

// Async ResultAsync
function fetchUser(id: string): ResultAsync<User, FetchError> {
  return ResultAsync.fromPromise(
    fetch(`/api/users/${id}`).then((res) => {
      if (!res.ok) throw { statusCode: res.status };
      return res.json() as Promise<User>;
    }),
    (error): FetchError => ({
      code: "FETCH_ERROR",
      statusCode: (error as { statusCode?: number }).statusCode ?? 500,
    })
  );
}

// Chaining with andThen
const result = await fetchUser("123")
  .andThen((user) => validateEmail(user.email).map(() => user))
  .match(
    (user) => ({ success: true, data: user }),
    (error) => ({ success: false, error })
  );

// Using combine for multiple results
import { Result } from "neverthrow";

const results = Result.combine([
  validateEmail("test@example.com"),
  validateEmail("another@test.com"),
]);
// Result<string[], ValidationError> - fails on first error

// Using combineWithAllErrors to collect all errors
const allResults = Result.combineWithAllErrors([
  validateEmail("invalid"),
  validateEmail("also-invalid"),
]);
// Result<string[], ValidationError[]> - collects all errors
```

**Key neverthrow Methods:**
- `ok(value)` / `err(error)` - constructors
- `.map(fn)` - transform success value
- `.mapErr(fn)` - transform error value
- `.andThen(fn)` - chain Results (flatMap)
- `.orElse(fn)` - recover from errors
- `.match({ ok, err })` - pattern match
- `.unwrapOr(default)` - extract with default
- `Result.fromThrowable(fn)` - wrap throwing functions
- `Result.combine([...])` - combine multiple Results
- `ResultAsync.fromPromise(promise, errorFn)` - wrap Promises

### fp-ts Either

Full functional programming library with Either type:

```typescript
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";

interface User {
  id: string;
  name: string;
}

interface ParseError {
  code: "PARSE_ERROR";
  message: string;
}

interface ValidationError {
  code: "VALIDATION_ERROR";
  field: string;
}

// Creating Either values
const success = E.right<ParseError, User>({ id: "1", name: "John" });
const failure = E.left<ParseError, User>({
  code: "PARSE_ERROR",
  message: "Invalid JSON",
});

// Transformations with pipe
const result = pipe(
  E.right("42"),
  E.map((s) => parseInt(s, 10)),
  E.chain((n) =>
    n > 0
      ? E.right(n)
      : E.left<ValidationError, number>({
          code: "VALIDATION_ERROR",
          field: "number",
        })
  )
);

// Pattern matching with fold/match
const message = pipe(
  result,
  E.match(
    (error) => `Error: ${error.code}`,
    (value) => `Success: ${value}`
  )
);

// Async operations with TaskEither
function fetchUserTE(id: string): TE.TaskEither<ParseError, User> {
  return TE.tryCatch(
    () => fetch(`/api/users/${id}`).then((r) => r.json() as Promise<User>),
    (error): ParseError => ({
      code: "PARSE_ERROR",
      message: String(error),
    })
  );
}

// Chaining async operations
const asyncPipeline = pipe(
  fetchUserTE("123"),
  TE.map((user) => user.name.toUpperCase()),
  TE.mapLeft((error) => ({ ...error, retried: true }))
);

// Execute
const taskResult = await asyncPipeline();
```

**Key fp-ts Either Methods:**
- `E.right(value)` / `E.left(error)` - constructors
- `E.map(fn)` - transform right value
- `E.mapLeft(fn)` - transform left value
- `E.chain(fn)` / `E.flatMap(fn)` - chain operations
- `E.fold(onLeft, onRight)` / `E.match` - pattern match
- `E.getOrElse(fn)` - extract with default
- `E.tryCatch(fn, onError)` - wrap throwing functions
- `E.fromNullable(onNone)` - convert nullable
- `E.sequenceArray` - traverse array of Eithers

### ts-results

Rust-inspired Result type, simpler than neverthrow:

```typescript
import { Ok, Err, Result } from "ts-results";

interface DivisionError {
  code: "DIVISION_BY_ZERO";
}

function divide(a: number, b: number): Result<number, DivisionError> {
  if (b === 0) {
    return Err({ code: "DIVISION_BY_ZERO" });
  }
  return Ok(a / b);
}

const result = divide(10, 2);

// Type guards
if (result.ok) {
  console.log(result.val); // Access value
} else {
  console.error(result.val); // Access error (same property name)
}

// Mapping
const doubled = result.map((n) => n * 2);

// Chaining
const chained = result.andThen((n) => divide(n, 2));

// Unwrap with default
const value = result.unwrapOr(0);
```

### Custom Implementation (Zero Dependencies)

For projects wanting minimal overhead:

```typescript
// result.ts - Complete implementation
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => (result.ok ? ok(fn(result.value)) : result);

export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => (result.ok ? result : err(fn(result.error)));

export const flatMap = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>
): Result<U, E | F> => (result.ok ? fn(result.value) : result);

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => U; err: (error: E) => U }
): U => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));

export const tryCatch = <T, E>(
  fn: () => T,
  onError: (error: unknown) => E
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(onError(error));
  }
};

export const combine = <T, E>(
  results: Result<T, E>[]
): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
};

export const combineAllErrors = <T, E>(
  results: Result<T, E>[]
): Result<T[], E[]> => {
  const values: T[] = [];
  const errors: E[] = [];
  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }
  return errors.length > 0 ? err(errors) : ok(values);
};
```

---

## Async Integration

### Pattern 1: Promise Returning Result

```typescript
type AsyncResult<T, E> = Promise<Result<T, E>>;

async function fetchUser(id: string): AsyncResult<User, FetchError> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      return err({
        code: "FETCH_ERROR",
        statusCode: response.status,
      });
    }
    const user = await response.json();
    return ok(user);
  } catch (error) {
    return err({
      code: "FETCH_ERROR",
      statusCode: 500,
    });
  }
}

// Usage
const result = await fetchUser("123");
if (result.ok) {
  console.log(result.value);
}
```

### Pattern 2: neverthrow ResultAsync

```typescript
import { ResultAsync, okAsync, errAsync } from "neverthrow";

// Wrap existing Promise-returning functions
function fetchUserAsync(id: string): ResultAsync<User, FetchError> {
  return ResultAsync.fromPromise(
    fetch(`/api/users/${id}`).then((res) => {
      if (!res.ok) throw { statusCode: res.status };
      return res.json() as Promise<User>;
    }),
    (error): FetchError => ({
      code: "FETCH_ERROR",
      statusCode: (error as { statusCode?: number }).statusCode ?? 500,
    })
  );
}

// Chain async operations
const pipeline = fetchUserAsync("123")
  .andThen((user) =>
    ResultAsync.fromPromise(
      fetch(`/api/users/${user.id}/posts`).then((r) => r.json()),
      (): FetchError => ({ code: "FETCH_ERROR", statusCode: 500 })
    )
  )
  .map((posts) => posts.length);

// ResultAsync is thenable - works with await
const result = await pipeline;
```

### Pattern 3: fp-ts TaskEither

```typescript
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";

interface ApiError {
  code: string;
  message: string;
}

// Create TaskEither from async operations
const fetchUserTE = (id: string): TE.TaskEither<ApiError, User> =>
  TE.tryCatch(
    async () => {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json() as Promise<User>;
    },
    (error): ApiError => ({
      code: "API_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  );

// Chain async operations
const pipeline = pipe(
  fetchUserTE("123"),
  TE.chain((user) =>
    TE.tryCatch(
      async () => {
        const response = await fetch(`/api/posts?userId=${user.id}`);
        return response.json() as Promise<Post[]>;
      },
      (error): ApiError => ({
        code: "API_ERROR",
        message: String(error),
      })
    )
  ),
  TE.map((posts) => posts.length)
);

// Execute TaskEither
const result: E.Either<ApiError, number> = await pipeline();
```

### Pattern 4: Parallel Async Operations

```typescript
import { ResultAsync, Result } from "neverthrow";

interface User {
  id: string;
  name: string;
}

interface Post {
  id: string;
  title: string;
}

interface Settings {
  theme: string;
}

// Run multiple async operations in parallel
async function fetchUserDashboard(
  userId: string
): Promise<
  Result<{ user: User; posts: Post[]; settings: Settings }, FetchError>
> {
  const [userResult, postsResult, settingsResult] = await Promise.all([
    fetchUser(userId),
    fetchPosts(userId),
    fetchSettings(userId),
  ]);

  return Result.combine([userResult, postsResult, settingsResult]).map(
    ([user, posts, settings]) => ({ user, posts, settings })
  );
}

// Alternative with ResultAsync.combine
function fetchUserDashboardAsync(
  userId: string
): ResultAsync<{ user: User; posts: Post[]; settings: Settings }, FetchError> {
  return ResultAsync.combine([
    fetchUserAsync(userId),
    fetchPostsAsync(userId),
    fetchSettingsAsync(userId),
  ]).map(([user, posts, settings]) => ({ user, posts, settings }));
}
```

---

## Combining Multiple Results

### Fail-Fast Combination (First Error)

Stop at the first error encountered:

```typescript
// Custom implementation
function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result; // Return first error
    }
    values.push(result.value);
  }
  return ok(values);
}

// neverthrow
import { Result } from "neverthrow";

const combined = Result.combine([
  validateName("John"),
  validateEmail("john@example.com"),
  validateAge(25),
]);
// If any fails, returns first error
// If all succeed, returns Result<[string, string, number], ValidationError>
```

### Collect All Errors

Gather all errors instead of stopping at first:

```typescript
// Custom implementation
function combineAllErrors<T, E>(
  results: Result<T, E>[]
): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  return errors.length > 0 ? err(errors) : ok(values);
}

// neverthrow
import { Result } from "neverthrow";

const validated = Result.combineWithAllErrors([
  validateName(""),
  validateEmail("invalid"),
  validateAge(-5),
]);
// Result<[string, string, number], ValidationError[]>
// Contains ALL validation errors
```

### Form Validation Example

```typescript
interface ValidationError {
  field: string;
  message: string;
}

interface FormData {
  name: string;
  email: string;
  age: number;
}

function validateName(name: string): Result<string, ValidationError> {
  if (name.length < 2) {
    return err({ field: "name", message: "Name must be at least 2 characters" });
  }
  return ok(name);
}

function validateEmail(email: string): Result<string, ValidationError> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return err({ field: "email", message: "Invalid email format" });
  }
  return ok(email);
}

function validateAge(age: number): Result<number, ValidationError> {
  if (age < 0 || age > 150) {
    return err({ field: "age", message: "Age must be between 0 and 150" });
  }
  return ok(age);
}

// Validate form and collect all errors
function validateForm(
  data: FormData
): Result<FormData, ValidationError[]> {
  const results = combineAllErrors([
    validateName(data.name),
    validateEmail(data.email),
    validateAge(data.age),
  ]);

  return results.ok
    ? ok(data)
    : err(results.error);
}

// Usage
const result = validateForm({
  name: "J",
  email: "invalid",
  age: -5,
});

if (!result.ok) {
  // Shows all validation errors at once
  result.error.forEach((e) => console.log(`${e.field}: ${e.message}`));
}
```

---

## Pattern Matching

### Native TypeScript Pattern Matching

Using discriminated unions with switch:

```typescript
type Result<T, E> =
  | { _tag: "Ok"; value: T }
  | { _tag: "Err"; error: E };

function handleResult<T, E>(result: Result<T, E>): string {
  switch (result._tag) {
    case "Ok":
      return `Success: ${result.value}`;
    case "Err":
      return `Error: ${result.error}`;
    // TypeScript ensures exhaustiveness
  }
}
```

### Using ts-pattern Library

```typescript
import { match, P } from "ts-pattern";

type ApiResult =
  | { type: "success"; data: User }
  | { type: "not_found"; id: string }
  | { type: "validation_error"; errors: string[] }
  | { type: "network_error"; statusCode: number };

const response = match(result)
  .with({ type: "success" }, ({ data }) => ({
    status: 200,
    body: data,
  }))
  .with({ type: "not_found" }, ({ id }) => ({
    status: 404,
    body: { message: `User ${id} not found` },
  }))
  .with({ type: "validation_error" }, ({ errors }) => ({
    status: 400,
    body: { errors },
  }))
  .with({ type: "network_error", statusCode: P.number.gte(500) }, () => ({
    status: 502,
    body: { message: "Upstream service error" },
  }))
  .with({ type: "network_error" }, ({ statusCode }) => ({
    status: statusCode,
    body: { message: "Request failed" },
  }))
  .exhaustive(); // TypeScript ensures all cases handled
```

### neverthrow match Method

```typescript
import { ok, err } from "neverthrow";

const result = divide(10, 2);

const message = result.match(
  (value) => `Result: ${value}`,
  (error) => `Error: ${error.code}`
);

// With async
const asyncResult = await fetchUser("123").match(
  (user) => ({ success: true, user }),
  (error) => ({ success: false, error })
);
```

### Exhaustive Checking with never

Ensure all error types are handled:

```typescript
type AppError =
  | { type: "NOT_FOUND"; id: string }
  | { type: "UNAUTHORIZED" }
  | { type: "VALIDATION"; field: string };

function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

function handleError(error: AppError): string {
  switch (error.type) {
    case "NOT_FOUND":
      return `Resource ${error.id} not found`;
    case "UNAUTHORIZED":
      return "Please log in";
    case "VALIDATION":
      return `Invalid ${error.field}`;
    default:
      // TypeScript error if we miss a case
      return assertNever(error);
  }
}
```

---

## When to Use Result vs Exceptions

### Use Result Types When:

**1. Errors are Expected and Recoverable**

```typescript
// User input validation - errors are expected
function validateEmail(email: string): Result<string, ValidationError> {
  // Validation failures are normal, not exceptional
}

// API calls that might fail
function fetchUser(id: string): ResultAsync<User, ApiError> {
  // Network failures, 404s are expected scenarios
}

// Parsing untrusted data
function parseConfig(json: string): Result<Config, ParseError> {
  // Invalid JSON is a normal possibility
}
```

**2. Caller Needs to Handle Specific Error Types**

```typescript
type CheckoutError =
  | { code: "INSUFFICIENT_STOCK"; productId: string }
  | { code: "PAYMENT_DECLINED"; reason: string }
  | { code: "ADDRESS_INVALID"; field: string };

function checkout(cart: Cart): Result<Order, CheckoutError> {
  // Caller can handle each error type differently
}

const result = checkout(cart);
if (!result.ok) {
  switch (result.error.code) {
    case "INSUFFICIENT_STOCK":
      // Show "out of stock" message
      break;
    case "PAYMENT_DECLINED":
      // Show payment retry form
      break;
    case "ADDRESS_INVALID":
      // Highlight invalid field
      break;
  }
}
```

**3. Building Libraries or Public APIs**

```typescript
// Library consumers see exactly what can go wrong
export function createUser(
  data: CreateUserInput
): Result<User, CreateUserError> {
  // Type signature documents all failure modes
}
```

**4. Performance-Critical Code**

Result types are ~300x faster than exceptions.

### Use Exceptions When:

**1. Truly Exceptional/Unexpected Situations**

```typescript
// Programming errors that shouldn't happen
function getElement<T>(array: T[], index: number): T {
  if (index < 0 || index >= array.length) {
    // This indicates a bug in the calling code
    throw new RangeError(`Index ${index} out of bounds`);
  }
  return array[index];
}
```

**2. Unrecoverable Errors**

```typescript
// Configuration errors during startup
function loadConfig(): Config {
  const config = process.env.CONFIG;
  if (!config) {
    // App cannot function without config - crash is appropriate
    throw new Error("CONFIG environment variable not set");
  }
  return JSON.parse(config);
}
```

**3. Third-Party Library Boundaries**

```typescript
// Wrap third-party exceptions, don't let them leak
function safeJsonParse<T>(json: string): Result<T, ParseError> {
  return tryCatch(
    () => JSON.parse(json) as T,
    (error): ParseError => ({
      code: "PARSE_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  );
}
```

**4. Framework Integration Points**

```typescript
// Express error handlers expect exceptions
app.get("/users/:id", async (req, res, next) => {
  const result = await fetchUser(req.params.id);

  if (!result.ok) {
    // Convert Result error to HTTP exception for Express
    return next(new HttpException(404, result.error.message));
  }

  res.json(result.value);
});
```

### Hybrid Approach (Recommended)

```typescript
// Internal business logic uses Results
function validateOrder(order: Order): Result<ValidatedOrder, ValidationError[]> {
  return combineAllErrors([
    validateItems(order.items),
    validateShipping(order.shipping),
    validatePayment(order.payment),
  ]).map(() => order as ValidatedOrder);
}

// API boundary converts to HTTP responses/exceptions
app.post("/orders", async (req, res) => {
  const result = await validateOrder(req.body)
    .asyncAndThen(processPayment)
    .andThen(createOrder);

  result.match(
    (order) => res.status(201).json(order),
    (error) => res.status(400).json({ errors: error })
  );
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Ignoring Results

```typescript
// BAD: Result is ignored - defeats the purpose
function processUser(id: string): void {
  fetchUser(id); // Result is discarded!
}

// GOOD: Handle the result
async function processUser(id: string): Promise<void> {
  const result = await fetchUser(id);
  if (result.ok) {
    console.log(`User: ${result.value.name}`);
  } else {
    console.error(`Failed to fetch user: ${result.error.message}`);
  }
}

// Use eslint-plugin-neverthrow to catch this
```

### Anti-Pattern 2: Mixing throw and Result

```typescript
// BAD: Function returns Result but also throws
function parseUser(json: string): Result<User, ParseError> {
  const data = JSON.parse(json); // Can throw SyntaxError!
  if (!data.name) {
    return err({ code: "PARSE_ERROR", message: "Missing name" });
  }
  return ok(data);
}

// GOOD: Wrap all throwable operations
function parseUser(json: string): Result<User, ParseError> {
  return tryCatch(
    () => JSON.parse(json),
    (): ParseError => ({ code: "PARSE_ERROR", message: "Invalid JSON" })
  ).flatMap((data) => {
    if (!data.name) {
      return err({ code: "PARSE_ERROR", message: "Missing name" });
    }
    return ok(data as User);
  });
}
```

### Anti-Pattern 3: Overly Generic Error Types

```typescript
// BAD: Error type is too generic
function fetchUser(id: string): Result<User, Error> {
  // Caller can't distinguish error types
}

// GOOD: Use specific error types
type FetchUserError =
  | { code: "NOT_FOUND"; id: string }
  | { code: "UNAUTHORIZED" }
  | { code: "NETWORK_ERROR"; statusCode: number };

function fetchUser(id: string): Result<User, FetchUserError> {
  // Caller can handle each case
}
```

### Anti-Pattern 4: Unwrapping Without Checking

```typescript
// BAD: Assuming success
function getName(result: Result<User, Error>): string {
  return result.value!.name; // Crashes if error!
}

// GOOD: Check first or use unwrapOr
function getName(result: Result<User, Error>): string {
  if (result.ok) {
    return result.value.name;
  }
  return "Unknown";
}

// Or with unwrapOr
function getName(result: Result<User, Error>): string {
  return unwrapOr(map(result, (u) => u.name), "Unknown");
}
```

### Anti-Pattern 5: Nested Results

```typescript
// BAD: Result inside Result
function fetchAndValidate(id: string): Result<Result<User, ValidationError>, FetchError> {
  // Confusing and hard to work with
}

// GOOD: Flatten with flatMap/andThen
function fetchAndValidate(id: string): Result<User, FetchError | ValidationError> {
  return fetchUser(id).andThen(validateUser);
}
```

### Anti-Pattern 6: Using Result for Optional Values

```typescript
// BAD: Using Result when Option/nullable is clearer
function findUser(id: string): Result<User, NotFoundError> {
  const user = users.find((u) => u.id === id);
  return user ? ok(user) : err({ code: "NOT_FOUND" });
}

// GOOD: Use nullable/Option for "might not exist"
function findUser(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}

// Use Result when there's actual error information
function fetchUser(id: string): Result<User, FetchError> {
  // Network errors carry meaningful information
}
```

### Anti-Pattern 7: Converting All Errors to Strings

```typescript
// BAD: Loses type information
function processData(input: string): Result<Data, string> {
  // Can't distinguish error types
}

// GOOD: Keep structured errors
interface ProcessError {
  code: "PARSE_ERROR" | "VALIDATION_ERROR" | "TRANSFORM_ERROR";
  message: string;
  details?: Record<string, unknown>;
}

function processData(input: string): Result<Data, ProcessError> {
  // Errors remain actionable
}
```

---

## Performance Considerations

### Benchmark Results

Testing with 1 million iterations after 10,000 warmup:

| Approach | Time | Relative |
|----------|------|----------|
| Error object return | 3.3 ms | 1x |
| Exception creation | 1,113 ms | 337x slower |
| Exception throwing | 1,172 ms | 355x slower |

### Why Exceptions Are Slow

1. **Stack trace generation** - Expensive string building
2. **Message formatting** - Dynamic string interpolation
3. **Stack unwinding** - Runtime searches for catch blocks

### Optimization Tips

**1. Pre-create Error Objects for Known Errors**

```typescript
// Create once, reuse
const DIVISION_BY_ZERO_ERROR = Object.freeze({
  code: "DIVISION_BY_ZERO" as const,
  message: "Cannot divide by zero",
});

function divide(a: number, b: number): Result<number, DivisionError> {
  if (b === 0) {
    return err(DIVISION_BY_ZERO_ERROR); // No object creation
  }
  return ok(a / b);
}
```

**2. Use Object Pooling for High-Frequency Errors**

```typescript
const errorPool = {
  validation: { code: "VALIDATION_ERROR" as const, field: "" },
};

function validateField(
  field: string,
  value: string
): Result<string, ValidationError> {
  if (!value) {
    errorPool.validation.field = field;
    return err(errorPool.validation);
  }
  return ok(value);
}
```

**3. Avoid Creating Closures in Hot Paths**

```typescript
// BAD: Creates closure every call
function transform(result: Result<number, Error>): Result<string, Error> {
  return map(result, (n) => n.toString());
}

// GOOD: Reuse function reference
const numberToString = (n: number): string => n.toString();

function transform(result: Result<number, Error>): Result<string, Error> {
  return map(result, numberToString);
}
```

---

## ESLint Integration

### eslint-plugin-neverthrow

Enforce Result handling with ESLint:

```javascript
// .eslintrc.js
module.exports = {
  plugins: ["neverthrow"],
  rules: {
    // Ensure Result values are used
    "neverthrow/must-use-result": "error",

    // Prevent throwing in Result-returning functions
    "neverthrow/no-throw-in-result-function": "error",
  },
};
```

### Custom ESLint Rules

```javascript
// Warn on functions that could throw but return Result
module.exports = {
  rules: {
    // Require try-catch when calling JSON.parse, etc.
    "no-unsafe-third-party-calls": {
      create(context) {
        return {
          CallExpression(node) {
            if (
              node.callee.type === "MemberExpression" &&
              node.callee.object.name === "JSON" &&
              node.callee.property.name === "parse"
            ) {
              const parent = context.getAncestors().pop();
              if (parent.type !== "TryStatement") {
                context.report({
                  node,
                  message: "JSON.parse should be wrapped in try-catch or tryCatch",
                });
              }
            }
          },
        };
      },
    },
  },
};
```

### TypeScript Strict Settings

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

---

## Migration Strategy

### Phase 1: Identify Boundaries

Start at system boundaries where errors naturally occur:

```typescript
// API clients
// Database queries
// User input validation
// File operations
// External service calls
```

### Phase 2: Create Error Types

Define typed errors for each domain:

```typescript
// errors/user-errors.ts
export type UserError =
  | { code: "USER_NOT_FOUND"; userId: string }
  | { code: "USER_ALREADY_EXISTS"; email: string }
  | { code: "INVALID_CREDENTIALS" };

// errors/api-errors.ts
export type ApiError =
  | { code: "NETWORK_ERROR"; statusCode: number }
  | { code: "TIMEOUT" }
  | { code: "PARSE_ERROR"; message: string };
```

### Phase 3: Wrap External Code

Create Result-returning wrappers for third-party code:

```typescript
// lib/safe-fetch.ts
export function safeFetch<T>(
  url: string,
  options?: RequestInit
): ResultAsync<T, ApiError> {
  return ResultAsync.fromPromise(
    fetch(url, options).then(async (res) => {
      if (!res.ok) {
        throw { statusCode: res.status };
      }
      return res.json() as Promise<T>;
    }),
    (error): ApiError => {
      if (typeof error === "object" && error !== null && "statusCode" in error) {
        return {
          code: "NETWORK_ERROR",
          statusCode: (error as { statusCode: number }).statusCode,
        };
      }
      return { code: "PARSE_ERROR", message: String(error) };
    }
  );
}

// lib/safe-json.ts
export function safeJsonParse<T>(json: string): Result<T, ParseError> {
  return tryCatch(
    () => JSON.parse(json) as T,
    (error): ParseError => ({
      code: "PARSE_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  );
}
```

### Phase 4: Convert Services Incrementally

```typescript
// Before
class UserService {
  async getUser(id: string): Promise<User> {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status}`);
    }
    return response.json();
  }
}

// After
class UserService {
  getUser(id: string): ResultAsync<User, UserError> {
    return safeFetch<User>(`/api/users/${id}`).mapErr(
      (apiError): UserError =>
        apiError.code === "NETWORK_ERROR" && apiError.statusCode === 404
          ? { code: "USER_NOT_FOUND", userId: id }
          : { code: "USER_NOT_FOUND", userId: id } // Simplify for example
    );
  }
}
```

### Phase 5: Update Consumers

```typescript
// Before
try {
  const user = await userService.getUser(id);
  displayUser(user);
} catch (error) {
  showError("Failed to load user");
}

// After
const result = await userService.getUser(id);
result.match(
  (user) => displayUser(user),
  (error) => {
    switch (error.code) {
      case "USER_NOT_FOUND":
        showError(`User ${error.userId} not found`);
        break;
      default:
        showError("Failed to load user");
    }
  }
);
```

---

## Summary

### Key Takeaways

1. **Result types make errors explicit** in function signatures, forcing callers to handle failures
2. **Choose the right library** for your needs - neverthrow for simplicity, fp-ts for full FP, custom for zero deps
3. **Use Results for expected failures**, exceptions for truly exceptional situations
4. **Combine Results properly** - fail-fast for sequential operations, collect-all for validation
5. **Pattern match exhaustively** to ensure all error cases are handled
6. **Wrap third-party code** at boundaries to convert exceptions to Results
7. **Migrate incrementally** starting from system boundaries

### Recommended Stack

| Use Case | Recommendation |
|----------|----------------|
| Simple projects | Custom implementation (zero deps) |
| Medium projects | neverthrow |
| Full FP adoption | fp-ts or Effect |
| Pattern matching | ts-pattern + any Result library |
| Form validation | combineAllErrors pattern |

---

## Sources

- [Error Handling with Result Types - TypeScript.tv](https://typescript.tv/best-practices/error-handling-with-result-types/)
- [neverthrow GitHub Repository](https://github.com/supermacro/neverthrow)
- [fp-ts Either Documentation](https://gcanti.github.io/fp-ts/modules/Either.ts.html)
- [Railway Oriented Programming - F# for Fun and Profit](https://fsharpforfunandprofit.com/rop/)
- [ts-pattern - Exhaustive Pattern Matching](https://github.com/gvergnaud/ts-pattern)
- [Effect vs neverthrow Comparison](https://effect.website/docs/additional-resources/effect-vs-neverthrow/)
- [TypeScript Errors vs Exceptions Benchmarks](https://hamy.xyz/blog/2025-05_typescript-errors-vs-exceptions-benchmarks)
- [Simple and Maintainable Error Handling in TypeScript](https://dev.to/supermetrics/simple-and-maintainable-error-handling-in-typescript-56lm)
- [Robust Error Handling: Rust-Inspired Solutions](https://dev.to/alexanderop/robust-error-handling-in-typescript-a-journey-from-naive-to-rust-inspired-solutions-1mdh)
- [TypeScript Result - Combining Multiple Results](https://www.typescript-result.dev/combining-multiple-results)
- [Neverthrow Composition Patterns - DeepWiki](https://deepwiki.com/supermacro/neverthrow/4.2-composition-patterns)
- [ts-results GitHub Repository](https://github.com/vultix/ts-results)
- [Exhaustive Matching in TypeScript - TkDodo](https://tkdodo.eu/blog/exhaustive-matching-in-type-script)
