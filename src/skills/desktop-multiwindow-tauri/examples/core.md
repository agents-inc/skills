# Tauri Multi-Window & Events - Core Examples

> Window creation, event system, close confirmation, and cross-window communication. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [persistence.md](persistence.md) for window state plugin. See [advanced.md](advanced.md) for parent/child and multi-webview.

---

## Window Creation from JavaScript

### Basic Creation with Existence Check

```typescript
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const SETTINGS_LABEL = "settings";
const SETTINGS_WIDTH = 600;
const SETTINGS_HEIGHT = 400;

async function openSettingsWindow(): Promise<void> {
  // Always check if window already exists
  const existing = await WebviewWindow.getByLabel(SETTINGS_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const settingsWindow = new WebviewWindow(SETTINGS_LABEL, {
    url: "settings.html",
    title: "Settings",
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    resizable: false,
    center: true,
  });

  settingsWindow.once("tauri://created", () => {
    console.log("Settings window created");
  });

  settingsWindow.once("tauri://error", (e) => {
    console.error("Failed to create settings window:", e);
  });
}
```

**Why good:** existence check prevents duplicate-label runtime errors, named constants for dimensions, handles both success and error events, focuses existing window instead of creating duplicate

```typescript
// BAD: No existence check, magic numbers, no error handling
const win = new WebviewWindow("settings", {
  url: "settings.html",
  width: 600,
  height: 400,
});
```

**Why bad:** creating a second window with the same label throws a runtime error, magic numbers are undocumented, silent failure if creation fails

---

## Window Creation from Rust

```rust
use tauri::WebviewWindowBuilder;

const SETTINGS_LABEL: &str = "settings";
const SETTINGS_WIDTH: f64 = 600.0;
const SETTINGS_HEIGHT: f64 = 400.0;

#[tauri::command]
async fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    // Check if window already exists
    if let Some(window) = app.get_webview_window(SETTINGS_LABEL) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        SETTINGS_LABEL,
        tauri::WebviewUrl::App("settings.html".into()),
    )
    .title("Settings")
    .inner_size(SETTINGS_WIDTH, SETTINGS_HEIGHT)
    .resizable(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
```

**Why good:** same existence-check pattern as JS side, named constants, returns Result for error propagation to frontend

---

## Event System

### Global Events (All Windows)

Use for app-wide broadcasts where every window should react.

```typescript
import { emit, listen } from "@tauri-apps/api/event";

// Emitting: all windows with a "theme-changed" listener receive this
await emit("theme-changed", { theme: "dark" });

// Listening: returns an unlisten function -- MUST be called on cleanup
const unlisten = await listen<{ theme: string }>("theme-changed", (event) => {
  applyTheme(event.payload.theme);
});

// Clean up when component unmounts or listener is no longer needed
unlisten();
```

**Why good:** typed payload with generics, unlisten stored and called on cleanup

```typescript
// BAD: Listener leak -- unlisten never called
await listen("theme-changed", (event) => {
  applyTheme(event.payload.theme);
});
```

**Why bad:** listener accumulates on every mount/navigation, memory leak in long-running apps

---

### Targeted Events (One Specific Window)

Use when you know exactly which window should receive the event.

```typescript
import { emitTo } from "@tauri-apps/api/event";

// Send to the "editor" window only
await emitTo("editor", "file-opened", { path: "/docs/readme.md" });
```

```typescript
// Listening in the editor window
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const appWindow = getCurrentWebviewWindow();
const unlisten = await appWindow.listen<{ path: string }>(
  "file-opened",
  (event) => {
    loadFile(event.payload.path);
  },
);
```

**Key point:** `emitTo` accepts either a string label or an `EventTarget` object. Using the string label is simpler for most cases.

---

### Filtered Events (Multiple Specific Windows -- Rust Only)

Use when targeting a subset of windows by predicate. Only available from Rust.

```rust
use tauri::{Emitter, EventTarget};

#[tauri::command]
fn notify_viewers(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.emit_filter("file-changed", &path, |target| match target {
        EventTarget::WebviewWindow { label } =>
            label == "main" || label == "file-viewer" || label == "diff-viewer",
        _ => false,
    })
    .map_err(|e| e.to_string())?;

    Ok(())
}
```

**Why good:** single emission to multiple windows without calling `emit_to` three times, predicate-based filtering is flexible

**Key point:** there is no JavaScript equivalent of `emit_filter`. From the frontend, use multiple `emitTo()` calls.

