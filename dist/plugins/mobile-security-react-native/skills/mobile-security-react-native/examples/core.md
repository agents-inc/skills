# React Native Security - Core Patterns

> Secure storage, certificate pinning, and biometric authentication. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites**: Familiarity with React Native development and async/await patterns.

---

## Pattern 1: Secure Storage with expo-secure-store

### Basic Token Storage

```typescript
import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "auth-token";
const REFRESH_TOKEN_KEY = "refresh-token";

// ---- Store ----

async function storeTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

// ---- Retrieve ----

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

// ---- Delete ----

async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
```

**Why good:** each token has a named constant key, separate store/retrieve/delete functions, hardware-backed encryption on both platforms

### Biometric-Protected Storage

```typescript
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_TOKEN_KEY = "biometric-protected-token";

async function storeBiometricProtectedToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token, {
    requireAuthentication: true,
    authenticationPrompt: "Authenticate to save your credentials",
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function getBiometricProtectedToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY, {
      requireAuthentication: true,
      authenticationPrompt: "Authenticate to access your credentials",
    });
  } catch (error) {
    // User cancelled biometric prompt or auth failed
    return null;
  }
}
```

**Why good:** `requireAuthentication` gates reads behind biometric/passcode, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` prevents backup extraction, error handling covers cancelled prompts

### Bad Example: AsyncStorage for Sensitive Data

```typescript
// BAD: AsyncStorage is a plain-text file on device
import AsyncStorage from "@react-native-async-storage/async-storage";

await AsyncStorage.setItem("auth-token", token); // Readable on rooted devices
await AsyncStorage.setItem("user-password", password); // NEVER do this
```

**Why bad:** AsyncStorage stores data as unencrypted JSON on the filesystem -- trivially readable on jailbroken/rooted devices, no encryption, no access control

---

## Pattern 2: Secure Storage with react-native-keychain

### Credential Storage with Biometric Protection

```typescript
import * as Keychain from "react-native-keychain";

const AUTH_SERVICE = "com.myapp.auth";

async function storeCredentials(
  username: string,
  token: string,
): Promise<boolean> {
  try {
    await Keychain.setGenericPassword(username, token, {
      service: AUTH_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      authenticationType: Keychain.AUTHENTICATION_TYPE.BIOMETRICS,
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function getCredentials(): Promise<{
  username: string;
  password: string;
} | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: AUTH_SERVICE,
      authenticationPrompt: {
        title: "Authenticate",
        subtitle: "Verify your identity to access credentials",
        cancel: "Cancel",
      },
    });
    if (credentials === false) return null;
    return { username: credentials.username, password: credentials.password };
  } catch (error) {
    // Biometric auth failed or was cancelled
    return null;
  }
}

async function clearCredentials(): Promise<void> {
  await Keychain.resetGenericPassword({ service: AUTH_SERVICE });
}
```

**Why good:** `BIOMETRY_ANY_OR_DEVICE_PASSCODE` provides fallback if biometrics unavailable, service name isolates credentials, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` prevents backup extraction, error handling covers all failure paths

### Checking Biometric Availability

```typescript
import * as Keychain from "react-native-keychain";

async function getBiometricInfo(): Promise<{
  available: boolean;
  biometryType: string | null;
}> {
  const biometryType = await Keychain.getSupportedBiometryType();
  return {
    available: biometryType !== null,
    biometryType, // "TouchID" | "FaceID" | "Fingerprint" | "Face" | "Iris" | null
  };
}
```

---

## Pattern 3: expo-secure-store vs react-native-keychain Comparison

| Feature                   | expo-secure-store                     | react-native-keychain                             |
| ------------------------- | ------------------------------------- | ------------------------------------------------- |
| **Workflow**              | Expo managed + bare                   | Bare RN (+ Expo dev builds)                       |
| **API style**             | Key-value (string only)               | Username/password pairs                           |
| **Value size limit**      | ~2KB                                  | No practical limit                                |
| **Biometric gating**      | `requireAuthentication` option        | `ACCESS_CONTROL` enum (granular)                  |
| **Access control**        | Basic (unlock/passcode)               | Fine-grained (biometry types, current set vs any) |
| **iOS storage**           | Keychain (`kSecClassGenericPassword`) | Keychain (`kSecClassGenericPassword`)             |
| **Android storage**       | Keystore-encrypted SharedPreferences  | Keystore (RSA or AES)                             |
| **Persists on reinstall** | iOS: yes, Android: no                 | iOS: yes, Android: no                             |
| **Sync API**              | `setItem`/`getItem` (sync)            | No sync API                                       |
| **Internet credentials**  | No                                    | Yes (`setInternetCredentials`)                    |

**Use expo-secure-store when:** Expo managed workflow, simple token storage, values under 2KB.

**Use react-native-keychain when:** Need granular biometric access control, storing larger values, bare RN workflow, or need internet credential separation.

---

## Pattern 4: Certificate Pinning

### JS-Level Pinning with react-native-ssl-public-key-pinning

