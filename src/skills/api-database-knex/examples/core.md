# Knex.js -- Core Pattern Examples

> Initialization, query builder, insert/update/delete, raw queries, TypeScript integration. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [schema-migrations.md](schema-migrations.md) -- Schema builder, createTable, alterTable, migrations, seeds
- [transactions-advanced.md](transactions-advanced.md) -- Transactions, batch insert, subqueries, pooling, multi-tenancy

---

## Knex Initialization

```typescript
import knex from "knex";
import type { Knex } from "knex";

const POOL_MIN = 0;
const POOL_MAX = 10;
const ACQUIRE_TIMEOUT_MS = 30_000;
const CONNECTION_LIFETIME_MS = 5 * 60_000;
const LIFETIME_JITTER_MS = 60_000;

function createDatabase(): Knex {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return knex({
    client: "pg",
    connection: connectionString,
    pool: {
      min: POOL_MIN,
      max: POOL_MAX,
      // Force periodic connection churn to avoid stale connections
      maxConnectionLifetimeMillis: CONNECTION_LIFETIME_MS,
      maxConnectionLifetimeJitterMillis: LIFETIME_JITTER_MS,
    },
    acquireConnectionTimeout: ACQUIRE_TIMEOUT_MS,
  });
}

export { createDatabase };
```

**Why good:** Single instance, pool min: 0 releases idle connections, connection lifetime prevents stale connections, jitter avoids thundering herd on reconnection, named constants

```typescript
// ❌ Bad Example -- Pool leak with multiple instances
import knex from "knex";

// Called on every request -- each call creates a new connection pool
async function getUser(id: number) {
  const db = knex({ client: "pg", connection: "postgres://localhost/mydb" });
  const user = await db("users").where("id", id).first();
  // db.destroy() never called -- pool leaked
  return user;
}
```

**Why bad:** New pool per call exhausts database connections, hardcoded connection string, pool never destroyed

---

## Graceful Shutdown

```typescript
import type { Knex } from "knex";

function setupGracefulShutdown(db: Knex): void {
  const shutdown = async () => {
    await db.destroy();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export { setupGracefulShutdown };
```

**Why good:** Drains connection pool before exit, handles both SIGTERM and SIGINT

---

## Query Builder -- SELECT

```typescript
import type { Knex } from "knex";

interface User {
  id: number;
  name: string;
  email: string;
  status: string;
  created_at: Date;
}

const ACTIVE_STATUS = "active";
const PAGE_SIZE = 25;

// Basic select with typed result
async function getActiveUsers(db: Knex, page: number): Promise<User[]> {
  const offset = (page - 1) * PAGE_SIZE;

  return db<User>("users")
    .select("id", "name", "email", "created_at")
    .where("status", ACTIVE_STATUS)
    .orderBy("created_at", "desc")
    .limit(PAGE_SIZE)
    .offset(offset);
}

// Join with aliased columns
async function getUsersWithOrderCount(
  db: Knex,
): Promise<Array<{ id: number; name: string; order_count: string }>> {
  return db("users")
    .select("users.id", "users.name")
    .count("orders.id as order_count")
    .leftJoin("orders", "users.id", "orders.user_id")
    .groupBy("users.id", "users.name")
    .orderBy("order_count", "desc");
}

// Complex where with OR groups
async function searchUsers(db: Knex, query: string): Promise<User[]> {
  return db<User>("users")
    .select("id", "name", "email")
    .where(function () {
      this.where("name", "ilike", `%${query}%`).orWhere(
        "email",
        "ilike",
        `%${query}%`,
      );
    })
    .andWhere("status", ACTIVE_STATUS)
    .limit(PAGE_SIZE);
}

// First row (returns undefined if not found)
async function getUserById(
  db: Knex,
  userId: number,
): Promise<User | undefined> {
  return db<User>("users")
    .select("id", "name", "email", "status")
    .where("id", userId)
    .first();
}

export { getActiveUsers, getUsersWithOrderCount, searchUsers, getUserById };
```

**Why good:** Explicit column selection, typed results, pagination with limit/offset, `.first()` for single-row queries, grouped OR conditions with callback syntax

```typescript
// ❌ Bad Example -- Overly broad query
async function getUsers(db: Knex) {
  return db("users").select("*"); // Fetches ALL columns, ALL rows -- no limit
}
```

**Why bad:** `select("*")` fetches unnecessary columns, no limit loads entire table into memory

---

## Insert / Update / Delete

```typescript
import type { Knex } from "knex";

interface NewUser {
  name: string;
  email: string;
}

// Insert with returning (PostgreSQL/MSSQL)
async function createUser(
  db: Knex,
  data: NewUser,
): Promise<{ id: number; created_at: Date }> {
  const [result] = await db("users")
    .insert({
      ...data,
      status: "active",
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning(["id", "created_at"]);

  return result;
}

// Update with returning
async function updateUserEmail(
  db: Knex,
  userId: number,
  newEmail: string,
): Promise<{ id: number; email: string; updated_at: Date }> {
  const [result] = await db("users")
    .where("id", userId)
    .update({
      email: newEmail,
      updated_at: db.fn.now(),
    })
    .returning(["id", "email", "updated_at"]);

  return result;
}

// Soft delete
async function softDeleteUser(db: Knex, userId: number): Promise<void> {
  const rowsAffected = await db("users")
    .where("id", userId)
    .update({ deleted_at: db.fn.now(), status: "deleted" });

  if (rowsAffected === 0) {
    throw new Error(`User ${userId} not found`);
  }
}

// Hard delete with validation
async function deleteUser(db: Knex, userId: number): Promise<void> {
  const rowsDeleted = await db("users").where("id", userId).del();

  if (rowsDeleted === 0) {
    throw new Error(`User ${userId} not found`);
  }
}

// Upsert (PostgreSQL, MySQL, SQLite)
async function upsertUser(
  db: Knex,
  data: NewUser & { id: number },
): Promise<void> {
  await db("users").insert(data).onConflict("id").merge(["name", "email"]); // Only update these columns on conflict
}

export { createUser, updateUserEmail, softDeleteUser, deleteUser, upsertUser };
```

