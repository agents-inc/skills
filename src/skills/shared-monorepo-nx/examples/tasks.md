# Nx - Task Pipeline & Caching Examples

> Complete examples for task pipelines, dependency ordering, caching strategies, named inputs, and affected commands. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [setup.md](setup.md) - Workspace creation, directory structure, nx.json config
- [generators.md](generators.md) - Built-in and custom generators
- [ci.md](ci.md) - CI pipelines, Nx Cloud, release management

---

## Task Pipeline Examples

### Build Pipeline with Topological Ordering

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    }
  }
}
```

When you run `nx build web`, Nx:

1. Analyzes the project graph to find `web`'s dependencies (e.g., `shared-ui`, `shared-types`)
2. Builds `shared-types` first (leaf dependency)
3. Builds `shared-ui` next (depends on `shared-types`)
4. Builds `web` last (depends on both)
5. Caches each step. Next run with no changes: instant.

### E2E Pipeline with Continuous Serve

```json
{
  "targetDefaults": {
    "e2e": {
      "dependsOn": [{ "target": "serve", "params": "ignore" }],
      "cache": true
    },
    "serve": {
      "continuous": true,
      "cache": false
    }
  }
}
```

**Why good:** `continuous: true` on serve means Nx starts the dev server and immediately proceeds to run e2e tests without waiting for serve to "exit." Without `continuous: true`, the e2e task waits forever.

### dependsOn Syntax Reference

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

- `"^build"` - Run `build` on **dependency** projects first (topological)
- `"build"` - Run `build` on the **same** project first
- `{ "target": "serve", "params": "ignore" }` - Object form with parameter control

---

## Caching Examples

### Named Inputs for Fine-Grained Cache Control

```json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/test-setup.ts",
      "!{projectRoot}/vitest.config.ts"
    ],
    "sharedGlobals": [
      "{workspaceRoot}/tsconfig.base.json",
      "{workspaceRoot}/.env"
    ]
  }
}
```

**Scenario:** You modify `libs/shared/ui/src/button.spec.ts` (a test file).

- `build` uses `production` input - test file is excluded - build cache is **not** invalidated
- `test` uses `default` input - test file is included - test cache **is** invalidated
- Result: `nx build shared-ui` is instant (cache hit), `nx test shared-ui` reruns

### External Dependency Tracking

```json
{
  "targetDefaults": {
    "test": {
      "inputs": [
        "default",
        "^production",
        { "externalDependencies": ["vitest", "@testing-library/react"] }
      ],
      "cache": true
    }
  }
}
```

**Why good:** Upgrading vitest or testing-library invalidates test caches (new test runner might produce different results), but upgrading an unrelated dependency does not.

### Next.js Output Caching

```json
{
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/.next/**", "!{projectRoot}/.next/cache/**"],
      "cache": true
    }
  }
}
```

**Why good:** Caches `.next/` build output but excludes `.next/cache/` (Next.js internal cache) to avoid caching the cache and bloating storage.

### Complete Cache Configuration

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

### Force Cache Bypass

```bash
# Skip cache for a specific run
npx nx build my-app --skip-nx-cache

# Clear all cached artifacts
npx nx reset

# Clear only cache (preserve daemon)
npx nx reset --only-cache
```

---

## Affected Command Examples

### Basic Affected Usage

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

# Compare against specific commit
npx nx affected -t build --base=HEAD~3

# List affected projects (useful for scripting)
npx nx show projects --affected
```

**Why good:** Only runs tasks for changed projects and their dependents, uses project graph for accurate dependency analysis, `--graph` flag visualizes impact for debugging

```bash
# BAD: Run all tests every time
npx nx run-many -t test
```

**Why bad:** Runs tests for every project regardless of changes, wastes CI time and compute on unchanged projects

**When to use:** Always use `nx affected` in CI pipelines. Use `nx run-many` only for local development when you want to run everything.
