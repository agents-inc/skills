---
name: mobile-hardware-ble-nfc
description: BLE scanning/connecting/GATT operations with react-native-ble-plx, NFC tag reading/writing with react-native-nfc-manager, permissions, background mode, battery-efficient patterns
---

# BLE & NFC Patterns

> **Quick Guide:** Use `react-native-ble-plx` for BLE (scanning, connecting, GATT read/write/monitor). Use `react-native-nfc-manager` for NFC (NDEF read/write, tag technology access). BLE values are Base64-encoded -- decode before use. NFC operations follow request-technology/operate/cancel-technology lifecycle. Always clean up: remove BLE subscriptions, call `cancelTechnologyRequest()` for NFC, and `destroy()` the BleManager. MTU defaults to 23 bytes (20 usable) -- negotiate higher on Android. iOS auto-negotiates up to 187 bytes.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST call `destroy()` on BleManager when deallocating resources -- leaking the manager causes native memory leaks and zombie listeners)**

**(You MUST call `discoverAllServicesAndCharacteristics()` after connecting before any read/write/monitor operations -- GATT structure is not available until discovered)**

**(You MUST call `cancelTechnologyRequest()` in a finally block after every NFC operation -- failing to release the NFC session blocks subsequent scans)**

**(You MUST check BLE adapter state (`PoweredOn`) before scanning -- scanning while powered off or unauthorized throws errors silently on some devices)**

**(You MUST remove all BLE subscriptions (scan listeners, characteristic monitors, disconnect listeners) on cleanup -- leaked subscriptions cause crashes after component unmount)**

</critical_requirements>

---

**Auto-detection:** react-native-ble-plx, BleManager, startDeviceScan, connectToDevice, monitorCharacteristicForDevice, writeCharacteristicWithResponseForDevice, readCharacteristicForDevice, requestMTUForDevice, react-native-nfc-manager, NfcManager, NfcTech, Ndef, requestTechnology, cancelTechnologyRequest, writeNdefMessage, ndefHandler, useCodeScanner BLE, BLE scanning, NFC tag, NDEF record, characteristic notification, GATT

**When to use:**

- Scanning for and connecting to BLE peripherals (IoT sensors, wearables, medical devices)
- Reading/writing BLE GATT characteristics and monitoring notifications
- Reading NDEF tags or writing NDEF records to NFC tags
- Implementing background BLE reconnection with state restoration
- MTU negotiation for large data transfers over BLE
- Accessing low-level NFC technologies (NfcA, IsoDep, MifareUltralight)

**When NOT to use:**

- Classic Bluetooth audio/file transfer (different protocol, different libraries)
- BLE peripheral/server mode (react-native-ble-plx is central-only)
- Web-based Bluetooth (use Web Bluetooth API)
- Wi-Fi Direct or peer-to-peer networking

**Key patterns covered:**

- BLE lifecycle: scan, connect, discover services, read/write/monitor, disconnect
- Battery-efficient scanning with UUID filters and scan modes
- MTU negotiation (Android explicit, iOS automatic)
- Characteristic subscriptions (notifications/indications) with cleanup
- BLE reconnection and disconnect monitoring
- NFC NDEF read/write lifecycle with technology request/cancel
- NFC technology types and platform availability (iOS vs Android)
- Permission handling for both BLE and NFC

**Detailed Resources:**

- [examples/core.md](examples/core.md) - BLE scanning, connecting, GATT operations, disconnect handling
- [examples/nfc.md](examples/nfc.md) - NFC NDEF reading/writing, technology types, platform differences
- [reference.md](reference.md) - API quick reference, permission matrix, decision frameworks

---

<philosophy>

## Philosophy

BLE and NFC are hardware communication protocols with fundamentally different interaction models:

**BLE** is connection-oriented and long-lived. You scan for devices, establish a persistent connection, discover the GATT service/characteristic tree, then read/write/subscribe to characteristics over time. Connections can last minutes to hours. The main challenges are connection lifecycle management, reconnection, and battery-efficient scanning.

**NFC** is session-oriented and brief. You request a technology, tap a tag, perform one operation (read or write), and release the technology. Sessions last seconds. The main challenges are platform differences (iOS vs Android technology support) and ensuring proper cleanup.

**Core principles:**

