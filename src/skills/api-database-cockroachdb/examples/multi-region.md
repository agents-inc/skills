# CockroachDB -- Multi-Region & Performance Examples

> Locality configuration, survival goals, follower reads, AS OF SYSTEM TIME, and performance optimization. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Pool setup, transaction retry logic, parameterized queries
- [schema-ops.md](schema-ops.md) -- Online schema changes, IMPORT INTO, CHANGEFEED

---

## Multi-Region Database Setup

Configure a database to span multiple regions with locality-aware data placement.

```sql
-- Step 1: Start nodes with locality flags
-- cockroach start --locality=region=us-east1,zone=us-east1-b ...
-- cockroach start --locality=region=us-west1,zone=us-west1-a ...
-- cockroach start --locality=region=eu-west1,zone=eu-west1-c ...

-- Step 2: Set primary region
ALTER DATABASE myapp PRIMARY REGION "us-east1";

-- Step 3: Add secondary regions
ALTER DATABASE myapp ADD REGION "us-west1";
ALTER DATABASE myapp ADD REGION "eu-west1";

-- Step 4: Set survival goal
ALTER DATABASE myapp SURVIVE ZONE FAILURE;
-- Or for maximum availability (requires 3+ regions):
-- ALTER DATABASE myapp SURVIVE REGION FAILURE;
```

**Why good:** Locality flags on nodes tell CockroachDB where each node is physically located, enabling intelligent data placement. Region failure survival requires 5 replicas (2+2+1 across 3 regions).

---

## Table Locality Configuration

### Regional By Table (Default)

All data for the table resides in one region. Best for data accessed primarily from one location.

```sql
-- Data lives in the primary region
ALTER TABLE users SET LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- Or pin to a specific region
ALTER TABLE eu_compliance_logs SET LOCALITY REGIONAL BY TABLE IN "eu-west1";
```

**When to use:** Tables accessed from a single region (e.g., region-specific audit logs, compliance data that must stay in a jurisdiction).

---

### Regional By Row

Each row is placed in the region specified by its `crdb_region` column. Best for user data where users are geo-distributed.

```sql
-- Step 1: Add the region column
ALTER TABLE users ADD COLUMN crdb_region crdb_internal_region
  NOT NULL DEFAULT gateway_region()
  AS (
    CASE
      WHEN country IN ('US', 'CA', 'MX') THEN 'us-east1'
      WHEN country IN ('GB', 'DE', 'FR') THEN 'eu-west1'
      ELSE 'us-west1'
    END
  ) STORED;

-- Step 2: Set the locality
ALTER TABLE users SET LOCALITY REGIONAL BY ROW;
```

**Why good:** Each user's data lives in their nearest region. Reads and writes for that user are local. The computed column automatically places rows based on the `country` field.

**When to use:** User profiles, session data, per-tenant data -- anything where each record has a natural region affinity.

```typescript
// Application code -- insert with explicit region
await pool.query(
  `INSERT INTO users (email, name, country, crdb_region)
   VALUES ($1, $2, $3, $4)`,
  [email, name, country, "us-east1"],
);

// Or let the computed column handle it
await pool.query(
  `INSERT INTO users (email, name, country)
   VALUES ($1, $2, $3)`,
  [email, name, country],
  // crdb_region is computed from country
);
```

---

### Global Tables

Data is replicated to all regions for fast reads everywhere. Writes are slower because they require cross-region consensus.

```sql
ALTER TABLE feature_flags SET LOCALITY GLOBAL;
ALTER TABLE exchange_rates SET LOCALITY GLOBAL;
ALTER TABLE app_config SET LOCALITY GLOBAL;
```

**When to use:** Reference data, configuration, feature flags -- tables that are read frequently from all regions but updated rarely.

**Gotcha:** Global table writes require consensus across all regions, adding latency proportional to the cross-region round-trip time. Only use GLOBAL for tables with a high read-to-write ratio.

---

## AS OF SYSTEM TIME (Follower Reads)

### Basic Follower Read

Read slightly stale data from the nearest replica. This avoids the round-trip to the leaseholder.

```typescript
import type pg from "pg";

interface ProductRow {
  id: string;
  name: string;
  price: string; // DECIMAL returns as string
  category: string;
}

// Follower read -- served by nearest replica
async function getProducts(
  pool: pg.Pool,
  category: string,
): Promise<ProductRow[]> {
  const result = await pool.query<ProductRow>(
    `SELECT id, name, price, category
     FROM products
     WHERE category = $1
     AS OF SYSTEM TIME follower_read_timestamp()`,
    [category],
  );
  return result.rows;
}

export { getProducts };
```

**Why good:** `follower_read_timestamp()` automatically computes a safe staleness window (typically ~4.8 seconds). The query is served by any replica, avoiding leaseholder round-trip.

---

### Explicit Staleness

When you need a specific staleness guarantee or a historical snapshot.

