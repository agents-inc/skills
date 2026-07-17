---
name: desktop-backend-tauri
description: Tauri 2.x Rust command patterns, state management, error handling, events, channels, testing
---

# Tauri Rust Backend Patterns

> **Quick Guide:** Define commands with `#[tauri::command]`, register in `generate_handler![]`. Use `State<T>` for shared state (wrap mutable fields in `Mutex`). Error types must implement both `serde::Serialize` and `Display` -- use `thiserror` for ergonomic error enums. Async commands run on Tokio -- borrowed args (`&str`, `State<'_, T>`) require `Result<T, E>` return type. Stream data to frontend via `Channel<T>` (not events) for high throughput. Emit events with `app.emit()` for fire-and-forget notifications.
>
> **Current version:** Tauri 2.x (stable). Async runtime is Tokio.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST register every command in `tauri::generate_handler![]` -- unregistered commands compile fine but silently fail at runtime)**

**(You MUST implement `serde::Serialize` on all error types returned from commands -- Tauri serializes errors across the IPC boundary)**

**(You MUST wrap mutable managed state in `Mutex` or `RwLock` -- commands run concurrently and `State<T>` requires `Send + Sync`)**

**(You MUST return `Result<T, E>` from async commands that use borrowed args (`&str`, `State<'_, T>`) -- Rust lifetime rules require it)**

**(You MUST use `Channel<T>` for streaming data to frontend -- events are designed for small payloads, not high-throughput streaming)**

</critical_requirements>

---

**Auto-detection:** #[tauri::command], tauri::command, tauri::State, AppHandle, app.manage, generate_handler, tauri::ipc::Channel, Emitter, Listener, thiserror, tauri::test, mock_builder, async tauri command, tauri error handling, tauri state management

**When to use:**

- Defining Rust command handlers (sync and async) for frontend invocation
- Managing application state across commands with `app.manage()` and `State<T>`
- Implementing error types that serialize across the IPC boundary
- Emitting events from Rust to frontend (progress, notifications, background updates)
- Streaming data from Rust to frontend via channels
- Testing Rust commands with Tauri's mock runtime
- Organizing commands into modules as the backend grows

**When NOT to use:**

- Frontend invoke patterns and TypeScript types (see the framework-level Tauri skill)
- Permission/capability configuration (see the framework-level Tauri skill)
- Plugin installation and configuration (see the framework-level Tauri skill)
- Window management, system tray, menus (see the framework-level Tauri skill)
- Packaging and distribution (see the framework-level Tauri skill)
- General Rust programming not specific to Tauri APIs

**Key patterns covered:**

- Sync and async commands with `#[tauri::command]` ([examples/core.md](examples/core.md))
- Error handling with `thiserror` + manual `Serialize` impl ([examples/core.md](examples/core.md))
- Managed state with `Mutex`/`RwLock` and `State<T>` injection ([examples/core.md](examples/core.md))
- `AppHandle` for accessing app resources from commands ([examples/core.md](examples/core.md))
- Channels for streaming data to frontend ([examples/core.md](examples/core.md))
- Emitting events from Rust ([examples/events.md](examples/events.md))
- Listening for frontend events in Rust ([examples/events.md](examples/events.md))
- Testing commands with mock runtime ([examples/testing.md](examples/testing.md))
- Command organization in modules ([examples/core.md](examples/core.md))

**Detailed resources:**

- [examples/core.md](examples/core.md) - Commands, error handling, state, AppHandle, channels, modules
- [examples/events.md](examples/events.md) - Emitting and listening for events from Rust
- [examples/testing.md](examples/testing.md) - Mock runtime, testing commands with state
- [reference.md](reference.md) - Decision frameworks, quick-lookup tables, lifetime rules

---

<philosophy>

## Philosophy

The Tauri Rust backend is the **trust boundary** between the untrusted webview frontend and the operating system. Every sensitive operation -- file I/O, network requests, shell commands, state mutations -- flows through Rust commands. The backend is responsible for validation, authorization, and safe execution.

**Design principles:**

- **Commands are the API surface.** Each command is a well-defined endpoint with typed arguments, typed return values, and explicit error handling. Treat them like HTTP handlers.
- **State is managed, not global.** Use `app.manage(T)` to register singletons. Commands request state via `State<T>` injection -- no global statics, no lazy_static.
- **Errors are data, not panics.** Never `unwrap()` in commands. Return `Result<T, E>` where `E` implements `Serialize`. The frontend receives structured error information.
- **Async by default for I/O.** Sync commands block the main thread. Use async for anything involving files, network, or long computation. Tokio is the runtime.
- **Channels for streaming, events for notifications.** `Channel<T>` is optimized for ordered, high-throughput data delivery. Events are pub-sub fire-and-forget for small payloads.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Sync and Async Commands

