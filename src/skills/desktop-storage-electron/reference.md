# Electron Storage & Credentials Reference

> Quick-lookup tables, API reference, and security checklist. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## electron-store API Quick Reference

| Method / Property       | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `new Store<T>(options)` | Create store with typed config           |
| `.get(key, default?)`   | Read value (type-safe)                   |
| `.set(key, value)`      | Write value (schema-validated)           |
| `.set(object)`          | Write multiple values                    |
| `.has(key)`             | Check key existence                      |
| `.delete(key)`          | Remove key                               |
| `.reset(...keys)`       | Reset keys to defaults                   |
| `.clear()`              | Delete all stored data                   |
| `.onDidChange(key, cb)` | Watch specific key (returns unsubscribe) |
| `.onDidAnyChange(cb)`   | Watch any change (returns unsubscribe)   |
| `.store`                | Entire config object                     |
| `.path`                 | Absolute file path                       |
| `.size`                 | Number of stored keys                    |

### Constructor Options

| Option                          | Default                   | Purpose                                                       |
| ------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `defaults`                      | `{}`                      | Default values for all keys                                   |
| `schema`                        | none                      | JSON Schema (draft-2020-12 via ajv) for validation            |
| `name`                          | `"config"`                | Filename (without extension)                                  |
| `cwd`                           | `app.getPath("userData")` | Storage directory                                             |
| `fileExtension`                 | `"json"`                  | File extension                                                |
| `encryptionKey`                 | none                      | Obfuscation key (NOT security -- use safeStorage for secrets) |
| `watch`                         | `false`                   | Enable filesystem watching for external changes               |
| `migrations`                    | none                      | Version-keyed migration handlers                              |
| `clearInvalidConfig`            | `false`                   | Clear file if it fails schema validation                      |
| `accessPropertiesByDotNotation` | `true`                    | Enable `store.get("a.b.c")` syntax                            |

---

## safeStorage API Quick Reference

| Method                            | Returns   | Notes                               |
| --------------------------------- | --------- | ----------------------------------- |
| `isEncryptionAvailable()`         | `boolean` | Must be true before encrypt/decrypt |
| `encryptString(plainText)`        | `Buffer`  | Throws if unavailable               |
| `decryptString(encrypted)`        | `string`  | Throws if unavailable or corrupted  |
| `setUsePlainTextEncryption(bool)` | `void`    | Linux only -- fallback (not secure) |
| `getSelectedStorageBackend()`     | `string`  | Linux only -- identifies backend    |

### Platform Encryption Backends

| Platform      | Backend                   | Per-App Isolation                    |
| ------------- | ------------------------- | ------------------------------------ |
| macOS         | Keychain Access           | Yes -- other apps need user override |
| Windows       | DPAPI                     | Per-user only -- not per-app         |
| Linux (GNOME) | gnome-keyring / libsecret | Yes                                  |
| Linux (KDE)   | KWallet                   | Yes                                  |
| Linux (none)  | basic_text (plaintext!)   | No                                   |

---

## better-sqlite3 API Quick Reference

| Method                      | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `new Database(path, opts?)` | Open or create database                        |
| `.prepare(sql)`             | Create prepared statement                      |
| `.exec(sql)`                | Execute raw SQL (multiple statements)          |
| `.pragma(string, opts?)`    | Execute PRAGMA (use `simple: true` for scalar) |
| `.transaction(fn)`          | Wrap function in transaction                   |
| `.backup(dest, opts?)`      | Async backup to file (returns Promise)         |
| `.serialize(opts?)`         | Serialize to Buffer                            |
| `.close()`                  | Close connection                               |

### Statement Methods

| Method                | Returns                        | Purpose                                 |
| --------------------- | ------------------------------ | --------------------------------------- |
| `.run(...params)`     | `{ changes, lastInsertRowid }` | Execute (INSERT/UPDATE/DELETE)          |
| `.get(...params)`     | `object \| undefined`          | Single row                              |
| `.all(...params)`     | `object[]`                     | All matching rows                       |
| `.iterate(...params)` | `Iterator`                     | Memory-efficient row iteration          |
| `.pluck(toggle?)`     | `Statement`                    | Return first column only                |
| `.expand(toggle?)`    | `Statement`                    | Expand to `{ tableName: { col: val } }` |
| `.bind(...params)`    | `Statement`                    | Pre-bind parameters                     |

### Recommended Pragmas

| Pragma         | Value    | Purpose                         |
| -------------- | -------- | ------------------------------- |
| `journal_mode` | `WAL`    | Concurrent reads during writes  |
| `synchronous`  | `NORMAL` | Balanced safety/speed           |
| `foreign_keys` | `ON`     | Enforce referential integrity   |
| `cache_size`   | `-64000` | 64MB cache (negative = KB)      |
| `busy_timeout` | `5000`   | Wait on lock instead of failing |

---

## app.getPath() Directory Map

| Name        | macOS                                 | Windows                   | Linux                  | Purpose                        |
| ----------- | ------------------------------------- | ------------------------- | ---------------------- | ------------------------------ |
| `userData`  | `~/Library/Application Support/<App>` | `%APPDATA%/<App>`         | `~/.config/<App>`      | Config, databases, credentials |
| `appData`   | `~/Library/Application Support`       | `%APPDATA%`               | `~/.config`            | Parent of userData             |
| `temp`      | `/tmp`                                | `%TEMP%`                  | `/tmp`                 | Temporary files                |
| `logs`      | `~/Library/Logs/<App>`                | `%APPDATA%/<App>/logs`    | `~/.config/<App>/logs` | Log files                      |
| `documents` | `~/Documents`                         | `%USERPROFILE%/Documents` | `~/Documents`          | User documents                 |
| `downloads` | `~/Downloads`                         | `%USERPROFILE%/Downloads` | `~/Downloads`          | User downloads                 |
| `desktop`   | `~/Desktop`                           | `%USERPROFILE%/Desktop`   | `~/Desktop`            | User desktop                   |
| `home`      | `~`                                   | `%USERPROFILE%`           | `~`                    | User home directory            |

---

## Storage Security Checklist

- [ ] Secrets encrypted with `safeStorage.encryptString()` before storing
- [ ] `isEncryptionAvailable()` checked before every encrypt/decrypt call
- [ ] No tokens, API keys, or passwords in plain-text JSON files
- [ ] All persistent data under `app.getPath("userData")`, not the install directory
- [ ] Database closed cleanly on `before-quit` event
- [ ] WAL mode enabled for better-sqlite3
- [ ] better-sqlite3 rebuilt for Electron's Node.js version (`@electron/rebuild`)
- [ ] `asarUnpack` configured for better-sqlite3 in packaged builds
- [ ] No direct filesystem access from renderer -- all storage routed through IPC
- [ ] electron-store's `encryptionKey` NOT used as a substitute for `safeStorage`

---

## See Also

- [Electron safeStorage Documentation](https://www.electronjs.org/docs/latest/api/safe-storage)
- [electron-store GitHub](https://github.com/sindresorhus/electron-store)
- [better-sqlite3 API Documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [lowdb GitHub](https://github.com/typicode/lowdb)
- [Electron app.getPath() Documentation](https://www.electronjs.org/docs/latest/api/app#appgetpathname)
