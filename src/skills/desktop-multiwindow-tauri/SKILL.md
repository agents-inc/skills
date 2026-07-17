---
name: desktop-multiwindow-tauri
description: Tauri 2.x multi-window creation, event system, window state persistence, parent/child and modal windows
---

# Tauri Multi-Window & Events

> **Quick Guide:** Create windows from JS with `new WebviewWindow(label, options)` or from Rust with `WebviewWindowBuilder`. Communicate across windows using events: `emit()` broadcasts globally, `emitTo(label, event, payload)` targets a specific window, `emit_filter()` targets multiple windows by predicate. Always call the unlisten function returned by `listen()`. Use `tauri-plugin-window-state` to persist window position/size across sessions. Window labels must be unique and are used for both event targeting and permission scoping.
>
> **Current version:** Tauri 2.x (stable). Multi-webview in a single window requires the `unstable` feature flag.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST give every window a unique label -- labels identify windows for event targeting, permissions, and retrieval)**

**(You MUST always call the unlisten function returned by `listen()` / `once()` -- leaked listeners cause memory leaks in long-running apps)**

**(You MUST check if a window already exists before creating it -- duplicate labels cause runtime errors)**

**(You MUST add window labels to capability file `windows` array -- windows without permissions cannot use plugins or core APIs)**

**(You MUST use `@tauri-apps/api/event` for global events and `@tauri-apps/api/webviewWindow` for window-scoped events -- mixing them causes missed events)**

</critical_requirements>

---

**Auto-detection:** WebviewWindow, WebviewWindowBuilder, emit_to, emitTo, emit_filter, EventTarget, window label, multi-window, onCloseRequested, tauri-plugin-window-state, parent window, modal window, WebviewBuilder, add_child, getCurrentWebviewWindow, window.listen, window.emit, cross-window communication

**When to use:**

- Creating secondary windows (settings, preferences, about, detached panels)
- Communicating between windows via the Tauri event system
- Handling window close confirmation (unsaved changes dialogs)
- Persisting window size/position across app restarts
- Setting up parent/child or modal window relationships
- Building multi-panel layouts with multiple webviews in a single window

**When NOT to use:**

- Single-window apps with no inter-window communication (use the base Tauri framework skill)
- General Tauri commands, IPC, or plugin setup (use the base Tauri framework skill)
- Frontend framework state management within a single window (use respective framework skills)

**Key patterns covered:**

- Window creation from JS and Rust ([examples/core.md](examples/core.md))
- Event system: emit, emitTo, emit_filter for targeted messaging ([examples/core.md](examples/core.md))
- Cross-window state synchronization via events ([examples/core.md](examples/core.md))
- Window close confirmation with onCloseRequested ([examples/core.md](examples/core.md))
- Window state persistence with tauri-plugin-window-state ([examples/persistence.md](examples/persistence.md))
- Parent/child windows and modal dialogs ([examples/advanced.md](examples/advanced.md))
- Multi-webview in a single window (unstable) ([examples/advanced.md](examples/advanced.md))

**Detailed resources:**

- [examples/core.md](examples/core.md) - Window creation, event system, close confirmation, cross-window sync
- [examples/persistence.md](examples/persistence.md) - Window state plugin setup, manual save/restore, StateFlags
- [examples/advanced.md](examples/advanced.md) - Parent/child windows, modals, multi-webview layouts
- [reference.md](reference.md) - API quick reference, event method comparison, decision framework

---

<philosophy>

## Philosophy

Tauri's multi-window architecture is built on two key concepts: **window labels** for identification and **events** for communication.

Every window has a unique string label assigned at creation. This label is used everywhere: event targeting with `emitTo`, permission scoping in capability files, and retrieval with `app.get_webview_window(label)`. Labels are the window's address.

The event system follows a pub-sub model with three tiers of targeting:

1. **Global** (`emit`) -- all listeners in all windows receive the event
2. **Targeted** (`emitTo`) -- only listeners in the specified window receive the event
3. **Filtered** (`emit_filter`) -- listeners matching a predicate receive the event

**When to use multi-window patterns:**

- App needs separate UI surfaces (settings panel, file viewer, log output)
- Need to decouple UI concerns into independent windows
- Need modal dialogs that block interaction with the parent window
- Need persistent panel layouts (IDE-style split views)

**When NOT to use multi-window:**

- A tabbed interface within a single window handles the use case
- The secondary UI is a simple overlay/modal that lives in the same DOM
- You only need to show/hide sections of a single-page app

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Window Creation

Create windows from JavaScript or Rust. Always check if the window exists first to avoid duplicate-label errors.

```typescript
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const SETTINGS_WINDOW_LABEL = "settings";
const SETTINGS_WIDTH = 600;
const SETTINGS_HEIGHT = 400;

// Check if already open, focus it instead of creating duplicate
const existing = await WebviewWindow.getByLabel(SETTINGS_WINDOW_LABEL);
if (existing) {
  await existing.setFocus();
  return;
}

const settingsWindow = new WebviewWindow(SETTINGS_WINDOW_LABEL, {
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
  console.error("Failed to create window:", e);
});
```

