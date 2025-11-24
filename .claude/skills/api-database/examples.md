# API Development & Database - Examples

---

## Pattern 1: Complete API Route with OpenAPI

### ✅ Good Example

```typescript
// File: app/api/routes/jobs.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db, jobs, companies } from "@/lib/db";
import { and, eq, desc, isNull } from "drizzle-orm";
import {
  JobsQuerySchema,
  JobsResponseSchema,
  JobDetailSchema,
  ErrorResponseSchema,
} from "../schemas";

const app = new OpenAPIHono();

// ============================================================================
// LIST ENDPOINT
// ============================================================================

const getJobsRoute = createRoute({
  method: "get",
  path: "/jobs",
  operationId: "getJobs", // Clean method name in generated client
  tags: ["Jobs"], // Groups in documentation
  summary: "Get all jobs",
  description: "Retrieve active job postings with filters",
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

app.openapi(getJobsRoute, async (c) => {
  try {
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
      .limit(100);

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

// ============================================================================
// DETAIL ENDPOINT
// ============================================================================

const getJobByIdRoute = createRoute({
  method: "get",
  path: "/jobs/{id}",
  operationId: "getJobById",
  tags: ["Jobs"],
  summary: "Get job by ID",
  description: "Retrieve single job with full details",
  request: {
    params: z.object({
      id: z.string().uuid(), // Validate UUID format
    }),
  },
  responses: {
    200: {
      description: "Job details",
      content: {
        "application/json": {
          schema: JobDetailSchema,
        },
      },
    },
    404: {
      description: "Job not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
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

app.openapi(getJobByIdRoute, async (c) => {
  try {
    const { id } = c.req.valid("param");

    // Use relational query to fetch all relations in ONE query
    const job = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.id, id),
        eq(jobs.isActive, true),
        isNull(jobs.deletedAt)
      ),
      with: {
        company: {
          with: {
            locations: true,
            photos: true,
          },
        },
        jobSkills: {
          with: {
            skill: true,
          },
        },
      },
    });

    if (!job) {
      return c.json(
        {
          error: "Job not found",
          message: `Job with ID ${id} does not exist`,
        },
        404
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
      500
    );
  }
});

export default app;
```

**Why this is good:**

- ✅ Clear route configuration with full OpenAPI metadata
- ✅ Proper validation with Zod schemas
- ✅ Type-safe query parameters using `c.req.valid()`
- ✅ Consistent error handling with typed error responses
- ✅ Soft delete checks with `isNull(deletedAt)`
- ✅ Relational query for detail endpoint (avoids N+1)
- ✅ HTTP status codes match OpenAPI spec
- ✅ Clean `operationId` for generated client methods

---

### ❌ Bad Example

```typescript
// DON'T DO THIS
const app = new OpenAPIHono();

app.get("/jobs", async (c) => {
  // ❌ No OpenAPI route definition
  // ❌ No validation
  const country = c.req.query("country"); // ❌ Not validated

  // ❌ No soft delete check
  // ❌ No conditions array pattern
  const results = await db
    .select()
    .from(jobs)
    .where(country ? eq(jobs.country, country) : undefined); // ❌ Breaks type safety

  // ❌ No error handling
  return c.json(results); // ❌ No status code, no shape
});

app.get("/jobs/:id", async (c) => {
  const id = c.req.param("id"); // ❌ Not validated

  // ❌ N+1 query problem
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, id),
  });

  // Separate queries for relations
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, job.companyId),
  });

  const skills = await db.query.jobSkills.findMany({
    where: eq(jobSkills.jobId, job.id),
  });

  return c.json({ ...job, company, skills }); // ❌ No 404 handling
});
```

**Why this is bad:**

- ❌ No OpenAPI documentation generated
- ❌ No validation—accepts any input
- ❌ N+1 query problem (multiple database roundtrips)
- ❌ No error handling or status codes
- ❌ Missing soft delete checks
- ❌ Type safety bypassed with `undefined` checks

