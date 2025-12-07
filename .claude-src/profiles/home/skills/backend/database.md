# Database with Drizzle ORM + Neon

> **Quick Guide:** Use Drizzle ORM for type-safe queries, Neon serverless Postgres for edge-compatible connections. Schema-first design with automatic TypeScript types. Relational queries with `.with()` avoid N+1 problems. Use transactions for atomic operations.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST set `casing: 'snake_case'` in Drizzle config to map camelCase JS to snake_case SQL)**

**(You MUST use `tx` parameter (NOT `db`) inside transaction callbacks to ensure atomicity)**

**(You MUST use `.with()` for relational queries to avoid N+1 problems - fetches all data in single SQL query)**

</critical_requirements>

---

**Auto-detection:** drizzle-orm, @neondatabase/serverless, neon-http, db.query, db.transaction, drizzle-kit, pgTable, relations

**When to use:**

- Serverless functions needing type-safe database queries
- Schema-first development with migrations
- Building Next.js apps with API routes

**When NOT to use:**

- Simple apps using Next.js server actions directly (overhead not justified)
- Apps needing traditional TCP connection pooling only (use standard Postgres clients)
- Non-TypeScript projects (lose primary benefit of type safety)
- Edge functions requiring WebSocket connections (not supported in edge runtime)

**Key patterns covered:**

- Neon serverless connection (HTTP and WebSocket)
- Drizzle schema design (tables, relations, enums)
- Relational queries with `.with()` (single SQL query)
- Query builder for complex filters
- Transactions for atomic operations
- Database migrations with Drizzle Kit
- Performance optimization (indexes, prepared statements)

---

<philosophy>

## Philosophy

**Drizzle ORM** provides SQL-like queries with TypeScript safety and zero runtime overhead. **Neon Serverless** offers PostgreSQL over HTTP/WebSocket for edge compatibility.

**When to use this stack:**

- Serverless functions (Vercel, Cloudflare Workers, Edge)
- Need type-safe database queries
- Want schema-first development with migrations
- Building Next.js apps with API routes

**When NOT to use:**

- Simple apps using Next.js server actions directly
- Apps needing traditional TCP connection pooling only
- Non-TypeScript projects

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Database Connection (Neon HTTP)

Configure Drizzle with Neon for serverless/edge compatibility.

#### Configuration

```typescript
// ✅ Good Example - Proper Neon HTTP setup
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Use neon() for HTTP-based queries (edge-compatible)
export const sql = neon(process.env.DATABASE_URL);

// Initialize Drizzle with schema and snake_case mapping
export const db = drizzle(sql, {
  schema,
  casing: "snake_case", // Maps camelCase JS to snake_case SQL
});

// Export tables for direct query access
export const { jobs, companies, companyLocations, skills, jobSkills } = schema;
```

**Why good:** Environment variable validation prevents runtime errors, `casing: "snake_case"` ensures JS camelCase maps correctly to SQL snake_case preventing field name mismatches, HTTP connection works in all serverless environments

```typescript
// ❌ Bad Example - Missing critical configuration
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon(process.env.DATABASE_URL!); // No validation
const db = drizzle(sql); // Missing schema and casing

export default db; // Default export
```

**Why bad:** No env validation = runtime crashes, missing `casing` config = field name mismatches between JS and SQL, missing schema = no relational queries available, default export violates project conventions

#### Drizzle Kit Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle", // Migration files output
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

### Pattern 2: WebSocket Connection (Long-Running Queries)

For queries taking > 30 seconds or LISTEN/NOTIFY.

```typescript
// ✅ Good Example - WebSocket for long queries
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Enable WebSocket support (Node.js only, not edge)
neonConfig.webSocketConstructor = ws;

const QUERY_TIMEOUT_MS = 60000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: QUERY_TIMEOUT_MS,
});

async function longRunningQuery() {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM large_table WHERE ...");
    return result.rows;
  } finally {
    client.release(); // Always release connection
  }
}

export { longRunningQuery };
```

**Why good:** WebSocket enables queries > 30 seconds without timeout, connection pooling reuses connections efficiently, `finally` ensures connections are released preventing memory leaks, named constant for timeout improves maintainability

```typescript
// ❌ Bad Example - Missing connection cleanup
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query() {
  const client = await pool.connect();
  const result = await client.query("SELECT * FROM table");
  return result.rows; // Missing client.release()
}
```

**Why bad:** Missing `client.release()` causes connection leaks, connection pool exhaustion, memory leaks in serverless environments

---

### Pattern 3: Schema Definition

Define tables with TypeScript types using Drizzle's schema builder.

