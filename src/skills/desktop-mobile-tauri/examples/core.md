# Tauri Mobile - Core Examples

> Project setup, mobile plugin registration, platform permissions, conditional compilation, and debugging. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [plugins.md](plugins.md) for mobile-specific plugin usage.

---

## Prerequisites

### iOS (macOS only)

```sh
# Install Xcode from Mac App Store (NOT just Command Line Tools)

# Add iOS Rust targets
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim

# Install CocoaPods
brew install cocoapods
```

### Android

```sh
# Install Android Studio from https://developer.android.com/studio

# Add Android Rust targets
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Set environment variables (add to shell profile):

```sh
# Point to Android Studio's bundled JDK
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
# On Linux: export JAVA_HOME="/opt/android-studio/jbr"

# Android SDK and NDK paths
export ANDROID_HOME="$HOME/Library/Android/sdk"
# On Linux: export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk | sort -V | tail -1)"
```

Use Android Studio SDK Manager to install: Android SDK Platform, Platform-Tools, NDK (Side by side), Build-Tools, Command-line Tools.

---

## Project Initialization

```sh
# Initialize Android target (creates gen/android/ directory)
npx tauri android init

# Initialize iOS target (creates gen/apple/ directory) -- macOS only
npx tauri ios init
```

After initialization, ensure `lib.rs` has the mobile entry point:

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![/* your commands */])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Why this pattern:** `tauri android init` and `tauri ios init` scaffold platform-specific project files. The `#[cfg_attr(mobile, tauri::mobile_entry_point)]` attribute generates the native entry point (Activity on Android, UIApplicationDelegate on iOS). Without it, the app compiles but cannot start.

**Common mistake:** Running `tauri ios init` on Linux or Windows -- iOS development requires macOS with Xcode.

---

## Mobile Plugin Registration (Conditional)

Mobile-only plugins must use `#[cfg(mobile)]` to avoid desktop build failures:

```toml
# src-tauri/Cargo.toml -- conditional dependencies
[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]
tauri-plugin-biometric = "2"
tauri-plugin-barcode-scanner = "2"
tauri-plugin-nfc = "2"
tauri-plugin-haptics = "2"
tauri-plugin-geolocation = "2"
```

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Register mobile-only plugins conditionally
    #[cfg(mobile)]
    {
        builder = builder
            .plugin(tauri_plugin_biometric::init())
            .plugin(tauri_plugin_barcode_scanner::init())
            .plugin(tauri_plugin_nfc::init())
            .plugin(tauri_plugin_haptics::init())
            .plugin(tauri_plugin_geolocation::init());
    }

    // Cross-platform plugins -- register unconditionally
    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![/* commands */])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Why this pattern:** Mobile-only plugins depend on native iOS/Android libraries that are not available on desktop platforms. Conditional compilation prevents linker errors on desktop builds. Cross-platform plugins (fs, store, dialog, etc.) work on all platforms and should be registered unconditionally.

**Common mistake:** Registering `tauri_plugin_biometric::init()` without `#[cfg(mobile)]` -- compiles on the mobile target but fails to link on desktop.

---

## Platform Permission Layering

Mobile plugins require three layers of permissions:

### Layer 1: Tauri Capability File

```json
{
  "$schema": "../gen/schemas/mobile-schema.json",
  "identifier": "mobile-capability",
  "description": "Permissions for mobile features",
  "platforms": ["android", "iOS"],
  "permissions": [
    "core:default",
    "biometric:default",
    "barcode-scanner:allow-scan",
    "barcode-scanner:allow-cancel",
    "geolocation:allow-get-current-position",
    "geolocation:allow-watch-position",
    "geolocation:allow-check-permissions",
    "geolocation:allow-request-permissions",
    "nfc:default",
    "haptics:default"
  ]
}
```

**Note:** Use `mobile-schema.json` (not `desktop-schema.json`) for mobile-specific capabilities. You can also set `"platforms": ["android", "iOS"]` to restrict the capability to mobile.

### Layer 2: iOS Info.plist

```xml
<!-- src-tauri/Info.ios.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Camera (barcode scanner) -->
    <key>NSCameraUsageDescription</key>
    <string>Required to scan barcodes and QR codes</string>

    <!-- Biometric (Face ID) -->
    <key>NSFaceIDUsageDescription</key>
    <string>Authenticate to access secure features</string>

    <!-- Location -->
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>Required for location-based features</string>

    <!-- NFC -->
    <key>NFCReaderUsageDescription</key>
    <string>Required to read NFC tags</string>
</dict>
</plist>
```

### Layer 3: Android Manifest

```xml
<!-- gen/android/app/src/main/AndroidManifest.xml -->
<!-- Add inside <manifest> tag -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.NFC" />

<!-- Optional: declare required hardware -->
<uses-feature android:name="android.hardware.camera" android:required="true" />
<uses-feature android:name="android.hardware.location.gps" android:required="true" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

**Why three layers:** Tauri capabilities control which plugin commands the webview can invoke. iOS Info.plist entries explain to the user WHY the app needs each permission. Android manifest entries declare which OS-level permissions the app requires. Missing any layer causes failures at different stages.

**Common mistake:** Adding Tauri capability permissions but forgetting the iOS usage description string -- iOS silently denies the permission request.

---

## Runtime Permission Requests

Many mobile features require explicit user consent at runtime:

```typescript
import {
  checkPermissions,
  requestPermissions,
} from "@tauri-apps/plugin-geolocation";

