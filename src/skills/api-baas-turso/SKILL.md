---
name: api-baas-turso
description: Edge-hosted SQLite database with libSQL driver and embedded replicas
---

# Turso / libSQL Patterns

> **Quick Guide:** Use `@libsql/client` for all Turso database access. Use `execute()` for single queries, `batch()` for atomic multi-statement operations (preferred over interactive transactions), and `transaction()` only when subsequent queries depend on prior results. For edge/serverless runtimes without filesystem access, import from `@libsql/client/web`. For zero-latency reads, configure embedded replicas with a local file URL + `syncUrl`. All writes are forwarded to the primary -- design for 15-50ms write latency. Turso is SQLite under the hood: single-writer model, no `ALTER TABLE ... ADD CONSTRAINT`, no stored procedures.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `batch()` with a transaction mode for multi-statement atomic operations -- it is faster and safer than interactive `transaction()` because it executes in a single round trip)**

**(You MUST import from `@libsql/client/web` in edge/serverless runtimes that lack filesystem access (Cloudflare Workers, Vercel Edge Functions) -- the base `@libsql/client` import pulls in native bindings that fail in these environments)**

**(You MUST specify a transaction mode (`"write"`, `"read"`, or `"deferred"`) as the second argument to `batch()` and `transaction()` -- the default is `"deferred"`, which silently fails to acquire a write lock for INSERT/UPDATE/DELETE)**

**(You MUST call `client.close()` when the client is no longer needed in short-lived processes -- open clients hold connections and file handles)**

**(You MUST NOT access the local embedded replica database file directly while the client is running -- concurrent access causes data corruption)**

</critical_requirements>

---

**Auto-detection:** Turso, libSQL, @libsql/client, createClient, turso.io, embedded replica, syncUrl, syncInterval, turso db, turso group, libsql, .turso.io, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN

**When to use:**

- Querying a Turso-hosted SQLite database from any runtime (Node.js, edge, serverless)
- Setting up embedded replicas for zero-latency local reads synced from a remote primary
- Multi-tenant SaaS with database-per-tenant (Turso supports millions of databases)
- Serverless/edge functions needing a database without connection pooling complexity
- Running atomic multi-statement operations with `batch()` or interactive `transaction()`
- Managing database groups and multi-region placement via the Turso CLI

**When NOT to use:**

- Write-heavy workloads requiring strong multi-writer consistency (Turso is single-writer, writes forwarded to primary)
- Complex relational queries needing PostgreSQL features (CTEs with mutating subqueries, stored procedures, advanced constraints)
- Complex distributed transactions across multiple databases
- Large analytical datasets (SQLite row-size and concurrency limitations apply)

**Detailed Resources:**

- [examples/core.md](examples/core.md) -- Client setup, execute, batch, transactions, import paths
- [examples/embedded-replicas.md](examples/embedded-replicas.md) -- Local replicas, sync, offline mode, encryption
- [reference.md](reference.md) -- Decision frameworks, type definitions, CLI commands, lookup tables

---

<philosophy>

## Philosophy

Turso brings SQLite to the edge by hosting libSQL (a fork of SQLite) as a managed service with multi-region replication. The `@libsql/client` driver provides a unified API that works identically whether you are connecting to a remote Turso database, a local SQLite file, an in-memory database, or an embedded replica that syncs from a remote primary.

**Core principles:**

1. **Batch over transaction** -- `batch()` sends all statements in a single round trip and executes them in an implicit transaction. Interactive `transaction()` requires multiple round trips and holds a database lock (5-second timeout). Use `batch()` unless you need conditional logic between queries.
2. **Writes always hit the primary** -- Even with embedded replicas, writes are forwarded to the remote primary database. Write latency is 15-50ms depending on distance to the primary region. Design for this: optimistic UI, background sync, avoid write-heavy hot paths.
3. **Embedded replicas for reads** -- A local SQLite file synced from the remote primary. Reads are microsecond-level. Writes forward to remote. The local file updates after a successful write (read-your-writes semantics).
4. **Two import paths** -- `@libsql/client` includes native SQLite bindings for Node.js and supports `file:` URLs. `@libsql/client/web` is pure JS/WASM for edge runtimes (Cloudflare Workers, Vercel Edge Functions) and cannot open local files.
5. **SQLite semantics** -- Turso is SQLite. No `ADD CONSTRAINT`, no stored procedures, no `LISTEN/NOTIFY`, single-writer WAL mode. Know SQLite's limitations before choosing Turso.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client Setup

Create a client with `createClient()`. The `url` determines the connection type: `libsql://` for remote Turso, `file:` for local SQLite (Node.js only), `:memory:` for in-memory (tests). Always use environment variables for `authToken` -- never hardcode credentials.

See [examples/core.md](examples/core.md) for full setup patterns including singleton modules and bad examples.

---

### Pattern 2: Executing Queries

`execute()` runs a single SQL statement. Always use parameterized queries with `args` -- never string interpolation.