**Why good:** `.returning()` avoids extra SELECT, `db.fn.now()` uses database-native timestamps, row count check catches not-found cases, `.onConflict().merge()` for upsert

```typescript
// ❌ Bad Example -- Missing WHERE on update
async function makeAdmin(db: Knex) {
  await db("users").update({ role: "admin" });
  // ALL users are now admin -- WHERE clause missing
}
```

**Why bad:** No `.where()` clause updates every row in the table

---

## Raw Queries with Safe Bindings

```typescript
import type { Knex } from "knex";

const MIN_ORDER_AMOUNT = 100;

// Value bindings with ?
async function getHighValueOrders(db: Knex, sinceDate: Date) {
  const { rows } = await db.raw(
    `SELECT o.id, o.total, u.name as customer_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     WHERE o.total > ? AND o.created_at > ?
     ORDER BY o.total DESC`,
    [MIN_ORDER_AMOUNT, sinceDate],
  );
  return rows;
}

// Identifier bindings with ??
async function getDynamicColumn(
  db: Knex,
  tableName: string,
  columnName: string,
  filterValue: string,
) {
  const { rows } = await db.raw("SELECT ?? FROM ?? WHERE ?? = ?", [
    columnName,
    tableName,
    columnName,
    filterValue,
  ]);
  return rows;
}

// Raw in WHERE clause
async function getRecentActiveUsers(db: Knex) {
  return db("users")
    .select("id", "name")
    .whereRaw("created_at > NOW() - INTERVAL '30 days'")
    .andWhereRaw("login_count > ?", [0]);
}

// Raw in SELECT (computed column)
async function getUsersWithAge(db: Knex) {
  return db("users").select(
    "id",
    "name",
    db.raw("EXTRACT(YEAR FROM AGE(birth_date)) as age"),
  );
}

export {
  getHighValueOrders,
  getDynamicColumn,
  getRecentActiveUsers,
  getUsersWithAge,
};
```

**Why good:** `?` for values, `??` for identifiers, all user input parameterized, raw SQL only where query builder can't express the query

```typescript
// ❌ Bad Example -- SQL injection via interpolation
async function findUser(db: Knex, email: string) {
  return db.raw(`SELECT * FROM users WHERE email = '${email}'`);
  // email = "'; DROP TABLE users; --" => disaster
}
```

**Why bad:** String interpolation allows SQL injection, attacker can execute arbitrary SQL

---

## TypeScript Integration

```typescript
import type { Knex } from "knex";

// Augment Knex's table type system
declare module "knex/types/tables" {
  interface User {
    id: number;
    name: string;
    email: string;
    status: "active" | "inactive" | "deleted";
    created_at: Date;
    updated_at: Date;
  }

  // CompositeTableType: separate types for select, insert, update
  interface Tables {
    users: Knex.CompositeTableType<
      // Select type (what you get back)
      User,
      // Insert type (what you provide on insert)
      Pick<User, "name" | "email"> & Partial<Pick<User, "status">>,
      // Update type (what you can update)
      Partial<Omit<User, "id" | "created_at">>
    >;
  }
}

// Usage: TypeScript infers correct types based on table name
async function typedQueries(db: Knex) {
  // Select: returns User[]
  const users = await db("users").select("id", "name");

  // Insert: requires name + email, optional status
  const [inserted] = await db("users")
    .insert({ name: "Alice", email: "alice@example.com" })
    .returning("*");

  // Update: accepts partial fields (except id, created_at)
  await db("users")
    .where("id", 1)
    .update({ name: "Bob", updated_at: new Date() });

  return { users, inserted };
}

export { typedQueries };
```

**Why good:** `CompositeTableType` gives different types for select/insert/update, type inference works with `.select()` and `.returning()`, prevents inserting read-only fields

**Important caveat:** Knex TypeScript support is best-effort. Not all query patterns can be fully type-checked. Complex joins, raw queries, and dynamic column selection may require explicit type annotations.

---

## postProcessResponse for snake_case to camelCase

```typescript
import knex from "knex";

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

const db = knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
  // Convert database snake_case columns to camelCase in results
  postProcessResponse: (result) => {
    if (Array.isArray(result)) {
      return result.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, val]) => [snakeToCamel(key), val]),
        ),
      );
    }
    return result;
  },
  // Convert camelCase identifiers to snake_case in queries
  wrapIdentifier: (value, origImpl) => {
    return origImpl(camelToSnake(value));
  },
});

export { db };
```

**Why good:** Automatic conversion between JS camelCase and DB snake_case, applied globally so every query benefits, both directions handled

**When to use:** Projects that use camelCase in TypeScript but snake_case in the database. Avoids manual conversion in every query.

**When NOT to use:** Projects that use snake_case everywhere, or projects using a separate mapping layer.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
