# PlanetScale -- Core Examples

> Driver setup, parameterized queries, transactions, and type casting patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Branching & schema change patterns:** See [branching.md](branching.md).

---

## Pattern 1: Basic Connection and Query

### Good Example -- Typed Query with Named Constants

```typescript
// lib/db.ts
import { connect, cast } from "@planetscale/database";
import type { Config, Field } from "@planetscale/database";

const DATABASE_HOST = process.env.DATABASE_HOST!;
const DATABASE_USERNAME = process.env.DATABASE_USERNAME!;
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD!;

function customCast(field: Field, value: any): any {
  if (value == null) return null;
  // Default cast already handles INT8-32, FLOAT32/64 -- only extend for BigInt, Date, boolean
  if (field.type === "INT64" || field.type === "UINT64") return BigInt(value);
  if (field.type === "DATETIME" || field.type === "TIMESTAMP")
    return new Date(value + "Z");
  if (field.type === "INT8" && field.columnLength === 1) return value === "1";
  return cast(field, value);
}

const config: Config = {
  host: DATABASE_HOST,
  username: DATABASE_USERNAME,
  password: DATABASE_PASSWORD,
  cast: customCast,
};

export const conn = connect(config);

// Usage
const ACTIVE_STATUS = "active";

export async function getActiveUsers() {
  const { rows } = await conn.execute(
    "SELECT id, name, email FROM users WHERE status = ?",
    [ACTIVE_STATUS],
  );
  return rows;
}
```

**Why good:** Named constants for credentials and status, custom cast extends default behavior for BigInt/Date/boolean types, typed Config import, connection exported for reuse, parameterized query prevents injection

### Bad Example -- Hardcoded Values, No Custom Cast

```typescript
import { connect } from "@planetscale/database";

const conn = connect({ url: "mysql://root:pass@host/db" }); // Hardcoded credentials

async function getUsers() {
  const { rows } = await conn.execute(
    "SELECT * FROM users WHERE status = 'active'",
  );
  // Default cast handles INT32 (id would be 42, not "42")
  // But: created_at is "2024-01-15 10:30:00" (string!) -- Date comparisons fail
  // And: BIGINT ids remain as strings without custom cast
  return rows;
}
```

**Why bad:** Credentials in code, `SELECT *` fetches unnecessary data, no custom cast means BIGINT/DATETIME columns are strings, hardcoded status string

---

## Pattern 2: Client Factory for Serverless

### Good Example -- Per-Request Connection

```typescript
import { Client, cast } from "@planetscale/database";
import type { Field } from "@planetscale/database";

function customCast(field: Field, value: any): any {
  if (value == null) return null;
  // Default cast already handles INT8-32 and FLOAT32/64 -- extend for BigInt and Date
  if (field.type === "INT64" || field.type === "UINT64") return BigInt(value);
  if (field.type === "DATETIME" || field.type === "TIMESTAMP")
    return new Date(value + "Z");
  if (field.type === "INT8" && field.columnLength === 1) return value === "1";
  return cast(field, value);
}

// Client is safe to create once at module level
const client = new Client({
  host: process.env.DATABASE_HOST!,
  username: process.env.DATABASE_USERNAME!,
  password: process.env.DATABASE_PASSWORD!,
  cast: customCast,
});

// Each request gets a fresh connection
export async function handleRequest(request: Request): Promise<Response> {
  const conn = client.connection();

  try {
    const PAGE_SIZE = 20;
    const { rows } = await conn.execute(
      "SELECT id, title, published_at FROM posts WHERE published = ? ORDER BY published_at DESC LIMIT ?",
      [true, PAGE_SIZE],
    );

    return new Response(JSON.stringify(rows), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";
    const INTERNAL_ERROR = 500;
    return new Response(JSON.stringify({ error: message }), {
      status: INTERNAL_ERROR,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

**Why good:** `Client` created once at module level (safe -- it's just a config holder), `client.connection()` creates a fresh connection per request, custom cast extends defaults for BigInt/Date/boolean, named constant for page size, proper error handling

---

## Pattern 3: Named Parameters

### Good Example -- Complex Query with Named Params

```typescript
import { connect } from "@planetscale/database";

const conn = connect({ url: process.env.DATABASE_URL });

