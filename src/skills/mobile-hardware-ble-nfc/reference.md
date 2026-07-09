# BLE & NFC Quick Reference

> API quick reference, permission matrix, and decision frameworks. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

## BLE Connection Flow

```
1. new BleManager()               -- create once, share globally
2. onStateChange(PoweredOn)       -- wait for adapter ready
3. startDeviceScan(UUIDs, opts)   -- scan with UUID filter
4. stopDeviceScan()               -- stop when target found or timeout
5. connectToDevice(id, opts)      -- establish connection (requestMTU on Android)
6. discoverAllServicesAndCharacteristics() -- MUST call before read/write/monitor
7. read / write / monitor         -- GATT operations
8. cancelConnection()             -- disconnect
9. destroy()                      -- cleanup manager on app teardown
```

---

## BLE Permission Matrix

| Platform                 | API Level | Required Permissions                               | Notes                                         |
| ------------------------ | --------- | -------------------------------------------------- | --------------------------------------------- |
| **iOS**                  | All       | Info.plist: `NSBluetoothAlwaysUsageDescription`    | Handled at build time, no runtime request     |
| **Android 12+**          | 31+       | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`              | Runtime request via PermissionsAndroid        |
| **Android 10-11**        | 29-30     | `ACCESS_FINE_LOCATION`                             | Location required for BLE scanning            |
| **Android <10**          | 23-28     | `ACCESS_COARSE_LOCATION` or `ACCESS_FINE_LOCATION` | Either works                                  |
| **Android (background)** | 29+       | `ACCESS_BACKGROUND_LOCATION`                       | Additional permission for background scanning |

**Expo config plugin permissions:**

```json
{
  "plugins": [
    [
      "react-native-ble-plx",
      {
        "isBackgroundEnabled": true,
        "modes": ["central"],
        "neverForLocation": true,
        "bluetoothAlwaysPermission": "This app uses Bluetooth to communicate with your device"
      }
    ]
  ]
}
```

- `neverForLocation: true` -- declares scanning does not use location (Android 12+, avoids location permission)
- `modes: ["peripheral", "central"]` -- iOS background modes

---

## NFC Permission Matrix

| Platform          | Required Setup                                                                 | Notes                                |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| **iOS**           | Info.plist: `NFCReaderUsageDescription`                                        | Required                             |
| **iOS**           | Xcode: "Near Field Communication Tag Reading" capability                       | Required                             |
| **iOS (ISO7816)** | Info.plist: `com.apple.developer.nfc.readersession.iso7816.select-identifiers` | For smart card AIDs                  |
| **Android**       | Manifest: `<uses-permission android:name="android.permission.NFC" />`          | Required                             |
| **Android 12+**   | `compileSdkVersion >= 31`                                                      | PendingIntent mutability requirement |

---

## BLE Adapter States

| State          | Meaning            | Action                                 |
| -------------- | ------------------ | -------------------------------------- |
| `Unknown`      | Transitioning      | Wait for next state                    |
| `Resetting`    | Resetting          | Wait for PoweredOn                     |
| `Unsupported`  | No BLE hardware    | Show error, disable BLE features       |
| `Unauthorized` | Permission denied  | Request permission or link to Settings |
| `PoweredOff`   | Bluetooth disabled | Prompt user to enable Bluetooth        |
| `PoweredOn`    | Ready              | Safe to scan and connect               |

---

## BLE Scan Modes (Android)

| Mode                     | Battery Impact | Scan Interval             | Use Case                       |
| ------------------------ | -------------- | ------------------------- | ------------------------------ |
| `ScanMode.LowLatency`    | High           | Continuous                | Finding a specific device fast |
| `ScanMode.Balanced`      | Medium         | ~5s on / ~5s off          | Default, general scanning      |
| `ScanMode.LowPower`      | Low            | ~0.5s on / ~4.5s off      | Background monitoring          |
| `ScanMode.Opportunistic` | Minimal        | Piggybacks on other scans | Passive discovery              |

---

## BLE MTU Reference

| Platform        | Default MTU | Auto-Negotiated           | Max MTU                                   |
| --------------- | ----------- | ------------------------- | ----------------------------------------- |
| **iOS**         | 23          | Yes, up to 187            | 187 (negotiated automatically on connect) |
| **Android <14** | 23          | No (must call requestMTU) | 517                                       |
| **Android 14+** | 517         | Yes                       | 517                                       |

**Usable payload = MTU - 3 bytes** (ATT protocol header)

| MTU              | Usable Bytes | Packets for 100 bytes |
| ---------------- | ------------ | --------------------- |
| 23 (default)     | 20           | 5                     |
| 187 (iOS auto)   | 184          | 1                     |
| 512 (negotiated) | 509          | 1                     |

---

## NFC Technology Handlers

| Technology                 | Handler Property                 | Platform      | Methods                                                                                   |
| -------------------------- | -------------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `NfcTech.Ndef`             | `ndefHandler`                    | iOS + Android | `writeNdefMessage()`, `makeReadOnly()`, `getNdefStatus()`                                 |
| `NfcTech.NfcA`             | `nfcAHandler`                    | iOS + Android | `transceive()`                                                                            |
| `NfcTech.IsoDep`           | `isoDepHandler`                  | iOS + Android | `transceive()`                                                                            |
| `NfcTech.NfcV`             | `nfcVHandler`                    | Android       | `transceive()`                                                                            |
| `NfcTech.MifareClassic`    | `mifareClassicHandlerAndroid`    | Android       | `mifareClassicAuthenticateA/B()`, `mifareClassicReadBlock()`, `mifareClassicWriteBlock()` |
| `NfcTech.MifareUltralight` | `mifareUltralightHandlerAndroid` | Android       | `mifareUltralightReadPages()`, `mifareUltralightWritePage()`                              |

---

## Ndef Utility Methods

| Method                             | Purpose                        | Example                                     |
| ---------------------------------- | ------------------------------ | ------------------------------------------- |
| `Ndef.uriRecord(uri)`              | Create URI record              | `Ndef.uriRecord("https://example.com")`     |
| `Ndef.textRecord(text, lang?)`     | Create text record             | `Ndef.textRecord("Hello", "en")`            |
| `Ndef.encodeMessage(records)`      | Encode record array to bytes   | `Ndef.encodeMessage([Ndef.uriRecord(url)])` |
| `Ndef.uri.decodePayload(payload)`  | Decode URI from payload bytes  | Returns decoded URL string                  |
| `Ndef.text.decodePayload(payload)` | Decode text from payload bytes | Returns decoded text string                 |
| `Ndef.uri.encodePayload(uri)`      | Encode URI to payload bytes    | Returns byte array                          |
| `Ndef.text.encodePayload(text)`    | Encode text to payload bytes   | Returns byte array                          |

---

## BLE Error Codes

| Category       | Error Codes                                                            | Meaning               |
| -------------- | ---------------------------------------------------------------------- | --------------------- |
| **Adapter**    | `BluetoothUnsupported`, `BluetoothUnauthorized`, `BluetoothPoweredOff` | BLE not available     |
| **Scanning**   | `BluetoothScanStartFailed`                                             | Scan could not start  |
| **Connection** | `DeviceNotFound`, `DeviceNotConnected`, `DeviceConnectionFailed`       | Connection issues     |
| **Discovery**  | `ServiceNotFound`, `CharacteristicNotFound`, `DescriptorNotFound`      | GATT element missing  |
| **Operations** | `CharacteristicReadFailed`, `CharacteristicWriteFailed`                | Read/write failure    |
| **Control**    | `OperationCancelled`, `OperationTimedOut`                              | Operation interrupted |

---

## BLE Characteristic Capabilities

Before operating on a characteristic, check its capability flags:

| Flag                        | Meaning                                            | Required For                                     |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `isReadable`                | Value can be read                                  | `readCharacteristicForService()`                 |
| `isWritableWithResponse`    | Write-acknowledged supported                       | `writeCharacteristicWithResponseForService()`    |
| `isWritableWithoutResponse` | Fire-and-forget write                              | `writeCharacteristicWithoutResponseForService()` |
| `isNotifiable`              | Notifications supported                            | `monitorCharacteristicForService()`              |
| `isIndicatable`             | Indications supported (acknowledged notifications) | `monitorCharacteristicForService()`              |

---

## Common BLE Service UUIDs

| Service            | UUID     | Purpose                        |
| ------------------ | -------- | ------------------------------ |
| Generic Access     | `0x1800` | Device name, appearance        |
| Generic Attribute  | `0x1801` | Service changed indication     |
| Device Information | `0x180A` | Manufacturer, firmware, serial |
| Battery Service    | `0x180F` | Battery level                  |
| Heart Rate         | `0x180D` | Heart rate measurement         |
| Health Thermometer | `0x1809` | Temperature measurement        |
| Blood Pressure     | `0x1810` | Blood pressure measurement     |
| Current Time       | `0x1805` | Current time                   |

**Note:** Full UUIDs follow the format `0000XXXX-0000-1000-8000-00805f9b34fb` where `XXXX` is the short UUID.

---

## BLE Connection Options

| Option        | Type          | Default | Notes                                                  |
| ------------- | ------------- | ------- | ------------------------------------------------------ |
| `requestMTU`  | number        | -       | Android only, request MTU during connection            |
| `timeout`     | number        | -       | Connection timeout in ms                               |
| `autoConnect` | boolean       | false   | Connect when device available (slower initial connect) |
| `refreshGatt` | "OnConnected" | -       | Android only, refresh GATT cache on connect            |

---

## Battery-Efficient BLE Checklist

- [ ] Scanning with UUID filter (not `null`) to reduce radio activity
- [ ] Scan timeout set (never scan indefinitely)
- [ ] Scan stopped as soon as target device found
- [ ] Using `ScanMode.Balanced` or `ScanMode.LowPower` on Android (not `LowLatency` unless needed)
- [ ] Characteristic monitoring subscriptions removed when no longer needed
- [ ] Disconnect from device when communication is complete
- [ ] Background scanning uses `ScanMode.LowPower` or `Opportunistic`
- [ ] Connection interval appropriate for use case (not always `High` priority)
