# Electron Desktop UI Reference

> Quick-lookup tables and platform support matrix. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## Title Bar Options

| Option                                  | macOS                             | Windows                             | Linux                               | Notes                               |
| --------------------------------------- | --------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| `titleBarStyle: 'default'`              | Standard title bar                | Standard title bar                  | Standard title bar                  | Default behavior                    |
| `titleBarStyle: 'hidden'`               | Hides title, keeps traffic lights | Hides title bar entirely            | Hides title bar entirely            | Most common for custom title bars   |
| `titleBarStyle: 'hiddenInset'`          | Traffic lights inset further      | Same as hidden                      | Same as hidden                      | macOS only                          |
| `titleBarStyle: 'customButtonsOnHover'` | Traffic lights on hover only      | Same as hidden                      | Same as hidden                      | macOS only                          |
| `titleBarOverlay: true`                 | Not needed                        | Native min/max/close overlay        | Native min/max/close overlay        | Pair with `hidden` titleBarStyle    |
| `titleBarOverlay: { ... }`              | Not needed                        | Customized controls (color, height) | Customized controls (color, height) | `color`, `symbolColor`, `height`    |
| `trafficLightPosition: { x, y }`        | Repositions traffic lights        | N/A                                 | N/A                                 | Requires hidden or hiddenInset      |
| `frame: false`                          | No chrome at all                  | No chrome at all                    | No chrome at all                    | Must implement all controls in HTML |

---

## Vibrancy Values (macOS Only)

| Value           | Use Case                 | Notes                       |
| --------------- | ------------------------ | --------------------------- |
| `sidebar`       | App sidebars             | Most common choice          |
| `under-window`  | Entire window background | Full-window translucency    |
| `content`       | Content area             | Content region translucency |
| `header`        | Header/toolbar           | Toolbar areas               |
| `titlebar`      | Title bar                | Title bar translucency      |
| `tooltip`       | Tooltips                 | Tooltip backgrounds         |
| `menu`          | Menus                    | Menu backgrounds            |
| `popover`       | Popovers                 | Popover backgrounds         |
| `sheet`         | Sheets/dialogs           | Dialog backgrounds          |
| `hud`           | HUD displays             | Heads-up display            |
| `fullscreen-ui` | Fullscreen UI            | Fullscreen overlay          |
| `selection`     | Selection highlight      | Selected areas              |
| `window`        | Window background        | General window              |

**Deprecated values:** `appearance-based` -- use `sidebar` or `under-window` instead.

---

## Background Material Values (Windows 11 22H2+ Only)

| Value     | Use Case           | Notes                   |
| --------- | ------------------ | ----------------------- |
| `auto`    | Let DWM decide     | Default value           |
| `none`    | No system backdrop | Opaque background       |
| `mica`    | Long-lived windows | Subtle, primary windows |
| `acrylic` | Transient surfaces | Tooltips, menus, popups |
| `tabbed`  | Tabbed interfaces  | Tab-row effect          |

**Requirement:** Set `backgroundColor: '#00000000'` (NOT `transparent: true`).

---

## Always-On-Top Levels (Low to High)

| Level           | Position                         | Notes                          |
| --------------- | -------------------------------- | ------------------------------ |
| `normal`        | Regular window stacking          | Default when flag is false     |
| `floating`      | Above regular windows            | Default when flag is true      |
| `torn-off-menu` | Above floating                   | Torn-off menu windows          |
| `modal-panel`   | Above torn-off-menu              | Modal dialogs                  |
| `main-menu`     | Above modal-panel                | Main menu bar                  |
| `status`        | Above main-menu                  | Status bar level               |
| `pop-up-menu`   | Above status, above Dock/taskbar | Popup menus                    |
| `screen-saver`  | Highest                          | Above fullscreen apps on macOS |

Levels `floating` through `status` appear **below** the Dock (macOS) and taskbar (Windows). `pop-up-menu` and `screen-saver` appear above them.

---

## Badge API Platform Support

| Method                    | macOS              | Linux               | Windows              |
| ------------------------- | ------------------ | ------------------- | -------------------- |
| `app.setBadgeCount(n)`    | Numeric dock badge | Unity launcher only | Not supported        |
| `app.dock.setBadge(text)` | Text dock badge    | N/A                 | N/A                  |
| `app.dock.setIcon(image)` | Custom dock icon   | N/A                 | N/A                  |
| `tray.displayBalloon()`   | N/A                | N/A                 | Balloon notification |

---

## Tray Behavior by Platform

| Behavior            | macOS                                   | Windows                             | Linux                          |
| ------------------- | --------------------------------------- | ----------------------------------- | ------------------------------ |
| Left-click          | Shows context menu (if set)             | `click` event fires                 | `click` event fires            |
| Right-click         | Shows context menu                      | Shows context menu                  | Shows context menu             |
| Icon format         | 16x16 template image                    | `.ico` or `.png` (16x16 to 256x256) | `.png`                         |
| Dark/light mode     | Automatic with `setTemplateImage(true)` | Manual icon swap                    | Manual icon swap               |
| Desktop environment | Always available                        | Always available                    | Varies (GNOME needs extension) |

---

## Window Type Values

| Value          | Platform              | Behavior                                         |
| -------------- | --------------------- | ------------------------------------------------ |
| `desktop`      | macOS, Linux          | Desktop-level window                             |
| `dock`         | Linux                 | Dock-level window                                |
| `toolbar`      | macOS, Windows, Linux | Toolbar-style window                             |
| `splash`       | Linux                 | Splash screen (not draggable even with CSS drag) |
| `notification` | Linux                 | Notification-level window                        |
| `textured`     | macOS                 | Textured window appearance                       |
| `panel`        | macOS                 | Panel-style floating window                      |

---

## See Also

- [Electron Custom Title Bar Tutorial](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar)
- [Electron Window Customization](https://www.electronjs.org/docs/latest/tutorial/window-customization)
- [Electron Custom Window Interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions)
- [BaseWindowConstructorOptions](https://www.electronjs.org/docs/latest/api/structures/base-window-options)
- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray)
- [Electron Menu API](https://www.electronjs.org/docs/latest/api/menu)
