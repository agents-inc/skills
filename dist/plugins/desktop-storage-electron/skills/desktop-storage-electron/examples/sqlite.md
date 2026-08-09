# Electron Storage - better-sqlite3 Patterns

> SQLite database setup, WAL mode, prepared statements, transactions, migrations, native module rebuild. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [core.md](core.md) for electron-store and safeStorage.

---

## Database Setup with Performance Pragmas

```typescript
import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";

const DB_FILE = "app-data.db";
const CACHE_SIZE_KB = 64000; // 64MB cache

function openDatabase(): Database.Database {
  const dbPath = path.join(app.getPath("userData"), DB_FILE);
  const db = new Database(dbPath);

  // Performance and safety pragmas -- set once per connection
  db.pragma("journal_mode = WAL"); // Concurrent reads during writes
  db.pragma("synchronous = NORMAL"); // Balanced durability and speed
  db.pragma("foreign_keys = ON"); // Enforce referential integrity
  db.pragma(`cache_size = -${CACHE_SIZE_KB}`); // Negative = KB (positive = pages)
  db.pragma("busy_timeout = 5000"); // Wait 5s on lock instead of failing immediately
  db.pragma("wal_autocheckpoint = 1000"); // Default -- checkpoint every 1000 pages

  return db;
}

// Close cleanly on app quit
app.on("before-quit", () => {
  db.pragma("wal_checkpoint(TRUNCATE)"); // Flush WAL to main file
  db.close();
});
```

**Why good:** WAL mode is critical for multi-window apps (readers do not block writers), `busy_timeout` prevents immediate SQLITE_BUSY errors, clean shutdown truncates the WAL file for smaller backups

---

## Prepared Statements

Prepare once, execute many times. Avoids re-parsing SQL on every call.

```typescript
// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Prepare reusable statements
const insertNote = db.prepare(`
  INSERT INTO notes (id, title, content) VALUES (@id, @title, @content)
`);

const getNote = db.prepare(`
  SELECT * FROM notes WHERE id = ?
`);

const getAllNotes = db.prepare(`
  SELECT id, title, created_at, updated_at FROM notes ORDER BY updated_at DESC
`);

const updateNote = db.prepare(`
  UPDATE notes SET title = @title, content = @content, updated_at = datetime('now')
  WHERE id = @id
`);

const deleteNote = db.prepare(`
  DELETE FROM notes WHERE id = ?
`);

// Usage
insertNote.run({ id: crypto.randomUUID(), title: "My Note", content: "Hello" });

const note = getNote.get("abc-123"); // Single row or undefined
const notes = getAllNotes.all(); // Array of rows

updateNote.run({ id: "abc-123", title: "Updated", content: "New content" });
deleteNote.run("abc-123");
```

**Why good:** Named parameters (`@id`) are self-documenting, positional `?` works for single-parameter queries, `.get()` returns a single row, `.all()` returns an array

---

## Transactions for Bulk Operations

Transactions make bulk operations atomic and dramatically faster (50x+ for many inserts).

```typescript
interface NoteInput {
  id: string;
  title: string;
  content: string;
}

const insertNote = db.prepare(`
  INSERT INTO notes (id, title, content) VALUES (@id, @title, @content)
`);

// Wrap in transaction for atomicity and performance
const insertMany = db.transaction((notes: NoteInput[]) => {
  for (const note of notes) {
    insertNote.run(note);
  }
  return notes.length;
});

// All-or-nothing: if any insert fails, all are rolled back
const count = insertMany([
  { id: "1", title: "Note 1", content: "Content 1" },
  { id: "2", title: "Note 2", content: "Content 2" },
  { id: "3", title: "Note 3", content: "Content 3" },
]);
```

**Why good:** Without a transaction, each insert is a separate disk write. With a transaction, all writes happen in one disk operation. Automatic rollback on exception.

**Critical:** Transaction functions must be synchronous. Async functions return at the first `await`, which commits the transaction prematurely:

