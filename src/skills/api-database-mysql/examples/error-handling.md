# MySQL (mysql2) -- Error Handling Examples

> MySQL error codes, connection errors, retry strategies, and graceful degradation. See [core.md](core.md) for pool setup and [transactions.md](transactions.md) for deadlock retry.

**Related examples:**

- [core.md](core.md) -- Pool setup, typed queries
- [transactions.md](transactions.md) -- Transaction patterns, deadlock retry
- [configuration.md](configuration.md) -- Pool tuning, monitoring events

---

## MySQL Error Type Guard

```typescript
interface MysqlError extends Error {
  code: string;
  errno: number;
  sqlState: string;
  sqlMessage: string;
}

function isMysqlError(error: unknown): error is MysqlError {
  return error instanceof Error && "code" in error && "errno" in error;
}

export { isMysqlError };
export type { MysqlError };
```

**Why good:** Type guard narrows `unknown` to structured MySQL error, allows safe access to `code`, `errno`, `sqlState`

---

## Handling ER_DUP_ENTRY (Duplicate Key)

```typescript
import type { Pool, ResultSetHeader } from "mysql2/promise";
import { isMysqlError } from "./error-utils";

const MYSQL_ER_DUP_ENTRY = "ER_DUP_ENTRY";

type CreateResult =
  | { success: true; id: number }
  | { success: false; reason: "duplicate" };

async function createUserSafe(
  pool: Pool,
  email: string,
  name: string,
): Promise<CreateResult> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO users (email, name) VALUES (?, ?)",
      [email, name],
    );
    return { success: true, id: result.insertId };
  } catch (error) {
    if (isMysqlError(error) && error.code === MYSQL_ER_DUP_ENTRY) {
      return { success: false, reason: "duplicate" };
    }
    throw error; // Re-throw unexpected errors
  }
}

export { createUserSafe };
```

**Why good:** Discriminated union return type, named constant for error code, expected errors (duplicate) return a result instead of throwing, unexpected errors propagate

```typescript
// ❌ Bad Example - Catching all errors silently
try {
  await pool.execute("INSERT INTO users (email, name) VALUES (?, ?)", [
    email,
    name,
  ]);
} catch {
  return null; // Swallows ALL errors -- connection failures, syntax errors, everything
}
```

**Why bad:** Silent catch swallows connection errors, syntax errors, and other critical failures -- only catch specific error codes

---

## Handling ER_LOCK_DEADLOCK

Deadlock handling belongs at the transaction level. See [transactions.md](transactions.md) for the full `withDeadlockRetry` pattern.

```typescript
import { isMysqlError } from "./error-utils";

const MYSQL_ER_LOCK_DEADLOCK = "ER_LOCK_DEADLOCK";

function isDeadlockError(error: unknown): boolean {
  return isMysqlError(error) && error.code === MYSQL_ER_LOCK_DEADLOCK;
}

export { isDeadlockError };
```

**Gotcha:** When MySQL detects a deadlock, it automatically rolls back the **entire transaction** for the selected victim. You cannot retry just the last query -- you must retry the entire transaction from `beginTransaction()`.

---

## Handling ER_LOCK_WAIT_TIMEOUT

```typescript
import type { Pool } from "mysql2/promise";
import { isMysqlError } from "./error-utils";

const MYSQL_ER_LOCK_WAIT_TIMEOUT = "ER_LOCK_WAIT_TIMEOUT";

async function executeWithLockTimeout<T>(
  pool: Pool,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isMysqlError(error) && error.code === MYSQL_ER_LOCK_WAIT_TIMEOUT) {
      throw new Error(
        "Operation timed out waiting for a database lock. Another transaction may be holding the lock.",
      );
    }
    throw error;
  }
}

export { executeWithLockTimeout };
```

**Gotcha:** Unlike `ER_LOCK_DEADLOCK`, a lock wait timeout does NOT automatically roll back the transaction. The transaction is still active -- you must explicitly `ROLLBACK` if you want to abort it.

---

## Connection Error Handling

```typescript
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

function createPoolWithErrorHandling(): Pool {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
  });

  // Pool-level error handler -- prevents unhandled error crashes
  pool.on("error", (err) => {
    console.error("Pool error:", err.message);
    // Do NOT exit the process -- the pool will attempt to reconnect
  });

  return pool;
}

export { createPoolWithErrorHandling };
```

**Why good:** Pool `error` event prevents process crash, pool handles reconnection automatically

**Gotcha:** The pool's `error` event fires for connection-level errors (e.g., the server closes an idle connection). Individual query errors are thrown from `execute()`/`query()` calls and are NOT emitted on the pool `error` event.

---

## Health Check Query

```typescript
import type { Pool, RowDataPacket } from "mysql2/promise";

const HEALTH_CHECK_TIMEOUT_MS = 3000;

interface HealthCheckRow extends RowDataPacket {
  result: number;
}

async function checkDatabaseHealth(pool: Pool): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<HealthCheckRow[]>({
        sql: "SELECT 1 AS result",
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      });
      return rows[0]?.result === 1;
    } finally {
      connection.release();
    }
  } catch {
    return false;
  }
}

export { checkDatabaseHealth };
```

**Why good:** Dedicated connection for health check, query-level timeout prevents hanging, returns boolean instead of throwing

---

## Error Classification Helper

```typescript
import { isMysqlError, type MysqlError } from "./error-utils";

type ErrorCategory =
  | "duplicate"
  | "deadlock"
  | "lock_timeout"
  | "connection"
  | "validation"
  | "unknown";

const ERROR_CATEGORY_MAP: Record<string, ErrorCategory> = {
  ER_DUP_ENTRY: "duplicate",
  ER_LOCK_DEADLOCK: "deadlock",
  ER_LOCK_WAIT_TIMEOUT: "lock_timeout",
  ER_DATA_TOO_LONG: "validation",
  ER_BAD_NULL_ERROR: "validation",
  ER_TRUNCATED_WRONG_VALUE: "validation",
  ER_NO_SUCH_TABLE: "validation",
  ER_BAD_FIELD_ERROR: "validation",
  ER_ACCESS_DENIED_ERROR: "connection",
  ER_BAD_DB_ERROR: "connection",
  ER_CON_COUNT_ERROR: "connection",
};

function classifyMysqlError(error: unknown): ErrorCategory {
  if (!isMysqlError(error)) return "unknown";
  return ERROR_CATEGORY_MAP[error.code] ?? "unknown";
}

function isRetryableError(error: unknown): boolean {
  const category = classifyMysqlError(error);
  return category === "deadlock" || category === "lock_timeout";
}

export { classifyMysqlError, isRetryableError };
```

**Why good:** Centralizes error classification, separates retryable from non-retryable errors, extensible map for new error codes

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
