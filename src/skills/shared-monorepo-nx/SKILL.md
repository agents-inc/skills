---
name: shared-monorepo-nx
description: Nx monorepo build system — workspace configuration, project graph, task pipelines, caching, generators, plugins, and release management
---

# Monorepo Orchestration with Nx

> **Quick Guide:** Nx 22 for monorepo orchestration and build intelligence. Project graph for dependency analysis. Task pipelines with topological ordering and `dependsOn`. Local computation caching + Nx Cloud remote caching for massive speed gains. Inferred tasks (Project Crystal) auto-detect targets from tool config files. `nx affected` runs only what changed. `nx release` for versioning, changelogs, and publishing. Generators scaffold code, executors run tasks.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST enable caching with `"cache": true` on cacheable targets — builds, tests, linting — and set `"cache": false` or omit for side-effect tasks like `serve`)**

**(You MUST define `dependsOn: ["^build"]` in targetDefaults for build tasks to ensure topological ordering across the project graph)**

**(You MUST declare `inputs` and `outputs` for cached targets so Nx knows what to hash and what to restore)**

**(You MUST use inferred tasks (Project Crystal) as the default — only add `project.json` targets when overriding inferred configuration)**

**(You MUST use `nx affected -t <target>` in CI to only run tasks for changed projects and their dependents)**

</critical_requirements>

---

**Auto-detection:** Nx workspace, nx.json, project.json, nx generate, nx affected, nx graph, nx release, @nx/ plugins, Nx Cloud, inferred tasks, Project Crystal, nx migrate, targetDefaults, namedInputs, nx run-many, nx serve

**When to use:**

- Setting up a new Nx monorepo or adding Nx to an existing repo
- Configuring task pipelines, caching, and dependency ordering in nx.json
- Generating projects, libraries, and components with Nx generators
- Running affected commands to optimize CI builds
- Configuring Nx Cloud for remote caching and distributed task execution
- Managing releases with `nx release` (versioning, changelogs, publishing)
- Setting up module federation for micro-frontend architectures
- Migrating between Nx versions with `nx migrate`

**When NOT to use:**

- Single application with no shared libraries (standard build tools suffice)
- Projects already using Turborepo (do not mix monorepo orchestrators)
- Very small projects where Nx setup overhead exceeds benefits
- When all you need is `npm workspaces` without task orchestration

**Key patterns covered:**

- Workspace setup and nx.json configuration
- Task pipelines with `targetDefaults` and `dependsOn`
- Local + remote caching strategies
- Inferred tasks (Project Crystal) and plugin system
- Affected commands and project graph
- Generators and executors
- Release management (`nx release`)
- Module federation for micro-frontends

**Detailed Resources:**

- For code examples, see [examples/nx.md](examples/nx.md) (always start here)
- For CLI reference and decision frameworks, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

Nx is a build intelligence platform for monorepos. Unlike simple task runners, Nx understands the structure of your codebase through the **project graph** — a directed acyclic graph of projects and their dependencies. This graph enables intelligent task scheduling, fine-grained caching, and affected analysis.

Nx's core value proposition: **never run a task that has already been computed, and never run more tasks than necessary.**

**Key principles:**

- **Project graph first** — Nx analyzes imports, configuration, and dependency relationships to build a graph of your workspace. Every feature (caching, affected, task pipelines) builds on this graph.
- **Inferred configuration** — Since Project Crystal (Nx 18+), plugins auto-detect tasks from tool configs (vite.config.ts, jest.config.ts, etc.), dramatically reducing boilerplate.
- **Computation caching** — Every task result is cached by default. Cache keys are computed from file inputs, environment, and dependency graph position.
- **Affected analysis** — `nx affected` uses git diff + project graph to determine the minimum set of projects impacted by a change.

**When to use Nx:**

- Monorepos with multiple apps sharing libraries
- Teams needing remote cache sharing across developers and CI
- Large codebases where build/test times are a bottleneck
- Projects with complex task dependency chains requiring topological ordering
- Organizations wanting enforced module boundaries between teams

**When NOT to use Nx:**

- Single-app projects with no shared code (Vite/esbuild directly)
- Polyrepo setups where repos are intentionally independent
- Projects already using Turborepo (pick one orchestrator)
- Prototypes or very small projects where setup cost exceeds benefit

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Workspace Setup and nx.json Configuration

