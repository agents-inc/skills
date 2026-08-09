# MMKV - Core Patterns

> Instance setup, typed access, React hooks, and listeners. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites:** React Native 0.75+, `react-native-mmkv` v4+, `react-native-nitro-modules` installed.

---

## Pattern 1: Instance Creation with Full Configuration

```typescript
import { createMMKV } from "react-native-mmkv";

// Default instance -- most apps only need this
export const storage = createMMKV();

// Fully configured instance
const SECURE_STORAGE_ID = "secure-storage";

export const secureStorage = createMMKV({
  id: SECURE_STORAGE_ID,
  encryptionKey: "your-secret-key",
  encryptionType: "AES-256", // Default: "AES-128"
  // path: "/custom/path",             // Custom file location (rarely needed)
  // mode: "multi-process",            // For App Groups / extensions
  // readOnly: true,                   // Prevent writes
  // compareBeforeSet: true,           // Skip write if value unchanged
});
```

**Why good:** Module-scope creation runs once. Named exports let consumers import the instance they need. Config options are documented inline.

```typescript
// BAD: Instance in component body
import { createMMKV } from "react-native-mmkv";

function SettingsScreen() {
  // New native allocation EVERY render
  const storage = createMMKV({ id: "settings" });
  const theme = storage.getString("theme");
  return <Text>{theme}</Text>;
}
```

**Why bad:** `createMMKV()` allocates a native C++ object. Calling it in a component body creates a new instance on every render, leaking memory.

---

## Pattern 2: Typed Getters, Setters, and Key Management

```typescript
import { storage } from "./storage";

// --- String ---
storage.set("user.name", "Alice");
const name = storage.getString("user.name"); // "Alice" | undefined

// --- Number ---
const MAX_RETRIES = 5;
storage.set("settings.maxRetries", MAX_RETRIES);
const retries = storage.getNumber("settings.maxRetries"); // 5 | undefined

// --- Boolean ---
storage.set("onboarding.completed", true);
const done = storage.getBoolean("onboarding.completed"); // true | undefined

// --- ArrayBuffer (binary data) ---
const encoder = new TextEncoder();
storage.set("cert", encoder.encode("binary-data").buffer);
const cert = storage.getBuffer("cert"); // ArrayBuffer | undefined

// --- Object (via JSON serialization) ---
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

const profile: UserProfile = {
  id: "1",
  name: "Alice",
  email: "alice@example.com",
};
storage.set("user.profile", JSON.stringify(profile));

const stored = storage.getString("user.profile");
const parsed: UserProfile | undefined = stored ? JSON.parse(stored) : undefined;

// --- Key management ---
storage.contains("user.name"); // true
storage.getAllKeys(); // ["user.name", "settings.maxRetries", ...]
storage.remove("user.name"); // Delete single key (NOT .delete() -- renamed in v4)
storage.clearAll(); // Delete all keys in this instance
```

**Why good:** Each getter returns `T | undefined` -- no exceptions on missing keys. `remove()` is the v4 method name (was `delete()` in v3).

**Gotcha:** `getString()` on a key stored with `set(key, 42)` returns `undefined`, not `"42"`. MMKV does not auto-convert between types.

---

## Pattern 3: React Hooks for Reactive Storage

All hooks accept an optional second argument for a custom MMKV instance.

```typescript
import {
  useMMKVString,
  useMMKVNumber,
  useMMKVBoolean,
  useMMKVBuffer,
  useMMKVObject,
  useMMKVKeys,
} from "react-native-mmkv";
import { View, Text, Switch, TextInput } from "react-native";
import type { User } from "../types";

function SettingsScreen() {
  // String hook -- same API as useState
  const [name, setName] = useMMKVString("user.name");

  // Boolean hook -- toggles persist automatically
  const [darkMode, setDarkMode] = useMMKVBoolean("settings.darkMode");

  // Number hook
  const [fontSize, setFontSize] = useMMKVNumber("settings.fontSize");

  // Object hook -- handles JSON serialization internally
  const [user, setUser] = useMMKVObject<User>("user.profile");

  // Keys hook -- reactive list of all keys
  const allKeys = useMMKVKeys();

  return (
    <View>
      <TextInput value={name ?? ""} onChangeText={setName} />
      <Switch value={darkMode ?? false} onValueChange={setDarkMode} />
      <Text>Stored keys: {allKeys?.length ?? 0}</Text>
      {user && <Text>Logged in as {user.name}</Text>}
    </View>
  );
}

export { SettingsScreen };
```

**Why good:** Hooks trigger re-renders when storage changes (even from other components or native code). `useMMKVObject` handles JSON internally -- no manual stringify/parse.

```typescript
// BAD: Manual subscription with useEffect
import { useState, useEffect } from "react";
import { storage } from "./storage";

function BadExample() {
  const [name, setName] = useState(storage.getString("user.name"));

  useEffect(() => {
    const listener = storage.addOnValueChangedListener((key) => {
      if (key === "user.name") setName(storage.getString("user.name"));
    });
    return () => listener.remove();
  }, []);

  return <Text>{name}</Text>;
}
```

**Why bad:** Reimplements what `useMMKVString("user.name")` does in one line. Manual listener setup is error-prone and verbose.

---

## Pattern 4: Using Hooks with Custom Instances

```typescript
import { useMMKVString, useMMKVObject } from "react-native-mmkv";
import { secureStorage } from "./storage";
import type { AuthToken } from "../types";

function AuthStatus() {
  // Pass custom instance as second argument
  const [token, setToken] = useMMKVString("auth.token", secureStorage);
  const [session, setSession] = useMMKVObject<AuthToken>("auth.session", secureStorage);

  const handleLogout = () => {
    setToken(undefined);   // Setting undefined removes the key
    setSession(undefined);
  };

  return token ? <LoggedInView onLogout={handleLogout} /> : <LoginScreen />;
}

export { AuthStatus };
```

**Why good:** Encrypted instance isolates sensitive data. Setting `undefined` deletes the key, providing a clean logout.

---

## Pattern 5: Value Change Listeners

### Non-React Listener (services, background tasks)

```typescript
import { storage } from "./storage";

// addOnValueChangedListener returns a subscription with .remove()
const subscription = storage.addOnValueChangedListener((changedKey) => {
  switch (changedKey) {
    case "auth.token": {
      const token = storage.getString(changedKey);
      if (!token) {
        // Token was removed -- handle logout
        redirectToLogin();
      }
      break;
    }
    case "settings.language": {
      const lang = storage.getString(changedKey);
      if (lang) updateLocale(lang);
      break;
    }
  }
});

// Cleanup when service shuts down
subscription.remove();
```

**Why good:** Works outside React tree, listener receives only the key (read new value yourself), `.remove()` prevents leaks.

### React Hook Listener

```typescript
import { useMMKVListener } from "react-native-mmkv";
import { storage } from "./storage";

function AnalyticsTracker() {
  // useMMKVListener handles cleanup automatically on unmount
  useMMKVListener((changedKey) => {
    trackStorageEvent(changedKey);
  }, storage); // Optional: pass instance, or omit for global listener

  return null; // Headless component
}

export { AnalyticsTracker };
```

**Why good:** Hook handles cleanup on unmount -- no manual `.remove()` call needed. Pass instance as second arg to scope the listener.
