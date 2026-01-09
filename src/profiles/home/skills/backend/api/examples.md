# Backend API Examples

> All code examples for Hono + OpenAPI patterns. Referenced from [skill.md](skill.md).

---

## API Route Setup Examples

### Good Example - Modular Route Setup

**File: `/app/api/[[...route]]/route.ts`**

```typescript
// Import order: External deps -> Relative imports
import { OpenAPIHono } from "@hono/zod-openapi";
import { handle } from "hono/vercel";

import { jobsRoutes } from "../routes/jobs";
import { companiesRoutes } from "../routes/companies";

// Create main app with base path
const app = new OpenAPIHono().basePath("/api");

// Mount route modules using app.route()
app.route("/", jobsRoutes);
app.route("/", companiesRoutes);

// REQUIRED: Export app for OpenAPI spec generation
export { app };

// Export handlers for Next.js (all HTTP methods)
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
```

**Why good:** app.route() prevents God files, app export enables build-time spec generation, named exports follow project convention

### Bad Example - Missing exports and poor structure

```typescript
// BAD Example - Missing exports and poor structure
import { Hono } from "hono";

const app = new Hono();

// BAD: Inline route definitions make file huge
app.get("/jobs", async (c) => {
  // 100+ lines of code here...
});

app.get("/companies", async (c) => {
  // 100+ lines of code here...
});

// BAD: Default export prevents spec generation
export default handle(app);
```

**Why bad:** No OpenAPI means no docs/validation, inline routes create 1000+ line files, default export breaks spec generation, no modularization = unmaintainable

---

## Zod Schema Definition Examples

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

## Route Definition Examples

### Good Example - List Endpoint

**File: `/app/api/routes/jobs.ts`**

```typescript
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq, desc, isNull } from "drizzle-orm";

import { db, jobs, companies } from "@/lib/db";
import { JobsQuerySchema, JobsResponseSchema, ErrorResponseSchema } from "../schemas";

const DEFAULT_QUERY_LIMIT = 100;
const app = new OpenAPIHono();

const getJobsRoute = createRoute({
  method: "get",
  path: "/jobs",
  operationId: "getJobs", // Used for generated client method names
  tags: ["Jobs"], // Groups endpoints in documentation
  summary: "Get all jobs",
  description: "Retrieve active job postings with optional filters",
  request: {
    query: JobsQuerySchema,
  },
  responses: {
    200: {
      description: "List of jobs",
      content: { "application/json": { schema: JobsResponseSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

app.openapi(getJobsRoute, async (c) => {
  try {
    // Type-safe query parameter extraction
    const { country, employment_type } = c.req.valid("query");

    const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

    if (country) {
      conditions.push(eq(jobs.country, country));
    }

    if (employment_type) {
      conditions.push(eq(jobs.employmentType, employment_type as any));
    }

    const results = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        employmentType: jobs.employmentType,
        companyName: companies.name,
        companyLogoUrl: companies.logoUrl,
      })
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt))
      .limit(DEFAULT_QUERY_LIMIT);

    return c.json({ jobs: results, total: results.length }, 200);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return c.json(
      {
        error: "Failed to fetch jobs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Named export (project convention - no default exports)
export { app as jobsRoutes };
```

**Why good:** operationId becomes client method name (getJobs vs get_api_jobs), c.req.valid() enforces schema validation, soft delete checks prevent exposing deleted data

### Good Example - Detail Endpoint

