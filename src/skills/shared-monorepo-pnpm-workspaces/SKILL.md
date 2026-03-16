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
- Task orchestration logic (use a dedicated task runner on top of pnpm)

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

- [Core Setup](examples/core.md) -- pnpm-workspace.yaml, .npmrc, directory structure, settings
- [Shared Packages](examples/packages.md) -- workspace protocol, catalogs, TypeScript/ESLint config
- [Scripts & Filtering](examples/scripts.md) -- --filter, recursive execution, dependency management
- [Publishing & Versioning](examples/publishing.md) -- changesets, publishConfig, Docker
- [CI/CD Pipelines](examples/ci.md) -- GitHub Actions, automated release
- [Quick Command Reference](reference.md) -- condensed lookup table

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

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

In pnpm v10, settings moved from `.npmrc` to this file:

```yaml
# pnpm-workspace.yaml (v10+)
packages:
  - "apps/*"
  - "packages/*"

linkWorkspacePackages: true
saveWorkspaceProtocol: rolling
disallowWorkspaceCycles: true
```

**Why good:** Single source of truth for workspace definition and settings

See [examples/core.md](examples/core.md) for full workspace setup, directory structure, and all settings.

---

### Pattern 2: Workspace Protocol (`workspace:*`)

The workspace protocol ensures internal packages always resolve to the local workspace version, never from the registry.

| Protocol      | During Development     | After `pnpm publish`                        |
| ------------- | ---------------------- | ------------------------------------------- |
| `workspace:*` | Links to local package | Replaced with exact version (e.g., `1.5.0`) |
| `workspace:^` | Links to local package | Replaced with caret range (e.g., `^1.5.0`)  |
| `workspace:~` | Links to local package | Replaced with tilde range (e.g., `~1.5.0`)  |

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/types": "workspace:*"
  }
}
```

**Why good:** Guarantees local linking, pnpm refuses to resolve externally, version conversion on publish ensures correct semver

```json
{
  "dependencies": {
    "@repo/ui": "^1.0.0"
  }
}
```

**Why bad:** Hardcoded versions may install from npm registry instead of local workspace, version mismatches across packages

See [examples/packages.md](examples/packages.md) for protocol variants, aliasing, and internal package setup.

---

### Pattern 3: Catalogs for Version Synchronization

Catalogs define dependency versions once in `pnpm-workspace.yaml` and reference them across all packages with `catalog:`.

```yaml
# pnpm-workspace.yaml
catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.7.0
```

```json
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  }
}
```

**Why good:** Single version source of truth, updating one line updates all packages, eliminates merge conflicts

Named catalogs support version migration:

```yaml
catalogs:
  react18:
    react: ^18.3.1
  react19:
    react: ^19.0.0
```

See [examples/packages.md](examples/packages.md) for named catalogs, strict enforcement, and full examples.

---

### Pattern 4: Filtering Commands

`--filter` (or `-F`) restricts commands to specific packages instead of running across the entire workspace.

```bash
# Exact package
pnpm --filter @repo/web-app build

# Package and ALL its dependencies
pnpm --filter "web-app..." build

# Changed packages since main
pnpm --filter "...[origin/main]" test

# Exclude a package
pnpm --filter "!@repo/docs" build
```

**Why good:** Targeted execution saves CI time, dependency-aware filtering ensures correct build order

```bash
# BAD: Running everything when only one package changed
pnpm -r build
```

**Why bad:** Wastes CI time rebuilding all packages, no change detection

See [examples/scripts.md](examples/scripts.md) for all filter variants, CI-optimized patterns, and graph exploration.

---

### Pattern 5: Running Scripts Across Workspaces

```bash
# Topological order (respects dependency graph) -- use for build
pnpm -r build

# Parallel (ignores dependency graph) -- use for test, lint
pnpm -r --parallel test

# Controlled concurrency
pnpm -r --workspace-concurrency 4 build
```

```bash
# BAD: Building in parallel when packages depend on each other
pnpm -r --parallel build
```

**Why bad:** Packages may build before their dependencies finish, causing missing module failures

See [examples/scripts.md](examples/scripts.md) for dependency management and adding dependencies.

---

### Pattern 6: Shared TypeScript Configuration

Share TypeScript compiler options across all workspace packages using a configuration package.

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

Consumer usage:

```json
{
  "extends": "@repo/config-typescript/react",
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**Why good:** Single source of truth for TypeScript settings, changes propagate to all packages

See [examples/packages.md](examples/packages.md) for full base/react/node configs and ESLint sharing.

---

### Pattern 7: Publishing from Workspaces

Use `publishConfig` to control what gets published and changesets for versioning.

```json
{
  "name": "@repo/ui",
  "main": "./src/index.ts",
  "publishConfig": {
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "access": "public"
  }
}
```

**Why good:** Source during development (fast HMR), built output on publish

```bash
pnpm changeset          # Create changeset
pnpm changeset version  # Bump versions + changelogs
pnpm publish -r         # Publish to npm
```

See [examples/publishing.md](examples/publishing.md) for changesets config, Docker deployment, and migration.

---

### Pattern 8: CI/CD with GitHub Actions

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: "pnpm"
- run: pnpm install
- run: pnpm --filter "...[origin/main]" build
- run: pnpm --filter "...[origin/main]" test
```

**Why good:** `pnpm/action-setup@v4` handles installation, `cache: "pnpm"` caches the store, `--frozen-lockfile` is automatic in CI, change-based filtering only builds affected packages

See [examples/ci.md](examples/ci.md) for complete workflows including automated release with changesets.

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
- Typical savings: 50-70% less disk space compared to npm

**CI Caching:**

```yaml
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
```

</decision_framework>

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
- Not configuring `allowBuilds` (or the older `onlyBuiltDependencies`) allowlist (blocks all install scripts in v10)

**Common Mistakes:**

- Mixing package managers (npm install in a pnpm workspace breaks the lockfile)
- Using `shamefullyHoist: true` as a quick fix instead of declaring missing dependencies properly
- Forgetting `fetch-depth: 0` in GitHub Actions checkout (breaks git-based change detection)
- Running different pnpm versions locally vs CI (lockfile format incompatibility)

**Gotchas & Edge Cases:**

- `workspace:*` is replaced with the actual version on `pnpm publish` -- this is expected behavior, not a bug
- `catalog:` entries must match the dependency name exactly -- typos silently fall through
- `--filter "...[origin/main]"` requires git history -- use `fetch-depth: 0` or at minimum `fetch-depth: 2`
- pnpm v10 blocks ALL lifecycle scripts by default -- use `pnpm approve-builds` to allowlist packages that need `postinstall` (like `esbuild`, `sharp`), or configure `allowBuilds` in `pnpm-workspace.yaml`
- `injectWorkspacePackages: true` is required for `pnpm deploy` (or use `pnpm deploy --legacy` to bypass)
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