```typescript
// Positional: args as array
await client.execute({
  sql: "SELECT * FROM users WHERE id = ?",
  args: [userId],
});

// Named: args as object (bare names match :name, @name, $name in SQL)
await client.execute({
  sql: "INSERT INTO users (name, email) VALUES (:name, :email)",
  args: { name, email },
});
```

Returns `ResultSet` with `rows` (Array\<Row\>), `columns`, `rowsAffected`, `lastInsertRowid` (bigint). See [examples/core.md](examples/core.md) for typed result mapping and bad examples.

---

### Pattern 3: Batch Operations

`batch()` executes multiple statements atomically in a single round trip. All succeed or all roll back. Always specify the transaction mode as the second argument.

```typescript
const results = await client.batch(
  [
    { sql: "INSERT INTO users (name) VALUES (?)", args: ["Alice"] },
    {
      sql: "INSERT INTO audit_log (action, entity_id) VALUES (?, last_insert_rowid())",
      args: ["user_created"],
    },
  ],
  "write", // Required for INSERT/UPDATE/DELETE
);
```

Use `"write"` for mutations, `"read"` for SELECT-only (allows parallel execution), `"deferred"` to start read-only and escalate. `last_insert_rowid()` works across statements in the same batch. See [examples/core.md](examples/core.md) for multi-insert and read-only batch patterns, and [reference.md](reference.md) for the transaction mode comparison table.

---

### Pattern 4: Interactive Transactions

Use `transaction()` **only** when subsequent queries depend on results of earlier queries. It holds a database lock (5-second idle timeout) and requires multiple round trips. Always use try/catch/finally with `close()`.

```typescript
const tx = await client.transaction("write");
try {
  const { rows } = await tx.execute({
    sql: "SELECT balance FROM accounts WHERE id = ?",
    args: [fromId],
  });
  // ... conditional logic based on results ...
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
} finally {
  tx.close();
}
```

If all statements are known upfront with no conditional logic, use `batch()` instead. See [examples/core.md](examples/core.md) for a complete purchase-with-stock-check example.

---

### Pattern 5: Import Paths for Different Runtimes

```typescript
// Node.js, Bun, Deno (has filesystem access, native bindings)
import { createClient } from "@libsql/client";

// Edge/serverless runtimes WITHOUT filesystem (Cloudflare Workers, Vercel Edge)
import { createClient } from "@libsql/client/web";
```

The base `@libsql/client` bundles native SQLite bindings that fail in edge runtimes. `@libsql/client/web` is pure JS/WASM but cannot open local `file:` URLs. See [examples/core.md](examples/core.md) for a full Cloudflare Worker example.

---

### Pattern 6: Embedded Replicas

A local SQLite file that syncs from a remote Turso primary. Reads are local (microseconds), writes forward to remote (15-50ms).

```typescript
const client = createClient({
  url: "file:local-replica.db",
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: 60, // Auto-sync every 60 seconds
});
await client.sync(); // Populate local replica before first read
```

Key points: `file:` URL for local replica, `syncUrl` for remote primary, call `sync()` on startup, reads are local, writes forward to remote with read-your-writes semantics.

**When to use:** VMs, VPS, containers, or any long-running process with filesystem access. Not available in serverless/edge runtimes without filesystem. See [examples/embedded-replicas.md](examples/embedded-replicas.md) for full patterns including manual sync, offline mode, and encryption.

---

### Pattern 7: Database Groups and Multi-Region

Turso organizes databases into groups. Each group has a primary region and optional replica locations. All databases in a group inherit its locations.

All writes go to the primary region regardless of which replica handles the read. Adding more locations improves read latency globally but does not reduce write latency. Write latency is determined by distance to the primary region.

See [reference.md](reference.md) for the full Turso CLI command reference (`turso db create`, `turso group create`, `turso db shell`, etc.).

</patterns>

---

<decision_framework>

## Decision Framework

### batch() vs transaction()

```
Are all SQL statements known upfront (no conditional logic between them)?
+-- YES --> Use batch() (single round trip, implicit transaction, preferred)
+-- NO  --> Do later statements depend on results of earlier statements?
    +-- YES --> Use transaction() (interactive, multiple round trips, holds lock)
    +-- NO  --> Use batch()
```

### Import Path Selection

```
What runtime environment?
+-- Node.js / Bun / Deno / VM / container
|   +-- Need embedded replicas (local file)?
|   |   +-- YES --> @libsql/client with file: URL + syncUrl
|   |   +-- NO  --> @libsql/client with libsql:// URL
+-- Cloudflare Workers / Vercel Edge / browser / serverless without filesystem
    +-- @libsql/client/web (remote connections only, no file: URLs)
```

### Embedded Replica vs Remote-Only

```
Is the process long-lived with filesystem access?
+-- YES --> Do you need sub-millisecond read latency?
|   +-- YES --> Embedded replica (file: URL + syncUrl)
|   +-- NO  --> Remote-only is simpler (libsql:// URL)
+-- NO (serverless, edge, short-lived)
    +-- Remote-only (@libsql/client/web, libsql:// URL)
```

