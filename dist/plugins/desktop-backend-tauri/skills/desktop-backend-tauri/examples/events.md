# Tauri Rust Backend - Event Patterns

> Emitting events from Rust, listening for frontend events, targeted emission, structured payloads. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for commands and channels.

---

## Emitting Global Events

Broadcast to all listeners (frontend and backend):

```rust
use tauri::Emitter;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncProgress {
    items_synced: u32,
    total_items: u32,
}

#[tauri::command]
async fn start_sync(app: tauri::AppHandle) -> Result<(), String> {
    let total: u32 = 100;

    for i in 0..=total {
        app.emit(
            "sync-progress",
            SyncProgress {
                items_synced: i,
                total_items: total,
            },
        )
        .map_err(|e| e.to_string())?;

        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    app.emit("sync-complete", ()).map_err(|e| e.to_string())?;
    Ok(())
}
```

**Key points:**

- Import `tauri::Emitter` to use `.emit()` on `AppHandle`
- Payloads must implement `Serialize + Clone`
- Use `#[serde(rename_all = "camelCase")]` so frontend receives camelCase keys
- Unit payload `()` is valid for signal-only events

---

## Emitting to Specific Windows

Target a single webview window by label:

```rust
use tauri::Emitter;

#[tauri::command]
async fn notify_window(app: tauri::AppHandle, label: String, message: String) -> Result<(), String> {
    app.emit_to(&label, "notification", &message)
        .map_err(|e| e.to_string())
}
```

**Gotcha:** If the target webview does not exist, `emit_to` silently drops the event -- no error is returned. Verify the window exists first if delivery is critical.

---

## Filtered Event Emission

Emit to a subset of webview windows based on a predicate:

```rust
use tauri::{Emitter, EventTarget};

#[tauri::command]
async fn broadcast_to_editors(app: tauri::AppHandle, content: String) -> Result<(), String> {
    app.emit_filter("content-updated", &content, |target| match target {
        EventTarget::WebviewWindow { label } => {
            label.starts_with("editor-")
        }
        _ => false,
    })
    .map_err(|e| e.to_string())
}
```

**When to use:** When you need to target multiple (but not all) windows. For a single window, use `emit_to`. For all windows, use `emit`.

---

## Listening for Frontend Events in Rust

### In App Setup

```rust
use tauri::Listener;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.listen("user-action", |event| {
                println!("Received user action: {:?}", event.payload());
            });

            // Listen with unlisten capability
            let id = app.listen("settings-changed", |event| {
                println!("Settings changed: {:?}", event.payload());
            });

            // Later, to stop listening:
            // app.unlisten(id);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### In Commands via AppHandle

```rust
use tauri::Listener;

#[tauri::command]
async fn watch_for_event(app: tauri::AppHandle) -> Result<(), String> {
    let handle = app.clone();
    app.listen("external-data", move |event| {
        let payload = event.payload();
        println!("Received: {:?}", payload);
        // Use the cloned handle for further actions
        use tauri::Emitter;
        let _ = handle.emit("data-processed", payload);
    });
    Ok(())
}
```

**Key points:**

- Import `tauri::Listener` to use `.listen()` on `AppHandle` or `App`
- `.listen()` returns an `EventId` that can be passed to `.unlisten()` to stop listening
- Event payloads arrive as `&str` (JSON string) -- parse manually if structured data is needed
- Clone `AppHandle` before moving into closure if you need to emit from inside a listener

---

## Structured Event Payloads

Use serde-tagged enums for type-safe event payloads:

```rust
use serde::Serialize;
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
enum TaskUpdate {
    #[serde(rename_all = "camelCase")]
    Running { progress_percent: u32 },
    Completed { result: String },
    Failed { error: String },
}

#[tauri::command]
async fn run_task(app: tauri::AppHandle) -> Result<(), String> {
    app.emit("task-update", TaskUpdate::Running { progress_percent: 0 })
        .map_err(|e| e.to_string())?;

    // ... task work ...

    app.emit("task-update", TaskUpdate::Completed { result: "done".into() })
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

```typescript
// Frontend receives tagged objects:
// { status: "running", progressPercent: 0 }
// { status: "completed", result: "done" }
// { status: "failed", error: "..." }
```

**Why tagged enums:** Maps cleanly to TypeScript discriminated unions. The frontend can switch on the `status` field for type-safe handling.

---

## Events from Background Threads

For long-running background work that outlives a single command:

```rust
use tauri::Emitter;

pub fn spawn_background_watcher(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            // ... check for changes ...
            let _ = app.emit("file-changed", "/path/to/file");
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    });
}
```

```rust
// Register in setup
tauri::Builder::default()
    .setup(|app| {
        spawn_background_watcher(app.handle().clone());
        Ok(())
    })
```

**Key point:** Use `tauri::async_runtime::spawn` (not `tokio::spawn` directly) to ensure the task runs on Tauri's managed runtime. Clone `AppHandle` before moving into the spawned future.

---

See [core.md](core.md) for channels (preferred for streaming) and [testing.md](testing.md) for testing event emission.
