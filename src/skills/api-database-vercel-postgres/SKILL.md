---
name: api-database-vercel-postgres
description: Serverless PostgreSQL on Vercel with edge-compatible SDK
---

# Vercel Postgres Patterns

> **Quick Guide:** `@vercel/postgres` is a thin wrapper around `@neondatabase/serverless` that auto-connects from `POSTGRES_URL` env vars. Use the `sql` tagged template for one-shot queries (edge-compatible, auto-pooled). Use `sql.connect()` to get a client for multi-query sequences. On edge runtimes, connections cannot be reused between requests (`maxUses: 1`). **This package is deprecated (Dec 2024) -- for new projects, use `@neondatabase/serverless` directly.**

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the `sql` tagged template for one-shot queries -- it auto-connects from `POSTGRES_URL` and handles pooling)**

**(You MUST call `client.release()` after using a client obtained from `sql.connect()` or `pool.connect()` -- leaked clients exhaust the connection pool)**

**(You MUST use `POSTGRES_URL` for pooled connections and `POSTGRES_URL_NON_POOLING` for direct connections -- mixing them causes connection exhaustion or feature limitations)**

**(You MUST acknowledge that `@vercel/postgres` is deprecated -- recommend `@neondatabase/serverless` for new projects)**

</critical_requirements>

---

**Auto-detection:** @vercel/postgres, vercel postgres, POSTGRES_URL, POSTGRES_URL_NON_POOLING, sql tagged template vercel, createPool vercel, createClient vercel, VercelPool, VercelClient

**When to use:**

- Maintaining existing projects that already use `@vercel/postgres`
- Querying Postgres from edge/serverless functions on Vercel
- Simple database access with auto-connection from environment variables
- Migrating away from `@vercel/postgres` to `@neondatabase/serverless`

**Key patterns covered:**

