# Tauri Rust Backend - Testing Patterns

> Testing commands with Tauri's mock runtime, testing state access, testing async commands. See [SKILL.md](../SKILL.md) for red flags. See [core.md](core.md) for command patterns.

---

## Setup: Enable Test Feature

Add the `test` feature to your Tauri dependency:

```toml
# src-tauri/Cargo.toml
[dev-dependencies]
tauri = { version = "2", features = ["test"] }
tokio = { version = "1", features = ["macros", "rt"] }
serde_json = "1"
```

---

## Testing Commands Directly (Unit Test)

The simplest approach: call the command function directly, bypassing the IPC layer. Works for commands that do not use injected parameters (`State<T>`, `AppHandle`).

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greet_returns_formatted_string() {
        let result = greet("World");
        assert_eq!(result, "Hello, World!");
    }

    #[tokio::test]
    async fn read_file_returns_error_for_missing_path() {
        let result = read_file("/nonexistent/path.txt".into()).await;
        assert!(result.is_err());
    }
}
```

**When to use:** Commands with no injected parameters. Fast, no Tauri runtime overhead.

---

## Testing with Mock Runtime

For commands that use `State<T>`, `AppHandle`, or `WebviewWindow`, use Tauri's mock builder:

```rust
#[cfg(test)]
mod tests {
    use std::sync::Mutex;
    use tauri::test::{mock_builder, mock_context, noop_assets};

    use super::*;
    use crate::state::AppState;

    fn create_test_app() -> tauri::App<tauri::test::MockRuntime> {
        mock_builder()
            .manage(Mutex::new(AppState::default()))
            .invoke_handler(tauri::generate_handler![add_item, get_items])
            .build(mock_context(noop_assets()))
            .expect("failed to build test app")
    }

    #[test]
    fn add_item_updates_state() {
        let app = create_test_app();
        let state = app.state::<Mutex<AppState>>();

        // Call the command directly with injected state
        let result = add_item(
            tauri::State::from(&state),
            "test item".into(),
        );

        assert_eq!(result, vec!["test item"]);
    }

    #[test]
    fn get_items_returns_current_state() {
        let app = create_test_app();
        let state = app.state::<Mutex<AppState>>();

        // Pre-populate state
        {
            let mut inner = state.lock().unwrap();
            inner.items.push("existing".into());
        }

        let items = get_items(tauri::State::from(&state));
        assert_eq!(items, vec!["existing"]);
    }
}
```

**Key points:**

- `mock_builder()` creates a `Builder` with `MockRuntime` (no actual webview)
- `mock_context(noop_assets())` provides a minimal app context
- Access managed state via `app.state::<T>()` and wrap in `tauri::State::from()`
- The `MockRuntime` does not execute any native webview code

---

## Testing Async Commands with State

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn save_and_notify_adds_to_state() {
        let app = create_test_app();
        let state = app.state::<Mutex<AppState>>();
        let handle = app.handle().clone();

        let result = save_and_notify(
            handle,
            tauri::State::from(&state),
            "new data".into(),
        )
        .await;

        assert!(result.is_ok());

        let inner = state.lock().unwrap();
        assert!(inner.items.contains(&"new data".to_string()));
    }
}
```

**Key point:** For commands that take `AppHandle`, pass `app.handle().clone()`. The mock runtime provides a functional `AppHandle` that supports state access and event emission (but not actual window operations).

---

## Testing Error Handling

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AppError;

    #[tokio::test]
    async fn load_config_returns_not_found_for_missing_file() {
        let result = load_config("/nonexistent/config.json".into()).await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        // Verify the error serializes correctly (frontend receives this string)
        let serialized = serde_json::to_string(&err).unwrap();
        assert!(serialized.contains("No such file"));
    }

    #[test]
    fn app_error_serializes_as_string() {
        let error = AppError::NotFound("test.txt".into());
        let json = serde_json::to_value(&error).unwrap();
        // Manual Serialize impl produces a string, not a variant object
        assert_eq!(json, serde_json::json!("File not found: test.txt"));
    }
}
```

**Why test serialization:** The frontend receives the serialized error. Verify that your manual `Serialize` impl produces the expected string format.

---

## Testing Pure Logic Separately

Extract business logic out of command handlers into pure functions. Test those directly without any Tauri infrastructure:

```rust
// src-tauri/src/logic/validation.rs
pub fn validate_username(name: &str) -> Result<(), String> {
    if name.len() < 3 {
        return Err("Username must be at least 3 characters".into());
    }
    if !name.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Username can only contain letters, numbers, and underscores".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_short_username() {
        assert!(validate_username("ab").is_err());
    }

    #[test]
    fn rejects_special_characters() {
        assert!(validate_username("user@name").is_err());
    }

    #[test]
    fn accepts_valid_username() {
        assert!(validate_username("valid_user_123").is_ok());
    }
}
```

```rust
// Command is a thin wrapper around pure logic
#[tauri::command]
pub fn create_user(name: String) -> Result<String, String> {
    validate_username(&name)?;
    Ok(format!("User {} created", name))
}
```

**Best practice:** Keep command handlers thin. Extract validation, transformation, and business logic into pure functions. Test the pure functions directly (fast, no mocking). Use mock runtime tests only for integration points (state access, event emission, AppHandle usage).

---

See [core.md](core.md) for command patterns and [events.md](events.md) for event emission.