interface SearchOptions {
  query: string;
  role?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_OFFSET = 0;

async function searchUsers(options: SearchOptions) {
  const { rows, size } = await conn.execute(
    `SELECT id, name, email, role
     FROM users
     WHERE name LIKE :query AND (:role IS NULL OR role = :role)
     ORDER BY name ASC
     LIMIT :limit OFFSET :offset`,
    {
      query: `%${options.query}%`,
      role: options.role ?? null,
      limit: options.limit ?? DEFAULT_PAGE_SIZE,
      offset: options.offset ?? DEFAULT_OFFSET,
    },
  );

  return { users: rows, count: size };
}
```

**Why good:** Named parameters improve readability for complex queries, nullable role handled with `IS NULL OR` pattern, named constants for defaults, `LIKE` pattern safely parameterized (the `%` is part of the value, not interpolated SQL)

### Bad Example -- Mixing Parameter Styles

```typescript
// BAD: Cannot mix positional and named parameters
const results = await conn.execute(
  "SELECT * FROM users WHERE name = ? AND role = :role",
  ["alice", { role: "admin" }], // ERROR -- pick one style
);
```

**Why bad:** A single `execute()` call must use either positional (`?` + array) or named (`:param` + object), never both

---

## Pattern 4: Transaction with Error Handling

### Good Example -- Order Creation with Inventory Check

```typescript
import { connect, cast } from "@planetscale/database";
import type { Field } from "@planetscale/database";

function numericCast(field: Field, value: any): any {
  if (value == null) return null;
  // Default cast handles INT32, FLOAT64 -- extend for INT64 (BigInt) and DECIMAL
  if (field.type === "INT64" || field.type === "UINT64") return BigInt(value);
  if (field.type === "DECIMAL") return parseFloat(value);
  return cast(field, value);
}

const conn = connect({
  url: process.env.DATABASE_URL,
  cast: numericCast,
});

interface OrderResult {
  orderId: string;
  total: number;
}

async function createOrder(
  productId: string,
  quantity: number,
  userId: string,
): Promise<OrderResult> {
  const MIN_QUANTITY = 1;

  if (quantity < MIN_QUANTITY) {
    throw new Error("Quantity must be at least 1");
  }

  return conn.transaction(async (tx) => {
    // Check stock
    const { rows: products } = await tx.execute(
      "SELECT id, stock, price FROM products WHERE id = ? FOR UPDATE",
      [productId],
    );

    if (products.length === 0) {
      throw new Error("Product not found");
    }

    const product = products[0];

    if (product.stock < quantity) {
      throw new Error(
        `Insufficient stock: ${product.stock} available, ${quantity} requested`,
      );
    }

    // Deduct inventory
    await tx.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [
      quantity,
      productId,
    ]);

    // Create order
    const total = product.price * quantity;
    const orderResult = await tx.execute(
      "INSERT INTO orders (user_id, product_id, quantity, total) VALUES (?, ?, ?, ?)",
      [userId, productId, quantity, total],
    );

    return {
      orderId: orderResult.insertId,
      total,
    };
  });
}
```

**Why good:** `FOR UPDATE` locks the product row preventing concurrent stock deductions, transaction auto-rolls back if any throw occurs, numeric cast ensures `stock` and `price` are numbers (not strings), named constant for minimum quantity, type-safe return

### Bad Example -- No Transaction for Related Operations

```typescript
// BAD: Two related operations without transaction
const {
  rows: [product],
} = await conn.execute("SELECT stock, price FROM products WHERE id = ?", [
  productId,
]);
// Another request could modify stock between these two queries!
await conn.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [
  quantity,
  productId,
]);
await conn.execute(
  "INSERT INTO orders (user_id, product_id, quantity, total) VALUES (?, ?, ?, ?)",
  [userId, productId, quantity, product.price * quantity],
);
// If INSERT fails, stock is already deducted -- inconsistent state
```

**Why bad:** Without a transaction, stock can change between SELECT and UPDATE (race condition), and a failure in the INSERT leaves inventory deducted without a corresponding order

---

## Pattern 5: Full Results with Metadata

### Good Example -- Pagination with Row Count

```typescript
import { connect } from "@planetscale/database";

const conn = connect({ url: process.env.DATABASE_URL });

