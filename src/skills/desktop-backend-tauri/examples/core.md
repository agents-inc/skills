# Tauri Rust Backend - Core Examples

> Commands, error handling, state management, AppHandle, channels, command organization. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [events.md](events.md) for event emission patterns. See [testing.md](testing.md) for mock runtime testing.

---

## Sync Command with Arguments

```rust
// src-tauri/src/commands/greet.rs

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

```typescript
// Frontend invocation
import { invoke } from "@tauri-apps/api/core";

const greeting = await invoke<string>("greet", { name: "World" });
```

**Key points:**

- Arguments arrive as a JSON object -- keys must match Rust parameter names
- By default, frontend sends camelCase (`invokeMessage`), Rust receives snake_case (`invoke_message`)
- Use `#[tauri::command(rename_all = "snake_case")]` to require snake_case from frontend instead

---

## Async Command with Result

```rust
// src-tauri/src/commands/files.rs

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())
}
```

**Why `String` not `&str` for `path`:** Async commands cannot use borrowed args (`&str`) unless the return type is `Result<T, E>`. Using owned `String` avoids the lifetime constraint entirely.

**Alternative with borrowed args:**

```rust
// This works because of the Result return type
#[tauri::command]
pub async fn search(query: &str, state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    // &str and State<'_, T> both work when return type is Result
    let items = state.items.lock().unwrap();
    Ok(items.iter().filter(|i| i.contains(query)).cloned().collect())
}
```

---

## Error Handling with thiserror

The production pattern for error handling: `thiserror` for `Display` and `From` impls, manual `Serialize` for IPC.

```rust
// src-tauri/src/error.rs
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("File not found: {0}")]
    NotFound(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    SerdeJson(#[from] serde_json::Error),

    #[error("Validation failed: {0}")]
    Validation(String),

    #[error("Database error: {0}")]
    Database(String),
}

// Manual Serialize: always serialize as the Display string
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

```rust
// src-tauri/src/commands/data.rs
use crate::error::AppError;

#[tauri::command]
pub async fn load_config(path: String) -> Result<serde_json::Value, AppError> {
    let content = tokio::fs::read_to_string(&path).await?; // #[from] converts io::Error
    let config: serde_json::Value = serde_json::from_str(&content)?; // #[from] converts serde error
    Ok(config)
}
```

**Why manual `Serialize` instead of `#[derive(Serialize)]`:**

```rust
// BAD: derive(Serialize) produces variant-structure JSON
#[derive(Debug, Error, serde::Serialize)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
}
// Frontend receives: {"NotFound": "file.txt"} -- awkward to handle

// GOOD: manual impl produces a readable string
// Frontend receives: "Not found: file.txt" -- easy to display
```

---

## Managed State with Mutex

```rust
// src-tauri/src/state.rs
use std::sync::Mutex;

#[derive(Default)]
pub struct AppStateInner {
    pub items: Vec<String>,
    pub count: u32,
}

// Type alias avoids repeating Mutex<...> everywhere
pub type AppState = Mutex<AppStateInner>;
```

```rust
// src-tauri/src/lib.rs
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::items::add_item,
            commands::items::get_items,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```rust
// src-tauri/src/commands/items.rs
use crate::state::AppState;

#[tauri::command]
pub fn add_item(state: tauri::State<AppState>, item: String) -> Vec<String> {
    let mut inner = state.lock().unwrap();
    inner.items.push(item);
    inner.count += 1;
    inner.items.clone()
}

#[tauri::command]
pub fn get_items(state: tauri::State<AppState>) -> Vec<String> {
    let inner = state.lock().unwrap();
    inner.items.clone()
}
```

**Key points:**

- `State<T>` is injected automatically -- it is never passed from the frontend
- The type alias `type AppState = Mutex<AppStateInner>` keeps command signatures clean
- `lock().unwrap()` panics if a previous holder panicked (mutex poisoning). In production, handle `PoisonError`

### RwLock for Read-Heavy State

```rust
use std::sync::RwLock;

pub type AppConfig = RwLock<ConfigInner>;

#[tauri::command]
pub fn get_setting(state: tauri::State<AppConfig>, key: String) -> Option<String> {
    let config = state.read().unwrap();
    config.settings.get(&key).cloned()
}

#[tauri::command]
pub fn set_setting(state: tauri::State<AppConfig>, key: String, value: String) {
    let mut config = state.write().unwrap();
    config.settings.insert(key, value);
}
```

**When to use RwLock:** Multiple concurrent readers with infrequent writes. `read()` does not block other readers. `write()` blocks everything.

### Async State Access with tokio::sync::Mutex

```rust
use tokio::sync::Mutex;

pub type AsyncState = Mutex<ExpensiveResource>;

