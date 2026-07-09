# Tauri Capabilities & ACL - Core Patterns

> Capability file structure, scoped permissions, window/platform targeting, remote access, debugging. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [custom-permissions.md](custom-permissions.md) for app-defined permissions and permission sets.

---

## Pattern 1: Minimal Capability File

Every Tauri 2 app starts with at least one capability file. This is the minimum viable capability.

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for all windows",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

**Why this works:** `core:default` includes `core:app:default`, `core:event:default`, `core:window:default`, `core:path:default`, `core:image:default`, `core:menu:default`, `core:tray:default`, `core:webview:default`, and `core:resources:default`. This is enough for basic app lifecycle, window management, and event handling.

**Without this file:** Every `invoke()` call from the frontend will fail with a permission denied error at runtime.

---

## Pattern 2: Complete Capability File (All Fields)

A capability file with every available field documented.

```json
// src-tauri/capabilities/main.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Full permissions for the main application window",
  "local": true,
  "windows": ["main"],
  "webviews": [],
  "platforms": ["linux", "macOS", "windows"],
  "permissions": [
    "core:default",
    "event:default",
    "window:default",
    "path:default",
    "shell:allow-open",
    "dialog:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/**" }, { "path": "$RESOURCE/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    }
  ],
  "remote": {
    "urls": ["https://*.example.com"]
  }
}
```

**Field reference:**

| Field         | Type                 | Required | Purpose                                                                        |
| ------------- | -------------------- | -------- | ------------------------------------------------------------------------------ |
| `$schema`     | string               | No       | IDE autocompletion (generated on first `cargo tauri dev`)                      |
| `identifier`  | string               | Yes      | Unique name for this capability (`[a-z]` and hyphens only)                     |
| `description` | string               | Yes      | Explains what this capability grants                                           |
| `local`       | boolean              | No       | Enable for local app URLs (default: `true`)                                    |
| `windows`     | string[]             | No       | Window labels this capability applies to (supports `"*"` wildcard)             |
| `webviews`    | string[]             | No       | Webview labels this capability applies to                                      |
| `platforms`   | string[]             | No       | Restrict to platforms: `"linux"`, `"macOS"`, `"windows"`, `"iOS"`, `"android"` |
| `permissions` | (string \| object)[] | Yes      | Permission identifiers or scoped permission objects                            |
| `remote`      | object               | No       | Remote domain access via `urls` array using URLPattern standard                |

---

## Pattern 3: Scoped Filesystem Permissions

Restrict file operations to specific directories using path scopes. Deny always wins.

```json
// src-tauri/capabilities/file-access.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "file-access",
  "description": "Scoped file system access for main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$APPDATA/**" },
        { "path": "$RESOURCE/**" },
        { "path": "$DOCUMENT/**" }
      ]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:deny-read-text-file",
      "deny": [
        { "path": "$APPDATA/secrets/**" },
        { "path": "$APPDATA/.credentials/**" }
      ]
    }
  ]
}
```

**Why good:** Reads from app data, resources, and documents. Writes only to app data. Explicitly denies access to secrets subdirectory. Even if another capability allows reading `$APPDATA/**`, the deny scope blocks the secrets path.

```json
// BAD: No path scope -- allows reading ANY file on the system
{
  "permissions": ["fs:allow-read-text-file"]
}
```

**Why bad:** Without a scope, the permission grants access to the entire filesystem. Always scope filesystem permissions to specific directories.

**Path variables and glob patterns:** See [reference.md](../reference.md) for the full path variable table (`$APPDATA`, `$HOME`, `$RESOURCE`, etc.) and glob pattern syntax.

---

## Pattern 4: Scoped HTTP Permissions

