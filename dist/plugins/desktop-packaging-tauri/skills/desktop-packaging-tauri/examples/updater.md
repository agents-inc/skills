# Tauri Bundling - Auto-Updater

> Auto-updater plugin setup, Ed25519 key generation, endpoint format, JS and Rust usage, CI integration. See [SKILL.md](../SKILL.md) for decision frameworks. See [reference.md](../reference.md) for endpoint response format and platform target strings.

---

## Setup

### Install the Plugin

```sh
# Using Tauri CLI (registers in Cargo.toml + lib.rs)
cargo tauri add updater

# Or manually:
cargo add tauri-plugin-updater
npm add @tauri-apps/plugin-updater
```

### Register in Rust

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Note:** The updater is desktop-only. Use the `#[cfg(desktop)]` gate if your app targets both desktop and mobile:

```rust
#[cfg(desktop)]
app.handle().plugin(tauri_plugin_updater::Builder::new().build());
```

### Add Permissions

```json
{
  "permissions": ["updater:default"]
}
```

Individual permissions: `updater:allow-check`, `updater:allow-download`, `updater:allow-install`, `updater:allow-download-and-install`.

---

## Key Generation

Generate an Ed25519 (Minisign) key pair:

```sh
cargo tauri signer generate -w ~/.tauri/myapp.key
```

This produces:

- **Private key** -- store securely, never commit to source control
- **Public key** -- safe to commit, goes in `tauri.conf.json`

### Build-Time Environment Variables

Set before running `cargo tauri build`:

```sh
# Path to key file or raw key content
export TAURI_SIGNING_PRIVATE_KEY="~/.tauri/myapp.key"

# Optional password (if key is password-protected)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

**CRITICAL:** Without `TAURI_SIGNING_PRIVATE_KEY`, the build will not generate `.sig` signature files even if `createUpdaterArtifacts: true` is set.

---

## Configuration

### tauri.conf.json

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "endpoints": [
        "https://releases.example.com/{{target}}/{{arch}}/{{current_version}}"
      ]
    }
  }
}
```

**Template variables** (resolved at runtime):

- `{{current_version}}` -- app version from `tauri.conf.json`
- `{{target}}` -- `linux`, `windows`, or `darwin`
- `{{arch}}` -- `x86_64`, `aarch64`, `i686`, `armv7`

### Windows Update Behavior

```json
{
  "plugins": {
    "updater": {
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

- `"passive"` (default): Shows progress bar, no user interaction
- `"basicUi"`: Shows basic installer UI
- `"quiet"`: Silent installation

---

## Build Artifacts

When `createUpdaterArtifacts: true` and `TAURI_SIGNING_PRIVATE_KEY` is set:

| Platform | Installer                 | Signature File                 |
| -------- | ------------------------- | ------------------------------ |
| Linux    | `.AppImage`               | `.AppImage.sig`                |
| macOS    | `.app` (as `.app.tar.gz`) | `.app.tar.gz.sig`              |
| Windows  | `-setup.exe` or `.msi`    | `-setup.exe.sig` or `.msi.sig` |

---

## JavaScript Usage

### Check and Install Updates

```typescript
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

async function checkForUpdates(): Promise<void> {
  const update = await check();

  if (!update) {
    console.log("No update available");
    return;
  }

  console.log(`Update available: ${update.version}`);
  console.log(`Release notes: ${update.body}`);

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        console.log(
          `Downloading ${event.data.contentLength ?? "unknown"} bytes`,
        );
        break;
      case "Progress":
        console.log(`Downloaded chunk: ${event.data.chunkLength} bytes`);
        break;
      case "Finished":
        console.log("Download complete, installing...");
        break;
    }
  });

  // Restart the app to apply the update
  await relaunch();
}
```

### Runtime Configuration (JS)

```typescript
import { check } from "@tauri-apps/plugin-updater";

const update = await check({
  proxy: "https://proxy.example.com",
  timeout: 30000,
  headers: {
    Authorization: "Bearer token",
  },
  target: "macos-universal",
});
```

---

## Rust Usage

### Check and Install from Backend

```rust
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let update = app.updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    match update {
        Some(update) => {
            let version = update.version.clone();

            update.download_and_install(
                |chunk_length, content_length| {
                    println!("downloaded {chunk_length} of {content_length:?}");
                },
                || {
                    println!("download finished");
                },
            ).await.map_err(|e| e.to_string())?;

            Ok(Some(version))
        }
        None => Ok(None),
    }
}
```

### Runtime Configuration (Rust)

```rust
use tauri_plugin_updater::UpdaterExt;

// Custom endpoints at runtime
let update = app.updater_builder()
    .endpoints(vec!["https://custom.endpoint.com/update/{{target}}/{{arch}}/{{current_version}}".parse().unwrap()])?
    .build()?
    .check()
    .await?;

// Custom target (e.g., universal macOS binary)
let update = app.updater_builder()
    .target("macos-universal")
    .build()?
    .check()
    .await?;

// Custom version comparator (allow downgrades)
let update = app.updater_builder()
    .version_comparator(|current, update| update.version != current)
    .build()?
    .check()
    .await?;
```

---

## Update Endpoint

### Static JSON (GitHub Releases, S3)

Host a JSON file per platform, or a single JSON with all platforms:

```json
{
  "version": "1.2.0",
  "notes": "Bug fixes and improvements",
  "pub_date": "2025-06-15T00:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "url": "https://github.com/myorg/myapp/releases/download/v1.2.0/my-app_1.2.0_amd64.AppImage"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "url": "https://github.com/myorg/myapp/releases/download/v1.2.0/my-app.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "url": "https://github.com/myorg/myapp/releases/download/v1.2.0/my-app_1.2.0_x64-setup.exe"
    }
  }
}
```

Required fields: `version`, `platforms.[target].url`, `platforms.[target].signature`.

### Dynamic Endpoint

A server that returns HTTP 204 (no update) or HTTP 200 with:

```json
{
  "version": "1.2.0",
  "url": "https://cdn.example.com/my-app-setup.exe",
  "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
  "notes": "Bug fixes",
  "pub_date": "2025-06-15T00:00:00Z"
}
```

Required fields: `version`, `url`, `signature`.

### Using GitHub Releases with tauri-action

The `tauri-action` automatically generates the update JSON when configured:

```yaml
- uses: tauri-apps/tauri-action@v0
  with:
    tagName: app-v__VERSION__
    releaseName: "App v__VERSION__"
    updaterJsonPreferNsis: true # Prefer NSIS over MSI for Windows updates
```

The action creates a `latest.json` artifact compatible with the static endpoint format. Point your `endpoints` config at the release asset URL.

---

## Common Updater Pitfalls

- **Missing `TAURI_SIGNING_PRIVATE_KEY`** at build time -- `.sig` files are not generated, updates will fail signature verification
- **Lost private key** -- Users with the app already installed cannot receive updates. Generate a new key pair and distribute a fresh build.
- **Windows: app exits during update** -- This is expected behavior on Windows. The installer takes over and restarts the app.
- **HTTP endpoints** -- Set `dangerousInsecureTransportProtocol: true` for non-HTTPS endpoints (not recommended for production)
- **Version format** -- Must be valid semver. The updater compares versions; non-semver strings cause parse errors.
- **macOS update artifact** -- The updater expects `.app.tar.gz` (not `.dmg`). The build produces this automatically.

---

See [core.md](core.md) for bundle configuration, [code-signing.md](code-signing.md) for signing setup, and [ci-cd.md](ci-cd.md) for the GitHub Actions workflow.
