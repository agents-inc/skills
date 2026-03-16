---
name: shared-monorepo-pnpm-workspaces
description: pnpm workspace protocol, filtering, catalogs, shared dependencies, publishing, and CI/CD for monorepo management
---

# pnpm Workspaces for Monorepo Management

> **Quick Guide:** pnpm 10.x workspaces for monorepo management. `pnpm-workspace.yaml` defines workspace packages. `workspace:*` protocol for internal linking. `catalog:` protocol for dependency version synchronization. `--filter` for targeted commands. Shared `tsconfig` and tooling config across packages. Changesets for versioning and publishing. Strict dependency isolation by default.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `workspace:*` protocol for ALL internal package dependencies -- never hardcode versions)**

**(You MUST use `--frozen-lockfile` in CI -- pnpm enables this by default in CI environments)**

**(You MUST define workspace packages in `pnpm-workspace.yaml` at the repository root)**

**(You MUST put pnpm-specific settings in `pnpm-workspace.yaml` -- NOT `.npmrc` (pnpm v10 change))**

**(You MUST use `catalog:` protocol when sharing dependency versions across 3+ packages)**

**(You MUST use `--filter` for targeted commands instead of `pnpm -r` when only specific packages changed)**

</critical_requirements>

---

**Auto-detection:** pnpm-workspace.yaml, pnpm workspaces, workspace protocol, workspace:\*, catalog:, pnpm filter, pnpm recursive, pnpm monorepo, pnpm-lock.yaml, .npmrc pnpm, pnpm catalogs, pnpm publish

**When to use:**

- Setting up a monorepo with pnpm workspaces
- Configuring `pnpm-workspace.yaml` for workspace package discovery
- Linking internal packages with `workspace:*` protocol
- Synchronizing dependency versions with `catalog:` protocol
- Running scripts across workspaces with `--filter` or `-r`
- Publishing packages from a pnpm workspace
- Setting up CI/CD pipelines with pnpm caching
- Sharing TypeScript, ESLint, or Prettier config across workspace packages
- Migrating from npm/yarn workspaces to pnpm

**When NOT to use:**

- Single-package projects with no shared code
- Projects using Bun or Yarn as their package manager
- Projects that need npm compatibility exclusively (e.g., npm workspaces)
- Task orchestration logic (use Turborepo or Nx on top of pnpm)

**Key patterns covered:**

- `pnpm-workspace.yaml` setup and workspace package discovery
- Workspace protocol (`workspace:*`, `workspace:^`, `workspace:~`)
- Catalogs for dependency version synchronization
- Filtering commands (`--filter`, `-F`, glob patterns, dependency selectors)
- Running scripts across workspaces (`-r`, `--parallel`, `--workspace-concurrency`)
- Settings in `pnpm-workspace.yaml` (v10: settings moved from `.npmrc`)
- Publishing with `publishConfig` and changesets
- CI/CD with GitHub Actions, caching, and `--frozen-lockfile`
- Shared TypeScript configuration patterns
- Monorepo directory structure conventions

**Detailed resources:**

- For practical code examples, see [examples/pnpm-workspaces.md](examples/pnpm-workspaces.md)
- For quick command reference, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

pnpm workspaces provide strict, efficient monorepo management with content-addressable storage. Unlike npm/yarn, pnpm creates a non-flat `node_modules` where packages can only access their declared dependencies -- this strictness catches missing dependency declarations early. The workspace protocol (`workspace:*`) ensures internal packages always link locally, while catalogs (`catalog:`) centralize version management to eliminate version drift.

**Core principles:**

- **Strict by default** -- packages cannot access undeclared dependencies
- **Disk efficient** -- content-addressable store shares identical files across projects
- **Security first** -- v10 blocks lifecycle scripts by default to prevent supply chain attacks
- **Single lockfile** -- one `pnpm-lock.yaml` at the workspace root for all packages

**When to use pnpm workspaces:**

- Monorepos with multiple apps and shared packages
- Projects that need strict dependency isolation
- Teams that want disk-efficient dependency storage
- Publishing multiple related npm packages from one repo

**When NOT to use:**

- Single-package projects (no workspace benefits)
- Projects deeply invested in Yarn PnP or Berry features
- Environments where only npm is available (some CI/CD, restricted corporate setups)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Workspace Configuration (`pnpm-workspace.yaml`)

