# Electron Testing - E2E Patterns

> Dialog stubbing, menu testing, CI headless setup, screenshot testing, auto-update testing, multi-window flows. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for launch/evaluate fundamentals. See [mocking.md](mocking.md) for unit test mocking.

---

## Dialog Stubbing

Native dialogs (`showOpenDialog`, `showSaveDialog`, `showMessageBox`) block the process and cannot be interacted with by Playwright. Stub them via `evaluate()` before triggering.

### Open File Dialog

```typescript
test("opens and displays a file", async () => {
  // Stub showOpenDialog to return a test file
  await electronApp.evaluate(async ({ dialog }) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: ["/tmp/test-data/sample.txt"],
    });
  });

  await window.click('button[data-testid="open-file"]');

  await expect(window.locator('[data-testid="file-content"]')).toContainText(
    "sample content",
  );
});
```

### Save File Dialog

```typescript
test("saves file to selected path", async () => {
  const savePath = path.join(os.tmpdir(), "electron-test-save.txt");

  await electronApp.evaluate(async ({ dialog }, targetPath) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: targetPath,
    });
  }, savePath);

  await window.click('button[data-testid="save-file"]');

  // Verify the file was actually written
  const content = await readFile(savePath, "utf-8");
  expect(content).toContain("expected content");
});
```

**Key point:** The second argument to `evaluate()` is passed into the callback. Use this to inject test-specific paths.

### Canceled Dialog

```typescript
test("handles canceled dialog gracefully", async () => {
  await electronApp.evaluate(async ({ dialog }) => {
    dialog.showOpenDialog = async () => ({
      canceled: true,
      filePaths: [],
    });
  });

  await window.click('button[data-testid="open-file"]');

  // Verify the app does not crash and shows no file
  await expect(
    window.locator('[data-testid="file-content"]'),
  ).not.toBeVisible();
});
```

### Message Box Dialog

```typescript
test("confirms dangerous action via message box", async () => {
  // Button index 0 = "Yes" in a Yes/No dialog
  const CONFIRM_BUTTON_INDEX = 0;

  await electronApp.evaluate(async ({ dialog }, buttonIndex) => {
    dialog.showMessageBox = async () => ({
      response: buttonIndex,
      checkboxChecked: false,
    });
  }, CONFIRM_BUTTON_INDEX);

  await window.click('button[data-testid="delete-all"]');
  await expect(window.locator('[data-testid="empty-state"]')).toBeVisible();
});
```

---

## electron-playwright-helpers Library

For projects with many dialog-heavy tests, `electron-playwright-helpers` provides convenience wrappers.

```typescript
import { stubDialog, stubMultipleDialogs } from "electron-playwright-helpers";

test("opens file using helper library", async () => {
  await stubDialog(electronApp, "showOpenDialog", {
    filePaths: ["/tmp/test.txt"],
    canceled: false,
  });

  await window.click('button[data-testid="open-file"]');
  await expect(window.locator('[data-testid="file-name"]')).toHaveText(
    "test.txt",
  );
});

test("multi-step file workflow", async () => {
  await stubMultipleDialogs(electronApp, [
    {
      method: "showOpenDialog",
      value: { filePaths: ["/tmp/source.txt"], canceled: false },
    },
    {
      method: "showSaveDialog",
      value: { filePath: "/tmp/output.txt", canceled: false },
    },
  ]);

  await window.click('button[data-testid="convert-file"]');
  await expect(window.locator('[data-testid="status"]')).toHaveText(
    "Conversion complete",
  );
});
```

**Key point:** Each dialog method can only be stubbed with one value at a time. Call `stubDialog` again before each dialog trigger if the same method is called multiple times.

---

## Menu Testing

Application menus and context menus cannot be directly clicked via Playwright. Test via `evaluate()` to trigger menu actions programmatically.

```typescript
test("File > New creates a new document", async () => {
  // Simulate menu click by triggering the menu item's click handler
  await electronApp.evaluate(async ({ Menu }) => {
    const appMenu = Menu.getApplicationMenu();
    const fileMenu = appMenu?.getMenuItemById("file-new");
    fileMenu?.click();
  });

  await expect(window.locator('[data-testid="document-title"]')).toHaveText(
    "Untitled",
  );
});
```

