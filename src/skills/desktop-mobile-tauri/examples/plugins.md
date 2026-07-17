# Tauri Mobile - Plugin Examples

> Mobile-specific plugin setup and usage: biometric, barcode-scanner, NFC, haptics, geolocation. See [core.md](core.md) for plugin registration and permission layering. See [SKILL.md](../SKILL.md) for decision frameworks.

---

## Biometric Authentication

Prompt the user for fingerprint or Face ID authentication. Mobile only (iOS, Android).

### Setup

```sh
npx tauri add biometric
```

```rust
// src-tauri/src/lib.rs -- conditional registration
#[cfg(mobile)]
builder = builder.plugin(tauri_plugin_biometric::init());
```

```xml
<!-- src-tauri/Info.ios.plist -->
<key>NSFaceIDUsageDescription</key>
<string>Authenticate to access secure features</string>
```

```json
// src-tauri/capabilities/mobile.json
{ "permissions": ["biometric:default"] }
```

### Usage

```typescript
import { authenticate } from "@tauri-apps/plugin-biometric";

// Authenticate the user
try {
  await authenticate("Confirm your identity to proceed", {
    title: "Authentication Required",
    subtitle: "Verify to access sensitive data",
    confirmationRequired: true,
    allowDeviceCredential: true, // Fall back to PIN/password if biometric fails
  });
  // Authentication succeeded
} catch (error) {
  // Authentication failed, was cancelled, or hardware not available
  console.error("Biometric auth failed:", error);
}
```

**Key point:** The `authenticate` function throws if hardware is unavailable or authentication fails -- wrap in try/catch. Setting `allowDeviceCredential: true` lets the user fall back to PIN/pattern/password.

---

## Barcode Scanner

Scan QR codes, EAN-13, and other barcode formats using the device camera. Mobile only (iOS, Android).

### Setup

```sh
npx tauri add barcode-scanner
```

```rust
#[cfg(mobile)]
builder = builder.plugin(tauri_plugin_barcode_scanner::init());
```

```xml
<!-- src-tauri/Info.ios.plist -->
<key>NSCameraUsageDescription</key>
<string>Required to scan barcodes and QR codes</string>
```

```json
// src-tauri/capabilities/mobile.json
{
  "permissions": [
    "barcode-scanner:allow-scan",
    "barcode-scanner:allow-cancel",
    "barcode-scanner:allow-check-permissions",
    "barcode-scanner:allow-request-permissions"
  ]
}
```

### Usage

```typescript
import { scan, cancel, Format } from "@tauri-apps/plugin-barcode-scanner";

// Scan with camera overlay (opens separate camera view)
const result = await scan({
  formats: [Format.QR_CODE, Format.EAN_13],
});
console.log("Scanned:", result.content);

// Windowed mode: makes webview transparent, camera shows behind it
const result2 = await scan({
  windowed: true,
  formats: [Format.QR_CODE],
});

// Cancel an ongoing scan
await cancel();
```

**Key point:** `windowed: true` makes the webview transparent so the camera feed shows behind your UI -- useful for custom scan overlays. Without it, a separate full-screen camera view opens.

---

## NFC (Near Field Communication)

Read and write NFC tags. Mobile only (iOS, Android). Requires iOS 14+.

### Setup

```sh
npx tauri add nfc
```

```rust
#[cfg(mobile)]
builder = builder.plugin(tauri_plugin_nfc::init());
```

```xml
<!-- src-tauri/Info.ios.plist -->
<key>NFCReaderUsageDescription</key>
<string>Required to read NFC tags</string>
```

On iOS, you must also enable the "Near Field Communication Tag Reading" capability in Xcode or add it to entitlements.

```json
// src-tauri/capabilities/mobile.json
{ "permissions": ["nfc:default"] }
```

### Usage

