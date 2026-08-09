# Electron Desktop UI - Window State Persistence

> Save and restore window position, size, and maximized state across app restarts. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for other UI patterns.

---

## Custom Window State Persistence

Persist window bounds to a JSON file in the user data directory. Validate against current displays on restore to avoid placing the window off-screen.

```javascript
// window-state.js
const { screen } = require("electron/main");
const { app } = require("electron/main");
const fs = require("node:fs");
const path = require("node:path");

const WINDOW_STATE_FILE = "window-state.json";
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const MIN_VISIBLE_OVERLAP = 100; // px of window that must be on-screen

function getStatePath() {
  return path.join(app.getPath("userData"), WINDOW_STATE_FILE);
}

function loadWindowState() {
  try {
    const data = fs.readFileSync(getStatePath(), "utf-8");
    const state = JSON.parse(data);

    // Validate saved bounds are still on a visible display
    if (state.x !== undefined && state.y !== undefined) {
      const visible = isPositionOnScreen(
        state.x,
        state.y,
        state.width,
        state.height,
      );
      if (!visible) {
        // Display configuration changed -- use defaults but keep size
        return {
          width: state.width,
          height: state.height,
          isMaximized: state.isMaximized,
        };
      }
    }

    return state;
  } catch {
    return null;
  }
}

function isPositionOnScreen(x, y, width, height) {
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
    // Check that at least MIN_VISIBLE_OVERLAP px of the window overlaps a display
    const overlapX = Math.max(
      0,
      Math.min(x + width, dx + dw) - Math.max(x, dx),
    );
    const overlapY = Math.max(
      0,
      Math.min(y + height, dy + dh) - Math.max(y, dy),
    );
    return overlapX >= MIN_VISIBLE_OVERLAP && overlapY >= MIN_VISIBLE_OVERLAP;
  });
}

function saveWindowState(win) {
  // Do not save bounds while maximized -- save the pre-maximized bounds
  if (win.isMaximized() || win.isMinimized() || win.isFullScreen()) {
    // Only update the maximized/fullscreen flag
    try {
      const existing = JSON.parse(fs.readFileSync(getStatePath(), "utf-8"));
      existing.isMaximized = win.isMaximized();
      existing.isFullScreen = win.isFullScreen();
      fs.writeFileSync(getStatePath(), JSON.stringify(existing, null, 2));
    } catch {
      // No existing state -- skip
    }
    return;
  }

  const bounds = win.getBounds();
  const state = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: false,
    isFullScreen: false,
  };

  fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
}

function createWindowWithState(options) {
  const savedState = loadWindowState();

  const windowOptions = {
    width: savedState?.width ?? DEFAULT_WIDTH,
    height: savedState?.height ?? DEFAULT_HEIGHT,
    ...options,
  };

  if (savedState?.x !== undefined && savedState?.y !== undefined) {
    windowOptions.x = savedState.x;
    windowOptions.y = savedState.y;
  }

  const { BrowserWindow } = require("electron/main");
  const win = new BrowserWindow(windowOptions);

  // Restore maximized state after window creation
  if (savedState?.isMaximized) {
    win.maximize();
  }
  if (savedState?.isFullScreen) {
    win.setFullScreen(true);
  }

  // Save state on close (NOT 'closed' -- window is already destroyed)
  win.on("close", () => {
    saveWindowState(win);
  });

  return win;
}

module.exports = { createWindowWithState };
```

**Why good:** Validates saved position against current displays (handles monitor disconnection/rearrangement). Saves on `close` event (not `closed` -- window is destroyed by then). Skips saving bounds when maximized (preserves the pre-maximized position). Named constants for defaults and overlap threshold.

---

## Usage in Main Process

```javascript
// main.js
const { app } = require("electron/main");
const path = require("node:path");
const { createWindowWithState } = require("./window-state.js");

app.whenReady().then(() => {
  const mainWindow = createWindowWithState({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: "hidden",
  });

  mainWindow.loadFile("index.html");
});
```

---

## Using electron-window-state Library

For projects that prefer a library over custom code, `electron-window-state` handles persistence with less boilerplate. It uses `jsonfile` internally and supports multi-window state.

```javascript
// main.js
const windowStateKeeper = require("electron-window-state");

function createWindow() {
  const state = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  });

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Attach listeners that save state on move/resize
  state.manage(win);

  win.loadFile("index.html");
}
```

**Key point:** `state.manage(win)` attaches `move`, `resize`, and `close` listeners automatically. Call it after creating the window. For multi-window apps, pass a unique `file` option to each instance:

```javascript
const editorState = windowStateKeeper({
  defaultWidth: 800,
  file: "editor-window-state.json",
});
const previewState = windowStateKeeper({
  defaultWidth: 600,
  file: "preview-window-state.json",
});
```

---

## Native Window State Persistence (Future)

Electron has an active RFC for built-in window state persistence (`windowStatePersistence` constructor option). When released, it will replace both custom implementations and the `electron-window-state` library:

```javascript
// Proposed API (not yet in stable Electron)
const win = new BrowserWindow({
  name: "main-window", // unique identifier for state persistence
  windowStatePersistence: {
    bounds: true, // save position and size
    displayMode: true, // save maximized/fullscreen state
  },
});
```

**Status:** Active RFC, reference implementation in progress (GSoC 2025). Not yet available in any stable Electron release. Use the custom or library approach above until this ships.

---

See [core.md](core.md) for other UI patterns. See [SKILL.md](../SKILL.md) for decision frameworks.
