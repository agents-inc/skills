---
name: api-database-cockroachdb
description: CockroachDB distributed SQL -- transaction retries, multi-region, online schema changes, follower reads, PostgreSQL compatibility gaps
---

# CockroachDB Patterns

> **Quick Guide:** CockroachDB connects via the standard `pg` driver (PostgreSQL wire protocol). The single most important difference from PostgreSQL: **transaction retries are mandatory**. CockroachDB's serializable isolation means any transaction can fail with SQLSTATE `40001` -- your application MUST catch this and retry the entire transaction. Use `UUID` with `gen_random_uuid()` for primary keys (never `SERIAL` -- sequential IDs cause distributed hotspots). DDL runs as online schema changes in background jobs and **cannot be inside explicit transactions**. Use `AS OF SYSTEM TIME` for follower reads to reduce latency in multi-region deployments.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST implement transaction retry logic for SQLSTATE `40001` errors -- CockroachDB WILL return serialization errors under normal operation, unlike PostgreSQL where they are rare)**

**(You MUST use `UUID` with `gen_random_uuid()` for primary keys -- NEVER use `SERIAL` or sequential IDs, which cause distributed write hotspots)**

**(You MUST NOT put DDL statements inside explicit transactions -- most DDL runs as background jobs and can fail at COMMIT time with a partially applied state. `CREATE TABLE`/`CREATE INDEX` are exceptions but the safest practice is always: one DDL statement per implicit transaction)**

**(You MUST use `Pool` from `pg` for all database access -- same as PostgreSQL, but be aware that each node in the cluster is a valid connection target)**

</critical_requirements>

---

## Examples

- [Core Patterns](examples/core.md) -- Pool setup, parameterized queries, transaction retry logic, error handling
- [Multi-Region & Performance](examples/multi-region.md) -- Locality, survival goals, follower reads, AS OF SYSTEM TIME
- [Schema & Operations](examples/schema-ops.md) -- Online schema changes, IMPORT INTO, CHANGEFEED, cockroach CLI

**Additional resources:**

- [reference.md](reference.md) -- PostgreSQL compatibility gaps, error codes, type differences, production checklist

---

**Auto-detection:** CockroachDB, cockroachdb, cockroach, CRDB, crdb, cockroach_restart, SAVEPOINT cockroach_restart, 40001, serialization_failure, retry transaction, restart transaction, gen_random_uuid, unique_rowid, AS OF SYSTEM TIME, follower_read_timestamp, CHANGEFEED, CREATE CHANGEFEED, IMPORT INTO, cockroach sql, cockroach start, multi-region, survival goal, zone survival, region survival, locality, REGIONAL BY ROW

**When to use:**

- Direct SQL queries against CockroachDB via the `pg` driver
- Distributed transactions requiring serializable isolation
- Multi-region database deployments with locality-aware reads/writes
- Applications migrating from PostgreSQL to CockroachDB
- Change data capture with CHANGEFEED
- Bulk data loading with IMPORT INTO

**Key patterns covered:**

- Transaction retry logic (SQLSTATE 40001 handling with exponential backoff)
- UUID primary keys with gen_random_uuid() (hotspot avoidance)
- AS OF SYSTEM TIME for follower reads and historical queries
- Multi-region configuration (locality, survival goals, regional tables)
- Online schema changes (DDL behavior differences from PostgreSQL)
- PostgreSQL compatibility gaps (what does NOT work)

**When NOT to use:**

- You need an ORM or query builder -- use your ORM/query builder skill instead
- You are targeting standard PostgreSQL without CockroachDB -- use the PostgreSQL skill
- You need features CockroachDB lacks (advisory locks, full stored procedure support, CREATE DOMAIN)

---

<philosophy>

## Philosophy

CockroachDB is a **distributed SQL database** that uses the PostgreSQL wire protocol. The core principle: **write PostgreSQL-compatible SQL, but design for distribution.**

**Core principles:**

