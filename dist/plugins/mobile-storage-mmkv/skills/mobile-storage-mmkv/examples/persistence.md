# MMKV - Persistence Middleware

> State management persistence adapter and hydration handling. See [SKILL.md](../SKILL.md) for decision guidance. See [examples/core.md](core.md) for basic MMKV usage.

---

## Pattern 1: StateStorage Adapter

Implement a `StateStorage`-compatible interface to bridge MMKV with any persist middleware that accepts `getItem`/`setItem`/`removeItem`.

```typescript
// lib/mmkv-state-storage.ts
import { createMMKV } from "react-native-mmkv";

const storage = createMMKV();

interface StateStorage {
  setItem: (name: string, value: string) => void;
  getItem: (name: string) => string | null;
  removeItem: (name: string) => void;
}

export const mmkvStateStorage: StateStorage = {
  setItem: (name, value) => {
    storage.set(name, value);
  },
  getItem: (name) => {
    return storage.getString(name) ?? null;
  },
  removeItem: (name) => {
    storage.remove(name);
  },
};
```

**Why good:** Synchronous adapter -- no Promise wrappers needed. `getItem` returns `null` (not `undefined`) per standard `StateStorage` contract. Works as a drop-in replacement for any AsyncStorage-based adapter.

```typescript
// BAD: Async wrapper around synchronous MMKV
export const badAdapter = {
  setItem: async (name: string, value: string) => {
    storage.set(name, value);
  },
  getItem: async (name: string) => {
    return storage.getString(name) ?? null;
  },
  removeItem: async (name: string) => {
    storage.remove(name);
  },
};
```

**Why bad:** MMKV is synchronous -- wrapping in `async` adds unnecessary microtask overhead and defeats the performance benefit over AsyncStorage.

---

## Pattern 2: Custom Instance per Store

Use separate MMKV instances to encrypt specific stores independently.

```typescript
import { createMMKV } from "react-native-mmkv";

interface StateStorage {
  setItem: (name: string, value: string) => void;
  getItem: (name: string) => string | null;
  removeItem: (name: string) => void;
}

const createMMKVAdapter = (
  instanceId: string,
  encryptionKey?: string,
): StateStorage => {
  const instance = createMMKV({
    id: instanceId,
    ...(encryptionKey && { encryptionKey, encryptionType: "AES-256" as const }),
  });

  return {
    setItem: (name, value) => instance.set(name, value),
    getItem: (name) => instance.getString(name) ?? null,
    removeItem: (name) => instance.remove(name),
  };
};

// Unencrypted adapter for preferences
export const preferencesAdapter = createMMKVAdapter("preferences");

// Encrypted adapter for auth data
export const authAdapter = createMMKVAdapter("auth-secure", "encryption-key");
```

**Why good:** Each store gets its own MMKV instance with independent encryption. Factory function prevents boilerplate duplication.

---

## Pattern 3: Hydration Handling

When using a persist middleware, prevent "flash of initial state" by waiting for hydration before rendering. The specific API depends on your state management solution -- here is the general pattern:

```typescript
import { useState, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

// Assume your persist middleware provides a way to know when hydration is complete.
// Common patterns:
//   - onRehydrateStorage callback that sets a flag
//   - A hasHydrated() selector on the store
//   - A Promise that resolves after rehydration

function AppRoot({ isHydrated, token }: { isHydrated: boolean; token: string | null }) {
  if (!isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return token ? <MainNavigator /> : <AuthNavigator />;
}

export { AppRoot };
```

**Why good:** Loading screen prevents rendering with stale initial state. Because MMKV is synchronous, hydration is nearly instant -- but the persist middleware may still need a tick to deserialize and apply state.

```typescript
// BAD: No hydration check
function BadAppRoot({ token }: { token: string | null }) {
  // token is null initially (default state), then hydrated to real value
  // User sees login screen flash before main app
  return token ? <MainNavigator /> : <AuthNavigator />;
}
```

**Why bad:** Without hydration check, `token` starts as `null` (initial state) before persist loads the real value from MMKV, causing a visible flash of the auth screen.
