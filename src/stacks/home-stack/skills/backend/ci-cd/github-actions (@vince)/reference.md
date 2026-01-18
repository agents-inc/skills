# CI/CD Reference

Decision frameworks, anti-patterns, and red flags for CI/CD pipelines.

---

## Decision Framework

### When to use affected detection vs full test suite?

```
Is this a pull request?
├─ YES → Are there new packages?
│   ├─ YES → Run full test suite (new package has no git history)
│   └─ NO → Run affected tests only (--filter=...[origin/main])
└─ NO → Is this the main branch?
    ├─ YES → Run full test suite (comprehensive validation)
    └─ NO → Run affected tests (feature branch)
```

### When to use remote caching?

```
Is this a monorepo with Turborepo?
├─ YES → Always use Vercel remote cache (free)
└─ NO → Is team > 3 people or CI > 5 min?
    ├─ YES → Use remote cache (saves time)
    └─ NO → Local cache sufficient
```

### When to use OIDC vs static credentials?

```
Deploying to AWS/GCP/Azure?
├─ YES → ALWAYS use OIDC (no static keys)
└─ NO → Deploying to Vercel/Netlify?
    ├─ YES → Use platform tokens (scoped)
    └─ NO → Evaluate if OIDC supported by provider
```

### When to require manual approval?

```
Deploying to production?
├─ YES → Require approval (GitHub environment protection)
└─ NO → Is this staging?
    ├─ YES → Auto-deploy (fast feedback)
    └─ NO → Is this preview?
        └─ YES → Auto-deploy (PR review)
```

### When to use reusable workflows vs composite actions?

```
Need to reuse CI/CD logic across repos?
├─ YES → Need multiple jobs or full pipeline?
│   ├─ YES → Reusable Workflow (workflow_call)
│   │   - Supports multiple jobs
│   │   - Native secrets context
│   │   - Up to 10 nested, 50 total per run
│   └─ NO → Need step-level reuse within a job?
│       ├─ YES → Composite Action
│       │   - Bundle steps into single action
│       │   - Runs within caller's job
│       │   - No direct secrets context
│       └─ NO → Inline steps (no reuse needed)
└─ NO → Define steps directly in workflow
```

### When to use matrix builds?

```
Testing multiple configurations?
├─ YES → All combinations valid?
│   ├─ YES → Basic matrix (arrays)
│   └─ NO → Need specific inclusions/exclusions?
│       ├─ Many exclusions → Use include-only strategy
│       └─ Few exclusions → Use exclude keyword
└─ NO → Single configuration (no matrix)
```

---

## RED FLAGS

**High Priority Issues:**

- ❌ **Running full test suite on every PR** - Use affected detection (`--filter=...[origin/main]`) or CI takes 10+ minutes
- ❌ **No caching configured** - Reinstalling dependencies every run wastes 2-3 minutes
- ❌ **Using `latest` for tool versions** - Non-deterministic builds break reproducibility (pin to `1.2.2`)
- ❌ **Committing secrets to repository** - Use GitHub Secrets, never hardcode credentials
- ❌ **Static AWS/GCP credentials** - Use OIDC authentication, never store long-lived access keys
- ❌ **No quality gates on main branch** - Missing lint/test/type-check allows broken code to merge

**Medium Priority Issues:**

- ⚠️ **Sequential jobs instead of parallel** - Lint/test/type-check should run in parallel (saves 40% time)
- ⚠️ **No remote caching for Turborepo** - Team doesn't benefit from shared cache (enable Vercel remote cache)
- ⚠️ **No concurrency limits** - Multiple CI runs on same PR waste resources (use `cancel-in-progress: true`)
- ⚠️ **Rebuilding for each environment** - Build once, promote artifact through staging/production
- ⚠️ **No monitoring of CI performance** - Can't identify bottlenecks (track duration, cache hit rate)
- ⚠️ **Magic numbers in workflows** - Hardcoded timeouts, thresholds (use named constants)

**Common Mistakes:**

