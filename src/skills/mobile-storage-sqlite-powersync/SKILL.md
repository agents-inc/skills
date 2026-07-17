---
name: mobile-storage-sqlite-powersync
description: PowerSync offline-first sync engine on SQLite for React Native - schema definition, watched queries, CRUD operations, backend connectors, sync rules, conflict resolution, attachments
---

# SQLite + PowerSync Patterns

> **Quick Guide:** Use `@powersync/react-native` for offline-first apps backed by local SQLite. Define schemas with `Table` and `column.text/integer/real` (id column is auto-created). Use `PowerSyncDatabase` for reads/writes, `useQuery` from `@powersync/react` for reactive watched queries. Connect to your backend via a connector implementing `fetchCredentials` + `uploadData`. Conflict resolution defaults to last-write-wins per field -- customize in `uploadData`. Use `@powersync/op-sqlite` for SQLCipher encryption.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define schemas with `new Table({ ... })` using `column.text`, `column.integer`, `column.real` -- NEVER declare an `id` column, PowerSync creates it automatically)**

**(You MUST call `powersync.connect(connector)` after `init()` to start syncing -- without it the database is local-only with no sync)**

**(You MUST implement both `fetchCredentials()` and `uploadData()` in your backend connector -- missing either breaks the sync loop)**

**(You MUST use `useQuery` from `@powersync/react` for reactive queries -- raw `getAll()` does NOT re-render on data changes)**

</critical_requirements>

---

**Auto-detection:** PowerSync, powersync, @powersync/react-native, @powersync/react, @powersync/op-sqlite, PowerSyncDatabase, useQuery, usePowerSync, useStatus, useSuspenseQuery, PowerSyncBackendConnector, fetchCredentials, uploadData, column.text, column.integer, column.real, Schema, Table, sync rules, bucket_definitions, offline-first SQLite, watched query, CrudEntry, CrudTransaction, AttachmentQueue, AttachmentTable, local-only table

**When to use:**

- Building offline-first React Native apps that sync with a cloud database
- Storing relational data locally in SQLite with automatic cloud sync
- Implementing reactive UIs that update when synced data changes
- Handling CRUD operations that work offline and sync when reconnected
- Defining sync rules (bucket definitions) for partial data replication
- Managing file attachments with offline upload/download queues

**Key patterns covered:**

- Schema definition with `Table`, `column` types, indexes, and local-only tables
- `PowerSyncDatabase` setup with default or OP-SQLite adapter
- React hooks: `useQuery`, `useSuspenseQuery`, `useStatus`, `usePowerSync`
- Backend connector: `fetchCredentials()` + `uploadData()` implementation
- CRUD operations via `execute()`, `get()`, `getAll()`, `getOptional()`
- Sync rules with bucket definitions (YAML) for per-user data filtering
- Conflict resolution strategies (last-write-wins, field-level, custom)
- Attachment handling with `AttachmentTable` and `AttachmentQueue`
- OP-SQLite integration for SQLCipher encryption

**When NOT to use:**

- Simple key-value storage without sync (use a key-value store)
- Apps that never go offline and always have connectivity
- Data that does not need relational queries (use a key-value store)
- File-only storage without structured metadata (use the filesystem)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Schema, database setup, CRUD, watched queries, hooks
- [examples/sync.md](examples/sync.md) - Backend connector, sync rules, conflict resolution
- [examples/attachments.md](examples/attachments.md) - Attachment queue, upload/download, storage adapters
- [reference.md](reference.md) - API reference, setup checklist

---

<philosophy>

## Philosophy

PowerSync is an **offline-first sync engine** that sits on top of SQLite. The core idea: your app reads and writes to a local SQLite database instantly (no network calls), and PowerSync handles bidirectional sync with your cloud database in the background.

**Core principles:**

1. **Local-first** -- all reads and writes hit local SQLite, so the app works instantly and offline
2. **Sync is transparent** -- PowerSync streams changes from the server and uploads local mutations automatically
3. **Schema drives everything** -- the client schema defines local tables, the server sync rules define what data each client receives
4. **Conflict resolution is yours** -- defaults to last-write-wins, but `uploadData()` gives you full control
5. **Watched queries for reactivity** -- `useQuery` re-executes queries when dependent tables change, keeping UI in sync

**Architecture overview:**

