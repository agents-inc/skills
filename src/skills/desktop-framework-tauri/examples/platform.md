# Tauri - Platform Features

> Window management, system tray, menus, multi-window apps, and webview management. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for commands and state.

---

## Window Management

### Create Windows from Rust

```rust
use tauri::WebviewWindowBuilder;

#[tauri::command]
async fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    // Check if window already exists
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("settings.html".into()),
    )
    .title("Settings")
    .inner_size(600.0, 400.0)
    .resizable(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
```

**Why this pattern:** Always check if the window already exists before creating. `WebviewWindowBuilder` provides a fluent API for window configuration. The label (`"settings"`) must be unique across all windows.

### Create Windows from Frontend

```typescript
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const settingsWindow = new WebviewWindow("settings", {
  url: "settings.html",
  title: "Settings",
  width: 600,
  height: 400,
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

**Key point:** The window label must match the `windows` array in capability files for permissions to apply.

---

## Window Properties and Methods

```typescript
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const appWindow = getCurrentWebviewWindow();

// Position and size
await appWindow.setPosition(new PhysicalPosition(100, 100));
await appWindow.setSize(new PhysicalSize(800, 600));
await appWindow.center();

// Visibility
await appWindow.show();
await appWindow.hide();
await appWindow.setFocus();

// State
await appWindow.minimize();
await appWindow.maximize();
await appWindow.unmaximize();
const isMaximized = await appWindow.isMaximized();

// Title
await appWindow.setTitle("New Title");

// Decorations and always-on-top
await appWindow.setDecorations(false);
await appWindow.setAlwaysOnTop(true);

// Close
await appWindow.close();
```

```typescript
// Import position/size types
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
```

**Key point:** Use `PhysicalPosition`/`PhysicalSize` for pixel-accurate positioning. These account for display scaling (HiDPI/Retina).

---

## System Tray

```rust
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::{Emitter, Manager};

pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
    let hide = MenuItemBuilder::with_id("hide", "Hide Window").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&show, &hide, &quit])
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => (),
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

```rust
// Register in app setup
tauri::Builder::default()
    .setup(|app| {
        setup_tray(app)?;
        Ok(())
    })
```

**Why this pattern:** `TrayIconBuilder` (Tauri 2) replaces the removed `SystemTray` API from v1. Menu items are created with `MenuItemBuilder::with_id()` and matched by ID in the event handler. Tray icon events and menu events are handled separately.

**Key point:** The tray icon must be set explicitly. Use `app.default_window_icon()` to reuse the app icon, or load a custom icon with `tauri::image::Image::from_bytes()`.

---

## Application Menu

```rust
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

pub fn setup_menu(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open = MenuItemBuilder::with_id("open", "Open File")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .items(&[&open, &save, &quit])
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&file_menu])
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(move |app, event| {
        match event.id().as_ref() {
            "open" => app.emit("menu-open", ()).unwrap(),
            "save" => app.emit("menu-save", ()).unwrap(),
            "quit" => app.exit(0),
            _ => (),
        }
    });

    Ok(())
}
```

**Key point:** Use `accelerator()` for keyboard shortcuts. The `"CmdOrCtrl"` modifier maps to Cmd on macOS and Ctrl on Windows/Linux. Menu events are emitted to the frontend via `app.emit()` for the UI to handle.

---

## Multi-Window Communication

```rust
use tauri::{Emitter, Manager};

#[tauri::command]
fn send_to_window(app: tauri::AppHandle, target: String, payload: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&target) {
        window.emit("message", payload).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

```typescript
// In target window
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const appWindow = getCurrentWebviewWindow();
const unlisten = await appWindow.listen<string>("message", (event) => {
  console.log("Received:", event.payload);
});
```

**Key point:** Use `app.get_webview_window(label)` to get a specific window by its label. Window-targeted `emit()` only delivers to that window, not globally.

---

## Prevent Window Close (Confirm Exit)

```rust
use tauri::Manager;

tauri::Builder::default()
    .setup(|app| {
        let window = app.get_webview_window("main").unwrap();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Prevent the window from closing
                api.prevent_close();
                // Emit event to frontend for confirmation dialog
                // (handled by frontend framework)
            }
        });
        Ok(())
    })
```

**Key point:** `api.prevent_close()` stops the close action. The frontend can then show a confirmation dialog and call `appWindow.close()` or `appWindow.destroy()` if confirmed.

---

See [core.md](core.md) for command patterns and [security.md](security.md) for window-scoped permissions.
