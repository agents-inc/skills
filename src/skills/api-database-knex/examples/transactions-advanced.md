# Knex.js -- Transactions & Advanced Pattern Examples

> Transactions, batch insert, subqueries, connection pooling, multi-tenancy. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Initialization, query builder, insert/update/delete, raw queries
- [schema-migrations.md](schema-migrations.md) -- Schema builder, createTable, alterTable, migrations, seeds

---

## Transaction with Async/Await

```typescript
import type { Knex } from "knex";

interface OrderItem {
  product_id: number;
  quantity: number;
  price: number;
}

async function createOrder(
  db: Knex,
  userId: number,
  items: OrderItem[],
): Promise<{ orderId: number }> {
  return db.transaction(async (trx) => {
    // Create the order
    const [order] = await trx("orders")
      .insert({
        user_id: userId,
        total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        status: "pending",
        created_at: db.fn.now(),
      })
      .returning(["id"]);

    // Insert all line items
    await trx("order_items").insert(
      items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,
      })),
    );

    // Decrement inventory for each product
    for (const item of items) {
      const updated = await trx("inventory")
        .where("product_id", item.product_id)
        .andWhere("quantity", ">=", item.quantity)
        .decrement("quantity", item.quantity);

      if (updated === 0) {
        // Throwing rolls back the entire transaction
        throw new Error(
          `Insufficient inventory for product ${item.product_id}`,
        );
      }
    }

    return { orderId: order.id };
    // Auto-commits when handler completes without error
  });
}

export { createOrder };
```

**Why good:** All-or-nothing: order, items, and inventory updated atomically. Throwing inside the handler auto-rolls-back. Inventory check inside transaction prevents overselling.

```typescript
// ❌ Bad Example -- Transaction that hangs
await db.transaction((trx) => {
  // Handler does not return a promise
  trx("orders").insert({ user_id: 1 });
  trx("items").insert({ order_id: 1 });
  // Knex waits for a returned promise to commit/rollback
  // Neither trx.commit() nor a returned promise -- hangs forever
});
```

**Why bad:** Without returning a promise, Knex cannot detect when the transaction is done. The connection hangs until the acquire timeout fires, potentially exhausting the pool.

---

## Manual Transaction (Without Handler)

Useful when transaction lifecycle spans multiple function calls.

```typescript
import type { Knex } from "knex";

async function manualTransaction(db: Knex): Promise<void> {
  const trx = await db.transaction();

  try {
    await trx("accounts").where("id", 1).decrement("balance", 100);

    await trx("accounts").where("id", 2).increment("balance", 100);

    await trx.commit();
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

export { manualTransaction };
```

**Why good:** Manual control when transaction spans multiple functions, explicit commit/rollback in try/catch

**When to use:** When you need to pass the transaction object across module boundaries. Prefer the callback pattern for simpler cases.

---

## Transaction with Isolation Level

```typescript
import type { Knex } from "knex";

async function readConsistentReport(
  db: Knex,
  userId: number,
): Promise<{ balance: number; orderTotal: number }> {
  return db.transaction(
    async (trx) => {
      const account = await trx("accounts")
        .where("user_id", userId)
        .select("balance")
        .first();

      const orders = await trx("orders")
        .where("user_id", userId)
        .where("status", "pending")
        .sum("total as order_total")
        .first();

      return {
        balance: account?.balance ?? 0,
        orderTotal: parseFloat(orders?.order_total ?? "0"),
      };
    },
    { isolationLevel: "repeatable read" },
  );
}

export { readConsistentReport };
```

**Why good:** `repeatable read` ensures both queries see the same snapshot, prevents phantom reads between the two queries

---

## Batch Insert with Chunking

