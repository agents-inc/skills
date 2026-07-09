# Tauri Bundling & Distribution Reference

> Quick-lookup tables for bundle configuration, CLI commands, and platform targets. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## Build CLI Commands

| Command                                          | Purpose                                     |
| ------------------------------------------------ | ------------------------------------------- |
| `cargo tauri build`                              | Build production binary + installers        |
| `cargo tauri build --debug`                      | Debug build (faster compile, larger binary) |
| `cargo tauri build --bundles nsis`               | Build specific installer format             |
| `cargo tauri build --bundles deb,appimage`       | Build multiple formats                      |
| `cargo tauri build --no-bundle`                  | Build binary without packaging              |
| `cargo tauri build --target x86_64-apple-darwin` | Build for specific Rust target              |
| `cargo tauri icon path/to/1024.png`              | Generate all icon sizes from source image   |
| `cargo tauri signer generate -w key.key`         | Generate Ed25519 key pair for updater       |

---

## Bundle Config Field Reference

### Top-Level Bundle Fields

| Field                           | Type       | Default | Purpose                                      |
| ------------------------------- | ---------- | ------- | -------------------------------------------- |
| `bundle.active`                 | `boolean`  | `true`  | Enable/disable bundling                      |
| `bundle.targets`                | `string[]` | `"all"` | Installer formats to build                   |
| `bundle.identifier`             | `string`   | --      | Reverse-domain app ID (required)             |
| `bundle.icon`                   | `string[]` | `[]`    | Icon file paths                              |
| `bundle.resources`              | `object`   | --      | Extra files/dirs to include in bundle        |
| `bundle.externalBin`            | `string[]` | --      | Sidecar binary paths (without target triple) |
| `bundle.createUpdaterArtifacts` | `boolean`  | `false` | Generate `.sig` files for updater            |

### Windows Bundle Fields

| Field                                         | Purpose                                  |
| --------------------------------------------- | ---------------------------------------- |
| `bundle.windows.certificateThumbprint`        | Code signing certificate thumbprint      |
| `bundle.windows.digestAlgorithm`              | Signing digest (typically `"sha256"`)    |
| `bundle.windows.timestampUrl`                 | Timestamp server URL                     |
| `bundle.windows.signCommand`                  | Custom sign command (Azure, relic, etc.) |
| `bundle.windows.nsis.installMode`             | `"perUser"` / `"perMachine"` / `"both"`  |
| `bundle.windows.nsis.installerHooks`          | Path to `.nsh` hook file                 |
| `bundle.windows.nsis.template`                | Path to custom NSIS template             |
| `bundle.windows.nsis.displayLanguageSelector` | Show language picker                     |
| `bundle.windows.nsis.languages`               | NSIS language list                       |
| `bundle.windows.nsis.minimumWebview2Version`  | Minimum WebView2 runtime version         |
| `bundle.windows.webviewInstallMode`           | WebView2 bundling strategy               |

### macOS Bundle Fields

| Field                               | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `bundle.macOS.signingIdentity`      | Code signing identity (or `"-"` for ad-hoc) |
| `bundle.macOS.entitlements`         | Path to entitlements plist                  |
| `bundle.macOS.frameworks`           | Native frameworks to bundle                 |
| `bundle.macOS.minimumSystemVersion` | Minimum macOS version (default `"10.13"`)   |

### Linux Bundle Fields

| Field                                        | Purpose                              |
| -------------------------------------------- | ------------------------------------ |
| `bundle.linux.deb.depends`                   | Debian package dependencies          |
| `bundle.linux.deb.section`                   | Package section (e.g., `"utils"`)    |
| `bundle.linux.appimage.bundleMediaFramework` | Include GStreamer for media playback |
| `bundle.linux.appimage.files`                | Extra files to include in AppImage   |
| `bundle.linux.rpm.epoch`                     | RPM epoch number                     |
| `bundle.linux.rpm.release`                   | RPM release string                   |

---

## WebView2 Install Modes

