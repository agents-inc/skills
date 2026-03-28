# Tauri - Core Examples

> Rust commands, invoke bridge, state management, events, async commands, error handling. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [security.md](security.md) for the permission system.

---

## Basic Command + Invoke

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Tauri.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
// Frontend (any framework)
import { invoke } from "@tauri-apps/api/core";

const greeting = await invoke<string>("greet", { name: "World" });
```

**Why this pattern:** `#[tauri::command]` auto-generates the IPC glue. Arguments are passed as a single JSON object where keys must match Rust parameter names exactly. Return values are serialized via serde.

**Common mistake:** Forgetting to add the command to `generate_handler![]` compiles fine but `invoke()` silently returns an error at runtime.

---

## Async Commands with Error Handling

```rust
use serde::Serialize;

#[derive(Debug, Serialize)]
enum AppError {
    NotFound(String),
    IoError(String),
}

// Display impl required for Tauri error serialization
impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::NotFound(msg) => write!(f, "Not found: {msg}"),
            AppError::IoError(msg) => write!(f, "IO error: {msg}"),
        }
    }
}

#[tauri::command]
async fn read_data(path: String) -> Result<String, AppError> {
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| AppError::IoError(e.to_string()))?;

    if content.is_empty() {
        return Err(AppError::NotFound(format!("Empty file: {path}")));
    }

    Ok(content)
}
```

```typescript
import { invoke } from "@tauri-apps/api/core";

try {
  const data = await invoke<string>("read_data", { path: "/some/file.txt" });
} catch (error) {
  // error is the serialized AppError
  console.error("Command failed:", error);
}
```

**Why this pattern:** Async commands run on Tokio's thread pool, preventing UI freezes. Returning `Result<T, E>` maps to a resolved/rejected Promise on the frontend. The error type must implement both `Serialize` and `Display`.

**Common mistake:** Using `unwrap()` in commands instead of `Result` crashes the command handler silently -- the frontend gets a generic error with no details.

---

## State Management

```rust
use std::sync::Mutex;
use serde::Serialize;

#[derive(Default, Serialize)]
struct AppState {
    items: Mutex<Vec<String>>,
    count: Mutex<i32>,
}

#[tauri::command]
fn add_item(state: tauri::State<AppState>, item: String) -> Vec<String> {
    let mut items = state.items.lock().unwrap();
    items.push(item);
    items.clone()
}

#[tauri::command]
fn get_count(state: tauri::State<AppState>) -> i32 {
    let count = state.count.lock().unwrap();
    *count
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![add_item, get_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Why this pattern:** `app.manage(T)` registers a singleton. Any command can request it via `tauri::State<T>` parameter. Tauri injects it automatically -- you do not pass it from the frontend. Wrap mutable fields in `Mutex` because commands may run concurrently.

**Common mistake:** Registering state after `invoke_handler` still works, but forgetting `.manage()` entirely causes a panic when a command tries to access the state.

---

## Event System

### Frontend to Backend

```typescript
import { emit, listen } from "@tauri-apps/api/event";

// Listen for events from backend
const unlisten = await listen<{ progress: number }>(
  "download-progress",
  (event) => {
    console.log(`Progress: ${event.payload.progress}%`);
  },
);

// Emit to backend
await emit("user-action", { action: "save", id: 42 });

// IMPORTANT: Clean up when component unmounts
unlisten();
```

### Backend to Frontend

```rust
use tauri::Emitter;

#[tauri::command]
async fn start_download(app: tauri::AppHandle) -> Result<(), String> {
    for i in 0..=100 {
        app.emit("download-progress", serde_json::json!({ "progress": i }))
            .map_err(|e| e.to_string())?;
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    Ok(())
}
```

### Backend Listening

```rust
use tauri::Listener;

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.listen("user-action", |event| {
        println!("Received: {:?}", event.payload());
    });
    Ok(())
}
```

**Why this pattern:** Events provide fire-and-forget communication. Use for progress reporting, background notifications, and decoupled communication. Commands are request-response; events are pub-sub.

**Common mistake:** Not calling `unlisten()` causes memory leaks, especially in single-page apps where components mount/unmount frequently.

---

## Channels (Streaming Data to Frontend)

For high-throughput streaming, use `tauri::ipc::Channel` instead of events. Channels bypass the event system serialization overhead.

```rust
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
struct LogEntry {
    level: String,
    message: String,
}

#[tauri::command]
async fn stream_logs(channel: Channel<LogEntry>) -> Result<(), String> {
    for i in 0..100 {
        channel.send(LogEntry {
            level: "info".into(),
            message: format!("Log entry {i}"),
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

```typescript
import { invoke, Channel } from "@tauri-apps/api/core";

const channel = new Channel<{ level: string; message: string }>();
channel.onmessage = (entry) => {
  console.log(`[${entry.level}] ${entry.message}`);
};

await invoke("stream_logs", { channel });
```

**Why this pattern:** Channels are more efficient than events for streaming large amounts of data from a single command. The channel is tied to the command invocation lifecycle.

---

## App Handle in Commands

Access the `AppHandle` to manage windows, emit events, or access app paths from within a command.

```rust
use tauri::Manager;

#[tauri::command]
async fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    // Access app data directory
    let app_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    // Emit event to all windows
    app.emit("settings-opened", ()).map_err(|e| e.to_string())?;

    // Get a specific window
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

**Why this pattern:** `AppHandle` is the central access point for Tauri's runtime features inside commands. Declare it as a parameter and Tauri injects it automatically (same as `State<T>`).

---

## Multiple Commands in Modules

```rust
// src-tauri/src/commands/files.rs
use tauri::State;
use crate::AppState;

#[tauri::command]
pub async fn save_file(state: State<'_, AppState>, content: String) -> Result<(), String> {
    // ...
    Ok(())
}

#[tauri::command]
pub async fn load_file(state: State<'_, AppState>, path: String) -> Result<String, String> {
    // ...
    Ok(String::new())
}
```

```rust
// src-tauri/src/lib.rs
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::files::save_file,
            commands::files::load_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Why this pattern:** Organize commands by domain in separate modules. Reference them with full path in `generate_handler![]`. Each command must be `pub` and use the full module path.

---

See [security.md](security.md) for the permission system and [plugins.md](plugins.md) for official plugin usage.