The `nx.json` file is the central configuration for task behavior, caching, plugins, and workspace-wide defaults.

#### Minimal nx.json

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/.eslintrc.json"
    ],
    "sharedGlobals": ["{workspaceRoot}/.github/workflows/*"]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "test": {
      "inputs": ["default", "^production"],
      "cache": true
    },
    "lint": {
      "inputs": [
        "default",
        "{workspaceRoot}/.eslintrc.json",
        "{workspaceRoot}/eslint.config.js"
      ],
      "cache": true
    }
  },
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": { "buildTargetName": "build", "testTargetName": "test" }
    },
    {
      "plugin": "@nx/eslint/plugin",
      "options": { "targetName": "lint" }
    }
  ]
}
```

**Why good:** `namedInputs` define reusable file sets so test files do not invalidate build caches, `targetDefaults` set global task behavior (caching, ordering) without repeating per project, `dependsOn: ["^build"]` enforces topological build ordering, plugins with inferred tasks eliminate per-project `project.json` boilerplate

```json
{
  "targetDefaults": {
    "build": {
      "outputs": ["dist/**"]
    }
  }
}
```

**Why bad:** Missing `dependsOn` breaks topological ordering (packages may build before their dependencies), missing `inputs` means Nx cannot properly detect which changes invalidate the cache, missing `cache: true` disables caching entirely for this target, no `namedInputs` to exclude test files from build cache keys

---

### Pattern 2: Task Pipelines and Dependency Ordering

Task pipelines define execution order using the `dependsOn` property. The `^` prefix means "run this target on dependencies first" (topological ordering).

#### dependsOn Syntax

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "e2e": {
      "dependsOn": [
        {
          "target": "serve",
          "params": "ignore"
        }
      ]
    },
    "serve": {
      "continuous": true,
      "cache": false
    }
  }
}
```

**Why good:** `^build` runs dependency builds first (topological), `"dependsOn": ["build"]` runs same-project build before test, `continuous: true` marks long-running tasks (Nx 21+) so dependents do not wait for exit, `params: "ignore"` prevents parameter forwarding to dependencies

```json
{
  "targetDefaults": {
    "build": {},
    "test": {},
    "e2e": {
      "dependsOn": ["serve"]
    },
    "serve": {}
  }
}
```

**Why bad:** Build has no `dependsOn: ["^build"]` so dependency packages may not build first, test has no dependency on build so it may run against stale artifacts, serve is not marked `continuous: true` so e2e waits forever for it to exit, no caching configuration

---

### Pattern 3: Computation Caching (Local + Remote)

Nx caches task results locally by default. When inputs have not changed, cached outputs are restored instantly. Nx Cloud extends this with remote caching shared across the team.

#### Cache Configuration

```json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts"
    ],
    "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "outputs": [
        "{projectRoot}/dist",
        "{projectRoot}/.next/**",
        "!{projectRoot}/.next/cache/**"
      ],
      "cache": true
    },
    "test": {
      "inputs": [
        "default",
        "^production",
        { "externalDependencies": ["jest", "vitest"] }
      ],
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "cache": true
    },
    "serve": {
      "cache": false,
      "continuous": true
    }
  },
  "maxCacheSize": "10GB"
}
```

**Why good:** `production` input excludes test files so test changes do not invalidate build cache, `outputs` include build artifacts and exclude framework caches, `externalDependencies` ensures cache invalidates when test runner version changes, `cache: false` on serve prevents caching long-running dev servers, `maxCacheSize` prevents disk bloat

#### Nx Cloud Remote Caching

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

See [examples/nx.md](examples/nx.md) for cache configuration examples and CI integration.

---

### Pattern 4: Inferred Tasks (Project Crystal)

Since Nx 18, plugins automatically infer tasks from tool configuration files. For example, `@nx/vite/plugin` detects `vite.config.ts` and creates `build`, `serve`, and `test` targets without any `project.json` configuration.

#### Plugin Configuration

```json
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "serveTargetName": "serve",
        "testTargetName": "test"
      }
    },
    {
      "plugin": "@nx/jest/plugin",
      "include": ["packages/**/*"],
      "exclude": ["**/*-e2e/**/*"],
      "options": {
        "targetName": "test"
      }
    },
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ]
}
```

