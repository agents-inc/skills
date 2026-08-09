# BLE & NFC - NFC Patterns

> NFC NDEF reading/writing, technology types, platform differences, and low-level tag access. See [core.md](core.md) for BLE patterns. See [SKILL.md](../SKILL.md) for red flags and decision guidance.

**Prerequisites:** react-native-nfc-manager v3.14+

---

## Pattern 1: NFC Initialization and Capability Check

Initialize NfcManager once at app start. Check if NFC is supported and enabled.

```typescript
import NfcManager from "react-native-nfc-manager";

async function initNfc(): Promise<boolean> {
  const isSupported = await NfcManager.isSupported();
  if (!isSupported) {
    return false;
  }

  await NfcManager.start();
  return true;
}

// Check if NFC is currently enabled (user may have disabled it in settings)
async function isNfcEnabled(): Promise<boolean> {
  try {
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}
```

**Why good:** support checked before start, start() called once, isEnabled() checks runtime state (user may toggle NFC in settings)

**Platform setup:**

- **iOS:** Add `NFCReaderUsageDescription` to Info.plist, enable "Near Field Communication Tag Reading" capability in Xcode
- **Android:** Add `<uses-permission android:name="android.permission.NFC" />` to AndroidManifest.xml
- **Android 12+:** Set `compileSdkVersion` to 31+ (PendingIntent mutability requirement)

---

## Pattern 2: Reading NDEF Tags

Request NDEF technology, read the tag, parse records. Always cancel in finally.

```typescript
import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";

interface NdefRecord {
  tnf: number; // Type Name Format
  type: number[];
  id: number[];
  payload: number[];
}

interface ParsedTag {
  id: string | null;
  records: Array<{
    type: string;
    value: string;
  }>;
}

async function readNdefTag(): Promise<ParsedTag | null> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();

    if (!tag?.ndefMessage || tag.ndefMessage.length === 0) {
      return { id: tag?.id ?? null, records: [] };
    }

    const records = tag.ndefMessage.map((record: NdefRecord) => {
      const type = String.fromCharCode(...record.type);

      // Decode based on record type
      if (type === "U") {
        // URI record -- first payload byte is URI prefix code
        return {
          type: "uri",
          value: Ndef.uri.decodePayload(
            record.payload as unknown as Uint8Array,
          ),
        };
      }
      if (type === "T") {
        // Text record -- first bytes encode language
        return {
          type: "text",
          value: Ndef.text.decodePayload(
            record.payload as unknown as Uint8Array,
          ),
        };
      }

      // Raw payload fallback
      return {
        type: "unknown",
        value: String.fromCharCode(...record.payload),
      };
    });

    return { id: tag.id ?? null, records };
  } catch (error) {
    // NfcError: user cancelled, tag removed too soon, or technology unavailable
    return null;
  } finally {
    // CRITICAL: Always release the NFC session
    await NfcManager.cancelTechnologyRequest();
  }
}
```

**Why good:** try/finally ensures cancelTechnologyRequest is always called, record type checked for proper decoding (URI vs text vs raw), tag ID extracted, null checks on tag and ndefMessage

```typescript
// Bad: no finally, no error handling
async function readTag() {
  await NfcManager.requestTechnology(NfcTech.Ndef);
  const tag = await NfcManager.getTag();
  return tag; // Technology never released if error thrown above
}
```

**Why bad:** if getTag() throws (tag removed too soon), technology is never released, blocking all subsequent NFC operations until app restart

---

## Pattern 3: Writing NDEF Tags

Write URL records, text records, or multi-record messages.

```typescript
import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";

// Write a single URI record
async function writeUrlTag(url: string): Promise<boolean> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);

    const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    return true;
  } catch {
    return false;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

// Write a single text record
async function writeTextTag(text: string): Promise<boolean> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);

    const bytes = Ndef.encodeMessage([Ndef.textRecord(text)]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    return true;
  } catch {
    return false;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

// Write multiple records in one NDEF message
async function writeMultiRecordTag(
  url: string,
  description: string,
): Promise<boolean> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);

    const bytes = Ndef.encodeMessage([
      Ndef.uriRecord(url),
      Ndef.textRecord(description),
    ]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    return true;
  } catch {
    return false;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}
```

**Why good:** Ndef utilities used for proper record encoding, try/finally in every function, multi-record message shows composability, boolean return signals success/failure

---

## Pattern 4: NFC Technology Types and Platform Availability

Different NFC technologies have different platform support. Always check platform before requesting a technology.

