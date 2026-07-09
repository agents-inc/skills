# Electron Auto-Update Reference

> Quick-lookup tables, event payloads, provider comparison, and security checklist. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/](examples/) for full code examples.

---

## Update Lifecycle Events

| Event                  | Payload        | When                                    |
| ---------------------- | -------------- | --------------------------------------- |
| `checking-for-update`  | (none)         | Check started                           |
| `update-available`     | `UpdateInfo`   | Newer version found on server           |
| `update-not-available` | `UpdateInfo`   | Current version is latest               |
| `download-progress`    | `ProgressInfo` | During full download (not differential) |
| `update-downloaded`    | `UpdateInfo`   | Download complete, ready to install     |
| `error`                | `Error`        | Any failure during check or download    |

---

## UpdateInfo Fields

| Field                  | Type                          | Description                                          |
| ---------------------- | ----------------------------- | ---------------------------------------------------- |
| `version`              | `string`                      | Semver version of the update                         |
| `files`                | `UpdateFileInfo[]`            | Array of update file metadata                        |
| `releaseDate`          | `string`                      | ISO 8601 timestamp                                   |
| `releaseName`          | `string?`                     | Optional display name                                |
| `releaseNotes`         | `string \| ReleaseNoteInfo[]` | Changelog (string or array if `fullChangelog: true`) |
| `stagingPercentage`    | `number?`                     | Rollout percentage (0-100)                           |
| `minimumSystemVersion` | `string?`                     | Minimum required OS version                          |

---

## ProgressInfo Fields

| Field            | Type     | Description                 |
| ---------------- | -------- | --------------------------- |
| `bytesPerSecond` | `number` | Download speed              |
| `percent`        | `number` | Download completion (0-100) |
| `transferred`    | `number` | Bytes downloaded            |
| `total`          | `number` | Total bytes to download     |

---

## AppUpdater Properties

| Property                      | Type                   | Default     | Description                                          |
| ----------------------------- | ---------------------- | ----------- | ---------------------------------------------------- |
| `autoDownload`                | `boolean`              | `true`      | Download update automatically when available         |
| `autoInstallOnAppQuit`        | `boolean`              | `true`      | Install downloaded update on app exit                |
| `autoRunAppAfterInstall`      | `boolean`              | `true`      | Launch app after installer completes                 |
| `allowPrerelease`             | `boolean`              | `false`     | Accept pre-release versions (GitHub only)            |
| `allowDowngrade`              | `boolean`              | `false`     | Enable downgrade between channels                    |
| `fullChangelog`               | `boolean`              | `false`     | Return release notes as array (GitHub)               |
| `channel`                     | `string`               | from config | Override update channel at runtime                   |
| `forceDevUpdateConfig`        | `boolean`              | `false`     | Use `dev-app-update.yml` instead of `app-update.yml` |
| `disableDifferentialDownload` | `boolean`              | `false`     | Force full download (NSIS Windows only)              |
| `disableWebInstaller`         | `boolean`              | `false`     | Prevent loading unsigned web installers              |
| `logger`                      | `Logger?`              | `null`      | Logger implementing `{ info, warn, error }`          |
| `requestHeaders`              | `OutgoingHttpHeaders?` | `null`      | Custom HTTP headers for update requests              |

---

## AppUpdater Methods

| Method                                        | Returns                              | Description                                          |
| --------------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `checkForUpdates()`                           | `Promise<UpdateCheckResult \| null>` | Check for updates silently                           |
| `checkForUpdatesAndNotify(opts?)`             | `Promise<UpdateCheckResult \| null>` | Check + show OS notification on download             |
| `downloadUpdate(token?)`                      | `Promise<string[]>`                  | Start download manually (when `autoDownload: false`) |
| `quitAndInstall(isSilent?, isForceRunAfter?)` | `void`                               | Close app and run installer                          |
| `setFeedURL(options)`                         | `void`                               | Override provider config at runtime                  |
| `addAuthHeader(token)`                        | `void`                               | Add auth header for private repos                    |

---

## Provider Comparison

