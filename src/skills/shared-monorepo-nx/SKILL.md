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

## Examples

- [Workspace Setup](examples/setup.md) — Creating workspaces, directory structure, nx.json config, TypeScript setup
- [Task Pipeline & Caching](examples/tasks.md) — dependsOn ordering, namedInputs, cache configuration, affected commands
- [Generators](examples/generators.md) — Built-in generators, custom generators, schemas, migrations
- [CI & Release Management](examples/ci.md) — GitHub Actions, Nx Cloud, release configuration, module federation

**Additional resources:**

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

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts"
    ]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    }
  },
  "plugins": [
    { "plugin": "@nx/vite/plugin", "options": { "buildTargetName": "build" } }
  ]
}
```

**Why good:** `namedInputs` exclude test files from build cache keys, `dependsOn: ["^build"]` enforces topological ordering, plugins auto-detect targets

For complete nx.json examples, see [examples/setup.md](examples/setup.md).

---

### Pattern 2: Task Pipelines and Dependency Ordering

Task pipelines define execution order using the `dependsOn` property. The `^` prefix means "run this target on dependencies first" (topological ordering).

```json
{
  "targetDefaults": {
    "build": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["build"] },
    "e2e": { "dependsOn": [{ "target": "serve", "params": "ignore" }] },
    "serve": { "continuous": true, "cache": false }
  }
}
```

- `"^build"` — Run `build` on **dependency** projects first (topological)
- `"build"` — Run `build` on the **same** project first
- `{ "target": "serve", "params": "ignore" }` — Object form, prevents parameter forwarding
- `"continuous": true` — Long-running task (Nx 21+), dependents start immediately

For pipeline examples and ordering walkthrough, see [examples/tasks.md](examples/tasks.md).

---

### Pattern 3: Computation Caching (Local + Remote)

Nx caches task results locally by default. When inputs have not changed, cached outputs are restored instantly. Nx Cloud extends this with remote caching shared across the team.

```json
{
  "namedInputs": {
    "production": ["default", "!{projectRoot}/**/*.test.ts"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "test": {
      "inputs": [
        "default",
        "^production",
        { "externalDependencies": ["vitest"] }
      ],
      "cache": true
    },
    "serve": { "cache": false, "continuous": true }
  }
}
```

**Key concepts:** `production` excludes test files from build cache keys, `externalDependencies` invalidates cache on test runner upgrades, `cache: false` on serve prevents caching dev servers

For cache strategies and namedInputs scenarios, see [examples/tasks.md](examples/tasks.md).

---

### Pattern 4: Inferred Tasks (Project Crystal)

Since Nx 18, plugins automatically infer tasks from tool configuration files. For example, `@nx/vite/plugin` detects `vite.config.ts` and creates `build`, `serve`, and `test` targets without any `project.json`.

```json
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": { "buildTargetName": "build", "testTargetName": "test" }
    },
    {
      "plugin": "@nx/jest/plugin",
      "include": ["packages/**/*"],
      "exclude": ["**/*-e2e/**/*"]
    }
  ]
}
```

#### Configuration Precedence

```
1. Plugin inferred config (lowest priority)
2. targetDefaults in nx.json
3. project.json or package.json targets (highest priority)
```

**When to use:** Always prefer inferred tasks as default. Only add `project.json` targets when overriding:

```json
{
  "name": "my-app",
  "targets": {
    "build": { "outputs": ["{projectRoot}/custom-dist"] }
  }
}
```

---

### Pattern 5: Affected Commands and Project Graph

`nx affected` uses git diff combined with the project graph to determine which projects need to be rebuilt/tested. This is the primary CI optimization.

```bash
npx nx affected -t test                              # Test affected projects
npx nx affected -t build test lint                    # Multiple targets
npx nx affected -t test --base=origin/main --head=HEAD  # Explicit base
npx nx affected --graph                               # Visualize impact
```

**Why good:** Only runs tasks for changed projects and their dependents

For CI pipeline examples with affected commands, see [examples/ci.md](examples/ci.md).

---

### Pattern 6: Generators (Code Scaffolding)

Generators create and modify code from templates. Use defaults in nx.json to enforce consistency:

```json
{
  "generators": {
    "@nx/react:library": {
      "bundler": "vite",
      "unitTestRunner": "vitest",
      "style": "scss"
    }
  }
}
```

```bash
npx nx g @nx/react:library my-lib --directory=libs/shared/my-lib
npx nx g @nx/next:application my-app --directory=apps/my-app
npx nx g @nx/workspace:move --project=my-lib --destination=packages/shared/my-lib
```

For built-in and custom generator examples, see [examples/generators.md](examples/generators.md).

---

### Pattern 7: Release Management (nx release)

`nx release` orchestrates versioning, changelog generation, and publishing. Supports fixed and independent strategies.

```json
{
  "release": {
    "projects": ["packages/*"],
    "projectsRelationship": "independent",
    "version": { "conventionalCommits": true, "updateDependents": "always" },
    "changelog": {
      "projectChangelogs": {
        "file": "{projectRoot}/CHANGELOG.md",
        "createRelease": "github"
      }
    },
    "releaseTag": { "pattern": "{projectName}-v{version}" },
    "git": { "commit": true, "tag": true }
  }
}
```

```bash
npx nx release              # Full release
npx nx release --dry-run    # Preview
npx nx release plan minor -m "Add new API endpoints"  # Version plans
```

For release configuration examples, see [examples/ci.md](examples/ci.md).

---

### Pattern 8: Module Federation (Micro-Frontends)

Nx provides first-class module federation support, enabling independent teams to deploy separately.

```bash
npx nx g @nx/react:host shell --directory=apps/shell
npx nx g @nx/react:remote shop --directory=apps/shop --host=shell
npx nx serve shell --devRemotes=shop,cart
```

**When to use:** Large teams with independent deployment cadences. **When to avoid:** Small teams where a single app suffices.

For module federation examples, see [examples/ci.md](examples/ci.md).

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

- **Use `namedInputs`** to exclude test/spec files from build cache keys
- **Set `outputs` precisely** to only cache what is needed (exclude framework caches)
- **Enable Nx Cloud** for remote caching — one developer's cache hit benefits the team
- **Use `nx affected`** in CI to skip unchanged projects entirely
- **Configure `parallel`** in nx.json to control concurrency (default: 3)
- **Use `maxCacheSize`** to prevent unbounded cache growth

```bash
npx nx build my-app --skip-nx-cache  # Skip cache for a specific run
npx nx reset                          # Clear all cached artifacts
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

- **Package managers (npm, pnpm, Bun, Yarn)**: Nx works with any package manager's workspace feature
- **Vite**: `@nx/vite/plugin` infers build/serve/test targets from vite.config.ts
- **Jest / Vitest**: `@nx/jest/plugin` and `@nx/vite/plugin` infer test targets
- **ESLint**: `@nx/eslint/plugin` infers lint targets from eslint.config.js
- **Next.js**: `@nx/next` provides generators, executors, and module federation
- **React / Angular**: `@nx/react` and `@nx/angular` provide generators and executors
- **Storybook**: `@nx/storybook` infers build-storybook and storybook targets
- **Playwright / Cypress**: `@nx/playwright` and `@nx/cypress` with test atomizer
- **Nx Cloud**: Remote caching (Nx Replay) and distributed task execution (Nx Agents)

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
