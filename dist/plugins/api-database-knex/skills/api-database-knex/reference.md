# Knex.js Quick Reference

> Query method cheat sheet, column types, pool options, anti-patterns, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Query Builder Methods

### SELECT Methods

| Method                          | Description                        | Example                                |
| ------------------------------- | ---------------------------------- | -------------------------------------- |
| `.select(columns...)`           | Select columns                     | `db("users").select("id", "name")`     |
| `.distinct(columns...)`         | Select distinct                    | `db("users").distinct("email")`        |
| `.first()`                      | Return first row (or `undefined`)  | `db("users").where("id", 1).first()`   |
| `.pluck(column)`                | Return flat array of single column | `db("users").pluck("id")`              |
| `.count(column?)`               | Count rows                         | `db("users").count("id as total")`     |
| `.sum(column)`                  | Sum values                         | `db("orders").sum("total as revenue")` |
| `.avg(column)`                  | Average values                     | `db("orders").avg("total")`            |
| `.min(column)` / `.max(column)` | Min/max value                      | `db("orders").max("total as highest")` |

### WHERE Methods

| Method                      | Description     | Example                                                                             |
| --------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `.where(col, val)`          | Equal           | `db("users").where("status", "active")`                                             |
| `.where(col, op, val)`      | Operator        | `db("users").where("age", ">", 18)`                                                 |
| `.where(obj)`               | Multiple AND    | `db("users").where({ status: "active", role: "admin" })`                            |
| `.whereNot(col, val)`       | Not equal       | `db("users").whereNot("status", "banned")`                                          |
| `.whereIn(col, arr)`        | In array        | `db("users").whereIn("id", [1, 2, 3])`                                              |
| `.whereNotIn(col, arr)`     | Not in array    | `db("users").whereNotIn("role", ["guest"])`                                         |
| `.whereNull(col)`           | Is null         | `db("users").whereNull("deleted_at")`                                               |
| `.whereNotNull(col)`        | Is not null     | `db("users").whereNotNull("email")`                                                 |
| `.whereBetween(col, range)` | Between         | `db("users").whereBetween("age", [18, 65])`                                         |
| `.whereExists(builder)`     | Subquery exists | `db("users").whereExists(db("orders").where("orders.user_id", db.ref("users.id")))` |
| `.whereRaw(sql, bindings)`  | Raw WHERE       | `db("users").whereRaw("age > ?", [18])`                                             |
| `.orWhere(col, val)`        | OR condition    | `db("users").where("role", "admin").orWhere("role", "super")`                       |

### JOIN Methods

| Method                         | Description      | Example                                                         |
| ------------------------------ | ---------------- | --------------------------------------------------------------- |
| `.join(table, col1, op, col2)` | Inner join       | `db("users").join("orders", "users.id", "=", "orders.user_id")` |
| `.leftJoin(...)`               | Left outer join  | `db("users").leftJoin("orders", "users.id", "orders.user_id")`  |
| `.rightJoin(...)`              | Right outer join | `db("users").rightJoin("orders", ...)`                          |
| `.fullOuterJoin(...)`          | Full outer join  | `db("users").fullOuterJoin("orders", ...)`                      |
| `.crossJoin(table)`            | Cross join       | `db("users").crossJoin("roles")`                                |
| `.joinRaw(sql)`                | Raw join         | `db("users").joinRaw("NATURAL JOIN orders")`                    |

### ORDER / GROUP / LIMIT

| Method                      | Description   | Example                                                        |
| --------------------------- | ------------- | -------------------------------------------------------------- |
| `.orderBy(col, dir?)`       | Sort results  | `db("users").orderBy("created_at", "desc")`                    |
| `.orderByRaw(sql)`          | Raw order     | `db("users").orderByRaw("FIELD(status, 'active', 'pending')")` |
| `.groupBy(cols...)`         | Group results | `db("orders").groupBy("user_id")`                              |
| `.having(col, op, val)`     | Filter groups | `db("orders").groupBy("user_id").having("total", ">", 100)`    |
| `.havingRaw(sql, bindings)` | Raw having    | `db("orders").havingRaw("COUNT(*) > ?", [5])`                  |
| `.limit(n)`                 | Limit results | `db("users").limit(25)`                                        |
| `.offset(n)`                | Skip results  | `db("users").offset(50)`                                       |