```typescript
const getJobByIdRoute = createRoute({
  method: "get",
  path: "/jobs/{id}",
  operationId: "getJobById",
  tags: ["Jobs"],
  summary: "Get job by ID",
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        param: { name: "id", in: "path" },
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
    }),
  },
  responses: {
    200: {
      description: "Job details",
      content: { "application/json": { schema: JobSchema } },
    },
    404: {
      description: "Job not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

app.openapi(getJobByIdRoute, async (c) => {
  try {
    // Type-safe param extraction (note: "param" not "params")
    const { id } = c.req.valid("param");

    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, id), eq(jobs.isActive, true), isNull(jobs.deletedAt)),
      with: {
        company: {
          with: { locations: true },
        },
        jobSkills: {
          with: { skill: true },
        },
      },
    });

    if (!job) {
      return c.json({ error: "Job not found", message: `Job with ID ${id} does not exist` }, 404);
    }

    return c.json(job, 200);
  } catch (error) {
    console.error("Error fetching job:", error);
    return c.json(
      {
        error: "Failed to fetch job",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
```

### Bad Example - Poor practices

```typescript
// BAD Example - Poor practices
import { Hono } from "hono";

const app = new Hono();

app.get("/jobs", async (c) => {
  // BAD: No createRoute - no OpenAPI documentation
  // BAD: No type-safe query validation
  const country = c.req.query("country");

  // BAD: No soft delete check
  // BAD: Magic number limit(100)
  const results = await db.select().from(jobs).where(eq(jobs.country, country)).limit(100);

  // BAD: No error handling
  return c.json({ jobs: results });
});

export default app; // BAD: Default export
```

**Why bad:** No createRoute = no OpenAPI docs, no validation = crashes on bad input, missing soft delete returns deleted records to users, no error handling = 500s with no context

---

## Error Handling Examples

### Good Example - Standardized Error Handling

```typescript
import { z } from "zod";
import type { Context } from "hono";

const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;
const HTTP_STATUS_CONFLICT = 409;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.any().optional(),
  })
  .openapi("ErrorResponse");

// Named constants for error codes (no magic strings)
export const ErrorCodes = {
  VALIDATION_ERROR: "validation_error",
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  INTERNAL_ERROR: "internal_error",
  DATABASE_ERROR: "database_error",
} as const;

export const handleRouteError = (error: unknown, c: Context) => {
  // Always log with context
  console.error("Route error:", error);

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return c.json(
      {
        error: ErrorCodes.VALIDATION_ERROR,
        message: "Validation failed",
        statusCode: HTTP_STATUS_UNPROCESSABLE_ENTITY,
        details: error.errors,
      },
      HTTP_STATUS_UNPROCESSABLE_ENTITY,
    );
  }

  // Handle database constraint violations
  if (error instanceof Error) {
    if (error.message.includes("unique constraint")) {
      return c.json(
        {
          error: ErrorCodes.VALIDATION_ERROR,
          message: "Resource already exists",
          statusCode: HTTP_STATUS_CONFLICT,
        },
        HTTP_STATUS_CONFLICT,
      );
    }

    return c.json(
      {
        error: ErrorCodes.INTERNAL_ERROR,
        message: error.message,
        statusCode: HTTP_STATUS_INTERNAL_ERROR,
      },
      HTTP_STATUS_INTERNAL_ERROR,
    );
  }

  // Fallback for unknown errors
  return c.json(
    {
      error: ErrorCodes.INTERNAL_ERROR,
      message: "An unexpected error occurred",
      statusCode: HTTP_STATUS_INTERNAL_ERROR,
    },
    HTTP_STATUS_INTERNAL_ERROR,
  );
};
```

**Why good:** Named error codes enable frontend handling (switch on code), Zod error details show which field failed, consistent shape = predictable client parsing

**Usage in routes:**

```typescript
app.openapi(getJobsRoute, async (c) => {
  try {
    // ... route logic
  } catch (error) {
    return handleRouteError(error, c);
  }
});
```

### Bad Example - Inconsistent error handling

```typescript
// BAD Example - Inconsistent error handling
app.get("/jobs", async (c) => {
  try {
    const jobs = await db.select().from(jobs);
    return c.json(jobs);
  } catch (error) {
    // BAD: Magic number 500
    // BAD: No error code constant
    // BAD: Generic message
    return c.json({ error: "Error" }, 500);
  }
});
```