**Why good:** Zero-config task detection from existing tool configs, `include`/`exclude` scope plugins to specific projects, inferred caching/inputs/outputs are accurate because plugins understand the tool, consistent target naming across all projects

#### Overriding Inferred Tasks

When you need to customize an inferred target, add a `project.json` with only the overrides:

```json
{
  "name": "my-app",
  "targets": {
    "build": {
      "outputs": ["{projectRoot}/custom-dist"]
    }
  }
}
```

**Why good:** Only overrides specified, all other inferred properties preserved. Nx merges `project.json` targets with inferred targets (project-level takes precedence).

#### Configuration Precedence

```
1. Plugin inferred config (lowest priority)
2. targetDefaults in nx.json
3. project.json or package.json targets (highest priority)
```

**When to use:** Always prefer inferred tasks as default. Only add `project.json` targets when a project needs configuration that differs from the inferred defaults.

---

### Pattern 5: Affected Commands and Project Graph

`nx affected` uses git diff combined with the project graph to determine which projects need to be rebuilt/tested. This is the primary CI optimization.

#### Affected Commands

```bash
# Run tests only for affected projects
npx nx affected -t test

# Build only affected projects
npx nx affected -t build

# Run multiple targets on affected projects
npx nx affected -t build test lint

# Compare against specific base branch
npx nx affected -t test --base=origin/main --head=HEAD

# Visualize affected project graph
npx nx affected --graph
```

**Why good:** Only runs tasks for changed projects and their dependents, uses project graph for accurate dependency analysis, `--graph` flag visualizes impact for debugging

```bash
# BAD: Run all tests every time
npx nx run-many -t test
```

**Why bad:** Runs tests for every project regardless of changes, wastes CI time and compute on unchanged projects

**When to use:** Always in CI pipelines. Use `nx run-many` only for local development when you want to run everything.

---

### Pattern 6: Generators (Code Scaffolding)

Generators create and modify code from templates. Official plugins provide generators for apps, libraries, components, and more. Custom generators enforce organizational standards.

#### Using Built-in Generators

```bash
# Create a new React library
npx nx generate @nx/react:library my-lib --directory=packages/my-lib

# Create a new Next.js application
npx nx generate @nx/next:application my-app --directory=apps/my-app

# Create a new Node library
npx nx generate @nx/node:library my-api --directory=packages/my-api

# Move a project to a new location
npx nx generate @nx/workspace:move --project=my-lib --destination=packages/shared/my-lib

# Remove a project
npx nx generate @nx/workspace:remove my-lib
```

#### Generator Defaults in nx.json

```json
{
  "generators": {
    "@nx/react:library": {
      "bundler": "vite",
      "unitTestRunner": "vitest",
      "style": "scss"
    },
    "@nx/react:component": {
      "style": "scss"
    },
    "@nx/js:library": {
      "buildable": true,
      "publishable": false
    }
  }
}
```

**Why good:** Consistent defaults for all generated code, no need to pass flags every time, enforces organizational standards

See [examples/nx.md](examples/nx.md) for custom generator examples.

---

### Pattern 7: Release Management (nx release)

`nx release` orchestrates three phases: versioning, changelog generation, and publishing. Supports fixed (all packages same version) and independent (per-package versioning) strategies.

#### nx.json Release Configuration

```json
{
  "release": {
    "projects": ["packages/*"],
    "projectsRelationship": "independent",
    "version": {
      "conventionalCommits": true,
      "preserveMatchingDependencyRanges": true,
      "updateDependents": "always"
    },
    "changelog": {
      "workspaceChangelog": {
        "createRelease": "github",
        "file": "{workspaceRoot}/CHANGELOG.md"
      },
      "projectChangelogs": {
        "file": "{projectRoot}/CHANGELOG.md"
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

**Why good:** Conventional commits automate version bumps from commit messages, independent releases allow per-package versioning, GitHub releases created automatically, changelogs at both workspace and project level, git tags follow clear naming pattern

#### Release Commands

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

# Version plans (file-based versioning)
npx nx release plan minor -m "Add new API endpoints"
```

#### Version Plans (Alternative to Conventional Commits)

