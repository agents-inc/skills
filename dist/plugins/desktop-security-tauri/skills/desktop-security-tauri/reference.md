# Tauri Capabilities & ACL Reference

> Quick-lookup tables, permission identifier patterns, path variables, core permissions, migration checklist. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/core.md](examples/core.md) for full code examples.

---

## Permission Identifier Patterns

| Pattern                    | Example                   | Meaning                                                       |
| -------------------------- | ------------------------- | ------------------------------------------------------------- |
| `core:default`             | `core:default`            | All default core permissions (app, event, window, path, etc.) |
| `<plugin>:default`         | `fs:default`              | Plugin's safe default permission set                          |
| `<plugin>:allow-<command>` | `fs:allow-read-text-file` | Allow a specific plugin command                               |
| `<plugin>:deny-<command>`  | `fs:deny-write-text-file` | Deny a specific plugin command                                |
| `allow-<command>`          | `allow-greet`             | Allow an app-defined command (no prefix)                      |
| `deny-<command>`           | `deny-reset-database`     | Deny an app-defined command (no prefix)                       |
| `<set-name>`               | `editor-commands`         | Reference a custom permission set                             |

**Key rule:** Plugin permissions always use the `plugin:` prefix. App-defined permissions never use a prefix.

**Identifier restrictions:** Lowercase ASCII letters `[a-z]`, hyphens `-`, and colons `:` only. Max length: 116 characters. No digits after the first character.

---

## Core Default Permissions

`core:default` bundles these permission groups:

| Group                    | Includes                                                         | Purpose                               |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------- |
| `core:app:default`       | `allow-version`, `allow-name`, `allow-tauri-version`             | App metadata                          |
| `core:event:default`     | `allow-listen`, `allow-unlisten`, `allow-emit`, `allow-emit-to`  | Event system                          |
| `core:window:default`    | Position, size, focus, state queries                             | Window info (read-only safe defaults) |
| `core:path:default`      | `allow-resolve-directory`, `allow-join`, `allow-normalize`, etc. | Path utilities                        |
| `core:image:default`     | Image operations                                                 | Image handling                        |
| `core:menu:default`      | Menu operations                                                  | App/context menus                     |
| `core:tray:default`      | Tray operations                                                  | System tray                           |
| `core:webview:default`   | Webview operations                                               | Webview management                    |
| `core:resources:default` | Resource operations                                              | Bundled resource access               |

**Always include `core:default`** in every capability. Without it, basic operations like event listening and window title queries fail.

---

## Tauri Path Variables

Use in capability file scopes. These are Tauri-specific, not environment variables.

| Variable        | Resolves to                                                                            | Typical use                        |
| --------------- | -------------------------------------------------------------------------------------- | ---------------------------------- |
| `$APPDATA`      | App data dir (`~/.local/share/<id>` Linux, `~/Library/Application Support/<id>` macOS) | User data, databases               |
| `$APPCONFIG`    | App config dir (`~/.config/<id>` Linux)                                                | Settings, preferences              |
| `$APPCACHE`     | App cache dir                                                                          | Temporary cached data              |
| `$APPLOG`       | App log dir                                                                            | Log files                          |
| `$APPLOCALDATA` | App local data dir                                                                     | Platform-specific local data       |
| `$HOME`         | User home directory                                                                    | Broad user access (use cautiously) |
| `$RESOURCE`     | App resource dir (bundled assets)                                                      | Read-only bundled files            |
| `$TEMP`         | System temp directory                                                                  | Temporary files                    |
| `$DESKTOP`      | User desktop dir                                                                       | Desktop shortcuts, exports         |
| `$DOCUMENT`     | User documents dir                                                                     | User documents                     |
| `$DOWNLOAD`     | User downloads dir                                                                     | Downloaded files                   |

**Glob patterns:** `$APPDATA/*` = direct children. `$APPDATA/**` = all descendants recursively.

---

## Capability File Quick Reference

### Minimal capability

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

### Scoped permission (inline)

```json
{
  "identifier": "fs:allow-read-text-file",
  "allow": [{ "path": "$APPDATA/**" }]
}
```

### Deny scope (inline)

```json
{
  "identifier": "fs:deny-read-text-file",
  "deny": [{ "path": "$HOME/.ssh/**" }]
}
```

### Platform restriction

