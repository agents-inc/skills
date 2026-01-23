# Turborepo and Build Performance

> Build system caching, TypeScript optimization, and monorepo performance. See [core.md](core.md) for React runtime patterns.

---

## Turborepo Configuration

### Good Example - Proper Outputs and Env Vars

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "env": ["DATABASE_URL", "NODE_ENV"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "src/**/*.tsx", "src/**/*.ts"]
    }
  }
}
```

**Why good:** Proper outputs ensure cache hits when build artifacts haven't changed, env array invalidates cache when environment changes, excluding .next/cache prevents caching the cache itself

### Bad Example - Missing Outputs and Env Declarations

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"]
      // Missing outputs - cache won't work
      // Missing env - env changes won't invalidate cache
    }
  }
}
```

**Why bad:** Cache won't replay outputs without explicit declaration, environment variable changes won't invalidate cache leading to stale builds, missing inputs means cache key doesn't account for file changes

---

## Monitoring Cache Performance

```bash
#!/bin/bash
# scripts/monitor-cache.sh

# View Turborepo cache stats
turbo run build --summarize

# Output shows:
# - Tasks run
# - Cache hits vs misses
# - Execution time per task
# - Total time saved by cache
```

**Cache hit improvement strategies:**

- Don't modify generated files manually (breaks determinism)
- Use deterministic builds (no timestamps in output)
- Declare all environment variables in `turbo.json` env array
- Use granular tasks (separate lint/test/build for better caching)

---

## TypeScript Build Performance

### Good Example - Optimized TypeScript Config

```json
// packages/typescript-config/base.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "skipLibCheck": true,
    "composite": true
  }
}
```

**Why good:** Incremental compilation caches type information between builds, skipLibCheck avoids type-checking node_modules (80%+ speedup), composite enables project references for monorepo optimization

### Bad Example - No Incremental Compilation

```json
{
  "compilerOptions": {
    "strict": true
    // Missing incremental: true - full type check every time
    // Missing skipLibCheck - wastes time checking node_modules
  }
}
```

**Why bad:** Type-checks all files on every build (slow), checks node_modules types unnecessarily (massive overhead), no caching between builds
