# Result Types — Combining Results

> Fail-fast, collect-all, object and sequential combination. See [core.md](core.md) for the module these build on.

The choice is one question: does the caller act on the first failure, or on all of them? A chain of
dependent steps has nothing to collect. A form has nothing to gain by hiding four problems behind
one.

---

## Pattern 7: Fail-fast (`combine`)

```typescript
// lib/result.ts (continued)
import type { Result } from "./result";
import { ok } from "./result";

export const combine = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }

  return ok(values);
};
```

**Why good:** the loop returns the failing Result itself rather than rebuilding it, so the error
type flows through untouched.

```typescript
// services/order-service.ts
import type { Result } from "../lib/result";
import { ok, err, combine, flatMap } from "../lib/result";

interface OrderItem {
  readonly productId: string;
  readonly quantity: number;
  readonly price: number;
}

interface Order {
  readonly items: readonly OrderItem[];
  readonly shippingAddress: string;
  readonly paymentMethod: string;
}

type OrderError =
  | {
      readonly code: "VALIDATION_ERROR";
      readonly field: string;
      readonly message: string;
    }
  | { readonly code: "STOCK_ERROR"; readonly productId: string };

const MIN_ORDER_QUANTITY = 1;
const MAX_ORDER_QUANTITY = 100;

function validateQuantity(item: OrderItem): Result<OrderItem, OrderError> {
  const inRange =
    item.quantity >= MIN_ORDER_QUANTITY && item.quantity <= MAX_ORDER_QUANTITY;
  return inRange
    ? ok(item)
    : err({
        code: "VALIDATION_ERROR",
        field: "quantity",
        message: `Quantity must be between ${MIN_ORDER_QUANTITY} and ${MAX_ORDER_QUANTITY}`,
      });
}

function validatePrice(item: OrderItem): Result<OrderItem, OrderError> {
  return item.price > 0
    ? ok(item)
    : err({
        code: "VALIDATION_ERROR",
        field: "price",
        message: "Price must be positive",
      });
}

export function validateOrder(order: Order): Result<Order, OrderError> {
  const perItem = order.items.map((item) =>
    flatMap(validateQuantity(item), () => validatePrice(item)),
  );

  return flatMap(combine(perItem), () => ok(order));
}
```

**Why good:** an order with an impossible quantity is rejected whole, so there is no partial order to
clean up afterwards.

---

## Pattern 7 continued: Collect all (`combineWithAllErrors`)

```typescript
// lib/result.ts (continued)

export const combineWithAllErrors = <T, E>(
  results: Result<T, E>[],
): Result<T[], E[]> => {
  const values = results.flatMap((result) => (result.ok ? [result.value] : []));
  const errors = results.flatMap((result) => (result.ok ? [] : [result.error]));

  return errors.length > 0 ? err(errors) : ok(values);
};
```

```typescript
// features/registration/validate-form.ts
import type { Result } from "../lib/result";
import { ok, err, combineWithAllErrors } from "../lib/result";

interface FieldError {
  readonly field: string;
  readonly message: string;
}

interface RegistrationForm {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly age: number;
}

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 8;
const MIN_AGE = 13;
const MAX_AGE = 120;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldError = (
  field: string,
  message: string,
): Result<never, FieldError> => err({ field, message });

function validateUsername(username: string): Result<string, FieldError> {
  if (
    username.length < MIN_USERNAME_LENGTH ||
    username.length > MAX_USERNAME_LENGTH
  ) {
    return fieldError(
      "username",
      `Username must be ${MIN_USERNAME_LENGTH}–${MAX_USERNAME_LENGTH} characters`,
    );
  }
  if (!USERNAME_PATTERN.test(username)) {
    return fieldError("username", "Letters, numbers and underscores only");
  }
  return ok(username);
}

function validateEmail(email: string): Result<string, FieldError> {
  return EMAIL_PATTERN.test(email)
    ? ok(email)
    : fieldError("email", "Enter a valid email address");
}

function validatePassword(password: string): Result<string, FieldError> {
  return password.length >= MIN_PASSWORD_LENGTH
    ? ok(password)
    : fieldError(
        "password",
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
}

function validatePasswordMatch(
  password: string,
  confirm: string,
): Result<string, FieldError> {
  return password === confirm
    ? ok(confirm)
    : fieldError("confirmPassword", "Passwords do not match");
}

function validateAge(age: number): Result<number, FieldError> {
  return age >= MIN_AGE && age <= MAX_AGE
    ? ok(age)
    : fieldError("age", `Age must be between ${MIN_AGE} and ${MAX_AGE}`);
}

export function validateRegistrationForm(
  form: RegistrationForm,
): Result<RegistrationForm, FieldError[]> {
  const results = combineWithAllErrors([
    validateUsername(form.username),
    validateEmail(form.email),
    validatePassword(form.password),
    validatePasswordMatch(form.password, form.confirmPassword),
    validateAge(form.age),
  ]);

  return results.ok ? ok(form) : results;
}
```

**Why good:** every field is validated regardless of the ones before it, and the error carries
`field`, so each message can be placed against the input it belongs to rather than dumped in a list.

```typescript
// Bad — collected them all, showed one
const result = validateRegistrationForm(form);
if (!result.ok) showError(result.error[0].message);
```

**Why bad:** the user fixes one field, resubmits, and meets the next — which is the experience
fail-fast would have given for a fraction of the work.

