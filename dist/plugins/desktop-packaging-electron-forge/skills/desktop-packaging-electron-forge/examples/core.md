# Electron Forge -- Core Patterns

> forge.config.ts setup, maker configuration, Vite plugin, Fuses, dependency management. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [signing.md](signing.md) for code signing. See [publishers.md](publishers.md) for release distribution.

---

## Complete forge.config.ts with Makers and Fuses

```typescript
// forge.config.ts
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRPM } from "@electron-forge/maker-rpm";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "./assets/icon", // Forge picks .icns (macOS), .ico (Windows), .png (Linux)
    name: "MyApp",
    executableName: "my-app",
    appBundleId: "com.example.myapp",
    // macOS code signing -- see signing.md for full setup
    osxSign: {},
    osxNotarize: {
      appleId: process.env.APPLE_ID!,
      appleIdPassword: process.env.APPLE_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!,
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      setupIcon: "./assets/icon.ico",
    }),
    new MakerDMG({
      icon: "./assets/icon.icns",
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerDeb({
      options: {
        icon: "./assets/icon.png",
        maintainer: "Your Name",
        homepage: "https://example.com",
      },
    }),
    new MakerRPM({}),
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
};

export default config;
```

**Why good:** TypeScript config with full type inference, all security fuses enabled, signing credentials from env vars, ASAR enabled, minimal maker set covers all three platforms

---

## Maker Configuration (Object-Style vs Class-Style)

Forge v7 supports two maker configuration styles: object-based (JSON-serializable) and class-based (imported constructors). Both are equivalent.

```typescript
// Class-based (recommended for TypeScript -- full type inference)
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDMG } from "@electron-forge/maker-dmg";

makers: [
  new MakerSquirrel({ setupIcon: "./assets/icon.ico" }),
  new MakerDMG({ icon: "./assets/icon.icns" }),
],
```

```typescript
// Object-based (works in JS config or when you want JSON-serializable config)
makers: [
  {
    name: "@electron-forge/maker-squirrel",
    config: { setupIcon: "./assets/icon.ico" },
  },
  {
    name: "@electron-forge/maker-dmg",
    config: { icon: "./assets/icon.icns" },
  },
],
```

**Key point:** Class-based imports give you autocomplete and type-checking on the config object. Object-based is useful for dynamic configs loaded from JSON.

---

## Dynamic Maker Config by Architecture

Makers accept a function for platform/arch-specific configuration.

```typescript
new MakerSquirrel((arch) => ({
  setupIcon: "./assets/icon.ico",
  // Different signing certificate for ARM vs x64
  certificateFile:
    arch === "arm64"
      ? process.env.WIN_CSC_LINK_ARM
      : process.env.WIN_CSC_LINK,
  certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
})),
```

---

## Vite Plugin Setup

```typescript
// forge.config.ts
import { VitePlugin } from "@electron-forge/plugin-vite";

plugins: [
  new VitePlugin({
    build: [
      { entry: "src/main.ts", config: "vite.main.config.mts" },
      { entry: "src/preload.ts", config: "vite.preload.config.mts" },
    ],
    renderer: [
      { name: "main_window", config: "vite.renderer.config.mts" },
    ],
  }),
],
```

```typescript
// src/main.ts -- loading the renderer
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // In dev: load from Vite dev server (HMR)
  // In prod: load from built files
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};
```

```typescript
// src/vite-env.d.ts -- declare the plugin-injected globals
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
```

**Why good:** Separate configs for main/preload/renderer, TypeScript declarations prevent type errors, conditional loading handles dev vs production paths correctly

**Gotcha:** Native modules (better-sqlite3, sharp) must be marked as `external` in `vite.main.config.mts` rollupOptions -- Vite cannot bundle native addons.

---

## ASAR Unpacking for Native Modules

Native Node.js addons cannot load from inside an ASAR archive. Unpack them explicitly.

```typescript
packagerConfig: {
  asar: true,
  asarUnpack: [
    "node_modules/better-sqlite3/**",
    "node_modules/sharp/**",
    "bin/**", // any bundled binary executables
  ],
},
```

**Why needed:** Unpacked files are placed in `app.asar.unpacked/` alongside `app.asar`. The app loads them from the filesystem. Keep the unpack list minimal -- every unpacked file is exposed on disk.

**Runtime path resolution:**

```typescript
const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "app.asar.unpacked")
  : __dirname;
```

---

## Dependency Management

```json
{
  "dependencies": {
    "electron-store": "^10.0.0"
  },
  "devDependencies": {
    "electron": "^35.0.0",
    "@electron-forge/cli": "^7.11.0",
    "@electron-forge/maker-squirrel": "^7.11.0",
    "@electron-forge/maker-dmg": "^7.11.0",
    "@electron-forge/maker-zip": "^7.11.0",
    "@electron-forge/maker-deb": "^7.11.0",
    "@electron-forge/plugin-fuses": "^7.11.0",
    "@electron/fuses": "^1.8.0",
    "@electron/rebuild": "^3.7.0"
  }
}
```

**Why critical:** Forge bundles `dependencies` into the final app but excludes `devDependencies`. Electron itself (~200MB) is provided by the packager -- placing it in `dependencies` ships a duplicate copy.

**Common mistake:** Build tools, testing libraries, Forge packages, or `electron` itself in `dependencies` instead of `devDependencies`.