```typescript
import type { Knex } from "knex";

const DEFAULT_CHUNK_SIZE = 500;

// Using built-in batchInsert
async function bulkCreateUsers(
  db: Knex,
  users: Array<{ name: string; email: string }>,
): Promise<number[]> {
  const ids = await db
    .batchInsert("users", users, DEFAULT_CHUNK_SIZE)
    .returning("id");

  return ids.map((row: { id: number }) => row.id);
}

// Manual chunking with progress callback (for very large datasets)
async function bulkImportWithProgress(
  db: Knex,
  rows: Array<Record<string, unknown>>,
  tableName: string,
  onProgress?: (inserted: number, total: number) => void,
): Promise<void> {
  let inserted = 0;

  await db.transaction(async (trx) => {
    for (let i = 0; i < rows.length; i += DEFAULT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + DEFAULT_CHUNK_SIZE);
      await trx(tableName).insert(chunk);
      inserted += chunk.length;
      onProgress?.(inserted, rows.length);
    }
  });
}

export { bulkCreateUsers, bulkImportWithProgress };
```

**Why good:** `batchInsert` handles chunking and wraps in transaction automatically, manual version adds progress tracking, named constant for chunk size

**Gotcha:** `batchInsert` wraps ALL chunks in a single transaction. If one chunk fails, all previous chunks are rolled back. For partial-success behavior, insert each chunk in its own transaction.

---

## Subqueries

```typescript
import type { Knex } from "knex";

// Subquery in WHERE (correlated)
async function getUsersWithRecentOrders(
  db: Knex,
): Promise<Array<{ id: number; name: string }>> {
  return db("users")
    .select("id", "name")
    .whereExists(function () {
      this.select(db.raw("1"))
        .from("orders")
        .whereRaw("orders.user_id = users.id")
        .andWhere(
          "orders.created_at",
          ">",
          db.raw("NOW() - INTERVAL '30 days'"),
        );
    });
}

// Subquery in FROM (derived table)
async function getTopSpenders(db: Knex, limit: number) {
  const subquery = db("orders")
    .select("user_id")
    .sum("total as total_spent")
    .groupBy("user_id")
    .as("order_totals"); // Required: derived tables must have an alias

  return db("users")
    .select("users.name", "order_totals.total_spent")
    .join(subquery, "users.id", "order_totals.user_id")
    .orderBy("order_totals.total_spent", "desc")
    .limit(limit);
}

// Subquery in WHERE IN
async function getUsersInActiveTeams(db: Knex) {
  return db("users")
    .select("id", "name")
    .whereIn("team_id", function () {
      this.select("id").from("teams").where("status", "active");
    });
}

export { getUsersWithRecentOrders, getTopSpenders, getUsersInActiveTeams };
```

**Why good:** Correlated subquery with `whereExists` is efficient, derived table uses `.as()` alias (required by SQL), `whereIn` with subquery avoids fetching IDs to Node.js

**Gotcha:** Subqueries in FROM (derived tables) MUST have an `.as()` alias, otherwise the query fails.

---

## Connection Pool Monitoring

```typescript
import type { Knex } from "knex";

interface PoolStats {
  used: number;
  free: number;
  pendingAcquires: number;
  pendingCreates: number;
}

function getPoolStats(db: Knex): PoolStats {
  const pool = db.client.pool;
  return {
    used: pool.numUsed(),
    free: pool.numFree(),
    pendingAcquires: pool.numPendingAcquires(),
    pendingCreates: pool.numPendingCreates(),
  };
}

// Health check endpoint
async function healthCheck(
  db: Knex,
): Promise<{ healthy: boolean; pool: PoolStats }> {
  const pool = getPoolStats(db);

  try {
    await db.raw("SELECT 1");
    return { healthy: true, pool };
  } catch {
    return { healthy: false, pool };
  }
}

export { getPoolStats, healthCheck };
```

**Why good:** Exposes pool stats for monitoring/alerting, health check verifies connectivity, useful for load balancer probes

---

## Query Timeout

