# Electron Type-Safe IPC Reference

> Quick-lookup tables, decision frameworks, and security checklist. See [SKILL.md](SKILL.md) for patterns and philosophy. See [examples/](examples/) for full code implementations.

---

## IPC Methods Quick Reference

| Pattern                 | Main API                             | Preload API              | Direction         | Returns   |
| ----------------------- | ------------------------------------ | ------------------------ | ----------------- | --------- |
| Request-response        | `ipcMain.handle(ch, handler)`        | `ipcRenderer.invoke(ch)` | Renderer --> Main | `Promise` |
| Fire-and-forget         | `ipcMain.on(ch, handler)`            | `ipcRenderer.send(ch)`   | Renderer --> Main | `void`    |
| Main pushes to renderer | `webContents.send(ch, data)`         | `ipcRenderer.on(ch, cb)` | Main --> Renderer | `void`    |
| Synchronous (avoid)     | `ipcMain.on()` + `event.returnValue` | `sendSync()` (blocks!)   | Renderer --> Main | sync      |
| Port-based              | `MessageChannelMain`                 | `MessagePort`            | Bidirectional     | `void`    |
| Utility process         | `child.postMessage()`                | `parentPort.postMessage` | Main <-> Utility  | `void`    |

---

## Type Safety Approaches Comparison

| Approach                    | Dependencies          | Type Safety Level | Effort | Best For               |
| --------------------------- | --------------------- | ----------------- | ------ | ---------------------- |
| Shared channel map + wraps  | None                  | Compile-time      | Low    | 1-10 IPC channels      |
| electron-trpc               | `electron-trpc`, tRPC | Compile + runtime | Medium | 10+ channels, complex  |
| @electron-toolkit/typed-ipc | `@electron-toolkit/*` | Compile-time      | Low    | Drop-in typed wrappers |

---

## Channel Map Type Patterns

| Communication Pattern | Type Shape                         | Example                                              |
| --------------------- | ---------------------------------- | ---------------------------------------------------- |
| Request-response      | `channel: (...args) => ReturnType` | `"file:read": (path: string) => { content: string }` |
| Fire-and-forget       | `channel: [...args]`               | `"log:error": [message: string, stack?: string]`     |
| Main-to-renderer push | `channel: PayloadType`             | `"update:progress": { percent: number }`             |

---

## Port Transfer Methods

Standard IPC methods (`send`, `invoke`) **cannot** transfer MessagePort objects. You must use:

| Method                      | Process          | Usage                            |
| --------------------------- | ---------------- | -------------------------------- |
| `webContents.postMessage()` | Main             | Transfer port to renderer        |
| `ipcRenderer.postMessage()` | Renderer/Preload | Transfer port to main            |
| `child.postMessage()`       | Main             | Transfer port to utility process |
| `parentPort.postMessage()`  | Utility process  | Transfer port back to main       |

---

## Security Checklist for IPC

- [ ] Preload exposes only specific channel wrappers, not raw `ipcRenderer`
- [ ] All `ipcMain.handle()` handlers validate argument types
- [ ] File path arguments are resolved and checked against allowed directories
- [ ] String arguments are length-limited
- [ ] Channel names use a namespace prefix (`file:`, `app:`, `dialog:`)
- [ ] `ipcRenderer.on()` listeners are cleaned up on component unmount
- [ ] No `sendSync` usage (blocks renderer thread)
- [ ] `contextIsolation` is `true` (default since Electron 12)
- [ ] `nodeIntegration` is `false` (default since Electron 5)
- [ ] `shell.openExternal()` validates URLs against an allowlist

---

## electron-trpc Checklist

- [ ] `exposeElectronTRPC()` called in preload script
- [ ] `createIPCHandler({ router, windows: [win] })` in main process after `app.whenReady()`
- [ ] Router exported as `type AppRouter = typeof router` for renderer client
- [ ] `createTRPCProxyClient<AppRouter>({ links: [ipcLink()] })` in renderer
- [ ] SuperJSON transformer configured if procedures return `Date`, `Map`, or `Set`
- [ ] Subscriptions handle auto-cancel on navigation (resubscribe if SPA)

---

## See Also

- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron MessagePorts](https://www.electronjs.org/docs/latest/tutorial/message-ports)
- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [Electron contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge)
- [electron-trpc documentation](https://electron-trpc.dev/)
