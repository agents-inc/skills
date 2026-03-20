# PostgreSQL -- Streaming & Real-Time Examples

> Cursors, pg-query-stream for large result sets, and LISTEN/NOTIFY for real-time notifications. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Pool setup, parameterized queries, error handling
- [transactions.md](transactions.md) -- Transactions, savepoints, retry logic
- [advanced.md](advanced.md) -- Prepared statements, SSL, testing patterns

---

## Cursor-Based Batch Processing (pg-cursor)

Use `pg-cursor` when you need to process rows in batches without loading the entire result set into memory.

```typescript
import type pg from "pg";
import Cursor from "pg-cursor";

const BATCH_SIZE = 500;

async function processLargeTable(
  pool: pg.Pool,
  status: string,
  processor: (rows: OrderRow[]) => Promise<void>,
): Promise<number> {
  const client = await pool.connect();
  let totalProcessed = 0;

  try {
    const cursor = client.query(
      new Cursor(
        "SELECT id, user_id, total, status FROM orders WHERE status = $1 ORDER BY id",
        [status],
      ),
    );

    let rows = await cursor.read(BATCH_SIZE);
    while (rows.length > 0) {
      await processor(rows);
      totalProcessed += rows.length;
      rows = await cursor.read(BATCH_SIZE);
    }

    await cursor.close();
    return totalProcessed;
  } finally {
    client.release();
  }
}

interface OrderRow {
  id: number;
  user_id: number;
  total: string; // numeric comes back as string
  status: string;
}

export { processLargeTable };
```

**Why good:** Fixed memory footprint regardless of result set size, parameterized cursor query, proper client release, cursor closed explicitly

**When to use:** Processing 1,000-100,000 rows where you need to control batch size and do async work per batch.

---

## Streaming with pg-query-stream

Use `pg-query-stream` when you need a Node.js Readable stream -- ideal for piping to file writes, HTTP responses, or transform streams.

```typescript
import type pg from "pg";
import QueryStream from "pg-query-stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Transform } from "node:stream";

const STREAM_BATCH_SIZE = 100;

async function exportOrdersToCsv(
  pool: pg.Pool,
  outputPath: string,
): Promise<void> {
  const client = await pool.connect();

  try {
    const queryStream = new QueryStream(
      "SELECT id, user_id, total, created_at FROM orders ORDER BY id",
      [],
      { batchSize: STREAM_BATCH_SIZE },
    );

    const dbStream = client.query(queryStream);

    const csvTransform = new Transform({
      objectMode: true,
      transform(row, _encoding, callback) {
        const line = `${row.id},${row.user_id},${row.total},${row.created_at.toISOString()}\n`;
        callback(null, line);
      },
    });

    const fileStream = createWriteStream(outputPath);

    // Write CSV header
    fileStream.write("id,user_id,total,created_at\n");

    await pipeline(dbStream, csvTransform, fileStream);
  } finally {
    client.release();
  }
}

export { exportOrdersToCsv };
```

**Why good:** Constant memory usage for arbitrarily large tables, `pipeline` handles backpressure and error propagation, client released in finally

**When to use:** Exporting 100,000+ rows to files, HTTP streaming responses, or ETL pipelines. For smaller result sets or when you need per-batch async processing, use pg-cursor instead.

---

## LISTEN/NOTIFY -- Subscribing to PostgreSQL Notifications

LISTEN/NOTIFY is PostgreSQL's built-in pub/sub mechanism. A client executes `LISTEN channel` and receives notifications sent via `NOTIFY channel` or `pg_notify(channel, payload)`.

```typescript
import type pg from "pg";

const ORDER_CHANNEL = "order_events";

interface OrderEvent {
  orderId: number;
  action: "created" | "updated" | "canceled";
  timestamp: string;
}

async function subscribeToOrderEvents(
  pool: pg.Pool,
  handler: (event: OrderEvent) => void,
): Promise<{ unsubscribe: () => Promise<void> }> {
  // LISTEN requires a dedicated client -- it stays checked out
  const client = await pool.connect();

  client.on("notification", (msg) => {
    if (msg.channel === ORDER_CHANNEL && msg.payload) {
      try {
        const event = JSON.parse(msg.payload) as OrderEvent;
        handler(event);
      } catch (err) {
        console.error("Failed to parse notification payload:", err);
      }
    }
  });

  await client.query(`LISTEN ${ORDER_CHANNEL}`);

  return {
    unsubscribe: async () => {
      await client.query(`UNLISTEN ${ORDER_CHANNEL}`);
      client.release();
    },
  };
}

export { subscribeToOrderEvents };
export type { OrderEvent };
```

**Why good:** Dedicated client for listener, JSON payload parsing with error handling, unsubscribe releases client back to pool, typed event interface

---

## LISTEN/NOTIFY -- Publishing Notifications

Use `pg_notify()` with parameterized queries for safe payload publishing. This can use `pool.query()` since it is a single command.

```typescript
import type pg from "pg";

const ORDER_CHANNEL = "order_events";

async function publishOrderEvent(
  pool: pg.Pool,
  orderId: number,
  action: "created" | "updated" | "canceled",
): Promise<void> {
  const payload = JSON.stringify({
    orderId,
    action,
    timestamp: new Date().toISOString(),
  });

  // pg_notify() with parameterized channel and payload
  await pool.query("SELECT pg_notify($1, $2)", [ORDER_CHANNEL, payload]);
}

export { publishOrderEvent };
```

**Why good:** `pg_notify($1, $2)` is parameterized (safe from injection), `pool.query()` is fine for publishing (no need for dedicated client), JSON payload is structured

```typescript
// ❌ Bad Example - String interpolation in NOTIFY
await pool.query(`NOTIFY ${channel}, '${payload}'`);
// SQL injection if channel or payload contain quotes
// Also: NOTIFY payload is limited to 8000 bytes and must be a string literal
```

**Why bad:** String interpolation allows injection, `NOTIFY` with literal payload has an 8000-byte limit and requires manual escaping

---

## LISTEN/NOTIFY -- Database Trigger Integration

A common pattern is to fire NOTIFY from a PostgreSQL trigger so that application code is notified of data changes automatically.

```sql
-- PostgreSQL trigger function
CREATE OR REPLACE FUNCTION notify_order_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'order_events',
    json_build_object(
      'orderId', NEW.id,
      'action', TG_OP,
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to table
CREATE TRIGGER order_change_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_change();
```

**Why good:** Notifications are automatic -- no application code needed for publishing. Trigger fires within the transaction, so notification is only sent on COMMIT.

**Gotcha:** If the transaction rolls back, the notification is NOT sent. This is usually desired behavior -- you don't want to notify about changes that didn't persist.

**Gotcha:** LISTEN is NOT transactional -- `BEGIN; LISTEN channel; ROLLBACK;` still leaves the listener active. Only UNLISTEN or disconnecting removes it.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
