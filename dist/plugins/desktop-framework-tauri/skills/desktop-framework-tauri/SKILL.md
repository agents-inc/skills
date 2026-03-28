---
name: desktop-framework-tauri
description: Tauri 2.x commands, IPC bridge, permission system, plugins, window management, system tray, packaging
---

# Tauri 2.x Desktop & Mobile Apps

> **Quick Guide:** Tauri 2.x uses system webviews (not bundled Chromium) with a Rust backend. Define Rust commands with `#[tauri::command]`, invoke from frontend via `invoke()` from `@tauri-apps/api/core`. Every sensitive operation requires an explicit permission grant in a capability file. Plugins follow a dual-install pattern: Cargo crate + npm package. Tauri 2 supports desktop (Windows, macOS, Linux) and mobile (iOS, Android).
>
> **Current version:** Tauri 2.x (stable, 2024+). Tauri 1.x is legacy and uses a fundamentally different security model (allowlist vs capabilities).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the Tauri 2.x capability/permission system -- the v1 allowlist is removed)**

**(You MUST register every command in `tauri::generate_handler![]` -- unregistered commands silently fail on invoke)**

**(You MUST add plugin permissions to a capability file -- plugins with missing permissions throw runtime errors)**

**(You MUST use `#[cfg_attr(mobile, tauri::mobile_entry_point)]` on `pub fn run()` for mobile support)**

**(You MUST use `@tauri-apps/api/core` for `invoke()` -- not the removed `@tauri-apps/api/tauri` path from v1)**

</critical_requirements>

---

**Auto-detection:** Tauri, tauri.conf.json, src-tauri, tauri::command, tauri::Builder, invoke, @tauri-apps/api, tauri-plugin, capabilities, #[tauri::command], generate_handler, AppHandle, WebviewWindow, TrayIconBuilder

**When to use:**

- Building desktop apps with system webview + Rust backend
- Defining Rust commands and invoking them from frontend JavaScript/TypeScript
- Configuring the capability/permission security model
- Using official Tauri plugins (fs, dialog, http, notification, store, shell, etc.)
- System tray, window management, menus
- Packaging and distributing desktop or mobile apps
- Migrating from Tauri v1 to v2

**When NOT to use:**

- Frontend framework patterns (component architecture, state management, routing -- use respective framework skills)
- General Rust programming not related to Tauri APIs
- Build tool configuration (bundler, dev server -- separate tooling skill)
- If you need full Chromium features (WebRTC, Chrome DevTools Protocol, Chrome extensions -- evaluate alternatives)

**Key patterns covered:**

- Rust commands + frontend invoke bridge ([examples/core.md](examples/core.md))
- State management via `app.manage()` + `tauri::State<T>` ([examples/core.md](examples/core.md))
- Event system: emit/listen between frontend and backend ([examples/core.md](examples/core.md))
- Permission/capability system ([examples/security.md](examples/security.md))
- Official plugin installation and usage ([examples/plugins.md](examples/plugins.md))
- Window management, system tray, menus ([examples/platform.md](examples/platform.md))
- Packaging and distribution ([examples/packaging.md](examples/packaging.md))

**Detailed resources:**

- [examples/core.md](examples/core.md) - Commands, invoke, state, events, async commands, error handling
- [examples/security.md](examples/security.md) - Capabilities, permissions, scopes, CSP, custom permissions
- [examples/plugins.md](examples/plugins.md) - Official plugin registry, installation pattern, common plugins
- [examples/platform.md](examples/platform.md) - Windows, system tray, menus, multi-window, webview management
- [examples/packaging.md](examples/packaging.md) - Build config, platform targets, updater, CI/CD
- [reference.md](reference.md) - CLI commands, config reference, path variables, migration checklist

---

<philosophy>

## Philosophy

Tauri is **security-first, small, and native**. It uses the OS system webview instead of bundling Chromium, producing binaries 10-100x smaller than alternatives. The Rust backend provides memory safety and native performance. The permission system enforces least-privilege access -- nothing is allowed unless explicitly granted.

**Tauri vs alternatives -- when Tauri is the right choice:**

- You want small binary sizes (5-15 MB vs 150+ MB)
- You want native OS integration without bundling a browser engine
- You need a strong security model with granular permissions
- You are comfortable with Rust for backend logic
- You need mobile support (iOS/Android) from the same codebase

**When Tauri may NOT be the right choice:**

