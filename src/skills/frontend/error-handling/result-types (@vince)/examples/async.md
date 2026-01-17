# Async Result Patterns

> Patterns for handling asynchronous operations with Result types. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Promise Returning Result

The simplest async pattern - functions return `Promise<Result<T, E>>`.

### Good Example - Async Function with Result

```typescript
// src/lib/result-async.ts
import type { Result } from "./result";
import { ok, err } from "./result";

/** Type alias for async Result */
export type AsyncResult<T, E> = Promise<Result<T, E>>;

/** Async version of tryCatch */
export const tryCatchAsync = async <T, E>(
  fn: () => Promise<T>,
  onError: (error: unknown) => E
): AsyncResult<T, E> => {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(onError(error));
  }
};
```

**Why good:** Simple type alias for clarity, async tryCatch wraps promises, same pattern as sync version

---

### Good Example - API Client with Results

```typescript
// src/api/client.ts
import type { AsyncResult } from "../lib/result-async";
import { ok, err, tryCatchAsync } from "../lib/result-async";
import type { ApiError } from "../errors/api-errors";
import { httpError, networkError, parseError } from "../errors/api-errors";

const API_BASE_URL = "/api";
const DEFAULT_TIMEOUT_MS = 30000;

interface FetchOptions extends RequestInit {
  timeout?: number;
}

export async function apiRequest<T>(
  endpoint: string,
  options: FetchOptions = {}
): AsyncResult<T, ApiError> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return err(httpError(response.status, response.statusText));
    }

    const data = await response.json();
    return ok(data as T);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return err({ code: "TIMEOUT", timeoutMs: timeout });
    }

    return err(
      networkError(
        error instanceof Error ? error.message : "Network request failed",
        error
      )
    );
  }
}

// Convenience methods
export const get = <T>(endpoint: string): AsyncResult<T, ApiError> =>
  apiRequest<T>(endpoint, { method: "GET" });

export const post = <T>(endpoint: string, body: unknown): AsyncResult<T, ApiError> =>
  apiRequest<T>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const put = <T>(endpoint: string, body: unknown): AsyncResult<T, ApiError> =>
  apiRequest<T>(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const del = <T>(endpoint: string): AsyncResult<T, ApiError> =>
  apiRequest<T>(endpoint, { method: "DELETE" });
```

**Why good:** Handles timeout, network errors, and HTTP errors as typed Results, named constants for configuration, convenience methods for common operations

---

## Pattern 2: Chaining Async Results

### Good Example - Sequential Async Operations

```typescript
// src/lib/result-async.ts (additional functions)
import type { Result, AsyncResult } from "./result";
import { ok, err, isOk } from "./result";

/** Chain async Results - like flatMap but for async */
export const flatMapAsync = async <T, U, E, F>(
  result: AsyncResult<T, E>,
  fn: (value: T) => AsyncResult<U, F>
): AsyncResult<U, E | F> => {
  const awaited = await result;
  if (!awaited.ok) {
    return awaited;
  }
  return fn(awaited.value);
};

/** Map over async Result */
export const mapAsync = async <T, U, E>(
  result: AsyncResult<T, E>,
  fn: (value: T) => U
): AsyncResult<U, E> => {
  const awaited = await result;
  if (!awaited.ok) {
    return awaited;
  }
  return ok(fn(awaited.value));
};
```

---

### Good Example - User Registration Flow

