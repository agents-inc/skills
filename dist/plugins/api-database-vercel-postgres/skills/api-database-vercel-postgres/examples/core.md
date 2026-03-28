# Vercel Postgres -- Core Examples

> Driver setup, queries, transactions, edge patterns, and migration. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Basic Query with `sql`

### Good Example -- Tagged Template Query

```typescript
import { sql } from "@vercel/postgres";

const ACTIVE_STATUS = "active";
const PAGE_SIZE = 20;

async function getActiveUsers(page: number) {
  const offset = page * PAGE_SIZE;

  const { rows } = await sql`
    SELECT id, name, email
    FROM users
    WHERE status = ${ACTIVE_STATUS}
    ORDER BY created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  return rows;
}
```

**Why good:** Tagged template auto-parameterizes `${ACTIVE_STATUS}`, `${PAGE_SIZE}`, and `${offset}` preventing SQL injection, named constants for magic values, auto-connects from `POSTGRES_URL`

### Bad Example -- String Interpolation

```typescript
import { sql } from "@vercel/postgres";

async function getUsers(status: string) {
  // BAD: sql.query with string template -- SQL injection
  const { rows } = await sql.query(
    `SELECT * FROM users WHERE status = '${status}'`,
  );
  return rows;
}
```

**Why bad:** String interpolation bypasses parameterization, user-supplied `status` can inject arbitrary SQL

---

## Pattern 2: Insert with Returning

### Good Example -- Typed Insert

```typescript
import { sql } from "@vercel/postgres";

interface User {
  id: string;
  name: string;
  email: string;
}

async function createUser(name: string, email: string): Promise<User> {
  const { rows } = await sql<User>`
    INSERT INTO users (name, email)
    VALUES (${name}, ${email})
    RETURNING id, name, email
  `;

  return rows[0];
}
```

**Why good:** Generic type parameter `<User>` types the result rows, RETURNING avoids a separate SELECT, single tagged template call

---

## Pattern 3: Transaction with `sql.connect()`

### Good Example -- Proper Transaction Pattern

```typescript
import { sql } from "@vercel/postgres";

async function createOrderWithItems(
  userId: string,
  items: Array<{ productId: string; quantity: number; price: number }>,
) {
  const client = await sql.connect();

  try {
    await client.sql`BEGIN`;

    // Create order
    const {
      rows: [order],
    } = await client.sql`
      INSERT INTO orders (user_id, status)
      VALUES (${userId}, 'pending')
      RETURNING id
    `;

    // Insert all items
    for (const item of items) {
      await client.sql`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (${order.id}, ${item.productId}, ${item.quantity}, ${item.price})
      `;
    }

    await client.sql`COMMIT`;
    return { orderId: order.id };
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }
}
```

**Why good:** `sql.connect()` gets a dedicated client from the pool, all queries run on same connection (transaction is real), ROLLBACK on error, `client.release()` in finally prevents leaks

### Bad Example -- Transaction Without Shared Client

```typescript
import { sql } from "@vercel/postgres";

// BAD: Each sql call may hit a different pooled connection
async function badTransaction(userId: string, amount: number) {
  await sql`BEGIN`;
  await sql`UPDATE accounts SET balance = balance - ${amount} WHERE user_id = ${userId}`;
  await sql`COMMIT`;
  // BEGIN was on connection A, UPDATE on B, COMMIT on C -- no real transaction!
}
```

**Why bad:** The `sql` export uses a pool -- each call may get a different connection, making BEGIN/COMMIT meaningless across connections

---

## Pattern 4: Custom Pool Configuration

### Good Example -- Secondary Database

```typescript
import { createPool } from "@vercel/postgres";

// Connect to a different database than the default POSTGRES_URL
const analyticsPool = createPool({
  connectionString: process.env.ANALYTICS_POSTGRES_URL,
});

