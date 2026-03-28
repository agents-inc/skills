# Tauri Reference

> Quick-lookup tables, CLI commands, config reference, and migration checklist. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/core.md](examples/core.md) for full code examples.

---

## Tauri CLI Commands

| Command                       | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `cargo tauri init`            | Initialize Tauri in an existing project       |
| `cargo tauri dev`             | Start dev server with hot reload              |
| `cargo tauri build`           | Build production binary                       |
| `cargo tauri icon`            | Generate app icons from source image          |
| `cargo tauri add <plugin>`    | Add an official plugin (Cargo + registration) |
| `cargo tauri android init`    | Initialize Android project                    |
| `cargo tauri ios init`        | Initialize iOS project                        |
| `cargo tauri android dev`     | Dev on Android emulator/device                |
| `cargo tauri ios dev`         | Dev on iOS simulator/device                   |
| `cargo tauri signer generate` | Generate keys for the updater plugin          |
| `cargo tauri completions`     | Generate shell completions                    |

**Note:** `cargo tauri` requires `tauri-cli`. Install with `cargo install tauri-cli`.

---

## tauri.conf.json Key Fields

| Field                       | Purpose                   | Example                      |
| --------------------------- | ------------------------- | ---------------------------- |
| `productName`               | App display name          | `"My App"`                   |
| `version`                   | App version (semver)      | `"1.0.0"`                    |
| `identifier`                | Reverse-domain app ID     | `"com.example.myapp"`        |
| `build.devUrl`              | Frontend dev server URL   | `"http://localhost:5173"`    |
| `build.frontendDist`        | Path to built frontend    | `"../dist"`                  |
| `app.windows[].title`       | Default window title      | `"My App"`                   |
| `app.windows[].width`       | Default window width      | `1024`                       |
| `app.windows[].height`      | Default window height     | `768`                        |
| `app.windows[].resizable`   | Allow window resize       | `true`                       |
| `app.windows[].decorations` | Show OS title bar         | `true`                       |
| `app.security.csp`          | Content Security Policy   | `"default-src 'self'"`       |
| `app.withGlobalTauri`       | Expose `window.__TAURI__` | `false`                      |
| `bundle.active`             | Enable bundling           | `true`                       |
| `bundle.targets`            | Platform bundle formats   | `["deb", "appimage", "msi"]` |
| `bundle.icon`               | Icon paths                | `["icons/icon.png"]`         |

---

## Tauri Path Variables

Use in capability file scopes and `tauri::path` resolvers.

| Variable        | Resolves To                                                 |
| --------------- | ----------------------------------------------------------- |
| `$APPDATA`      | App data directory (`~/.local/share/<identifier>` on Linux) |
| `$APPLOCALDATA` | App local data directory                                    |
| `$APPCONFIG`    | App config directory (`~/.config/<identifier>` on Linux)    |
| `$APPCACHE`     | App cache directory                                         |
| `$APPLOG`       | App log directory                                           |
| `$HOME`         | User home directory                                         |
| `$RESOURCE`     | App resource directory (bundled assets)                     |
| `$TEMP`         | System temp directory                                       |
| `$DESKTOP`      | User desktop directory                                      |
| `$DOCUMENT`     | User documents directory                                    |
| `$DOWNLOAD`     | User downloads directory                                    |

---

## Official Plugin Registry

| Plugin          | Cargo Crate                      | NPM Package                            | Purpose                           |
| --------------- | -------------------------------- | -------------------------------------- | --------------------------------- |
| File System     | `tauri-plugin-fs`                | `@tauri-apps/plugin-fs`                | Read/write files                  |
| Dialog          | `tauri-plugin-dialog`            | `@tauri-apps/plugin-dialog`            | File/folder picker, message box   |
| HTTP            | `tauri-plugin-http`              | `@tauri-apps/plugin-http`              | HTTP requests from backend        |
| Store           | `tauri-plugin-store`             | `@tauri-apps/plugin-store`             | Persistent key-value storage      |
| Notification    | `tauri-plugin-notification`      | `@tauri-apps/plugin-notification`      | System notifications              |
| Shell           | `tauri-plugin-shell`             | `@tauri-apps/plugin-shell`             | Run external processes            |
| Clipboard       | `tauri-plugin-clipboard-manager` | `@tauri-apps/plugin-clipboard-manager` | System clipboard                  |
| Updater         | `tauri-plugin-updater`           | `@tauri-apps/plugin-updater`           | Auto-update                       |
| Deep Link       | `tauri-plugin-deep-link`         | `@tauri-apps/plugin-deep-link`         | Custom URL scheme                 |
| Autostart       | `tauri-plugin-autostart`         | `@tauri-apps/plugin-autostart`         | Launch on login                   |
| Global Shortcut | `tauri-plugin-global-shortcut`   | `@tauri-apps/plugin-global-shortcut`   | System-wide hotkeys               |
| Barcode Scanner | `tauri-plugin-barcode-scanner`   | `@tauri-apps/plugin-barcode-scanner`   | Mobile barcode scanning           |
| Biometric       | `tauri-plugin-biometric`         | `@tauri-apps/plugin-biometric`         | Fingerprint/Face ID (mobile)      |
| Log             | `tauri-plugin-log`               | `@tauri-apps/plugin-log`               | Structured logging                |
| Process         | `tauri-plugin-process`           | `@tauri-apps/plugin-process`           | App process info, exit, restart   |
| OS              | `tauri-plugin-os`                | `@tauri-apps/plugin-os`                | OS info (platform, arch, version) |
| Window State    | `tauri-plugin-window-state`      | `@tauri-apps/plugin-window-state`      | Persist window position/size      |
| SQL             | `tauri-plugin-sql`               | `@tauri-apps/plugin-sql`               | SQLite/MySQL/PostgreSQL           |

---

## Default Permission Groups

Each plugin provides a `:default` permission set with safe defaults. Add granular permissions as needed.

| Permission Pattern         | Meaning                              |
| -------------------------- | ------------------------------------ |
| `core:default`             | Basic app lifecycle (always include) |
| `window:default`           | Window management basics             |
| `event:default`            | Event emit/listen                    |
| `path:default`             | Path resolution                      |
| `<plugin>:default`         | Plugin safe defaults                 |
| `<plugin>:allow-<command>` | Allow a specific plugin command      |
| `<plugin>:deny-<command>`  | Deny a specific plugin command       |

---

## Tauri v1 to v2 Migration Checklist

1. **Replace `tauri.allowlist`** in config with capability files in `src-tauri/capabilities/`
2. **Replace `@tauri-apps/api/tauri`** imports with `@tauri-apps/api/core`
3. **Replace `tauri::api::*`** Rust imports with plugin crates (fs, dialog, http, etc.)
4. **Replace `SystemTray`** with `TrayIconBuilder` from `tauri::tray`
5. **Replace `tauri::Manager::emit_all`** with `app.emit()` (scoped emitting)
6. **Add `#[cfg_attr(mobile, tauri::mobile_entry_point)]`** to `pub fn run()`
7. **Create capability files** granting permissions for all used features
8. **Update `tauri-build` and `tauri` crate versions** to 2.x
9. **Update all plugin crates** to their v2 equivalents (`tauri-plugin-*` 2.x)
10. **Update JS package** `@tauri-apps/api` to 2.x

---

## See Also

- [Tauri v2 Documentation](https://v2.tauri.app)
- [Tauri v2 Migration Guide](https://v2.tauri.app/start/migrate/from-tauri-1/)
- [Tauri Plugins Repository](https://github.com/tauri-apps/plugins-workspace)
- [Tauri v2 Security Model](https://v2.tauri.app/security/)
