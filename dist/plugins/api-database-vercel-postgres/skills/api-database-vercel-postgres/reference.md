# Vercel Postgres Reference

> Quick lookup tables and environment variable reference. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Deprecation Status

| Detail                       | Value                                    |
| ---------------------------- | ---------------------------------------- |
| Last version                 | 0.10.0                                   |
| Status                       | Deprecated (December 2024)               |
| Databases migrated to        | Neon (automatic, via Vercel Marketplace) |
| Recommended for new projects | `@neondatabase/serverless`               |

---

## API Exports

| Export                     | Import                                                        | Description                                            |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| `sql`                      | `import { sql } from "@vercel/postgres"`                      | Auto-connected tagged template (pooled)                |
| `createPool`               | `import { createPool } from "@vercel/postgres"`               | Custom connection pool                                 |
| `createClient`             | `import { createClient } from "@vercel/postgres"`             | Single direct connection                               |
| `db`                       | `import { db } from "@vercel/postgres"`                       | Alias for `sql` (pool-based access)                    |
| `postgresConnectionString` | `import { postgresConnectionString } from "@vercel/postgres"` | Returns connection URL from env vars (`pool`/`direct`) |

---

## Environment Variables

```bash
# Pooled connection (via PgBouncer -- for application queries)
POSTGRES_URL=postgresql://user:pass@endpoint-pooler.region.aws.neon.tech/dbname?sslmode=require

# Direct connection (for migrations, session features)
POSTGRES_URL_NON_POOLING=postgresql://user:pass@endpoint.region.aws.neon.tech/dbname?sslmode=require
```

These are auto-provisioned by the Vercel Marketplace integration. Pull locally with `vercel env pull .env.development.local`.

---

## `sql` Methods

| Method                    | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `` sql`...` ``            | Execute a single parameterized query (tagged template)      |
| `sql.connect()`           | Get a `VercelPoolClient` for multi-query sessions           |
| `sql.query(text, values)` | Execute a query with explicit text + params (pg-compatible) |

---

## Edge vs Node.js Runtime

| Behavior                         | Node.js                         | Edge                        |
| -------------------------------- | ------------------------------- | --------------------------- |
| Connection reuse across requests | Yes                             | No                          |
| `maxUses` setting                | Default (unlimited)             | `1` (auto-set by SDK)       |
| Multiple `sql` calls per request | Each may reuse connections      | Each opens a new connection |
| Recommended for multi-query      | `sql.connect()` or direct `sql` | `sql.connect()` (required)  |

---

## PgBouncer Transaction Mode Limitations

Through pooled connections (`POSTGRES_URL`), the following are **not supported**:

- `SET` / `RESET` statements
- `LISTEN` / `NOTIFY`
- `WITH HOLD CURSOR`
- Session-level advisory locks
- Temporary tables with `PRESERVE` / `DELETE ROWS`
- SQL-level `PREPARE` / `DEALLOCATE`

Use `POSTGRES_URL_NON_POOLING` (direct connection) for these features.

---

## Migration Cheat Sheet

| `@vercel/postgres`                       | `@neondatabase/serverless`                                 |
| ---------------------------------------- | ---------------------------------------------------------- |
| `import { sql } from "@vercel/postgres"` | `import { neon } from "@neondatabase/serverless"`          |
| `sql` auto-reads `POSTGRES_URL`          | `const sql = neon(process.env.DATABASE_URL!)`              |
| `` const { rows } = await sql`...` ``    | `` const rows = await sql`...` ``                          |
| `sql.connect()` for client               | `Pool` + `pool.connect()`                                  |
| `createPool()`                           | `new Pool({ connectionString })`                           |
| `createClient()`                         | `new Client({ connectionString })`                         |
| Transaction: `BEGIN`/`COMMIT` via client | `sql.transaction([...])` (HTTP) or client `BEGIN`/`COMMIT` |