async function getPageViews(path: string) {
  const { rows } = await analyticsPool.sql`
    SELECT date, views
    FROM page_analytics
    WHERE path = ${path}
    ORDER BY date DESC
    LIMIT 30
  `;

  return rows;
}
```

**Why good:** `createPool()` with explicit connection string for secondary databases, pool provides same `sql` tagged template interface

---

## Pattern 5: Edge Runtime Multi-Query

### Good Example -- Shared Client on Edge

```typescript
import { sql } from "@vercel/postgres";

export const runtime = "edge";

export async function GET(request: Request) {
  // On edge, maxUses=1 means each pool.connect() opens a fresh connection.
  // Use one client for all queries to avoid opening N connections.
  const client = await sql.connect();

  try {
    const { rows: posts } = await client.sql`
      SELECT id, title, excerpt FROM posts WHERE published = true ORDER BY created_at DESC LIMIT 10
    `;

    const {
      rows: [{ count }],
    } = await client.sql`
      SELECT count(*)::int FROM posts WHERE published = true
    `;

    return Response.json({ posts, total: count });
  } finally {
    client.release();
  }
}
```

**Why good:** Single client for multiple queries on edge (avoids opening multiple connections), `client.release()` in finally

### Bad Example -- Multiple `sql` Calls on Edge

```typescript
import { sql } from "@vercel/postgres";

export const runtime = "edge";

export async function GET() {
  // BAD on edge: each sql call opens a NEW connection (maxUses=1)
  const { rows: posts } = await sql`SELECT * FROM posts LIMIT 10`;
  const { rows: users } = await sql`SELECT * FROM users LIMIT 10`;
  const { rows: tags } = await sql`SELECT * FROM tags`;
  // 3 separate connections opened and closed -- wasteful
  return Response.json({ posts, users, tags });
}
```

**Why bad:** On edge runtime, `maxUses: 1` means each `sql` call opens a new TCP/WebSocket connection, tripling connection overhead and latency

---

## Pattern 6: Direct Client for Migrations

### Good Example -- Non-Pooled Connection

```typescript
import { createClient } from "@vercel/postgres";

// createClient reads POSTGRES_URL_NON_POOLING by default (direct, no PgBouncer)
async function runMigration() {
  const client = createClient();
  await client.connect();

  try {
    await client.sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  } finally {
    await client.end();
  }
}
```

**Why good:** `createClient()` uses direct connection (`POSTGRES_URL_NON_POOLING`) which supports DDL and session features, explicit `client.end()` cleanup

**When to use:** Schema migrations, `pg_dump`, or any operation needing session-level features that PgBouncer's transaction mode strips.

---

## Pattern 7: Migration to `@neondatabase/serverless`

### Good Example -- Full Migration

```typescript
// Before (@vercel/postgres)
import { sql } from "@vercel/postgres";
const { rows } = await sql`SELECT id, name FROM users WHERE status = ${status}`;

// After (@neondatabase/serverless)
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const rows = await sql`SELECT id, name FROM users WHERE status = ${status}`;
```

**Key differences:**

- `neon()` requires an explicit connection string (typically `DATABASE_URL`) -- no auto-read from env
- `neon()` returns rows directly by default -- not `{ rows, rowCount, ... }`. Use `{ fullResults: true }` option to get the full result object
- `@neondatabase/serverless` supports HTTP transactions via `sql.transaction([...])` and composable SQL fragments

### WebSocket Pool Migration (Transactions)

```typescript
// Before (@vercel/postgres)
import { sql } from "@vercel/postgres";
const client = await sql.connect();

// After (@neondatabase/serverless)
import { Pool } from "@neondatabase/serverless";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
```

**Why good:** `Pool` from `@neondatabase/serverless` provides the same `connect()` / `release()` pattern. Transactions work identically with `BEGIN`/`COMMIT`/`ROLLBACK` on the client.

---

_For decision frameworks and API reference, see [reference.md](../reference.md)._
