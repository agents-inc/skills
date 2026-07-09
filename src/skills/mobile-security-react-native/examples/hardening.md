# React Native Security - App Hardening

> Code obfuscation, jailbreak detection, screenshot prevention, and network security configuration. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Related**: [core.md](core.md) for secure storage, certificate pinning, and biometric auth.

---

## Pattern 1: Jailbreak/Root Detection

### Basic Detection with jail-monkey

```typescript
import JailMonkey from "jail-monkey";

interface DeviceSecurityReport {
  isCompromised: boolean;
  isJailbroken: boolean;
  canMockLocation: boolean;
  isDebugMode: boolean;
  isOnExternalStorage: boolean; // Android only
}

function assessDeviceSecurity(): DeviceSecurityReport {
  const isJailbroken = JailMonkey.isJailBroken();
  const canMockLocation = JailMonkey.canMockLocation();
  const isDebugMode = JailMonkey.isDebuggedMode();
  const isOnExternalStorage = JailMonkey.isOnExternalStorage();

  return {
    isCompromised: isJailbroken || isDebugMode,
    isJailbroken,
    canMockLocation,
    isDebugMode,
    isOnExternalStorage,
  };
}
```

**Why good:** checks multiple indicators, combines jailbreak + debug for `isCompromised` flag, structured return for logging/reporting

### Response Strategy

```typescript
import { Alert } from "react-native";

type SecurityAction = "block" | "warn" | "log";

const SECURITY_ACTIONS: Record<string, SecurityAction> = {
  jailbroken: "warn", // Alert user but allow access
  debugMode: "log", // Log only (may be legitimate dev use)
  mockLocation: "block", // Block for location-sensitive features
};

function handleCompromisedDevice(report: DeviceSecurityReport): void {
  if (report.isJailbroken && SECURITY_ACTIONS.jailbroken === "warn") {
    Alert.alert(
      "Security Notice",
      "This device appears to be modified. Some features may be restricted.",
      [{ text: "I Understand" }],
    );
  }

  if (report.canMockLocation && SECURITY_ACTIONS.mockLocation === "block") {
    // Disable location-dependent features
  }

  // Always report to server for monitoring
  reportSecurityEvent({
    type: "device-integrity",
    ...report,
    timestamp: Date.now(),
  });
}
```

**Why good:** configurable response per threat type (not blanket block), server-side reporting for monitoring, user-friendly messaging

### Bad Example: Blocking Without Server Validation

```typescript
// BAD: relying solely on client-side detection
if (JailMonkey.isJailBroken()) {
  // Attacker hooks JailMonkey.isJailBroken() to return false
  exitApp(); // Bypassed trivially with Frida
}
```

**Why bad:** client-side checks are bypassable with hooking frameworks (Frida, Objection), no server-side validation means the check provides false security assurance

---

## Pattern 2: Code Obfuscation

### Layer 1: Hermes Bytecode (Default)

Hermes is enabled by default since React Native 0.70. It compiles JavaScript to optimized bytecode at build time.

**Verify Hermes is enabled:**

```json
// app.json (Expo)
{
  "expo": {
    "jsEngine": "hermes"
  }
}
```

```groovy
// android/gradle.properties (bare RN)
hermesEnabled=true
```

Hermes bytecode is NOT encrypted -- tools like `hbctool` can decompile it. It raises the reverse engineering bar but is not a substitute for proper secret management.

### Layer 2: Metro Obfuscation Transformer

Adds JavaScript-level obfuscation (variable renaming, control flow flattening, dead code injection) on top of Hermes.

```javascript
// metro.config.js
const { getDefaultConfig } = require("@react-native/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-obfuscating-transformer"),
};

module.exports = config;
```

**Obfuscation config (obfuscating-transformer.config.js):**

```javascript
module.exports = {
  // Files to obfuscate (regex pattern)
  filter: (filename) => {
    return (
      filename.startsWith("src/") &&
      !filename.includes("__tests__") &&
      !filename.includes(".test.")
    );
  },
  // Safe options -- avoid stringArray (breaks builds)
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false, // Renaming globals breaks RN module system
  // DO NOT enable stringArray -- known to break React Native builds
};
```

**Why good:** filter excludes test files, conservative thresholds balance security vs performance, `renameGlobals: false` prevents module resolution breaks, explicit warning about `stringArray`

### Layer 3: ProGuard/R8 for Android

R8 (ProGuard replacement) shrinks, obfuscates, and optimizes Android native/Java code.

```groovy
// android/app/build.gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
        }
    }
}
```

```proguard
# android/app/proguard-rules.pro

# Keep React Native bridge classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep classes used via reflection
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep serializable classes (if using)
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
}

# Keep your app's model classes if accessed via reflection
# -keep class com.yourapp.models.** { *; }
```

**Why good:** `minifyEnabled true` activates R8, React Native bridge classes preserved, native methods preserved, reflection-accessed classes protected with `-keep` rules

**Important:** R8 only runs in release builds. Test release builds thoroughly -- crashes from missing classes only appear in production.

---

## Pattern 3: Screenshot and Screen Recording Prevention

### Expo ScreenCapture (Managed Workflow)

```typescript
import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import * as ScreenCapture from "expo-screen-capture";

/**
 * Hook to prevent screen capture while a screen is focused.
 * Enables capture again when navigating away or unmounting.
 */
function usePreventCapture(): void {
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

// Usage in a sensitive screen
function BankingScreen() {
  usePreventCapture();
  return <AccountDetails />;
}
```

