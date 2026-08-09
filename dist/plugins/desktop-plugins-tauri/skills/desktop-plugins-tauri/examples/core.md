# Tauri Plugins - Core Patterns

> Installation pattern, permission scoping, multi-plugin registration. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [reference.md](../reference.md) for the full plugin registry.

---

## Four-Step Installation Pattern

Every official plugin follows the same four steps. Missing any step causes runtime errors (not compile errors).

```sh
# Step 1: Add the Rust crate
cargo add tauri-plugin-fs

# Step 2: Add the JS bindings
npm add @tauri-apps/plugin-fs

# Step 3: Register the plugin in Rust (src-tauri/src/lib.rs)
```

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())  // Step 3
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```json
// Step 4: Add permissions to capability file (src-tauri/capabilities/main.json)
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": ["core:default", "fs:default"]
}
```

**Why all four steps:** The Rust crate provides backend functionality, the npm package provides typed JS bindings, `.plugin()` activates the plugin at runtime, and the capability permission authorizes the frontend to invoke plugin commands.

**Shortcut:** `cargo tauri add <plugin-name>` handles steps 1 and 3 (Cargo crate + Rust registration). You still need npm install (step 2) and capability permissions (step 4).

---

## Permission Scoping

### Scoped Filesystem Access

```json
{
  "permissions": [
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

**Why good:** Restricts read/write to the app data directory only. Without scoping, `fs:allow-read-text-file` grants access to the entire filesystem.

### Scoped HTTP Access

```json
{
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.example.com/**" }]
    }
  ]
}
```

**Why good:** Restricts HTTP requests to a specific domain. Without scoping, the app could make requests to any server.

### Scoped Shell Execution

```json
{
  "permissions": [
    "shell:allow-open",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "run-git-status",
          "cmd": "git",
          "args": ["status"],
          "sidecar": false
        }
      ]
    }
  ]
}
```

**Why good:** Only allows running `git status` specifically. Never grant unscoped `shell:allow-execute` -- it allows running any command on the system.

---

## Multi-Plugin Registration

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Cross-platform plugins
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            // Desktop-only plugins must be guarded
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_shell::init())?;
                app.handle().plugin(
                    tauri_plugin_autostart::init(
                        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                        None,
                    )
                );
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new().build()
                )?;
                app.handle().plugin(
                    tauri_plugin_updater::Builder::new().build()
                )?;
                app.handle().plugin(
                    tauri_plugin_window_state::Builder::default().build()
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![/* your commands */])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Key points:**

- Plugin registration order does not matter
- Cross-platform plugins register directly on the Builder
- Desktop-only plugins register inside `setup()` with `#[cfg(desktop)]` guard
- Use `app.handle().plugin()` inside `setup()` (not the builder chain)

---

## Capability File with Multiple Plugins

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Main window permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "store:default",
    "notification:default",
    "process:default",
    "os:default",
    "log:default",
    "shell:allow-open",
    "clipboard-manager:default",
    "updater:default",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "window-state:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.example.com/**" }]
    }
  ]
}
```

**Key points:**

- Use `:default` permission sets for safe defaults
- Add granular `allow-*` permissions for specific operations
- Scope filesystem and HTTP permissions to specific paths/URLs
- Permissions are per-window -- secondary windows need their own capability or must be listed in `windows`

---

See [data-storage.md](data-storage.md) for fs, store, sql, stronghold APIs. See [system.md](system.md) for shell, notification, clipboard, dialog APIs. See [lifecycle.md](lifecycle.md) for updater, deep-link, autostart, global-shortcut APIs.
