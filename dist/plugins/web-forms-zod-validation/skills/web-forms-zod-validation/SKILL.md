---
name: web-forms-zod-validation
description: Zod schema validation patterns for TypeScript - schema definitions, type inference, refinements, transforms, discriminated unions
---

# Zod Schema Validation Patterns

> **Quick Guide:** A schema is declared once and the TypeScript type derived from it with `z.infer`,
> so the rule and the type cannot drift. `safeParse` returns a result object where invalid input is
> expected and `parse` throws where it is a bug; `refine` and `superRefine` carry rules the built-in
> checks cannot express, and `transform` converts during validation — which splits `z.input` from
> `z.output`. On v4 the string formats moved to the top level (`z.email()`, `z.url()`, `z.iso.*`) and
> the v3 method chains are deprecated rather than removed; `flatten()`, `format()` and `merge()` have
> replacements, and [reference.md](reference.md) carries the full migration list.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — schema definition, safe parsing, error formatting, unions, composition, async refinements
- [examples/transforms.md](examples/transforms.md) — transforms, coercion, pipe chains, query params
- [examples/advanced-patterns.md](examples/advanced-patterns.md) — branded types, `.catch()` fallbacks, readonly, recursive schemas
- [reference.md](reference.md) — decision trees, method lookup, worked anti-patterns, v4 migration guide

---

## Which path applies

- **The schema checks a value and hands back what it received** — `z.infer` is the only type helper
  needed, and the parsed value has the shape the caller passed in. Follow
  [examples/core.md](examples/core.md).
- **The schema converts as it checks** — a `transform`, a `coerce` or a `default` makes the input and
  output types differ, so a function taking pre-validation data types its parameter `z.input` and
  its return `z.output`. Follow [examples/transforms.md](examples/transforms.md).

---

<critical_requirements>

## Before writing Zod schemas

**Reach for `safeParse` wherever invalid input is expected.** It returns a result object rather than
throwing, so the failure is a branch rather than a catch, and `result.error.issues` carries the field
paths a form needs. Keep `parse` for config and internal data, where invalid means a bug.

**Derive the type with `z.infer<typeof schema>`.** A hand-written interface beside a schema is a
second declaration of the same thing, and the two drift in the direction that leaves the type
claiming more than the schema checks.

**Validate where untrusted data enters** — API responses, form input, config, URL params. A shape
change caught at the boundary names the field that moved; caught later it surfaces as an undefined
property several frames away.

**Name the validation limits.** `.min(MIN_USERNAME_LENGTH)` says what the number is for, and the same
constant reaches the error message so the two cannot disagree.

</critical_requirements>

---

**Auto-detection:** zod, z.object, z.infer, z.input, z.output, safeParse, safeParseAsync, parse,
parseAsync, refine, superRefine, ctx.addIssue, transform, discriminatedUnion, z.coerce, z.pipe,
z.catch, z.brand, z.lazy, z.email, z.url, z.uuid, z.iso, z.flattenError, z.treeifyError,
z.strictObject, z.looseObject, ZodError

**Applies to:**

- Validating data crossing a trust boundary, and reporting which field failed
- Deriving TypeScript types from the rules that enforce them
- Cross-field rules, conditional shapes and discriminated variants
- Converting values during validation — strings to numbers, ISO strings to `Date`
- Composing schemas for the read, create and update shapes of one record

**Handled elsewhere:**

- Wiring a schema into a form — a form library accepts one through its own adapter or validator
  slot, and how that connection is made is settled by whatever owns it.
- Where the data came from — a schema validates a value it is handed and performs no I/O of its own.
- Persistence schemas — a runtime validator and a table definition are separate artefacts even where
  they describe the same record, and generating one from the other is that tool's concern.

---

<philosophy>

TypeScript checks the code you compile; a schema checks the data you receive. The two meet at the
boundary, and the point of deriving the type from the schema is that only one of them can be wrong.

```typescript
const UserSchema = z.object({ name: z.string(), email: z.email() });
type User = z.infer<typeof UserSchema>;
```

Written the other way round — an interface, and a schema maintained beside it — a field added to the
interface and forgotten in the schema type-checks everywhere while validating nothing.

The corollary is where _not_ to reach for a schema. Data that has already crossed a boundary has
been checked, and re-validating it inside a function the compiler already governs buys nothing and
costs a parse on every call.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Schema with named limits

The constant appears in the check and in the message, so a change to the limit updates both.

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
  email: z.email("Invalid email format"),
});

type User = z.infer<typeof UserSchema>;
```

Full code: [examples/core.md](examples/core.md) Pattern 1

---

### Pattern 2: safeParse and error formatting

The result is a discriminated union on `success`, so the failure branch narrows to an error and the
success branch to typed data.

```typescript
const result = UserSchema.safeParse(data);

if (!result.success) {
  const { fieldErrors } = z.flattenError(result.error);
  return { success: false, errors: fieldErrors };
}

