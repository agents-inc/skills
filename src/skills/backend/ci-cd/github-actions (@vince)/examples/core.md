# GitHub Actions - Core Examples

> Pipeline configuration, job dependencies, caching strategies, and resource management. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [testing.md](testing.md) - Affected detection, quality gates
- [caching.md](caching.md) - Remote caching, Turborepo
- [security.md](security.md) - OIDC auth, secrets rotation
- [deployment.md](deployment.md) - Multi-env, rollback
- [monitoring.md](monitoring.md) - Datadog, GitHub Insights

---

## Pattern 1: Pipeline Configuration Examples

### Job Dependencies - Parallel Jobs

```yaml
# Good Example - Parallel jobs with dependencies
jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2 # Named constant, not "latest"

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

  lint:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2
      - run: bunx turbo run lint --filter=...[origin/main]

  test:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for git diff in affected detection
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2
      - run: bunx turbo run test --filter=...[origin/main]

  type-check:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2
      - run: bunx turbo run type-check --filter=...[origin/main]

  build:
    needs: [lint, test, type-check]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2
      - run: bunx turbo run build
```

**Why good:** Install runs once and caches dependencies, lint/test/type-check run in parallel for speed, build only runs after all quality gates pass, prevents wasted build time on failing tests

```yaml
# Bad Example - Sequential jobs, no caching
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest # BAD: Non-deterministic
      - run: bun install # No caching
      - run: bun run test # Full test suite, not affected

  lint:
    needs: test # BAD: Sequential, not parallel
    runs-on: ubuntu-latest
    steps:
      - run: bun install # Re-installing, no cache
      - run: bun run lint

  build:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - run: bun install # Third install!
      - run: bun run build
```

**Why bad:** Sequential jobs waste time (5min test + 2min lint + 3min build = 10min total vs 5min parallel), no caching repeats npm install 3 times, "latest" Bun version is non-deterministic and breaks reproducibility, running full test suite on PRs wastes resources

---

### Caching Strategies

```yaml
# Good Example - Multi-level caching
- name: Cache Bun dependencies
  uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
    restore-keys: |
      ${{ runner.os }}-bun-

- name: Cache Turborepo
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

**Why good:** Bun cache keyed by lockfile hash invalidates only when dependencies change, Turborepo cache per commit SHA enables incremental builds, restore-keys provide fallback for partial cache hits

```yaml
# Bad Example - No caching or wrong cache keys
- name: Install dependencies
  run: bun install # No caching - reinstalls every time

# OR

- name: Cache everything
  uses: actions/cache@v4
  with:
    path: .
    key: my-cache # BAD: Static key never invalidates
```

**Why bad:** No caching wastes 2-3 minutes per CI run reinstalling unchanged dependencies, static cache keys prevent invalidation when dependencies change leading to stale builds, caching entire directory includes build artifacts that should be regenerated

---

### Environment Variables and Secrets

```yaml
# Good Example - Proper secret management
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  NODE_ENV: production # Public, not sensitive
  API_TIMEOUT_MS: 30000 # Named constant

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production # Requires approval

    steps:
      - name: Deploy
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }} # Per-environment secret
          NEXT_PUBLIC_API_URL: ${{ secrets.PROD_API_URL }}
        run: bun run deploy
```

**Why good:** Secrets encrypted and masked in logs, environment-specific secrets prevent staging secrets from accessing production, environment protection requires approval for production deploys, named constants for non-sensitive config

```yaml
# Bad Example - Exposing secrets, hardcoded values
env:
  DATABASE_URL: postgres://user:password@host/db # BAD: Hardcoded secret
  TIMEOUT: 30000 # Magic number

jobs:
  deploy:
    steps:
      - name: Deploy
        run: |
          echo "Deploying with token: ${{ secrets.PROD_TOKEN }}" # BAD: Leaks secret
          curl -H "Authorization: Bearer sk-1234..." # Hardcoded in code
```

**Why bad:** Hardcoded secrets in YAML are committed to git and visible in repository history, echoing secrets to logs bypasses GitHub's secret masking, sharing production secrets across all environments violates least-privilege principle, magic numbers make configuration unclear

---

## Resource Management Examples

```yaml
# Good Example - Concurrency control and resource optimization
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true # Cancel outdated runs when new commit pushed

jobs:
  test:
    runs-on: ubuntu-latest # GitHub-hosted (free for public repos)
    timeout-minutes: 10 # Prevent runaway jobs

    steps:
      - name: Cleanup disk space
        run: |
          # Free up disk space on GitHub runners if needed
          sudo rm -rf /usr/share/dotnet
          sudo rm -rf /opt/ghc
```

**Why:** Concurrency cancellation saves resources (only test latest commit), timeout prevents runaway jobs from consuming runner hours, disk cleanup needed for large builds (Next.js can use 10GB+)
