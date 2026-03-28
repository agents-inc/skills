---
name: desktop-framework-electron
description: Electron process architecture, IPC patterns, preload security, native APIs, packaging and distribution
---

# Electron Desktop Applications

> **Quick Guide:** Electron apps run two process types: a **main process** (Node.js, manages windows and system APIs) and **renderer processes** (Chromium, one per window). All communication between them flows through IPC via a preload script that uses `contextBridge` to expose a minimal, typed API surface. Never disable `contextIsolation`. Never enable `nodeIntegration` in renderers. Package with Electron Forge or Electron Builder. Auto-update via `autoUpdater` (Squirrel on macOS/Windows) or `electron-updater` for all platforms.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST keep `contextIsolation: true` (the default) -- disabling it exposes the entire preload scope to untrusted renderer code)**

**(You MUST use `contextBridge.exposeInMainWorld()` in preload scripts -- never expose `ipcRenderer` directly)**

**(You MUST NOT enable `nodeIntegration: true` in any BrowserWindow -- it gives renderers full Node.js access, which is a critical security vulnerability)**

**(You MUST validate and sanitize ALL data received via IPC in the main process -- treat renderer messages as untrusted input)**

**(You MUST use `ipcMain.handle()` / `ipcRenderer.invoke()` for request-response IPC -- avoid `sendSync` which blocks the renderer)**

**(You MUST NOT load remote URLs with `nodeIntegration` or disabled `contextIsolation` -- this is equivalent to giving the remote site full system access)**

</critical_requirements>

---

**Auto-detection:** Electron, electron, BrowserWindow, ipcMain, ipcRenderer, contextBridge, preload, webPreferences, electron-builder, electron-forge, app.whenReady, electronAPI, mainWindow, autoUpdater, nativeTheme, safeStorage, Tray, Menu, dialog, protocol, shell

**When to use:**

- Building cross-platform desktop applications
- Configuring main process / renderer process architecture
- Setting up secure IPC communication patterns
- Integrating with native OS features (tray, menus, dialogs, notifications, file system)
- Packaging and distributing desktop applications
- Implementing auto-update functionality
- Registering custom protocol handlers / deep links

**When NOT to use:**

- Choosing a UI framework for the renderer (use the appropriate web framework skill)
- Styling the renderer UI (use the appropriate styling skill)
- Server-side or backend logic not related to the main process
- Mobile applications (Electron is desktop-only)
- CLI tools that do not need a GUI

---

<patterns>

## Key Patterns

### Pattern 1: Secure BrowserWindow Creation

Every BrowserWindow must use a preload script and rely on the secure defaults: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.

```javascript
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    // contextIsolation: true  -- default since Electron 12
    // sandbox: true           -- default since Electron 20
    // nodeIntegration: false  -- default since Electron 5
  },
});
```

**Key point:** Never override the security defaults. The preload script is the ONLY bridge between main and renderer. See [examples/core.md](examples/core.md).

---

### Pattern 2: Preload with contextBridge

The preload script exposes a narrow, explicitly typed API to the renderer. Never expose `ipcRenderer` directly.

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (_event, data) => callback(data));
  },
});
```

**Key point:** Each exposed method wraps a single IPC channel. The renderer calls `window.electronAPI.readFile(path)` with no knowledge of IPC internals. See [examples/core.md](examples/core.md).

---

### Pattern 3: IPC Request-Response (invoke/handle)

Use `ipcMain.handle()` in main and `ipcRenderer.invoke()` in preload for async two-way communication.

```javascript
// main process
ipcMain.handle("read-file", async (_event, filePath) => {
  const content = await fs.readFile(filePath, "utf-8");
  return { success: true, content };
});
```

**Key point:** `handle`/`invoke` returns a Promise. Always validate `filePath` in the handler -- never trust renderer input. See [examples/ipc.md](examples/ipc.md) for all IPC patterns.

---

### Pattern 4: Main-to-Renderer Messages

Use `webContents.send()` from main and listen in the preload with a callback pattern.

```javascript
// main: send to specific window
mainWindow.webContents.send("update-progress", { percent: 45 });

// preload: expose listener
onUpdateProgress: (callback) => {
  ipcRenderer.on("update-progress", (_event, data) => callback(data));
},
```

**Key point:** The renderer cannot pull from main -- main must push. Always scope listeners to specific channels. See [examples/ipc.md](examples/ipc.md).

---

### Pattern 5: App Lifecycle

The main process manages the app lifecycle with platform-specific conventions.

```javascript
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

**Key point:** macOS apps stay alive when all windows close (`window-all-closed` should not quit). The `activate` event recreates a window when the dock icon is clicked. See [examples/core.md](examples/core.md).

---

### Pattern 6: Native OS Integration

Electron exposes native APIs for dialogs, menus, tray icons, notifications, and more -- all accessed from the main process.

```javascript
const { dialog } = require("electron");

const result = await dialog.showOpenDialog(mainWindow, {
  properties: ["openFile", "multiSelections"],
  filters: [{ name: "Documents", extensions: ["txt", "md", "json"] }],
});
```

