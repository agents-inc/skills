# Electron Testing Reference

> Quick-lookup tables, Playwright Electron API reference, Spectron migration, test runner comparison. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## Playwright Electron API Quick Reference

### Electron Class

| Method   | Signature                   | Returns                        | Purpose             |
| -------- | --------------------------- | ------------------------------ | ------------------- |
| `launch` | `electron.launch(options?)` | `Promise<ElectronApplication>` | Launch Electron app |

#### Launch Options

| Option           | Type                                   | Default                      | Purpose                                                |
| ---------------- | -------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `args`           | `string[]`                             | --                           | Arguments passed to Electron (typically `["main.js"]`) |
| `executablePath` | `string`                               | `node_modules/.bin/electron` | Path to Electron binary                                |
| `cwd`            | `string`                               | --                           | Working directory                                      |
| `env`            | `Record<string, string>`               | `process.env`                | Environment variables                                  |
| `timeout`        | `number`                               | `30000`                      | Max wait for launch (ms)                               |
| `colorScheme`    | `"dark" \| "light" \| "no-preference"` | --                           | Emulate color scheme                                   |
| `locale`         | `string`                               | --                           | Emulate locale                                         |
| `recordVideo`    | `{ dir: string }`                      | --                           | Record video to directory                              |
| `tracesDir`      | `string`                               | --                           | Trace files output directory                           |

### ElectronApplication Class

| Method           | Signature                       | Returns                 | Purpose                           |
| ---------------- | ------------------------------- | ----------------------- | --------------------------------- |
| `firstWindow`    | `firstWindow(options?)`         | `Promise<Page>`         | Wait for first window             |
| `windows`        | `windows()`                     | `Page[]`                | All open windows                  |
| `close`          | `close()`                       | `Promise<void>`         | Quit the application              |
| `evaluate`       | `evaluate(fn, arg?)`            | `Promise<Serializable>` | Run function in main process      |
| `evaluateHandle` | `evaluateHandle(fn, arg?)`      | `Promise<JSHandle>`     | Get handle to main process object |
| `browserWindow`  | `browserWindow(page)`           | `Promise<JSHandle>`     | Get BrowserWindow for a Page      |
| `context`        | `context()`                     | `BrowserContext`        | Access browser context            |
| `process`        | `process()`                     | `ChildProcess`          | Main process child_process        |
| `waitForEvent`   | `waitForEvent(event, options?)` | `Promise<Object>`       | Wait for event (e.g., `"window"`) |

### ElectronApplication Events

| Event     | Payload          | When                               |
| --------- | ---------------- | ---------------------------------- |
| `close`   | --               | Application process terminated     |
| `console` | `ConsoleMessage` | Main process console method called |
| `window`  | `Page`           | New window created and loaded      |

---

## Test Strategy Matrix

| What to Test         | Approach                       | Speed | Confidence |
| -------------------- | ------------------------------ | ----- | ---------- |
| IPC handler logic    | Unit test (pure functions)     | Fast  | Medium     |
| Handler registration | Unit test (mock ipcMain)       | Fast  | Low        |
| Preload API shape    | Unit test (mock contextBridge) | Fast  | Medium     |
| IPC round-trip       | E2E (Playwright)               | Slow  | High       |
| Dialog workflows     | E2E + stubbed dialogs          | Slow  | High       |
| Window management    | E2E (Playwright)               | Slow  | High       |
| Visual appearance    | E2E + screenshot               | Slow  | High       |
| Renderer UI          | Standard web tests             | Fast  | High       |
| Auto-update          | Mock events + staging server   | Mixed | Medium     |

---

## Spectron Migration Guide

Spectron was deprecated February 2022 and does not work with Electron 24+. Migrate to Playwright or WebDriverIO.

### Spectron to Playwright Mapping

| Spectron                                               | Playwright Equivalent                                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `new Application({ path: electronPath, args: [...] })` | `electron.launch({ args: [...] })`                                                                                          |
| `app.start()`                                          | Happens at `launch()`                                                                                                       |
| `app.stop()`                                           | `electronApp.close()`                                                                                                       |
| `app.client` (WebDriver)                               | `electronApp.firstWindow()` (Page)                                                                                          |
| `app.client.$("selector")`                             | `window.locator("selector")`                                                                                                |
| `app.client.getText("selector")`                       | `window.locator("selector").textContent()`                                                                                  |
| `app.client.click("selector")`                         | `window.click("selector")`                                                                                                  |
| `app.client.waitForVisible("selector")`                | `window.waitForSelector("selector")`                                                                                        |
| `app.electron.remote.app.getVersion()`                 | `electronApp.evaluate(({ app }) => app.getVersion())`                                                                       |
| `app.electron.remote.dialog`                           | `electronApp.evaluate(({ dialog }) => ...)`                                                                                 |
| `app.browserWindow.getBounds()`                        | `electronApp.browserWindow(page).evaluate(bw => bw.getBounds())`                                                            |
| `app.webContents.send(channel, data)`                  | `electronApp.evaluate(({ BrowserWindow }, data) => BrowserWindow.getAllWindows()[0].webContents.send(channel, data), data)` |

### Key Differences

- **No `remote` module** -- Spectron used Electron's deprecated `remote` module. Playwright uses `evaluate()` to run code in the main process.
- **Page API, not WebDriver** -- Playwright returns `Page` objects with its own locator/assertion API, not WebDriver protocol elements.
- **Built-in assertions** -- Use `expect(locator).toHaveText()` instead of manual `getText()` + assert.
- **Auto-waiting** -- Playwright auto-waits for elements; no need for explicit `waitForVisible` in most cases.

---

## CI Platform Reference

| Platform                 | Display Server | Configuration                                      |
| ------------------------ | -------------- | -------------------------------------------------- |
| GitHub Actions (Ubuntu)  | xvfb-run       | `xvfb-run --auto-servernum -- npx playwright test` |
| GitHub Actions (macOS)   | Native         | `npx playwright test` (no extra config)            |
| GitHub Actions (Windows) | Native         | `npx playwright test` (no extra config)            |
| CircleCI                 | Pre-configured | `$DISPLAY` already set                             |
| Docker (Linux)           | xvfb           | Install `xvfb` in Dockerfile, run with `xvfb-run`  |

### xvfb Commands

| Command                              | Purpose                                                    |
| ------------------------------------ | ---------------------------------------------------------- |
| `xvfb-run --auto-servernum -- <cmd>` | Run command with auto-assigned display                     |
| `xvfb-maybe <cmd>`                   | Cross-platform wrapper (Linux: xvfb, macOS/Windows: no-op) |
| `Xvfb :99 &` + `export DISPLAY=:99`  | Manual setup (less common)                                 |

---

## Common Assertion Patterns

| Assertion          | Playwright Code                                                                   |
| ------------------ | --------------------------------------------------------------------------------- |
| Window title       | `expect(await window.title()).toBe("My App")`                                     |
| Element text       | `await expect(window.locator("h1")).toHaveText("Welcome")`                        |
| Element visible    | `await expect(window.locator(".modal")).toBeVisible()`                            |
| Element hidden     | `await expect(window.locator(".modal")).not.toBeVisible()`                        |
| Element count      | `await expect(window.locator(".item")).toHaveCount(3)`                            |
| Screenshot match   | `await expect(window).toHaveScreenshot("baseline.png")`                           |
| Window count       | `expect(electronApp.windows()).toHaveLength(2)`                                   |
| Main process value | `expect(await electronApp.evaluate(({ app }) => app.getVersion())).toBe("1.0.0")` |