**Why good:** per-screen control (not global), cleanup restores capture on navigate away, isFocused integration with navigation lifecycle

### Screenshot Listener (Detection Instead of Prevention)

```typescript
import { useEffect } from "react";
import * as ScreenCapture from "expo-screen-capture";

function useScreenshotListener(onCapture: () => void): void {
  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      onCapture();
    });

    return () => subscription.remove();
  }, [onCapture]);
}

// Usage: alert user and log event
function SensitiveScreen() {
  useScreenshotListener(() => {
    Alert.alert("Screenshot Detected", "Screenshots of this screen are monitored.");
    reportSecurityEvent({ type: "screenshot-detected", screen: "sensitive" });
  });

  return <SensitiveContent />;
}
```

**Why good:** useful when you cannot prevent screenshots (some iOS scenarios) but want to detect and log them, subscription cleanup prevents memory leaks

### Android FLAG_SECURE (Bare RN)

For bare React Native without Expo, use the native Android `FLAG_SECURE` flag:

```typescript
import { Platform, NativeModules } from "react-native";

// Requires a small native module that calls:
// getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)

function enableSecureMode(): void {
  if (Platform.OS === "android") {
    NativeModules.ScreenSecurity?.enableSecureFlag();
  }
}

function disableSecureMode(): void {
  if (Platform.OS === "android") {
    NativeModules.ScreenSecurity?.disableSecureFlag();
  }
}
```

**Platform differences:**

| Platform              | Screenshots     | Screen Recording | App Switcher Thumbnail |
| --------------------- | --------------- | ---------------- | ---------------------- |
| iOS (ScreenCapture)   | Blocked (blank) | Blocked          | Not affected           |
| Android (FLAG_SECURE) | Blocked (black) | Blocked (black)  | Black thumbnail        |

---

## Pattern 4: Network Security Configuration

### iOS App Transport Security (ATS)

ATS enforces HTTPS by default since iOS 9. The correct production configuration is to NOT add exceptions.

```xml
<!-- ios/YourApp/Info.plist -->
<!-- PRODUCTION: Do NOT include NSAppTransportSecurity at all (defaults are secure) -->
<!-- OR explicitly enforce: -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowArbitraryLoads</key>
  <false/>
</dict>

<!-- Face ID permission (REQUIRED when using biometrics) -->
<key>NSFaceIDUsageDescription</key>
<string>Use Face ID to securely access your account</string>
```

**Development-only exception (NEVER ship this):**

```xml
<!-- For local development server only -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSExceptionDomains</key>
  <dict>
    <key>localhost</key>
    <dict>
      <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
      <true/>
    </dict>
  </dict>
</dict>
```

**Why good:** no blanket `NSAllowArbitraryLoads`, development exceptions scoped to localhost only, includes `NSFaceIDUsageDescription` for biometric features

### Bad Example: Disabling ATS

```xml
<!-- BAD: disables ALL transport security -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowArbitraryLoads</key>
  <true/>
</dict>
```

**Why bad:** allows plain HTTP to any domain, Apple may reject apps with this in production, exposes all network traffic to interception

### Android Network Security Config

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
  <!-- Block all clear text traffic by default -->
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>

  <!-- Certificate pinning for your API -->
  <domain-config>
    <domain includeSubdomains="true">api.example.com</domain>
    <pin-set expiration="2026-12-31">
      <pin digest="SHA-256">CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=</pin>
      <pin digest="SHA-256">hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=</pin>
    </pin-set>
  </domain-config>

  <!-- Debug override: allow local dev server (debug builds only) -->
  <debug-overrides>
    <trust-anchors>
      <certificates src="user" />
    </trust-anchors>
  </debug-overrides>
</network-security-config>
```

**Reference the config in AndroidManifest.xml:**

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application
  android:networkSecurityConfig="@xml/network_security_config"
  ...>
```

**Why good:** clear text blocked globally, native pinning as defense-in-depth alongside JS-level pinning, debug-overrides allow local dev without compromising release builds, expiration date on pins

### Expo Configuration (app.json)

```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "enableProguardInReleaseBuilds": true,
            "enableShrinkResourcesInReleaseBuilds": true
          }
        }
      ]
    ]
  }
}
```

---

## Pattern 5: Secure Data Serialization

Never store structured sensitive data as raw JSON strings. Use a wrapper that encrypts before storing and decrypts after retrieval.

```typescript
import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "encrypted-session";
const MAX_SECURE_STORE_BYTES = 2048;

interface SecureSession {
  userId: string;
  accessToken: string;
  expiresAt: number;
}

async function storeSession(session: SecureSession): Promise<void> {
  const serialized = JSON.stringify(session);

  if (new Blob([serialized]).size > MAX_SECURE_STORE_BYTES) {
    throw new Error("Session data exceeds secure storage limit");
  }

  await SecureStore.setItemAsync(SESSION_KEY, serialized);
}

async function getSession(): Promise<SecureSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  const session: SecureSession = JSON.parse(raw);

  // Check expiration
  if (session.expiresAt < Date.now()) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }

  return session;
}
```

**Why good:** size check before storing prevents silent failures, expiration check on retrieval prevents using stale tokens, typed session interface, automatic cleanup of expired sessions