```typescript
import type { Knex } from "knex";

const QUERY_TIMEOUT_MS = 5000;

async function getReportData(db: Knex, startDate: Date, endDate: Date) {
  return db("orders")
    .select("status")
    .count("id as count")
    .sum("total as revenue")
    .whereBetween("created_at", [startDate, endDate])
    .groupBy("status")
    .timeout(QUERY_TIMEOUT_MS, { cancel: true });
}

export { getReportData };
```

**Why good:** `.timeout()` with `{ cancel: true }` sends a cancel signal to the database, preventing runaway queries from consuming server resources

**Gotcha:** Without `{ cancel: true }`, Knex only times out on the Node.js side. The query continues running on the database server, consuming resources.

---

## Multi-Tenancy with Schema

PostgreSQL schemas provide logical isolation for multi-tenant applications.

```typescript
import type { Knex } from "knex";

async function createTenantSchema(db: Knex, tenantId: string): Promise<void> {
  const schemaName = `tenant_${tenantId}`;

  // Create isolated schema
  await db.raw("CREATE SCHEMA IF NOT EXISTS ??", [schemaName]);

  // Run migrations in tenant schema
  await db.migrate.latest({
    directory: "./migrations/tenant",
    schemaName,
  });
}

function tenantQuery(db: Knex, tenantId: string): Knex {
  return db.withUserParams({ tenantId });
}

// Alternative: Use searchPath per query
async function getTenantUsers(
  db: Knex,
  tenantId: string,
): Promise<Array<{ id: number; name: string }>> {
  const schemaName = `tenant_${tenantId}`;
  return db.withSchema(schemaName).select("id", "name").from("users");
}

export { createTenantSchema, tenantQuery, getTenantUsers };
```

**Why good:** Schema-per-tenant provides logical isolation, `.withSchema()` targets the correct tenant, `IF NOT EXISTS` for idempotency

---

## Query Event Listeners

```typescript
import type { Knex } from "knex";

const SLOW_QUERY_THRESHOLD_MS = 1000;

function setupQueryLogging(db: Knex): void {
  const queryStartTimes = new Map<string, number>();

  // Track query start times (all environments)
  db.on("query", (queryData) => {
    queryStartTimes.set(queryData.__knexQueryUid, Date.now());
  });

  // Log all queries (development only)
  if (process.env.NODE_ENV === "development") {
    db.on("query", (queryData) => {
      console.log("SQL:", queryData.sql);
      console.log("Bindings:", queryData.bindings);
    });
  }

  // Log slow queries (all environments)
  db.on("query-response", (_response, queryData) => {
    const startTime = queryStartTimes.get(queryData.__knexQueryUid);
    queryStartTimes.delete(queryData.__knexQueryUid);
    if (startTime !== undefined) {
      const duration = Date.now() - startTime;
      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        console.warn(`Slow query (${duration}ms):`, queryData.sql);
      }
    }
  });

  // Log query errors
  db.on("query-error", (error, queryData) => {
    queryStartTimes.delete(queryData.__knexQueryUid);
    console.error("Query error:", error.message);
    console.error("SQL:", queryData.sql);
  });
}

export { setupQueryLogging };
```

**Why good:** Map tracks start times per query via `__knexQueryUid`, cleans up entries on response/error to prevent memory leak, development-only verbose logging, slow query detection in all environments

---

## Using knex.ref() for Column References

```typescript
import type { Knex } from "knex";

// Copy value from one column to another (in-database, no round-trip)
async function copyDisplayName(db: Knex): Promise<void> {
  await db("users")
    .whereNull("display_name")
    .update({ display_name: db.ref("name") });
}

// Use ref in join conditions with aliased columns
async function getOrdersWithUserEmail(db: Knex) {
  return db("orders")
    .select(
      "orders.id",
      "orders.total",
      db.ref("users.email").as("customer_email"),
    )
    .join("users", "users.id", "orders.user_id");
}

export { copyDisplayName, getOrdersWithUserEmail };
```

**Why good:** `db.ref()` references a column without quoting it as a string value, enables in-database column copy without fetching data to Node.js

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
