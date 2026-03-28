# Electron - Packaging & Distribution

> Electron Forge, Electron Builder, code signing, ASAR, and distribution. See [SKILL.md](../SKILL.md) for red flags. See [native-apis.md](native-apis.md) for auto-updater setup.

---

## Electron Forge Setup

Electron Forge is the official Electron build toolchain.

```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    asar: true,
    icon: "./assets/icon", // .icns (macOS), .ico (Windows), .png (Linux)
    name: "MyApp",
    executableName: "my-app",
    appBundleId: "com.example.myapp",
    // macOS code signing (requires Apple Developer certificate)
    osxSign: {},
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        // Windows installer (Squirrel)
        setupIcon: "./assets/icon.ico",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          icon: "./assets/icon.png",
          maintainer: "Your Name",
          homepage: "https://example.com",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
};
```

```json
// package.json scripts
{
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "publish": "electron-forge publish"
  }
}
```

**Key commands:**

- `electron-forge package` -- produces the platform-specific app bundle (no installer)
- `electron-forge make` -- produces distributable installers (.exe, .dmg, .deb, .rpm)
- `electron-forge publish` -- uploads artifacts to a configured target (GitHub Releases, S3, etc.)

---

## Electron Builder Setup

Alternative to Forge, widely used for its YAML-based config and broader publishing targets.

```yaml
# electron-builder.yml
appId: com.example.myapp
productName: MyApp
directories:
  output: dist
  buildResources: assets

asar: true

mac:
  category: public.app-category.developer-tools
  icon: assets/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  target:
    - dmg
    - zip

win:
  icon: assets/icon.ico
  target:
    - nsis
    - portable

linux:
  icon: assets/icon.png
  target:
    - AppImage
    - deb
  category: Development

publish:
  provider: github
  owner: your-org
  repo: your-app
```

```json
// package.json scripts
{
  "scripts": {
    "dist": "electron-builder",
    "dist:mac": "electron-builder --mac",
    "dist:win": "electron-builder --win",
    "dist:linux": "electron-builder --linux"
  }
}
```

---

## Code Signing

### macOS

macOS requires code signing and notarization for distribution outside the Mac App Store.

```bash
# Required environment variables
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"  # NOT your Apple ID password
export APPLE_TEAM_ID="XXXXXXXXXX"

# The signing certificate must be installed in the macOS Keychain
# "Developer ID Application: Your Name (TEAM_ID)"
```

**Key points:**

- Use an **app-specific password** (generated at appleid.apple.com), not your Apple ID password
- Notarization is required for macOS 10.15+ -- unsigned/unnotarized apps trigger Gatekeeper warnings
- `hardenedRuntime: true` is required for notarization
- Notarization takes 2-10 minutes per build (Apple's servers scan the binary)

### Windows

```bash
# Windows code signing with signtool (EV certificate)
# Typically configured via electron-builder or Forge config
export WIN_CSC_LINK="path/to/certificate.pfx"
export WIN_CSC_KEY_PASSWORD="certificate-password"
```

**Key point:** Windows SmartScreen warnings appear for unsigned apps. An EV (Extended Validation) code signing certificate provides immediate SmartScreen reputation. Standard certificates build reputation over time.

---

## ASAR Unpacking for Native Modules

Native Node.js addons cannot be loaded from inside an ASAR archive.

```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    asar: true,
    asarUnpack: [
      // Unpack native modules so they can be loaded
      "node_modules/better-sqlite3/**",
      "node_modules/sharp/**",
      // Unpack binary executables bundled with the app
      "bin/**",
    ],
  },
};
```

**Key point:** Unpacked files are placed in an `app.asar.unpacked/` directory alongside `app.asar`. Use `process.resourcesPath` to reference them at runtime. Keep the unpack list minimal -- every unpacked file is exposed on the filesystem.

---

## Keeping Dependencies Lean

```json
// package.json -- separate dependencies from devDependencies
{
  "dependencies": {
    "electron-store": "^8.0.0"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "@electron-forge/cli": "^7.0.0",
    "@electron-forge/maker-squirrel": "^7.0.0",
    "@electron-forge/maker-zip": "^7.0.0",
    "@electron-forge/maker-deb": "^7.0.0"
  }
}
```

**Why critical:** Both Forge and Builder bundle `dependencies` into the final app but exclude `devDependencies`. Electron itself must be a devDependency -- it is provided by the packager. Misplacing packages bloats app size significantly (Electron alone is ~200MB).

**Common mistake:** Placing build tools, testing libraries, or `electron` itself in `dependencies` instead of `devDependencies`.

---

## @electron/rebuild for Native Modules

Native modules compiled for system Node.js will not work in Electron without rebuilding.

```bash
# Install
npm install --save-dev @electron/rebuild

# Rebuild all native modules for the current Electron version
npx electron-rebuild

# Or add as a postinstall script
```

```json
// package.json
{
  "scripts": {
    "postinstall": "electron-rebuild"
  }
}
```

**When needed:** Any time you use a native Node.js addon (better-sqlite3, sharp, node-pty, etc.). Electron's Node.js version may differ from your system Node.js, requiring recompilation against Electron's headers.

**Gotcha:** Electron Forge runs `@electron/rebuild` automatically during `package`/`make`. If using Electron Builder, add the `postinstall` script or use `"npmRebuild": true` in config (the default).

---

## Dev vs Packaged Path Resolution

Paths differ between development (`electron .`) and packaged builds.

```javascript
// main.js
const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "app.asar.unpacked")
  : path.join(__dirname);

const PRELOAD_PATH = path.join(__dirname, "preload.js");

// For static assets bundled with the app
const ICON_PATH = path.join(RESOURCES_PATH, "assets", "icon.png");
```

**Key point:** `__dirname` inside ASAR points to the virtual ASAR path. `process.resourcesPath` points to the `resources/` directory of the packaged app. Use `app.isPackaged` (not `process.defaultApp`) when resolving resource paths -- they have slightly different semantics:

- `app.isPackaged`: `true` when the app is packaged (no source code present)
- `process.defaultApp`: `true` when launched with `electron .` (dev mode)

---

See [native-apis.md](native-apis.md) for auto-updater integration. See [security.md](security.md) for ASAR integrity validation.
