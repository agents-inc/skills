# pnpm Workspaces -- Core Examples

> Workspace initialization and configuration examples. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [packages.md](packages.md) -- Shared packages, TypeScript config, workspace protocol
- [scripts.md](scripts.md) -- Running scripts, filtering, dependency management
- [publishing.md](publishing.md) -- Changesets, versioning, publishing
- [ci.md](ci.md) -- CI/CD pipelines, GitHub Actions, Docker

---

## Minimal Workspace

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@10.32.1",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r --parallel lint",
    "clean": "pnpm -r exec rm -rf dist node_modules"
  }
}
```

**Why good:** `private: true` prevents accidental root publish, `packageManager` field ensures consistent pnpm version, glob patterns auto-discover packages

---

## Full Workspace with Catalogs and Settings

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"

# Dependency version catalog
catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.7.0
  vitest: ^3.0.0
  zod: ^3.24.0
  "@changesets/cli": ^2.27.0

# Workspace settings (moved from .npmrc in v10)
linkWorkspacePackages: true
saveWorkspaceProtocol: rolling
disallowWorkspaceCycles: true
strictPeerDependencies: true

# Security: allowlist packages that can run install scripts
# Use allowBuilds (preferred) or onlyBuiltDependencies (legacy)
allowBuilds:
  esbuild: true
  sharp: true
  "@swc/core": true
```

**Why good:** Single file defines workspace structure, dependency versions, and pnpm settings. `disallowWorkspaceCycles: true` catches circular dependencies at install time. `allowBuilds` explicitly trusts only necessary packages to run install scripts.

---

## v10 Settings Migration

In pnpm v10, most settings moved from `.npmrc` to `pnpm-workspace.yaml`. Only auth and registry settings remain in `.npmrc`.

```yaml
# pnpm-workspace.yaml (pnpm v10+)
packages:
  - "apps/*"
  - "packages/*"

# Settings that were previously in .npmrc
linkWorkspacePackages: true
saveWorkspaceProtocol: rolling
shamefullyHoist: false
strictPeerDependencies: true
```

```ini
# .npmrc (pnpm v10+ -- ONLY auth and registry settings)
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
@myorg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**Why good:** Single source of truth for pnpm configuration, `.npmrc` only contains secrets and registry URLs, settings are version-controlled alongside workspace definition

```yaml
# BAD: Settings in .npmrc (pnpm v10+)
# These will be IGNORED by pnpm v10
# shamefully-hoist=true
# link-workspace-packages=true
```

**Why bad:** pnpm v10 no longer reads non-auth settings from `.npmrc`, settings are silently ignored leading to unexpected behavior

---

## Recommended Directory Structure

```
my-monorepo/
  apps/
    web/                    # Web application
      package.json
      tsconfig.json         # Extends shared config
    api/                    # API server
      package.json
      tsconfig.json
  packages/
    ui/                     # Shared UI components
      package.json
      tsconfig.json
      src/
        index.ts            # Barrel file with named exports
    types/                  # Shared TypeScript types
      package.json
      tsconfig.json
      src/
        index.ts
    config-typescript/      # Shared tsconfig base
      package.json
      tsconfig.base.json
      tsconfig.react.json
    config-eslint/          # Shared ESLint config
      package.json
      index.js
  pnpm-workspace.yaml      # Workspace definition + settings
  package.json              # Root package.json (workspace scripts)
  pnpm-lock.yaml            # Single lockfile for all packages
  .npmrc                    # Auth and registry settings only (v10+)
```

---

## Root package.json

```json
{
  "name": "my-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r --parallel lint",
    "clean": "pnpm -r exec rm -rf dist node_modules",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "catalog:",
    "typescript": "catalog:"
  }
}
```

**Why good:** Root scripts provide workspace-wide commands, `private: true` prevents accidental root publish, shared devDependencies hoisted to root reduce duplication

See [reference.md](../reference.md) for a complete settings lookup table.