---

## Pattern 2: Zod Schemas with OpenAPI Metadata

### ✅ Good Example

```typescript
// File: app/api/schemas.ts
import { z } from 'zod';
import { extendZodWithOpenApi } from '@hono/zod-openapi';

// CRITICAL: Must call this first
extendZodWithOpenApi(z);

// ============================================================================
// REUSABLE SUB-SCHEMAS
// ============================================================================

export const SalarySchema = z
  .object({
    min: z.number().min(0),
    max: z.number().min(0),
    currency: z.string().length(3),
  })
  .openapi('Salary', {
    example: {
      min: 60000,
      max: 90000,
      currency: 'EUR',
    },
  });

export const CompanySchema = z
  .object({
    name: z.string().nullable(),
    logoUrl: z.string().url().nullable(),
  })
  .openapi('Company');

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const JobsQuerySchema = z
  .object({
    country: z
      .string()
      .optional()
      .openapi({
        param: {
          name: 'country',
          in: 'query',
        },
        example: 'germany',
      }),
    employment_type: z
      .enum(['full_time', 'part_time', 'contract', 'internship'])
      .optional()
      .openapi({
        param: {
          name: 'employment_type',
          in: 'query',
        },
        example: 'full_time',
      }),
    limit: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .openapi({
        param: {
          name: 'limit',
          in: 'query',
        },
        example: '50',
      }),
  })
  .openapi('JobsQuery');

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const JobSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(255),
    description: z.string(),
    employmentType: z.string().nullable(),
    salary: SalarySchema.nullable(),
    company: CompanySchema,
  })
  .openapi('Job', {
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Senior React Developer',
      description: 'Build awesome things',
      employmentType: 'full_time',
      salary: {
        min: 70000,
        max: 95000,
        currency: 'EUR',
      },
      company: {
        name: 'Acme Corp',
        logoUrl: 'https://example.com/logo.png',
      },
    },
  });

export const JobsResponseSchema = z
  .object({
    jobs: z.array(JobSchema),
    total: z.number().int().min(0),
  })
  .openapi('JobsResponse');

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
  })
  .openapi('ErrorResponse', {
    example: {
      error: 'Failed to fetch jobs',
      message: 'Database connection timeout',
    },
  });

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Salary = z.infer<typeof SalarySchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Job = z.infer<typeof JobSchema>;
export type JobsQuery = z.infer<typeof JobsQuerySchema>;
export type JobsResponse = z.infer<typeof JobsResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

**Why this is good:**

- ✅ `extendZodWithOpenApi(z)` called before any schemas
- ✅ Reusable sub-schemas prevent duplication
- ✅ `.openapi()` with examples for documentation
- ✅ Query params have metadata (name, in, example)
- ✅ Validation rules (min, max, length, regex)
- ✅ Type exports for use in code
- ✅ Organized by category (request, response, error)

---

### ❌ Bad Example

```typescript
// DON'T DO THIS
import { z } from 'zod';
// ❌ Forgot to call extendZodWithOpenApi

export const JobSchema = z.object({
  // ❌ No .openapi() call
  id: z.string(), // ❌ No UUID validation
  title: z.string(), // ❌ No length constraints
  salary: z.any(), // ❌ Using any instead of proper schema
  company: z.object({
    // ❌ Inline schema instead of reusable
    name: z.string().nullable(),
    logoUrl: z.string().nullable(), // ❌ No URL validation
  }),
});

// ❌ No type export
```

**Why this is bad:**

- ❌ Missing `extendZodWithOpenApi` breaks registration
- ❌ No `.openapi()` = no schema metadata in spec
- ❌ Weak validation (no constraints)
- ❌ Inline schemas cause duplication
- ❌ No type exports for TypeScript use

---

## Pattern 3: Drizzle Schema with Relations

### ✅ Good Example

```typescript
// File: lib/db/schema.ts
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
  'freelance',
]);

export const seniorityLevelEnum = pgEnum('seniority_level', [
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
]);

