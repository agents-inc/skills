# Tauri - Packaging & Distribution

> Build configuration, platform targets, updater, sidecar binaries, and CI considerations. See [SKILL.md](../SKILL.md) for decision frameworks. See [reference.md](../reference.md) for config field reference.

---

## Build Configuration

### tauri.conf.json Bundle Settings

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
    ]
  }
}
```

**Key point:** `identifier` must be a valid reverse-domain identifier -- it is used for app data paths, code signing, and platform app stores. Generate icons from a single 1024x1024 PNG using `cargo tauri icon`.

---

## Platform-Specific Bundle Targets

| Platform | Target     | Produces                       |
| -------- | ---------- | ------------------------------ |
| Windows  | `nsis`     | `.exe` installer (recommended) |
| Windows  | `msi`      | `.msi` installer               |
| macOS    | `dmg`      | `.dmg` disk image              |
| macOS    | `app`      | `.app` bundle                  |
| Linux    | `deb`      | `.deb` package                 |
| Linux    | `appimage` | `.AppImage` portable binary    |
| Linux    | `rpm`      | `.rpm` package                 |

```json
// Target specific formats
{
  "bundle": {
    "targets": ["nsis", "msi"]
  }
}
```

```sh
# Build for current platform
cargo tauri build

# Build with debug info (faster compile, larger binary)
cargo tauri build --debug

# Build specific bundle format
cargo tauri build --bundles deb
```

**Key point:** `"targets": "all"` builds all formats for the current platform. Cross-compilation requires platform-specific CI runners (you cannot build `.msi` on Linux).

---

## Platform-Specific Configuration

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "webviewInstallMode": {
        "type": "embedBootstrapper"
      }
    },
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13",
      "signingIdentity": null,
      "entitlements": null
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0"],
        "section": "utils"
      },
      "appimage": {
        "bundleMediaFramework": true
      }
    }
  }
}
```

**Key points:**

- **Windows:** `webviewInstallMode` controls WebView2 runtime bundling. `"embedBootstrapper"` ensures WebView2 is installed automatically
- **macOS:** Code signing requires an Apple Developer certificate. Set `signingIdentity` for distribution
- **Linux:** WebKitGTK is a runtime dependency. The `deb` config can specify package dependencies

---

## Auto-Updater

### Setup

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
```

```json
// Capability permission
{
  "permissions": ["updater:default"]
}
```

### Updater Configuration

```json
// tauri.conf.json
{
  "bundle": {
    "createUpdaterArtifacts": "v1Compatible"
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://releases.example.com/{{target}}/{{arch}}/{{current_version}}"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### Check and Install Updates

```typescript
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const update = await check();
if (update) {
  console.log(`Update available: ${update.version}`);

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        console.log(`Downloading ${event.data.contentLength} bytes`);
        break;
      case "Progress":
        console.log(`Downloaded ${event.data.chunkLength} bytes`);
        break;
      case "Finished":
        console.log("Download complete");
        break;
    }
  });

  // Restart the app to apply the update
  await relaunch();
}
```

**Key points:**

- Generate signing keys with `cargo tauri signer generate` -- store the private key securely
- The `pubkey` in config is the PUBLIC key (safe to commit)
- `{{target}}`, `{{arch}}`, `{{current_version}}` are template variables resolved at runtime
- The update endpoint must return JSON with `version`, `url`, `signature`, and optional `notes`
- `createUpdaterArtifacts: "v1Compatible"` generates the update bundle alongside the installer

---

## Sidecar Binaries

Bundle external executables with your app.

```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": ["binaries/ffmpeg"]
  }
}
```

```
// File naming convention (platform-specific)
binaries/ffmpeg-x86_64-pc-windows-msvc.exe
binaries/ffmpeg-x86_64-apple-darwin
binaries/ffmpeg-x86_64-unknown-linux-gnu
binaries/ffmpeg-aarch64-apple-darwin
```

```rust
use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn convert_video(app: tauri::AppHandle, input: String) -> Result<String, String> {
    let output = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-i", &input, "output.mp4"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

**Key point:** Sidecar binary filenames must include the Rust target triple suffix. Tauri resolves the correct binary for the current platform at runtime. The shell plugin is required for sidecar execution.

---

## Build Size Optimization

| Technique                    | Impact              | How                                              |
| ---------------------------- | ------------------- | ------------------------------------------------ |
| Release profile              | ~50-70% smaller     | Default for `cargo tauri build`                  |
| Strip symbols                | ~10-20% smaller     | `[profile.release] strip = true` in `Cargo.toml` |
| LTO (link-time optimization) | ~10-20% smaller     | `[profile.release] lto = true` in `Cargo.toml`   |
| `opt-level = "s"`            | Optimize for size   | `[profile.release] opt-level = "s"`              |
| `codegen-units = 1`          | Better optimization | `[profile.release] codegen-units = 1`            |
| UPX compression              | ~50% smaller        | Post-build binary compression                    |

```toml
# Cargo.toml
[profile.release]
strip = true
lto = true
opt-level = "s"
codegen-units = 1
```

**Key point:** These settings increase compile time significantly (10-30 min for clean builds). Use `cargo tauri build --debug` during development for faster iteration.

---

See [reference.md](../reference.md) for CLI commands and [security.md](security.md) for capability configuration.