```
Client (React Native)              Cloud
+-------------------+         +-------------------+
| Local SQLite DB   | <-sync->| PowerSync Service |<--- Source DB (Postgres, etc.)
| (PowerSyncDatabase)|        | (Sync Rules)      |
+-------------------+         +-------------------+
| @powersync/react  |         | Bucket Defs       |
| (useQuery, etc.)  |         | (YAML config)     |
+-------------------+         +-------------------+
```

**Data flow:**

- **Writes:** App calls `execute(INSERT/UPDATE/DELETE)` on local SQLite. PowerSync queues the change and calls your `uploadData()` to push it to the backend.
- **Reads:** Sync rules on the server determine which data each client receives. The PowerSync Service streams changes to the client's local SQLite. `useQuery` watches for table changes and re-renders.

**Column types:** Only three types exist -- `column.text`, `column.integer`, `column.real`. The `id` column (text, primary key) is auto-created. If a synced value doesn't match the declared type, it is cast automatically.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Schema Definition

Define your client-side schema using `Table` and `column` types. The schema mirrors your server tables (minus the `id` column, which is auto-created).

```typescript
import { column, Schema, Table } from "@powersync/react-native";

const lists = new Table({
  created_at: column.text,
  name: column.text,
  owner_id: column.text,
});

const todos = new Table(
  {
    list_id: column.text,
    created_at: column.text,
    completed_at: column.text,
    description: column.text,
    completed: column.integer,
  },
  { indexes: { list: ["list_id"] } },
);

export const AppSchema = new Schema({ todos, lists });

// Derive types from schema
export type Database = (typeof AppSchema)["types"];
export type TodoRecord = Database["todos"];
export type ListRecord = Database["lists"];
```

**Why good:** Schema is source of truth for types, indexes optimize query performance, no manual `id` column needed

**Gotcha:** Table names in the schema must match table names in your sync rules. Mismatches cause data to silently not sync.

See [examples/core.md](examples/core.md) for local-only tables and index configuration.

---

### Pattern 2: PowerSyncDatabase Setup

Create the database instance at app startup. Choose between the default SQLite adapter or OP-SQLite for encryption.

```typescript
import { PowerSyncDatabase } from "@powersync/react-native";
import { AppSchema } from "./schema";

const DB_FILENAME = "app.db";

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: DB_FILENAME },
});

// Initialize and connect (typically in app bootstrap)
async function initDatabase(connector: PowerSyncBackendConnector) {
  await powersync.init();
  await powersync.connect(connector);
}
```

**Why good:** Single instance shared across app, `init()` creates SQLite tables from schema, `connect()` starts bidirectional sync

**Gotcha:** Without `connect()`, the database works but is purely local -- no sync occurs.

See [examples/core.md](examples/core.md) for OP-SQLite setup with encryption and the React context provider pattern.

---

### Pattern 3: React Hooks for Reactive Queries

Use `useQuery` from `@powersync/react` for watched queries that re-execute when dependent tables change. Wrap your app in `PowerSyncContext.Provider`.

```tsx
import { useQuery, useStatus, usePowerSync } from "@powersync/react";

function TodoList({ listId }: { listId: string }) {
  const {
    data: todos,
    isLoading,
    error,
  } = useQuery<TodoRecord>(
    "SELECT * FROM todos WHERE list_id = ? ORDER BY created_at DESC",
    [listId],
  );

  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <FlatList
      data={todos}
      renderItem={({ item }) => <TodoItem todo={item} />}
      keyExtractor={(item) => item.id}
    />
  );
}
```

**Why good:** `useQuery` automatically re-runs when the `todos` table changes (insert, update, delete), `isLoading` and `error` handle loading/error states

See [examples/core.md](examples/core.md) for `useSuspenseQuery`, `useStatus`, `usePowerSync`, and `runQueryOnce` usage.

---

### Pattern 4: CRUD Operations

All writes use `execute()` with parameterized SQL. PowerSync queues changes and calls your `uploadData()` to sync.

```typescript
import { usePowerSync } from "@powersync/react";

function useTodos(listId: string) {
  const powersync = usePowerSync();

  const addTodo = async (description: string) => {
    await powersync.execute(
      "INSERT INTO todos (id, list_id, description, created_at, completed) VALUES (uuid(), ?, ?, datetime(), 0)",
      [listId, description],
    );
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const completedAt = completed ? new Date().toISOString() : null;
    await powersync.execute(
      "UPDATE todos SET completed = ?, completed_at = ? WHERE id = ?",
      [completed ? 1 : 0, completedAt, id],
    );
  };

  const deleteTodo = async (id: string) => {
    await powersync.execute("DELETE FROM todos WHERE id = ?", [id]);
  };

  return { addTodo, toggleTodo, deleteTodo };
}
```

