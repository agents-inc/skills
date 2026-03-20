---
name: api-baas-vercel-postgres
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

Vercel Postgres was sunset in December 2024. All databases were migrated to Neon. The `@vercel/postgres` npm package (v0.10.0) is no longer maintained. Two migration paths exist:

- **Drop-in replacement:** `@neondatabase/vercel-postgres-compat` (same API, maintained by Neon)
- **Full migration:** `@neondatabase/serverless` (actively developed, richer API with HTTP transactions and composable fragments)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: One-Shot Queries with `sql`

The `sql` export is a tagged template that auto-connects from `POSTGRES_URL`. It handles pooling internally.

```typescript
import { sql } from "@vercel/postgres";

// Tagged template -- values are auto-parameterized (safe from injection)
const ACTIVE_STATUS = "active";
const { rows } =
  await sql`SELECT id, name FROM users WHERE status = ${ACTIVE_STATUS}`;
```

**Why good:** Zero-config (reads POSTGRES_URL automatically), auto-parameterized preventing SQL injection, connection pooling handled internally, named constant for status

```typescript
// BAD: String interpolation instead of tagged template
const status = "active";
const { rows } = await sql.query(
  `SELECT * FROM users WHERE status = '${status}'`,
);
```

**Why bad:** String interpolation bypasses parameterization -- SQL injection vulnerability, uses `.query()` with string instead of tagged template

---

### Pattern 2: Multi-Query Sessions with `sql.connect()`

When you need multiple queries on the same connection (transactions, sequential operations), obtain a client.

```typescript
import { sql } from "@vercel/postgres";

async function transferFunds(fromId: string, toId: string, amount: number) {
  const client = await sql.connect();

  try {
    await client.sql`BEGIN`;
    await client.sql`UPDATE accounts SET balance = balance - ${amount} WHERE id = ${fromId}`;
    await client.sql`UPDATE accounts SET balance = balance + ${amount} WHERE id = ${toId}`;
    await client.sql`COMMIT`;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }
}
```

**Why good:** Client obtained from pool for multi-query, explicit BEGIN/COMMIT/ROLLBACK for transaction, `client.release()` in finally block prevents connection leaks, uses tagged template on client

```typescript
// BAD: Multiple sql calls without a shared client
import { sql } from "@vercel/postgres";

await sql`BEGIN`; // Gets connection A
await sql`UPDATE accounts SET balance = balance - ${amount} WHERE id = ${fromId}`; // Gets connection B!
await sql`COMMIT`; // Gets connection C -- BEGIN was on A, this COMMIT does nothing useful
```

**Why bad:** Each `sql` call may use a different connection from the pool -- BEGIN/COMMIT on different connections means the transaction is not atomic

---

### Pattern 3: Custom Pool with `createPool()`

Use `createPool()` when you need custom configuration or a non-default connection string.

```typescript
import { createPool } from "@vercel/postgres";

// Custom pool with explicit connection string
const pool = createPool({
  connectionString: process.env.SECONDARY_POSTGRES_URL,
});

const { rows } =
  await pool.sql`SELECT id, title FROM posts WHERE published = true`;
```

**Why good:** Useful for connecting to a secondary database, pool provides same `sql` tagged template interface, explicit connection string when POSTGRES_URL isn't appropriate

#### Custom Client with `createClient()`

```typescript
import { createClient } from "@vercel/postgres";

// Direct (non-pooled) connection -- reads POSTGRES_URL_NON_POOLING by default
const client = createClient();
await client.connect();

try {
  const { rows } = await client.sql`SELECT id, name FROM users LIMIT 10`;
  return rows;
} finally {
  await client.end();
}
```

**When to use:** Migrations, administrative operations, or scenarios requiring session-level features (SET, LISTEN/NOTIFY) that PgBouncer's transaction mode does not support.

---

### Pattern 4: Edge Runtime Considerations

On edge runtimes, IO connections cannot be reused between requests. The SDK automatically sets `maxUses: 1`.

```typescript
// Edge function -- single query is fine with sql
import { sql } from "@vercel/postgres";

export const runtime = "edge";

export async function GET() {
  const { rows } =
    await sql`SELECT id, title FROM posts ORDER BY created_at DESC LIMIT 10`;
  return Response.json(rows);
}
```

**Why good:** Single `sql` call works naturally on edge, no connection management needed

```typescript
// Edge function -- multiple queries need a shared client
import { sql } from "@vercel/postgres";

export const runtime = "edge";

export async function GET() {
  // sql.connect() gets a client from the pool -- reuse it for multiple queries
  const client = await sql.connect();

  try {
    const { rows: posts } =
      await client.sql`SELECT id, title FROM posts LIMIT 10`;
    const { rows: counts } =
      await client.sql`SELECT count(*)::int AS total FROM posts`;
    return Response.json({ posts, total: counts[0].total });
  } finally {
    client.release();
  }
}
```

**Why good:** On edge with `maxUses: 1`, each `pool.connect()` opens a new connection -- reusing the client avoids opening multiple connections per request

---

### Pattern 5: Migration to `@neondatabase/serverless`

Since `@vercel/postgres` is deprecated, here are the migration paths.

#### Drop-In Replacement (Minimal Changes)

```typescript
// Before
import { sql } from "@vercel/postgres";

// After -- same API, maintained by Neon
import { sql } from "@neondatabase/vercel-postgres-compat";

// Code stays the same
const { rows } = await sql`SELECT id, name FROM users`;
```

**When to use:** Existing projects that need a quick fix without rewriting query code.

#### Full Migration (Recommended for New Code)

```typescript
// Before (@vercel/postgres)
import { sql } from "@vercel/postgres";
const { rows } = await sql`SELECT id, name FROM users WHERE status = ${status}`;

// After (@neondatabase/serverless)
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const rows = await sql`SELECT id, name FROM users WHERE status = ${status}`;
```

**Key differences:**

- `@vercel/postgres` returns `{ rows, rowCount, ... }` -- `@neondatabase/serverless` returns rows directly (unless `fullResults: true`)
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
