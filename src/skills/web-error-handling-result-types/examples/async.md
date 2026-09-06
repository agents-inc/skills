# Result Types — Async Patterns

> Full code for asynchronous Results. See [core.md](core.md) for the module these build on.

A `Promise<Result<T, E>>` never rejects: the promise settles, and the failure is inside it. That
makes `await` the only thing the caller has to remember — after which the ordinary `ok` check applies.

---

## The async helpers

```typescript
// lib/result-async.ts
import type { Result } from "./result";
import { ok, err } from "./result";

export type AsyncResult<T, E> = Promise<Result<T, E>>;

export const tryCatchAsync = async <T, E>(
  fn: () => Promise<T>,
  onError: (error: unknown) => E,
): AsyncResult<T, E> => {
  try {
    return ok(await fn());
  } catch (error) {
    return err(onError(error));
  }
};

export const flatMapAsync = async <T, U, E, F>(
  result: AsyncResult<T, E>,
  fn: (value: T) => AsyncResult<U, F>,
): AsyncResult<U, E | F> => {
  const awaited = await result;
  return awaited.ok ? fn(awaited.value) : awaited;
};

export const mapAsync = async <T, U, E>(
  result: AsyncResult<T, E>,
  fn: (value: T) => U,
): AsyncResult<U, E> => {
  const awaited = await result;
  return awaited.ok ? ok(fn(awaited.value)) : awaited;
};

/** Convert any promise-returning API at the boundary */
export const fromPromise = <T, E>(
  promise: Promise<T>,
  onError: (error: unknown) => E,
): AsyncResult<T, E> => tryCatchAsync(() => promise, onError);
```

**Why good:** `AsyncResult` is a type alias rather than a class, so it stays a plain promise and
works with `Promise.all`, `await` and every other promise combinator unchanged.

---

## A request client that returns Results

```typescript
// api/client.ts
import type { AsyncResult } from "../lib/result-async";
import { ok, err } from "../lib/result";

const API_BASE_URL = "/api";
const DEFAULT_TIMEOUT_MS = 30_000;

export type ApiError =
  | {
      readonly code: "HTTP_ERROR";
      readonly statusCode: number;
      readonly message: string;
    }
  | { readonly code: "TIMEOUT"; readonly timeoutMs: number }
  | {
      readonly code: "NETWORK_ERROR";
      readonly message: string;
      readonly cause?: unknown;
    };

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): AsyncResult<T, ApiError> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...requestOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...requestOptions,
      signal: controller.signal,
    });

    if (!response.ok) {
      return err({
        code: "HTTP_ERROR",
        statusCode: response.status,
        message: response.statusText,
      });
    }

    return ok((await response.json()) as T);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return err({ code: "TIMEOUT", timeoutMs });
    }
    return err({
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Request failed",
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const get = <T>(endpoint: string): AsyncResult<T, ApiError> =>
  apiRequest<T>(endpoint, { method: "GET" });

export const post = <T>(
  endpoint: string,
  body: unknown,
): AsyncResult<T, ApiError> =>
  apiRequest<T>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
```

**Why good:** the three ways a request fails become three variants a caller can tell apart —
`fetch` rejects only on a network failure, so the non-2xx case has to be turned into an error
explicitly. `clearTimeout` in `finally` runs on every path, including the successful one.

---

## Chaining dependent steps

```typescript
// services/registration-service.ts
import type { AsyncResult } from "../lib/result-async";
import { ok, err } from "../lib/result";
import { get, post } from "../api/client";
import type { User } from "../types/user";
import type { UserError } from "../errors/user-errors";
import { userValidationError } from "../errors/user-errors";

interface RegistrationData {
  email: string;
  password: string;
  name: string;
}

async function checkEmailAvailable(
  email: string,
): AsyncResult<string, UserError> {
  const result = await get<{ available: boolean }>(
    `/users/check-email?email=${encodeURIComponent(email)}`,
  );

  if (!result.ok) {
    return err(
      userValidationError("email", "Could not verify email availability"),
    );
  }
  return result.value.available
    ? ok(email)
    : err({ code: "USER_ALREADY_EXISTS", email });
}

async function createAccount(
  data: RegistrationData,
): AsyncResult<User, UserError> {
  const result = await post<User>("/users", data);
  return result.ok
    ? ok(result.value)
    : err(
        userValidationError(
          "unknown",
          result.error.code === "TIMEOUT"
            ? "Account creation timed out"
            : result.error.message,
        ),
      );
}

/** Failure here must not fail registration — the account exists either way */
async function sendWelcomeEmail(user: User): AsyncResult<User, UserError> {
  const result = await post<void>("/emails/welcome", { userId: user.id });
  if (!result.ok) console.warn("Failed to send welcome email:", result.error);
  return ok(user);
}

export async function registerUser(
  data: RegistrationData,
): AsyncResult<User, UserError> {
  const emailResult = await checkEmailAvailable(data.email);
  if (!emailResult.ok) return emailResult;

  const accountResult = await createAccount(data);
  if (!accountResult.ok) return accountResult;

  return sendWelcomeEmail(accountResult.value);
}
```

