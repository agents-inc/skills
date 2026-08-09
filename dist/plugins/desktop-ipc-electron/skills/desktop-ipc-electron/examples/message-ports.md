# Electron Type-Safe IPC - MessagePort & Utility Process

> High-throughput communication patterns: MessagePort for streaming and renderer-to-renderer, utilityProcess for background work. See [core.md](core.md) for standard typed IPC. See [SKILL.md](../SKILL.md) for when to choose MessagePort vs standard IPC.

---

## MessagePort: Main to Renderer

Use `MessageChannelMain` to create a port pair for high-frequency data transfer that avoids per-message IPC serialization overhead.

```typescript
// shared/port-messages.ts -- typed messages for port communication
export interface PortRequest {
  id: string;
  type: "process-chunk" | "stream-start" | "stream-stop";
  payload: unknown;
}

export interface PortResponse {
  id: string;
  type: "chunk-result" | "stream-data" | "stream-end" | "error";
  data: unknown;
}
```

```typescript
// main/data-channel.ts
import { MessageChannelMain } from "electron";
import type { BrowserWindow } from "electron";
import type { PortRequest, PortResponse } from "../shared/port-messages";

export function createDataChannel(win: BrowserWindow): MessagePortMain {
  const { port1, port2 } = new MessageChannelMain();

  // Main keeps port1 for sending/receiving
  port1.on("message", (event: Electron.MessageEvent) => {
    const request = event.data as PortRequest;
    const response = processRequest(request);
    port1.postMessage(response);
  });

  // CRITICAL: must call start() on main side
  port1.start();

  // Transfer port2 to the renderer via postMessage (not send/invoke)
  win.webContents.postMessage("data-channel-port", null, [port2]);

  return port1;
}

function processRequest(request: PortRequest): PortResponse {
  switch (request.type) {
    case "process-chunk":
      return {
        id: request.id,
        type: "chunk-result",
        data: heavyProcess(request.payload),
      };
    case "stream-start":
      return { id: request.id, type: "stream-data", data: null };
    case "stream-stop":
      return { id: request.id, type: "stream-end", data: null };
    default:
      return { id: request.id, type: "error", data: "Unknown request type" };
  }
}
```

```typescript
// preload.ts -- receive the port and expose it
import { contextBridge, ipcRenderer } from "electron";

let dataPort: MessagePort | null = null;

ipcRenderer.on("data-channel-port", (event) => {
  const [port] = event.ports;
  dataPort = port;
});

contextBridge.exposeInMainWorld("dataChannel", {
  onReady: (callback: (port: MessagePort) => void) => {
    if (dataPort) {
      callback(dataPort);
    } else {
      ipcRenderer.on("data-channel-port", (event) => {
        callback(event.ports[0]);
      });
    }
  },
});
```

```typescript
// renderer/use-data-channel.ts
import type { PortRequest, PortResponse } from "../shared/port-messages";

function useDataChannel(): {
  send: (request: PortRequest) => Promise<PortResponse>;
} {
  let port: MessagePort | null = null;
  const pending = new Map<string, (response: PortResponse) => void>();

  window.dataChannel.onReady((p) => {
    port = p;
    port.onmessage = (event: MessageEvent<PortResponse>) => {
      const resolve = pending.get(event.data.id);
      if (resolve) {
        pending.delete(event.data.id);
        resolve(event.data);
      }
    };
  });

  return {
    send: (request) =>
      new Promise((resolve) => {
        pending.set(request.id, resolve);
        port?.postMessage(request);
      }),
  };
}
```

**When to use:** Real-time data feeds (audio/video processing, live charts), large binary transfers, or patterns where the standard `invoke`/`handle` serialization overhead is measurable.

**Key differences from standard IPC:**

- Uses Structured Clone Algorithm instead of IPC serialization
- Ports transferred via `postMessage`, not `send`/`invoke`
- `port.start()` required on main side (renderer auto-starts on `message` listener)
- `port.close` event fires when the remote end is garbage collected

---

## Renderer-to-Renderer Communication

Two renderer windows cannot communicate directly. Route through main using a MessagePort pair.

```typescript
// main/renderer-bridge.ts
import { MessageChannelMain } from "electron";
import type { BrowserWindow } from "electron";

/**
 * Create a direct communication channel between two renderer windows.
 * Each window gets one end of a MessagePort pair.
 */
export function bridgeRenderers(
  windowA: BrowserWindow,
  windowB: BrowserWindow,
): void {
  const { port1, port2 } = new MessageChannelMain();

  // Transfer one port to each window
  windowA.webContents.postMessage("peer-port", null, [port1]);
  windowB.webContents.postMessage("peer-port", null, [port2]);
}
```