The `pnpm-workspace.yaml` file at the repository root defines which directories contain workspace packages. Every pnpm workspace MUST have this file.

#### Basic Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

**Why good:** Glob patterns (`apps/*`, `packages/*`) auto-discover all packages in those directories, clean separation between apps, shared packages, and tooling

#### v10 Settings Migration

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

### Pattern 2: Workspace Protocol (`workspace:*`)

The workspace protocol ensures internal packages always resolve to the local workspace version, never from the registry.

#### Protocol Variants

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/types": "workspace:^",
    "@repo/config": "workspace:~"
  }
}
```

| Protocol      | During Development     | After `pnpm publish`                        |
| ------------- | ---------------------- | ------------------------------------------- |
| `workspace:*` | Links to local package | Replaced with exact version (e.g., `1.5.0`) |
| `workspace:^` | Links to local package | Replaced with caret range (e.g., `^1.5.0`)  |
| `workspace:~` | Links to local package | Replaced with tilde range (e.g., `~1.5.0`)  |

#### Good Example

```json
{
  "name": "@repo/web-app",
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/types": "workspace:*",
    "@repo/api-client": "workspace:*"
  }
}
```

**Why good:** `workspace:*` guarantees local linking, pnpm refuses to resolve externally, version conversion on publish ensures correct semver for consumers

#### Bad Example

```json
{
  "name": "@repo/web-app",
  "dependencies": {
    "@repo/ui": "^1.0.0",
    "@repo/types": "1.2.3"
  }
}
```

**Why bad:** Hardcoded versions may install from npm registry instead of local workspace, version mismatches across packages, manual version bumps required on every change

#### Aliasing

```json
{
  "dependencies": {
    "ui-v2": "workspace:@repo/ui@*"
  }
}
```

**When to use:** Migrating between package versions in the same workspace, running two versions of an internal package side by side

---

### Pattern 3: Catalogs for Version Synchronization

Catalogs let you define dependency versions once in `pnpm-workspace.yaml` and reference them across all packages with `catalog:`. This eliminates version drift and reduces merge conflicts.

#### Defining Catalogs

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"

# Default catalog (referenced with "catalog:" or "catalog:default")
catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.7.0
  vitest: ^3.0.0
  zod: ^3.24.0

# Named catalogs (referenced with "catalog:<name>")
catalogs:
  react18:
    react: ^18.3.1
    react-dom: ^18.3.1
  react19:
    react: ^19.0.0
    react-dom: ^19.0.0
```

#### Using Catalogs in package.json

```json
{
  "name": "@repo/web-app",
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

**Why good:** Single version source of truth, updating one line in `pnpm-workspace.yaml` updates all packages, eliminates merge conflicts in `package.json` files, `catalog:` resolves to actual versions on publish

#### Named Catalog Usage

```json
{
  "name": "@repo/legacy-app",
  "dependencies": {
    "react": "catalog:react18",
    "react-dom": "catalog:react18"
  }
}
```

**When to use:** Migrating between major versions, different apps need different major versions of the same dependency

#### Bad Example

```json
{
  "name": "@repo/app-a",
  "dependencies": { "react": "^19.0.0" }
}
// In another package:
{
  "name": "@repo/app-b",
  "dependencies": { "react": "^18.3.1" }
}
```

**Why bad:** Version drift between packages, merge conflicts when updating versions, no single source of truth, easy to have incompatible versions

#### Catalog Settings

```yaml
# pnpm-workspace.yaml
# Enforce catalog usage
catalogMode: strict # Only catalog versions allowed
# catalogMode: prefer  # Use catalog if available, fallback allowed
# catalogMode: manual  # Default -- no automatic catalog enforcement

# Auto-remove unused catalog entries on install
cleanupUnusedCatalogs: true
```

---

### Pattern 4: Filtering Commands

`--filter` (or `-F`) restricts commands to specific packages instead of running across the entire workspace. This is critical for CI performance.

#### Package Name Matching

```bash
# Exact package name
pnpm --filter @repo/web-app build

# Glob pattern
pnpm --filter "@repo/*" build

# Short form
pnpm -F @repo/web-app dev
```

#### Dependency and Dependent Selection

```bash
# Package and ALL its dependencies (transitive)
pnpm --filter "web-app..." build

# Only dependencies of a package (excludes the package itself)
pnpm --filter "web-app^..." build

