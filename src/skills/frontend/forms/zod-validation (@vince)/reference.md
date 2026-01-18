# Zod Validation Reference

> Decision frameworks, anti-patterns, and red flags for Zod schema validation. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Zod vs TypeScript Alone

```
Is the data from an external source?
├─ YES → Is it an API response?
│   ├─ YES → Use Zod (API can change, backend bugs happen)
│   └─ NO → Is it user input?
│       ├─ YES → Use Zod (users provide invalid data)
│       └─ NO → Is it config/environment?
│           ├─ YES → Use Zod (catch config errors early)
│           └─ NO → Is it from URL params?
│               ├─ YES → Use Zod with z.coerce
│               └─ NO → TypeScript may be sufficient
└─ NO → Is it internal function parameters?
    ├─ YES → TypeScript is sufficient (trusted code)
    └─ NO → Consider the trust level of the data source
```

### Choosing Between parse and safeParse

```
Who provides the data?
├─ User input (forms, search) → safeParse (expected invalid)
├─ API response → safeParse (APIs can fail)
├─ Configuration → parse (invalid = programming error)
├─ Internal code → parse (TypeScript handles it)
└─ URL parameters → safeParse (can be manipulated)

Will invalid data crash the application?
├─ YES → safeParse (handle gracefully)
└─ NO → parse is acceptable
```

### When to Use Refinements vs Built-in Validators

```
Is the validation a standard format?
├─ YES → Use built-in: .email(), .url(), .uuid(), .datetime()
└─ NO → Is it a simple regex pattern?
    ├─ YES → Use .regex() with descriptive message
    └─ NO → Does it require cross-field validation?
        ├─ YES → Use .superRefine() with ctx.addIssue()
        └─ NO → Use .refine() with custom function
```

### When to Use Transforms vs Coercion

```
Is input always a string that needs type conversion?
├─ YES → Is it from URL params or form data?
│   ├─ YES → Use z.coerce (handles conversion automatically)
│   └─ NO → Is the string format predictable?
│       ├─ YES → Use z.coerce
│       └─ NO → Use .transform() for custom parsing
└─ NO → Does the data need format conversion?
    ├─ YES → Use .transform() (e.g., ISO string → Date)
    └─ NO → No transformation needed
```

### Choosing Union Type

```
Do objects share a common discriminator field?
├─ YES → Use z.discriminatedUnion() (better errors, narrowing)
└─ NO → Are objects structurally distinct?
    ├─ YES → Use z.union() (tries all schemas)
    └─ NO → Consider restructuring with discriminator
```

---

## RED FLAGS

### High Priority Issues

- **Using `parse` for user-facing validation** - Throws exceptions for expected invalid input, requiring try-catch and losing detailed error info
- **Magic numbers in validation limits** - `.min(3).max(50)` is undocumented; use named constants like `MIN_USERNAME_LENGTH`
- **Defining separate TypeScript interfaces** - Creates drift between schema and type; always use `z.infer<typeof schema>`
- **Not validating at trust boundaries** - API responses, user input, and config should always be validated at entry points
- **Async refinements with `parse` instead of `parseAsync`** - Async refinements silently fail with sync parse methods

### Medium Priority Issues

- **Overly strict validation on optional fields** - Empty strings should often be treated as undefined for optional fields
- **Missing custom error messages** - Default "Invalid input" messages are not user-friendly
- **Not using `flatten()` or custom formatter** - Raw ZodError structure is complex for UI display
- **Validating internal function parameters with Zod** - TypeScript is sufficient for trusted internal code
- **Using `.passthrough()` by default** - Allows unexpected fields through; use `.strict()` when you want to reject extras

### Common Mistakes

- Using `z.union` when `z.discriminatedUnion` is appropriate (worse error messages, no type narrowing)
- Forgetting to use `z.input` and `z.output` when transforms change the type
- Not chaining `.nullable()` or `.optional()` in the correct order
- Missing `.default()` on fields that should have fallback values
- Using `z.any()` or `z.unknown()` when a more specific schema is possible

### Gotchas & Edge Cases

- **`.optional()` vs `.nullable()` vs `.nullish()`**: optional allows undefined, nullable allows null, nullish allows both
- **Transform order matters**: `.transform()` runs after all other validations; refinements on transformed values need to come after
- **`z.coerce.boolean()`**: Coerces any truthy value to true, including string `"false"` - use explicit string comparison if needed
- **Empty strings**: `z.string().email()` rejects empty strings; use `.email().or(z.literal(""))` to allow empty
- **Array of at least one**: Use `z.array(schema).min(1)` not `z.array(schema).nonempty()` for better error messages
- **Date parsing**: `z.coerce.date()` uses `new Date()` which accepts many formats; use `.datetime()` for strict ISO format
- **Extend with refinements**: `.extend()` on a schema with `.refine()` throws; use `.superRefine()` on the extended schema instead
- **Zod v3 vs v4 syntax differences**: If migrating to v4, ISO validators moved to `z.iso.*` namespace and email/url are now top-level functions - see "Zod v4 Migration Notes" section below

