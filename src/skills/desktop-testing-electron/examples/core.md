# Electron Testing - Core Patterns

> Playwright E2E fundamentals, main process evaluation, IPC handler unit testing, preload script testing. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [e2e-patterns.md](e2e-patterns.md) for dialog stubbing, CI, and screenshots. See [mocking.md](mocking.md) for Electron module mocking patterns.

> **Note:** Unit test examples use Vitest syntax for concreteness. The Electron-specific patterns (what to extract, what to mock) apply to any test runner.

---

## Playwright E2E: Launch and First Window

```typescript
import { test, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";

let electronApp: ElectronApplication;
let window: Page;

test.beforeEach(async () => {
  electronApp = await electron.launch({
    args: ["dist/main.js"],
    env: { ...process.env, NODE_ENV: "test" },
  });
  window = await electronApp.firstWindow();
  // Wait for the renderer to be ready
  await window.waitForLoadState("domcontentloaded");
});

test.afterEach(async () => {
  await electronApp.close();
});

test("app opens with main window", async () => {
  const title = await window.title();
  expect(title).toBe("My Application");
});

test("main window has expected dimensions", async () => {
  const windowSize = await electronApp.evaluate(async ({ BrowserWindow }) => {
    const [mainWindow] = BrowserWindow.getAllWindows();
    const [width, height] = mainWindow.getSize();
    return { width, height };
  });
  expect(windowSize.width).toBeGreaterThanOrEqual(800);
  expect(windowSize.height).toBeGreaterThanOrEqual(600);
});
```

**Why good:** Launches with test environment, waits for DOM before assertions, cleans up in afterEach, uses evaluate for main process checks

```typescript
// BAD: no cleanup, no wait, hardcoded path
test("opens app", async () => {
  const app = await electron.launch({ args: ["/Users/me/dev/app/main.js"] });
  const win = await app.firstWindow();
  expect(await win.title()).toBe("My App");
  // No close! Process leaks on every test run
});
```

**Why bad:** Hardcoded absolute path, no waitForLoadState, no close in teardown -- leaked process accumulates

---

## Main Process Evaluation with evaluate()

`evaluate()` runs a function inside the main Electron process. It receives the Electron module object as its argument.

```typescript
test("app version matches package.json", async () => {
  const version = await electronApp.evaluate(async ({ app }) => {
    return app.getVersion();
  });
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("user data path is set", async () => {
  const userDataPath = await electronApp.evaluate(async ({ app }) => {
    return app.getPath("userData");
  });
  expect(userDataPath).toBeTruthy();
});

test("main window is not minimized on startup", async () => {
  const isMinimized = await electronApp.evaluate(async ({ BrowserWindow }) => {
    const [mainWindow] = BrowserWindow.getAllWindows();
    return mainWindow.isMinimized();
  });
  expect(isMinimized).toBe(false);
});
```

**Key points:**

- The callback receives the full Electron module -- destructure what you need (`{ app }`, `{ BrowserWindow }`, `{ dialog }`)
- Return values must be JSON-serializable (no functions, DOM nodes, or circular references)
- The function runs in the real main process, so you can access actual app state

---

## BrowserWindow Handle via browserWindow()

Access the underlying BrowserWindow for a given Page. Returns a `JSHandle` -- use `evaluate` on the handle.

```typescript
test("window has correct title bar configuration", async () => {
  const bwHandle = await electronApp.browserWindow(window);

  const isResizable = await bwHandle.evaluate((bw) => bw.isResizable());
  expect(isResizable).toBe(true);

  const bounds = await bwHandle.evaluate((bw) => bw.getBounds());
  expect(bounds.width).toBeGreaterThanOrEqual(800);
});
```

**Key point:** `browserWindow(page)` returns a JSHandle, not a direct BrowserWindow. You must call `.evaluate()` on the handle to access properties and methods.

---

## Multi-Window Testing

Use `waitForEvent("window")` to capture new windows spawned during a test.

```typescript
test("preferences opens in a new window", async () => {
  // Set up listener before triggering the action
  const windowPromise = electronApp.waitForEvent("window");

  // Trigger the action that opens a new window
  await window.click('[data-testid="open-preferences"]');

  // Wait for the new window
  const prefsWindow = await windowPromise;
  await prefsWindow.waitForLoadState("domcontentloaded");

  await expect(prefsWindow.locator("h1")).toHaveText("Preferences");

  // Verify window count
  const allWindows = electronApp.windows();
  expect(allWindows).toHaveLength(2);
});
```

