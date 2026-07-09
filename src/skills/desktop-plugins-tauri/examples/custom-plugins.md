# Tauri Plugins - Custom Plugin Development

> Creating custom plugins with the Builder pattern, commands, configuration, lifecycle hooks, and mobile support (Swift/Kotlin). See [core.md](core.md) for official plugin patterns. See [reference.md](../reference.md) for the full plugin registry.

---

## Scaffolding a New Plugin

```sh
# Scaffold a plugin project (creates tauri-plugin-<name>/ directory)
npx @tauri-apps/cli plugin new my-feature

# With mobile support
npx @tauri-apps/cli plugin new my-feature --android --ios

# Without JS bindings (Rust-only plugin)
npx @tauri-apps/cli plugin new my-feature --no-api
```

### Generated Project Structure

```
tauri-plugin-my-feature/
  src/
    lib.rs           # Plugin entry point (init function, re-exports)
    commands.rs      # Command definitions
    desktop.rs       # Desktop-specific implementation
    mobile.rs        # Mobile-specific implementation (if --android/--ios)
    error.rs         # Error types
    models.rs        # Shared data structures
  permissions/       # Permission definitions (TOML)
  guest-js/          # TypeScript API bindings
    index.ts
  android/           # Kotlin code (if --android)
  ios/               # Swift code (if --ios)
  build.rs           # Auto-generates permission files
  Cargo.toml
  package.json
```

---

## Basic Plugin with Commands

### Plugin Entry Point (src/lib.rs)

```rust
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

mod commands;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("my-feature")
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::process_data,
        ])
        .setup(|app, _api| {
            // Initialize plugin state
            app.manage(PluginState::default());
            Ok(())
        })
        .build()
}
```

### Command Definitions (src/commands.rs)

```rust
use tauri::{command, AppHandle, Runtime, State};
use crate::PluginState;

#[command]
pub async fn get_status<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, PluginState>,
) -> Result<String, String> {
    let status = state.status.lock().unwrap();
    Ok(status.clone())
}

#[command]
pub async fn process_data<R: Runtime>(
    _app: AppHandle<R>,
    input: String,
) -> Result<String, String> {
    // Process the input
    Ok(format!("Processed: {input}"))
}
```

### JavaScript Bindings (guest-js/index.ts)

```typescript
import { invoke } from "@tauri-apps/api/core";

export async function getStatus(): Promise<string> {
  return invoke<string>("plugin:my-feature|get_status");
}

export async function processData(input: string): Promise<string> {
  return invoke<string>("plugin:my-feature|process_data", { input });
}
```

**Key points:**

- Plugin commands are invoked as `plugin:<plugin-name>|<command_name>` from JS
- The `<R: Runtime>` generic allows the plugin to work in both desktop and mobile contexts
- Export an `init()` function following the Tauri plugin convention
- The plugin name in `Builder::new("my-feature")` must match the `plugin:my-feature|` prefix in JS invocations

---

## Plugin with Configuration

### Typed Config (src/lib.rs)

```rust
use serde::Deserialize;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

const DEFAULT_TIMEOUT_MS: usize = 30_000;
const DEFAULT_MAX_RETRIES: usize = 3;

#[derive(Deserialize)]
pub struct Config {
    #[serde(default = "default_timeout")]
    timeout: usize,
    #[serde(default = "default_max_retries")]
    max_retries: usize,
}

fn default_timeout() -> usize { DEFAULT_TIMEOUT_MS }
fn default_max_retries() -> usize { DEFAULT_MAX_RETRIES }

pub fn init<R: Runtime>() -> TauriPlugin<R, Config> {
    Builder::<R, Config>::new("my-feature")
        .setup(|app, api| {
            let timeout = api.config().timeout;
            let max_retries = api.config().max_retries;
            app.manage(PluginConfig { timeout, max_retries });
            Ok(())
        })
        .build()
}
```

### Host App Configuration (tauri.conf.json)

```json
{
  "plugins": {
    "my-feature": {
      "timeout": 5000,
      "maxRetries": 5
    }
  }
}
```

**Key points:**

- Config is deserialized from the host app's `tauri.conf.json` at runtime
- Use `#[serde(default)]` for optional fields with default values
- The config key in JSON must match the plugin name

---

## Plugin Lifecycle Hooks

```rust
use tauri::plugin::Builder;
use tauri::{RunEvent, Runtime};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("my-feature")
        .setup(|app, _api| {
            // Called when plugin is initialized
            // Register state, start background tasks
            Ok(())
        })
        .on_navigation(|window, url| {
            // Called when webview navigates
            // Return false to cancel navigation
            println!("Window {} navigating to {}", window.label(), url);
            url.scheme() != "forbidden"
        })
        .on_webview_ready(|window| {
            // Called when a new webview is created
            // Execute initialization scripts
            window.listen("content-loaded", |_event| {
                println!("Webview content loaded");
            });
        })
        .on_event(|_app, event| {
            // Called on event loop events
            match event {
                RunEvent::ExitRequested { api, .. } => {
                    // Prevent exit if needed
                    api.prevent_exit();
                }
                RunEvent::Exit => {
                    // Final cleanup
                }
                _ => {}
            }
        })
        .on_drop(|_app| {
            // Called when plugin is destroyed
            // Cleanup resources
        })
        .build()
}
```

