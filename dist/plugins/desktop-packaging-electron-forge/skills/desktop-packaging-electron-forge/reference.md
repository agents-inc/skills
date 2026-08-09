# Electron Forge Reference

> Quick-lookup tables, CLI commands, maker/publisher/fuse reference, Forge vs builder comparison. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## CLI Commands

| Command                  | Action                           | Output                                      |
| ------------------------ | -------------------------------- | ------------------------------------------- |
| `electron-forge start`   | Launch in dev mode               | Running app (with HMR if plugin configured) |
| `electron-forge package` | Create app bundle                | `.app` / `.exe` (no installer)              |
| `electron-forge make`    | Create distributable installers  | `.dmg`, `.exe`, `.deb`, etc.                |
| `electron-forge publish` | Upload artifacts to publisher    | Artifacts on GitHub/S3/Snapcraft            |
| `electron-forge import`  | Import existing Electron project | Adds Forge config and scripts               |
| `electron-forge init`    | Create new project from template | Scaffolded project                          |

---

## Makers Quick Reference

| Maker            | Package          | Platform     | Output     | Use Case                              |
| ---------------- | ---------------- | ------------ | ---------- | ------------------------------------- |
| Squirrel.Windows | `maker-squirrel` | Windows      | `.exe`     | Auto-updating desktop app             |
| WiX MSI          | `maker-wix`      | Windows      | `.msi`     | Enterprise IT deployment              |
| MSIX             | `maker-msix`     | Windows      | `.msix`    | Modern Windows packaging              |
| AppX             | `maker-appx`     | Windows      | `.appx`    | Microsoft Store                       |
| DMG              | `maker-dmg`      | macOS        | `.dmg`     | Direct distribution (drag-to-install) |
| PKG              | `maker-pkg`      | macOS        | `.pkg`     | Mac App Store                         |
| ZIP              | `maker-zip`      | macOS, Linux | `.zip`     | Auto-updater feed, universal archive  |
| deb              | `maker-deb`      | Linux        | `.deb`     | Debian/Ubuntu                         |
| RPM              | `maker-rpm`      | Linux        | `.rpm`     | Fedora/RHEL                           |
| Flatpak          | `maker-flatpak`  | Linux        | `.flatpak` | Sandboxed cross-distro                |
| Snap             | `maker-snap`     | Linux        | `.snap`    | Snap Store distribution               |

All packages are scoped under `@electron-forge/` (e.g., `@electron-forge/maker-squirrel`).

---

## Publishers Quick Reference

| Publisher | Package               | Target               | Auth                   |
| --------- | --------------------- | -------------------- | ---------------------- |
| GitHub    | `publisher-github`    | GitHub Releases      | `GITHUB_TOKEN` env var |
| S3        | `publisher-s3`        | Amazon S3 bucket     | AWS credentials        |
| GCS       | `publisher-gcs`       | Google Cloud Storage | GCP credentials        |
| Snapcraft | `publisher-snapcraft` | Snap Store           | `snapcraft login`      |

---

## Plugins Quick Reference

| Plugin              | Package                                      | Purpose                                          |
| ------------------- | -------------------------------------------- | ------------------------------------------------ |
| Vite                | `@electron-forge/plugin-vite`                | Vite bundling for main + renderer (experimental) |
| Webpack             | `@electron-forge/plugin-webpack`             | Webpack bundling for main + renderer             |
| Fuses               | `@electron-forge/plugin-fuses`               | Flip Electron Fuses at package time              |
| Auto Unpack Natives | `@electron-forge/plugin-auto-unpack-natives` | Auto-detect and unpack native modules            |
| Electronegativity   | `@electron-forge/plugin-electronegativity`   | Security audit during build                      |

---

## Fuses Quick Reference

| Fuse                                    | Recommended | Effect                                 |
| --------------------------------------- | ----------- | -------------------------------------- |
| `RunAsNode`                             | `false`     | Disables `ELECTRON_RUN_AS_NODE`        |
| `EnableCookieEncryption`                | `true`      | OS-level cookie encryption             |
| `EnableNodeOptionsEnvironmentVariable`  | `false`     | Disables `NODE_OPTIONS`                |
| `EnableNodeCliInspectArguments`         | `false`     | Disables `--inspect`                   |
| `EnableEmbeddedAsarIntegrityValidation` | `true`      | ASAR integrity check (macOS + Windows) |
| `OnlyLoadAppFromAsar`                   | `true`      | Prevents loose file loading            |
| `GrantFileProtocolExtraPrivileges`      | `false`     | Restricts `file://` privileges         |
| `LoadBrowserProcessSpecificV8Snapshot`  | default     | Separate V8 snapshot                   |

