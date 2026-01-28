# Performance Reference

Decision frameworks, anti-patterns, red flags, and performance monitoring for backend optimization.

---

<decision_framework>

## Decision Framework

### When to Add Caching?

```
Is response time > 100ms?
├─ YES → Is data read more than written?
│   ├─ YES → Is staleness acceptable (even 60s)?
│   │   ├─ YES → Add Redis caching
│   │   └─ NO → Use write-through or real-time sync
│   └─ NO → Focus on write optimization instead
└─ NO → Don't cache (premature optimization)
```

### Which Caching Strategy?

| Scenario         | Strategy               | TTL    |
| ---------------- | ---------------------- | ------ |
| User profiles    | Cache-aside            | 300s   |
| Product catalog  | Cache-aside            | 3600s  |
| Session data     | Write-through          | 86400s |
| Real-time prices | No cache or very short | 10-60s |
| Static config    | Cache-aside            | 3600s+ |

### When to Add an Index?

```
Is the query slow (> 100ms)?
├─ YES → Run EXPLAIN ANALYZE
│   ├─ Full table scan? → Add index on WHERE columns
│   ├─ Index exists but not used? → Check column order, data types
│   └─ Index scan but still slow? → Consider covering index
└─ NO → Don't add index (premature, adds write overhead)
```

### Composite Index Column Order

Order columns by:

1. **Equality conditions first** (exact matches)
2. **Range conditions last** (>, <, BETWEEN)
3. **High selectivity first** (more unique values)

```sql
-- Query: WHERE status = 'active' AND created_at > '2024-01-01'
-- Optimal index: (status, created_at) - equality first, then range
CREATE INDEX idx_status_created ON orders(status, created_at);
```

### Connection Pool vs External Pooler?

```
Are you hitting connection limits?
├─ YES → How many application instances?
│   ├─ Many (> 5) → Use external pooler (PgBouncer)
│   └─ Few → Tune pool size per instance
└─ NO → Default pool settings are fine
```

**Pool size formula:** `connections = (core_count * 2) + disk_spindles`

- For SSDs, approximate spindles as 1-2
- PostgreSQL default max is 100 connections
- Leave headroom for admin connections

</decision_framework>

---

<performance_monitoring>

## Performance Monitoring

### Key Metrics to Track

| Metric                | Warning Threshold | Critical Threshold |
| --------------------- | ----------------- | ------------------ |
| Query p95 latency     | > 100ms           | > 500ms            |
| Connection pool usage | > 70%             | > 90%              |
| Cache hit rate        | < 80%             | < 50%              |
| Event loop lag        | > 50ms            | > 200ms            |
| Database CPU          | > 60%             | > 85%              |

### EXPLAIN ANALYZE

Always check query plans before adding indexes:

```sql
-- Check if index is being used
EXPLAIN ANALYZE SELECT * FROM jobs
WHERE country = 'germany' AND employment_type = 'full_time';

-- Look for:
-- - "Seq Scan" = full table scan (bad for large tables)
-- - "Index Scan" or "Index Only Scan" = good
-- - "Bitmap Index Scan" = acceptable for low selectivity
-- - "actual time" = real execution time
-- - "rows" = actual vs estimated rows (big difference = stale stats)
```

### Identifying N+1 Queries

Signs of N+1:

- Many small identical queries in logs
- Response time scales linearly with result count
- Database shows high query count but low total time

```typescript
// Add query logging to catch N+1
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  log: (msg) => console.log("[DB Query]", msg),
});
```

### Redis Monitoring

```typescript
// Track cache hit/miss rates
const CACHE_HITS = new Map<string, number>();
const CACHE_MISSES = new Map<string, number>();

async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    CACHE_HITS.set(key, (CACHE_HITS.get(key) || 0) + 1);
    return JSON.parse(cached);
  }

  CACHE_MISSES.set(key, (CACHE_MISSES.get(key) || 0) + 1);
  const data = await fetchFn();
  await redis.set(key, JSON.stringify(data), { EX: ttl });
  return data;
}
```

</performance_monitoring>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **Missing connection release** - Connections never returned to pool cause pool exhaustion and application hangs
- ❌ **N+1 queries in loops** - Fetching related data one-by-one instead of eager loading destroys performance
- ❌ **Blocking event loop** - Synchronous operations or CPU-intensive work blocks all concurrent requests
- ❌ **Cache without TTL** - Unbounded cache grows until memory exhaustion or serves infinitely stale data
- ❌ **Full table scans on large tables** - Missing indexes on WHERE/JOIN columns cause slow queries

