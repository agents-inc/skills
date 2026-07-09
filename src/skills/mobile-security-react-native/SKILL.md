---
name: mobile-security-react-native
description: Secure storage, certificate pinning, biometric auth, jailbreak detection, code obfuscation, network security, screenshot prevention for React Native
---

# React Native Security Patterns

> **Quick Guide:** Defense-in-depth: layer secure storage (expo-secure-store or react-native-keychain), certificate pinning, biometric authentication, jailbreak/root detection, and code obfuscation. Never store secrets in AsyncStorage or JS bundles. Use Hermes bytecode as your first obfuscation layer. iOS Keychain persists across reinstalls; Android Keystore does not. Certificate pins require at least two hashes (primary + backup) on iOS.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST NEVER store tokens, passwords, API keys, or PII in AsyncStorage or plain-text files -- use hardware-backed secure storage)**

**(You MUST use at least two public key hashes for certificate pinning on iOS -- TrustKit/iOS enforces this and will throw if only one is provided)**

**(You MUST treat jailbreak/root detection as one layer in defense-in-depth -- client-side checks can be bypassed, always validate server-side too)**

**(You MUST configure both iOS ATS and Android Network Security Config to enforce HTTPS -- never ship with `NSAllowArbitraryLoads: true` in production)**

**(You MUST add `NSFaceIDUsageDescription` to Info.plist when using Face ID -- the OS silently falls back to passcode without it)**

</critical_requirements>

---

**Auto-detection:** secure storage, SecureStore, expo-secure-store, react-native-keychain, Keychain, Keystore, certificate pinning, SSL pinning, react-native-ssl-public-key-pinning, TrustKit, jailbreak detection, root detection, jail-monkey, biometric authentication, expo-local-authentication, Face ID, Touch ID, fingerprint, code obfuscation, Hermes bytecode, ProGuard, R8, screen capture prevention, App Transport Security, Network Security Config, MITM

**When to use:**

- Storing credentials, tokens, or sensitive data on device
- Implementing certificate pinning to prevent MITM attacks
- Adding biometric authentication (Face ID, Touch ID, fingerprint)
- Detecting jailbroken/rooted devices
- Hardening builds with code obfuscation (Hermes, ProGuard/R8)
- Preventing screenshot/screen recording of sensitive screens
- Configuring network security (ATS on iOS, Network Security Config on Android)

**When NOT to use:**

- General React Native component architecture (not a security concern)
- Server-side API security (use your backend security approach)
- Web-only applications (web security patterns differ fundamentally)

**Key patterns covered:**

- Secure storage with expo-secure-store and react-native-keychain
- Certificate pinning with react-native-ssl-public-key-pinning
- Biometric authentication with expo-local-authentication and react-native-keychain
- Jailbreak/root detection with jail-monkey
- Code obfuscation: Hermes bytecode, Metro transformer, ProGuard/R8
- Network security: iOS ATS and Android Network Security Config
- Screenshot and screen recording prevention
- Defense-in-depth strategy and security layering

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Secure storage, certificate pinning, biometric auth
- [examples/hardening.md](examples/hardening.md) - Code obfuscation, jailbreak detection, screenshot prevention, network config
- [reference.md](reference.md) - Security checklist, library API reference, pin hash commands

---

<philosophy>

## Philosophy

Mobile security is **defense-in-depth** -- no single measure is sufficient. Attackers can bypass any individual protection, so layer multiple defenses: secure storage protects data at rest, certificate pinning protects data in transit, biometric authentication protects access, jailbreak detection identifies compromised environments, and code obfuscation raises the cost of reverse engineering.

**Core principles:**

1. **Never trust the client** -- all sensitive operations need server-side validation. Client-side checks are speed bumps, not walls.
2. **Hardware-backed storage** -- iOS Keychain and Android Keystore provide hardware-level encryption. AsyncStorage is a plain-text file.
3. **HTTPS everywhere** -- enforce TLS for all network communication. Certificate pinning adds a second layer against compromised CAs.
4. **Minimal data exposure** -- store the least sensitive data possible on device. Prefer short-lived tokens over long-lived credentials.
5. **Fail secure** -- when security checks fail (biometric, jailbreak), deny access by default rather than falling back to insecure paths.

