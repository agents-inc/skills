---
name: api-performance-api-performance
description: Query optimization, caching, indexing, connection pooling, async patterns
---

# Backend Performance Optimization

> **Quick Guide:** Optimize backend performance through database query optimization (indexes, prepared statements, avoiding N+1), caching strategies (cache-aside, write-through), connection pooling, and non-blocking async patterns. Always measure before optimizing -- run EXPLAIN ANALYZE, check event loop lag, and track cache hit rates before adding complexity.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always release database connections back to the pool using `finally` blocks)**

**(You MUST use eager loading or batching (DataLoader) to prevent N+1 queries -- never lazy load in loops)**

**(You MUST set TTL on all cached data to prevent stale data and memory exhaustion)**

**(You MUST offload CPU-intensive work to Worker Threads -- blocking the event loop degrades all requests)**

</critical_requirements>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Database patterns: connection pooling, N+1 prevention, indexing, prepared statements, pagination
- [examples/caching.md](examples/caching.md) - Cache-aside, write-through, invalidation, key strategies, TTL guidance
- [examples/async.md](examples/async.md) - Event loop optimization, worker threads, chunked processing, concurrency control
- [reference.md](reference.md) - Decision frameworks, performance monitoring

---

**Auto-detection:** connection pool, query optimization, database index, N+1, caching, cache invalidation, prepared statement, worker threads, event loop, CPU-bound, latency, throughput, performance tuning, EXPLAIN ANALYZE, keyset pagination, cache-aside, write-through

**When to use:**

- Database queries taking > 100ms
- High-traffic endpoints with repeated data fetches
- API responses with multiple related entities (N+1 risk)
- CPU-intensive operations blocking request handling
- Need to reduce database load via caching

**When NOT to use:**

- Premature optimization without measuring first
- Simple CRUD with low traffic (adds complexity without benefit)
- Data that changes frequently and must always be fresh (caching adds staleness)
- Development/debugging (caching obscures issues)

**Key patterns covered:**

- Database indexing strategies (composite, partial, covering)
- Connection pooling with guaranteed release
- N+1 query prevention (eager loading, DataLoader)
- Caching strategies (cache-aside, write-through, invalidation)
- Event loop optimization (async I/O, setImmediate chunking)
- Worker threads for CPU-bound operations
- Keyset pagination for large datasets

---

<philosophy>

## Philosophy

Backend performance optimization follows one core principle: **measure first, optimize second**. Premature optimization wastes development time and adds complexity without evidence of benefit.

**The Three Pillars of Backend Performance:**

1. **Database Optimization** - Indexes, query planning, N+1 prevention, pagination
2. **Caching** - Reduce repeated expensive operations with TTL-bounded cache
3. **Async Efficiency** - Never block the event loop

**When to optimize:**

- Response times exceed SLA thresholds
- Database CPU/memory approaching limits
- Metrics show specific bottlenecks (EXPLAIN ANALYZE, event loop lag)
- Load testing reveals scaling issues

**When NOT to optimize:**

- "It might be slow someday" (premature)
- Optimizing cold paths (rarely executed code)
- Before profiling identifies the actual bottleneck

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Connection Pooling with Guaranteed Release

Connection pooling reuses database connections instead of creating new ones per request. A PostgreSQL handshake takes 20-30ms -- pooling eliminates this overhead.

**Key rules:**

- Use `pool.query()` for simple queries (auto-manages connection lifecycle)
- For transactions, manually checkout with `pool.connect()` and **always** release in `finally`
- Listen for pool errors (idle clients can still emit errors)

```typescript
// Transaction with guaranteed connection release
async function createUserWithProfile(
  userData: UserData,
  profileData: ProfileData,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
      [userData.name, userData.email],
    );
    await client.query("INSERT INTO profiles (user_id, bio) VALUES ($1, $2)", [
      userResult.rows[0].id,
      profileData.bio,
    ]);
    await client.query("COMMIT");
    return userResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release(); // CRITICAL: Always release back to pool
  }
}
```

**Why good:** `finally` guarantees connection release even on error, preventing pool exhaustion

See [examples/core.md](examples/core.md) for full pool configuration, sizing formula, and external pooler guidance.

---

### Pattern 2: N+1 Query Prevention

The N+1 problem occurs when fetching N records triggers N additional queries for related data. With 100 records, that's 101 database round-trips.

**Two solutions:**

1. **Eager loading** (ORM `.with()`) -- single query with JOINs for known relationships
2. **DataLoader** -- batches `.load()` calls into single query per tick, ideal for GraphQL

```typescript
// Eager loading: single query fetches jobs + companies + skills
const jobs = await db.query.jobs.findMany({
  where: and(eq(jobs.isActive, true), isNull(jobs.deletedAt)),
  with: {
    company: { with: { locations: true } },
    jobSkills: { with: { skill: true } },
  },
});
```

```typescript
// BAD: N+1 anti-pattern -- one query per job
for (const job of jobs) {
  job.company = await db.query.companies.findFirst({
    where: eq(companies.id, job.companyId),
  });
}
```

**Why bad:** 1 query for jobs + N queries for companies, latency grows linearly with data size

See [examples/core.md](examples/core.md) for DataLoader batching pattern.

---

### Pattern 3: Database Indexing

Indexes speed up queries by avoiding full table scans. Index columns used in WHERE, JOIN, and ORDER BY clauses.

```typescript
// Strategic indexes on a table definition
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    country: varchar("country", { length: 100 }),
    employmentType: varchar("employment_type", { length: 50 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    // Composite index for common filter combination
    index("jobs_country_employment_idx").on(
      table.country,
      table.employmentType,
    ),
    // Partial index -- only indexes active non-deleted jobs
    index("jobs_active_idx")
      .on(table.isActive, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),
    // Foreign key index for JOIN performance
    index("jobs_company_id_idx").on(table.companyId),
  ],
);
```