// ============================================================================
// TABLES
// ============================================================================

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Basic Info
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique(),
  description: text('description'),
  // Visual
  logoUrl: text('logo_url'),
  websiteUrl: text('website_url'),
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
});

export const companyLocations = pgTable('company_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }),
  country: varchar('country', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }),
  isHeadquarters: boolean('is_headquarters').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  // Basic Info
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  externalUrl: text('external_url').notNull(),
  // Job Details
  employmentType: employmentTypeEnum('employment_type'),
  seniorityLevel: seniorityLevelEnum('seniority_level'),
  // Compensation
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  salaryCurrency: varchar('salary_currency', { length: 3 }).default('EUR'),
  showSalary: boolean('show_salary').default(false),
  // Status
  isActive: boolean('is_active').default(true),
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).unique(),
  popularityScore: integer('popularity_score').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Junction table for many-to-many
export const jobSkills = pgTable('job_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .references(() => jobs.id, { onDelete: 'cascade' })
    .notNull(),
  skillId: uuid('skill_id')
    .references(() => skills.id, { onDelete: 'cascade' })
    .notNull(),
  isRequired: boolean('is_required').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// RELATIONS (defined separately from tables)
// ============================================================================

export const companiesRelations = relations(companies, ({ many }) => ({
  jobs: many(jobs),
  locations: many(companyLocations),
}));

export const companyLocationsRelations = relations(companyLocations, ({ one }) => ({
  company: one(companies, {
    fields: [companyLocations.companyId],
    references: [companies.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  jobSkills: many(jobSkills),
}));

export const jobSkillsRelations = relations(jobSkills, ({ one }) => ({
  job: one(jobs, {
    fields: [jobSkills.jobId],
    references: [jobs.id],
  }),
  skill: one(skills, {
    fields: [jobSkills.skillId],
    references: [skills.id],
  }),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  jobSkills: many(jobSkills),
}));
```

**Why this is good:**

- ✅ Enums defined with `pgEnum` for type safety
- ✅ UUIDs with `defaultRandom()` for primary keys
- ✅ Foreign keys with `onDelete: 'cascade'` for cleanup
- ✅ Soft deletes with `deletedAt` timestamp
- ✅ Timestamps with `defaultNow()` for auditing
- ✅ Relations defined separately using `relations()`
- ✅ Many-to-many through junction table
- ✅ `.notNull()` for required fields
- ✅ Organized by section with comments

---

### ❌ Bad Example

```typescript
// DON'T DO THIS
import { pgTable, varchar, text, integer } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: integer('id').primaryKey(), // ❌ Using auto-increment instead of UUID
  name: varchar('name'), // ❌ No length, no .notNull()
  logo: text('logo'), // ❌ No URL validation
  // ❌ No timestamps
  // ❌ No soft delete
});

export const jobs = pgTable('jobs', {
  id: integer('id').primaryKey(),
  company_id: integer('company_id'), // ❌ No foreign key reference
  title: text('title'), // ❌ Text instead of varchar
  type: varchar('type'), // ❌ String instead of enum
  // ❌ No default values
  // ❌ No soft delete
});

// ❌ No relations defined
```

**Why this is bad:**

- ❌ Integer IDs instead of UUIDs (less secure, predictable)
- ❌ No foreign key constraints (orphaned records possible)
- ❌ No timestamps (can't track creation/updates)
- ❌ No soft deletes (data loss risk)
- ❌ No enums (allows invalid values)
- ❌ Missing `.notNull()` (nullable when shouldn't be)
- ❌ No relations (can't use relational queries)

---

## Pattern 4: Database Connection for Serverless

### ✅ Good Example

```typescript
// File: lib/db.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Use neon() for HTTP-based connection (edge-compatible)
export const sql = neon(process.env.DATABASE_URL);

// Initialize Drizzle with schema and casing
export const db = drizzle(sql, {
  schema,
  casing: 'snake_case', // Maps camelCase JS to snake_case SQL
});

// Export individual tables for queries
export const {
  jobs,
  companies,
  companyLocations,
  skills,
  jobSkills,
} = schema;
```

**Drizzle configuration:**

```typescript
// File: drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Why this is good:**

- ✅ Uses `neon()` HTTP driver for edge compatibility
- ✅ Validates `DATABASE_URL` exists
- ✅ Configures `casing: 'snake_case'` for SQL naming
- ✅ Exports `db` instance for queries
- ✅ Exports individual tables for convenience
- ✅ Schema imported as namespace for type safety

---

### ❌ Bad Example

```typescript
// DON'T DO THIS
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './db/schema';

// ❌ Using Pool in serverless (connection not reused)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ❌ No validation
});

// ❌ No casing configuration
export const db = drizzle(pool);

// ❌ Not exporting schema tables
```

**Why this is bad:**

- ❌ `Pool` creates persistent connections (not for edge runtime)
- ❌ No validation of `DATABASE_URL`
- ❌ Missing `casing: 'snake_case'` causes field mismatches
- ❌ Schema not passed to drizzle (no relational queries)
- ❌ Tables not exported (must import from schema)

---

## Pattern 5: Relational Queries

### ✅ Good Example

```typescript
// Fetch job with ALL relations in ONE SQL query
const job = await db.query.jobs.findFirst({
  where: and(
    eq(jobs.id, jobId),
    eq(jobs.isActive, true),
    isNull(jobs.deletedAt)
  ),
  with: {
    company: {
      with: {
        locations: {
          orderBy: [desc(companyLocations.isHeadquarters), asc(companyLocations.name)],
        },
        photos: {
          orderBy: [asc(companyPhotos.displayOrder)],
        },
      },
    },
    jobSkills: {
      where: eq(jobSkills.isRequired, true),
      with: {
        skill: true,
      },
    },
  },
});

// Result is fully typed and nested
if (job) {
  console.log(job.title); // string
  console.log(job.company.name); // string
  console.log(job.company.locations); // CompanyLocation[]
  console.log(job.jobSkills[0].skill.name); // string
}
```

**Why this is good:**

- ✅ Single SQL query (no N+1 problem)
- ✅ Nested `.with()` for deep relations
- ✅ Ordering nested results
- ✅ Filtering nested relations
- ✅ Fully typed results
- ✅ Soft delete check with `isNull(deletedAt)`

---

### ❌ Bad Example

```typescript
// DON'T DO THIS - N+1 Query Problem
const job = await db.query.jobs.findFirst({
  where: eq(jobs.id, jobId),
  // ❌ No relations fetched
});

// Separate query for company
const company = await db.query.companies.findFirst({
  where: eq(companies.id, job.companyId),
});

// Separate query for locations
const locations = await db.query.companyLocations.findMany({
  where: eq(companyLocations.companyId, job.companyId),
});

// Separate query for skills
const jobSkills = await db.query.jobSkills.findMany({
  where: eq(jobSkills.jobId, job.id),
});

// EVEN MORE queries for each skill
const skills = await Promise.all(
  jobSkills.map(js =>
    db.query.skills.findFirst({
      where: eq(skills.id, js.skillId),
    })
  )
);

// ❌ This executes 4+ separate SQL queries!
```

**Why this is bad:**

- ❌ N+1 query problem (multiple database roundtrips)
- ❌ Slower performance (network latency multiplied)
- ❌ More expensive on serverless (per-query pricing)
- ❌ Complex data assembly logic
- ❌ Not using Drizzle's relational API

---

## Pattern 6: Transactions

### ✅ Good Example

```typescript
import { db, companies, jobs } from '@/lib/db';

// Create company with jobs atomically
await db.transaction(async (tx) => {
  // Insert company
  const [company] = await tx
    .insert(companies)
    .values({
      name: 'Acme Corp',
      slug: 'acme-corp',
      websiteUrl: 'https://acme.com',
    })
    .returning({ id: companies.id });

  // Insert multiple jobs
  await tx.insert(jobs).values([
    {
      companyId: company.id,
      title: 'Senior Engineer',
      description: 'Build things',
      externalUrl: 'https://acme.com/jobs/1',
    },
    {
      companyId: company.id,
      title: 'Junior Designer',
      description: 'Design things',
      externalUrl: 'https://acme.com/jobs/2',
    },
  ]);

  // All succeed or all fail together
});

console.log('✅ Company and jobs created');
```

**Complex transaction with error handling:**

```typescript
try {
  await db.transaction(async (tx) => {
    // Update job status
    const [job] = await tx
      .update(jobs)
      .set({ isActive: false })
      .where(eq(jobs.id, jobId))
      .returning();

    if (!job) {
      throw new Error('Job not found');
    }

    // Log the change
    await tx.insert(auditLogs).values({
      entityType: 'job',
      entityId: job.id,
      action: 'deactivated',
      userId: currentUserId,
    });

    // Both updates succeed or both roll back
  });
} catch (error) {
  console.error('Transaction failed:', error);
  // Nothing was changed in the database
}
```

**Why this is good:**

- ✅ Uses `tx` parameter, not `db`, inside transaction
- ✅ `.returning()` to get inserted IDs
- ✅ Atomic operations (all or nothing)
- ✅ Error handling rolls back changes
- ✅ Short transaction (doesn't lock long)

---

### ❌ Bad Example

```typescript
// DON'T DO THIS
await db.transaction(async (tx) => {
  // Create company
  const [company] = await tx
    .insert(companies)
    .values({ name: 'Acme' })
    .returning();

  // ❌ Using db instead of tx (bypasses transaction)
  await db.insert(jobs).values({
    companyId: company.id,
    title: 'Engineer',
  });

  // ❌ Long-running operation in transaction
  await sendWelcomeEmail(company.id); // Takes 2+ seconds

  // ❌ Async operation not awaited
  tx.insert(auditLogs).values({ action: 'created' });
});
```

**Why this is bad:**

- ❌ Using `db` instead of `tx` bypasses transaction
- ❌ Long-running operation locks database rows
- ❌ Not awaiting async operations
- ❌ Side effects (email) in transaction (should be after)

---

## Pattern 7: Multiple Filters

### ✅ Good Example

```typescript
import { and, eq, inArray, sql, isNull } from "drizzle-orm";

app.openapi(getJobsRoute, async (c) => {
  const {
    country,
    employment_type,
    seniority_level,
    visa_sponsorship,
  } = c.req.valid("query");

  // Build conditions array
  const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

  // Country filter: support comma-separated values
  if (country) {
    const countries = country.split(',').map(c => c.trim().toLowerCase());

    if (countries.length === 1) {
      conditions.push(sql`LOWER(${jobs.country}) = ${countries[0]}`);
    } else {
      conditions.push(
        sql`LOWER(${jobs.country}) IN (${sql.join(
          countries.map(c => sql`${c}`),
          sql`, `
        )})`
      );
    }
  }

  // Single value filter
  if (employment_type) {
    conditions.push(eq(jobs.employmentType, employment_type as any));
  }

  // Multiple value filter with enum
  if (seniority_level) {
    const seniorities = seniority_level.split(',');

    if (seniorities.length === 1) {
      conditions.push(eq(jobs.seniorityLevel, seniorities[0] as any));
    } else {
      conditions.push(inArray(jobs.seniorityLevel, seniorities as any));
    }
  }

  // Boolean filter
  if (visa_sponsorship === "true") {
    conditions.push(ne(jobs.visaSponsorshipType, "none"));
  }

  const results = await db
    .select()
    .from(jobs)
    .where(and(...conditions)) // Spread conditions array
    .limit(100);

  return c.json({ jobs: results, total: results.length }, 200);
});
```

**Why this is good:**

- ✅ Conditions array pattern for dynamic filters
- ✅ Handles comma-separated values
- ✅ Case-insensitive string matching
- ✅ Uses `inArray()` for multiple enum values
- ✅ Spread operator with `and(...conditions)`
- ✅ Always checks soft delete

---

### ❌ Bad Example

```typescript
// DON'T DO THIS
const query = c.req.query();

// ❌ Massive nested ternary
const results = await db
  .select()
  .from(jobs)
  .where(
    query.country
      ? query.employment_type
        ? and(
            eq(jobs.country, query.country),
            eq(jobs.employmentType, query.employment_type)
          )
        : eq(jobs.country, query.country)
      : query.employment_type
      ? eq(jobs.employmentType, query.employment_type)
      : undefined // ❌ Passing undefined to where()
  );

// ❌ No soft delete check
// ❌ No validation
// ❌ Can't handle multiple values
```

**Why this is bad:**

- ❌ Unreadable nested ternaries
- ❌ Doesn't scale to more filters
- ❌ Can't handle comma-separated values
- ❌ No soft delete check
- ❌ No validation of query params

---

## Pattern 8: OpenAPI Spec Generation

### ✅ Good Example

```typescript
// File: scripts/generate-openapi.ts
import { writeFileSync } from 'fs';
import { app } from '../app/api/[[...route]]/route';

const spec = app.getOpenAPI31Document();

if (!spec) {
  console.error('❌ Could not generate OpenAPI spec');
  process.exit(1);
}

const fullSpec = {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'Jobs API',
    description: 'API for managing job postings, companies, and skills',
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Local development',
    },
    {
      url: 'https://api.example.com/api',
      description: 'Production',
    },
  ],
  ...spec,
};

const outputPath = './public/openapi.json';
writeFileSync(outputPath, JSON.stringify(fullSpec, null, 2));
console.log(`✅ OpenAPI spec written to ${outputPath}`);
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

**Why this is good:**

- ✅ Extracts spec from actual Hono app
- ✅ Adds metadata (title, version, servers)
- ✅ Writes to public directory
- ✅ Runs before build (prebuild script)
- ✅ Error handling with exit code

---

### ❌ Bad Example

```typescript
// DON'T DO THIS
// ❌ Manually writing OpenAPI spec
const spec = {
  openapi: '3.1.0',
  paths: {
    '/jobs': {
      get: {
        // ❌ Manually maintaining this
        responses: {
          200: {
            // ❌ Out of sync with actual code
          }
        }
      }
    }
  }
};

writeFileSync('./openapi.json', JSON.stringify(spec));
```

**Why this is bad:**

- ❌ Manual spec maintenance (gets out of sync)
- ❌ Doesn't leverage @hono/zod-openapi automation
- ❌ Error-prone and tedious
- ❌ No validation against actual routes

---

## Pattern 9: hey-api Client Configuration

### ✅ Good Example

```typescript
// File: openapi-ts.config.ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: './public/openapi.json',
  output: {
    path: './lib/api-client',
    format: 'prettier',
    lint: 'eslint',
  },
  plugins: [
    '@hey-api/typescript',      // Generate TypeScript types
    '@hey-api/schemas',          // Generate Zod schemas
    {
      name: '@hey-api/sdk',
      asClass: true,             // Class-based SDK
    },
    '@tanstack/react-query',     // React Query hooks
  ],
  services: {
    asClass: true,
  },
});
```

**Usage in app:**

```typescript
// File: lib/api-client/index.ts
import { client } from './client.gen';

// Configure once at app startup
client.setConfig({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export { client };
export * from './sdk.gen';
export * from './@tanstack/react-query.gen';
```

**Usage in React component:**

```typescript
import { useGetJobsQuery } from '@/lib/api-client';

function JobsList() {
  const { data, isLoading, error } = useGetJobsQuery({
    query: {
      country: 'germany',
      employment_type: 'full_time',
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.jobs.map(job => (
        <li key={job.id}>{job.title}</li>
      ))}
    </ul>
  );
}
```

**Why this is good:**

- ✅ Type-safe API calls with React Query
- ✅ Automatic refetch and caching
- ✅ Error handling built-in
- ✅ Generated from OpenAPI spec
- ✅ Configured once, used everywhere

---

### ❌ Bad Example

```typescript
// DON'T DO THIS
function JobsList() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    // ❌ Manual fetch without types
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => setJobs(data.jobs)); // ❌ No error handling
  }, []);

  // ❌ data is `any[]` - no type safety
  return (
    <ul>
      {jobs.map((job: any) => (
        <li key={job.id}>{job.title}</li>
      ))}
    </ul>
  );
}
```

**Why this is bad:**

- ❌ No type safety (jobs is `any[]`)
- ❌ No error handling
- ❌ No loading states
- ❌ No caching or refetching
- ❌ Manual URL construction
- ❌ Doesn't leverage generated client

---

## Real-World Complete Example

### Complete Job Board API

```typescript
// ============================================================================
// FILE: lib/db.ts
// ============================================================================

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set');
}

