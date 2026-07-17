# Electron Desktop UI - Core Patterns

> Custom title bars, drag regions, menus, tray, badges, transparent windows, splash screens, kiosk mode. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [window-state.md](window-state.md) for window state persistence.

---

## Custom Title Bar with Hidden Title Bar Style

```javascript
// main.js
const { app, BrowserWindow } = require("electron/main");
const path = require("node:path");

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const TITLE_BAR_HEIGHT = 40;
const TRAFFIC_LIGHT_X = 16;
const TRAFFIC_LIGHT_Y = 12;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    titleBarStyle: "hidden",
    // Windows/Linux: native window controls overlaid on content
    titleBarOverlay: {
      color: "#2f3241",
      symbolColor: "#74b1be",
      height: TITLE_BAR_HEIGHT,
    },
    // macOS: reposition traffic lights within custom title bar
    trafficLightPosition: { x: TRAFFIC_LIGHT_X, y: TRAFFIC_LIGHT_Y },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("index.html");
}
```

**Why good:** `titleBarStyle: 'hidden'` keeps macOS traffic lights while removing the title. `titleBarOverlay` provides native window controls on Windows/Linux. Named constants for all dimensions.

```javascript
// BAD: frame: false with no replacement controls
const mainWindow = new BrowserWindow({
  frame: false, // Removes ALL window controls -- user cannot close/minimize/maximize
});
```

**Why bad:** Users have no way to close, minimize, or maximize the window without custom HTML controls that you must implement yourself. Use `titleBarStyle: 'hidden'` instead to keep native controls.

---

## Custom Title Bar HTML + CSS

```html
<!-- index.html -->
<div class="title-bar">
  <div class="title-bar-text">My App</div>
  <div class="title-bar-actions">
    <button class="title-bar-btn" id="btn-settings">Settings</button>
  </div>
</div>
<div class="content">
  <!-- App content below the title bar -->
</div>
```

```css
/* styles.css */
.title-bar {
  app-region: drag;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px;
  background: #2f3241;
  color: #fff;
}

/* macOS: leave space for traffic lights */
@media screen and (-webkit-min-device-pixel-ratio: 0) {
  :root[data-platform="darwin"] .title-bar {
    padding-left: 80px; /* Space for traffic lights */
  }
}

/* CRITICAL: interactive elements MUST opt out of drag */
.title-bar button,
.title-bar input,
.title-bar a,
.title-bar select {
  app-region: no-drag;
}

.content {
  /* Push content below the title bar */
  margin-top: 40px;
}
```

**Why good:** `app-region: drag` makes the title bar draggable. `user-select: none` prevents text selection during drag. All interactive elements explicitly opt out with `app-region: no-drag`. macOS padding leaves room for traffic lights.

```css
/* BAD: missing no-drag on interactive elements */
.title-bar {
  app-region: drag;
}
/* Buttons inside .title-bar are unclickable -- drag swallows all pointer events */
```

**Why bad:** Without `app-region: no-drag`, buttons, links, and inputs inside the drag region receive no pointer events (no clicks, no hover, no cursor changes). This is the most common custom title bar bug.

---

## macOS Title Bar Variants

```javascript
// hiddenInset: traffic lights shifted slightly inward (macOS only)
const win = new BrowserWindow({
  titleBarStyle: "hiddenInset",
});

// customButtonsOnHover: traffic lights hidden until mouse hovers (macOS only)
const win = new BrowserWindow({
  titleBarStyle: "customButtonsOnHover",
});

// Custom traffic light position (macOS only, requires hidden or hiddenInset)
const TRAFFIC_LIGHT_POSITION = { x: 20, y: 18 };
const win = new BrowserWindow({
  titleBarStyle: "hidden",
  trafficLightPosition: TRAFFIC_LIGHT_POSITION,
});
```

**Platform note:** `hiddenInset` and `customButtonsOnHover` are macOS-only. On Windows and Linux, both behave identically to `hidden`.

---

## Application Menu

```javascript
// main.js
const { Menu, app } = require("electron/main");

function createMenu(mainWindow) {
  const template = [
    // macOS: first item is always the app name menu
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow.webContents.send("menu:new"),
        },
        {
          label: "Open",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow.webContents.send("menu:open"),
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow.webContents.send("menu:save"),
        },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
```

**Why good:** Uses `role` properties for standard actions (Electron handles platform labels/shortcuts automatically). macOS app name menu conditionally included as first item. `CmdOrCtrl` adapts to platform.

---

## Context Menu

