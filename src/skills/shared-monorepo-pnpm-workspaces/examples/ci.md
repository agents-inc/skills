# pnpm Workspaces -- CI/CD Pipeline Examples

> GitHub Actions workflows for build, test, and automated release. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [setup.md](setup.md) -- Workspace initialization, pnpm-workspace.yaml, settings
- [packages.md](packages.md) -- Shared packages, TypeScript config, workspace protocol
- [scripts.md](scripts.md) -- Running scripts, filtering, dependency management
- [publishing.md](publishing.md) -- Changesets, versioning, publishing, Docker

---

## GitHub Actions: Build + Test

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - name: Install
        run: pnpm install

      - name: Typecheck
        run: pnpm -r --parallel typecheck

      - name: Lint
        run: pnpm -r --parallel lint

      - name: Build (affected only)
        run: pnpm --filter "...[origin/main]" build

      - name: Test (affected only)
        run: pnpm --filter "...[origin/main]" test
```

**Why good:** `pnpm/action-setup@v4` handles pnpm installation, `cache: "pnpm"` in setup-node caches the store, `--frozen-lockfile` is automatic in CI (prevents lockfile mutations), `--filter "...[origin/main]"` only builds/tests changed packages, `fetch-depth: 0` enables git-based change detection

---

## GitHub Actions: Automated Release with Changesets

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
          registry-url: "https://registry.npmjs.org"

      - name: Install
        run: pnpm install

      - name: Build
        run: pnpm -r build

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          version: pnpm changeset version
          publish: pnpm publish -r --access=public
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Why good:** `concurrency` prevents duplicate runs, `permissions` grants write access for PR creation, `changesets/action` auto-creates version bump PRs and publishes on merge, pnpm store is cached between runs