**Why bad:** Magic 500 breaks when status changes, generic "Error" message can't be handled by frontend, no logging = blind to production issues

---

## Filtering Examples

### Good Example - Multiple Values with Case-Insensitive Matching

```typescript
import { sql } from "drizzle-orm";

const SINGLE_VALUE_COUNT = 1;

// Query: ?country=germany,france,spain
const { country } = c.req.valid("query");

const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

if (country) {
  const countries = country.split(",").map((c) => c.trim().toLowerCase());

  if (countries.length === SINGLE_VALUE_COUNT) {
    // Single value: use simple equality with case-insensitive comparison
    conditions.push(sql`LOWER(${jobs.country}) = ${countries[0]}`);
  } else {
    // Multiple values: use IN clause with case-insensitive comparison
    conditions.push(
      sql`LOWER(${jobs.country}) IN (${sql.join(
        countries.map((c) => sql`${c}`),
        sql`, `,
      )})`,
    );
  }
}

const results = await db
  .select()
  .from(jobs)
  .where(and(...conditions));
```

**Why good:** LOWER() prevents "Germany" vs "germany" mismatches, sql template prevents SQL injection, handling both single/multiple covers all URL patterns

### Good Example - Multiple Filter Types

```typescript
import { and, eq, ne, inArray, sql } from "drizzle-orm";

const SINGLE_VALUE_COUNT = 1;

app.openapi(getJobsRoute, async (c) => {
  const { country, employment_type, seniority_level, visa_sponsorship } = c.req.valid("query");

  const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

  // Country filter: comma-separated with case-insensitive matching
  if (country) {
    const countries = country.split(",").map((c) => c.trim().toLowerCase());
    if (countries.length === SINGLE_VALUE_COUNT) {
      conditions.push(sql`LOWER(${jobs.country}) = ${countries[0]}`);
    } else {
      conditions.push(
        sql`LOWER(${jobs.country}) IN (${sql.join(
          countries.map((c) => sql`${c}`),
          sql`, `,
        )})`,
      );
    }
  }

  // Single enum value filter
  if (employment_type) {
    conditions.push(eq(jobs.employmentType, employment_type as any));
  }

  // Multiple enum values filter
  if (seniority_level) {
    const seniorities = seniority_level.split(",");
    if (seniorities.length === SINGLE_VALUE_COUNT) {
      conditions.push(eq(jobs.seniorityLevel, seniorities[0] as any));
    } else {
      conditions.push(inArray(jobs.seniorityLevel, seniorities as any));
    }
  }

  // Boolean filter (string to boolean logic)
  if (visa_sponsorship === "true") {
    conditions.push(ne(jobs.visaSponsorshipType, "none"));
  }

  const results = await db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .limit(DEFAULT_QUERY_LIMIT);

  return c.json({ jobs: results, total: results.length }, 200);
});
```

**Why good:** inArray() for multiple enums is cleaner than chained OR, ne() for visa check handles null correctly, case-insensitive = better UX

### Bad Example - No multiple value support

```typescript
// BAD Example - No multiple value support
const { country } = c.req.query();

// BAD: Only handles single value
// BAD: Case-sensitive (won't match "Germany" vs "germany")
const results = await db
  .select()
  .from(jobs)
  .where(eq(jobs.country, country))
  .limit(100); // BAD: Magic number
```

**Why bad:** Single-value filter forces multiple API calls, case-sensitive breaks when user types "GERMANY", magic 100 can't be easily changed

---

## Pagination Examples

### Good Example - Offset-Based Pagination

