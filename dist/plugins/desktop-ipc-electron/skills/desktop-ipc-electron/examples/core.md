# Electron Type-Safe IPC - Core Patterns

> Shared channel map, typed wrappers, typed preload, and declaration augmentation. See [electron-trpc.md](electron-trpc.md) for the tRPC approach. See [message-ports.md](message-ports.md) for MessagePort and utility process patterns.

---

## Shared IPC Channel Map

The foundation of type-safe IPC: a single file defining all channel names, argument types, and return types. Both main and renderer processes import from this file.

```typescript
// shared/ipc-channels.ts

/** Request-response channels: renderer calls, main responds with a Promise */
export interface IpcHandleChannels {
  "file:read": (filePath: string) => { content: string };
  "file:write": (filePath: string, content: string) => { success: boolean };
  "file:exists": (filePath: string) => boolean;
  "dialog:open-file": (options: {
    filters?: Array<{ name: string; extensions: string[] }>;
    multiSelect?: boolean;
  }) => string[] | null;
  "dialog:save-file": (defaultPath?: string) => string | null;
  "app:get-version": () => string;
  "app:get-path": (name: "userData" | "documents" | "downloads") => string;
  "settings:get": <T>(key: string) => T | null;
  "settings:set": (key: string, value: unknown) => void;
}

/** Fire-and-forget channels: renderer sends, main does not respond */
export interface IpcSendChannels {
  "analytics:track": [eventName: string, metadata?: Record<string, unknown>];
  "log:error": [message: string, stack?: string];
  "log:info": [message: string];
  "window:minimize": [];
  "window:close": [];
}

/** Main-to-renderer push channels: main sends, renderer listens */
export interface IpcMainToRendererChannels {
  "update:progress": { percent: number; message: string };
  "update:available": { version: string; releaseNotes?: string };
  "update:downloaded": { version: string };
  "theme:changed": "light" | "dark";
  "deep-link:received": { url: string };
}
```

**Why good:** All channel contracts live in one file. Renaming a channel or changing a payload type triggers compile errors everywhere the old contract is used. Channel names use namespace prefixes (`file:`, `app:`, `dialog:`) for organization.

---

## Typed Main Process Handlers

Create typed wrappers around `ipcMain.handle` and `ipcMain.on` that constrain channels to the map.

```typescript
// main/typed-ipc.ts
import { ipcMain } from "electron";
import type {
  IpcHandleChannels,
  IpcSendChannels,
} from "../shared/ipc-channels";

/** Type-safe ipcMain.handle -- only accepts channels from IpcHandleChannels */
export function typedHandle<C extends keyof IpcHandleChannels>(
  channel: C,
  handler: (
    event: Electron.IpcMainInvokeEvent,
    ...args: Parameters<IpcHandleChannels[C]>
  ) =>
    | ReturnType<IpcHandleChannels[C]>
    | Promise<ReturnType<IpcHandleChannels[C]>>,
): void {
  ipcMain.handle(channel, handler as (...args: unknown[]) => unknown);
}

/** Type-safe ipcMain.on -- only accepts channels from IpcSendChannels */
export function typedOn<C extends keyof IpcSendChannels>(
  channel: C,
  handler: (event: Electron.IpcMainEvent, ...args: IpcSendChannels[C]) => void,
): void {
  ipcMain.on(channel, handler as (...args: unknown[]) => void);
}
```

```typescript
// main/handlers.ts -- register all handlers using typed wrappers
import { app, dialog } from "electron";
import { typedHandle, typedOn } from "./typed-ipc";

// TypeScript enforces correct return types
typedHandle("file:read", async (_event, filePath) => {
  // filePath is typed as string, return must be { content: string }
  const content = await fs.readFile(filePath, "utf-8");
  return { content };
});

typedHandle("dialog:open-file", async (_event, options) => {
  // options is typed from the channel map
  const result = await dialog.showOpenDialog({
    properties: options.multiSelect
      ? ["openFile", "multiSelections"]
      : ["openFile"],
    filters: options.filters ?? [],
  });
  return result.canceled ? null : result.filePaths;
});

typedHandle("app:get-version", () => app.getVersion());

// Fire-and-forget -- no return value expected
typedOn("analytics:track", (_event, eventName, metadata) => {
  // eventName: string, metadata: Record<string, unknown> | undefined
  trackEvent(eventName, metadata);
});

typedOn("log:error", (_event, message, stack) => {
  logger.error(message, { stack });
});
```

**Why good:** typo in channel name = compile error, wrong argument types = compile error, wrong return type = compile error. The wrapper functions are thin -- no runtime overhead beyond a type cast.

---

## Typed Preload Script

The preload script bridges main and renderer. Build a generic typed API from the channel map.

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from "electron";
import type {
  IpcHandleChannels,
  IpcSendChannels,
  IpcMainToRendererChannels,
} from "../shared/ipc-channels";

