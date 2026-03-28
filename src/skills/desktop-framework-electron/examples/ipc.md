# Electron - IPC Patterns

> All IPC communication patterns: invoke/handle, send/on, main-to-renderer, MessagePort, typed channels. See [core.md](core.md) for preload/contextBridge fundamentals. See [SKILL.md](../SKILL.md) for IPC pattern selection decision tree.

---

## Request-Response (invoke/handle)

The primary pattern for renderer-to-main communication when a response is needed.

```javascript
// main.js
const { ipcMain, dialog } = require("electron/main");

ipcMain.handle("dialog:openFile", async (_event, options) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: options?.multiSelect
      ? ["openFile", "multiSelections"]
      : ["openFile"],
    filters: options?.filters ?? [],
  });
  if (canceled) return null;
  return options?.multiSelect ? filePaths : filePaths[0];
});
```

```javascript
// preload.js
contextBridge.exposeInMainWorld("electronAPI", {
  openFile: (options) => ipcRenderer.invoke("dialog:openFile", options),
});
```

```javascript
// renderer.js
const filePath = await window.electronAPI.openFile({
  filters: [{ name: "Images", extensions: ["png", "jpg", "gif"] }],
});
if (filePath) {
  console.log("Selected:", filePath);
}
```

**Key point:** `invoke` returns a Promise that resolves with the handler's return value. If the handler throws, the Promise rejects. This is the preferred pattern for most IPC.

---

## Fire-and-Forget (send/on)

For renderer-to-main messages that do not need a response.

```javascript
// main.js
ipcMain.on("log-event", (_event, eventName, metadata) => {
  analyticsLogger.track(eventName, metadata);
});
```

```javascript
// preload.js
contextBridge.exposeInMainWorld("electronAPI", {
  logEvent: (eventName, metadata) =>
    ipcRenderer.send("log-event", eventName, metadata),
});
```

**When to use:** Analytics, logging, or side effects where the renderer does not need confirmation. Use `invoke/handle` if you need to know whether the operation succeeded.

---

## Main-to-Renderer (webContents.send)

Main process pushes data to a specific renderer window.

```javascript
// main.js
function startDownload(mainWindow, url) {
  const stream = downloadFile(url);

  stream.on("progress", (percent) => {
    mainWindow.webContents.send("download-progress", { percent, url });
  });

  stream.on("complete", (filePath) => {
    mainWindow.webContents.send("download-complete", { filePath, url });
  });

  stream.on("error", (error) => {
    mainWindow.webContents.send("download-error", { message: error.message });
  });
}
```

```javascript
// preload.js
contextBridge.exposeInMainWorld("electronAPI", {
  onDownloadProgress: (callback) => {
    ipcRenderer.on("download-progress", (_event, data) => callback(data));
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on("download-complete", (_event, data) => callback(data));
  },
  onDownloadError: (callback) => {
    ipcRenderer.on("download-error", (_event, data) => callback(data));
  },
  removeDownloadListeners: () => {
    ipcRenderer.removeAllListeners("download-progress");
    ipcRenderer.removeAllListeners("download-complete");
    ipcRenderer.removeAllListeners("download-error");
  },
});
```

**Key point:** Always expose a cleanup method (`removeDownloadListeners`) so the renderer can unsubscribe when components unmount. Without this, listeners accumulate across page navigations or component re-mounts.

---

## MessagePort for High-Frequency Communication

Use `MessageChannelMain` for streaming data or worker-like patterns that would overwhelm standard IPC.

```javascript
// main.js
const { MessageChannelMain, ipcMain } = require("electron/main");

ipcMain.handle("create-data-channel", (event) => {
  const { port1, port2 } = new MessageChannelMain();

  // Main process keeps port1 for sending
  port1.on("message", (messageEvent) => {
    const request = messageEvent.data;
    // Process request, send response back
    port1.postMessage({ id: request.id, result: processData(request) });
  });
  port1.start();

  // Transfer port2 to the renderer
  event.sender.postMessage("data-channel-port", null, [port2]);
});
```

```javascript
// preload.js
contextBridge.exposeInMainWorld("electronAPI", {
  requestDataChannel: () => ipcRenderer.invoke("create-data-channel"),
  onDataChannelReady: (callback) => {
    ipcRenderer.on("data-channel-port", (event) => {
      const port = event.ports[0];
      callback(port);
    });
  },
});
```

**When to use:** Real-time data feeds, large binary transfers, or patterns where the standard `invoke/handle` overhead matters. MessagePort uses the Structured Clone Algorithm and avoids the IPC serialization overhead per-message.

**Gotcha:** You must call `port.start()` on the main process side. The renderer side auto-starts when you add a `message` event listener.

---

## Reply Directly to Sender

Use `event.sender` when a main process handler needs to push additional messages back to the specific renderer that sent the original request.

```javascript
// main.js
ipcMain.on("start-long-task", (event, taskId) => {
  performLongTask(taskId, {
    onProgress: (percent) => {
      // Send progress updates back to the SAME renderer that started the task
      event.sender.send("task-progress", { taskId, percent });
    },
    onComplete: (result) => {
      event.sender.send("task-complete", { taskId, result });
    },
  });
});
```

**Key point:** `event.sender` is the `WebContents` of the renderer that sent the message. This is essential in multi-window apps where you need to respond to the correct window.

---

## IPC Input Validation

Always validate arguments received from the renderer in main process handlers.

```javascript
// main.js
const ALLOWED_DIRECTORIES = new Set(["userData", "documents", "downloads"]);

ipcMain.handle("list-directory", async (_event, dirName) => {
  // Validate against allowlist -- never trust renderer input
  if (typeof dirName !== "string" || !ALLOWED_DIRECTORIES.has(dirName)) {
    throw new Error(`Invalid directory: ${dirName}`);
  }

  const dirPath = app.getPath(dirName);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
  }));
});

ipcMain.handle("write-user-file", async (_event, fileName, content) => {
  // Sanitize filename -- prevent path traversal
  if (typeof fileName !== "string" || /[/\\]/.test(fileName)) {
    throw new Error("Invalid filename");
  }
  if (typeof content !== "string" || content.length > 10 * 1024 * 1024) {
    throw new Error("Invalid content");
  }

  const filePath = path.join(app.getPath("userData"), fileName);
  await fs.writeFile(filePath, content, "utf-8");
  return { success: true };
});
```

**Why critical:** The renderer process may be compromised via XSS. Main process handlers have full Node.js access -- if they blindly trust renderer arguments, attackers can read/write arbitrary files, execute commands, or escalate privileges.

---

See [security.md](security.md) for CSP and permission handling. See [native-apis.md](native-apis.md) for dialog, menu, tray, and notification patterns.
