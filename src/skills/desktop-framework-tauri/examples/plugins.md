# Tauri - Plugins

> Official plugin installation, usage patterns, and common plugin examples. See [SKILL.md](../SKILL.md) for the plugin decision tree. See [reference.md](../reference.md) for the full plugin registry.

---

## Plugin Installation Pattern

Every official plugin follows four steps. Missing any step causes runtime errors (not compile errors).

```sh
# 1. Add the Rust crate
cargo add tauri-plugin-store

# 2. Add the JS bindings
npm add @tauri-apps/plugin-store

# 3. Register the plugin in Rust (src-tauri/src/lib.rs)
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())

# 4. Add permissions to a capability file (src-tauri/capabilities/main.json)
# "store:default"
```

**Why all four steps:** The Rust crate provides backend functionality, the npm package provides typed JS bindings, `.plugin()` activates the plugin at runtime, and the capability permission authorizes the frontend to invoke plugin commands.

**Common mistake:** Adding the Cargo crate and npm package but forgetting `.plugin()` registration or capability permissions. Both cause runtime errors with unhelpful messages.

---

## File System Plugin

```rust
// src-tauri/src/lib.rs
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
```

```json
// Capability permissions
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
    }
  ]
}
```

```typescript
import {
  readTextFile,
  writeTextFile,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

// Read from app data directory
const content = await readTextFile("config.json", {
  baseDir: BaseDirectory.AppData,
});

// Write to app data directory
await writeTextFile("config.json", JSON.stringify(data), {
  baseDir: BaseDirectory.AppData,
});
```

**Key point:** Always scope filesystem permissions to specific directories using path variables. Never grant unscoped `fs:allow-read-text-file` -- it allows reading any file on the system.

---

## Dialog Plugin

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
```

```typescript
import { open, save, message, ask } from "@tauri-apps/plugin-dialog";

// File picker
const filePath = await open({
  multiple: false,
  filters: [{ name: "Documents", extensions: ["txt", "md", "json"] }],
});

// Save dialog
const savePath = await save({
  defaultPath: "export.json",
  filters: [{ name: "JSON", extensions: ["json"] }],
});

// Message dialog
await message("Operation complete", { title: "Success", kind: "info" });

// Confirm dialog
const confirmed = await ask("Are you sure?", {
  title: "Confirm",
  kind: "warning",
});
```

**Key point:** Dialog functions return `null` when the user cancels. Always handle the null case.

---

## Store Plugin (Persistent Key-Value)

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
```

```typescript
import { load } from "@tauri-apps/plugin-store";

// Load or create a store (persisted as JSON file in app data)
const store = await load("settings.json", { autoSave: true });

// Set values
await store.set("theme", "dark");
await store.set("windowSize", { width: 1024, height: 768 });

// Get values
const theme = await store.get<string>("theme");
const size = await store.get<{ width: number; height: number }>("windowSize");

// Check existence
const hasTheme = await store.has("theme");

// Delete
await store.delete("theme");

// Iterate
const keys = await store.keys();
const entries = await store.entries<string>();

// Manual save (if autoSave is false)
await store.save();
```

**Key point:** The store persists automatically to a JSON file in the app data directory when `autoSave: true`. Store data is NOT encrypted -- use the Stronghold plugin for sensitive data.

---

## HTTP Plugin

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
```

```json
// Capability -- scope HTTP access to specific domains
{
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.example.com/**" }]
    }
  ]
}
```

```typescript
import { fetch } from "@tauri-apps/plugin-http";

const response = await fetch("https://api.example.com/data", {
  method: "GET",
  headers: { Authorization: "Bearer token" },
});

const data = await response.json();
```

**Key point:** The HTTP plugin bypasses CORS restrictions (requests go through the Rust backend, not the webview). Scope the URL pattern in capabilities to prevent the app from making requests to arbitrary domains.

---

## Shell Plugin

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
```

```json
// Capability -- carefully scope shell access
{
  "permissions": [
    "shell:allow-open",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "run-git",
          "cmd": "git",
          "args": ["status"],
          "sidecar": false
        }
      ]
    }
  ]
}
```

```typescript
import { open } from "@tauri-apps/plugin-shell";

// Open URL in default browser
await open("https://tauri.app");

// Open file with default application
await open("/path/to/document.pdf");
```

**Key point:** Shell execution is dangerous and desktop-only. `shell:allow-open` (for URLs/files) is the `:default` permission. For `shell:allow-execute`, you must explicitly list each allowed command and its arguments. Never grant unscoped shell execute access.

---

## Notification Plugin

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
```

```typescript
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

// Check and request notification permission
let permissionGranted = await isPermissionGranted();
if (!permissionGranted) {
  const permission = await requestPermission();
  permissionGranted = permission === "granted";
}

if (permissionGranted) {
  sendNotification({
    title: "Download Complete",
    body: "Your file has been downloaded successfully.",
  });
}
```

**Key point:** On macOS and mobile, notifications require explicit user permission. Always check `isPermissionGranted()` before sending.

---

## Registering Multiple Plugins

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![/* your commands */])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Key point:** Plugin registration order does not matter. Each `.plugin()` call is independent. Group all plugin registrations before `.invoke_handler()` for readability.

---

See [security.md](security.md) for permission scoping and [reference.md](../reference.md) for the complete plugin registry table.