```typescript
import { Platform } from "react-native";
import NfcManager, { NfcTech } from "react-native-nfc-manager";

// Technology availability matrix
// | Technology          | Android | iOS |
// |---------------------|---------|-----|
// | NfcTech.Ndef        |    Y    |  Y  |
// | NfcTech.NfcA        |    Y    |  Y  |
// | NfcTech.IsoDep      |    Y    |  Y  |
// | NfcTech.NfcB        |    Y    |  N  |
// | NfcTech.NfcF        |    Y    |  N  |
// | NfcTech.NfcV        |    Y    |  N  |
// | NfcTech.MifareClassic     | Y |  N  |
// | NfcTech.MifareUltralight  | Y |  N  |
// | NfcTech.MifareIOS         | N |  Y  |
// | NfcTech.Iso15693IOS       | N |  Y  |
// | NfcTech.FelicaIOS         | N |  Y  |

// Safe technology request with platform check
async function requestTechnologySafe(tech: NfcTech): Promise<boolean> {
  const androidOnly: NfcTech[] = [
    NfcTech.NfcB,
    NfcTech.NfcF,
    NfcTech.NfcV,
    NfcTech.MifareClassic,
    NfcTech.MifareUltralight,
  ];

  const iosOnly: NfcTech[] = [
    NfcTech.MifareIOS,
    NfcTech.Iso15693IOS,
    NfcTech.FelicaIOS,
  ];

  if (Platform.OS === "ios" && androidOnly.includes(tech)) {
    return false; // Not available on iOS
  }
  if (Platform.OS === "android" && iosOnly.includes(tech)) {
    return false; // Not available on Android
  }

  try {
    await NfcManager.requestTechnology(tech);
    return true;
  } catch {
    return false;
  }
}
```

**Why good:** platform-specific technologies listed explicitly, platform checked before requesting, error handled for unsupported technologies

---

## Pattern 5: Low-Level Tag Access (NfcA / IsoDep)

For tags that don't use NDEF, access raw tag commands via technology-specific handlers.

```typescript
import NfcManager, { NfcTech } from "react-native-nfc-manager";

// Read Mifare Ultralight pages (Android only)
const PAGES_PER_READ = 4; // Mifare Ultralight reads 4 pages (16 bytes) at a time

async function readMifareUltralight(): Promise<number[][] | null> {
  if (Platform.OS !== "android") return null;

  try {
    await NfcManager.requestTechnology(NfcTech.MifareUltralight);

    const pages: number[][] = [];
    const PAGE_COUNT = 16; // Total pages to read

    for (let i = 0; i < PAGE_COUNT; i += PAGES_PER_READ) {
      const pageData =
        await NfcManager.mifareUltralightHandlerAndroid.mifareUltralightReadPages(
          i,
        );
      pages.push(pageData);
    }

    return pages;
  } catch {
    return null;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

// Send APDU command via IsoDep (smart card interaction)
async function sendApduCommand(command: number[]): Promise<number[] | null> {
  try {
    await NfcManager.requestTechnology(NfcTech.IsoDep);
    const response = await NfcManager.isoDepHandler.transceive(command);
    return response;
  } catch {
    return null;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}
```

**Why good:** platform checked for Android-only technology, try/finally for cleanup, named constants for page count, handler accessed through the correct technology-specific property

---

## Pattern 6: iOS NFC Alert Message

iOS shows a system NFC scanning dialog. Customize the alert message.

```typescript
import { Platform } from "react-native";
import NfcManager, { NfcTech } from "react-native-nfc-manager";

async function readTagWithCustomAlert(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      // iOS: requestTechnology accepts an options object with alertMessage
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: "Hold your device near the NFC tag",
      });
    } else {
      // Android: scanning is silent (no system dialog)
      await NfcManager.requestTechnology(NfcTech.Ndef);
    }

    const tag = await NfcManager.getTag();
    // Process tag...

    if (Platform.OS === "ios") {
      // iOS: dismiss the system dialog with a success message
      await NfcManager.setAlertMessageIOS("Tag read successfully!");
    }
  } catch {
    // User cancelled or tag not found
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}
```

**Why good:** platform check for iOS-specific alert, custom message improves UX, success message provides feedback before dialog dismisses, Android path stays simple

---

## Pattern 7: NFC with React Hooks

Wrap NFC operations in a hook for component-level use.

```typescript
import { useState, useCallback, useEffect } from "react";
import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";

interface UseNfcReaderResult {
  isScanning: boolean;
  lastTag: string | null;
  error: string | null;
  startScan: () => Promise<void>;
  cancelScan: () => Promise<void>;
}

export function useNfcReader(): UseNfcReaderResult {
  const [isScanning, setIsScanning] = useState(false);
  const [lastTag, setLastTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize NFC on mount
  useEffect(() => {
    NfcManager.start().catch(() => {
      setError("NFC not supported");
    });
  }, []);

  const startScan = useCallback(async () => {
    setIsScanning(true);
    setError(null);

    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();

      if (tag?.ndefMessage?.[0]) {
        const payload = tag.ndefMessage[0].payload;
        const text = Ndef.text.decodePayload(payload as unknown as Uint8Array);
        setLastTag(text);
      } else {
        setLastTag(null);
      }
    } catch {
      setError("Scan cancelled or failed");
    } finally {
      await NfcManager.cancelTechnologyRequest();
      setIsScanning(false);
    }
  }, []);

  const cancelScan = useCallback(async () => {
    await NfcManager.cancelTechnologyRequest();
    setIsScanning(false);
  }, []);

  return { isScanning, lastTag, error, startScan, cancelScan };
}
```

**Why good:** hook encapsulates NFC lifecycle, isScanning tracks UI state, cleanup in finally, cancel exposed for user-initiated abort, error state for UI feedback, NfcManager.start() called once on mount
