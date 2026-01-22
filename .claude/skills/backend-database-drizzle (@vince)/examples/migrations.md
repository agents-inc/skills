# Migration Examples

Patterns for managing database schema changes with Drizzle Kit.

> **Version Note:** Drizzle Kit v1.0.0-beta.2 restructured migrations - journal.json removed, SQL files and snapshots now in separate folders per migration. Run `drizzle-kit up` to upgrade existing migrations.

---

## Migration Workflow

```bash
# 1. Make schema changes in your schema file
# 2. Generate migration
bun run drizzle-kit generate

# 3. Review generated SQL in drizzle/ directory
# 4. Apply migration (development)
bun run drizzle-kit migrate

# 5. For serverless/production, use push for direct schema sync
bun run drizzle-kit push

# 6. (v1.0.0-beta.2+) Upgrade existing migrations to new folder structure
bun run drizzle-kit up
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:pull": "drizzle-kit pull",
    "db:up": "drizzle-kit up",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## When to Use `generate` vs `push`

| Command                | Use Case          | Notes                                     |
| ---------------------- | ----------------- | ----------------------------------------- |
| `generate` + `migrate` | Development       | Trackable migration files                 |
| `push`                 | Serverless/CI     | Direct schema sync                        |
| `pull`                 | Existing DB       | Introspect schema from database           |
| `up`                   | Migration upgrade | Upgrade to v1.0.0-beta.2 folder structure |

**Critical:** Never use `push` in production with existing data without backup

---

## Migration Naming Convention

Follow this pattern for migration file names (auto-generated use timestamp prefix):

- `20242409125510_init.sql` - Timestamp-prefixed (default)
- Custom naming with `--name` flag: `drizzle-kit generate --name=add_users_table`

---

## Custom Migrations

For data migrations or unsupported DDL:

```bash
# Generate empty migration file for custom SQL
bun run drizzle-kit generate --custom --name=seed-initial-data
```

Then edit the generated file with your custom SQL.

---

## Migration Table Configuration

Configure where Drizzle stores migration history:

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    table: "__drizzle_migrations", // Custom table name (default)
    schema: "public", // PostgreSQL only - schema for migrations table
  },
});
```

---

## v1.0.0-beta.2 Migration Structure

New folder structure (eliminates Git conflicts with journal.json):

```
drizzle/
  0001_migration_name/
    migration.sql      # SQL statements
    snapshot.json      # Schema snapshot
  0002_another_migration/
    migration.sql
    snapshot.json
```

**Upgrading from older structure:**

```bash
# Run once to upgrade existing migrations
bun run drizzle-kit up
```

---

## Production Migration Patterns

### Runtime Migrations (Monolith)

Apply migrations during application startup:

```typescript
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./db";

// Run during deployment/startup
await migrate(db, { migrationsFolder: "./drizzle" });
```

### Serverless Migrations

For serverless deployments, apply migrations as a separate step:

```bash
# In CI/CD pipeline
bun run drizzle-kit migrate

# Or use push for direct sync
bun run drizzle-kit push
```

---

## See Also

- [core.md](core.md) - Drizzle Kit configuration
- [seeding.md](seeding.md) - Populating development data after migrations
- [Drizzle Kit Docs](https://orm.drizzle.team/docs/kit-overview) - Official documentation
- [v1.0.0-beta.2 Release](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2) - Migration structure changes
