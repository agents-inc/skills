# Result Types Reference

> Decision frameworks, anti-patterns, and red flags for Result type implementation. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Result vs Exceptions

```
Is this an expected, recoverable error?
├─ YES → Use Result type
│   ├─ User input validation → Result
│   ├─ API call that might fail → Result
│   ├─ Parsing untrusted data → Result
│   ├─ Business rule violations → Result
│   └─ File not found (expected) → Result
└─ NO → Is it a programming bug?
    ├─ YES → Use exceptions (let it crash)
    │   ├─ Index out of bounds
    │   ├─ Null pointer (missing check)
    │   ├─ Invalid state (logic error)
    │   └─ Type assertion failure
    └─ NO → Is it unrecoverable?
        ├─ YES → Use exceptions
        │   ├─ Missing required config at startup
        │   ├─ Database connection failed
        │   └─ Out of memory
        └─ NO → Evaluate case by case
```

### When to Use Result vs Nullable

```
Does failure carry information beyond "not found"?
├─ NO → Use T | null or T | undefined
│   ├─ Array.find() → T | undefined
│   ├─ Map.get() → T | undefined
│   └─ Optional config value → T | undefined
└─ YES → Use Result<T, E>
    ├─ Why did it fail? → Result
    ├─ What can caller do? → Result
    └─ Multiple failure modes? → Result
```

### Choosing Error Handling Strategy

```
What kind of operation is this?
├─ Single operation that might fail
│   └─ Return Result<T, E>
├─ Chain of dependent operations
│   └─ Use flatMap/andThen
├─ Multiple independent operations
│   ├─ All must succeed → combine()
│   └─ Show all errors → combineWithAllErrors()
├─ Async operation
│   └─ Return Promise<Result<T, E>>
└─ External library that throws
    └─ Wrap with tryCatch at boundary
```

### Choosing a Result Library

```
What are your requirements?
├─ Zero dependencies, full control → Custom implementation
├─ Simple needs, small bundle → neverthrow (~2KB)
│   ├─ Has ResultAsync for async
│   ├─ Has combine methods
│   └─ Active community
├─ Full FP ecosystem → fp-ts (~30KB)
│   ├─ Comprehensive utilities
│   ├─ Steeper learning curve
│   └─ Pipe-based composition
├─ Maximum capability → Effect (~50KB)
│   ├─ Full effect system
│   ├─ Very steep learning curve
│   └─ Best for complex systems
└─ Learning the pattern → Custom implementation
    └─ Understand internals before using library
```

### Typed Error Design

```
How should errors be structured?
├─ Has multiple failure modes → Discriminated union
│   ├─ Use "code" or "type" as discriminant
│   ├─ Each variant carries relevant data
│   └─ Enable exhaustive switch handling
├─ Single failure mode → Simple interface
│   └─ Still use code property for consistency
├─ Needs context for logging → Include cause/context fields
│   ├─ Original error
│   ├─ Operation context
│   └─ Timestamp if relevant
└─ Needs human-readable message → Include message field
    └─ Separate from code for i18n flexibility
```

---

## RED FLAGS

### High Priority Issues

- **Ignoring Result return values** - Defeats entire purpose of Result types
- **Mixing throw and Result in same function** - Signature lies about error contract
- **Using generic Error or string as error type** - Loses type safety benefits
- **Unwrapping Result without checking ok** - Runtime crash waiting to happen
- **Not wrapping throwable operations (JSON.parse)** - Hidden exceptions in Result code

### Medium Priority Issues

- **Deep nesting instead of flatMap** - Hard to read, doesn't compose
- **Using combineWithAllErrors but only showing first error** - Wasted effort
- **Creating new error objects in hot paths** - Performance overhead
- **Error type too generic for domain** - Caller can't handle specifically
- **Converting Result back to exception at boundary** - Information loss

### Common Mistakes

