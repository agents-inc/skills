# Tauri - Security & Permissions

> Capability files, permission scoping, custom permissions, CSP. See [SKILL.md](../SKILL.md) for red flags. See [core.md](core.md) for commands and IPC.

---

## Capability File Structure

Capabilities live in `src-tauri/capabilities/` as JSON or TOML files. Each defines permissions for specific windows.

```json
// src-tauri/capabilities/main.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Permissions for the main application window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "event:default",
    "window:default",
    "path:default",
    "app:default",
    "image:default",
    "resources:default",
    "menu:default",
    "tray:default"
  ]
}
```

**Why this pattern:** Every Tauri 2 app needs at least one capability file. The `core:default` permission is essential -- without it, basic app lifecycle commands fail. The `$schema` field enables IDE autocompletion for available permissions.

**Key rule:** Permissions are scoped to the `windows` array. A window not listed in any capability has zero permissions.

---

## Scoped Permissions

Restrict plugin operations to specific paths or parameters using inline scope objects.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "file-access",
  "description": "Scoped file system access",
  "windows": ["main"],
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/**" }, { "path": "$RESOURCE/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:deny-read-text-file",
      "deny": [{ "path": "$APPDATA/secrets/**" }]
    }
  ]
}
```

**Why this pattern:** Scopes enforce the principle of least privilege. The app can read from app data and resources, write only to app data, and is explicitly denied access to a secrets subdirectory. Deny rules take precedence over allow rules.

**Path variable reference:** `$APPDATA`, `$APPCONFIG`, `$APPCACHE`, `$APPLOG`, `$APPLOCALDATA`, `$HOME`, `$RESOURCE`, `$TEMP`, `$DESKTOP`, `$DOCUMENT`, `$DOWNLOAD`. See [reference.md](../reference.md) for the full list.

---

## Multi-Window Capabilities

Different windows can have different permission sets.

```json
// src-tauri/capabilities/editor.json
{
  "identifier": "editor-capability",
  "description": "Full permissions for the editor window",
  "windows": ["editor"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "dialog:default"
  ]
}
```

```json
// src-tauri/capabilities/viewer.json
{
  "identifier": "viewer-capability",
  "description": "Read-only permissions for the viewer window",
  "windows": ["viewer"],
  "permissions": [
    "core:default",
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$RESOURCE/**" }]
    }
  ]
}
```

**Why this pattern:** Principle of least privilege per window. The editor gets full file access, while the viewer can only read bundled resources. If a window is compromised, it cannot exceed its capability.

---

## Custom Command Permissions

When you write custom Tauri commands, they are accessible by default. To add permission control over custom commands, define permission files.

```toml
# src-tauri/permissions/my-commands/default.toml
[[permission]]
identifier = "allow-greet"
description = "Allow the greet command"
commands.allow = ["greet"]

[[permission]]
identifier = "allow-admin"
description = "Allow admin operations"
commands.allow = ["reset_database", "export_all"]
```

```json
// Reference in capability file
{
  "permissions": ["core:default", "my-commands:allow-greet"]
}
```

**Why this pattern:** Custom permissions let you control access to your own commands, not just plugin commands. Useful for multi-window apps where some windows should not access admin operations.

---

## Content Security Policy

Configure CSP in `tauri.conf.json` to control what the webview can load.

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: http://asset.localhost; style-src 'self' 'unsafe-inline'; connect-src ipc: http://ipc.localhost"
    }
  }
}
```

**Why this pattern:** CSP prevents XSS by restricting the sources of executable content. The `asset:` and `http://asset.localhost` schemes are Tauri-specific for accessing bundled assets. `ipc:` and `http://ipc.localhost` are required for Tauri command invocation.

**Key rule:** Avoid `'unsafe-eval'` and `'unsafe-inline'` for scripts. If your frontend framework requires them during development, restrict them to dev-only configuration.

---

## Platform-Specific Capabilities

Target capabilities to specific platforms using the `platforms` field.

```json
{
  "identifier": "desktop-capability",
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
{
  "identifier": "mobile-capability",
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

**Why this pattern:** Some plugins are platform-specific. Splitting capabilities by platform prevents permission errors on platforms where a plugin is unavailable.

---

See [plugins.md](plugins.md) for plugin installation and [reference.md](../reference.md) for the full permission pattern reference.
