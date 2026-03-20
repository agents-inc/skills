# CockroachDB -- Core Pattern Examples

> Pool setup, transaction retry logic, UUID primary keys, parameterized queries, and error handling. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [multi-region.md](multi-region.md) -- Locality, survival goals, follower reads, AS OF SYSTEM TIME
- [schema-ops.md](schema-ops.md) -- Online schema changes, IMPORT INTO, CHANGEFEED

---

## Pool Setup

CockroachDB uses the standard `pg` driver. Configuration is identical to PostgreSQL except for the default port (26257) and SSL requirements.

```typescript
import pg from "pg";

const POOL_MAX_CLIENTS = 20;
const IDLE_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 5_000;
const MAX_LIFETIME_SECONDS = 1_800;

function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new pg.Pool({
    connectionString,
    // Example: postgresql://user:pass@crdb-lb:26257/mydb?sslmode=verify-full
    max: POOL_MAX_CLIENTS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    maxLifetimeSeconds: MAX_LIFETIME_SECONDS,
  });

  // REQUIRED: idle client errors crash the process if unhandled
  pool.on("error", (err) => {
    console.error("Unexpected idle client error:", err.message);
  });

  return pool;
}

export { createPool };
```

**Why good:** Standard pg Pool, environment variable validation, named constants, error handler prevents process crash, `connectionTimeoutMillis` prevents infinite waits on pool exhaustion

```typescript
// Bad Example - Wrong port, no SSL
import pg from "pg";

const pool = new pg.Pool({
  host: "crdb-node-1",
  port: 5432, // WRONG -- CockroachDB default is 26257
  database: "mydb",
  user: "root",
  // No SSL -- CockroachDB Cloud requires it, self-hosted strongly recommends it
});
// No pool.on("error") handler
```

**Why bad:** Wrong port (5432 is PostgreSQL default, CockroachDB is 26257), no SSL for a distributed database, hardcoded credentials, no error handler

---

## Transaction Retry Helper (MANDATORY)

This is the most important pattern for CockroachDB. Any transaction can fail with SQLSTATE `40001` due to serialization conflicts. Your application MUST retry.

```typescript
import type pg from "pg";

const CRDB_SERIALIZATION_FAILURE = "40001";
const CRDB_STATEMENT_COMPLETION_UNKNOWN = "40003";
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 50;

const RETRYABLE_CODES = new Set([
  CRDB_SERIALIZATION_FAILURE,
  CRDB_STATEMENT_COMPLETION_UNKNOWN,
]);

interface PgError extends Error {
  code: string;
  constraint?: string;
  detail?: string;
}

function isPgError(err: unknown): err is PgError {
  return err instanceof Error && "code" in err;
}

function isCrdbRetryError(err: unknown): boolean {
  if (!isPgError(err)) return false;
  if (RETRYABLE_CODES.has(err.code)) return true;
  return err.message.startsWith("restart transaction");
}

async function withCrdbRetry<T>(
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
        // Exponential backoff with jitter
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

  throw new Error("CockroachDB retry loop exited unexpectedly");
}

export {
  withCrdbRetry,
  isCrdbRetryError,
  isPgError,
  CRDB_SERIALIZATION_FAILURE,
  CRDB_STATEMENT_COMPLETION_UNKNOWN,
};
```

**Why good:** Handles both 40001 and 40003, checks message prefix for CockroachDB-specific retry signals, exponential backoff with jitter, fresh client per attempt (avoids tainted connection state), bounded retries

**Gotcha:** Errors can occur on `COMMIT`, not just on individual statements. The retry loop above correctly catches errors from any point in the transaction including the COMMIT.

**Gotcha:** The operation callback must NOT have side effects outside the database (e.g., sending emails, making HTTP calls). If the transaction retries, the callback runs again. Keep side effects AFTER the `withCrdbRetry` call returns.

---

## Using the Retry Helper

