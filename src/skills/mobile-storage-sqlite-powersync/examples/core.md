# SQLite + PowerSync - Core Patterns

> Schema definition, database setup, CRUD operations, and React hooks. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites:** React Native 0.68+, `@powersync/react-native`, `@powersync/react`, and a PowerSync Service instance.

---

## Pattern 1: Schema Definition with Column Types

```typescript
import { column, Schema, Table } from "@powersync/react-native";

// --- Synced tables (data comes from server via sync rules) ---

const LISTS_TABLE = "lists";
const TODOS_TABLE = "todos";

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
    completed: column.integer, // 0 = false, 1 = true (SQLite has no boolean)
    priority: column.real, // Floating-point values
  },
  { indexes: { list: ["list_id"] } }, // Index for faster queries by list
);

// --- Local-only table (never synced, useful for drafts/app state) ---

const drafts = new Table(
  {
    content: column.text,
    updated_at: column.text,
  },
  { localOnly: true },
);

export const AppSchema = new Schema({ todos, lists, drafts });

// Derive TypeScript types from schema
export type Database = (typeof AppSchema)["types"];
export type TodoRecord = Database["todos"];
export type ListRecord = Database["lists"];
```

**Why good:** Single source of truth for types and database structure, indexes declared alongside columns, local-only tables for non-synced data, derived types stay in sync with schema

```typescript
// BAD: Declaring an id column
const todos = new Table({
  id: column.text, // WRONG -- PowerSync auto-creates this
  list_id: column.text,
  description: column.text,
});
```

**Why bad:** PowerSync automatically creates an `id` column of type `text` as the primary key. Declaring it manually causes column conflicts.

**Column type reference:**

| Type             | SQLite Type | Use For                             |
| ---------------- | ----------- | ----------------------------------- |
| `column.text`    | TEXT        | Strings, UUIDs, ISO dates, JSON     |
| `column.integer` | INTEGER     | Numbers, booleans (0/1), timestamps |
| `column.real`    | REAL        | Floating-point numbers              |

---

## Pattern 2: PowerSyncDatabase Setup

### Default Adapter

```typescript
import { PowerSyncDatabase } from "@powersync/react-native";
import { AppSchema } from "./schema";

const DB_FILENAME = "app.db";

// Create a single database instance -- share across the entire app
export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: DB_FILENAME },
});
```

### OP-SQLite Adapter (with Optional SQLCipher Encryption)

```typescript
import { PowerSyncDatabase } from "@powersync/react-native";
import { OPSqliteOpenFactory } from "@powersync/op-sqlite";
import { AppSchema } from "./schema";

const DB_FILENAME = "app-encrypted.db";

const factory = new OPSqliteOpenFactory({
  dbFilename: DB_FILENAME,
  sqliteOptions: {
    // Enable SQLCipher encryption (requires "op-sqlite": { "sqlcipher": true } in package.json)
    encryptionKey: "your-encryption-key",
  },
});

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: factory,
});
```

**Why good:** OP-SQLite provides SQLCipher encryption and better New Architecture support, factory pattern separates adapter config from database config

**OP-SQLite package.json requirement:**

```json
{
  "op-sqlite": {
    "sqlcipher": true
  }
}
```

### App Bootstrap (Init + Connect)

```typescript
import type { PowerSyncBackendConnector } from "@powersync/react-native";
import { powersync } from "./database";
import { connector } from "./connector";

async function initializeDatabase(): Promise<void> {
  await powersync.init();
  // connect() starts bidirectional sync -- without it, database is local-only
  await powersync.connect(connector);
}

// On logout: stop sync, optionally clear local data
async function handleLogout(): Promise<void> {
  // disconnect() stops sync but preserves local data
  await powersync.disconnect();
  // disconnectAndClear() stops sync AND deletes all local data
  // await powersync.disconnectAndClear();
}
```

### React Context Provider

```tsx
import { PowerSyncContext } from "@powersync/react";
import { powersync } from "./database";

function App() {
  return (
    <PowerSyncContext.Provider value={powersync}>
      <Navigation />
    </PowerSyncContext.Provider>
  );
}

export { App };
```

**Why good:** Provider gives all descendants access via `usePowerSync()` and `useQuery()` hooks

---

## Pattern 3: React Hooks

### useQuery -- Reactive Watched Queries

```tsx
import { useQuery } from "@powersync/react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import type { TodoRecord } from "./schema";

function TodoList({ listId }: { listId: string }) {
  // Automatically re-executes when the todos table changes
  const {
    data: todos,
    isLoading,
    isFetching,
    error,
  } = useQuery<TodoRecord>(
    "SELECT * FROM todos WHERE list_id = ? ORDER BY created_at DESC",
    [listId],
  );

  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <View>
      {isFetching && <Text>Syncing...</Text>}
      <FlatList
        data={todos}
        renderItem={({ item }) => (
          <Text>
            {item.description} {item.completed ? "(done)" : ""}
          </Text>
        )}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}

export { TodoList };
```

