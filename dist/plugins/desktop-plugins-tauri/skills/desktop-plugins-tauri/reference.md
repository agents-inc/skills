# Tauri Plugins Quick Reference

> Quick-lookup tables, plugin registry, permission patterns, and platform support. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/core.md](examples/core.md) for installation patterns.

---

## Official Plugin Registry

| Plugin          | Cargo Crate                      | NPM Package                            | Platform                         | Init Pattern                    |
| --------------- | -------------------------------- | -------------------------------------- | -------------------------------- | ------------------------------- |
| File System     | `tauri-plugin-fs`                | `@tauri-apps/plugin-fs`                | All                              | `.init()`                       |
| Dialog          | `tauri-plugin-dialog`            | `@tauri-apps/plugin-dialog`            | All (folder picker desktop-only) | `.init()`                       |
| HTTP Client     | `tauri-plugin-http`              | `@tauri-apps/plugin-http`              | All                              | `.init()`                       |
| Store           | `tauri-plugin-store`             | `@tauri-apps/plugin-store`             | All                              | `Builder::new().build()`        |
| Notification    | `tauri-plugin-notification`      | `@tauri-apps/plugin-notification`      | All                              | `.init()`                       |
| Shell           | `tauri-plugin-shell`             | `@tauri-apps/plugin-shell`             | Desktop                          | `.init()`                       |
| Clipboard       | `tauri-plugin-clipboard-manager` | `@tauri-apps/plugin-clipboard-manager` | All                              | `.init()`                       |
| Updater         | `tauri-plugin-updater`           | `@tauri-apps/plugin-updater`           | Desktop                          | `Builder::new().build()`        |
| Deep Link       | `tauri-plugin-deep-link`         | `@tauri-apps/plugin-deep-link`         | All                              | `.init()`                       |
| Autostart       | `tauri-plugin-autostart`         | `@tauri-apps/plugin-autostart`         | Desktop                          | `init(MacosLauncher, args)`     |
| Global Shortcut | `tauri-plugin-global-shortcut`   | `@tauri-apps/plugin-global-shortcut`   | Desktop                          | `Builder::new().build()`        |
| Barcode Scanner | `tauri-plugin-barcode-scanner`   | `@tauri-apps/plugin-barcode-scanner`   | Mobile                           | `.init()`                       |
| Biometric       | `tauri-plugin-biometric`         | `@tauri-apps/plugin-biometric`         | Mobile                           | `.init()`                       |
| Log             | `tauri-plugin-log`               | `@tauri-apps/plugin-log`               | All                              | `Builder::new().build()`        |
| Process         | `tauri-plugin-process`           | `@tauri-apps/plugin-process`           | All                              | `.init()`                       |
| OS              | `tauri-plugin-os`                | `@tauri-apps/plugin-os`                | All                              | `.init()`                       |
| Window State    | `tauri-plugin-window-state`      | `@tauri-apps/plugin-window-state`      | Desktop                          | `Builder::default().build()`    |
| SQL             | `tauri-plugin-sql`               | `@tauri-apps/plugin-sql`               | All                              | `Builder::default().build()`    |
| Stronghold      | `tauri-plugin-stronghold`        | `@tauri-apps/plugin-stronghold`        | Desktop                          | `Builder::new(hash_fn).build()` |
| Single Instance | `tauri-plugin-single-instance`   | `@tauri-apps/plugin-single-instance`   | Desktop                          | `init(callback)`                |
| Geolocation     | `tauri-plugin-geolocation`       | `@tauri-apps/plugin-geolocation`       | Mobile                           | `.init()`                       |
| Haptics         | `tauri-plugin-haptics`           | `@tauri-apps/plugin-haptics`           | Mobile                           | `.init()`                       |
| NFC             | `tauri-plugin-nfc`               | `@tauri-apps/plugin-nfc`               | Mobile                           | `.init()`                       |
| Opener          | `tauri-plugin-opener`            | `@tauri-apps/plugin-opener`            | Desktop                          | `.init()`                       |
| Positioner      | `tauri-plugin-positioner`        | `@tauri-apps/plugin-positioner`        | Desktop                          | `.init()`                       |
| CLI             | `tauri-plugin-cli`               | `@tauri-apps/plugin-cli`               | Desktop                          | `.init()`                       |
| Localhost       | `tauri-plugin-localhost`         | `@tauri-apps/plugin-localhost`         | Desktop                          | `Builder::new(port).build()`    |
| Persisted Scope | `tauri-plugin-persisted-scope`   | `@tauri-apps/plugin-persisted-scope`   | All                              | `.init()`                       |
| Upload          | `tauri-plugin-upload`            | `@tauri-apps/plugin-upload`            | All                              | `.init()`                       |
| WebSocket       | `tauri-plugin-websocket`         | `@tauri-apps/plugin-websocket`         | All                              | `.init()`                       |

---

## Permission Pattern Reference