```typescript
// Read data as of 10 seconds ago
const TEN_SECONDS_AGO = "-10s";

const result = await pool.query<ProductRow>(
  `SELECT id, name, price
   FROM products
   WHERE category = $1
   AS OF SYSTEM TIME now() - $2::INTERVAL`,
  [category, TEN_SECONDS_AGO],
);

// Read at a specific timestamp
const result2 = await pool.query<ProductRow>(
  `SELECT id, name, price
   FROM products
   AS OF SYSTEM TIME '2025-01-15 12:00:00+00:00'`,
);
```

**When to use:** Historical snapshots for reports, consistent reads across multiple queries (same timestamp), analytics on past data.

---

### Bounded Staleness Read

Read the freshest data available on the nearest replica, with a maximum staleness guarantee.

```typescript
const MAX_STALENESS = "10s";

// Bounded staleness: single-row lookup by primary key
const result = await pool.query<ProductRow>(
  `SELECT id, name, price
   FROM products
   WHERE id = $1
   AS OF SYSTEM TIME with_max_staleness($2::INTERVAL)`,
  [productId, MAX_STALENESS],
);
```

**Why good:** Tries to serve the freshest data locally. If the local replica's data is within the staleness bound, it answers immediately. If not, it fetches from the leaseholder.

**When to use:** When you want low latency but also want reasonably fresh data (e.g., a product price that can be up to 10 seconds stale).

**Gotcha:** `with_max_staleness()` and `with_min_timestamp()` have strict limitations: they must be used in a **single-statement implicit transaction**, must read from a **single row**, and must not require an index join. For multi-row follower reads, use `follower_read_timestamp()` instead.

---

### Follower Reads in Explicit Transactions

```typescript
async function generateReport(pool: pg.Pool): Promise<ReportData> {
  const client = await pool.connect();
  try {
    // All reads in this transaction see the same snapshot
    await client.query("BEGIN AS OF SYSTEM TIME follower_read_timestamp()");

    const users = await client.query("SELECT count(*) FROM users");
    const orders = await client.query("SELECT sum(total) FROM orders");
    const products = await client.query("SELECT count(*) FROM products");

    await client.query("COMMIT");

    return {
      userCount: parseInt(users.rows[0].count, 10),
      orderTotal: orders.rows[0].sum,
      productCount: parseInt(products.rows[0].count, 10),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { generateReport };
```

**Why good:** All queries in the transaction see a consistent snapshot, served by nearest replica, no retry logic needed (read-only follower reads cannot conflict)

**Gotcha:** `AS OF SYSTEM TIME` transactions are read-only. You cannot INSERT, UPDATE, or DELETE within them.

---

## SELECT FOR UPDATE (Pessimistic Locking)

CockroachDB supports `SELECT ... FOR UPDATE` but it acquires locks across the cluster. Use it for high-contention scenarios.

```typescript
async function claimJob(
  pool: pg.Pool,
  workerId: string,
): Promise<JobRow | null> {
  return withCrdbRetry(pool, async (client) => {
    // SKIP LOCKED avoids waiting on rows locked by other workers
    const { rows } = await client.query<JobRow>(
      `SELECT id, payload FROM job_queue
       WHERE status = 'pending'
       ORDER BY created_at
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );

    if (rows.length === 0) return null;

    await client.query(
      `UPDATE job_queue
       SET status = 'processing', worker_id = $1, started_at = now()
       WHERE id = $2`,
      [workerId, rows[0].id],
    );

    return rows[0];
  });
}

export { claimJob };
```

**Why good:** `FOR UPDATE SKIP LOCKED` is ideal for job queues -- it skips rows already claimed by other workers instead of waiting. Wrapped in `withCrdbRetry` for 40001 handling.

**Gotcha:** `SELECT ... FOR UPDATE` has higher latency in CockroachDB than PostgreSQL because the lock must be coordinated across nodes. For low-contention workloads, optimistic locking (version columns) is often faster.

---

## Optimistic Locking with Version Columns

An alternative to `FOR UPDATE` that avoids distributed lock coordination.

```typescript
async function updateProductPrice(
  pool: pg.Pool,
  productId: string,
  newPrice: string,
  expectedVersion: number,
): Promise<boolean> {
  return withCrdbRetry(pool, async (client) => {
    const result = await client.query(
      `UPDATE products
       SET price = $1, version = version + 1, updated_at = now()
       WHERE id = $2 AND version = $3`,
      [newPrice, productId, expectedVersion],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new ConflictError(
        "Product was modified by another transaction. Re-read and retry.",
      );
    }

    return true;
  });
}

export { updateProductPrice };
```

**Why good:** No distributed lock overhead, version check detects concurrent modifications, conflict results in a clear error message

**When to use:** Low-to-moderate contention scenarios. For high contention (many concurrent writes to the same row), use `FOR UPDATE`.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