```typescript
// src/services/registration-service.ts
import type { AsyncResult } from "../lib/result-async";
import { ok, err, flatMapAsync, mapAsync } from "../lib/result-async";
import { get, post } from "../api/client";
import type { User } from "../types/user";
import type { UserError, ApiError } from "../errors";

interface RegistrationData {
  email: string;
  password: string;
  name: string;
}

// Check if email is available
async function checkEmailAvailable(email: string): AsyncResult<string, UserError> {
  const result = await get<{ available: boolean }>(`/users/check-email?email=${email}`);

  if (!result.ok) {
    return err({
      code: "USER_VALIDATION_ERROR",
      field: "email",
      message: "Could not verify email availability",
    });
  }

  if (!result.value.available) {
    return err({
      code: "USER_ALREADY_EXISTS",
      email,
    });
  }

  return ok(email);
}

// Create user account
async function createAccount(data: RegistrationData): AsyncResult<User, UserError> {
  const result = await post<User>("/users", data);

  if (!result.ok) {
    // Map API error to domain error
    return err({
      code: "USER_VALIDATION_ERROR",
      field: "unknown",
      message: result.error.message,
    });
  }

  return ok(result.value);
}

// Send welcome email (fire and forget, but track success)
async function sendWelcomeEmail(user: User): AsyncResult<User, UserError> {
  const result = await post<void>("/emails/welcome", { userId: user.id });

  // Email failure shouldn't fail registration
  if (!result.ok) {
    console.warn("Failed to send welcome email:", result.error);
  }

  return ok(user); // Always succeed
}

// Composed registration flow
export async function registerUser(
  data: RegistrationData
): AsyncResult<User, UserError> {
  // Chain: validate email -> create account -> send welcome email
  const emailResult = await checkEmailAvailable(data.email);
  if (!emailResult.ok) return emailResult;

  const accountResult = await createAccount(data);
  if (!accountResult.ok) return accountResult;

  const emailSentResult = await sendWelcomeEmail(accountResult.value);
  return emailSentResult;
}

// Alternative with flatMapAsync (cleaner for longer chains)
export async function registerUserChained(
  data: RegistrationData
): AsyncResult<User, UserError> {
  return flatMapAsync(
    checkEmailAvailable(data.email),
    () => flatMapAsync(createAccount(data), sendWelcomeEmail)
  );
}
```

**Why good:** Each step is a separate function returning Result, errors short-circuit the chain, non-critical failures (email) don't fail the operation

---

## Pattern 3: Parallel Async Operations

### Good Example - Parallel with All-or-Nothing

```typescript
// src/lib/result-async.ts (additional functions)

/** Run async Results in parallel, fail on first error */
export const combineAsync = async <T, E>(
  results: AsyncResult<T, E>[]
): AsyncResult<T[], E> => {
  const awaited = await Promise.all(results);

  for (const result of awaited) {
    if (!result.ok) {
      return result;
    }
  }

  return ok(awaited.map((r) => r.value as T));
};

/** Run async Results in parallel, collect all errors */
export const combineAllErrorsAsync = async <T, E>(
  results: AsyncResult<T, E>[]
): AsyncResult<T[], E[]> => {
  const awaited = await Promise.all(results);

  const values: T[] = [];
  const errors: E[] = [];

  for (const result of awaited) {
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

### Good Example - Dashboard Data Loading

```typescript
// src/features/dashboard/load-dashboard.ts
import type { AsyncResult } from "../lib/result-async";
import { ok, combineAsync } from "../lib/result-async";
import { get } from "../api/client";
import type { ApiError } from "../errors/api-errors";

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
  notifications: boolean;
}

interface DashboardData {
  user: User;
  posts: Post[];
  settings: Settings;
}

// Individual loaders
const loadUser = (userId: string): AsyncResult<User, ApiError> =>
  get<User>(`/users/${userId}`);

const loadPosts = (userId: string): AsyncResult<Post[], ApiError> =>
  get<Post[]>(`/users/${userId}/posts`);

const loadSettings = (userId: string): AsyncResult<Settings, ApiError> =>
  get<Settings>(`/users/${userId}/settings`);

// Parallel load all dashboard data
export async function loadDashboard(
  userId: string
): AsyncResult<DashboardData, ApiError> {
  const result = await combineAsync([
    loadUser(userId),
    loadPosts(userId),
    loadSettings(userId),
  ]);

  if (!result.ok) {
    return result;
  }

  const [user, posts, settings] = result.value as [User, Post[], Settings];
  return ok({ user, posts, settings });
}

