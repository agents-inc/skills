---
name: desktop-packaging-tauri
description: Tauri 2.x bundling, code signing, auto-updater, platform installers, CI/CD
---

# Tauri 2.x Bundling & Distribution

> **Quick Guide:** Configure bundling in `tauri.conf.json` under `bundle`. Platform targets: NSIS/MSI (Windows), DMG/app bundle (macOS), deb/rpm/AppImage (Linux). Code signing is required for macOS distribution (Apple notarization) and recommended for Windows (SmartScreen). The auto-updater uses Ed25519 (Minisign) signatures -- generate keys with `cargo tauri signer generate`, set `TAURI_SIGNING_PRIVATE_KEY` at build time. Cross-platform CI uses `tauri-apps/tauri-action` with a matrix strategy. Optimize binary size with `[profile.release]` settings in `Cargo.toml`.
>
> **Current version:** Tauri 2.x (stable). Updater artifacts use `createUpdaterArtifacts: true` (not the v1 `"v1Compatible"` unless migrating).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST set `TAURI_SIGNING_PRIVATE_KEY` as an environment variable at build time for updater artifacts -- never commit the private key)**

**(You MUST configure code signing for macOS distribution -- unsigned apps are blocked by Gatekeeper)**

**(You MUST use `bundle.identifier` as a valid reverse-domain string -- it is used for code signing, app data paths, and store submissions)**

**(You MUST build platform-specific installers on their native OS -- cross-compilation is limited to NSIS via `cargo-xwin`)**

**(You MUST set `createUpdaterArtifacts: true` in `bundle` to generate `.sig` files alongside installers)**

</critical_requirements>

---

**Auto-detection:** tauri.conf.json bundle, cargo tauri build, bundle targets, NSIS, MSI, DMG, AppImage, deb, rpm, code signing, notarization, APPLE_SIGNING_IDENTITY, certificateThumbprint, tauri-plugin-updater, createUpdaterArtifacts, TAURI_SIGNING_PRIVATE_KEY, sidecar, externalBin, tauri-action, cargo tauri signer, Minisign, installer hooks

**When to use:**

- Configuring `tauri.conf.json` bundle settings (targets, icons, resources, identifier)
- Building platform-specific installers (NSIS, MSI, DMG, deb, rpm, AppImage)
- Setting up macOS code signing and Apple notarization
- Setting up Windows code signing (OV/EV certificates, Azure Trusted Signing)
- Configuring the auto-updater plugin with Ed25519 signature verification
- Optimizing Tauri app binary size (Rust release profile, frontend bundle)
- Bundling sidecar binaries or extra resources
- Creating GitHub Actions CI/CD for cross-platform builds
- Customizing NSIS installers with hooks or templates

**When NOT to use:**

- Tauri command/IPC bridge, permissions, plugins, window management (use the Tauri framework skill)
- Frontend framework or build tool configuration (separate skills)
- General Rust programming or Cargo configuration not specific to Tauri bundling
- Mobile distribution to App Store / Google Play (different workflow)

**Key patterns covered:**

- Bundle configuration in `tauri.conf.json` ([examples/core.md](examples/core.md))
- Platform-specific installer options ([examples/core.md](examples/core.md))
- macOS code signing and notarization ([examples/code-signing.md](examples/code-signing.md))
- Windows code signing ([examples/code-signing.md](examples/code-signing.md))
- Auto-updater setup with Ed25519 signatures ([examples/updater.md](examples/updater.md))
- Binary size optimization ([examples/core.md](examples/core.md))
- Sidecar binaries and resources ([examples/core.md](examples/core.md))
- GitHub Actions cross-platform CI/CD ([examples/ci-cd.md](examples/ci-cd.md))
- NSIS installer hooks and customization ([examples/core.md](examples/core.md))

**Detailed resources:**

