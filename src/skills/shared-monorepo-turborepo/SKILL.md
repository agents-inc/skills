---
name: shared-monorepo-turborepo
description: Turborepo, workspaces, package architecture, @repo/* naming, exports, tree-shaking
---

# Monorepo Orchestration with Turborepo

> **Quick Guide:** Turborepo 2.x for monorepo orchestration. Task pipelines with dependency ordering. Local + remote caching for massive speed gains. Workspaces for package linking. Syncpack for dependency version consistency. Internal packages use `@repo/*` naming, explicit `exports` fields, and `workspace:*` protocol.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define task dependencies using `dependsOn: ["^build"]` in turbo.json to ensure topological ordering)**

**(You MUST declare all environment variables in the `env` array of turbo.json tasks for proper cache invalidation)**

**(You MUST set `cache: false` for tasks with side effects like dev servers and code generation)**

**(You MUST use `workspace:*` protocol for internal package dependencies)**

**(You MUST use `@repo/*` naming convention for ALL internal packages)**

**(You MUST define explicit `exports` field in package.json - never allow importing internal paths)**

**(You MUST mark React as `peerDependencies` NOT `dependencies` in component packages)**

</critical_requirements>

---

**Auto-detection:** Turborepo configuration, turbo.json, monorepo setup, workspaces, Bun workspaces, syncpack, task pipelines, @repo/\* packages, package.json exports, workspace dependencies, shared configurations

**When to use:**

- Configuring Turborepo task pipeline and caching strategies
- Setting up workspaces for monorepo package linking
- Enabling remote caching for team/CI cache sharing
- Synchronizing dependency versions across workspace packages
- Creating new internal packages in `packages/`
- Configuring package.json exports for tree-shaking
- Setting up shared configuration packages (@repo/eslint-config, @repo/typescript-config)

**When NOT to use:**

- Single application projects (use standard build tools directly)
- Projects without shared packages (no monorepo benefits)
- Very small projects where setup overhead exceeds caching benefits
- Polyrepo architecture is preferred over monorepo
- Projects already using Nx or Lerna (don't mix monorepo tools)
- App-specific code that won't be shared (keep in app directory)

**Key patterns covered:**

- Turborepo 2.x task pipeline (dependsOn, outputs, inputs, cache)
- Local and remote caching strategies
- Workspaces for package linking
- Syncpack for dependency version consistency
- Environment variable handling in turbo.json
- Package structure and @repo/\* naming conventions
- package.json exports for tree-shaking
- Named exports and barrel file patterns
- Internal dependencies with workspace protocol

**Detailed Resources:**

- For code examples, see [examples/core.md](examples/core.md) (always start here)
  - [examples/caching.md](examples/caching.md) - Remote caching, CI/CD integration
  - [examples/workspaces.md](examples/workspaces.md) - Workspace protocol, syncpack, dependency boundaries
  - [examples/packages.md](examples/packages.md) - Internal package conventions, exports, creating packages
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

Turborepo is a high-performance build system designed for JavaScript/TypeScript monorepos. It provides intelligent task scheduling, caching, and remote cache sharing to dramatically reduce build times. Combined with workspaces, it enables efficient package management with automatic dependency linking.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Turborepo Task Pipeline with Dependency Ordering

Define task dependencies and caching behavior in turbo.json to enable intelligent build orchestration and caching.

#### Key Concepts

- `dependsOn: ["^build"]` - Run dependency tasks first (topological order)
- `outputs` - Define what files to cache
- `inputs` - Specify which files trigger cache invalidation
- `cache: false` - Disable caching for tasks with side effects
- `persistent: true` - Keep dev servers running

#### Minimal Example

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["DATABASE_URL", "NODE_ENV"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": { "cache": false, "persistent": true }
  }
}
```

**Key:** `dependsOn: ["^build"]` ensures topological execution, `env` declares variables for cache invalidation, `cache: false` for side-effect tasks.

See [examples/core.md](examples/core.md) for full good/bad comparison examples.

---

### Pattern 2: Caching Strategies

Turborepo's caching system dramatically speeds up builds by reusing previous task outputs when inputs haven't changed.

#### What Gets Cached

- Build outputs (`dist/`, `.next/`, framework-specific directories)
- Test results (when `cache: true`)
- Lint results

#### What Doesn't Get Cached

- Dev servers (`cache: false`)
- Code generation (`cache: false` - generates files)
- Tasks with side effects

#### Cache Invalidation Triggers

- Source file changes
- Dependency changes
- Environment variable changes (when in `env` array)
- Global dependencies changes (`.env`, `tsconfig.json`)

**Setup:** Link a Vercel account (or self-hosted cache), then set `TURBO_TOKEN` and `TURBO_TEAM` environment variables to enable remote cache sharing.

See [examples/caching.md](examples/caching.md) for remote caching configuration and CI integration examples.

---

### Pattern 3: Workspaces for Package Management

Configure workspaces to enable package linking and dependency sharing across monorepo packages.

#### Key Concepts

- Root `package.json` declares `"workspaces": ["apps/*", "packages/*"]`
- Internal deps use `"@repo/ui": "workspace:*"` protocol for automatic linking
- Standard structure: `apps/` for deployable apps, `packages/` for shared code

See [examples/workspaces.md](examples/workspaces.md) for full good/bad comparison examples and syncpack configuration.

</patterns>

---

<performance>

## Performance Optimization

**Cache Hit Metrics:**

- First build: ~45s (5 packages, no cache)
- Cached build: ~1s (97% faster with local cache)
- Affected build: ~12s (73% faster, only changed packages rebuild)
- Team savings: Hours per week with remote cache enabled

**Optimization Strategies:**

- **Set `globalDependencies`** for files affecting all packages (`.env`, `tsconfig.json`) to prevent unnecessary cache invalidation
- **Use `inputs` array** to fine-tune what triggers cache invalidation for specific tasks
- **Enable remote caching** to share artifacts across team and CI
- **Use `--filter` with affected detection** (`--filter=...[HEAD^]`) to only run tasks for changed packages
- **Set `outputs` carefully** to exclude cache directories (e.g., `!.next/cache/**`)

**Force Cache Bypass:**

```bash
# Ignore cache when needed
bun run build --force

# Only build affected packages
bun run build --filter=...[HEAD^1]
```

</performance>

---

<decision_framework>

## Decision Framework

```
New code? → Shared across 2+ apps? → packages/ (else keep in app)
Monorepo? → Builds > 30s or caching matters? → Use Turborepo
```

For comprehensive decision trees and package creation criteria, see [reference.md](reference.md).

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing `dependsOn: ["^build"]` for build tasks (breaks topological ordering)
- Missing `env` array in turbo.json (causes cache misses across environments)
- Caching dev servers or code generation (incorrect outputs reused)
- Default exports in library packages (breaks tree-shaking)
- Missing `exports` field in package.json (allows internal path imports)

**Common Mistakes:**

- Hardcoded versions instead of `workspace:*` for internal deps
- React in `dependencies` instead of `peerDependencies`
- Giant barrel files re-exporting everything (negates tree-shaking)
- Running full test suite without `--filter=...[HEAD^]` affected detection

**Gotchas:**

- `dependsOn: ["^task"]` runs dependencies' tasks; `dependsOn: ["task"]` runs same package's task
- `--filter=...[HEAD^]` requires `fetch-depth: 2` in GitHub Actions
- Exclude cache directories in outputs: `!.next/cache/**`

For detailed anti-patterns and checklists, see [reference.md](reference.md).

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST define task dependencies using `dependsOn: ["^build"]` in turbo.json to ensure topological ordering)**

**(You MUST declare all environment variables in the `env` array of turbo.json tasks for proper cache invalidation)**

**(You MUST set `cache: false` for tasks with side effects like dev servers and code generation)**

**(You MUST use `workspace:*` protocol for internal package dependencies)**

**(You MUST use `@repo/*` naming convention for ALL internal packages)**

**(You MUST define explicit `exports` field in package.json - never allow importing internal paths)**

**(You MUST mark React as `peerDependencies` NOT `dependencies` in component packages)**

**Failure to follow these rules will cause incorrect builds, cache misses, broken dependency resolution, and tree-shaking failures.**

</critical_reminders>
