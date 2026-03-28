# Electron - Core Patterns

> App lifecycle, BrowserWindow creation, preload scripts, contextBridge fundamentals. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [ipc.md](ipc.md) for advanced IPC patterns.

---

## App Lifecycle and Window Creation

```javascript
// main.js
const { app, BrowserWindow } = require("electron/main");
const path = require("node:path");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // Security defaults -- do NOT override these:
      // contextIsolation: true   (Electron 12+)
      // sandbox: true            (Electron 20+)
      // nodeIntegration: false   (Electron 5+)
    },
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  // macOS: re-create window when dock icon is clicked and no windows exist
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Windows/Linux: quit when all windows are closed
// macOS: app stays alive (standard behavior)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

**Why good:** Uses secure defaults, handles platform-specific lifecycle correctly, preload attached via absolute path

---

## Preload Script with contextBridge

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
  // Request-response: renderer asks, main answers
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  saveFile: (filePath, content) =>
    ipcRenderer.invoke("save-file", filePath, content),

  // Main-to-renderer: main pushes, renderer listens
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },

  // Cleanup: remove listeners to prevent memory leaks
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners("update-available");
  },
});
```

**Why good:** Exposes a narrow, explicitly named API surface. Each method wraps exactly one IPC channel. The renderer calls `window.electronAPI.readFile(path)` with zero knowledge of IPC internals. Includes cleanup method for event listeners.

```javascript
// BAD: exposing ipcRenderer directly
contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => ipcRenderer.on(channel, callback),
});
```

**Why bad:** The renderer can send messages to ANY IPC channel, including ones you never intended to expose. A critical security vulnerability -- an XSS attack could invoke arbitrary main process handlers.

---

## Main Process IPC Handlers

```javascript
// main.js (add after app.whenReady)
const { ipcMain } = require("electron/main");
const fs = require("node:fs/promises");
const path = require("node:path");

app.whenReady().then(() => {
  // Register handlers BEFORE creating windows
  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });

  ipcMain.handle("read-file", async (_event, filePath) => {
    // ALWAYS validate paths received from renderer
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(app.getPath("userData"))) {
      throw new Error("Access denied: path outside user data directory");
    }
    return fs.readFile(resolved, "utf-8");
  });

  createWindow();
});
```

**Why good:** Handlers registered before windows are created (prevents race conditions). File paths validated against an allowed base directory to prevent path traversal attacks.

---

## TypeScript Preload with Type Declarations

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from "electron/renderer";

const electronAPI = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke("read-file", filePath),
  saveFile: (
    filePath: string,
    content: string,
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("save-file", filePath, content),
  onUpdateAvailable: (callback: (info: { version: string }) => void): void => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },
  removeUpdateListener: (): void => {
    ipcRenderer.removeAllListeners("update-available");
  },
} as const;

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
```

```typescript
// src/global.d.ts (include in renderer tsconfig)
import type { ElectronAPI } from "../preload";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

**Why good:** Full type safety across the IPC boundary. The renderer gets autocompletion and type checking for `window.electronAPI.*` calls.

---

## Single Instance Lock

```javascript
// main.js -- prevent multiple app instances
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    // On Windows/Linux, deep link URLs arrive via argv
    const deepLinkUrl = argv.find((arg) => arg.startsWith("myapp://"));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  });

  app.whenReady().then(createWindow);
}
```

**Why good:** Prevents duplicate instances. On Windows/Linux, `second-instance` is also how deep link URLs arrive when the app is already running.

---

## Dev vs Production URL Loading

```javascript
const MAIN_WINDOW_DEV_URL = "http://localhost:5173";
const MAIN_WINDOW_PROD_FILE = "index.html";

function createWindow() {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (process.defaultApp) {
    mainWindow.loadURL(MAIN_WINDOW_DEV_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(MAIN_WINDOW_PROD_FILE);
  }
}
```

**Why good:** `process.defaultApp` is `true` when running via `electron .` during development, `undefined` in packaged builds. More reliable than checking `NODE_ENV`. DevTools only open in development.

---

See [ipc.md](ipc.md) for advanced IPC patterns. See [security.md](security.md) for CSP and permission handlers.
