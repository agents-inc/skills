# Database Reference

Decision frameworks, anti-patterns, red flags, and performance optimization for Drizzle ORM + Neon.

---

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

---

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

---

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

---

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

---

## When to Use Each Pattern

| Scenario | Pattern | Reason |
|----------|---------|--------|
| Fetch job with company | `db.query` with `.with()` | Single query, type-safe |
| Custom column selection | Query builder | More control over output |
| Create company + jobs | Transaction | Atomic operation |
| List jobs with filters | Query builder | Dynamic conditions |
| Paginated list | Query builder + offset/limit | Standard pagination |
| Real-time updates | WebSocket connection | LISTEN/NOTIFY support |
| Edge runtime | HTTP connection | WebSocket not available |
| Repeated query | Prepared statement | Performance optimization |
