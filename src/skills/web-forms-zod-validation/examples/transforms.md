# Zod Validation - Transform & Coercion Examples

> Data conversion patterns during validation. See [core.md](core.md) for fundamental patterns.

**Prerequisites**: Understand schema definition and safeParse from core examples first.

---

## Pattern 7: String to Date Transform

```typescript
import { z } from "zod";

const DateStringSchema = z
  .string()
  .datetime()
  .transform((str) => new Date(str));

const EventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  startDate: DateStringSchema,
  endDate: DateStringSchema,
  isAllDay: z.boolean().default(false),
});

// Types reflect transformation
type EventInput = z.input<typeof EventSchema>;
// { id: string; title: string; startDate: string; endDate: string; isAllDay?: boolean }

type Event = z.output<typeof EventSchema>;
// { id: string; title: string; startDate: Date; endDate: Date; isAllDay: boolean }

// Cross-field validation on transformed values
const ValidEventSchema = EventSchema.refine(
  (event) => event.endDate >= event.startDate,
  { message: "End date must be after start date", path: ["endDate"] },
);
```

**Why good:** transform converts strings to Dates during validation, input/output types are distinct, refinement can use transformed values for cross-field checks

---

## Pattern 8: Coercion for URL Query Params

```typescript
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_LIMIT, `Limit cannot exceed ${MAX_LIMIT}`)
    .default(DEFAULT_LIMIT),
  sortBy: z.enum(["createdAt", "name", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

type Pagination = z.infer<typeof PaginationSchema>;

function getPaginationFromQuery(params: URLSearchParams): Pagination {
  const result = PaginationSchema.safeParse({
    page: params.get("page"),
    limit: params.get("limit"),
    sortBy: params.get("sortBy"),
    sortOrder: params.get("sortOrder"),
  });

  if (!result.success) {
    return PaginationSchema.parse({});
  }

  return result.data;
}
```

**Why good:** coerce handles string-to-number conversion, defaults provide fallbacks for missing params, max limit prevents abuse

---

## Pattern 9: Pipe - Transform Then Validate

Use `.pipe()` to chain schemas: transform first, then validate the transformed result.

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

TrimmedStringSchema.parse("  hello  "); // => "hello"
// TrimmedStringSchema.parse("   ");    // Error: Field cannot be empty

type TrimmedInput = z.input<typeof TrimmedStringSchema>; // string
type TrimmedOutput = z.output<typeof TrimmedStringSchema>; // string
```

**Why good:** pipe separates transformation from validation, each step is clear and testable, error messages reference the validated (trimmed) value

**When to use:** When you need to validate the result of a transform, not the original input. Common for trimming, normalization, and format conversion.
