# MySQL (mysql2) -- Configuration Examples

> SSL/TLS, named placeholders, pool tuning, and monitoring events. See [core.md](core.md) for basic pool setup.

**Related examples:**

- [core.md](core.md) -- Pool setup, connection lifecycle
- [error-handling.md](error-handling.md) -- Connection error handling

---

## Named Placeholders

Named placeholders use `:name` syntax instead of positional `?`. Enable with `namedPlaceholders: true`.

```typescript
import mysql from "mysql2/promise";
import type { Pool, RowDataPacket } from "mysql2/promise";

interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  price: number;
  category: string;
}

function createPoolWithNamedPlaceholders(): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    namedPlaceholders: true,
  });
}

async function searchProducts(
  pool: Pool,
  filters: { category: string; minPrice: number; maxPrice: number },
): Promise<ProductRow[]> {
  const [rows] = await pool.execute<ProductRow[]>(
    "SELECT id, name, price, category FROM products WHERE category = :category AND price BETWEEN :minPrice AND :maxPrice",
    filters, // Object keys match :placeholder names
  );
  return rows;
}

export { createPoolWithNamedPlaceholders, searchProducts };
```

**Why good:** Named placeholders are self-documenting for queries with many parameters, object keys match placeholder names -- no positional confusion

**When to use:** Queries with 4+ parameters where positional `?` becomes hard to track

**Gotcha:** Named placeholders are converted to positional `?` on the client side -- the MySQL protocol does not support them natively. This means the SQL sent to the server still uses `?`, and the conversion happens in the mysql2 driver.

---

## SSL/TLS Configuration

```typescript
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import type { Pool } from "mysql2/promise";

// Option 1: Cloud databases (PlanetScale, AWS RDS, etc.)
// Most cloud providers' CA certs are already trusted by the system
function createCloudPool(): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: {},
  });
}

// Option 2: Custom CA certificate
function createPoolWithCA(caCertPath: string): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: {
      ca: readFileSync(caCertPath),
      rejectUnauthorized: true,
    },
  });
}

// Option 3: Mutual TLS (client certificate authentication)
function createPoolWithMTLS(
  caCertPath: string,
  clientCertPath: string,
  clientKeyPath: string,
): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: {
      ca: readFileSync(caCertPath),
      cert: readFileSync(clientCertPath),
      key: readFileSync(clientKeyPath),
      rejectUnauthorized: true,
    },
  });
}

export { createCloudPool, createPoolWithCA, createPoolWithMTLS };
```

**Why good:** Three common TLS patterns covered, `rejectUnauthorized: true` prevents MITM attacks

**Gotcha:** Setting `ssl: {}` (empty object) enables SSL with system CA trust -- this is sufficient for most cloud databases. Setting `rejectUnauthorized: false` disables certificate validation entirely and should NEVER be used in production.

---

## Pool Event Monitoring

```typescript
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

function createMonitoredPool(): Pool {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
  });

  pool.on("acquire", (connection) => {
    console.log("Connection %d acquired from pool", connection.threadId);
  });

  pool.on("release", (connection) => {
    console.log("Connection %d released to pool", connection.threadId);
  });

  pool.on("enqueue", () => {
    // This fires when the pool has no available connections and a request is queued
    // If you see this frequently, increase connectionLimit
    console.warn("Waiting for available connection -- pool may be exhausted");
  });

  pool.on("error", (err) => {
    console.error("Pool error:", err.message);
  });

  return pool;
}

export { createMonitoredPool };
```

**Why good:** `enqueue` event is an early warning for pool exhaustion, `acquire`/`release` track connection lifecycle

**When to use:** Development debugging, production monitoring integration, pool sizing validation

---

## Pool Size Tuning

```typescript
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

// Standard server application
const STANDARD_POOL_LIMIT = 10;
const STANDARD_IDLE_TIMEOUT_MS = 60_000;

// Serverless function (Lambda, Vercel)
const SERVERLESS_POOL_LIMIT = 1;
const SERVERLESS_IDLE_TIMEOUT_MS = 10_000;

// High-throughput batch processing
const BATCH_POOL_LIMIT = 25;
const BATCH_IDLE_TIMEOUT_MS = 120_000;

function createServerPool(): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: STANDARD_POOL_LIMIT,
    maxIdle: STANDARD_POOL_LIMIT,
    idleTimeout: STANDARD_IDLE_TIMEOUT_MS,
    waitForConnections: true,
    queueLimit: 0,
  });
}

function createServerlessPool(): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: SERVERLESS_POOL_LIMIT,
    maxIdle: SERVERLESS_POOL_LIMIT,
    idleTimeout: SERVERLESS_IDLE_TIMEOUT_MS,
    waitForConnections: true,
  });
}

function createBatchPool(): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: BATCH_POOL_LIMIT,
    maxIdle: STANDARD_POOL_LIMIT, // Keep fewer idle connections
    idleTimeout: BATCH_IDLE_TIMEOUT_MS,
    waitForConnections: true,
    queueLimit: 0,
  });
}

export { createServerPool, createServerlessPool, createBatchPool };
```

**Why good:** Named constants for each environment, `maxIdle` different from `connectionLimit` for batch (scales down when idle), serverless uses `connectionLimit: 1` to avoid connection exhaustion

**Key insight:** Each MySQL connection uses ~10 MB of server memory. With 5 application instances at `connectionLimit: 10` each, the MySQL server needs capacity for 50 connections. Check `SHOW VARIABLES LIKE 'max_connections'` to verify.

---

## Date and Timezone Configuration

```typescript
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

// Option 1: Return dates as JavaScript Date objects (default)
function createPoolWithDates(): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    timezone: "+00:00", // Store and retrieve in UTC
  });
}

// Option 2: Return dates as strings (avoids timezone conversion issues)
function createPoolWithDateStrings(): Pool {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    dateStrings: true, // DATE -> "2025-01-15", DATETIME -> "2025-01-15 10:30:00"
  });
}
```

**When to use `dateStrings: true`:** When you need exact date/time values without JavaScript's timezone conversion, or when passing dates to APIs that expect ISO strings.

**Gotcha:** With `timezone: "local"` (default), JavaScript `Date` objects are converted using the local timezone of the Node.js process. This causes inconsistencies between environments. Use `timezone: "+00:00"` and store all dates in UTC.

---

## Testing Configuration

```typescript
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

const TEST_POOL_LIMIT = 2;

function createTestPool(): Pool {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL environment variable is required");
  }

  return mysql.createPool({
    uri: url,
    connectionLimit: TEST_POOL_LIMIT,
    waitForConnections: true,
  });
}

// Setup/teardown for test suites
async function setupTestDatabase(pool: Pool): Promise<void> {
  // Truncate tables in dependency order (children first)
  await pool.execute("SET FOREIGN_KEY_CHECKS = 0");
  await pool.execute("TRUNCATE TABLE order_items");
  await pool.execute("TRUNCATE TABLE orders");
  await pool.execute("TRUNCATE TABLE users");
  await pool.execute("SET FOREIGN_KEY_CHECKS = 1");
}

async function teardownTestDatabase(pool: Pool): Promise<void> {
  await pool.end();
}

export { createTestPool, setupTestDatabase, teardownTestDatabase };
```

**Why good:** Separate env var for test database, low connection limit for tests, `FOREIGN_KEY_CHECKS = 0` allows truncation regardless of FK constraints, cleanup in dependency order

**Gotcha:** Run tests with `--runInBand` (or equivalent serial mode) when sharing a test database -- parallel tests will clobber each other's data. Alternatively, use unique database names per test worker.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
