# Database Examples

Complete code examples for all database patterns with good/bad comparisons.

---

## Pattern 1: Database Connection

### Neon HTTP Setup (Edge-Compatible)

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

---

### WebSocket Connection (Long-Running Queries)

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

### Drizzle Kit Configuration

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

## Pattern 2: Schema Definition

### Complete Table Definitions

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

---

### Relations Definition

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

## Pattern 3: Relational Queries

### Efficient Relational Query with `.with()`

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

---

## Pattern 4: Query Builder

### Basic Query Builder

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

---

### Dynamic Filtering

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

---

## Pattern 5: Transactions

### Basic Transaction

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

---

### Transaction with Error Handling

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

---

## Pattern 6: Database Migrations

### Migration Workflow

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

### Package.json Scripts

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

## Pattern 7: Database Seeding

### Safe Seeding with Cleanup

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

### Package.json

```json
{
  "scripts": {
    "db:seed": "bun run scripts/seed.ts"
  }
}
```
