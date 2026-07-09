# React Native Security Reference

> Checklists, library API reference, and quick-lookup commands. See [SKILL.md](SKILL.md) for decision frameworks, red flags, and anti-patterns.

---

## Security Checklist

### Before Release

- [ ] No tokens/credentials in AsyncStorage (use secure storage)
- [ ] No secrets hardcoded in JS bundle (use secure config)
- [ ] HTTPS enforced (ATS on iOS, Network Security Config on Android)
- [ ] `NSAllowArbitraryLoads` is NOT `true` in production Info.plist
- [ ] `NSFaceIDUsageDescription` set (if using biometrics)
- [ ] Hermes enabled (bytecode compilation)
- [ ] ProGuard/R8 enabled for Android release builds
- [ ] Certificate pinning initialized at app entry
- [ ] At least 2 pin hashes per domain (iOS requirement)
- [ ] Pin expiration date set (prevent bricking)
- [ ] Debug-only network exceptions not in release builds

### For High-Security Apps

- [ ] Jailbreak/root detection implemented
- [ ] Security events reported to server
- [ ] Screenshot prevention on sensitive screens
- [ ] Biometric authentication on sensitive operations
- [ ] JS code obfuscation transformer configured
- [ ] Server-side device attestation integrated
- [ ] Minimum TLS 1.2 enforced

---

## Library Quick Reference

### expo-secure-store

```typescript
import * as SecureStore from "expo-secure-store";

// Store
await SecureStore.setItemAsync(key, value, options?);
SecureStore.setItem(key, value, options?);          // Sync

// Retrieve
const val = await SecureStore.getItemAsync(key, options?);
const val = SecureStore.getItem(key, options?);     // Sync

// Delete
await SecureStore.deleteItemAsync(key, options?);

// Check biometric support
SecureStore.canUseBiometricAuthentication();         // boolean

// Options: { keychainService?, keychainAccessible?, requireAuthentication?, authenticationPrompt? }
// Accessibility: WHEN_UNLOCKED (default), AFTER_FIRST_UNLOCK, WHEN_UNLOCKED_THIS_DEVICE_ONLY, etc.
// Size limit: ~2KB per value
```

### react-native-keychain

```typescript
import * as Keychain from "react-native-keychain";

// Store credentials
await Keychain.setGenericPassword(username, password, options?);

// Retrieve (triggers biometric if accessControl set)
const creds = await Keychain.getGenericPassword(options?);
// Returns { username, password, service, storage } or false

// Delete
await Keychain.resetGenericPassword(options?);

// Check biometrics
const type = await Keychain.getSupportedBiometryType();
// "TouchID" | "FaceID" | "Fingerprint" | "Face" | "Iris" | null

// Key options:
// accessControl: ACCESS_CONTROL.BIOMETRY_ANY | BIOMETRY_CURRENT_SET | BIOMETRY_ANY_OR_DEVICE_PASSCODE
// accessible: ACCESSIBLE.WHEN_UNLOCKED | WHEN_UNLOCKED_THIS_DEVICE_ONLY | AFTER_FIRST_UNLOCK
// authenticationType: AUTHENTICATION_TYPE.BIOMETRICS | DEVICE_PASSCODE_OR_BIOMETRICS
// service: string (namespace for multiple credential sets)
```

### expo-local-authentication

```typescript
import * as LocalAuthentication from "expo-local-authentication";

// Check hardware support
const hasHardware = await LocalAuthentication.hasHardwareAsync();

// Check enrollment
const isEnrolled = await LocalAuthentication.isEnrolledAsync();

// Authenticate
const result = await LocalAuthentication.authenticateAsync({
  promptMessage: "Verify identity",
  cancelLabel: "Cancel",
  disableDeviceFallback: false,
  fallbackLabel: "Use passcode", // iOS only
  requireConfirmation: true, // Android only
  biometricsSecurityLevel: "strong", // Android: "weak" | "strong"
});
// result: { success: true } | { success: false, error: string, warning?: string }

// Available types
const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
// AuthenticationType.FINGERPRINT (1) | FACIAL_RECOGNITION (2) | IRIS (3)

// Cancel (Android only)
await LocalAuthentication.cancelAuthenticate();
```

### react-native-ssl-public-key-pinning

```typescript
import { initializeSslPinning } from "react-native-ssl-public-key-pinning";

// Initialize at app entry (before any network requests)
await initializeSslPinning({
  "api.example.com": {
    includeSubdomains: true, // Pin subdomains too
    publicKeyHashes: [
      // Minimum 2 on iOS
      "hash1...", // Primary (current cert)
      "hash2...", // Backup (next cert)
    ],
    expirationDate: "2026-12-31", // Safety valve (optional but recommended)
  },
});
```

### jail-monkey

```typescript
import JailMonkey from "jail-monkey";

JailMonkey.isJailBroken(); // boolean - jailbreak/root detected
JailMonkey.canMockLocation(); // boolean - mock location enabled
JailMonkey.isDebuggedMode(); // boolean - debugger attached
JailMonkey.isOnExternalStorage(); // boolean - Android only
```

---

## Pin Hash Generation Commands

```bash
# From certificate file
openssl x509 -in cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64

# From live server
openssl s_client -connect api.example.com:443 -servername api.example.com 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform DER | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64

# Verify a pin against a server
openssl s_client -connect api.example.com:443 2>/dev/null | \
  openssl x509 -noout -fingerprint -sha256
```