# Package and ALL its dependents (what depends on it)
pnpm --filter "...@repo/ui" build

# Only dependents (excludes the package itself)
pnpm --filter "...^@repo/ui" build
```

#### Directory and Change-Based Filtering

```bash
# All packages in a directory
pnpm --filter "./packages/**" test

# All packages changed since a git ref
pnpm --filter "...[origin/main]" test

# Changed packages and their dependents
pnpm --filter "...[origin/main]..." build

# Exclude a package
pnpm --filter "!@repo/docs" build
```

**Why good:** Targeted execution saves CI time, dependency-aware filtering ensures correct build order, change-based filtering only rebuilds what changed

#### Bad Example

```bash
# Running everything when only one package changed
pnpm -r build
```

**Why bad:** Wastes CI time rebuilding all packages, no dependency awareness for order, no change detection

---

### Pattern 5: Running Scripts Across Workspaces

pnpm provides several ways to execute scripts across workspace packages with different ordering and concurrency strategies.

#### Recursive Execution

```bash
# Run build in all packages (topological order -- respects dependency graph)
pnpm -r build

# Run in all packages including the root
pnpm -r --include-workspace-root build

# Run tests in parallel (ignores dependency graph)
pnpm -r --parallel test

# Control concurrency (4 packages at a time, topological order)
pnpm -r --workspace-concurrency 4 build
```

#### Topological vs Parallel

```bash
# CORRECT: Build in dependency order (packages build before their dependents)
pnpm -r build

# CORRECT: Tests can run in parallel (no build artifact dependencies)
pnpm -r --parallel test

# CORRECT: Lint can run in parallel (no cross-package dependencies)
pnpm -r --parallel lint
```

```bash
# BAD: Building in parallel when packages depend on each other
pnpm -r --parallel build
```

**Why bad:** Packages that depend on other packages may start building before their dependencies finish, causing build failures with missing modules

#### Adding Dependencies Across Workspaces

```bash
# Add a dependency to a specific package
pnpm --filter @repo/web-app add zod

# Add a dev dependency to the workspace root
pnpm add -Dw vitest

# Add a workspace package as a dependency
pnpm --filter @repo/web-app add @repo/ui --workspace
```

---

### Pattern 6: Monorepo Directory Structure

A well-organized pnpm workspace follows consistent conventions for apps, packages, and shared configuration.

#### Recommended Structure

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

#### Root package.json

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

### Pattern 7: Shared TypeScript Configuration

Share TypeScript compiler options across all workspace packages using a configuration package.

#### Configuration Package

```json
{
  "name": "@repo/config-typescript",
  "private": true,
  "exports": {
    "./base": "./tsconfig.base.json",
    "./react": "./tsconfig.react.json",
    "./node": "./tsconfig.node.json"
  }
}
```

#### Base tsconfig

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

#### React tsconfig

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"]
  }
}
```

#### Consumer Package tsconfig

```json
{
  "extends": "@repo/config-typescript/react",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

**Why good:** Single source of truth for TypeScript settings, changes propagate to all packages, consistent compilation across the monorepo, packages can pick the right config variant (base, react, node)

---

### Pattern 8: Publishing from Workspaces

When publishing packages from a pnpm workspace, use `publishConfig` to control what gets published and changesets to manage versioning.

#### publishConfig

```json
{
  "name": "@repo/ui",
  "version": "1.0.0",
  "private": false,
  "main": "./src/index.ts",
  "publishConfig": {
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js"
      }
    },
    "access": "public"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts"
  }
}
```

**Why good:** `main` points to source during development (fast HMR), `publishConfig.main` points to built output on publish, `access: public` required for scoped packages on npm

#### Changesets Workflow

```bash
# 1. Install changesets
pnpm add -Dw @changesets/cli

# 2. Initialize
pnpm changeset init

# 3. Create a changeset (interactive prompt)
pnpm changeset

# 4. Version packages (bumps versions + generates changelogs)
pnpm changeset version

# 5. Update lockfile after version bumps
pnpm install

# 6. Publish to registry
pnpm publish -r
```

**When to use:** Publishing packages to npm, managing versioning across multiple packages, generating changelogs automatically

---

### Pattern 9: CI/CD with GitHub Actions

Set up efficient CI for pnpm workspaces with caching and frozen lockfile.

#### GitHub Actions Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for change detection

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install # --frozen-lockfile is default in CI

      - name: Build affected packages
        run: pnpm --filter "...[origin/main]" build

      - name: Test affected packages
        run: pnpm --filter "...[origin/main]" test

      - name: Lint all packages
        run: pnpm -r --parallel lint
```

