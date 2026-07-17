# Tauri Bundling - CI/CD

> GitHub Actions cross-platform build workflow, matrix strategy, code signing in CI, updater artifact publishing. See [SKILL.md](../SKILL.md) for decision frameworks. See [code-signing.md](code-signing.md) for signing details.

---

## GitHub Actions Workflow

### Complete Cross-Platform Build

```yaml
name: "Build & Release"

on:
  workflow_dispatch:
  push:
    branches:
      - release

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: "macos-latest"
            args: "--target aarch64-apple-darwin"
          - platform: "macos-latest"
            args: "--target x86_64-apple-darwin"
          - platform: "ubuntu-22.04"
            args: ""
          - platform: "ubuntu-22.04-arm"
            args: ""
          - platform: "windows-latest"
            args: ""

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      # Install Linux dependencies
      - name: Install Linux dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf

      # Setup Node.js
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: "npm"

      # Setup Rust
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      # Cache Rust build artifacts
      - name: Cache Rust
        uses: swatinem/rust-cache@v2

      # Install frontend dependencies
      - name: Install dependencies
        run: npm ci

      # Import Windows certificate
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

      # Build and release
      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
          APPLE_API_KEY_PATH: ${{ secrets.APPLE_API_KEY_PATH }}
          # Updater signing
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: app-v__VERSION__
          releaseName: "App v__VERSION__"
          releaseBody: "See the assets to download and install this version."
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

### Key Workflow Details

**Matrix strategy:**

- `fail-fast: false` -- one platform failure does not cancel other builds
- macOS builds target both Intel and Apple Silicon separately
- Ubuntu 22.04 for Linux (22.04-arm for ARM64 builds)
- `tauri-action` handles the build, bundling, and release upload

**Platform dependencies:**

- Linux requires `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
- macOS and Windows have no additional system dependencies

**Secrets required:**

| Secret                               | Platform | Purpose                      |
| ------------------------------------ | -------- | ---------------------------- |
| `APPLE_CERTIFICATE`                  | macOS    | Base64-encoded `.p12`        |
| `APPLE_CERTIFICATE_PASSWORD`         | macOS    | `.p12` password              |
| `APPLE_SIGNING_IDENTITY`             | macOS    | Signing identity string      |
| `APPLE_API_ISSUER`                   | macOS    | Notarization API issuer      |
| `APPLE_API_KEY`                      | macOS    | Notarization API key ID      |
| `APPLE_API_KEY_PATH`                 | macOS    | Path to `.p8` key file       |
| `WINDOWS_CERTIFICATE`                | Windows  | Base64-encoded `.pfx`        |
| `WINDOWS_CERTIFICATE_PASSWORD`       | Windows  | `.pfx` password              |
| `TAURI_SIGNING_PRIVATE_KEY`          | All      | Ed25519 key for updater sigs |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | All      | Key password (optional)      |

---

## Tauri Action Configuration

### Common Options

```yaml
- uses: tauri-apps/tauri-action@v0
  with:
    # Release settings
    tagName: app-v__VERSION__ # __VERSION__ is replaced with app version
    releaseName: "App v__VERSION__"
    releaseBody: "Release notes here"
    releaseDraft: true # Create as draft (review before publishing)
    prerelease: false

    # Build settings
    args: "--target aarch64-apple-darwin" # Rust target
    tauriScript: "npx tauri" # Custom tauri command

    # Updater
    updaterJsonPreferNsis: true # Prefer NSIS over MSI for Windows
```

### macOS Universal Binary

To create a universal binary (Intel + Apple Silicon in one file), build both architectures and combine:

```yaml
matrix:
  include:
    - platform: "macos-latest"
      args: "--target universal-apple-darwin"
```

Or build separately and use `lipo`:

```yaml
- platform: "macos-latest"
  args: "--target aarch64-apple-darwin"
- platform: "macos-latest"
  args: "--target x86_64-apple-darwin"
```

---

## Separated Build and Bundle

For complex pipelines, split the build and bundle steps:

```yaml
# Step 1: Build without bundling
- name: Build binary
  run: npx tauri build --no-bundle

# Step 2: Bundle separately (can be a different job)
- name: Bundle
  run: npx tauri bundle
```

This is useful when you need to run additional steps between compilation and packaging (e.g., signing, testing the binary).

---

## Caching Strategy

```yaml
# Rust build cache (significant speedup)
- uses: swatinem/rust-cache@v2

# Node.js dependency cache
- uses: actions/setup-node@v4
  with:
    cache: "npm"
```

**Impact:** Rust caching reduces subsequent build times from 10-30 minutes to 2-5 minutes. Node.js caching saves 30-60 seconds on dependency installation.

---

## Common CI Pitfalls

- **macOS notarization timeout** -- Notarization can take 5-60 minutes. Ensure your CI job timeout is sufficient (default GitHub timeout is 6 hours).
- **ARM Linux builds** -- Use `ubuntu-22.04-arm` runners (available for public repos). Previous workarounds with emulation are no longer needed.
- **Missing Linux dependencies** -- `libwebkit2gtk-4.1-dev` is the critical one. Missing it produces cryptic Rust compile errors.
- **Certificate not found in Windows CI** -- The certificate import step must run before `tauri-action`. The PowerShell script imports into `Cert:\CurrentUser\My`.
- **`GITHUB_TOKEN` permissions** -- The job needs `contents: write` permission to create releases.
- **Version mismatch** -- `__VERSION__` in `tagName` is replaced with the version from `tauri.conf.json`. Ensure `tauri.conf.json` version matches your intended release.

---

See [code-signing.md](code-signing.md) for detailed signing setup and [updater.md](updater.md) for auto-updater configuration.
