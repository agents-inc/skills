# Electron Storage & Credentials - Core Patterns

> electron-store typed preferences, safeStorage credential management, lowdb JSON database, storage paths. See [SKILL.md](../SKILL.md) for decision frameworks and red flags. See [sqlite.md](sqlite.md) for better-sqlite3 patterns.

---

## electron-store: Typed Preferences with Schema

```typescript
import Store from "electron-store";

interface AppSettings {
  theme: "light" | "dark" | "system";
  windowBounds: { width: number; height: number; x?: number; y?: number };
  recentFiles: string[];
  fontSize: number;
  lastOpenedProject: string | null;
}

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;
const DEFAULT_FONT_SIZE = 14;
const MAX_RECENT_FILES = 10;

const store = new Store<AppSettings>({
  defaults: {
    theme: "system",
    windowBounds: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
    recentFiles: [],
    fontSize: DEFAULT_FONT_SIZE,
    lastOpenedProject: null,
  },
  schema: {
    theme: {
      type: "string",
      enum: ["light", "dark", "system"],
    },
    fontSize: {
      type: "number",
      minimum: MIN_FONT_SIZE,
      maximum: MAX_FONT_SIZE,
    },
  },
});

// Read values (type-safe via generic)
const theme = store.get("theme"); // "light" | "dark" | "system"
const bounds = store.get("windowBounds"); // { width, height, x?, y? }

// Write values (schema-validated at write time)
store.set("theme", "dark");
store.set("windowBounds", { width: 1400, height: 900, x: 100, y: 50 });

// Dot-notation access for nested properties
store.set("windowBounds.width", 1600);
const width = store.get("windowBounds.width");

// Check existence
if (store.has("lastOpenedProject")) {
  // ...
}

// Reset specific keys to defaults
store.reset("theme", "fontSize");

// Clear all stored data
store.clear();
```

**Why good:** Generic type parameter gives compile-time safety on get/set, schema validates at runtime, dot-notation accesses nested properties without reading the entire object

---

## electron-store: Migrations Between Versions

Migrations run automatically when the stored version is below the migration key. Use semver ranges.

```typescript
import Store from "electron-store";

interface SettingsV2 {
  appearance: { theme: "light" | "dark" | "system"; fontSize: number };
  editor: { tabSize: number; wordWrap: boolean };
}

const DEFAULT_FONT_SIZE = 14;
const DEFAULT_TAB_SIZE = 2;

const store = new Store<SettingsV2>({
  defaults: {
    appearance: { theme: "system", fontSize: DEFAULT_FONT_SIZE },
    editor: { tabSize: DEFAULT_TAB_SIZE, wordWrap: true },
  },
  migrations: {
    // Runs for any version below 1.1.0
    "1.1.0": (store) => {
      // Rename flat "theme" key to nested "appearance.theme"
      const oldTheme = store.get("theme" as never);
      if (oldTheme) {
        store.set("appearance.theme", oldTheme as "light" | "dark" | "system");
        store.delete("theme" as never);
      }
    },
    // Runs for any version below 2.0.0
    "2.0.0": (store) => {
      // Move fontSize into appearance group
      const oldFontSize = store.get("fontSize" as never);
      if (oldFontSize) {
        store.set("appearance.fontSize", oldFontSize as number);
        store.delete("fontSize" as never);
      }
    },
  },
  beforeEachMigration: (store, context) => {
    console.log(
      `Migrating from ${context.fromVersion} to ${context.toVersion}`,
    );
  },
});
```

**Why good:** Migrations are declarative by version, run in order, and execute only once. The `beforeEachMigration` hook enables logging for debugging upgrade issues.

---

## electron-store: Watching for Changes

Use `watch: true` to detect external changes (e.g., another process editing the config file) and `onDidChange` to react to specific key changes.

```typescript
const store = new Store<AppSettings>({
  defaults: {
    /* ... */
  },
  watch: true, // Enables file-system watching
});

// Watch a specific key
const unsubTheme = store.onDidChange("theme", (newValue, oldValue) => {
  applyTheme(newValue);
});

// Watch any change
const unsubAny = store.onDidAnyChange((newStore, oldStore) => {
  syncSettingsToRenderers(newStore);
});

// Clean up when done (e.g., on app quit)
app.on("before-quit", () => {
  unsubTheme();
  unsubAny();
});
```

