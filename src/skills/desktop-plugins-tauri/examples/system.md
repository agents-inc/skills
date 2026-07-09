# Tauri Plugins - System Integration

> Shell, notification, clipboard, dialog, OS info, and process plugin APIs. See [core.md](core.md) for installation and permission patterns. See [reference.md](../reference.md) for the full plugin registry.

---

## Shell Plugin (Desktop Only)

### Opening URLs and Files

```typescript
import { open } from "@tauri-apps/plugin-shell";

// Open URL in default browser
await open("https://tauri.app");

// Open file with default application
await open("/path/to/document.pdf");
```

**Permission:** `"shell:allow-open"` (included in `shell:default`).

### Executing Commands (Dangerous -- Scope Carefully)

Shell execution must be scoped to specific commands and arguments in the capability file.

```json
{
  "permissions": [
    "shell:allow-open",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "run-git-status",
          "cmd": "git",
          "args": ["status"],
          "sidecar": false
        },
        {
          "name": "run-ls",
          "cmd": "ls",
          "args": ["-la", { "validator": "\\S+" }],
          "sidecar": false
        }
      ]
    }
  ]
}
```

**Key points:**

- Desktop-only -- wrap registration in `#[cfg(desktop)]`
- `shell:allow-open` is safe (opens URLs/files in default app)
- `shell:allow-execute` is dangerous -- always scope to specific commands
- Use `{ "validator": "\\S+" }` for arguments that need runtime validation
- Never grant unscoped `shell:allow-execute`

---

## Notification Plugin

### Sending Notifications

```typescript
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

// Check and request notification permission (required on macOS and mobile)
let granted = await isPermissionGranted();
if (!granted) {
  const permission = await requestPermission();
  granted = permission === "granted";
}

if (granted) {
  sendNotification({
    title: "Download Complete",
    body: "Your file has been downloaded successfully.",
  });
}
```

**Key points:**

- On macOS and mobile, notifications require explicit user permission -- always check first
- On Windows and Linux, permissions are typically granted by default
- The notification API is fire-and-forget -- no callback when the user clicks
- Permissions: `"notification:default"` grants send and permission check

---

## Clipboard Plugin

### Reading and Writing Clipboard

```typescript
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

// Write text to clipboard
await writeText("Copied text content");

// Read text from clipboard
const text = await readText();
```

**Key points:**

- Works on desktop and mobile
- Permissions: `"clipboard-manager:default"` grants read and write
- The plugin name in capabilities uses `clipboard-manager` (not `clipboard`)

---

## Dialog Plugin

### File Picker, Save Dialog, Message Boxes

```typescript
import { open, save, message, ask, confirm } from "@tauri-apps/plugin-dialog";

// File picker (returns path or null if cancelled)
const filePath = await open({
  multiple: false,
  filters: [{ name: "Documents", extensions: ["txt", "md", "json"] }],
});

// Multiple file picker
const filePaths = await open({
  multiple: true,
  directory: false,
});

// Directory picker
const dirPath = await open({
  directory: true,
});

// Save dialog
const savePath = await save({
  defaultPath: "export.json",
  filters: [{ name: "JSON", extensions: ["json"] }],
});

// Message dialog
await message("Operation complete", { title: "Success", kind: "info" });

// Confirm dialog (returns boolean)
const confirmed = await ask("Are you sure you want to delete this?", {
  title: "Confirm Delete",
  kind: "warning",
});

// Yes/No/Cancel confirm
const result = await confirm("Save changes before closing?", {
  title: "Unsaved Changes",
  kind: "warning",
  cancelLabel: "Cancel",
  okLabel: "Save",
});
```

**Key points:**

- Works on desktop and mobile (file selection). Folder picker is desktop-only.
- On mobile, file dialog returns `file://` URIs (iOS) or content URIs (Android) instead of filesystem paths
- All picker dialogs return `null` when the user cancels -- always handle the null case
- `kind` options: `"info"`, `"warning"`, `"error"`
- Permissions: `"dialog:default"` grants all dialog operations

---

## OS Plugin

### Getting OS Information

```typescript
import {
  platform,
  arch,
  type,
  version,
  locale,
  hostname,
} from "@tauri-apps/plugin-os";

const osInfo = {
  platform: platform(), // "linux", "macos", "windows", "ios", "android"
  arch: arch(), // "x86_64", "aarch64", "armv7", etc.
  osType: type(), // "linux", "darwin", "windows_nt"
  osVersion: version(), // "14.0" (macOS), "10.0.22621" (Windows), etc.
  locale: await locale(), // "en-US", "fr-FR", etc.
  hostname: await hostname(), // Computer name (desktop only)
};
```

**Key points:**

- Works on all platforms
- `platform()`, `arch()`, `type()`, `version()` are synchronous
- `locale()` and `hostname()` are async
- Permissions: `"os:default"` grants all operations

---

## Process Plugin

### App Lifecycle Control

```typescript
import { exit, relaunch } from "@tauri-apps/plugin-process";

// Exit the application
await exit(0); // Exit code 0 = success

// Restart the application
await relaunch();
```

**Key points:**

- `exit()` terminates the process immediately -- ensure data is saved first
- `relaunch()` starts a new instance and exits the current one (used after updates)
- Works on all platforms
- Permissions: `"process:default"` grants exit and relaunch

---

See [lifecycle.md](lifecycle.md) for updater, deep-link, autostart, global-shortcut APIs. See [data-storage.md](data-storage.md) for fs, store, sql, stronghold APIs.
