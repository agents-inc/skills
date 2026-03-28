---
name: api-database-drizzle
description: Drizzle ORM, queries, migrations
---

# Database with Drizzle ORM + Neon

> **Quick Guide:** Use Drizzle ORM for type-safe queries, Neon serverless Postgres for edge-compatible connections. Schema-first design with automatic TypeScript types. Use RQB v2 with `defineRelations()` and object-based `where` syntax. Relational queries with `.with()` avoid N+1 problems. Use transactions for atomic operations.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST set `casing: 'snake_case'` in Drizzle config to map camelCase JS to snake_case SQL)**

**(You MUST use `tx` parameter (NOT `db`) inside transaction callbacks to ensure atomicity)**

**(You MUST use `.with()` for relational queries to avoid N+1 problems - fetches all data in single SQL query)**

**(You MUST use `defineRelations()` for RQB v2 - the old `relations()` per-table syntax is deprecated)**

</critical_requirements>

---

**Detailed Resources:**

- For code examples, see [examples/](examples/) folder:
  - [core.md](examples/core.md) - Connection setup and schema definition (always loaded)
  - [queries.md](examples/queries.md) - Relational queries and query builder
  - [relations-v2.md](examples/relations-v2.md) - RQB v2 with defineRelations() (NEW)
  - [transactions.md](examples/transactions.md) - Atomic operations
  - [migrations.md](examples/migrations.md) - Drizzle Kit workflow
  - [seeding.md](examples/seeding.md) - Development data population (includes drizzle-seed)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

**Auto-detection:** drizzle-orm, @neondatabase/serverless, neon-http, db.query, db.transaction, drizzle-kit, pgTable, defineRelations, drizzle-seed

**When to use:**

- Serverless functions needing type-safe database queries
- Schema-first development with migrations
- Building server-rendered apps with API routes

**When NOT to use:**

- Simple apps using framework server actions directly (overhead not justified)
- Apps needing traditional TCP connection pooling only (use standard Postgres clients)
- Non-TypeScript projects (lose primary benefit of type safety)
- Edge functions requiring WebSocket connections (not supported in edge runtime)

---

<patterns>

## Core Patterns

### Pattern 1: Database Connection (Neon HTTP)

Configure Drizzle with Neon for serverless/edge compatibility. Key setup requirements:

```typescript
export const db = drizzle(sql, {
  schema,
  casing: "snake_case", // Maps camelCase JS to snake_case SQL
});
```

- Validate `DATABASE_URL` before use (throw on missing)
- Always set `casing: "snake_case"` to prevent field name mismatches
- Use `neon()` for HTTP (edge-compatible) or `Pool` for WebSocket (long queries)

Full connection setup, WebSocket config, and Drizzle Kit config in [examples/core.md](examples/core.md).

---

### Pattern 2: Schema Definition

Define tables with TypeScript types using Drizzle's schema builder:

```typescript
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique(),
  deletedAt: timestamp("deleted_at"), // Soft delete
  createdAt: timestamp("created_at").defaultNow(),
});
```

- Use `pgEnum()` for constrained values instead of varchar
- Always include `createdAt`/`updatedAt` timestamps
- Add `deletedAt` for soft deletes
- Set `onDelete: "cascade"` on foreign keys to prevent orphaned records
- Use `uuid().defaultRandom()` or `integer().generatedAlwaysAsIdentity()` for primary keys

Full schema examples (enums, relations, junction tables, identity columns) in [examples/core.md](examples/core.md).

---

### Pattern 3: Relational Queries with `.with()`

Fetch related data efficiently in a single SQL query using `.with()`:

```typescript
const job = await db.query.jobs.findFirst({
  where: and(eq(jobs.id, jobId), isNull(jobs.deletedAt)),
  with: {
    company: { with: { locations: true } },
    jobSkills: { with: { skill: true } },
  },
});
// Result is fully typed: job.company.name, job.jobSkills[0].skill.name
```

- **Use `db.query` with `.with()`** when fetching related data -- single SQL query, no N+1
- **Use query builder (`db.select()`)** for custom column selection, complex JOINs, aggregations
- Always include `isNull(deletedAt)` in WHERE conditions for soft-deleted tables

Full relational query examples, N+1 anti-patterns, and dynamic filtering in [examples/queries.md](examples/queries.md).

</patterns>

---

## Additional Patterns

The following patterns are documented with full examples in [examples/](examples/):

- **Query Builder** - Complex filters, dynamic conditions, custom JOINs - see [queries.md](examples/queries.md)
- **Transactions** - Atomic operations, error handling, rollback - see [transactions.md](examples/transactions.md)
- **Database Migrations** - Drizzle Kit workflow, `generate` vs `push` - see [migrations.md](examples/migrations.md)
- **Database Seeding** - Development data, safe cleanup - see [seeding.md](examples/seeding.md)

Performance optimization (indexes, prepared statements, pagination) is documented in [reference.md](reference.md#performance-optimization).

---

<red_flags>

## RED FLAGS

- ❌ **Using `db` instead of `tx` inside transactions** - Bypasses transaction context, breaking atomicity
- ❌ **N+1 queries with relations** - Use `.with()` to fetch in one query
- ❌ **Not setting `casing: 'snake_case'`** - Field name mismatches between JS and SQL
- ❌ **Using v1 `relations()` per-table syntax** - Deprecated, use `defineRelations()`
- ❌ **Using callback-based `where`/`orderBy`** - v1 syntax deprecated, use object-based syntax
- ⚠️ Queries without soft delete checks (`isNull(deletedAt)`)
- ⚠️ No pagination limits on list queries

**Gotchas & Edge Cases:**

- Neon HTTP has 30-second query timeout - long queries need WebSocket
- Prepared statements created outside transactions cannot be used inside transactions
- `enableRLS()` deprecated in v1.0.0-beta.1 - use `pgTable.withRLS()` instead
- Validator packages consolidated: `drizzle-zod` is now `drizzle-orm/zod` (since v1 beta)

For the complete list of anti-patterns and gotchas, see [reference.md](reference.md#red-flags).

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST set `casing: 'snake_case'` in Drizzle config to map camelCase JS to snake_case SQL)**

**(You MUST use `tx` parameter (NOT `db`) inside transaction callbacks to ensure atomicity)**

**(You MUST use `.with()` for relational queries to avoid N+1 problems - fetches all data in single SQL query)**

**(You MUST use `defineRelations()` for RQB v2 - the old `relations()` per-table syntax is deprecated)**

**Failure to follow these rules will cause field name mismatches, break transaction atomicity, create N+1 performance issues, and use deprecated APIs.**

</critical_reminders>