**Mental model:**

Think of mobile security as concentric rings. Each ring (secure storage, pinning, biometrics, obfuscation, jailbreak detection) independently slows attackers. The combination creates a security posture that makes exploitation impractical for most threat models.

**Platform differences that matter:**

| Concern               | iOS                                        | Android                                                        |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| Secure storage        | Keychain (persists across reinstalls)      | Keystore + SharedPreferences (cleared on uninstall)            |
| Biometrics            | Face ID / Touch ID                         | Fingerprint / Face Unlock (weak vs strong)                     |
| Network security      | ATS (default HTTPS since iOS 9)            | Network Security Config (clear text blocked API 28+)           |
| Code protection       | Hermes bytecode (no ProGuard for JS)       | Hermes bytecode + ProGuard/R8 for native/Java                  |
| Screenshot prevention | Effective (screen recording + screenshots) | FLAG_SECURE (effective for screenshots, partial for recording) |

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Secure Storage

Two main libraries: **expo-secure-store** (Expo-managed, simpler API, 2KB value limit) and **react-native-keychain** (bare RN, biometric-protected credentials, no size limit).

**expo-secure-store** uses iOS Keychain and Android Keystore-encrypted SharedPreferences. Values are strings with a ~2KB limit. Supports biometric gating via `requireAuthentication`.

```typescript
import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "auth-token";

// Store securely with biometric protection
await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, {
  requireAuthentication: true,
  authenticationPrompt: "Authenticate to save credentials",
});

// Retrieve (prompts biometric if requireAuthentication was set)
const stored = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
```

**react-native-keychain** provides credential storage with granular access control and biometric gating via `ACCESS_CONTROL` options.

```typescript
import * as Keychain from "react-native-keychain";

await Keychain.setGenericPassword("user@example.com", token, {
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```

**Why good:** hardware-backed encryption, biometric gating prevents unauthorized reads, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` prevents extraction from backups

See [examples/core.md](examples/core.md) for full secure storage patterns with error handling and library comparison.

---

### Pattern 2: Certificate Pinning

Pin your server's public key hashes to prevent MITM attacks even when a device's CA store is compromised. Use **react-native-ssl-public-key-pinning** for a JS-level approach that works with all HTTP clients.

```typescript
import { initializeSslPinning } from "react-native-ssl-public-key-pinning";

const PIN_EXPIRATION_DATE = "2026-12-31";

await initializeSslPinning({
  "api.example.com": {
    includeSubdomains: true,
    publicKeyHashes: [
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // Primary
      "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=", // Backup (REQUIRED on iOS)
    ],
    expirationDate: PIN_EXPIRATION_DATE,
  },
});
```

**Why good:** intercepts all fetch/XMLHttpRequest calls globally, no native code changes required, expiration date prevents bricking when certificates rotate

**Gotcha:** iOS requires at least two hashes per domain. Providing only one causes `initializeSslPinning` to throw.

See [examples/core.md](examples/core.md) for rotation strategy and [reference.md](reference.md) for pin hash generation commands.

---

### Pattern 3: Biometric Authentication

Two approaches: **expo-local-authentication** (standalone biometric prompt, no credential storage) and **react-native-keychain** (biometric-gated credential retrieval).

```typescript
import * as LocalAuthentication from "expo-local-authentication";

async function authenticateUser(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Verify your identity",
    disableDeviceFallback: false,
    cancelLabel: "Cancel",
  });

  return result.success;
}
```

**Why good:** checks hardware + enrollment before prompting, disableDeviceFallback: false allows passcode as backup, clean boolean result

**Gotcha:** Face ID requires `NSFaceIDUsageDescription` in Info.plist. Without it, iOS silently falls back to passcode (no error, no Face ID prompt). Face ID is not supported in Expo Go -- use a development build.

See [examples/core.md](examples/core.md) for biometric-gated credential flow combining both libraries.

---

### Pattern 4: Jailbreak/Root Detection

Detect compromised devices where security controls (sandboxing, code signing) are disabled. Use **jail-monkey** for detection checks.

```typescript
import JailMonkey from "jail-monkey";