```typescript
import type pg from "pg";

interface TransferResult {
  fromBalance: string; // numeric returns as string
  toBalance: string;
}

async function transferFunds(
  pool: pg.Pool,
  fromAccountId: string, // UUID
  toAccountId: string,
  amount: string, // numeric as string for precision
): Promise<TransferResult> {
  return withCrdbRetry(pool, async (client) => {
    // Lock rows in consistent order to reduce contention
    const { rows } = await client.query<{ id: string; balance: string }>(
      `SELECT id, balance FROM accounts
       WHERE id = ANY($1)
       ORDER BY id FOR UPDATE`,
      [[fromAccountId, toAccountId]],
    );

    const fromAccount = rows.find((r) => r.id === fromAccountId);
    const toAccount = rows.find((r) => r.id === toAccountId);

    if (!fromAccount || !toAccount) {
      throw new Error("Account not found");
    }

    if (parseFloat(fromAccount.balance) < parseFloat(amount)) {
      throw new Error("Insufficient balance");
    }

    await client.query(
      "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
      [amount, fromAccountId],
    );
    await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
      [amount, toAccountId],
    );

    return {
      fromBalance: (
        parseFloat(fromAccount.balance) - parseFloat(amount)
      ).toString(),
      toBalance: (
        parseFloat(toAccount.balance) + parseFloat(amount)
      ).toString(),
    };
  });
}

export { transferFunds };
```

**Why good:** Wrapped in `withCrdbRetry` for automatic 40001 handling, `FOR UPDATE` with `ORDER BY id` reduces contention and prevents deadlocks, UUID primary keys, numeric handled as strings

---

## Advanced Retry: SAVEPOINT cockroach_restart

CockroachDB supports a special savepoint name `cockroach_restart` that enables an advanced retry protocol. This is useful when you want CockroachDB to automatically handle retries for transactions within the server's internal buffer size.

```typescript
import type pg from "pg";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 50;

async function withSavepointRetry<T>(
  pool: pg.Pool,
  operation: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await client.query("SAVEPOINT cockroach_restart");
      try {
        const result = await operation(client);
        await client.query("RELEASE SAVEPOINT cockroach_restart");
        await client.query("COMMIT");
        return result;
      } catch (err) {
        if (isCrdbRetryError(err) && attempt < MAX_RETRIES) {
          await client.query("ROLLBACK TO SAVEPOINT cockroach_restart");
          const delay =
            BASE_DELAY_MS * Math.pow(2, attempt) +
            Math.random() * BASE_DELAY_MS;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
    throw new Error("SAVEPOINT retry loop exited unexpectedly");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { withSavepointRetry };
```

**Why good:** Uses CockroachDB's native retry protocol, single client across retries (avoids pool checkout overhead), `ROLLBACK TO SAVEPOINT` resets transaction state cleanly

**When to use:** High-contention workloads where you want to avoid the overhead of checking out a new client per retry. The standard `withCrdbRetry` (fresh client per attempt) is simpler and recommended for most cases.

---

## Parameterized Queries with UUID

```typescript
import type pg from "pg";

interface UserRow {
  id: string; // UUID
  email: string;
  name: string;
  created_at: Date;
}

// SELECT with UUID parameter
async function getUserById(
  pool: pg.Pool,
  userId: string,
): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    "SELECT id, email, name, created_at FROM users WHERE id = $1",
    [userId],
  );
  return result.rows[0];
}

// INSERT with gen_random_uuid() (database generates the UUID)
async function createUser(
  pool: pg.Pool,
  email: string,
  name: string,
): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, name)
     VALUES ($1, $2)
     RETURNING id, email, name, created_at`,
    [email, name],
  );
  return result.rows[0];
}

// Array parameter -- use ANY($1), not IN ($1)
async function getUsersByIds(
  pool: pg.Pool,
  userIds: string[],
): Promise<UserRow[]> {
  const result = await pool.query<UserRow>(
    "SELECT id, email, name, created_at FROM users WHERE id = ANY($1)",
    [userIds],
  );
  return result.rows;
}