- Not using `fetch-depth: 0` for affected detection (git diff fails without history)
- Forgetting to cache `node_modules` in addition to `~/.bun/install/cache`
- Using `needs: [all, previous, jobs]` on every job (creates sequential execution)
- Not handling new packages in affected detection (they get skipped)
- Mixing kebab-case and camelCase in workflow/job names (inconsistent)

**Gotchas & Edge Cases:**

- **Turborepo affected detection requires `fetch-depth: 0`** or git comparison fails (shallow clone by default)
- **New packages have no git history** so `--filter=...[origin/main]` skips them (always check for new package.json files)
- **GitHub Actions cache has 10GB limit** and evicts oldest entries (don't cache large build artifacts, only node_modules)
- **Vercel remote cache free tier is per-user** not per-organization (each developer needs individual Vercel account linked)
- **OIDC requires `id-token: write` permission** or token generation fails silently
- **Environment secrets override repository secrets** with same name (can cause confusion)
- **Artifact attestations require `attestations: write` permission** in addition to `id-token: write` and `contents: read`
- **Cache action v4.2.0+ required since Feb 2025** - older versions will fail (runner 2.231.0+ also required)
- **`actions/create-release` is deprecated** - use `softprops/action-gh-release@v2` instead
- **workflow_dispatch now supports 25 inputs** (increased from 10) - use `type: environment` for environment selection
- **Reusable workflow limits increased (Nov 2025)** - now supports 10 nested levels (was 4) and 50 total workflows (was 20)
- **OIDC tokens now include `check_run_id` claim (Nov 2025)** - enables tracing tokens to exact job/compute for compliance
- **M2 macOS runners available** - use `macos-latest-xlarge`, `macos-15-xlarge` for Apple Silicon with GPU

---

## Anti-Patterns to Avoid

### Running Full Test Suite on PRs

```yaml
# ❌ ANTI-PATTERN: Full test suite on every PR
jobs:
  test:
    steps:
      - run: bunx turbo run test  # Runs ALL tests
```

**Why it's wrong:** PRs should get fast feedback (< 5 min), full test suite takes 10+ minutes, wastes CI resources on unchanged code.

**What to do instead:** Use affected detection: `bunx turbo run test --filter=...[origin/main]`

---

### No Caching Strategy

```yaml
# ❌ ANTI-PATTERN: No caching
jobs:
  test:
    steps:
      - uses: oven-sh/setup-bun@v1
      - run: bun install  # Reinstalls every time
      - run: bun run test
```

**Why it's wrong:** Reinstalling dependencies wastes 2-3 minutes per run, rebuilding unchanged packages wastes 60-70% of CI time.

**What to do instead:** Cache `~/.bun/install/cache/` and `.turbo/` directories, use Vercel remote cache.

---

### Static Cloud Credentials

```yaml
# ❌ ANTI-PATTERN: Static AWS credentials
jobs:
  deploy:
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

**Why it's wrong:** Static credentials never expire creating permanent security risk, no audit trail linking to specific commit.

**What to do instead:** Use OIDC authentication with `role-to-assume` and `id-token: write` permission.

---

### Magic Numbers in Workflows

```yaml
# ❌ ANTI-PATTERN: Magic numbers everywhere
jobs:
  test:
    timeout-minutes: 15  # Why 15?
    steps:
      - run: bun run test -- --coverage --coverageThreshold='{"global":{"statements":80}}'
```

**Why it's wrong:** Magic numbers scattered across workflows, impossible to tune centrally, no documentation of intent.

**What to do instead:** Define constants in `ci-config.ts` and reference them in workflows.

---

## Configuration Constants Reference

### CI Configuration

```typescript
// ci-config.ts - Shared CI configuration constants
export const BUN_VERSION = "1.2.2";
export const NODE_ENV_PRODUCTION = "production";
export const CACHE_RETENTION_DAYS = 30;
export const ARTIFACT_RETENTION_DAYS = 30;
export const MIN_COVERAGE_THRESHOLD = 80;
export const DEPLOY_APPROVAL_TIMEOUT_MINUTES = 60;
```

### Cache Paths

```typescript
// ci-cache-config.ts
export const CACHE_PATHS = {
  BUN_DEPENDENCIES: "~/.bun/install/cache/",
  NODE_MODULES: "node_modules",
  TURBOREPO_CACHE: ".turbo/",
  NEXT_CACHE: ".next/cache/",
  TYPESCRIPT_BUILD_INFO: "tsconfig.tsbuildinfo",
} as const;
```

### Quality Gates

```typescript
// quality-gate-config.ts
export const QUALITY_GATES = {
  COVERAGE_THRESHOLD_STATEMENTS: 80,
  COVERAGE_THRESHOLD_BRANCHES: 75,
  COVERAGE_THRESHOLD_FUNCTIONS: 80,
  COVERAGE_THRESHOLD_LINES: 80,
  MAX_BUNDLE_SIZE_KB: 500,
  LINT_MAX_WARNINGS: 0,
} as const;
```

### Turborepo Filters

```typescript
// turbo-filter-config.ts - Filter patterns for different scenarios
export const TURBO_FILTERS = {
  AFFECTED_SINCE_MAIN: "--filter=...[origin/main]",
  AFFECTED_APPS_ONLY: "--filter=./apps/*...[origin/main]",
  SPECIFIC_PACKAGE_WITH_DEPS: "--filter=@repo/ui...",
  SPECIFIC_PACKAGE_WITH_DEPENDENTS: "--filter=...@repo/api",
} as const;
```

### CI Performance Targets

```typescript
// ci-performance-config.ts
export const CI_PERFORMANCE_CONFIG = {
  TARGET_PR_DURATION_SECONDS: 300, // 5 minutes
  TARGET_MAIN_DURATION_SECONDS: 600, // 10 minutes
  TARGET_CACHE_HIT_RATE: 0.8, // 80%
  MAX_PARALLEL_JOBS: 10,
} as const;
```

### Deployment Configuration

```typescript
// deployment-config.ts
export const DEPLOYMENT_CONFIG = {
  ENVIRONMENTS: {
    PREVIEW: {
      NAME: "preview",
      URL_PATTERN: "pr-{{number}}.example.com",
      AUTO_DEPLOY: true,
      REQUIRE_APPROVAL: false,
    },
    STAGING: {
      NAME: "staging",
      URL: "staging.example.com",
      AUTO_DEPLOY: true,
      REQUIRE_APPROVAL: false,
    },
    PRODUCTION: {
      NAME: "production",
      URL: "example.com",
      AUTO_DEPLOY: true,
      REQUIRE_APPROVAL: true,
      APPROVAL_TIMEOUT_MINUTES: 60,
    },
  },
  ARTIFACT_RETENTION_DAYS: 30,
} as const;
```

### AWS OIDC Configuration

```typescript
// aws-oidc-config.ts
export const AWS_OIDC_CONFIG = {
  ROLE_SESSION_NAME: "github-actions-deployment",
  ROLE_DURATION_SECONDS: 3600,
  AWS_REGION: "us-east-1",
} as const;
```

### Vault Configuration

```typescript
// vault-config.ts
export const VAULT_CONFIG = {
  VAULT_ADDR: process.env.VAULT_ADDR || "https://vault.example.com",
  VAULT_NAMESPACE: "production",
  SECRET_PATH_PREFIX: "secret/data/github-actions",
  TOKEN_TTL_SECONDS: 3600,
  TOKEN_RENEWABLE: true,
} as const;
```

### Datadog CI Configuration

```typescript
// datadog-ci-config.ts
export const DATADOG_CONFIG = {
  SITE: "datadoghq.com",
  SERVICE_NAME: "cv-launch-ci",
  ENV: process.env.GITHUB_REF === "refs/heads/main" ? "production" : "staging",
  TRACE_SAMPLING_RATE: 1.0, // 100% for CI
} as const;
```

### Cache Invalidation

```typescript
// turbo-cache-config.ts
export const CACHE_CONFIG = {
  FORCE_REBUILD: process.env.TURBO_FORCE === "true",
  SKIP_CACHE: process.env.CI === "true" && process.env.SKIP_TURBO_CACHE === "true",
} as const;
```
