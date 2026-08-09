# Electron Multi-Window - Inter-Window Communication

> Main process relay, MessagePort for direct renderer-to-renderer, typed channels. See [core.md](core.md) for window registry and lifecycle patterns. See [SKILL.md](../SKILL.md) for decision frameworks.

---

## Main Process Relay

The simplest pattern: renderer A sends to main, main forwards to renderer B.

```javascript
// main.js
const { ipcMain } = require("electron");

// Route messages between windows using the registry
ipcMain.on("relay-to-window", (event, targetWindowId, channel, data) => {
  const targetWin = windowRegistry.get(targetWindowId);
  if (!targetWin || targetWin.isDestroyed()) return;

  targetWin.webContents.send(channel, {
    ...data,
    sourceWindowId: getWindowId(event.sender), // track origin
  });
});

// Broadcast to all windows except sender
ipcMain.on("broadcast", (event, channel, data) => {
  const senderId = event.sender.id;
  for (const win of windowRegistry.values()) {
    if (!win.isDestroyed() && win.webContents.id !== senderId) {
      win.webContents.send(channel, data);
    }
  }
});

// Helper: find window ID by webContents
function getWindowId(webContents) {
  for (const [id, win] of windowRegistry.entries()) {
    if (win.webContents.id === webContents.id) return id;
  }
  return null;
}
```

```javascript
// preload.js -- expose relay and broadcast
const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("windowAPI", {
  sendToWindow: (targetId, channel, data) =>
    ipcRenderer.send("relay-to-window", targetId, channel, data),
  broadcast: (channel, data) => ipcRenderer.send("broadcast", channel, data),
  onMessage: (channel, callback) => {
    ipcRenderer.on(channel, (_event, data) => callback(data));
  },
  removeListener: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
```

```javascript
// renderer.js (window A)
window.windowAPI.sendToWindow("editor", "file-changed", { path: "/app.js" });

// renderer.js (window B -- "editor")
window.windowAPI.onMessage("file-changed", (data) => {
  reloadFile(data.path);
});
```

**Why good:** Simple setup, uses existing IPC infrastructure, main process can validate/transform messages, works with any number of windows

**When to use:** Infrequent messages (settings changes, file updates, status notifications) where slight latency from the main process roundtrip is acceptable.

---

## MessagePort -- Direct Renderer-to-Renderer

For high-frequency communication (collaborative editing, streaming data), establish a direct channel that bypasses the main process after setup.

```javascript
// main.js -- create and distribute ports
const { MessageChannelMain, ipcMain } = require("electron");

function connectWindows(window1, window2) {
  const { port1, port2 } = new MessageChannelMain();

  // Transfer ports to each renderer -- MUST use postMessage, not send
  window1.webContents.postMessage("connect-port", { peerId: "window2" }, [
    port1,
  ]);
  window2.webContents.postMessage("connect-port", { peerId: "window1" }, [
    port2,
  ]);
}

// Example: connect windows when both are ready
ipcMain.handle("request-connection", (event, targetWindowId) => {
  const sourceWin = BrowserWindow.fromWebContents(event.sender);
  const targetWin = windowRegistry.get(targetWindowId);
  if (sourceWin && targetWin) {
    connectWindows(sourceWin, targetWin);
  }
});
```

```javascript
// preload.js -- receive and expose port
const { contextBridge, ipcRenderer } = require("electron/renderer");

let messagePort = null;

ipcRenderer.on("connect-port", (event) => {
  // Port arrives via event.ports, not event args
  const [port] = event.ports;
  messagePort = port;

  // CRITICAL: start() must be called to begin receiving queued messages
  port.start();

  // Forward port messages to the renderer world
  port.onmessage = (msgEvent) => {
    window.postMessage({ type: "peer-message", data: msgEvent.data }, "*");
  };
});

contextBridge.exposeInMainWorld("portAPI", {
  sendToPeer: (data) => {
    if (messagePort) messagePort.postMessage(data);
  },
  onPeerMessage: (callback) => {
    window.addEventListener("message", (event) => {
      if (event.data?.type === "peer-message") {
        callback(event.data.data);
      }
    });
  },
  requestConnection: (targetWindowId) =>
    ipcRenderer.invoke("request-connection", targetWindowId),
});
```

```javascript
// renderer.js (window 1)
await window.portAPI.requestConnection("editor");

window.portAPI.onPeerMessage((data) => {
  console.log("Received from peer:", data);
});

window.portAPI.sendToPeer({
  action: "cursor-move",
  position: { line: 10, col: 5 },
});
```

**Why good:** After setup, messages flow directly between renderers without main process overhead. Ideal for real-time collaboration, streaming updates, or high-frequency events.

**Key gotchas:**

- Ports transfer via `postMessage`, not `send` or `invoke`
- `port.start()` must be called in preload -- messages queue until then
- Port arrives in `event.ports`, not as a regular argument
- With `contextIsolation`, the preload must relay port messages to the renderer world via `window.postMessage`

---

## Typed IPC Channels

For TypeScript projects, define channel types for type-safe inter-window messaging.

```typescript
// shared/ipc-channels.ts
interface WindowMessages {
  "file-changed": { path: string; content: string };
  "theme-changed": { theme: "light" | "dark" };
  "selection-changed": { start: number; end: number; windowId: string };
}

type WindowChannel = keyof WindowMessages;

// Preload exposes typed methods
interface WindowAPI {
  sendToWindow: <C extends WindowChannel>(
    targetId: string,
    channel: C,
    data: WindowMessages[C],
  ) => void;
  onMessage: <C extends WindowChannel>(
    channel: C,
    callback: (data: WindowMessages[C]) => void,
  ) => void;
  removeListener: (channel: WindowChannel) => void;
}
```

```typescript
// global.d.ts
declare global {
  interface Window {
    windowAPI: WindowAPI;
  }
}
```

```typescript
// renderer.ts -- type-safe usage
window.windowAPI.sendToWindow("editor", "file-changed", {
  path: "/app.js",
  content: "// updated",
});

// Type error: { wrong: "data" } does not match FileChangedPayload
window.windowAPI.sendToWindow("editor", "file-changed", { wrong: "data" });
```

**Why good:** Compile-time safety for inter-window messages, channel names and payloads are centrally defined, type errors catch mismatched messages

---

## Shared State via Main Process

When multiple windows need the same state, keep a single source of truth in main and push updates.

```javascript
// main.js -- main process as state owner
const { ipcMain } = require("electron");

let appState = {
  theme: "light",
  recentFiles: [],
  user: null,
};

ipcMain.handle("get-state", () => {
  return appState;
});

ipcMain.handle("update-state", (_event, patch) => {
  appState = { ...appState, ...patch };

  // Push updated state to ALL windows
  for (const win of windowRegistry.values()) {
    if (!win.isDestroyed()) {
      win.webContents.send("state-updated", appState);
    }
  }

  return appState;
});
```

```javascript
// preload.js
contextBridge.exposeInMainWorld("stateAPI", {
  getState: () => ipcRenderer.invoke("get-state"),
  updateState: (patch) => ipcRenderer.invoke("update-state", patch),
  onStateUpdate: (callback) => {
    ipcRenderer.on("state-updated", (_event, state) => callback(state));
  },
});
```

**Why good:** Single source of truth prevents desync, all windows receive updates, state changes are serialized through main process (no race conditions)

**When to use:** Application-wide settings (theme, user preferences, authentication state) that all windows must reflect consistently.

---

See [core.md](core.md) for window registry implementation and lifecycle patterns.
