# Electron Security - Navigation, Protocols & URL Validation

> Navigation restrictions, deep link validation, custom protocol security, safe `shell.openExternal()`. See [core.md](core.md) for fuses and ASAR integrity. See [csp-permissions.md](csp-permissions.md) for CSP and permission handling. See [SKILL.md](../SKILL.md) for decision frameworks.

---

## Block Navigation Away from the App

Prevent the renderer from navigating to unexpected URLs:

```javascript
// main.js
function createSecureWindow() {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const appUrl = mainWindow.webContents.getURL();
    if (url !== appUrl) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile("index.html");
  return mainWindow;
}
```

**Why good:** Blocks all navigation away from the app's loaded URL. A compromised renderer or injected link cannot redirect to a phishing page.

**When to relax:** If your app legitimately navigates between local pages (multi-page SPA loaded from disk), allowlist specific origins:

```javascript
const ALLOWED_ORIGINS = new Set(["file://", "myapp://"]);

mainWindow.webContents.on("will-navigate", (event, url) => {
  const parsed = new URL(url);
  if (
    !ALLOWED_ORIGINS.has(parsed.origin) &&
    !ALLOWED_ORIGINS.has(parsed.protocol)
  ) {
    event.preventDefault();
  }
});
```

---

## Block New Window Creation

Prevent `window.open()`, `target="_blank"`, and other new-window triggers:

```javascript
// main.js
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  // Open external links in the user's default browser
  const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "mailto:"]);

  try {
    const parsed = new URL(url);
    if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      shell.openExternal(url);
    }
  } catch {
    // Invalid URL -- silently deny
  }

  return { action: "deny" };
});
```

**Why good:** Always returns `{ action: "deny" }` -- no Electron windows are ever spawned by renderer code. External links are validated and opened in the user's default browser. Invalid URLs are silently dropped.

**Key point:** `setWindowOpenHandler` replaces the deprecated `new-window` event. The old event is ignored in recent Electron versions.

---

## Safe shell.openExternal()

`shell.openExternal()` can execute arbitrary commands if given a malicious URL:

```javascript
// main.js
const ALLOWED_PROTOCOLS = new Set(["https:", "mailto:"]);

ipcMain.handle("open-external", async (_event, url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }

  await shell.openExternal(url);
});
```

**Why good:** Protocol allowlist prevents `file://`, `javascript:`, and custom protocol URLs from being passed to the OS. The `new URL()` constructor rejects malformed URLs. Error is thrown (not silently ignored) so the caller knows the operation was denied.

```javascript
// BAD -- passing user input directly
ipcMain.handle("open-external", async (_event, url) => {
  await shell.openExternal(url); // Arbitrary command execution
});
```

**Why bad:** `shell.openExternal("file:///path/to/script.sh")` or custom protocol handlers can execute arbitrary code on the user's machine.

---

## Custom Protocol Registration

Replace `file://` with a custom protocol for serving local content. Disable the `GrantFileProtocolExtraPrivileges` fuse.

```javascript
// main.js -- must be called BEFORE app.whenReady()
const { protocol } = require("electron/main");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "myapp",
    privileges: {
      standard: true, // Enables relative URL resolution
      secure: true, // Treated as HTTPS for CSP and mixed-content
      supportFetchAPI: true, // Allows fetch() from this scheme
      corsEnabled: true, // Enables CORS for cross-origin requests
    },
  },
]);
```

**Key points:**

- `registerSchemesAsPrivileged` must be called before the `ready` event
- `secure: true` means the scheme is treated like `https:` for CSP purposes
- `standard: true` enables proper relative URL resolution (important for bundled apps)
- With this in place, disable `GrantFileProtocolExtraPrivileges` fuse since `file://` is no longer needed

### Handling the Custom Protocol

```javascript
// main.js -- inside app.whenReady()
const ALLOWED_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".svg",
  ".png",
  ".jpg",
  ".woff2",
]);

protocol.handle("myapp", (request) => {
  const url = new URL(request.url);
  const filePath = path.join(__dirname, "renderer", url.pathname);

  // Validate the file extension
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Prevent path traversal
  const resolvedPath = path.resolve(filePath);
  const rendererDir = path.resolve(__dirname, "renderer");
  if (!resolvedPath.startsWith(rendererDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  return net.fetch(`file://${resolvedPath}`);
});
```

**Why good:** Extension allowlist prevents serving sensitive files (`.env`, `.json` configs). Path traversal check ensures requests cannot escape the renderer directory. Uses `net.fetch` for the actual file read (respects Chromium's content-type handling).

---

## Deep Link URL Validation

When your app handles `myapp://` URLs from external sources (browsers, other apps), always validate the incoming URL before acting on it.

```javascript
// main.js
const ALLOWED_DEEP_LINK_PATHS = new Set(["/open", "/auth/callback", "/invite"]);
const MAX_URL_LENGTH = 2048;

function handleDeepLink(url) {
  if (url.length > MAX_URL_LENGTH) {
    return; // Reject excessively long URLs
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return; // Reject malformed URLs
  }

  if (parsed.protocol !== "myapp:") {
    return; // Reject unexpected protocols
  }

  if (!ALLOWED_DEEP_LINK_PATHS.has(parsed.pathname)) {
    return; // Reject unknown paths
  }

  // Safe to route to handler
  routeDeepLink(parsed.pathname, parsed.searchParams);
}

// macOS -- handle open-url event
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows/Linux -- handle second-instance event
app.on("second-instance", (_event, commandLine) => {
  const deepLinkUrl = commandLine.find((arg) => arg.startsWith("myapp://"));
  if (deepLinkUrl) {
    handleDeepLink(deepLinkUrl);
  }
});
```

**Why good:** Multiple layers of validation: length limit, URL parsing, protocol check, path allowlist. Named constants for limits and allowed paths. Platform-specific handling (macOS uses `open-url`, Windows/Linux uses `second-instance`).

**Key point:** An attacker can craft arbitrary `myapp://` URLs -- never trust the path or query parameters without validation. Treat deep links like untrusted user input.

---

## IPC Sender Validation

Verify that IPC messages come from expected windows:

```javascript
// main.js
ipcMain.handle("sensitive-operation", async (event) => {
  // Verify the sender is the main window
  const senderFrame = event.senderFrame;
  const expectedOrigin = "myapp://renderer";

  if (
    senderFrame.url !== expectedOrigin &&
    !senderFrame.url.startsWith("file://")
  ) {
    throw new Error("Unauthorized IPC sender");
  }

  // Safe to proceed
  return performSensitiveOperation();
});
```

**Why important:** Without sender validation, any BrowserWindow or webview in your app can call any IPC handler. If a window loads external content (even temporarily), that content can invoke your IPC handlers.

---

See [core.md](core.md) for fuse configuration and ASAR integrity. See [csp-permissions.md](csp-permissions.md) for CSP and permission handlers.
