# Hono + OpenAPI - Validation Examples

> Zod schema definitions with OpenAPI integration. See [core.md](core.md) for route setup patterns.

**Prerequisites**: Understand Pattern 1 (Modular Route Setup) from core examples first.

---

## Pattern 1: Complete Schema Setup

### Good Example - Complete Schema Setup

**File: `/app/api/schemas.ts`**

```typescript
import { z } from "zod";
import { extendZodWithOpenApi } from "@hono/zod-openapi";

// REQUIRED: Extend Zod with OpenAPI methods BEFORE defining schemas
extendZodWithOpenApi(z);

const MIN_SALARY = 0;
const CURRENCY_CODE_LENGTH = 3;
const MIN_TITLE_LENGTH = 1;
const MAX_TITLE_LENGTH = 255;
const DEFAULT_LIMIT = "50";

// Reusable Sub-Schemas
export const SalarySchema = z
  .object({
    min: z.number().min(MIN_SALARY),
    max: z.number().min(MIN_SALARY),
    currency: z.string().length(CURRENCY_CODE_LENGTH),
  })
  .openapi("Salary", {
    example: { min: 60000, max: 90000, currency: "EUR" },
  });

export const CompanySchema = z
  .object({
    name: z.string().nullable(),
    logoUrl: z.string().url().nullable(),
  })
  .openapi("Company");

// Request Schemas
export const JobsQuerySchema = z
  .object({
    country: z
      .string()
      .optional()
      .openapi({
        param: { name: "country", in: "query" },
        example: "germany",
        description: "Filter by country (comma-separated for multiple)",
      }),
    employment_type: z
      .enum(["full_time", "part_time", "contract", "internship"])
      .optional()
      .openapi({
        param: { name: "employment_type", in: "query" },
        example: "full_time",
      }),
    limit: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .openapi({
        param: { name: "limit", in: "query" },
        example: DEFAULT_LIMIT,
      }),
  })
  .openapi("JobsQuery");

// Response Schemas
export const JobSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(MIN_TITLE_LENGTH).max(MAX_TITLE_LENGTH),
    description: z.string(),
    employmentType: z.string().nullable(),
    salary: SalarySchema.nullable(),
    company: CompanySchema,
  })
  .openapi("Job");

export const JobsResponseSchema = z
  .object({
    jobs: z.array(JobSchema),
    total: z.number().int().min(MIN_SALARY),
  })
  .openapi("JobsResponse");

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
  })
  .openapi("ErrorResponse", {
    example: { error: "Failed to fetch jobs", message: "Database connection timeout" },
  });

// Type Exports
export type Salary = z.infer<typeof SalarySchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Job = z.infer<typeof JobSchema>;
export type JobsQuery = z.infer<typeof JobsQuerySchema>;
export type JobsResponse = z.infer<typeof JobsResponseSchema>;
```

**Why good:** extendZodWithOpenApi first (required for .openapi() to exist), named constants prevent magic number bugs, reusable sub-schemas reduce duplication, .openapi() enables auto-docs

### Bad Example - Missing best practices

```typescript
// BAD Example - Missing best practices
import { z } from "zod";

const JobSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255), // BAD: Magic numbers
  salary: z.object({
    // BAD: Duplicated schema instead of reusable
    min: z.number(),
    max: z.number(),
    currency: z.string().length(3), // BAD: Magic number
  }),
});

// BAD: No .openapi() registration
// BAD: No examples for documentation
// BAD: extendZodWithOpenApi() not called

export default JobSchema; // BAD: Default export
```

**Why bad:** Magic numbers cause silent bugs when changed, missing extendZodWithOpenApi crashes at runtime, no .openapi() = no docs, duplicated schemas diverge over time

---
