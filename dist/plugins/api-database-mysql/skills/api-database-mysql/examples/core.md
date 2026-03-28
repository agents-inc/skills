# MySQL (mysql2) -- Core Examples

> Pool setup, typed queries, prepared statements, and connection lifecycle. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [transactions.md](transactions.md) -- Manual transactions, savepoints, deadlock retry
- [streaming.md](streaming.md) -- Streaming large result sets, batch inserts
- [error-handling.md](error-handling.md) -- MySQL error codes, retry strategies
- [configuration.md](configuration.md) -- SSL/TLS, named placeholders, pool tuning

---

## Pool Setup

```typescript
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

function createDatabasePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: DEFAULT_CONNECTION_LIMIT,
    maxIdle: DEFAULT_CONNECTION_LIMIT,
    idleTimeout: DEFAULT_IDLE_TIMEOUT_MS,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  return pool;
}

export { createDatabasePool };
```

**Why good:** Environment variable validation, named constants, `waitForConnections: true` queues requests instead of throwing, `enableKeepAlive` prevents stale connections from firewall timeouts

```typescript
// ❌ Bad Example - Hardcoded credentials, single connection
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password123",
  database: "mydb",
});
// Hardcoded credentials leak in version control
// Single connection cannot handle concurrent requests
// No automatic reconnection on failure
```

**Why bad:** Hardcoded credentials, single connection exhausts under concurrent load, no reconnection strategy

---

## Typed SELECT with RowDataPacket

```typescript
import type { Pool, RowDataPacket } from "mysql2/promise";

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  created_at: Date;
}

async function getUserById(
  pool: Pool,
  userId: number,
): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>(
    "SELECT id, email, name, created_at FROM users WHERE id = ?",
    [userId],
  );
  return rows[0] ?? null;
}

async function getUsersByStatus(
  pool: Pool,
  status: string,
  limit: number,
): Promise<UserRow[]> {
  const [rows] = await pool.execute<UserRow[]>(
    "SELECT id, email, name, created_at FROM users WHERE status = ? LIMIT ?",
    [status, limit],
  );
  return rows;
}

export { getUserById, getUsersByStatus };
export type { UserRow };
```

**Why good:** Interface extends `RowDataPacket` for type-safe destructuring, `execute()` uses prepared statements with LRU cache, explicit column list avoids `SELECT *`, null-safe return for missing rows

```typescript
// ❌ Bad Example - Untyped, SELECT *, string interpolation
const [rows] = await pool.query(`SELECT * FROM users WHERE id = ${userId}`);
const user = rows[0]; // type: any
```

**Why bad:** SQL injection via template literal, `any`-typed results, `SELECT *` pulls unnecessary columns and breaks on schema changes

---

## INSERT with ResultSetHeader

```typescript
import type { Pool, ResultSetHeader } from "mysql2/promise";

async function createUser(
  pool: Pool,
  email: string,
  name: string,
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users (email, name) VALUES (?, ?)",
    [email, name],
  );
  return result.insertId;
}

export { createUser };
```

**Why good:** `ResultSetHeader` provides typed access to `insertId` and `affectedRows`

---

## UPDATE and DELETE with Affected Rows

```typescript
import type { Pool, ResultSetHeader } from "mysql2/promise";

async function updateUserName(
  pool: Pool,
  userId: number,
  newName: string,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE users SET name = ? WHERE id = ?",
    [newName, userId],
  );
  // affectedRows: rows matching WHERE clause
  // changedRows is deprecated -- use affectedRows instead
  return result.affectedRows > 0;
}

async function deleteUser(pool: Pool, userId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM users WHERE id = ?",
    [userId],
  );
  return result.affectedRows > 0;
}

export { updateUserName, deleteUser };
```

**Why good:** Returns boolean indicating whether the operation found a matching row, uses `affectedRows` (not deprecated `changedRows`)

**Gotcha:** `affectedRows` counts rows matching the WHERE clause. The deprecated `changedRows` used to count rows where values actually changed -- use `affectedRows` instead and check `result.info` if you need the distinction (it contains `"Rows matched: 1  Changed: 0"` for unchanged UPDATEs).

---

## Connection Lifecycle

```typescript
import type { Pool, PoolConnection } from "mysql2/promise";

// Pattern 1: Pool convenience method (auto-acquires and releases)
async function simpleQuery(pool: Pool): Promise<void> {
  // Connection is acquired, query runs, connection is released automatically
  const [rows] = await pool.execute("SELECT 1");
}

// Pattern 2: Manual connection for multiple operations on same connection
async function multiStepOperation(pool: Pool): Promise<void> {
  const connection = await pool.getConnection();
  try {
    // All queries run on the SAME connection
    await connection.execute("SET @var = 1");
    const [rows] = await connection.execute("SELECT @var AS result");
    // Session variables, temporary tables, and locks persist across queries
  } finally {
    connection.release(); // ALWAYS release in finally
  }
}
```

**Why good:** Pattern 1 for simple queries -- zero boilerplate. Pattern 2 for when you need session state, temp tables, or transactions. `finally` block guarantees the connection is returned to the pool.

```typescript
// ❌ Bad Example - Leaked connection
const connection = await pool.getConnection();
await connection.execute("SELECT 1");
// If execute() throws, connection is never released
// Pool eventually exhausts all connections
connection.release(); // Never reached on error
```

**Why bad:** No `finally` block means the connection leaks on any error, eventually exhausting the pool

---

## Graceful Shutdown

```typescript
import type { Pool } from "mysql2/promise";

async function shutdownPool(pool: Pool): Promise<void> {
  try {
    await pool.end();
  } catch (error) {
    // Pool may already be closed or connections may be in use
    console.error("Error closing pool:", (error as Error).message);
  }
}

// Usage with process signals
process.on("SIGTERM", async () => {
  await shutdownPool(pool);
  process.exit(0);
});
```

**Why good:** Graceful shutdown closes all idle connections, `SIGTERM` handler for container orchestrators

**Gotcha:** `pool.end()` immediately destroys all connections, including ones with in-flight queries. In production, drain requests before calling `pool.end()`.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
