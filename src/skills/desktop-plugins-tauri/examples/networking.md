# Tauri Plugins - Networking

> HTTP client, logging, WebSocket, and upload plugin APIs. See [core.md](core.md) for installation and permission patterns. See [reference.md](../reference.md) for log targets and platform support.

---

## HTTP Plugin

### JavaScript API

```typescript
import { fetch } from "@tauri-apps/plugin-http";

// GET request
const response = await fetch("https://api.example.com/data", {
  method: "GET",
  headers: { Authorization: "Bearer token" },
});
const data = await response.json();

// POST request with JSON body
const createResponse = await fetch("https://api.example.com/items", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "New Item" }),
});
```

### Scoped Permissions

```json
{
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.example.com/**" },
        { "url": "https://cdn.example.com/**" }
      ]
    }
  ]
}
```

**Key points:**

- HTTP plugin requests go through the Rust backend, bypassing CORS restrictions
- Always scope URL patterns in capabilities -- unscoped `http:default` allows requests to any domain
- The API mirrors the browser `fetch()` API
- Works on all platforms (desktop and mobile)

---

## Log Plugin

### Rust Configuration

```rust
use tauri_plugin_log::{Target, TargetKind};

const MAX_LOG_FILE_SIZE: u128 = 50_000; // bytes

tauri::Builder::default()
    .plugin(
        tauri_plugin_log::Builder::new()
            .targets([
                Target::new(TargetKind::Stdout),
                Target::new(TargetKind::Webview),
                Target::new(TargetKind::LogDir {
                    file_name: Some("app".to_string()),
                }),
            ])
            .max_file_size(MAX_LOG_FILE_SIZE)
            .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
            .level(log::LevelFilter::Info)
            .level_for("hyper", log::LevelFilter::Warn) // Silence noisy dependencies
            .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
            .build(),
    )
```

### JavaScript API

```typescript
import {
  trace,
  debug,
  info,
  warn,
  error,
  attachConsole,
} from "@tauri-apps/plugin-log";

// Attach to browser console (forwards console.log etc. to Tauri log)
const detach = await attachConsole();

// Log at different levels
trace("Detailed trace information");
debug("Debug diagnostic info");
info("Normal operation info");
warn("Something unexpected happened");
error("Something failed");

// Detach console forwarding when no longer needed
detach();
```

### Forwarding Console Output

```typescript
import { trace, error } from "@tauri-apps/plugin-log";

function forwardConsole(
  fnName: "log" | "warn" | "error",
  logger: (message: string) => Promise<void>,
) {
  const original = console[fnName];
  console[fnName] = (message: string) => {
    original(message);
    logger(message);
  };
}

forwardConsole("log", trace);
forwardConsole("error", error);
```

**Key points:**

- Default targets: stdout + app log directory
- Use `.clear_targets()` before `.targets()` to override defaults
- Log directory: Linux `~/.local/share/{bundleId}/logs`, macOS `~/Library/Logs/{bundleId}`, Windows `AppData\Local\{bundleId}\logs`
- `.level_for()` filters logs from specific Rust modules (useful for silencing noisy dependencies like `hyper`)
- Permissions: `"log:default"`

---

## WebSocket Plugin

```typescript
import WebSocket from "@tauri-apps/plugin-websocket";

// Connect to a WebSocket server
const ws = await WebSocket.connect("wss://echo.websocket.org");

// Listen for messages
ws.addListener((message) => {
  console.log("Received:", message);
});

// Send message
ws.send("Hello, WebSocket!");

// Disconnect
ws.disconnect();
```

**Key points:**

- WebSocket connections go through the Rust backend (bypasses browser restrictions)
- Works on all platforms
- Permissions: `"websocket:default"`

---

## Upload Plugin

```typescript
import { upload } from "@tauri-apps/plugin-upload";

await upload(
  "https://api.example.com/upload",
  "/path/to/file.zip",
  (progress, total) => {
    console.log(`Uploaded ${progress} of ${total} bytes`);
  },
  { Authorization: "Bearer token" },
);
```

**Key points:**

- Streams the file from disk (does not load entire file into memory)
- Progress callback provides byte-level progress
- Works on all platforms
- Permissions: `"upload:default"`

---

See [data-storage.md](data-storage.md) for fs, store, sql, stronghold APIs. See [lifecycle.md](lifecycle.md) for updater and deep-link APIs.