1. **Retry everything** -- Serializable isolation means any transaction can be aborted by CockroachDB to resolve conflicts. Your code MUST handle SQLSTATE `40001` and retry the full transaction. This is not an edge case -- it happens under normal load.
2. **Distribute evenly** -- Sequential primary keys (`SERIAL`, auto-increment) create write hotspots because CockroachDB sorts data by primary key across ranges. Use `UUID` with `gen_random_uuid()` to scatter writes across the cluster.
3. **DDL is async** -- Schema changes run as background jobs. They cannot be wrapped in explicit transactions. Plan migrations accordingly -- one DDL statement at a time in production.
4. **Read from followers** -- Use `AS OF SYSTEM TIME` to read slightly stale data from the nearest replica instead of always hitting the leaseholder. This is the single biggest latency optimization in multi-region deployments.
5. **PostgreSQL, mostly** -- CockroachDB supports most PostgreSQL syntax and the `pg` driver works directly. But certain features are missing or behave differently. Know the gaps before you hit them in production.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Connection Pool Setup

CockroachDB uses the standard `pg` driver. Pool setup is nearly identical to PostgreSQL, but the connection string points to a CockroachDB node (or load balancer). See [examples/core.md](examples/core.md) for full configuration.

```typescript
// Good Example - CockroachDB pool with error handling
import pg from "pg";

const POOL_MAX_CLIENTS = 20;
const IDLE_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 5_000;

function createPool(): pg.Pool {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Example: postgresql://user:pass@crdb-lb:26257/mydb?sslmode=verify-full
    max: POOL_MAX_CLIENTS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });

  pool.on("error", (err) => {
    console.error("Unexpected idle client error:", err.message);
  });

  return pool;
}

export { createPool };
```

**Why good:** Standard pg Pool works unmodified, named constants, error handler prevents process crash, CockroachDB default port is 26257 (not 5432)

```typescript
// Bad Example - SERIAL primary key
await pool.query(`
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
  )
`);
// SERIAL creates sequential IDs via unique_rowid()
// which causes write hotspots on a single range
```

**Why bad:** Sequential IDs from SERIAL/unique_rowid() cluster writes on one range, creating a hotspot that defeats CockroachDB's distributed architecture

---

### Pattern 2: Transaction Retry Logic (MANDATORY)

CockroachDB's serializable isolation means transactions can fail with SQLSTATE `40001` under normal operation. You MUST catch this and retry. See [examples/core.md](examples/core.md) for the full retry helper.

```typescript
// Good Example - Transaction with retry logic
const CRDB_SERIALIZATION_FAILURE = "40001";
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 50;

async function withRetry<T>(
  pool: pg.Pool,
  operation: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      if (isCrdbRetryError(err) && attempt < MAX_RETRIES) {
        const delay =
          BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * BASE_DELAY_MS;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  throw new Error("Retry loop exited unexpectedly");
}
```

**Why good:** Catches 40001 errors specifically, exponential backoff with jitter prevents thundering herd, fresh client per attempt, bounded retries, releases client in finally

```typescript
// Bad Example - No retry logic (WILL fail in production)
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
    [100, fromId],
  );
  await client.query(
    "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
    [100, toId],
  );
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err; // 40001 errors bubble up as application failures!
} finally {
  client.release();
}
```

**Why bad:** No retry logic -- serialization errors (40001) propagate as unhandled application failures. In CockroachDB, these are EXPECTED under normal concurrent load, not exceptional conditions.

---

### Pattern 3: UUID Primary Keys

CockroachDB distributes data across ranges sorted by primary key. Sequential IDs create hotspots. See [examples/core.md](examples/core.md) for table design patterns.