const PAGE_SIZE = 20;

interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

async function getPaginatedPosts(
  page: number,
): Promise<PaginatedResult<Record<string, unknown>>> {
  const offset = page * PAGE_SIZE;

  // Fetch one extra row to determine if there are more pages
  const FETCH_EXTRA = 1;
  const { rows } = await conn.execute(
    "SELECT id, title, excerpt, published_at FROM posts WHERE published = ? ORDER BY published_at DESC LIMIT ? OFFSET ?",
    [true, PAGE_SIZE + FETCH_EXTRA, offset],
  );

  const hasMore = rows.length > PAGE_SIZE;
  const data = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return { data, page, pageSize: PAGE_SIZE, hasMore };
}
```

**Why good:** Fetches `N+1` rows to detect next page without a separate COUNT query, named constants for page size and extra fetch, typed return interface, avoids expensive `SELECT COUNT(*)` on large tables

---

## Pattern 6: Bulk Insert with Batching

### Good Example -- Batched Inserts for Large Datasets

```typescript
import { connect } from "@planetscale/database";

const conn = connect({ url: process.env.DATABASE_URL });

const BATCH_SIZE = 100;

interface UserRecord {
  name: string;
  email: string;
  role: string;
}

async function bulkInsertUsers(users: UserRecord[]): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    // Build multi-row INSERT
    const placeholders = batch.map(() => "(?, ?, ?)").join(", ");
    const values = batch.flatMap((u) => [u.name, u.email, u.role]);

    const result = await conn.execute(
      `INSERT INTO users (name, email, role) VALUES ${placeholders}`,
      values,
    );

    totalInserted += result.rowsAffected;
  }

  return totalInserted;
}
```

**Why good:** Named constant for batch size, batching avoids hitting the 64KB query limit, multi-row INSERT is faster than individual inserts, `flatMap` builds parameter array cleanly

---

## Pattern 7: DatabaseError Handling

### Good Example -- Typed Error Handling

```typescript
import { connect, DatabaseError } from "@planetscale/database";

const conn = connect({ url: process.env.DATABASE_URL });

const ALREADY_EXISTS_CODE = "ALREADY_EXISTS";
const CONFLICT_STATUS = 409;
const INTERNAL_ERROR_STATUS = 500;

async function createUser(name: string, email: string): Promise<Response> {
  try {
    const result = await conn.execute(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      [name, email],
    );

    return new Response(JSON.stringify({ id: result.insertId }), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      // DatabaseError has .status (HTTP status) and .body (VitessError with .message and .code)
      // .body.code is a Vitess gRPC status string, not a MySQL errno number
      if (error.body?.code === ALREADY_EXISTS_CODE) {
        return new Response(
          JSON.stringify({ error: "A user with this email already exists" }),
          { status: CONFLICT_STATUS },
        );
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: INTERNAL_ERROR_STATUS,
    });
  }
}
```

**Why good:** `DatabaseError` is the specific error class from the driver, `.body.code` is a Vitess gRPC status string (`"ALREADY_EXISTS"`, `"NOT_FOUND"`, etc.), named constants for error codes and HTTP statuses, user-friendly error message for duplicate entries

---

## Pattern 8: Custom Fetch for HTTP/2

### Good Example -- Using fetch-h2 for Better Performance

```typescript
import { connect } from "@planetscale/database";
import { context } from "fetch-h2";

const { fetch: h2Fetch, disconnectAll } = context();

const conn = connect({
  host: process.env.DATABASE_HOST!,
  username: process.env.DATABASE_USERNAME!,
  password: process.env.DATABASE_PASSWORD!,
  fetch: h2Fetch,
});

// Use conn.execute() as normal -- HTTP/2 multiplexing reduces latency
const { rows } = await conn.execute("SELECT id, name FROM users LIMIT 10");

// Cleanup when shutting down
await disconnectAll();
```

**Why good:** HTTP/2 multiplexing allows concurrent queries over a single TCP connection, reducing connection overhead, `disconnectAll()` cleans up on shutdown

**When to use:** Long-running Node.js servers where HTTP/2 multiplexing provides latency benefits. Not needed for serverless (single request per invocation).

---

_For branching and deploy request patterns, see [branching.md](branching.md)._
