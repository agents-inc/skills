# Result Types Core Examples

> Complete code examples for Result type patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Extended Examples:**
- [async.md](async.md) - Async Result patterns with Promise
- [combining.md](combining.md) - Combining multiple Results

---

## Pattern 1: Complete Result Type Implementation

### Good Example - Zero-Dependency Result Module

```typescript
// src/lib/result.ts

/**
 * Result type for explicit error handling.
 * Use for expected, recoverable errors.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// ============ Constructors ============

/** Create a success Result */
export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

/** Create a failure Result */
export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

// ============ Transformations ============

/** Transform success value, pass through errors */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => (result.ok ? ok(fn(result.value)) : result);

/** Transform error value, pass through success */
export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => (result.ok ? result : err(fn(result.error)));

/** Chain operations that return Results */
export const flatMap = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>
): Result<U, E | F> => (result.ok ? fn(result.value) : result);

/** Alias for flatMap */
export const andThen = flatMap;

// ============ Extraction ============

/** Extract value or return default */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

/** Extract value or compute default from error */
export const unwrapOrElse = <T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T => (result.ok ? result.value : fn(result.error));

/** Pattern match on Result */
export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => U; err: (error: E) => U }
): U => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));

// ============ Error Handling ============

/** Wrap a function that might throw */
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

/** Convert nullable to Result */
export const fromNullable = <T, E>(
  value: T | null | undefined,
  error: E
): Result<T, E> => (value != null ? ok(value) : err(error));

// ============ Predicates ============

/** Check if Result is success */
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok;

/** Check if Result is failure */
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  !result.ok;
```

**Why good:** Complete implementation covering all common operations, zero dependencies, fully typed, readonly prevents mutation, clear separation of concerns

---

## Pattern 2: Typed Error Definitions

### Good Example - Domain Error Types

```typescript
// src/errors/user-errors.ts

/** User not found in database */
export interface UserNotFoundError {
  readonly code: "USER_NOT_FOUND";
  readonly userId: string;
}

/** User already exists with given email */
export interface UserAlreadyExistsError {
  readonly code: "USER_ALREADY_EXISTS";
  readonly email: string;
}

/** Invalid user credentials */
export interface InvalidCredentialsError {
  readonly code: "INVALID_CREDENTIALS";
}

/** User validation failed */
export interface UserValidationError {
  readonly code: "USER_VALIDATION_ERROR";
  readonly field: string;
  readonly message: string;
}

/** Union of all user-related errors */
export type UserError =
  | UserNotFoundError
  | UserAlreadyExistsError
  | InvalidCredentialsError
  | UserValidationError;

// Pre-created error instances for performance
export const INVALID_CREDENTIALS_ERROR: InvalidCredentialsError = {
  code: "INVALID_CREDENTIALS",
};

// Factory functions for errors with parameters
export const userNotFoundError = (userId: string): UserNotFoundError => ({
  code: "USER_NOT_FOUND",
  userId,
});

export const userAlreadyExistsError = (email: string): UserAlreadyExistsError => ({
  code: "USER_ALREADY_EXISTS",
  email,
});

export const userValidationError = (
  field: string,
  message: string
): UserValidationError => ({
  code: "USER_VALIDATION_ERROR",
  field,
  message,
});
```

**Why good:** Discriminated union with `code` property, readonly prevents mutation, factory functions for parameterized errors, pre-created constants for errors without parameters

---

### Good Example - API Error Types

```typescript
// src/errors/api-errors.ts

export interface NetworkError {
  readonly code: "NETWORK_ERROR";
  readonly message: string;
  readonly cause?: unknown;
}

export interface HttpError {
  readonly code: "HTTP_ERROR";
  readonly statusCode: number;
  readonly message: string;
}

export interface TimeoutError {
  readonly code: "TIMEOUT";
  readonly timeoutMs: number;
}

export interface ParseError {
  readonly code: "PARSE_ERROR";
  readonly message: string;
  readonly input: string;
}

export type ApiError = NetworkError | HttpError | TimeoutError | ParseError;

// Factory functions
export const networkError = (message: string, cause?: unknown): NetworkError => ({
  code: "NETWORK_ERROR",
  message,
  cause,
});

export const httpError = (statusCode: number, message: string): HttpError => ({
  code: "HTTP_ERROR",
  statusCode,
  message,
});

const DEFAULT_TIMEOUT_MS = 30000;

export const timeoutError = (timeoutMs: number = DEFAULT_TIMEOUT_MS): TimeoutError => ({
  code: "TIMEOUT",
  timeoutMs,
});

export const parseError = (message: string, input: string): ParseError => ({
  code: "PARSE_ERROR",
  message,
  input,
});
```

