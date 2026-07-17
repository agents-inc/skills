# Electron Multi-Window - Core Patterns

> BaseWindow + WebContentsView layouts, window lifecycle, parent/child windows, window registry, state persistence, multi-monitor. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [inter-window-communication.md](inter-window-communication.md) for IPC between windows.

---

## BaseWindow with Split View

Two WebContentsView instances side by side in a single BaseWindow, with resize handling.

```javascript
const { app, BaseWindow, WebContentsView } = require("electron");
const path = require("node:path");

const SIDEBAR_WIDTH = 300;
const MIN_MAIN_WIDTH = 400;

function createSplitWindow() {
  const win = new BaseWindow({ width: 1200, height: 800, show: false });

  const sidebar = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  const main = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });

  win.contentView.addChildView(sidebar);
  win.contentView.addChildView(main);

  // Initial layout
  const { width, height } = win.getBounds();
  sidebar.setBounds({ x: 0, y: 0, width: SIDEBAR_WIDTH, height });
  main.setBounds({
    x: SIDEBAR_WIDTH,
    y: 0,
    width: width - SIDEBAR_WIDTH,
    height,
  });

  // Re-layout on resize (WebContentsView has no setAutoResize)
  win.on("resize", () => {
    const { width: w, height: h } = win.getBounds();
    sidebar.setBounds({ x: 0, y: 0, width: SIDEBAR_WIDTH, height: h });
    main.setBounds({
      x: SIDEBAR_WIDTH,
      y: 0,
      width: w - SIDEBAR_WIDTH,
      height: h,
    });
  });

  sidebar.webContents.loadFile("sidebar.html");
  main.webContents.loadFile("main.html");

  // BaseWindow does not fire ready-to-show -- listen on a view's webContents
  main.webContents.once("ready-to-show", () => {
    win.show();
  });

  // CRITICAL: explicitly destroy webContents on close (BaseWindow does not auto-cleanup)
  win.on("closed", () => {
    sidebar.webContents.close();
    main.webContents.close();
  });

  return win;
}

app.whenReady().then(createSplitWindow);
```

**Why good:** Named constants for layout dimensions, manual resize replaces deprecated setAutoResize, explicit webContents cleanup prevents memory leaks, ready-to-show workaround for BaseWindow

---

## Tab Management with WebContentsView

Multiple tabs where only the active tab view is visible, with a fixed tab bar.

```javascript
const { BaseWindow, WebContentsView } = require("electron");
const path = require("node:path");

const TAB_BAR_HEIGHT = 40;

class TabbedWindow {
  constructor() {
    this.win = new BaseWindow({ width: 1000, height: 700, show: false });
    this.tabs = new Map(); // tabId -> WebContentsView
    this.activeTabId = null;

    // Tab bar is itself a WebContentsView
    this.tabBar = new WebContentsView({
      webPreferences: { preload: path.join(__dirname, "tab-bar-preload.js") },
    });
    this.win.contentView.addChildView(this.tabBar);
    this.tabBar.webContents.loadFile("tab-bar.html");

    this.layoutViews();
    this.win.on("resize", () => this.layoutViews());

    // Cleanup all views on close
    this.win.on("closed", () => {
      this.tabBar.webContents.close();
      for (const view of this.tabs.values()) {
        view.webContents.close();
      }
      this.tabs.clear();
    });
  }

  addTab(tabId, url) {
    const view = new WebContentsView({
      webPreferences: { preload: path.join(__dirname, "preload.js") },
    });
    this.tabs.set(tabId, view);
    this.win.contentView.addChildView(view);
    view.webContents.loadURL(url);

    // Hide by setting zero bounds until activated
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    this.activateTab(tabId);
  }

  activateTab(tabId) {
    const { width, height } = this.win.getBounds();
    const contentHeight = height - TAB_BAR_HEIGHT;

    // Hide current active tab
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      this.tabs
        .get(this.activeTabId)
        .setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }

    // Show new active tab
    const view = this.tabs.get(tabId);
    if (view) {
      view.setBounds({ x: 0, y: TAB_BAR_HEIGHT, width, height: contentHeight });
      this.activeTabId = tabId;
    }
  }

  removeTab(tabId) {
    const view = this.tabs.get(tabId);
    if (!view) return;

    this.win.contentView.removeChildView(view);
    view.webContents.close(); // Prevent memory leak
    this.tabs.delete(tabId);

    // Activate another tab if we removed the active one
    if (this.activeTabId === tabId) {
      const nextId = this.tabs.keys().next().value;
      if (nextId) this.activateTab(nextId);
    }
  }

  layoutViews() {
    const { width, height } = this.win.getBounds();
    this.tabBar.setBounds({ x: 0, y: 0, width, height: TAB_BAR_HEIGHT });

    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      const contentHeight = height - TAB_BAR_HEIGHT;
      this.tabs.get(this.activeTabId).setBounds({
        x: 0,
        y: TAB_BAR_HEIGHT,
        width,
        height: contentHeight,
      });
    }
  }
}
```

