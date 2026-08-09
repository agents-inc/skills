# EAS Reference

> Decision frameworks, CLI commands, and version management. Reference from [SKILL.md](SKILL.md).

---

## Decision Frameworks

### Build Profile Selection

```
Which build profile?
|
+-> Local development testing?
|   +-> On simulator/emulator -> development (simulator: true)
|   +-> On physical device -> development-device (simulator: false)
|
+-> Testing with real team / QA?
|   +-> preview (distribution: "internal")
|
+-> App store submission?
|   +-> production (autoIncrement, distribution: "store")
|
+-> CI/CD builds?
    +-> PR builds -> preview
    +-> Main branch -> production
```

### Runtime Version Policy

```
Choosing runtimeVersion policy?
|
+-> App has native dependencies that change often?
|   +-> YES -> "fingerprint" (auto-detects native changes)
|   +-> NO  -> Continue...
|
+-> Simple app, minimal native dependencies?
|   +-> "appVersion" (tracks version field)
|
+-> Need exact control over compatibility?
|   +-> Custom string (e.g., "1.0.0")
|
+-> Default recommendation?
    +-> "fingerprint" for safety, "appVersion" for simplicity
```

### Channel Strategy

```
Which channel for this update?
|
+-> Development builds (testing locally)?
|   +-> development channel (or none)
|
+-> Internal testing / QA (preview builds)?
|   +-> preview channel
|
+-> App store releases?
|   +-> production channel
|
+-> Hotfix for production?
    +-> production channel (same as affected build)
```

### Credentials Source

```
How to manage signing credentials?
|
+-> First-time setup / small team?
|   +-> Automatic (let EAS manage everything)
|
+-> Enterprise with existing certificates?
|   +-> Local (credentials.json with own signing files)
|
+-> Team members need to build independently?
|   +-> Automatic (remote credentials shared via EAS)
|
+-> CI/CD pipeline?
    +-> Automatic (EXPO_TOKEN for auth, EAS manages signing)
```

---

## CLI Commands Quick Reference

### Build

```bash
eas build --profile [profile] --platform [ios|android|all]
eas build --profile production --platform all --auto-submit
eas build --profile production --platform all --non-interactive  # CI
eas build:list                     # List recent builds
eas build:view [id]                # View build details
eas build:run --platform [platform]  # Run built app on simulator/emulator
```

### Update (SDK 55+)

```bash
eas update --environment [development|preview|production] --message "description"
eas update:list                    # List published updates
eas update:rollback --channel [channel]  # Rollback to previous update
eas channel:edit [channel] --branch [branch]  # Remap channel to branch
eas channel:list                   # List channels
```

### Update (SDK 54 and earlier)

```bash
eas update --channel [channel] --message "description"
```

### Submit

```bash
eas submit --platform [ios|android]
eas submit --platform [platform] --id [build-id]  # Submit specific build
```

### Credentials and Secrets

```bash
eas credentials --platform [ios|android]  # Interactive management
eas device:create                  # Register iOS test device
eas device:list                    # List registered devices
eas secret:create --scope [project|account] --name [name] --value [value]
eas secret:create --scope account --name [name] --type file --value ./path
eas secret:list
eas secret:delete --name [name]
```

### Workflows

```bash
eas workflow:run [workflow-file]    # Trigger workflow manually
eas workflow:list                  # List workflow runs
```

---

## Version Management

### autoIncrement Options

| Value           | iOS Effect             | Android Effect         | When to Use                |
| --------------- | ---------------------- | ---------------------- | -------------------------- |
| `false`         | No change              | No change              | Manual version management  |
| `true`          | Increments buildNumber | Increments versionCode | Default auto-increment     |
| `"buildNumber"` | Increments buildNumber | Increments versionCode | Internal build tracking    |
| `"version"`     | Increments version     | Increments versionName | User-visible version bumps |

### appVersionSource

