# Core EAS Patterns

> Build profiles, eas.json configuration, runtime versions, submit config, and monorepo setup. See [SKILL.md](../SKILL.md) for decisions and philosophy.

---

## Build Profiles

### Minimal eas.json

```json
{
  "cli": {
    "version": ">= 14.0.0"
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

### Complete eas.json with Profile Inheritance

```json
{
  "cli": {
    "version": ">= 14.0.0",
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
      "autoIncrement": "buildNumber",
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

**Why good:** `base` profile shares Node version and env config, `extends` eliminates duplication, `development-device` overrides only `simulator: false` from `development`, production uses `autoIncrement` and AAB

### Build Commands

```bash
# Development builds
eas build --profile development --platform ios        # iOS simulator
eas build --profile development --platform android    # Android APK
eas build --profile development-device --platform ios # iOS physical device

# Preview builds (internal distribution)
eas build --profile preview --platform all

# Production builds
eas build --profile production --platform all
eas build --profile production --platform all --auto-submit  # Build + submit

# Install on simulator/emulator after build completes
eas build:run --platform ios
eas build:run --platform android
```

---

## Runtime Versions

### Fingerprint Policy (Recommended for Most Projects)

```typescript
// app.config.ts
export default {
  runtimeVersion: {
    policy: "fingerprint",
  },
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
  },
};
```

**How fingerprint works:** Hashes all native dependencies, config plugins, and native code modifications. When the hash changes (new native module added, SDK version bumped), the runtime version changes automatically. OTA updates only deploy to builds with a matching fingerprint.

### AppVersion Policy (Simpler Projects)

```typescript
// app.config.ts
const APP_VERSION = "1.2.0";

export default {
  version: APP_VERSION,
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
  },
};
```

**How appVersion works:** Uses the `version` field from app config as the runtime version. You must manually bump `version` when making native changes.

### Custom Runtime Version (Full Control)

```typescript
// app.config.ts
export default {
  runtimeVersion: "2.0.0",
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
  },
};
```

**When to use:** When you need exact control and understand the consequences. You must manually update the string when native code changes.

---

## Submit Configuration

### iOS App Store

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABC123DEF"
      }
    }
  }
}
```

For CI (avoids 2FA prompts), use App Store Connect API keys:

```json
{
  "submit": {
    "production": {
      "ios": {
        "ascApiKeyPath": "./AuthKey_XXXXXXXXXX.p8",
        "ascApiKeyIssuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "ascApiKeyId": "XXXXXXXXXX"
      }
    }
  }
}
```

**Gotcha:** Store the `.p8` file path relative to `eas.json`. In CI, download the key from EAS Secrets or your secret manager before the submit step.

### Google Play

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

**Track options:**

| Track        | Purpose               |
| ------------ | --------------------- |
| `internal`   | Internal testers only |
| `alpha`      | Closed testing        |
| `beta`       | Open testing          |
| `production` | Public release        |

**Tip:** Start with `"track": "internal"` and promote through Play Console. Set `"releaseStatus": "draft"` to review before publishing.

### Staged Rollouts (Android)

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "production",
        "releaseStatus": "inProgress",
        "rollout": 0.1
      }
    }
  }
}
```

**How it works:** `rollout: 0.1` releases to 10% of users. Increase through Play Console as confidence grows.

---

## Environment Variables in Builds

### Non-Sensitive Variables (eas.json)

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

### Sensitive Variables (EAS Secrets)

```bash
# Create project-scoped secrets
eas secret:create --scope project --name MY_AUTH_TOKEN --value "tok_abc123"
eas secret:create --scope project --name MAPS_API_KEY --value "AIza..."

# Create account-scoped file secret (shared across projects)
eas secret:create --scope account --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

Secrets are automatically available as environment variables during builds -- no `eas.json` env configuration needed.

---

## Monorepo Setup

### Directory Structure

```
my-monorepo/
  apps/
    mobile/              <-- eas.json lives here
      eas.json
      app.config.ts
      package.json
    web/
  packages/
    shared/
    ui/
  package.json           <-- Monorepo root
  pnpm-workspace.yaml    <-- Or workspaces in package.json
```

### Running Builds

```bash
# ALWAYS run from the app directory
cd apps/mobile
eas build --profile preview --platform ios

# NOT from the monorepo root
# cd my-monorepo && eas build  <-- WRONG
```

### Monorepo Considerations

- EAS auto-detects your package manager and runs install from the monorepo root
- Lock file must be at the repository root (EAS looks there, not in the app dir)
- For pnpm, ensure `pnpm-workspace.yaml` exists at the repo root
- If shared packages need building before the app, add a `postinstall` script:

```json
{
  "scripts": {
    "postinstall": "cd ../.. && pnpm run build --filter=@myorg/shared"
  }
}
```

---

## Version Management

### Remote Version Source

```json
{
  "cli": {
    "appVersionSource": "remote"
  }
}
```

**How it works:** EAS tracks version numbers server-side. No need to update `app.config.ts` version fields manually. Requires a paid EAS plan.

### Manual Version Sync

```typescript
// app.config.ts
const APP_VERSION = "1.2.0";
const BUILD_NUMBER = 42;

export default {
  version: APP_VERSION,
  ios: {
    buildNumber: String(BUILD_NUMBER), // MUST be string for iOS
  },
  android: {
    versionCode: BUILD_NUMBER, // MUST be integer for Android
  },
};
```

**Key rules:**

- iOS `buildNumber` is a **string** -- always use `String()`
- Android `versionCode` is an **integer** -- never stringify
- Android `versionCode` must **strictly increase** for each Play Store upload