```javascript
// main.js
const { Menu, BrowserWindow, ipcMain } = require("electron/main");

ipcMain.on("show-context-menu", (event, menuItems) => {
  const template = [
    { label: "Cut", role: "cut" },
    { label: "Copy", role: "copy" },
    { label: "Paste", role: "paste" },
    { type: "separator" },
    {
      label: "Inspect Element",
      click: () => event.sender.inspectElement(0, 0),
      visible: process.defaultApp, // dev only
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
});
```

```javascript
// preload.js
contextBridge.exposeInMainWorld("electronAPI", {
  showContextMenu: () => ipcRenderer.send("show-context-menu"),
});
```

```javascript
// renderer.js
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.electronAPI.showContextMenu();
});
```

**Key point:** `menu.popup()` displays at the cursor position by default. Pass `{ window }` to scope the menu to the correct BrowserWindow.

---

## System Tray with Context Menu and Balloon

```javascript
// main.js
const { Tray, Menu, nativeImage, app } = require("electron/main");
const path = require("node:path");

let tray = null; // MUST keep reference -- GC destroys the icon silently

function createTray(mainWindow) {
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath);

  // macOS: tray icons must be 16x16 template images for dark/light mode
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip(app.name);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: "separator" },
    {
      label: "Status",
      enabled: false, // greyed-out informational item
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);

  // Windows/Linux: left-click shows the window
  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}
```

**Why good:** Module-level `tray` variable prevents garbage collection. Template image for macOS dark/light mode. Separate click handler for Windows/Linux (macOS shows context menu on any click when one is set).

```javascript
// BAD: tray created as local variable
function createTray() {
  const tray = new Tray(icon); // Local variable -- GC will destroy this
  tray.setContextMenu(menu);
  // tray icon disappears after a few seconds with no error
}
```

**Why bad:** When `tray` is a local variable, it becomes eligible for garbage collection after the function returns. The tray icon silently disappears -- no error, no warning.

---

## Updating Tray Menu Dynamically

```javascript
function updateTrayMenu(tray, mainWindow, status) {
  const contextMenu = Menu.buildFromTemplate([
    { label: `Status: ${status}`, enabled: false },
    { type: "separator" },
    {
      label: "Show",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
}
```

**Key point:** Tray menus are not mutable -- rebuild the entire menu with `Menu.buildFromTemplate()` and call `tray.setContextMenu()` again. There is no way to update individual menu items in place.

---

## Windows Tray Balloon Notification

```javascript
// Windows only -- balloon notifications from tray icon
tray.displayBalloon({
  iconType: "info", // 'none' | 'info' | 'warning' | 'error'
  title: "Update Available",
  content: "A new version is ready to install.",
  largeIcon: false,
  noSound: false,
  respectQuietTime: true,
});

tray.on("balloon-click", () => {
  mainWindow.show();
  mainWindow.focus();
});

tray.on("balloon-closed", () => {
  // Balloon was dismissed
});
```

**Platform note:** `displayBalloon()` is Windows-only. On macOS and Linux, use the `Notification` API from the main process instead.

---

## Dock and Taskbar Badges

```javascript
// main.js
const { app, ipcMain } = require("electron/main");

ipcMain.handle("set-badge", (_event, count) => {
  // macOS + Linux (Unity launcher only)
  const success = app.setBadgeCount(count);
  return success;
});

ipcMain.handle("set-badge-text", (_event, text) => {
  // macOS only -- text badge on dock icon
  if (process.platform === "darwin") {
    app.dock.setBadge(text);
  }
});

ipcMain.handle("clear-badge", () => {
  app.setBadgeCount(0);
  if (process.platform === "darwin") {
    app.dock.setBadge("");
  }
});
```

**Platform support:**

| Method                    | macOS                      | Linux               | Windows       |
| ------------------------- | -------------------------- | ------------------- | ------------- |
| `app.setBadgeCount(n)`    | Numeric badge on dock icon | Unity launcher only | Not supported |
| `app.dock.setBadge(text)` | Text badge on dock icon    | N/A                 | N/A           |

**Gotchas:** `setBadgeCount()` requires notification permissions on macOS. On Linux, requires a `.desktop` launcher file and Unity desktop environment.

---

## Splash Screen

```javascript
// main.js
function createSplashAndMain() {
  const SPLASH_WIDTH = 400;
  const SPLASH_HEIGHT = 300;

  const splash = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true, // Don't show in taskbar
    resizable: false,
    center: true,
  });

  splash.loadFile("splash.html");

  const mainWindow = new BrowserWindow({
    show: false, // Hidden until ready
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("index.html");

  // Close splash and show main window when content is rendered
  mainWindow.once("ready-to-show", () => {
    splash.destroy();
    mainWindow.show();
  });

  return mainWindow;
}
```