---

### One-Time Events

Use `once()` for events you only need to handle once (initialization, window-ready signals).

```typescript
import { once } from "@tauri-apps/api/event";

// Listen only for the first occurrence
const unlisten = await once<{ ready: boolean }>("app-initialized", (event) => {
  console.log("App ready:", event.payload.ready);
});
```

```rust
use tauri::Listener;

app.once("frontend-ready", |event| {
    println!("Frontend reports ready: {:?}", event.payload());
});
```

---

## Cross-Window State Synchronization

Use events to keep state in sync across windows. One window emits changes, others listen and update.

```typescript
// In the settings window: emit preference changes
import { emit } from "@tauri-apps/api/event";

interface PreferenceUpdate {
  key: string;
  value: unknown;
}

async function updatePreference(key: string, value: unknown): Promise<void> {
  // Save to backend/store first
  await savePreference(key, value);
  // Broadcast to all windows
  await emit("preference-updated", { key, value } satisfies PreferenceUpdate);
}
```

```typescript
// In every other window: listen for preference changes
import { listen } from "@tauri-apps/api/event";

interface PreferenceUpdate {
  key: string;
  value: unknown;
}

const unlisten = await listen<PreferenceUpdate>(
  "preference-updated",
  (event) => {
    const { key, value } = event.payload;
    applyPreference(key, value);
  },
);

// Clean up on unmount
unlisten();
```

**Key point:** the emitting window also receives its own global events unless you use `emitTo` to target only other windows. Filter in the listener if needed, or use `emitTo` to each window except `getCurrentWebviewWindow().label`.

---

## Window Close Confirmation

### JavaScript (onCloseRequested)

```typescript
import { getCurrentWindow } from "@tauri-apps/api/window";

const currentWindow = getCurrentWindow();
const unlisten = await currentWindow.onCloseRequested(async (event) => {
  if (hasUnsavedChanges()) {
    event.preventDefault();
    // Show your confirmation UI
    const confirmed = await showConfirmDialog(
      "You have unsaved changes. Close anyway?",
    );
    if (confirmed) {
      // Use destroy() to force-close without retriggering close-requested
      await currentWindow.destroy();
    }
  }
});
```

**Why good:** prevents accidental data loss, uses `destroy()` instead of `close()` to avoid retriggering the close handler

```typescript
// BAD: Using close() after preventDefault causes infinite loop
const unlisten = await currentWindow.onCloseRequested(async (event) => {
  event.preventDefault();
  const confirmed = await showConfirmDialog("Close?");
  if (confirmed) {
    await currentWindow.close(); // Triggers onCloseRequested again!
  }
});
```

**Why bad:** `close()` fires the close-requested event again, creating an infinite confirmation loop

### Rust (on_window_event)

```rust
use tauri::Manager;

tauri::Builder::default()
    .setup(|app| {
        let window = app.get_webview_window("main").unwrap();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                // Emit to frontend for confirmation UI
                // Frontend calls window.destroy() if confirmed
            }
        });
        Ok(())
    })
```

**Key point:** the Rust `on_window_event` approach is more reliable for dynamically created windows where the JS `onCloseRequested` may have known issues.

---

## Retrieving Windows

### Get All Open Windows

```typescript
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const allWindows = WebviewWindow.getAll();
for (const win of allWindows) {
  console.log(`Window: ${win.label}`);
}
```

### Get Current Window

```typescript
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const currentWindow = getCurrentWebviewWindow();
console.log(`I am: ${currentWindow.label}`);
```

### Get Window by Label

```typescript
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const editor = await WebviewWindow.getByLabel("editor");
if (editor) {
  await editor.setFocus();
}
```

```rust
use tauri::Manager;

if let Some(editor) = app.get_webview_window("editor") {
    editor.set_focus().unwrap();
}
```

---

## Capability File for Multi-Window

Every window label must appear in a capability file's `windows` array to receive permissions.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "multi-window-capability",
  "description": "Permissions for all app windows",
  "windows": ["main", "settings", "editor", "file-viewer"],
  "permissions": [
    "core:default",
    "event:default",
    "window:default",
    "window:allow-create",
    "window:allow-close",
    "window:allow-set-focus"
  ]
}
```

**Key point:** a window not listed in any capability's `windows` array silently lacks permissions. If a new window can't use plugins or core APIs, check this first.

---

See [persistence.md](persistence.md) for window state persistence and [advanced.md](advanced.md) for parent/child and multi-webview patterns.
