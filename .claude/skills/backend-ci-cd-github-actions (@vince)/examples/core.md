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

---

## Reusable Workflows

### Basic Reusable Workflow

```yaml
# .github/workflows/reusable-ci.yml
# Good Example - Reusable workflow for standardized CI
name: Reusable CI Workflow

on:
  workflow_call:
    inputs:
      node-version:
        description: "Node.js version to use"
        required: false
        type: string
        default: "20"
      bun-version:
        description: "Bun version to use"
        required: false
        type: string
        default: "1.2.2"
      run-e2e:
        description: "Whether to run E2E tests"
        required: false
        type: boolean
        default: false
    secrets:
      TURBO_TOKEN:
        required: false
      TURBO_TEAM:
        required: false
    outputs:
      build-sha:
        description: "SHA of the build"
        value: ${{ jobs.build.outputs.sha }}

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ inputs.bun-version }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint
        run: bunx turbo run lint --filter=...[origin/main]
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

      - name: Test
        run: bunx turbo run test --filter=...[origin/main]

  build:
    needs: lint-and-test
    runs-on: ubuntu-latest
    outputs:
      sha: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ inputs.bun-version }}

      - name: Build
        run: bunx turbo run build
```

**Why good:** Centralized CI definition ensures all repos use same quality gates, inputs allow customization per-caller while enforcing standards, secrets passed securely via workflow_call

### Calling a Reusable Workflow

```yaml
# .github/workflows/ci.yml
# Good Example - Calling a reusable workflow
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    uses: your-org/workflows/.github/workflows/reusable-ci.yml@v1
    with:
      bun-version: "1.2.2"
      run-e2e: ${{ github.ref == 'refs/heads/main' }}
    secrets:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
    # Or inherit all secrets:
    # secrets: inherit
```

**Why good:** Single line per reusable workflow keeps caller minimal, version tag (@v1) ensures stability while allowing updates, secrets inherit option simplifies secret passing

**Limits (as of Nov 2025):**

- Up to 10 nested reusable workflows (increased from 4)
- Up to 50 total workflows per run (increased from 20)

---

## Composite Actions

### Basic Composite Action

```yaml
# .github/actions/setup-bun-turbo/action.yml
# Good Example - Composite action for Bun + Turborepo setup
name: "Setup Bun with Turborepo"
description: "Install Bun and configure Turborepo remote cache"

inputs:
  bun-version:
    description: "Bun version to install"
    required: false
    default: "1.2.2"
  turbo-token:
    description: "Turborepo remote cache token"
    required: false
  turbo-team:
    description: "Turborepo team ID"
    required: false

outputs:
  cache-hit:
    description: "Whether dependencies were restored from cache"
    value: ${{ steps.cache.outputs.cache-hit }}

runs:
  using: "composite"
  steps:
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: ${{ inputs.bun-version }}

    - name: Cache dependencies
      id: cache
      uses: actions/cache@v4
      with:
        path: ~/.bun/install/cache
        key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
        restore-keys: |
          ${{ runner.os }}-bun-

    - name: Install dependencies
      shell: bash
      run: bun install --frozen-lockfile

    - name: Configure Turborepo
      if: inputs.turbo-token != ''
      shell: bash
      run: |
        echo "TURBO_TOKEN=${{ inputs.turbo-token }}" >> $GITHUB_ENV
        echo "TURBO_TEAM=${{ inputs.turbo-team }}" >> $GITHUB_ENV
```

**Why good:** Encapsulates common setup steps into single reusable action, reduces duplication across workflows, outputs allow subsequent steps to make decisions based on cache status

### Using Composite Action

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Local composite action (same repo)
      - name: Setup environment
        uses: ./.github/actions/setup-bun-turbo
        with:
          bun-version: "1.2.2"
          turbo-token: ${{ secrets.TURBO_TOKEN }}
          turbo-team: ${{ secrets.TURBO_TEAM }}

      - name: Run tests
        run: bunx turbo run test --filter=...[origin/main]
```

**Composite Actions vs Reusable Workflows:**

- **Composite Actions**: Bundle steps within a job, cannot have multiple jobs, no secrets context directly
- **Reusable Workflows**: Define entire jobs, can have multiple jobs, support secrets natively
- **Use Composite Actions for**: Shared setup/teardown logic, step-level reuse
- **Use Reusable Workflows for**: Full pipeline templates, job orchestration

---

## Matrix Builds

### Basic Matrix Strategy

```yaml
# Good Example - Matrix for multi-version testing
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
        os: [ubuntu-latest, macos-latest]
      fail-fast: false # Continue other jobs if one fails

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Test on ${{ matrix.os }} with Node ${{ matrix.node-version }}
        run: npm test
```

**Why good:** Tests all supported Node versions and OS combinations in parallel, fail-fast: false ensures you see all failures not just first one

### Matrix with Include/Exclude

```yaml
# Good Example - Matrix with specific inclusions and exclusions
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [18, 20]
        exclude:
          # Skip Windows + Node 18 (known incompatibility)
          - os: windows-latest
            node-version: 18
        include:
          # Add specific experimental configuration
          - os: ubuntu-latest
            node-version: 22
            experimental: true
          # Use M2 macOS for performance testing
          - os: macos-15-xlarge
            node-version: 20
            experimental: true

    continue-on-error: ${{ matrix.experimental || false }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - run: npm ci
      - run: npm test
```

**Why good:** exclude removes incompatible combinations without listing all valid ones, include adds special cases with extra variables (experimental), continue-on-error allows experimental builds to fail without blocking

### Include-Only Strategy (Dynamic Matrix)

```yaml
# Good Example - Include-only for specific configurations
jobs:
  deploy:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - environment: staging
            url: https://staging.example.com
            auto_deploy: true
          - environment: production
            url: https://example.com
            auto_deploy: false
            require_approval: true

    environment:
      name: ${{ matrix.environment }}
      url: ${{ matrix.url }}

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to ${{ matrix.environment }}
        if: matrix.auto_deploy || github.event_name == 'workflow_dispatch'
        run: echo "Deploying to ${{ matrix.url }}"
```

**Why good:** Include-only strategy defines exactly the configurations you want without generating unwanted combinations, each configuration can have unique properties