**Why good:** Named constant for default timeout, each error carries relevant context, factory functions provide consistent creation

---

## Pattern 3: Service Functions Returning Results

### Good Example - User Service with Results

```typescript
// src/services/user-service.ts
import type { Result } from "../lib/result";
import { ok, err, flatMap, map, tryCatch } from "../lib/result";
import type { User } from "../types/user";
import type { UserError } from "../errors/user-errors";
import {
  userNotFoundError,
  userAlreadyExistsError,
  userValidationError,
  INVALID_CREDENTIALS_ERROR,
} from "../errors/user-errors";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation functions return Results
function validateEmail(email: string): Result<string, UserError> {
  if (!EMAIL_REGEX.test(email)) {
    return err(userValidationError("email", "Invalid email format"));
  }
  return ok(email);
}

function validatePassword(password: string): Result<string, UserError> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return err(
      userValidationError(
        "password",
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      )
    );
  }
  return ok(password);
}

// Service function composing validations
export function createUser(
  email: string,
  password: string,
  name: string
): Result<{ email: string; password: string; name: string }, UserError> {
  // Chain validations - short-circuits on first error
  return flatMap(validateEmail(email), (validEmail) =>
    flatMap(validatePassword(password), (validPassword) =>
      ok({ email: validEmail, password: validPassword, name })
    )
  );
}

// Usage
const result = createUser("test@example.com", "securepassword", "John");
if (result.ok) {
  console.log("User data:", result.value);
} else {
  console.error(`Validation failed: ${result.error.field} - ${result.error.message}`);
}
```

**Why good:** Validation logic returns Results, flatMap chains cleanly, error type is specific and actionable, named constants for configuration values

---

## Pattern 4: Wrapping External Libraries

### Good Example - Safe JSON Operations

```typescript
// src/lib/safe-json.ts
import type { Result } from "./result";
import { ok, err, tryCatch } from "./result";
import type { ParseError } from "../errors/api-errors";
import { parseError } from "../errors/api-errors";

const MAX_INPUT_LOG_LENGTH = 100;

/** Safely parse JSON with typed error */
export function safeJsonParse<T>(json: string): Result<T, ParseError> {
  return tryCatch(
    () => JSON.parse(json) as T,
    (error): ParseError =>
      parseError(
        error instanceof Error ? error.message : "Unknown parse error",
        json.substring(0, MAX_INPUT_LOG_LENGTH) // Truncate for logging
      )
  );
}

/** Safely stringify JSON with typed error */
export function safeJsonStringify<T>(
  value: T,
  space?: number
): Result<string, ParseError> {
  return tryCatch(
    () => JSON.stringify(value, null, space),
    (error): ParseError =>
      parseError(
        error instanceof Error ? error.message : "Unknown stringify error",
        String(value).substring(0, MAX_INPUT_LOG_LENGTH)
      )
  );
}
```

**Why good:** Wraps throwable operations at boundary, preserves partial input for debugging, typed error with relevant context

---

### Good Example - Safe localStorage Operations

```typescript
// src/lib/safe-storage.ts
import type { Result } from "./result";
import { ok, err, tryCatch, flatMap } from "./result";
import { safeJsonParse, safeJsonStringify } from "./safe-json";

interface StorageError {
  readonly code: "STORAGE_ERROR";
  readonly operation: "get" | "set" | "remove";
  readonly key: string;
  readonly message: string;
}

const storageError = (
  operation: "get" | "set" | "remove",
  key: string,
  message: string
): StorageError => ({
  code: "STORAGE_ERROR",
  operation,
  key,
  message,
});

export function getItem<T>(key: string): Result<T | null, StorageError> {
  return tryCatch(
    () => {
      const item = localStorage.getItem(key);
      if (item === null) return null;

      const parsed = safeJsonParse<T>(item);
      if (!parsed.ok) {
        throw new Error(parsed.error.message);
      }
      return parsed.value;
    },
    (error): StorageError =>
      storageError(
        "get",
        key,
        error instanceof Error ? error.message : "Unknown error"
      )
  );
}

export function setItem<T>(key: string, value: T): Result<void, StorageError> {
  return flatMap(safeJsonStringify(value), (json) =>
    tryCatch(
      () => {
        localStorage.setItem(key, json);
      },
      (error): StorageError =>
        storageError(
          "set",
          key,
          error instanceof Error ? error.message : "Unknown error"
        )
    )
  );
}
```

