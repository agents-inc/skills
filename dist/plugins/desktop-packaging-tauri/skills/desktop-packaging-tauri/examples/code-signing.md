# Tauri Bundling - Code Signing

> macOS code signing and notarization, Windows code signing, CI/CD signing setup. See [SKILL.md](../SKILL.md) for decision frameworks. See [reference.md](../reference.md) for environment variable reference.

---

## macOS Code Signing

### Certificate Types

| Certificate                     | Distribution Method   | Notarization Required |
| ------------------------------- | --------------------- | --------------------- |
| Apple Distribution              | App Store             | No (Apple handles it) |
| Developer ID Application        | Direct download (DMG) | Yes                   |
| Ad-hoc (`signingIdentity: "-"`) | Development/testing   | No (Gatekeeper warns) |

### Local Setup

1. Create a Certificate Signing Request from Keychain Access
2. Upload CSR to Apple Developer > Certificates, IDs & Profiles
3. Download and install the `.cer` file
4. Find your signing identity:

```sh
security find-identity -v -p codesigning
```

5. Configure in `tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: My Company (TEAMID)"
    }
  }
}
```

Or set the `APPLE_SIGNING_IDENTITY` environment variable.

### Notarization Setup

Required when using Developer ID Application certificates (apps distributed outside the App Store).

**App Store Connect API (recommended for CI):**

```sh
export APPLE_API_ISSUER="issuer-uuid-from-app-store-connect"
export APPLE_API_KEY="key-id"
export APPLE_API_KEY_PATH="/path/to/AuthKey_KEYID.p8"
```

**Apple ID method (alternative):**

```sh
export APPLE_ID="developer@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

**Key points:**

- Generate an app-specific password at appleid.apple.com (not your Apple ID password)
- Team ID is found in Apple Developer > Membership
- App Store Connect API is preferred because it avoids 2FA issues in CI

### CI/CD Setup for macOS

Export your certificate as base64 for use in CI secrets:

```sh
# Export certificate from Keychain as .p12
# Then encode as base64
openssl base64 -A -in certificate.p12 -out certificate-base64.txt
```

Required CI secrets:

```yaml
# GitHub Actions secrets
APPLE_CERTIFICATE: <base64-encoded .p12 file>
APPLE_CERTIFICATE_PASSWORD: <password for .p12>
APPLE_SIGNING_IDENTITY: "Developer ID Application: My Company (TEAMID)"
APPLE_API_ISSUER: <App Store Connect API issuer>
APPLE_API_KEY: <API key ID>
APPLE_API_KEY_PATH: <path to .p8 key file>
```

The certificate is imported into a temporary keychain during the build. The `tauri-action` handles this automatically when the environment variables are set.

---

## Windows Code Signing

### Certificate Types

| Certificate Type            | SmartScreen Behavior             | Availability       |
| --------------------------- | -------------------------------- | ------------------ |
| EV (Extended Validation)    | Immediate reputation             | More expensive     |
| OV (Organization Validated) | Builds reputation over time      | Pre-June 2023 only |
| Azure Trusted Signing       | Immediate reputation             | Azure subscription |
| None                        | SmartScreen warning to all users | Free               |

### Method 1: Certificate Thumbprint (Local/CI)

1. Obtain a code signing certificate (not SSL) from a trusted CA
2. Convert to `.pfx` if needed:

```sh
openssl pkcs12 -export -in cert.cer -inkey private.key -out cert.pfx
```

3. Import into Windows certificate store and find the thumbprint via `certmgr.msc`
4. Configure in `tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "A1B2C3D4E5F6...",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.comodoca.com"
    }
  }
}
```

### Method 2: Custom Sign Command (Azure, relic)

For Azure Key Vault, Azure Trusted Signing, or other signing tools, use `signCommand`:

```json
{
  "bundle": {
    "windows": {
      "signCommand": "trusted-signing-cli -e https://wus2.codesigning.azure.net -a MyAccount -c MyProfile -d \"My App\" %1"
    }
  }
}
```

The `%1` placeholder is replaced with the file path to sign.

**Azure Trusted Signing setup:**

```sh
# Install the CLI tool
cargo install trusted-signing-cli

# Set Azure credentials
export AZURE_CLIENT_ID="..."
export AZURE_CLIENT_SECRET="..."
export AZURE_TENANT_ID="..."
```

### CI/CD Setup for Windows

```yaml
# GitHub Actions -- import certificate before build
- name: Import Windows certificate
  if: matrix.platform == 'windows-latest'
  env:
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
    WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: |
    $bytes = [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE)
    [IO.File]::WriteAllBytes("cert.pfx", $bytes)
    Import-PfxCertificate -FilePath cert.pfx -CertStoreLocation Cert:\CurrentUser\My -Password (ConvertTo-SecureString $env:WINDOWS_CERTIFICATE_PASSWORD -AsPlainText -Force)
    Remove-Item cert.pfx
```

**Key points:**

- The certificate must be in the Windows certificate store before building
- `timestampUrl` ensures the signature remains valid after the certificate expires
- EV certificates provide immediate SmartScreen trust; OV certificates build reputation over time

---

## Common Signing Pitfalls

- **macOS: "certificate not found"** -- The signing identity string must match exactly. Run `security find-identity -v -p codesigning` to verify.
- **macOS: notarization stuck** -- Notarization can take 5-60 minutes. The Tauri CLI waits automatically but CI may time out.
- **macOS: free account** -- Free Apple Developer accounts cannot notarize. A paid $99/year account is required.
- **macOS: private key lost** -- The private key download from Apple is only available once. Export from Keychain before it is lost.
- **Windows: "certificate not trusted"** -- The certificate must be from a CA trusted by Windows. Self-signed certificates will not work.
- **Windows: SmartScreen warning** -- New OV certificates have no reputation. Microsoft offers a manual review process, or use an EV certificate.
- **Timestamping:** Always configure a timestamp URL. Without it, signatures become invalid when the certificate expires.

---

See [core.md](core.md) for bundle configuration and [ci-cd.md](ci-cd.md) for the full GitHub Actions workflow.
