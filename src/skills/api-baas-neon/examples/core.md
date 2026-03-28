# Neon -- Core Examples

> Driver setup, HTTP queries, WebSocket connections, and transaction patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Branching & CI/CD patterns:** See [branching.md](branching.md).

---

## Pattern 1: HTTP Query Function Setup

### Good Example -- Typed Query Client

```typescript
// lib/db.ts
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL!;

// Create the SQL tagged template function
export const sql = neon(DATABASE_URL);

// Usage in a handler
export async function getActiveUsers() {
  const ACTIVE_STATUS = "active";
  const users =
    await sql`SELECT id, name, email FROM users WHERE status = ${ACTIVE_STATUS}`;
  return users;
}
```

**Why good:** `neon()` returns a tagged template function that auto-parameterizes all interpolated values, named constant for status value, export enables reuse across handlers

### Bad Example -- String Concatenation

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(DATABASE_URL);

// BAD: sql.unsafe with user input -- SQL injection vulnerability
async function searchUsers(userInput: string) {
  return await sql`SELECT * FROM ${sql.unsafe(userInput)}`; // user controls table name!
}
```

**Why bad:** `sql.unsafe()` inserts raw SQL without parameterization -- user input can inject arbitrary SQL. Only use `sql.unsafe()` for hardcoded, trusted identifiers.

### Good Example -- Dynamic SQL with `sql.query()`

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(DATABASE_URL);

// Use sql.query() when the SQL string is in a variable
async function findByColumn(column: "email" | "username", value: string) {
  // Column name from trusted allowlist, user value parameterized via $1
  const q = `SELECT id, name FROM users WHERE ${column} = $1`;
  return await sql.query(q, [value]);
}
```

**Why good:** `sql.query()` accepts numbered placeholders (`$1`, `$2`) for safe parameterization when the query is a string variable rather than a template literal, column name from a typed allowlist (not user input)

---

## Pattern 2: Full Results with Metadata

### Good Example -- Row Count and Field Info

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(DATABASE_URL, { fullResults: true });

async function getPostsWithCount() {
  const result = await sql`SELECT id, title FROM posts WHERE published = true`;

  // result.rows -- the data rows
  // result.rowCount -- number of rows returned
  // result.fields -- column metadata (name, dataTypeID)
  // result.command -- "SELECT", "INSERT", etc.

  return {
    posts: result.rows,
    total: result.rowCount,
  };
}
```

**Why good:** `fullResults: true` provides metadata alongside data, useful for pagination and debugging without a separate COUNT query

---

## Pattern 3: Composable Query Fragments

### Good Example -- Dynamic Query Building

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(DATABASE_URL);

// Reusable filter fragments
function buildFilters(options: { status?: string; authorId?: string }) {
  const conditions: ReturnType<typeof sql>[] = [];

  if (options.status) {
    conditions.push(sql`status = ${options.status}`);
  }
  if (options.authorId) {
    conditions.push(sql`author_id = ${options.authorId}`);
  }

  if (conditions.length === 0) {
    return sql`TRUE`;
  }

  // Compose with AND -- parameters renumber automatically
  return conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);
}

const PAGE_SIZE = 25;

async function getPosts(options: {
  status?: string;
  authorId?: string;
  page: number;
}) {
  const where = buildFilters(options);
  const offset = options.page * PAGE_SIZE;

  return sql`
    SELECT id, title, created_at
    FROM posts
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;
}
```

**Why good:** Fragments compose safely with automatic parameter renumbering, typed filter function, named constant for page size, no raw string concatenation

---

## Pattern 4: HTTP Transactions

### Good Example -- Atomic Balance Transfer

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(DATABASE_URL);

async function transferFunds(fromId: string, toId: string, amount: number) {
  const MIN_TRANSFER_AMOUNT = 0;

  if (amount <= MIN_TRANSFER_AMOUNT) {
    throw new Error("Transfer amount must be positive");
  }

  // All queries execute atomically in a single HTTP round trip
  const [debit, credit] = await sql.transaction(
    (txn) => [
      txn`UPDATE accounts SET balance = balance - ${amount} WHERE id = ${fromId} RETURNING balance`,
      txn`UPDATE accounts SET balance = balance + ${amount} WHERE id = ${toId} RETURNING balance`,
    ],
    { isolationLevel: "Serializable" },
  );

  return { fromBalance: debit[0].balance, toBalance: credit[0].balance };
}
```

**Why good:** Serializable isolation prevents concurrent transfer races, function form for transaction, single HTTP round trip for both queries, RETURNING avoids a separate SELECT, named constant for validation

### Good Example -- Read-Only Transaction for Consistent Snapshots

