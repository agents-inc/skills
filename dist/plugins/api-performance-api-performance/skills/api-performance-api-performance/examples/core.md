# Backend Performance - Core Examples

> Core database performance patterns. See [caching.md](caching.md) for cache strategies and [async.md](async.md) for event loop optimization.

---

## Prepared Statements

Prepare query plans once, execute many times with different parameters.

```typescript
// Good Example - Prepared statement for repeated queries
const DEFAULT_LIMIT = 50;

// Define prepared statement once at module level (ORM syntax varies)
const getActiveJobsByCountry = db
  .select()
  .from(jobs)
  .where(
    and(
      eq(jobs.country, sql.placeholder("country")),
      eq(jobs.isActive, true),
      isNull(jobs.deletedAt),
    ),
  )
  .limit(DEFAULT_LIMIT)
  .prepare("get_active_jobs_by_country");

// Execute with parameters - reuses query plan
async function findJobsByCountry(country: string) {
  return await getActiveJobsByCountry.execute({ country });
}

export { findJobsByCountry };
```

**Why good:** Query plan compiled once and reused, faster than building query each execution, parameterized queries prevent SQL injection

**Caveat:** Prepared statements created outside a transaction cannot be used inside transactions. Create them inside the transaction callback if needed.

---

## Query Optimization Techniques

### Select Only Needed Columns

```typescript
// Good Example - Select specific columns
const jobs = await db
  .select({
    id: jobs.id,
    title: jobs.title,
    company: companies.name,
  })
  .from(jobs)
  .innerJoin(companies, eq(jobs.companyId, companies.id));

// Bad Example - SELECT * fetches unnecessary data
const jobs = await db.select().from(jobs);
```

**Why good:** Reduces data transfer, uses less memory, can enable covering indexes (index-only scans)

### Avoid Functions on Indexed Columns

```typescript
// Bad Example - Function prevents index use
const orders = await db
  .select()
  .from(orders)
  .where(sql`YEAR(${orders.createdAt}) = 2024`);

// Good Example - Range condition uses index
const START_OF_2024 = new Date("2024-01-01");
const START_OF_2025 = new Date("2025-01-01");

const orders = await db
  .select()
  .from(orders)
  .where(
    and(
      gte(orders.createdAt, START_OF_2024),
      lt(orders.createdAt, START_OF_2025),
    ),
  );
```

**Why good:** Range conditions allow index seeks, function-based queries require full table scan

### Batch Inserts

```typescript
// Good Example - Batch insert to avoid long transactions
const BATCH_SIZE = 1000;

async function bulkInsertProducts(products: NewProduct[]) {
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await db.insert(productsTable).values(batch);
  }
}
```

**Why good:** Batched inserts prevent transaction timeout, memory-efficient processing of large datasets

---

## Pagination Patterns

### Offset Pagination (Simple but Limited)

```typescript
// Good Example - Offset pagination with total count
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface PaginationParams {
  page: number;
  pageSize: number;
}

async function getJobsPaginated(params: PaginationParams) {
  const pageSize = Math.min(
    params.pageSize || DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const offset = (params.page - 1) * pageSize;

  const [jobsResult, countResult] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(isNull(jobs.deletedAt))
      .orderBy(desc(jobs.createdAt))
      .limit(pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(isNull(jobs.deletedAt)),
  ]);

  return {
    data: jobsResult,
    pagination: {
      page: params.page,
      pageSize,
      total: countResult[0].count,
      totalPages: Math.ceil(countResult[0].count / pageSize),
    },
  };
}
```

**When to use:** Small to medium datasets (< 100k rows), need total count, random page access required

**Limitations:** OFFSET scans all previous rows - performance degrades at high offsets

### Keyset (Cursor) Pagination

```typescript
// Good Example - Keyset pagination for large datasets
interface CursorParams {
  cursor?: string; // Last seen ID
  limit: number;
}

async function getJobsCursor(params: CursorParams) {
  const limit = Math.min(params.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  let query = db
    .select()
    .from(jobs)
    .where(isNull(jobs.deletedAt))
    .orderBy(desc(jobs.createdAt), desc(jobs.id))
    .limit(limit + 1); // Fetch one extra to check for more

  // If cursor provided, filter to items after cursor
  if (params.cursor) {
    const cursorJob = await db.query.jobs.findFirst({
      where: eq(jobs.id, params.cursor),
    });
    if (cursorJob) {
      query = query.where(
        or(
          lt(jobs.createdAt, cursorJob.createdAt),
          and(
            eq(jobs.createdAt, cursorJob.createdAt),
            lt(jobs.id, cursorJob.id),
          ),
        ),
      );
    }
  }

  const results = await query;
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
    },
  };
}
```

**Why good:** Constant time regardless of offset, efficient for large datasets, handles real-time data well (no duplicates from inserts)

**Trade-offs:** Can't jump to arbitrary pages, no total count without separate query

---

## Index Monitoring

### Check Index Usage (PostgreSQL)

```sql
-- Find unused indexes
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find missing indexes (sequential scans on large tables)
SELECT
  schemaname,
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND n_live_tup > 10000
ORDER BY seq_tup_read DESC
LIMIT 10;
```

### EXPLAIN ANALYZE Examples

```sql
-- Check if index is being used
EXPLAIN ANALYZE
SELECT * FROM jobs
WHERE country = 'germany' AND employment_type = 'full_time';

-- Good output:
-- Index Scan using jobs_country_employment_idx on jobs
-- Index Cond: (country = 'germany' AND employment_type = 'full_time')
-- Execution Time: 0.123 ms

-- Bad output (needs index):
-- Seq Scan on jobs
-- Filter: (country = 'germany' AND employment_type = 'full_time')
-- Rows Removed by Filter: 50000
-- Execution Time: 45.678 ms
```

---

## Connection Pool Sizing

### Calculation Formula

```typescript
// Pool size = (core_count * 2) + effective_spindle_count
// For SSDs, effective_spindle_count ~ 1-2

const CPU_CORES = 4;
const EFFECTIVE_SPINDLES = 2; // SSD
const CALCULATED_POOL_SIZE = CPU_CORES * 2 + EFFECTIVE_SPINDLES; // = 10

// Also consider:
// - PostgreSQL max_connections (default 100)
// - Number of application instances
// - Leave headroom for admin connections

const POOL_MAX_CONNECTIONS = Math.min(CALCULATED_POOL_SIZE, 20);
```

### External Poolers (PgBouncer)

For high-scale deployments with many application instances:

```
Application Instances (10) x Pool Size (20) = 200 connections
PostgreSQL max_connections = 100

Solution: PgBouncer in transaction mode
- All app instances connect to PgBouncer
- PgBouncer maintains smaller pool to PostgreSQL
- Each transaction gets a real connection, returned immediately after
```

**When to use an external pooler:**

- More than 5 application instances
- Serverless functions (many short-lived connections)
- Hitting PostgreSQL connection limits
- Connection storms during traffic spikes

---

## See Also

- [caching.md](caching.md) - Cache strategies and invalidation
- [async.md](async.md) - Event loop and worker threads
