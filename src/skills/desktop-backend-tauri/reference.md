# Tauri Rust Backend Quick Reference

> Quick-lookup tables, lifetime rules, common imports. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/core.md](examples/core.md) for full code examples.

---

## Command Signature Quick Reference

| Scenario             | Signature                                                                        |
| -------------------- | -------------------------------------------------------------------------------- |
| Sync, no deps        | `fn cmd(arg: &str) -> String`                                                    |
| Async, owned args    | `async fn cmd(arg: String) -> Result<T, E>`                                      |
| Async, borrowed args | `async fn cmd(arg: &str) -> Result<T, E>`                                        |
| With state           | `fn cmd(state: State<AppState>) -> T`                                            |
| With state (async)   | `async fn cmd(state: State<'_, AppState>) -> Result<T, E>`                       |
| With AppHandle       | `async fn cmd(app: AppHandle) -> Result<T, E>`                                   |
| With Channel         | `async fn cmd(ch: Channel<Event>) -> Result<(), E>`                              |
| With raw request     | `fn cmd(req: tauri::ipc::Request) -> Result<T, E>`                               |
| Combined             | `async fn cmd(app: AppHandle, state: State<'_, T>, arg: String) -> Result<V, E>` |

---

## Common Imports

| Import                                 | When                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| `use tauri::Manager;`                  | Access `.path()`, `.get_webview_window()`, `.state()` on AppHandle |
| `use tauri::Emitter;`                  | Call `.emit()`, `.emit_to()`, `.emit_filter()`                     |
| `use tauri::Listener;`                 | Call `.listen()`, `.unlisten()`                                    |
| `use tauri::ipc::Channel;`             | Streaming data to frontend from a command                          |
| `use tauri::ipc::Request;`             | Access raw request headers and body                                |
| `use tauri::ipc::Response;`            | Return optimized binary data                                       |
| `use serde::{Serialize, Deserialize};` | Serialize/deserialize command args and returns                     |
| `use thiserror::Error;`                | Derive Display and From for error enums                            |
| `use std::sync::Mutex;`                | Wrap mutable state (sync critical sections)                        |
| `use std::sync::RwLock;`               | Wrap read-heavy mutable state                                      |
| `use tokio::sync::Mutex;`              | Wrap state accessed across .await points                           |

---

## Lifetime Rules for Async Commands

| Argument Type     | Sync Command | Async Command                                   |
| ----------------- | ------------ | ----------------------------------------------- |
| `&str`            | Works        | Requires `Result<T, E>` return                  |
| `String`          | Works        | Works                                           |
| `State<AppState>` | Works        | Requires `State<'_, T>` + `Result<T, E>` return |
| `AppHandle`       | Works        | Works                                           |
| `Channel<T>`      | Works        | Works                                           |
| `WebviewWindow`   | Works        | Works                                           |

**Rule:** If an async command uses any borrowed type (`&str`, `State<'_, T>`), the return type MUST be `Result<T, E>`. This is a Rust lifetime constraint, not a Tauri design choice.

---

## Argument Naming Convention

| Rust Parameter | Frontend Key (default) | With `rename_all = "snake_case"` |
| -------------- | ---------------------- | -------------------------------- |
| `file_path`    | `filePath`             | `file_path`                      |
| `user_name`    | `userName`             | `user_name`                      |
| `is_active`    | `isActive`             | `is_active`                      |

**Default:** Frontend sends camelCase, Rust receives snake_case. This happens automatically.

**Override:** `#[tauri::command(rename_all = "snake_case")]` requires frontend to send snake_case.

---

## State Wrapper Decision Table

| Scenario                        | Wrapper                 | Reason                             |
| ------------------------------- | ----------------------- | ---------------------------------- |
| Immutable config                | None                    | Set once at startup, never changes |
| Mutable, short critical section | `std::sync::Mutex<T>`   | Simple exclusive access            |
| Read-heavy, infrequent writes   | `std::sync::RwLock<T>`  | Multiple concurrent readers        |
| Lock held across .await         | `tokio::sync::Mutex<T>` | Does not block Tokio runtime       |
| Per-field granularity           | Wrap individual fields  | Reduces lock contention            |

---

## Error Type Checklist

For any error type returned from a `#[tauri::command]`:

- [ ] Implements `Debug` (derive)
- [ ] Implements `Display` (via `thiserror::Error` derive)
- [ ] Implements `serde::Serialize` (manual impl, serializes as string)
- [ ] Uses `#[from]` on variants for automatic `?` operator conversion
- [ ] Uses `#[error(transparent)]` for pass-through error messages

---

## Injected vs Frontend Parameters

Tauri automatically identifies and injects these parameter types -- they are NOT passed from the frontend:

| Injected Parameter    | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `State<T>`            | Managed state registered with `.manage()`       |
| `AppHandle`           | App runtime access (paths, windows, events)     |
| `WebviewWindow`       | The calling webview window                      |
| `Channel<T>`          | Streaming channel (frontend creates and passes) |
| `tauri::ipc::Request` | Raw IPC request (headers, body)                 |

All other parameters are deserialized from the frontend's `invoke()` arguments object.

---

## Communication Method Comparison

| Feature     | Commands                     | Events                  | Channels             |
| ----------- | ---------------------------- | ----------------------- | -------------------- |
| Direction   | Frontend -> Rust -> Frontend | Bidirectional           | Rust -> Frontend     |
| Pattern     | Request/response             | Pub/sub                 | Ordered stream       |
| Type safety | Full (serde)                 | Weak (JSON string)      | Full (serde)         |
| Throughput  | Per-call                     | Low (JSON overhead)     | High (optimized)     |
| Lifetime    | Single invocation            | App-wide                | Tied to command      |
| Use case    | Data queries, mutations      | Notifications, progress | File streaming, logs |

---

## See Also

- [Tauri v2 - Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/)
- [Tauri v2 - Calling Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/)
- [Tauri v2 - State Management](https://v2.tauri.app/develop/state-management/)
- [Tauri v2 - Testing](https://v2.tauri.app/develop/tests/)
- [thiserror crate](https://docs.rs/thiserror/latest/thiserror/)