// Usage
async function initDashboard(userId: string) {
  const result = await loadDashboard(userId);

  if (result.ok) {
    renderDashboard(result.value);
  } else {
    switch (result.error.code) {
      case "HTTP_ERROR":
        if (result.error.statusCode === 401) {
          redirectToLogin();
        } else {
          showError("Failed to load dashboard");
        }
        break;
      case "NETWORK_ERROR":
        showError("Network error. Please check your connection.");
        break;
      case "TIMEOUT":
        showError("Request timed out. Please try again.");
        break;
    }
  }
}
```

**Why good:** Parallel loading for performance, single error handling point, typed error enables specific handling

---

## Pattern 4: Retry Logic with Results

### Good Example - Exponential Backoff Retry

```typescript
// src/lib/retry.ts
import type { AsyncResult } from "./result-async";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const BACKOFF_MULTIPLIER = 2;

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T, E>(
  operation: () => AsyncResult<T, E>,
  options: RetryOptions = {}
): AsyncResult<T, E> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    shouldRetry = () => true,
  } = options;

  let lastResult: Awaited<AsyncResult<T, E>>;
  let attempt = 0;

  while (attempt <= maxRetries) {
    lastResult = await operation();

    if (lastResult.ok) {
      return lastResult;
    }

    if (attempt >= maxRetries || !shouldRetry(lastResult.error)) {
      return lastResult;
    }

    const delayMs = baseDelayMs * Math.pow(BACKOFF_MULTIPLIER, attempt);
    await sleep(delayMs);
    attempt++;
  }

  return lastResult!;
}

// Usage with API call
import { get } from "../api/client";
import type { ApiError } from "../errors/api-errors";

const isRetryableError = (error: ApiError): boolean => {
  if (error.code === "NETWORK_ERROR") return true;
  if (error.code === "TIMEOUT") return true;
  if (error.code === "HTTP_ERROR" && error.statusCode >= 500) return true;
  return false;
};

async function fetchUserWithRetry(userId: string) {
  return withRetry(() => get<User>(`/users/${userId}`), {
    maxRetries: 3,
    baseDelayMs: 1000,
    shouldRetry: isRetryableError,
  });
}
```

**Why good:** Named constants for configuration, configurable retry logic, only retries transient errors, exponential backoff prevents thundering herd

---

## Pattern 5: Converting Promise to Result

### Good Example - Promise Adapter

```typescript
// src/lib/promise-to-result.ts
import type { AsyncResult } from "./result-async";
import { ok, err, tryCatchAsync } from "./result-async";

/**
 * Convert any Promise to a Result.
 * Use when integrating with libraries that return Promises.
 */
export function fromPromise<T, E>(
  promise: Promise<T>,
  mapError: (error: unknown) => E
): AsyncResult<T, E> {
  return tryCatchAsync(() => promise, mapError);
}

// Usage with third-party libraries
import type { ApiError } from "../errors/api-errors";
import { networkError } from "../errors/api-errors";

// Wrap a library that returns Promises
async function uploadFile(file: File): AsyncResult<string, ApiError> {
  // Assume uploadToS3 is from a library returning Promise<string>
  return fromPromise(
    uploadToS3(file),
    (error): ApiError =>
      networkError(
        error instanceof Error ? error.message : "Upload failed",
        error
      )
  );
}
```

**Why good:** Clean boundary between Promise-land and Result-land, error mapping at boundary, works with any Promise-returning library

---

## Anti-Pattern Examples

### Bad Example - Await Without Handling Result

```typescript
// BAD: Awaiting but ignoring the Result
async function processUser(userId: string): Promise<void> {
  await fetchUser(userId); // Result is awaited but discarded!
  console.log("Done");
}
```

**Why bad:** Promise is awaited but Result inside is ignored, no error handling

---

### Bad Example - try/catch Around Result Functions

```typescript
// BAD: Mixing paradigms unnecessarily
async function getUser(userId: string): Promise<User> {
  try {
    const result = await fetchUser(userId);
    if (!result.ok) {
      throw new Error(result.error.message); // Converting back to exception!
    }
    return result.value;
  } catch (error) {
    throw error;
  }
}
```

**Why bad:** Converts Result back to exception, loses typed error information, defeats purpose of Result

---

### Good Example - Proper Async Error Propagation

```typescript
// GOOD: Keep as Result, handle at boundary
async function getUser(userId: string): AsyncResult<User, UserError> {
  return fetchUser(userId); // Propagate Result
}

// At UI boundary - convert to appropriate action
async function handleLoadUser(userId: string) {
  const result = await getUser(userId);

  if (result.ok) {
    setUser(result.value);
  } else {
    switch (result.error.code) {
      case "USER_NOT_FOUND":
        showNotFound();
        break;
      case "UNAUTHORIZED":
        redirectToLogin();
        break;
      default:
        showError(result.error.message);
    }
  }
}
```

**Why good:** Results stay as Results until boundary, typed errors enable specific handling, clean separation

---

> **See also:**
> - [core.md](core.md) - Core Result patterns
> - [combining.md](combining.md) - Combining multiple Results