```typescript
const [posts, stats] = await sql.transaction(
  [
    sql`SELECT id, title FROM posts ORDER BY created_at DESC LIMIT 10`,
    sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE published)::int AS published FROM posts`,
  ],
  { readOnly: true, isolationLevel: "RepeatableRead" },
);
```

**Why good:** Read-only + RepeatableRead ensures consistent snapshot across both queries, array form is concise for predetermined queries

---

## Pattern 5: WebSocket Pool in Serverless Handler

### Good Example -- Request-Scoped Pool

```typescript
import { Pool } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL!;

// Edge/serverless handler pattern
export async function handleRequest(request: Request): Promise<Response> {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const { rows } = await pool.query(
      "SELECT id, title, content FROM posts WHERE published = $1 ORDER BY created_at DESC LIMIT $2",
      [true, 10],
    );

    return new Response(JSON.stringify(rows), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  } finally {
    // ctx.waitUntil(pool.end()) if available, otherwise await
    await pool.end();
  }
}
```

**Why good:** Pool created inside handler, pool.end() in finally block, parameterized query, error handling with proper types

### Good Example -- Using ctx.waitUntil for Non-Blocking Cleanup

```typescript
// Serverless platform with ExecutionContext (e.g., edge workers)
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const pool = new Pool({ connectionString: env.DATABASE_URL });

    try {
      const { rows } = await pool.query("SELECT id, name FROM users LIMIT 10");
      return new Response(JSON.stringify(rows));
    } finally {
      // Close pool without blocking the response
      ctx.waitUntil(pool.end());
    }
  },
};
```

**Why good:** `ctx.waitUntil()` closes the pool after the response is sent, reducing latency for the client while still cleaning up connections

---

## Pattern 6: Interactive Transactions via WebSocket

### Good Example -- Multi-Step Transaction with Conditional Logic

```typescript
import { Pool } from "@neondatabase/serverless";

async function createOrderWithInventoryCheck(
  productId: string,
  quantity: number,
  userId: string,
): Promise<{ orderId: string }> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check inventory (interactive -- depends on result)
      const {
        rows: [product],
      } = await client.query(
        "SELECT id, stock, price FROM products WHERE id = $1 FOR UPDATE",
        [productId],
      );

      if (!product || product.stock < quantity) {
        await client.query("ROLLBACK");
        throw new Error("Insufficient stock");
      }

      // Deduct inventory
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [quantity, productId],
      );

      // Create order
      const {
        rows: [order],
      } = await client.query(
        "INSERT INTO orders (user_id, product_id, quantity, total) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, productId, quantity, product.price * quantity],
      );

      await client.query("COMMIT");
      return { orderId: order.id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
```

**Why good:** `FOR UPDATE` locks the row preventing concurrent stock deductions, interactive transaction (second query depends on first result), proper ROLLBACK on both error and business logic failure, client.release() + pool.end() in finally blocks

**When to use:** Interactive transactions where subsequent queries depend on results of earlier queries. For predetermined query batches, use `sql.transaction()` over HTTP instead.

---

## Pattern 7: Node.js WebSocket Configuration

### Good Example -- Configuring ws for Node.js

```typescript
// Required for Node.js v21 and below
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Set before creating any Pool/Client
neonConfig.webSocketConstructor = ws;

// Now Pool/Client work normally
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query("SELECT now()");
await pool.end();
```

**Why good:** WebSocket constructor configured before any connection is created, only needed for Node.js <= v21 (v22+ has built-in WebSocket)

**When to use:** When running `Pool`/`Client` (WebSocket mode) in Node.js versions before v22. Not needed for the `neon()` HTTP function (it uses fetch, not WebSockets).

---

## Pattern 8: Connection Timeout Handling

### Good Example -- Appropriate Timeouts for Cold Starts

```typescript
import { neon } from "@neondatabase/serverless";

const CONNECTION_TIMEOUT_MS = 15_000; // 15 seconds -- accommodates cold start + query

const sql = neon(process.env.DATABASE_URL!, {
  fetchOptions: {
    signal: AbortSignal.timeout(CONNECTION_TIMEOUT_MS),
  },
});

// For Pool/Client connections
import { Pool } from "@neondatabase/serverless";

const POOL_CONNECTION_TIMEOUT_MS = 10_000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
});
```

**Why good:** Named constants for all timeouts, 15-second HTTP timeout accommodates cold start (200-500ms) plus query execution, Pool has its own timeout config

### Bad Example -- Default Timeouts

```typescript
// BAD: No timeout configuration
const sql = neon(DATABASE_URL);
const pool = new Pool({ connectionString: DATABASE_URL });

// After 5 min idle, cold start adds 200-500ms
// Default fetch timeout may be too short, causing intermittent failures
```

**Why bad:** Default timeouts do not account for Neon's scale-to-zero cold start latency, leading to intermittent timeout errors after idle periods

---

_For branching and CI/CD patterns, see [branching.md](branching.md)._
