# MMKV - Advanced Patterns

> Encryption, multiple instances, App Groups, multi-process mode, and AsyncStorage migration. See [SKILL.md](../SKILL.md) for decision guidance. See [examples/core.md](core.md) for basic usage.

---

## Pattern 1: Encryption with AES-128 and AES-256

Encryption applies to the **entire instance** -- you cannot encrypt individual keys. Use a dedicated encrypted instance for sensitive data.

```typescript
import { createMMKV } from "react-native-mmkv";

// AES-128 encryption (default when encryptionKey is provided)
const secureStorage = createMMKV({
  id: "secure",
  encryptionKey: "your-secret-key",
});

// AES-256 encryption (stronger, slightly slower)
const highSecurityStorage = createMMKV({
  id: "high-security",
  encryptionKey: "your-secret-key",
  encryptionType: "AES-256",
});
```

### Runtime Encryption Management

```typescript
// Encrypt an existing unencrypted instance
storage.encrypt("new-password");

// Upgrade encryption type
storage.encrypt("new-password", "AES-256");

// Remove encryption (data becomes plaintext)
storage.decrypt();
```

### Key Rotation Pattern

```typescript
const rotateEncryptionKey = (
  storage: ReturnType<typeof createMMKV>,
  newKey: string,
) => {
  // Re-encrypting with a new key decrypts with the old key
  // and re-encrypts with the new key in one operation
  storage.encrypt(newKey, "AES-256");
};
```

**When to use AES-128 vs AES-256:**

| Scenario                           | Recommendation |
| ---------------------------------- | -------------- |
| User preferences, non-sensitive    | No encryption  |
| Auth tokens, session data          | AES-128        |
| PII, financial data, API secrets   | AES-256        |
| Regulatory compliance (HIPAA, etc) | AES-256        |

---

## Pattern 2: Multiple Instances for Data Isolation

```typescript
import { createMMKV, existsMMKV, deleteMMKV } from "react-native-mmkv";

const APP_STORAGE_ID = "app-global";

// Global storage -- app-level settings, feature flags
export const appStorage = createMMKV({ id: APP_STORAGE_ID });

// Per-user storage -- created on login, deleted on logout
export const createUserStorage = (userId: string) =>
  createMMKV({
    id: `user-${userId}`,
    encryptionKey: `user-key-${userId}`,
  });

// Instance lifecycle management
export const userStorageExists = (userId: string): boolean =>
  existsMMKV(`user-${userId}`);

export const deleteUserStorage = (userId: string): boolean =>
  deleteMMKV(`user-${userId}`);
```

### Usage in Auth Flow

```typescript
import { createUserStorage, deleteUserStorage } from "./storage";

let userStorage: ReturnType<typeof createMMKV> | null = null;

const handleLogin = (userId: string) => {
  userStorage = createUserStorage(userId);
  // User-specific data is now isolated
  userStorage.set("lastLoginAt", Date.now());
};

const handleLogout = (userId: string) => {
  // Delete entire user storage -- all keys removed from disk
  deleteUserStorage(userId);
  userStorage = null;
};
```

**Why good:** `deleteMMKV` removes the entire storage file from disk -- no leftover data after logout. `existsMMKV` checks without creating the instance.

---

## Pattern 3: iOS App Group Sharing

Share MMKV data between your main app and extensions (widgets, watch, share extensions).

### Step 1: Configure App Group in Info.plist

```xml
<key>AppGroupIdentifier</key>
<string>group.com.yourcompany.yourapp</string>
```

> **V4 change:** The key was `AppGroup` in v3, renamed to `AppGroupIdentifier` in v4.

### Step 2: Create Shared Instance

```typescript
import { createMMKV } from "react-native-mmkv";

const SHARED_STORAGE_ID = "shared-with-extensions";

// Both main app and extension use this same config
export const sharedStorage = createMMKV({
  id: SHARED_STORAGE_ID,
  mode: "multi-process", // Required for cross-process access
});
```

### Step 3: Read/Write from Extension

The extension uses the same `createMMKV` call with the same `id` and `mode: "multi-process"`. MMKV handles file locking and cross-process synchronization automatically.

---

## Pattern 4: Android Multi-Process Mode

When your app uses multiple processes (services, content providers), enable multi-process mode to prevent data corruption.

```typescript
const multiProcessStorage = createMMKV({
  id: "multi-process-storage",
  mode: "multi-process",
});
```

**When to use:** App has background services in separate processes, or you are using Android App Widgets that run in a different process.

**When NOT needed:** Single-process apps (most React Native apps are single-process).

---

## Pattern 5: Migration from AsyncStorage

One-time migration script that copies all AsyncStorage data to MMKV, then cleans up.

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMMKV } from "react-native-mmkv";

const storage = createMMKV();
const MIGRATION_FLAG = "hasMigratedFromAsyncStorage";

export const hasMigrated = (): boolean =>
  storage.getBoolean(MIGRATION_FLAG) === true;

export const migrateFromAsyncStorage = async (): Promise<void> => {
  if (hasMigrated()) return;

  const start = performance.now();
  const keys = await AsyncStorage.getAllKeys();

  for (const key of keys) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) {
        // Detect booleans stored as strings
        if (value === "true" || value === "false") {
          storage.set(key, value === "true");
        } else {
          storage.set(key, value);
        }
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Failed to migrate key "${key}":`, error);
      // Continue with remaining keys -- don't abort entire migration
    }
  }

  storage.set(MIGRATION_FLAG, true);
  const elapsed = performance.now() - start;
  console.log(`MMKV migration completed in ${elapsed.toFixed(1)}ms`);
};
```

### Integrate in App Entry Point

```typescript
import { useState, useEffect } from "react";
import { InteractionManager, ActivityIndicator, View } from "react-native";
import { hasMigrated, migrateFromAsyncStorage } from "./migration";

function App() {
  const [ready, setReady] = useState(hasMigrated());

  useEffect(() => {
    if (ready) return;

    // Run after animations complete to avoid janky transitions
    const task = InteractionManager.runAfterInteractions(async () => {
      await migrateFromAsyncStorage();
      setReady(true);
    });

    return () => task.cancel();
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <MainApp />;
}

export { App };
```

**Why good:** Migration runs once (flag prevents re-runs), deferred to after interactions to avoid blocking UI, error handling per key prevents one bad key from aborting entire migration.

---

## Pattern 6: Storage Size and Maintenance

```typescript
import { storage } from "./storage";

// Check storage size in bytes
const sizeInBytes = storage.size;
const TRIM_THRESHOLD = 4096;

// Trim reclaims space from deleted keys
if (sizeInBytes >= TRIM_THRESHOLD) {
  storage.trim();
}

// Import data from another MMKV instance
import { createMMKV } from "react-native-mmkv";
const legacyStorage = createMMKV({ id: "legacy" });
const importedCount = storage.importAllFrom(legacyStorage);
```

**Why good:** `trim()` is a lightweight operation that reclaims disk space. `importAllFrom` enables instance consolidation without manual key copying.
