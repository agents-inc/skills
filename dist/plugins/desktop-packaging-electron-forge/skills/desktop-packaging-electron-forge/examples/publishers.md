# Electron Forge -- Publishers

> GitHub, S3, Snapcraft publishers and CI/CD cross-platform build patterns. See [SKILL.md](../SKILL.md) for decision frameworks. See [signing.md](signing.md) for code signing in CI.

---

## GitHub Publisher

Uploads make artifacts to GitHub Releases. The most common choice for open-source Electron apps.

```typescript
// forge.config.ts
publishers: [
  {
    name: "@electron-forge/publisher-github",
    config: {
      repository: {
        owner: "my-org",
        name: "my-app",
      },
      prerelease: false,
      draft: true, // create as draft -- review before publishing
    },
  },
],
```

**Authentication:** Set `GITHUB_TOKEN` environment variable with `contents: write` permission.

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxx electron-forge publish
```

**Key behavior:** If a release for the current `package.json` version already exists, Forge appends artifacts to it. This makes multi-platform CI builds work -- each runner uploads its platform's artifacts to the same release.

---

## S3 Publisher

Uploads artifacts to an Amazon S3 bucket. Useful for private distribution or custom update servers.

```typescript
publishers: [
  {
    name: "@electron-forge/publisher-s3",
    config: {
      bucket: "my-app-releases",
      folder: "releases", // key prefix -- artifacts at releases/{platform}/{arch}/{name}
      public: true,       // make objects publicly readable
      region: "us-east-1",
    },
  },
],
```

**Authentication:** Use AWS credentials via environment variables or shared credentials file (~/.aws/credentials). If not possible, pass `accessKeyId` and `secretAccessKey` in config (not recommended).

---

## Snapcraft Publisher

Publishes `.snap` artifacts to the Snap Store. Linux only -- requires `snapcraft` CLI installed.

```typescript
publishers: [
  {
    name: "@electron-forge/publisher-snapcraft",
    config: {
      release: "[latest/edge]", // channel: latest/{stable,candidate,beta,edge}
    },
  },
],
```

**Prerequisite:** Log in with `snapcraft login` before publishing. In CI, use `SNAPCRAFT_STORE_CREDENTIALS` env var.

---

## CI/CD Cross-Platform Build Matrix

Forge makers run only on the target OS. Cross-platform distribution requires per-platform CI runners.

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ["v*"]

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            args: --arch=x64,arm64
          - os: windows-latest
            args: ""
          - os: ubuntu-latest
            args: ""

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Import macOS signing certificate
        if: runner.os == 'macOS'
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

      - name: Make and publish
        run: npx electron-forge publish ${{ matrix.args }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

**Key points:**

- Each OS runner builds only its own platform's installers
- All three runners upload to the same GitHub Release (Forge appends artifacts)
- macOS runner must import the signing certificate into a temporary Keychain
- Use `--arch=x64,arm64` on macOS to build universal binaries
- Set notarization timeout in CI -- Apple's servers take 2-10 minutes per build
- Tag-triggered workflow ensures `publish` only runs on release tags

---

## Draft Release Workflow

A common pattern: CI creates a draft release, team reviews, then manually publishes.

1. Push a version tag: `git tag v1.2.0 && git push origin v1.2.0`
2. CI runs `electron-forge publish` on all three platforms
3. GitHub Release is created as draft (if `draft: true` in publisher config)
4. Team reviews release notes and artifacts
5. Click "Publish" on GitHub to make it live

**Alternative:** Use `prerelease: true` instead of `draft: true` for automatic publication to a "pre-release" channel that users can opt into.