**Why good:** Writes hit local SQLite instantly (no network wait), `uuid()` generates IDs client-side, parameterized queries prevent SQL injection

**Gotcha:** `execute()` returns `{ rowsAffected, insertId }`. When using views, `rowsAffected` may return 0 -- use `RETURNING` clauses to confirm mutations.

See [examples/core.md](examples/core.md) for `get()`, `getAll()`, `getOptional()`, and transaction patterns.

---

### Pattern 5: Backend Connector

The connector bridges PowerSync with your backend. Implement `fetchCredentials()` for auth and `uploadData()` for pushing local changes.

```typescript
import type {
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/react-native";
import type { AbstractPowerSyncDatabase } from "@powersync/react-native";

export const connector: PowerSyncBackendConnector = {
  fetchCredentials: async (): Promise<PowerSyncCredentials> => {
    // Return your PowerSync instance URL and a valid JWT
    const session = await getAuthSession();
    return {
      endpoint: POWERSYNC_URL,
      token: session.accessToken,
      expiresAt: session.expiresAt,
    };
  },

  uploadData: async (database: AbstractPowerSyncDatabase): Promise<void> => {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    for (const op of transaction.crud) {
      // Send each operation to your backend API
      await applyOperation(op);
    }
    await transaction.complete();
  },
};
```

**Why good:** Clean separation of auth and data upload, transaction-based processing ensures atomicity, `complete()` marks the batch as synced

See [examples/sync.md](examples/sync.md) for the full Supabase connector, custom backend patterns, and error handling with retries.

---

### Pattern 6: Sync Rules (Bucket Definitions)

Sync rules (YAML) define which server data each client receives. Configured on the PowerSync Service, not in client code.

```yaml
bucket_definitions:
  user_lists:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM lists WHERE owner_id = bucket.user_id
      - SELECT * FROM todos WHERE list_id IN (
        SELECT id FROM lists WHERE owner_id = bucket.user_id
        )

  global_settings:
    # No parameters = global bucket, synced to all clients
    data:
      - SELECT * FROM settings
```

**Why good:** Per-user data filtering at the server, global buckets for shared data, SQL-based rules are familiar

**Gotcha:** Maximum 1,000 buckets per client (default). Table names must match client schema.

See [examples/sync.md](examples/sync.md) for parameterized buckets, client parameters, and multi-tenant patterns.

---

### Pattern 7: Conflict Resolution

Default behavior is **last-write-wins per field**. Customize in your `uploadData()` implementation.

The key insight: PowerSync gives you full control in `uploadData()`. You choose how to handle each `CrudEntry` operation -- accept, reject, merge, or record conflicts.

Common strategies:

- **Last-write-wins (default):** Simply upsert each operation
- **Timestamp-based:** Compare client vs server timestamps, reject stale writes
- **Field-level merge:** Apply only newer field values, keep others
- **Server-side validation:** Enforce business rules (e.g., prevent modifying shipped orders)
- **Conflict recording:** Store both versions for manual user resolution

See [examples/sync.md](examples/sync.md) for complete conflict resolution implementations.

---

### Pattern 8: Attachment Handling

Use `AttachmentTable` in your schema and `AttachmentQueue` for offline-capable file upload/download.

```typescript
import { AttachmentTable } from "@powersync/react-native";
import { column, Schema, Table } from "@powersync/react-native";

const users = new Table({
  name: column.text,
  photo_id: column.text, // References attachment ID
});

export const AppSchema = new Schema({
  users,
  attachments: new AttachmentTable(),
});
```

The `AttachmentQueue` manages the lifecycle: local save, queued upload, synced state, automatic download on other devices, retry on failure.

See [examples/attachments.md](examples/attachments.md) for queue setup, upload/download handlers, and storage adapter patterns.

</patterns>

---

<decision_framework>

## Decision Framework