Restrict HTTP requests to specific domains using URL scopes.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "api-access",
  "description": "Restricted HTTP access",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.example.com/**" },
        { "url": "https://cdn.example.com/**" }
      ],
      "deny": [{ "url": "https://api.example.com/admin/**" }]
    }
  ]
}
```

**Why good:** HTTP requests are restricted to two specific domains. Admin endpoints are explicitly denied even though the base domain is allowed.

---

## Pattern 5: Multi-Window Capabilities

Different windows get different permission levels based on their role.

```json
// src-tauri/capabilities/editor.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "editor-capability",
  "description": "Full access for the editor window",
  "windows": ["editor"],
  "permissions": [
    "core:default",
    "fs:default",
    "dialog:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$DOCUMENT/**" }, { "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$DOCUMENT/**" }, { "path": "$APPDATA/**" }]
    }
  ]
}
```

```json
// src-tauri/capabilities/viewer.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "viewer-capability",
  "description": "Read-only access for the viewer window",
  "windows": ["viewer"],
  "permissions": [
    "core:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$RESOURCE/**" }]
    }
  ]
}
```

**Why good:** Principle of least privilege per window. The editor can read/write documents and app data. The viewer can only read bundled resources. If the viewer window is compromised, it cannot modify files or access user documents.

**Wildcard window matching:**

```json
{
  "windows": ["*"],
  "permissions": ["core:default"]
}
```

The `"*"` wildcard matches all windows, including dynamically created ones. Use sparingly in production -- prefer explicit window labels.

---

## Pattern 6: Platform-Specific Capabilities

Some plugins are desktop-only or mobile-only. Split capabilities by platform to prevent runtime errors.

```json
// src-tauri/capabilities/desktop.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "desktop-features",
  "description": "Desktop-only features",
  "windows": ["main"],
  "platforms": ["linux", "macOS", "windows"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "global-shortcut:default",
    "autostart:default"
  ]
}
```

```json
// src-tauri/capabilities/mobile.json
{
  "$schema": "../gen/schemas/mobile-schema.json",
  "identifier": "mobile-features",
  "description": "Mobile-only features",
  "windows": ["main"],
  "platforms": ["iOS", "android"],
  "permissions": [
    "core:default",
    "barcode-scanner:default",
    "biometric:default"
  ]
}
```

**Why good:** Shell, autostart, and global-shortcut are desktop-only plugins. Barcode scanner and biometric are mobile-only. Splitting prevents "plugin not available" errors on the wrong platform.

**Cross-platform capability (shared features):**

```json
// src-tauri/capabilities/shared.json
{
  "identifier": "shared-features",
  "description": "Features available on all platforms",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "notification:default",
    "store:default"
  ]
}
```

---

## Pattern 7: Remote Domain Access

Allow remote web content to access Tauri APIs. Use for apps that load external content in webviews.

```json
// src-tauri/capabilities/remote-access.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "remote-partner-access",
  "description": "Allow partner domain to use notifications",
  "windows": ["main"],
  "remote": {
    "urls": ["https://*.partner.com", "https://dashboard.internal.dev"]
  },
  "permissions": ["notification:default"]
}
```

**Why good:** Only the specified remote domains can call the notification API. The `urls` array uses the URLPattern standard -- `*` matches any subdomain.

**Security warnings:**

- Remote URLs gain access to the specified Tauri APIs -- this is a significant security surface
- On Linux and Android, Tauri cannot distinguish between `<iframe>` requests and window requests
- Only grant the minimum permissions needed to remote content
- Never grant filesystem or shell permissions to remote domains

---

## Pattern 8: Referencing Capabilities in tauri.conf.json

By default, all capability files in `src-tauri/capabilities/` are auto-enabled. To explicitly control which capabilities are active:

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "capabilities": ["shared-features", "editor-capability"]
    }
  }
}
```

**Key rule:** Once you add any entries to this array, ONLY the listed capabilities are used. Unlisted capability files are ignored. This is useful for excluding development-only capabilities from production builds.

**Development vs production pattern:**

Create a `dev-tools.json` capability with broad permissions for development. In production builds, omit it from the `capabilities` array in `tauri.conf.json`. In development, leave the array empty (or omit it entirely) so all capabilities are auto-discovered.

---

## Pattern 9: Inline Capabilities in tauri.conf.json

For simple apps, capabilities can be defined directly in `tauri.conf.json` instead of separate files.

```json
{
  "app": {
    "security": {
      "capabilities": [
        {
          "identifier": "main-capability",
          "description": "Main window permissions",
          "windows": ["main"],
          "permissions": ["core:default", "shell:allow-open", "dialog:default"]
        }
      ]
    }
  }
}
```

**When to inline:** Single-window apps with few permissions where a separate file feels like overkill.

**When NOT to inline:** Multi-window apps, apps with scoped permissions, or when you want IDE autocompletion from the `$schema` field.

---

## Pattern 10: Debugging Permission Errors

When a Tauri API call fails with "not allowed" or "permission denied":

**Step 1: Check the error message.** It usually names the specific permission that is missing, e.g., `fs.write_text_file not allowed`.

**Step 2: Verify the capability file.** Ensure the correct `plugin:permission-name` is listed in the `permissions` array.

```json
// The permission identifier MUST match the plugin and command
"permissions": [
  "fs:allow-write-text-file"
]
// NOT "fs:write-text-file" (missing allow/deny prefix)
// NOT "allow-write-text-file" (missing plugin prefix)
```

**Step 3: Check the `windows` array.** Ensure the window making the API call is listed. A common mistake is creating a new window programmatically but forgetting to add its label to a capability.

**Step 4: Check scopes.** If the permission has a scope, verify the path or URL matches. Remember deny always wins.

**Step 5: Check for stale ACL.** If you recently added a permission but it still fails:

```sh
# Clean the build to force ACL regeneration
cargo clean
cargo tauri dev
```

The build system embeds the ACL at compile time. If `build.rs` does not have `cargo:rerun-if-changed` for the capabilities directory, incremental builds may use a stale ACL.

**Step 6: Verify schema generation.** Run `cargo tauri dev` once to generate the schema files in `src-tauri/gen/schemas/`. The `$schema` field in capability files only works after schemas are generated.

---

## Pattern 11: Content Security Policy

Configure CSP in `tauri.conf.json` to control what the webview can load. This is separate from capabilities -- CSP restricts web content sources, capabilities restrict Tauri API access.

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: http://asset.localhost; style-src 'self' 'unsafe-inline'; connect-src ipc: http://ipc.localhost"
    }
  }
}
```

**Key CSP directives for Tauri:**

| Directive     | Value                           | Purpose                                         |
| ------------- | ------------------------------- | ----------------------------------------------- |
| `default-src` | `'self'`                        | Only allow loading from the app's own origin    |
| `connect-src` | `ipc: http://ipc.localhost`     | Required for Tauri command invocation           |
| `img-src`     | `asset: http://asset.localhost` | Required for loading bundled assets as images   |
| `style-src`   | `'self' 'unsafe-inline'`        | Allow inline styles (many frameworks need this) |

**Key rules:**

- Avoid `'unsafe-eval'` for scripts -- it allows arbitrary code execution
- The `ipc:` and `http://ipc.localhost` schemes are Tauri-specific for command invocation
- The `asset:` and `http://asset.localhost` schemes are for accessing bundled files
- If your frontend framework requires `'unsafe-eval'` in development, restrict it to dev-only configuration
