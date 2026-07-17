# Tauri Multi-Window & Events - Advanced Patterns

> Parent/child windows, modal dialogs, and multi-webview layouts. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for basic window creation and events. See [persistence.md](persistence.md) for window state plugin.

---

## Parent/Child Windows

### JavaScript: Create a Child Window

```typescript
import {
  WebviewWindow,
  getCurrentWebviewWindow,
} from "@tauri-apps/api/webviewWindow";

const DIALOG_LABEL = "confirm-dialog";
const DIALOG_WIDTH = 400;
const DIALOG_HEIGHT = 200;

async function openChildDialog(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(DIALOG_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const parent = getCurrentWebviewWindow();

  const dialog = new WebviewWindow(DIALOG_LABEL, {
    url: "confirm.html",
    title: "Confirm Action",
    width: DIALOG_WIDTH,
    height: DIALOG_HEIGHT,
    parent: parent,
    center: true,
    resizable: false,
  });

  dialog.once("tauri://error", (e) => {
    console.error("Failed to create dialog:", e);
  });
}
```

**Key point:** setting `parent` creates an owned window. On macOS, the child moves with the parent. On Linux, the child is transient (stays above parent). On Windows, the child is hidden when the parent is minimized.

### Rust: Create a Child Window

```rust
use tauri::{Manager, WebviewWindowBuilder};

const DIALOG_LABEL: &str = "confirm-dialog";
const DIALOG_WIDTH: f64 = 400.0;
const DIALOG_HEIGHT: f64 = 200.0;

#[tauri::command]
async fn open_child_dialog(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(DIALOG_LABEL) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let parent = app.get_webview_window("main")
        .ok_or("Parent window not found")?;

    WebviewWindowBuilder::new(
        &app,
        DIALOG_LABEL,
        tauri::WebviewUrl::App("confirm.html".into()),
    )
    .title("Confirm Action")
    .inner_size(DIALOG_WIDTH, DIALOG_HEIGHT)
    .parent(&parent)
    .map_err(|e| e.to_string())?
    .center()
    .resizable(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
```

**Key point:** `.parent()` returns a `Result` because parent window support varies by platform -- handle the error.

---

## Dialog Pattern: Child Communicates Result to Parent

A common pattern for confirmation dialogs: the child emits a result event, the parent listens.

### Parent Window

```typescript
import { listen } from "@tauri-apps/api/event";

// Open child and listen for its response
await openChildDialog();

const unlisten = await listen<{ confirmed: boolean }>(
  "dialog-result",
  (event) => {
    if (event.payload.confirmed) {
      performAction();
    }
    unlisten();
  },
);
```

### Child Window (confirm.html)

```typescript
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

const PARENT_LABEL = "main";

async function handleConfirm(confirmed: boolean): Promise<void> {
  await emitTo(PARENT_LABEL, "dialog-result", { confirmed });
  const currentWindow = getCurrentWindow();
  await currentWindow.destroy();
}
```

**Why good:** child uses `emitTo` to send result only to the parent (not all windows), then closes itself with `destroy()`

---

## Window Position Management

### Position Relative to Parent

```typescript
import {
  getCurrentWebviewWindow,
  WebviewWindow,
} from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";

const OFFSET_X = 50;
const OFFSET_Y = 50;
const CHILD_WIDTH = 400;
const CHILD_HEIGHT = 300;

async function openOffsetChild(label: string, url: string): Promise<void> {
  const parent = getCurrentWebviewWindow();
  const parentPos = await parent.outerPosition();
  const parentSize = await parent.outerSize();

  const childX = parentPos.x + OFFSET_X;
  const childY = parentPos.y + OFFSET_Y;

  const child = new WebviewWindow(label, {
    url,
    width: CHILD_WIDTH,
    height: CHILD_HEIGHT,
    x: childX,
    y: childY,
  });
}
```

