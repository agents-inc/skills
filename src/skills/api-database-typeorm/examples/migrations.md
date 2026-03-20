# TypeORM - Migration Examples

> Generate, run, revert migrations and CLI configuration. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand DataSource configuration from [core.md](core.md).

---

## DataSource for Migrations

### Good Example - Separate Export for CLI

```typescript
// data-source.ts - Used by BOTH app and migration CLI
import { DataSource } from "typeorm";
import { User } from "./entities/user.entity";
import { Post } from "./entities/post.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASS ?? "postgres",
  database: process.env.DB_NAME ?? "myapp",
  entities: [User, Post],
  migrations: ["./src/migrations/*.ts"],
  synchronize: false,
  logging: false,
});
```

**Why good:** Single DataSource file shared between app runtime and CLI, explicit entity list (no globs), migrations directory configured

**Key point:** The CLI loads this file directly via `-d` flag. It must export a `DataSource` instance (not a function).

---

## CLI Commands

### Running Migrations

```bash
# Generate migration from entity changes (auto-diff)
npx typeorm-ts-node-esm migration:generate ./src/migrations/AddUserRole -d ./src/data-source.ts

# Create empty migration (for manual SQL)
npx typeorm-ts-node-esm migration:create ./src/migrations/SeedDefaultRoles

# Run all pending migrations
npx typeorm-ts-node-esm migration:run -d ./src/data-source.ts

# Revert the last executed migration
npx typeorm-ts-node-esm migration:revert -d ./src/data-source.ts

# Show migration status
npx typeorm-ts-node-esm migration:show -d ./src/data-source.ts
```

**Key points:**

- `migration:generate` compares entities to DB schema and generates SQL diff
- `migration:revert` reverts only the LAST migration - call repeatedly to revert multiple
- Always use `typeorm-ts-node-esm` for TypeScript projects (or `typeorm-ts-node-commonjs`)
- The `-d` flag is required for run/revert/show/generate (points to DataSource file)

---

## Migration File Structure

### Good Example - Auto-Generated Migration

```typescript
// src/migrations/1710000000000-AddUserRole.ts
import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRole1710000000000 implements MigrationInterface {
  name = "AddUserRole1710000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" character varying NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_role" ON "users" ("role")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }
}
```

**Why good:** `up()` applies changes, `down()` reverts them exactly, index created with the column, timestamp ensures ordering

### Good Example - Manual Migration (Seed Data)

```typescript
// src/migrations/1710000001000-SeedDefaultRoles.ts
import type { MigrationInterface, QueryRunner } from "typeorm";

export class SeedDefaultRoles1710000001000 implements MigrationInterface {
  name = "SeedDefaultRoles1710000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "roles" ("id", "name", "description")
      VALUES
        (gen_random_uuid(), 'user', 'Default user role'),
        (gen_random_uuid(), 'admin', 'Administrator role'),
        (gen_random_uuid(), 'moderator', 'Content moderator')
      ON CONFLICT ("name") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "roles" WHERE "name" IN ('user', 'admin', 'moderator')
    `);
  }
}
```

**Why good:** `migration:create` generates empty file for manual SQL like seed data, `ON CONFLICT DO NOTHING` makes it idempotent, `down()` cleanly reverses

---

## Transaction Control in Migrations

### Good Example - Per-Migration Transaction Control

```bash
# Default: all migrations in one transaction
npx typeorm-ts-node-esm migration:run -d ./src/data-source.ts

# Each migration in its own transaction
npx typeorm-ts-node-esm migration:run -d ./src/data-source.ts --transaction each

# No transactions (for DDL that can't run in transactions, e.g., CREATE INDEX CONCURRENTLY)
npx typeorm-ts-node-esm migration:run -d ./src/data-source.ts --transaction none
```

### Good Example - Programmatic Transaction Control

```typescript
// Per-migration transaction override
export class CreateConcurrentIndex1710000002000 implements MigrationInterface {
  // This migration handles its own transaction
  transaction = false as const; // Disable auto-wrapping

  public async up(queryRunner: QueryRunner): Promise<void> {
    // CREATE INDEX CONCURRENTLY cannot run inside a transaction
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY "IDX_posts_title" ON "posts" ("title")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_posts_title"`);
  }
}
```

**Why good:** `transaction = false` disables transaction wrapping for this specific migration, necessary for PostgreSQL `CONCURRENTLY` operations

---

## Migration Workflow

### Recommended Process

```bash
# 1. Modify entity class(es)

# 2. Generate migration from diff
npx typeorm-ts-node-esm migration:generate ./src/migrations/DescribeChange -d ./src/data-source.ts

# 3. Review the generated SQL - always inspect before running!
cat ./src/migrations/*-DescribeChange.ts

# 4. Run migration on development
npx typeorm-ts-node-esm migration:run -d ./src/data-source.ts

# 5. Test the migration
# ...run tests...

# 6. If something went wrong, revert
npx typeorm-ts-node-esm migration:revert -d ./src/data-source.ts

# 7. Commit migration file with entity changes
```

**Key points:**

- Always review generated SQL before running - TypeORM can generate destructive changes
- Entity renames generate DROP + CREATE (data loss) - use manual migration for renames
- Run migrations in CI/CD pipeline, never use `synchronize: true`

---

## Common Migration Gotchas

- **Column rename = data loss**: `migration:generate` creates DROP + ADD, not ALTER RENAME. Write manual migration for renames.
- **Enum changes**: Adding/removing enum values requires manual SQL. Generated migration may fail on PostgreSQL.
- **Default value changes**: TypeORM generates ALTER for existing rows but doesn't backfill. Consider manual UPDATE in migration.
- **migration:run requires compiled JS** if not using ts-node. Compile TypeScript first or use `typeorm-ts-node-esm`.
- **Migration table**: TypeORM tracks executed migrations in `migrations` table (configurable via `migrationsTableName`). Don't delete rows from it.

---

## package.json Scripts

### Good Example - Convenient Migration Scripts

```json
{
  "scripts": {
    "migration:generate": "typeorm-ts-node-esm migration:generate -d ./src/data-source.ts",
    "migration:run": "typeorm-ts-node-esm migration:run -d ./src/data-source.ts",
    "migration:revert": "typeorm-ts-node-esm migration:revert -d ./src/data-source.ts",
    "migration:show": "typeorm-ts-node-esm migration:show -d ./src/data-source.ts",
    "migration:create": "typeorm-ts-node-esm migration:create"
  }
}
```

**Usage:** `npm run migration:generate -- ./src/migrations/AddUserEmail`

---

## Quick Reference

| Command                     | Purpose                        | Requires `-d` |
| --------------------------- | ------------------------------ | ------------- |
| `migration:generate <path>` | Auto-generate from entity diff | Yes           |
| `migration:create <path>`   | Create empty migration file    | No            |
| `migration:run`             | Execute all pending migrations | Yes           |
| `migration:revert`          | Revert last executed migration | Yes           |
| `migration:show`            | List migrations with status    | Yes           |

| Transaction Flag      | Behavior                                    |
| --------------------- | ------------------------------------------- |
| `--transaction all`   | All migrations in one transaction (default) |
| `--transaction each`  | Each migration in its own transaction       |
| `--transaction none`  | No transaction wrapping                     |
| `transaction = false` | Per-migration override (in class)           |