Sync commands execute on the main thread. Async commands run on Tokio's thread pool.

```rust
// Sync -- blocks main thread, use only for fast operations
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// Async -- runs on Tokio, use for I/O and long operations
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())
}
```

**Key rule:** Async commands cannot use `&str` arguments unless the return type is `Result<T, E>`. Use `String` for owned args, or wrap in `Result` to satisfy Rust's async lifetime constraints.

See [examples/core.md](examples/core.md) for command registration and argument conventions.

---

### Pattern 2: Error Handling with thiserror

Command error types must implement both `Serialize` (for IPC) and `Display` (for Tauri's error serialization). The `thiserror` crate provides `Display` via `#[error()]` macros; implement `Serialize` manually to serialize as a string.

```rust
use thiserror::Error;

#[derive(Debug, Error)]
enum AppError {
    #[error("File not found: {0}")]
    NotFound(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("Validation failed: {0}")]
    Validation(String),
}

// Manual Serialize -- converts error to its Display string
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

**Why manual `Serialize`:** `#[derive(Serialize)]` on error enums serializes the enum variant structure (e.g., `{"Io": {...}}`), which is rarely useful for frontend error display. Serializing as a string gives the frontend a human-readable message.

See [examples/core.md](examples/core.md) for the full error pattern with `#[from]` conversions.

---

### Pattern 3: Managed State with Mutex

Register state with `app.manage()`. Commands access it via `State<T>` injection. Mutable fields require `Mutex` or `RwLock`.

```rust
use std::sync::Mutex;

#[derive(Default)]
struct AppState {
    counter: Mutex<u32>,
    config: Mutex<AppConfig>,
}

#[tauri::command]
fn increment(state: tauri::State<AppState>) -> u32 {
    let mut counter = state.counter.lock().unwrap();
    *counter += 1;
    *counter
}
```

**Key rule:** `State<T>` requires `T: Send + Sync`. `Mutex<T>` and `RwLock<T>` provide this for mutable data. Tauri injects state automatically -- it is not passed from the frontend. Missing `.manage()` registration causes a runtime panic.

See [examples/core.md](examples/core.md) for async state access, type alias patterns, and `RwLock` usage.

---

### Pattern 4: AppHandle for App Resources

`AppHandle` gives commands access to the app's runtime: paths, windows, event emission, and plugin APIs.

```rust
use tauri::Manager;

#[tauri::command]
async fn get_app_data_path(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}
```

**Key rule:** `AppHandle` is injected automatically like `State<T>`. Import `tauri::Manager` to access `.path()`, `.get_webview_window()`, and other runtime methods.

See [examples/core.md](examples/core.md) for window access and combined state + AppHandle patterns.

---

### Pattern 5: Channels for Streaming

`Channel<T>` streams ordered data from a command to the frontend. More efficient than events for high-throughput scenarios (file reads, download progress, log streaming).

```rust
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
enum DownloadEvent {
    #[serde(rename_all = "camelCase")]
    Progress { percent: u32, bytes_received: u64 },
    Finished,
}

#[tauri::command]
async fn download(url: String, on_event: Channel<DownloadEvent>) -> Result<(), String> {
    // ... download logic ...
    on_event.send(DownloadEvent::Progress { percent: 50, bytes_received: 1024 })
        .map_err(|e| e.to_string())?;
    on_event.send(DownloadEvent::Finished)
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**Key rule:** Channel payload types must implement `Serialize + Clone`. The channel is tied to the command invocation lifecycle. Use events (not channels) when you need to broadcast to all listeners from outside a command.

See [examples/core.md](examples/core.md) for the frontend Channel setup.

---

### Pattern 6: Emitting Events from Rust

Events provide fire-and-forget pub-sub communication from backend to frontend. Use for progress notifications, background updates, and decoupled messaging.

```rust
use tauri::Emitter;

#[tauri::command]
async fn start_sync(app: tauri::AppHandle) -> Result<(), String> {
    app.emit("sync-started", ()).map_err(|e| e.to_string())?;
    // ... sync work ...
    app.emit("sync-complete", serde_json::json!({ "count": 42 }))
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**Key rule:** Import `tauri::Emitter` to use `.emit()`, `.emit_to()`, and `.emit_filter()`. Event payloads must implement `Serialize + Clone`. Events are not typed -- use consistent naming conventions.

See [examples/events.md](examples/events.md) for targeted window events, filtered emission, and listening from Rust.

</patterns>

---

<decision_framework>

## Decision Framework

### Command Design

```
How should this command be structured?
|-- Fast, CPU-only, no I/O?
|   +-- Sync command: #[tauri::command] fn
|-- Involves file, network, or long computation?
|   +-- Async command: #[tauri::command] async fn -> Result<T, E>
|-- Needs shared app state?
|   +-- Add State<T> parameter, register with .manage()
|-- Needs app paths, windows, or event emission?
|   +-- Add AppHandle parameter, import Manager trait
|-- Needs to stream data back to frontend?
|   +-- Add Channel<T> parameter
+-- Needs raw request headers or binary body?
    +-- Add tauri::ipc::Request parameter
```

### Communication Method

```
How should Rust communicate with the frontend?
|-- Request/response (frontend asks, Rust answers)?
|   +-- Command (invoke from frontend, return value)
|-- Ordered stream from a specific operation?
|   +-- Channel<T> parameter in a command
|-- Fire-and-forget notification (broadcast)?
|   +-- Event: app.emit() or app.emit_to()
+-- Need to run JS in the webview?
    +-- webview.eval() (escape hatch, avoid if possible)
```

### Error Strategy

```
How should this command handle errors?
|-- Quick prototype or simple command?
|   +-- Result<T, String> with .map_err(|e| e.to_string())
|-- Production command with multiple error sources?
|   +-- Custom error enum with thiserror + manual Serialize impl
|-- Truly unrecoverable (corrupt state, invariant violation)?
|   +-- panic! (but never unwrap() on expected errors)
```

### State Mutability

```
How should state be wrapped?
|-- Read-only config set once at startup?
|   +-- No wrapper needed: app.manage(Config { ... })
|-- Read-heavy, infrequent writes?
|   +-- RwLock<T>: multiple concurrent readers, exclusive writer
|-- Frequent reads and writes, simple fields?
|   +-- Mutex<T>: exclusive access for both reads and writes
+-- Need to hold lock across .await points?
    +-- tokio::sync::Mutex (not std::sync::Mutex)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `unwrap()` in commands instead of returning `Result` -- panics crash the command handler, frontend gets a generic error with no details
- Forgetting to register commands in `generate_handler![]` -- compiles fine, silently fails at runtime
- Missing `serde::Serialize` on error types -- compilation error, but the fix is non-obvious (manual impl, not derive)
- Using `std::sync::Mutex` and holding the lock across `.await` -- blocks the Tokio runtime, causes deadlocks. Use `tokio::sync::Mutex` when you need to hold across await points
- Forgetting `.manage(T)` registration -- runtime panic when a command tries to access `State<T>`
- Deriving `Serialize` on error enums -- produces variant-structure JSON (`{"Io": {...}}`) instead of a readable string

**Medium Priority Issues:**

- Using events for high-throughput streaming (download progress, log tailing) -- events are JSON-serialized pub-sub, not optimized for throughput. Use `Channel<T>`
- Using sync commands for I/O operations -- blocks the main thread, freezes the webview
- Not importing `tauri::Emitter` when calling `.emit()` -- compilation error with confusing message about missing method
- Returning `Option<()>` from commands -- serializes as `null` which the frontend may not expect (serde serialization/deserialization asymmetry)

**Gotchas & Edge Cases:**

- **Async + borrowed args:** `async fn cmd(name: &str)` without `Result` return type fails to compile. Either use `String` or return `Result<T, E>`
- **Argument naming:** Frontend passes camelCase (`invokeMessage`), Rust receives snake_case (`invoke_message`) by default. Use `#[tauri::command(rename_all = "snake_case")]` to change this
- **State injection order:** `State<T>` parameters are not passed from frontend -- they are injected by Tauri. Mixing up "frontend args" and "injected params" in the function signature is confusing but works (Tauri filters them)
- **Mutex poisoning:** `lock().unwrap()` panics if a previous holder panicked. In production, handle `PoisonError` or use `lock().expect("state lock poisoned")`
- **Multiple state types:** Each `.manage(T)` call registers a separate type. `State<Mutex<AppState>>` and `State<AppState>` are different registrations
- **Channel lifetime:** `Channel<T>` is tied to the command invocation. It cannot be stored for later use outside the command
- **Event payload types:** Event payloads must be `Serialize + Clone`. `serde_json::Value` works as a catch-all but loses type safety
- **`emit_to` target:** Target is a webview label string. If the webview does not exist, the event is silently dropped

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST register every command in `tauri::generate_handler![]` -- unregistered commands compile fine but silently fail at runtime)**

**(You MUST implement `serde::Serialize` on all error types returned from commands -- Tauri serializes errors across the IPC boundary)**

**(You MUST wrap mutable managed state in `Mutex` or `RwLock` -- commands run concurrently and `State<T>` requires `Send + Sync`)**

**(You MUST return `Result<T, E>` from async commands that use borrowed args (`&str`, `State<'_, T>`) -- Rust lifetime rules require it)**

**(You MUST use `Channel<T>` for streaming data to frontend -- events are designed for small payloads, not high-throughput streaming)**

**Failure to follow these rules will cause silent command failures, runtime panics, deadlocked async runtimes, or unserializable error types.**

</critical_reminders>
