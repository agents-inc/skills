# Result Types — Core Examples

> Full code for the patterns in [SKILL.md](../SKILL.md).

**Extended examples:**

- [async.md](async.md) — `Promise<Result>`, chaining, retry, promise conversion
- [combining.md](combining.md) — fail-fast, collect-all, object and sequential combination

---

## Patterns 1–5: the Result module

The whole zero-dependency implementation. Everything else in this skill composes these.

```typescript
// lib/result.ts

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Transform the success value, pass errors through */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => (result.ok ? ok(fn(result.value)) : result);

/** Transform the error, pass successes through */
export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> => (result.ok ? result : err(fn(result.error)));

/** Chain a step that itself returns a Result */
export const flatMap = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => (result.ok ? fn(result.value) : result);

export const andThen = flatMap;

export const unwrapOr = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

export const unwrapOrElse = <T, E>(
  result: Result<T, E>,
  fn: (error: E) => T,
): T => (result.ok ? result.value : fn(result.error));

export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => U; err: (error: E) => U },
): U => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));

/** Convert throwing code at the boundary */
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

export const fromNullable = <T, E>(
  value: T | null | undefined,
  error: E,
): Result<T, E> => (value != null ? ok(value) : err(error));

export const isOk = <T, E>(
  result: Result<T, E>,
): result is { ok: true; value: T } => result.ok;
export const isErr = <T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } => !result.ok;
```

**Why good:** `never` on each constructor's other parameter lets `ok(1)` infer as
`Result<number, never>` and unify with whatever error type the surrounding function declares;
`readonly` stops a caller mutating a Result it received; and `map`/`flatMap` return the input
unchanged on the failing side rather than rebuilding it.

---

## Pattern 6: Typed error definitions

Errors get their own module, so the union that a function can fail with is stated once.

```typescript
// errors/user-errors.ts

export interface UserNotFoundError {
  readonly code: "USER_NOT_FOUND";
  readonly userId: string;
}

export interface UserAlreadyExistsError {
  readonly code: "USER_ALREADY_EXISTS";
  readonly email: string;
}

export interface InvalidCredentialsError {
  readonly code: "INVALID_CREDENTIALS";
}

export interface UserValidationError {
  readonly code: "USER_VALIDATION_ERROR";
  readonly field: string;
  readonly message: string;
}

export type UserError =
  | UserNotFoundError
  | UserAlreadyExistsError
  | InvalidCredentialsError
  | UserValidationError;

/** No parameters, so one instance serves every call site */
export const INVALID_CREDENTIALS_ERROR: InvalidCredentialsError = {
  code: "INVALID_CREDENTIALS",
};

export const userNotFoundError = (userId: string): UserNotFoundError => ({
  code: "USER_NOT_FOUND",
  userId,
});

export const userValidationError = (
  field: string,
  message: string,
): UserValidationError => ({
  code: "USER_VALIDATION_ERROR",
  field,
  message,
});
```

**Why good:** each variant carries only what its own handler reads — `userId` for the missing user,
`field` for the invalid one — so no handler has to check whether an optional field is present.
Factory functions keep the `code` literal in one place, where a typo would otherwise widen the
variant to `string` and break narrowing at every call site.

---

## Pattern 3 applied: Composing validations

```typescript
// services/user-service.ts
import type { Result } from "../lib/result";
import { ok, err, flatMap } from "../lib/result";
import type { UserError } from "../errors/user-errors";
import { userValidationError } from "../errors/user-errors";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): Result<string, UserError> {
  return EMAIL_PATTERN.test(email)
    ? ok(email)
    : err(userValidationError("email", "Invalid email format"));
}

function validatePassword(password: string): Result<string, UserError> {
  return password.length >= MIN_PASSWORD_LENGTH
    ? ok(password)
    : err(
        userValidationError(
          "password",
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        ),
      );
}

export function createUser(email: string, password: string, name: string) {
  return flatMap(validateEmail(email), (validEmail) =>
    flatMap(validatePassword(password), (validPassword) =>
      ok({ email: validEmail, password: validPassword, name }),
    ),
  );
}
```

**Why good:** the first invalid field ends the chain, and each validator is independently callable
and independently testable.