#### Constants and Enums

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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Define enums for constrained values
export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "freelance",
]);

export const seniorityLevelEnum = pgEnum("seniority_level", [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
]);
```

#### Table Definitions

```typescript
// ✅ Good Example - Well-structured table with constraints
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

export const companyLocations = pgTable("company_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }),
  country: varchar("country", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }),
  isHeadquarters: boolean("is_headquarters").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  externalUrl: text("external_url").notNull(),
  employmentType: employmentTypeEnum("employment_type"),
  seniorityLevel: seniorityLevelEnum("seniority_level"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: varchar("salary_currency", { length: 3 }).default("EUR"),
  showSalary: boolean("show_salary").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).unique(),
  popularityScore: integer("popularity_score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction table for many-to-many
export const jobSkills = pgTable("job_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .references(() => jobs.id, { onDelete: "cascade" })
    .notNull(),
  skillId: uuid("skill_id")
    .references(() => skills.id, { onDelete: "cascade" })
    .notNull(),
  isRequired: boolean("is_required").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Why good:** `uuid().defaultRandom()` generates secure unique IDs, `.notNull()` enforces required fields preventing null errors, enums constrain values to valid options, `onDelete: 'cascade'` prevents orphaned records, `deletedAt` enables soft deletes preserving data history, `createdAt`/`updatedAt` track record lifecycle

```typescript
// ❌ Bad Example - Missing constraints and best practices
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey(), // Missing defaultRandom()
  name: varchar("name", { length: 255 }), // Missing .notNull()
  // Missing timestamps
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey(),
  companyId: uuid("company_id").references(() => companies.id), // Missing onDelete
  status: varchar("status", { length: 50 }), // Should use enum
});
```

**Why bad:** Missing `defaultRandom()` requires manual ID generation, missing `.notNull()` allows nulls in required fields causing runtime errors, missing `onDelete` leaves orphaned records on deletion, no timestamps prevents tracking creation/updates, varchar for status instead of enum allows invalid values

#### Relations

```typescript
// Define relations separately from tables
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

---

### Pattern 4: Relational Queries with `.with()`

Fetch related data efficiently in a single SQL query.

```typescript
// ✅ Good Example - Efficient relational query
import { and, eq, desc, asc, isNull } from "drizzle-orm";

const job = await db.query.jobs.findFirst({
  where: and(eq(jobs.id, jobId), eq(jobs.isActive, true), isNull(jobs.deletedAt)),
  with: {
    company: {
      with: {
        locations: {
          orderBy: [desc(companyLocations.isHeadquarters), asc(companyLocations.name)],
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

**Why good:** Single SQL query eliminates N+1 problem, nested `.with()` loads deep relations efficiently, soft delete check prevents returning deleted records, ordering nested results provides predictable output, fully typed results catch errors at compile time

```typescript
// ❌ Bad Example - N+1 query problem
const job = await db.query.jobs.findFirst({
  where: eq(jobs.id, jobId), // Missing soft delete check
});

// Separate queries cause N+1 problem
const company = await db.query.companies.findFirst({
  where: eq(companies.id, job.companyId),
});

const locations = await db.query.companyLocations.findMany({
  where: eq(companyLocations.companyId, company.id),
});

const jobSkills = await db.query.jobSkills.findMany({
  where: eq(jobSkills.jobId, job.id),
});
```

**Why bad:** Multiple queries create N+1 problem degrading performance, missing soft delete check returns deleted records, manual relation loading is error-prone, no ordering means unpredictable results, more database round-trips = slower response times

**When to use:** Need related data across tables, want to avoid N+1 queries, prefer type-safe queries over raw SQL

**When not to use:** Simple queries without relations (use `db.select()`), need custom JOINs with complex conditions (use query builder)

---

### Pattern 5: Query Builder for Complex Queries

Use the query builder for custom queries with conditions.

#### Basic Query Builder

```typescript
// ✅ Good Example - Complex filtered query
import { and, eq, desc, isNull, sql } from "drizzle-orm";

const MAX_RESULTS = 100;

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
      sql`LOWER(${jobs.country}) = ${country.toLowerCase()}`,
    ),
  )
  .orderBy(desc(jobs.createdAt))
  .limit(MAX_RESULTS);
```

**Why good:** Custom column selection reduces data transfer, named constant for limit improves maintainability, soft delete filter prevents returning deleted records, `LOWER()` makes country comparison case-insensitive, explicit ordering provides predictable results

```typescript
// ❌ Bad Example - Missing filters and magic numbers
const results = await db
  .select()
  .from(jobs)
  .leftJoin(companies, eq(jobs.companyId, companies.id))
  .where(sql`country = ${country}`) // Case-sensitive, no soft delete
  .limit(1000); // Magic number
```

**Why bad:** Missing soft delete check returns deleted records, case-sensitive comparison misses matches, magic number makes limit unclear and hard to change, selecting all columns wastes bandwidth, no ordering = unpredictable results

#### Dynamic Filtering

```typescript
// ✅ Good Example - Dynamic filters with proper handling
import { inArray } from "drizzle-orm";

const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

// Country filter: support comma-separated values
if (country) {
  const countries = country.split(",").map((c) => c.trim().toLowerCase());
  if (countries.length === 1) {
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

// Single value filter
if (employment_type) {
  conditions.push(eq(jobs.employmentType, employment_type as any));
}

// Multiple value filter with enum
if (seniority_level) {
  const seniorities = seniority_level.split(",");
  if (seniorities.length === 1) {
    conditions.push(eq(jobs.seniorityLevel, seniorities[0] as any));
  } else {
    conditions.push(inArray(jobs.seniorityLevel, seniorities as any));
  }
}

const results = await db
  .select()
  .from(jobs)
  .where(and(...conditions))
  .limit(MAX_RESULTS);
```

**Why good:** Conditions array allows dynamic filter building, handles both single and multiple values correctly, `trim()` cleans whitespace from input, case-insensitive country matching prevents missed results, `inArray()` optimizes multiple value queries

**When to use:** Custom column selection, complex WHERE conditions, multiple dynamic filters, manual JOINs with specific conditions

**When not to use:** Simple relation fetching (use `db.query` with `.with()`), no filtering needed (relational queries are cleaner)

---

### Pattern 6: Transactions

Use transactions for operations that must succeed or fail together.

#### Basic Transaction

```typescript
// ✅ Good Example - Proper transaction usage
await db.transaction(async (tx) => {
  // Insert parent
  const [company] = await tx
    .insert(companies)
    .values({
      name: "Acme Corp",
      slug: "acme-corp",
      websiteUrl: "https://acme.com",
    })
    .returning({ id: companies.id });

  // Insert children
  await tx.insert(jobs).values([
    {
      companyId: company.id,
      title: "Senior Engineer",
      description: "Build things",
      externalUrl: "https://acme.com/jobs/1",
    },
    {
      companyId: company.id,
      title: "Junior Designer",
      description: "Design things",
      externalUrl: "https://acme.com/jobs/2",
    },
  ]);

  // All succeed or all fail together
});
```

**Why good:** Uses `tx` parameter (not `db`) ensuring atomicity, `.returning()` gets inserted ID for child records, all operations succeed or fail together preventing partial data, transaction keeps related data consistent

```typescript
// ❌ Bad Example - Not using transaction parameter
await db.transaction(async (tx) => {
  const [company] = await db.insert(companies).values({...}); // Using db instead of tx
  await db.insert(jobs).values({...}); // Using db instead of tx
});
```

**Why bad:** Using `db` instead of `tx` bypasses transaction context breaking atomicity, operations can succeed/fail independently leaving inconsistent data, defeats entire purpose of transaction

#### Transaction with Error Handling

```typescript
// ✅ Good Example - Transaction with proper error handling
try {
  await db.transaction(async (tx) => {
    const [job] = await tx
      .update(jobs)
      .set({ isActive: false })
      .where(eq(jobs.id, jobId))
      .returning();

    if (!job) {
      throw new Error("Job not found");
    }

    await tx.insert(auditLogs).values({
      entityType: "job",
      entityId: job.id,
      action: "deactivated",
      userId: currentUserId,
    });
  });
} catch (error) {
  console.error("Transaction failed:", error);
  // Nothing was changed in the database
}
```

**Why good:** Try-catch handles transaction failures, throwing error inside transaction rolls back all changes, validation ensures data exists before proceeding, audit log and update are atomic

**When to use:** Creating related records together, updating multiple tables that must stay consistent, financial operations or critical data changes

**When not to use:** Read-only queries (no benefit), long-running operations (blocks other queries), independent operations (split into separate queries)

---

### Pattern 7: Database Migrations

Manage schema changes with Drizzle Kit.

#### Migration Workflow

```bash
# 1. Make schema changes in your schema file
# 2. Generate migration
bun run drizzle-kit generate

# 3. Review generated SQL in drizzle/ directory
# 4. Apply migration (development)
bun run drizzle-kit migrate

# 5. For serverless/production, use push for direct schema sync
bun run drizzle-kit push
```

#### Package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

**When to use `generate` vs `push`:**

- Use `generate` + `migrate` for development (trackable migrations)
- Use `push` for serverless/CI (direct schema sync)
- Never use `push` in production with existing data without backup

**Migration naming convention:**

- `0001_create_companies_table.sql`
- `0002_add_salary_fields_to_jobs.sql`
- `0003_create_job_skills_junction_table.sql`

---

### Pattern 8: Database Seeding

Populate database with initial or test data.

```typescript
// ✅ Good Example - Safe seeding with cleanup
import { db } from "./db";
import { companies, jobs, skills } from "./db/schema";

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (development only!)
  await db.delete(jobs);
  await db.delete(companies);

  // Seed companies
  const [acme] = await db
    .insert(companies)
    .values({
      name: "Acme Corp",
      slug: "acme-corp",
      websiteUrl: "https://acme.com",
    })
    .returning();

  // Seed jobs
  await db.insert(jobs).values([
    {
      companyId: acme.id,
      title: "Senior Engineer",
      description: "Build amazing products",
      externalUrl: "https://acme.com/jobs/1",
      employmentType: "full_time",
    },
    {
      companyId: acme.id,
      title: "Product Designer",
      description: "Design user experiences",
      externalUrl: "https://acme.com/jobs/2",
      employmentType: "full_time",
    },
  ]);

  console.log("Database seeded");
}

seed().catch(console.error);
```

**Why good:** Cleanup ensures clean slate, `.returning()` gets IDs for dependent records, error handling with `.catch()` surfaces failures, uses enum values for type safety

```typescript
// ❌ Bad Example - Unsafe seeding
async function seed() {
  // No cleanup - causes duplicate errors on re-run
  await db.insert(companies).values({
    name: "Acme Corp",
  }); // Missing .returning()

  // Hard-coded UUID - fragile
  await db.insert(jobs).values({
    companyId: "12345",
  });
}
```

**Why bad:** No cleanup causes errors on re-run, missing `.returning()` prevents getting generated IDs, hard-coded UUIDs are fragile and break easily, no error handling hides failures

**Package.json:**

```json
{
  "scripts": {
    "db:seed": "bun run scripts/seed.ts"
  }
}
```

**When to use:** Development environment setup, test data generation, demo environments

**When not to use:** Production databases (use migrations instead), sensitive data (never seed credentials)

</patterns>

---

<performance>

## Performance Optimization

### Query Optimization with Indexes

Add indexes for commonly filtered columns:

```typescript
import { index } from "drizzle-orm/pg-core";

export const jobs = pgTable(
  "jobs",
  {
    // ... columns
  },
  (table) => ({
    // Composite index for common filter combinations
    countryEmploymentIdx: index("jobs_country_employment_idx").on(
      table.country,
      table.employmentType,
    ),
    // Partial index for active jobs only
    activeIdx: index("jobs_active_idx")
      .on(table.isActive)
      .where(sql`${table.deletedAt} IS NULL`),
    // Text search index
    titleIdx: index("jobs_title_idx").on(table.title),
  }),
);
```

### Prepared Statements for Repeated Queries

```typescript
const DEFAULT_LIMIT = 50;

// Define once, reuse many times
const getActiveJobsByCountry = db
  .select()
  .from(jobs)
  .where(and(eq(jobs.country, sql.placeholder("country")), eq(jobs.isActive, true)))
  .prepare("get_active_jobs_by_country");

// Execute with parameters (faster than building query each time)
const results = await getActiveJobsByCountry.execute({ country: "germany" });
```

### Pagination

Implement offset-based pagination:

```typescript
const DEFAULT_PAGE_LIMIT = 50;
const DEFAULT_PAGE_OFFSET = 0;

export const parsePagination = (limit?: string, offset?: string) => ({
  limit: parseInt(limit || String(DEFAULT_PAGE_LIMIT), 10),
  offset: parseInt(offset || String(DEFAULT_PAGE_OFFSET), 10),
});

const { limit, offset } = parsePagination(query.limit, query.offset);

const results = await db.select().from(jobs).limit(limit).offset(offset);

// Get total count for pagination
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(jobs)
  .where(and(...conditions));

return { jobs: results, total: count };
```

**When NOT to use offset pagination:**

- Real-time feeds (use cursor-based pagination)
- Large datasets (offset is slow on large tables - use keyset pagination)

</performance>

---

<decision_framework>

## Decision Framework

### Relational Query API vs Query Builder?

**Use `db.query` (Relational API) when:**

- Fetching related data defined in schema relations
- Want simple, readable queries
- Need nested relations with `.with()`
- Don't need custom column selection

**Use Query Builder when:**

- Need custom column selection
- Complex WHERE conditions
- JOINs not defined in relations
- Aggregations (COUNT, SUM, etc.)

### When to use Transactions?

**Use transactions when:**

- Creating parent + child records together
- Updating related tables that must stay consistent
- Operations must be atomic (all or nothing)

**Don't use transactions when:**

- Read-only queries
- Independent operations
- Long-running operations

### Neon HTTP vs WebSocket?

**Use HTTP (`neon()`) when:**

- Short-lived serverless functions
- Edge runtime (Vercel Edge, Cloudflare Workers)
- Simple queries

**Use WebSocket when:**

- Need persistent connections
- Long-running queries (> 30 seconds)
- LISTEN/NOTIFY for real-time updates
- NOT available in all edge environments

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **Using `db` instead of `tx` inside transactions** - Bypasses transaction context, breaking atomicity and causing inconsistent data
- ❌ **Using `Pool` with edge runtime** - Not compatible with serverless environments, causes runtime errors
- ❌ **Not setting `casing: 'snake_case'`** - Causes field name mismatches between JS camelCase and SQL snake_case
- ❌ **Long transactions** - Locks rows, blocks other queries, degrades performance
- ❌ **N+1 queries with relations** - Multiple database round-trips instead of single query, use `.with()` to fetch in one query

**Medium Priority Issues:**

- ⚠️ Queries without soft delete checks - Returns deleted records to users
- ⚠️ No pagination limits - Can return massive datasets causing memory issues
- ⚠️ Not using prepared statements - Slower performance for repeated queries
- ⚠️ Mixing relational queries and query builder - Inconsistent patterns, harder to maintain

**Common Mistakes:**

- Forgetting `.returning()` after inserts - Can't access inserted IDs for dependent records
- Not handling `null` in queries - Causes type errors and runtime crashes
- Using `parseInt()` without fallback - Returns NaN on invalid input
- Not cleaning up database connections - Memory leaks in serverless functions
- Foreign keys without `onDelete` - Orphaned records possible after deletions
- No timestamps - Can't track creation/updates
- No soft deletes - Data loss risk

**Gotchas & Edge Cases:**

- Neon HTTP has 30-second query timeout - long queries need WebSocket connection
- WebSocket connections not available in edge runtime - must use HTTP
- `casing: 'snake_case'` config must match actual database column names
- Relations must be defined separately from tables in Drizzle schema
- Transaction callbacks receive `tx` parameter - using `db` bypasses transaction

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Using `db` Instead of `tx` in Transactions

```typescript
// ❌ ANTI-PATTERN: Bypassing transaction context
await db.transaction(async (tx) => {
  const [company] = await db.insert(companies).values({...}); // Using db!
  await db.insert(jobs).values({ companyId: company.id }); // Using db!
});
```

**Why it's wrong:** Using `db` instead of `tx` bypasses transaction context, operations succeed/fail independently, data becomes inconsistent.

**What to do instead:** Always use the `tx` parameter passed to the callback.

---

### N+1 Query Problem

```typescript
// ❌ ANTI-PATTERN: Separate queries for related data
const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
const locations = await db.query.companyLocations.findMany({ where: eq(companyLocations.companyId, company.id) });
```

**Why it's wrong:** Multiple database round-trips degrade performance, each query adds latency, doesn't scale with data size.

**What to do instead:** Use `.with()` to fetch all related data in a single query.

---

### Missing casing Configuration

```typescript
// ❌ ANTI-PATTERN: No casing config
const db = drizzle(sql, { schema });
// camelCase JS fields won't match snake_case SQL columns
```

**Why it's wrong:** Field name mismatches between JavaScript camelCase and SQL snake_case cause silent failures.

**What to do instead:** Always set `casing: 'snake_case'` in Drizzle config.

---

### Queries Without Soft Delete Checks

```typescript
// ❌ ANTI-PATTERN: No soft delete filter
const results = await db
  .select()
  .from(jobs)
  .where(eq(jobs.companyId, companyId));
// Returns deleted records!
```

**Why it's wrong:** Returns records that were soft-deleted, users see data that should be hidden.

**What to do instead:** Always include `isNull(jobs.deletedAt)` in WHERE conditions.

</anti_patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST set `casing: 'snake_case'` in Drizzle config to map camelCase JS to snake_case SQL)**

**(You MUST use `tx` parameter (NOT `db`) inside transaction callbacks to ensure atomicity)**

**(You MUST use `.with()` for relational queries to avoid N+1 problems - fetches all data in single SQL query)**

**Failure to follow these rules will cause field name mismatches, break transaction atomicity, and create N+1 performance issues.**

</critical_reminders>