| Value      | Behavior                                | Plan Required |
| ---------- | --------------------------------------- | ------------- |
| `"local"`  | Reads version from app config (default) | Free          |
| `"remote"` | EAS tracks version server-side          | Paid          |

### Version Number Rules

- iOS `buildNumber`: Must be a **string** (e.g., `"42"`)
- Android `versionCode`: Must be an **integer** (e.g., `42`)
- Android versionCode must **strictly increase** for each Play Store upload
- iOS buildNumber must increase per App Store submission (per bundle ID)

---

## eas.json Schema Overview

```
eas.json
|
+-> cli
|   +-> version           # Minimum EAS CLI version
|   +-> appVersionSource  # "local" | "remote"
|
+-> build
|   +-> [profile-name]
|       +-> extends              # Inherit from another profile
|       +-> distribution         # "store" | "internal"
|       +-> developmentClient    # true for dev builds
|       +-> channel              # EAS Update channel
|       +-> environment          # "development" | "preview" | "production"
|       +-> env                  # Build-time environment variables
|       +-> node / yarn / pnpm / bun  # Tool versions
|       +-> autoIncrement        # Version bump strategy
|       +-> resourceClass        # "default" | "medium" | "large"
|       +-> credentialsSource    # "remote" | "local"
|       +-> prebuildCommand      # Custom prebuild override
|       +-> cache                # { disabled, key, paths }
|       +-> config               # Custom workflow file
|       +-> ios
|       |   +-> simulator        # true for simulator builds
|       |   +-> scheme           # Xcode scheme name
|       |   +-> buildConfiguration  # "Release" | "Debug"
|       |   +-> resourceClass    # Platform-specific machine size
|       |   +-> image            # Build environment image
|       +-> android
|           +-> buildType        # "app-bundle" | "apk"
|           +-> gradleCommand    # Custom Gradle task
|           +-> ndk              # Android NDK version
|           +-> resourceClass    # Platform-specific machine size
|           +-> image            # Build environment image
|
+-> submit
    +-> [profile-name]
        +-> ios
        |   +-> appleId          # Apple ID email
        |   +-> ascAppId         # App Store Connect ID
        |   +-> appleTeamId      # Developer Team ID
        |   +-> ascApiKeyPath    # API key for CI (avoids 2FA)
        |   +-> ascApiKeyIssuerId
        |   +-> ascApiKeyId
        +-> android
            +-> serviceAccountKeyPath  # Google service account JSON
            +-> track            # "internal" | "alpha" | "beta" | "production"
            +-> releaseStatus    # "completed" | "draft" | "halted" | "inProgress"
            +-> rollout          # Fraction 0-1 for staged rollouts
```

---

## Anti-Patterns

> Summary red flags are in [SKILL.md](SKILL.md). These are detailed anti-patterns with explanations.

### Anti-Pattern 1: Secrets in Version Control

```json
{
  "build": {
    "production": {
      "env": {
        "MY_AUTH_TOKEN": "tok_abc123..."
      }
    }
  }
}
```

**Why wrong:** `eas.json` is committed to version control. Anyone with repo access sees the token.

**Fix:** Use EAS Secrets: `eas secret:create --scope project --name MY_AUTH_TOKEN --value "tok_abc123..."`. The secret is injected as an env var during build.

---

### Anti-Pattern 2: Missing Non-Interactive in CI

```yaml
# CI pipeline
- run: eas build --profile production --platform all
  # Hangs waiting for user input!
```

**Why wrong:** EAS CLI prompts for confirmations by default. CI has no stdin.

**Fix:** Always add `--non-interactive`:

```yaml
- run: eas build --profile production --platform all --non-interactive
```

---

### Anti-Pattern 3: APK for Production

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

**Why wrong:** Google Play requires Android App Bundles (AAB). APKs are for local testing / side-loading only.

**Fix:** Use `"app-bundle"` (default) or omit `buildType` entirely for production:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```