---

## Anti-Patterns

### Parallel Type Definitions

Schema and type can drift apart, leading to false confidence in validation.

```typescript
// ❌ WRONG - Parallel definitions
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

interface User {
  name: string;
  email: string;
  role: string;  // Not in schema - won't be validated!
}

// ✅ CORRECT - Type derived from schema
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
});

type User = z.infer<typeof UserSchema>;
```

### Using parse for User Input

User input is expected to be invalid; exceptions are noisy and lose error details.

```typescript
// ❌ WRONG - Exceptions for expected invalid input
function validateForm(data: unknown) {
  try {
    return { success: true, data: FormSchema.parse(data) };
  } catch (e) {
    return { success: false, error: "Validation failed" };  // Lost all details
  }
}

// ✅ CORRECT - Explicit error handling
function validateForm(data: unknown) {
  const result = FormSchema.safeParse(data);
  if (!result.success) {
    return { success: false, errors: result.error.flatten().fieldErrors };
  }
  return { success: true, data: result.data };
}
```

### Magic Numbers in Validation

Undocumented limits are hard to maintain and update consistently.

```typescript
// ❌ WRONG - Magic numbers
const schema = z.object({
  password: z.string().min(8).max(128),
  age: z.number().min(13).max(120),
});

// ✅ CORRECT - Named constants
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_AGE = 13;
const MAX_AGE = 120;

const schema = z.object({
  password: z.string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(MAX_PASSWORD_LENGTH),
  age: z.number()
    .min(MIN_AGE, `You must be at least ${MIN_AGE} years old`)
    .max(MAX_AGE),
});
```

### Validation Logic Outside Schema

Split validation is hard to maintain and easy to forget.

```typescript
// ❌ WRONG - Validation split between schema and function
const schema = z.object({
  password: z.string().min(8),
});

function additionalValidation(pwd: string): string[] {
  const errors = [];
  if (!/[A-Z]/.test(pwd)) errors.push("Need uppercase");
  return errors;
}

// ✅ CORRECT - All validation in schema
const schema = z.object({
  password: z.string()
    .min(8)
    .refine((pwd) => /[A-Z]/.test(pwd), { message: "Need uppercase" }),
});
```

### Using z.union When discriminatedUnion Works

Regular union tries all schemas and combines errors; discriminatedUnion is cleaner.

```typescript
// ❌ WRONG - Union without discriminator
const ResponseSchema = z.union([
  z.object({ data: z.array(z.string()) }),
  z.object({ error: z.string() }),
]);
// Error message: "Invalid input" (unhelpful)

// ✅ CORRECT - Discriminated union
const ResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("success"), data: z.array(z.string()) }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);
// Error message: "Invalid discriminator value. Expected 'success' | 'error'"
```

### Not Using z.input/z.output with Transforms

When transforms change types, using only `z.infer` gives the output type, not input.

```typescript
// ❌ WRONG - Missing input type for transforms
const DateSchema = z.string().transform((s) => new Date(s));
type DateType = z.infer<typeof DateSchema>;  // Date (output only)

// Function signature is misleading
function processDate(date: DateType) {
  // Caller thinks they need to pass Date, but schema expects string!
}

// ✅ CORRECT - Explicit input and output types
const DateSchema = z.string().datetime().transform((s) => new Date(s));
type DateInput = z.input<typeof DateSchema>;   // string
type DateOutput = z.output<typeof DateSchema>; // Date

// Clear function signature
function processDateInput(dateStr: DateInput): DateOutput {
  return DateSchema.parse(dateStr);
}
```

---

## Quick Reference

### Schema Definition Checklist

- [ ] All validation limits use named constants (no magic numbers)
- [ ] All user-facing fields have custom error messages
- [ ] Types are derived with `z.infer<typeof schema>` (no parallel interfaces)
- [ ] Optional fields use `.optional()`, `.nullable()`, or `.nullish()` appropriately
- [ ] Default values provided where appropriate with `.default()`
- [ ] Schemas are composed from reusable sub-schemas where possible

### Validation Checklist

- [ ] User input uses `safeParse` (not `parse`)
- [ ] API responses are validated at fetch boundary
- [ ] Async refinements use `safeParseAsync`
- [ ] Error messages are formatted for UI display
- [ ] Validation errors include field paths

