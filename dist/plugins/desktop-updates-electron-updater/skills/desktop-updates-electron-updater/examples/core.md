# Electron Auto-Update - Core Patterns

> Setup, lifecycle events, manual download control, provider configuration, error handling with retry. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [channels-and-rollouts.md](channels-and-rollouts.md) for update channels and staged rollouts.

---

## Full Lifecycle Setup

```javascript
// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log"); // or your logging solution

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

function setupAutoUpdater(mainWindow) {
  // CRITICAL: Never check for updates in development
  if (!app.isPackaged) return;

  // 1. Checking started
  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
    mainWindow.webContents.send("update-status", "checking");
  });

  // 2. Update found
  autoUpdater.on("update-available", (info) => {
    log.info(`Update available: ${info.version}`);
    mainWindow.webContents.send("update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // 3. Already up to date
  autoUpdater.on("update-not-available", (info) => {
    log.info(`Already up to date: ${info.version}`);
    mainWindow.webContents.send("update-status", "up-to-date");
  });

  // 4. Download progress (full downloads only, not differential)
  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("update-progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  // 5. Download complete -- ready to install
  autoUpdater.on("update-downloaded", (info) => {
    log.info(`Update downloaded: ${info.version}`);
    mainWindow.webContents.send("update-downloaded", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  // 6. Error handling -- MUST be wired up
  autoUpdater.on("error", (error) => {
    log.error("Auto-update error:", error.message);
    mainWindow.webContents.send("update-error", error.message);
  });

  // Initial check + periodic re-check
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS);
}

// Handle user-initiated install
ipcMain.handle("install-update", () => {
  // quitAndInstall() closes all windows and installs
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  const mainWindow = createWindow();
  setupAutoUpdater(mainWindow);
});
```

**Why good:** Guards with `app.isPackaged`, handles all lifecycle events including errors, uses named constants for intervals, sends progress to renderer via IPC, logger attached for debugging

```javascript
// BAD: common mistakes in a single example
const { autoUpdater } = require("electron"); // WRONG: built-in module, not electron-updater
autoUpdater.checkForUpdates(); // WRONG: no isPackaged guard
setInterval(() => autoUpdater.checkForUpdates(), 60000); // WRONG: magic number
// WRONG: no error handler -- crashes if network fails
```

**Why bad:** Imports from wrong package (`electron` vs `electron-updater`), no `app.isPackaged` guard causes dev errors, magic number interval, missing error handler crashes the process

---

## Manual Download Control

When `autoDownload` is false, the updater checks for updates but does not download them. You control when the download starts.

```javascript
const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true; // Install on next quit after download

function setupManualUpdater(mainWindow) {
  if (!app.isPackaged) return;

  autoUpdater.on("update-available", (info) => {
    // Send update info to renderer -- let user decide
    mainWindow.webContents.send("update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("update-progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow.webContents.send("update-ready", { version: info.version });
  });

  autoUpdater.on("error", (error) => {
    mainWindow.webContents.send("update-error", error.message);
  });

  autoUpdater.checkForUpdates();
}

// User clicks "Download Update" in the renderer
ipcMain.handle("start-update-download", async () => {
  const result = await autoUpdater.downloadUpdate();
  return result; // Array of downloaded file paths
});

// User clicks "Restart and Install"
ipcMain.handle("install-update", () => {
  // IMPORTANT: Confirm user intent before calling this
  autoUpdater.quitAndInstall();
});
```

**Why good:** User has full control over when to download and install, progress tracking enabled, `autoInstallOnAppQuit` ensures the update installs even if user does not explicitly restart

---

## Runtime Provider Override with setFeedURL

Override the provider at runtime when you need environment-specific update URLs or private repository authentication.