- Assuming Result catches async errors automatically (it doesn't)
- Using Result for truly exceptional situations (use exceptions)
- Forgetting to update error union when adding new failure modes
- Using `any` or `unknown` as error type (defeats type safety)
- Not providing reset/recovery path when displaying errors

### Gotchas & Edge Cases

- `flatMap` unions error types - can grow large with long chains
- Pre-created error constants help performance but lose dynamic context
- TypeScript's type narrowing requires checking `result.ok` (not just truthy check)
- Error objects are usually not `instanceof Error` - custom comparison needed
- Result of `void` operation: use `Result<void, E>` not `Result<undefined, E>`
- Async Results: always await before checking `ok` property

---

## Anti-Patterns

### Ignoring Result Values

The most common mistake - calling a Result-returning function but discarding the return value.

```typescript
// WRONG - Result is silently discarded
function processUser(id: string): void {
  fetchUser(id); // Returns Result but ignored!
  console.log("Done"); // Continues regardless of failure
}

// CORRECT - Handle the Result
function processUser(id: string): Result<void, UserError> {
  const result = fetchUser(id);
  if (!result.ok) {
    return result;
  }
  console.log("User fetched:", result.value);
  return ok(undefined);
}
```

### Mixing throw and Result

Function signature says Result but implementation can throw exceptions, breaking the contract.

```typescript
// WRONG - Signature lies about error contract
function parseUser(json: string): Result<User, ParseError> {
  const data = JSON.parse(json); // Can throw SyntaxError!
  if (!data.name) {
    return err({ code: "PARSE_ERROR", message: "Missing name" });
  }
  return ok(data);
}

// CORRECT - Wrap ALL throwable operations
function parseUser(json: string): Result<User, ParseError> {
  const parseResult = tryCatch(
    () => JSON.parse(json),
    (): ParseError => ({ code: "PARSE_ERROR", message: "Invalid JSON" })
  );

  if (!parseResult.ok) {
    return parseResult;
  }

  if (!parseResult.value.name) {
    return err({ code: "PARSE_ERROR", message: "Missing name" });
  }

  return ok(parseResult.value as User);
}
```

### Generic Error Types

Using `Error`, `string`, or `unknown` as error type loses all the benefits of typed errors.

```typescript
// WRONG - Error type is useless
function fetchUser(id: string): Result<User, Error> {
  // Caller can't distinguish error types
}

// WRONG - Even worse, just a string
function fetchUser(id: string): Result<User, string> {
  // No structure, no handling
}

// CORRECT - Typed error with discriminant
type FetchUserError =
  | { code: "NOT_FOUND"; userId: string }
  | { code: "UNAUTHORIZED" }
  | { code: "NETWORK_ERROR"; message: string };

function fetchUser(id: string): Result<User, FetchUserError> {
  // Caller can handle each case specifically
}
```

### Unsafe Unwrapping

Accessing `result.value` without checking `result.ok` first leads to runtime errors.

```typescript
// WRONG - Assumes success
function getName(result: Result<User, Error>): string {
  return result.value!.name; // Crashes if error!
}

// CORRECT - Check first
function getName(result: Result<User, Error>): string {
  if (result.ok) {
    return result.value.name;
  }
  return "Unknown";
}

// CORRECT - Use unwrapOr
function getName(result: Result<User, Error>): string {
  return unwrapOr(map(result, (u) => u.name), "Unknown");
}
```

### Nested Results

Result inside Result is confusing and hard to work with.

```typescript
// WRONG - Nested Result
function fetchAndValidate(
  id: string
): Result<Result<User, ValidationError>, FetchError> {
  // Caller has to unwrap twice
}

// CORRECT - Flatten with flatMap
function fetchAndValidate(
  id: string
): Result<User, FetchError | ValidationError> {
  return flatMap(fetchUser(id), validateUser);
}
```

### Converting Result Back to Exception

At boundaries, sometimes you need exceptions - but don't lose the typed error information.

```typescript
// WRONG - Loses typed error information
function getUser(id: string): Promise<User> {
  const result = await fetchUser(id);
  if (!result.ok) {
    throw new Error(result.error.message); // Type info lost!
  }
  return result.value;
}

// CORRECT - Keep Result as long as possible
async function getUser(id: string): Promise<Result<User, UserError>> {
  return fetchUser(id);
}

// At framework boundary only, convert with full context
app.get("/users/:id", async (req, res) => {
  const result = await getUser(req.params.id);

  if (!result.ok) {
    // Convert Result to HTTP response (not exception)
    switch (result.error.code) {
      case "NOT_FOUND":
        return res.status(404).json({ error: result.error });
      case "UNAUTHORIZED":
        return res.status(401).json({ error: result.error });
      default:
        return res.status(500).json({ error: result.error });
    }
  }

  res.json(result.value);
});
```

### Using Result for Optional Values

When there's no meaningful error information, use nullable types instead.

```typescript
// WRONG - Result adds nothing here
function findUser(id: string): Result<User, NotFoundError> {
  const user = users.find((u) => u.id === id);
  return user ? ok(user) : err({ code: "NOT_FOUND" });
}

// CORRECT - Use nullable when just "not found"
function findUser(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}

// Use Result when there's meaningful error info
function fetchUser(id: string): Result<User, FetchError> {
  // Network errors carry useful information
}
```

---

## Quick Reference

### Result Type Checklist

- [ ] Uses discriminated union with `ok` boolean
- [ ] Error type has discriminant property (`code` or `type`)
- [ ] All throwable operations wrapped in `tryCatch`
- [ ] Never ignores Result return values
- [ ] Uses `flatMap`/`andThen` for chaining (not nested ifs)
- [ ] Error types are specific, not generic `Error` or `string`
- [ ] Always checks `result.ok` before accessing `value` or `error`

### Library Quick Reference

| Library | Import | Success | Failure | Chain |
|---------|--------|---------|---------|-------|
| Custom | N/A | `ok(value)` | `err(error)` | `flatMap(result, fn)` |
| neverthrow | `import { ok, err, Result } from "neverthrow"` | `ok(value)` | `err(error)` | `result.andThen(fn)` |
| fp-ts | `import * as E from "fp-ts/Either"` | `E.right(value)` | `E.left(error)` | `E.chain(fn)` |
| ts-results | `import { Ok, Err, Result } from "ts-results"` | `Ok(value)` | `Err(error)` | `result.andThen(fn)` |

### Common Operations Reference

| Operation | Purpose | Example |
|-----------|---------|---------|
| `ok(value)` | Create success | `ok(42)` |
| `err(error)` | Create failure | `err({ code: "NOT_FOUND" })` |
| `map(result, fn)` | Transform success value | `map(result, x => x * 2)` |
| `mapError(result, fn)` | Transform error value | `mapError(result, e => ({...e, context: "foo"}))` |
| `flatMap(result, fn)` | Chain operations | `flatMap(result, x => divide(x, 2))` |
| `unwrapOr(result, default)` | Extract with default | `unwrapOr(result, 0)` |
| `match(result, {ok, err})` | Pattern match | `match(result, {ok: v => v, err: e => null})` |
| `tryCatch(fn, onError)` | Wrap throwable | `tryCatch(() => JSON.parse(s), e => err)` |
| `combine(results)` | Fail-fast combine | `combine([r1, r2, r3])` |
| `combineWithAllErrors(results)` | Collect all errors | `combineWithAllErrors([r1, r2])` |

### Performance Comparison

| Approach | 1M Iterations | Relative |
|----------|---------------|----------|
| Result object return | ~3 ms | 1x (baseline) |
| Exception creation | ~1,100 ms | ~350x slower |
| Exception throw/catch | ~1,200 ms | ~400x slower |

**Why exceptions are slow:**
- Stack trace generation (expensive string operations)
- Message formatting
- Stack unwinding to find catch block

**Result optimization tips:**
- Pre-create static error objects for common errors
- Avoid creating closures in hot paths
- Use object pooling for high-frequency errors

### Error Type Template

```typescript
// Template for domain errors
interface [Domain]Error {
  readonly code: "[ERROR_CODE]";
  readonly message: string;
  // Add domain-specific fields
}

// Example
interface UserError {
  readonly code: "USER_NOT_FOUND" | "USER_EXISTS" | "INVALID_CREDENTIALS";
  readonly message: string;
  readonly userId?: string;
}
```

### What Results Catch vs Don't Catch

| Scenario | Caught by Result? | Solution |
|----------|-------------------|----------|
| Return from sync function | Yes | Return `err()` |
| Return from async function | Yes | Return `err()` |
| `JSON.parse` throwing | No | Wrap in `tryCatch` |
| Network `fetch` failure | No | Wrap in `tryCatchAsync` |
| Promise rejection | No | Wrap with `fromPromise` |
| setTimeout callback error | No | Wrap in `tryCatch` |
| Event handler error | No | Use try/catch |

### TypeScript Configuration

```json
// tsconfig.json - Recommended settings
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

These settings help catch Result-related issues at compile time.
