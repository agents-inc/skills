# Tauri Plugins - App Lifecycle

> Updater, deep-link, autostart, single-instance, window-state, and global-shortcut plugin APIs. See [core.md](core.md) for installation and permission patterns. See [reference.md](../reference.md) for endpoint formats and platform support.

---

## Updater Plugin (Desktop Only)

### Rust Setup

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Configuration (tauri.conf.json)

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "CONTENT_FROM_PUBLIC_KEY_FILE",
      "endpoints": [
        "https://releases.example.com/{{target}}/{{arch}}/{{current_version}}"
      ]
    }
  }
}
```

**Endpoint variables:** `{{current_version}}`, `{{target}}` (linux/windows/darwin), `{{arch}}` (x86_64/aarch64).

### JavaScript API

```typescript
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const update = await check();
if (update) {
  console.log(`Update to v${update.version} available: ${update.body}`);

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        console.log(`Downloading ${event.data.contentLength} bytes`);
        break;
      case "Progress":
        console.log(`Downloaded chunk: ${event.data.chunkLength} bytes`);
        break;
      case "Finished":
        console.log("Download complete");
        break;
    }
  });

  await relaunch();
}
```

### Signing Keys

```sh
# Generate signing keypair (do this once, keep private key safe)
cargo tauri signer generate -w ~/.tauri/myapp.key

# Set environment variables during builds
export TAURI_SIGNING_PRIVATE_KEY="path/to/private.key"  # or key content
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="optional-password"
```

**Key points:**

- Signature validation is mandatory and cannot be disabled
- Losing the private key means you cannot ship updates to existing users
- The public key goes in `tauri.conf.json`, the private key stays in CI/CD secrets
- Windows `installMode` options: `"passive"` (default, minimal UI), `"basicUi"` (interactive), `"quiet"` (no feedback)
- Permissions: `"updater:default"` grants check, download, and install

---

## Deep Link Plugin

### Configuration (tauri.conf.json)

```json
{
  "plugins": {
    "deep-link": {
      "mobile": [{ "scheme": ["myapp"], "appLink": false }],
      "desktop": {
        "schemes": ["myapp"]
      }
    }
  }
}
```

### JavaScript API

```typescript
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

// Check if app was started via deep link
const startUrls = await getCurrent();
if (startUrls) {
  handleDeepLink(startUrls);
}

// Listen for deep links while the app is running
await onOpenUrl((urls) => {
  console.log("Deep link received:", urls);
  handleDeepLink(urls);
});

function handleDeepLink(urls: string[]) {
  for (const url of urls) {
    const parsed = new URL(url);
    // Route based on path: myapp://settings/theme
    console.log(`Scheme: ${parsed.protocol}, Path: ${parsed.pathname}`);
  }
}
```

### Rust Runtime Registration (Desktop)

```rust
use tauri_plugin_deep_link::DeepLinkExt;

app.deep_link().register_all()?;  // Register all configured schemes
// Or register a specific scheme:
app.deep_link().register("myapp")?;
```

**Key points:**

- On desktop, deep links arrive as command-line arguments -- combine with single-instance plugin for handling when the app is already running
- On mobile, `appLink: true` requires server-side verification files (`.well-known/assetlinks.json` for Android, `.well-known/apple-app-site-association` for iOS)
- `appLink: false` uses custom URI schemes (`myapp://`) without server verification
- Permissions: `"deep-link:default"` grants get-current and event listening

---

## Autostart Plugin (Desktop Only)

### Rust Setup

```rust
tauri::Builder::default()
    .setup(|app| {
        #[cfg(desktop)]
        app.handle().plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),  // Optional args passed on startup
        ));
        Ok(())
    })
```

### JavaScript API

```typescript
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

// Enable launch on login
await enable();

// Check status
const enabled = await isEnabled();
console.log(`Autostart: ${enabled ? "enabled" : "disabled"}`);

// Disable launch on login
await disable();
```

**Key points:**

- Desktop-only -- guard with `#[cfg(desktop)]`
- `MacosLauncher::LaunchAgent` is the recommended macOS method
- Optional args are passed to the app when it auto-starts (useful for `--minimized` flag)
- Permissions: `"autostart:allow-enable"`, `"autostart:allow-disable"`, `"autostart:allow-is-enabled"`

---

## Single Instance Plugin (Desktop Only)

### Rust Setup

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        // This callback runs in the EXISTING instance when a second instance is launched
        println!("Second instance launched with args: {:?}", argv);
        println!("Working directory: {}", cwd);

        // Focus the existing window
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_focus();
        }

        // Handle deep links from argv
        for arg in &argv {
            if arg.starts_with("myapp://") {
                // Handle deep link
            }
        }
    }))
```

**Key points:**

- Desktop-only
- When a second instance starts, the callback fires in the FIRST instance and the second instance exits
- The `argv` parameter contains command-line arguments from the second instance (useful for deep links on desktop)
- Combine with the deep-link plugin for complete deep link handling on desktop
- No JS API needed -- behavior is entirely configured in Rust

---

## Window State Plugin (Desktop Only)

### Rust Setup

```rust
tauri::Builder::default()
    .setup(|app| {
        #[cfg(desktop)]
        app.handle().plugin(
            tauri_plugin_window_state::Builder::default().build()
        )?;
        Ok(())
    })
```

**That is it.** The plugin automatically:

- Saves window position, size, and maximized state on close
- Restores saved state on next launch
- No JavaScript API needed

**Key points:**

- Zero-config persistence of window geometry
- Data persists in the app's data directory
- Works automatically for all windows
- Permissions: `"window-state:default"`

---

## Global Shortcut Plugin (Desktop Only)

### JavaScript API

```typescript
import {
  register,
  unregister,
  unregisterAll,
  isRegistered,
} from "@tauri-apps/plugin-global-shortcut";

// Register a global shortcut
await register("CommandOrControl+Shift+C", () => {
  console.log("Global shortcut triggered");
});

// Check if registered
const registered = await isRegistered("CommandOrControl+Shift+C");

// Unregister specific shortcut
await unregister("CommandOrControl+Shift+C");

// Unregister all shortcuts
await unregisterAll();
```

### Rust API (with Pressed/Released Events)

```rust
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyN);

app.handle().plugin(
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |_app, shortcut, event| {
            match event.state() {
                ShortcutState::Pressed => println!("Shortcut pressed"),
                ShortcutState::Released => println!("Shortcut released"),
            }
        })
        .build(),
)?;

app.global_shortcut().register(shortcut)?;
```

**Key points:**

- Desktop-only -- guard with `#[cfg(desktop)]`
- `CommandOrControl` maps to `Cmd` on macOS and `Ctrl` on Windows/Linux
- Registering a shortcut already bound system-wide may silently fail or override the system binding (OS-dependent)
- Always unregister shortcuts when no longer needed to avoid conflicts
- Permissions: `"global-shortcut:allow-register"`, `"global-shortcut:allow-unregister"`, `"global-shortcut:allow-is-registered"`

---

See [system.md](system.md) for shell, notification, clipboard, dialog APIs. See [networking.md](networking.md) for http and log APIs.