### MUTATION Methods

| Method                          | Description        | Example                                                  |
| ------------------------------- | ------------------ | -------------------------------------------------------- |
| `.insert(data)`                 | Insert row(s)      | `db("users").insert({ name: "Alice" })`                  |
| `.insert(data).returning(cols)` | Insert + return    | `db("users").insert({...}).returning(["id"])`            |
| `.update(data)`                 | Update rows        | `db("users").where("id", 1).update({ name: "Bob" })`     |
| `.increment(col, amount?)`      | Increment          | `db("users").where("id", 1).increment("login_count")`    |
| `.decrement(col, amount?)`      | Decrement          | `db("inventory").where("id", 1).decrement("stock", 5)`   |
| `.del()` / `.delete()`          | Delete rows        | `db("users").where("id", 1).del()`                       |
| `.onConflict(col).merge()`      | Upsert (PG/SQLite) | `db("users").insert({...}).onConflict("email").merge()`  |
| `.onConflict(col).ignore()`     | Insert or skip     | `db("users").insert({...}).onConflict("email").ignore()` |

### UTILITY Methods

| Method                             | Description           | Example                                       |
| ---------------------------------- | --------------------- | --------------------------------------------- |
| `.raw(sql, bindings)`              | Raw SQL               | `db.raw("SELECT NOW()")`                      |
| `.ref(column)`                     | Column reference      | `db.ref("users.id")`                          |
| `.fn.now(precision?)`              | Current timestamp     | `db.fn.now(6)`                                |
| `.fn.uuid()`                       | Generate UUID         | `db.fn.uuid()`                                |
| `.batchInsert(table, rows, chunk)` | Chunked insert        | `db.batchInsert("users", rows, 500)`          |
| `.timeout(ms, opts?)`              | Query timeout         | `db("users").timeout(5000, { cancel: true })` |
| `.toSQL()`                         | Inspect generated SQL | `db("users").where("id", 1).toSQL()`          |
| `.toString()`                      | SQL as string         | `db("users").where("id", 1).toString()`       |

---

## Schema Column Types

| Method                                     | SQL Type                    | Notes                                        |
| ------------------------------------------ | --------------------------- | -------------------------------------------- |
| `table.increments("id")`                   | `SERIAL` / `AUTO_INCREMENT` | Primary key by default                       |
| `table.bigIncrements("id")`                | `BIGSERIAL`                 | For large tables                             |
| `table.integer("col")`                     | `INTEGER`                   |                                              |
| `table.bigInteger("col")`                  | `BIGINT`                    |                                              |
| `table.float("col", precision?, scale?)`   | `FLOAT`                     |                                              |
| `table.decimal("col", precision?, scale?)` | `DECIMAL`                   | Use for money (e.g., 10, 2)                  |
| `table.string("col", length?)`             | `VARCHAR`                   | Default length: 255                          |
| `table.text("col", textType?)`             | `TEXT`                      | textType: "mediumtext", "longtext"           |
| `table.boolean("col")`                     | `BOOLEAN`                   |                                              |
| `table.date("col")`                        | `DATE`                      |                                              |
| `table.datetime("col", opts?)`             | `DATETIME`                  | opts: `{ precision: 6 }`                     |
| `table.timestamp("col", opts?)`            | `TIMESTAMP`                 | opts: `{ precision: 6, useTz: true }`        |
| `table.time("col", precision?)`            | `TIME`                      |                                              |
| `table.json("col")`                        | `JSON`                      |                                              |
| `table.jsonb("col")`                       | `JSONB`                     | PostgreSQL only                              |
| `table.binary("col", length?)`             | `BLOB` / `BYTEA`            |                                              |
| `table.enum("col", values, opts?)`         | `ENUM`                      | opts: `{ useNative: true, enumName: "..." }` |
| `table.uuid("col")`                        | `UUID` / `CHAR(36)`         |                                              |
| `table.specificType("col", type)`          | Custom type                 | `table.specificType("col", "CITEXT")`        |

