# Combining Multiple Results

> Patterns for combining multiple Result values - fail-fast and collect-all strategies. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Fail-Fast Combination (combine)

Stop at the first error and return it. Use when any failure means the whole operation fails.

### Implementation

```typescript
// src/lib/result.ts (additional functions)
import type { Result } from "./result";
import { ok, err } from "./result";

/**
 * Combine multiple Results, failing on first error.
 * Returns array of success values if all succeed.
 */
export const combine = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) {
      return result; // Return first error
    }
    values.push(result.value);
  }

  return ok(values);
};

/**
 * Combine Results of different types (tuple version).
 * Preserves individual types in the result tuple.
 */
export function combineTyped<A, B, E>(
  results: [Result<A, E>, Result<B, E>]
): Result<[A, B], E>;
export function combineTyped<A, B, C, E>(
  results: [Result<A, E>, Result<B, E>, Result<C, E>]
): Result<[A, B, C], E>;
export function combineTyped<A, B, C, D, E>(
  results: [Result<A, E>, Result<B, E>, Result<C, E>, Result<D, E>]
): Result<[A, B, C, D], E>;
export function combineTyped<T, E>(results: Result<T, E>[]): Result<T[], E> {
  return combine(results);
}
```

**Why good:** Early exit on first error (performance), preserves types with overloads, simple array accumulation

---

### Good Example - Order Processing

```typescript
// src/services/order-service.ts
import type { Result } from "../lib/result";
import { ok, err, combine, combineTyped } from "../lib/result";

interface OrderError {
  code: "VALIDATION_ERROR" | "STOCK_ERROR" | "PAYMENT_ERROR";
  message: string;
  field?: string;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

interface Order {
  items: OrderItem[];
  shippingAddress: string;
  paymentMethod: string;
}

const MIN_ORDER_QUANTITY = 1;
const MAX_ORDER_QUANTITY = 100;

// Individual validations
function validateQuantity(item: OrderItem): Result<OrderItem, OrderError> {
  if (item.quantity < MIN_ORDER_QUANTITY || item.quantity > MAX_ORDER_QUANTITY) {
    return err({
      code: "VALIDATION_ERROR",
      message: `Quantity must be between ${MIN_ORDER_QUANTITY} and ${MAX_ORDER_QUANTITY}`,
      field: "quantity",
    });
  }
  return ok(item);
}

function validatePrice(item: OrderItem): Result<OrderItem, OrderError> {
  if (item.price <= 0) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Price must be positive",
      field: "price",
    });
  }
  return ok(item);
}

function checkStock(item: OrderItem): Result<OrderItem, OrderError> {
  // Simulated stock check
  const inStock = true; // Would be actual check
  if (!inStock) {
    return err({
      code: "STOCK_ERROR",
      message: `Product ${item.productId} is out of stock`,
    });
  }
  return ok(item);
}

// Validate all items - fail on first error
function validateOrder(order: Order): Result<Order, OrderError> {
  const itemValidations = order.items.map((item) => {
    // Chain validations per item
    const quantityResult = validateQuantity(item);
    if (!quantityResult.ok) return quantityResult;

    const priceResult = validatePrice(item);
    if (!priceResult.ok) return priceResult;

    return checkStock(item);
  });

  // Combine all item validations
  const result = combine(itemValidations);
  if (!result.ok) {
    return result;
  }

  return ok(order);
}

// Usage
const order: Order = {
  items: [
    { productId: "ABC", quantity: 2, price: 29.99 },
    { productId: "XYZ", quantity: 0, price: 15.00 }, // Invalid quantity!
  ],
  shippingAddress: "123 Main St",
  paymentMethod: "card",
};

const result = validateOrder(order);
if (!result.ok) {
  console.error(`Order invalid: ${result.error.message}`);
  // Shows first error: "Quantity must be between 1 and 100"
}
```

**Why good:** Stops at first error (user fixes one at a time), clear error messages, named constants for limits

---

## Pattern 2: Collect All Errors (combineWithAllErrors)

Gather all errors instead of stopping at first. Essential for form validation where users should see all problems at once.

### Implementation

