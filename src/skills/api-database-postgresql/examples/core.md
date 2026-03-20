# PostgreSQL -- Core Pattern Examples

> Pool setup, parameterized queries, typed results, and error handling. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [transactions.md](transactions.md) -- BEGIN/COMMIT/ROLLBACK, savepoints, retry logic
- [streaming.md](streaming.md) -- Cursors, pg-query-stream, LISTEN/NOTIFY
- [advanced.md](advanced.md) -- SSL/TLS, prepared statements, testing patterns

---

## Pool Setup with Full Error Handling

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

**Why good:** Environment variable validation, named constants for all config values, error handler prevents process crash, `connectionTimeoutMillis` prevents infinite waits

```typescript
// ❌ Bad Example - Hardcoded, no error handling
import pg from "pg";

const pool = new pg.Pool({
  host: "localhost",
  database: "mydb",
  user: "root",
  password: "secret123",
});

// No pool.on("error") -- idle client errors crash process
// Hardcoded credentials -- will be committed to version control
// Default connectionTimeoutMillis: 0 -- infinite wait on pool exhaustion
```

**Why bad:** Hardcoded credentials leak in version control, missing error handler crashes process, default timeout means pool exhaustion hangs forever

---

## Parameterized Queries

```typescript
import type pg from "pg";

interface UserRow {
  id: number;
  name: string;
  email: string;
  created_at: Date;
}

// Simple SELECT with parameters
async function getUserById(
  pool: pg.Pool,
  userId: number,
): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    "SELECT id, name, email, created_at FROM users WHERE id = $1",
    [userId],
  );
  return result.rows[0];
}

// INSERT with RETURNING
async function createUser(
  pool: pg.Pool,
  name: string,
  email: string,
): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at",
    [name, email],
  );
  return result.rows[0];
}

// UPDATE with rowCount check
async function updateUserEmail(
  pool: pg.Pool,
  userId: number,
  newEmail: string,
): Promise<boolean> {
  const result = await pool.query(
    "UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2",
    [newEmail, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

// DELETE
async function deleteUser(pool: pg.Pool, userId: number): Promise<boolean> {
  const result = await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  return (result.rowCount ?? 0) > 0;
}

export { getUserById, createUser, updateUserEmail, deleteUser };
```

**Why good:** Generic `<UserRow>` types result rows, `$1`/`$2` prevents injection, `RETURNING` avoids a second query, `rowCount` check for update/delete success

---

## Array Parameters

PostgreSQL array parameters have a specific gotcha: you cannot use `IN ($1)` with a JavaScript array. Use `= ANY($1)` instead.

```typescript
// ✅ Good Example - Array parameter with ANY
async function getUsersByIds(
  pool: pg.Pool,
  userIds: number[],
): Promise<UserRow[]> {
  const result = await pool.query<UserRow>(
    "SELECT id, name, email FROM users WHERE id = ANY($1)",
    [userIds], // pg auto-converts JS array to PostgreSQL array
  );
  return result.rows;
}
```

**Why good:** `= ANY($1)` works with pg's automatic array conversion; no need to generate `$1, $2, $3, ...` placeholders dynamically

```typescript
// ❌ Bad Example - IN with single parameter
const result = await pool.query("SELECT * FROM users WHERE id IN ($1)", [
  [1, 2, 3],
]);
// Error: invalid input syntax for type integer: "{1,2,3}"
// pg converts [1,2,3] to the string "{1,2,3}" which IN cannot parse
```

**Why bad:** `IN ($1)` expects a single scalar value, not an array; pg's array conversion creates a PostgreSQL array literal that IN cannot parse

---

## Error Handling with PostgreSQL Error Codes

```typescript
import type pg from "pg";

// Named constants for PostgreSQL SQLSTATE error codes
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_NOT_NULL_VIOLATION = "23502";
const PG_CHECK_VIOLATION = "23514";
const PG_DEADLOCK_DETECTED = "40P01";
const PG_SERIALIZATION_FAILURE = "40001";

// Type guard for PostgreSQL errors
interface PgError extends Error {
  code: string;
  constraint?: string;
  detail?: string;
  table?: string;
  column?: string;
  schema?: string;
}

function isPgError(err: unknown): err is PgError {
  return err instanceof Error && "code" in err;
}

// Usage: map PostgreSQL errors to application errors
async function createUser(
  pool: pg.Pool,
  email: string,
  name: string,
): Promise<UserRow> {
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
  isPgError,
  PG_UNIQUE_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PG_NOT_NULL_VIOLATION,
  PG_CHECK_VIOLATION,
  PG_DEADLOCK_DETECTED,
  PG_SERIALIZATION_FAILURE,
};
```

**Why good:** Named constants replace magic strings, type guard enables safe property access, switch on code maps to domain-specific errors, re-throws unknown errors

---

## Graceful Pool Shutdown

```typescript
import type pg from "pg";

async function gracefulShutdown(pool: pg.Pool): Promise<void> {
  console.log("Shutting down database pool...");
  await pool.end(); // Waits for checked-out clients to be released, then closes all
  console.log("Database pool closed");
}

// Wire into process signals
process.on("SIGTERM", async () => {
  await gracefulShutdown(pool);
  process.exit(0);
});

process.on("SIGINT", async () => {
  await gracefulShutdown(pool);
  process.exit(0);
});
```

**Why good:** `pool.end()` drains the pool cleanly, signal handlers prevent abrupt disconnection

**Gotcha:** `pool.end()` waits for ALL checked-out clients to be released. If any client was never released (leaked), `pool.end()` will hang forever. This is a symptom of missing `finally` blocks in `pool.connect()` usage.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
