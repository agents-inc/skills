# EAS (Expo Application Services) Patterns

Cloud build, submit, and OTA update workflows.

---

## EAS Setup

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to your Expo account
eas login

# Initialize EAS in your project
eas init

# Verify setup
eas whoami
```

---

## eas.json Configuration

### Basic Configuration

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal"
      }
    }
  }
}
```

### Complete Configuration with All Profiles

```json
{
  "cli": {
    "version": ">= 7.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "base": {
      "node": "20.17.0",
      "env": {
        "EXPO_PUBLIC_APP_ENV": "development"
      }
    },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true,
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "development-device": {
      "extends": "development",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "EXPO_PUBLIC_APP_ENV": "preview"
      }
    },
    "production": {
      "extends": "base",
      "autoIncrement": "version",
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_APP_ENV": "production"
      },
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABC123DEF"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal",
        "releaseStatus": "draft"
      }
    }
  }
}
```

---

## Development Builds

### Create Development Build

```bash
# iOS Simulator
eas build --profile development --platform ios

# iOS Device (requires Apple Developer account)
eas build --profile development-device --platform ios

# Android APK
eas build --profile development --platform android

# Both platforms
eas build --profile development --platform all
```

### Local Development Build

```bash
# Requires android/ios directories (run prebuild first)
npx expo prebuild

# Build locally
npx expo run:ios
npx expo run:android

# Build locally with specific device
npx expo run:ios --device "iPhone 15 Pro"
```

### Install Development Build

```bash
# List available builds
eas build:list

# Install on simulator/emulator (after build completes)
eas build:run --platform ios
eas build:run --platform android

# Install specific build
eas build:run --id [build-id]
```

---

## Preview Builds

```bash
# Create preview build
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Internal distribution - generates QR code
# Testers scan to install from Expo dashboard
```

### Internal Distribution Setup (iOS)

1. Create Apple Developer account with Ad Hoc distribution
2. Register test devices in Apple Developer Portal
3. Add devices to EAS:

```bash
# Register devices
eas device:create

# List registered devices
eas device:list
```

---

## Production Builds

```bash
# Create production build
eas build --profile production --platform ios
eas build --profile production --platform android

# Create both platforms
eas build --profile production --platform all

# Build with auto-increment version
eas build --profile production --platform all --auto-submit
```

### Production Build Configuration

```json
{
  "build": {
    "production": {
      "autoIncrement": "version",
      "channel": "production",
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

---

## App Store Submission

### iOS App Store

```bash
# Submit latest production build
eas submit --platform ios

# Submit specific build
eas submit --platform ios --id [build-id]

# Build and submit in one command
eas build --profile production --platform ios --auto-submit
```

### iOS Credentials Setup

```bash
# Manage iOS credentials
eas credentials --platform ios

# Options:
# - Let EAS manage (recommended for most)
# - Use own certificates (enterprise/specific requirements)
```

### Google Play Store

```bash
# Submit to internal testing track
eas submit --platform android

# Submit specific build
eas submit --platform android --id [build-id]
```

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal",
        "releaseStatus": "draft"
      }
    }
  }
}
```

### Google Play Setup

1. Create Service Account in Google Cloud Console
2. Grant access to Play Console
3. Download JSON key file
4. Add path to eas.json

---

## OTA Updates (EAS Update)

### Update Configuration

```typescript
// app.config.ts
export default {
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: "appVersion", // or "sdkVersion", "nativeVersion", "fingerprint"
  },
  // Alternative: exact runtimeVersion
  // runtimeVersion: "1.0.0",
};
```

### Runtime Version Policies

| Policy | When to Use | Auto Updates |
|--------|-------------|--------------|
| `appVersion` | Standard apps, tracks version field | Within same app version |
| `sdkVersion` | SDK-based versioning | Within same SDK |
| `nativeVersion` | iOS buildNumber/Android versionCode | Within same native version |
| `fingerprint` | Automatic detection | Detects native changes |
| Explicit string | Full control | Only matching versions |

### Publish Updates

```bash
# Publish to preview channel
eas update --channel preview --message "Bug fix for login flow"

# Publish to production channel
eas update --channel production --message "Version 1.2.0 release"

# Publish specific branch to channel
eas update --branch main --message "Latest main"

# Interactive mode
eas update --channel preview
```

