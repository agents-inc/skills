# MMKV Quick Reference

> API reference and migration checklist. See [SKILL.md](SKILL.md) for decision framework, red flags, and anti-patterns.

---

## API Reference

### Instance Management

| Function     | Signature                               | Returns                      |
| ------------ | --------------------------------------- | ---------------------------- |
| `createMMKV` | `(options?: MMKVConfiguration) => MMKV` | MMKV instance                |
| `existsMMKV` | `(id: string) => boolean`               | Whether instance file exists |
| `deleteMMKV` | `(id: string) => boolean`               | Whether instance was deleted |

### Configuration Options

| Option             | Type                                  | Default              | Purpose                       |
| ------------------ | ------------------------------------- | -------------------- | ----------------------------- |
| `id`               | `string`                              | `"mmkv.default"`     | Unique instance identifier    |
| `path`             | `string`                              | `$(Documents)/mmkv/` | Custom file directory         |
| `encryptionKey`    | `string`                              | `undefined`          | Enables AES encryption        |
| `encryptionType`   | `"AES-128" \| "AES-256"`              | `"AES-128"`          | Encryption strength           |
| `mode`             | `"single-process" \| "multi-process"` | `"single-process"`   | Process access mode           |
| `readOnly`         | `boolean`                             | `false`              | Prevent writes                |
| `compareBeforeSet` | `boolean`                             | `false`              | Skip write if value unchanged |

### Getters and Setters

| Method       | Signature                                                                  | Returns          |
| ------------ | -------------------------------------------------------------------------- | ---------------- |
| `set`        | `(key: string, value: string \| number \| boolean \| ArrayBuffer) => void` | void             |
| `getString`  | `(key: string) => string \| undefined`                                     | Stored string    |
| `getNumber`  | `(key: string) => number \| undefined`                                     | Stored number    |
| `getBoolean` | `(key: string) => boolean \| undefined`                                    | Stored boolean   |
| `getBuffer`  | `(key: string) => ArrayBuffer \| undefined`                                | Stored buffer    |
| `contains`   | `(key: string) => boolean`                                                 | Key exists       |
| `remove`     | `(key: string) => void`                                                    | Deletes key      |
| `getAllKeys` | `() => string[]`                                                           | All key names    |
| `clearAll`   | `() => void`                                                               | Removes all keys |

### Encryption Runtime Methods

| Method    | Signature                                              | Purpose                  |
| --------- | ------------------------------------------------------ | ------------------------ |
| `encrypt` | `(key: string, type?: "AES-128" \| "AES-256") => void` | Enable/change encryption |
| `decrypt` | `() => void`                                           | Remove encryption        |

### Instance Utilities

| Property/Method | Type                       | Purpose                             |
| --------------- | -------------------------- | ----------------------------------- |
| `size`          | `number`                   | Storage size in bytes               |
| `trim`          | `() => void`               | Reclaim space from deleted keys     |
| `importAllFrom` | `(source: MMKV) => number` | Copy all keys from another instance |

### Listeners

| Method                      | Signature                                                     | Returns      |
| --------------------------- | ------------------------------------------------------------- | ------------ |
| `addOnValueChangedListener` | `(callback: (key: string) => void) => { remove: () => void }` | Subscription |

### React Hooks

| Hook               | Signature                                                                                       | Returns                |
| ------------------ | ----------------------------------------------------------------------------------------------- | ---------------------- |
| `useMMKVString`    | `(key: string, instance?) => [string \| undefined, (v: string \| undefined) => void]`           | Reactive string        |
| `useMMKVNumber`    | `(key: string, instance?) => [number \| undefined, (v: number \| undefined) => void]`           | Reactive number        |
| `useMMKVBoolean`   | `(key: string, instance?) => [boolean \| undefined, (v: boolean \| undefined) => void]`         | Reactive boolean       |
| `useMMKVBuffer`    | `(key: string, instance?) => [ArrayBuffer \| undefined, (v: ArrayBuffer \| undefined) => void]` | Reactive buffer        |
| `useMMKVObject<T>` | `(key: string, instance?) => [T \| undefined, (v: T \| undefined) => void]`                     | Reactive JSON object   |
| `useMMKVListener`  | `(callback: (key: string) => void, instance?) => void`                                          | Auto-cleanup listener  |
| `useMMKVKeys`      | `(instance?) => string[] \| undefined`                                                          | Reactive key list      |
| `useMMKV`          | `(options?: MMKVConfiguration) => MMKV`                                                         | Reactive MMKV instance |

---

## V3 to V4 Migration

| Change           | V3                       | V4                                 |
| ---------------- | ------------------------ | ---------------------------------- |
| Constructor      | `new MMKV()`             | `createMMKV()`                     |
| Delete key       | `storage.delete(key)`    | `storage.remove(key)`              |
| Peer dependency  | None                     | `react-native-nitro-modules`       |
| Min React Native | 0.71                     | 0.75                               |
| App Group key    | `AppGroup` in Info.plist | `AppGroupIdentifier` in Info.plist |
| Architecture     | JSI TurboModule          | Nitro Module                       |

---

## AsyncStorage Migration Checklist

- [ ] Install `react-native-mmkv` and `react-native-nitro-modules`
- [ ] Create MMKV instance at module scope
- [ ] Write migration function with per-key error handling
- [ ] Add migration flag check (`hasMigratedFromAsyncStorage`)
- [ ] Wrap migration in `InteractionManager.runAfterInteractions`
- [ ] Show loading indicator during migration
- [ ] Replace all `await AsyncStorage.getItem()` with `storage.getString()`
- [ ] Replace all `await AsyncStorage.setItem()` with `storage.set()`
- [ ] Replace all `await AsyncStorage.removeItem()` with `storage.remove()`
- [ ] Remove `async`/`await` from storage calls (MMKV is synchronous)
- [ ] Update persistence middleware adapter if using a state management persist plugin
- [ ] Remove `@react-native-async-storage/async-storage` after migration verified
- [ ] Test on both iOS and Android