1. **Lifecycle-driven** -- BLE connections have a strict flow: scan -> connect -> discover -> operate -> disconnect. Skipping steps causes silent failures.
2. **Subscription-based** -- BLE characteristic monitoring returns Subscription objects that MUST be removed on cleanup. NFC technology requests MUST be canceled in finally blocks.
3. **Base64-encoded** -- All BLE characteristic values are Base64-encoded strings. Decode before use, encode before write.
4. **Platform-aware** -- BLE permissions differ significantly between Android versions. NFC technology support varies between iOS and Android. Always check platform capabilities.

**When to use BLE:**

- Continuous communication with a peripheral (sensor readings, device control)
- Background monitoring (health devices, beacons)
- Large data transfers requiring MTU negotiation

**When to use NFC:**

- One-tap interactions (read a tag, write a tag, verify identity)
- Quick data exchange without pairing
- Tag provisioning or configuration

**When NOT to use either:**

- High-bandwidth streaming (use Wi-Fi or classic Bluetooth)
- Cross-platform web apps (use Web Bluetooth / Web NFC)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: BLE Manager Initialization and State

Create one BleManager instance for the app lifetime. Check adapter state before operations.

```typescript
import { BleManager, State } from "react-native-ble-plx";

const manager = new BleManager();

// Wait for Bluetooth to be ready
manager.onStateChange((state) => {
  if (state === State.PoweredOn) {
    // Safe to scan
  }
}, true); // true = emit current state immediately

// Cleanup on app teardown
manager.destroy();
```

**Why good:** single manager instance, state checked before operations, destroy called on cleanup, `true` flag emits current state immediately so you don't miss the initial PoweredOn

See [examples/core.md](examples/core.md) for full initialization with background mode support and state restoration.

---

### Pattern 2: BLE Scanning with Filters

Filter scans by service UUIDs for battery efficiency. Stop scanning as soon as you find the target device.

```typescript
const HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const SCAN_TIMEOUT_MS = 10000;

manager.startDeviceScan(
  [HEART_RATE_SERVICE_UUID], // Filter by service UUID -- null scans ALL devices
  { allowDuplicates: false },
  (error, device) => {
    if (error) {
      /* handle */ return;
    }
    if (device?.name === "MyDevice") {
      manager.stopDeviceScan();
      // Connect to device
    }
  },
);

// Always set a timeout to stop scanning
setTimeout(() => manager.stopDeviceScan(), SCAN_TIMEOUT_MS);
```

**Why good:** UUID filter reduces battery drain, scan timeout prevents indefinite scanning, duplicates disabled to reduce callback noise, scan stopped once target found

See [examples/core.md](examples/core.md) for complete scanning with Android scan modes and permission handling.

---

### Pattern 3: BLE Connection and GATT Discovery

Connect, discover services/characteristics, then operate. Always monitor for disconnects.

```typescript
const device = await manager.connectToDevice(deviceId, {
  requestMTU: 512, // Android only -- request larger MTU during connection
});

// MUST discover before read/write/monitor
await device.discoverAllServicesAndCharacteristics();

// Monitor for unexpected disconnects
const disconnectSubscription = device.onDisconnected(
  (error, disconnectedDevice) => {
    // Handle reconnection logic
  },
);

// Cleanup
disconnectSubscription.remove();
await device.cancelConnection();
```

**Why good:** MTU requested during connection (Android), GATT discovered before operations, disconnect monitored for reconnection, subscription removed on cleanup

See [examples/core.md](examples/core.md) for full connection flow with retry logic and error handling.

---

### Pattern 4: Reading and Writing BLE Characteristics

All values are Base64-encoded. Decode after read, encode before write.

```typescript
import { decode as atob, encode as btoa } from "base-64";

const SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const CHAR_UUID = "00002a37-0000-1000-8000-00805f9b34fb";

// Read
const characteristic = await device.readCharacteristicForService(
  SERVICE_UUID,
  CHAR_UUID,
);
const decodedValue = atob(characteristic.value ?? "");

// Write with response (acknowledged)
const base64Value = btoa("command-data");
await device.writeCharacteristicWithResponseForService(
  SERVICE_UUID,
  CHAR_UUID,
  base64Value,
);

// Write without response (faster, no acknowledgment)
await device.writeCharacteristicWithoutResponseForService(
  SERVICE_UUID,
  CHAR_UUID,
  base64Value,
);
```

**Why good:** named constants for UUIDs, Base64 decode/encode explicit, write-with-response used for reliable delivery, write-without-response available for speed

See [examples/core.md](examples/core.md) for complete read/write patterns with error handling.

---

### Pattern 5: Characteristic Monitoring (Notifications)

Subscribe to characteristic value changes. Returns a Subscription that MUST be removed.