#[tauri::command]
pub async fn process(state: tauri::State<'_, AsyncState>) -> Result<String, String> {
    let mut resource = state.lock().await; // .await, not .unwrap()
    resource.do_async_work().await.map_err(|e| e.to_string())
}
```

**When to use tokio::sync::Mutex:** When you need to hold the lock across `.await` points. Standard `std::sync::Mutex` blocks the Tokio runtime thread if held across an await -- use it only when the critical section is synchronous.

---

## AppHandle for App Resources

```rust
use tauri::Manager;

#[tauri::command]
pub async fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    // Access app directories
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // Get or focus a window
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

### Combined State + AppHandle

```rust
use tauri::Manager;
use crate::state::AppState;

#[tauri::command]
pub async fn save_and_notify(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    data: String,
) -> Result<(), String> {
    // Access state
    {
        let mut inner = state.lock().unwrap();
        inner.items.push(data.clone());
    } // Lock released here

    // Use app handle for side effects
    use tauri::Emitter;
    app.emit("data-saved", &data).map_err(|e| e.to_string())?;
    Ok(())
}
```

**Key point:** Release the `Mutex` lock before performing async operations or emitting events. Use a block scope `{ ... }` to drop the lock guard early.

---

## Channels for Streaming Data

### Rust Command with Channel

```rust
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum ProgressEvent {
    #[serde(rename_all = "camelCase")]
    Progress { percent: u32, bytes_received: u64 },
    Finished { total_bytes: u64 },
    Error { message: String },
}

const CHUNK_SIZE: usize = 4096;

#[tauri::command]
pub async fn download_file(
    url: String,
    on_progress: Channel<ProgressEvent>,
) -> Result<(), String> {
    // Simulated download loop
    let total: u64 = 10240;
    let mut received: u64 = 0;

    while received < total {
        // ... perform download chunk ...
        received += CHUNK_SIZE as u64;
        let percent = ((received as f64 / total as f64) * 100.0) as u32;

        on_progress
            .send(ProgressEvent::Progress {
                percent,
                bytes_received: received,
            })
            .map_err(|e| e.to_string())?;
    }

    on_progress
        .send(ProgressEvent::Finished { total_bytes: total })
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

### Frontend Channel Setup

```typescript
import { invoke, Channel } from "@tauri-apps/api/core";

type ProgressEvent =
  | { type: "progress"; percent: number; bytesReceived: number }
  | { type: "finished"; totalBytes: number }
  | { type: "error"; message: string };

const channel = new Channel<ProgressEvent>();
channel.onmessage = (event) => {
  switch (event.type) {
    case "progress":
      console.log(`${event.percent}% (${event.bytesReceived} bytes)`);
      break;
    case "finished":
      console.log(`Done: ${event.totalBytes} bytes`);
      break;
    case "error":
      console.error(event.message);
      break;
  }
};

await invoke("download_file", {
  url: "https://example.com/file",
  onProgress: channel,
});
```

**Key points:**

- `Channel<T>` payload must implement `Serialize + Clone`
- Channel is tied to the command invocation -- it cannot be stored or reused outside the command
- Use `#[serde(tag = "type")]` for tagged union serialization that maps cleanly to TypeScript discriminated unions
- Frontend receives camelCase keys (`bytesReceived`) due to `#[serde(rename_all = "camelCase")]`

---

## Raw IPC Request Access

For custom headers or binary payloads:

```rust
use tauri::ipc::Request;

#[tauri::command]
pub fn upload(request: Request) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("Expected raw binary body".into());
    };

    let auth = request
        .headers()
        .get("Authorization")
        .ok_or("Missing Authorization header")?
        .to_str()
        .map_err(|e| e.to_string())?;

    Ok(format!("Received {} bytes with auth: {}", data.len(), auth))
}
```

---

## Command Organization in Modules

As the backend grows, organize commands by domain:

```
src-tauri/src/
  lib.rs            # Builder setup, manage(), generate_handler!
  error.rs          # Shared AppError type
  state.rs          # AppState definition
  commands/
    mod.rs          # pub mod declarations
    files.rs        # File-related commands
    auth.rs         # Auth-related commands
    sync.rs         # Sync/background commands
```

```rust
// src-tauri/src/commands/mod.rs
pub mod auth;
pub mod files;
pub mod sync;
```

```rust
// src-tauri/src/lib.rs
mod commands;
mod error;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::files::read_file,
            commands::files::write_file,
            commands::auth::login,
            commands::auth::logout,
            commands::sync::start_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Key rule:** All commands must be listed in a single `generate_handler![]` macro invocation. Commands in modules must be `pub` and referenced with their full module path.

---

See [events.md](events.md) for event emission patterns and [testing.md](testing.md) for mock runtime testing.