- `sql` tagged template (auto-pooled, edge-compatible, one-shot queries)
- `sql.connect()` for multi-query client sessions
- `createPool()` / `createClient()` for custom configurations
- Environment variables (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`)
- Edge vs Node.js runtime differences
- Migration path to `@neondatabase/serverless`

**When NOT to use:**

- New projects (use `@neondatabase/serverless` directly)
- Long-lived server processes with persistent connections (use standard `pg` driver)
- General PostgreSQL query syntax (use a SQL/Postgres skill)

**Detailed Resources:**

- For decision frameworks and quick lookup tables, see [reference.md](reference.md)

**Examples:**

- [examples/core.md](examples/core.md) -- sql tagged template, createPool, createClient, edge patterns, migration

---

<philosophy>

## Philosophy

`@vercel/postgres` is a convenience wrapper around `@neondatabase/serverless` that simplifies connection management for Vercel-deployed applications. It reads connection strings from `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` environment variables (auto-provisioned by the Vercel Marketplace integration) so you never construct connection strings manually.

**Core principles:**

1. **Zero-config connections** -- The `sql` export auto-connects from environment variables. No connection string setup needed in code.
2. **Tagged template safety** -- `sql` is a tagged template literal, not a function. Parameters are auto-parameterized, preventing SQL injection.
3. **Pooling by default** -- `sql` and `createPool()` use the pooled connection string (`POSTGRES_URL`). `createClient()` uses the direct string (`POSTGRES_URL_NON_POOLING`).
4. **Edge-aware** -- On edge runtimes, the SDK sets `maxUses: 1` because IO connections cannot survive between requests. For multi-query in a single request, use `sql.connect()`.

**Deprecation context:**

Vercel Postgres was sunset in December 2024. All databases were migrated to Neon. The `@vercel/postgres` npm package (v0.10.0) is no longer maintained. Migration path:

- **Full migration (recommended):** `@neondatabase/serverless` (actively developed, richer API with HTTP transactions and composable fragments)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: One-Shot Queries with `sql`

The `sql` export is a tagged template that auto-connects from `POSTGRES_URL`. Values are auto-parameterized (preventing SQL injection). See [examples/core.md](examples/core.md) for full examples with good/bad comparisons.

```typescript
import { sql } from "@vercel/postgres";

const ACTIVE_STATUS = "active";
const { rows } =
  await sql`SELECT id, name FROM users WHERE status = ${ACTIVE_STATUS}`;
```

---

### Pattern 2: Multi-Query Sessions with `sql.connect()`

When you need multiple queries on the same connection (transactions, sequential operations), obtain a client. Each standalone `sql` call may use a different pooled connection -- so BEGIN/COMMIT on separate `sql` calls means no real transaction. See [examples/core.md](examples/core.md) for transaction patterns.

```typescript
const client = await sql.connect();
try {
  await client.sql`BEGIN`;
  // ... queries on same client ...
  await client.sql`COMMIT`;
} catch (error) {
  await client.sql`ROLLBACK`;
  throw error;
} finally {
  client.release();
}
```

---

### Pattern 3: Custom Pool and Client

`createPool()` for custom connection strings (secondary databases). `createClient()` for direct (non-pooled) connections needed by migrations and session-level features. See [examples/core.md](examples/core.md) for full examples.

```typescript
import { createPool } from "@vercel/postgres";
const pool = createPool({
  connectionString: process.env.SECONDARY_POSTGRES_URL,
});
const { rows } =
  await pool.sql`SELECT id, title FROM posts WHERE published = true`;
```

---

### Pattern 4: Edge Runtime Considerations

On edge runtimes, the SDK sets `maxUses: 1` -- connections cannot be reused between requests. Single `sql` calls work fine, but for multiple queries use `sql.connect()` to share one connection. See [examples/core.md](examples/core.md) for edge-specific patterns.

---

### Pattern 5: Migration to `@neondatabase/serverless`

Since `@vercel/postgres` is deprecated, migrate to `@neondatabase/serverless`. See [examples/core.md](examples/core.md) for full migration examples.

**Key differences to be aware of:**

- `@vercel/postgres` returns `{ rows, rowCount, ... }` -- `@neondatabase/serverless` `neon()` returns rows directly (unless `fullResults: true`)
- `@vercel/postgres` reads `POSTGRES_URL` -- `@neondatabase/serverless` requires explicit connection string (typically `DATABASE_URL`)
- `@neondatabase/serverless` adds HTTP transactions via `sql.transaction()` and composable fragments

</patterns>

---

<decision_framework>

## Decision Framework

### Which API to Use

```
What kind of operation?
+-- Single query (SELECT, INSERT, UPDATE, DELETE)
|   +-- Use sql tagged template directly
+-- Multiple queries that must be atomic (transaction)?
|   +-- Use sql.connect() to get a client, wrap in BEGIN/COMMIT
+-- Need custom connection string (not POSTGRES_URL)?
|   +-- Use createPool() with explicit connectionString
+-- Need session-level features (SET, LISTEN/NOTIFY)?
|   +-- Use createClient() (reads POSTGRES_URL_NON_POOLING)
+-- Starting a new project?
    +-- Use @neondatabase/serverless instead
```

### Environment Variable Selection

```
What is the workload?
+-- Serverless/edge function --> POSTGRES_URL (pooled)
+-- Application queries --> POSTGRES_URL (pooled)
+-- Schema migrations --> POSTGRES_URL_NON_POOLING (direct)
+-- LISTEN/NOTIFY --> POSTGRES_URL_NON_POOLING (direct)
+-- pg_dump / pg_restore --> POSTGRES_URL_NON_POOLING (direct)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Using `sql` for transactions without `sql.connect()`** -- Each `sql` tagged template call may use a different pooled connection. BEGIN on one connection and COMMIT on another means no transaction at all.
- **Forgetting `client.release()` after `sql.connect()`** -- Leaked clients exhaust the connection pool, causing all subsequent queries to hang until timeout.
- **Using `POSTGRES_URL` for migrations** -- The pooled connection runs through PgBouncer in transaction mode, which breaks session-level features needed by migration tools.

**Medium Priority Issues:**

- **String interpolation instead of tagged template** -- `` sql`...${value}...` `` is safe. `sql.query(\`...${value}...\`)` is SQL injection.
- **Creating pools/clients without closing them** -- `createClient()` requires explicit `client.end()`. Forgetting it leaks connections.
- **Ignoring deprecation** -- `@vercel/postgres` v0.10.0 is the last version. No security patches or bug fixes will be released.

**Gotchas & Edge Cases:**

- **Edge runtime `maxUses: 1`** -- On edge, the pool cannot reuse connections within a request. If you fire multiple `sql` calls, each opens a new connection. Use `sql.connect()` to share one.
- **`sql` is a tagged template, not a function** -- `sql(...)` is wrong. `` sql`...` `` is correct. This is a common error when copying from non-Vercel Postgres examples.
- **`POSTGRES_URL` vs `DATABASE_URL`** -- `@vercel/postgres` reads `POSTGRES_URL` by default. `@neondatabase/serverless` reads nothing by default (pass explicitly). After Neon migration, Vercel sets both, but your code must match the SDK's expectation.
- **PgBouncer transaction mode limitations** -- Through pooled connections: no SET/RESET, no LISTEN/NOTIFY, no temporary tables with PRESERVE, no session-level advisory locks.
- **Result shape differs from `@neondatabase/serverless`** -- `@vercel/postgres` returns `{ rows, rowCount, fields }`. The Neon `neon()` function returns rows directly. This breaks code during migration if not accounted for.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the `sql` tagged template for one-shot queries -- it auto-connects from `POSTGRES_URL` and handles pooling)**

**(You MUST call `client.release()` after using a client obtained from `sql.connect()` or `pool.connect()` -- leaked clients exhaust the connection pool)**

**(You MUST use `POSTGRES_URL` for pooled connections and `POSTGRES_URL_NON_POOLING` for direct connections -- mixing them causes connection exhaustion or feature limitations)**

**(You MUST acknowledge that `@vercel/postgres` is deprecated -- recommend `@neondatabase/serverless` for new projects)**

**Failure to follow these rules will cause connection pool exhaustion, SQL injection vulnerabilities, or silent transaction failures.**

</critical_reminders>