**Why good:** Subscription returns an unsubscribe function for deterministic cleanup, `onDidChange` provides both old and new values for comparison

---

## electron-store: Expose to Renderer via IPC

electron-store runs in the main process. Renderers access it through IPC handlers.

```typescript
// main.ts -- register IPC handlers
import { ipcMain } from "electron";
import Store from "electron-store";

const store = new Store<AppSettings>({
  /* ... */
});

ipcMain.handle("settings:get", (_event, key: string) => {
  return store.get(key as keyof AppSettings);
});

ipcMain.handle("settings:set", (_event, key: string, value: unknown) => {
  store.set(key as keyof AppSettings, value);
});

ipcMain.handle("settings:getAll", () => {
  return store.store; // Returns entire config object
});
```

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from "electron/renderer";

contextBridge.exposeInMainWorld("settingsAPI", {
  get: (key: string) => ipcRenderer.invoke("settings:get", key),
  set: (key: string, value: unknown) =>
    ipcRenderer.invoke("settings:set", key, value),
  getAll: () => ipcRenderer.invoke("settings:getAll"),
});
```

```typescript
// renderer usage
const theme = await window.settingsAPI.get("theme");
await window.settingsAPI.set("theme", "dark");
```

**Why good:** Renderer has no direct filesystem access, IPC boundary validates the channel, preload exposes a minimal typed API surface

---

## safeStorage: Credential Manager

A complete pattern for storing and retrieving encrypted secrets.

```typescript
// credential-manager.ts (main process)
import { safeStorage, app } from "electron";
import Store from "electron-store";

const CREDENTIAL_STORE_NAME = "secure-credentials";

interface EncryptedCredentials {
  [key: string]: string; // base64-encoded encrypted buffers
}

const credentialStore = new Store<EncryptedCredentials>({
  name: CREDENTIAL_STORE_NAME,
});

function ensureEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS encryption not available. On Linux, ensure gnome-keyring or KWallet is running.",
    );
  }
}

function saveCredential(key: string, secret: string): void {
  ensureEncryptionAvailable();
  const encrypted = safeStorage.encryptString(secret);
  credentialStore.set(key, encrypted.toString("base64"));
}

function loadCredential(key: string): string | null {
  const stored = credentialStore.get(key);
  if (!stored) return null;

  ensureEncryptionAvailable();
  const buffer = Buffer.from(stored, "base64");
  return safeStorage.decryptString(buffer);
}

function deleteCredential(key: string): void {
  credentialStore.delete(key);
}

function hasCredential(key: string): boolean {
  return credentialStore.has(key);
}

export { saveCredential, loadCredential, deleteCredential, hasCredential };
```

```typescript
// main.ts -- IPC handlers for credentials
import { ipcMain } from "electron";
import {
  saveCredential,
  loadCredential,
  deleteCredential,
  hasCredential,
} from "./credential-manager.js";

ipcMain.handle("credentials:save", (_event, key: string, secret: string) => {
  saveCredential(key, secret);
});

ipcMain.handle("credentials:load", (_event, key: string) => {
  return loadCredential(key);
});

ipcMain.handle("credentials:delete", (_event, key: string) => {
  deleteCredential(key);
});

ipcMain.handle("credentials:has", (_event, key: string) => {
  return hasCredential(key);
});
```

**Why good:** Secrets are encrypted by the OS keychain before touching disk, base64 encoding stores the buffer safely in JSON, availability check prevents crashes on unsupported platforms, IPC boundary keeps the renderer away from direct crypto operations

---

## safeStorage: Platform Behavior

```
safeStorage.isEncryptionAvailable()
|
+-- macOS: true after app ready (Keychain Access)
|   Encrypted data is per-app -- other apps cannot decrypt without user override
|
+-- Windows: true after app ready (DPAPI)
|   Encrypted data is per-user -- other apps running as the same user could decrypt
|
+-- Linux: depends on desktop environment
    +-- GNOME: gnome-keyring (gnome_libsecret backend)
    +-- KDE: KWallet (kwallet5/kwallet6 backend)
    +-- None: basic_text fallback (NOT secure)
    +-- Check: safeStorage.getSelectedStorageBackend() (Linux only)