**Why good:** `useQuery` detects dependent tables via `EXPLAIN QUERY PLAN` and re-runs when those tables change. `isLoading` covers initial load, `isFetching` covers background refreshes.

### useQuery with runQueryOnce (No Watching)

```tsx
// For data that won't change (e.g., static reference data)
const { data: categories } = useQuery<CategoryRecord>(
  "SELECT * FROM categories ORDER BY name",
  [],
  { runQueryOnce: true },
);
```

### useSuspenseQuery -- With React Suspense

```tsx
import { useSuspenseQuery } from "@powersync/react";
import { Suspense } from "react";
import { ErrorBoundary } from "./error-boundary";

function TodoListSuspense({ listId }: { listId: string }) {
  // Suspends until data is available -- no isLoading/error handling needed
  const { data: todos } = useSuspenseQuery<TodoRecord>(
    "SELECT * FROM todos WHERE list_id = ?",
    [listId],
  );

  return <FlatList data={todos} /* ... */ />;
}

// Must wrap in Suspense + ErrorBoundary
function TodoScreen({ listId }: { listId: string }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<ActivityIndicator />}>
        <TodoListSuspense listId={listId} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

### useStatus -- Connection and Sync Status

```tsx
import { useStatus } from "@powersync/react";
import { View, Text } from "react-native";

function SyncIndicator() {
  const status = useStatus();

  return (
    <View>
      <Text>Connected: {status.connected ? "Yes" : "No"}</Text>
      <Text>Initial sync done: {status.hasSynced ? "Yes" : "No"}</Text>
    </View>
  );
}

export { SyncIndicator };
```

### usePowerSync -- Direct Database Access

```tsx
import { usePowerSync } from "@powersync/react";

function useCreateList() {
  const powersync = usePowerSync();

  const createList = async (name: string, ownerId: string) => {
    await powersync.execute(
      "INSERT INTO lists (id, name, created_at, owner_id) VALUES (uuid(), ?, datetime(), ?)",
      [name, ownerId],
    );
  };

  return { createList };
}
```

---

## Pattern 4: CRUD Operations

### Write Operations (execute)

```typescript
import type { AbstractPowerSyncDatabase } from "@powersync/react-native";

// INSERT -- uuid() is a PowerSync SQL function
async function createTodo(
  db: AbstractPowerSyncDatabase,
  listId: string,
  description: string,
): Promise<void> {
  await db.execute(
    "INSERT INTO todos (id, list_id, description, created_at, completed) VALUES (uuid(), ?, ?, datetime(), 0)",
    [listId, description],
  );
}

// UPDATE
async function completeTodo(
  db: AbstractPowerSyncDatabase,
  todoId: string,
): Promise<void> {
  await db.execute(
    "UPDATE todos SET completed = 1, completed_at = datetime() WHERE id = ?",
    [todoId],
  );
}

// DELETE
async function deleteTodo(
  db: AbstractPowerSyncDatabase,
  todoId: string,
): Promise<void> {
  await db.execute("DELETE FROM todos WHERE id = ?", [todoId]);
}
```

### Read Operations (get, getAll, getOptional)

```typescript
// getAll -- returns array, empty array if no results
const todos = await db.getAll<TodoRecord>(
  "SELECT * FROM todos WHERE list_id = ?",
  [listId],
);

// get -- returns single row, THROWS if not found
const todo = await db.get<TodoRecord>("SELECT * FROM todos WHERE id = ?", [
  todoId,
]);

// getOptional -- returns single row or null
const maybeTodo = await db.getOptional<TodoRecord>(
  "SELECT * FROM todos WHERE id = ?",
  [todoId],
);
```

**Why good:** Three read methods for three use cases -- `getAll` for lists, `get` when the row must exist (throws on missing), `getOptional` when the row might not exist

### Transactions

```typescript
// Execute multiple operations atomically
await db.writeTransaction(async (tx) => {
  await tx.execute(
    "INSERT INTO lists (id, name, created_at, owner_id) VALUES (uuid(), ?, datetime(), ?)",
    [name, ownerId],
  );
  await tx.execute(
    "INSERT INTO todos (id, list_id, description, created_at, completed) VALUES (uuid(), last_insert_rowid(), ?, datetime(), 0)",
    [firstTodoDescription],
  );
});
```

---

## Pattern 5: Watched Queries with Raw API (Non-React)

For use outside React components (services, background tasks):

```typescript
// watch() returns an async iterable
for await (const result of powersync.watch(
  "SELECT * FROM todos WHERE completed = 0",
)) {
  console.log("Active todos:", result.rows?.length);
}

// With throttling
for await (const result of powersync.watch(
  "SELECT COUNT(*) as count FROM todos",
  [],
  { throttleMs: 1000 }, // Re-query at most once per second
)) {
  updateBadgeCount(result.rows?.[0]?.count ?? 0);
}
```

**Why good:** Works outside React, async iterable is a standard JS pattern, `throttleMs` prevents excessive re-queries during rapid changes
