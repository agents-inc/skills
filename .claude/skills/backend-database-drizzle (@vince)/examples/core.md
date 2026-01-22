# Core Database Examples

Essential patterns for Drizzle ORM setup and schema definition. These are foundational patterns needed for any database work.

---

## Database Connection

### Neon HTTP Setup (Edge-Compatible)

```typescript
// Good Example - Proper Neon HTTP setup
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
// Bad Example - Missing critical configuration
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
// Good Example - WebSocket for long queries
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
// Bad Example - Missing connection cleanup
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

## Schema Definition

### Complete Table Definitions

```typescript
// Good Example - Well-structured table with constraints
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
// Bad Example - Missing constraints and best practices
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

### Identity Columns (Alternative to UUID)

PostgreSQL recommends identity columns over serial for auto-incrementing integer primary keys. Use when you prefer integer IDs over UUIDs.

```typescript
import { pgTable, integer, text } from "drizzle-orm/pg-core";

// Good Example - Identity column for auto-increment
export const products = pgTable("products", {
  // GENERATED ALWAYS - database always generates value
  id: integer("id").primaryKey().generatedAlwaysAsIdentity({ startWith: 1000 }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Alternative: GENERATED BY DEFAULT - allows manual override
export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
});
```

**Why use identity columns:** PostgreSQL recommended over deprecated `serial` type, customizable sequence options (startWith, increment), allows multiple identity columns per table, standard SQL compliance

**When to use UUID vs Identity:**

- **UUID** (`uuid().defaultRandom()`): Distributed systems, client-generated IDs, prevent ID enumeration
- **Identity** (`integer().generatedAlwaysAsIdentity()`): Simple auto-increment, smaller storage, faster joins

---

### Relations Definition

```typescript
// Define relations separately from tables
export const companiesRelations = relations(companies, ({ many }) => ({
  jobs: many(jobs),
  locations: many(companyLocations),
}));

export const companyLocationsRelations = relations(
  companyLocations,
  ({ one }) => ({
    company: one(companies, {
      fields: [companyLocations.companyId],
      references: [companies.id],
    }),
  }),
);

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

## See Also

- [queries.md](queries.md) - Relational queries with `.with()` and query builder patterns
- [transactions.md](transactions.md) - Atomic operations and error handling
- [migrations.md](migrations.md) - Drizzle Kit workflow and best practices
- [seeding.md](seeding.md) - Development data population
