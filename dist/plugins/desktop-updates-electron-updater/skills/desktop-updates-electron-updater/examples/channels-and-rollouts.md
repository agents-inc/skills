# Electron Auto-Update - Channels and Staged Rollouts

> Update channels (stable/beta/alpha), staged rollouts with percentage-based distribution, channel switching at runtime. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for basic setup.

---

## Update Channels Configuration

Channels allow you to distribute pre-release versions to specific user groups. The channel is determined by the version suffix in `package.json`.

### Build Configuration

```json
// package.json -- beta release
{
  "name": "my-app",
  "version": "2.1.0-beta",
  "build": {
    "generateUpdatesFilesForAllChannels": true
  }
}
```

```json
// package.json -- stable release (no suffix)
{
  "name": "my-app",
  "version": "2.1.0"
}
```

**Key point:** Setting `generateUpdatesFilesForAllChannels: true` produces metadata files for all channels in a single build. Without this, only the current channel's YAML file is generated.

### Generated Metadata Files

| Version Suffix | Files Generated (with `generateUpdatesFilesForAllChannels: true`) |
| -------------- | ----------------------------------------------------------------- |
| `2.1.0`        | `latest.yml`, `latest-mac.yml`, `latest-linux.yml`                |
| `2.1.0-beta`   | Above + `beta.yml`, `beta-mac.yml`, `beta-linux.yml`              |
| `2.1.0-alpha`  | Above + `alpha.yml`, `alpha-mac.yml`, `alpha-linux.yml`           |

### Channel Inheritance

Users receive updates from their channel AND all more-stable channels:

```
alpha channel --> receives: alpha + beta + stable releases
beta channel  --> receives: beta + stable releases
latest (stable) --> receives: stable releases only
```

---

## Switching Channels at Runtime

Allow users to opt into or out of pre-release channels from the app's settings.

```javascript
const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");

// Read saved preference (from your config/settings store)
const savedChannel = getUserPreference("updateChannel") || "latest";
autoUpdater.channel = savedChannel;

// User changes channel in settings
ipcMain.handle("set-update-channel", (_event, channel) => {
  const VALID_CHANNELS = ["latest", "beta", "alpha"];
  if (!VALID_CHANNELS.includes(channel)) {
    throw new Error(`Invalid channel: ${channel}`);
  }

  autoUpdater.channel = channel;
  saveUserPreference("updateChannel", channel);

  // Setting channel automatically enables allowDowngrade,
  // so switching from beta -> latest will downgrade to stable
  autoUpdater.checkForUpdates();

  return { channel, allowDowngrade: autoUpdater.allowDowngrade };
});
```

**Why good:** Validates channel input, persists preference, triggers immediate check after switch, explains allowDowngrade behavior

**Gotcha:** When `generateUpdatesFilesForAllChannels` is true, `allowDowngrade` is automatically set to true. This means a user switching from `beta` to `latest` will downgrade to the latest stable version. If you want to prevent downgrades, explicitly set `autoUpdater.allowDowngrade = false` after setting the channel.

---

## Staged Rollouts

Staged rollouts distribute an update to a percentage of your user base. This is controlled by editing the metadata YAML file after publishing (not in the electron-builder config).

### Setting Up a Staged Rollout

```yaml
# latest.yml (manually edited after build/publish)
version: 2.1.0
path: my-app-setup-2.1.0.exe
sha512: abc123...
releaseDate: "2025-03-15T10:00:00.000Z"
stagingPercentage: 10
```

### Gradual Rollout Strategy

```
Day 1:  stagingPercentage: 10   -- 10% of users, monitor error reports
Day 3:  stagingPercentage: 30   -- Expand if no issues
Day 5:  stagingPercentage: 50   -- Half the user base
Day 7:  stagingPercentage: 100  -- Full rollout (or remove the field)
```

### How Staging Works Internally

Each installation gets a persistent random UUID. The updater hashes this UUID to a number between 0-100 and compares it to `stagingPercentage`. This means:

- The same user consistently gets or skips the update (deterministic, not random each check)
- Increasing the percentage includes previously-excluded users
- Decreasing the percentage excludes some previously-included users

### Pulling a Broken Staged Release

If a staged release has critical bugs:

```yaml
# WRONG: setting stagingPercentage to 0 does NOT reliably stop the rollout
version: 2.1.0
stagingPercentage: 0  # Undefined behavior -- do not rely on this

# CORRECT: publish a new version that supersedes the broken one
version: 2.1.1  # Fix version -- even if the "fix" is just a revert
stagingPercentage: 100  # Ensure all users (including those on 2.1.0) get this
```

**Key point:** Users already on the broken version (2.1.0) will NOT downgrade to 2.1.0 again. You must publish a higher version number. This is the most common staged rollout mistake.

---

## Combining Channels and Staged Rollouts

Use channels for user opt-in (beta testers) and staged rollouts for controlled distribution within a channel.

```
Release strategy for v3.0.0:
1. Publish 3.0.0-alpha  --> alpha channel testers (days 1-7)
2. Publish 3.0.0-beta   --> beta channel testers (days 8-14)
3. Publish 3.0.0        --> stable channel, stagingPercentage: 10 (day 15)
4. Increase staging      --> stagingPercentage: 50 (day 18)
5. Full rollout          --> stagingPercentage: 100 (day 21)
```

---

## GitHub Provider with Channels

When using the GitHub provider, releases are matched to channels by version tag:

```
GitHub Release: v2.1.0-beta.1  --> beta channel
GitHub Release: v2.1.0         --> latest (stable) channel
```

**Gotcha:** GitHub release detection does not always respect the channel from the version tag alone. Set the `channel` property explicitly in your publish config when using GitHub:

```yaml
# electron-builder.yml
publish:
  provider: github
  owner: my-org
  repo: my-app
  channel: beta # Explicit channel for GitHub
```