```typescript
import { sql } from "drizzle-orm";

const DEFAULT_LIMIT = 50;
const DEFAULT_OFFSET = 0;
const RADIX_DECIMAL = 10;

export const parsePagination = (limit?: string, offset?: string) => ({
  limit: limit ? parseInt(limit, RADIX_DECIMAL) : DEFAULT_LIMIT,
  offset: offset ? parseInt(offset, RADIX_DECIMAL) : DEFAULT_OFFSET,
});

app.openapi(getJobsRoute, async (c) => {
  const query = c.req.valid("query");
  const { limit, offset } = parsePagination(query.limit, query.offset);

  // Apply filters
  const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

  // Get paginated results
  const results = await db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(jobs.createdAt));

  // Get total count for pagination (with same filters)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(...conditions));

  return c.json(
    {
      jobs: results,
      total: count,
      limit,
      offset,
    },
    200,
  );
});
```

**Why good:** Total count enables "Page X of Y" UI, radix 10 prevents parseInt("08") bugs, same conditions for count = accurate totals

**Pagination response schema:**

```typescript
export const PaginatedJobsResponseSchema = z
  .object({
    jobs: z.array(JobSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  })
  .openapi("PaginatedJobsResponse");
```

### Bad Example - Missing best practices

```typescript
// BAD Example - Missing best practices
const limit = parseInt(c.req.query("limit") || "50"); // BAD: Magic numbers, no radix
const offset = parseInt(c.req.query("offset") || "0"); // BAD: Magic numbers, no radix

const results = await db.select().from(jobs).limit(limit).offset(offset);

// BAD: No total count - can't show "Page X of Y"
return c.json({ jobs: results });
```

**Why bad:** No radix causes parseInt("08")=0 in some engines, missing total = can't build pagination UI, limit/offset not in response = client can't track state

---

## Data Transformation Examples

### Good Example - Reusable Transformation Utilities

**File: `/app/api/utils/helpers.ts`**

```typescript
export const toISOString = (date: Date | string | null): string | null => {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : date;
};

const DEFAULT_CURRENCY = "EUR";

export const transformJobRow = (row: any) => {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    employmentType: row.employmentType,
    // Conditionally include salary only if showSalary is true
    salary:
      row.showSalary && row.salaryMin && row.salaryMax
        ? {
            min: row.salaryMin,
            max: row.salaryMax,
            currency: row.salaryCurrency || DEFAULT_CURRENCY,
          }
        : null,
    // Transform dates to ISO strings
    postedDate: toISOString(row.postedDate),
    createdAt: toISOString(row.createdAt)!,
    // Flatten joined company data into nested object
    company: {
      name: row.companyName,
      logoUrl: row.companyLogoUrl,
    },
  };
};
```

**Why good:** Reusable transform = DRY across routes, null-safe toISOString prevents crashes, conditional salary inclusion respects showSalary flag

**Usage in route:**

```typescript
app.openapi(getJobsRoute, async (c) => {
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      // ... all fields
      showSalary: jobs.showSalary,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      salaryCurrency: jobs.salaryCurrency,
      companyName: companies.name,
      companyLogoUrl: companies.logoUrl,
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id));

  // Transform all rows
  const transformedJobs = rows.map(transformJobRow);

  return c.json({ jobs: transformedJobs, total: transformedJobs.length }, 200);
});
```

### Bad Example - Inline transformations

```typescript
// BAD Example - Inline transformations
app.get("/jobs", async (c) => {
  const rows = await db.select().from(jobs);

  // BAD: Inline transformation makes code hard to read
  // BAD: No reusability
  // BAD: Magic string "EUR"
  const jobs = rows.map((r) => ({
    ...r,
    salary: r.showSalary
      ? {
          min: r.salaryMin,
          max: r.salaryMax,
          currency: r.salaryCurrency || "EUR", // BAD: Magic string
        }
      : null,
    createdAt: r.createdAt.toISOString(), // BAD: Can crash if null
  }));

  return c.json(jobs);
});
```

**Why bad:** Inline transform duplicates across routes, r.createdAt.toISOString() crashes on null, magic "EUR" becomes inconsistent when changed

---

