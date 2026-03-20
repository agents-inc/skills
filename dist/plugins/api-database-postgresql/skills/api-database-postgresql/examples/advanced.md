# PostgreSQL -- Advanced Examples

> Prepared statements, SSL/TLS configuration, migration patterns, and testing with transaction rollback. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Pool setup, parameterized queries, error handling
- [transactions.md](transactions.md) -- Transactions, savepoints, retry logic
- [streaming.md](streaming.md) -- Cursors, pg-query-stream, LISTEN/NOTIFY

---

## Prepared Statements

Named queries cache execution plans on the PostgreSQL server per connection. Useful for complex queries executed repeatedly.

```typescript
import type pg from "pg";

interface ProductRow {
  id: number;
  name: string;
  price: string; // numeric returns as string
  category: string;
}

const PRODUCT_SEARCH_QUERY = {
  name: "search-products",
  text: `
    SELECT id, name, price, category
    FROM products
    WHERE category = $1
      AND price BETWEEN $2 AND $3
    ORDER BY price ASC
    LIMIT $4
  `,
};

const DEFAULT_PAGE_SIZE = 50;

async function searchProducts(
  pool: pg.Pool,
  category: string,
  minPrice: number,
  maxPrice: number,
  limit: number = DEFAULT_PAGE_SIZE,
): Promise<ProductRow[]> {
  const result = await pool.query<ProductRow>({
    ...PRODUCT_SEARCH_QUERY,
    values: [category, minPrice, maxPrice, limit],
  });

  return result.rows;
}

export { searchProducts };
```

**Why good:** Named query (`name: "search-products"`) tells PostgreSQL to cache the execution plan, subsequent calls skip parsing and planning. The query object is defined once as a constant.

**When to use:** Complex queries with multiple JOINs where planning time is significant. For simple queries, the overhead of plan caching is not worth it.

**Gotcha:** Prepared statement plans are cached per connection. If a pool rotates connections (due to `maxUses` or `maxLifetimeSeconds`), plans are lost on the new connection. This is usually fine -- the first execution on a new connection parses, subsequent ones are cached.

**Gotcha:** If you run DDL (ALTER TABLE, CREATE INDEX) that changes the table structure, cached plans may become invalid. PostgreSQL automatically invalidates them, but be aware this causes a one-time re-plan.

---

## SSL/TLS Connections

```typescript
import pg from "pg";
import { readFileSync } from "node:fs";

// Cloud-managed databases (AWS RDS, GCP Cloud SQL, etc.)
// Most cloud providers use trusted CAs -- just enable SSL
function createCloudPool(): pg.Pool {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: true, // Verify server certificate
    },
  });
}

// Self-signed certificates (on-premise, custom CA)
function createMtlsPool(): pg.Pool {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      ca: readFileSync(process.env.PG_CA_CERT!),
      key: readFileSync(process.env.PG_CLIENT_KEY!),
      cert: readFileSync(process.env.PG_CLIENT_CERT!),
      rejectUnauthorized: true,
    },
  });
}

export { createCloudPool, createMtlsPool };
```

**Why good:** `rejectUnauthorized: true` validates the server certificate (prevents MITM), mTLS for mutual authentication, cert paths from environment variables

**Gotcha:** If you set `ssl` in the Pool config AND include `sslmode=require` in the connection string, the connection string parameters overwrite your config object. Use one or the other.

**Gotcha:** `ssl: true` is equivalent to `ssl: { rejectUnauthorized: true }` in pg v8.x. For older versions, `ssl: true` might accept self-signed certs -- always use the object form to be explicit.

---

## Dynamic Password Callback

Useful for AWS IAM database authentication or secrets managers that rotate credentials.

```typescript
import pg from "pg";

function createPoolWithDynamicPassword(
  getPassword: () => Promise<string>,
): pg.Pool {
  return new pg.Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT ?? "5432", 10),
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: getPassword, // Called on each new connection
    ssl: { rejectUnauthorized: true },
  });
}

export { createPoolWithDynamicPassword };
```

**Why good:** Password callback is invoked each time a new connection is established, so rotated credentials are picked up automatically without restarting the pool.

---

## Migration Pattern (Manual SQL Files)

A simple, dependency-free migration approach using sequential SQL files.

```typescript
import type pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_TABLE = "schema_migrations";

async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`,
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
    .sort(); // Alphabetical order: 001_create_users.sql, 002_add_email.sql

  const newMigrations: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [
        file,
      ]);
      await client.query("COMMIT");
      newMigrations.push(file);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(
        `Migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      client.release();
    }
  }

  return newMigrations;
}

export { runMigrations };
```

**Why good:** Each migration runs in its own transaction (atomic per file), tracks applied migrations in database, alphabetical ordering ensures deterministic execution, no external dependencies

**When NOT to use:** If you already use a migration tool from your ORM or framework, use that instead. This pattern is for projects that use raw `pg` without higher-level tools.

---

## Testing with Transaction Rollback

Wrap each test in a transaction that rolls back after the test. This provides test isolation without database cleanup scripts.

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

// Usage in tests (framework-agnostic)
// describe("UserRepository", () => {
//   it("creates a user", async () => {
//     await withTestTransaction(pool, async (client) => {
//       await client.query(
//         "INSERT INTO users (name, email) VALUES ($1, $2)",
//         ["Test User", "[email protected]"],
//       );
//
//       const { rows } = await client.query(
//         "SELECT * FROM users WHERE email = $1",
//         ["[email protected]"],
//       );
//
//       expect(rows).toHaveLength(1);
//       expect(rows[0].name).toBe("Test User");
//       // ROLLBACK happens in finally -- database is clean for next test
//     });
//   });
// });
```

**Why good:** Every test starts with a clean database state, no teardown needed, tests are isolated, fast because rollback is cheaper than truncate

**Gotcha:** The test function receives a `PoolClient`, not the pool itself. Code under test must accept a client/pool interface so you can inject the test client. If your code calls `pool.query()` internally, it will use a different connection and won't see the test transaction's uncommitted data.

---

## Connection Pool per Test Suite

For integration tests that need `pool.query()` to work (not just a dedicated client), create an isolated pool per test suite with a test database.

```typescript
import pg from "pg";

const POOL_MAX_TEST = 5;
const IDLE_TIMEOUT_TEST_MS = 1_000;
const CONNECTION_TIMEOUT_TEST_MS = 3_000;

function createTestPool(): pg.Pool {
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    max: POOL_MAX_TEST,
    idleTimeoutMillis: IDLE_TIMEOUT_TEST_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_TEST_MS,
    allowExitOnIdle: true, // Let test runner exit cleanly
  });

  pool.on("error", (err) => {
    console.error("Test pool error:", err.message);
  });

  return pool;
}

// Truncate all tables between test suites
async function cleanDatabase(pool: pg.Pool): Promise<void> {
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename != 'schema_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$
  `);
}

export { createTestPool, cleanDatabase };
```

**Why good:** `allowExitOnIdle: true` prevents test runner from hanging, low pool size for tests, truncate cascades handle foreign keys, skips migration table

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
