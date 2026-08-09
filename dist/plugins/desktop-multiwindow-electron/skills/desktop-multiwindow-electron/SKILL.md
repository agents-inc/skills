---
name: desktop-multiwindow-electron
description: Multi-window management, WebContentsView, BaseWindow, window lifecycle, inter-window communication, state persistence
---

# Electron Multi-Window Patterns

> **Quick Guide:** Use `BrowserWindow` for single-view windows. Use `BaseWindow` + `WebContentsView` for multi-view layouts (tabs, split panes, panels). `BrowserView` is deprecated since Electron 30 -- migrate to `WebContentsView`. Track windows with a `Map<string, BrowserWindow>` registry. Communicate between windows via the main process or `MessagePort` for direct renderer-to-renderer channels. Persist window bounds manually or use the upcoming `windowStatePersistence` API. Always close `webContents` explicitly when using `BaseWindow` -- unlike `BrowserWindow`, it does not auto-cleanup.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST close `webContents` explicitly when destroying a `BaseWindow` -- it does not auto-cleanup like `BrowserWindow`, causing memory leaks)**

**(You MUST use `WebContentsView` instead of `BrowserView` -- `BrowserView` is deprecated since Electron 30)**

**(You MUST route all inter-window communication through the main process or `MessagePort` -- never access another window's renderer directly)**

**(You MUST validate that saved window bounds are on a visible display before restoring -- monitors may disconnect between sessions)**

</critical_requirements>

---

**Auto-detection:** multi-window, BaseWindow, WebContentsView, BrowserView migration, contentView, addChildView, removeChildView, parent window, child window, modal window, window registry, MessagePort, MessageChannelMain, window state persistence, screen API, workArea, getAllDisplays, split view, tabs, panels, window lifecycle, ready-to-show, window-all-closed

**When to use:**

- Creating multi-view layouts (tabs, split panes, embedded panels) with BaseWindow + WebContentsView
- Managing multiple BrowserWindow instances with a window registry
- Migrating from deprecated BrowserView to WebContentsView
- Setting up parent/child or modal windows
- Communicating between windows (via main process relay or MessagePort)
- Persisting and restoring window position, size, and display state
- Placing windows on specific monitors using the screen API

**When NOT to use:**

- Single-window apps with one view (`BrowserWindow` is sufficient on its own)
- Choosing a UI framework for the renderer
- IPC patterns between main and a single renderer (basic IPC is outside multi-window scope)
- Styling or layout within a single renderer

**Key patterns covered:**

- BaseWindow + WebContentsView for multi-view layouts
- BrowserView to WebContentsView migration
- Window lifecycle events (ready-to-show, close, closed)
- Parent/child and modal windows
- Window registry with Map-based tracking
- Inter-window communication via main process and MessagePort
- Window state persistence (bounds, maximized, fullscreen)
- Multi-monitor placement with screen API

---

<philosophy>

## Philosophy

Electron's window model has two tiers. **BrowserWindow** is the simple path: one window, one web view, automatic lifecycle management. **BaseWindow + WebContentsView** is the flexible path: one window shell containing multiple independently managed web views, each with its own renderer process and preload script.

The key architectural decision: **use BrowserWindow for single-view windows, BaseWindow for multi-view layouts.** BaseWindow trades convenience for control -- you manage view lifecycle, bounds, and cleanup explicitly.

**When to use BaseWindow + WebContentsView:**

- Tab bars, split editors, preview panels, embedded browser views
- Any layout where multiple independent web pages share one OS window
- Applications migrating from deprecated BrowserView

**When NOT to use BaseWindow:**

- Single-view windows (BrowserWindow is simpler and handles cleanup automatically)
- Windows that only need a toolbar or status bar (a single BrowserWindow with HTML layout is sufficient)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: BaseWindow with WebContentsView

BaseWindow is the window shell; WebContentsView instances are the content. Each view has its own renderer process and preload script.

```javascript
const { BaseWindow, WebContentsView } = require("electron");

const win = new BaseWindow({ width: 1200, height: 800 });

const sidebar = new WebContentsView({
  webPreferences: { preload: path.join(__dirname, "preload.js") },
});
const main = new WebContentsView({
  webPreferences: { preload: path.join(__dirname, "preload.js") },
});

win.contentView.addChildView(sidebar);
win.contentView.addChildView(main);

const SIDEBAR_WIDTH = 250;
sidebar.setBounds({ x: 0, y: 0, width: SIDEBAR_WIDTH, height: 800 });
main.setBounds({ x: SIDEBAR_WIDTH, y: 0, width: 950, height: 800 });

sidebar.webContents.loadFile("sidebar.html");
main.webContents.loadFile("main.html");
```

**Key point:** Each WebContentsView needs its own `webPreferences` and preload script. BaseWindow has no `webContents` of its own. See [examples/core.md](examples/core.md) for complete split-view and tab examples with resize handling.

---

### Pattern 2: BrowserView to WebContentsView Migration

BrowserView is deprecated since Electron 30. Migration is straightforward -- constructors have the same shape.

| Deprecated (BrowserView)                 | Replacement (WebContentsView)                             |
| ---------------------------------------- | --------------------------------------------------------- |
| `new BrowserView(opts)`                  | `new WebContentsView(opts)`                               |
| `win.addBrowserView(view)`               | `win.contentView.addChildView(view)`                      |
| `win.removeBrowserView(view)`            | `win.contentView.removeChildView(view)`                   |
| `win.getBrowserViews()`                  | `win.contentView.children`                                |
| `win.setTopBrowserView(view)`            | `win.contentView.addChildView(view)` (re-adding reorders) |
| `view.setAutoResize({ vertical: true })` | Manual resize via `win.on("resize", ...)` + `setBounds()` |

**Gotcha:** WebContentsView defaults to a white background; BrowserView defaulted to transparent. Set `view.setBackgroundColor("#00000000")` for transparency.

See [examples/core.md](examples/core.md) for the complete migration pattern with auto-resize replacement.

---

### Pattern 3: Window Lifecycle Events

Window events fire in a predictable order. Use `ready-to-show` to prevent visual flash, `close` to intercept (confirmations, state saving), `closed` for final cleanup.

```javascript
const win = new BrowserWindow({ show: false });

// Prevent white flash -- show only after first paint
win.once("ready-to-show", () => {
  win.show();
});

// Intercept close for unsaved changes
win.on("close", (event) => {
  if (hasUnsavedChanges()) {
    event.preventDefault();
    promptSaveDialog(win);
  }
});

// Final cleanup after window is gone
win.on("closed", () => {
  windowRegistry.delete(win.id);
});
```

**Gotcha:** `ready-to-show` fires on `BrowserWindow` (which owns a `webContents`) but NOT on `BaseWindow` (which has no `webContents`). For BaseWindow, listen on the individual WebContentsView's `webContents` instead: `view.webContents.once("ready-to-show", ...)`.

See [examples/core.md](examples/core.md) for the full lifecycle sequence and BaseWindow workaround.

---

### Pattern 4: Parent/Child and Modal Windows

Child windows always appear above their parent. Modal windows additionally disable the parent until closed.

```javascript
const parent = new BrowserWindow({ width: 800, height: 600 });

// Child window: always on top of parent, non-blocking
const child = new BrowserWindow({
  parent,
  width: 400,
  height: 300,
});

// Modal window: blocks parent interaction
const modal = new BrowserWindow({
  parent,
  modal: true,
  show: false,
  width: 500,
  height: 400,
});
modal.once("ready-to-show", () => modal.show());
```

**Platform behavior:** On macOS, modal child windows display as sheets attached to the parent. On Windows/Linux, they display as separate windows with the parent disabled.

See [examples/core.md](examples/core.md) for confirmation dialogs and settings windows.

---

### Pattern 5: Window Registry

Track all open windows with a Map for reliable lookup, messaging, and cleanup.

```javascript
const windowRegistry = new Map();

function createWindow(id, options) {
  const win = new BrowserWindow(options);
  windowRegistry.set(id, win);

  win.on("closed", () => {
    windowRegistry.delete(id);
  });

  return win;
}

// Find and focus a window by ID
function focusWindow(id) {
  const win = windowRegistry.get(id);
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}
```

**Key point:** Use string IDs (not window objects) as keys. Clean up on `closed` event. The registry enables "show existing or create new" patterns for settings, about, and preferences windows.

See [examples/core.md](examples/core.md) for the full singleton window pattern.

---

### Pattern 6: Inter-Window Communication

Two patterns: **main process relay** for simple messages, **MessagePort** for direct high-frequency renderer-to-renderer channels.

```javascript
// Pattern A: Main process relay
ipcMain.on("message-to-window", (_event, targetId, channel, data) => {
  const target = windowRegistry.get(targetId);
  if (target) target.webContents.send(channel, data);
});

// Pattern B: MessagePort -- direct renderer-to-renderer
const { MessageChannelMain } = require("electron");
const { port1, port2 } = new MessageChannelMain();

window1.webContents.postMessage("port", null, [port1]);
window2.webContents.postMessage("port", null, [port2]);
```

**Key point:** Main process relay is simpler but adds latency. MessagePort creates a direct channel after initial setup. Use `postMessage` (not `send`) to transfer ports.

See [examples/inter-window-communication.md](examples/inter-window-communication.md) for complete examples of both patterns.

---

### Pattern 7: Window State Persistence

Save and restore window bounds, maximized state, and display information across sessions.

```javascript
function saveWindowState(win, stateFile) {
  const bounds = win.getBounds();
  const state = {
    bounds,
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
    displayId: screen.getDisplayMatching(bounds).id,
  };
  fs.writeFileSync(stateFile, JSON.stringify(state));
}
```

**Key point:** Always validate restored bounds against current displays -- a monitor may have been disconnected. Fall back to the primary display's work area if the saved display is unavailable.

See [examples/core.md](examples/core.md) for the complete save/restore cycle with multi-monitor validation.

---

### Pattern 8: Multi-Monitor Placement

Use the `screen` API to enumerate displays, find work areas, and place windows on specific monitors.

```javascript
const { screen } = require("electron");

const displays = screen.getAllDisplays();
const externalDisplay = displays.find(
  (d) => d.bounds.x !== 0 || d.bounds.y !== 0,
);

if (externalDisplay) {
  const win = new BrowserWindow({
    x: externalDisplay.bounds.x,
    y: externalDisplay.bounds.y,
    width: 800,
    height: 600,
  });
}
```

**Key point:** Use `workArea` (not `bounds`) to avoid placing windows behind taskbars/docks. Listen for `display-added`, `display-removed`, and `display-metrics-changed` events to react to monitor changes at runtime.

See [examples/core.md](examples/core.md) for display enumeration and safe placement.

</patterns>

---

<decision_framework>

## Decision Framework

### Window Type Selection

```
How many web views does this window need?
+-- One full-size view?
|   +-- BrowserWindow (simpler, automatic lifecycle)
+-- Multiple views (tabs, split pane, sidebar + content)?
|   +-- BaseWindow + WebContentsView
+-- Frameless window with custom layout?
    +-- One view? -> BrowserWindow with frame: false
    +-- Multiple views? -> BaseWindow with frame: false
```

### Inter-Window Communication

```
How should windows communicate?
+-- Simple, infrequent messages?
|   +-- Main process relay (ipcMain/webContents.send)
+-- High-frequency or streaming data?
|   +-- MessagePort (direct renderer-to-renderer after setup)
+-- Shared state across windows?
    +-- Main process as single source of truth, push updates via IPC
```

### Window Relationship

```
What is the relationship between windows?
+-- Independent (editor, browser tabs)?
|   +-- Separate BrowserWindow instances, window registry
+-- Always above parent (inspector, palette)?
|   +-- Child window: { parent: parentWin }
+-- Blocks parent (save dialog, settings confirmation)?
    +-- Modal window: { parent: parentWin, modal: true }
```

</decision_framework>

---

**Detailed resources:**

- [examples/core.md](examples/core.md) - BaseWindow + WebContentsView, lifecycle, registry, state persistence, multi-monitor
- [examples/inter-window-communication.md](examples/inter-window-communication.md) - Main process relay, MessagePort, typed channels
- [reference.md](reference.md) - API quick-reference tables, migration checklist, event order

---

<red_flags>

## RED FLAGS

**Critical Issues:**

- Not closing `webContents` when destroying a `BaseWindow` -- causes memory leaks (BrowserWindow auto-cleans, BaseWindow does not)
- Using deprecated `BrowserView` instead of `WebContentsView` -- deprecated since Electron 30
- Direct renderer-to-renderer communication bypassing the main process -- violates process isolation
- Restoring window bounds without checking if the target display still exists -- window appears off-screen

**Architecture Issues:**

- Using `BaseWindow` for single-view windows -- unnecessary complexity, use `BrowserWindow`
- Using `BrowserView.setAutoResize()` patterns with `WebContentsView` -- no equivalent exists, use manual resize listeners
- Storing `BrowserWindow` objects as Map values without cleaning up on `closed` -- stale references
- Creating child windows from the renderer process -- always create from main

**Common Mistakes:**

- Expecting `ready-to-show` on `BaseWindow` -- it fires on `BrowserWindow` only; for `BaseWindow`, listen on `view.webContents`
- Forgetting that `WebContentsView` defaults to white background (BrowserView defaulted to transparent) -- set `"#00000000"` explicitly
- Using `ipcRenderer.send()` to transfer `MessagePort` -- only `postMessage()` can transfer ports
- Placing windows using `display.bounds` instead of `display.workArea` -- window ends up behind taskbar/dock
- Not handling `display-removed` event -- window references a disconnected monitor

**Gotchas & Edge Cases:**

- Re-adding a child view with `addChildView()` moves it to the top of the z-order -- this is intentional, not a bug
- `setBounds()` coordinates are relative to the parent view, not the screen
- On macOS, modal windows display as sheets attached to the parent window
- `win.getBounds()` returns the outer frame bounds on some platforms -- content area may differ
- Each `WebContentsView` runs its own renderer process -- resource usage scales linearly with view count
- `MessagePortMain` requires calling `.start()` before messages are delivered -- they queue until then

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST close `webContents` explicitly when destroying a `BaseWindow` -- it does not auto-cleanup like `BrowserWindow`, causing memory leaks)**

**(You MUST use `WebContentsView` instead of `BrowserView` -- `BrowserView` is deprecated since Electron 30)**

**(You MUST route all inter-window communication through the main process or `MessagePort` -- never access another window's renderer directly)**

**(You MUST validate that saved window bounds are on a visible display before restoring -- monitors may disconnect between sessions)**

**Failure to follow these rules will cause memory leaks, deprecated API warnings, broken inter-process communication, or off-screen windows.**

</critical_reminders>
