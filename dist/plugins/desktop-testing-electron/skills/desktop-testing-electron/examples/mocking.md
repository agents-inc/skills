# Electron Testing - Mocking Patterns

> Mocking Electron modules for unit tests: electron module, ipcMain/ipcRenderer, BrowserWindow, dialog, contextBridge. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for E2E and handler testing. See [e2e-patterns.md](e2e-patterns.md) for dialog stubbing in E2E.

> **Note:** Examples use Vitest mock syntax (`vi.mock`, `vi.fn`) for concreteness. The mocking patterns (what to mock and why) apply to any test runner that supports module mocking.

---

## Full Electron Module Mock

When main process code imports from `electron`, mock the entire module. Place this in a setup file or at the top of each test file.

```typescript
// test/mocks/electron.ts -- reusable mock
import { vi } from "vitest";

export function createElectronMock() {
  return {
    app: {
      getPath: vi.fn().mockReturnValue("/tmp/mock-app-data"),
      getVersion: vi.fn().mockReturnValue("1.0.0"),
      getName: vi.fn().mockReturnValue("TestApp"),
      whenReady: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      quit: vi.fn(),
    },
    BrowserWindow: vi.fn().mockImplementation(() => ({
      loadFile: vi.fn().mockResolvedValue(undefined),
      loadURL: vi.fn().mockResolvedValue(undefined),
      webContents: {
        send: vi.fn(),
        on: vi.fn(),
        openDevTools: vi.fn(),
      },
      on: vi.fn(),
      show: vi.fn(),
      close: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      getBounds: vi
        .fn()
        .mockReturnValue({ x: 0, y: 0, width: 1200, height: 800 }),
    })),
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    dialog: {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
      showMessageBox: vi.fn(),
      showErrorBox: vi.fn(),
    },
    Menu: {
      buildFromTemplate: vi.fn(),
      setApplicationMenu: vi.fn(),
      getApplicationMenu: vi.fn(),
    },
    Tray: vi.fn().mockImplementation(() => ({
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
    })),
    Notification: vi.fn().mockImplementation(() => ({
      show: vi.fn(),
      on: vi.fn(),
    })),
    nativeTheme: {
      shouldUseDarkColors: false,
      themeSource: "system",
      on: vi.fn(),
    },
    shell: {
      openExternal: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(""),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn().mockReturnValue(true),
      encryptString: vi.fn().mockReturnValue(Buffer.from("encrypted")),
      decryptString: vi.fn().mockReturnValue("decrypted"),
    },
  };
}
```

### Using the Mock in Tests

```typescript
// vitest setup or individual test file
import { vi } from "vitest";
import { createElectronMock } from "./mocks/electron.js";

vi.mock("electron", () => createElectronMock());
```

Or inline for a single test file:

```typescript
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue("/tmp/test"),
    getVersion: vi.fn().mockReturnValue("1.0.0"),
    whenReady: vi.fn().mockResolvedValue(undefined),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
}));
```

---

## Per-Test Mock Overrides

Override specific mock behavior for individual tests without resetting the entire module.

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";
import { dialog } from "electron";

vi.mock("electron", () => ({
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
}));

describe("file-picker module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns selected file path", async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/home/user/document.txt"],
    });

    const result = await pickFile();
    expect(result).toBe("/home/user/document.txt");
  });

  it("returns null when dialog is canceled", async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const result = await pickFile();
    expect(result).toBeNull();
  });
});
```

**Why good:** Each test controls the mock return value independently, `clearAllMocks` in beforeEach prevents leak between tests

---

## ipcMain Handler Registration Testing

Test that your handler registration function wires up the correct channels.

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ipcMain } from "electron";

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

import { registerFileHandlers } from "./register-handlers.js";

describe("registerFileHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers read-file and save-file handlers", () => {
    registerFileHandlers();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      "read-file",
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      "save-file",
      expect.any(Function),
    );
  });

  it("read-file handler calls through to handleReadFile", async () => {
    registerFileHandlers();

    // Extract the registered handler
    const handleCall = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "read-file");
    const handler = handleCall?.[1];

    // Call the handler with a mock event and test args
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = await handler?.(mockEvent, "/tmp/test.txt");

    expect(result).toBeDefined();
  });
});
```

---

## BrowserWindow Mock with webContents

Test code that creates and manages BrowserWindows.

```typescript
import { vi, describe, it, expect } from "vitest";
import { BrowserWindow } from "electron";

vi.mock("electron", () => {
  const mockWebContents = {
    send: vi.fn(),
    on: vi.fn(),
    openDevTools: vi.fn(),
  };

  const mockWindow = {
    loadFile: vi.fn().mockResolvedValue(undefined),
    loadURL: vi.fn().mockResolvedValue(undefined),
    webContents: mockWebContents,
    on: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  };

  return {
    BrowserWindow: vi.fn().mockImplementation(() => mockWindow),
  };
});

import { createMainWindow } from "./window-manager.js";

describe("createMainWindow", () => {
  it("creates window with correct options", () => {
    createMainWindow();

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
        webPreferences: expect.objectContaining({
          preload: expect.stringContaining("preload"),
        }),
      }),
    );
  });

  it("loads the correct entry file", () => {
    const win = createMainWindow();
    expect(win.loadFile).toHaveBeenCalledWith(
      expect.stringContaining("index.html"),
    );
  });
});
```

---

## contextBridge and ipcRenderer Mock (Preload Testing)

Test preload scripts by capturing what `exposeInMainWorld` receives.

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

const exposedApis: Record<string, Record<string, Function>> = {};

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((key: string, api: Record<string, Function>) => {
      exposedApis[key] = api;
    }),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

describe("preload script", () => {
  beforeEach(async () => {
    // Clear captured APIs and re-import preload
    Object.keys(exposedApis).forEach((key) => delete exposedApis[key]);
    vi.resetModules();
    await import("./preload.js");
  });

  it("exposes all expected API methods", () => {
    const api = exposedApis.electronAPI;
    expect(api).toBeDefined();

    const expectedMethods = [
      "readFile",
      "saveFile",
      "getAppVersion",
      "onUpdateAvailable",
    ];
    for (const method of expectedMethods) {
      expect(typeof api[method]).toBe("function");
    }
  });

  it("wires readFile to the correct IPC channel", async () => {
    const { ipcRenderer } = await import("electron");
    const api = exposedApis.electronAPI;

    await api.readFile("/test/path.txt");

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      "read-file",
      "/test/path.txt",
    );
  });

  it("wires event listener to correct channel", async () => {
    const { ipcRenderer } = await import("electron");
    const api = exposedApis.electronAPI;
    const callback = vi.fn();

    api.onUpdateAvailable(callback);

    expect(ipcRenderer.on).toHaveBeenCalledWith(
      "update-available",
      expect.any(Function),
    );
  });
});
```

**Why good:** Captures the exact API surface exposed to the renderer, verifies correct IPC channel names, catches wiring bugs without running Electron

---

## Test Runner Configuration Tip

Main process tests should run in a **Node environment** (not jsdom/happy-dom). If your project has both renderer tests (browser environment) and main process tests (Node environment), use your test runner's project/workspace feature to split them. Apply the Electron module mock globally in a setup file so every main process test gets it automatically.
