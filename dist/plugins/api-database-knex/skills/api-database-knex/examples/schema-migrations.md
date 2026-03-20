# Knex.js -- Schema & Migration Examples

> Schema builder, createTable, alterTable, migrations, seeds. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Initialization, query builder, insert/update/delete, raw queries
- [transactions-advanced.md](transactions-advanced.md) -- Transactions, batch insert, subqueries, pooling

---

## Creating Tables

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("name", 100).notNullable();
    table.string("email", 255).notNullable().unique();
    table.string("password_hash", 255).notNullable();
    table
      .enum("role", ["user", "admin", "moderator"], {
        useNative: true,
        enumName: "user_role",
      })
      .notNullable()
      .defaultTo("user");
    table.jsonb("preferences").defaultTo("{}");
    table.timestamp("email_verified_at").nullable();
    table.timestamps(true, true); // created_at, updated_at with defaults
  });

  // Orders table with foreign key
  await knex.schema.createTable("orders", (table) => {
    table.increments("id").primary();
    table
      .integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.decimal("total", 10, 2).notNullable();
    table
      .enum("status", ["pending", "paid", "shipped", "cancelled"])
      .notNullable()
      .defaultTo("pending");
    table.text("notes").nullable();
    table.timestamps(true, true);

    // Composite index for common query pattern
    table.index(["user_id", "status"], "idx_orders_user_status");
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse order to respect foreign keys
  await knex.schema.dropTable("orders");
  await knex.schema.dropTable("users");
  // Drop native enum type (PostgreSQL)
  await knex.raw("DROP TYPE IF EXISTS user_role");
}
```

**Why good:** Foreign key with cascade, composite index named explicitly, native enum with explicit type name, timestamps with defaults, down migration drops in reverse order, enum type cleaned up in down

---

## Altering Tables

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.string("phone", 20).nullable();
    table.string("avatar_url", 500).nullable();
    table.timestamp("last_login_at").nullable();
    table.index("email"); // Add index on existing column
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropIndex("email");
    table.dropColumn("last_login_at");
    table.dropColumn("avatar_url");
    table.dropColumn("phone");
  });
}
```

**Why good:** Reversible migration, index added for frequently queried column, down drops in reverse order of creation

---

## PostgreSQL-Specific: Concurrent Index and Enum Extension

Some DDL operations don't work inside transactions. Disable per-migration transaction for these.

```typescript
import type { Knex } from "knex";

// Disable transaction for this migration -- CREATE INDEX CONCURRENTLY
// cannot run inside a transaction
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  // Non-blocking index creation (PostgreSQL only)
  await knex.raw(
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders (created_at)",
  );

  // Add value to existing enum type (PostgreSQL)
  await knex.raw("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX CONCURRENTLY IF EXISTS idx_orders_created_at");
  // Note: PostgreSQL does not support removing values from an enum type
  // Dropping requires recreating the type -- omit unless truly needed
}
```

**Why good:** `config.transaction = false` required for CONCURRENTLY, IF NOT EXISTS/IF EXISTS for idempotency, explains PostgreSQL enum limitation in down migration

---

## Migration with Data Backfill

When a migration needs to modify data alongside schema changes:

```typescript
import type { Knex } from "knex";

const BATCH_SIZE = 1000;

export async function up(knex: Knex): Promise<void> {
  // Step 1: Add new column (nullable first)
  await knex.schema.alterTable("users", (table) => {
    table.string("display_name", 100).nullable();
  });

  // Step 2: Backfill data in batches
  let updated = 0;
  do {
    updated = await knex("users")
      .whereNull("display_name")
      .update({ display_name: knex.ref("name") })
      .limit(BATCH_SIZE);
  } while (updated === BATCH_SIZE);

  // Step 3: Make column NOT NULL after backfill
  await knex.schema.alterTable("users", (table) => {
    table.string("display_name", 100).notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("display_name");
  });
}
```

**Why good:** Three-step pattern (add nullable, backfill, make NOT NULL) prevents failures on existing data, batch processing avoids locking entire table, `knex.ref()` copies column value in-database without fetching to Node.js

---

## Knexfile Configuration (TypeScript)

```typescript
// knexfile.ts
import type { Knex } from "knex";

const POOL_MIN = 0;
const POOL_MAX_DEV = 5;
const POOL_MAX_PROD = 20;

const baseConfig: Partial<Knex.Config> = {
  migrations: {
    directory: "./migrations",
    extension: "ts",
    tableName: "knex_migrations",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...baseConfig,
    client: "pg",
    connection:
      process.env.DATABASE_URL ?? "postgres://localhost:5432/myapp_dev",
    pool: { min: POOL_MIN, max: POOL_MAX_DEV },
  },
  test: {
    ...baseConfig,
    client: "pg",
    connection:
      process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/myapp_test",
    pool: { min: POOL_MIN, max: POOL_MAX_DEV },
  },
  production: {
    ...baseConfig,
    client: "pg",
    connection: process.env.DATABASE_URL,
    pool: { min: POOL_MIN, max: POOL_MAX_PROD },
  },
};

export { config };
```

**Why good:** Shared base config, per-environment pool sizing, environment variables for connection strings, TypeScript migrations and seeds

---

## Migration CLI Commands

```bash
# Create a new migration
npx knex migrate:make create_users_table --knexfile knexfile.ts

# Run all pending migrations
npx knex migrate:latest --knexfile knexfile.ts

# Rollback the last batch
npx knex migrate:rollback --knexfile knexfile.ts

# Rollback ALL migrations
npx knex migrate:rollback --all --knexfile knexfile.ts

# Run the next single migration
npx knex migrate:up --knexfile knexfile.ts

# Rollback the last single migration
npx knex migrate:down --knexfile knexfile.ts

# List migration status
npx knex migrate:list --knexfile knexfile.ts
```

---

## Seeds

Seeds populate tables with initial or test data. Unlike migrations, seeds are not versioned -- they run independently.

```typescript
// seeds/01_users.ts
import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  // Truncate in correct order (child tables first)
  await knex("order_items").truncate();
  await knex("orders").truncate();
  await knex("users").truncate();

  // Insert seed data
  await knex("users").insert([
    { name: "Alice Admin", email: "alice@example.com", role: "admin" },
    { name: "Bob User", email: "bob@example.com", role: "user" },
    { name: "Carol Mod", email: "carol@example.com", role: "moderator" },
  ]);
}
```

**Why good:** Truncates in reverse dependency order, then inserts fresh data, idempotent (safe to re-run)

```bash
# Create a new seed file
npx knex seed:make 01_users --knexfile knexfile.ts

# Run all seed files
npx knex seed:run --knexfile knexfile.ts

# Run a specific seed file
npx knex seed:run --specific=01_users.ts --knexfile knexfile.ts
```

---

## View Creation

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createView("active_users_summary", (view) => {
    view.as(
      knex("users")
        .select(
          "users.id",
          "users.name",
          "users.email",
          knex.raw("COUNT(orders.id) as order_count"),
          knex.raw("COALESCE(SUM(orders.total), 0) as total_spent"),
        )
        .leftJoin("orders", "users.id", "orders.user_id")
        .where("users.status", "active")
        .groupBy("users.id", "users.name", "users.email"),
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropView("active_users_summary");
}
```

**Why good:** View encapsulates complex query, used from migrations (not ad-hoc), COALESCE handles null sums

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