```
What kind of data are you storing?
|
+-> Relational data that needs offline + cloud sync?
|   +-> YES -> PowerSync + SQLite (this skill)
|   +-> NO  -> Key-value pairs only?
|       +-> YES -> Use a key-value store (not this skill)
|       +-> NO  -> Files/media only?
|           +-> YES -> Use the filesystem
|
+-> Do you need reactive queries in React?
|   +-> YES -> Use useQuery from @powersync/react
|   +-> NO  -> Use powersync.getAll() / get() directly
|
+-> Do you need on-device encryption?
|   +-> YES -> Use @powersync/op-sqlite with SQLCipher
|   +-> NO  -> Use the default SQLite adapter
|
+-> Do you have file attachments?
|   +-> YES -> Use AttachmentTable + AttachmentQueue
|   +-> NO  -> Standard schema is sufficient
|
+-> How should conflicts be resolved?
    +-> Simple apps -> Last-write-wins (default)
    +-> Collaborative editing -> Field-level merge or CRDTs
    +-> Business-critical -> Server-side validation + conflict recording
```

### When to Use Each Query API

| Scenario                       | API                                              |
| ------------------------------ | ------------------------------------------------ |
| Reactive component data        | `useQuery()` from `@powersync/react`             |
| Reactive with Suspense         | `useSuspenseQuery()` from `@powersync/react`     |
| One-time fetch (no reactivity) | `useQuery()` with `runQueryOnce: true`           |
| Service/utility reads          | `powersync.getAll()` / `get()` / `getOptional()` |
| Write operations               | `powersync.execute()`                            |
| Connection status              | `useStatus()` from `@powersync/react`            |
| Database instance access       | `usePowerSync()` from `@powersync/react`         |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Declaring an `id` column in schema -- PowerSync auto-creates `id` as `text` primary key. Declaring it causes conflicts.
- Calling `execute()` for reads (SELECT) instead of `getAll()` / `useQuery()` -- `execute()` does not return query results in a usable format
- Forgetting `powersync.connect(connector)` -- database works locally but nothing syncs, easy to miss in development
- Using `getAll()` in React components expecting reactivity -- raw reads do not watch for changes, use `useQuery()` instead
- Missing `transaction.complete()` in `uploadData()` -- unacknowledged transactions retry indefinitely, causing duplicate uploads

**Medium Priority Issues:**

- Schema table names not matching sync rule table names -- data silently fails to sync
- Not handling `fetchCredentials()` returning null -- happens when auth session expires, must re-authenticate
- Storing large blobs in SQLite columns -- use `AttachmentTable` for files, keep SQLite for metadata
- Missing indexes on frequently queried columns -- sync queries can be slow with large datasets
- Using `column.integer` for booleans without consistent 0/1 values -- SQLite has no native boolean type

**Gotchas & Edge Cases:**

- `uuid()` is a PowerSync SQL function, not a JavaScript function -- use it in SQL strings, not in JS
- `column.real` stores IEEE 754 doubles -- be aware of floating-point precision for currency (use integer cents instead)
- Sync rules YAML uses `request.user_id()` to access the authenticated user ID from the JWT -- not a custom function
- `getNextCrudTransaction()` returns `null` when the upload queue is empty -- always check before iterating
- `execute()` with views may return `rowsAffected: 0` even on success -- use `RETURNING` clause for confirmation
- PowerSync supports WebSocket (default since v1.11.0) and HTTP streaming for sync -- WebSocket is recommended
- The Rust-based sync client is enabled by default since v1.29.0 -- pass `clientImplementation: SyncClientImplementation.JAVASCRIPT` to use the legacy JS client
- `disconnectAndClear()` removes all local data -- use `disconnect()` to stop sync while preserving local data
- Local-only tables (set `localOnly: true` on Table options) are never synced -- useful for draft data or app state

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST define schemas with `new Table({ ... })` using `column.text`, `column.integer`, `column.real` -- NEVER declare an `id` column, PowerSync creates it automatically)**

**(You MUST call `powersync.connect(connector)` after `init()` to start syncing -- without it the database is local-only with no sync)**

**(You MUST implement both `fetchCredentials()` and `uploadData()` in your backend connector -- missing either breaks the sync loop)**

**(You MUST use `useQuery` from `@powersync/react` for reactive queries -- raw `getAll()` does NOT re-render on data changes)**

**Failure to follow these rules will cause silent sync failures, missing data, and non-reactive UIs.**

</critical_reminders>