```typescript
const subscription = device.monitorCharacteristicForService(
  SERVICE_UUID,
  CHAR_UUID,
  (error, characteristic) => {
    if (error) {
      /* handle */ return;
    }
    const value = atob(characteristic?.value ?? "");
    // Process incoming notification
  },
);

// CRITICAL: Remove on cleanup
subscription.remove();
```

**Why good:** subscription stored for cleanup, error handled in callback, value decoded from Base64

**Gotcha:** Check `characteristic.isNotifiable` or `characteristic.isIndicatable` before monitoring -- not all characteristics support notifications.

See [examples/core.md](examples/core.md) for monitoring with React hooks and cleanup patterns.

---

### Pattern 6: MTU Negotiation

Larger MTU = fewer packets for big payloads. iOS negotiates automatically (up to 187 bytes). Android requires explicit request.

```typescript
import { Platform } from "react-native";

const DESIRED_MTU = 512;
const BLE_HEADER_BYTES = 3;

// Request MTU after connection (Android only -- iOS auto-negotiates)
if (Platform.OS === "android") {
  const updatedDevice = await device.requestMTU(DESIRED_MTU);
  const usableBytes = updatedDevice.mtu - BLE_HEADER_BYTES;
  // usableBytes is the max payload per packet
}
```

**Why good:** platform check avoids unnecessary call on iOS, named constants for MTU and header size, usable bytes calculated correctly (MTU minus 3-byte ATT header)

See [reference.md](reference.md) for MTU size recommendations by use case.

---

### Pattern 7: NFC NDEF Read

Request NDEF technology, read the tag, clean up in finally block.

```typescript
import NfcManager, { NfcTech } from "react-native-nfc-manager";

// Initialize once at app start
await NfcManager.start();

async function readNdefTag(): Promise<string | null> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();

    if (tag?.ndefMessage && tag.ndefMessage.length > 0) {
      // tag.ndefMessage is an array of NDEF records
      // Each record has: tnf, type, id, payload (all number arrays)
      return String.fromCharCode(...tag.ndefMessage[0].payload);
    }
    return null;
  } catch (error) {
    // User cancelled or tag not found
    return null;
  } finally {
    // CRITICAL: Always release the NFC session
    await NfcManager.cancelTechnologyRequest();
  }
}
```

**Why good:** technology request and cancel in try/finally, error handled for user cancellation, start() called once at app initialization, tag null-checked before access

See [examples/nfc.md](examples/nfc.md) for complete NDEF reading with record parsing.

---

### Pattern 8: NFC NDEF Write

Request technology, encode the message, write, release.

```typescript
import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";

async function writeNdefTag(url: string): Promise<boolean> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    return true;
  } catch (error) {
    return false;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}
```

**Why good:** Ndef utility encodes records properly, try/finally ensures cleanup, boolean return signals success/failure

See [examples/nfc.md](examples/nfc.md) for text records, multi-record messages, and platform-specific handling.

---

### Pattern 9: BLE Permissions

BLE permissions differ significantly across Android versions. iOS requires Info.plist entries.

```typescript
import { Platform, PermissionsAndroid } from "react-native";

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    const apiLevel = Platform.Version;
    if (apiLevel >= 31) {
      // Android 12+: BLUETOOTH_SCAN + BLUETOOTH_CONNECT
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(results).every((r) => r === "granted");
    }
    // Android <12: ACCESS_FINE_LOCATION
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return result === "granted";
  }
  // iOS: permissions handled via Info.plist (NSBluetoothAlwaysUsageDescription)
  return true;
}
```

**Why good:** Android API level checked for correct permission set, Android 12+ uses new Bluetooth permissions, pre-12 falls back to location permission, iOS handled via plist

See [reference.md](reference.md) for the full permission matrix across platforms and Android versions.

</patterns>

---

<decision_framework>

## Decision Framework

### BLE vs NFC

```
What kind of hardware interaction?
|
+-> Continuous connection with a peripheral (sensor, wearable)?
|   +-> BLE -- long-lived connection with GATT operations
|
+-> One-tap read/write (tag, card)?
|   +-> NFC -- session-based, tap and go
|
+-> Background monitoring of nearby devices?
|   +-> BLE -- background scanning with state restoration
|
+-> Quick device provisioning (write config to tag)?
    +-> NFC -- write NDEF record, tap target device
```

### BLE Write Method

