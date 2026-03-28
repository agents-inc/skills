# Electron - Native APIs

> Dialogs, menus, tray, notifications, protocol handlers, auto-updater. See [SKILL.md](../SKILL.md) for architecture decisions. See [ipc.md](ipc.md) for exposing these APIs to the renderer via IPC.

---

## Native Dialogs

```javascript
// main.js
const { dialog, ipcMain } = require("electron/main");

ipcMain.handle("dialog:openFile", async (_event, options) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: options?.title ?? "Open File",
    properties: ["openFile"],
    filters: options?.filters ?? [{ name: "All Files", extensions: ["*"] }],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle("dialog:saveFile", async (_event, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: options?.title ?? "Save File",
    defaultPath: options?.defaultName,
    filters: options?.filters ?? [],
  });
  return canceled ? null : filePath;
});

ipcMain.handle("dialog:confirm", async (_event, message, title) => {
  const { response } = await dialog.showMessageBox({
    type: "question",
    buttons: ["Cancel", "OK"],
    defaultId: 1,
    cancelId: 0,
    title: title ?? "Confirm",
    message,
  });
  return response === 1; // true if OK clicked
});
```

**Key point:** Pass `mainWindow` as the first argument to `showOpenDialog(mainWindow, options)` to make the dialog modal to that window (sheet on macOS). Without it, the dialog is app-modal.

---

## Application Menu

```javascript
// main.js
const { Menu, app } = require("electron/main");

const APP_NAME = app.name;

function createMenu(mainWindow) {
  const template = [
    // macOS app menu (first item is always the app name menu)
    ...(process.platform === "darwin"
      ? [
          {
            label: APP_NAME,
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
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
```

**Key point:** On macOS, the first menu item is always the app name menu -- include it conditionally via `process.platform`. Use built-in `role` properties for standard actions (undo, copy, quit) -- Electron handles platform-specific labels and keyboard shortcuts automatically.

---

## Context Menu

```javascript
// main.js
const { Menu, ipcMain } = require("electron/main");

ipcMain.on("show-context-menu", (event) => {
  const template = [
    {
      label: "Cut",
      role: "cut",
    },
    {
      label: "Copy",
      role: "copy",
    },
    {
      label: "Paste",
      role: "paste",
    },
    { type: "separator" },
    {
      label: "Inspect Element",
      click: () => {
        event.sender.inspectElement(0, 0);
      },
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

---

## System Tray

```javascript
// main.js
const { Tray, Menu, nativeImage } = require("electron/main");

let tray = null; // Must keep a reference to prevent garbage collection

function createTray(mainWindow) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "assets", "tray-icon.png"),
  );

  // macOS tray icons should be 16x16 template images
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
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);

  // Windows/Linux: click the tray icon to show/focus
  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}
```

**Gotcha:** You MUST keep a reference to the `Tray` object (module-level variable). If it gets garbage collected, the tray icon disappears silently. On macOS, tray icons should be 16x16 "template images" (monochrome) for proper dark/light mode rendering.

---

## Notifications

```javascript
// main.js
const { Notification, ipcMain } = require("electron/main");

ipcMain.handle("show-notification", (_event, options) => {
  if (!Notification.isSupported()) return false;

  const notification = new Notification({
    title: options.title,
    body: options.body,
    silent: options.silent ?? false,
  });

  notification.show();
  return true;
});
```

**Key point:** `Notification` is a main process API. Always check `Notification.isSupported()` -- it returns `false` on some Linux environments without a notification daemon.

---

## Custom Protocol Handler (Deep Links)

```javascript
// main.js -- register as handler for myapp:// URLs
const PROTOCOL_SCHEME = "myapp";

if (process.defaultApp) {
  // Dev: must pass script path as argument
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

function handleDeepLink(url) {
  const parsed = new URL(url);
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send("deep-link", {
      host: parsed.host,
      pathname: parsed.pathname,
      search: parsed.search,
    });
  }
}

// macOS: open-url event (app may already be running)
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows/Linux: deep link arrives as argv in second-instance event
app.on("second-instance", (_event, argv) => {
  const deepLink = argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
  if (deepLink) {
    handleDeepLink(deepLink);
  }
});
```

**Key point:** macOS and Windows/Linux handle deep links differently. macOS uses the `open-url` event. Windows/Linux receive the URL as a command-line argument via the `second-instance` event (requires `requestSingleInstanceLock`).

---

## Auto-Updater (Squirrel)

```javascript
// main.js -- built-in autoUpdater (Squirrel, macOS + Windows only)
const { autoUpdater, dialog } = require("electron/main");

const UPDATE_SERVER_URL = "https://your-update-server.com";

function setupAutoUpdater() {
  // Do NOT run in development -- packaged builds only
  if (process.defaultApp) return;

  const feedUrl = `${UPDATE_SERVER_URL}/update/${process.platform}/${app.getVersion()}`;
  autoUpdater.setFeedURL({ url: feedUrl });

  autoUpdater.on("update-available", () => {
    // Update is downloading automatically
  });

  autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
    dialog
      .showMessageBox({
        type: "info",
        buttons: ["Restart", "Later"],
        title: "Update Available",
        message: `Version ${releaseName} has been downloaded. Restart to apply.`,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", (error) => {
    console.error("Auto-update error:", error.message);
  });

  // Check for updates periodically
  const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS);
}
```

**Key point:** The built-in `autoUpdater` uses Squirrel and only works on macOS and Windows. For Linux support, use the `electron-updater` package (from electron-builder) which supports all platforms and additional update sources (S3, GitHub Releases, generic server).

**Gotcha:** Never call `autoUpdater.checkForUpdates()` during development -- it will fail and emit confusing errors. Guard with `process.defaultApp` or `app.isPackaged`.

---

## nativeTheme (Dark/Light Mode)

```javascript
// main.js
const { nativeTheme, ipcMain } = require("electron/main");

ipcMain.handle("get-theme", () => {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
});

ipcMain.handle("set-theme", (_event, theme) => {
  // "system" | "light" | "dark"
  nativeTheme.themeSource = theme;
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
});

// Push theme changes to all renderers
nativeTheme.on("updated", () => {
  const theme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("theme-changed", theme);
  });
});
```

**Key point:** `nativeTheme.themeSource` accepts `"system"`, `"light"`, or `"dark"`. Setting it to `"system"` follows the OS preference. The `updated` event fires when the OS theme changes OR when `themeSource` is set programmatically.

---

## safeStorage (Encrypted Secrets)

```javascript
// main.js
const { safeStorage, ipcMain } = require("electron/main");

ipcMain.handle("store-secret", (_event, key, value) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption not available on this platform");
  }
  const encrypted = safeStorage.encryptString(value);
  // Store `encrypted` (Buffer) in a file or database
  // safeStorage uses the OS keychain (macOS Keychain, Windows DPAPI, Linux libsecret)
  store.set(key, encrypted.toString("base64"));
});

ipcMain.handle("get-secret", (_event, key) => {
  const stored = store.get(key);
  if (!stored) return null;
  const encrypted = Buffer.from(stored, "base64");
  return safeStorage.decryptString(encrypted);
});
```

**Key point:** `safeStorage` uses OS-level encryption (macOS Keychain, Windows DPAPI, Linux libsecret). Data encrypted with `safeStorage` can only be decrypted on the same machine by the same OS user. Always check `isEncryptionAvailable()` -- it returns `false` on some Linux configurations without a keyring.

---

See [packaging.md](packaging.md) for building and distributing the app. See [security.md](security.md) for CSP and permission handlers.