### Update Workflow

```typescript
// hooks/use-updates.ts
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

const UPDATE_CHECK_INTERVAL_MS = 30000; // 30 seconds

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
    if (__DEV__) return; // Skip in development

    try {
      setState((prev) => ({ ...prev, isChecking: true }));
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setState((prev) => ({ ...prev, isAvailable: true, isDownloading: true }));
        await Updates.fetchUpdateAsync();
        setState((prev) => ({ ...prev, isDownloading: false }));

        Alert.alert(
          "Update Ready",
          "A new version has been downloaded. Restart to apply.",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart",
              onPress: () => Updates.reloadAsync(),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
    } finally {
      setState((prev) => ({ ...prev, isChecking: false }));
    }
  };

  useEffect(() => {
    checkForUpdates();

    // Check periodically
    const interval = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    checkForUpdates,
  };
}
```

### Update Channels Strategy

```
Channels:
├── production     → App Store releases
├── preview        → TestFlight / Internal testing
└── development    → Development builds

Workflow:
1. Develop on development channel
2. Merge to staging → publish to preview channel
3. QA approval → publish to production channel
```

---

## Environment Variables in EAS

### Build-Time Variables

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging.api.example.com",
        "EXPO_PUBLIC_APP_ENV": "preview"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.example.com",
        "EXPO_PUBLIC_APP_ENV": "production"
      }
    }
  }
}
```

### Secrets (Sensitive Values)

```bash
# Set secret for project
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "your-token"

# Set secret for account (shared across projects)
eas secret:create --scope account --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json

# List secrets
eas secret:list

# Delete secret
eas secret:delete --name SENTRY_AUTH_TOKEN
```

### Using Secrets in Build

```json
{
  "build": {
    "production": {
      "env": {
        "SENTRY_AUTH_TOKEN": "@sentry-auth-token"
      }
    }
  }
}
```

---

## Version Management

### Auto Version Increment

```json
{
  "build": {
    "production": {
      "autoIncrement": "buildNumber"
    }
  }
}
```

| Value | iOS | Android | When to Use |
|-------|-----|---------|-------------|
| `buildNumber` | Increments `buildNumber` | Increments `versionCode` | Each build |
| `version` | Increments `version` | Increments `versionName` | Each release |

### Syncing Versions

```typescript
// app.config.ts
const APP_VERSION = "1.2.0";
const BUILD_NUMBER = 42;

export default {
  version: APP_VERSION,
  ios: {
    buildNumber: String(BUILD_NUMBER),
  },
  android: {
    versionCode: BUILD_NUMBER,
  },
};
```

### Remote Version Source

```json
{
  "cli": {
    "appVersionSource": "remote"
  }
}
```

This uses EAS to track versions instead of local config.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/eas-build.yml
name: EAS Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build Preview
        if: github.event_name == 'pull_request'
        run: eas build --profile preview --platform all --non-interactive

      - name: Build Production
        if: github.ref == 'refs/heads/main'
        run: eas build --profile production --platform all --non-interactive
```

### EAS Build Webhooks

```json
{
  "build": {
    "production": {
      "channel": "production"
    }
  }
}
```

Configure webhooks in Expo dashboard to notify on build completion.

---

## Debugging Builds

```bash
# View build logs
eas build:view [build-id]

# Download build artifacts
eas build:download --id [build-id]

# List recent builds
eas build:list

# Cancel running build
eas build:cancel [build-id]

# View build configuration
eas config --platform ios --profile production
```

---

## CLI Commands Reference

```bash
# Build
eas build --platform [ios|android|all] --profile [profile]
eas build:list
eas build:view [id]
eas build:cancel [id]
eas build:run --platform [platform] --id [id]

# Submit
eas submit --platform [ios|android] --id [build-id]

# Update
eas update --channel [channel] --message "description"
eas update:list
eas update:rollback --channel [channel]

# Credentials
eas credentials --platform [ios|android]
eas credentials:configure-build

# Secrets
eas secret:create --name [name] --value [value]
eas secret:list
eas secret:delete --name [name]

# Devices (iOS internal distribution)
eas device:create
eas device:list
eas device:delete [udid]

# Project
eas init
eas config --platform [platform] --profile [profile]
eas whoami
eas logout
```
