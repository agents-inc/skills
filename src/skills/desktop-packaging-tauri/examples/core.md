# Tauri Bundling - Core Patterns

> Bundle configuration, platform-specific settings, size optimization, sidecars, and NSIS customization. See [SKILL.md](../SKILL.md) for decision frameworks. See [reference.md](../reference.md) for config field reference.

---

## Bundle Configuration

### Complete tauri.conf.json Bundle Section

```json
{
  "productName": "My App",
  "version": "1.0.0",
  "identifier": "com.mycompany.myapp",
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": {
      "locales/*": "locales/",
      "data/defaults.json": "data/"
    },
    "createUpdaterArtifacts": true,
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "webviewInstallMode": {
        "type": "embedBootstrapper"
      },
      "nsis": {
        "installMode": "both",
        "displayLanguageSelector": true
      }
    },
    "macOS": {
      "signingIdentity": null,
      "entitlements": null,
      "minimumSystemVersion": "10.13",
      "frameworks": []
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0"],
        "section": "utils"
      },
      "appimage": {
        "bundleMediaFramework": false
      }
    }
  }
}
```

**Key points:**

- `identifier` must be unique reverse-domain -- used for app data paths, code signing, and store submissions
- Generate icons from a single 1024x1024 PNG: `cargo tauri icon path/to/icon.png`
- `createUpdaterArtifacts: true` produces `.sig` signature files alongside each installer
- `resources` bundles extra files accessible at runtime via Tauri path resolver
- Set `certificateThumbprint` and `signingIdentity` to `null` during development, configure for release via env vars or CI

---

## Platform-Specific Targets

### Building for Specific Formats

```sh
# Build all formats for current platform
cargo tauri build

# Build specific format(s)
cargo tauri build --bundles nsis
cargo tauri build --bundles deb,appimage

# Debug build (faster compile, includes debug symbols)
cargo tauri build --debug

# Cross-compile NSIS installer from Linux/macOS
cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis

# Build for specific architecture
cargo tauri build --target aarch64-apple-darwin
cargo tauri build --target x86_64-apple-darwin
```

### Targeting Specific Formats in Config

```json
{
  "bundle": {
    "targets": ["nsis", "msi"]
  }
}
```

**Trade-offs by format:**

- **NSIS** (Windows): Recommended. Supports `perUser`/`perMachine`/`both` modes, custom hooks, language selector. Cross-compilable via `cargo-xwin`.
- **MSI** (Windows): WiX-based, Windows-only build. Better for enterprise deployment with Group Policy.
- **DMG** (macOS): Standard drag-to-install disk image. Requires code signing + notarization for distribution.
- **deb** (Linux): Small package (~2-6 MB), relies on system packages. Ideal for Debian/Ubuntu.
- **rpm** (Linux): Small package, for Fedora/RHEL/openSUSE.
- **AppImage** (Linux): Portable (~70+ MB), bundles all dependencies. No installation needed.

---

## Binary Size Optimization

### Rust Release Profile

```toml
# src-tauri/Cargo.toml
[profile.release]
codegen-units = 1   # Better optimization (slower compile)
lto = true           # Link-time optimization
opt-level = "s"      # Optimize for size ("z" may also work -- test both)
panic = "abort"      # Remove panic unwinding code
strip = true         # Remove debug symbols
```

**Impact:** These settings typically reduce binary size by 30-50% but increase clean build time to 10-30 minutes.

### Nightly Toolchain Additions (Optional)

```toml
# Only with nightly Rust toolchain
[profile.release]
trim-paths = "all"
```

### Frontend Bundle Size

The frontend JavaScript bundle is embedded in the binary. Minimize it:

- Use a bundle analyzer to identify large dependencies
- Tree-shake unused code (most bundlers do this by default)
- Consider lighter alternatives for heavy dependencies
- Lazy-load routes and heavy components

### Remove Unused Commands (Tauri 2.4+)

```json
{
  "build": {
    "removeUnusedCommands": true
  }
}
```

This strips commands not listed in your capability files from the binary. Ensure all needed commands are explicitly allowed in your ACL.

---

## Sidecar Binaries

### Configuration

```json
{
  "bundle": {
    "externalBin": ["binaries/ffmpeg"]
  }
}
```

### File Naming Convention

Sidecar filenames must include the Rust target triple. Tauri resolves the correct one at runtime.

