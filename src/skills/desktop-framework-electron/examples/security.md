# Electron - Security Patterns

> Security hardening, CSP, permission handlers, safe external URL handling. See [core.md](core.md) for preload/contextBridge fundamentals. See [SKILL.md](../SKILL.md) for critical security requirements.

---

## Content Security Policy

Set CSP in the renderer HTML to mitigate XSS and code injection.

```html
<!-- index.html -->
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data:;
    connect-src 'self';
    font-src 'self';
  "
/>
```

**Key point:** `'self'` restricts loading to the app's own origin (the `file://` or custom protocol). Never add `'unsafe-eval'` in production -- it enables `eval()` and template injection attacks.

**Gotcha:** If using a dev server (`http://localhost:5173`), CSP `'self'` refers to that origin. Some bundlers inject inline scripts that require `'unsafe-inline'` for `script-src` during development -- scope this to dev only.

---

## CSP via Session Headers

For apps loading remote content or needing dynamic CSP:

```javascript
// main.js
const { session } = require("electron/main");

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
        ],
      },
    });
  });
});
```

**When to use:** When you cannot set CSP via a `<meta>` tag (e.g., loading remote HTML), or when CSP needs to differ between windows.

---

## Permission Request Handler

Restrict what web permissions renderers can request.

```javascript
// main.js
const ALLOWED_PERMISSIONS = new Set([
  "clipboard-read",
  "clipboard-sanitized-write",
]);

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission));
    },
  );

  // Also handle permission checks (synchronous queries)
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      return ALLOWED_PERMISSIONS.has(permission);
    },
  );
});
```

**Why critical:** By default, Electron grants most permission requests (media, geolocation, notifications). This handler denies everything except explicitly allowed permissions. Without it, a compromised renderer could access the camera, microphone, or location.

---

## Safe shell.openExternal

`shell.openExternal()` can execute arbitrary commands if given a malicious URL.

```javascript
// main.js
const { shell } = require("electron/main");

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

**Why critical:** `shell.openExternal("file:///path/to/script.sh")` or custom protocol handlers can execute arbitrary code. Always validate the protocol against an allowlist. Never pass unvalidated user input directly to `shell.openExternal()`.

---

## Disable Navigation and New Windows

Prevent the renderer from navigating to unexpected URLs or opening new windows.

```javascript
// main.js
function createWindow() {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Block all navigation away from the app
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const appUrl = mainWindow.webContents.getURL();
    if (url !== appUrl) {
      event.preventDefault();
    }
  });

  // Block new window creation (window.open, target="_blank")
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in the user's default browser
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.loadFile("index.html");
}
```

**Why critical:** Without these guards, a compromised renderer could navigate to a phishing page that looks like your app, or open pop-up windows. `setWindowOpenHandler` replaces the deprecated `new-window` event.

---

## ASAR Integrity Validation

Protect packaged app code from tampering.

```json
// forge.config.js or electron-builder config
{
  "asar": true,
  "asarUnpack": ["node_modules/native-addon/**"]
}
```

**Key point:** ASAR packs your app into a single archive, preventing casual code modification. Native modules that need direct filesystem access must be unpacked via `asarUnpack`. Electron Forge and Electron Builder both support ASAR by default.

**Gotcha:** ASAR is not encryption -- it prevents casual tampering but a determined attacker can still extract and modify the archive. For sensitive logic, keep it server-side.

---

## Secure webPreferences Audit

A checklist pattern for verifying all BrowserWindows use secure defaults:

```javascript
// main.js -- development-only audit
if (process.defaultApp) {
  app.on("browser-window-created", (_event, window) => {
    const prefs = window.webContents.getLastWebPreferences();

    const violations = [];
    if (!prefs.contextIsolation) violations.push("contextIsolation is false");
    if (prefs.nodeIntegration) violations.push("nodeIntegration is true");
    if (!prefs.sandbox) violations.push("sandbox is false");
    if (!prefs.webSecurity) violations.push("webSecurity is false");

    if (violations.length > 0) {
      console.error(
        `[SECURITY] Window "${window.getTitle()}" has unsafe webPreferences:`,
        violations,
      );
    }
  });
}
```

**Why useful:** Catches accidental security regressions during development. The `browser-window-created` event fires for every BrowserWindow, including those created by dependencies.

---

See [core.md](core.md) for secure BrowserWindow creation patterns. See [SKILL.md](../SKILL.md) for the full security red flags list.
