# SQLite + PowerSync Quick Reference

> API reference and setup checklist. See [SKILL.md](SKILL.md) for decision frameworks, red flags, and anti-patterns.

---

## Package Overview

| Package                   | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `@powersync/react-native` | Core SDK: database, schema, sync engine  |
| `@powersync/react`        | React hooks: useQuery, useStatus, etc.   |
| `@powersync/op-sqlite`    | OP-SQLite adapter with SQLCipher support |

**Peer dependencies:** One SQLite adapter is required -- either `@journeyapps/react-native-quick-sqlite` (default) or `@powersync/op-sqlite` + `@op-engineering/op-sqlite`.

---

## Schema API

### Column Types

| Type             | SQLite Type | Example Values            |
| ---------------- | ----------- | ------------------------- |
| `column.text`    | TEXT        | Strings, UUIDs, ISO dates |
| `column.integer` | INTEGER     | Numbers, booleans (0/1)   |
| `column.real`    | REAL        | Floating-point numbers    |

**Note:** The `id` column (TEXT, primary key) is auto-created. Never declare it.

### Table Constructor

```typescript
new Table(columns, options?)
```

| Option      | Type                       | Purpose                       |
| ----------- | -------------------------- | ----------------------------- |
| `indexes`   | `Record<string, string[]>` | Named indexes on columns      |
| `localOnly` | `boolean`                  | Never synced (default: false) |
| `viewName`  | `string`                   | Custom SQLite view name       |

---

## PowerSyncDatabase API

### Read Methods

| Method             | Returns     | Throws on empty? |
| ------------------ | ----------- | ---------------- |
| `getAll(sql)`      | `T[]`       | No (empty array) |
| `get(sql)`         | `T`         | Yes              |
| `getOptional(sql)` | `T \| null` | No               |

### Write Methods

| Method                 | Purpose                            |
| ---------------------- | ---------------------------------- |
| `execute(sql, params)` | INSERT, UPDATE, DELETE             |
| `writeTransaction(fn)` | Atomic multi-statement transaction |

### Watch Methods

| Method                     | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `watch(sql, params, opts)` | Async iterable that re-queries on changes |

### Lifecycle Methods

| Method                 | Purpose                          |
| ---------------------- | -------------------------------- |
| `init()`               | Create tables from schema        |
| `connect(connector)`   | Start bidirectional sync         |
| `disconnect()`         | Stop sync, preserve local data   |
| `disconnectAndClear()` | Stop sync, delete all local data |

### Upload Queue Methods

| Method                     | Returns                   | Purpose                 |
| -------------------------- | ------------------------- | ----------------------- |
| `getNextCrudTransaction()` | `CrudTransaction \| null` | Next atomic transaction |
| `getCrudBatch(limit)`      | `CrudBatch \| null`       | Batch of operations     |

---

## React Hooks API (@powersync/react)

| Hook                    | Returns                                  | Purpose                     |
| ----------------------- | ---------------------------------------- | --------------------------- |
| `useQuery(sql)`         | `{ data, isLoading, isFetching, error }` | Reactive watched query      |
| `useSuspenseQuery(sql)` | `{ data }`                               | Watched query with Suspense |
| `useStatus()`           | `{ connected, hasSynced }`               | Sync connection status      |
| `usePowerSync()`        | `PowerSyncDatabase`                      | Direct database instance    |

### useQuery Options

| Option         | Type      | Default | Purpose                             |
| -------------- | --------- | ------- | ----------------------------------- |
| `runQueryOnce` | `boolean` | `false` | Disable watching (one-time fetch)   |
| `throttleMs`   | `number`  | -       | Minimum interval between re-queries |

---

## CrudEntry Reference

| Property   | Type             | Description                      |
| ---------- | ---------------- | -------------------------------- |
| `id`       | `string`         | Row ID                           |
| `table`    | `string`         | Table name                       |
| `op`       | `UpdateType`     | `PUT`, `PATCH`, or `DELETE`      |
| `opData`   | `Record \| null` | Changed fields (null for DELETE) |
| `clientId` | `string`         | Unique client identifier         |

### UpdateType Enum

| Value    | Meaning                              |
| -------- | ------------------------------------ |
| `PUT`    | Full row insert or replace           |
| `PATCH`  | Partial update (only changed fields) |
| `DELETE` | Row deletion                         |

---

## Sync Rules YAML Reference

```yaml
bucket_definitions:
  bucket_name:
    # Parameter queries determine bucket creation
    parameters: SELECT request.user_id() as user_id
    # Data queries select rows for each bucket
    data:
      - SELECT * FROM table WHERE owner_id = bucket.user_id
```

### Built-in Functions

| Function                         | Returns               | Use In       |
| -------------------------------- | --------------------- | ------------ |
| `request.user_id()`              | Authenticated user ID | Parameters   |
| `request.parameters() ->> 'key'` | Client-provided param | Parameters   |
| `bucket.param_name`              | Parameter value       | Data queries |

---

## Setup Checklist

- [ ] Install `@powersync/react-native` and `@powersync/react`
- [ ] Choose SQLite adapter (default or OP-SQLite)
- [ ] Define schema with `Table` and `column` types (no `id` column)
- [ ] Create `PowerSyncDatabase` instance with schema
- [ ] Implement backend connector (`fetchCredentials` + `uploadData`)
- [ ] Wrap app in `PowerSyncContext.Provider`
- [ ] Call `powersync.init()` then `powersync.connect(connector)` on app start
- [ ] Configure sync rules (bucket definitions) on PowerSync Service
- [ ] Use `useQuery` for reactive reads, `execute` for writes
- [ ] Test offline: disconnect network, verify reads/writes work locally
- [ ] Test sync: reconnect, verify changes propagate to/from server