```typescript
import { initializeSslPinning } from "react-native-ssl-public-key-pinning";

const PIN_EXPIRATION = "2026-12-31";

// Call as early as possible in app entry (before any network requests)
async function setupCertificatePinning(): Promise<void> {
  try {
    await initializeSslPinning({
      "api.example.com": {
        includeSubdomains: true,
        publicKeyHashes: [
          // Primary certificate hash (current cert)
          "CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=",
          // Backup certificate hash (next cert -- REQUIRED on iOS)
          "hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=",
        ],
        expirationDate: PIN_EXPIRATION,
      },
    });
  } catch (error) {
    // Pinning failed to initialize -- block network access or alert
    throw new Error("Certificate pinning initialization failed");
  }
}
```

**Why good:** called at app entry before any requests, two hashes (primary + backup), expiration date prevents permanent bricking, error handling prevents silent failure

See [reference.md](../reference.md) for pin hash generation commands.

### Certificate Rotation Strategy

1. Generate hash for the NEW certificate before deploying it to the server
2. Ship an app update that pins BOTH the current and new certificate hashes
3. Deploy the new certificate to the server
4. After the app update has propagated, remove the old hash in the next release
5. Always keep `expirationDate` set -- it acts as a safety valve if rotation is missed

### Bad Example: Single Pin Without Expiration

```typescript
// BAD: single pin + no expiration
await initializeSslPinning({
  "api.example.com": {
    includeSubdomains: true,
    publicKeyHashes: [
      "CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=",
      // Missing backup hash -- iOS will THROW
    ],
    // Missing expirationDate -- app bricks if cert rotates
  },
});
```

**Why bad:** iOS (TrustKit) requires two hashes and throws with only one, no expiration date means the app permanently breaks when the certificate is rotated until users update

---

## Pattern 5: Biometric Authentication with expo-local-authentication

### Full Biometric Flow

```typescript
import * as LocalAuthentication from "expo-local-authentication";

type BiometricResult =
  | { success: true }
  | {
      success: false;
      reason: "no-hardware" | "not-enrolled" | "failed" | "cancelled";
    };

async function authenticateWithBiometrics(): Promise<BiometricResult> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { success: false, reason: "no-hardware" };
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    return { success: false, reason: "not-enrolled" };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Verify your identity",
    cancelLabel: "Cancel",
    disableDeviceFallback: false, // Allow passcode as backup
    fallbackLabel: "Use passcode", // iOS only
  });

  if (result.success) {
    return { success: true };
  }

  return {
    success: false,
    reason: result.error === "user_cancel" ? "cancelled" : "failed",
  };
}
```

**Why good:** checks hardware and enrollment before prompting (prevents confusing errors), typed result discriminated union, passcode fallback enabled, handles cancellation distinctly from failure

### Checking Available Biometric Types

```typescript
import * as LocalAuthentication from "expo-local-authentication";

async function getAvailableBiometrics(): Promise<string[]> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

  return types.map((type) => {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return "Fingerprint";
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return "Face Recognition";
      case LocalAuthentication.AuthenticationType.IRIS:
        return "Iris"; // Android only
      default:
        return "Unknown";
    }
  });
}
```

---

## Pattern 6: Combined Biometric + Secure Storage Flow

The most secure pattern: biometric-gated credential retrieval. The credentials never leave secure storage without biometric verification.

### With react-native-keychain

```typescript
import * as Keychain from "react-native-keychain";

const CREDENTIAL_SERVICE = "com.myapp.credentials";

async function setupBiometricLogin(
  username: string,
  token: string,
): Promise<boolean> {
  const biometryType = await Keychain.getSupportedBiometryType();
  if (!biometryType) return false;

  try {
    await Keychain.setGenericPassword(username, token, {
      service: CREDENTIAL_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch {
    return false;
  }
}

async function biometricLogin(): Promise<{
  username: string;
  token: string;
} | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: CREDENTIAL_SERVICE,
      authenticationPrompt: {
        title: "Sign In",
        subtitle: "Use biometrics to access your account",
        cancel: "Cancel",
      },
    });

    if (credentials === false) return null;
    return { username: credentials.username, token: credentials.password };
  } catch {
    // Biometric auth failed, cancelled, or credentials don't exist
    return null;
  }
}
```

**Why good:** credentials are stored once during initial login, subsequent logins require biometric verification to read them back, the OS handles the biometric prompt natively (no custom UI), `BIOMETRY_ANY_OR_DEVICE_PASSCODE` provides fallback

### With expo-secure-store

```typescript
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

const SECURE_TOKEN_KEY = "biometric-session-token";

async function setupBiometricSession(token: string): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) return false;

  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token, {
    requireAuthentication: true,
    authenticationPrompt: "Authenticate to enable biometric login",
  });

  return true;
}

async function biometricSessionRetrieve(): Promise<string | null> {
  try {
    // The OS automatically prompts for biometric when requireAuthentication was set
    return await SecureStore.getItemAsync(SECURE_TOKEN_KEY, {
      requireAuthentication: true,
      authenticationPrompt: "Authenticate to sign in",
    });
  } catch {
    return null;
  }
}
```

**Why good:** `requireAuthentication` on both set and get ensures biometric gating, the OS handles prompt presentation, two-step check (hardware + enrollment) before setup