| Provider | Config Key | Auth               | Differential   | Notes                   |
| -------- | ---------- | ------------------ | -------------- | ----------------------- |
| GitHub   | `github`   | `GH_TOKEN` env     | No             | Easiest for open source |
| Generic  | `generic`  | Custom headers     | Yes (blockmap) | Any HTTP(S) server      |
| S3       | `s3`       | AWS creds          | Yes (blockmap) | Scales well             |
| Spaces   | `spaces`   | `DO_KEY_ID` env    | Yes (blockmap) | DigitalOcean            |
| Keygen   | `keygen`   | `KEYGEN_TOKEN` env | No             | License-gated updates   |

---

## Platform-Specific Behavior

| Feature                   | macOS (DMG)          | Windows (NSIS)              | Linux (AppImage)      |
| ------------------------- | -------------------- | --------------------------- | --------------------- |
| Code signing required     | Yes (mandatory)      | No (recommended)            | No                    |
| Differential download     | No                   | Yes (blockmap)              | No                    |
| Silent install            | No (always shows UI) | Yes (`isSilent` param)      | N/A (replaces binary) |
| `download-progress` event | Yes                  | Full download only          | Yes                   |
| Signature verification    | Apple code sign      | `verifyUpdateCodeSignature` | No                    |
| `autoRunAppAfterInstall`  | No effect            | Yes                         | No effect             |

---

## Channel Quick Reference

| Version in package.json | Channel           | Metadata Files                          | Receives Updates From |
| ----------------------- | ----------------- | --------------------------------------- | --------------------- |
| `2.1.0`                 | `latest` (stable) | `latest.yml`                            | Stable only           |
| `2.1.0-beta`            | `beta`            | `beta.yml` + `latest.yml`               | Beta + stable         |
| `2.1.0-alpha`           | `alpha`           | `alpha.yml` + `beta.yml` + `latest.yml` | Alpha + beta + stable |

**Requires:** `generateUpdatesFilesForAllChannels: true` in electron-builder config.

---

## Security Checklist

- [ ] macOS builds are code-signed with a Developer ID certificate
- [ ] Windows builds are code-signed with an EV or standard code signing certificate
- [ ] Update server uses HTTPS (not plain HTTP in production)
- [ ] Private repo tokens are stored in environment variables, not in code
- [ ] `verifyUpdateCodeSignature` is NOT disabled in production (Windows)
- [ ] `disableWebInstaller` is `true` unless web installer is specifically needed
- [ ] `setFeedURL()` is not called with user-controlled input (prevents redirect attacks)
- [ ] `latest.yml` sha512 hash matches the actual installer binary

---

## Metadata File Format (latest.yml)

```yaml
version: 2.1.0
path: my-app-setup-2.1.0.exe
sha512: <base64-encoded-sha512-of-installer>
releaseDate: "2025-03-15T10:00:00.000Z"
stagingPercentage: 100 # Optional: 0-100 for staged rollouts
```

**Key point:** The `sha512` value is base64-encoded, not hex. This catches most manual-editing errors.

---

## electron-updater vs Electron's Built-in autoUpdater

| Feature                   | `electron-updater`                  | Built-in `autoUpdater`                  |
| ------------------------- | ----------------------------------- | --------------------------------------- |
| Package                   | `electron-updater` (npm)            | `electron` (built-in)                   |
| Linux support             | Yes (AppImage, DEB, RPM)            | No                                      |
| Windows mechanism         | NSIS                                | Squirrel.Windows                        |
| Providers                 | GitHub, S3, Spaces, Keygen, Generic | Custom URL only                         |
| Differential downloads    | Yes (blockmap on Windows)           | Squirrel delta packages                 |
| Staged rollouts           | Yes (`stagingPercentage`)           | No                                      |
| Update channels           | Yes (alpha/beta/stable)             | No                                      |
| Code signing validation   | macOS + Windows                     | macOS only                              |
| `download-progress` event | Yes                                 | No                                      |
| Maintained                | Yes (electron-builder team)         | Limited (Squirrel.Windows unmaintained) |
