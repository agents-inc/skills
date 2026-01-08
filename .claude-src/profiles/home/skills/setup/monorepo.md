---
name: Monorepo
description: Turborepo, workspaces, package architecture
---

# Monorepo Orchestration with Turborepo

> **Quick Guide:** Turborepo 2.4.2 with Bun for monorepo orchestration. Task pipelines with dependency ordering. Local + remote caching for massive speed gains. Workspaces for package linking. Syncpack for dependency version consistency.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST define task dependencies using `dependsOn: ["^build"]` in turbo.json to ensure topological ordering)**

**(You MUST declare all environment variables in the `env` array of turbo.json tasks for proper cache invalidation)**

**(You MUST set `cache: false` for tasks with side effects like dev servers and code generation)**

**(You MUST use Bun workspaces protocol `workspace:*` for internal package dependencies)**

</critical_requirements>

---

**Auto-detection:** Turborepo configuration, turbo.json, monorepo setup, workspaces, Bun workspaces, syncpack, task pipelines

**When to use:**

- Configuring Turborepo task pipeline and caching strategies
- Setting up workspaces for monorepo package linking
- Enabling remote caching for team/CI cache sharing
- Synchronizing dependency versions across workspace packages

**When NOT to use:**

- Single application projects (use standard build tools directly)
- Projects without shared packages (no monorepo benefits)
- Very small projects where setup overhead exceeds caching benefits
- Polyrepo architecture is preferred over monorepo
- Projects already using Nx or Lerna (don't mix monorepo tools)

**Key patterns covered:**

- Turborepo 2.4.2 task pipeline (dependsOn, outputs, inputs, cache)
- Local and remote caching strategies
- Bun workspaces for package linking
- Syncpack for dependency version consistency
- Environment variable handling in turbo.json

---

<philosophy>

## Philosophy

Turborepo is a high-performance build system designed for JavaScript/TypeScript monorepos. It provides intelligent task scheduling, caching, and remote cache sharing to dramatically reduce build times. Combined with Bun workspaces, it enables efficient package management with automatic dependency linking.

**When to use Turborepo:**

- Managing monorepos with multiple apps and shared packages
- Teams need to share build cache across developers and CI
- Build times are slow and need optimization through caching
- Projects with complex task dependencies requiring topological ordering

**When NOT to use Turborepo:**

- Single application projects (use standard build tools)
- Projects without shared packages (no monorepo needed)
- Very small projects where setup overhead exceeds benefits
- Polyrepo architecture is preferred over monorepo

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

#### Configuration

```json
// ✅ Good Example - Proper task configuration with dependencies
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["DATABASE_URL", "NODE_ENV"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "src/**/*.tsx", "src/**/*.ts", "test/**/*.ts", "test/**/*.tsx"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "generate": {
      "dependsOn": ["^generate"],
      "cache": false
    },
    "lint": {}
  }
}
```

**Why good:** `dependsOn: ["^build"]` ensures topological task execution (dependencies build first), `env` array includes all environment variables for proper cache invalidation, `cache: false` prevents caching tasks with side effects (dev servers, code generation), `outputs` specifies cacheable artifacts while excluding cache directories

```json
// ❌ Bad Example - Missing critical configuration
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
      // BAD: No dependsOn - dependencies may not build first
      // BAD: No env array - environment changes won't invalidate cache
    },
    "dev": {
      "persistent": true
      // BAD: Missing cache: false - dev server output gets cached
    },
    "generate": {
      "dependsOn": ["^generate"]
      // BAD: Missing cache: false - generated files get cached
    }
  }
}
```

**Why bad:** Missing `dependsOn` breaks topological ordering (packages may build before their dependencies), missing `env` array causes stale builds when environment variables change, caching dev servers or code generation tasks causes incorrect cached outputs to be reused

---

### Pattern 2: Caching Strategies

Turborepo's caching system dramatically speeds up builds by reusing previous task outputs when inputs haven't changed.

#### What Gets Cached

- Build outputs (`dist/`, `.next/`)
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

```json
// ✅ Good Example - Remote caching with signature verification
{
  "remoteCache": {
    "signature": true
  },
  "tasks": {
    "build": {
      "env": ["DATABASE_URL", "NODE_ENV", "NEXT_PUBLIC_API_URL"]
    }
  }
}
```

**Why good:** `signature: true` enables cache verification for security, `env` array declares all environment variables so different values trigger rebuilds, remote cache shares artifacts across team and CI reducing redundant builds

**Setup:** Link Vercel account, set `TURBO_TOKEN` and `TURBO_TEAM` environment variables to enable remote cache sharing.

---

### Pattern 3: Incremental Builds with Advanced Caching

Turborepo's incremental build system with caching can reduce build times by 95%+ through intelligent artifact reuse.

#### Advanced Configuration

```typescript
// turbo.json - Advanced caching configuration
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    "tsconfig.json",
    ".eslintrc.js"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true,
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"]
    },
    "lint": {
      "cache": true,
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "remoteCache": {
    "signature": true
  }
}
```

### Cache Hit Examples

```bash
# Local development - uses local cache
npx turbo run build
# ✅ Cache miss - Building...
# ✅ Packages built: 5
# ✅ Time: 45.2s

# Second run - hits cache
npx turbo run build
# ✅ Cache hit - Skipping...
# ✅ Packages restored: 5
# ✅ Time: 1.2s (97% faster)

# Only rebuilds changed packages
# Edit packages/ui/src/Button.tsx
npx turbo run build
# ✅ Cache hit: @repo/types, @repo/config, @repo/api-client
# ✅ Cache miss: @repo/ui (changed)
# ✅ Cache miss: web, admin (depend on @repo/ui)
# ✅ Time: 12.4s (73% faster)
```

### Remote Caching in CI

```yaml
# .github/workflows/ci.yml - Remote caching in CI
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2 # Needed for --filter

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install

      # Remote cache with Vercel
      - name: Build
        run: npx turbo run build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

      # Only run affected tests on PRs
      - name: Test affected
        if: github.event_name == 'pull_request'
        run: npx turbo run test --filter=...[HEAD^]

      # Run all tests on main
      - name: Test all
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: npx turbo run test
```

### Useful Scripts

```json
// package.json - Remote cache setup
{
  "scripts": {
    "build": "turbo run build",
    "build:fresh": "turbo run build --force",
    "build:affected": "turbo run build --filter=...[HEAD^1]",
    "test:affected": "turbo run test --filter=...[HEAD^1]"
  }
}
```

---

### Pattern 4: Bun Workspaces for Package Management

Configure Bun workspaces to enable package linking and dependency sharing across monorepo packages.

#### Workspace Configuration

```json
// ✅ Good Example - Properly configured workspaces
{
  "workspaces": ["apps/*", "packages/*"],
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/types": "workspace:*"
  }
}
```

**Why good:** `workspace:*` protocol links local packages automatically, glob patterns `apps/*` and `packages/*` discover all packages dynamically, Bun hoists common dependencies to root reducing duplication

```json
// ❌ Bad Example - Hardcoded versions instead of workspace protocol
{
  "workspaces": ["apps/*", "packages/*"],
  "dependencies": {
    "@repo/ui": "1.0.0",
    "@repo/types": "^2.1.0"
  }
}
```

**Why bad:** Hardcoded versions break local package linking (installs from npm instead of linking), version mismatches across packages cause duplicate dependencies, changes to internal packages require manual version updates everywhere

#### Directory Structure

```
my-monorepo/
├── apps/
│   ├── client-next/      # Next.js app
│   ├── client-react/     # Vite React app
│   └── server/           # Backend server
├── packages/
│   ├── ui/               # Shared UI components
│   ├── api/              # API client
│   ├── eslint-config/    # Shared ESLint config
│   ├── prettier-config/  # Shared Prettier config
│   └── typescript-config/ # Shared TypeScript config
├── turbo.json            # Turborepo configuration
└── package.json          # Root package.json with workspaces
```

---

### Pattern 5: Environment Variable Validation with Turborepo

Declare all environment variables in turbo.json to ensure proper cache invalidation and enable ESLint validation.

#### Turbo Configuration

```json
// ✅ Good Example - All env vars declared
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["NEXT_PUBLIC_API_URL", "NODE_ENV", "DATABASE_URL"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "env": ["NEXT_PUBLIC_API_URL", "NODE_ENV"]
    }
  }
}
```

**Why good:** All environment variables explicitly declared in `env` array, cache invalidates when env values change, ESLint can validate undeclared usage, different environments (dev/staging/prod) properly trigger rebuilds

```json
// ❌ Bad Example - Missing env declarations
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
      // BAD: No env array - using DATABASE_URL won't invalidate cache
    }
  }
}
```

**Why bad:** Missing `env` array means environment variable changes don't invalidate cache, stale builds with wrong config get reused across environments, ESLint can't catch undeclared variable usage

#### ESLint Integration

```javascript
// packages/eslint-config/base.js
export const baseConfig = [
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
];
```

---

### Pattern 6: Dependency Synchronization with Syncpack

Ensure consistent dependency versions across all workspace packages using Syncpack.

#### Package Scripts

```json
// ✅ Good Example - Syncpack configured for version checking
{
  "scripts": {
    "deps:check": "syncpack list-mismatches",
    "deps:fix": "syncpack fix-mismatches"
  }
}
```

**Why good:** `deps:check` identifies version mismatches across packages, `deps:fix` auto-updates to consistent versions, runs in CI to prevent version drift

#### Syncpack Configuration

```json
// .syncpackrc.json - Enforce workspace protocol and consistent versions
{
  "versionGroups": [
    {
      "label": "Use workspace protocol for internal packages",
      "dependencies": ["@repo/*"],
      "dependencyTypes": ["prod", "dev"],
      "pinVersion": "workspace:*"
    }
  ],
  "semverGroups": [
    {
      "range": "^",
      "dependencyTypes": ["prod", "dev"],
      "dependencies": ["**"],
      "packages": ["**"]
    }
  ]
}
```

#### Usage Example

```bash
# Check for mismatches
$ bun run deps:check
❌ react: 18.2.0, 18.3.0, 19.0.0 (3 versions across packages!)
❌ @types/react: 18.2.0, 18.3.0 (2 versions!)

# Auto-fix to consistent versions
$ bun run deps:fix
✅ Updated react to 19.0.0 across all packages
✅ Updated @types/react to 18.3.0 across all packages
```

---

### Pattern 7: Dependency Boundary Management

Enforce clean architecture with proper dependency boundaries between apps and packages.

#### Layered Architecture Rules

```
✅ ALLOWED:
apps/web → @repo/ui → @repo/types
apps/admin → @repo/api-client → @repo/types

❌ FORBIDDEN:
@repo/ui → apps/web  (packages cannot depend on apps)
@repo/types → apps/admin  (packages cannot depend on apps)
@repo/ui → @repo/api-client → @repo/ui  (circular dependency)
```

#### Circular Dependency Detection

```bash
# Using madge to detect circular dependencies
npx madge --circular --extensions ts,tsx ./packages
npx madge --circular --extensions ts,tsx ./apps/client-next/src

# Using dpdm
npx dpdm --circular ./packages/*/src/index.ts
```

#### CI Integration

```json
// package.json - Add to CI pipeline
{
  "scripts": {
    "check:circular": "madge --circular --extensions ts,tsx ./packages",
    "check:deps": "bun run deps:check"
  }
}
```

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

### When to Create a New Package

```
New code to write?
│
├─ Is it a deployable application?
│  └─→ apps/ (Next.js app, API server, admin dashboard)
│
├─ Is it shared across multiple apps?
│  └─→ packages/ (ui, api-client, types)
│
├─ Is it app-specific but significant?
│  └─→ Feature folder within the app (not a package)
│
└─ Is it a build tool or generator?
   └─→ tools/ (code generators, custom scripts)
```

### Package Creation Criteria

✅ **Create package when:**

- Code is used by 2+ apps
- Logical boundary exists (UI library, API client)
- Independent versioning would be valuable
- Clear ownership/team boundary

❌ **Keep code in app when:**

- Only one app uses it
- Tightly coupled to app-specific logic
- Frequently changes with app features
- No clear reuse potential

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Bun**: Package manager and task runner - `bun install`, `bun run build`
- **ESLint**: Turborepo plugin validates env var declarations in turbo.json
- **Syncpack**: Ensures consistent dependency versions across workspaces
- **CI/CD**: GitHub Actions, GitLab CI, CircleCI with remote caching via `TURBO_TOKEN` and `TURBO_TEAM`
- **Vercel**: Built-in support for Turborepo with automatic remote caching

**Replaces / Conflicts with:**

- **Lerna**: Turborepo provides better caching and task orchestration
- **Nx**: Similar monorepo tool - choose one, not both
- **Rush**: Microsoft's monorepo tool - Turborepo is simpler for JS/TS projects

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Running full test suite on every PR without affected detection (wastes CI time and money)
- ❌ Not using caching at all (missing `outputs` configuration)
- ❌ Missing `dependsOn: ["^build"]` for tasks that need dependencies built first
- ❌ Forgetting to declare environment variables in `env` array (causes cache misses across environments)

**Medium Priority Issues:**

- ⚠️ Not setting `cache: false` for dev servers and code generation tasks
- ⚠️ Not using remote caching for teams (everyone rebuilds everything locally)
- ⚠️ Missing `globalDependencies` for shared config files affecting all packages
- ⚠️ Using `latest` Docker tags in CI (non-deterministic builds)

**Common Mistakes:**

- Building dependencies separately instead of letting Turborepo handle topological ordering
- Rebuilding for each environment instead of building once and deploying many
- Not setting GitHub Actions concurrency limits (multiple CI runs on same PR)
- Hardcoding package versions instead of using `workspace:*` protocol

**Gotchas & Edge Cases:**

- Cache invalidation requires ALL affected inputs to be declared - missing `env` vars or `inputs` causes stale builds
- Remote cache requires Vercel account or self-hosted solution - not automatic
- `dependsOn: ["^task"]` runs dependencies' tasks, `dependsOn: ["task"]` runs same package's task first
- Excluding cache directories in `outputs` is critical: `!.next/cache/**` prevents caching the cache
- `--filter=...[HEAD^]` syntax requires fetch-depth: 2 in GitHub Actions checkout

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Missing dependsOn for Build Tasks

```json
// ❌ ANTI-PATTERN: No dependency ordering
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
      // Missing dependsOn: ["^build"]
    }
  }
}
```

**Why it's wrong:** Dependencies may not build first causing build failures, topological ordering broken.

**What to do instead:** Always use `dependsOn: ["^build"]` for build tasks.

---

### Hardcoded Package Versions

```json
// ❌ ANTI-PATTERN: Hardcoded versions for workspace packages
{
  "dependencies": {
    "@repo/ui": "1.0.0",
    "@repo/types": "^2.1.0"
  }
}
```

**Why it's wrong:** Breaks local package linking (installs from npm instead), version mismatches cause duplicate dependencies.

**What to do instead:** Use workspace protocol: `"@repo/ui": "workspace:*"`

---

### Missing Environment Variable Declarations

```json
// ❌ ANTI-PATTERN: Env vars not declared
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"]
      // Missing env array - DATABASE_URL changes won't invalidate cache
    }
  }
}
```

**Why it's wrong:** Environment variable changes don't invalidate cache, stale builds with wrong config get reused.

**What to do instead:** Declare all env vars in the `env` array.

---

### Caching Side-Effect Tasks

```json
// ❌ ANTI-PATTERN: Dev server gets cached
{
  "tasks": {
    "dev": {
      "persistent": true
      // Missing cache: false
    }
  }
}
```

**Why it's wrong:** Dev servers and code generation should not be cached, causes incorrect cached outputs to be reused.

**What to do instead:** Set `cache: false` for dev servers and code generation tasks.

</anti_patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST define task dependencies using `dependsOn: ["^build"]` in turbo.json to ensure topological ordering)**

**(You MUST declare all environment variables in the `env` array of turbo.json tasks for proper cache invalidation)**

**(You MUST set `cache: false` for tasks with side effects like dev servers and code generation)**

**(You MUST use Bun workspaces protocol `workspace:*` for internal package dependencies)**

**Failure to follow these rules will cause incorrect builds, cache misses, and broken dependency resolution.**

</critical_reminders>

---

## Resources

**Official documentation:**

- Turborepo: https://turbo.build/repo/docs
- Turborepo CI/CD: https://turbo.build/repo/docs/ci
- Turborepo Caching: https://turbo.build/repo/docs/core-concepts/caching
- Bun Workspaces: https://bun.sh/docs/install/workspaces

**Tools:**

- Syncpack: https://github.com/JamieMason/syncpack
- Turborepo Remote Cache: https://turbo.build/repo/docs/core-concepts/remote-caching