| Mode                   | Internet | Size Impact | Use Case                        |
| ---------------------- | -------- | ----------- | ------------------------------- |
| `downloadBootstrapper` | Yes      | +0 MB       | Default, smallest installer     |
| `embedBootstrapper`    | Yes      | +1.8 MB     | Better Windows 7 support        |
| `offlineInstaller`     | No       | +127 MB     | Offline/air-gapped environments |
| `fixedVersion`         | No       | +180 MB     | Controlled runtime management   |
| `skip`                 | No       | +0 MB       | Assumes runtime pre-installed   |

---

## NSIS Install Modes

| Mode         | Admin Required | Install Path     | Use Case               |
| ------------ | -------------- | ---------------- | ---------------------- |
| `perUser`    | No             | `%LOCALAPPDATA%` | Default, no UAC prompt |
| `perMachine` | Yes            | `Program Files`  | Enterprise/system-wide |
| `both`       | Yes            | User chooses     | Flexible installer     |

---

## Code Signing Environment Variables

### macOS

| Variable                     | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64-encoded `.p12` certificate      |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file           |
| `APPLE_SIGNING_IDENTITY`     | Signing identity string                |
| `APPLE_API_ISSUER`           | App Store Connect API issuer ID        |
| `APPLE_API_KEY`              | App Store Connect API key ID           |
| `APPLE_API_KEY_PATH`         | Path to `.p8` API key file             |
| `APPLE_ID`                   | Apple account email (alternate auth)   |
| `APPLE_PASSWORD`             | App-specific password (alternate auth) |
| `APPLE_TEAM_ID`              | Apple Developer team ID                |

### Windows

| Variable                       | Purpose                           |
| ------------------------------ | --------------------------------- |
| `WINDOWS_CERTIFICATE`          | Base64-encoded `.pfx` certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the `.pfx` file      |

### Updater

| Variable                             | Purpose                               |
| ------------------------------------ | ------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | Ed25519 private key (path or content) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Private key password (optional)       |

---

## Updater Endpoint Response Format

### Static JSON (GitHub Releases, S3)

```json
{
  "version": "1.2.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2025-01-15T00:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "MINISIGN_SIGNATURE",
      "url": "https://cdn.example.com/app_1.2.0_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "MINISIGN_SIGNATURE",
      "url": "https://cdn.example.com/app_1.2.0_x64-setup.exe"
    },
    "darwin-x86_64": {
      "signature": "MINISIGN_SIGNATURE",
      "url": "https://cdn.example.com/app.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "MINISIGN_SIGNATURE",
      "url": "https://cdn.example.com/app-aarch64.app.tar.gz"
    }
  }
}
```

### Dynamic Server Response

- **No update available:** HTTP 204 (No Content)
- **Update available:** HTTP 200 with:

```json
{
  "version": "1.2.0",
  "url": "https://cdn.example.com/bundle",
  "signature": "MINISIGN_SIGNATURE",
  "notes": "Release notes",
  "pub_date": "2025-01-15T00:00:00Z"
}
```

Required fields: `version`, `url`, `signature`.

---

## Platform Target Strings (Updater)

| `{{target}}` | `{{arch}}` | Platform            |
| ------------ | ---------- | ------------------- |
| `linux`      | `x86_64`   | Linux x64           |
| `linux`      | `aarch64`  | Linux ARM64         |
| `windows`    | `x86_64`   | Windows x64         |
| `windows`    | `i686`     | Windows x86         |
| `windows`    | `aarch64`  | Windows ARM64       |
| `darwin`     | `x86_64`   | macOS Intel         |
| `darwin`     | `aarch64`  | macOS Apple Silicon |

---

## See Also

- [Tauri v2 Distribute Guide](https://v2.tauri.app/distribute/)
- [Tauri v2 Config Reference](https://v2.tauri.app/reference/config/)
- [Tauri GitHub Action](https://github.com/tauri-apps/tauri-action)
- [Tauri App Size Guide](https://v2.tauri.app/concept/size/)
