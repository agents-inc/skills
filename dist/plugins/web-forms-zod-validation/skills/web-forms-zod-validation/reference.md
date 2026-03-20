# Zod Validation Reference

> Decision frameworks, anti-patterns, method reference, and v4 migration guide. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

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
    ├─ YES → Use .transform() (e.g., ISO string to Date)
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

## Anti-Patterns

### Parallel Type Definitions

Schema and type can drift apart, leading to false confidence in validation.

```typescript
// WRONG - Parallel definitions
const UserSchema = z.object({ name: z.string(), email: z.string().email() });
interface User {
  name: string;
  email: string;
  role: string;
} // Not in schema!

// CORRECT - Type derived from schema
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
});
type User = z.infer<typeof UserSchema>;
```

### Using parse for User Input

```typescript
// WRONG - Exceptions for expected invalid input
try {
  return { success: true, data: FormSchema.parse(data) };
} catch (e) {
  return { success: false, error: "Validation failed" };
} // Lost details

// CORRECT - Explicit error handling
const result = FormSchema.safeParse(data);
if (!result.success)
  return { success: false, errors: z.flattenError(result.error).fieldErrors };
return { success: true, data: result.data };
```

### Validation Logic Outside Schema

```typescript
// WRONG - Split validation
const schema = z.object({ password: z.string().min(8) });
function additionalValidation(pwd: string): string[] {
  /* separate checks */
}

// CORRECT - All validation in schema
const schema = z.object({
  password: z
    .string()
    .min(8)
    .refine((pwd) => /[A-Z]/.test(pwd), { message: "Need uppercase" }),
});
```

### Missing z.input/z.output with Transforms

```typescript
// WRONG - Misleading function signature
const DateSchema = z.string().transform((s) => new Date(s));
type DateType = z.infer<typeof DateSchema>; // Date (output only)
function processDate(date: DateType) {} // Caller thinks they need Date, but schema expects string

// CORRECT - Explicit input and output types
type DateInput = z.input<typeof DateSchema>; // string
type DateOutput = z.output<typeof DateSchema>; // Date
function processDateInput(dateStr: DateInput): DateOutput {
  return DateSchema.parse(dateStr);
}
```

---

## Quick Checklists

### Schema Definition

- [ ] All validation limits use named constants (no magic numbers)
- [ ] All user-facing fields have custom error messages
- [ ] Types are derived with `z.infer<typeof schema>` (no parallel interfaces)
- [ ] Optional fields use `.optional()`, `.nullable()`, or `.nullish()` appropriately
- [ ] Default values provided where appropriate with `.default()`
- [ ] Schemas are composed from reusable sub-schemas where possible

### Validation

- [ ] User input uses `safeParse` (not `parse`)
- [ ] API responses are validated at fetch boundary
- [ ] Async refinements use `safeParseAsync`
- [ ] Error messages are formatted for UI display
- [ ] Validation errors include field paths

### Type Safety

- [ ] Types are derived from schemas with `z.infer`
- [ ] Schemas with transforms use `z.input` and `z.output` where needed
- [ ] Discriminated unions are used when objects share discriminator field
- [ ] Named exports are used (no default exports)

### Performance

- [ ] Complex async validations are debounced in UI
- [ ] Large schemas are split into reusable sub-schemas
- [ ] Schemas are defined once, not recreated on each validation
- [ ] Only validate at trust boundaries, not internal function calls

---

## Method Quick Reference

| Method              | Purpose                           | Example                                                   |
| ------------------- | --------------------------------- | --------------------------------------------------------- |
| `.parse()`          | Validate and throw on error       | `schema.parse(data)`                                      |
| `.safeParse()`      | Validate and return result object | `schema.safeParse(data)`                                  |
| `.parseAsync()`     | Async parse (throws)              | `await schema.parseAsync(data)`                           |
| `.safeParseAsync()` | Async safe parse                  | `await schema.safeParseAsync(data)`                       |
| `.refine()`         | Custom validation                 | `.refine((val) => val > 0, { message: "..." })`           |
| `.superRefine()`    | Cross-field validation            | `.superRefine((data, ctx) => { ctx.addIssue(...) })`      |
| `.transform()`      | Convert data during validation    | `.transform((val) => val.trim())`                         |
| `.pipe()`           | Chain schemas together            | `z.string().pipe(z.transform(v => v.length))`             |
| `.catch()`          | Provide fallback on error         | `.catch("default")` or `.catch((ctx) => fallback)`        |
| `.default()`        | Provide default value             | `.default("unknown")`                                     |
| `.optional()`       | Allow undefined                   | `.optional()` -> `T \| undefined`                         |
| `.nullable()`       | Allow null                        | `.nullable()` -> `T \| null`                              |
| `.nullish()`        | Allow null or undefined           | `.nullish()` -> `T \| null \| undefined`                  |
| `.readonly()`       | Mark output as readonly           | `.readonly()` -> `Readonly<T>`                            |
| `.brand<T>()`       | Add nominal type brand            | `.brand<"UserId">()`                                      |
| `.extend()`         | Add fields to object              | `schema.extend({ newField: z.string() })`                 |
| `.pick()`           | Select specific fields            | `schema.pick({ id: true, name: true })`                   |
| `.omit()`           | Remove specific fields            | `schema.omit({ password: true })`                         |
| `.partial()`        | Make all fields optional          | `schema.partial()`                                        |
| `.passthrough()`    | Allow extra fields                | `schema.passthrough()` (deprecated v4: `z.looseObject()`) |
| `.strict()`         | Reject extra fields               | `schema.strict()` (deprecated v4: `z.strictObject()`)     |
| `z.coerce`          | Convert type before validation    | `z.coerce.number()`                                       |
| `z.lazy`            | Recursive schema reference        | `z.lazy(() => CategorySchema)`                            |
| `z.infer`           | Extract output type               | `type T = z.infer<typeof schema>`                         |
| `z.input`           | Extract input type                | `type T = z.input<typeof schema>`                         |
| `z.output`          | Extract output type (alias)       | `type T = z.output<typeof schema>`                        |