```javascript
const { autoUpdater } = require("electron-updater");

// GitHub provider with authentication (private repos)
autoUpdater.setFeedURL({
  provider: "github",
  owner: "my-org",
  repo: "my-app",
  token: process.env.GH_TOKEN, // For private repos
});

// Generic server provider
autoUpdater.setFeedURL({
  provider: "generic",
  url: "https://releases.example.com/updates",
});

// S3 provider
autoUpdater.setFeedURL({
  provider: "s3",
  bucket: "my-app-releases",
  region: "us-east-1",
  path: "/releases",
});

// Private repo with custom auth header
autoUpdater.addAuthHeader(`Bearer ${accessToken}`);
autoUpdater.checkForUpdates();
```

**Why good:** `setFeedURL()` overrides publish config at runtime, `addAuthHeader()` handles private repos without exposing tokens in the build config

**Gotcha:** `setFeedURL()` must be called before `checkForUpdates()`. Calling it after a check is in progress has no effect on the current check.

---

## Error Handling with Retry and Backoff

```javascript
const { autoUpdater } = require("electron-updater");

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 30_000; // 30 seconds

let retryCount = 0;

function checkForUpdatesWithRetry(mainWindow) {
  if (!app.isPackaged) return;

  autoUpdater.on("error", (error) => {
    log.error(
      `Update check failed (attempt ${retryCount + 1}):`,
      error.message,
    );

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount - 1); // Exponential backoff
      log.info(`Retrying in ${delay / 1000}s...`);
      setTimeout(() => autoUpdater.checkForUpdates(), delay);
    } else {
      log.error("Max retries reached. Update check abandoned.");
      mainWindow.webContents.send(
        "update-error",
        "Update check failed after multiple attempts.",
      );
      retryCount = 0; // Reset for next scheduled check
    }
  });

  autoUpdater.on("update-available", () => {
    retryCount = 0; // Reset on success
  });

  autoUpdater.on("update-not-available", () => {
    retryCount = 0; // Reset on success
  });

  autoUpdater.checkForUpdates();
}
```

**Why good:** Exponential backoff prevents hammering the server, resets retry count on success, named constants for retry limits and delays, logs each attempt for debugging

---

## Preload Script Integration

Expose update-related IPC channels to the renderer through the preload script.

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("updaterAPI", {
  // Listen for update events from main
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on("update-progress", (_event, progress) => callback(progress));
  },
  onUpdateReady: (callback) => {
    ipcRenderer.on("update-ready", (_event, info) => callback(info));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on("update-error", (_event, message) => callback(message));
  },
  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", (_event, status) => callback(status));
  },

  // Trigger actions from renderer
  startDownload: () => ipcRenderer.invoke("start-update-download"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),

  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners("update-available");
    ipcRenderer.removeAllListeners("update-progress");
    ipcRenderer.removeAllListeners("update-ready");
    ipcRenderer.removeAllListeners("update-error");
    ipcRenderer.removeAllListeners("update-status");
  },
});
```

**Why good:** Follows Electron's contextBridge pattern, exposes narrow typed API, includes cleanup method to prevent memory leaks, separates event listeners from action triggers

---

## quitAndInstall Options (Windows NSIS)

```javascript
// Standard install -- shows installer UI, runs app after install
autoUpdater.quitAndInstall();

// Silent install -- no UI, runs app after install (Windows NSIS only)
const IS_SILENT = true;
const RUN_AFTER = true;
autoUpdater.quitAndInstall(IS_SILENT, RUN_AFTER);

// Silent install, do NOT run app after (useful for background services)
autoUpdater.quitAndInstall(true, false);
```

**Gotcha:** The `isSilent` parameter only works on Windows NSIS. On macOS, the installer always shows the standard DMG UI. The `isForceRunAfter` parameter is also Windows-only.

---

## Logging for Debugging

```javascript
const { autoUpdater } = require("electron-updater");
const log = require("electron-log"); // or your logging solution

// Attach logger -- update events are logged automatically
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "debug"; // Verbose for debugging

// Set to null to disable all logging
// autoUpdater.logger = null;
```

**Key point:** With a logger attached, electron-updater logs all event transitions, download progress, provider resolution, and errors to the log file. This is the primary debugging tool when updates fail silently.