export { getUserById, createUser, getUsersByIds };
```

**Why good:** UUID primary keys (string type in TypeScript), parameterized queries, `RETURNING` avoids a second query, `= ANY($1)` for array parameters (not `IN ($1)`)

---

## Error Handling with CockroachDB-Specific Codes

```typescript
import type pg from "pg";

// PostgreSQL SQLSTATE codes (also used by CockroachDB)
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_NOT_NULL_VIOLATION = "23502";
const PG_CHECK_VIOLATION = "23514";

// CockroachDB-specific retry codes
const CRDB_SERIALIZATION_FAILURE = "40001";
const CRDB_STATEMENT_COMPLETION_UNKNOWN = "40003";

interface PgError extends Error {
  code: string;
  constraint?: string;
  detail?: string;
  table?: string;
  column?: string;
}

function isPgError(err: unknown): err is PgError {
  return err instanceof Error && "code" in err;
}

async function createUser(
  pool: pg.Pool,
  email: string,
  name: string,
): Promise<UserRow> {
  // NOTE: this should be called INSIDE withCrdbRetry for 40001 handling
  try {
    const result = await pool.query<UserRow>(
      "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *",
      [email, name],
    );
    return result.rows[0];
  } catch (err) {
    if (!isPgError(err)) throw err;

    switch (err.code) {
      case PG_UNIQUE_VIOLATION:
        throw new ConflictError(
          `Duplicate value for constraint: ${err.constraint}`,
        );
      case PG_FOREIGN_KEY_VIOLATION:
        throw new NotFoundError(
          `Referenced entity does not exist: ${err.detail}`,
        );
      case PG_NOT_NULL_VIOLATION:
        throw new ValidationError(`Missing required field: ${err.column}`);
      case PG_CHECK_VIOLATION:
        throw new ValidationError(`Validation failed: ${err.constraint}`);
      default:
        throw err;
    }
  }
}

export {
  PG_UNIQUE_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PG_NOT_NULL_VIOLATION,
  PG_CHECK_VIOLATION,
  CRDB_SERIALIZATION_FAILURE,
  CRDB_STATEMENT_COMPLETION_UNKNOWN,
};
```

**Why good:** Named constants for all error codes, type guard for safe property access, CockroachDB uses the same PostgreSQL SQLSTATE codes for constraint violations

**Gotcha:** `40001` errors should be handled at the transaction level (by `withCrdbRetry`), not inside individual query functions. Constraint violations (23xxx) are application errors that should NOT be retried.

---

## Graceful Pool Shutdown

```typescript
import type pg from "pg";

async function gracefulShutdown(pool: pg.Pool): Promise<void> {
  console.log("Shutting down database pool...");
  await pool.end();
  console.log("Database pool closed");
}

process.on("SIGTERM", async () => {
  await gracefulShutdown(pool);
  process.exit(0);
});

process.on("SIGINT", async () => {
  await gracefulShutdown(pool);
  process.exit(0);
});
```

**Why good:** Same as PostgreSQL -- `pool.end()` drains the pool cleanly

---

## Table Schema Design

```sql
-- Good Example - CockroachDB-optimized table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  total DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  INDEX idx_orders_user_id (user_id),
  INDEX idx_orders_status (status) WHERE status != 'completed'
);
```

**Why good:** UUID primary key distributes writes, foreign key to UUID column, partial index on status reduces index size, DECIMAL for money (returned as string by pg driver)

```sql
-- Bad Example - PostgreSQL patterns that hurt CockroachDB
CREATE TABLE orders (
  id SERIAL PRIMARY KEY, -- hotspot!
  user_id INTEGER NOT NULL REFERENCES users(id), -- assumes integer PK on users
  total MONEY NOT NULL, -- MONEY type has portability issues
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now() -- use TIMESTAMPTZ, not TIMESTAMP
);
```

**Why bad:** SERIAL creates write hotspot, INTEGER FK assumes sequential PK, MONEY type has formatting issues across locales, TIMESTAMP without timezone loses timezone info

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