**Why good:** checks for existing window first, uses named constants for dimensions, handles both creation success and error events

See [examples/core.md](examples/core.md) for Rust-side creation with `WebviewWindowBuilder` and a full reusable helper.

---

### Pattern 2: Event System (Global, Targeted, Filtered)

Three tiers of event emission -- choose the narrowest scope that fits.

```typescript
import { emit, emitTo, listen } from "@tauri-apps/api/event";

// Global: all windows receive
await emit("theme-changed", { theme: "dark" });

// Targeted: only the "editor" window receives
await emitTo("editor", "file-opened", { path: "/docs/readme.md" });
```

```rust
use tauri::{Emitter, EventTarget};

// Targeted: send to one window
app.emit_to("editor", "file-opened", payload)?;

// Filtered: send to multiple specific windows
app.emit_filter("file-opened", payload, |target| match target {
    EventTarget::WebviewWindow { label } =>
        label == "main" || label == "file-viewer",
    _ => false,
})?;
```

**Key decision:** Use `emit()` for app-wide broadcasts (theme changes, user logout). Use `emitTo()` when you know the exact target window. Use `emit_filter()` when targeting multiple specific windows.

See [examples/core.md](examples/core.md) for the full listening pattern with cleanup and cross-window state sync.

---

### Pattern 3: Window Close Confirmation

Intercept the close request to show a confirmation dialog (e.g., unsaved changes).

```typescript
import { getCurrentWindow } from "@tauri-apps/api/window";

const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
  if (hasUnsavedChanges()) {
    event.preventDefault();
    // Show your confirmation UI, then call window.close() or window.destroy() if confirmed
  }
});

// Clean up listener when no longer needed
unlisten();
```

**Key point:** `event.preventDefault()` stops the window from closing. You must then either close it programmatically when the user confirms or leave it open. `destroy()` force-closes without triggering close-requested again.

See [examples/core.md](examples/core.md) for the Rust-side equivalent using `on_window_event`.

---

### Pattern 4: Window State Persistence

Use `tauri-plugin-window-state` to automatically save and restore window position/size across sessions.

```rust
tauri::Builder::default()
    .setup(|app| {
        #[cfg(desktop)]
        app.handle().plugin(
            tauri_plugin_window_state::Builder::default().build()
        );
        Ok(())
    })
```

**Key point:** Set `visible: false` in window config and let the plugin show the window after restoring state -- prevents a flash of the default position before restore. See [examples/persistence.md](examples/persistence.md) for manual save/restore and StateFlags.

---

### Pattern 5: Parent/Child and Modal Windows

Create owned windows that are tied to a parent. Modal windows block interaction with the parent until closed.

```typescript
import {
  WebviewWindow,
  getCurrentWebviewWindow,
} from "@tauri-apps/api/webviewWindow";

const DIALOG_LABEL = "confirm-dialog";
const DIALOG_WIDTH = 400;
const DIALOG_HEIGHT = 200;

const parent = getCurrentWebviewWindow();

const dialog = new WebviewWindow(DIALOG_LABEL, {
  url: "confirm.html",
  title: "Confirm Action",
  width: DIALOG_WIDTH,
  height: DIALOG_HEIGHT,
  parent: parent,
  center: true,
});
```

```rust
use tauri::WebviewWindowBuilder;

const DIALOG_WIDTH: f64 = 400.0;
const DIALOG_HEIGHT: f64 = 200.0;

WebviewWindowBuilder::new(&app, "confirm-dialog", tauri::WebviewUrl::App("confirm.html".into()))
    .title("Confirm Action")
    .inner_size(DIALOG_WIDTH, DIALOG_HEIGHT)
    .parent(&parent_window)?
    .center()
    .build()?;
```

**Key point:** On macOS, parent makes the child a child window. On Linux, it makes it transient. Owned windows are hidden when the parent is minimized. See [examples/advanced.md](examples/advanced.md) for modal patterns.

---

### Pattern 6: Multi-Webview in a Single Window (Unstable)

Create multiple webviews within a single window for panel/splitter layouts. Requires the `unstable` Cargo feature.

```rust
// Cargo.toml: tauri = { version = "2", features = ["unstable"] }

use tauri::{LogicalPosition, LogicalSize};
use tauri::webview::WebviewBuilder;
use tauri::window::WindowBuilder;

let window = WindowBuilder::new(&app, "main")
    .inner_size(1200.0, 800.0)
    .build()?;

let sidebar_width = 300.0;
let main_width = 900.0;
let height = 800.0;

window.add_child(
    WebviewBuilder::new("sidebar", tauri::WebviewUrl::App("sidebar.html".into())),
    LogicalPosition::new(0.0, 0.0),
    LogicalSize::new(sidebar_width, height),
)?;

window.add_child(
    WebviewBuilder::new("content", tauri::WebviewUrl::App("content.html".into())),
    LogicalPosition::new(sidebar_width, 0.0),
    LogicalSize::new(main_width, height),
)?;
```