Verify: `npx @electron/fuses read --app /path/to/app`

---

## forge.config.ts Top-Level Fields

| Field             | Type                | Purpose                                            |
| ----------------- | ------------------- | -------------------------------------------------- |
| `packagerConfig`  | `PackagerConfig`    | `@electron/packager` options (icon, signing, ASAR) |
| `rebuildConfig`   | `RebuildConfig`     | `@electron/rebuild` options for native modules     |
| `makers`          | `MakerConfig[]`     | Platform-specific installer generators             |
| `publishers`      | `PublisherConfig[]` | Artifact upload targets                            |
| `plugins`         | `PluginConfig[]`    | Build plugins (Vite, Webpack, Fuses)               |
| `hooks`           | `HooksConfig`       | Custom lifecycle callbacks                         |
| `buildIdentifier` | `string`            | Build variant identifier (prod, beta)              |
| `outDir`          | `string`            | Output directory path                              |

**Cannot override in packagerConfig:** `dir`, `arch`, `platform`, `out`, `electronVersion` (set by Forge internally).

---

## Build Hooks

| Hook                  | When                            | Mutating?                    |
| --------------------- | ------------------------------- | ---------------------------- |
| `generateAssets`      | Before start or package         | No                           |
| `preStart`            | Before app launches             | No                           |
| `postStart`           | After app launches              | No                           |
| `prePackage`          | Before @electron/packager       | No                           |
| `packageAfterCopy`    | After build dir copied          | No                           |
| `packageAfterPrune`   | After devDependencies pruned    | No                           |
| `packageAfterExtract` | After Electron binary extracted | No                           |
| `postPackage`         | After package completes         | No                           |
| `preMake`             | Before makers run               | No                           |
| `postMake`            | After makers complete           | Yes -- return `MakeResult[]` |
| `readPackageJson`     | Every package.json read         | Yes -- return modified JSON  |

---

## Forge vs electron-builder

| Factor                | Electron Forge                   | electron-builder                    |
| --------------------- | -------------------------------- | ----------------------------------- |
| Maintainer            | Electron team (first-party)      | Community                           |
| Config                | TypeScript / JavaScript          | YAML / JSON / JS                    |
| Architecture          | Composable packages              | Monolithic                          |
| New Electron features | Same-day                         | Delayed                             |
| Windows installers    | Squirrel, WiX, MSIX, AppX        | NSIS, Squirrel, MSI, AppX, portable |
| macOS installers      | DMG, ZIP, PKG                    | DMG, ZIP, PKG, MAS                  |
| Linux installers      | deb, RPM, Flatpak, Snap          | deb, RPM, AppImage, Snap, Flatpak   |
| Auto-update           | Via Squirrel + update server     | Built-in electron-updater           |
| npm downloads         | ~50K/week                        | ~1.4M/week                          |
| Extensibility         | Custom makers/publishers/plugins | Limited scripting hooks             |
| NSIS support          | No (use WiX or Squirrel)         | Yes (full NSIS scripting)           |

**Choose Forge when:** Starting new projects, want first-party support, need TypeScript config, value composability.

**Choose electron-builder when:** Need NSIS installer, want YAML config, need broader community resources, migrating existing electron-builder project.

---

## Code Signing Checklist

- [ ] `electron` is in `devDependencies` (not `dependencies`)
- [ ] `asar: true` enabled in `packagerConfig`
- [ ] macOS: `osxSign` + `osxNotarize` configured
- [ ] macOS: Developer ID Application certificate installed in Keychain
- [ ] macOS: Using app-specific password (not Apple ID password)
- [ ] Windows: Certificate file or Azure Trusted Signing configured
- [ ] Signing credentials stored in environment variables (not in config)
- [ ] Fuses enabled: `RunAsNode: false`, `OnlyLoadAppFromAsar: true`
- [ ] CI/CD imports signing certificate into build runner Keychain (macOS)
- [ ] CI/CD timeout accounts for notarization delay (2-10 minutes)

---

## See Also

- [Electron Forge Documentation](https://www.electronforge.io/)
- [Electron Forge GitHub](https://github.com/electron/forge)
- [Electron Code Signing Guide](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Electron Fuses Tutorial](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [Electron ASAR Integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)