**Key point:** Native dialogs are modal to a window when passed `mainWindow` as the first argument. See [examples/native-apis.md](examples/native-apis.md).

---

### Pattern 7: Custom Protocol / Deep Linking

Register your app to handle `myapp://` URLs for deep linking from browsers or other apps.

```javascript
if (process.defaultApp) {
  app.setAsDefaultProtocolClient("myapp", process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient("myapp");
}
```

**Key point:** In development (`process.defaultApp` is true), you must pass the script path as an argument. On macOS, handle the `open-url` event on the `app` object. On Windows/Linux, handle via `second-instance` event. See [examples/native-apis.md](examples/native-apis.md).

</patterns>

---

<decision_framework>

## Decision Framework

### IPC Pattern Selection

```
Which IPC pattern?
+-- Renderer needs a response from main?
|   +-- YES --> ipcMain.handle() + ipcRenderer.invoke()
+-- Renderer sends data, no response needed?
|   +-- YES --> ipcMain.on() + ipcRenderer.send()
+-- Main needs to push data to renderer?
|   +-- YES --> webContents.send() + ipcRenderer.on() (in preload)
+-- Two renderers need to communicate?
|   +-- YES --> Route through main process (never direct renderer-to-renderer)
+-- High-frequency data transfer (streaming)?
    +-- YES --> MessageChannelMain / MessagePort pair
```

### Window Architecture

```
How many windows?
+-- Single window app?
|   +-- One BrowserWindow, one preload script
+-- Multi-window (e.g., preferences, about)?
|   +-- Separate BrowserWindow per view, each with its own preload
+-- Frameless / custom title bar?
|   +-- frame: false + custom drag regions via CSS (-webkit-app-region: drag)
+-- Persistent background work?
    +-- Use a hidden BrowserWindow or utilityProcess (Electron 22+)
```

</decision_framework>

---

**Detailed resources:**

- [examples/core.md](examples/core.md) - App lifecycle, BrowserWindow, preload, contextBridge fundamentals
- [examples/ipc.md](examples/ipc.md) - All IPC patterns: invoke/handle, send/on, main-to-renderer, MessagePort
- [examples/security.md](examples/security.md) - Security hardening, CSP, permission handlers, safe defaults
- [examples/native-apis.md](examples/native-apis.md) - Dialogs, menus, tray, notifications, protocol handlers, auto-updater
- [examples/packaging.md](examples/packaging.md) - Electron Forge, Electron Builder, code signing, distribution
- [reference.md](reference.md) - API quick-reference tables, version history, security checklist

---

<red_flags>

## RED FLAGS

**Critical Security Issues:**

- Disabling `contextIsolation` (`contextIsolation: false`) -- exposes preload globals to renderer
- Enabling `nodeIntegration: true` -- gives renderer full Node.js access (fs, child_process, etc.)
- Exposing `ipcRenderer` directly via `contextBridge` instead of wrapping individual channels
- Loading remote/untrusted URLs without `sandbox: true`
- Disabling `webSecurity` in production (`webSecurity: false` disables same-origin policy)
- Not validating IPC arguments in main process handlers (path traversal, injection attacks)
- Using `shell.openExternal()` with unvalidated URLs (can execute arbitrary commands)

**Architecture Issues:**

- Using `ipcRenderer.sendSync()` -- blocks the renderer process, causes UI freezes
- Putting business logic in the renderer instead of the main process
- Direct renderer-to-renderer communication (bypassing main)
- Using `remote` module (removed in Electron 14+, was a security and performance hazard)
- Creating BrowserWindows from the renderer process
- Not handling `window-all-closed` per-platform (macOS apps should not quit)

**Packaging Issues:**

- Shipping `devDependencies` in production builds (bloated app size)
- Not code-signing the application (OS warnings, auto-update failures on macOS)
- Bundling `node_modules` without pruning or using ASAR archive
- Hardcoding absolute paths that differ between dev and packaged environments
- Using `__dirname` in renderer code (unavailable in sandboxed renderers)

**Common Mistakes:**

- Forgetting `app.whenReady()` -- APIs are unavailable before the `ready` event
- Not re-creating window on `activate` event (macOS dock click does nothing)
- Using `require()` in renderer scripts loaded via `<script>` tags (not available in sandboxed renderers)
- Setting `nodeIntegrationInSubFrames: true` for iframes loading external content
- Not setting proper `Content-Security-Policy` headers for renderer HTML

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST keep `contextIsolation: true` (the default) -- disabling it exposes the entire preload scope to untrusted renderer code)**

**(You MUST use `contextBridge.exposeInMainWorld()` in preload scripts -- never expose `ipcRenderer` directly)**

**(You MUST NOT enable `nodeIntegration: true` in any BrowserWindow -- it gives renderers full Node.js access, which is a critical security vulnerability)**

**(You MUST validate and sanitize ALL data received via IPC in the main process -- treat renderer messages as untrusted input)**

**(You MUST use `ipcMain.handle()` / `ipcRenderer.invoke()` for request-response IPC -- avoid `sendSync` which blocks the renderer)**

**Failure to follow these rules will create severe security vulnerabilities or broken desktop applications.**

</critical_reminders>