```sql
-- Good Example - UUID primary key with gen_random_uuid()
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Why good:** UUIDs distribute writes evenly across all ranges in the cluster, `gen_random_uuid()` is built-in and generates UUIDv4

```sql
-- Bad Example - SERIAL primary key
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- SERIAL uses unique_rowid() which generates time-ordered IDs
-- All recent inserts land on the same range -> hotspot
```

**Why bad:** SERIAL/unique_rowid() generates roughly time-ordered values, causing all concurrent inserts to target the same range, which bottlenecks on a single node

---

### Pattern 4: AS OF SYSTEM TIME (Follower Reads)

Read slightly stale data from the nearest replica for dramatically lower latency in multi-region setups. See [examples/multi-region.md](examples/multi-region.md) for full patterns.

```typescript
// Good Example - Follower read with built-in function
const result = await pool.query<ProductRow>(
  "SELECT id, name, price FROM products WHERE category = $1 AS OF SYSTEM TIME follower_read_timestamp()",
  [category],
);
```

**Why good:** `follower_read_timestamp()` automatically picks a safe staleness window, query can be served by any replica (nearest to the client), no leaseholder round-trip

**When to use:** Read-heavy dashboards, product catalogs, search results -- anywhere slightly stale data (typically 4.8 seconds) is acceptable.

**When not to use:** Reads that must reflect the latest write (e.g., reading immediately after an INSERT to confirm it succeeded).

---

### Pattern 5: Online Schema Changes

CockroachDB DDL runs as background jobs -- NOT inside transactions. See [examples/schema-ops.md](examples/schema-ops.md) for migration patterns.

```typescript
// Good Example - DDL executed as individual statements
await pool.query("ALTER TABLE users ADD COLUMN phone TEXT");
// Runs as a background schema change job
// Table remains fully available for reads and writes during the change
```

**Why good:** DDL runs without table locks, no downtime, table available throughout

```typescript
// Bad Example - DDL inside a transaction
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("ALTER TABLE users ADD COLUMN phone TEXT");
  await client.query("ALTER TABLE users ADD COLUMN address TEXT");
  await client.query("COMMIT");
  // Most DDL can fail at COMMIT time with a partially applied state
} finally {
  client.release();
}
```

**Why bad:** Most DDL in explicit transactions can fail at COMMIT time with a partially applied state. `CREATE TABLE`/`CREATE INDEX` are exceptions, but the safest practice is always one DDL statement per implicit transaction.

---

### Pattern 6: CHANGEFEED (Change Data Capture)

Stream row-level changes to external sinks. See [examples/schema-ops.md](examples/schema-ops.md) for full CHANGEFEED patterns.

```sql
-- Good Example - CHANGEFEED to Kafka
CREATE CHANGEFEED FOR TABLE orders
  INTO 'kafka://broker:9092'
  WITH updated, resolved = '10s';

-- Sinkless changefeed (streams to SQL client)
CREATE CHANGEFEED FOR TABLE orders WITH updated;
```

**Why good:** Real-time CDC without polling, supports Kafka/webhook/cloud storage sinks, `resolved` timestamps enable downstream consumers to know data completeness

**When to use:** Event-driven architectures, data replication to analytics systems, audit logging, cache invalidation.

</patterns>

---

<decision_framework>

## Decision Framework

### Primary Key Strategy

```
What type of primary key?
+-- Need human-readable IDs? -> UUID with gen_random_uuid() + separate readable slug column
+-- Need globally unique IDs? -> UUID with gen_random_uuid() (recommended default)
+-- Migrating from PostgreSQL SERIAL? -> Switch to UUID, backfill existing data
+-- Need monotonically increasing? -> DO NOT -- use UUID. If you absolutely must, use
|                                      SERIAL but understand the hotspot tradeoff.
```

### Isolation Level Choice

```
Which isolation level?
+-- Need strongest guarantees? -> SERIALIZABLE (default, recommended)
|   +-- Your app handles 40001 retries? -> Yes, use SERIALIZABLE
|   +-- Cannot implement retry logic? -> Consider READ COMMITTED
+-- Analytics / read-heavy workload? -> READ COMMITTED (no retry needed)
+-- Background jobs with loose consistency? -> READ COMMITTED
```

### Read Strategy

```
How fresh must the data be?
+-- Must see latest writes? -> Normal read (hits leaseholder)
+-- Stale by a few seconds is fine? -> AS OF SYSTEM TIME follower_read_timestamp()
+-- Need a specific historical snapshot? -> AS OF SYSTEM TIME '<timestamp>'
+-- Exporting data for analytics? -> AS OF SYSTEM TIME with follower reads
```

### Schema Change Strategy

```
How to run DDL?
+-- Single column add/drop? -> Run as individual statement (no transaction)
+-- Multiple related changes? -> Run sequentially, one statement at a time
+-- Need to roll back DDL? -> You cannot -- DDL is not transactional. Plan carefully.
+-- Index creation on large table? -> Run with CONCURRENTLY (same as PostgreSQL)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- No transaction retry logic for 40001 errors -- CockroachDB WILL return these under normal concurrent load. Without retries, your application randomly fails under traffic.
- Using SERIAL or sequential primary keys -- creates a write hotspot on a single range, bottlenecking the entire cluster on one node.
- DDL inside explicit transactions -- most DDL can fail at COMMIT time with a partially applied state. `CREATE TABLE`/`CREATE INDEX` are exceptions, but the safest practice is one DDL per implicit transaction.
- Using advisory locks (`pg_advisory_lock`, `pg_try_advisory_lock`) -- CockroachDB does NOT implement them. They are defined as no-op stubs that silently do nothing.