function getDeviceSecurityStatus() {
  return {
    isJailbroken: JailMonkey.isJailBroken(),
    canMockLocation: JailMonkey.canMockLocation(),
    isDebugMode: JailMonkey.isDebuggedMode(),
    isOnExternalStorage: JailMonkey.isOnExternalStorage(), // Android only
  };
}
```

**Why good:** checks multiple indicators (not just one file path), includes location mocking and debug detection

**Important:** Jailbreak detection is a speed bump, not a wall. Determined attackers bypass client-side checks with hooking frameworks (Frida, Objection). Always pair with server-side device attestation for high-security apps.

See [examples/hardening.md](examples/hardening.md) for response strategies and server-side validation.

---

### Pattern 5: Code Obfuscation

Layer 1: **Hermes bytecode** (enabled by default since RN 0.70) compiles JS to bytecode, making casual reverse engineering difficult. Layer 2: **Metro obfuscation transformer** for additional string encryption and control flow flattening. Layer 3: **ProGuard/R8** for Android native/Java code.

```javascript
// metro.config.js -- adding obfuscation transformer
const { getDefaultConfig } = require("@react-native/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-obfuscating-transformer"),
};

module.exports = config;
```

**Why good:** layered approach -- Hermes handles baseline, transformer adds string/flow obfuscation, ProGuard/R8 covers native code

**Gotcha:** Not all obfuscation options work. The `stringArray` option in react-native-obfuscating-transformer is known to break builds. Test thoroughly.

See [examples/hardening.md](examples/hardening.md) for ProGuard/R8 configuration and obfuscation options.

---

### Pattern 6: Network Security Configuration

Enforce HTTPS at the OS level. iOS uses **App Transport Security** (ATS), Android uses **Network Security Config**.

**iOS (Info.plist):** ATS enforces HTTPS by default since iOS 9. Never ship with `NSAllowArbitraryLoads: true`.

**Android (network_security_config.xml):** Clear text blocked by default since API 28. Pin certificates natively for defense-in-depth alongside JS-level pinning.

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
  <domain-config>
    <domain includeSubdomains="true">api.example.com</domain>
    <pin-set expiration="2026-12-31">
      <pin digest="SHA-256">AAAAAAAAAA...=</pin>
      <pin digest="SHA-256">BBBBBBBBBB...=</pin>
    </pin-set>
  </domain-config>
</network-security-config>
```

**Why good:** OS-level enforcement, clear text blocked globally, native pinning adds second layer beyond JS-level pinning

See [examples/hardening.md](examples/hardening.md) for iOS ATS configuration and debug vs release network policies.

---

### Pattern 7: Screenshot and Screen Recording Prevention

Prevent screen capture on sensitive screens (banking, credentials, personal data).

```typescript
import { useIsFocused } from "@react-navigation/native";
import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";

function usePreventCapture() {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      ScreenCapture.preventScreenCaptureAsync();
    } else {
      ScreenCapture.allowScreenCaptureAsync();
    }
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, [isFocused]);
}
```

**Why good:** per-screen control (not global), cleanup on unfocus/unmount, works for both screenshots and screen recording on iOS

**Gotcha:** On Android, `FLAG_SECURE` reliably blocks screenshots but screen recording prevention varies by Android version. On iOS, screenshot content is replaced with blank but the user can still trigger the screenshot action.

See [examples/hardening.md](examples/hardening.md) for non-Expo alternatives and listener-based approaches.

</patterns>

---

<decision_framework>

## Decision Framework

### Secure Storage Choice

```
Need to store credentials/tokens securely?
+-- Using Expo managed workflow?
|   +-- YES -> expo-secure-store (simpler API, Expo-native)
|   +-- NO  -> react-native-keychain (more control, biometric options)
|
+-- Need biometric-gated credential retrieval?
|   +-- YES -> react-native-keychain with ACCESS_CONTROL.BIOMETRY_ANY
|   +-- OR  -> expo-secure-store with requireAuthentication: true
|
+-- Value larger than 2KB?
|   +-- YES -> react-native-keychain (no size limit)
|   +-- NO  -> Either library works
|
+-- Need credential persistence across app reinstalls?
    +-- iOS -> Both persist (Keychain behavior)
    +-- Android -> Neither persists (cleared on uninstall)
```

### Biometric Authentication Choice