```typescript
import {
  isAvailable,
  scan,
  write,
  textRecord,
  uriRecord,
} from "@tauri-apps/plugin-nfc";

// Check NFC hardware availability
const available = await isAvailable();
if (!available) {
  console.warn("NFC not available on this device");
  return;
}

// Read an NFC tag
const tag = await scan({
  type: "tag",
  keepSessionAlive: false,
});
console.log("Tag data:", tag);

// Write to an NFC tag
await write([uriRecord("https://example.com"), textRecord("Hello from Tauri")]);
```

**Key point:** NFC requires physical proximity. On iOS, a system NFC sheet appears during scanning. `keepSessionAlive: true` allows multiple reads without re-triggering the scan UI.

---

## Haptics (Vibration and Feedback)

Provide tactile feedback on mobile devices. Mobile only (iOS, Android).

### Setup

```sh
npx tauri add haptics
```

```rust
#[cfg(mobile)]
builder = builder.plugin(tauri_plugin_haptics::init());
```

```json
// src-tauri/capabilities/mobile.json
{
  "permissions": [
    "haptics:allow-vibrate",
    "haptics:allow-impact-feedback",
    "haptics:allow-notification-feedback",
    "haptics:allow-selection-feedback"
  ]
}
```

### Usage

```typescript
import {
  vibrate,
  impactFeedback,
  notificationFeedback,
  selectionFeedback,
} from "@tauri-apps/plugin-haptics";

// Simple vibration (duration in milliseconds)
const VIBRATE_DURATION_MS = 100;
await vibrate(VIBRATE_DURATION_MS);

// Impact feedback (light, medium, heavy)
await impactFeedback("medium");

// Notification feedback (success, warning, error)
await notificationFeedback("success");

// Selection feedback (subtle tick for UI selection changes)
await selectionFeedback();
```

**Key point:** iOS maps these to UIKit haptic feedback generators (UIImpactFeedbackGenerator, etc.). Android vibration support varies by device -- budget phones may not support all feedback styles. No platform permissions needed beyond Tauri capability grants.

---

## Geolocation

Get and track device position including altitude, heading, and speed. Works on mobile; limited desktop support.

### Setup

```sh
npx tauri add geolocation
```

```rust
#[cfg(mobile)]
builder = builder.plugin(tauri_plugin_geolocation::init());
```

```xml
<!-- src-tauri/Info.ios.plist -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Required for location-based features</string>
```

```xml
<!-- gen/android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" android:required="true" />
```

```json
// src-tauri/capabilities/mobile.json
{
  "permissions": [
    "geolocation:allow-get-current-position",
    "geolocation:allow-watch-position",
    "geolocation:allow-check-permissions",
    "geolocation:allow-request-permissions"
  ]
}
```

### Usage

```typescript
import {
  checkPermissions,
  requestPermissions,
  getCurrentPosition,
  watchPosition,
} from "@tauri-apps/plugin-geolocation";

// Request location permission
const status = await checkPermissions();
if (status.location !== "granted") {
  const result = await requestPermissions(["location"]);
  if (result.location !== "granted") {
    return; // User denied
  }
}

// Get current position (one-shot)
const position = await getCurrentPosition();
console.log(
  `Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude}`,
);
console.log(`Altitude: ${position.coords.altitude}`);
console.log(`Speed: ${position.coords.speed}`);

// Watch position (continuous tracking)
const watchId = await watchPosition(
  { enableHighAccuracy: true },
  (position, error) => {
    if (error) {
      console.error("Location error:", error);
      return;
    }
    console.log(
      `Updated: ${position.coords.latitude}, ${position.coords.longitude}`,
    );
  },
);

// Stop watching (important for battery life)
// clearWatch(watchId);
```

**Key point:** Always request permissions before accessing location. `enableHighAccuracy: true` uses GPS (slower, more battery, more precise). Call `clearWatch()` when tracking is no longer needed -- continuous GPS tracking drains battery quickly.

---

See [core.md](core.md) for the permission layering pattern and [native-plugins.md](native-plugins.md) for writing custom plugins.