**Why good:** `pnpm/action-setup@v4` handles pnpm installation, `cache: "pnpm"` in setup-node caches the store, `--frozen-lockfile` is automatic in CI (prevents lockfile mutations), `--filter "...[origin/main]"` only builds/tests changed packages, `fetch-depth: 0` enables git-based change detection

#### Changesets Publish Workflow

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm run release
          version: pnpm changeset version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

### Pattern 10: Workspace Settings Reference

Key settings for `pnpm-workspace.yaml` (pnpm v10+) that control workspace behavior.

#### Dependency Resolution

```yaml
# pnpm-workspace.yaml
linkWorkspacePackages: true # Link local packages instead of downloading
saveWorkspaceProtocol: rolling # Auto-save workspace: protocol ("rolling" | "fixed" | false)
preferWorkspacePackages: false # Prefer workspace packages over registry
disallowWorkspaceCycles: true # Fail install if circular dependencies detected
```

#### Hoisting

```yaml
# pnpm-workspace.yaml
shamefullyHoist: false # Do NOT hoist everything to root (strict by default)
hoistPattern:
  - "*" # Hoist to .pnpm/node_modules (hidden)
publicHoistPattern: [] # Nothing hoisted to root node_modules
hoistWorkspacePackages: true # Symlink workspace packages based on hoist config
```

#### Injection (Hard Links)

```yaml
# pnpm-workspace.yaml
injectWorkspacePackages: true # Hard-link workspace deps (instead of symlink)
# Required for: pnpm deploy, Docker builds, bundler compatibility
```

**When to use:** `injectWorkspacePackages: true` is required for `pnpm deploy` and recommended when bundlers have issues with symlinked workspace packages

#### Security (v10 Defaults)

```yaml
# pnpm-workspace.yaml
# pnpm v10 blocks lifecycle scripts by default
onlyBuiltDependencies:
  - esbuild # Allowlist packages that can run install scripts
  - sharp
  - better-sqlite3
```

**Why good:** Supply chain attack prevention, only explicitly trusted packages can run install scripts

</patterns>

---

<performance>

## Performance Optimization

**Install Performance:**

- pnpm uses content-addressable storage -- identical files are stored once on disk
- Warm installs are up to 2x faster than npm/yarn due to hard linking
- `--frozen-lockfile` (default in CI) skips resolution for fastest installs

**Workspace Performance:**

- Use `--filter` to run commands only on affected packages
- Use `--parallel` for tasks without cross-package dependencies (test, lint)
- Use `--workspace-concurrency` to control parallelism on resource-constrained CI
- Change-based filtering (`--filter "...[origin/main]"`) skips unchanged packages

**Disk Savings:**

- Global store deduplicates across projects (`pnpm store path`)
- Enable `enableGlobalVirtualStore: true` (v10.12+) to share store across all projects on disk
- Typical savings: 50-70% less disk space compared to npm

**CI Caching:**

```yaml
# Cache pnpm store in GitHub Actions
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: "pnpm"
```

This caches the pnpm content-addressable store between runs, making subsequent installs near-instant.

</performance>

---

<decision_framework>

## Decision Framework

### When to Use Catalogs vs Direct Versions

```
Does 3+ packages use this dependency?
  YES -> Use catalog: protocol
  NO  -> Direct version is fine

Will this dependency version be updated frequently?
  YES -> Use catalog: (one-line update)
  NO  -> Direct version is acceptable

Are you publishing packages to npm?
  YES -> catalog: is auto-replaced on publish (safe)
  NO  -> catalog: works transparently
```

### workspace:\* vs workspace:^ vs workspace:~

```
Are you publishing packages to npm?
  NO  -> Use workspace:* (exact local linking, version irrelevant)
  YES -> Do consumers need flexible version ranges?
    YES -> workspace:^ (caret range on publish)
    NO  -> workspace:* (exact version on publish)
```

### When to Use --filter vs -r