**Alternative:** If your menu items trigger IPC messages, test the IPC handler directly rather than going through the menu.

---

## Headless CI Configuration

### GitHub Actions -- Linux with xvfb

```yaml
name: Electron E2E Tests
on: [push, pull_request]

jobs:
  test-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build # Build the Electron app first
      - run: npx playwright install --with-deps chromium
      - name: Run E2E tests
        run: xvfb-run --auto-servernum -- npx playwright test

  test-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test # No xvfb needed on macOS

  test-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test # No xvfb needed on Windows
```

### Cross-Platform npm Script with xvfb-maybe

```json
{
  "scripts": {
    "test:e2e": "xvfb-maybe npx playwright test"
  },
  "devDependencies": {
    "xvfb-maybe": "^0.2.1"
  }
}
```

**Key point:** `xvfb-maybe` auto-detects the platform. On Linux it wraps with xvfb, on macOS/Windows it's a no-op.

---

## Screenshot and Visual Regression Testing

### Full Window Screenshot

```typescript
test("main window visual regression", async () => {
  await window.waitForLoadState("networkidle");

  await expect(window).toHaveScreenshot("main-window.png", {
    maxDiffPixelRatio: 0.01, // Allow 1% pixel difference
  });
});
```

### Component Screenshot

```typescript
test("sidebar matches baseline", async () => {
  const sidebar = window.locator('[data-testid="sidebar"]');
  await expect(sidebar).toHaveScreenshot("sidebar.png");
});
```

### Masking Dynamic Content

```typescript
test("dashboard without dynamic elements", async () => {
  await expect(window).toHaveScreenshot("dashboard.png", {
    mask: [
      window.locator('[data-testid="timestamp"]'),
      window.locator('[data-testid="user-avatar"]'),
    ],
  });
});
```

**Key points:**

- Generate baselines with `npx playwright test --update-snapshots`
- Run screenshot tests on a single OS in CI for consistent baselines
- Use `maxDiffPixelRatio` for tolerance against minor rendering differences
- Mask timestamps, avatars, and other dynamic content to avoid false positives
- Store baseline screenshots in version control

---

## Auto-Update Testing

Auto-update is difficult to fully E2E test because it requires a real update server. Use a layered strategy.

### Unit Test: Mock Event Emission

```typescript
// auto-updater.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron-updater", () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: vi.fn(),
    on: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

import { autoUpdater } from "electron-updater";
import { setupAutoUpdater } from "./auto-updater.js";

describe("auto-updater setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers update-available handler", () => {
    setupAutoUpdater();
    expect(autoUpdater.on).toHaveBeenCalledWith(
      "update-available",
      expect.any(Function),
    );
  });

  it("registers update-downloaded handler", () => {
    setupAutoUpdater();
    expect(autoUpdater.on).toHaveBeenCalledWith(
      "update-downloaded",
      expect.any(Function),
    );
  });
});
```

### E2E Test: Verify Update UI (with stubbed updater)

```typescript
test("shows update notification when update is available", async () => {
  // Simulate the main process emitting an update event
  await electronApp.evaluate(async ({ BrowserWindow }) => {
    const [mainWindow] = BrowserWindow.getAllWindows();
    mainWindow.webContents.send("update-available", {
      version: "2.0.0",
      releaseDate: "2025-01-01",
    });
  });

  await expect(window.locator('[data-testid="update-banner"]')).toBeVisible();
  await expect(window.locator('[data-testid="update-version"]')).toHaveText(
    "2.0.0",
  );
});
```

### Staging Integration Test

For full integration testing, use a local update server (e.g., Minio for S3-compatible hosting) with a version bump in `package.json`:

1. Build a "current" version (e.g., 1.0.0)
2. Build an "update" version (e.g., 1.1.0)
3. Serve the update via local server
4. Launch the 1.0.0 build and verify it detects and downloads the update

This is typically run manually or in a dedicated CI stage, not on every commit.
