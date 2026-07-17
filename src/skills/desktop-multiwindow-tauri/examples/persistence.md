# Tauri Multi-Window & Events - Window State Persistence

> Save and restore window position, size, and visibility across app restarts using `tauri-plugin-window-state`. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for window creation and events.

---

## Plugin Setup

Install with `npm run tauri add window-state` (handles both Rust crate and JS bindings).

### Register in Rust

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(
                tauri_plugin_window_state::Builder::default().build()
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Key point:** wrap in `#[cfg(desktop)]` because window-state is desktop-only. After registration, all windows automatically save state on close and restore on next launch.

### Add Permission

```json
{
  "permissions": ["window-state:default"]
}
```

The default permission set includes `allow-filename`, `allow-restore-state`, and `allow-save-window-state`.

---

## Preventing Flash on Restore

Set `visible: false` in the window config so the plugin can restore position/size before showing the window.

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "My App",
        "width": 1024,
        "height": 768,
        "visible": false
      }
    ]
  }
}
```

**Why this matters:** without this, the window briefly appears at its default position/size before the plugin restores the saved state, causing a visible jump.

---

## Manual Save and Restore (Rust)

Override the automatic behavior when you need to save state at specific points (e.g., before a settings migration).

```rust
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

// Save all window states to disk
app.save_window_state(StateFlags::all())
    .expect("failed to save window state");
```

```rust
use tauri_plugin_window_state::{WindowExt, StateFlags};

// Restore a specific window's state
let window = app.get_webview_window("main").unwrap();
window.restore_state(StateFlags::all())
    .expect("failed to restore window state");
```

---

## Manual Save and Restore (JavaScript)

```typescript
import {
  saveWindowState,
  restoreStateCurrent,
  StateFlags,
} from "@tauri-apps/plugin-window-state";

// Save all windows
await saveWindowState(StateFlags.ALL);

// Restore the current window
await restoreStateCurrent(StateFlags.ALL);
```

---

## StateFlags

Control which dimensions of window state are persisted.

| Flag          | What it persists              |
| ------------- | ----------------------------- |
| `POSITION`    | Window x/y coordinates        |
| `SIZE`        | Window width/height           |
| `MAXIMIZED`   | Whether window is maximized   |
| `VISIBLE`     | Whether window is visible     |
| `DECORATIONS` | Whether decorations are shown |
| `FULLSCREEN`  | Whether window is fullscreen  |
| `ALL`         | All of the above              |

```rust
use tauri_plugin_window_state::StateFlags;

// Save only position and size (not maximized/fullscreen state)
let flags = StateFlags::POSITION | StateFlags::SIZE;
app.save_window_state(flags).unwrap();
```

**Key point:** the default behavior uses `StateFlags::all()`. If you only want to persist position and size, use a custom flags combination.

---

## Multi-Window State Persistence

The plugin automatically handles all windows. Each window's state is saved under its label, so labels must be consistent across app launches.

```rust
// All windows declared in tauri.conf.json OR created programmatically
// will have their state saved/restored automatically.
// The label used at creation time is the key for persistence.

// Dynamic windows: use consistent labels
WebviewWindowBuilder::new(&app, "editor", url)  // "editor" is the persistence key
    .visible(false)  // Let plugin handle visibility after restore
    .build()?;
```

**Gotcha:** if you create windows with dynamic labels (e.g., `editor-{file-id}`), the plugin saves state per label. Restarting the app with different file IDs means old state won't match. Use stable labels for windows that should persist state.

---

See [core.md](core.md) for window creation patterns and [advanced.md](advanced.md) for parent/child windows.
