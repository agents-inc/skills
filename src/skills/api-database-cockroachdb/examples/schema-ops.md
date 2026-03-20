# CockroachDB -- Schema & Operations Examples

> Online schema changes, IMPORT INTO for bulk data, CHANGEFEED for CDC, and cockroach CLI usage. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Pool setup, transaction retry logic, parameterized queries
- [multi-region.md](multi-region.md) -- Locality, survival goals, follower reads

---

## Online Schema Changes

CockroachDB DDL runs as background jobs. Tables remain available for reads and writes throughout the change. DDL statements CANNOT be inside explicit transactions.

### Adding Columns

```typescript
import type pg from "pg";

// Good Example - DDL as individual statements
async function addPhoneColumn(pool: pg.Pool): Promise<void> {
  // Each DDL runs as an implicit transaction (individual statement)
  await pool.query("ALTER TABLE users ADD COLUMN phone TEXT");
  // Table is fully available during this operation
}

// Add column with default (backfills existing rows in background)
async function addStatusColumn(pool: pg.Pool): Promise<void> {
  await pool.query(
    "ALTER TABLE orders ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'",
  );
  // CockroachDB backfills the default value in a background job
}

export { addPhoneColumn, addStatusColumn };
```

**Why good:** Individual DDL statements, no transaction wrapper, table stays available

```typescript
// Bad Example - DDL inside explicit transaction
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("ALTER TABLE users ADD COLUMN phone TEXT");
  await client.query("ALTER TABLE users ADD COLUMN address TEXT");
  await client.query("COMMIT");
  // Most DDL can fail at COMMIT time with a partially applied state
  // CREATE TABLE/CREATE INDEX are exceptions, but mixing DDL types is unsafe
} finally {
  client.release();
}
```

**Why bad:** Most DDL in explicit transactions can fail at COMMIT time with a partially applied state. The safest practice is one DDL statement per implicit transaction.

---

### Creating Indexes

```sql
-- Good Example - Index creation (runs as background job)
CREATE INDEX idx_orders_user_status ON orders (user_id, status);

-- Partial index (reduces index size)
CREATE INDEX idx_orders_pending ON orders (created_at)
  WHERE status = 'pending';

-- GIN index for JSONB columns
CREATE INVERTED INDEX idx_users_metadata ON users (metadata);
```

**Why good:** Index creation runs in the background without blocking reads or writes. Partial indexes reduce storage and improve write performance.

**Gotcha:** CockroachDB uses `INVERTED INDEX` instead of PostgreSQL's `GIN INDEX` for JSONB/array indexes. The syntax differs but the functionality is equivalent.

---

### Monitoring Schema Change Progress

```sql
-- Check running schema change jobs
SHOW JOBS WHERE job_type = 'SCHEMA CHANGE';

-- Detailed job status
SELECT job_id, description, status, fraction_completed, error
FROM [SHOW JOBS]
WHERE job_type = 'SCHEMA CHANGE'
  AND status != 'succeeded';

-- Cancel a running schema change
CANCEL JOB <job_id>;
```

**Gotcha:** In production, run one DDL statement at a time and monitor via `SHOW JOBS`. Multiple concurrent schema changes compete for resources and can slow each other down significantly.

---

## Migration Pattern

Since DDL cannot be in transactions, migrations need a different approach than PostgreSQL.

```typescript
import type pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_TABLE = "schema_migrations";

async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  // This DDL is fine as an implicit transaction
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY applied_at`,
  );
  return new Set(result.rows.map((r) => r.name));
}

async function runMigrations(
  pool: pg.Pool,
  migrationsDir: string,
): Promise<string[]> {
  await ensureMigrationsTable(pool);
  const applied = await getAppliedMigrations(pool);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const newMigrations: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), "utf-8");

    // Split file into individual statements
    // DDL and DML may need to run as separate statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await pool.query(statement);
    }

    // Record migration AFTER all statements succeed
    await pool.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [
      file,
    ]);

    newMigrations.push(file);
  }

  return newMigrations;
}

export { runMigrations };
```

**Why good:** UUID primary key on migrations table, each DDL statement runs individually (not in a transaction), migration recorded after success

**Gotcha:** Unlike PostgreSQL, if a migration fails partway through, some statements may have been applied but the migration is not recorded. You may need to manually clean up. Design migrations to be idempotent where possible (e.g., `CREATE INDEX IF NOT EXISTS`).

---

## IMPORT INTO (Bulk Data Loading)

`IMPORT INTO` is CockroachDB's high-performance bulk loading mechanism. It is significantly faster than individual INSERTs for large datasets.

```sql
-- Import from CSV (cloud storage)
IMPORT INTO users (id, email, name, created_at)
  CSV DATA (
    'gs://my-bucket/users-part1.csv',
    'gs://my-bucket/users-part2.csv'
  )
  WITH skip = '1', nullif = '';

-- Import from S3
IMPORT INTO orders (id, user_id, total, status)
  CSV DATA (
    's3://my-bucket/orders.csv?AWS_ACCESS_KEY_ID={key}&AWS_SECRET_ACCESS_KEY={secret}'
  );

-- Import with custom delimiter (TSV)
IMPORT INTO products (id, name, price)
  CSV DATA ('gs://my-bucket/products.tsv')
  WITH delimiter = e'\t';

-- Run import as detached background job
IMPORT INTO users (id, email, name)
  CSV DATA ('gs://my-bucket/users.csv')
  WITH detached;