- You need guaranteed identical rendering across platforms (Tauri uses the OS webview, which varies)
- You need Chrome-specific APIs (WebRTC, Chrome extensions, Pepper plugins)
- Your team has no Rust experience and cannot invest in learning it
- You need WebView2 features not available in older Windows WebView2 versions

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Rust Commands + Frontend Invoke

Define commands in Rust with `#[tauri::command]`, register them with `generate_handler![]`, invoke from frontend. Commands support arguments, return values, async, and error handling.

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// Register in main.rs or lib.rs
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![greet])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

```typescript
import { invoke } from "@tauri-apps/api/core";
const greeting = await invoke<string>("greet", { name: "World" });
```

**Key point:** Arguments are passed as a single object. The Rust parameter names must match the object keys. Forgetting to register a command in `generate_handler![]` causes silent failure. See [examples/core.md](examples/core.md) for async commands, error handling, and state access.

---

### Pattern 2: Permission / Capability System

Every Tauri 2 app needs at least one capability file granting permissions. Without permissions, plugin and core API calls fail at runtime.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "dialog:default",
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/*" }]
    }
  ]
}
```

**Key point:** Permissions are scoped to specific windows. Use path variables (`$APPDATA`, `$HOME`, etc.) to restrict filesystem access. The v1 allowlist is completely removed. See [examples/security.md](examples/security.md) for the full permission model.

---

### Pattern 3: State Management

Share state between commands using `app.manage()` and `tauri::State<T>`. For mutable state, wrap in `Mutex` or `RwLock`.

```rust
use std::sync::Mutex;

struct AppState {
    counter: Mutex<i32>,
}

#[tauri::command]
fn increment(state: tauri::State<AppState>) -> i32 {
    let mut counter = state.counter.lock().unwrap();
    *counter += 1;
    *counter
}
```

**Key point:** `tauri::State<T>` is injected automatically when declared as a command parameter. The type must implement `Send + Sync`. See [examples/core.md](examples/core.md) for full patterns.

---

### Pattern 4: Event System

Bidirectional events between frontend and backend. Frontend uses `emit()`/`listen()`, backend uses `app.emit()`/`app.listen()`.

```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<string>("download-progress", (event) => {
  console.log(`Progress: ${event.payload}`);
});
// Clean up when done
unlisten();
```

```rust
// Emit from backend to all windows
app.emit("download-progress", "50%").unwrap();
```

**Key point:** Always call the unlisten function to prevent memory leaks. Events are string-typed -- use consistent naming conventions. See [examples/core.md](examples/core.md) for targeted window events and channels.

---

### Pattern 5: Plugin Installation Pattern

All official plugins follow a dual-install pattern: Rust crate + npm package. Each plugin needs permissions in a capability file.

```sh
# 1. Add Rust crate
cargo add tauri-plugin-store

# 2. Add JS bindings
npm add @tauri-apps/plugin-store

# 3. Register plugin in Rust
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())

# 4. Add permission to capability file
# "store:allow-get", "store:allow-set"
```

**Key point:** Missing any of the four steps (crate, npm, registration, permission) causes runtime errors, not compile errors. See [examples/plugins.md](examples/plugins.md) for the full plugin list.

---

### Pattern 6: System Tray

Build system tray icons with menus and event handlers.

```rust
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

tauri::Builder::default()
    .setup(|app| {
        let toggle = MenuItemBuilder::with_id("toggle", "Toggle").build(app)?;
        let menu = MenuBuilder::new(app).items(&[&toggle]).build()?;
        TrayIconBuilder::new()
            .menu(&menu)
            .on_menu_event(move |_app, event| match event.id().as_ref() {
                "toggle" => println!("toggle clicked"),
                _ => (),
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up, ..
                } = event {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            })
            .build(app)?;
        Ok(())
    })
```

**Key point:** In Tauri 2, `SystemTray` is replaced by `TrayIconBuilder`. Menu events and tray icon events are handled separately. See [examples/platform.md](examples/platform.md) for full tray patterns.

</patterns>

---

<decision_framework>

## Decision Framework

### Tauri 2 App Architecture

```
Where does this logic belong?
|-- Pure UI rendering, user interaction?
|   +-- Frontend (JavaScript/TypeScript in webview)
|-- File system, network, OS integration, heavy computation?
|   +-- Rust backend (Tauri commands)
|-- Sensitive operation (file write, shell exec, HTTP)?
|   +-- Rust command + explicit permission in capability file
+-- Shared state between commands?
    +-- app.manage() with Mutex/RwLock wrapper
```

### Command Design

```
How to structure the command?
|-- Returns data synchronously?
|   +-- Regular #[tauri::command] fn
|-- Needs I/O, network, or long computation?
|   +-- async #[tauri::command] with Result<T, E>
|-- Needs to access managed state?
|   +-- Add tauri::State<T> parameter
|-- Needs app handle (emit events, manage windows)?
|   +-- Add app: tauri::AppHandle parameter
+-- Needs to stream data to frontend?
    +-- Use tauri::ipc::Channel<T> parameter
```

### Plugin Selection

```
Need OS integration?
|-- File system access?
|   +-- tauri-plugin-fs
|-- File/folder picker dialog?
|   +-- tauri-plugin-dialog
|-- HTTP requests from backend?
|   +-- tauri-plugin-http
|-- Persistent key-value storage?
|   +-- tauri-plugin-store
|-- System notifications?
|   +-- tauri-plugin-notification
|-- Run external processes?
|   +-- tauri-plugin-shell
|-- Auto-update?
|   +-- tauri-plugin-updater
|-- Clipboard?
|   +-- tauri-plugin-clipboard-manager
|-- Deep links (custom URL scheme)?
|   +-- tauri-plugin-deep-link
+-- Launch on system startup?
    +-- tauri-plugin-autostart
```

See [reference.md](reference.md) for CLI commands and config reference.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `@tauri-apps/api/tauri` import path (removed in v2 -- use `@tauri-apps/api/core`)
- Using the v1 `allowlist` in `tauri.conf.json` (replaced by capability files in v2)
- Forgetting to register commands in `generate_handler![]` (silent failure, no compile error)
- Missing plugin permissions in capability file (runtime error, not compile error)
- Using `SystemTray` API (removed in v2 -- use `TrayIconBuilder` from `tauri::tray`)
- Using `tauri::api::*` (removed in v2 -- functionality moved to plugins)
- Calling `invoke()` without awaiting (returns a Promise, not the value)
- Missing `#[cfg_attr(mobile, tauri::mobile_entry_point)]` on `run()` (breaks mobile builds)

**Medium Priority Issues:**

- Not cleaning up event listeners (memory leaks from `listen()` without calling unlisten)
- Using `unwrap()` in commands instead of returning `Result` (crashes the command, no error to frontend)
- Granting overly broad permissions (`fs:allow-read-file` without path scope)
- Hardcoding paths instead of using Tauri path variables (`$APPDATA`, `$HOME`, `$RESOURCE`)
- Not using `Mutex`/`RwLock` for mutable managed state (data races)

**Common Mistakes:**

- Command argument name mismatch between Rust parameter and JS invoke object key
- Forgetting the npm package when installing a plugin (only adding the Cargo crate)
- Using `window.__TAURI__` without setting `app.withGlobalTauri: true` in config
- Expecting identical webview rendering across platforms (Windows WebView2 vs macOS WebKit vs Linux WebKitGTK)
- Not handling the `Result` error variant in async commands (unhandled promise rejection in frontend)

**Gotchas & Edge Cases:**

- **Capability scoping**: permissions are per-window -- a secondary window needs its own capability or must be listed in `windows`
- **Path variables**: `$APPDATA`, `$RESOURCE`, `$HOME` etc. are Tauri-specific, not environment variables
- **Mobile differences**: some plugins are desktop-only (shell, autostart, global-shortcut), check plugin docs
- **WebView2 on Windows**: requires WebView2 runtime (bundled by default in installer, but not guaranteed on older Windows 10)
- **Serialization**: command arguments and return values must be `serde::Serialize`/`Deserialize` -- complex types need derive macros
- **Dev server**: `tauri dev` proxies your frontend dev server -- configure `devUrl` in `tauri.conf.json`, not in the frontend build tool
- **Build size**: Tauri binaries are 5-15 MB, but Rust compilation is slow -- expect 2-5 min clean builds

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the Tauri 2.x capability/permission system -- the v1 allowlist is removed)**

**(You MUST register every command in `tauri::generate_handler![]` -- unregistered commands silently fail on invoke)**

**(You MUST add plugin permissions to a capability file -- plugins with missing permissions throw runtime errors)**

**(You MUST use `#[cfg_attr(mobile, tauri::mobile_entry_point)]` on `pub fn run()` for mobile support)**

**(You MUST use `@tauri-apps/api/core` for `invoke()` -- not the removed `@tauri-apps/api/tauri` path from v1)**

**Failure to follow these rules will cause silent command failures, runtime permission errors, or broken mobile builds.**

</critical_reminders>
