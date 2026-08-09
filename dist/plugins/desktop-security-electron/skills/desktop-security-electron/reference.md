# Electron Security Quick Reference

> Quick-lookup tables, security checklist, and version reference. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## Production Security Checklist

### Fuses (Build-Time)

- [ ] `RunAsNode` disabled
- [ ] `EnableCookieEncryption` enabled
- [ ] `EnableNodeOptionsEnvironmentVariable` disabled
- [ ] `EnableNodeCliInspectArguments` disabled
- [ ] `EnableEmbeddedAsarIntegrityValidation` enabled
- [ ] `OnlyLoadAppFromAsar` enabled
- [ ] `GrantFileProtocolExtraPrivileges` disabled
- [ ] Fuses flipped BEFORE code signing
- [ ] Fuse state verified with `npx @electron/fuses read --app <path>`

### webPreferences (Runtime)

- [ ] `contextIsolation` is `true` (default since Electron 12)
- [ ] `nodeIntegration` is `false` (default since Electron 5)
- [ ] `sandbox` is `true` (default since Electron 20)
- [ ] `webSecurity` is `true` (default)
- [ ] `allowRunningInsecureContent` is `false` (default)
- [ ] No `experimentalFeatures` or `enableBlinkFeatures` enabled
- [ ] No `nodeIntegrationInSubFrames: true` for external iframes

### Content Security Policy

- [ ] CSP `<meta>` tag or session header present in all renderers
- [ ] No `'unsafe-eval'` in production CSP
- [ ] No `'unsafe-inline'` for `script-src` in production CSP
- [ ] No wildcard `*` origins in production CSP

### Permissions

- [ ] `setPermissionRequestHandler()` set with explicit allowlist
- [ ] `setPermissionCheckHandler()` set with same allowlist
- [ ] Default is deny -- only listed permissions are granted

### Navigation & Windows

- [ ] `will-navigate` handler blocks navigation away from app origin
- [ ] `setWindowOpenHandler` denies all new windows (opens external links in browser)
- [ ] `shell.openExternal()` validates URL protocol against allowlist

### Protocols & Deep Links

- [ ] Custom protocol registered with `secure: true`
- [ ] `GrantFileProtocolExtraPrivileges` fuse disabled
- [ ] Deep link URLs validated (protocol, path allowlist, length limit)
- [ ] Custom protocol handler validates file extension and prevents path traversal

### IPC

- [ ] Preload exposes only specific channel wrappers, not raw `ipcRenderer`
- [ ] Main process validates all IPC arguments (paths, URLs, data)
- [ ] Sensitive handlers verify `event.senderFrame` origin

---

## Fuse Defaults and Recommendations

| Fuse                                    | Default | Production | Attack Vector Prevented                     |
| --------------------------------------- | ------- | ---------- | ------------------------------------------- |
| `RunAsNode`                             | ON      | **OFF**    | `ELECTRON_RUN_AS_NODE=1 app malicious.js`   |
| `EnableCookieEncryption`                | OFF     | **ON**     | Plain-text cookie theft from disk           |
| `EnableNodeOptionsEnvironmentVariable`  | ON      | **OFF**    | `NODE_OPTIONS='--require malicious.js' app` |
| `EnableNodeCliInspectArguments`         | ON      | **OFF**    | `app --inspect` debugger attachment         |
| `EnableEmbeddedAsarIntegrityValidation` | OFF     | **ON**     | Modified `app.asar` code injection          |
| `OnlyLoadAppFromAsar`                   | OFF     | **ON**     | `app/` folder bypass of ASAR validation     |
| `LoadBrowserProcessSpecificV8Snapshot`  | OFF     | Keep       | N/A (performance, not security)             |
| `GrantFileProtocolExtraPrivileges`      | ON      | **OFF**    | `file://` fetch and universal frame access  |
| `WasmTrapHandlers`                      | ON      | Keep       | N/A (disabling increases WASM size)         |

---

## Electron Security Version History

| Version | Security Change                                              |
| ------- | ------------------------------------------------------------ |
| 5       | `nodeIntegration` defaults to `false`                        |
| 10      | `enableRemoteModule` defaults to `false`                     |
| 12      | `contextIsolation` defaults to `true`                        |
| 14      | `remote` module removed entirely                             |
| 20      | `sandbox` defaults to `true`                                 |
| 22      | `webviewTag` defaults to `false`; `utilityProcess` API added |
| 28      | `nativeWindowOpen` removed (was already default behavior)    |
| 29      | `GrantFileProtocolExtraPrivileges` fuse added                |
| 30      | ASAR integrity validation supported on Windows               |

---

## @electron/fuses CLI Reference

```bash
# Read fuse state of a packaged app
npx @electron/fuses read --app /path/to/MyApp.app

# Write fuse state (before code signing)
npx @electron/fuses write --app /path/to/MyApp.app \
  --RunAsNode=off \
  --EnableCookieEncryption=on \
  --EnableNodeOptionsEnvironmentVariable=off \
  --EnableNodeCliInspectArguments=off \
  --EnableEmbeddedAsarIntegrityValidation=on \
  --OnlyLoadAppFromAsar=on \
  --GrantFileProtocolExtraPrivileges=off
```

---

## See Also

- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Fuses Documentation](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [ASAR Integrity Documentation](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)
- [@electron/fuses on npm](https://www.npmjs.com/package/@electron/fuses)
- [Electron Forge Fuses Plugin](https://www.electronforge.io/config/plugins/fuses)
- [electron-builder Fuses Tutorial](https://www.electron.build/tutorials/adding-electron-fuses.html)