## OpenAPI Spec Generation Examples

### Good Example - Build-Time Spec Generation

**File: `/scripts/generate-openapi.ts`**

```typescript
import { writeFileSync } from "fs";
import { app } from "../app/api/[[...route]]/route";

const OPENAPI_VERSION = "3.1.0";
const API_VERSION = "1.0.0";
const INDENT_SPACES = 2;

const spec = app.getOpenAPI31Document();

if (!spec) {
  console.error("Could not generate OpenAPI spec");
  process.exit(1);
}

const fullSpec = {
  openapi: OPENAPI_VERSION,
  info: {
    version: API_VERSION,
    title: "Jobs API",
    description: "API for managing job postings",
  },
  servers: [
    { url: "http://localhost:3000/api", description: "Local development" },
    { url: "https://api.example.com/api", description: "Production" },
  ],
  ...spec,
};

const outputPath = "./public/openapi.json";
writeFileSync(outputPath, JSON.stringify(fullSpec, null, INDENT_SPACES));
console.log(`OpenAPI spec written to ${outputPath}`);
```

**Why good:** Build-time = spec generated once (fast), env-specific servers = proper URLs in docs, exit(1) fails CI if spec broken

**Package.json:**
```json
{ "scripts": { "prebuild": "bun run scripts/generate-openapi.ts && openapi-ts" } }
```

### Bad Example - Runtime spec generation

```typescript
// BAD Example - Runtime spec generation
app.get("/openapi.json", (c) => {
  // BAD: Generates spec on every request (slow)
  // BAD: No version info, no servers
  return c.json(app.getOpenAPI31Document());
});
```

**Why bad:** Runtime = regenerates on every request (CPU), no version info breaks client caching, can't use hey-api at build time

---

## Authentication Middleware Examples

### Good Example - JWT with Type-Safe Variables

```typescript
import { verify } from "hono/jwt";
import { createMiddleware } from "hono/factory";

const BEARER_PREFIX = "Bearer ";
const BEARER_PREFIX_LENGTH = 7;
const HTTP_STATUS_UNAUTHORIZED = 401;

type AuthVariables = {
  userId: string;
  userRole: "admin" | "user";
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith(BEARER_PREFIX)) {
    return c.json(
      { error: "unauthorized", message: "Missing or invalid Authorization header" },
      HTTP_STATUS_UNAUTHORIZED,
    );
  }

  const token = authHeader.slice(BEARER_PREFIX_LENGTH);

  try {
    const payload = await verify(token, process.env.JWT_SECRET!);

    if (!payload.userId || typeof payload.userId !== "string") {
      throw new Error("Invalid token payload");
    }

    c.set("userId", payload.userId);
    c.set("userRole", (payload.role as "admin" | "user") || "user");
    await next();
  } catch (error) {
    return c.json(
      { error: "unauthorized", message: "Invalid or expired token" },
      HTTP_STATUS_UNAUTHORIZED,
    );
  }
});
```

**Why good:** Type-safe Variables means c.get("userId") is typed, payload validation prevents accepting garbage tokens, default role prevents undefined access

**Usage in route:**

```typescript
const protectedRoute = createRoute({
  method: "get",
  path: "/me",
  middleware: [authMiddleware] as const, // as const for type inference
  operationId: "getCurrentUser",
  tags: ["Auth"],
  responses: {
    200: {
      description: "Current user",
      content: { "application/json": { schema: UserSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

app.openapi(protectedRoute, async (c) => {
  // Type-safe access to userId from middleware
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return c.json(user, 200);
});
```

**Why good:** `as const` enables TypeScript to infer middleware types, 401 in responses shows auth requirement in docs

### Bad Example - Weak auth middleware

```typescript
// BAD Example - Weak auth middleware
const authMiddleware = async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", ""); // BAD: Magic string

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401); // BAD: Magic number
  }

  // BAD: No payload validation
  const payload = await verify(token, process.env.JWT_SECRET!);

  // BAD: No type safety
  c.userId = payload.userId;

  await next();
};
```