export const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema, casing: 'snake_case' });
export const { jobs, companies, skills, jobSkills } = schema;

// ============================================================================
// FILE: app/api/schemas.ts
// ============================================================================

import { z } from 'zod';
import { extendZodWithOpenApi } from '@hono/zod-openapi';

extendZodWithOpenApi(z);

export const JobSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  companyName: z.string(),
  employmentType: z.enum(['full_time', 'part_time', 'contract']).nullable(),
}).openapi('Job');

export const JobsQuerySchema = z.object({
  country: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
}).openapi('JobsQuery');

export const JobsResponseSchema = z.object({
  jobs: z.array(JobSchema),
  total: z.number(),
}).openapi('JobsResponse');

// ============================================================================
// FILE: app/api/routes/jobs.ts
// ============================================================================

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { db, jobs, companies } from "@/lib/db";
import { and, eq, desc, isNull } from "drizzle-orm";
import { JobsQuerySchema, JobsResponseSchema } from "../schemas";

const app = new OpenAPIHono();

const getJobsRoute = createRoute({
  method: "get",
  path: "/jobs",
  operationId: "getJobs",
  tags: ["Jobs"],
  request: { query: JobsQuerySchema },
  responses: {
    200: {
      description: "Jobs list",
      content: { "application/json": { schema: JobsResponseSchema } },
    },
  },
});