### Column Modifiers

| Modifier                            | Description       | Example                                                      |
| ----------------------------------- | ----------------- | ------------------------------------------------------------ |
| `.primary()`                        | Primary key       | `table.uuid("id").primary()`                                 |
| `.notNullable()`                    | NOT NULL          | `table.string("name").notNullable()`                         |
| `.nullable()`                       | Allow NULL        | `table.string("bio").nullable()`                             |
| `.defaultTo(value)`                 | Default value     | `table.boolean("active").defaultTo(true)`                    |
| `.unsigned()`                       | Unsigned integer  | `table.integer("age").unsigned()`                            |
| `.unique()`                         | Unique constraint | `table.string("email").unique()`                             |
| `.index()`                          | Create index      | `table.string("slug").index()`                               |
| `.references("col").inTable("tbl")` | Foreign key       | `table.integer("user_id").references("id").inTable("users")` |
| `.onDelete("CASCADE")`              | FK delete action  | Chain after `.references()`                                  |
| `.onUpdate("CASCADE")`              | FK update action  | Chain after `.references()`                                  |
| `.comment("text")`                  | Column comment    | `table.string("code").comment("ISO country code")`           |

### Table-Level Operations

| Method                                 | Description                 | Example                                 |
| -------------------------------------- | --------------------------- | --------------------------------------- |
| `table.timestamps(true, true)`         | Add created_at + updated_at | Both with defaultTo(now)                |
| `table.index(columns, name?)`          | Composite index             | `table.index(["user_id", "status"])`    |
| `table.unique(columns, name?)`         | Composite unique            | `table.unique(["email", "tenant_id"])`  |
| `table.primary(columns)`               | Composite PK                | `table.primary(["user_id", "role_id"])` |
| `table.foreign("col").references(...)` | Named FK                    | More control than column-level          |
| `table.dropColumn("col")`              | Remove column               |                                         |
| `table.renameColumn("old", "new")`     | Rename column               |                                         |

---

## Connection Pool Options (tarn.js)

| Option                                   | Default        | Description                                                 |
| ---------------------------------------- | -------------- | ----------------------------------------------------------- |
| `pool.min`                               | `2`            | Minimum connections (set to `0` for serverless/low-traffic) |
| `pool.max`                               | `10`           | Maximum connections                                         |
| `pool.idleTimeoutMillis`                 | `30000`        | Close idle connections after this duration                  |
| `pool.reapIntervalMillis`                | `1000`         | How often to check for idle connections                     |
| `pool.createTimeoutMillis`               | `30000`        | Timeout for creating a new connection                       |
| `pool.acquireTimeoutMillis`              | `30000`        | Timeout for acquiring a connection from pool                |
| `pool.destroyTimeoutMillis`              | `5000`         | Timeout for destroying a connection                         |
| `pool.maxConnectionLifetimeMillis`       | `0` (disabled) | Force connection churn after this duration                  |
| `pool.maxConnectionLifetimeJitterMillis` | `0`            | Spread out reconnections to avoid thundering herd           |
| `pool.validate`                          | `undefined`    | Function to validate connection before reuse                |

---

## Anti-Patterns

### String Interpolation in Raw Queries

```typescript
// ANTI-PATTERN: SQL injection
const results = await db.raw(`SELECT * FROM users WHERE email = '${email}'`);
```

**Why it's wrong:** User input is directly interpolated into SQL, allowing injection attacks.

**What to do instead:** Use parameterized bindings:

```typescript
const results = await db.raw("SELECT * FROM users WHERE email = ?", [email]);
```

---

### Creating Multiple Knex Instances