**Why bad:** c.userId not typed = any access, no payload validation = trusts malicious tokens, "Unauthorized" gives attackers no info but also no help for debugging

---

## Rate Limiting Examples

### Good Example - Rate Limiting with Headers

```typescript
import { createMiddleware } from "hono/factory";

const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
const RETRY_AFTER_SECONDS = 60;

// Simple in-memory rate limiter (use Redis for production multi-instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const clientId = c.req.header("X-API-Key") || c.req.header("X-Forwarded-For") || "anonymous";
  const now = Date.now();

  let record = rateLimitStore.get(clientId);

  // Reset if window expired
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  record.count++;
  rateLimitStore.set(clientId, record);

  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - record.count);
  const resetTime = Math.ceil((record.resetTime - now) / 1000);

  // Set rate limit headers (industry standard)
  c.header("X-RateLimit-Limit", String(MAX_REQUESTS_PER_WINDOW));
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-Reset", String(resetTime));

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    c.header("Retry-After", String(RETRY_AFTER_SECONDS));
    return c.json(
      {
        error: "rate_limit_exceeded",
        message: `Too many requests. Limit: ${MAX_REQUESTS_PER_WINDOW} per minute`,
        statusCode: HTTP_STATUS_TOO_MANY_REQUESTS,
        retryAfter: RETRY_AFTER_SECONDS,
      },
      HTTP_STATUS_TOO_MANY_REQUESTS,
    );
  }

  await next();
});
```

**Why good:** X-RateLimit-* headers let clients track usage before hitting limit, Retry-After enables proper backoff, API key fallback to IP covers both auth'd and anon

**Usage:**

```typescript
// Apply globally
const app = new OpenAPIHono();
app.use("*", rateLimitMiddleware);

// Or per-route
const getJobsRoute = createRoute({
  method: "get",
  path: "/jobs",
  middleware: [rateLimitMiddleware] as const,
  // ... rest of route config
});
```

### Bad Example - No rate limiting headers

```typescript
// BAD Example - No rate limiting headers or proper response
const rateLimiter = async (c, next) => {
  const count = getRequestCount(c);

  if (count > 100) {
    // BAD: Magic number
    return c.json({ error: "Too many requests" }, 429); // BAD: Magic number, no headers
  }

  await next();
};
```

**Why bad:** No headers = client can't implement proactive backoff, generic message doesn't tell them when to retry, magic 100 can't be tuned per deployment

---

## CORS Configuration Examples

### Good Example - Secure CORS

```typescript
import { cors } from "hono/cors";

const ALLOWED_ORIGINS = [
  "https://app.example.com",
  "https://admin.example.com",
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "",
].filter(Boolean);

const MAX_AGE_SECONDS = 86400; // 24 hours

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return "*";

    // Check against allowlist
    if (ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }

    // Reject unknown origins
    return "";
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  credentials: true,
  maxAge: MAX_AGE_SECONDS,
});

// Apply globally
const app = new OpenAPIHono();
app.use("*", corsMiddleware);
```

**Why good:** Origin allowlist prevents CSRF from random sites, exposeHeaders lets client read rate limit headers, no-origin fallback handles mobile apps/Postman

### Bad Example - Insecure CORS

```typescript
// BAD Example - Insecure CORS configuration
import { cors } from "hono/cors";

app.use(
  "*",
  cors({
    origin: "*", // BAD: Wildcard with credentials is forbidden
    credentials: true, // BAD: Can't use with wildcard
    maxAge: 86400, // BAD: Magic number
  }),
);
```

**Why bad:** `*` + credentials is rejected by browsers (spec violation), magic maxAge can't be tuned, missing exposeHeaders = client can't read rate limit

---

## Health Check Examples

### Good Example - Shallow and Deep Health Checks

