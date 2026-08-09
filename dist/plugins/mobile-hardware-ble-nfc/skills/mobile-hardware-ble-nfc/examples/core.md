# BLE & NFC - Core BLE Patterns

> BLE scanning, connecting, GATT operations, characteristic monitoring, disconnect handling, and reconnection. See [nfc.md](nfc.md) for NFC patterns. See [SKILL.md](../SKILL.md) for red flags and decision guidance.

**Prerequisites:** react-native-ble-plx v3.2+, base-64 (for encoding/decoding characteristic values)

---

## Pattern 1: BleManager Initialization and State Monitoring

Create a single BleManager instance for the entire app. Monitor adapter state to know when BLE is ready.

```typescript
import { BleManager, State, type Subscription } from "react-native-ble-plx";

// Singleton -- create once, share everywhere
const manager = new BleManager();

function waitForPoweredOn(): Promise<void> {
  return new Promise((resolve, reject) => {
    const subscription = manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        subscription.remove();
        resolve();
      } else if (state === State.Unsupported) {
        subscription.remove();
        reject(new Error("BLE is not supported on this device"));
      } else if (state === State.Unauthorized) {
        subscription.remove();
        reject(new Error("Bluetooth permission not granted"));
      }
    }, true); // true = emit current state immediately
  });
}

// Usage
async function initBle() {
  await waitForPoweredOn();
  // Now safe to scan and connect
}

// App teardown -- call once when app is being destroyed
function teardownBle() {
  manager.destroy();
}
```

**Why good:** single manager instance avoids native resource leaks, state checked before operations, subscription removed after state resolved, `true` flag avoids missing initial state

```typescript
// Bad: creating manager per component
function MyComponent() {
  const manager = new BleManager(); // Leaks on every mount
  // ...
}
```

**Why bad:** each BleManager allocates native resources, unmounting without destroy() causes memory leaks

---

### Background Mode and State Restoration

For apps that must maintain BLE connections when backgrounded (iOS):

```typescript
const RESTORE_ID = "my-app-ble-restore";

const manager = new BleManager({
  restoreStateIdentifier: RESTORE_ID,
  restoreStateFunction: (restoredState) => {
    if (restoredState?.connectedPeripherals) {
      // Re-establish monitoring on peripherals that were connected
      // when the app was terminated by iOS
      for (const device of restoredState.connectedPeripherals) {
        // Re-subscribe to characteristics
      }
    }
  },
});
```

**Platform setup:**

- **iOS:** Enable "Uses Bluetooth LE Accessories" in Background Modes capability
- **Android:** Set `isBackgroundEnabled: true` in Expo plugin config
- **Expo:** Add `react-native-ble-plx` plugin with `{ isBackgroundEnabled: true, modes: ["central"] }` in app.json

---

## Pattern 2: BLE Scanning with Permissions

Always request permissions before scanning. Filter by service UUID for battery efficiency.

```typescript
import { Platform, PermissionsAndroid } from "react-native";
import {
  BleManager,
  type Device,
  type Subscription,
  ScanMode,
} from "react-native-ble-plx";

const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const SCAN_TIMEOUT_MS = 15000;
const ANDROID_12_API_LEVEL = 31;

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    if (Platform.Version >= ANDROID_12_API_LEVEL) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(results).every(
        (status) => status === PermissionsAndroid.RESULTS.GRANTED,
      );
    }
    // Android < 12: location permission required for BLE scanning
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS: handled via Info.plist (NSBluetoothAlwaysUsageDescription)
  return true;
}

async function scanForDevices(
  manager: BleManager,
  onDeviceFound: (device: Device) => void,
): Promise<void> {
  const hasPermission = await requestBlePermissions();
  if (!hasPermission) {
    throw new Error("BLE permissions not granted");
  }

  await waitForPoweredOn();

  const seenDeviceIds = new Set<string>();

  manager.startDeviceScan(
    [HEART_RATE_SERVICE], // Filter by service UUID -- null scans ALL devices (battery drain)
    {
      allowDuplicates: false, // iOS only -- Android always emits duplicates
      // Android scan modes:
      // ScanMode.LowLatency -- fastest, highest battery use
      // ScanMode.Balanced -- default
      // ScanMode.LowPower -- slowest, lowest battery
      // ScanMode.Opportunistic -- piggybacks on other apps' scans
    },
    (error, device) => {
      if (error) {
        console.error("Scan error:", error.message);
        return;
      }
      if (!device) return;

      // Manual deduplication for Android (allowDuplicates has no effect)
      if (seenDeviceIds.has(device.id)) return;
      seenDeviceIds.add(device.id);

      onDeviceFound(device);
    },
  );

  // Always set a timeout to stop scanning
  setTimeout(() => {
    manager.stopDeviceScan();
  }, SCAN_TIMEOUT_MS);
}
```

