# EAS Credentials Patterns

> iOS provisioning, Android keystores, local credentials, and code signing. See [SKILL.md](../SKILL.md) for decisions and philosophy.

---

## Automatic Credential Management (Recommended)

EAS manages all signing credentials by default. On first build, it generates and stores:

- **iOS:** Distribution Certificate + Provisioning Profile
- **Android:** Upload keystore + key

```bash
# First build -- EAS prompts to generate credentials
eas build --profile production --platform ios
# "Would you like to let EAS manage your credentials? (Y/n)"
# Select Y -- EAS creates and stores everything

# Subsequent builds reuse stored credentials
eas build --profile production --platform ios
# No prompts -- credentials are already managed
```

### Team Collaboration

After credentials are generated, teammates with EAS dashboard access can build without Apple Developer Portal access:

```bash
# Teammate runs build -- uses remote credentials
eas build --profile preview --platform ios
# No Apple Developer login needed
```

### Credential Inspection

```bash
# View current credentials
eas credentials --platform ios
eas credentials --platform android

# Options:
# - View existing certificates/profiles
# - Generate new ones
# - Remove old ones
# - Switch between managed and local
```

---

## iOS Provisioning

### Distribution Types

| Type       | Use Case                   | Build Profile Setting              |
| ---------- | -------------------------- | ---------------------------------- |
| App Store  | App Store submission       | `distribution: "store"` (default)  |
| Ad Hoc     | Internal testing (devices) | `distribution: "internal"`         |
| Enterprise | Company-wide distribution  | Enterprise Apple Developer account |

### Device Registration for Ad Hoc

Internal distribution (preview builds) requires registering test devices:

```bash
# Register a device -- generates a URL for the device owner to visit
eas device:create

# List registered devices
eas device:list

# After adding new devices, rebuild to include them in provisioning profile
eas build --profile preview --platform ios
```

**Gotcha:** iOS provisioning profiles expire after 12 months. This doesn't affect apps already installed, but the next build will need a new profile. Run `eas credentials --platform ios` to regenerate.

### App Store Connect API Keys (CI)

For CI pipelines, use API keys to avoid 2FA prompts:

1. Generate a key in [App Store Connect > Users and Access > Integrations > App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. Download the `.p8` file
3. Store the key as an EAS Secret or in your CI's secret manager

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

---

## Android Keystore

### Upload Keystore (Play App Signing)

Google Play App Signing is the recommended approach. Google manages the app signing key; you use an upload key:

```bash
# EAS generates upload keystore on first build
eas build --profile production --platform android

# If you need to view or reset:
eas credentials --platform android
```

**Key distinction:**

- **App signing key:** Google manages this. Used to sign the APK/AAB delivered to users.
- **Upload key:** You (EAS) manage this. Used to sign uploads to Play Console. Can be reset if compromised.

### Keystore Backup

```bash
# Download your keystore from EAS (for backup)
eas credentials --platform android
# Select: "Download credentials from EAS servers"
```

**Store securely** -- if you lose the upload keystore and don't use Play App Signing, you cannot update your app on the Play Store.

---

## Local Credential Management

For enterprises or teams that must manage their own signing credentials:

### credentials.json

Create `credentials.json` at the app root (same level as `eas.json`):

```json
{
  "ios": {
    "provisioningProfilePath": "./certs/profile.mobileprovision",
    "distributionCertificate": {
      "path": "./certs/dist-cert.p12",
      "password": "DIST_CERT_PASSWORD"
    }
  },
  "android": {
    "keystore": {
      "keystorePath": "./certs/upload-keystore.jks",
      "keystorePassword": "KEYSTORE_PASSWORD",
      "keyAlias": "upload-key",
      "keyPassword": "KEY_PASSWORD"
    }
  }
}
```

### Enable Local Credentials in Build Profile

```json
{
  "build": {
    "production": {
      "credentialsSource": "local"
    }
  }
}
```

**Security rules:**

- Add `credentials.json` to `.gitignore`
- Store actual credential files outside of version control
- Use environment variables for passwords (reference via `$VARIABLE_NAME` syntax)
- In CI, download credentials from a secret manager before the build step

### Generating Local Credentials Manually

```bash
# iOS: Export from Apple Developer Portal or Keychain Access
# - Distribution Certificate (.p12)
# - Provisioning Profile (.mobileprovision)

# Android: Generate keystore
keytool -genkeypair -v \
  -storetype JKS \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -alias upload-key \
  -keystore upload-keystore.jks \
  -dname "CN=Your Name, OU=Your Org, O=Your Company, L=City, S=State, C=US"
```

---

## EXPO_TOKEN for CI Authentication

Authenticate EAS CLI in CI without interactive login:

```bash
# Generate token at https://expo.dev/accounts/[account]/settings/access-tokens
# Store as CI secret (GitHub Actions, CircleCI, etc.)

# CI pipeline uses token automatically
EXPO_TOKEN=your-token eas build --profile production --platform all --non-interactive
```

### GitHub Actions Example

```yaml
- name: Setup EAS
  uses: expo/expo-github-action@v8
  with:
    eas-version: latest
    token: ${{ secrets.EXPO_TOKEN }}

- name: Build
  run: eas build --profile production --platform all --non-interactive
```

The `EXPO_TOKEN` environment variable is read automatically by EAS CLI -- no `eas login` needed.
