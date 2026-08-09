# Electron Multi-Window Reference

> Quick-lookup tables, migration checklist, event order. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## Window Type Comparison

| Feature               | BrowserWindow              | BaseWindow + WebContentsView         |
| --------------------- | -------------------------- | ------------------------------------ |
| Web views             | 1 (built-in)               | 0+ (added manually)                  |
| Has `webContents`     | Yes (automatic)            | No (each view has its own)           |
| `ready-to-show`       | Yes                        | No (listen on view's webContents)    |
| Auto-cleanup on close | Yes (destroys webContents) | No (must close webContents manually) |
| Preload scripts       | 1 (in webPreferences)      | 1 per WebContentsView                |
| Resize handling       | Automatic for content      | Manual via `resize` event            |
| Use case              | Single-view windows        | Multi-view layouts (tabs, panels)    |

---

## BrowserView to WebContentsView Migration Checklist

- [ ] Replace `new BrowserView(opts)` with `new WebContentsView(opts)`
- [ ] Replace `win.addBrowserView(view)` with `win.contentView.addChildView(view)`
- [ ] Replace `win.removeBrowserView(view)` with `win.contentView.removeChildView(view)`
- [ ] Replace `win.getBrowserViews()` with `win.contentView.children`
- [ ] Replace `win.setTopBrowserView(view)` with `win.contentView.addChildView(view)` (re-adding reorders)
- [ ] Replace `view.setAutoResize(...)` with manual `win.on("resize", ...)` + `view.setBounds(...)`
- [ ] Set `view.setBackgroundColor("#00000000")` if transparency is needed (WebContentsView defaults to white)
- [ ] Add explicit `view.webContents.close()` in window `closed` handler (no auto-cleanup)

---

## View API Quick Reference

| Method / Property        | Class            | Description                                      |
| ------------------------ | ---------------- | ------------------------------------------------ |
| `addChildView(view, i?)` | View             | Add child view; optional index for z-order       |
| `removeChildView(view)`  | View             | Remove child view (no-op if not a child)         |
| `children`               | View (read-only) | Array of child View objects                      |
| `setBounds(rect)`        | View             | Set position and size relative to parent         |
| `getBounds()`            | View             | Get position and size relative to parent         |
| `setBackgroundColor(c)`  | View             | Set background (hex, RGB, RGBA, HSL, CSS names)  |
| `setBorderRadius(r)`     | View             | Set border radius in pixels                      |
| `setVisible(bool)`       | View             | Show or hide the view                            |
| `getVisible()`           | View             | Whether the view should be drawn                 |
| `webContents`            | WebContentsView  | Read-only reference to the displayed WebContents |

---

## Window Lifecycle Events (Ordered)

| Event           | Preventable? | When                                      | Typical Use                      |
| --------------- | ------------ | ----------------------------------------- | -------------------------------- |
| `ready-to-show` | No           | First paint complete (BrowserWindow only) | Show window without flash        |
| `close`         | Yes          | Window is about to close                  | Save state, confirm unsaved work |
| `closed`        | No           | Window has been destroyed                 | Clean up registry, release refs  |

**Note:** `will-close` does not exist as a documented event. Use `close` with `event.preventDefault()` to intercept.

---

## Screen API Quick Reference

| Method / Event                         | Returns / Fires | Description                                    |
| -------------------------------------- | --------------- | ---------------------------------------------- |
| `screen.getAllDisplays()`              | `Display[]`     | All connected displays                         |
| `screen.getPrimaryDisplay()`           | `Display`       | The primary/main display                       |
| `screen.getDisplayNearestPoint(point)` | `Display`       | Display closest to a screen coordinate         |
| `screen.getDisplayMatching(rect)`      | `Display`       | Display that most overlaps with the given rect |
| `display-added`                        | Event           | New display connected                          |
| `display-removed`                      | Event           | Display disconnected                           |
| `display-metrics-changed`              | Event           | Display properties changed (resolution, etc.)  |

### Display Object Properties

| Property      | Type        | Description                                   |
| ------------- | ----------- | --------------------------------------------- |
| `id`          | `number`    | Unique display identifier                     |
| `bounds`      | `Rectangle` | Full display area including taskbar           |
| `workArea`    | `Rectangle` | Usable area excluding taskbar/dock            |
| `scaleFactor` | `number`    | DPI scale factor (1 = standard, 2 = retina)   |
| `rotation`    | `number`    | Display rotation in degrees (0, 90, 180, 270) |

**Key distinction:** Use `workArea` (not `bounds`) for window placement to avoid positioning behind taskbars or docks.

---

## Inter-Window Communication Methods

| Pattern            | Setup Complexity | Latency | Use Case                        |
| ------------------ | ---------------- | ------- | ------------------------------- |
| Main process relay | Low              | Medium  | Infrequent messages, state sync |
| MessagePort        | Medium           | Low     | High-frequency, streaming data  |
| Shared main state  | Low              | Medium  | App-wide settings, preferences  |

---

## Parent/Child Window Behavior by Platform

| Behavior                     | macOS                    | Windows / Linux |
| ---------------------------- | ------------------------ | --------------- |
| Modal display                | Sheet attached to parent | Separate window |
| Modal blocks parent          | Yes                      | Yes             |
| Child always above parent    | Yes                      | Yes             |
| Parent close closes children | Yes                      | Yes             |
| Child can outlive parent     | No                       | No              |

---

## See Also

- [Electron BaseWindow API](https://www.electronjs.org/docs/latest/api/base-window)
- [Electron WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [Electron View API](https://www.electronjs.org/docs/latest/api/view)
- [Electron Screen API](https://www.electronjs.org/docs/latest/api/screen)
- [BrowserView to WebContentsView Migration Guide](https://www.electronjs.org/blog/migrate-to-webcontentsview)
- [MessagePorts in Electron](https://www.electronjs.org/docs/latest/tutorial/message-ports)