**Key points:**

- `setup`: Runs once when the plugin initializes -- register state and start background tasks here
- `on_navigation`: Runs before each webview navigation -- return `false` to block
- `on_webview_ready`: Runs when a new webview is created
- `on_event`: Receives all event loop events (exit, window events, menu events)
- `on_drop`: Runs when the plugin is destroyed -- cleanup resources

---

## Plugin Permissions

### Defining Permissions (permissions/default.toml)

```toml
[[permission]]
identifier = "allow-get-status"
description = "Allows reading the plugin status"
commands.allow = ["get_status"]

[[permission]]
identifier = "allow-process-data"
description = "Allows processing data through the plugin"
commands.allow = ["process_data"]

[[set]]
identifier = "default"
description = "Default permissions for my-feature plugin"
permissions = ["allow-get-status"]
```

### Auto-Generating Permissions (build.rs)

```rust
const COMMANDS: &[&str] = &["get_status", "process_data"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
```

This generates `allow-get-status`, `deny-get-status`, `allow-process-data`, `deny-process-data` permissions automatically.

### Using in Host App

```json
{
  "permissions": ["my-feature:default", "my-feature:allow-process-data"]
}
```

---

## Mobile Plugin Support

### Rust: Desktop vs Mobile Split

```rust
// src/desktop.rs
use tauri::{AppHandle, Runtime};

pub struct MyFeature<R: Runtime>(AppHandle<R>);

impl<R: Runtime> MyFeature<R> {
    pub fn get_battery_level(&self) -> crate::Result<f64> {
        // Desktop implementation (may use system APIs or return default)
        Ok(1.0) // Desktop always reports "full"
    }
}

// src/mobile.rs
use serde::de::DeserializeOwned;
use tauri::{plugin::PluginHandle, Runtime};

pub struct MyFeature<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> MyFeature<R> {
    pub fn get_battery_level(&self) -> crate::Result<f64> {
        // Calls native mobile code via PluginHandle
        self.0
            .run_mobile_plugin::<BatteryResponse>("getBatteryLevel", ())
            .map(|r| r.level)
            .map_err(Into::into)
    }
}
```

### Android Plugin (Kotlin)

```kotlin
package com.plugin.myfeature

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class MyFeaturePlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun getBatteryLevel(invoke: Invoke) {
        val batteryManager = activity.getSystemService(
            android.content.Context.BATTERY_SERVICE
        ) as android.os.BatteryManager

        val level = batteryManager.getIntProperty(
            android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY
        )

        val result = JSObject()
        result.put("level", level / 100.0)
        invoke.resolve(result)
    }
}
```

**Key points for Android:**

- `@TauriPlugin` annotation marks the plugin class
- `@Command` marks methods callable from Rust/JS
- Commands run on the main thread -- use coroutines for blocking I/O
- `invoke.resolve(JSObject)` sends data back to Rust
- `invoke.reject(errorMessage)` sends an error

### iOS Plugin (Swift)

```swift
import SwiftRs
import Tauri
import UIKit
import WebKit

class MyFeaturePlugin: Plugin {
    @objc public func getBatteryLevel(_ invoke: Invoke) throws {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let level = UIDevice.current.batteryLevel

        invoke.resolve(["level": Double(level)])
    }
}
```

**Key points for iOS:**

- Plugin class extends `Plugin`
- `@objc` attribute + `Invoke` parameter = callable from Rust
- `invoke.resolve([String: Any])` sends data back
- `invoke.reject(errorMessage)` sends an error

### Plugin Events from Mobile

```kotlin
// Android: emit event to frontend
trigger("battery-change", JSObject().apply {
    put("level", newLevel)
})
```

```swift
// iOS: emit event to frontend
trigger("battery-change", data: ["level": newLevel])
```

```typescript
// Frontend: listen for plugin events
import { addPluginListener } from "@tauri-apps/api/core";

const unlisten = await addPluginListener(
  "my-feature",
  "battery-change",
  (event: { level: number }) => {
    console.log(`Battery: ${event.level * 100}%`);
  },
);
```

---

## Publishing a Custom Plugin

```sh
# Build TypeScript bindings
cd guest-js && npm run build

# Publish to npm (JS bindings)
npm publish

# Publish to crates.io (Rust crate)
cargo publish
```

**Naming conventions:**

- Cargo crate: `tauri-plugin-<name>`
- NPM package: `@scope/plugin-<name>` (scope recommended) or `tauri-plugin-<name>`
- Plugin identifier (in Builder): `<name>` (without the `tauri-plugin-` prefix)

---

See [core.md](core.md) for the four-step installation pattern that consumers use. See [reference.md](../reference.md) for the full plugin registry.