```typescript
// BAD: async inside transaction
const broken = db.transaction(async (data: NoteInput[]) => {
  for (const note of data) {
    await someAsyncValidation(note); // Transaction already committed!
    insertNote.run(note);
  }
});
```

---

## Schema Migrations

Run migrations on database open to evolve the schema across app versions.

```typescript
const CURRENT_SCHEMA_VERSION = 3;

function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  if (currentVersion >= CURRENT_SCHEMA_VERSION) return;

  const migrate = db.transaction(() => {
    if (currentVersion < 1) {
      db.exec(`
        CREATE TABLE notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    }

    if (currentVersion < 2) {
      db.exec(`ALTER TABLE notes ADD COLUMN updated_at TEXT`);
      db.exec(
        `UPDATE notes SET updated_at = created_at WHERE updated_at IS NULL`,
      );
    }

    if (currentVersion < 3) {
      db.exec(
        `ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`,
      );
      db.exec(`CREATE INDEX idx_notes_archived ON notes(archived)`);
    }

    db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
  });

  migrate();
}

// Usage
const db = openDatabase();
runMigrations(db);
```

**Why good:** Uses SQLite's `user_version` pragma to track schema version, runs all pending migrations in a single transaction (all-or-nothing), idempotent -- safe to run on every app start

---

## Expose to Renderer via IPC

The database lives in the main process. Renderers interact via IPC handlers.

```typescript
// main.ts
import { ipcMain } from "electron";

const db = openDatabase();
runMigrations(db);

const insertNote = db.prepare(`
  INSERT INTO notes (id, title, content) VALUES (@id, @title, @content)
`);
const getNote = db.prepare("SELECT * FROM notes WHERE id = ?");
const getAllNotes = db.prepare("SELECT * FROM notes ORDER BY updated_at DESC");
const deleteNote = db.prepare("DELETE FROM notes WHERE id = ?");

ipcMain.handle(
  "notes:create",
  (_event, note: { title: string; content: string }) => {
    const id = crypto.randomUUID();
    insertNote.run({ id, title: note.title, content: note.content });
    return getNote.get(id);
  },
);

ipcMain.handle("notes:list", () => {
  return getAllNotes.all();
});

ipcMain.handle("notes:delete", (_event, id: string) => {
  const result = deleteNote.run(id);
  return result.changes > 0; // true if a row was deleted
});
```

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from "electron/renderer";

contextBridge.exposeInMainWorld("notesAPI", {
  create: (note: { title: string; content: string }) =>
    ipcRenderer.invoke("notes:create", note),
  list: () => ipcRenderer.invoke("notes:list"),
  delete: (id: string) => ipcRenderer.invoke("notes:delete", id),
});
```

**Why good:** Renderer has no database access, IPC handlers validate and execute queries in the main process, prepared statements are reused across calls

---

## Native Module Rebuild for Electron

better-sqlite3 is a native C++ module that must be compiled against Electron's Node.js version.

```json
// package.json
{
  "dependencies": {
    "better-sqlite3": "^12.8.0"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.7.0"
  },
  "scripts": {
    "postinstall": "electron-rebuild"
  },
  "build": {
    "npmRebuild": true,
    "asarUnpack": ["node_modules/better-sqlite3"]
  }
}
```

**Key points:**

- `better-sqlite3` must be in `dependencies` (not `devDependencies`) -- `@electron/rebuild` skips dev dependencies
- `asarUnpack` extracts the native binary from the ASAR archive -- it cannot load from inside ASAR
- The `postinstall` script ensures the native module is rebuilt every time dependencies are installed
- If using Electron Forge, `@electron/rebuild` is already integrated -- check your forge config

---

## In-Memory Database for Tests

```typescript
import Database from "better-sqlite3";

function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db); // Apply schema to in-memory DB
  return db;
}

// Usage in tests
const db = createTestDatabase();
// ... run test queries
db.close();
```

**Why good:** In-memory databases are fast, isolated per test, and automatically cleaned up on `close()`. Use the same migration function as production for schema consistency.

---

See [core.md](core.md) for electron-store and safeStorage patterns. See [../reference.md](../reference.md) for API quick-reference tables.