**Why good:** Sets up event listener before the action, waits for load state on the new window, verifies window count

---

## Unit Testing IPC Handlers (Extract + Test)

The most testable pattern: extract handler logic into pure functions, register them separately.

### Step 1: Extract handler logic

```typescript
// main/handlers/file-handler.ts
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_EXTENSIONS = new Set([".txt", ".md", ".json"]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export async function handleReadFile(filePath: string): Promise<FileResult> {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { success: false, error: `Unsupported extension: ${ext}` };
  }

  try {
    const content = await readFile(filePath, "utf-8");
    if (Buffer.byteLength(content) > MAX_FILE_SIZE_BYTES) {
      return { success: false, error: "File exceeds maximum size" };
    }
    return { success: true, content };
  } catch {
    return { success: false, error: `Failed to read file: ${filePath}` };
  }
}

export async function handleSaveFile(
  filePath: string,
  content: string,
): Promise<FileResult> {
  try {
    await writeFile(filePath, content, "utf-8");
    return { success: true };
  } catch {
    return { success: false, error: `Failed to write file: ${filePath}` };
  }
}
```

### Step 2: Register handlers (thin wiring layer)

```typescript
// main/register-handlers.ts
import { ipcMain } from "electron";
import { handleReadFile, handleSaveFile } from "./handlers/file-handler.js";

export function registerFileHandlers(): void {
  ipcMain.handle("read-file", (_event, filePath: string) =>
    handleReadFile(filePath),
  );
  ipcMain.handle("save-file", (_event, filePath: string, content: string) =>
    handleSaveFile(filePath, content),
  );
}
```

### Step 3: Unit test the handler logic (no mocking needed)

```typescript
// main/handlers/file-handler.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { handleReadFile, handleSaveFile } from "./file-handler.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "electron-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("handleReadFile", () => {
  it("reads a valid text file", async () => {
    const filePath = path.join(tempDir, "test.txt");
    await writeFile(filePath, "hello world");

    const result = await handleReadFile(filePath);
    expect(result).toStrictEqual({ success: true, content: "hello world" });
  });

  it("rejects unsupported file extensions", async () => {
    const result = await handleReadFile("/tmp/malicious.exe");
    expect(result).toStrictEqual({
      success: false,
      error: "Unsupported extension: .exe",
    });
  });

  it("returns error for non-existent files", async () => {
    const result = await handleReadFile("/tmp/does-not-exist.txt");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to read file");
  });
});

describe("handleSaveFile", () => {
  it("writes content to a file", async () => {
    const filePath = path.join(tempDir, "output.txt");
    const result = await handleSaveFile(filePath, "saved content");
    expect(result).toStrictEqual({ success: true });
  });
});
```

**Why good:** Handler logic is a pure async function, no Electron imports, no mocking needed, uses temp directories for filesystem tests

---

## Preload Script Testing

Test that your preload script exposes the correct API shape by mocking `contextBridge` and `ipcRenderer`.

```typescript
// preload.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron/renderer before importing preload
vi.mock("electron", () => {
  const exposedApis: Record<string, unknown> = {};
  return {
    contextBridge: {
      exposeInMainWorld: vi.fn((key: string, api: unknown) => {
        exposedApis[key] = api;
      }),
    },
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    __exposedApis: exposedApis,
  };
});

describe("preload script", () => {
  let exposedApis: Record<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();
    const electronMock = await import("electron");
    // Import preload -- it calls exposeInMainWorld as a side effect
    await import("./preload.js");
    exposedApis = (
      electronMock as unknown as { __exposedApis: Record<string, unknown> }
    ).__exposedApis;
  });

  it("exposes electronAPI to the renderer", () => {
    expect(exposedApis).toHaveProperty("electronAPI");
  });

  it("exposes expected methods", () => {
    const api = exposedApis.electronAPI as Record<string, unknown>;
    expect(typeof api.readFile).toBe("function");
    expect(typeof api.saveFile).toBe("function");
    expect(typeof api.getAppVersion).toBe("function");
  });

  it("readFile calls ipcRenderer.invoke with correct channel", async () => {
    const { ipcRenderer } = await import("electron");
    const api = exposedApis.electronAPI as Record<
      string,
      (arg: string) => Promise<unknown>
    >;

    await api.readFile("/tmp/test.txt");
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      "read-file",
      "/tmp/test.txt",
    );
  });
});
```

**Why good:** Verifies the preload API shape without running Electron, confirms correct IPC channels are wired, catches typos in channel names early