**Key point:** use `outerPosition()` and `outerSize()` for pixel-accurate positioning. These return `PhysicalPosition`/`PhysicalSize` which account for display scaling (HiDPI).

---

## Multi-Webview in a Single Window (Unstable)

Create multiple webviews within a single window for panel/splitter layouts. Requires the `unstable` feature flag in Cargo.toml.

### Setup

```toml
# Cargo.toml
[dependencies]
tauri = { version = "2", features = ["unstable"] }
```

### Create a Split Layout

```rust
use tauri::{LogicalPosition, LogicalSize};
use tauri::webview::WebviewBuilder;
use tauri::window::WindowBuilder;

const WINDOW_WIDTH: f64 = 1200.0;
const WINDOW_HEIGHT: f64 = 800.0;
const SIDEBAR_WIDTH: f64 = 300.0;

fn setup_split_layout(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = WindowBuilder::new(app, "main")
        .title("My App")
        .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
        .build()?;

    let content_width = WINDOW_WIDTH - SIDEBAR_WIDTH;

    // Left sidebar panel
    window.add_child(
        WebviewBuilder::new("sidebar", tauri::WebviewUrl::App("sidebar.html".into())),
        LogicalPosition::new(0.0, 0.0),
        LogicalSize::new(SIDEBAR_WIDTH, WINDOW_HEIGHT),
    )?;

    // Main content panel
    window.add_child(
        WebviewBuilder::new("content", tauri::WebviewUrl::App("content.html".into())),
        LogicalPosition::new(SIDEBAR_WIDTH, 0.0),
        LogicalSize::new(content_width, WINDOW_HEIGHT),
    )?;

    Ok(())
}
```

**Key point:** each child webview gets its own label and can communicate with other webviews via the event system (`emitTo`). Position and size use `LogicalPosition`/`LogicalSize` for DPI-aware layout.

### Cross-Panel Communication

```typescript
// In sidebar.html: notify content panel of selection
import { emitTo } from "@tauri-apps/api/event";

async function selectItem(itemId: string): Promise<void> {
  await emitTo("content", "item-selected", { itemId });
}
```

```typescript
// In content.html: listen for sidebar selections
import { getCurrentWebview } from "@tauri-apps/api/webview";

const webview = getCurrentWebview();
const unlisten = await webview.listen<{ itemId: string }>(
  "item-selected",
  (event) => {
    loadItem(event.payload.itemId);
  },
);
```

**Key point:** in multi-webview setups, use `getCurrentWebview()` from `@tauri-apps/api/webview` (not `getCurrentWebviewWindow()`). Each webview within the window has its own label and event scope.

### Resizing Panels Programmatically

```rust
use tauri::{LogicalPosition, LogicalSize, Manager};

#[tauri::command]
fn resize_sidebar(app: tauri::AppHandle, new_width: f64) -> Result<(), String> {
    let window = app.get_webview_window("main")
        .ok_or("Main window not found")?;

    let window_size = window.inner_size().map_err(|e| e.to_string())?;
    let height = window_size.height as f64;
    let content_width = window_size.width as f64 - new_width;

    if let Some(sidebar) = app.get_webview("sidebar") {
        sidebar.set_size(LogicalSize::new(new_width, height))
            .map_err(|e| e.to_string())?;
    }

    if let Some(content) = app.get_webview("content") {
        content.set_position(LogicalPosition::new(new_width, 0.0))
            .map_err(|e| e.to_string())?;
        content.set_size(LogicalSize::new(content_width, height))
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

**Limitations of multi-webview:**

- Desktop-only (no mobile support)
- Requires `unstable` feature flag -- API may change between Tauri minor versions
- No built-in drag-to-resize between panels -- must implement resize handles in the webview or via Rust commands
- Each webview runs in its own web context (no shared DOM, no shared JS globals)

---

See [core.md](core.md) for window creation patterns and [persistence.md](persistence.md) for state persistence.