**Why good:** Each tab is a separate WebContentsView with independent renderer, hidden tabs have zero bounds (lightweight), explicit cleanup on close and on tab removal

---

## BrowserView to WebContentsView Migration

Before/after showing the key API changes.

```javascript
// BEFORE (deprecated BrowserView)
const { BrowserView, BrowserWindow } = require("electron");

const win = new BrowserWindow({ width: 800, height: 600 });
const view = new BrowserView({
  webPreferences: { preload: path.join(__dirname, "preload.js") },
});

win.addBrowserView(view);
view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
view.setAutoResize({ width: true, height: true });
view.webContents.loadURL("https://example.com");
```

```javascript
// AFTER (WebContentsView)
const { BrowserWindow, WebContentsView } = require("electron");

const win = new BrowserWindow({ width: 800, height: 600 });
const view = new WebContentsView({
  webPreferences: { preload: path.join(__dirname, "preload.js") },
});

win.contentView.addChildView(view);
view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
// No setAutoResize -- use manual resize handler
win.on("resize", () => {
  const { width, height } = win.getBounds();
  view.setBounds({ x: 0, y: 0, width, height });
});
view.webContents.loadURL("https://example.com");

// Default background is white -- set transparent if needed
view.setBackgroundColor("#00000000");
```

**Why good:** Minimal API change, explicit resize handling replaces magic auto-resize, background color explicitly set to match previous behavior

---

## Window Lifecycle Events

The full sequence of events and where to hook into each.

```javascript
const { BrowserWindow } = require("electron");

function createManagedWindow() {
  const win = new BrowserWindow({
    show: false, // Start hidden to prevent flash
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // 1. Show after first paint (prevents white flash)
  win.once("ready-to-show", () => {
    win.show();
  });

  // 2. Intercept close -- save state, confirm unsaved changes
  win.on("close", (event) => {
    saveWindowState(win);

    if (hasUnsavedChanges(win.id)) {
      event.preventDefault();
      // Show confirmation dialog, then call win.destroy() to force close
      showSaveConfirmation(win);
    }
  });

  // 3. Cleanup after window is fully gone
  win.on("closed", () => {
    windowRegistry.delete(win.id);
  });

  win.loadFile("index.html");
  return win;
}
```

**Event order:** `close` (preventable) -> window closes -> `closed` (cleanup, non-preventable)

**BaseWindow workaround:** Since `BaseWindow` does not have a `webContents`, `ready-to-show` does not fire. Listen on the view:

```javascript
const win = new BaseWindow({ show: false, width: 800, height: 600 });
const view = new WebContentsView({
  /* ... */
});
win.contentView.addChildView(view);
view.webContents.loadFile("index.html");

// Listen on the view's webContents, not on the BaseWindow
view.webContents.once("ready-to-show", () => {
  win.show();
});
```

---

## Parent/Child and Modal Windows

```javascript
const { BrowserWindow } = require("electron");

function openSettingsWindow(parentWin) {
  const settings = new BrowserWindow({
    parent: parentWin,
    modal: true,
    show: false,
    width: 600,
    height: 500,
    // macOS: display as sheet
    // Windows/Linux: separate window with parent disabled
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  settings.once("ready-to-show", () => {
    settings.show();
  });

  settings.loadFile("settings.html");
  return settings;
}

// Non-modal child: always above parent but does not block it
function openInspectorWindow(parentWin) {
  const inspector = new BrowserWindow({
    parent: parentWin,
    width: 400,
    height: 600,
  });

  inspector.loadFile("inspector.html");
  return inspector;
}
```

**Key point:** `modal: true` requires a `parent`. On macOS, modals appear as sheets. On Windows/Linux, the parent is disabled until the modal closes.

---

## Window Registry

A Map-based registry for tracking, looking up, and messaging windows.

```javascript
const { BrowserWindow } = require("electron");

const windowRegistry = new Map();

function createTrackedWindow(id, options) {
  // Singleton pattern: focus existing window instead of creating duplicate
  const existing = windowRegistry.get(id);
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow(options);
  windowRegistry.set(id, win);

  win.on("closed", () => {
    windowRegistry.delete(id);
  });

  return win;
}

// Send message to a specific window by ID
function sendToWindow(id, channel, data) {
  const win = windowRegistry.get(id);
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data);
  }
}

// Broadcast to all windows
function broadcastToAll(channel, data) {
  for (const win of windowRegistry.values()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}
```

**Why good:** Singleton pattern prevents duplicate windows, `isDestroyed()` check avoids sending to dead windows, `closed` event keeps the registry clean

---

## Window State Persistence

Save bounds, maximized/fullscreen state, and display ID. Validate on restore.