**Why good:** permissions checked per Android API level, UUID filter reduces battery drain, scan timeout prevents indefinite scanning, manual deduplication handles Android behavior, named constants for UUIDs and timeouts

```typescript
// Bad: scanning without filter, no timeout, no permissions
manager.startDeviceScan(null, null, (error, device) => {
  setDevices((prev) => [...prev, device!]);
});
```

**Why bad:** null UUID filter scans all nearby BLE devices (battery killer), no timeout means scan runs forever, no permission check, no null guard on device, setState on every callback floods renders

---

## Pattern 3: Connection, GATT Discovery, and MTU Negotiation

The full connection lifecycle: connect -> request MTU -> discover GATT -> operate.

```typescript
import { Platform } from "react-native";
import { type Device, type Subscription } from "react-native-ble-plx";

const DESIRED_MTU = 512;
const CONNECTION_TIMEOUT_MS = 10000;
const BLE_ATT_HEADER_BYTES = 3;

async function connectToDevice(
  manager: BleManager,
  deviceId: string,
): Promise<{ device: Device; mtu: number }> {
  // Connect with options
  const device = await manager.connectToDevice(deviceId, {
    requestMTU: Platform.OS === "android" ? DESIRED_MTU : undefined,
    timeout: CONNECTION_TIMEOUT_MS,
    // autoConnect: false -- default. true = connect when device becomes available (slower)
  });

  // CRITICAL: Discover GATT structure before any operations
  await device.discoverAllServicesAndCharacteristics();

  // Calculate usable payload size
  const usableBytes = device.mtu - BLE_ATT_HEADER_BYTES;

  return { device, mtu: usableBytes };
}
```

**Why good:** MTU requested only on Android (iOS auto-negotiates), connection timeout prevents hanging, GATT discovered before operations, usable bytes calculated with ATT header subtracted

```typescript
// Bad: reading immediately after connect
const device = await manager.connectToDevice(deviceId);
const char = await device.readCharacteristicForService(svc, chr);
// Throws: services not discovered
```

**Why bad:** GATT structure not discovered, read/write/monitor operations fail because the service/characteristic tree is not cached locally

---

## Pattern 4: Reading and Writing Characteristics

All BLE values are Base64-encoded. Use a library like `base-64` for encoding/decoding.

```typescript
import { decode as atob, encode as btoa } from "base-64";
import type { Characteristic } from "react-native-ble-plx";

const DEVICE_INFO_SERVICE = "0000180a-0000-1000-8000-00805f9b34fb";
const FIRMWARE_REV_CHAR = "00002a26-0000-1000-8000-00805f9b34fb";
const CONTROL_POINT_CHAR = "00002a55-0000-1000-8000-00805f9b34fb";

// Read a characteristic
async function readFirmwareVersion(device: Device): Promise<string> {
  const characteristic = await device.readCharacteristicForService(
    DEVICE_INFO_SERVICE,
    FIRMWARE_REV_CHAR,
  );
  return atob(characteristic.value ?? "");
}

// Write with response (acknowledged -- reliable)
async function sendCommand(device: Device, command: string): Promise<void> {
  const base64Value = btoa(command);
  await device.writeCharacteristicWithResponseForService(
    DEVICE_INFO_SERVICE,
    CONTROL_POINT_CHAR,
    base64Value,
  );
}

// Write without response (fire-and-forget -- faster)
async function sendFastCommand(device: Device, command: string): Promise<void> {
  const base64Value = btoa(command);
  await device.writeCharacteristicWithoutResponseForService(
    DEVICE_INFO_SERVICE,
    CONTROL_POINT_CHAR,
    base64Value,
  );
}
```

**Why good:** Base64 encode/decode explicit, named constants for all UUIDs, write-with-response for reliable delivery, write-without-response option for speed, value null-coalesced before decode

---

## Pattern 5: Characteristic Monitoring (Notifications/Indications)

Subscribe to real-time value changes from a characteristic. Returns a Subscription that MUST be removed.