```
Which write method?
|
+-> Data MUST arrive reliably?
|   +-> writeCharacteristicWithResponseForService (acknowledged, slower)
|
+-> Speed matters more than reliability?
|   +-> writeCharacteristicWithoutResponseForService (fire-and-forget, faster)
|
+-> Large payload (> MTU)?
    +-> Negotiate higher MTU first, then use write-with-response
```

### NFC Technology Selection

```
What kind of NFC tag?
|
+-> Standard NDEF content (URL, text, MIME)?
|   +-> NfcTech.Ndef (iOS + Android)
|
+-> ISO 14443-3A tag (raw commands)?
|   +-> NfcTech.NfcA (iOS + Android)
|
+-> Smart card / ISO 7816 (APDU commands)?
|   +-> NfcTech.IsoDep (iOS + Android)
|
+-> Mifare Classic (Android only)?
|   +-> NfcTech.MifareClassic
|
+-> Mifare Ultralight (Android only)?
    +-> NfcTech.MifareUltralight
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Skipping `discoverAllServicesAndCharacteristics()` after connecting** -- read/write/monitor calls fail silently or throw errors because GATT structure is not cached
- **Not removing BLE subscriptions on cleanup** -- leaked subscriptions fire callbacks after component unmount, causing "setState on unmounted component" crashes
- **Forgetting `cancelTechnologyRequest()` in NFC finally block** -- NFC session stays locked, all subsequent NFC operations fail until app restart
- **Creating multiple BleManager instances** -- each instance allocates native resources. Create ONE and share it. Call `destroy()` only once on app teardown.
- **Scanning without UUID filter and without timeout** -- scans all devices indefinitely, drains battery rapidly

**Medium Priority Issues:**

- Not checking `State.PoweredOn` before scanning -- scanning while Bluetooth is off throws errors on some devices and does nothing on others
- Not handling Base64 encoding/decoding for BLE characteristic values -- raw Base64 strings are not human-readable and cannot be compared directly
- Using `writeCharacteristicWithoutResponseForService` for critical data -- fire-and-forget may lose data; use write-with-response for reliability
- Not requesting MTU on Android -- default 23-byte MTU means 20 usable bytes per packet, making large transfers extremely slow
- Hardcoding service/characteristic UUIDs inline instead of using named constants

**Gotchas & Edge Cases:**

- **iOS BLE device IDs are random UUIDs**, not MAC addresses -- they can change after Bluetooth is toggled or the device restarts. Do not persist iOS device IDs for reconnection; use service UUID scanning instead.
- **Android 12+ changed BLE permissions** -- `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` replaced `ACCESS_FINE_LOCATION` for BLE scanning (set `neverForLocation: true` in Expo config if scanning does not need location)
- **Android 14+ defaults MTU to 517 bytes** -- `requestMTU` may be unnecessary on newer Android devices. Check `device.mtu` after connection.
- **iOS auto-negotiates MTU up to 187 bytes** -- calling `requestMTU` on iOS has no effect
- **`onDeviceDisconnected` fires once per registration** -- you must re-register the listener after each reconnection if you want continued disconnect monitoring
- **NfcTech.NfcB, NfcF, NfcV are Android-only** -- iOS has different equivalents (Iso15693IOS, FelicaIOS). Always check platform before requesting a technology.
- **NFC on iOS shows a system scan dialog** -- you cannot customize it beyond the `alertMessage`. On Android, scanning is silent.
- **BLE `allowDuplicates` is iOS-only** -- Android always emits duplicates. Deduplicate in your scan callback using a Set of device IDs.
- **HCE (Host Card Emulation) is NOT supported by react-native-nfc-manager** -- use a dedicated library like `react-native-hce` for card emulation
- **NFC `getTag()` returns the last discovered tag** -- if no tag was tapped during the session, it returns the previous tag. Always request technology first.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST call `destroy()` on BleManager when deallocating resources -- leaking the manager causes native memory leaks and zombie listeners)**

**(You MUST call `discoverAllServicesAndCharacteristics()` after connecting before any read/write/monitor operations -- GATT structure is not available until discovered)**

**(You MUST call `cancelTechnologyRequest()` in a finally block after every NFC operation -- failing to release the NFC session blocks subsequent scans)**

**(You MUST check BLE adapter state (`PoweredOn`) before scanning -- scanning while powered off or unauthorized throws errors silently on some devices)**

**(You MUST remove all BLE subscriptions (scan listeners, characteristic monitors, disconnect listeners) on cleanup -- leaked subscriptions cause crashes after component unmount)**

**Failure to follow these rules will cause native crashes, memory leaks, blocked NFC sessions, and battery drain.**

</critical_reminders>
