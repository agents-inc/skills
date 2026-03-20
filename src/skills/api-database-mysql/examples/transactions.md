# MySQL (mysql2) -- Transaction Examples

> Manual transactions, savepoints, deadlock retry, and nested operations. See [core.md](core.md) for pool setup and basic queries.

**Related examples:**

- [core.md](core.md) -- Pool setup, typed queries, connection lifecycle
- [error-handling.md](error-handling.md) -- MySQL error codes, retry strategies

---

## Basic Transaction Pattern

```typescript
import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";

async function transferFunds(
  pool: Pool,
  fromAccountId: number,
  toAccountId: number,
  amount: number,
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Debit source account (balance check in SQL prevents overdraft)
    const [debitResult] = await connection.execute<ResultSetHeader>(
      "UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?",
      [amount, fromAccountId, amount],
    );

    if (debitResult.affectedRows === 0) {
      throw new Error("Insufficient balance or account not found");
    }

    // Credit destination account
    await connection.execute<ResultSetHeader>(
      "UPDATE accounts SET balance = balance + ? WHERE id = ?",
      [amount, toAccountId],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { transferFunds };
```

**Why good:** `getConnection()` pins one connection for the entire transaction, `finally` guarantees release, `rollback()` in catch prevents partial commits, balance check in SQL is atomic with the UPDATE

```typescript
// ❌ Bad Example - Transaction on pool convenience methods
await pool.execute("BEGIN");
await pool.execute(
  "UPDATE accounts SET balance = balance - ? WHERE id = ?",
  [100, 1],
);
await pool.execute(
  "UPDATE accounts SET balance = balance + ? WHERE id = ?",
  [100, 2],
);
await pool.execute("COMMIT");
// Each pool.execute() may use a DIFFERENT connection -- transaction is split across connections
```

**Why bad:** Pool convenience methods do not guarantee the same connection -- BEGIN, queries, and COMMIT may run on different connections, completely breaking transaction isolation

---

## Transaction Helper (Reusable)

```typescript
import type { Pool, PoolConnection } from "mysql2/promise";

async function withTransaction<T>(
  pool: Pool,
  operation: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { withTransaction };
```

**Usage:**

```typescript
const orderId = await withTransaction(pool, async (conn) => {
  const [orderResult] = await conn.execute<ResultSetHeader>(
    "INSERT INTO orders (user_id, total) VALUES (?, ?)",
    [userId, total],
  );

  for (const item of items) {
    await conn.execute(
      "INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)",
      [orderResult.insertId, item.productId, item.quantity],
    );
  }

  return orderResult.insertId;
});
```

**Why good:** Encapsulates the acquire/begin/commit/rollback/release boilerplate, generic return type, caller only handles the business logic

---

## Savepoints (Nested Transaction Boundaries)

MySQL does not support nested transactions, but savepoints provide similar functionality within a transaction.

```typescript
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";

async function createOrderWithOptionalNotification(
  connection: PoolConnection,
  userId: number,
  items: Array<{ productId: number; quantity: number }>,
): Promise<number> {
  // Main transaction already started by caller

  const [orderResult] = await connection.execute<ResultSetHeader>(
    "INSERT INTO orders (user_id, status) VALUES (?, 'pending')",
    [userId],
  );
  const orderId = orderResult.insertId;

  for (const item of items) {
    await connection.execute(
      "INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)",
      [orderId, item.productId, item.quantity],
    );
  }

  // Savepoint for optional notification -- failure should not roll back the order
  await connection.execute("SAVEPOINT notification_attempt");
  try {
    await connection.execute(
      "INSERT INTO notifications (user_id, type, reference_id) VALUES (?, 'order_created', ?)",
      [userId, orderId],
    );
  } catch {
    // Notification failed -- roll back to savepoint but keep the order
    await connection.execute("ROLLBACK TO SAVEPOINT notification_attempt");
  }
  await connection.execute("RELEASE SAVEPOINT notification_attempt");

  return orderId;
}

export { createOrderWithOptionalNotification };
```

**Why good:** Savepoint isolates optional work -- notification failure does not roll back the order, RELEASE SAVEPOINT frees server resources

**Gotcha:** Savepoints are NOT nested transactions. A top-level `ROLLBACK` rolls back everything, including all savepoints. A `ROLLBACK TO SAVEPOINT` only rolls back to that savepoint.

---

## Deadlock Retry

When MySQL detects a deadlock, it automatically rolls back one of the competing transactions and returns `ER_LOCK_DEADLOCK`. The application should retry the entire transaction.

```typescript
import type { Pool } from "mysql2/promise";

const MYSQL_ER_LOCK_DEADLOCK = "ER_LOCK_DEADLOCK";
const MAX_DEADLOCK_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 100;

interface MysqlError extends Error {
  code: string;
  errno: number;
}

function isMysqlError(error: unknown): error is MysqlError {
  return error instanceof Error && "code" in error;
}

async function withDeadlockRetry<T>(
  pool: Pool,
  operation: () => Promise<T>,
  maxRetries: number = MAX_DEADLOCK_RETRIES,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isDeadlock =
        isMysqlError(error) && error.code === MYSQL_ER_LOCK_DEADLOCK;
      const hasRetriesLeft = attempt < maxRetries;

      if (isDeadlock && hasRetriesLeft) {
        // Exponential backoff with jitter
        const delay =
          RETRY_BASE_DELAY_MS * Math.pow(2, attempt) * (0.5 + Math.random());
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Exhausted deadlock retries");
}

export { withDeadlockRetry };
```

**Usage:**

```typescript
await withDeadlockRetry(pool, async () => {
  await withTransaction(pool, async (conn) => {
    await conn.execute(
      "UPDATE inventory SET stock = stock - 1 WHERE product_id = ?",
      [productId],
    );
    await conn.execute(
      "INSERT INTO reservations (product_id, user_id) VALUES (?, ?)",
      [productId, userId],
    );
  });
});
```

**Why good:** Wraps entire transaction (not individual queries), exponential backoff with jitter prevents retry storms, configurable retry count, only retries deadlock errors -- other errors propagate immediately

**Gotcha:** The deadlocked transaction is already rolled back by MySQL when you receive `ER_LOCK_DEADLOCK`. You must retry the entire transaction from scratch, not just the last query.

---

## SELECT ... FOR UPDATE (Row Locking)

```typescript
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

interface InventoryRow extends RowDataPacket {
  product_id: number;
  stock: number;
}

async function reserveStock(
  pool: Pool,
  productId: number,
  quantity: number,
): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // FOR UPDATE locks the row until commit/rollback
    const [rows] = await connection.execute<InventoryRow[]>(
      "SELECT stock FROM inventory WHERE product_id = ? FOR UPDATE",
      [productId],
    );

    if (rows.length === 0 || rows[0].stock < quantity) {
      await connection.rollback();
      return false;
    }

    await connection.execute<ResultSetHeader>(
      "UPDATE inventory SET stock = stock - ? WHERE product_id = ?",
      [quantity, productId],
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export { reserveStock };
```

**Why good:** `FOR UPDATE` prevents other transactions from reading or modifying the row until this transaction completes, eliminates race conditions in read-then-write patterns

**When to use:** Inventory checks, seat reservations, counter increments where the new value depends on the current value

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