- [examples/core.md](examples/core.md) - Bundle config, platform targets, size optimization, sidecars, NSIS hooks
- [examples/code-signing.md](examples/code-signing.md) - macOS notarization, Windows signing, CI/CD signing setup
- [examples/updater.md](examples/updater.md) - Auto-updater plugin, key generation, endpoint format, JS/Rust usage
- [examples/ci-cd.md](examples/ci-cd.md) - GitHub Actions workflow, matrix strategy, secrets
- [reference.md](reference.md) - Bundle config field reference, CLI commands, platform target table

---

<philosophy>

## Philosophy

Tauri's bundling system produces small, native installers by leveraging the OS system webview instead of bundling a browser engine. The typical binary is 5-15 MB compared to 150+ MB for alternatives. Distribution requires platform-specific steps: code signing and notarization for macOS, SmartScreen-friendly signing for Windows, and package manager formats for Linux.

**The bundling workflow:**

1. Configure `tauri.conf.json` bundle section (identifier, icons, targets)
2. Set up code signing for target platforms
3. Configure the updater plugin with Ed25519 keys
4. Build with `cargo tauri build` (produces installer + `.sig` files)
5. Distribute via CI/CD pipeline with platform matrix

**Key constraints:**

- Cross-compilation is limited -- build macOS on macOS, Windows on Windows (NSIS is the exception via `cargo-xwin`)
- Code signing requires platform-specific certificates and accounts (Apple Developer, Windows code signing cert)
- The updater requires Ed25519 signatures -- this cannot be disabled
- AppImage bundles all dependencies (~70+ MB) while deb/rpm rely on system packages (~2-6 MB)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Bundle Configuration

The `bundle` section in `tauri.conf.json` controls all packaging behavior. The `identifier` is the most important field -- it must be a unique reverse-domain string used for app data paths, code signing, and store submissions.

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "identifier": "com.mycompany.myapp",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": {
      "locales/*": "locales/"
    },
    "createUpdaterArtifacts": true
  }
}
```

**Key points:** `"targets": "all"` builds all formats for the current OS. Use `cargo tauri icon path/to/1024x1024.png` to generate all icon sizes. Set `createUpdaterArtifacts: true` to produce `.sig` signature files alongside installers. See [examples/core.md](examples/core.md) for full config with platform-specific sections.

---

### Pattern 2: Platform-Specific Installers

Each platform has distinct installer formats with different trade-offs.

| Platform | Format     | Output        | Size    | Notes                      |
| -------- | ---------- | ------------- | ------- | -------------------------- |
| Windows  | `nsis`     | `-setup.exe`  | ~2-5 MB | Recommended, cross-compile |
| Windows  | `msi`      | `.msi`        | ~2-5 MB | WiX, Windows-only build    |
| macOS    | `dmg`      | `.dmg`        | ~5-8 MB | Drag-to-install disk image |
| macOS    | `app`      | `.app` bundle | ~5-8 MB | Raw app, no installer      |
| Linux    | `deb`      | `.deb`        | ~2-6 MB | Debian/Ubuntu              |
| Linux    | `rpm`      | `.rpm`        | ~2-6 MB | Fedora/RHEL                |
| Linux    | `appimage` | `.AppImage`   | ~70+ MB | Portable, bundles all deps |

```sh
# Build all formats for current platform
cargo tauri build

# Build specific format
cargo tauri build --bundles nsis

# Debug build (faster compile, larger binary)
cargo tauri build --debug
```

**Key point:** You cannot build `.msi` on Linux or `.dmg` on Windows. NSIS is the only cross-compilable format (via `cargo-xwin`). See [examples/core.md](examples/core.md) for platform-specific config sections.

---

### Pattern 3: Code Signing

macOS requires both code signing and notarization for distribution outside the App Store. Windows signing prevents SmartScreen warnings.

**macOS** -- set environment variables for CI:

- `APPLE_CERTIFICATE` (base64-encoded `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- Notarization: `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH` (App Store Connect API)