---

## Combining into an object

An array of Results loses which value was which. Keying them keeps the shape.

```typescript
type ResultObject<T extends Record<string, Result<unknown, unknown>>> = {
  [K in keyof T]: T[K] extends Result<infer V, unknown> ? V : never;
};

type ErrorUnion<T extends Record<string, Result<unknown, unknown>>> =
  T[keyof T] extends Result<unknown, infer E> ? E : never;

export const combineObject = <
  T extends Record<string, Result<unknown, unknown>>,
>(
  results: T,
): Result<ResultObject<T>, ErrorUnion<T>> => {
  const output: Record<string, unknown> = {};

  for (const [key, result] of Object.entries(results)) {
    if (!result.ok) return result as Result<ResultObject<T>, ErrorUnion<T>>;
    output[key] = result.value;
  }

  return ok(output as ResultObject<T>);
};
```

```typescript
// config/load-config.ts
import type { Result } from "../lib/result";
import { ok, err, combineObject } from "../lib/result";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

interface ConfigError {
  readonly code: "CONFIG_ERROR";
  readonly key: string;
  readonly message: string;
}

function requiredString(key: string): Result<string, ConfigError> {
  const value = process.env[key];
  return value
    ? ok(value)
    : err({
        code: "CONFIG_ERROR",
        key,
        message: `Missing required variable: ${key}`,
      });
}

function numberWithDefault(
  key: string,
  fallback: number,
): Result<number, ConfigError> {
  const value = process.env[key];
  if (!value) return ok(fallback);

  const parsed = Number(value);
  return Number.isNaN(parsed)
    ? err({
        code: "CONFIG_ERROR",
        key,
        message: `Invalid number for ${key}: ${value}`,
      })
    : ok(parsed);
}

export const loadConfig = () =>
  combineObject({
    apiUrl: requiredString("API_URL"),
    apiTimeoutMs: numberWithDefault("API_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    maxRetries: numberWithDefault("MAX_RETRIES", DEFAULT_MAX_RETRIES),
  });
```

**Why good:** the returned object's keys and value types are derived from the input, so adding a
setting needs no change to the combining code. Configuration is where fail-fast is unarguable — a
program with a missing required value has nothing useful to do.

---

## Sequential processing (`traverse` and `foldResult`)

Where each item is processed in turn and the first failure should stop the rest.

```typescript
// lib/result.ts (continued)

export const traverse = <T, U, E>(
  items: readonly T[],
  fn: (item: T, index: number) => Result<U, E>,
): Result<U[], E> => {
  const results: U[] = [];

  for (const [index, item] of items.entries()) {
    const result = fn(item, index);
    if (!result.ok) return result;
    results.push(result.value);
  }

  return ok(results);
};

/** Accumulate across items, stopping at the first failure */
export const foldResult = <T, A, E>(
  items: readonly T[],
  initial: A,
  fn: (accumulator: A, item: T, index: number) => Result<A, E>,
): Result<A, E> => {
  let accumulator = initial;

  for (const [index, item] of items.entries()) {
    const result = fn(accumulator, item, index);
    if (!result.ok) return result;
    accumulator = result.value;
  }

  return ok(accumulator);
};
```

**Why good:** `traverse` turns a list plus a fallible function into one Result over the whole list,
which is what a caller wants — a partial list with holes in it is rarely useful. The index reaches
the error, so a failure can say which row.

---

## Dependent steps

When a later step needs an earlier step's value, `flatMap` nests and the alternative reads better.
The three writes belong to the application rather than to this pattern, so they are declared here by
signature only — all the pattern needs from them is that each returns a Result.

```typescript
// services/user-setup.ts
import type { Result } from "../lib/result";
import { ok } from "../lib/result";

interface SetupError {
  readonly code: "SETUP_ERROR";
  readonly step: string;
  readonly message: string;
}

interface User {
  readonly id: string;
  readonly email: string;
}

interface Workspace {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
}

interface Membership {
  readonly userId: string;
  readonly workspaceId: string;
  readonly role: "owner" | "member";
}

interface SetupResult {
  readonly user: User;
  readonly workspace: Workspace;
  readonly membership: Membership;
}

declare function createUser(email: string): Result<User, SetupError>;
declare function createWorkspace(user: User): Result<Workspace, SetupError>;
declare function createMembership(
  user: User,
  workspace: Workspace,
): Result<Membership, SetupError>;

export function setupUser(email: string): Result<SetupResult, SetupError> {
  const userResult = createUser(email);
  if (!userResult.ok) return userResult;

  const workspaceResult = createWorkspace(userResult.value);
  if (!workspaceResult.ok) return workspaceResult;

  const membershipResult = createMembership(
    userResult.value,
    workspaceResult.value,
  );
  if (!membershipResult.ok) return membershipResult;

  return ok({
    user: userResult.value,
    workspace: workspaceResult.value,
    membership: membershipResult.value,
  });
}
```

**Why good:** every intermediate value stays in scope for the steps after it, which nested `flatMap`
callbacks also give but at three levels of indentation. Early return is the flatter form of the same
railway, and it is the one to reach for once a chain needs more than one earlier value.

Note what this does not do: three writes with no rollback between them means a failure at step three
leaves the first two in place. Where that matters, the whole sequence belongs inside one transaction
rather than inside one Result.