### ISO String Validators

| Method        | Purpose                       | Example                                             |
| ------------- | ----------------------------- | --------------------------------------------------- |
| `.date()`     | Validate ISO 8601 date string | `z.string().date()` -> `"2024-01-15"`               |
| `.time()`     | Validate ISO 8601 time string | `z.string().time()` -> `"12:30:00"`                 |
| `.datetime()` | Validate ISO 8601 datetime    | `z.string().datetime()` -> `"2024-01-15T12:30:00Z"` |
| `.duration()` | Validate ISO 8601 duration    | `z.string().duration()` -> `"P3Y6M4DT12H30M5S"`     |

---

## Zod v4 Migration Guide

Zod v4 was released as stable in May 2025 (current: v4.1+). These are the changes that affect patterns documented in this skill.

### Breaking Changes

**String format methods deprecated:**

```typescript
// v3 (still works, deprecated)      // v4 (preferred)
z.string().email()                    z.email()
z.string().url()                      z.url()
z.string().uuid()                     z.uuid()
z.string().date()                     z.iso.date()
z.string().time()                     z.iso.time()
z.string().datetime()                 z.iso.datetime()
z.string().duration()                 z.iso.duration()
```

**Error handling changes:**

```typescript
// v3                                  // v4
result.error.flatten()                 z.flattenError(result.error)
result.error.format()                  z.treeifyError(result.error)
z.ZodErrorMap                         Use `error` param instead of `errorMap`
invalid_type_error / required_error   Use `error` function param
```

Note: `ctx.addIssue()` in `.superRefine()` still works in v4. `ctx.path` was removed for performance.

**Object schema changes:**

```typescript
// v3                                  // v4
schema.merge(other)                    schema.extend(other.shape)
schema.strict()                        z.strictObject({...})
schema.passthrough()                   z.looseObject({...})
schema.deepPartial()                   Removed (use z.partial recursion)
```

**Other breaking changes:**

- `z.number()` rejects Infinity (was accepted in v3)
- `z.number().safe()` now identical to `.int()`; both only accept safe integers
- `z.uuid()` now enforces RFC 9562/4122; use `z.guid()` for permissive
- `z.record()` requires two arguments: `z.record(keySchema, valueSchema)` (single-arg form dropped)
- `z.record()` with enum keys now enforces exhaustiveness; use `z.partialRecord()` for optional keys
- `z.nativeEnum()` deprecated; `z.enum()` handles enum-like objects
- Refinement type predicates no longer narrow types
- `.refine()` function as second argument removed; use `.superRefine()` for dynamic error messages
- `ctx.path` removed from `.superRefine()` for performance; `ctx.addIssue()` still works
- Schema-level error maps take precedence over parse-time maps (reversed from v3)
- `.default()` now requires value matching output type (not input type); use `.prefault()` for old behavior

### New v4 Features

- **`z.file()`**: File validation with `.min()`, `.max()`, `.mime()`
- **`z.stringbool()`**: Parses "true"/"yes"/"1"/"on" to boolean, "false"/"no"/"0"/"off" to false
- **`z.templateLiteral()`**: Type-safe string patterns
- **`z.toJSONSchema()`**: Native JSON Schema export
- **`z.int32()`, `z.float32()`, `z.int64()`**: Numeric format schemas
- **`z.prettifyError()`**: Human-readable error string for debugging/logging
- **`z.partialRecord()`**: Record with optional keys (for non-exhaustive enum key records)
- **Recursive types**: Direct recursive definitions without type casting in v4

### Version Import Strategy

```typescript
// For libraries supporting both versions
import { z } from "zod/v3"; // Pinned to v3
import { z } from "zod/v4"; // Pinned to v4

// For applications on v4
import { z } from "zod"; // Latest (v4)
```

### Performance Improvements (v4)

- String parsing: 14.7x faster
- Array parsing: 7.4x faster
- Object parsing: 6.5x faster
- TypeScript instantiations: 100x reduction (25,000 to 175)
- Bundle size: 57% smaller (5.36kb gzipped vs 12.47kb)
