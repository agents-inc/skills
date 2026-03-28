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
│   │   - Up to 10 levels total (caller + 9 nested), 50 unique per run
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

## Gotchas Quick Reference

> For the full RED FLAGS list, see [SKILL.md](SKILL.md). This section covers extended gotchas and version-specific notes.

- **Cache action v5 is current (v4.2.0 minimum)** - older versions use deprecated cache backend
- **Vercel remote cache free tier is per-user** not per-organization (each developer needs individual Vercel account linked)
- **OIDC tokens now include `check_run_id` claim (Nov 2025)** - enables tracing tokens to exact job/compute for compliance
- **M2 macOS runners available** - use `macos-latest-xlarge`, `macos-15-xlarge` for Apple Silicon with GPU
- **Reusable workflow limits increased (Nov 2025)** - now supports 10 levels total (caller + 9 nested, was 4) and 50 unique workflows per run (was 20)

---

## Anti-Patterns to Avoid

### Running Full Test Suite on PRs

```yaml
# ❌ ANTI-PATTERN: Full test suite on every PR
jobs:
  test:
    steps:
      - run: bunx turbo run test # Runs ALL tests
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
      - uses: oven-sh/setup-bun@v2
      - run: bun install # Reinstalls every time
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
    timeout-minutes: 15 # Why 15?
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
export const BUN_VERSION = "1.2.2"; // Pin to your project's version
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
  SPECIFIC_PACKAGE_WITH_DEPS: "--filter=my-package...",
  SPECIFIC_PACKAGE_WITH_DEPENDENTS: "--filter=...my-package",
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

### CI Observability Configuration

```typescript
// ci-observability-config.ts
export const CI_OBSERVABILITY_CONFIG = {
  SERVICE_NAME: "my-project-ci",
  ENV: process.env.GITHUB_REF === "refs/heads/main" ? "production" : "staging",
  TRACE_SAMPLING_RATE: 1.0, // 100% for CI
} as const;
```

### Cache Invalidation

```typescript
// turbo-cache-config.ts
export const CACHE_CONFIG = {
  FORCE_REBUILD: process.env.TURBO_FORCE === "true",
  SKIP_CACHE:
    process.env.CI === "true" && process.env.SKIP_TURBO_CACHE === "true",
} as const;
```