```json
{
  "release": {
    "version": {
      "conventionalCommits": false
    },
    "versionPlans": true
  }
}
```

```bash
# Create a version plan file
npx nx release plan patch -m "Fix button hover state"
# Creates .nx/version-plans/plan-123.md
# Apply when ready
npx nx release
```

**When to use:** Use conventional commits for automated CI releases. Use version plans when teams want to decouple "what changed" from "what version bump."

---

### Pattern 8: Module Federation (Micro-Frontends)

Nx provides first-class module federation support for React and Angular, enabling micro-frontend architectures where independent teams deploy separately.

#### Generating Module Federation Setup

```bash
# Create host application
npx nx generate @nx/react:host shell --directory=apps/shell

# Create remote application
npx nx generate @nx/react:remote shop --directory=apps/shop --host=shell

# Add another remote
npx nx generate @nx/react:remote cart --directory=apps/cart --host=shell
```

#### Host Configuration (module-federation.config.ts)

```typescript
// apps/shell/module-federation.config.ts
import type { ModuleFederationConfig } from "@nx/module-federation";

const config: ModuleFederationConfig = {
  name: "shell",
  remotes: ["shop", "cart"],
};

export default config;
```

#### Dynamic Module Federation

```typescript
// apps/shell/module-federation.manifest.json
{
  "shop": "http://localhost:4201",
  "cart": "http://localhost:4202"
}
```

**Why good:** Remotes resolved at runtime (not hardcoded at build time), enables independent deployment, host does not need to rebuild when remotes change

**When to use:** Large teams with independent deployment cadences. When to avoid: small teams where a single app suffices.

</patterns>

---

<performance>

## Performance Optimization

**Cache Hit Metrics (typical monorepo with 20+ projects):**

- First build: ~60s (no cache, full workspace)
- Cached build: ~1s (local cache hit, 98% faster)
- Affected build: ~15s (only changed projects, 75% faster)
- Remote cache hit: ~5s (download + restore from Nx Cloud)
- Team savings: 10-40 hours/week with Nx Cloud enabled

**Optimization Strategies:**

- **Use `namedInputs`** to exclude test/spec files from build cache keys. A test file change should not invalidate the build cache.
- **Set `outputs` precisely** to only cache what is needed. Exclude framework caches (e.g., `!{projectRoot}/.next/cache/**`).
- **Enable Nx Cloud** for remote caching. One developer's cache hit benefits the entire team.
- **Use `nx affected`** in CI to skip unchanged projects entirely.
- **Configure `parallel`** in nx.json to control concurrency (default is 3, increase for powerful CI machines).
- **Use `maxCacheSize`** to prevent unbounded cache growth (default: 10% of disk, max 10GB).

**Force Cache Bypass:**

```bash
# Skip cache for a specific run
npx nx build my-app --skip-nx-cache

# Clear all cached artifacts
npx nx reset
```

</performance>

---

<decision_framework>

## Decision Framework

### When to Use Nx

```
Is this a monorepo with shared code?
├─ NO → Standard build tools (Vite, esbuild, tsc)
└─ YES → Do you need task orchestration and caching?
    ├─ NO → npm/pnpm/bun workspaces alone may suffice
    └─ YES → Do you need a project graph and affected analysis?
        ├─ YES → Nx
        └─ NO → Turborepo may be simpler
```

### Nx vs Turborepo

```
Which monorepo tool?
├─ Need project graph analysis → Nx
├─ Need generators and code scaffolding → Nx
├─ Need module federation support → Nx
├─ Need distributed task execution (Nx Agents) → Nx
├─ Need simplest possible config → Turborepo
├─ Already using Vercel ecosystem → Turborepo
└─ Need polyglot support (.NET, Java, Gradle) → Nx
```

### Where to Put New Code

```
New code to write?
├─ Deployable application → apps/
├─ Shared across 2+ apps → libs/ or packages/
├─ App-specific code → Feature folder within the app
├─ Build tooling or generators → tools/
└─ Shared configuration → packages/ (e.g., eslint-config, tsconfig)
```

### Fixed vs Independent Releases

```
How to version packages?
├─ All packages always release together → "fixed" (default)
├─ Packages have different consumers → "independent"
├─ Internal-only packages → Fixed (simpler)
└─ Published to npm with different audiences → Independent
```