```typescript
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { HealthCheckResult } from "@/lib/types";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

const HealthStatusSchema = z
  .object({
    status: z.enum(["healthy", "unhealthy"]),
    timestamp: z.string(),
    uptime: z.number(),
    dependencies: z
      .object({
        database: z.enum(["connected", "disconnected", "degraded"]),
        redis: z.enum(["connected", "disconnected", "degraded"]).optional(),
      })
      .optional(),
  })
  .openapi("HealthStatus");

// Shallow health check (fast, no dependency checks)
const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  tags: ["Health"],
  summary: "Health check",
  description: "Lightweight health check for load balancers",
  responses: {
    200: {
      description: "Service is healthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
  },
});

app.openapi(healthRoute, async (c) => {
  return c.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    HTTP_STATUS_OK,
  );
});

// Deep health check (includes dependency checks)
const healthDeepRoute = createRoute({
  method: "get",
  path: "/health/deep",
  operationId: "getHealthDeep",
  tags: ["Health"],
  summary: "Deep health check",
  description: "Comprehensive health check including dependencies",
  responses: {
    200: {
      description: "Service and dependencies are healthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
    503: {
      description: "Service or dependencies are unhealthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
  },
});

app.openapi(healthDeepRoute, async (c) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
  ]);

  const dbStatus = checks[0].status === "fulfilled" ? checks[0].value.status : "disconnected";
  const redisStatus = checks[1].status === "fulfilled" ? checks[1].value.status : "disconnected";

  const isHealthy = dbStatus === "connected" && redisStatus === "connected";

  return c.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: dbStatus,
        redis: redisStatus,
      },
    },
    isHealthy ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE,
  );
});

// Dependency check helper (with timeout)
const checkDatabase = async (): Promise<{ status: "connected" | "disconnected" | "degraded" }> => {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), HEALTH_CHECK_TIMEOUT_MS),
    );

    await Promise.race([db.execute("SELECT 1"), timeoutPromise]);

    return { status: "connected" };
  } catch (error) {
    console.error("Database health check failed:", error);
    return { status: "disconnected" };
  }
};
```

**Why good:** Shallow /health is fast (liveness for LB), deep /health/deep checks deps (readiness), timeout prevents hanging forever, 503 triggers K8s restart

### Bad Example - Slow health check

```typescript
// BAD Example - Slow health check
app.get("/health", async (c) => {
  // BAD: Checks dependencies on every request (slow for load balancers)
  const db = await checkDatabase();
  const redis = await checkRedis();

  // BAD: Magic number 200
  // BAD: No timeout (can hang indefinitely)
  return c.json({ status: "ok" }, 200);
});
```

**Why bad:** Checking DB on every LB ping = slow + DB load, no timeout = LB request can hang forever, 200 on failure = LB keeps routing to broken instance

---

## Logging Examples

### Good Example - Structured JSON Logging with PII Sanitization