```typescript
// ANTI-PATTERN: Pool leak
function queryUsers() {
  const db = require("knex")({
    client: "pg",
    connection: process.env.DATABASE_URL,
  });
  return db("users").select("*"); // Pool never destroyed
}
```

**Why it's wrong:** Each call creates a new connection pool. Pools accumulate and exhaust database connections.

**What to do instead:** Create one instance at startup, share via module export or dependency injection.

---

### Missing WHERE on Update/Delete

```typescript
// ANTI-PATTERN: Updates ALL rows
await db("users").update({ role: "admin" });
// Every single user is now an admin
```

**Why it's wrong:** Without `.where()`, the operation affects every row in the table.

**What to do instead:** Always chain `.where()` before `.update()` or `.del()`.

---

### Not Destroying Pool on Shutdown

```typescript
// ANTI-PATTERN: Process hangs
process.on("SIGTERM", () => {
  // db.destroy() never called
  // Process hangs because pool connections are still open
  process.exit(0); // Force exit -- connections not cleanly closed
});
```

**Why it's wrong:** Open pool connections keep the event loop alive. `process.exit(0)` forces termination without cleanly closing connections.

**What to do instead:**

```typescript
process.on("SIGTERM", async () => {
  await db.destroy();
  process.exit(0);
});
```

---

## Production Checklist

### Connection Management

- [ ] Single knex instance per application
- [ ] Connection string from environment variable (DATABASE_URL)
- [ ] Pool `min: 0` for serverless/low-traffic (avoids stale connections)
- [ ] Pool `max` tuned for your database's connection limit (leave headroom)
- [ ] `acquireConnectionTimeout` set (default 60s may be too long)
- [ ] `knex.destroy()` called on SIGTERM/SIGINT
- [ ] TLS/SSL configured for production databases

### Query Safety

- [ ] All `knex.raw()` calls use `?` / `??` bindings (never string interpolation)
- [ ] All `.update()` and `.del()` calls have a `.where()` clause
- [ ] `.timeout()` set on long-running queries with `{ cancel: true }`
- [ ] `.returning()` used on PostgreSQL/MSSQL inserts and updates
- [ ] No `select("*")` in production queries

### Migrations

- [ ] All schema changes in migrations (not ad-hoc `knex.schema` calls)
- [ ] Every `up()` has a corresponding `down()` for rollback
- [ ] Migration filenames use consistent timestamp format
- [ ] Migrations tested: run `migrate:latest` then `migrate:rollback` then `migrate:latest` again
- [ ] `disableTransactions` only used when necessary (e.g., PostgreSQL `CREATE INDEX CONCURRENTLY`)

### Transactions

- [ ] All multi-table writes wrapped in `knex.transaction()`
- [ ] Transaction handlers always return or await promises
- [ ] No manual `trx.commit()`/`trx.rollback()` AND returned promise (pick one)
- [ ] Isolation level set when needed (default is `read committed` on PostgreSQL)

### Monitoring

- [ ] Connection pool stats monitored: `db.client.pool.numUsed()`, `numFree()`, `numPendingAcquires()`
- [ ] Slow query logging enabled via `knex.on("query", ...)` or database-level logging
- [ ] Pool exhaustion alerts configured
- [ ] Migration state tracked (`knex_migrations` table)

---

## .returning() Behavior by Database

| Database     | `.returning()`          | Insert default return     | Notes                         |
| ------------ | ----------------------- | ------------------------- | ----------------------------- |
| PostgreSQL   | Returns `[{ id, ... }]` | `[{ id: 0 }]` (row count) | Full support                  |
| MSSQL        | Returns `[{ id, ... }]` | `[{ id: 0 }]`             | Full support                  |
| SQLite 3.35+ | Returns `[{ id, ... }]` | `[rowid]`                 | Requires SQLite 3.35+         |
| MySQL        | **Silently ignored**    | `[insertId]`              | Use `result[0]` for insert ID |
| Oracle       | Returns `[{ id, ... }]` | `[sequence]`              | Requires explicit sequence    |

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
