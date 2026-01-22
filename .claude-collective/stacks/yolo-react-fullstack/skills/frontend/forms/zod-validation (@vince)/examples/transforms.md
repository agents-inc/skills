# Zod Transform & Coercion Examples

> Transform and coercion patterns for data conversion during validation. See [SKILL.md](../SKILL.md) for core concepts.

---

## Transforms

### Good Example - String to Date Transform

```typescript
import { z } from "zod";

// Transform ISO string to Date object
const DateStringSchema = z
  .string()
  .datetime()
  .transform((str) => new Date(str));

// Event schema with date transforms
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

// Validation with refinement after transform
const ValidEventSchema = EventSchema.refine(
  (event) => event.endDate >= event.startDate,
  { message: "End date must be after start date", path: ["endDate"] },
);
```

**Why good:** transform converts strings to Dates during validation, input/output types are distinct, refinement can use transformed values

---

## Coercion

### Good Example - Number Coercion with Validation

```typescript
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Query params schema with coercion
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

// Usage with URL query params
function getPaginationFromQuery(params: URLSearchParams): Pagination {
  const result = PaginationSchema.safeParse({
    page: params.get("page"),
    limit: params.get("limit"),
    sortBy: params.get("sortBy"),
    sortOrder: params.get("sortOrder"),
  });

  if (!result.success) {
    // Return defaults on invalid input
    return PaginationSchema.parse({});
  }

  return result.data;
}
```

**Why good:** coerce handles string-to-number conversion, defaults provide fallbacks for missing params, max limit prevents abuse
