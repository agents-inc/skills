# Hono + OpenAPI - Core Examples

> Essential patterns for Hono with OpenAPI. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [validation.md](validation.md) - Zod schema definitions and OpenAPI integration
- [routes.md](routes.md) - Filtering, pagination, and data transformation
- [middleware.md](middleware.md) - Auth, rate limiting, CORS, logging, caching
- [error-handling.md](error-handling.md) - Standardized error responses
- [openapi.md](openapi.md) - OpenAPI spec generation
- [health-checks.md](health-checks.md) - Health check endpoints
- [advanced-v4.md](advanced-v4.md) - RPC client, Context Storage, Combine Middleware (v4.x)

---

## Pattern 1: Modular Route Setup

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

## Pattern 2: List Endpoint

### Good Example - List Endpoint with OpenAPI

**File: `/app/api/routes/jobs.ts`**

```typescript
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq, desc, isNull } from "drizzle-orm";

import { db, jobs, companies } from "@/lib/db";
import {
  JobsQuerySchema,
  JobsResponseSchema,
  ErrorResponseSchema,
} from "../schemas";

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

---

## Pattern 3: Detail Endpoint

### Good Example - Detail Endpoint with Path Params

```typescript
const getJobByIdRoute = createRoute({
  method: "get",
  path: "/jobs/{id}",
  operationId: "getJobById",
  tags: ["Jobs"],
  summary: "Get job by ID",
  request: {
    params: z.object({
      id: z
        .string()
        .uuid()
        .openapi({
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
      where: and(
        eq(jobs.id, id),
        eq(jobs.isActive, true),
        isNull(jobs.deletedAt),
      ),
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
      return c.json(
        { error: "Job not found", message: `Job with ID ${id} does not exist` },
        404,
      );
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
  const results = await db
    .select()
    .from(jobs)
    .where(eq(jobs.country, country))
    .limit(100);

  // BAD: No error handling
  return c.json({ jobs: results });
});

export default app; // BAD: Default export
```

**Why bad:** No createRoute = no OpenAPI docs, no validation = crashes on bad input, missing soft delete returns deleted records to users, no error handling = 500s with no context

---
