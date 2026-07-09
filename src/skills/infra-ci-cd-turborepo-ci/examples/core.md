# Turborepo CI - Core Examples

> turbo.json task configuration, outputs, environment variables, caching control, and filter syntax. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [remote-cache.md](remote-cache.md) - Remote Cache setup, self-hosted, signature verification
- [affected-detection.md](affected-detection.md) - --affected, turbo query affected, conditional CI steps
- [docker.md](docker.md) - turbo prune --docker, multi-stage Dockerfile

---

## Pattern 1: Complete turbo.json for CI

### Task Configuration with Outputs and Env

```jsonc
// turbo.json - Root configuration
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["tsconfig.base.json", ".env"],
  "globalEnv": ["CI", "NODE_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"],
      "env": ["API_URL", "SENTRY_DSN", "PUBLIC_ASSET_PREFIX"],
      "outputLogs": "new-only",
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "env": ["DATABASE_URL", "TEST_API_URL"],
      "outputLogs": "new-only",
    },
    "lint": {
      "dependsOn": [],
      "cache": true,
      "outputLogs": "errors-only",
    },
    "type-check": {
      "dependsOn": ["^build"],
      "cache": true,
      "outputLogs": "errors-only",
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true,
    },
  },
}
```

**Why good:** Every cacheable task declares `outputs` so artifacts restore correctly on cache hit. Environment variables that affect output are in `env`. `dev` has `cache: false` and `persistent: true` because it's a long-running process. `outputLogs` reduces CI noise -- `errors-only` for lint/type-check, `new-only` for build/test.

### Bad Example: Missing Outputs and Env

```jsonc
// ❌ Bad - Missing outputs and env declarations
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      // No outputs: cache hit restores nothing
      // No env: API_URL change doesn't bust cache
    },
    "test": {
      "dependsOn": ["^build"],
      // No outputs: coverage reports lost on cache hit
    },
  },
}
```

**Why bad:** Cache hits restore logs but no artifacts (missing `outputs`). Environment variable changes don't invalidate cache (missing `env`), so `build` with `API_URL=staging` serves cached result from `API_URL=production`.

---

## Pattern 2: Package-Level turbo.json Overrides

Individual packages can extend root turbo.json to add package-specific configuration.

```jsonc
// apps/web/turbo.json - Package-level override
{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": {
      "env": ["PUBLIC_API_URL", "PUBLIC_ANALYTICS_ID"],
      "outputs": ["dist/**", "build/**"],
    },
    "test": {
      "env": ["PLAYWRIGHT_BASE_URL"],
      "inputs": ["src/**", "tests/**", "playwright.config.ts"],
    },
  },
}
```

**Why good:** `extends: ["//"]` inherits from root config. Package-specific env vars and outputs are declared where they're relevant. `inputs` on test narrows what invalidates the cache -- changes to `README.md` won't trigger test re-runs.

---

## Pattern 3: Environment Variable Modes

### Strict Mode (Default in v2)

```jsonc
{
  "envMode": "strict",
  "globalEnv": ["CI", "NODE_ENV"],
  "globalPassThroughEnv": ["npm_config_registry", "HTTP_PROXY"],
  "tasks": {
    "build": {
      "env": ["API_URL"],
      "passThroughEnv": ["DEPLOY_REGION"],
    },
  },
}
```

**Strict mode behavior:**

- Only variables listed in `env`/`globalEnv`/`passThroughEnv`/`globalPassThroughEnv` are available
- Unlisted variables are invisible to tasks
- Prevents accidental dependency on undeclared variables

### Loose Mode (Migration Helper)

```jsonc
{
  "envMode": "loose",
}
```

**Loose mode behavior:**

- All process environment variables available to all tasks
- Only `env`/`globalEnv` variables affect the cache hash
- Useful during migration to strict mode -- everything works, but cache correctness depends on manual `env` declarations

**Migration strategy:** Start with `loose`, run `turbo run build --summarize` to identify which variables are actually used, add them to `env`/`globalEnv`, then switch to `strict`.

---

## Pattern 4: Cache Control in CI

### Selective Cache Sources

```bash
# Use only local cache (debugging remote cache issues)
turbo run build --cache=local:rw,remote:off

# Read from remote but don't upload (preserve known-good cache)
turbo run build --cache=local:rw,remote:r

# No caching at all (full clean build)
turbo run build --force

# Disable caching for a specific run
turbo run build --cache=off
```

### Debugging Cache Misses with --summarize

```bash
# Generate run summary
turbo run build --summarize

# Output: .turbo/runs/<run-id>.json
# Contains: task hashes, input file hashes, env var hashes, timing data

# Compare two runs to find what caused a cache miss
diff <(jq '.tasks[0].hash' .turbo/runs/run1.json) \
     <(jq '.tasks[0].hash' .turbo/runs/run2.json)
```

### Dry Run for Execution Plan

```bash
# See what would execute without running
turbo run build test lint --dry

# JSON output for scripting
turbo run build --dry --json
```

**Why useful in CI:** Verify affected detection is selecting the right packages before committing to a full run. Debug why a task is being re-executed when you expect a cache hit.

---

## Pattern 5: Concurrency and Parallel Execution

```bash
# Default: 10 parallel tasks
turbo run build test lint

# Increase for CI runners with many cores
turbo run build test lint --concurrency=20

# Percentage of available CPUs
turbo run build test lint --concurrency=50%

# Serial execution for debugging ordering issues
turbo run build --concurrency=1
```

### Task Dependency Patterns

```jsonc
{
  "tasks": {
    // Lint has no dependencies -- runs immediately
    "lint": { "dependsOn": [] },

    // Type-check needs upstream builds
    "type-check": { "dependsOn": ["^build"] },

    // Test needs upstream builds
    "test": { "dependsOn": ["^build"] },

    // Build needs upstream builds
    "build": { "dependsOn": ["^build"] },

    // Deploy runs after build in the SAME package (no ^ prefix)
    "deploy": { "dependsOn": ["build"] },

    // E2E tests run after build in the same package
    "test:e2e": { "dependsOn": ["build"], "cache": false },
  },
}
```

**Key distinction:** `^build` means "build in dependency packages must complete first." `build` (no `^`) means "build in THIS package must complete first." `[]` means "no dependencies, run immediately."

---

## Pattern 6: Input Customization

### Narrowing Inputs for Better Cache Hit Rate

```jsonc
{
  "tasks": {
    "lint": {
      "inputs": [
        "src/**/*.ts",
        "src/**/*.tsx",
        ".eslintrc.*",
        "eslint.config.*",
      ],
      "dependsOn": [],
    },
    "test": {
      "inputs": ["src/**", "tests/**", "vitest.config.*", "$TURBO_DEFAULT$"],
    },
  },
}
```

**Why good:** Lint only re-runs when source files or eslint config change -- README edits don't trigger it. `$TURBO_DEFAULT$` in test inputs adds custom globs to the default inputs rather than replacing them.

### Using $TURBO_ROOT$ for Root-Level Files

```jsonc
{
  "tasks": {
    "build": {
      "inputs": [
        "src/**",
        "$TURBO_ROOT$/tsconfig.base.json",
        "$TURBO_DEFAULT$",
      ],
    },
  },
}
```

**Why useful:** `$TURBO_ROOT$` makes the glob relative to the repository root instead of the package directory. Useful for shared configs that live at the root.
