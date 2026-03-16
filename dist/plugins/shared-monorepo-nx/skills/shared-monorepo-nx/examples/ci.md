# Nx - CI & Release Management Examples

> Complete examples for CI pipeline setup, Nx Cloud remote caching, release management, and module federation. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) - Workspace structure, nx.json config
- [tasks.md](tasks.md) - Task pipelines, caching, affected commands
- [generators.md](generators.md) - Built-in and custom generators

---

## CI Pipeline Examples

### GitHub Actions with Affected Commands

```yaml
name: CI
on: [pull_request]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for affected detection

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      # Set SHAs for affected comparison
      - uses: nrwl/nx-set-shas@v4

      # Run only affected targets
      - run: npx nx affected -t lint test build --parallel=3
```

**Why good:** `fetch-depth: 0` provides full git history for affected analysis, `nrwl/nx-set-shas@v4` sets base/head SHAs correctly, `--parallel=3` runs up to 3 tasks concurrently

### GitHub Actions with Nx Cloud

```yaml
name: CI
on: [pull_request]

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - uses: nrwl/nx-set-shas@v4

      # Nx Cloud handles distribution automatically
      - run: npx nx affected -t lint test build e2e
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
```

**Why good:** Nx Cloud remote cache means tasks computed by other developers or previous CI runs are reused. No extra configuration needed beyond the token.

---

## Nx Cloud Remote Caching

### Setup

```json
{
  "nxCloudId": "your-cloud-id"
}
```

```bash
# Connect workspace to Nx Cloud
npx nx connect

# Verify remote cache is working
npx nx build my-app --verbose
# Second run should show "remote cache hit"
```

**Why good:** One-line setup, entire team shares cached results, CI builds reuse developer cache hits and vice versa

---

## Release Management Examples

### Fixed Release (All Packages Together)

```json
{
  "release": {
    "projects": ["libs/*"],
    "projectsRelationship": "fixed",
    "version": {
      "conventionalCommits": true
    },
    "changelog": {
      "workspaceChangelog": {
        "createRelease": "github",
        "file": "{workspaceRoot}/CHANGELOG.md"
      }
    },
    "git": {
      "commit": true,
      "tag": true
    }
  }
}
```

```bash
# Preview release
npx nx release --dry-run

# Execute release
npx nx release

# First release (skip changelog comparison)
npx nx release --first-release
```

### Independent Release (Per-Package Versioning)

```json
{
  "release": {
    "projects": ["libs/*"],
    "projectsRelationship": "independent",
    "version": {
      "conventionalCommits": true,
      "updateDependents": "always",
      "preserveMatchingDependencyRanges": true
    },
    "changelog": {
      "projectChangelogs": {
        "file": "{projectRoot}/CHANGELOG.md",
        "createRelease": "github"
      }
    },
    "releaseTag": {
      "pattern": "{projectName}-v{version}"
    },
    "git": {
      "commit": true,
      "tag": true
    }
  }
}
```

**Why good:** Each package versions independently, dependent packages get dependency bumps automatically (`updateDependents: "always"`), per-project changelogs and GitHub releases, clear tag naming (`shared-ui-v1.2.3`)

### Version Plans (File-Based Versioning)

```json
{
  "release": {
    "projects": ["libs/*"],
    "versionPlans": true,
    "version": {
      "conventionalCommits": false
    }
  }
}
```

```bash
# Developer creates a version plan when making changes
npx nx release plan minor -m "Add new Button variants"
# Creates .nx/version-plans/plan-abc123.md

# Release manager applies all pending version plans
npx nx release
```

**When to use:** Teams that want explicit control over version bumps rather than deriving from commit messages.

### Release Commands Reference

```bash
# Full release: version + changelog + publish
npx nx release

# Dry run to preview changes
npx nx release --dry-run

# First release (skip changelog diff)
npx nx release --first-release

# Individual phases
npx nx release version
npx nx release changelog
npx nx release publish

# Version plans
npx nx release plan minor -m "Add new API endpoints"
npx nx release plan patch -m "Fix button hover state"
```

---

## Module Federation Examples

### Setting Up Host + Remotes

```bash
# Create host application
npx nx g @nx/react:host shell --directory=apps/shell

# Create remote applications
npx nx g @nx/react:remote shop --directory=apps/shop --host=shell
npx nx g @nx/react:remote cart --directory=apps/cart --host=shell
```

### Host Configuration (module-federation.config.ts)

```typescript
// apps/shell/module-federation.config.ts
import type { ModuleFederationConfig } from "@nx/module-federation";

const config: ModuleFederationConfig = {
  name: "shell",
  remotes: ["shop", "cart"],
};

export default config;
```

### Dynamic Module Federation Manifest

```json
{
  "shop": "http://localhost:4201",
  "cart": "http://localhost:4202"
}
```

**Why good:** Remote URLs resolved at runtime, not hardcoded at build time. Host does not need to rebuild when remotes change. Enables independent deployment of micro-frontends.

### Serving the Full System

```bash
# Serve host with all remotes
npx nx serve shell --devRemotes=shop,cart

# Serve host with only one remote in dev mode (others use production builds)
npx nx serve shell --devRemotes=shop
```