```
Running a command in CI?
  YES -> Use --filter "...[origin/main]" (only affected packages)
  NO  -> Running locally?
    ALL packages -> pnpm -r <cmd>
    ONE package  -> pnpm --filter <name> <cmd>

Is the command order-dependent (build)?
  YES -> Use -r (topological order) or --filter with ...
  NO  -> Use --parallel for speed (lint, test)
```

### pnpm vs npm vs Yarn Workspaces

```
Need strict dependency isolation?
  YES -> pnpm (non-flat node_modules by default)
  NO  -> Any works

Need disk efficiency?
  YES -> pnpm (content-addressable store)
  NO  -> Any works

Need zero-config PnP (no node_modules)?
  YES -> Yarn Berry with PnP
  NO  -> pnpm or npm

Need broadest tool compatibility?
  YES -> npm (always available, widest support)
  NO  -> pnpm (better DX and performance)
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Turborepo**: pnpm workspaces + Turborepo for task orchestration, caching, and remote cache sharing
- **Nx**: Alternative orchestration layer with computation caching and affected detection
- **Changesets**: Versioning and publishing automation for pnpm workspaces
- **TypeScript Project References**: Combine with `tsconfig.json` `references` for incremental builds
- **Docker**: Use `pnpm deploy` with `injectWorkspacePackages: true` for production images
- **Vercel / Netlify**: Native pnpm support with automatic workspace detection

**Replaces / Conflicts with:**

- **npm workspaces**: pnpm provides stricter dependency isolation and better disk efficiency
- **Yarn workspaces**: pnpm offers similar features without Yarn Berry's PnP complexity
- **Lerna (standalone)**: pnpm workspaces + changesets replace Lerna's core functionality

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Hardcoded versions for internal packages instead of `workspace:*` (breaks local linking, installs from registry)
- Settings in `.npmrc` that should be in `pnpm-workspace.yaml` (silently ignored in pnpm v10)
- Missing `pnpm-workspace.yaml` at repo root (pnpm will not recognize workspace packages)
- Running `pnpm install` without `--frozen-lockfile` in CI (lockfile can mutate silently)
- Using `--parallel` for build commands when packages depend on each other (race conditions)

**Medium Priority Issues:**

- Not using `catalog:` when 3+ packages share the same dependency version (version drift)
- Running `pnpm -r build` in CI instead of `--filter "...[origin/main]"` (wastes time)
- Missing `private: true` on internal packages (risk of accidental npm publish)
- Not configuring `onlyBuiltDependencies` allowlist (blocks all install scripts in v10)

**Common Mistakes:**

- Mixing package managers (npm install in a pnpm workspace breaks the lockfile)
- Using `shamefullyHoist: true` as a quick fix instead of declaring missing dependencies properly
- Forgetting `fetch-depth: 0` in GitHub Actions checkout (breaks git-based change detection)
- Running different pnpm versions locally vs CI (lockfile format incompatibility)

**Gotchas & Edge Cases:**

- `workspace:*` is replaced with the actual version on `pnpm publish` -- this is expected behavior, not a bug
- `catalog:` entries must match the dependency name exactly -- typos silently fall through
- `--filter "...[origin/main]"` requires git history -- use `fetch-depth: 0` or at minimum `fetch-depth: 2`
- pnpm v10 blocks ALL lifecycle scripts by default -- you must allowlist packages that need `postinstall` (like `esbuild`, `sharp`)
- `injectWorkspacePackages: true` is required for `pnpm deploy` to work correctly
- Circular workspace dependencies cause unpredictable script execution order -- use `disallowWorkspaceCycles: true`
- `saveWorkspaceProtocol: rolling` (default) means `pnpm add` auto-saves with `workspace:` -- this is correct behavior

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `workspace:*` protocol for ALL internal package dependencies -- never hardcode versions)**

**(You MUST use `--frozen-lockfile` in CI -- pnpm enables this by default in CI environments)**

**(You MUST define workspace packages in `pnpm-workspace.yaml` at the repository root)**

**(You MUST put pnpm-specific settings in `pnpm-workspace.yaml` -- NOT `.npmrc` (pnpm v10 change))**

**(You MUST use `catalog:` protocol when sharing dependency versions across 3+ packages)**

**(You MUST use `--filter` for targeted commands instead of `pnpm -r` when only specific packages changed)**

**Failure to follow these rules will cause broken dependency resolution, version drift, missed CI caching, and security vulnerabilities.**

</critical_reminders>