**Why good:** Main window starts hidden (`show: false`). Splash is frameless, always-on-top, transparent, and skips the taskbar. `ready-to-show` fires when the renderer has painted at least once, avoiding a white flash.

---

## Always-On-Top with Levels

```javascript
// Normal always-on-top (above regular windows, below taskbar)
mainWindow.setAlwaysOnTop(true, "floating");

// Above macOS fullscreen apps (use sparingly)
mainWindow.setAlwaysOnTop(true, "screen-saver");

// Disable always-on-top
mainWindow.setAlwaysOnTop(false);

// Toggle via IPC
ipcMain.handle("toggle-always-on-top", () => {
  const isOnTop = mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(!isOnTop, "floating");
  return !isOnTop;
});
```

**Available levels (low to high):** `normal`, `floating`, `torn-off-menu`, `modal-panel`, `main-menu`, `status`, `pop-up-menu`, `screen-saver`

**Key point:** `floating` is the default level when flag is true. Levels from `floating` to `status` appear below the Dock (macOS) and taskbar (Windows). Higher levels appear above them.

---

## Transparent Window

```javascript
// Fully transparent window (for overlays, widgets, HUDs)
const overlay = new BrowserWindow({
  transparent: true,
  frame: false,
  hasShadow: false,
  backgroundColor: "#00000000",
});

// Click-through (mouse events pass to windows below)
overlay.setIgnoreMouseEvents(true);

// Selective click-through (forward mouse move, block clicks)
overlay.setIgnoreMouseEvents(true, { forward: true });
```

**Key point:** `transparent: true` requires `frame: false` on Windows. Set `backgroundColor: '#00000000'` explicitly. Use `hasShadow: false` to remove the window shadow that appears even on transparent windows.

---

## macOS Vibrancy

```javascript
// macOS frosted glass effect
const win = new BrowserWindow({
  vibrancy: "sidebar",
  visualEffectState: "active", // 'followWindow' (default) | 'active' | 'inactive'
  backgroundColor: "#00000000",
});

// Change vibrancy at runtime
win.setVibrancy("under-window");

// Remove vibrancy
win.setVibrancy(null);
```

**Common vibrancy values:**

| Value          | Use Case                   |
| -------------- | -------------------------- |
| `sidebar`      | App sidebars (most common) |
| `under-window` | Entire window background   |
| `content`      | Content area background    |
| `header`       | Header/toolbar area        |
| `titlebar`     | Title bar area             |
| `tooltip`      | Tooltip background         |
| `menu`         | Menu background            |
| `popover`      | Popover background         |
| `sheet`        | Sheet/dialog background    |

**Note:** Values like `appearance-based` are deprecated. Prefer `sidebar` or `under-window`.

---

## Windows 11 Mica / Acrylic

```javascript
// Mica: subtle, long-lived window material
const win = new BrowserWindow({
  backgroundMaterial: "mica",
  backgroundColor: "#00000000", // NOT transparent: true
});

// Acrylic: translucent, for transient surfaces (tooltips, menus)
const win = new BrowserWindow({
  backgroundMaterial: "acrylic",
  backgroundColor: "#00000000",
});

// Tabbed: tab-row material for tabbed interfaces
const win = new BrowserWindow({
  backgroundMaterial: "tabbed",
  backgroundColor: "#00000000",
});

// Change at runtime
win.setBackgroundMaterial("acrylic");
```

**Key point:** Requires Windows 11 version 22H2 or later -- silently does nothing on older versions. Set `backgroundColor: '#00000000'` to clear Electron's composition buffer and reveal the DWM-painted material underneath. Do NOT use `transparent: true` -- it enables layered window mode which breaks the material effect.

---

## Kiosk Mode

```javascript
// Enter kiosk mode (fullscreen, no window controls, no OS exit shortcuts)
const kiosk = new BrowserWindow({
  kiosk: true,
});

// Toggle kiosk at runtime
ipcMain.handle("toggle-kiosk", () => {
  const isKiosk = kiosk.isKiosk();
  kiosk.setKiosk(!isKiosk);
  return !isKiosk;
});
```

**Key point:** Kiosk mode disables Alt+F4 (Windows), Cmd+Q (macOS), and all standard OS exit shortcuts. You MUST provide an in-app exit mechanism:

```javascript
// Escape hatch: hidden keyboard shortcut or admin button
ipcMain.on("exit-kiosk", () => {
  kiosk.setKiosk(false);
  // Or: app.quit();
});
```

**Use cases:** Digital signage, POS terminals, interactive displays, exam environments.

---

See [window-state.md](window-state.md) for window state persistence. See [SKILL.md](../SKILL.md) for decision frameworks and red flags.