// Check current permission status
const status = await checkPermissions();

if (status.location !== "granted") {
  // Request permission from the user
  const result = await requestPermissions(["location"]);
  if (result.location !== "granted") {
    // User denied -- handle gracefully
    return;
  }
}

// Now safe to use the API
import { getCurrentPosition } from "@tauri-apps/plugin-geolocation";
const position = await getCurrentPosition();
```

**Why this pattern:** On both iOS and Android, camera, location, and NFC require runtime user consent. Tauri plugins auto-generate `checkPermissions` and `requestPermissions` commands. Always check before using a protected API.

---

## Platform-Conditional Rust Code

### Conditional Dependencies

```toml
# src-tauri/Cargo.toml

# Mobile-only dependencies
[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]
tauri-plugin-biometric = "2"

# Android-only dependencies
[target.'cfg(target_os = "android")'.dependencies]
jni = "0.21"

# iOS-only dependencies
[target.'cfg(target_os = "ios")'.dependencies]
# iOS-specific crates here
```

### Conditional Command Logic

```rust
#[tauri::command]
fn get_device_info() -> serde_json::Value {
    #[cfg(target_os = "android")]
    {
        serde_json::json!({
            "platform": "android",
            "webview": "Android WebView"
        })
    }

    #[cfg(target_os = "ios")]
    {
        serde_json::json!({
            "platform": "ios",
            "webview": "WKWebView"
        })
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        serde_json::json!({
            "platform": "desktop",
            "webview": "system"
        })
    }
}
```

### Desktop/Mobile Module Split (Plugin Pattern)

```rust
// src-tauri/src/lib.rs
#[cfg(mobile)]
mod mobile;
#[cfg(not(mobile))]
mod desktop;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(mobile)]
            mobile::setup(app)?;

            #[cfg(not(mobile))]
            desktop::setup(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Why this pattern:** The module split keeps platform-specific code isolated. Rust's `cfg` attributes are compile-time -- code for other platforms is not included in the binary.

---

## Running and Debugging

### Dev Commands

```sh
# iOS simulator (macOS only)
npx tauri ios dev

# Specific iOS device or simulator
npx tauri ios dev 'iPhone 16'

# Android emulator
npx tauri android dev

# Open in Xcode / Android Studio for native tooling
npx tauri ios dev --open
npx tauri android dev --open

# Build for release
npx tauri ios build
npx tauri android build
```

### WebView Debugging

**iOS (Safari Web Inspector):**

1. Open Safari on Mac
2. Safari > Settings > Advanced > "Show features for web developers"
3. On physical device: Settings > Safari > Advanced > Web Inspector = ON
4. Run `tauri ios dev`
5. Safari > Develop menu > select device > inspect localhost

**Android (Chrome DevTools):**

1. Enable USB Debugging on device (Settings > Developer Options)
2. Run `tauri android dev`
3. Open `chrome://inspect` in Chrome on your computer
4. Select your device and click "inspect"

### Native Log Debugging

```sh
# Android: filter Tauri logs via logcat
adb logcat | grep -i tauri

# iOS: view logs in Xcode console when using --open
npx tauri ios dev --open
# Logs appear in Xcode's debug console
```

### Physical Device Setup

For physical devices, the dev server must be accessible over the local network. The Tauri CLI handles this automatically, but your frontend dev server must respect the `TAURI_DEV_HOST` environment variable:

```typescript
// Frontend dev server config -- adapt to your build tool
const DEV_PORT = 1420;
const HMR_PORT = 1421;

const serverConfig = {
  host: process.env.TAURI_DEV_HOST || "localhost",
  port: DEV_PORT,
  strictPort: true,
  hmr: process.env.TAURI_DEV_HOST
    ? { protocol: "ws", host: process.env.TAURI_DEV_HOST, port: HMR_PORT }
    : undefined,
};
```

**Why this pattern:** When developing on a physical device, the device connects to your computer's dev server over the network. `TAURI_DEV_HOST` provides the correct IP address for the device to reach.

---

## Mobile UI Considerations

### Safe Areas (Notch, Home Indicator)

Tauri does not provide built-in safe area handling. Use CSS environment variables:

```css
/* Respect device safe areas */
.app-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

Add the viewport meta tag for proper mobile rendering:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover"
/>
```

**Key point:** `viewport-fit=cover` enables edge-to-edge rendering, allowing content to extend under the notch and home indicator. Without `env(safe-area-inset-*)`, content will be obscured.

---

## Android 16KB Page Size Compliance

For Google Play compliance with newer devices, add this when using NDK versions before 28:

```toml
# .cargo/config.toml
[target.aarch64-linux-android]
rustflags = ["-C", "link-arg=-Wl,-z,max-page-size=16384"]
```

**Why this matters:** Android devices with ARM64 processors may use 16KB memory pages. Without this flag, the app may crash on those devices.

---

See [plugins.md](plugins.md) for mobile-specific plugin usage and [native-plugins.md](native-plugins.md) for custom Swift/Kotlin plugin development.