| Pattern                    | Meaning                       | Example                                                                                                       |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `<plugin>:default`         | Safe defaults for the plugin  | `"store:default"`                                                                                             |
| `<plugin>:allow-<command>` | Allow a specific command      | `"fs:allow-read-text-file"`                                                                                   |
| `<plugin>:deny-<command>`  | Deny a specific command       | `"shell:deny-execute"`                                                                                        |
| Scoped permission (object) | Allow with restrictions       | `{ "identifier": "fs:allow-read-text-file", "allow": [{ "path": "$APPDATA/**" }] }`                           |
| HTTP URL scope             | Restrict HTTP to domain       | `{ "identifier": "http:default", "allow": [{ "url": "https://api.example.com/**" }] }`                        |
| Shell command scope        | Restrict to specific commands | `{ "identifier": "shell:allow-execute", "allow": [{ "name": "run-git", "cmd": "git", "args": ["status"] }] }` |

---

## Platform Support Matrix

| Feature         | Windows | macOS | Linux | iOS                    | Android                |
| --------------- | ------- | ----- | ----- | ---------------------- | ---------------------- |
| File System     | Yes     | Yes   | Yes   | Yes                    | Yes                    |
| Dialog          | Yes     | Yes   | Yes   | Yes (no folder picker) | Yes (no folder picker) |
| HTTP            | Yes     | Yes   | Yes   | Yes                    | Yes                    |
| Store           | Yes     | Yes   | Yes   | Yes                    | Yes                    |
| Notification    | Yes     | Yes   | Yes   | Yes                    | Yes                    |
| Shell           | Yes     | Yes   | Yes   | No                     | No                     |
| Clipboard       | Yes     | Yes   | Yes   | Yes                    | Yes                    |
| Updater         | Yes     | Yes   | Yes   | No                     | No                     |
| Deep Link       | Yes     | Yes   | Yes   | Yes                    | Yes                    |
| Autostart       | Yes     | Yes   | Yes   | No                     | No                     |
| Global Shortcut | Yes     | Yes   | Yes   | No                     | No                     |
| Barcode Scanner | No      | No    | No    | Yes                    | Yes                    |
| Biometric       | No      | No    | No    | Yes                    | Yes                    |
| Log             | Yes     | Yes   | Yes   | Yes                    | Yes                    |
| SQL             | Yes     | Yes   | Yes   | Yes                    | Yes                    |
| Stronghold      | Yes     | Yes   | Yes   | No                     | No                     |
| Single Instance | Yes     | Yes   | Yes   | No                     | No                     |
| Window State    | Yes     | Yes   | Yes   | No                     | No                     |
| Geolocation     | No      | No    | No    | Yes                    | Yes                    |
| Haptics         | No      | No    | No    | Yes                    | Yes                    |
| NFC             | No      | No    | No    | Yes                    | Yes                    |

---

## SQL Plugin Feature Flags

| Database   | Cargo Feature | Connection String              |
| ---------- | ------------- | ------------------------------ |
| SQLite     | `sqlite`      | `sqlite:mydatabase.db`         |
| MySQL      | `mysql`       | `mysql://user:pass@host/db`    |
| PostgreSQL | `postgres`    | `postgres://user:pass@host/db` |

**Query placeholder syntax:**

- SQLite: `$1, $2, $3`
- MySQL: `?, ?, ?`
- PostgreSQL: `$1, $2, $3`

---

## Updater Endpoint JSON Formats

**Static JSON (multi-platform):**

```json
{
  "version": "1.0.1",
  "notes": "Release notes",
  "pub_date": "2025-01-15T12:00:00Z",
  "platforms": {
    "linux-x86_64": { "signature": "...", "url": "https://..." },
    "windows-x86_64": { "signature": "...", "url": "https://..." },
    "darwin-x86_64": { "signature": "...", "url": "https://..." },
    "darwin-aarch64": { "signature": "...", "url": "https://..." }
  }
}
```

**Dynamic server response:**

- HTTP 204: No update available
- HTTP 200: `{ "version": "1.0.1", "url": "...", "signature": "...", "notes": "..." }`

---

## Tauri Path Variables (for Permission Scopes)

| Variable        | Resolves To              |
| --------------- | ------------------------ |
| `$APPDATA`      | App data directory       |
| `$APPLOCALDATA` | App local data directory |
| `$APPCONFIG`    | App config directory     |
| `$APPCACHE`     | App cache directory      |
| `$APPLOG`       | App log directory        |
| `$HOME`         | User home directory      |
| `$RESOURCE`     | Bundled app resources    |
| `$TEMP`         | System temp directory    |
| `$DESKTOP`      | User desktop             |
| `$DOCUMENT`     | User documents           |
| `$DOWNLOAD`     | User downloads           |

---

## Log Plugin Targets

| Target Kind | Description               | Location         |
| ----------- | ------------------------- | ---------------- |
| `Stdout`    | Terminal standard output  | Console          |
| `Stderr`    | Terminal standard error   | Console          |
| `Webview`   | Browser devtools console  | Webview          |
| `LogDir`    | Application log directory | OS-specific path |
| `Folder`    | Custom directory          | Specified path   |

**Log directory defaults:**

- Linux: `~/.local/share/{bundleId}/logs`
- macOS: `~/Library/Logs/{bundleId}`
- Windows: `AppData\Local\{bundleId}\logs`

---

## See Also

- [Tauri v2 Plugin Documentation](https://v2.tauri.app/plugin/)
- [Tauri Plugins Repository](https://github.com/tauri-apps/plugins-workspace)
- [Plugin Development Guide](https://v2.tauri.app/develop/plugins/)
- [Mobile Plugin Development](https://v2.tauri.app/develop/plugins/develop-mobile/)
