---
name: desktop-storage-electron
description: Persistent storage, SQLite databases, and credential management in Electron apps
---

# Electron Storage & Credentials

> **Quick Guide:** Use `electron-store` for typed JSON preferences (small key-value config with schema validation, migrations, and file watching). Use `better-sqlite3` for structured/relational data or anything beyond simple key-value (synchronous, WAL mode, transactions). Use `safeStorage` for encrypting secrets like tokens and API keys via the OS keychain -- it replaces the deprecated `keytar`. All persistent data belongs under `app.getPath("userData")`. Never store secrets in plain JSON files.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `safeStorage.encryptString()` / `safeStorage.decryptString()` for secrets -- never store tokens, API keys, or passwords in plain text or in electron-store without OS-level encryption)**

**(You MUST store all persistent data under `app.getPath("userData")` -- never write to the app installation directory, which is replaced on updates)**

**(You MUST enable WAL mode (`PRAGMA journal_mode = WAL`) when using better-sqlite3 -- it prevents readers from blocking writers and avoids SQLITE_BUSY errors in multi-window apps)**

**(You MUST call `safeStorage.isEncryptionAvailable()` before encrypting -- it returns false before the app `ready` event and on some Linux configurations)**

**(You MUST rebuild better-sqlite3 for Electron's Node.js version using `@electron/rebuild` -- mismatched native bindings crash the app)**

</critical_requirements>

---

**Auto-detection:** electron-store, better-sqlite3, safeStorage, app.getPath, userData, encryptString, decryptString, isEncryptionAvailable, lowdb, JSONFilePreset, persistent storage, credential storage, keytar replacement, electron config, electron preferences, electron database

**When to use:**

- Persisting user preferences and app configuration
- Storing structured or relational data locally
- Encrypting tokens, API keys, or other secrets
- Choosing between storage solutions for an Electron app
- Migrating stored data between app versions
- Working with `app.getPath()` standard directories

**When NOT to use:**

- Choosing a UI framework or styling for the renderer (separate skill)
- IPC communication patterns between main and renderer (separate concern)
- Packaging and distribution concerns (separate concern)
- Server-side or cloud storage

**Key patterns covered:**

- electron-store: typed config, schema validation, migrations, encryption, watching
- better-sqlite3: WAL mode, prepared statements, transactions, native module rebuild
- safeStorage: OS keychain encryption for secrets, replacing keytar
- lowdb: lightweight JSON database for medium-complexity data
- Storage path conventions using `app.getPath()`
- Credential storage best practices

---

<philosophy>

## Philosophy

Electron apps have access to the full filesystem but should store data in OS-designated locations. The right storage solution depends on data shape and sensitivity:

**Preferences and small config** (theme, window bounds, feature flags): `electron-store` writes a single JSON file atomically. It is read and written in full on every change, so it is only appropriate for small data (under ~1MB).

**Structured or queryable data** (chat history, project metadata, analytics): `better-sqlite3` provides a synchronous SQLite database with ACID transactions. It handles concurrent reads via WAL mode and scales to gigabytes.

**Secrets** (OAuth tokens, API keys, passwords): `safeStorage` uses the OS keychain (macOS Keychain, Windows DPAPI, Linux secret service) to encrypt strings. The encrypted buffer can be stored in electron-store or a file -- only your app can decrypt it on the same machine and user account.

**Medium-complexity JSON data** (todo lists, small document stores): `lowdb` provides a file-backed JavaScript object with native array methods. Simpler than SQLite for JSON-shaped data that does not need relational queries.

**Key principle:** Storage runs in the **main process**. Renderers request data via IPC. Never give renderers direct filesystem or database access.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: electron-store -- Typed Preferences

Use for small key-value configuration that persists across sessions. Supports schema validation, defaults, and migrations.

```typescript
import Store from "electron-store";

interface AppSettings {
  theme: "light" | "dark" | "system";
  windowBounds: { width: number; height: number; x?: number; y?: number };
  recentFiles: string[];
  fontSize: number;
}

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;
const DEFAULT_FONT_SIZE = 14;

const store = new Store<AppSettings>({
  defaults: {
    theme: "system",
    windowBounds: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
    recentFiles: [],
    fontSize: DEFAULT_FONT_SIZE,
  },
  schema: {
    fontSize: {
      type: "number",
      minimum: MIN_FONT_SIZE,
      maximum: MAX_FONT_SIZE,
    },
  },
});
```

**Why good:** Type-safe generic parameter ensures `.get()` and `.set()` are checked at compile time, named constants for all limits, schema rejects invalid values at write time

See [examples/core.md](examples/core.md) for migrations, file watching, dot-notation access, and renderer integration via IPC.

---

### Pattern 2: better-sqlite3 -- Local Database

Use for structured data that benefits from queries, indexes, or transactions. Always enable WAL mode.

```typescript
import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";

const DB_FILE = "app-data.db";

const db = new Database(path.join(app.getPath("userData"), DB_FILE));

// Performance pragmas -- set once at connection open
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
```

**Why good:** WAL mode allows concurrent reads during writes (essential for multi-window apps), `synchronous = NORMAL` balances safety and speed, foreign keys enforce referential integrity

See [examples/sqlite.md](examples/sqlite.md) for prepared statements, transactions, bulk inserts, and schema migrations.

---

### Pattern 3: safeStorage -- OS Keychain Encryption

Use for secrets (tokens, API keys, passwords). The encrypted buffer is opaque -- only your app on the same machine and user account can decrypt it.

```typescript
import { safeStorage, app } from "electron";
import Store from "electron-store";

const credentialStore = new Store<Record<string, string>>({
  name: "credentials",
});

function saveSecret(key: string, plainText: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS encryption is not available");
  }
  const encrypted = safeStorage.encryptString(plainText);
  credentialStore.set(key, encrypted.toString("base64"));
}

function loadSecret(key: string): string | null {
  const stored = credentialStore.get(key);
  if (!stored) return null;
  const buffer = Buffer.from(stored, "base64");
  return safeStorage.decryptString(buffer);
}
```

**Why good:** Secrets are encrypted via the OS keychain before being persisted, base64 encoding allows storing the buffer in JSON, explicit availability check prevents crashes on unsupported systems

See [examples/core.md](examples/core.md) for the full credential manager pattern and async API usage.

---

### Pattern 4: Storage Path Conventions

All persistent data belongs under `app.getPath("userData")`. Use other paths for specific purposes.

```typescript
import { app } from "electron";

// User-specific persistent data (config, databases, credentials)
const userDataDir = app.getPath("userData");
//  macOS: ~/Library/Application Support/<AppName>
//  Windows: %APPDATA%/<AppName>
//  Linux: ~/.config/<AppName>

// Temporary files (cache, downloads in progress)
const tempDir = app.getPath("temp");

// Log files
const logsDir = app.getPath("logs");

// User's documents, downloads, desktop (for file save dialogs)
const documentsDir = app.getPath("documents");
const downloadsDir = app.getPath("downloads");
```

**Key point:** The `userData` directory survives app updates. The app installation directory does not -- writing data there causes data loss on update.

---

### Pattern 5: lowdb -- Lightweight JSON Database

Use when data is JSON-shaped but too complex for flat key-value (nested arrays, document collections) and does not need relational queries.

```typescript
import { JSONFilePreset } from "lowdb/node";
import { app } from "electron";
import path from "node:path";

interface ProjectData {
  projects: Array<{ id: string; name: string; lastOpened: string }>;
  settings: { sortBy: "name" | "lastOpened" };
}

const DB_FILE = "projects.json";
const defaultData: ProjectData = {
  projects: [],
  settings: { sortBy: "lastOpened" },
};

const db = await JSONFilePreset<ProjectData>(
  path.join(app.getPath("userData"), DB_FILE),
  defaultData,
);

// Read
const recent = db.data.projects.toSorted((a, b) =>
  b.lastOpened.localeCompare(a.lastOpened),
);

// Write (mutate then persist)
db.data.projects.push({
  id: "abc",
  name: "New Project",
  lastOpened: new Date().toISOString(),
});
await db.write();
```

**Why good:** Plain JavaScript data access (no query language), type-safe with generics, file I/O only on explicit `.write()` call

**When to prefer SQLite instead:** Data exceeds ~10MB, you need indexes or joins, you need concurrent write safety, or you need partial reads (lowdb loads the entire file into memory).

</patterns>

---

<decision_framework>

## Decision Framework

### Choosing a Storage Solution

```
What kind of data?
|
+-- User preferences / small config (theme, window size, feature flags)?
|   +-- electron-store (JSON file, schema validation, migrations)
|
+-- Secrets (tokens, API keys, passwords)?
|   +-- safeStorage + electron-store or file
|   +-- Never plain text, never unencrypted electron-store
|
+-- Structured / relational data (records, queries, indexes)?
|   +-- better-sqlite3 (WAL mode, transactions, scales to GB)
|
+-- JSON document collections (nested objects, no joins needed)?
|   +-- Small (<10MB) -> lowdb
|   +-- Large or concurrent writes -> better-sqlite3 with JSON columns
|
+-- Temporary / cache data?
|   +-- app.getPath("temp") + regular file I/O
|
+-- Session-only state (lost on quit)?
    +-- In-memory (no persistence needed)
```

### electron-store vs better-sqlite3

| Criteria          | electron-store             | better-sqlite3                      |
| ----------------- | -------------------------- | ----------------------------------- |
| Data shape        | Flat key-value, small JSON | Relational, structured records      |
| Data size         | < 1MB                      | Up to several GB                    |
| Query capability  | Get by key, dot-notation   | Full SQL, indexes, joins            |
| Concurrent access | Single process only        | WAL mode supports multi-window      |
| Schema evolution  | Migrations by semver       | SQL ALTER TABLE / migration scripts |
| Setup complexity  | Zero (pure JS)             | Native module rebuild required      |
| Best for          | Preferences, feature flags | Chat history, project data, logs    |

### safeStorage vs electron-store encryptionKey

| Feature             | safeStorage                    | electron-store encryptionKey        |
| ------------------- | ------------------------------ | ----------------------------------- |
| Security level      | OS keychain (strong)           | Obfuscation only (weak)             |
| Key management      | OS manages keys                | Key embedded in source code         |
| Use for secrets     | Yes                            | No -- not actual encryption         |
| Use for obfuscation | Overkill                       | Yes -- prevents casual file reading |
| Platform support    | macOS, Windows, Linux (varies) | All platforms                       |

</decision_framework>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - electron-store setup, migrations, watching, safeStorage credential manager, lowdb, storage paths
- [examples/sqlite.md](examples/sqlite.md) - better-sqlite3 setup, WAL mode, prepared statements, transactions, migrations, native rebuild
- [reference.md](reference.md) - API quick-reference tables, path directory map, security checklist

---

<red_flags>

## RED FLAGS

**Critical Security Issues:**

- Storing tokens, API keys, or passwords in plain text (electron-store without safeStorage)
- Using `electron-store`'s `encryptionKey` option for actual secrets -- it is obfuscation, not encryption. The key is in your source code.
- Writing persistent data to the app installation directory -- it is deleted on update
- Giving renderer processes direct filesystem or database access -- route through IPC

**Architecture Issues:**

- Not enabling WAL mode with better-sqlite3 -- causes `SQLITE_BUSY` errors when reading and writing concurrently
- Using better-sqlite3 without `@electron/rebuild` -- native module version mismatch crashes the app at startup
- Using electron-store for large datasets (>1MB) -- the entire file is read and written on every change
- Running database operations in the renderer process instead of the main process
- Not checking `safeStorage.isEncryptionAvailable()` before encrypting -- crashes on Linux without a secret service

**Common Mistakes:**

- Calling `safeStorage` methods before `app.whenReady()` -- encryption is unavailable until the app is ready
- Forgetting to `db.close()` on `before-quit` -- risks WAL file corruption
- Using async functions inside `better-sqlite3` transactions -- the transaction commits at the first `await`, not at function end
- Not using `asarUnpack` for better-sqlite3 in packaged builds -- the native binary fails to load from inside ASAR archives
- Storing `Buffer` objects directly in electron-store -- they serialize incorrectly. Convert to base64 strings.

**Gotchas & Edge Cases:**

- `electron-store` requires Electron 30+ and is ESM-only (no CommonJS)
- `safeStorage` on Windows (DPAPI) protects data per-user but not per-app -- another app running as the same user could theoretically decrypt
- `safeStorage` on Linux depends on the desktop environment's secret service (gnome-keyring, KWallet) -- falls back to plaintext if none is available
- `electron-store`'s `schema` validation uses JSON Schema draft-2020-12 via ajv -- not Zod
- `Object.groupBy` on `better-sqlite3` result rows works but rows are plain objects with a null prototype -- use `Object.hasOwn()` not `hasOwnProperty`

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `safeStorage.encryptString()` / `safeStorage.decryptString()` for secrets -- never store tokens, API keys, or passwords in plain text or in electron-store without OS-level encryption)**

**(You MUST store all persistent data under `app.getPath("userData")` -- never write to the app installation directory, which is replaced on updates)**

**(You MUST enable WAL mode (`PRAGMA journal_mode = WAL`) when using better-sqlite3 -- it prevents readers from blocking writers and avoids SQLITE_BUSY errors in multi-window apps)**

**(You MUST call `safeStorage.isEncryptionAvailable()` before encrypting -- it returns false before the app `ready` event and on some Linux configurations)**

**(You MUST rebuild better-sqlite3 for Electron's Node.js version using `@electron/rebuild` -- mismatched native bindings crash the app)**

**Failure to follow these rules will cause data loss, security vulnerabilities, or application crashes.**

</critical_reminders>
