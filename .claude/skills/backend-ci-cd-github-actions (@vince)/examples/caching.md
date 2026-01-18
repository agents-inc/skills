# GitHub Actions - Caching Examples

> Remote caching with Turborepo and Vercel. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [core.md](core.md) - Pipeline config, jobs, caching basics
- [testing.md](testing.md) - Affected detection, quality gates
- [security.md](security.md) - OIDC auth, secrets rotation
- [deployment.md](deployment.md) - Multi-env, rollback
- [monitoring.md](monitoring.md) - Datadog, GitHub Insights

---

## Pattern 3: Remote Caching Examples

### Vercel Remote Cache Setup

```yaml
# Good Example - Vercel remote cache configuration
name: CI with Remote Cache

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  build:
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build with remote cache
        run: bunx turbo run build
        # TURBO_TOKEN and TURBO_TEAM automatically used

      - name: Check cache statistics
        run: |
          echo "Cache hit rate:"
          cat .turbo/runs/*.json | jq -r '.tasks[] | "\(.label): \(.cache.status)"'
```

**Why good:** Remote cache shared across all CI runs and local development for massive speedups, cache hits mean instant builds (0s vs 30s+ per package), free for Turborepo users via Vercel with zero config, statistics help track cache effectiveness (target 80%+ hit rate)

**Setup steps:**

```bash
# 1. Sign up for Vercel and link project
bun add -g vercel
vercel login
vercel link

# 2. Get team ID and token
vercel team ls
# Generate token at: https://vercel.com/account/tokens

# 3. Add to GitHub Secrets:
# - TURBO_TOKEN: Your Vercel token
# - TURBO_TEAM: Your team ID (or "your-username" for personal)

# 4. Enable in turbo.json:
```

```json
{
  "remoteCache": {
    "signature": true
  }
}
```

```yaml
# Bad Example - No remote caching
jobs:
  build:
    steps:
      - run: bunx turbo run build
        # No TURBO_TOKEN/TURBO_TEAM - local cache only
        # Every CI run rebuilds from scratch
```

**Why bad:** No remote cache means every CI run and every developer rebuilds from scratch wasting compute time, local-only Turborepo cache not shared across machines so team gets no benefit from each other's work, rebuilding unchanged packages wastes 60-70% of CI time

---

### Cache Invalidation

```typescript
// turbo-cache-config.ts
export const CACHE_CONFIG = {
  FORCE_REBUILD: process.env.TURBO_FORCE === "true",
  SKIP_CACHE: process.env.CI === "true" && process.env.SKIP_TURBO_CACHE === "true",
} as const;
```

```bash
# Good Example - Manual cache invalidation when needed
# Clear local cache only
bunx turbo run build --force

# Bypass remote cache (emergency)
TURBO_FORCE=true bunx turbo run build

# Invalidate specific task
bunx turbo run build --force --filter=@repo/api
```

**Why good:** --force flag rebuilds from scratch when cache is suspected corrupt, TURBO_FORCE env var allows bypassing remote cache for debugging, scoped force rebuild (--filter) limits blast radius to specific packages
