# Electron Forge -- Code Signing

> macOS notarization, Windows Authenticode, Azure Trusted Signing, entitlements. See [SKILL.md](../SKILL.md) for decision frameworks. See [core.md](core.md) for forge.config.ts setup.

---

## macOS: Signing + Notarization

macOS requires two layers for distribution outside the Mac App Store:

1. **Code signing** -- certifies the app author's identity (requires Apple Developer Program certificate)
2. **Notarization** -- Apple's server-side malware scan (required since macOS 10.15 Catalina)

### Minimal Configuration

```typescript
// forge.config.ts
packagerConfig: {
  osxSign: {},  // empty object = use first valid signing identity from Keychain
  osxNotarize: {
    appleId: process.env.APPLE_ID!,
    appleIdPassword: process.env.APPLE_PASSWORD!,  // app-specific password
    teamId: process.env.APPLE_TEAM_ID!,
  },
},
```

**Prerequisite:** Install "Developer ID Application" certificate via Xcode. Verify with:

```bash
security find-identity -p codesigning -v
```

### Notarization Authentication Strategies

#### Option 1: App-Specific Password (simplest)

```typescript
osxNotarize: {
  appleId: process.env.APPLE_ID!,
  appleIdPassword: process.env.APPLE_PASSWORD!,  // NOT your Apple ID password
  teamId: process.env.APPLE_TEAM_ID!,
},
```

Generate the app-specific password at appleid.apple.com. If your Apple ID password changes, regenerate it.

#### Option 2: App Store Connect API Key (recommended for CI)

```typescript
osxNotarize: {
  appleApiKey: process.env.APPLE_API_KEY_PATH!,     // path to .p8 file
  appleApiKeyId: process.env.APPLE_API_KEY_ID!,     // 10-char alphanumeric
  appleApiIssuer: process.env.APPLE_API_ISSUER!,    // UUID
},
```

**Why for CI:** API keys do not expire and do not require 2FA -- ideal for headless environments.

#### Option 3: Keychain Profile (pre-stored credentials)

```typescript
osxNotarize: {
  keychainProfile: "my-app-notarize",
  // keychain: "/path/to/keychain" // optional -- auto-detected
},
```

Store credentials first: `xcrun notarytool store-credentials my-app-notarize`

### Custom Entitlements

Entitlements define which OS capabilities your app can access (camera, microphone, USB, etc.).

```typescript
osxSign: {
  optionsForFile: (filePath) => ({
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
  }),
},
```

```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
  </dict>
</plist>
```

**Why these entitlements:** Electron's Chromium engine requires JIT, unsigned executable memory, and dyld env vars to function under hardened runtime. The network client entitlement allows outbound HTTP requests.

---

## Windows: Authenticode Signing

### Traditional Certificate (.pfx)

```typescript
// Squirrel maker
new MakerSquirrel({
  certificateFile: process.env.WIN_CSC_LINK!,
  certificatePassword: process.env.WIN_CSC_KEY_PASSWORD!,
  setupIcon: "./assets/icon.ico",
}),

// WiX MSI maker -- same fields
new MakerWix({
  certificateFile: process.env.WIN_CSC_LINK!,
  certificatePassword: process.env.WIN_CSC_KEY_PASSWORD!,
}),
```

**Since June 2023:** Private keys must be stored on FIPS 140 Level 2 hardware (HSM or USB token). Software-only .pfx files are no longer accepted by certificate authorities for new purchases.

### Azure Trusted Signing (Modern Alternative)

Azure Trusted Signing is Microsoft's cloud-based code signing service. It eliminates SmartScreen warnings immediately (no reputation building required).

```typescript
// forge.config.ts
packagerConfig: {
  windowsSign: {
    signToolPath: process.env.SIGNTOOL_PATH!,
    certificateFile: process.env.AZURE_METADATA_JSON!,
    certificatePassword: "", // not used with Azure
    additionalCertificateFile: process.env.AZURE_CODE_SIGNING_DLIB!,
  },
},
```

**Requirements:**

- US or Canada-based organization with 3+ years verifiable history, OR individual US/Canada developer
- Azure subscription with Trusted Signing resource configured
- All paths in env vars must NOT contain spaces (signing fails silently)

### Certificate Types Comparison

| Type                     | SmartScreen                 | Cost       | Setup                     |
| ------------------------ | --------------------------- | ---------- | ------------------------- |
| Standard (OV)            | Builds reputation over time | ~$200/year | Buy from CA, install .pfx |
| Extended Validation (EV) | Immediate trust             | ~$400/year | HSM/USB token required    |
| Azure Trusted Signing    | Immediate trust             | ~$10/month | Azure subscription        |

---

## CI/CD Signing Secrets

Never commit signing credentials. Use CI/CD secret management:

```yaml
# GitHub Actions example -- secrets stored in repository settings
env:
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
  WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

**macOS CI caveat:** The signing certificate must be imported into the CI runner's Keychain. Use a setup step:

```yaml
- name: Import signing certificate
  env:
    CERTIFICATE_P12: ${{ secrets.MAC_CERTIFICATE_P12 }}
    CERTIFICATE_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
  run: |
    echo "$CERTIFICATE_P12" | base64 --decode > certificate.p12
    security create-keychain -p "" build.keychain
    security import certificate.p12 -k build.keychain -P "$CERTIFICATE_PASSWORD" -T /usr/bin/codesign
    security set-keychain-settings build.keychain
    security list-keychains -d user -s build.keychain login.keychain
    security set-key-partition-list -S apple-tool:,apple: -k "" build.keychain
```
