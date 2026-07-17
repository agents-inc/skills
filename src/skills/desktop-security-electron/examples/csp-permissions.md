# Electron Security - CSP & Permission Handling

> Content Security Policy configuration and permission request/check handlers. See [core.md](core.md) for fuses and ASAR integrity. See [navigation-protocols.md](navigation-protocols.md) for navigation restrictions and custom protocols. See [SKILL.md](../SKILL.md) for decision frameworks.

---

## Content Security Policy via Meta Tag

For static apps that bundle all assets locally:

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

**Why good:** `'self'` restricts all resource loading to the app's own origin. No `'unsafe-eval'` means `eval()`, `new Function()`, and template injection are blocked.

```html
<!-- BAD -- overly permissive CSP -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src * 'unsafe-inline' 'unsafe-eval'"
/>
```

**Why bad:** `*` allows loading from any origin, `'unsafe-inline'` allows inline scripts (XSS vector), `'unsafe-eval'` allows `eval()` (code injection vector). This CSP provides no protection.

---

## Content Security Policy via Session Headers

For apps loading remote content or needing per-window CSP:

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

**When to use:** When you cannot set CSP via a `<meta>` tag (loading remote HTML), when CSP needs to differ between windows, or when you need to apply CSP to all responses including subresources.

**Key point:** Session headers override `<meta>` tag CSP -- if both are present, the more restrictive policy wins per-directive.

---

## Development vs Production CSP

Some bundlers inject inline scripts that require relaxed CSP during development:

```javascript
// main.js
const IS_DEV = process.defaultApp;

const PRODUCTION_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'";
const DEVELOPMENT_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [IS_DEV ? DEVELOPMENT_CSP : PRODUCTION_CSP],
      },
    });
  });
});
```

**Why good:** Named constants for each CSP, dev-only relaxation scoped to the `process.defaultApp` check, production CSP never includes `'unsafe-inline'` for scripts.

**Gotcha:** If your dev server runs on `http://localhost:5173`, CSP `'self'` refers to that origin. When the app loads from `file://` or a custom protocol, `'self'` refers to that scheme's origin instead.

---

## Permission Request Handler

Restrict what web permissions renderers can request. Electron grants most permissions by default.

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
});
```

**Why good:** Explicit allowlist -- every permission is denied unless listed. Named constant for the allowlist makes it easy to audit and update.

```javascript
// BAD -- granting all permissions
session.defaultSession.setPermissionRequestHandler(
  (_webContents, permission, callback) => {
    callback(true); // Grants camera, microphone, geolocation, everything
  },
);
```

**Why bad:** Grants every permission a compromised renderer requests, including camera, microphone, and geolocation access.

---

## Permission Check Handler

Handles synchronous permission queries (not prompted). Must be set alongside the request handler for complete coverage.

```javascript
// main.js
app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      return ALLOWED_PERMISSIONS.has(permission);
    },
  );
});
```

**Why both handlers are needed:** Web APIs typically perform a synchronous permission check first, then make an async request if the check fails. Without `setPermissionCheckHandler`, some permissions can be silently granted through the check path alone (e.g., `navigator.permissions.query()` may return `"granted"` even when the request handler would deny it).

---

## Common Web API Permissions

| Permission                  | Risk                         | Recommendation               |
| --------------------------- | ---------------------------- | ---------------------------- |
| `media`                     | Camera and microphone access | Deny unless video/audio app  |
| `geolocation`               | User location tracking       | Deny unless mapping app      |
| `notifications`             | Desktop notification spam    | Allow only if needed         |
| `clipboard-read`            | Read clipboard contents      | Allow only if needed         |
| `clipboard-sanitized-write` | Write to clipboard           | Generally safe to allow      |
| `fullscreen`                | Fullscreen mode              | Generally safe to allow      |
| `pointerLock`               | Mouse pointer capture        | Allow only for games/drawing |
| `openExternal`              | Open URL in default browser  | Validate URL before allowing |

---

See [core.md](core.md) for fuse configuration. See [navigation-protocols.md](navigation-protocols.md) for navigation and URL validation patterns.
