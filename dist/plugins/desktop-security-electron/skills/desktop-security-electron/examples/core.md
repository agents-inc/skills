# Electron Security - Fuses, ASAR Integrity & webPreferences

> Fuse configuration with `@electron/fuses`, ASAR integrity validation, secure webPreferences audit. See [csp-permissions.md](csp-permissions.md) for CSP and permission handling. See [navigation-protocols.md](navigation-protocols.md) for navigation restrictions and custom protocols. See [SKILL.md](../SKILL.md) for decision frameworks and red flags.

---

## Fuse Reference Table

Every fuse, its default, and the recommended production setting:

| FuseV1Options Constant                  | Default  | Recommended | Effect When Disabled/Enabled                                                           |
| --------------------------------------- | -------- | ----------- | -------------------------------------------------------------------------------------- |
| `RunAsNode`                             | Enabled  | **Disable** | Prevents `ELECTRON_RUN_AS_NODE` env var from turning app into a plain Node.js process  |
| `EnableCookieEncryption`                | Disabled | **Enable**  | Encrypts on-disk cookies with OS-level cryptography (matches Chrome behavior)          |
| `EnableNodeOptionsEnvironmentVariable`  | Enabled  | **Disable** | Prevents `NODE_OPTIONS` and `NODE_EXTRA_CA_CERTS` env vars from injecting options      |
| `EnableNodeCliInspectArguments`         | Enabled  | **Disable** | Prevents `--inspect` / `--inspect-brk` / SIGUSR1 from attaching a debugger             |
| `EnableEmbeddedAsarIntegrityValidation` | Disabled | **Enable**  | Validates `app.asar` header hash at runtime (macOS 16+, Windows 30+)                   |
| `OnlyLoadAppFromAsar`                   | Disabled | **Enable**  | Prevents loading app code from outside the ASAR archive                                |
| `LoadBrowserProcessSpecificV8Snapshot`  | Disabled | Keep        | Uses `browser_v8_context_snapshot.bin` instead of shared snapshot                      |
| `GrantFileProtocolExtraPrivileges`      | Enabled  | **Disable** | Removes `file://` fetch access and universal frame access                              |
| `WasmTrapHandlers`                      | Enabled  | Keep        | Uses signal handlers for WebAssembly memory protection (disabling increases WASM size) |

---

## Flipping Fuses with @electron/fuses (Direct API)

```javascript
// build-scripts/flip-fuses.js
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const path = require("node:path");

const ELECTRON_BINARY_PATH = path.resolve("dist/mac-arm64/MyApp.app");

async function configureProductionFuses() {
  await flipFuses(ELECTRON_BINARY_PATH, {
    version: FuseVersion.V1,
    // Disable attack vectors
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    // Enable protections
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // Leave at defaults
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    // For arm64 macOS when not immediately code-signing:
    // resetAdHocDarwinSignature: true,
  });
}

configureProductionFuses();
```

**Why good:** All security-relevant fuses explicitly configured, named constant for the binary path, comments explain intent for each group of fuses.

### Validating Fuses After Build

```bash
# Read current fuse state of a packaged app
npx @electron/fuses read --app /Applications/MyApp.app

# Output shows each fuse and its current state (enabled/disabled)
```

---

## Flipping Fuses with Electron Forge

```javascript
// forge.config.js
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};
```

**Key point:** The `FusesPlugin` automatically resolves the Electron binary path -- you do not pass it manually. Install both `@electron-forge/plugin-fuses` and `@electron/fuses` as dev dependencies.

---

## Flipping Fuses with electron-builder

### Option A: electronFuses Config Property

```javascript
// electron-builder.config.js
module.exports = {
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    loadBrowserProcessSpecificV8Snapshot: false,
    grantFileProtocolExtraPrivileges: false,
  },
};
```

### Option B: afterPack Hook (Advanced)

