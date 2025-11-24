# API Development & Database Documentation

> **Quick Guide:** Use Hono with @hono/zod-openapi for type-safe REST APIs that auto-generate OpenAPI specs, Drizzle ORM for type-safe database queries, and Neon serverless Postgres for edge-compatible database connections. This stack provides end-to-end type safety from database → API → generated client.

---

## Philosophy

This stack prioritizes **type safety**, **developer experience**, and **serverless compatibility**:

- **Hono + @hono/zod-openapi**: Define schemas once, get validation AND documentation
- **Drizzle ORM**: SQL-like queries with TypeScript safety, no runtime overhead
- **Neon Serverless**: PostgreSQL over HTTP/WebSocket for edge compatibility
- **hey-api**: Generate type-safe clients from OpenAPI specs automatically

**When to use this stack:**

- Building Next.js applications with API routes
- Need OpenAPI documentation without manual maintenance
- Require edge runtime compatibility (Vercel Edge, Cloudflare Workers)
- Want end-to-end type safety from DB to frontend
- Building APIs consumed by multiple clients

**When NOT to use:**

- Simple CRUD apps (use Next.js server actions directly)
- Internal-only APIs with no documentation needs
- Apps that need traditional TCP database connections only
- Non-TypeScript projects

---

## Core Patterns

### Pattern 1: API Route Setup (Hono + OpenAPI)

Structure API routes in `/app/api/` using the catch-all route pattern:

**File: `/app/api/[[...route]]/route.ts`**

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import { handle } from "hono/vercel";
import jobsRoutes from "../routes/jobs";
import companiesRoutes from "../routes/companies";

// Create main app with base path
const app = new OpenAPIHono().basePath("/api");

// Mount route modules
app.route("/", jobsRoutes);
app.route("/", companiesRoutes);

// Export for OpenAPI spec generation
export { app };

// Export handlers for Next.js
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
```

**When to use:**
- All Next.js API routes using Hono
- Need single entry point for multiple resource routes
- Want OpenAPI documentation

**When NOT to use:**
- Simple single-endpoint APIs (use standalone Next.js route handlers)
- Non-Hono APIs

---

### Pattern 2: Zod Schema Definition with OpenAPI

Define schemas that serve both validation AND OpenAPI documentation:

**File: `/app/api/schemas.ts`**

```typescript
import { z } from 'zod';
import { extendZodWithOpenApi } from '@hono/zod-openapi';

// REQUIRED: Extend Zod with OpenAPI methods
extendZodWithOpenApi(z);

// Define schemas with .openapi() for documentation
export const JobSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    employmentType: z.string().nullable(),
    salary: z.object({
      min: z.number(),
      max: z.number(),
      currency: z.string(),
    }).nullable(),
  })
  .openapi('Job'); // Names the schema in OpenAPI spec

export const JobsQuerySchema = z
  .object({
    country: z.string().optional(),
    employment_type: z.string().optional(),
    seniority_level: z.string().optional(),
  })
  .openapi('JobsQuery');

export const JobsResponseSchema = z
  .object({
    jobs: z.array(JobSchema),
    total: z.number(),
  })
  .openapi('JobsResponse');

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
  })
  .openapi('ErrorResponse');

// Export types for use in code
export type Job = z.infer<typeof JobSchema>;
export type JobsQuery = z.infer<typeof JobsQuerySchema>;
export type JobsResponse = z.infer<typeof JobsResponseSchema>;
```

**When to use:**
- All API request/response types
- Need OpenAPI documentation
- Want runtime validation

**When NOT to use:**
- Internal types not exposed via API
- Database-only models (use Drizzle schema instead)

---

### Pattern 3: Route Definition with createRoute

Define routes with full OpenAPI metadata:

**File: `/app/api/routes/jobs.ts`**

```typescript
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db, jobs } from "@/lib/db";
import { JobsQuerySchema, JobsResponseSchema, ErrorResponseSchema } from "../schemas";

const app = new OpenAPIHono();

