# Turso -- Core Examples

> Client setup, execute, batch, transactions, and import path patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Embedded replica patterns:** See [embedded-replicas.md](embedded-replicas.md).

---

## Pattern 1: Remote Client Setup

### Good Example -- Environment-Based Configuration

```typescript
// lib/db.ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export { client };
```

**Why good:** Credentials from environment variables, named export, single client instance reused across the application

### Bad Example -- Client Per Request

```typescript
// BAD: Creating a new client for every request
export async function getUsers() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const result = await client.execute("SELECT * FROM users");
  // client.close() never called -- resource leak
  return result.rows;
}
```

**Why bad:** Creates a new client (and underlying connection) per call, never closes it, wastes resources and can exhaust connection limits

---

## Pattern 2: Parameterized Queries

### Good Example -- Positional and Named Parameters

```typescript
// Positional parameters with ?
const POST_LIMIT = 20;

async function getRecentPosts(authorId: string) {
  const result = await client.execute({
    sql: "SELECT id, title, created_at FROM posts WHERE author_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [authorId, POST_LIMIT],
  });
  return result.rows;
}

// Named parameters with :prefix
async function createUser(name: string, email: string) {
  const result = await client.execute({
    sql: "INSERT INTO users (name, email) VALUES (:name, :email)",
    args: { name, email },
  });
  return { id: Number(result.lastInsertRowid) };
}
```

**Why good:** Parameterized queries prevent SQL injection, named constant for limit, named parameters are self-documenting, explicit `Number()` conversion for bigint rowid

### Bad Example -- String Concatenation

```typescript
// BAD: Building SQL with string interpolation
async function searchUsers(query: string) {
  return await client.execute(
    `SELECT * FROM users WHERE name LIKE '%${query}%'`,
  );
}
```

**Why bad:** SQL injection vulnerability, user input directly in SQL string, LIKE wildcards not escaped

---

## Pattern 3: Batch Operations

### Good Example -- Atomic Multi-Insert with Audit

```typescript
async function createTeamWithMembers(teamName: string, memberNames: string[]) {
  const statements = [
    {
      sql: "INSERT INTO teams (name) VALUES (?)",
      args: [teamName],
    },
    ...memberNames.map((name) => ({
      sql: "INSERT INTO team_members (team_id, name) VALUES (last_insert_rowid(), ?)",
      args: [name],
    })),
  ];

  const results = await client.batch(statements, "write");
  const teamId = Number(results[0].lastInsertRowid);

  return { teamId, membersCreated: memberNames.length };
}
```

**Why good:** All statements execute atomically in one round trip, `last_insert_rowid()` references the team INSERT, `"write"` mode specified, dynamic statement list from array

### Good Example -- Read-Only Batch for Dashboard Data

```typescript
async function getDashboardData(userId: string) {
  const [userResult, postsResult, statsResult] = await client.batch(
    [
      { sql: "SELECT name, email FROM users WHERE id = ?", args: [userId] },
      {
        sql: "SELECT id, title FROM posts WHERE author_id = ? ORDER BY created_at DESC LIMIT 5",
        args: [userId],
      },
      {
        sql: "SELECT count(*) as total FROM posts WHERE author_id = ?",
        args: [userId],
      },
    ],
    "read",
  );

  return {
    user: userResult.rows[0],
    recentPosts: postsResult.rows,
    totalPosts: statsResult.rows[0].total,
  };
}
```

**Why good:** `"read"` mode allows parallel execution on replicas, single round trip for three queries, destructured results for clarity

---

## Pattern 4: Interactive Transactions

### Good Example -- Conditional Logic Between Queries

```typescript
const MIN_STOCK = 0;

async function purchaseItem(
  userId: string,
  productId: string,
  quantity: number,
) {
  const tx = await client.transaction("write");

  try {
    // Check stock -- result determines next query
    const { rows } = await tx.execute({
      sql: "SELECT stock, price FROM products WHERE id = ?",
      args: [productId],
    });

    if (rows.length === 0) {
      throw new Error("Product not found");
    }

    const stock = rows[0].stock as number;
    const price = rows[0].price as number;

    if (stock - quantity < MIN_STOCK) {
      throw new Error("Insufficient stock");
    }

    const totalCost = price * quantity;

    // These statements depend on the SELECT result above
    await tx.batch([
      {
        sql: "UPDATE products SET stock = stock - ? WHERE id = ?",
        args: [quantity, productId],
      },
      {
        sql: "INSERT INTO orders (user_id, product_id, quantity, total) VALUES (?, ?, ?, ?)",
        args: [userId, productId, quantity, totalCost],
      },
      {
        sql: "UPDATE users SET balance = balance - ? WHERE id = ?",
        args: [totalCost, userId],
      },
    ]);

    await tx.commit();
    return { orderId: "created", total: totalCost };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
```

**Why good:** Interactive transaction because UPDATE amounts depend on SELECT results, `tx.batch()` groups non-dependent writes within the transaction, explicit rollback on error, named constant for stock threshold

**When to use:** When subsequent queries depend on results of earlier queries. If all statements are predetermined, use `client.batch()` instead.

---

## Pattern 5: Edge Runtime Client

### Good Example -- Cloudflare Worker

```typescript
import { createClient } from "@libsql/client/web";

interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const client = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });

    try {
      const result = await client.execute(
        "SELECT id, name FROM users LIMIT 10",
      );

      return new Response(JSON.stringify(result.rows), {
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      client.close();
    }
  },
};
```

**Why good:** `@libsql/client/web` import for edge runtime, credentials from environment bindings (not hardcoded), client.close() in finally block, typed Env interface

### Bad Example -- Wrong Import for Edge

```typescript
// BAD: Base import fails in edge runtimes
import { createClient } from "@libsql/client";
// Error: Cannot find module 'libsql' (native binding)

// BAD: Trying file: URL in edge runtime
import { createClient } from "@libsql/client/web";
const client = createClient({ url: "file:local.db" });
// Error: file: URLs not supported in @libsql/client/web
```

**Why bad:** Base import bundles native bindings unavailable in edge runtimes, `@libsql/client/web` cannot open local files

---

## Pattern 6: Row Type Safety

### Good Example -- Typed Query Results

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

async function getUserById(id: string): Promise<User | null> {
  const result = await client.execute({
    sql: "SELECT id, name, email, created_at FROM users WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id as number,
    name: row.name as string,
    email: row.email as string,
    created_at: row.created_at as string,
  };
}
```

**Why good:** Explicit type mapping from Row (which returns `Value` for each column) to a typed interface, null check for missing rows, specific column selection (not `SELECT *`)

**When to use:** When you need type-safe access to query results. The libSQL `Row` type returns `Value` (null | string | number | bigint | ArrayBuffer) for each column, so casting is necessary for typed code. If using an ORM, the ORM handles this mapping.

---

## Pattern 7: executeMultiple for Raw SQL Scripts

### Good Example -- Schema Initialization

```typescript
async function initializeSchema() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
  `);
}
```

**Why good:** `executeMultiple` is designed for DDL scripts (semicolon-separated SQL), `IF NOT EXISTS` makes it idempotent, foreign key references defined at table creation (cannot be added later in SQLite)

**When to use:** Schema setup, seed scripts, or running `.sql` dump files. Not for parameterized queries (use `execute` or `batch` instead). Not atomic -- each statement commits independently.

---

_For embedded replica patterns, see [embedded-replicas.md](embedded-replicas.md)._
