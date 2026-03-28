# MySQL (mysql2) -- Streaming & Batch Examples

> Streaming large result sets, batch inserts, and multiple statements. See [core.md](core.md) for pool setup and basic queries.

**Related examples:**

- [core.md](core.md) -- Pool setup, typed queries, connection lifecycle
- [transactions.md](transactions.md) -- Transactions for batch operations
- [error-handling.md](error-handling.md) -- Error handling for long-running operations

---

## Streaming Large Result Sets

Streaming uses the **callback-based** API (not `mysql2/promise`) because `.stream()` is only available on the callback `query()` return value.

```typescript
import mysql from "mysql2";
import type { RowDataPacket } from "mysql2";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  name: string;
}

const STREAM_HIGH_WATER_MARK = 100;

function createCallbackPool(): ReturnType<typeof mysql.createPool> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return mysql.createPool({ uri: url });
}

async function streamUsersToFile(
  pool: ReturnType<typeof mysql.createPool>,
  outputPath: string,
): Promise<number> {
  let count = 0;

  const queryStream = pool
    .query("SELECT id, email, name FROM users WHERE active = 1")
    .stream({ highWaterMark: STREAM_HIGH_WATER_MARK });

  const transform = new Transform({
    objectMode: true,
    transform(row: UserRow, _encoding, callback) {
      count++;
      const line = `${row.id},${row.email},${row.name}\n`;
      callback(null, line);
    },
  });

  const { createWriteStream } = await import("node:fs");
  const fileStream = createWriteStream(outputPath);

  await pipeline(queryStream, transform, fileStream);
  return count;
}

export { createCallbackPool, streamUsersToFile };
```

**Why good:** `highWaterMark` limits buffer size, `pipeline()` handles backpressure and error propagation automatically, constant memory usage regardless of result set size

**When to use:** Result sets with 10K+ rows, CSV/JSON exports, ETL pipelines, data migrations

**Gotcha:** `.stream()` is NOT available on the promise API's `execute()` or `query()`. You must use the callback-based `mysql2` import (not `mysql2/promise`) for streaming. You can still use both APIs in the same application -- create separate pool instances.

---

## Streaming with Connection (Not Pool)

When you need streaming within a transaction or on a specific connection:

```typescript
import mysql from "mysql2";
import type { RowDataPacket } from "mysql2";

interface OrderRow extends RowDataPacket {
  id: number;
  total: number;
  created_at: Date;
}

const STREAM_BATCH_SIZE = 50;

async function processLargeOrders(
  pool: ReturnType<typeof mysql.createPool>,
): Promise<number> {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        reject(err);
        return;
      }

      let processed = 0;

      const stream = connection
        .query("SELECT id, total, created_at FROM orders WHERE total > 1000")
        .stream({ highWaterMark: STREAM_BATCH_SIZE });

      stream.on("data", (row: OrderRow) => {
        processed++;
        // Process each row
      });

      stream.on("end", () => {
        connection.release();
        resolve(processed);
      });

      stream.on("error", (error) => {
        connection.release();
        reject(error);
      });
    });
  });
}

export { processLargeOrders };
```

**Why good:** Manual connection management for streaming, proper cleanup on both success and error paths

---

## Batch INSERT (Single Statement)

Insert many rows in a single query for maximum throughput.

```typescript
import type { Pool, ResultSetHeader } from "mysql2/promise";

const MAX_BATCH_SIZE = 1000;

interface NewUser {
  email: string;
  name: string;
}

async function batchInsertUsers(pool: Pool, users: NewUser[]): Promise<number> {
  if (users.length === 0) return 0;

  let totalInserted = 0;

  // Process in chunks to avoid MySQL's max_allowed_packet limit
  for (let i = 0; i < users.length; i += MAX_BATCH_SIZE) {
    const chunk = users.slice(i, i + MAX_BATCH_SIZE);

    const placeholders = chunk.map(() => "(?, ?)").join(", ");
    const values = chunk.flatMap((u) => [u.email, u.name]);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (email, name) VALUES ${placeholders}`,
      values,
    );
    totalInserted += result.affectedRows;
  }

  return totalInserted;
}

export { batchInsertUsers };
```

**Why good:** Chunking prevents exceeding `max_allowed_packet`, single INSERT per chunk is far faster than individual INSERTs, `query()` is used here because the SQL text changes per chunk (dynamic placeholder count)

**Gotcha:** `execute()` (prepared statements) cannot be used for dynamic batch inserts because the number of `?` placeholders changes per chunk. Use `query()` with parameterized values -- the parameters are still escaped, so this is safe from SQL injection.

```typescript
// ❌ Bad Example - Individual inserts in a loop
for (const user of users) {
  await pool.execute("INSERT INTO users (email, name) VALUES (?, ?)", [
    user.email,
    user.name,
  ]);
}
// 1000 users = 1000 round-trips to MySQL
```

**Why bad:** Each INSERT is a separate network round-trip, orders of magnitude slower than a single batch INSERT

---

## INSERT ... ON DUPLICATE KEY UPDATE (Upsert)

```typescript
import type { Pool, ResultSetHeader } from "mysql2/promise";

async function upsertUser(
  pool: Pool,
  email: string,
  name: string,
): Promise<{ inserted: boolean }> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (email, name) VALUES (?, ?) AS new_row
     ON DUPLICATE KEY UPDATE name = new_row.name`,
    [email, name],
  );

  // affectedRows: 1 = inserted, 2 = updated existing row
  return { inserted: result.affectedRows === 1 };
}

export { upsertUser };
```

**Why good:** Atomic upsert without separate SELECT + INSERT/UPDATE, `affectedRows` distinguishes insert from update

**Gotcha:** `affectedRows` is `1` for a new insert, `2` for an update (MySQL counts the delete + insert internally), and `0` if the row exists but no values changed. `insertId` is `0` when an existing row was updated. The `VALUES()` function in `ON DUPLICATE KEY UPDATE` is deprecated since MySQL 8.0.20 -- use row alias syntax (`AS new_row`) instead.

---

## Multiple Statements

Multiple statements in a single call require `multipleStatements: true` on the pool/connection config. This is disabled by default for security.

```typescript
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2/promise";

// Enable ONLY when needed -- security risk with user input
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
});

interface CountRow extends RowDataPacket {
  count: number;
}

async function getTableStats(
  pool: mysql.Pool,
): Promise<{ users: number; orders: number }> {
  const [results] = await pool.query<CountRow[][]>(
    "SELECT COUNT(*) AS count FROM users; SELECT COUNT(*) AS count FROM orders",
  );

  // results is an array of result sets -- one per statement
  return {
    users: results[0][0].count,
    orders: results[1][0].count,
  };
}

export { getTableStats };
```

**Why good:** Single round-trip for multiple independent queries, typed as `RowDataPacket[][]` (array of arrays)

**When to use:** Dashboard queries, statistics gathering, schema introspection -- situations where all SQL is developer-authored.

**When NOT to use:** Any query involving user input. `multipleStatements: true` allows `;`-separated injection attacks.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
