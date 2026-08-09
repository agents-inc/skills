---
name: desktop-updates-electron-updater
description: Cross-platform auto-update patterns with electron-updater (electron-builder ecosystem)
---

# Electron Auto-Update Patterns

> **Quick Guide:** Use `electron-updater` (from electron-builder) for cross-platform auto-updates. It supports macOS (DMG), Windows (NSIS), and Linux (AppImage/DEB/RPM). Configure a provider (GitHub, S3, generic server) in your `electron-builder` config. The updater emits lifecycle events: `checking-for-update` -> `update-available` -> `download-progress` -> `update-downloaded`. Set `autoDownload: false` for manual download control. Use channels (`latest`/`beta`/`alpha`) for staged releases and `stagingPercentage` for gradual rollouts. Code signing is mandatory on macOS and strongly recommended on Windows.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST guard update checks with `app.isPackaged` -- calling `checkForUpdates()` in development causes confusing errors and network calls to non-existent endpoints)**

**(You MUST handle the `error` event on the updater -- unhandled update errors crash the main process)**

**(You MUST code-sign macOS builds -- unsigned apps cannot auto-update and the updater silently fails)**

**(You MUST NOT call `quitAndInstall()` without confirming the user's intent -- forcing a restart mid-work causes data loss)**

**(You MUST use named constants for all intervals and timeouts -- no magic numbers in `setInterval` or retry logic)**

</critical_requirements>

---

**Auto-detection:** electron-updater, autoUpdater from electron-updater, checkForUpdates, checkForUpdatesAndNotify, update-available, update-downloaded, download-progress, quitAndInstall, autoDownload, stagingPercentage, dev-app-update.yml, NsisUpdater, MacUpdater, AppImageUpdater, setFeedURL, allowPrerelease, allowDowngrade, forceDevUpdateConfig, disableDifferentialDownload

<philosophy>

**When to use:**

- Implementing auto-updates in Electron apps built with electron-builder
- Configuring update providers (GitHub Releases, S3, generic HTTP server)
- Setting up update channels for beta/alpha testing
- Implementing staged rollouts with percentage-based distribution
- Controlling download behavior (manual download, progress tracking)
- Handling update errors with retry strategies
- Testing the update flow locally during development

**When NOT to use:**

- Apps packaged with Electron Forge using Squirrel (use Electron's built-in `autoUpdater` module instead)
- Apps distributed exclusively through platform app stores (macOS App Store, Microsoft Store) -- those have their own update mechanisms
- Apps that only need to check for updates and show a "download from website" link (no in-app update needed)

</philosophy>

---

<patterns>

## Key Patterns

### Pattern 1: Basic Setup with Lifecycle Events

Import `autoUpdater` from `electron-updater` (not Electron's built-in module). Wire up lifecycle events in the main process after the app is ready.

```javascript
import { autoUpdater } from "electron-updater";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

function setupAutoUpdater(mainWindow) {
  if (!app.isPackaged) return; // Never check in development

  autoUpdater.on("update-available", (info) => {
    mainWindow.webContents.send("update-available", info);
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow.webContents.send("update-downloaded", info);
  });

  autoUpdater.on("error", (error) => {
    log.error("Update error:", error);
  });

  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdates(), CHECK_INTERVAL_MS);
}
```

**Key point:** `checkForUpdatesAndNotify()` checks and shows a native OS notification when an update downloads. Use `checkForUpdates()` for silent checks when you handle UI yourself. See [examples/core.md](examples/core.md).

---

### Pattern 2: Manual Download Control

Set `autoDownload: false` to let users decide when to download. This is essential for metered connections or large updates.

```javascript
autoUpdater.autoDownload = false;

autoUpdater.on("update-available", (info) => {
  // Show UI prompt -- user decides whether to download
  mainWindow.webContents.send("update-available", info);
});

// User clicks "Download" in the renderer
ipcMain.handle("start-update-download", () => {
  return autoUpdater.downloadUpdate();
});
```

**Key point:** With `autoDownload: false`, the `download-progress` and `update-downloaded` events only fire after you explicitly call `downloadUpdate()`. See [examples/core.md](examples/core.md).

---

### Pattern 3: Update Providers

Configure where the updater looks for releases. The provider is set in your `electron-builder` config file and can be overridden at runtime with `setFeedURL()`.

```yaml
# electron-builder.yml -- GitHub provider (default if GH_TOKEN set)
publish:
  provider: github
  owner: my-org
  repo: my-app
```

```yaml
# electron-builder.yml -- Generic HTTP server
publish:
  provider: generic
  url: https://releases.example.com/updates
```

```yaml
# electron-builder.yml -- S3 bucket
publish:
  provider: s3
  bucket: my-app-releases
  region: us-east-1
  path: /releases
```

**Key point:** The first provider in the list is the auto-update source. Additional providers are publishing targets only. See [examples/core.md](examples/core.md) for runtime `setFeedURL()` override.

---

### Pattern 4: Update Channels (Stable/Beta/Alpha)

Channels distribute pre-release versions to specific user groups. Append `-beta` or `-alpha` to your `package.json` version to produce channel-specific metadata files.

```json
{ "version": "2.1.0-beta" }
```

```yaml
# electron-builder.yml
generateUpdatesFilesForAllChannels: true
```

```javascript
// Switch channel at runtime
autoUpdater.channel = "beta";
// Setting channel automatically enables allowDowngrade
```

**Key point:** Users on `alpha` receive alpha, beta, and stable releases. Users on `beta` receive beta and stable. Users on `latest` (stable) only receive stable releases. See [examples/channels-and-rollouts.md](examples/channels-and-rollouts.md).

---

### Pattern 5: Staged Rollouts

Roll out updates gradually by setting `stagingPercentage` in your metadata YAML file. The updater assigns each installation a persistent random ID and compares it against the percentage.

```yaml
# latest.yml (manually edited after publishing)
version: 2.1.0
stagingPercentage: 10 # Ship to 10% of users first
```

**Key point:** Increment the version when pulling a broken staged release -- users already on the broken version will not downgrade to the same version number. See [examples/channels-and-rollouts.md](examples/channels-and-rollouts.md).

---

### Pattern 6: Error Handling and Retry

Network failures during update checks are common. Wrap retry logic around the check and always handle the `error` event.

```javascript
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30_000; // 30 seconds

autoUpdater.on("error", (error) => {
  log.error("Auto-update error:", error.message);
  // Notify renderer for user-facing feedback
  mainWindow.webContents.send("update-error", error.message);
});
```

**Key point:** The `error` event fires for network failures, signature verification failures, and corrupted downloads. Never ignore it -- unhandled errors in the updater crash the main process. See [examples/core.md](examples/core.md) for retry with exponential backoff.

---

### Pattern 7: Testing Locally

Use `dev-app-update.yml` and `forceDevUpdateConfig` to test the update flow without packaging.

```yaml
# dev-app-update.yml (project root)
provider: generic
url: http://localhost:8080/updates
```

```javascript
if (!app.isPackaged) {
  autoUpdater.forceDevUpdateConfig = true;
}
```

**Key point:** You still need a local HTTP server serving the update artifacts (installer + `latest.yml`). Minio is commonly used as a local S3-compatible server for this purpose. See [examples/testing.md](examples/testing.md).

</patterns>

---

<decision_framework>

## Decision Framework

### Which Update Approach?

```
Building with electron-builder?
+-- YES --> Use electron-updater (this skill)
+-- NO  --> Building with Electron Forge?
    +-- YES --> Using Squirrel maker?
    |   +-- YES --> Use Electron's built-in autoUpdater module
    |   +-- NO  --> Can use electron-updater with custom config
    +-- NO  --> Distributing via app store?
        +-- YES --> Use the store's native update mechanism
        +-- NO  --> Use electron-updater with generic provider
```

### Which Provider?

```
Where are your releases hosted?
+-- GitHub Releases (public or private repo)
|   +-- Use provider: github
+-- AWS S3 or compatible (MinIO, Backblaze B2)
|   +-- Use provider: s3
+-- DigitalOcean Spaces
|   +-- Use provider: spaces
+-- Any HTTP(S) server (Nginx, CDN, custom)
|   +-- Use provider: generic
+-- Keygen (license-gated updates)
    +-- Use provider: keygen
```

### autoDownload: true vs false?

```
Should updates download automatically?
+-- App is small (<50 MB) and users expect seamless updates?
|   +-- autoDownload: true (default) + checkForUpdatesAndNotify()
+-- App is large or users are on metered connections?
|   +-- autoDownload: false + show download prompt in UI
+-- Enterprise environment with IT-managed rollouts?
    +-- autoDownload: false + admin-controlled trigger
```

</decision_framework>

---

**Detailed resources:**

- [examples/core.md](examples/core.md) - Setup, lifecycle events, manual download, providers, error handling with retry
- [examples/channels-and-rollouts.md](examples/channels-and-rollouts.md) - Update channels, staged rollouts, channel switching
- [examples/testing.md](examples/testing.md) - Local testing, dev-app-update.yml, debugging with logging
- [reference.md](reference.md) - API quick reference, event payloads, provider comparison, security checklist

---

<red_flags>

## RED FLAGS

**Critical Issues:**

- Calling `checkForUpdates()` or `checkForUpdatesAndNotify()` outside `app.isPackaged` guard -- causes errors and unnecessary network calls in development
- Not handling the `error` event on `autoUpdater` -- unhandled update errors crash the main process
- Shipping unsigned macOS builds -- auto-update silently fails without code signing
- Calling `quitAndInstall()` immediately without user confirmation -- forces restart, risks data loss
- Using Electron's built-in `autoUpdater` module instead of importing from `electron-updater` -- different API, different behavior, no Linux support

**Architecture Issues:**

- Running update logic in the renderer process -- `electron-updater` must run in the main process only
- Checking for updates on every app launch without a cooldown -- hammers the update server, especially with large user bases
- Not using `autoInstallOnAppQuit` when `autoDownload` is true -- users never get the update if they don't explicitly restart
- Mixing Squirrel.Windows and NSIS updater patterns -- they are incompatible (Squirrel uses `.nupkg` delta files, NSIS uses blockmap-based differential downloads)

**Staged Rollout Mistakes:**

- Setting `stagingPercentage: 0` expecting it to block all updates -- behavior is undefined at 0; use channels for access control instead
- Not incrementing version when pulling a broken staged release -- users already on the broken version stay there
- Editing `stagingPercentage` in `latest.yml` without re-signing -- signature validation fails

**Common Mistakes:**

- Forgetting `generateUpdatesFilesForAllChannels: true` when using beta/alpha channels -- only the current channel's YAML is generated
- Using `allowPrerelease: true` on the client instead of proper channels -- `allowPrerelease` only works with GitHub provider and is less predictable than channels
- Not setting `autoUpdater.logger` during debugging -- update failures are silent without logging configured
- Hardcoding update URLs instead of using `electron-builder` publish config -- the build process auto-generates correct metadata only when publish is configured

**Gotchas & Edge Cases:**

- `checkForUpdatesAndNotify()` returns `null` when `app.isPackaged` is false -- it silently skips in dev
- Differential downloads (blockmap) only work for NSIS on Windows -- macOS and Linux always do full downloads
- `quitAndInstall(true)` (silent mode) only works on Windows NSIS -- macOS ignores the `isSilent` parameter
- The `download-progress` event does not fire when differential download is used -- only fires for full downloads
- On Windows, the updater verifies the code signature of the downloaded installer by default (`verifyUpdateCodeSignature`) -- unsigned updates are rejected
- `setFeedURL()` overrides the provider from `electron-builder` config at runtime -- useful for switching environments but can cause confusion if called unintentionally

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST guard update checks with `app.isPackaged` -- calling `checkForUpdates()` in development causes confusing errors and network calls to non-existent endpoints)**

**(You MUST handle the `error` event on the updater -- unhandled update errors crash the main process)**

**(You MUST code-sign macOS builds -- unsigned apps cannot auto-update and the updater silently fails)**

**(You MUST NOT call `quitAndInstall()` without confirming the user's intent -- forcing a restart mid-work causes data loss)**

**(You MUST use named constants for all intervals and timeouts -- no magic numbers in `setInterval` or retry logic)**

**Failure to follow these rules will cause silent update failures, crashes, or data loss for end users.**

</critical_reminders>
