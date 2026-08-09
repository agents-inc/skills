# Tauri Multi-Window & Events Quick Reference

> Quick-lookup tables and decision frameworks. See [SKILL.md](../SKILL.md) for patterns and red flags. See [examples/core.md](examples/core.md) for full code examples.

---

## Event Method Comparison

| Method                                   | Scope                  | Available From | Use Case                                  |
| ---------------------------------------- | ---------------------- | -------------- | ----------------------------------------- |
| `emit(event, payload)`                   | Global (all windows)   | JS + Rust      | App-wide broadcasts (theme, logout)       |
| `emitTo(label, event, payload)`          | One window             | JS + Rust      | Targeted messages (file opened in editor) |
| `emit_filter(event, payload, predicate)` | Multiple windows       | Rust only      | Subset targeting (notify all viewers)     |
| `window.emit(event, payload)`            | Window-scoped (Rust)   | Rust           | Emit from a `WebviewWindow` handle        |
| `listen(event, handler)`                 | Global listener        | JS + Rust      | Receive from any emitter                  |
| `window.listen(event, handler)`          | Window-scoped listener | JS + Rust      | Receive only for this window              |
| `once(event, handler)`                   | One-time global        | JS + Rust      | Initialization, one-shot signals          |

---

## JavaScript Import Map

| Module                            | Import                                                               | Purpose                                   |
| --------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| `@tauri-apps/api/event`           | `emit`, `emitTo`, `listen`, `once`                                   | Global event functions                    |
| `@tauri-apps/api/webviewWindow`   | `WebviewWindow`, `getCurrentWebviewWindow`                           | Window creation + window-scoped events    |
| `@tauri-apps/api/webview`         | `Webview`, `getCurrentWebview`                                       | Webview-scoped operations (multi-webview) |
| `@tauri-apps/api/window`          | `Window`, `getCurrentWindow`                                         | Window control (close, focus, position)   |
| `@tauri-apps/api/dpi`             | `PhysicalPosition`, `PhysicalSize`, `LogicalPosition`, `LogicalSize` | Position/size types                       |
| `@tauri-apps/plugin-window-state` | `saveWindowState`, `restoreStateCurrent`, `StateFlags`               | Window state persistence                  |

---

## Rust Trait Map

| Trait      | Provides                                             | Import                 |
| ---------- | ---------------------------------------------------- | ---------------------- |
| `Emitter`  | `emit()`, `emit_to()`, `emit_filter()`               | `use tauri::Emitter;`  |
| `Listener` | `listen()`, `once()`, `unlisten()`                   | `use tauri::Listener;` |
| `Manager`  | `get_webview_window()`, `get_webview()`, `windows()` | `use tauri::Manager;`  |

---

## Window Creation Options (JavaScript)

| Option        | Type      | Default     | Purpose                                        |
| ------------- | --------- | ----------- | ---------------------------------------------- |
| `url`         | `string`  | -           | HTML file or URL to load                       |
| `title`       | `string`  | `""`        | Window title bar text                          |
| `width`       | `number`  | `800`       | Window width in logical pixels                 |
| `height`      | `number`  | `600`       | Window height in logical pixels                |
| `x`           | `number`  | OS default  | Window x position                              |
| `y`           | `number`  | OS default  | Window y position                              |
| `center`      | `boolean` | `false`     | Center on primary monitor                      |
| `resizable`   | `boolean` | `true`      | Allow user resize                              |
| `decorations` | `boolean` | `true`      | Show OS title bar                              |
| `alwaysOnTop` | `boolean` | `false`     | Stay above other windows                       |
| `visible`     | `boolean` | `true`      | Show immediately (set false for state restore) |
| `focused`     | `boolean` | `true`      | Focus on creation                              |
| `parent`      | `Window`  | `undefined` | Parent window for child/owned relationship     |
| `closable`    | `boolean` | `true`      | Allow close button                             |
| `minimizable` | `boolean` | `true`      | Allow minimize button                          |
| `maximizable` | `boolean` | `true`      | Allow maximize button                          |

---

## EventTarget Type (JavaScript)

Used with `emitTo()` for explicit target specification.

```typescript
type EventTarget =
  | { kind: "Any" }
  | { kind: "AnyLabel"; label: string }
  | { kind: "Webview"; label: string }
  | { kind: "WebviewWindow"; label: string };
```

Most common usage: pass the label string directly (shorthand for `WebviewWindow` target).

---

## Built-in Tauri Events

| Event                     | Trigger                             |
| ------------------------- | ----------------------------------- |
| `tauri://created`         | Window/webview successfully created |
| `tauri://error`           | Window/webview creation failed      |
| `tauri://close-requested` | User clicked close button           |
| `tauri://destroyed`       | Window/webview destroyed            |
| `tauri://focus`           | Window gained focus                 |
| `tauri://blur`            | Window lost focus                   |
| `tauri://resize`          | Window resized                      |
| `tauri://move`            | Window moved                        |
| `tauri://scale-change`    | Display scale factor changed        |
| `tauri://theme-changed`   | OS theme changed (light/dark)       |
| `tauri://webview-created` | A new webview was created           |

---

## Window State Plugin Permissions

| Permission                             | Purpose                                             |
| -------------------------------------- | --------------------------------------------------- |
| `window-state:default`                 | Includes filename, restore-state, save-window-state |
| `window-state:allow-filename`          | Access state file path                              |
| `window-state:allow-restore-state`     | Restore window state                                |
| `window-state:allow-save-window-state` | Save window state                                   |

---

## Decision Quick Reference

| Question                         | Answer                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- |
| How to target one window?        | `emitTo(label, event, payload)`                                                 |
| How to target all windows?       | `emit(event, payload)`                                                          |
| How to target multiple windows?  | `emit_filter()` (Rust) or multiple `emitTo()` (JS)                              |
| How to prevent close?            | `onCloseRequested` + `event.preventDefault()`                                   |
| How to force-close?              | `window.destroy()` (skips close-requested)                                      |
| How to persist window state?     | `tauri-plugin-window-state`                                                     |
| How to avoid flash on restore?   | Set `visible: false` in config                                                  |
| How to make a child window?      | Set `parent` option in creation                                                 |
| How to split window into panels? | Multi-webview with `unstable` feature                                           |
| How to check if window exists?   | `WebviewWindow.getByLabel(label)` (JS) / `app.get_webview_window(label)` (Rust) |

---

See [SKILL.md](SKILL.md) for the full decision framework and red flags.