### Transaction Mode Selection

```
What operations will the batch/transaction perform?
+-- Only SELECT queries --> "read" (allows parallel execution on replicas)
+-- Any INSERT / UPDATE / DELETE --> "write" (acquires exclusive lock)
+-- Unsure at call time --> "deferred" (starts read, escalates if needed)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Missing transaction mode in `batch()`/`transaction()`** -- Omitting the second argument defaults to `"deferred"`, which starts read-only and may silently fail to acquire a write lock for INSERT/UPDATE/DELETE. Always specify the mode explicitly.
- **Using `@libsql/client` in edge runtimes** -- The base package bundles native SQLite bindings that fail in Cloudflare Workers, Vercel Edge Functions, and similar environments. Use `@libsql/client/web` instead.
- **String interpolation in SQL** -- `execute(\`SELECT \* FROM users WHERE id = '${id}'\`)`is a SQL injection vulnerability. Always use parameterized queries with`args`.
- **Accessing embedded replica file directly** -- Opening the local `.db` file with another SQLite client while the libSQL client is running causes data corruption. Only access through the client.

**Medium Priority Issues:**

- **Using `transaction()` when `batch()` suffices** -- Interactive transactions hold a database lock with a 5-second timeout, require multiple round trips, and block other writers. Use `batch()` for predetermined statement sets.
- **Not calling `client.close()`** -- In short-lived processes (CLI scripts, test teardown), forgetting to close the client leaves connections and file handles open.
- **Ignoring write latency with embedded replicas** -- Reads are microseconds (local), but writes are 15-50ms (forwarded to remote primary). Design accordingly -- avoid tight write loops.
- **Setting `syncInterval` too low** -- Each sync pulls all changed frames (4KB each). Sub-second intervals on write-heavy databases generate significant network and I/O overhead.

**Common Mistakes:**

- **Wrong package name** -- The package is `@libsql/client`, not `libsql-client`, `@turso/client`, or `turso-client`.
- **Named parameter prefix in args object** -- Args use bare names: `{ name: "Alice" }` matches `:name`, `@name`, and `$name` in SQL. Do not include the prefix: `{ ":name": "Alice" }` will not match.
- **Expecting `lastInsertRowid` to be a number** -- It is `bigint | undefined`. If you need a number, explicitly convert: `Number(result.lastInsertRowid)`, but be aware of precision loss for very large rowids.
- **Using `executeMultiple()` for atomic operations** -- `executeMultiple()` runs raw SQL text (semicolon-separated) with no parameterization and no implicit transaction. Use `batch()` for atomic parameterized operations.

**Gotchas & Edge Cases:**

- **`batch()` statements share a transaction but are NOT parallel** -- They execute sequentially. `last_insert_rowid()` in a later statement reflects the previous statement's insert.
- **`transaction()` has a 5-second idle timeout** -- If no statement is executed within 5 seconds after the last one, the transaction is automatically rolled back. This matters on high-latency connections.
- **Embedded replica `sync()` is not atomic with reads** -- If you read immediately after `sync()`, another sync could start. The client handles this internally, but be aware that `syncInterval` syncs happen in the background.
- **Frame-based sync overhead** -- Embedded replica sync operates in 4KB frames. A 1-byte write still transfers a full 4KB frame. B-tree splits and WAL checkpoint operations can trigger unexpectedly large sync payloads.
- **`intMode` affects how SQLite integers are returned** -- Default is `"number"`, which loses precision for integers > 2^53. Use `"bigint"` for large IDs or counters, or `"string"` for universal safety.
- **SQLite type affinity** -- Turso is SQLite. A `TEXT` column will happily store an integer without error. There is no strict type enforcement unless you use `STRICT` tables.
- **No `ALTER TABLE ... ADD CONSTRAINT`** -- SQLite (and Turso) do not support adding constraints after table creation. You must recreate the table.
- **Single-writer model** -- Only one write transaction can execute at a time across all clients. Concurrent write attempts queue behind the current writer. This is fundamental to SQLite/libSQL, not a Turso limitation.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `batch()` with a transaction mode for multi-statement atomic operations -- it is faster and safer than interactive `transaction()` because it executes in a single round trip)**

**(You MUST import from `@libsql/client/web` in edge/serverless runtimes that lack filesystem access (Cloudflare Workers, Vercel Edge Functions) -- the base `@libsql/client` import pulls in native bindings that fail in these environments)**

**(You MUST specify a transaction mode (`"write"`, `"read"`, or `"deferred"`) as the second argument to `batch()` and `transaction()` -- the default is `"deferred"`, which silently fails to acquire a write lock for INSERT/UPDATE/DELETE)**

**(You MUST call `client.close()` when the client is no longer needed in short-lived processes -- open clients hold connections and file handles)**

**(You MUST NOT access the local embedded replica database file directly while the client is running -- concurrent access causes data corruption)**

**Failure to follow these rules will cause data corruption, runtime crashes in edge environments, or silent data inconsistency.**

</critical_reminders>