// Define route configuration separately
const getJobsRoute = createRoute({
  method: "get",
  path: "/jobs",
  operationId: "getJobs", // Used for generated client method names
  tags: ["Jobs"], // Groups endpoints in documentation
  summary: "Get all jobs",
  description: "Retrieve a list of active job postings with optional filters",
  request: {
    query: JobsQuerySchema,
  },
  responses: {
    200: {
      description: "List of jobs",
      content: {
        "application/json": {
          schema: JobsResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// Implement route handler
app.openapi(getJobsRoute, async (c) => {
  try {
    const query = c.req.valid("query"); // Type-safe validated query params

    // Database query logic here
    const results = await db.query.jobs.findMany();

    return c.json({ jobs: results, total: results.length }, 200);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return c.json(
      {
        error: "Failed to fetch jobs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

export default app;
```

**When to use:**
- All Hono API routes
- Need automatic validation
- Want OpenAPI documentation

**When NOT to use:**
- Internal server-only functions
- Routes without validation needs

---

### Pattern 4: Database Connection (Neon Serverless)

Configure Drizzle with Neon for serverless/edge compatibility:

**File: `/lib/db.ts`**

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Use neon() for HTTP-based queries (edge-compatible)
export const sql = neon(process.env.DATABASE_URL);

// Initialize Drizzle with schema and snake_case mapping
export const db = drizzle(sql, {
  schema,
  casing: 'snake_case' // Maps camelCase JS to snake_case SQL
});

// Export tables for direct query access
export const {
  jobs,
  companies,
  companyLocations,
  skills,
  jobSkills
} = schema;
```

**When to use:**
- All serverless environments (Vercel, Cloudflare Workers)
- Edge runtime compatibility required
- Next.js API routes and server components

**When NOT to use:**
- Long-running Node.js servers (use `Pool` instead for connection pooling)
- Need WebSocket connections (use `neonConfig.webSocketConstructor`)

**Configuration: `/drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle', // Migration files output
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

### Pattern 5: Drizzle Schema Definition

Define tables with TypeScript types using Drizzle's schema builder:

**File: `/lib/db/schema.ts`**

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time',
  'part_time',
  'contract',
  'internship',
]);

// ============================================================================
// TABLES
// ============================================================================

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique(),
  description: text('description'),
  logoUrl: text('logo_url'),
  websiteUrl: text('website_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  employmentType: employmentTypeEnum('employment_type'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const companiesRelations = relations(companies, ({ many }) => ({
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
}));
```

**Key principles:**
- Use `uuid().defaultRandom()` for primary keys
- Add `.notNull()` for required fields
- Use enums for constrained values
- Define relations separately from tables
- Include `deletedAt` for soft deletes
- Use `onDelete: 'cascade'` for cleanup

**When to use:**
- Defining all database tables
- Need type-safe queries
- Want automatic TypeScript types

**When NOT to use:**
- Raw SQL queries (use `sql` template tag instead)

---

### Pattern 6: Relational Queries with .with()

Fetch related data efficiently using Drizzle's relational query API:

```typescript
// Fetch job with all relations in ONE SQL query
const job = await db.query.jobs.findFirst({
  where: eq(jobs.id, jobId),
  with: {
    company: {
      with: {
        locations: {
          orderBy: [desc(companyLocations.isHeadquarters)],
        },
        photos: {
          orderBy: [asc(companyPhotos.displayOrder)],
        },
      },
    },
    jobSkills: {
      with: {
        skill: true,
      },
    },
  },
});
```

**Key benefits:**
- Single SQL query (no N+1 problem)
- Type-safe results matching your relations
- Automatic JOIN generation
- Nested ordering

**When to use:**
- Need related data across tables
- Want to avoid N+1 queries
- Prefer type-safe queries over raw SQL

**When NOT to use:**
- Simple queries without relations (use `db.select()`)
- Need custom JOINs with complex conditions (use query builder)

---

### Pattern 7: Query Builder for Complex Queries

Use the query builder for custom queries with conditions:

```typescript
import { and, eq, desc, isNull, sql } from "drizzle-orm";

const results = await db
  .select({
    id: jobs.id,
    title: jobs.title,
    companyName: companies.name,
    companyLogo: companies.logoUrl,
  })
  .from(jobs)
  .leftJoin(companies, eq(jobs.companyId, companies.id))
  .where(
    and(
      eq(jobs.isActive, true),
      isNull(jobs.deletedAt),
      sql`LOWER(${jobs.country}) = ${country.toLowerCase()}`
    )
  )
  .orderBy(desc(jobs.createdAt))
  .limit(100);
```

**When to use:**
- Custom column selection
- Complex WHERE conditions
- Multiple filters
- Manual JOINs with specific conditions

**When NOT to use:**
- Simple relation fetching (use `db.query` with `.with()`)
- No filtering needed (relational queries are cleaner)

---

### Pattern 8: Transactions

Use transactions for operations that must succeed or fail together:

```typescript
await db.transaction(async (tx) => {
  // Insert parent
  const [company] = await tx
    .insert(companies)
    .values({ name: 'Acme Corp' })
    .returning({ id: companies.id });

  // Insert children
  await tx.insert(jobs).values([
    { companyId: company.id, title: 'Engineer' },
    { companyId: company.id, title: 'Designer' },
  ]);
});
```

**Key principles:**
- Use `tx` parameter, not `db`, inside transaction
- All queries succeed or all fail (atomicity)
- Use `.returning()` to get inserted IDs
- Transactions lock rows—keep them short

**When to use:**
- Creating related records together
- Updating multiple tables that must stay consistent
- Financial operations or critical data changes

**When NOT to use:**
- Read-only queries (no benefit)
- Long-running operations (blocks other queries)
- Independent operations (split into separate queries)

---

### Pattern 9: Filtering with Multiple Values

Handle comma-separated filters for OR conditions:

```typescript
// Query: ?country=germany,france,spain
const { country } = c.req.valid("query");

const conditions = [eq(jobs.isActive, true)];

if (country) {
  const countries = country.split(',').map(c => c.trim().toLowerCase());

  if (countries.length === 1) {
    // Single value: direct equality
    conditions.push(sql`LOWER(${jobs.country}) = ${countries[0]}`);
  } else {
    // Multiple values: IN clause
    conditions.push(
      sql`LOWER(${jobs.country}) IN (${sql.join(
        countries.map(c => sql`${c}`),
        sql`, `
      )})`
    );
  }
}

const results = await db
  .select()
  .from(jobs)
  .where(and(...conditions));
```

**When to use:**
- Filter by multiple values for same field
- User-facing filters (country, skills, categories)
- OR conditions on single column

**When NOT to use:**
- Enums with Drizzle's `inArray()` (cleaner)
- Complex multi-field OR logic (refactor query)

---

### Pattern 10: Pagination

Implement offset-based pagination:

```typescript
// Query: ?limit=50&offset=100
export const parsePagination = (limit?: string, offset?: string) => ({
  limit: parseInt(limit || '50', 10),
  offset: parseInt(offset || '0', 10),
});

const { limit, offset } = parsePagination(
  c.req.valid("query").limit,
  c.req.valid("query").offset
);

const results = await db
  .select()
  .from(jobs)
  .limit(limit)
  .offset(offset);

// Get total count for pagination
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(jobs)
  .where(conditions);

return c.json({ jobs: results, total: count }, 200);
```

**When to use:**
- List endpoints with many results
- Need total count for UI pagination
- Simple pagination needs

**When NOT to use:**
- Real-time feeds (use cursor-based pagination)
- Large datasets (offset is slow—use keyset pagination)

---

### Pattern 11: Data Transformation Utilities

Transform database results to match API schemas:

**File: `/app/api/utils/helpers.ts`**

```typescript
export const toISOString = (date: Date | string | null): string | null => {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : date;
};

export const transformJobRow = (row: any) => {
  return {
    ...row,
    salary: row.showSalary && row.salaryMin && row.salaryMax
      ? {
          min: row.salaryMin,
          max: row.salaryMax,
          currency: row.salaryCurrency || 'EUR',
        }
      : null,
    postedDate: toISOString(row.postedDate),
    createdAt: toISOString(row.createdAt)!,
    company: {
      name: row.companyName,
      logoUrl: row.companyLogoUrl,
    },
  };
};
```

**When to use:**
- Database column names differ from API schema
- Need computed fields (conditional salary display)
- Date formatting (Date → ISO string)
- Nested object transformation

**When NOT to use:**
- Direct 1:1 mapping (return DB results directly)
- Complex business logic (move to service layer)

---

### Pattern 12: OpenAPI Spec Generation

Generate OpenAPI spec from Hono app:

**File: `/scripts/generate-openapi.ts`**

```typescript
import { writeFileSync } from 'fs';
import { app } from '../app/api/[[...route]]/route';

// Extract OpenAPI spec from Hono app
const spec = app.getOpenAPI31Document();

const fullSpec = {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'Jobs API',
    description: 'API for managing job postings',
  },
  ...spec,
};

writeFileSync('./public/openapi.json', JSON.stringify(fullSpec, null, 2));
console.log('✅ OpenAPI spec written to ./public/openapi.json');
```

**Package.json scripts:**

```json
{
  "scripts": {
    "openapi:generate": "bun run scripts/generate-openapi.ts",
    "api:generate": "bun run openapi:generate && openapi-ts",
    "prebuild": "bun run api:generate"
  }
}
```

**When to use:**
- Before building for production
- After changing API schemas or routes
- When client code needs regenerating

**When NOT to use:**
- In runtime/production (generate at build time)

---

### Pattern 13: Client Generation with hey-api

Generate type-safe clients from OpenAPI spec:

**File: `/openapi-ts.config.ts`**

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: './public/openapi.json',
  output: {
    path: './lib/api-client',
    format: 'prettier',
  },
  plugins: [
    '@hey-api/typescript',      // TypeScript types
    '@hey-api/schemas',          // Zod schemas
    {
      name: '@hey-api/sdk',
      asClass: true,             // Generate class-based SDK
    },
    '@tanstack/react-query',     // React Query hooks
  ],
  services: {
    asClass: true,
  },
});
```

**Usage in frontend:**

```typescript
import { client } from '@/lib/api-client';
import { useGetJobsQuery } from '@/lib/api-client/@tanstack/react-query';

// Configure client once
client.setConfig({
  baseUrl: '/api',
});

// Use generated React Query hooks
function JobsList() {
  const { data, isLoading } = useGetJobsQuery({
    query: { country: 'germany' }
  });

  if (isLoading) return <div>Loading...</div>;
  return <div>{data.jobs.length} jobs found</div>;
}
```

**When to use:**
- All frontend API consumption
- Need React Query integration
- Want end-to-end type safety

**When NOT to use:**
- Server-side API calls (use Hono RPC instead)
- Non-TypeScript frontends

---

## Decision Framework

### When to use Relational Query API vs Query Builder?

**Use `db.query` (Relational API) when:**
- ✅ Fetching related data defined in schema relations
- ✅ Want simple, readable queries
- ✅ Need nested relations with `.with()`
- ✅ Don't need custom column selection

**Use Query Builder when:**
- ✅ Need custom column selection
- ✅ Complex WHERE conditions
- ✅ JOINs not defined in relations
- ✅ Aggregations (COUNT, SUM, etc.)

### When to use Transactions?

**Use transactions when:**
- ✅ Creating parent + child records together
- ✅ Updating related tables that must stay consistent
- ✅ Operations must be atomic (all or nothing)

**Don't use transactions when:**
- ❌ Read-only queries
- ❌ Independent operations
- ❌ Long-running operations

### Neon HTTP vs WebSocket?

**Use HTTP (`neon()`) when:**
- ✅ Short-lived serverless functions
- ✅ Edge runtime (Vercel Edge, Cloudflare Workers)
- ✅ Simple queries

**Use WebSocket when:**
- ✅ Need persistent connections
- ✅ Long-running queries
- ✅ Streaming results
- ❌ NOT available in all edge environments

---

## Integration Guide

### With Next.js API Routes

Place all API routes under `/app/api/[[...route]]/` using catch-all routing. Hono handles sub-routes internally.

### With React Query

Use generated hooks from hey-api:
```typescript
import { useGetJobsQuery } from '@/lib/api-client/@tanstack/react-query';
```

### With Environment Variables

Required variables:
```env
DATABASE_URL=postgresql://user:pass@host/db
```

### With Migrations

Generate and apply migrations:
```bash
# Generate migration
bun run drizzle-kit generate

# Apply migration
bun run drizzle-kit migrate
```

---

## RED FLAGS

**High Priority Issues:**

- ❌ **Using `db` instead of `tx` inside transactions** – Bypasses transaction, breaking atomicity
- ❌ **Not using `.openapi()` on Zod schemas** – OpenAPI spec won't include schema metadata
- ❌ **Forgetting `extendZodWithOpenApi(z)`** – Breaks schema registration
- ❌ **Using `Pool` with edge runtime** – Not compatible with serverless environments
- ❌ **Not handling validation errors** – Hono returns 422, but you must return proper error shapes
- ❌ **Mutating generated client code** – Gets overwritten on next generation
- ❌ **Long transactions** – Locks rows, blocks other queries
- ❌ **N+1 queries with relations** – Use `.with()` to fetch in single query
- ❌ **Not setting `casing: 'snake_case'`** – Causes field name mismatches

**Medium Priority Issues:**

- ⚠️ **Not exporting `app` instance** – Can't generate OpenAPI spec
- ⚠️ **Missing `operationId` in routes** – Generated client has ugly method names
- ⚠️ **Using `.openapi()` in production** – Generate spec at build time
- ⚠️ **Not versioning OpenAPI spec** – Breaking changes without notice
- ⚠️ **Queries without soft delete checks** – Returns deleted records
- ⚠️ **No pagination limits** – Can return massive datasets
- ⚠️ **Not using prepared statements** – Slower performance for repeated queries
- ⚠️ **Mixing relational queries and query builder** – Inconsistent patterns

**Common Mistakes:**

- 🔸 **Forgetting `.returning()` after inserts** – Can't access inserted IDs
- 🔸 **Not handling `null` in queries** – Causes type errors
- 🔸 **Using `parseInt()` without fallback** – Returns NaN on invalid input
- 🔸 **Not configuring client base URL** – API calls fail in production
- 🔸 **Regenerating client without updating imports** – Breaks after renames
- 🔸 **Not using `c.req.valid()` for params** – Bypasses validation
- 🔸 **Transforming data in queries** – Do it in transformation utilities
- 🔸 **Not cleaning up database connections** – Memory leaks in serverless