```javascript
// build-scripts/after-pack.js
const { FuseVersion, FuseV1Options } = require("@electron/fuses");

exports.default = async function afterPack(context) {
  await context.packager.addElectronFuses(context, {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  });
};
```

**When to use Option B:** When you need `strictlyRequireAllFuses: true` (fails the build if any fuse is unconfigured) or custom logic per-platform. The `afterPack` hook receives the full packaging context.

**Gotcha with `strictlyRequireAllFuses`:** If a new Electron version adds a fuse you haven't configured, the build will fail until you add it. This is intentional -- it forces you to make a conscious decision about every fuse.

---

## ASAR Integrity Configuration

### Automatic (Electron Forge / Packager)

Electron Forge (7.4.0+) and `@electron/packager` (18.3.1+) automatically generate integrity metadata when ASAR is enabled. No extra configuration needed beyond enabling the two fuses.

### How It Works

Each ASAR archive stores a JSON header containing:

```json
{
  "algorithm": "SHA256",
  "hash": "<header-hash>",
  "blockSize": 1024,
  "blocks": ["<block-1-hash>", "<block-2-hash>"]
}
```

At runtime, Electron verifies the header hash embedded in the platform's metadata:

- **macOS:** `ElectronAsarIntegrity` dictionary in `Info.plist`
- **Windows:** Resource entry of type `Integrity` named `ElectronAsar`

If no hash is present or hashes mismatch, the app forcefully terminates.

### What ASAR Integrity Does NOT Do

- It is **not encryption** -- a determined attacker can still extract, modify, and repackage the ASAR
- It prevents **casual tampering** and detects modification, but sensitive logic should remain server-side
- Without `OnlyLoadAppFromAsar`, an attacker can place an `app/` folder alongside `app.asar` and bypass validation entirely

---

## webPreferences Security Audit (Development Only)

Catch accidental security regressions during development:

```javascript
// main.js -- development-only audit
if (process.defaultApp) {
  app.on("browser-window-created", (_event, window) => {
    const prefs = window.webContents.getLastWebPreferences();

    const SECURITY_CHECKS = [
      {
        key: "contextIsolation",
        expected: true,
        label: "contextIsolation must be true",
      },
      {
        key: "nodeIntegration",
        expected: false,
        label: "nodeIntegration must be false",
      },
      { key: "sandbox", expected: true, label: "sandbox must be true" },
      { key: "webSecurity", expected: true, label: "webSecurity must be true" },
    ];

    const violations = SECURITY_CHECKS.filter(
      (check) => prefs[check.key] !== check.expected,
    ).map((check) => check.label);

    if (violations.length > 0) {
      console.error(
        `[SECURITY] Window "${window.getTitle()}" has unsafe webPreferences:`,
        violations,
      );
    }
  });
}
```

**Why good:** Runs only in development (`process.defaultApp` is true in `electron .` mode). Catches violations from any BrowserWindow, including those created by third-party dependencies. Named constants for expected values make the checks self-documenting.

```javascript
// BAD -- manual spot-checking
// Relies on developer remembering to check each window manually
// Misses windows created by dependencies
```

**Why bad:** Manual checks miss regressions and third-party windows. The audit hook catches everything automatically.

---

## webPreferences Defaults by Electron Version

| Property           | Default | Since       | Security Impact                               |
| ------------------ | ------- | ----------- | --------------------------------------------- |
| `contextIsolation` | `true`  | Electron 12 | Isolates preload from renderer globals        |
| `nodeIntegration`  | `false` | Electron 5  | Prevents renderer from accessing Node.js APIs |
| `sandbox`          | `true`  | Electron 20 | OS-level process sandboxing                   |
| `webSecurity`      | `true`  | Always      | Enforces same-origin policy                   |
| `webviewTag`       | `false` | Electron 22 | Requires explicit opt-in for `<webview>`      |

---

See [csp-permissions.md](csp-permissions.md) for Content Security Policy and permission handling. See [navigation-protocols.md](navigation-protocols.md) for navigation and protocol security.