```

**Why good:** Parallel bulk loading from multiple files, supports cloud storage directly, `detached` option runs as background job

**Gotcha:** `IMPORT INTO` takes the target table **offline** during the import. The table cannot serve reads or writes until the import completes. Plan accordingly -- import during maintenance windows or into staging tables.

**Gotcha:** Column order in the CSV must match the column order specified in the `IMPORT INTO` statement.

---

## CHANGEFEED (Change Data Capture)

Stream row-level changes from tables to external systems.

### Changefeed to Kafka

```sql
-- Stream all changes from orders table to Kafka
CREATE CHANGEFEED FOR TABLE orders
  INTO 'kafka://broker.internal:9092'
  WITH updated, resolved = '10s',
       format = 'json',
       topic_prefix = 'crdb_';
-- Produces to topic: crdb_orders
```

### Changefeed to Webhook

```sql
CREATE CHANGEFEED FOR TABLE orders
  INTO 'webhook-https://my-api.example.com/webhooks/orders'
  WITH updated, resolved = '30s';
```

### Changefeed to Cloud Storage

```sql
CREATE CHANGEFEED FOR TABLE orders
  INTO 'gs://my-bucket/cdc/orders'
  WITH updated, resolved = '1m',
       format = 'json';
```

### Sinkless Changefeed (SQL Client)

```sql
-- Streams to the SQL client indefinitely
CREATE CHANGEFEED FOR TABLE orders WITH updated;

-- With filtering (CDC query)
CREATE CHANGEFEED WITH updated AS
  SELECT id, status, updated_at
  FROM orders
  WHERE status IN ('shipped', 'delivered');
```

### Managing Changefeeds

```sql
-- List active changefeeds
SELECT job_id, description, status
FROM [SHOW JOBS]
WHERE job_type = 'CHANGEFEED';

-- Pause a changefeed
PAUSE JOB <job_id>;

-- Resume a paused changefeed
RESUME JOB <job_id>;

-- Cancel a changefeed
CANCEL JOB <job_id>;
```

**When to use:** Event-driven architectures, real-time data replication, audit logging, cache invalidation, feeding data to analytics pipelines.

**Gotcha:** CDC queries support only a single table per changefeed. You cannot JOIN across tables in a changefeed query.

**Gotcha:** Enterprise changefeeds (with sinks like Kafka, S3, webhooks) require a CockroachDB Enterprise license. Sinkless changefeeds are available in all editions.

---

## cockroach CLI Operations

### Starting a Local Cluster

```bash
# Start a single-node cluster for development
cockroach start-single-node --insecure --store=node1 --listen-addr=localhost:26257

# Start a 3-node cluster
cockroach start --insecure --store=node1 --listen-addr=localhost:26257 \
  --join=localhost:26257,localhost:26258,localhost:26259

cockroach start --insecure --store=node2 --listen-addr=localhost:26258 \
  --join=localhost:26257,localhost:26258,localhost:26259

cockroach start --insecure --store=node3 --listen-addr=localhost:26259 \
  --join=localhost:26257,localhost:26258,localhost:26259

# Initialize the cluster (run once after first start)
cockroach init --insecure --host=localhost:26257
```

### SQL Shell

```bash
# Connect to local insecure cluster
cockroach sql --insecure --host=localhost:26257

# Connect with SSL
cockroach sql --url "postgresql://user@crdb-host:26257/mydb?sslmode=verify-full&sslrootcert=ca.crt"

# Execute a single command
cockroach sql --insecure -e "SELECT count(*) FROM users"
```

### Cluster Operations

```bash
# Check node status
cockroach node status --insecure --host=localhost:26257

# Decommission a node (graceful removal)
cockroach node decommission 3 --insecure --host=localhost:26257

# Check running jobs (schema changes, imports, etc.)
cockroach sql --insecure -e "SHOW JOBS WHERE status = 'running'"

# Collect debug info for support
cockroach debug zip debug.zip --insecure --host=localhost:26257
```

### Quick Demo Cluster

```bash
# Spin up a temporary in-memory cluster with sample data
cockroach demo

# Demo with specific dataset
cockroach demo --nodes=5 --demo-locality=region=us-east1:region=us-west1:region=eu-west1
```

---

## Testing with CockroachDB

### Docker-Based Test Cluster

```bash
# Start CockroachDB for testing
docker run -d --name crdb-test \
  -p 26257:26257 -p 8080:8080 \
  cockroachdb/cockroach:latest start-single-node --insecure

# Create test database
docker exec crdb-test cockroach sql --insecure \
  -e "CREATE DATABASE testdb"
```

### Test Pool Configuration

```typescript
import pg from "pg";

const TEST_POOL_MAX = 5;
const TEST_IDLE_TIMEOUT_MS = 1_000;
const TEST_CONNECTION_TIMEOUT_MS = 3_000;

function createTestPool(): pg.Pool {
  const pool = new pg.Pool({
    connectionString:
      process.env.TEST_DATABASE_URL ??
      "postgresql://root@localhost:26257/testdb?sslmode=disable",
    max: TEST_POOL_MAX,
    idleTimeoutMillis: TEST_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: TEST_CONNECTION_TIMEOUT_MS,
    allowExitOnIdle: true,
  });

  pool.on("error", (err) => {
    console.error("Test pool error:", err.message);
  });

  return pool;
}

export { createTestPool };
```

### Transaction Rollback Test Isolation

```typescript
import type pg from "pg";

async function withTestTransaction<T>(
  pool: pg.Pool,
  testFn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await testFn(client);
    return result;
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

export { withTestTransaction };
```

**Why good:** Each test runs in a transaction that rolls back, leaving the database clean. Same pattern as PostgreSQL.

**Gotcha:** Code under test must accept a `PoolClient` (not a `Pool`) so the test can inject the transactional client. If code uses `pool.query()`, it gets a different connection that cannot see the test transaction's uncommitted data.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