```json
{
  "platforms": ["linux", "macOS", "windows"]
}
```

### Remote domain access

```json
{
  "remote": { "urls": ["https://*.example.com"] }
}
```

---

## Common Plugin Permission Identifiers

| Plugin           | Common Permissions                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **fs**           | `fs:default`, `fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:allow-exists`, `fs:allow-mkdir`, `fs:allow-remove`, `fs:allow-rename`, `fs:allow-copy-file` |
| **dialog**       | `dialog:default`, `dialog:allow-open`, `dialog:allow-save`, `dialog:allow-message`, `dialog:allow-ask`, `dialog:allow-confirm`                                       |
| **http**         | `http:default`, `http:allow-fetch`                                                                                                                                   |
| **shell**        | `shell:allow-open`, `shell:allow-execute`, `shell:default`                                                                                                           |
| **notification** | `notification:default`, `notification:allow-notify`, `notification:allow-request-permission`                                                                         |
| **store**        | `store:default`, `store:allow-get`, `store:allow-set`, `store:allow-delete`, `store:allow-keys`, `store:allow-clear`                                                 |
| **clipboard**    | `clipboard-manager:default`, `clipboard-manager:allow-read-text`, `clipboard-manager:allow-write-text`                                                               |
| **process**      | `process:default`, `process:allow-exit`, `process:allow-restart`                                                                                                     |
| **updater**      | `updater:default`                                                                                                                                                    |
| **os**           | `os:default`, `os:allow-platform`, `os:allow-arch`, `os:allow-version`                                                                                               |

**Finding available permissions:** Use the `$schema` field in your capability file pointing to the generated schema (`../gen/schemas/desktop-schema.json`). Your IDE will autocomplete all available permission identifiers.

---

## Tauri v1 to v2 Security Migration

| v1 (allowlist in tauri.conf.json)             | v2 (capability files)                               |
| --------------------------------------------- | --------------------------------------------------- |
| `"allowlist": { "fs": { "all": true } }`      | `"fs:default"` + scoped `fs:allow-*` permissions    |
| `"allowlist": { "fs": { "readFile": true } }` | `"fs:allow-read-text-file"` with path scope         |
| `"allowlist": { "shell": { "open": true } }`  | `"shell:allow-open"`                                |
| `"allowlist": { "dialog": { "all": true } }`  | `"dialog:default"`                                  |
| `"allowlist": { "http": { "all": true } }`    | `"http:default"` with URL scope                     |
| Scope defined in tauri.conf.json              | Scope defined inline in capability file permissions |
| Global boolean per API                        | Per-window, per-platform, per-path granular control |

### Migration steps

1. Run `npm run tauri migrate` (or `cargo tauri migrate`) -- auto-generates capability files from v1 allowlist
2. Review generated capabilities -- the migration tool may grant overly broad permissions
3. Add path scopes to filesystem permissions
4. Add URL scopes to HTTP permissions
5. Split capabilities by window if you have multiple windows
6. Remove `"allowlist"` from `tauri.conf.json` (it is ignored in v2)
7. Test every feature -- missing permissions only surface at runtime

**Key differences:**

- v1 was global on/off. v2 is per-window, per-platform, per-path.
- v1 had no deny mechanism. v2 has deny scopes that always win over allow.
- v1 scopes were in config. v2 scopes are inline in capability files.
- v2 permissions are runtime-checked, not compile-time-checked.

---

## Debugging Checklist

When a Tauri API call fails:

1. [ ] Error message names the missing permission -- add it to the capability file
2. [ ] Permission uses correct format: `plugin:permission-name` for plugins, `permission-name` for app commands
3. [ ] The calling window's label is in the capability's `windows` array
4. [ ] Path/URL scopes match the actual paths/URLs being accessed
5. [ ] No deny scope is blocking the operation (deny always wins)
6. [ ] Build is not using stale ACL -- run `cargo clean && cargo tauri dev`
7. [ ] Schema files exist in `src-tauri/gen/schemas/` (run `cargo tauri dev` once to generate)
8. [ ] If using `app.security.capabilities` in config, the capability is listed there
9. [ ] Platform field (if set) includes the current platform
10. [ ] Plugin is registered in Rust with `.plugin(tauri_plugin_<name>::init())` or `.plugin(tauri_plugin_<name>::Builder::new().build())`
