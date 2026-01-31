# Zod Advanced Pattern Examples

> Advanced patterns including pipes, catch fallbacks, branded types, readonly, and ISO validators. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pipe - Schema Chaining

### Good Example - Transform Then Validate

```typescript
import { z } from "zod";

const MIN_TRIMMED_LENGTH = 1;
const MAX_TRIMMED_LENGTH = 100;

// Parse string, trim it, then validate trimmed length
const TrimmedStringSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(MIN_TRIMMED_LENGTH, "Field cannot be empty")
      .max(
        MAX_TRIMMED_LENGTH,
        `Field cannot exceed ${MAX_TRIMMED_LENGTH} characters`,
      ),
  );

// Usage
TrimmedStringSchema.parse("  hello  "); // => "hello"
TrimmedStringSchema.parse("   "); // ❌ Error: Field cannot be empty

// Type inference
type TrimmedInput = z.input<typeof TrimmedStringSchema>; // string
type TrimmedOutput = z.output<typeof TrimmedStringSchema>; // string
```

**Why good:** pipe separates transformation from validation, makes each step clear and testable, error messages reference the validated (trimmed) value

---

## Catch - Fallback Values

### Good Example - Graceful Degradation for Config

```typescript
import { z } from "zod";

const DEFAULT_THEME = "light";
const DEFAULT_LOCALE = "en";
const DEFAULT_PAGE_SIZE = 20;

// User preferences with fallbacks for invalid/missing values
const UserPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).catch(DEFAULT_THEME),
  locale: z.string().min(2).max(5).catch(DEFAULT_LOCALE),
  pageSize: z.number().int().positive().max(100).catch(DEFAULT_PAGE_SIZE),
});

type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Even with invalid data, parsing succeeds with defaults
const prefs = UserPreferencesSchema.parse({
  theme: "invalid-theme", // Falls back to "light"
  locale: "", // Falls back to "en"
  pageSize: -5, // Falls back to 20
});

// prefs: { theme: "light", locale: "en", pageSize: 20 }
```

**Why good:** catch provides graceful degradation for corrupted data (localStorage, cookies), application doesn't crash on invalid user preferences

---

## Brand - Nominal Types

### Good Example - Type-Safe ID Handling

```typescript
import { z } from "zod";

// Branded ID schemas prevent mixing different ID types
const UserIdSchema = z.string().uuid().brand<"UserId">();
const OrganizationIdSchema = z.string().uuid().brand<"OrganizationId">();
const InvoiceIdSchema = z.string().uuid().brand<"InvoiceId">();

type UserId = z.infer<typeof UserIdSchema>;
type OrganizationId = z.infer<typeof OrganizationIdSchema>;
type InvoiceId = z.infer<typeof InvoiceIdSchema>;

// API functions with type-safe IDs
async function getUser(userId: UserId): Promise<User> {
  return fetch(`/api/users/${userId}`).then((r) => r.json());
}

async function getInvoice(invoiceId: InvoiceId): Promise<Invoice> {
  return fetch(`/api/invoices/${invoiceId}`).then((r) => r.json());
}

// Usage - TypeScript prevents accidental ID swapping
const userId = UserIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
const invoiceId = InvoiceIdSchema.parse("660e8400-e29b-41d4-a716-446655440000");

getUser(userId); // ✅ OK
// getUser(invoiceId); // ❌ TypeScript error: InvoiceId not assignable to UserId

// Note: Branded types are compile-time only - runtime parsing is unchanged
```

**Why good:** branded types catch ID mixing bugs at compile time, no runtime overhead, prevents common bugs in large codebases with many entity types

---

## Readonly - Immutable Output

### Good Example - Configuration Object

```typescript
import { z } from "zod";

const AppConfigSchema = z
  .object({
    api: z.object({
      baseUrl: z.string().url(),
      timeout: z.number().positive(),
      retries: z.number().int().min(0).max(5),
    }),
    features: z.object({
      darkMode: z.boolean(),
      analytics: z.boolean(),
    }),
  })
  .readonly();

type AppConfig = z.infer<typeof AppConfigSchema>;
// Readonly<{ api: { baseUrl: string; timeout: number; retries: number }; features: { darkMode: boolean; analytics: boolean } }>

const config = AppConfigSchema.parse({
  api: { baseUrl: "https://api.example.com", timeout: 5000, retries: 3 },
  features: { darkMode: true, analytics: false },
});

// TypeScript prevents mutation
// config.api.timeout = 10000; // ❌ Error: Cannot assign to 'timeout'

// Note: Object.freeze() is applied at runtime
```

**Why good:** readonly prevents accidental config mutation, enforced at both compile-time (TypeScript) and runtime (Object.freeze)

---

## ISO Date/Time Validators (Zod 3.23+)

### Good Example - Event Scheduling

```typescript
import { z } from "zod";

// ISO 8601 date (YYYY-MM-DD)
const DateOnlySchema = z.string().date();

// ISO 8601 time (HH:MM:SS or HH:MM:SS.sss)
const TimeOnlySchema = z.string().time();

// ISO 8601 datetime with timezone
const DateTimeSchema = z.string().datetime();

// ISO 8601 duration (P[n]Y[n]M[n]DT[n]H[n]M[n]S)
const DurationSchema = z.string().duration();

// Complete event schema
const EventSchema = z.object({
  title: z.string().min(1),
  date: DateOnlySchema, // "2024-06-15"
  startTime: TimeOnlySchema, // "09:00:00"
  endTime: TimeOnlySchema, // "17:00:00"
  reminderBefore: DurationSchema.optional(), // "PT30M" (30 minutes)
});

type Event = z.infer<typeof EventSchema>;

// Usage
const event = EventSchema.parse({
  title: "Team Meeting",
  date: "2024-06-15",
  startTime: "09:00:00",
  endTime: "10:30:00",
  reminderBefore: "PT15M",
});

// Invalid formats rejected
// DateOnlySchema.parse("06/15/2024");    // ❌ Error: not ISO format
// TimeOnlySchema.parse("9:00 AM");       // ❌ Error: not 24-hour ISO format
```

**Why good:** native ISO validators are more precise than regex patterns, better error messages, specifically designed for date interchange formats

---

## Recursive Schemas

### Good Example - Category Tree

```typescript
import { z } from "zod";

// Define the type first for recursive reference
interface Category {
  id: string;
  name: string;
  subcategories?: Category[];
}

// Use getter syntax for recursive schema (Zod 3.22+)
const CategorySchema: z.ZodType<Category> = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  get subcategories() {
    return z.array(CategorySchema).optional();
  },
});

// Usage
const category = CategorySchema.parse({
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Electronics",
  subcategories: [
    {
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Phones",
      subcategories: [
        {
          id: "770e8400-e29b-41d4-a716-446655440000",
          name: "Smartphones",
        },
      ],
    },
  ],
});
```

**Why good:** getter syntax is cleaner than z.lazy() for most cases, type annotation ensures correct recursive inference, handles arbitrarily deep nesting

### Alternative - z.lazy() for Mutual Recursion

```typescript
import { z } from "zod";

// For mutually recursive types, use z.lazy()
interface TreeNode {
  value: string;
  children?: TreeNode[];
}

const TreeNodeSchema: z.ZodType<TreeNode> = z.object({
  value: z.string(),
  children: z.lazy(() => z.array(TreeNodeSchema)).optional(),
});
```

**When to use z.lazy():** When you need mutual recursion between two schemas, or for backward compatibility with older Zod versions.