```typescript
import { useEffect, useRef, useState, useCallback } from "react";
import { decode as atob } from "base-64";
import type { Device, Subscription } from "react-native-ble-plx";

const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";

export function useHeartRateMonitor(device: Device | null) {
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    if (!device) return;

    subscriptionRef.current = device.monitorCharacteristicForService(
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      (error, characteristic) => {
        if (error) {
          console.error("Monitor error:", error.message);
          return;
        }
        if (!characteristic?.value) return;

        // Heart rate measurement format: first byte is flags, second byte is HR value
        const raw = atob(characteristic.value);
        const heartRateValue = raw.charCodeAt(1);
        setHeartRate(heartRateValue);
      },
    );

    // CRITICAL: Remove subscription on cleanup
    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [device]);

  return heartRate;
}
```

**Why good:** subscription stored in ref and removed in cleanup, null checks on device and characteristic, error handled in callback, useEffect cleanup prevents leaked listeners

```typescript
// Bad: no cleanup
device.monitorCharacteristicForService(svc, chr, (err, char) => {
  setHeartRate(parseHR(char));
});
// Subscription leaked -- fires after unmount, causes crash
```

**Why bad:** subscription not stored or removed, callback fires after component unmount causing "setState on unmounted component" crash

---

## Pattern 6: Disconnect Monitoring and Reconnection

Monitor for unexpected disconnects and implement reconnection with backoff.

```typescript
import type { BleManager, Device, Subscription } from "react-native-ble-plx";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

async function connectWithReconnection(
  manager: BleManager,
  deviceId: string,
  onConnected: (device: Device) => void,
  onDisconnected: () => void,
): Promise<() => void> {
  let disconnectSubscription: Subscription | null = null;
  let isCleanedUp = false;
  let reconnectAttempts = 0;

  async function connect() {
    try {
      const device = await manager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
      reconnectAttempts = 0; // Reset on successful connection

      onConnected(device);

      // Monitor for disconnects -- fires once per registration
      disconnectSubscription = device.onDisconnected((error) => {
        if (isCleanedUp) return;
        onDisconnected();
        attemptReconnect();
      });
    } catch (error) {
      attemptReconnect();
    }
  }

  async function attemptReconnect() {
    if (isCleanedUp || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    reconnectAttempts++;
    const delay = Math.min(
      BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts - 1),
      MAX_DELAY_MS,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    if (!isCleanedUp) {
      await connect();
    }
  }

  await connect();

  // Return cleanup function
  return () => {
    isCleanedUp = true;
    disconnectSubscription?.remove();
    manager.cancelDeviceConnection(deviceId).catch(() => {
      // Ignore disconnect errors during cleanup
    });
  };
}
```

**Why good:** exponential backoff prevents aggressive reconnection, max attempts prevents infinite loops, cleanup function cancels connection and removes listeners, `onDisconnected` fires once per registration (re-registered after each reconnect), named constants for all timing values

---

## Pattern 7: Listing Services and Characteristics

After GATT discovery, enumerate available services and their characteristics.

```typescript
import type { Device, Service, Characteristic } from "react-native-ble-plx";

interface GattMap {
  services: Array<{
    uuid: string;
    characteristics: Array<{
      uuid: string;
      isReadable: boolean;
      isWritableWithResponse: boolean;
      isWritableWithoutResponse: boolean;
      isNotifiable: boolean;
      isIndicatable: boolean;
    }>;
  }>;
}

async function discoverGattStructure(device: Device): Promise<GattMap> {
  const services = await device.services();

  const serviceEntries = await Promise.all(
    services.map(async (service) => {
      const characteristics = await service.characteristics();
      return {
        uuid: service.uuid,
        characteristics: characteristics.map((char) => ({
          uuid: char.uuid,
          isReadable: char.isReadable,
          isWritableWithResponse: char.isWritableWithResponse,
          isWritableWithoutResponse: char.isWritableWithoutResponse,
          isNotifiable: char.isNotifiable,
          isIndicatable: char.isIndicatable,
        })),
      };
    }),
  );

  return { services: serviceEntries };
}
```

**Why good:** enumerates all services and characteristics with capability flags, useful for debugging unknown peripherals, Promise.all parallelizes service enumeration

**Key:** Always check `isNotifiable` / `isIndicatable` before calling `monitorCharacteristicForService` -- not all characteristics support notifications.