```typescript
// Bad — the same thing by hand
function createUser(email: string, password: string) {
  const emailResult = validateEmail(email);
  if (emailResult.ok) {
    const passwordResult = validatePassword(password);
    if (passwordResult.ok) {
      return ok({ email: emailResult.value, password: passwordResult.value });
    }
    return passwordResult;
  }
  return emailResult;
}
```

**Why bad:** the nesting deepens with every step added, and the return paths multiply — this shape
is where a forgotten `return` silently drops an error.

This chain stops at the first problem. To report every invalid field at once, see
[combining.md](combining.md).

---

## Pattern 4 applied: Wrapping throwing code

```typescript
// lib/safe-json.ts
import type { Result } from "./result";
import { tryCatch } from "./result";

const MAX_LOGGED_INPUT_LENGTH = 100;

export interface ParseError {
  readonly code: "PARSE_ERROR";
  readonly message: string;
  readonly input: string;
}

export function safeJsonParse<T>(json: string): Result<T, ParseError> {
  return tryCatch(
    () => JSON.parse(json) as T,
    (error): ParseError => ({
      code: "PARSE_ERROR",
      message: error instanceof Error ? error.message : "Unknown parse error",
      input: json.slice(0, MAX_LOGGED_INPUT_LENGTH),
    }),
  );
}

export function safeJsonStringify<T>(
  value: T,
  space?: number,
): Result<string, ParseError> {
  return tryCatch(
    () => JSON.stringify(value, null, space),
    (error): ParseError => ({
      code: "PARSE_ERROR",
      message:
        error instanceof Error ? error.message : "Unknown stringify error",
      input: String(value).slice(0, MAX_LOGGED_INPUT_LENGTH),
    }),
  );
}
```

**Why good:** the truncated input travels with the error, so the log says what failed to parse
without carrying a megabyte of it. `JSON.stringify` throws on a circular structure and on a
`BigInt`, which is why it is wrapped too.

```typescript
// Bad — the signature says it cannot throw
function parseUser(json: string): Result<User, ParseError> {
  const data = JSON.parse(json); // throws SyntaxError past the return type
  if (!data.name)
    return err({ code: "PARSE_ERROR", message: "Missing name", input: json });
  return ok(data);
}
```

**Why bad:** the caller was told every failure comes back as a value, so nothing wraps this call —
and malformed input takes down whatever is above it.

---

### Composing wrapped operations

```typescript
// lib/safe-storage.ts
import type { Result } from "./result";
import { ok, err, tryCatch, flatMap } from "./result";
import { safeJsonParse, safeJsonStringify } from "./safe-json";

interface StorageError {
  readonly code: "STORAGE_ERROR";
  readonly operation: "get" | "set";
  readonly key: string;
  readonly message: string;
}

const storageError = (
  operation: StorageError["operation"],
  key: string,
  message: string,
): StorageError => ({ code: "STORAGE_ERROR", operation, key, message });

export function getItem<T>(key: string): Result<T | null, StorageError> {
  const raw = tryCatch(
    () => localStorage.getItem(key),
    (error): StorageError =>
      storageError(
        "get",
        key,
        error instanceof Error ? error.message : "Unknown error",
      ),
  );

  if (!raw.ok) return raw;
  if (raw.value === null) return ok(null);

  const parsed = safeJsonParse<T>(raw.value);
  return parsed.ok
    ? ok(parsed.value)
    : err(storageError("get", key, parsed.error.message));
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
          error instanceof Error ? error.message : "Unknown error",
        ),
    ),
  );
}
```

**Why good:** `localStorage` throws in private browsing and on quota, so both the read and the write
are wrapped; the parse error is remapped to a storage error, so the caller handles one error type
rather than two. Absent key is `ok(null)` rather than an error — nothing failed.

---

## Pattern 5 applied: Converting at the outbound boundary

```typescript
// api/response-handler.ts
import { match } from "../lib/result";
import type { Result } from "../lib/result";
import type { UserError } from "../errors/user-errors";

interface HttpResponse {
  status: number;
  body: unknown;
}

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

export function toHttpResponse(result: Result<User, UserError>): HttpResponse {
  return match(result, {
    ok: (user) => ({ status: HTTP_STATUS.OK, body: user }),
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
          const unhandled: never = error;
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

**Why good:** the `never` assignment in `default` is what makes adding a fifth error variant a
compile error here rather than a silent 500 in production. The conversion happens once, at the edge —
everything inward of this function still holds a Result.
