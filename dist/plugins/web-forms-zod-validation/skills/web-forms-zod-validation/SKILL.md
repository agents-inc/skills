---
name: web-forms-zod-validation
description: Zod schema validation patterns for TypeScript - schema definitions, type inference, refinements, transforms, discriminated unions
---

# Zod Schema Validation Patterns

> **Quick Guide:** Use Zod for runtime validation at trust boundaries (API responses, form inputs, config, URL params). Define schemas once, derive types with `z.infer`. Use `safeParse` for error handling, `refine`/`superRefine` for custom validation, `transform` for data conversion. Named constants for all validation limits.
>
> **Version Note:** Zod v4 is now the stable release (v4.1+). It brings 14.7x faster string parsing, 57% smaller bundle, and new top-level APIs (`z.email()`, `z.url()`, `z.iso.*`). The v3 method-chain equivalents (`z.string().email()`) still work but are deprecated. For migration details, see [reference.md](reference.md).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `safeParse` instead of `parse` for user-facing validation - prevents unhandled exceptions)**

**(You MUST use `z.infer<typeof schema>` to derive types - never duplicate schema as separate interface)**

**(You MUST validate at trust boundaries - API responses, form inputs, config files, URL params)**

**(You MUST use named constants for validation limits - NO magic numbers in `.min()`, `.max()`, `.length()`)**

</critical_requirements>

---

**Auto-detection:** Zod schemas, z.object, z.string, z.number, z.infer, safeParse, refine, superRefine, transform, discriminatedUnion, z.coerce, z.pipe, z.catch, z.brand, z.lazy, z.email, z.url, z.iso

**When to use:**

- Validating API responses before using data
- Parsing form input data with type safety
- Validating configuration files or environment variables
- Defining contracts between systems (frontend/backend shared schemas)
- Runtime type checking for data from untrusted sources

**When NOT to use:**

- Internal function parameters (TypeScript is sufficient for trusted data)
- Simple boolean checks that don't need schema definition
- Performance-critical hot paths where validation overhead matters

---

<philosophy>

## Philosophy

TypeScript provides compile-time type safety for code you control. Zod provides **runtime validation** for data you don't control - API responses, user input, configuration files, URL parameters. Use TypeScript for internal contracts; use Zod at **trust boundaries** where external data enters your system.

**Key principle:** Define the schema once, derive the type. Never maintain parallel type definitions and validation logic - they will drift apart.

```typescript
// Schema is the source of truth
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// Type is derived, always in sync
type User = z.infer<typeof UserSchema>;
```

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Schema Definition with Named Constants

Define schemas with named constants for all validation limits. Custom error messages for user-facing fields.

```typescript
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 50;

const UserSchema = z.object({
  username: z
    .string()
    .min(
      MIN_USERNAME_LENGTH,
      `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
    )
    .max(
      MAX_USERNAME_LENGTH,
      `Username cannot exceed ${MAX_USERNAME_LENGTH} characters`,
    ),
  email: z.string().email("Invalid email format"),
});

type User = z.infer<typeof UserSchema>; // Always derived, never manual interface
```

**Why good:** named constants make limits discoverable, custom error messages improve UX, type derived from schema

See [examples/core.md](examples/core.md) for complete schema examples with reusable sub-schemas and CRUD composition patterns.

---

### Pattern 2: Safe Parsing for Error Handling

Use `safeParse` for user input and API responses. Reserve `parse` for config/internal data where invalid = programming error.

```typescript
const result = UserSchema.safeParse(data);

if (!result.success) {
  const errors = result.error.issues.reduce(
    (acc, err) => {
      const field = err.path.join(".");
      acc[field] = err.message;
      return acc;
    },
    {} as Record<string, string>,
  );
  return { success: false, errors };
}

return { success: true, user: result.data };
```

**Why good:** safeParse never throws, validation errors handled explicitly, error formatting provides useful field-level feedback

See [examples/core.md](examples/core.md) for form validation and API response validation patterns.

---

### Pattern 3: Refinements and Cross-Field Validation

Use `refine` for custom validation logic. Use `superRefine` when you need cross-field validation with specific error paths.

```typescript
const MIN_PASSWORD_LENGTH = 8;

const PasswordFormSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });
```

**Why good:** superRefine enables cross-field validation with specific error paths, keeps all validation in the schema

See [examples/core.md](examples/core.md) for password refinement chains and conditional validation patterns.

---

### Pattern 4: Transforms and Type Conversion

Use `transform` to convert data during validation. Use `z.input` and `z.output` when transforms change the type.

```typescript
const DateSchema = z
  .string()
  .datetime()
  .transform((str) => new Date(str));

