# pnpm Workspaces -- Setup Examples

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
onlyBuiltDependencies:
  - esbuild
  - sharp
  - "@swc/core"
```

**Why good:** Single file defines workspace structure, dependency versions, and pnpm settings. `disallowWorkspaceCycles: true` catches circular dependencies at install time. `onlyBuiltDependencies` explicitly trusts only necessary packages.

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
    web/                    # Web application (Next.js, Vite, etc.)
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

---

## Workspace Settings Reference

Key settings for `pnpm-workspace.yaml` (pnpm v10+) that control workspace behavior.

### Dependency Resolution

```yaml
# pnpm-workspace.yaml
linkWorkspacePackages: true # Link local packages instead of downloading
saveWorkspaceProtocol: rolling # Auto-save workspace: protocol ("rolling" | "fixed" | false)
preferWorkspacePackages: false # Prefer workspace packages over registry
disallowWorkspaceCycles: true # Fail install if circular dependencies detected
```

### Hoisting

```yaml
# pnpm-workspace.yaml
shamefullyHoist: false # Do NOT hoist everything to root (strict by default)
hoistPattern:
  - "*" # Hoist to .pnpm/node_modules (hidden)
publicHoistPattern: [] # Nothing hoisted to root node_modules
hoistWorkspacePackages: true # Symlink workspace packages based on hoist config
```

### Injection (Hard Links)

```yaml
# pnpm-workspace.yaml
injectWorkspacePackages: true # Hard-link workspace deps (instead of symlink)
# Required for: pnpm deploy, Docker builds, bundler compatibility
```

**When to use:** `injectWorkspacePackages: true` is required for `pnpm deploy` and recommended when bundlers have issues with symlinked workspace packages

### Security (v10 Defaults)

```yaml
# pnpm-workspace.yaml
# pnpm v10 blocks lifecycle scripts by default
onlyBuiltDependencies:
  - esbuild # Allowlist packages that can run install scripts
  - sharp
  - better-sqlite3
```

**Why good:** Supply chain attack prevention, only explicitly trusted packages can run install scripts

### Catalogs

```yaml
# pnpm-workspace.yaml
catalogMode: strict # Only catalog versions allowed
# catalogMode: prefer  # Use catalog if available, fallback allowed
# catalogMode: manual  # Default -- no automatic catalog enforcement

# Auto-remove unused catalog entries on install
cleanupUnusedCatalogs: true
```