export interface ElectronAPI {
  invoke: <C extends keyof IpcHandleChannels>(
    channel: C,
    ...args: Parameters<IpcHandleChannels[C]>
  ) => Promise<ReturnType<IpcHandleChannels[C]>>;
  send: <C extends keyof IpcSendChannels>(
    channel: C,
    ...args: IpcSendChannels[C]
  ) => void;
  on: <C extends keyof IpcMainToRendererChannels>(
    channel: C,
    callback: (data: IpcMainToRendererChannels[C]) => void,
  ) => () => void;
}

const api: ElectronAPI = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) =>
      callback(data as never);
    ipcRenderer.on(channel, listener);
    // Return unsubscribe function for cleanup
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
```

**Why good:** `invoke`, `send`, and `on` are all constrained to their respective channel maps. The `on` method returns an unsubscribe function, making cleanup trivial in UI framework components.

---

## Window Type Augmentation

Augment the global `Window` interface so the renderer gets full autocompletion on `window.electronAPI`.

```typescript
// shared/electron-api.d.ts
import type { ElectronAPI } from "../preload";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

**Usage in renderer:**

```typescript
// renderer/some-component.ts
// Full autocompletion: channel names, argument types, return types
const { content } = await window.electronAPI.invoke(
  "file:read",
  "/path/to/file",
);
//     ^-- typed as { content: string }

window.electronAPI.send("analytics:track", "page-view", { page: "/home" });

// Listener with cleanup
const unsubscribe = window.electronAPI.on("update:progress", (data) => {
  console.log(data.percent); // typed as number
});
// Call unsubscribe() when component unmounts
```

---

## Typed Main-to-Renderer Push

Type-safe wrapper for `webContents.send()` so main process pushes are also constrained to the channel map.

```typescript
// main/typed-ipc.ts (add to existing file)
import type { BrowserWindow } from "electron";
import type { IpcMainToRendererChannels } from "../shared/ipc-channels";

/** Type-safe webContents.send -- only accepts channels from IpcMainToRendererChannels */
export function typedSendToRenderer<C extends keyof IpcMainToRendererChannels>(
  win: BrowserWindow,
  channel: C,
  data: IpcMainToRendererChannels[C],
): void {
  win.webContents.send(channel, data);
}
```

```typescript
// main/updater.ts
import { typedSendToRenderer } from "./typed-ipc";

function onUpdateProgress(win: BrowserWindow, percent: number) {
  typedSendToRenderer(win, "update:progress", {
    percent,
    message: `Downloading: ${percent}%`,
  });
}
```

**Why good:** prevents sending wrong data shape to a channel, prevents typos in channel names

---

## Channel Validation Middleware

For defense-in-depth, validate that incoming IPC channels are in the allowed set at runtime.

```typescript
// main/ipc-validator.ts
import { ipcMain } from "electron";
import type {
  IpcHandleChannels,
  IpcSendChannels,
} from "../shared/ipc-channels";

const ALLOWED_HANDLE_CHANNELS = new Set<string>([
  "file:read",
  "file:write",
  "file:exists",
  "dialog:open-file",
  "dialog:save-file",
  "app:get-version",
  "app:get-path",
  "settings:get",
  "settings:set",
] satisfies Array<keyof IpcHandleChannels>);

const ALLOWED_SEND_CHANNELS = new Set<string>([
  "analytics:track",
  "log:error",
  "log:info",
  "window:minimize",
  "window:close",
] satisfies Array<keyof IpcSendChannels>);

/**
 * Reject IPC messages on channels not in the allowed set.
 * Call once during app initialization.
 */
export function installChannelValidator(): void {
  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (
    channel: string,
    handler: (...args: unknown[]) => unknown,
  ) => {
    if (!ALLOWED_HANDLE_CHANNELS.has(channel)) {
      throw new Error(`Unregistered IPC handle channel: ${channel}`);
    }
    return originalHandle(channel, handler);
  };
}
```

**Why good:** the `satisfies` assertion ensures the allowlist stays in sync with the type map. If a channel is added to the type map but not the allowlist, TypeScript flags it.

---

## Listener Cleanup Pattern

Always clean up IPC listeners to prevent memory leaks. The unsubscribe function from the typed preload makes this straightforward.

```typescript
// In a UI framework component (framework-agnostic pattern)
function setupListeners() {
  const unsubProgress = window.electronAPI.on("update:progress", (data) => {
    updateProgressBar(data.percent);
  });

  const unsubAvailable = window.electronAPI.on("update:available", (data) => {
    showUpdateBanner(data.version);
  });

  // Return combined cleanup function
  return () => {
    unsubProgress();
    unsubAvailable();
  };
}

// Call cleanup when component unmounts or page navigates away
const cleanup = setupListeners();
// ... later:
cleanup();
```

**Why good:** each `on` call returns its own unsubscribe function, cleanup is explicit, no stale listeners accumulate across re-mounts or navigation