**Windows** -- configure in `tauri.conf.json` or use `signCommand`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.comodoca.com"
    }
  }
}
```

**Key point:** macOS notarization is mandatory for apps distributed outside the App Store -- without it, Gatekeeper blocks the app. See [examples/code-signing.md](examples/code-signing.md) for full setup and CI integration.

---

### Pattern 4: Auto-Updater

The updater plugin uses Ed25519 (Minisign) signatures to verify update authenticity. Signature verification cannot be disabled.

```sh
# Generate key pair (store private key securely)
cargo tauri signer generate -w ~/.tauri/myapp.key
```

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_ED25519_PUBLIC_KEY",
      "endpoints": [
        "https://releases.example.com/{{target}}/{{arch}}/{{current_version}}"
      ]
    }
  }
}
```

**Key points:** Set `TAURI_SIGNING_PRIVATE_KEY` at build time (never commit it). The endpoint template variables `{{target}}`, `{{arch}}`, `{{current_version}}` are resolved at runtime. The server returns HTTP 204 for no update, HTTP 200 with update JSON for available updates. See [examples/updater.md](examples/updater.md) for endpoint response format and JS/Rust usage.

---

### Pattern 5: Binary Size Optimization

Tauri binaries are already small (5-15 MB) but can be further optimized with Rust release profile settings.

```toml
# src-tauri/Cargo.toml
[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

| Setting             | Impact              | Trade-off                |
| ------------------- | ------------------- | ------------------------ |
| `strip = true`      | ~10-20% smaller     | No debug symbols         |
| `lto = true`        | ~10-20% smaller     | Slower compile           |
| `opt-level = "s"`   | Optimize for size   | May be slower at runtime |
| `codegen-units = 1` | Better optimization | Slower compile           |
| `panic = "abort"`   | Smaller binary      | No panic unwinding       |

**Key point:** These settings significantly increase compile time (10-30 min clean builds). Use `cargo tauri build --debug` during development. Tauri 2.4+ also supports `removeUnusedCommands: true` in `build` config. See [examples/core.md](examples/core.md) for frontend optimization tips.

---

### Pattern 6: Sidecar Binaries

Bundle external executables that run alongside your app. Filenames must include the Rust target triple.

```json
{
  "bundle": {
    "externalBin": ["binaries/ffmpeg"]
  }
}
```

```
binaries/ffmpeg-x86_64-pc-windows-msvc.exe
binaries/ffmpeg-x86_64-apple-darwin
binaries/ffmpeg-x86_64-unknown-linux-gnu
binaries/ffmpeg-aarch64-apple-darwin
```

**Key point:** Tauri resolves the correct platform binary at runtime. The shell plugin (`tauri-plugin-shell`) is required for sidecar execution. See [examples/core.md](examples/core.md) for the Rust sidecar execution pattern.

---

### Pattern 7: NSIS Installer Customization

Extend NSIS installers with hooks or replace the template entirely.

Four lifecycle hooks: `NSIS_HOOK_PREINSTALL`, `NSIS_HOOK_POSTINSTALL`, `NSIS_HOOK_PREUNINSTALL`, `NSIS_HOOK_POSTUNINSTALL`.

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "installerHooks": "hooks.nsh",
        "installMode": "both",
        "displayLanguageSelector": true
      }
    }
  }
}
```

**Key point:** Use hooks for targeted changes (registry keys, file associations). Use a custom template (`nsis.template`) only if hooks are insufficient. See [examples/core.md](examples/core.md) for hook examples.

</patterns>

---

<decision_framework>

## Decision Framework

### Which Installer Format?

```
Target platform?
|-- Windows
|   +-- Need MSI for enterprise deployment? -> msi (WiX, Windows-only build)
|   +-- General distribution? -> nsis (recommended, cross-compilable)
|-- macOS
|   +-- App Store? -> app bundle + App Store signing
|   +-- Direct download? -> dmg + Developer ID + notarization
|-- Linux
|   +-- Targeting Debian/Ubuntu? -> deb
|   +-- Targeting Fedora/RHEL? -> rpm
|   +-- Maximum portability? -> appimage (larger, ~70+ MB)
|   +-- Sandboxed distribution? -> snap or flatpak (manual setup)
+-- All platforms? -> Use "all" target with CI matrix
```

### Code Signing Decision

