# Tauri Plugins - Mobile-Only

> Barcode scanner, biometric, geolocation, haptics, and NFC plugin APIs. See [core.md](core.md) for installation and permission patterns. See [reference.md](../reference.md) for platform support.

---

## Barcode Scanner Plugin (Mobile Only)

```typescript
import { scan, Format } from "@tauri-apps/plugin-barcode-scanner";

// Scan a barcode using the device camera
const result = await scan({
  formats: [Format.QR_CODE, Format.EAN_13],
  windowed: false, // Full-screen scanner
});

console.log(`Scanned: ${result.content} (format: ${result.format})`);
```

**Key points:**

- iOS and Android only -- not available on desktop
- Requires camera permission on both platforms
- `windowed: true` shows the scanner in a small overlay; `false` uses full-screen
- Supported formats: QR Code, EAN-8, EAN-13, Code 39, Code 128, and more
- Permissions: `"barcode-scanner:default"` or `"barcode-scanner:allow-scan"`

---

## Biometric Plugin (Mobile Only)

```typescript
import { authenticate } from "@tauri-apps/plugin-biometric";

// Authenticate the user with biometric prompt
try {
  await authenticate("Confirm your identity to proceed", {
    title: "Biometric Authentication",
    subtitle: "Verify to access settings",
    confirmationRequired: true,
    allowDeviceCredential: true, // Fall back to PIN/password
  });
  console.log("Authentication successful");
} catch (error) {
  console.error("Authentication failed:", error);
}
```

**Key points:**

- iOS (Face ID, Touch ID) and Android (fingerprint, face) only
- `allowDeviceCredential: true` allows PIN/password as fallback
- `confirmationRequired` adds explicit confirmation after biometric (Android only)
- The function throws on failure -- wrap in try/catch
- No `BiometryType` export -- the plugin only exports `authenticate` and permission helpers
- Permissions: `"biometric:default"` or `"biometric:allow-authenticate"`

---

## Geolocation Plugin (Mobile Only)

```typescript
import {
  getCurrentPosition,
  watchPosition,
} from "@tauri-apps/plugin-geolocation";

// Get current position
const position = await getCurrentPosition();
console.log(
  `Lat: ${position.coords.latitude}, Lng: ${position.coords.longitude}`,
);
console.log(`Accuracy: ${position.coords.accuracy}m`);

// Watch position changes
const watchId = await watchPosition(
  { enableHighAccuracy: true },
  (position) => {
    if (position) {
      console.log(
        `Moved to: ${position.coords.latitude}, ${position.coords.longitude}`,
      );
    }
  },
);
```

**Key points:**

- iOS and Android only
- Requires location permission on both platforms (the plugin handles permission requests)
- `enableHighAccuracy: true` uses GPS (higher battery usage)
- Cancel watching with `clearWatch(watchId)`
- Permissions: `"geolocation:default"`

---

## Haptics Plugin (Mobile Only)

```typescript
import {
  impactFeedback,
  notificationFeedback,
  selectionFeedback,
  vibrate,
} from "@tauri-apps/plugin-haptics";

// Impact feedback (tap sensation) -- accepts "light", "medium", "heavy"
await impactFeedback("medium");

// Notification feedback (success/warning/error vibration) -- accepts "success", "warning", "error"
await notificationFeedback("success");

// Selection feedback (light tap for UI selection)
await selectionFeedback();

// Custom vibration pattern (Android only -- iOS ignores duration)
const VIBRATION_DURATION_MS = 200;
await vibrate(VIBRATION_DURATION_MS);
```

**Key points:**

- iOS and Android only
- `impactFeedback` accepts string values: `"light"`, `"medium"`, `"heavy"`
- `notificationFeedback` accepts string values: `"success"`, `"warning"`, `"error"`
- iOS uses the Taptic Engine -- `vibrate()` duration is ignored on iOS
- Android uses the vibrator motor
- Permissions: `"haptics:default"`

---

## NFC Plugin (Mobile Only)

```typescript
import { scan, write, textRecord, uriRecord } from "@tauri-apps/plugin-nfc";

// Scan for NFC tags
const tag = await scan({
  type: "tag",
  keepSessionAlive: false,
});
console.log("Tag data:", tag);

// Write to an NFC tag
await write([textRecord("Hello from Tauri"), uriRecord("https://example.com")]);
```

**Key points:**

- iOS and Android only
- Requires NFC hardware and permission
- `scan()` takes an options object with `type` and `keepSessionAlive` fields
- `write()` accepts an array of records created with `textRecord()`, `uriRecord()`, etc.
- iOS requires a user-initiated scan action (cannot scan in background)
- Android supports background NFC scanning
- Permissions: `"nfc:default"` or `"nfc:allow-scan"`

---

See [core.md](core.md) for the four-step installation pattern. See [custom-plugins.md](custom-plugins.md) for building mobile-native plugin functionality.
