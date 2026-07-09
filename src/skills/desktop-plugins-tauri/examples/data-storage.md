# Tauri Plugins - Data & Storage

> File system, store, SQL, and Stronghold plugin APIs. See [core.md](core.md) for installation and permission patterns. See [reference.md](../reference.md) for the full plugin registry.

---

## File System Plugin

### Reading and Writing Files

```typescript
import {
  readTextFile,
  writeTextFile,
  readDir,
  mkdir,
  exists,
  remove,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

// Read from app data directory
const content = await readTextFile("config.json", {
  baseDir: BaseDirectory.AppData,
});

// Write to app data directory
await writeTextFile("config.json", JSON.stringify(data, null, 2), {
  baseDir: BaseDirectory.AppData,
});

// Check if file exists
const fileExists = await exists("config.json", {
  baseDir: BaseDirectory.AppData,
});

// Create directory
await mkdir("exports", { baseDir: BaseDirectory.AppData, recursive: true });

// List directory contents
const entries = await readDir("exports", {
  baseDir: BaseDirectory.AppData,
});

// Remove file
await remove("old-config.json", { baseDir: BaseDirectory.AppData });
```

**Key points:**

- Always use `BaseDirectory` enum for portable paths across platforms
- Always scope filesystem permissions to specific directories in the capability file
- Binary files use `readFile` / `writeFile` (returns/accepts `Uint8Array`)

### Capability Permissions

```json
{
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-exists",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-mkdir",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-read-dir",
      "allow": [{ "path": "$APPDATA/**" }]
    }
  ]
}
```

---

## Store Plugin (Persistent Key-Value)

### JavaScript API

```typescript
import { Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "settings.json";

// Load or create a store (persisted as JSON in app data)
const store = await Store.load(STORE_FILE, { autoSave: true });

// Set values (supports any serializable type)
await store.set("theme", "dark");
await store.set("windowSize", { width: 1024, height: 768 });
await store.set("recentFiles", ["/path/one.txt", "/path/two.txt"]);

// Get values (typed)
const theme = await store.get<string>("theme");
const size = await store.get<{ width: number; height: number }>("windowSize");

// Check existence
const hasTheme = await store.has("theme");

// Delete a key
await store.delete("theme");

// Iterate
const keys = await store.keys();
const values = await store.values();
const entries = await store.entries<string>();

// Clear all data
await store.clear();

// Manual save (only needed if autoSave is false)
await store.save();
```

### LazyStore (Loads on First Access)

```typescript
import { LazyStore } from "@tauri-apps/plugin-store";

// LazyStore defers loading until the first get/set call
const store = new LazyStore("settings.json");
```

### Rust API

```rust
use tauri::Manager;
use serde_json::json;

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let store = app.store("store.json")?;
    store.set("some-key", json!({ "value": 5 }));
    let value = store.get("some-key");
    Ok(())
}
```

**Key points:**

- Store persists as a JSON file in the app data directory
- `autoSave: true` saves after every `.set()`. `autoSave: false` requires manual `.save()`. A number value debounces saves by that many milliseconds.
- Store data is NOT encrypted -- use Stronghold for sensitive data
- Permissions: `"store:default"` grants all operations

---

## SQL Plugin (SQLite / MySQL / PostgreSQL)

### Installation with Feature Flag

```sh
# Choose your database engine
cargo add tauri-plugin-sql --features sqlite
# Or: --features mysql
# Or: --features postgres
```

### Rust Setup with Migrations

```rust
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

let migrations = vec![
    Migration {
        version: 1,
        description: "create_users_table",
        sql: "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "create_todos_table",
        sql: "CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );",
        kind: MigrationKind::Up,
    },
];

tauri::Builder::default()
    .plugin(
        Builder::default()
            .add_migrations("sqlite:app.db", migrations)
            .build(),
    )
```

### JavaScript API

```typescript
import Database from "@tauri-apps/plugin-sql";

// Connect (SQLite creates the file automatically)
const db = await Database.load("sqlite:app.db");

// INSERT (SQLite uses $1, $2 placeholders)
await db.execute("INSERT INTO users (name, email) VALUES ($1, $2)", [
  "Alice",
  "alice@example.com",
]);

// SELECT
const users = await db.select<
  Array<{ id: number; name: string; email: string }>
>("SELECT * FROM users WHERE name = $1", ["Alice"]);

// UPDATE
await db.execute("UPDATE users SET name = $1 WHERE id = $2", [
  "Alice Smith",
  1,
]);

// DELETE
await db.execute("DELETE FROM users WHERE id = $1", [1]);

// Close connection
await db.close();
```

**Key points:**

- Default permissions only include read operations -- add `"sql:allow-execute"` for INSERT/UPDATE/DELETE
- Migrations run automatically when the database is loaded (either via `preload` config or `Database.load()`)
- Migrations execute in a transaction -- failures cause complete rollback
- SQLite and PostgreSQL use `$1, $2, $3` placeholders; MySQL uses `?, ?, ?`

### Permissions

```json
{
  "permissions": ["sql:default", "sql:allow-execute"]
}
```

---

## Stronghold Plugin (Encrypted Storage)

### Rust Setup (with Argon2 Hashing)

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            use argon2::{hash_raw, Config, Variant, Version};

            let config = Config {
                lanes: 4,
                mem_cost: 10_000,
                time_cost: 10,
                variant: Variant::Argon2id,
                version: Version::Version13,
                ..Default::default()
            };

            let salt = "your-salt".as_bytes();
            let key = hash_raw(password.as_ref(), salt, &config)
                .expect("failed to hash password");
            key.to_vec()
        })
        .build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Note:** Add `rust-argon2 = "2"` to your `src-tauri/Cargo.toml` dependencies.

### JavaScript API

```typescript
import { Client, Stronghold } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";

// Initialize Stronghold
const vaultPath = `${await appDataDir()}/vault.hold`;
const stronghold = await Stronghold.load(vaultPath, "vault-password");

// Create or load a client
let client: Client;
try {
  client = await stronghold.loadClient("my-client");
} catch {
  client = await stronghold.createClient("my-client");
}

// Get the store
const store = client.getStore();

// Insert a secret (data must be Uint8Array)
const encoder = new TextEncoder();
await store.insert("api-key", Array.from(encoder.encode("sk-secret-value")));

// Retrieve a secret
const data = await store.get("api-key");
const secret = new TextDecoder().decode(new Uint8Array(data));

// Remove a record
await store.remove("api-key");

// IMPORTANT: Save changes to disk
await stronghold.save();

// Unload when done
await stronghold.unload(vaultPath);
```

**Key points:**

- Desktop-only plugin (Windows, macOS, Linux)
- Data is stored as `Uint8Array`, not strings -- use `TextEncoder`/`TextDecoder` for conversion
- `stronghold.save()` must be called to persist changes to disk
- `Builder::new()` takes a closure that hashes the vault password -- use a secure algorithm like Argon2
- Add `rust-argon2` crate for the password hashing implementation
- Permissions: `"stronghold:default"` grants all store operations

---

See [system.md](system.md) for shell, notification, clipboard, dialog plugin APIs. See [lifecycle.md](lifecycle.md) for updater, autostart, deep-link APIs.