```
Distributing publicly?
|-- macOS
|   +-- App Store? -> Apple Distribution certificate
|   +-- Direct download? -> Developer ID Application + notarization (REQUIRED)
|   +-- Internal/testing only? -> Ad-hoc signing (signingIdentity: "-")
|-- Windows
|   +-- Microsoft Store? -> Store signing
|   +-- Direct download? -> OV or EV certificate (prevents SmartScreen warnings)
|   +-- Internal only? -> Optional but recommended
+-- Linux
    +-- Code signing is not required for Linux distribution
```

### Updater Strategy

```
Need auto-updates?
|-- YES -> tauri-plugin-updater
|   +-- Simple static hosting? -> Static JSON endpoint (GitHub Releases, S3)
|   +-- Dynamic update logic? -> Dynamic endpoint (returns 200/204)
|   +-- Need update UI? -> JS-side check() + downloadAndInstall()
|   +-- Background updates? -> Rust-side updater with AppHandle
+-- NO -> Skip updater config, omit createUpdaterArtifacts
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Committing `TAURI_SIGNING_PRIVATE_KEY` to source control -- store as CI secret, never in repo
- Missing `createUpdaterArtifacts: true` when using the updater -- no `.sig` files generated, updates fail
- Building macOS installer on Linux/Windows -- cross-compilation not supported for DMG/app bundle
- Using `"targets": "all"` in CI without a matrix strategy -- builds all formats for the current OS only
- Missing `bundle.identifier` or using an invalid format -- breaks code signing, app data paths, and store submissions
- Distributing unsigned macOS app -- Gatekeeper blocks it, users cannot open it

**Medium Priority Issues:**

- AppImage on Ubuntu 22.04+ targeting older distros -- higher glibc requirement breaks compatibility
- Missing `strip = true` in release profile -- debug symbols inflate binary by 10-20%
- Using `opt-level = 3` instead of `"s"` or `"z"` when binary size matters -- optimizes for speed, not size
- WebView2 `skip` install mode without guarantee runtime is present -- app crashes on startup
- NSIS `perUser` mode when app needs system-wide installation -- installs to `%LOCALAPPDATA%`, not Program Files

**Gotchas & Edge Cases:**

- `opt-level = "s"` vs `"z"` -- sometimes `"z"` produces smaller binaries, sometimes `"s"` does. Test both.
- macOS ad-hoc signing (`signingIdentity: "-"`) still triggers Gatekeeper warnings -- only useful for development
- NSIS is the only format supporting cross-compilation from Linux/macOS to Windows (via `cargo-xwin`)
- Sidecar binary filenames must include the Rust target triple suffix -- Tauri resolves the correct one at runtime
- Updater endpoint template variables (`{{target}}`, `{{arch}}`, `{{current_version}}`) are Tauri-specific, not environment variables
- AppImage bundles are ~70+ MB because they include all dependencies -- deb/rpm are 2-6 MB but require system packages
- Windows WebView2 runtime is bundled by default with `embedBootstrapper` -- older `downloadBootstrapper` mode requires internet at install time
- Snap/Flatpak packages run in a sandbox -- DBus communication is blocked unless declared in the manifest
- `removeUnusedCommands: true` (Tauri 2.4+) strips commands not in capability files -- ensure all needed commands are listed in ACL
- Free Apple Developer accounts cannot notarize apps -- a paid $99/year account is required for distribution

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST set `TAURI_SIGNING_PRIVATE_KEY` as an environment variable at build time for updater artifacts -- never commit the private key)**

**(You MUST configure code signing for macOS distribution -- unsigned apps are blocked by Gatekeeper)**

**(You MUST use `bundle.identifier` as a valid reverse-domain string -- it is used for code signing, app data paths, and store submissions)**

**(You MUST build platform-specific installers on their native OS -- cross-compilation is limited to NSIS via `cargo-xwin`)**

**(You MUST set `createUpdaterArtifacts: true` in `bundle` to generate `.sig` files alongside installers)**

**Failure to follow these rules will produce unsigned binaries, missing update signatures, or broken cross-platform builds.**

</critical_reminders>