```javascript
const { screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

function getStateFilePath(windowName) {
  return path.join(app.getPath("userData"), `window-state-${windowName}.json`);
}

function saveWindowState(win, windowName) {
  // Don't save bounds if maximized/fullscreen -- save the restored bounds instead
  if (win.isMaximized() || win.isFullScreen()) {
    const state = loadWindowState(windowName) || {};
    state.isMaximized = win.isMaximized();
    state.isFullScreen = win.isFullScreen();
    fs.writeFileSync(getStateFilePath(windowName), JSON.stringify(state));
    return;
  }

  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const state = {
    bounds,
    isMaximized: false,
    isFullScreen: false,
    displayId: display.id,
    workArea: display.workArea,
  };
  fs.writeFileSync(getStateFilePath(windowName), JSON.stringify(state));
}

function loadWindowState(windowName) {
  try {
    const raw = fs.readFileSync(getStateFilePath(windowName), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function restoreWindowState(windowName) {
  const state = loadWindowState(windowName);
  if (!state || !state.bounds) {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }

  // Validate: is the saved display still connected?
  const displays = screen.getAllDisplays();
  const targetDisplay = displays.find((d) => d.id === state.displayId);

  if (!targetDisplay) {
    // Display disconnected -- use primary display
    const primary = screen.getPrimaryDisplay();
    return {
      x: primary.workArea.x,
      y: primary.workArea.y,
      width: Math.min(state.bounds.width, primary.workArea.width),
      height: Math.min(state.bounds.height, primary.workArea.height),
    };
  }

  // Validate: are saved bounds within the display's work area?
  const { workArea } = targetDisplay;
  const x = Math.max(
    workArea.x,
    Math.min(state.bounds.x, workArea.x + workArea.width - state.bounds.width),
  );
  const y = Math.max(
    workArea.y,
    Math.min(
      state.bounds.y,
      workArea.y + workArea.height - state.bounds.height,
    ),
  );

  return {
    x,
    y,
    width: Math.min(state.bounds.width, workArea.width),
    height: Math.min(state.bounds.height, workArea.height),
    isMaximized: state.isMaximized,
    isFullScreen: state.isFullScreen,
  };
}

// Usage in window creation
function createWindowWithState(windowName) {
  const restored = restoreWindowState(windowName);
  const win = new BrowserWindow({
    ...restored,
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });

  if (restored.isMaximized) win.maximize();
  if (restored.isFullScreen) win.setFullScreen(true);

  win.on("close", () => saveWindowState(win, windowName));
  win.once("ready-to-show", () => win.show());

  return win;
}
```

**Why good:** Validates saved display still exists, clamps bounds to work area (not display bounds -- avoids taskbar), saves on close, falls back to primary display

---

## Multi-Monitor Placement

```javascript
const { screen, BrowserWindow } = require("electron");

// Find a specific display
function getExternalDisplay() {
  const displays = screen.getAllDisplays();
  return displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0);
}

// Create window centered on a specific display's work area
function createWindowOnDisplay(display) {
  const { workArea } = display;
  const WIDTH = 800;
  const HEIGHT = 600;

  return new BrowserWindow({
    x: workArea.x + Math.floor((workArea.width - WIDTH) / 2),
    y: workArea.y + Math.floor((workArea.height - HEIGHT) / 2),
    width: WIDTH,
    height: HEIGHT,
  });
}

// React to display changes
screen.on("display-added", (event, newDisplay) => {
  // A new monitor was connected
});

screen.on("display-removed", (event, oldDisplay) => {
  // A monitor was disconnected -- move any windows on it to primary
  const primary = screen.getPrimaryDisplay();
  for (const win of BrowserWindow.getAllWindows()) {
    const winBounds = win.getBounds();
    const winDisplay = screen.getDisplayMatching(winBounds);
    if (winDisplay.id === oldDisplay.id) {
      win.setBounds({
        x: primary.workArea.x,
        y: primary.workArea.y,
        width: winBounds.width,
        height: winBounds.height,
      });
    }
  }
});
```

**Why good:** Uses `workArea` (excludes taskbar/dock), centers window properly, handles display disconnect by relocating affected windows

---

## BaseWindow Cleanup Pattern

Critical pattern to prevent memory leaks with BaseWindow.

```javascript
function createBaseWindowWithViews() {
  const win = new BaseWindow({ width: 1000, height: 700 });
  const views = [];

  function addView(url) {
    const view = new WebContentsView({
      webPreferences: { preload: path.join(__dirname, "preload.js") },
    });
    win.contentView.addChildView(view);
    view.webContents.loadURL(url);
    views.push(view);
    return view;
  }

  // CRITICAL: clean up ALL views when window closes
  win.on("closed", () => {
    for (const view of views) {
      if (!view.webContents.isDestroyed()) {
        view.webContents.close();
      }
    }
    views.length = 0;
  });

  return { win, addView };
}
```

**Why good:** Tracks all views, checks `isDestroyed()` before closing (avoids double-close errors), clears the array to release references

```javascript
// BAD: forgetting to close webContents
win.on("closed", () => {
  // views still hold live webContents -- MEMORY LEAK
  windowRegistry.delete(win.id);
});
```

**Why bad:** BaseWindow does not auto-destroy webContents on close. Each orphaned webContents keeps its renderer process alive, consuming memory indefinitely.

---

See [inter-window-communication.md](inter-window-communication.md) for MessagePort and main process relay patterns.
