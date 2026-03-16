# Zod Validation - Advanced Pattern Examples

> Advanced patterns including branded types, catch fallbacks, readonly, recursive schemas, and ISO validators. See [core.md](core.md) for fundamental patterns.

**Prerequisites**: Understand schema definition, transforms, and refinements from core examples first.

---

## Pattern 10: Catch - Fallback Values

Use `.catch()` to recover from validation errors with fallback values. Ideal for user preferences, localStorage, cookies where data may be corrupted.

```typescript
import { z } from "zod";

const DEFAULT_THEME = "light";
const DEFAULT_LOCALE = "en";
const DEFAULT_PAGE_SIZE = 20;

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

**Why good:** catch provides graceful degradation for corrupted data, application doesn't crash on invalid preferences

**When to use:** Parsing data from localStorage, cookies, or other sources where corruption is possible but you want sensible defaults rather than errors.

---

## Pattern 11: Brand - Nominal Types

Use `.brand<T>()` to create nominal types that prevent accidental mixing of structurally identical types.

```typescript
import { z } from "zod";

const UserIdSchema = z.string().uuid().brand<"UserId">();
const OrganizationIdSchema = z.string().uuid().brand<"OrganizationId">();
const InvoiceIdSchema = z.string().uuid().brand<"InvoiceId">();

type UserId = z.infer<typeof UserIdSchema>;
type OrganizationId = z.infer<typeof OrganizationIdSchema>;
type InvoiceId = z.infer<typeof InvoiceIdSchema>;

async function getUser(userId: UserId): Promise<User> {
  return fetch(`/api/users/${userId}`).then((r) => r.json());
}

const userId = UserIdSchema.parse("550e8400-e29b-41d4-a716-446655440000");
const invoiceId = InvoiceIdSchema.parse("660e8400-e29b-41d4-a716-446655440000");

getUser(userId); // OK
// getUser(invoiceId); // TypeScript error: InvoiceId not assignable to UserId
```

**Why good:** branded types catch ID mixing bugs at compile time, no runtime overhead, prevents common bugs in codebases with many entity types

---

## Pattern 12: Readonly - Immutable Output

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
// Readonly<{ api: { baseUrl: string; ... }; features: { ... } }>

const config = AppConfigSchema.parse({
  api: { baseUrl: "https://api.example.com", timeout: 5000, retries: 3 },
  features: { darkMode: true, analytics: false },
});
// config.api.timeout = 10000; // TypeScript error: Cannot assign to 'timeout'
```

**Why good:** readonly prevents accidental config mutation at both compile-time and runtime

---

## Pattern 13: Recursive Schemas

### Getter Syntax (Preferred, Zod 3.22+)

```typescript
import { z } from "zod";

interface Category {
  id: string;
  name: string;
  subcategories?: Category[];
}

const CategorySchema: z.ZodType<Category> = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  get subcategories() {
    return z.array(CategorySchema).optional();
  },
});

const category = CategorySchema.parse({
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Electronics",
  subcategories: [
    {
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Phones",
      subcategories: [
        { id: "770e8400-e29b-41d4-a716-446655440000", name: "Smartphones" },
      ],
    },
  ],
});
```

**Why good:** getter syntax is cleaner than z.lazy(), type annotation ensures correct recursive inference

### z.lazy() for Mutual Recursion

```typescript
import { z } from "zod";

interface TreeNode {
  value: string;
  children?: TreeNode[];
}

const TreeNodeSchema: z.ZodType<TreeNode> = z.object({
  value: z.string(),
  children: z.lazy(() => z.array(TreeNodeSchema)).optional(),
});
```

**When to use z.lazy():** Mutual recursion between two schemas, or backward compatibility with older Zod versions.

---

## Pattern 14: ISO Date/Time Validators (Zod 3.23+)

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

const EventSchema = z.object({
  title: z.string().min(1),
  date: DateOnlySchema, // "2024-06-15"
  startTime: TimeOnlySchema, // "09:00:00"
  endTime: TimeOnlySchema, // "17:00:00"
  reminderBefore: DurationSchema.optional(), // "PT30M" (30 minutes)
});

// Invalid formats rejected:
// DateOnlySchema.parse("06/15/2024");  // Error: not ISO format
// TimeOnlySchema.parse("9:00 AM");     // Error: not 24-hour ISO format
```

**Why good:** native ISO validators are more precise than regex, better error messages than custom patterns

**Zod v4 note:** In v4, these moved to `z.iso.date()`, `z.iso.time()`, `z.iso.datetime()`, `z.iso.duration()` as top-level functions.
