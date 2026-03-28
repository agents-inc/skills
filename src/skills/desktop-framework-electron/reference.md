# Electron Reference

> Quick-lookup tables, security checklist, and version reference. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## Process Model

| Process  | Runtime  | Access                                | Count          |
| -------- | -------- | ------------------------------------- | -------------- |
| Main     | Node.js  | Full Node.js + Electron APIs          | Exactly 1      |
| Renderer | Chromium | DOM + exposed preload API only        | 1 per window   |
| Preload  | Node.js  | Node.js (bridged via `contextBridge`) | 1 per renderer |
| Utility  | Node.js  | Node.js (child of main, Electron 22+) | 0+             |

---

## BrowserWindow webPreferences Defaults

| Property           | Default | Since       | Notes                                       |
| ------------------ | ------- | ----------- | ------------------------------------------- |
| `contextIsolation` | `true`  | Electron 12 | Isolates preload from renderer globals      |
| `nodeIntegration`  | `false` | Electron 5  | Must stay false for security                |
| `sandbox`          | `true`  | Electron 20 | OS-level process sandboxing                 |
| `webviewTag`       | `false` | Electron 22 | Must explicitly enable if using `<webview>` |
| `webSecurity`      | `true`  | Always      | Same-origin policy enforcement              |

---

## IPC Methods Quick Reference

| Pattern                 | Main API                             | Preload API              | Direction         | Async |
| ----------------------- | ------------------------------------ | ------------------------ | ----------------- | ----- |
| Request-response        | `ipcMain.handle()`                   | `ipcRenderer.invoke()`   | Renderer --> Main | Yes   |
| Fire-and-forget         | `ipcMain.on()`                       | `ipcRenderer.send()`     | Renderer --> Main | Yes   |
| Main pushes to renderer | `webContents.send()`                 | `ipcRenderer.on()`       | Main --> Renderer | Yes   |
| Synchronous (avoid)     | `ipcMain.on()` + `event.returnValue` | `ipcRenderer.sendSync()` | Renderer --> Main | No    |
| Port-based              | `MessageChannelMain`                 | `MessagePort`            | Bidirectional     | Yes   |

---

## Native API Quick Reference

| API                 | Process | Purpose                                             |
| ------------------- | ------- | --------------------------------------------------- |
| `dialog`            | Main    | Native file/message/error dialogs                   |
| `Menu`              | Main    | Application menu and context menus                  |
| `Tray`              | Main    | System tray icon and menu                           |
| `Notification`      | Main    | OS-level notifications                              |
| `shell`             | Main    | Open URLs/files with default system app             |
| `clipboard`         | Both    | System clipboard access                             |
| `nativeTheme`       | Main    | Dark/light mode detection and override              |
| `safeStorage`       | Main    | OS keychain-encrypted string storage                |
| `powerMonitor`      | Main    | System power state (suspend, resume, lock)          |
| `screen`            | Main    | Display info, cursor position                       |
| `globalShortcut`    | Main    | System-wide keyboard shortcuts                      |
| `systemPreferences` | Main    | OS settings (accent color, accessibility)           |
| `autoUpdater`       | Main    | Squirrel-based auto-update (macOS/Windows)          |
| `protocol`          | Main    | Custom protocol handlers and interceptors           |
| `desktopCapturer`   | Main    | Screen/window capture for screenshots and recording |
| `utilityProcess`    | Main    | Spawn Node.js child processes (Electron 22+)        |

---

## App Lifecycle Events (Ordered)

| Event                   | When                                      | Typical Action                       |
| ----------------------- | ----------------------------------------- | ------------------------------------ |
| `will-finish-launching` | Before `ready`, before event handlers     | Set up crash reporter                |
| `ready`                 | App initialized, GPU process started      | Create windows, register shortcuts   |
| `activate`              | macOS dock icon clicked (no open windows) | Re-create main window                |
| `window-all-closed`     | Last window closed                        | Quit on Windows/Linux, noop on macOS |
| `before-quit`           | App about to quit                         | Save state, cleanup resources        |
| `will-quit`             | All windows closed, app quitting          | Unregister global shortcuts          |
| `quit`                  | App has quit                              | Final cleanup                        |

---

## Security Checklist

- [ ] `contextIsolation` is `true` (default)
- [ ] `nodeIntegration` is `false` (default)
- [ ] `sandbox` is `true` (default)
- [ ] Preload exposes only specific channel wrappers, not raw `ipcRenderer`
- [ ] Main process validates all IPC arguments (paths, URLs, data)
- [ ] `Content-Security-Policy` meta tag or header set in renderer HTML
- [ ] `shell.openExternal()` validates URLs against an allowlist
- [ ] `webSecurity` is `true` in production
- [ ] No `allowRunningInsecureContent: true` in production
- [ ] `session.setPermissionRequestHandler()` restricts media/geolocation/notification permissions
- [ ] Remote content never loaded with `nodeIntegration` or disabled `contextIsolation`
- [ ] ASAR archive integrity validation enabled for packaged builds

---

## Electron Version History (Security-Relevant)

| Version | Change                                                       |
| ------- | ------------------------------------------------------------ |
| 5       | `nodeIntegration` defaults to `false`                        |
| 10      | `enableRemoteModule` defaults to `false`                     |
| 12      | `contextIsolation` defaults to `true`                        |
| 14      | `remote` module removed entirely                             |
| 20      | `sandbox` defaults to `true`, renderers sandboxed by default |
| 22      | `utilityProcess` API added (replacement for fork/spawn)      |
| 22      | `webviewTag` defaults to `false`                             |
| 28+     | `nativeWindowOpen` removed (was already default behavior)    |

---

## See Also

- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron Forge Documentation](https://www.electronforge.io/)
