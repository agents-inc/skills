# Electron Auto-Update - Testing

> Local testing with dev-app-update.yml, debugging with logging, testing without packaging. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for production setup.

---

## Local Testing with dev-app-update.yml

Test the update flow during development without packaging the app. Create a `dev-app-update.yml` in your project root that mirrors your publish config.

### Generic Server (Simplest)

```yaml
# dev-app-update.yml (project root)
provider: generic
url: http://localhost:8080/updates
```

Serve the update artifacts from a local HTTP server:

```
local-updates/
  latest.yml          # Metadata pointing to the installer
  my-app-setup-2.0.0.exe  # The actual installer (or .dmg / .AppImage)
```

```yaml
# latest.yml (hand-crafted for testing)
version: 2.0.0
path: my-app-setup-2.0.0.exe
sha512: <sha512-hash-of-the-installer>
releaseDate: "2025-03-15T10:00:00.000Z"
```

### Enable Dev Config in Main Process

```javascript
const { autoUpdater } = require("electron-updater");
const { app } = require("electron");
const log = require("electron-log"); // or your logging solution

// Force dev update config when not packaged
if (!app.isPackaged) {
  autoUpdater.forceDevUpdateConfig = true;
}

// Verbose logging for debugging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "debug";

autoUpdater.checkForUpdates();
```

**Key point:** `forceDevUpdateConfig` makes the updater look for `dev-app-update.yml` in the project root instead of the packaged `app-update.yml`. This is the ONLY way to test update checks without a packaged app.

---

## Using a Local S3-Compatible Server

For testing S3 provider flows, use MinIO as a local S3-compatible server.

```yaml
# dev-app-update.yml
provider: s3
bucket: test-updates
endpoint: http://localhost:9000
path: /releases
```

Upload your test artifacts to the MinIO bucket, including the `latest.yml` metadata file.

---

## Debugging Checklist

When updates are not working, check these in order:

### 1. Logger Output

```javascript
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "debug";

// Check log file location:
// macOS: ~/Library/Logs/<app-name>/main.log
// Windows: %USERPROFILE%\AppData\Roaming\<app-name>\logs\main.log
// Linux: ~/.config/<app-name>/logs/main.log
```

### 2. Verify Metadata File

```yaml
# latest.yml must contain these fields:
version: 2.0.0 # Must be higher than current app version
path: my-app-setup.exe # Must match actual filename on server
sha512: <valid-hash> # Must match actual file hash
releaseDate: "2025-..." # ISO 8601 format
```

### 3. Common Failure Points

| Symptom                            | Cause                                                        | Fix                                                    |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `checkForUpdates()` returns null   | `app.isPackaged` is false and `forceDevUpdateConfig` not set | Set `forceDevUpdateConfig = true`                      |
| "No published versions" error      | Metadata file not found at provider URL                      | Verify URL + path combination resolves to `latest.yml` |
| "sha512 checksum mismatch"         | Installer was modified or hash is wrong                      | Regenerate `latest.yml` with correct hash              |
| "Code signing verification failed" | Windows: unsigned installer / wrong publisher                | Sign the installer or disable verification for testing |
| Silently does nothing              | Logger not attached                                          | Set `autoUpdater.logger = log` and check log file      |
| "net::ERR_CONNECTION_REFUSED"      | Local server not running                                     | Start your HTTP/S3 server                              |

### 4. Disable Code Signing Verification (Testing Only)

On Windows, the updater verifies the code signature of downloaded installers by default. For local testing with unsigned builds:

```javascript
// TESTING ONLY -- never do this in production
if (!app.isPackaged) {
  autoUpdater.forceDevUpdateConfig = true;

  // Skip code signature verification for local unsigned builds
  const { NsisUpdater } = require("electron-updater");
  if (autoUpdater instanceof NsisUpdater) {
    autoUpdater.verifyUpdateCodeSignature = () => Promise.resolve(null);
  }
}
```

**Why this is dangerous in production:** Disabling signature verification means any file matching the URL pattern could be installed -- including malware injected by a network attacker.

---

## Generating sha512 for Manual latest.yml

When hand-crafting `latest.yml` for local testing, you need the sha512 hash of the installer:

```bash
# macOS / Linux
shasum -a 512 my-app-setup-2.0.0.exe | awk '{print $1}' | xxd -r -p | base64

# Or with openssl
openssl dgst -sha512 -binary my-app-setup-2.0.0.exe | base64

# Windows (PowerShell)
$hash = Get-FileHash -Algorithm SHA512 my-app-setup-2.0.0.exe
[Convert]::ToBase64String([System.Convert]::FromHexString($hash.Hash))
```

**Key point:** The hash in `latest.yml` must be base64-encoded, not hex. electron-updater uses base64 format.

---

## Integration Test Strategy

For automated testing of the update flow:

1. **Unit test the update event handlers** -- mock `autoUpdater` and verify your handler functions call the right IPC methods
2. **Test the preload API** -- verify the exposed `updaterAPI` methods map to correct IPC channels
3. **End-to-end flow** -- requires a packaged app + update server; typically tested manually or in CI with a staging environment

```javascript
// Example: unit testing the update handler
const { EventEmitter } = require("events");

function createMockUpdater() {
  const mock = new EventEmitter();
  // Use your test framework's mock/spy function
  mock.checkForUpdates = vi.fn(); // or jest.fn(), sinon.stub(), etc.
  mock.checkForUpdatesAndNotify = vi.fn();
  mock.downloadUpdate = vi.fn().mockResolvedValue(["/path/to/file"]);
  mock.quitAndInstall = vi.fn();
  mock.autoDownload = true;
  mock.logger = null;
  return mock;
}
```

**Key point:** Full auto-update E2E tests are expensive and fragile. Focus unit tests on your event handler logic and preload API. Reserve E2E testing for CI pipelines with packaged builds against a staging update server.