**Why good:** Composes JSON parsing with storage, each operation returns Result, error includes operation context

---

## Pattern 5: Pattern Matching with Exhaustive Handling

### Good Example - HTTP Response Mapping

```typescript
// src/api/response-handler.ts
import { match } from "../lib/result";
import type { Result } from "../lib/result";
import type { User } from "../types/user";
import type { UserError } from "../errors/user-errors";

interface HttpResponse {
  status: number;
  body: unknown;
}

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

export function toHttpResponse(result: Result<User, UserError>): HttpResponse {
  return match(result, {
    ok: (user) => ({
      status: HTTP_STATUS.OK,
      body: user,
    }),
    err: (error) => {
      switch (error.code) {
        case "USER_NOT_FOUND":
          return {
            status: HTTP_STATUS.NOT_FOUND,
            body: { message: `User ${error.userId} not found` },
          };
        case "USER_ALREADY_EXISTS":
          return {
            status: HTTP_STATUS.BAD_REQUEST,
            body: { message: `Email ${error.email} already registered` },
          };
        case "INVALID_CREDENTIALS":
          return {
            status: HTTP_STATUS.UNAUTHORIZED,
            body: { message: "Invalid credentials" },
          };
        case "USER_VALIDATION_ERROR":
          return {
            status: HTTP_STATUS.BAD_REQUEST,
            body: { field: error.field, message: error.message },
          };
        default: {
          // Exhaustiveness check - TypeScript error if case is missing
          const _exhaustive: never = error;
          return {
            status: HTTP_STATUS.INTERNAL_ERROR,
            body: { message: "Unknown error" },
          };
        }
      }
    },
  });
}
```

**Why good:** Named constants for HTTP status codes, exhaustive switch with never check, each error code maps to appropriate HTTP response

---

## Anti-Pattern Examples

### Bad Example - Ignoring Results

```typescript
// BAD: Result is discarded
function processUser(id: string): void {
  fetchUser(id); // Returns Result but ignored!
  console.log("Processing complete");
}
```

**Why bad:** Defeats the purpose of Result types, error is silently ignored, no compiler warning

---

### Bad Example - Mixing throw and Result

```typescript
// BAD: Function lies about its error contract
function parseConfig(json: string): Result<Config, ParseError> {
  const data = JSON.parse(json); // Throws! Not wrapped!
  if (!data.version) {
    return err(parseError("Missing version", json));
  }
  return ok(data);
}
```

**Why bad:** Signature says Result but can throw, caller doesn't know to use try/catch, inconsistent error handling

---

### Bad Example - Generic Error Type

```typescript
// BAD: Error type is useless
function fetchUser(id: string): Result<User, Error> {
  // ...
}

// Caller can't do anything useful with error
const result = fetchUser("123");
if (!result.ok) {
  // What kind of error? No way to know!
  console.error(result.error.message);
}
```

**Why bad:** Loses type information, caller can't handle errors specifically, no better than try/catch

---

### Bad Example - Nested if Statements

```typescript
// BAD: Deeply nested, doesn't scale
function processInput(input: string): Result<number, ValidationError> {
  const parsed = parseNumber(input);
  if (parsed.ok) {
    const validated = validatePositive(parsed.value);
    if (validated.ok) {
      const transformed = transform(validated.value);
      if (transformed.ok) {
        return ok(transformed.value);
      }
      return transformed;
    }
    return validated;
  }
  return parsed;
}
```

**Why bad:** Deep nesting, hard to read, error handling scattered, doesn't compose

---

### Good Example - Using flatMap Instead

```typescript
// GOOD: Flat chain, reads linearly
function processInput(input: string): Result<number, ValidationError> {
  return flatMap(parseNumber(input), (num) =>
    flatMap(validatePositive(num), (positive) => transform(positive))
  );
}

// Or with pipe utility
const processInput = (input: string) =>
  pipe(
    parseNumber(input),
    andThen(validatePositive),
    andThen(transform)
  );
```

**Why good:** Flat structure, reads top-to-bottom, composes cleanly, error handling centralized

---

> **See also:**
> - [async.md](async.md) - Async Result patterns
> - [combining.md](combining.md) - Combining multiple Results
