# PostgreSQL -- Transaction Examples

> BEGIN/COMMIT/ROLLBACK, savepoints, retry logic for deadlocks, and advisory locks. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Pool setup, parameterized queries, error handling
- [streaming.md](streaming.md) -- Cursors, pg-query-stream, LISTEN/NOTIFY
- [advanced.md](advanced.md) -- Prepared statements, testing with transaction rollback

---

## Basic Transaction

```typescript
import type pg from "pg";

interface TransferResult {
  fromBalance: number;
  toBalance: number;
}

async function transferFunds(
  pool: pg.Pool,
  fromAccountId: number,
  toAccountId: number,
  amount: number,
): Promise<TransferResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock rows in consistent order to prevent deadlocks
    const { rows } = await client.query<{ id: number; balance: number }>(
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
    if (fromAccount.balance < amount) {
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

    await client.query("COMMIT");

    return {
      fromBalance: fromAccount.balance - amount,
      toBalance: toAccount.balance + amount,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { transferFunds };
```

**Why good:** `FOR UPDATE` locks rows to prevent concurrent modification, consistent `ORDER BY id` prevents deadlocks, balance check after locking prevents race conditions, ROLLBACK on any error, release in finally

---

## Transaction Helper (Reusable)

Extract the try/BEGIN/COMMIT/catch/ROLLBACK/finally/release boilerplate into a reusable helper.

```typescript
import type pg from "pg";

async function withTransaction<T>(
  pool: pg.Pool,
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { withTransaction };
```

Usage:

```typescript
const order = await withTransaction(pool, async (client) => {
  const {
    rows: [newOrder],
  } = await client.query<OrderRow>(
    "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING *",
    [userId, total],
  );

  for (const item of items) {
    await client.query(
      "INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)",
      [newOrder.id, item.productId, item.quantity],
    );
  }

  return newOrder;
});
```

**Why good:** Eliminates boilerplate, impossible to forget ROLLBACK or release, type-safe return value

---

## Savepoints (Nested Transaction Behavior)

PostgreSQL does not support nested transactions, but savepoints provide similar functionality within a transaction.

```typescript
import type pg from "pg";

async function createOrderWithOptionalDiscount(
  pool: pg.Pool,
  userId: number,
  items: Array<{ productId: number; quantity: number }>,
  discountCode: string | null,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Core order creation
    const {
      rows: [order],
    } = await client.query<{ id: number }>(
      "INSERT INTO orders (user_id) VALUES ($1) RETURNING id",
      [userId],
    );

    for (const item of items) {
      await client.query(
        "INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)",
        [order.id, item.productId, item.quantity],
      );
    }

    // Optional: apply discount -- if it fails, order still succeeds
    if (discountCode) {
      await client.query("SAVEPOINT apply_discount");
      try {
        await client.query(
          "UPDATE discount_codes SET used = true WHERE code = $1 AND used = false",
          [discountCode],
        );
        await client.query(
          "UPDATE orders SET discount_code = $1 WHERE id = $2",
          [discountCode, order.id],
        );
      } catch {
        // Discount failed -- rollback to savepoint, continue with order
        await client.query("ROLLBACK TO SAVEPOINT apply_discount");
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { createOrderWithOptionalDiscount };
```

**Why good:** Savepoint isolates optional logic -- discount failure doesn't kill the order. `ROLLBACK TO SAVEPOINT` undoes only the savepoint's changes. The outer transaction can still COMMIT.

---

## Retry Logic for Deadlocks and Serialization Failures

Deadlocks (`40P01`) and serialization failures (`40001`) are safe to retry. Wrap transactional code in a retry loop.

```typescript
import type pg from "pg";

const PG_DEADLOCK_DETECTED = "40P01";
const PG_SERIALIZATION_FAILURE = "40001";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 50;

const RETRYABLE_CODES = new Set([
  PG_DEADLOCK_DETECTED,
  PG_SERIALIZATION_FAILURE,
]);

interface PgError extends Error {
  code: string;
}

function isPgError(err: unknown): err is PgError {
  return err instanceof Error && "code" in err;
}

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

      const isRetryable = isPgError(err) && RETRYABLE_CODES.has(err.code);
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err;
      }

      // Exponential backoff with jitter
      const delay =
        BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * BASE_DELAY_MS;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      client.release();
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Retry loop exited unexpectedly");
}

export { withRetry };
```

**Why good:** Only retries errors that are safe to retry (deadlocks, serialization failures), exponential backoff with jitter prevents thundering herd, bounded retries prevent infinite loops, fresh client per attempt

---

## Advisory Locks

PostgreSQL advisory locks are application-level locks that don't lock any table rows. Use them to coordinate distributed operations.

```typescript
import type pg from "pg";

// Advisory locks use a bigint key. Use a consistent hash for string-based lock names.
const LOCK_REPORT_GENERATION = 1001;
const LOCK_CACHE_REBUILD = 1002;

async function withAdvisoryLock<T>(
  pool: pg.Pool,
  lockId: number,
  operation: (client: pg.PoolClient) => Promise<T>,
): Promise<T | null> {
  const client = await pool.connect();
  try {
    // pg_try_advisory_lock returns true if lock acquired, false if already held
    const { rows } = await client.query<{ pg_try_advisory_lock: boolean }>(
      "SELECT pg_try_advisory_lock($1)",
      [lockId],
    );

    if (!rows[0].pg_try_advisory_lock) {
      return null; // Another process holds the lock
    }

    try {
      return await operation(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
    }
  } finally {
    client.release();
  }
}

// Usage
const result = await withAdvisoryLock(
  pool,
  LOCK_REPORT_GENERATION,
  async (client) => {
    // Only one process runs this at a time across all app instances
    return generateExpensiveReport(client);
  },
);

if (result === null) {
  console.log("Report generation already in progress");
}

export { withAdvisoryLock, LOCK_REPORT_GENERATION, LOCK_CACHE_REBUILD };
```

**Why good:** `pg_try_advisory_lock` is non-blocking (returns false immediately if held), lock is released in a nested finally, named constants for lock IDs prevent collisions

**Gotcha:** Advisory locks are bound to the **session** (connection), not the transaction. If the client disconnects, the lock is automatically released. If you use `pg_advisory_xact_lock`, the lock is released when the transaction ends instead.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