```

**Key points:**

- Always call `isEncryptionAvailable()` before `encryptString()` -- it throws if unavailable
- On Linux, `setUsePlainTextEncryption(true)` forces an in-memory key as fallback, but this is NOT secure across restarts
- The async API (`encryptStringAsync` / `decryptStringAsync`) is recommended for new code -- it is non-blocking and supports key rotation

---

## lowdb: JSON Document Database

```typescript
import { JSONFilePreset } from "lowdb/node";
import { app } from "electron";
import path from "node:path";

interface NotesDB {
  notes: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
  }>;
  trash: Array<{ id: string; deletedAt: string }>;
}

const DB_FILE = "notes.json";

async function openNotesDB(): Promise<
  ReturnType<typeof JSONFilePreset<NotesDB>>
> {
  return JSONFilePreset<NotesDB>(path.join(app.getPath("userData"), DB_FILE), {
    notes: [],
    trash: [],
  });
}

// Usage in main process
const db = await openNotesDB();

// Find
const note = db.data.notes.find((n) => n.id === targetId);

// Add
db.data.notes.push({
  id: crypto.randomUUID(),
  title: "New Note",
  content: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: [],
});
await db.write();

// Update (mutate then write)
const toUpdate = db.data.notes.find((n) => n.id === targetId);
if (toUpdate) {
  toUpdate.content = "Updated content";
  toUpdate.updatedAt = new Date().toISOString();
  await db.write();
}

// Delete (move to trash)
const index = db.data.notes.findIndex((n) => n.id === targetId);
if (index !== -1) {
  const [removed] = db.data.notes.splice(index, 1);
  db.data.trash.push({ id: removed.id, deletedAt: new Date().toISOString() });
  await db.write();
}
```

**Why good:** Data is plain JavaScript -- use `find`, `filter`, `map`, `splice` directly. Explicit `write()` means reads are free (in-memory). Type-safe with generics.

**Limitations:**

- Entire file loaded into memory -- not suitable for data over ~10-50MB
- No concurrent write safety -- use only from main process
- No indexing or query optimization -- linear scans only
- No built-in migrations

---

## Window Bounds Persistence

A complete pattern for saving and restoring window position and size.

```typescript
import { BrowserWindow, screen } from "electron";
import Store from "electron-store";

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const store = new Store<{ windowBounds: WindowBounds }>({
  defaults: {
    windowBounds: {
      x: 0,
      y: 0,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      isMaximized: false,
    },
  },
});

function createWindow(): BrowserWindow {
  const bounds = store.get("windowBounds");

  // Validate that saved position is still on a connected display
  const displayBounds = screen.getAllDisplays().some((display) => {
    const { x, y, width, height } = display.bounds;
    return (
      bounds.x >= x &&
      bounds.y >= y &&
      bounds.x < x + width &&
      bounds.y < y + height
    );
  });

  const mainWindow = new BrowserWindow({
    ...(displayBounds ? { x: bounds.x, y: bounds.y } : {}), // Omit position if display no longer connected -- OS picks a default
    width: bounds.width,
    height: bounds.height,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (bounds.isMaximized) {
    mainWindow.maximize();
  }

  // Save bounds on move/resize (debounced by electron-store's atomic writes)
  const saveBounds = (): void => {
    if (!mainWindow.isMaximized()) {
      const [x, y] = mainWindow.getPosition();
      const [width, height] = mainWindow.getSize();
      store.set("windowBounds", { x, y, width, height, isMaximized: false });
    }
  };

  mainWindow.on("resize", saveBounds);
  mainWindow.on("move", saveBounds);
  mainWindow.on("maximize", () => store.set("windowBounds.isMaximized", true));
  mainWindow.on("unmaximize", () =>
    store.set("windowBounds.isMaximized", false),
  );

  return mainWindow;
}
```

**Why good:** Validates saved position against connected displays (prevents off-screen windows when a monitor is disconnected), saves maximize state separately, uses dot-notation for partial updates

---

See [sqlite.md](sqlite.md) for better-sqlite3 patterns. See [../reference.md](../reference.md) for API quick-reference tables.