return { success: true, user: result.data };
```

`z.flattenError` gives one level of field-to-messages, which is what a flat form needs.
`z.treeifyError` preserves nesting for anything deeper.

Full code: [examples/core.md](examples/core.md) Pattern 2

---

### Pattern 3: Refinements and cross-field rules

`refine` adds a condition to one value. `superRefine` sees the whole object and chooses which path
the error attaches to, which is what puts a mismatch message on the field the user must fix.

```typescript
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

Full code: [examples/core.md](examples/core.md) Pattern 5

---

### Pattern 4: Transforms and the input/output split

Once a schema transforms, it has two types. `z.infer` returns the output, so a function receiving
raw data types its parameter `z.input`.

```typescript
const DateSchema = z.iso.datetime().transform((str) => new Date(str));

type DateInput = z.input<typeof DateSchema>; // string
type DateOutput = z.output<typeof DateSchema>; // Date
```

`.transform()` runs after every other check on the same schema, so a rule that must inspect the
converted value goes after a `.pipe()` rather than before the transform.

Full code: [examples/transforms.md](examples/transforms.md) Pattern 7, and Pattern 9 for the pipe

---

### Pattern 5: Discriminated unions

Where the variants share a literal field, naming it lets Zod check one branch instead of all of them.

```typescript
const NotificationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("email"), email: z.email(), subject: z.string() }),
  z.object({ type: z.literal("sms"), phone: z.string(), message: z.string() }),
  z.object({
    type: z.literal("push"),
    deviceId: z.string(),
    title: z.string(),
  }),
]);
```

A plain `z.union` tries every member and reports the combined failure, which reads as "invalid
input"; the discriminated form names the variant and the field inside it, and narrows in a `switch`.

Full code: [examples/core.md](examples/core.md) Pattern 4

---

### Pattern 6: Composition

One base schema, and the read, create and update shapes derived from it — so a field added to the
base reaches all three.

```typescript
const UserSchema = BaseEntitySchema.extend({
  email: z.email(),
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

`.extend()` is unavailable on a schema that already carries `.refine()`, so extend first and refine
last.

Full code: [examples/core.md](examples/core.md) Pattern 3

---

### Pattern 7: Coercion for string sources

URL params and form fields arrive as strings whatever they represent. `z.coerce` converts before
checking, so the rules read as the types they are about.

```typescript
const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT),
});
```

`z.coerce.boolean()` is `Boolean(value)`, so every non-empty string is `true` — including `"false"`.
Use `z.stringbool()` where the string carries the intent.

Full code: [examples/transforms.md](examples/transforms.md) Pattern 8

---

### Pattern 8: optional, nullable, nullish and default

Four distinct claims about an absent value; picking by meaning keeps the type honest.

```typescript
const ProfileSchema = z.object({
  name: z.string(), // required
  bio: z.string().optional(), // may be omitted — string | undefined
  avatar: z.url().nullable(), // explicitly empty — string | null
  nickname: z.string().nullish(), // either — string | null | undefined
  theme: z.string().default("light"), // absent becomes "light" — always string
});
```

`.default()` fills a missing key, so the output type stays non-optional while the input type does
not — one more reason `z.input` and `z.output` diverge.

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `parse` on user input — it throws on the expected case, and a catch block receives the exception
  after the branch that could have read `error.issues` has been skipped. Use `safeParse`.
- An async refinement parsed synchronously — Zod throws rather than awaiting. `parseAsync` or
  `safeParseAsync` for any schema containing one.
- `.extend()` on a schema that already carries `.refine()` — the refined schema no longer exposes it.
  Extend first, refine last.
- v4: `.refine(fn, (val) => ({ message }))` — the function form of the second argument is gone. Use
  `superRefine` where the message depends on the value.
- v4: `z.record(valueSchema)` with one argument — both the key and the value schema are required now.

**Surprising behaviour:**

- Unknown keys are stripped rather than rejected. `z.strictObject()` rejects them and
  `z.looseObject()` keeps them; the plain object schema quietly drops them, which hides a renamed
  API field.
- `z.coerce.boolean()` coerces `"false"` to `true`, and `z.coerce.date()` accepts everything
  `new Date()` does — including strings that parse to a date nobody meant. Where the input is
  supposed to be ISO, `z.iso.datetime()` says so and rejects the rest.
- `z.email()` rejects the empty string, so an optional field that submits `""` fails. Allow it
  explicitly or normalise `""` to `undefined` before parsing.
- A `superRefine` rule is skipped, not failed, when a key it reads is absent — the object validates.
- Default `"Invalid input"` messages reach the user unchanged wherever a check has no message.
- v4: `ctx.path` is gone from `superRefine` — `ctx.addIssue({ path: [...] })` still works.
- v4 replacements: `.flatten()` → `z.flattenError()`, `.format()` → `z.treeifyError()`, `.merge()` →
  `.extend()`.

Worked before/after code for the most common of these is in [reference.md](reference.md).

</red_flags>