**Key point:** This is behind the `unstable` feature flag and is desktop-only. Each child webview gets its own label and can communicate via the event system. See [examples/advanced.md](examples/advanced.md) for resizing patterns.

</patterns>

---

<decision_framework>

## Decision Framework

### Event Targeting

```
Who should receive this event?
|-- ALL windows in the app?
|   +-- emit() (global broadcast)
|-- ONE specific window?
|   +-- emitTo(label, event, payload) (targeted)
|-- MULTIPLE specific windows (but not all)?
|   +-- emit_filter() with predicate (Rust only)
+-- The backend (Rust side)?
    +-- emit() from frontend + app.listen() in Rust
```

### Window Architecture

```
Does this UI surface need to be a separate window?
|-- Is it a settings/preferences panel?
|   +-- YES: separate window with its own label
|-- Is it a modal confirmation dialog?
|   +-- YES: child window with parent set
|-- Is it a dockable/undockable panel (IDE-style)?
|   +-- YES: multi-webview in single window (unstable)
|-- Is it content that can live in the same DOM?
|   +-- NO: don't create a new window -- use in-app routing/tabs
+-- Does it need to persist across window close?
    +-- YES: use tauri-plugin-window-state
```

### Where to Create Windows

```
Where does window creation belong?
|-- Triggered by user action in UI (button click)?
|   +-- Frontend: new WebviewWindow(label, options)
|-- Triggered by backend logic (file watcher, system event)?
|   +-- Rust: WebviewWindowBuilder::new(app, label, url)
|-- Need multiple webviews in one window?
|   +-- Rust: WindowBuilder + window.add_child(WebviewBuilder)
+-- Declared at startup in config?
    +-- tauri.conf.json "windows" array
```

See [reference.md](reference.md) for the complete API quick reference.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Duplicate window labels -- creating a window with a label that already exists throws a runtime error; always check first with `getByLabel()` or `app.get_webview_window()`
- Missing unlisten calls -- `listen()` returns an unlisten function; not calling it leaks memory, especially in long-running apps or components that mount/unmount
- Window label not in capability file `windows` array -- the new window silently lacks permissions for plugins and core APIs
- Using `@tauri-apps/api/tauri` for event imports -- removed in v2; use `@tauri-apps/api/event` for global events and `@tauri-apps/api/webviewWindow` for window-scoped events
- Calling `emit()` when you mean `emitTo()` -- broadcasting sensitive events (auth tokens, user data) to all windows is a security risk

**Medium Priority Issues:**

- Not handling `tauri://error` event on window creation -- creation can fail silently without this listener
- Using `close()` after `preventDefault()` in close handler -- triggers the close-requested event again; use `destroy()` to force-close without re-triggering
- Hardcoding window dimensions without named constants -- magic numbers make layouts harder to maintain
- Not using `center: true` or explicit position -- windows appear at OS-default position, which may be off-screen on multi-monitor setups

**Gotchas & Edge Cases:**

- **`onCloseRequested` on dynamic windows:** there is a known issue where `event.preventDefault()` may not work on windows created at runtime; use the Rust `on_window_event` approach as a fallback
- **Event payload serialization:** payloads must be serializable (JSON-compatible from JS, `serde::Serialize` from Rust); complex types like functions or DOM nodes cannot be sent
- **Window labels:** must be alphanumeric with `-`, `/`, `:`, `_` characters only -- no spaces or special characters
- **Multi-monitor:** `center()` centers on the primary monitor; for specific monitor positioning use `setPosition()` with `PhysicalPosition`
- **`emit_filter` is Rust-only:** there is no JavaScript equivalent; use multiple `emitTo()` calls from the frontend
- **Multi-webview is unstable:** requires `features = ["unstable"]` in Cargo.toml and is desktop-only (no mobile support)
- **Window state plugin:** does not restore maximized/fullscreen state by default -- use `StateFlags::all()` to include all state dimensions
- **Platform differences:** parent/child behavior varies -- macOS creates child windows, Linux uses transient windows, Windows creates owned windows

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST give every window a unique label -- labels identify windows for event targeting, permissions, and retrieval)**

**(You MUST always call the unlisten function returned by `listen()` / `once()` -- leaked listeners cause memory leaks in long-running apps)**

**(You MUST check if a window already exists before creating it -- duplicate labels cause runtime errors)**

**(You MUST add window labels to capability file `windows` array -- windows without permissions cannot use plugins or core APIs)**

**(You MUST use `@tauri-apps/api/event` for global events and `@tauri-apps/api/webviewWindow` for window-scoped events -- mixing them causes missed events)**

**Failure to follow these rules will cause runtime errors, memory leaks, silent permission failures, and missed events.**

</critical_reminders>