**Medium Priority Issues:**

- Not using `AS OF SYSTEM TIME` for read-heavy workloads in multi-region -- forces all reads to hit the leaseholder, adding cross-region latency.
- Running multiple DDL statements simultaneously in production -- each schema change consumes resources. Run them sequentially.
- Assuming PostgreSQL `LISTEN`/`NOTIFY` works -- CockroachDB does NOT support `LISTEN`/`NOTIFY`. Use `CHANGEFEED` for real-time change streaming.
- Using `CREATE DOMAIN` -- not supported in CockroachDB. Use `CHECK` constraints or application-level validation.

**Common Mistakes:**

- Connecting to port 5432 instead of 26257 -- CockroachDB default port is 26257.
- Expecting `SERIAL` to produce gapless sequential IDs -- CockroachDB's `unique_rowid()` produces time-ordered but non-sequential values with gaps.
- Forgetting that `numeric`/`decimal` types return as strings in the `pg` driver (same behavior as PostgreSQL).
- Wrapping retry logic around individual statements instead of the entire transaction -- you must retry the FULL transaction, not just the failed statement.
- Using `SELECT ... FOR UPDATE` without understanding it acquires locks across the cluster -- it works but has higher latency than in PostgreSQL.

**Gotchas & Edge Cases:**

- `40001` errors can occur on `COMMIT`, not just on individual statements. Your retry loop must catch errors from `COMMIT` too.
- CockroachDB's `SAVEPOINT cockroach_restart` is a special savepoint name that enables the advanced retry protocol. Regular savepoints (`SAVEPOINT my_savepoint`) work normally for nested rollback.
- Temporary tables exist but are experimental (`SET experimental_enable_temp_tables = 'on'`). Creating many temp objects degrades DDL performance.
- `READ COMMITTED` isolation is available but is not the default. Transactions default to `SERIALIZABLE`. Set per-transaction with `BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED`.
- CockroachDB's `pg_catalog` and `information_schema` are populated but may have differences from PostgreSQL -- some system tables have extra columns, some are missing columns.
- `IMPORT INTO` takes the target table offline during the import. The table cannot serve reads or writes until the import completes.
- Changefeed payload is limited. Complex JOINs or aggregations cannot be expressed directly in changefeed queries -- one table per changefeed.
- Float overflow returns `Infinity` in CockroachDB (PostgreSQL returns an error).
- Bitwise operator precedence differs from PostgreSQL. Use explicit parentheses.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST implement transaction retry logic for SQLSTATE `40001` errors -- CockroachDB WILL return serialization errors under normal operation, unlike PostgreSQL where they are rare)**

**(You MUST use `UUID` with `gen_random_uuid()` for primary keys -- NEVER use `SERIAL` or sequential IDs, which cause distributed write hotspots)**

**(You MUST NOT put DDL statements inside explicit transactions -- most DDL runs as background jobs and can fail at COMMIT time with a partially applied state. `CREATE TABLE`/`CREATE INDEX` are exceptions but the safest practice is always: one DDL statement per implicit transaction)**

**(You MUST use `Pool` from `pg` for all database access -- same as PostgreSQL, but be aware that each node in the cluster is a valid connection target)**

**Failure to follow these rules will cause transaction failures under load, write hotspots that defeat distribution, DDL errors, and application crashes.**

</critical_reminders>