**Medium Priority Issues:**

- ⚠️ **No index on foreign keys** - JOINs and ON DELETE CASCADE become slow
- ⚠️ **Over-indexing** - Every index slows writes; remove unused indexes
- ⚠️ **Cache key collisions** - Generic keys cause wrong data returned
- ⚠️ **No connection pool limits** - Unbounded pools can exhaust database connections
- ⚠️ **Offset pagination on large tables** - OFFSET scans all previous rows; use keyset pagination

**Common Mistakes:**

- Using `SELECT *` instead of specific columns (fetches unused data)
- Applying functions to indexed columns in WHERE (prevents index use)
- Not using parameterized queries (security risk + no query plan caching)
- Caching user-specific data with shared keys (data leakage)
- Setting pool max too high (each connection uses ~10MB server RAM)

**Gotchas & Edge Cases:**

- PostgreSQL EXPLAIN shows estimates; EXPLAIN ANALYZE shows actual - always use ANALYZE
- Composite index (a, b) doesn't help queries filtering only on b
- Redis SET with EX option replaces existing TTL - calling SET again resets expiration
- DataLoader caches within request - don't reuse across requests or you get stale data
- Worker threads have startup overhead (~30ms) - don't use for fast operations
- Connection pool `idleTimeoutMillis` can cause "connection terminated unexpectedly" if too short

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### 1. Lazy Loading in Loops (N+1)

```typescript
// ❌ ANTI-PATTERN: Fetching in a loop
const users = await db.query.users.findMany();
for (const user of users) {
  user.posts = await db.query.posts.findMany({
    where: eq(posts.userId, user.id),
  });
}
```

**Why it's wrong:** Creates N+1 queries where N is the number of users. With 100 users, that's 101 database round-trips.

**What to do instead:** Use eager loading with `.with()` or DataLoader for batching.

---

### 2. Functions on Indexed Columns

```sql
-- ❌ ANTI-PATTERN: Function prevents index use
SELECT * FROM orders WHERE YEAR(created_at) = 2024;

-- ✅ CORRECT: Range condition uses index
SELECT * FROM orders
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';
```

**Why it's wrong:** Applying a function to a column forces the database to evaluate the function for every row, preventing index use.

**What to do instead:** Rewrite as range conditions or create a functional index.

---

### 3. Cache Without Invalidation Strategy

```typescript
// ❌ ANTI-PATTERN: Cache forever
async function getUser(id: string) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);

  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  await redis.set(`user:${id}`, JSON.stringify(user)); // No TTL!
  return user;
}
```

**Why it's wrong:** Cache never expires, serving stale data forever. Updates to user are never reflected.

**What to do instead:** Always set TTL and implement cache invalidation on writes.

---

### 4. Blocking Event Loop

```typescript
// ❌ ANTI-PATTERN: Synchronous CPU-intensive work
app.get("/report", (req, res) => {
  const data = fs.readFileSync("large-file.csv"); // Blocks!
  const result = processLargeDataset(data); // Blocks!
  res.json(result);
});
```

**Why it's wrong:** While processing, no other requests can be handled. All concurrent users wait.

**What to do instead:** Use async file operations and Worker Threads for CPU work.

---

### 5. Offset Pagination on Large Tables

```sql
-- ❌ ANTI-PATTERN: OFFSET scans all previous rows
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 100000;
-- Database must scan 100,020 rows to return 20!
```

**Why it's wrong:** OFFSET doesn't skip rows efficiently; it reads and discards them. Performance degrades linearly with offset.

**What to do instead:** Use keyset (cursor-based) pagination.

```sql
-- ✅ CORRECT: Keyset pagination
SELECT * FROM products
WHERE id > :last_seen_id
ORDER BY id LIMIT 20;
```

---

## When to Use Each Pattern

| Problem               | Solution                     | When                        |
| --------------------- | ---------------------------- | --------------------------- |
| Slow repeated queries | Redis cache-aside            | Read-heavy, staleness OK    |
| N+1 with ORM          | Eager loading (`.with()`)    | Known relationships         |
| N+1 with GraphQL      | DataLoader                   | Dynamic field selection     |
| Slow JOINs            | Index foreign keys           | Any table with FKs          |
| Slow filters          | Composite index              | Common multi-column filters |
| CPU blocking requests | Worker Threads               | Heavy computation           |
| Memory growth         | Add TTL to cache             | Any caching                 |
| Connection exhaustion | Pool limits + finally blocks | Database access             |

</anti_patterns>