```typescript
import { randomUUID } from "crypto";
import { createMiddleware } from "hono/factory";

const LOG_LEVEL_INFO = "info";
const LOG_LEVEL_WARN = "warn";
const LOG_LEVEL_ERROR = "error";
const SLOW_REQUEST_THRESHOLD_MS = 1000;

// PII patterns to sanitize
const PII_PATTERNS = [
  { regex: /\b[\w.-]+@[\w.-]+\.\w+\b/g, replacement: "[EMAIL]" },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { regex: /\b\d{16}\b/g, replacement: "[CARD]" },
];

const sanitizePII = (data: any): any => {
  if (typeof data === "string") {
    let sanitized = data;
    for (const pattern of PII_PATTERNS) {
      sanitized = sanitized.replace(pattern.regex, pattern.replacement);
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizePII);
  }

  if (typeof data === "object" && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (["password", "token", "apiKey", "secret"].includes(key)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizePII(value);
      }
    }
    return sanitized;
  }

  return data;
};

export const loggingMiddleware = createMiddleware(async (c, next) => {
  const correlationId = c.req.header("X-Correlation-ID") || randomUUID();
  const startTime = Date.now();

  c.set("correlationId", correlationId);

  console.log(
    JSON.stringify({
      level: LOG_LEVEL_INFO,
      type: "request",
      correlationId,
      method: c.req.method,
      path: c.req.path,
      query: sanitizePII(c.req.query()),
      userAgent: c.req.header("User-Agent"),
      ip: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
      timestamp: new Date().toISOString(),
    }),
  );

  await next();

  const duration = Date.now() - startTime;
  const status = c.res.status;

  console.log(
    JSON.stringify({
      level: status >= 500 ? LOG_LEVEL_ERROR : status >= 400 ? LOG_LEVEL_WARN : LOG_LEVEL_INFO,
      type: "response",
      correlationId,
      method: c.req.method,
      path: c.req.path,
      status,
      duration,
      slow: duration > SLOW_REQUEST_THRESHOLD_MS,
      timestamp: new Date().toISOString(),
    }),
  );

  c.header("X-Correlation-ID", correlationId);
});

app.use("*", loggingMiddleware);
```

**Why good:** Correlation IDs trace requests across services, PII sanitization = GDPR compliance, structured JSON = searchable in log aggregators, duration tracking finds slow endpoints

### Bad Example - No structure or sanitization

```typescript
// BAD Example - No structure or sanitization
app.use("*", async (c, next) => {
  // BAD: Logs PII without sanitization
  // BAD: No correlation ID
  // BAD: No structured format
  console.log(`${c.req.method} ${c.req.path}`, c.req.query());

  await next();

  // BAD: No duration tracking
  console.log(`Response: ${c.res.status}`);
});
```

**Why bad:** Logging PII = GDPR violation, no correlation = can't trace user's request across microservices, unstructured = grep only (not searchable in Datadog/Splunk)

---

## Caching Examples

### Good Example - Cache-Control Headers

```typescript
import { createMiddleware } from "hono/factory";

const CACHE_MAX_AGE_SECONDS = 3600;
const CACHE_STALE_WHILE_REVALIDATE_SECONDS = 86400;

export const cacheMiddleware = createMiddleware(async (c, next) => {
  await next();

  // Only cache successful GET requests
  if (c.req.method === "GET" && c.res.status === 200) {
    // Public resources (job listings, company profiles)
    if (c.req.path.startsWith("/api/jobs") || c.req.path.startsWith("/api/companies")) {
      c.header(
        "Cache-Control",
        `public, max-age=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE_SECONDS}`,
      );
    }

    // Private resources (user data)
    if (c.req.path.startsWith("/api/me")) {
      c.header("Cache-Control", "private, max-age=0, must-revalidate");
    }
  }

  // Never cache errors
  if (c.res.status >= 400) {
    c.header("Cache-Control", "no-store");
  }
});
```

**Why good:** stale-while-revalidate serves cached while fetching new (fast UX), public/private prevents caching user data, no caching errors prevents stale failures

### Good Example - ETags

```typescript
import { createHash } from "crypto";

const HTTP_STATUS_NOT_MODIFIED = 304;

app.openapi(getJobsRoute, async (c) => {
  const jobs = await fetchJobs();
  const jobsJson = JSON.stringify(jobs);

  // Generate ETag from response content
  const etag = createHash("md5").update(jobsJson).digest("hex");

  // Check If-None-Match header
  const clientEtag = c.req.header("If-None-Match");

  if (clientEtag === etag) {
    return c.body(null, HTTP_STATUS_NOT_MODIFIED);
  }

  c.header("ETag", etag);
  return c.json(jobs, 200);
});
```

**Why good:** 304 sends no body = massive bandwidth savings, ETag comparison is cheap (hash compare), client caches intelligently