### Type Safety Checklist

- [ ] Types are derived from schemas with `z.infer`
- [ ] Schemas with transforms use `z.input` and `z.output` where needed
- [ ] Discriminated unions are used when objects share discriminator field
- [ ] Named exports are used (no default exports)

### Performance Considerations

- [ ] Complex async validations are debounced in UI
- [ ] Large schemas are split into reusable sub-schemas
- [ ] Schemas are defined once, not recreated on each validation
- [ ] Only validate at trust boundaries, not internal function calls

---

## Method Quick Reference

| Method | Purpose | Example |
|--------|---------|---------|
| `.parse()` | Validate and throw on error | `schema.parse(data)` |
| `.safeParse()` | Validate and return result object | `schema.safeParse(data)` |
| `.parseAsync()` | Async parse (throws) | `await schema.parseAsync(data)` |
| `.safeParseAsync()` | Async safe parse | `await schema.safeParseAsync(data)` |
| `.refine()` | Custom validation | `.refine((val) => val > 0, { message: "..." })` |
| `.superRefine()` | Cross-field validation | `.superRefine((data, ctx) => { ctx.addIssue(...) })` |
| `.transform()` | Convert data during validation | `.transform((val) => val.trim())` |
| `.pipe()` | Chain schemas together | `z.string().pipe(z.transform(v => v.length))` |
| `.catch()` | Provide fallback on error | `.catch("default")` or `.catch((ctx) => fallback)` |
| `.default()` | Provide default value | `.default("unknown")` |
| `.optional()` | Allow undefined | `.optional()` → `T \| undefined` |
| `.nullable()` | Allow null | `.nullable()` → `T \| null` |
| `.nullish()` | Allow null or undefined | `.nullish()` → `T \| null \| undefined` |
| `.readonly()` | Mark output as readonly | `.readonly()` → `Readonly<T>` |
| `.brand<T>()` | Add nominal type brand | `.brand<"UserId">()` |
| `.extend()` | Add fields to object | `schema.extend({ newField: z.string() })` |
| `.merge()` | Combine two objects | `schemaA.merge(schemaB)` |
| `.pick()` | Select specific fields | `schema.pick({ id: true, name: true })` |
| `.omit()` | Remove specific fields | `schema.omit({ password: true })` |
| `.partial()` | Make all fields optional | `schema.partial()` |
| `.passthrough()` | Allow extra fields | `schema.passthrough()` |
| `.strict()` | Reject extra fields | `schema.strict()` |
| `z.coerce` | Convert type before validation | `z.coerce.number()` |
| `z.lazy` | Recursive schema reference | `z.lazy(() => CategorySchema)` |
| `z.infer` | Extract output type | `type T = z.infer<typeof schema>` |
| `z.input` | Extract input type | `type T = z.input<typeof schema>` |
| `z.output` | Extract output type (alias) | `type T = z.output<typeof schema>` |

### ISO String Validators (Zod 3.23+)

| Method | Purpose | Example |
|--------|---------|---------|
| `.date()` | Validate ISO 8601 date string | `z.string().date()` → `"2024-01-15"` |
| `.time()` | Validate ISO 8601 time string | `z.string().time()` → `"12:30:00"` |
| `.datetime()` | Validate ISO 8601 datetime | `z.string().datetime()` → `"2024-01-15T12:30:00Z"` |
| `.duration()` | Validate ISO 8601 duration | `z.string().duration()` → `"P3Y6M4DT12H30M5S"` |

**Zod v4 Note:** In v4, these moved to `z.iso.date()`, `z.iso.time()`, `z.iso.datetime()`, `z.iso.duration()` as top-level functions.

---

## Advanced Patterns

### Pipe - Chaining Schemas

Use `.pipe()` to chain schemas together, particularly useful with transforms.

```typescript
import { z } from "zod";

// Parse string, then validate the resulting length
const stringToLength = z.string().pipe(z.transform((val) => val.length));
stringToLength.parse("hello"); // => 5

// Combine preprocess-like behavior with pipe
const trimmedNonEmpty = z.string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "Cannot be empty after trimming"));
```

### Catch - Fallback Values

Use `.catch()` to recover from validation errors with fallback values.

```typescript
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_THEME = "light";

// Simple fallback value
const numberWithCatch = z.number().catch(DEFAULT_PAGE);
numberWithCatch.parse(5);       // => 5
numberWithCatch.parse("invalid"); // => 1 (fallback)

// Fallback with access to error context
const themeSchema = z.enum(["light", "dark"]).catch((ctx) => {
  console.warn("Invalid theme, using default:", ctx.error);
  return DEFAULT_THEME;
});
```