**Index Decision Framework:**

| Column Usage                | Index Type       | When to Use                                    |
| --------------------------- | ---------------- | ---------------------------------------------- |
| WHERE equality              | B-tree (default) | High-selectivity columns                       |
| WHERE range (>, <, BETWEEN) | B-tree           | Date ranges, numeric ranges                    |
| WHERE multiple columns      | Composite        | Queries always filter by same columns together |
| WHERE on subset             | Partial          | Most queries filter on active/non-deleted      |
| Full-text search            | GIN/GiST         | Text search with LIKE, tsvector                |
| JSON field access           | GIN              | JSONB column queries                           |

**Composite index column order:** Equality conditions first, range conditions last, high selectivity first.

See [examples/core.md](examples/core.md) for EXPLAIN ANALYZE examples, index monitoring queries, and unused index detection.

---

### Pattern 4: Cache-Aside with TTL

The most common caching pattern. Check cache first, fetch from database on miss, store with TTL.

```typescript
const CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = "app:user";

async function getUserById(userId: string): Promise<User | null> {
  const cacheKey = `${CACHE_PREFIX}:${userId}`;
  const cached = await cacheClient.get(cacheKey);
  if (cached) return JSON.parse(cached) as User;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  await cacheClient.set(cacheKey, JSON.stringify(user), {
    EX: CACHE_TTL_SECONDS,
  });
  return user;
}
```

**Why good:** TTL prevents stale data accumulation, namespaced keys prevent collisions, early return on cache hit

See [examples/caching.md](examples/caching.md) for write-through, tag-based invalidation, key strategies, and TTL guidance.

---

### Pattern 5: Worker Threads for CPU-Bound Operations

Node.js uses a single thread for JavaScript. CPU-intensive work blocks ALL concurrent requests.

**Rule of thumb:**

| CPU Duration | Solution              | Rationale                             |
| ------------ | --------------------- | ------------------------------------- |
| < 50ms       | Keep on main thread   | Worker overhead not worth it          |
| 50-500ms     | setImmediate chunking | Yields to event loop between chunks   |
| > 500ms      | Worker Threads        | Offload completely to separate thread |

```typescript
// Chunked processing with setImmediate -- yields to event loop between batches
const CHUNK_SIZE = 100;

async function processLargeArray(items: Item[]): Promise<ProcessedItem[]> {
  const results: ProcessedItem[] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    for (const item of chunk) {
      results.push(expensiveTransform(item));
    }
    if (i + CHUNK_SIZE < items.length) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  return results;
}
```

See [examples/async.md](examples/async.md) for worker pool implementation, concurrency control with p-limit, and event loop lag monitoring.

---

### Pattern 6: Keyset Pagination for Large Datasets

OFFSET pagination scans all previous rows -- at OFFSET 100,000 the database reads and discards 100,000 rows. Keyset pagination uses a cursor for constant-time performance.

```sql
-- BAD: OFFSET scans all previous rows
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 100000;

-- GOOD: Keyset pagination -- constant time regardless of position
SELECT * FROM products
WHERE id > :last_seen_id
ORDER BY id LIMIT 20;
```

**When to use offset:** Small datasets (< 100k rows), need total count, random page access required.

**When to use keyset:** Large datasets, infinite scroll, real-time data where inserts shouldn't cause duplicates.

See [examples/core.md](examples/core.md) for full TypeScript implementations of both patterns.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing connection release -- connections never returned to pool cause pool exhaustion and application hangs
- N+1 queries in loops -- fetching related data one-by-one instead of eager loading destroys performance
- Blocking event loop -- synchronous I/O or CPU-intensive work blocks all concurrent requests
- Cache without TTL -- unbounded cache grows until memory exhaustion or serves infinitely stale data
- Full table scans on large tables -- missing indexes on WHERE/JOIN columns

**Medium Priority Issues:**

- No index on foreign keys -- JOINs and ON DELETE CASCADE become slow
- Over-indexing -- every index slows writes; remove unused indexes with `pg_stat_user_indexes`
- Cache key collisions -- generic keys cause wrong data returned to wrong users
- Offset pagination on large tables -- OFFSET scans all previous rows; use keyset pagination
- Unbounded parallelism -- `Promise.all` on 10,000 items overwhelms downstream services

**Gotchas & Edge Cases:**

- EXPLAIN shows estimates; EXPLAIN ANALYZE shows actual -- always use ANALYZE for real performance data
- Composite index (a, b) does NOT help queries filtering only on b -- column order matters
- Applying functions to indexed columns (e.g., `YEAR(created_at)`) prevents index use -- rewrite as range conditions
- DataLoader caches within request -- don't reuse across requests or you get stale data
- Worker threads have ~30ms startup overhead -- don't use for fast operations
- Connection pool `idleTimeoutMillis` can cause "connection terminated unexpectedly" if set too short
- `SELECT *` fetches unnecessary data and prevents covering index optimization -- select specific columns
- Cache SET with EX option replaces existing TTL -- calling SET again resets expiration timer

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST always release database connections back to the pool using `finally` blocks)**

**(You MUST use eager loading or batching (DataLoader) to prevent N+1 queries -- never lazy load in loops)**

**(You MUST set TTL on all cached data to prevent stale data and memory exhaustion)**

**(You MUST offload CPU-intensive work to Worker Threads -- blocking the event loop degrades all requests)**

**Failure to follow these rules will cause connection pool exhaustion, N+1 performance degradation, memory leaks from unbounded caches, and blocked event loops affecting all concurrent requests.**

</critical_reminders>