```typescript
// src/lib/result.ts (additional functions)

/**
 * Combine multiple Results, collecting ALL errors.
 * Returns array of all errors if any fail.
 */
export const combineWithAllErrors = <T, E>(
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

**Why good:** Collects all errors for display, separates success and failure paths, returns typed error array

---

### Good Example - Form Validation

```typescript
// src/features/registration/validate-form.ts
import type { Result } from "../lib/result";
import { ok, err, combineWithAllErrors } from "../lib/result";

interface FieldError {
  field: string;
  message: string;
}

interface RegistrationForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  age: number;
}

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 8;
const MIN_AGE = 13;
const MAX_AGE = 120;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUsername(username: string): Result<string, FieldError> {
  if (username.length < MIN_USERNAME_LENGTH) {
    return err({
      field: "username",
      message: `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
    });
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    return err({
      field: "username",
      message: `Username must be at most ${MAX_USERNAME_LENGTH} characters`,
    });
  }
  if (!USERNAME_REGEX.test(username)) {
    return err({
      field: "username",
      message: "Username can only contain letters, numbers, and underscores",
    });
  }
  return ok(username);
}

function validateEmail(email: string): Result<string, FieldError> {
  if (!EMAIL_REGEX.test(email)) {
    return err({
      field: "email",
      message: "Please enter a valid email address",
    });
  }
  return ok(email);
}

function validatePassword(password: string): Result<string, FieldError> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return err({
      field: "password",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }
  return ok(password);
}

function validatePasswordMatch(
  password: string,
  confirmPassword: string
): Result<string, FieldError> {
  if (password !== confirmPassword) {
    return err({
      field: "confirmPassword",
      message: "Passwords do not match",
    });
  }
  return ok(confirmPassword);
}

function validateAge(age: number): Result<number, FieldError> {
  if (age < MIN_AGE || age > MAX_AGE) {
    return err({
      field: "age",
      message: `Age must be between ${MIN_AGE} and ${MAX_AGE}`,
    });
  }
  return ok(age);
}

// Validate entire form, collecting ALL errors
export function validateRegistrationForm(
  form: RegistrationForm
): Result<RegistrationForm, FieldError[]> {
  const results = combineWithAllErrors([
    validateUsername(form.username),
    validateEmail(form.email),
    validatePassword(form.password),
    validatePasswordMatch(form.password, form.confirmPassword),
    validateAge(form.age),
  ]);

  if (!results.ok) {
    return results; // Returns array of all field errors
  }

  return ok(form);
}

// Usage in form handler
function handleSubmit(form: RegistrationForm) {
  const result = validateRegistrationForm(form);

  if (!result.ok) {
    // Display ALL errors at once
    result.error.forEach((fieldError) => {
      setFieldError(fieldError.field, fieldError.message);
    });
    return;
  }

  // All validations passed
  submitToServer(result.value);
}
```

**Why good:** All errors collected for single form display, named constants for limits, each field error has context

---

## Pattern 3: Object Combination

Combine Results into an object structure while preserving types.

### Implementation

```typescript
// src/lib/result.ts (additional functions)

type ResultObject<T extends Record<string, Result<unknown, unknown>>> = {
  [K in keyof T]: T[K] extends Result<infer V, unknown> ? V : never;
};

type ErrorUnion<T extends Record<string, Result<unknown, unknown>>> =
  T[keyof T] extends Result<unknown, infer E> ? E : never;

/**
 * Combine an object of Results into a Result of an object.
 * Preserves key-value structure.
 */
export const combineObject = <T extends Record<string, Result<unknown, unknown>>>(
  results: T
): Result<ResultObject<T>, ErrorUnion<T>> => {
  const output: Record<string, unknown> = {};

  for (const [key, result] of Object.entries(results)) {
    if (!result.ok) {
      return result as Result<ResultObject<T>, ErrorUnion<T>>;
    }
    output[key] = result.value;
  }

  return ok(output as ResultObject<T>);
};
```

---

### Good Example - Config Loading

```typescript
// src/config/load-config.ts
import type { Result } from "../lib/result";
import { ok, err, combineObject } from "../lib/result";

interface ConfigError {
  code: "CONFIG_ERROR";
  key: string;
  message: string;
}

interface AppConfig {
  apiUrl: string;
  apiTimeout: number;
  maxRetries: number;
  debugMode: boolean;
}

const DEFAULT_API_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

function loadEnvString(key: string): Result<string, ConfigError> {
  const value = process.env[key];
  if (!value) {
    return err({
      code: "CONFIG_ERROR",
      key,
      message: `Missing required environment variable: ${key}`,
    });
  }
  return ok(value);
}

function loadEnvNumber(
  key: string,
  defaultValue?: number
): Result<number, ConfigError> {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) {
      return ok(defaultValue);
    }
    return err({
      code: "CONFIG_ERROR",
      key,
      message: `Missing required environment variable: ${key}`,
    });
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return err({
      code: "CONFIG_ERROR",
      key,
      message: `Invalid number for ${key}: ${value}`,
    });
  }

  return ok(parsed);
}

function loadEnvBoolean(key: string, defaultValue: boolean): Result<boolean, ConfigError> {
  const value = process.env[key];
  if (!value) {
    return ok(defaultValue);
  }
  return ok(value === "true" || value === "1");
}

// Load all config at once with combineObject
export function loadConfig(): Result<AppConfig, ConfigError> {
  const result = combineObject({
    apiUrl: loadEnvString("API_URL"),
    apiTimeout: loadEnvNumber("API_TIMEOUT", DEFAULT_API_TIMEOUT),
    maxRetries: loadEnvNumber("MAX_RETRIES", DEFAULT_MAX_RETRIES),
    debugMode: loadEnvBoolean("DEBUG_MODE", false),
  });

  if (!result.ok) {
    return result;
  }

  return ok(result.value as AppConfig);
}

// Usage at startup
function initializeApp() {
  const configResult = loadConfig();

  if (!configResult.ok) {
    console.error(`Config error: ${configResult.error.message}`);
    process.exit(1); // Fail fast on config errors
  }

  const config = configResult.value;
  console.log(`Starting app with API URL: ${config.apiUrl}`);
}
```

**Why good:** Object structure preserved, named constants for defaults, first missing config fails startup

---

## Pattern 4: Sequence with Accumulator

Process a list sequentially, accumulating results and short-circuiting on error.

### Implementation

```typescript
// src/lib/result.ts (additional functions)

/**
 * Process items sequentially, accumulating results.
 * Short-circuits on first error.
 */
export const traverse = <T, U, E>(
  items: T[],
  fn: (item: T, index: number) => Result<U, E>
): Result<U[], E> => {
  const results: U[] = [];

  for (let i = 0; i < items.length; i++) {
    const result = fn(items[i], i);
    if (!result.ok) {
      return result;
    }
    results.push(result.value);
  }

  return ok(results);
};

/**
 * Reduce with Result - accumulate while checking for errors.
 */
export const foldResult = <T, A, E>(
  items: T[],
  initial: A,
  fn: (acc: A, item: T, index: number) => Result<A, E>
): Result<A, E> => {
  let accumulator = initial;

  for (let i = 0; i < items.length; i++) {
    const result = fn(accumulator, items[i], i);
    if (!result.ok) {
      return result;
    }
    accumulator = result.value;
  }

  return ok(accumulator);
};
```

---

### Good Example - Batch Processing with Limits

```typescript
// src/services/batch-processor.ts
import type { Result } from "../lib/result";
import { ok, err, traverse, foldResult } from "../lib/result";

interface ProcessError {
  code: "PROCESS_ERROR";
  itemIndex: number;
  message: string;
}

interface BatchItem {
  id: string;
  data: string;
}

interface ProcessedItem {
  id: string;
  result: string;
}

const MAX_BATCH_SIZE = 100;
const MAX_ITEM_SIZE = 1000;

function processItem(
  item: BatchItem,
  index: number
): Result<ProcessedItem, ProcessError> {
  if (item.data.length > MAX_ITEM_SIZE) {
    return err({
      code: "PROCESS_ERROR",
      itemIndex: index,
      message: `Item ${item.id} exceeds max size of ${MAX_ITEM_SIZE}`,
    });
  }

  // Process the item
  return ok({
    id: item.id,
    result: item.data.toUpperCase(),
  });
}

// Process batch with size limit
export function processBatch(
  items: BatchItem[]
): Result<ProcessedItem[], ProcessError> {
  if (items.length > MAX_BATCH_SIZE) {
    return err({
      code: "PROCESS_ERROR",
      itemIndex: -1,
      message: `Batch size ${items.length} exceeds maximum ${MAX_BATCH_SIZE}`,
    });
  }

  return traverse(items, processItem);
}

// Accumulate stats while processing
interface BatchStats {
  totalProcessed: number;
  totalBytes: number;
}

export function processBatchWithStats(
  items: BatchItem[]
): Result<BatchStats, ProcessError> {
  const initial: BatchStats = { totalProcessed: 0, totalBytes: 0 };

  return foldResult(items, initial, (stats, item, index) => {
    const processed = processItem(item, index);
    if (!processed.ok) {
      return processed;
    }

    return ok({
      totalProcessed: stats.totalProcessed + 1,
      totalBytes: stats.totalBytes + item.data.length,
    });
  });
}
```

**Why good:** Sequential processing with early exit, index available for error context, accumulator pattern for stats

---

## Pattern 5: Dependent Combinations

When later Results depend on earlier Results.

### Good Example - User Setup Flow

```typescript
// src/services/user-setup.ts
import type { Result } from "../lib/result";
import { ok, err, flatMap } from "../lib/result";

interface SetupError {
  code: "SETUP_ERROR";
  step: string;
  message: string;
}

interface User {
  id: string;
  email: string;
}

interface Workspace {
  id: string;
  ownerId: string;
  name: string;
}

interface Membership {
  userId: string;
  workspaceId: string;
  role: "owner" | "member";
}

interface SetupResult {
  user: User;
  workspace: Workspace;
  membership: Membership;
}

// Each step depends on the previous
function createUser(email: string): Result<User, SetupError> {
  // Create user
  return ok({ id: "user-123", email });
}

function createWorkspace(user: User): Result<Workspace, SetupError> {
  // Create workspace - needs user.id
  return ok({
    id: "ws-456",
    ownerId: user.id,
    name: `${user.email}'s Workspace`,
  });
}

function createMembership(
  user: User,
  workspace: Workspace
): Result<Membership, SetupError> {
  // Create membership - needs both user and workspace
  return ok({
    userId: user.id,
    workspaceId: workspace.id,
    role: "owner",
  });
}

// Combine dependent operations
export function setupUser(email: string): Result<SetupResult, SetupError> {
  return flatMap(createUser(email), (user) =>
    flatMap(createWorkspace(user), (workspace) =>
      flatMap(createMembership(user, workspace), (membership) =>
        ok({ user, workspace, membership })
      )
    )
  );
}

// Alternative with intermediate variables (clearer for complex flows)
export function setupUserExplicit(email: string): Result<SetupResult, SetupError> {
  const userResult = createUser(email);
  if (!userResult.ok) return userResult;

  const workspaceResult = createWorkspace(userResult.value);
  if (!workspaceResult.ok) return workspaceResult;

  const membershipResult = createMembership(
    userResult.value,
    workspaceResult.value
  );
  if (!membershipResult.ok) return membershipResult;

  return ok({
    user: userResult.value,
    workspace: workspaceResult.value,
    membership: membershipResult.value,
  });
}
```

**Why good:** Each step has access to previous results, early exit on any failure, final result combines all

---

## Anti-Pattern Examples

### Bad Example - Nested combine Calls

```typescript
// BAD: Overly nested, hard to read
const result = combine([
  combine([result1, result2]),
  combine([result3, result4]),
]);
```

**Why bad:** Confusing structure, hard to understand error handling

---

### Bad Example - Ignoring Error Array

```typescript
// BAD: Only checking first error
const result = combineWithAllErrors(validations);
if (!result.ok) {
  showError(result.error[0].message); // Ignoring other errors!
}
```

**Why bad:** Defeats purpose of collecting all errors, user only sees first problem

---

### Good Example - Display All Errors

```typescript
// GOOD: Use all collected errors
const result = combineWithAllErrors(validations);
if (!result.ok) {
  result.error.forEach((fieldError) => {
    setFieldError(fieldError.field, fieldError.message);
  });
  showErrorSummary(`Please fix ${result.error.length} errors`);
}
```

**Why good:** All errors displayed, user can fix everything at once

---

> **See also:**
> - [core.md](core.md) - Core Result patterns
> - [async.md](async.md) - Async Result patterns