type DateInput = z.input<typeof DateSchema>; // string
type DateOutput = z.output<typeof DateSchema>; // Date
```

**Gotcha:** `z.infer` returns the output type. When a function accepts pre-validation input, use `z.input` for the parameter type.

See [examples/transforms.md](examples/transforms.md) for coercion patterns (URL params, form data) and transform pipelines.

---

### Pattern 5: Discriminated Unions

Use `discriminatedUnion` when objects share a common discriminator field. Provides better error messages and TypeScript narrowing than `union`.

```typescript
const NotificationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("email"),
    email: z.string().email(),
    subject: z.string(),
  }),
  z.object({ type: z.literal("sms"), phone: z.string(), message: z.string() }),
  z.object({
    type: z.literal("push"),
    deviceId: z.string(),
    title: z.string(),
  }),
]);
```

**Why good over `z.union`:** discriminatedUnion reports which variant failed (not "Invalid input"), TypeScript narrows type in switch statements

See [examples/core.md](examples/core.md) for payment method union and type narrowing examples.

---

### Pattern 6: Schema Composition

Compose schemas using `extend`, `pick`, `omit`, and `partial` for CRUD operations.

```typescript
const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const UserSchema = BaseEntitySchema.extend({
  email: z.string().email(),
  name: z.string(),
});
const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
const UpdateUserSchema = CreateUserSchema.partial();
const UserSummarySchema = UserSchema.pick({ id: true, name: true });
```

See [examples/core.md](examples/core.md) for full CRUD schema composition example.

---

### Pattern 7: Coercion for String Inputs

Use `z.coerce` for URL params and form data that arrive as strings. Simpler than manual parsing.

```typescript
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT),
});

// "3" -> 3, "50" -> 50, missing -> defaults
```

**Gotcha:** `z.coerce.boolean()` coerces any truthy value to true, including the string `"false"`. Use explicit comparison for string booleans.

See [examples/transforms.md](examples/transforms.md) for complete pagination and query param patterns.

---

### Pattern 8: Optional, Nullable, and Nullish

```typescript
const ProfileSchema = z.object({
  name: z.string(), // Required
  bio: z.string().optional(), // string | undefined
  avatar: z.string().url().nullable(), // string | null
  nickname: z.string().nullish(), // string | null | undefined
  theme: z.string().default("light"), // string (always defined)
});
```

**Key distinction:** `nullable` = explicitly set to null (API returns null), `optional` = may be omitted entirely, `nullish` = either.

</patterns>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Schema definition, safe parsing, error formatting, discriminated unions, composition, nested schemas
- [examples/transforms.md](examples/transforms.md) - Transforms, coercion, pipe chains
- [examples/advanced-patterns.md](examples/advanced-patterns.md) - Branded types, catch fallbacks, readonly, recursive schemas, ISO validators
- [reference.md](reference.md) - Decision frameworks, method reference, anti-patterns, v4 migration guide

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Using `parse` for user-facing validation** - Throws exceptions for expected invalid input, requiring try-catch and losing detailed error info
- **Magic numbers in validation limits** - `.min(3).max(50)` is undocumented; use named constants like `MIN_USERNAME_LENGTH`
- **Defining separate TypeScript interfaces** - Creates drift between schema and type; always use `z.infer<typeof schema>`
- **Not validating at trust boundaries** - API responses, user input, and config should always be validated at entry points
- **Async refinements with `parse` instead of `parseAsync`** - Async refinements silently fail with sync parse methods

**Medium Priority Issues:**

- **Overly strict validation on optional fields** - Empty strings should often be treated as undefined for optional fields
- **Missing custom error messages** - Default "Invalid input" messages are not user-friendly
- **Validating internal function parameters with Zod** - TypeScript is sufficient for trusted internal code
- **Using `.passthrough()` by default** - Allows unexpected fields through; use `.strict()` when you want to reject extras

**Gotchas & Edge Cases:**

- **`z.coerce.boolean()`**: Coerces any truthy value to true, including string `"false"` - use explicit string comparison if needed
- **Transform order**: `.transform()` runs after all other validations; refinements on transformed values need `.pipe()` to validate after
- **Empty strings**: `z.string().email()` rejects empty strings; use `.email().or(z.literal(""))` to allow empty
- **Extend with refinements**: `.extend()` on a schema with `.refine()` throws; apply refinements after extending instead
- **Date parsing**: `z.coerce.date()` uses `new Date()` which accepts many formats; use `.datetime()` for strict ISO format
- **`z.union` vs `z.discriminatedUnion`**: Union tries all schemas and reports combined errors; discriminatedUnion uses discriminator for targeted validation and better errors
- **v4: `.refine()` function second arg removed**: `z.string().refine(fn, (val) => ({ message: ... }))` no longer works; use `superRefine()` for dynamic messages
- **v4: `ctx.path` removed in `.superRefine()`**: No longer available for performance reasons; `ctx.addIssue()` still works
- **v4 deprecations**: `.flatten()` deprecated - use `z.flattenError()` instead; `.format()` deprecated - use `z.treeifyError()` instead; `.merge()` deprecated - use `.extend()` instead

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `safeParse` instead of `parse` for user-facing validation - prevents unhandled exceptions)**

**(You MUST use `z.infer<typeof schema>` to derive types - never duplicate schema as separate interface)**

**(You MUST validate at trust boundaries - API responses, form inputs, config files, URL params)**

**(You MUST use named constants for validation limits - NO magic numbers in `.min()`, `.max()`, `.length()`)**

**Failure to follow these rules will create type mismatches, unhandled exceptions, and unmaintainable validation code.**

</critical_reminders>