```typescript
// preload.ts
ipcRenderer.on("peer-port", (event) => {
  const [port] = event.ports;
  contextBridge.exposeInMainWorld("peerChannel", {
    send: (data: unknown) => port.postMessage(data),
    onMessage: (callback: (data: unknown) => void) => {
      port.onmessage = (event) => callback(event.data);
    },
    close: () => port.close(),
  });
});
```

**How it works:** Main creates a `MessageChannelMain`, sends one port to each renderer. After setup, the two renderers communicate directly through the port pair -- main is not involved in message routing.

**Gotcha:** Both windows must be loaded before transferring ports. Use `webContents.on("did-finish-load")` to ensure readiness.

---

## Utility Process for Background Work

`utilityProcess.fork()` spawns a Node.js child process for CPU-intensive work without blocking the main process.

```typescript
// shared/worker-messages.ts
export interface WorkerRequest {
  type: "parse-csv" | "compress-file" | "generate-report";
  id: string;
  payload: unknown;
}

export interface WorkerResponse {
  type: "result" | "progress" | "error";
  id: string;
  data: unknown;
}
```

```typescript
// main/background-worker.ts
import { utilityProcess } from "electron";
import type { BrowserWindow } from "electron";
import path from "node:path";
import type { WorkerRequest, WorkerResponse } from "../shared/worker-messages";

export function createBackgroundWorker(mainWindow: BrowserWindow) {
  const worker = utilityProcess.fork(path.join(__dirname, "worker.js"), [], {
    serviceName: "background-worker",
  });

  // Forward results from worker to renderer
  worker.on("message", (response: WorkerResponse) => {
    if (response.type === "progress") {
      mainWindow.webContents.send("worker:progress", response);
    } else {
      mainWindow.webContents.send("worker:result", response);
    }
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      mainWindow.webContents.send("worker:error", {
        message: `Worker exited with code ${code}`,
      });
    }
  });

  return {
    send: (request: WorkerRequest) => worker.postMessage(request),
    kill: () => worker.kill(),
  };
}
```

```typescript
// worker.ts (runs in utility process)
import type { WorkerRequest, WorkerResponse } from "../shared/worker-messages";

process.parentPort.on("message", (event: Electron.MessageEvent) => {
  const request = event.data as WorkerRequest;

  switch (request.type) {
    case "parse-csv": {
      const result = parseLargeCsv(request.payload as string);
      const response: WorkerResponse = {
        type: "result",
        id: request.id,
        data: result,
      };
      process.parentPort.postMessage(response);
      break;
    }

    case "compress-file": {
      // Report progress during long operations
      for (let i = 0; i <= 100; i += 10) {
        const progress: WorkerResponse = {
          type: "progress",
          id: request.id,
          data: { percent: i },
        };
        process.parentPort.postMessage(progress);
      }
      break;
    }

    default: {
      const error: WorkerResponse = {
        type: "error",
        id: request.id,
        data: `Unknown request type: ${request.type}`,
      };
      process.parentPort.postMessage(error);
    }
  }
});
```

**Key points:**

- `utilityProcess.fork()` is preferred over `child_process.fork()` in Electron -- uses Chromium's Services API
- Communication via `parentPort.postMessage()` / `parentPort.on("message")`
- Can only be called after `app.whenReady()`
- `serviceName` option labels the process in Electron's `app.getAppMetrics()`
- Utility processes have full Node.js access (fs, crypto, etc.)
- The `exit` event fires with a code when the process terminates

---

## MessagePort Transfer to Utility Process

For direct communication between a renderer and a utility process, transfer a MessagePort.

```typescript
// main/direct-worker-channel.ts
import { MessageChannelMain, utilityProcess } from "electron";
import type { BrowserWindow } from "electron";
import path from "node:path";

export function createDirectWorkerChannel(win: BrowserWindow): void {
  const worker = utilityProcess.fork(path.join(__dirname, "worker.js"));
  const { port1, port2 } = new MessageChannelMain();

  // Send port1 to the worker
  worker.postMessage({ type: "init-port" }, [port1]);

  // Send port2 to the renderer
  win.webContents.postMessage("worker-port", null, [port2]);
}
```

```typescript
// worker.ts (utility process)
process.parentPort.on("message", (event: Electron.MessageEvent) => {
  if (event.data?.type === "init-port" && event.ports.length > 0) {
    const port = event.ports[0];
    port.on("message", (msgEvent: Electron.MessageEvent) => {
      // Direct message from renderer
      const result = processData(msgEvent.data);
      port.postMessage(result);
    });
    port.start();
  }
});
```

**When to use:** When the renderer needs frequent, low-latency communication with a background worker and routing through main would add unnecessary overhead. After the initial setup (which goes through main), all subsequent messages flow directly between the renderer and utility process.

**Gotcha:** The utility process must call `port.start()` after receiving the transferred port. The renderer side auto-starts when adding a `message` listener.
