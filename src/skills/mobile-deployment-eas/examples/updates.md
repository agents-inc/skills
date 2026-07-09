# EAS Update Patterns

> OTA update workflows, client-side update hooks, and channel strategies. See [SKILL.md](../SKILL.md) for decisions and philosophy.

---

## Publishing Updates

### SDK 55+ (--environment flag required)

```bash
# Publish to preview environment
eas update --environment preview --message "Fix login crash"

# Publish to production environment
eas update --environment production --message "Version 1.2.1 hotfix"

# List published updates
eas update:list

# Rollback a bad update
eas update:rollback --channel production
```

### SDK 54 and Earlier (--channel flag)

```bash
eas update --channel preview --message "Fix login crash"
eas update --channel production --message "Version 1.2.1 hotfix"
```

**Migration note:** If upgrading from SDK 54 to 55, replace all `--channel` flags with `--environment` in your scripts and CI pipelines.

---

## Channel-Branch-Update Model

```
Channel: "production"  ──points to──>  Branch: "production"
                                          |
                                          +-- Update 3 (latest - ACTIVE)
                                          +-- Update 2
                                          +-- Update 1

Channel: "preview"     ──points to──>  Branch: "preview"
                                          |
                                          +-- Update 2 (latest - ACTIVE)
                                          +-- Update 1
```

**Key concepts:**

- A **channel** is assigned to a build profile (in `eas.json`)
- A **branch** contains a list of updates (most recent is active)
- By default, a channel points to a branch with the same name
- You can remap: `eas channel:edit production --branch hotfix-v2`

### Remapping for Hotfixes

```bash
# Normal state: production channel -> production branch
# Hotfix scenario:
eas update --branch hotfix-v2 --message "Critical security fix"
eas channel:edit production --branch hotfix-v2

# After hotfix is merged into main:
eas update --environment production --message "Includes hotfix"
eas channel:edit production --branch production  # Reset
```

---

## Client-Side Update Hook

Check for and apply updates in the app. Skip checks in development mode.

```typescript
// hooks/use-ota-updates.ts
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

const UPDATE_CHECK_INTERVAL_MS = 30_000;

interface UpdateState {
  isChecking: boolean;
  isAvailable: boolean;
  isDownloading: boolean;
}

export function useOTAUpdates() {
  const [state, setState] = useState<UpdateState>({
    isChecking: false,
    isAvailable: false,
    isDownloading: false,
  });

  const checkForUpdates = async () => {
    if (__DEV__) return; // Skip in development builds

    try {
      setState((prev) => ({ ...prev, isChecking: true }));
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setState((prev) => ({
          ...prev,
          isAvailable: true,
          isDownloading: true,
        }));
        await Updates.fetchUpdateAsync();
        setState((prev) => ({ ...prev, isDownloading: false }));

        Alert.alert(
          "Update Ready",
          "A new version has been downloaded. Restart to apply.",
          [
            { text: "Later", style: "cancel" },
            { text: "Restart", onPress: () => Updates.reloadAsync() },
          ],
        );
      }
    } catch (error) {
      // Fail silently -- app continues with current version
      console.error("Error checking for updates:", error);
    } finally {
      setState((prev) => ({ ...prev, isChecking: false }));
    }
  };

  useEffect(() => {
    checkForUpdates();

    const interval = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    checkForUpdates,
  };
}
```

**Usage in root layout:**

```typescript
// app/_layout.tsx
import { useOTAUpdates } from "../hooks/use-ota-updates";

export default function RootLayout() {
  useOTAUpdates(); // Checks on mount and periodically

  return <Stack />;
}
```

**Why good:** Named constant for interval, graceful error handling (app continues on failure), skip in dev mode, cleanup on unmount

---

## Immediate Update Strategy

Force the update before the user interacts with the app. Use `fallbackToCacheTimeout` in app config.

```typescript
// app.config.ts
export default {
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
    fallbackToCacheTimeout: 5000, // Wait up to 5s for update on launch
  },
  runtimeVersion: {
    policy: "fingerprint",
  },
};
```

**How it works:** On app launch, `expo-updates` checks for a new update. If one is found and downloaded within 5 seconds, it runs immediately. Otherwise, the cached version runs and the update downloads in the background for the next launch.

**Trade-off:** Setting a high timeout delays app startup. Setting `0` (default) always uses the cached version and downloads updates in the background.

---

## Channel Strategy

```
Environment     Channel        Build Profile    Use Case
-----------     -------        -------------    --------
Development     development    development      Local dev testing
Preview/QA      preview        preview          Internal testing
Production      production     production       App store users

Git Branch      Deployment Target
----------      -----------------
feature/*       development channel (or none)
staging         preview channel
main            production channel
```

### Aligning eas.json with Channels

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  }
}
```

**Key rule:** Each build profile's `channel` determines which updates it receives. A production build with `"channel": "production"` will never receive updates published to the `preview` channel.

---

## Update Size Considerations

- EAS Update has a **~50MB limit** per update bundle
- Large assets (images, videos, fonts) should be hosted on a CDN, not bundled
- SDK 55 introduces **Hermes bytecode diffing** (opt-in via `enableBsdiffPatchSupport` in `expo-build-properties`) for up to 75% smaller OTA downloads
- Only JavaScript and asset changes are included in updates -- native code changes require a new build

---

## Code Signing (End-to-End)

For apps requiring cryptographic verification of updates (enterprise, regulated industries):

```bash
# Generate signing key pair (one-time)
npx expo-updates codesigning:generate \
  --key-output-directory keys \
  --certificate-output-directory certs \
  --certificate-common-name "My App"

# Configure in app.config.ts
export default {
  updates: {
    codeSigningCertificate: "./certs/certificate.pem",
    codeSigningMetadata: {
      keyid: "main-key",
      alg: "rsa-v1_5-sha256",
    },
  },
};

# Publish signed update
eas update --environment production \
  --private-key-path ./keys/private-key.pem \
  --message "Signed update v1.2.1"
```

**Key rules:**

- Private key never leaves your machine (or CI secret store)
- Public key is embedded in the app via config
- Requires EAS Production or Enterprise plan
- Updates without valid signatures are rejected by the client