```
Need biometric prompt (no credential storage)?
+-- YES -> expo-local-authentication
|
Need biometric-gated credential storage/retrieval?
+-- YES -> react-native-keychain with accessControl
|
Need to distinguish biometric security level (weak vs strong)?
+-- YES -> expo-local-authentication (provides SecurityLevel enum)
```

### Certificate Pinning Approach

```
Need SSL pinning?
+-- JS-level (works with all HTTP clients)?
|   +-- YES -> react-native-ssl-public-key-pinning
|
+-- Native-level (defense-in-depth)?
|   +-- iOS -> TrustKit (via CocoaPods)
|   +-- Android -> Network Security Config XML
|
+-- Best practice -> Both JS-level AND native-level
```

### Security Layering

```
Minimum viable security:
1. Secure storage (expo-secure-store or react-native-keychain)
2. HTTPS enforcement (ATS + Network Security Config)
3. Hermes bytecode (default since RN 0.70)

Standard security (most apps):
+ Certificate pinning
+ Biometric authentication
+ ProGuard/R8 on Android

High security (banking, healthcare, fintech):
+ Jailbreak/root detection
+ JS code obfuscation transformer
+ Screenshot prevention
+ Server-side device attestation
+ Runtime integrity checks
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Storing tokens or credentials in AsyncStorage -- it is a plain-text file, trivially readable on jailbroken/rooted devices
- Storing API keys or secrets in the JS bundle -- the bundle is extractable from any published app
- Shipping with `NSAllowArbitraryLoads: true` in production Info.plist -- disables ATS entirely, allows HTTP
- Using only one public key hash for certificate pinning on iOS -- TrustKit throws, pinning silently fails
- Relying solely on jailbreak detection for security -- client-side checks are bypassable with Frida/Objection

**Medium Priority Issues:**

- Not checking `hasHardwareAsync` and `isEnrolledAsync` before calling `authenticateAsync` -- crashes or confusing UX on devices without biometrics
- Missing `NSFaceIDUsageDescription` in Info.plist -- Face ID silently falls back to passcode without any error
- Using `ACCESSIBLE.ALWAYS` for Keychain items -- allows access even when device is locked (deprecated on iOS)
- Skipping ProGuard/R8 on Android release builds -- native code is trivially decompilable without it
- Not setting `expirationDate` on certificate pins -- expired certificates brick the app until users update

**Gotchas & Edge Cases:**

- iOS Keychain data persists across app reinstalls (same bundle ID); Android Keystore data does not -- plan token refresh accordingly
- expo-secure-store has a ~2KB value size limit -- large tokens or data blobs will silently fail or throw
- `z.coerce.boolean()` treats string `"false"` as truthy -- when parsing security config from strings, use explicit comparison
- Android `FLAG_SECURE` blocks screenshots reliably but screen recording prevention varies by OS version and manufacturer
- Hermes bytecode can be decompiled with tools like `hbctool` -- it raises the bar but is not true encryption
- react-native-obfuscating-transformer's `stringArray` option breaks React Native builds -- avoid it
- Android biometrics have "weak" (2D face) vs "strong" (fingerprint, 3D face) security levels -- financial apps should require strong
- Certificate pins must be rotated before expiry -- set calendar reminders and use the `expirationDate` field as a safety net
- `Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET` invalidates credentials when biometrics are re-enrolled -- use `BIOMETRY_ANY` for persistence across biometric changes

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST NEVER store tokens, passwords, API keys, or PII in AsyncStorage or plain-text files -- use hardware-backed secure storage)**

**(You MUST use at least two public key hashes for certificate pinning on iOS -- TrustKit/iOS enforces this and will throw if only one is provided)**

**(You MUST treat jailbreak/root detection as one layer in defense-in-depth -- client-side checks can be bypassed, always validate server-side too)**

**(You MUST configure both iOS ATS and Android Network Security Config to enforce HTTPS -- never ship with `NSAllowArbitraryLoads: true` in production)**

**(You MUST add `NSFaceIDUsageDescription` to Info.plist when using Face ID -- the OS silently falls back to passcode without it)**

**Failure to follow these rules will expose user credentials, enable MITM attacks, and create false security assumptions.**

</critical_reminders>