app.openapi(getJobsRoute, async (c) => {
  const { country, limit } = c.req.valid("query");

  const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

  if (country) {
    conditions.push(eq(jobs.country, country));
  }

  const results = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      employmentType: jobs.employmentType,
      companyName: companies.name,
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(...conditions))
    .orderBy(desc(jobs.createdAt))
    .limit(parseInt(limit || '50'));

  return c.json({ jobs: results, total: results.length }, 200);
});

export default app;

// ============================================================================
// FILE: app/api/[[...route]]/route.ts
// ============================================================================

import { OpenAPIHono } from "@hono/zod-openapi";
import { handle } from "hono/vercel";
import jobsRoutes from "../routes/jobs";

const app = new OpenAPIHono().basePath("/api");
app.route("/", jobsRoutes);

export { app };
export const GET = handle(app);

// ============================================================================
// USAGE: Frontend Component
// ============================================================================

import { useGetJobsQuery } from '@/lib/api-client';

function JobsList({ country }: { country?: string }) {
  const { data, isLoading } = useGetJobsQuery({
    query: { country, limit: '20' },
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <h2>{data?.total} jobs found</h2>
      <ul>
        {data?.jobs.map(job => (
          <li key={job.id}>
            {job.title} at {job.companyName}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

This complete example shows:

- ✅ End-to-end type safety (DB → API → Client)
- ✅ Proper schema organization
- ✅ Validation with Zod + OpenAPI
- ✅ Efficient queries with Drizzle
- ✅ React Query integration
- ✅ Production-ready patterns