**Why good:** the transport error is remapped to a domain error at each step, so the caller handles
`UserError` alone. `sendWelcomeEmail` returning `ok` on failure is the deliberate part — a
best-effort step that reports and continues, rather than one that rolls a created account back.

---

## Running independent requests in parallel

```typescript
// lib/result-async.ts (continued)
import type { AsyncResult } from "./result-async";
import { ok, err } from "./result";

/** All must succeed; the first error wins */
export const combineAsync = async <T, E>(
  results: AsyncResult<T, E>[],
): AsyncResult<T[], E> => {
  const awaited = await Promise.all(results);
  const values: T[] = [];

  for (const result of awaited) {
    if (!result.ok) return result;
    values.push(result.value);
  }

  return ok(values);
};

/** Every failure is reported */
export const combineAllErrorsAsync = async <T, E>(
  results: AsyncResult<T, E>[],
): AsyncResult<T[], E[]> => {
  const awaited = await Promise.all(results);
  const values = awaited.flatMap((result) => (result.ok ? [result.value] : []));
  const errors = awaited.flatMap((result) => (result.ok ? [] : [result.error]));
  return errors.length > 0 ? err(errors) : ok(values);
};
```

Where the results have different types, await them together and check each — that keeps every type
without a tuple cast.

```typescript
// features/dashboard/load-dashboard.ts
import type { AsyncResult } from "../../lib/result-async";
import { ok } from "../../lib/result";
import type { ApiError } from "../../api/client";
import { get } from "../../api/client";

interface User {
  readonly id: string;
  readonly name: string;
}

interface Post {
  readonly id: string;
  readonly title: string;
}

interface Settings {
  readonly theme: string;
  readonly notifications: boolean;
}

interface DashboardData {
  readonly user: User;
  readonly posts: Post[];
  readonly settings: Settings;
}

const loadUser = (userId: string): AsyncResult<User, ApiError> =>
  get<User>(`/users/${userId}`);

const loadPosts = (userId: string): AsyncResult<Post[], ApiError> =>
  get<Post[]>(`/users/${userId}/posts`);

const loadSettings = (userId: string): AsyncResult<Settings, ApiError> =>
  get<Settings>(`/users/${userId}/settings`);

export async function loadDashboard(
  userId: string,
): AsyncResult<DashboardData, ApiError> {
  const [user, posts, settings] = await Promise.all([
    loadUser(userId),
    loadPosts(userId),
    loadSettings(userId),
  ]);

  if (!user.ok) return user;
  if (!posts.ok) return posts;
  if (!settings.ok) return settings;

  return ok({ user: user.value, posts: posts.value, settings: settings.value });
}
```

**Why good:** `Promise.all` starts all three at once, and because none of them rejects it never
short-circuits — every request completes and the combination decides what to do with the failures.
That is the opposite of `Promise.all` over raw promises, where the first rejection abandons the rest.

---

## Retrying only what a retry can fix

```typescript
// lib/retry.ts
import type { AsyncResult } from "./result-async";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;
const SERVER_ERROR_STATUS = 500;

interface RetryOptions<E> {
  maxRetries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: E) => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T, E>(
  operation: () => AsyncResult<T, E>,
  options: RetryOptions<E> = {},
): AsyncResult<T, E> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    shouldRetry = () => true,
  } = options;

  let attempt = 0;
  let result = await operation();

  while (!result.ok && attempt < maxRetries && shouldRetry(result.error)) {
    await sleep(baseDelayMs * 2 ** attempt);
    attempt += 1;
    result = await operation();
  }

  return result;
}

const isRetryable = (error: ApiError): boolean =>
  error.code === "NETWORK_ERROR" ||
  error.code === "TIMEOUT" ||
  (error.code === "HTTP_ERROR" && error.statusCode >= SERVER_ERROR_STATUS);
```

**Why good:** `shouldRetry` reads the discriminant, so a 404 fails once and a 503 backs off — the
typed error is what makes that distinction available without parsing a message.

---

## Anti-patterns

```typescript
// Bad — awaited, then discarded
async function processUser(userId: string): Promise<void> {
  await fetchUser(userId);
  render();
}
```

**Why bad:** the `await` makes it look handled. The Result inside was never read, so a failed fetch
renders as though it had succeeded.

```typescript
// Bad — converted straight back to an exception
async function getUser(userId: string): Promise<User> {
  const result = await fetchUser(userId);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
```

**Why bad:** the discriminant, the status code and every other field are thrown away, and the
caller is back to a string. Propagate the Result and convert once, at the boundary that has to speak
another language.

```typescript
// Bad — checked before it settled
const result = fetchUser(userId);
if (result.ok) {
  // never reached: a pending promise has no `ok`
}
```

**Why bad:** a promise is an object with no `ok` property, so the check is `undefined` and the
success branch never runs — silently, with no error anywhere.