```
binaries/ffmpeg-x86_64-pc-windows-msvc.exe
binaries/ffmpeg-x86_64-apple-darwin
binaries/ffmpeg-x86_64-unknown-linux-gnu
binaries/ffmpeg-aarch64-apple-darwin
```

### Executing a Sidecar from Rust

```rust
use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn run_sidecar(app: tauri::AppHandle, input: String) -> Result<String, String> {
    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-i", &input, "-o", "output.mp4"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

**Key points:**

- The shell plugin (`tauri-plugin-shell`) is required for sidecar execution
- Add `shell:allow-execute` or `shell:allow-spawn` permission to your capability file
- The `externalBin` path is relative to `src-tauri/` and omits the target triple suffix

---

## NSIS Installer Customization

### Install Modes

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "installMode": "both"
      }
    }
  }
}
```

- `"perUser"` (default): No admin required, installs to `%LOCALAPPDATA%`
- `"perMachine"`: Requires admin, installs to `Program Files`
- `"both"`: User chooses at install time, requires admin

### Installer Hooks

Create a `.nsh` file with NSIS macros for the four lifecycle hooks:

```nsis
; hooks.nsh

!macro NSIS_HOOK_PREINSTALL
  ; Runs before copying files, registry keys, and shortcuts
  DetailPrint "Preparing installation..."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Runs after all installation steps complete
  ; Example: register file association
  WriteRegStr HKCU "Software\Classes\.myext" "" "MyApp.Document"
  WriteRegStr HKCU "Software\Classes\MyApp.Document\shell\open\command" "" '"$INSTDIR\MyApp.exe" "%1"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Runs before removing files and registry entries
  DetailPrint "Cleaning up..."
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Runs after removal operations finish
  DeleteRegKey HKCU "Software\Classes\.myext"
  DeleteRegKey HKCU "Software\Classes\MyApp.Document"
!macroend
```

Reference the hook file in config:

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "installerHooks": "hooks.nsh"
      }
    }
  }
}
```

### Custom NSIS Template

For complete control over the installer, provide a custom `.nsi` template:

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "template": "custom-installer.nsi"
      }
    }
  }
}
```

The template uses Handlebars syntax. Tauri injects variables from your `tauri.conf.json` into the template at build time.

---

## Resources and Extra Files

### Bundling Static Files

```json
{
  "bundle": {
    "resources": {
      "assets/*": "assets/",
      "config/defaults.json": "config/",
      "models/weights.bin": "models/"
    }
  }
}
```

### Accessing Resources at Runtime (Rust)

```rust
use tauri::Manager;

#[tauri::command]
fn read_default_config(app: tauri::AppHandle) -> Result<String, String> {
    let resource_path = app.path()
        .resolve("config/defaults.json", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    std::fs::read_to_string(resource_path).map_err(|e| e.to_string())
}
```

**Key point:** Resource paths are resolved relative to the bundle's resource directory. In development (`cargo tauri dev`), they resolve relative to `src-tauri/`.

---

## Snap and Flatpak (Manual Setup)

Snap and Flatpak are not built by `cargo tauri build`. They require manual manifest files.

### Snap Packaging

Requires a `snapcraft.yaml` manifest:

```yaml
name: my-app
base: core22
version: "1.0.0"
summary: My Tauri app
description: |
  A desktop application built with Tauri.
grade: stable
confinement: strict

apps:
  my-app:
    command: usr/bin/my-app
    desktop: usr/share/applications/my-app.desktop
    extensions: [gnome]

parts:
  my-app:
    plugin: dump
    source: src-tauri/target/release/bundle/deb/my-app_1.0.0_amd64.deb
    source-type: deb
```

Build: `sudo snapcraft`

### Flatpak Packaging

Requires a Flatpak manifest (e.g., `com.mycompany.myapp.yml`). Flatpak runs in a sandbox -- DBus communication must be explicitly declared.

**Key constraints for sandboxed packages:**

- Most DBus service communication is blocked by default
- Declare `--talk-name` and `--own-name` finish args for needed services
- Tray icon, notifications, and single-instance plugins may need additional manifest configuration

---

See [code-signing.md](code-signing.md) for signing setup, [updater.md](updater.md) for auto-update configuration, and [ci-cd.md](ci-cd.md) for GitHub Actions workflows.
