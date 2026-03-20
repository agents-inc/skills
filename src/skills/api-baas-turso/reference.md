# Turso Reference

> Quick lookup tables, CLI commands, and type definitions. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Client Interface (v0.17+)

```typescript
interface Client {
  execute(stmt: InStatement): Promise<ResultSet>;
  execute(sql: string, args?: InArgs): Promise<ResultSet>;
  batch(
    stmts: Array<InStatement | [string, InArgs?]>,
    mode?: TransactionMode,
  ): Promise<Array<ResultSet>>;
  transaction(mode?: TransactionMode): Promise<Transaction>;
  migrate(stmts: Array<InStatement>): Promise<Array<ResultSet>>;
  executeMultiple(sql: string): Promise<void>;
  sync(): Promise<Replicated>;
  close(): void;
  reconnect(): void;
  closed: boolean;
  protocol: string;
}
```

`mode` defaults to `"deferred"` for both `batch()` and `transaction()`. Always specify explicitly to avoid silent write failures.

---

## Core Types

```typescript
type InStatement = { sql: string; args?: InArgs } | string;
type InArgs = Array<InValue> | Record<string, InValue>;
type InValue = Value | boolean | Uint8Array | Date;
type Value = null | string | number | bigint | ArrayBuffer;
type TransactionMode = "write" | "read" | "deferred";
type IntMode = "number" | "bigint" | "string";
type Replicated = { frame_no: number; frames_synced: number } | undefined;
```

---

## ResultSet

| Property          | Type                  | Description                       |
| ----------------- | --------------------- | --------------------------------- |
| `rows`            | `Array<Row>`          | Result rows (empty for writes)    |
| `columns`         | `Array<string>`       | Column names in result order      |
| `columnTypes`     | `Array<string>`       | SQLite type names per column      |
| `rowsAffected`    | `number`              | Rows modified by write statements |
| `lastInsertRowid` | `bigint \| undefined` | Rowid of last inserted row        |

`Row` supports both index access (`row[0]`) and column-name access (`row.name`).

---

## createClient Config

| Option           | Type        | Default    | Description                                                           |
| ---------------- | ----------- | ---------- | --------------------------------------------------------------------- |
| `url`            | `string`    | (required) | Connection URL: `libsql://`, `file:`, `:memory:`                      |
| `authToken`      | `string?`   | —          | Auth token for remote databases                                       |
| `syncUrl`        | `string?`   | —          | Remote URL for embedded replica sync                                  |
| `syncInterval`   | `number?`   | —          | Auto-sync interval in seconds                                         |
| `readYourWrites` | `boolean?`  | `true`     | Apply writes to local replica immediately after remote write succeeds |
| `offline`        | `boolean?`  | `false`    | Enable local-only writes (embedded replicas)                          |
| `encryptionKey`  | `string?`   | —          | Encryption key for local SQLite file                                  |
| `intMode`        | `IntMode?`  | `"number"` | How to return SQLite integers                                         |
| `concurrency`    | `number?`   | `20`       | Max concurrent requests (`undefined` to disable)                      |
| `tls`            | `boolean?`  | `true`     | Enable TLS for remote connections                                     |
| `fetch`          | `Function?` | —          | Custom fetch implementation                                           |

---

## Transaction Modes

| Mode         | SQLite Equivalent | Behavior                                                           |
| ------------ | ----------------- | ------------------------------------------------------------------ |
| `"write"`    | `BEGIN IMMEDIATE` | Acquires write lock immediately; required for INSERT/UPDATE/DELETE |
| `"read"`     | `BEGIN READONLY`  | Read-only; can execute on replicas in parallel                     |
| `"deferred"` | `BEGIN DEFERRED`  | Starts read-only, escalates to write on first write statement      |

---

## URL Schemes

| Scheme                        | Runtime      | Use Case                              |
| ----------------------------- | ------------ | ------------------------------------- |
| `libsql://host.turso.io`      | Any          | Remote Turso database (WebSocket)     |
| `https://host.turso.io`       | Any          | Remote Turso database (HTTP)          |
| `file:path/to/db.db`          | Node.js only | Local SQLite file                     |
| `file:replica.db` + `syncUrl` | Node.js only | Embedded replica                      |
| `:memory:`                    | Any          | In-memory database (tests, ephemeral) |

---

## Turso CLI Quick Reference

```bash
# Install
curl -sSfL https://get.tur.so/install.sh | bash

# Authenticate
turso auth login

# Database management
turso db create <name>                     # Create database (auto-selects closest region)
turso db create <name> --group <group>     # Create in a specific group
turso db list                              # List all databases
turso db show <name>                       # Show database details
turso db show <name> --url                 # Get connection URL
turso db shell <name>                      # Open interactive SQL shell
turso db destroy <name>                    # Delete database

# Group management (multi-region)
turso group create <name>                  # Create group (auto-selects primary region)
turso group create <name> --location iad   # Create with explicit primary
turso group locations add <group> <loc>    # Add replica location
turso group locations remove <group> <loc> # Remove replica location
turso group list                           # List groups

# Tokens
turso db tokens create <name>              # Create auth token for a database
turso db tokens create <name> --expiration 7d  # Token with expiration
```

---

## Environment Variables

```bash
# Application
TURSO_DATABASE_URL=libsql://my-database-my-org.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...

# Embedded replica (in addition to above)
TURSO_SYNC_URL=libsql://my-database-my-org.turso.io  # Same as DATABASE_URL for sync target
```

---

## Parameter Syntax

| SQL Syntax       | Args Format | Example                   |
| ---------------- | ----------- | ------------------------- |
| `?` (positional) | `Array`     | `args: [1, "Alice"]`      |
| `:name`          | `Record`    | `args: { name: "Alice" }` |
| `@name`          | `Record`    | `args: { name: "Alice" }` |
| `$name`          | `Record`    | `args: { name: "Alice" }` |

Named parameter args use **bare names** (no prefix): `{ name: "Alice" }` matches all three prefixes.

---

## IntMode Behavior

| Mode                 | Returns  | Precision   | Use When                                  |
| -------------------- | -------- | ----------- | ----------------------------------------- |
| `"number"` (default) | `number` | Up to 2^53  | Most applications; JavaScript-native      |
| `"bigint"`           | `bigint` | Full 64-bit | Large IDs, counters, precise arithmetic   |
| `"string"`           | `string` | Full 64-bit | Universal safety; easy JSON serialization |

---

## Write Latency by Architecture

| Setup                    | Read Latency            | Write Latency                  |
| ------------------------ | ----------------------- | ------------------------------ |
| Embedded replica (local) | ~0.001ms (microseconds) | 15-50ms (forwarded to primary) |
| Remote (same region)     | 1-5ms                   | 1-5ms                          |
| Remote (cross-region)    | 5-50ms                  | 15-50ms (always to primary)    |