### Brand - Nominal Types

Use `.brand<T>()` to create nominal types that prevent accidental mixing of structurally identical types.

```typescript
import { z } from "zod";

// Create branded types for IDs
const UserIdSchema = z.string().uuid().brand<"UserId">();
const PostIdSchema = z.string().uuid().brand<"PostId">();

type UserId = z.infer<typeof UserIdSchema>;  // string & { __brand: "UserId" }
type PostId = z.infer<typeof PostIdSchema>;  // string & { __brand: "PostId" }

// TypeScript prevents mixing these types
function getUser(id: UserId) { /* ... */ }

const userId = UserIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
const postId = PostIdSchema.parse("660e8400-e29b-41d4-a716-446655440000");

getUser(userId); // ✅ OK
// getUser(postId); // ❌ TypeScript error: PostId not assignable to UserId
```

### Readonly - Frozen Output

Use `.readonly()` to mark schema output as readonly (frozen with `Object.freeze()`).

```typescript
import { z } from "zod";

const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  timeout: z.number(),
}).readonly();

type Config = z.infer<typeof ConfigSchema>;
// Readonly<{ apiUrl: string; timeout: number }>

const config = ConfigSchema.parse({ apiUrl: "https://api.example.com", timeout: 5000 });
// config.timeout = 10000; // ❌ TypeScript error: Cannot assign to 'timeout'
```

### Lazy - Recursive Schemas

Use getter syntax or `z.lazy()` for recursive/self-referencing schemas.

```typescript
import { z } from "zod";

// Using getter syntax (preferred in Zod 3.22+)
const CategorySchema: z.ZodType<Category> = z.object({
  name: z.string(),
  get subcategories() {
    return z.array(CategorySchema).optional();
  },
});

type Category = z.infer<typeof CategorySchema>;

// Alternative: z.lazy() for older patterns
const TreeNodeSchema: z.ZodType<TreeNode> = z.object({
  value: z.string(),
  children: z.lazy(() => z.array(TreeNodeSchema)).optional(),
});

type TreeNode = z.infer<typeof TreeNodeSchema>;
```

---

## Error Handling Patterns

### Flatten Errors for Forms

```typescript
const result = schema.safeParse(data);
if (!result.success) {
  const { fieldErrors, formErrors } = result.error.flatten();
  // fieldErrors: { email: ["Invalid email"], password: ["Too short"] }
  // formErrors: ["Form-level errors from superRefine"]
}
```

### Format Errors for Display

```typescript
function formatErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce((acc, issue) => {
    const path = issue.path.join(".");
    if (!acc[path]) acc[path] = issue.message;
    return acc;
  }, {} as Record<string, string>);
}
```

### Custom Error Map

```typescript
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.expected === "string") {
      return { message: "This field is required" };
    }
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);
```

---

## Zod v4 Migration Notes

### Major Changes from v3 to v4

**Performance Improvements:**
- String parsing: 14.7x faster
- Array parsing: 7.4x faster
- Object parsing: 6.5x faster
- TypeScript instantiations: 100x reduction (25,000 → 175)
- Bundle size: 57% smaller (5.36kb gzipped vs 12.47kb)

**Breaking Changes:**

1. **Error Customization**: Unified error API - use single `error` parameter instead of fragmented `message`, `invalid_type_error`, `required_error`
2. **ISO Validators**: Moved to top-level `z.iso.*` namespace:
   - `z.string().date()` → `z.iso.date()`
   - `z.string().time()` → `z.iso.time()`
   - `z.string().datetime()` → `z.iso.datetime()`
   - `z.string().duration()` → `z.iso.duration()`
3. **Email/URL**: Moved to top-level functions:
   - `z.string().email()` → `z.email()`
   - `z.string().url()` → `z.url()`
4. **Refinements**: Now live within schemas (not wrapping), enabling method chaining like `.refine().min()`

**New Features in v4:**

- **Template Literals**: `z.templateLiteral()` for type-safe string patterns
- **File Validation**: `z.file()` with `.min()`, `.max()`, `.mime()` constraints
- **String Boolean**: `z.stringbool()` parses "true", "yes", "1" to boolean
- **Codecs**: `z.codec(inputSchema, outputSchema, { decode, encode })` for bidirectional transforms
- **Recursive Types**: Getter syntax without type casting
- **JSON Schema Export**: Native `z.toJSONSchema()` conversion
- **Email Regex Options**: `z.regexes.email`, `z.regexes.html5Email`, `z.regexes.rfc5322Email`, `z.regexes.unicodeEmail`

For complete migration guide, see [zod.dev/v4](https://zod.dev/v4).