For comprehensive decision trees and anti-patterns, see [reference.md](reference.md).

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Package managers (npm, pnpm, Bun, Yarn)**: Nx works with any package manager's workspace feature for dependency linking
- **Vite**: `@nx/vite/plugin` infers build/serve/test targets from vite.config.ts
- **Jest / Vitest**: `@nx/jest/plugin` and `@nx/vite/plugin` infer test targets
- **ESLint**: `@nx/eslint/plugin` infers lint targets from eslint.config.js
- **Next.js**: `@nx/next` provides generators, executors, and module federation support
- **React**: `@nx/react` provides generators for apps, libraries, components, hooks
- **Angular**: `@nx/angular` provides full Angular CLI parity within Nx
- **Storybook**: `@nx/storybook` infers build-storybook and storybook targets
- **Playwright / Cypress**: `@nx/playwright` and `@nx/cypress` with test atomizer for distributed testing
- **Nx Cloud**: Remote caching (Nx Replay) and distributed task execution (Nx Agents)
- **Module Federation**: `@module-federation/enhanced` for micro-frontend architectures

**Replaces / Conflicts with:**

- **Turborepo**: Similar monorepo tool — choose one, not both
- **Lerna**: Nx subsumes Lerna's functionality (Nx team maintains Lerna since v6)
- **Rush**: Microsoft's monorepo tool — Nx provides broader plugin ecosystem

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing `dependsOn: ["^build"]` for build targets — dependencies may not build first, causing import errors
- Missing `cache: true` on cacheable targets — every run recomputes from scratch, negating Nx's primary value
- Caching long-running tasks (dev servers, watch mode) — `serve` and `dev` must have `cache: false`
- Running `nx run-many -t test` in CI instead of `nx affected -t test` — wastes compute on unchanged projects
- Missing `inputs` on cached targets — Nx cannot determine when cache is stale, leading to incorrect cache hits

**Medium Priority Issues:**

- Not using inferred tasks — manually defining every target in `project.json` when plugins can auto-detect
- Missing `namedInputs` for production — test file changes invalidate build caches unnecessarily
- Not connecting to Nx Cloud — every developer rebuilds everything locally instead of sharing cache
- Overly broad `outputs` — caching framework cache directories (`.next/cache/`) bloats cache storage

**Common Mistakes:**

- Using `dependsOn: ["build"]` (same project) when `dependsOn: ["^build"]` (dependency projects) was intended
- Forgetting to set `continuous: true` on serve tasks — dependent e2e tasks wait forever for serve to "complete"
- Running `nx migrate` without `--run-migrations` — migrations are generated but not applied
- Not setting `defaultBase` in nx.json — affected analysis defaults to `main` which may not be your branch

**Gotchas & Edge Cases:**

- `dependsOn: ["^task"]` runs the target on **dependency** projects; `dependsOn: ["task"]` runs it on the **same** project. Mixing these up causes subtle ordering bugs.
- `nx affected` requires git history — in CI, ensure `fetch-depth: 0` (full history) or at least `fetch-depth: 2` for shallow comparison.
- Plugin order in `nx.json` matters — when multiple plugins create the same target name, the last plugin wins.
- `maxCacheSize: "0"` means unlimited, not zero. To disable caching, use `cache: false` on targets.
- Nx merges `project.json` and `package.json` scripts. If both define the same target, `project.json` takes precedence for configuration but `package.json` scripts are still registered as targets.
- `nx reset` clears the local cache AND shuts down the Nx Daemon. Use `nx reset --only-cache` to preserve the daemon.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST enable caching with `"cache": true` on cacheable targets — builds, tests, linting — and set `"cache": false` or omit for side-effect tasks like `serve`)**

**(You MUST define `dependsOn: ["^build"]` in targetDefaults for build tasks to ensure topological ordering across the project graph)**

**(You MUST declare `inputs` and `outputs` for cached targets so Nx knows what to hash and what to restore)**

**(You MUST use inferred tasks (Project Crystal) as the default — only add `project.json` targets when overriding inferred configuration)**

**(You MUST use `nx affected -t <target>` in CI to only run tasks for changed projects and their dependents)**

**Failure to follow these rules will cause incorrect builds, stale caches, wasted CI compute, and broken task ordering.**

</critical_reminders>
