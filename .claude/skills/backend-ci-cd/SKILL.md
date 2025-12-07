# CI/CD Pipelines

> **Quick Guide:** GitHub Actions with Bun 1.2.2 for CI. Turborepo affected detection for monorepo optimization. Vercel remote cache (free). Quality gates: lint + type-check + test + build + coverage. Multi-environment deployments (preview/staging/prod). Secret scanning and dependency audits.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use Turborepo affected detection `--filter=...[origin/main]` for PR builds - NEVER run full test suite on PRs)**

**(You MUST cache Bun dependencies `~/.bun/install/cache/` and Turborepo `.turbo/` - CI without caching wastes 70% of runtime)**

**(You MUST use named constants for all timeouts, retry counts, and thresholds - NO magic numbers in CI configs)**

**(You MUST implement quality gates (lint + type-check + test + build) as required status checks - block merge on failures)**

**(You MUST use GitHub Secrets for sensitive data and rotate them quarterly - NEVER commit secrets to repository)**

</critical_requirements>

---

**Auto-detection:** GitHub Actions, CI/CD pipelines, Turborepo affected detection, Vercel remote cache, deployment automation, quality gates, OIDC authentication, secret rotation, CI monitoring

**When to use:**

- Setting up GitHub Actions workflows with Bun and Turborepo
- Implementing Turborepo affected detection for faster PR builds
- Configuring Vercel remote cache for team sharing
- Setting up quality gates and branch protection rules
- Implementing OIDC authentication for AWS/GCP deployments
- Setting up automated secrets rotation
- Monitoring CI/CD performance and reliability

**When NOT to use:**

- Single-package projects (simpler CI tools like GitHub Actions without Turborepo may suffice)
- No monorepo architecture (standard CI pipelines without affected detection)
- Real-time deployment requirements (use feature flags + trunk-based development instead)
- Simple static sites with no build step (direct hosting without CI/CD)

**Key patterns covered:**

- GitHub Actions with Bun 1.2.2 and Turborepo caching
- Affected detection (turbo run test --filter=...[origin/main] for PRs)
- Vercel remote cache (free, zero-config for Turborepo)
- Quality gates (lint, type-check, test, build - parallel jobs with dependencies)
- OIDC authentication (AWS, GCP - no static credentials; Vercel uses project tokens)
- Automated secrets rotation (HashiCorp Vault, AWS Secrets Manager)
- CI monitoring (Datadog CI Visibility, GitHub Insights)

---

<philosophy>

## Philosophy

CI/CD pipelines automate testing, building, and deployment to ensure code quality and fast feedback loops. In a Turborepo monorepo, intelligent caching and affected detection are critical for maintaining fast CI times as the codebase grows.

**When to use GitHub Actions with Turborepo:**

- Monorepo architecture with multiple packages/apps
- Need for shared build cache across team and CI
- Fast PR feedback (< 5 minutes) with affected detection
- Multi-environment deployments (preview/staging/production)
- Team collaboration with automated quality gates

**When NOT to use:**

- Single-package projects (simpler CI tools may suffice)
- No monorepo (standard CI pipelines without Turborepo)
- Real-time deployment requirements (use feature flags + trunk-based development)

This document outlines **recommended best practices** for CI/CD pipelines in a Turborepo monorepo using Bun, following CLAUDE.md conventions (kebab-case files, named exports, named constants).

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Pipeline Configuration

GitHub Actions with Bun 1.2.2 is the recommended CI platform for this stack.

#### Constants

```typescript
// ci-config.ts - Shared CI configuration constants
export const BUN_VERSION = "1.2.2";
export const NODE_ENV_PRODUCTION = "production";
export const CACHE_RETENTION_DAYS = 30;
export const ARTIFACT_RETENTION_DAYS = 30;
export const MIN_COVERAGE_THRESHOLD = 80;
export const DEPLOY_APPROVAL_TIMEOUT_MINUTES = 60;
```

#### Workflow Structure

**Recommended workflows:**

- `ci.yml` - Continuous integration (lint, test, type-check, build)
- `preview.yml` - Preview deployments for pull requests
- `deploy.yml` - Production deployment from main branch
- `release.yml` - Semantic versioning and changelog generation
- `dependabot.yml` - Automated dependency updates (optional)
- `security.yml` - Secret scanning and vulnerability checks

#### Job Dependencies

Parallel jobs with dependencies for optimal performance:

```yaml
# ✅ Good Example - Parallel jobs with dependencies
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
# ❌ Bad Example - Sequential jobs, no caching
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

#### Caching Strategies

**What to cache:**

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

```yaml
# ✅ Good Example - Multi-level caching
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
# ❌ Bad Example - No caching or wrong cache keys
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

#### Environment Variables and Secrets

```yaml
# ✅ Good Example - Proper secret management
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
# ❌ Bad Example - Exposing secrets, hardcoded values
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

### Pattern 2: Affected Detection

Only test and build changed packages in monorepo using Turborepo filters.

#### Filter Syntax

```typescript
// turbo-filter-config.ts - Filter patterns for different scenarios
export const TURBO_FILTERS = {
  AFFECTED_SINCE_MAIN: "--filter=...[origin/main]",
  AFFECTED_APPS_ONLY: "--filter=./apps/*...[origin/main]",
  SPECIFIC_PACKAGE_WITH_DEPS: "--filter=@repo/ui...",
  SPECIFIC_PACKAGE_WITH_DEPENDENTS: "--filter=...@repo/api",
} as const;
```

#### PR vs Main Branch Strategy

```yaml
# ✅ Good Example - Affected detection for PRs, full suite for main
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # CRITICAL: Required for git diff

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      # PRs: Only test affected packages
      - name: Test affected (PR)
        if: github.event_name == 'pull_request'
        run: bunx turbo run test --filter=...[origin/main]

      # Main: Full test suite for comprehensive validation
      - name: Test all (main branch)
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: bunx turbo run test
```

**Why good:** PRs get fast feedback (< 5 min) by testing only changed code plus dependents, main branch runs full suite to catch integration issues, fetch-depth 0 required for git diff to work correctly

```yaml
# ❌ Bad Example - Always run full test suite
jobs:
  test:
    steps:
      - uses: actions/checkout@v4 # fetch-depth: 1 by default
      - run: bunx turbo run test # Always runs ALL tests
```

**Why bad:** Running full test suite on every PR wastes CI resources and slows feedback (10+ min vs 3 min), shallow clone (fetch-depth 1) breaks git comparison for affected detection, no differentiation between PR and main wastes thoroughness on fast iteration

#### Handling New Packages

```yaml
# ✅ Good Example - Detect new packages, run full tests
jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      has-new-packages: ${{ steps.detect.outputs.new-packages }}

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect new packages
        id: detect
        run: |
          if git diff --name-only origin/main | grep -E "^(apps|packages)/.*/package\.json$"; then
            echo "new-packages=true" >> $GITHUB_OUTPUT
          else
            echo "new-packages=false" >> $GITHUB_OUTPUT
          fi

  test:
    needs: detect-changes
    steps:
      - name: Test
        run: |
          if [ "${{ needs.detect-changes.outputs.has-new-packages }}" = "true" ]; then
            echo "New package detected - running full test suite"
            bunx turbo run test
          else
            bunx turbo run test --filter=...[origin/main]
          fi
```

**Why good:** New packages have no git history so affected detection skips them, full test suite ensures new packages are validated, grep pattern specifically looks for new package.json files in apps/packages directories

```yaml
# ❌ Bad Example - New packages silently skipped
jobs:
  test:
    steps:
      - run: bunx turbo run test --filter=...[origin/main]
        # New packages have no git history - gets skipped!
```

**Why bad:** New packages are completely untested because they have no git history for comparison, silent failure means PR appears green but new package could be completely broken, no safeguard for edge case that occurs frequently in active monorepos

---

### Pattern 3: Remote Caching

Share Turborepo build cache across team and CI using Vercel Remote Cache (free).

#### Vercel Remote Cache Setup

```yaml
# ✅ Good Example - Vercel remote cache configuration
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
# ❌ Bad Example - No remote caching
jobs:
  build:
    steps:
      - run: bunx turbo run build
        # No TURBO_TOKEN/TURBO_TEAM - local cache only
        # Every CI run rebuilds from scratch
```

**Why bad:** No remote cache means every CI run and every developer rebuilds from scratch wasting compute time, local-only Turborepo cache not shared across machines so team gets no benefit from each other's work, rebuilding unchanged packages wastes 60-70% of CI time

#### Cache Invalidation

```typescript
// turbo-cache-config.ts
export const CACHE_CONFIG = {
  FORCE_REBUILD: process.env.TURBO_FORCE === "true",
  SKIP_CACHE: process.env.CI === "true" && process.env.SKIP_TURBO_CACHE === "true",
} as const;
```

```bash
# ✅ Good Example - Manual cache invalidation when needed
# Clear local cache only
bunx turbo run build --force

# Bypass remote cache (emergency)
TURBO_FORCE=true bunx turbo run build

# Invalidate specific task
bunx turbo run build --force --filter=@repo/api
```

**Why good:** --force flag rebuilds from scratch when cache is suspected corrupt, TURBO_FORCE env var allows bypassing remote cache for debugging, scoped force rebuild (--filter) limits blast radius to specific packages

---

### Pattern 4: Quality Gates

Automated checks that must pass before merge.

#### Required Checks Configuration

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

```yaml
# ✅ Good Example - Comprehensive quality gates
name: Quality Gates

on:
  pull_request:
    branches: [main]

jobs:
  quality-checks:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      # Gate 1: Linting
      - name: Lint affected packages
        run: bunx turbo run lint --filter=...[origin/main]

      # Gate 2: Type checking
      - name: Type check affected packages
        run: bunx turbo run type-check --filter=...[origin/main]

      # Gate 3: Tests with coverage
      - name: Test with coverage
        run: bunx turbo run test --filter=...[origin/main] -- --coverage

      # Gate 4: Coverage threshold enforcement
      - name: Check coverage threshold
        run: |
          bunx turbo run test --filter=...[origin/main] -- --coverage \
            --coverageThreshold='{"global":{"statements":80,"branches":75,"functions":80,"lines":80}}'

      # Gate 5: Build verification
      - name: Build affected apps
        run: bunx turbo run build --filter=./apps/*...[origin/main]

      # Gate 6: Bundle size check
      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}

      # Gate 7: Security audit
      - name: Audit dependencies
        run: bun audit
```

**Why good:** Multiple independent gates catch different classes of issues, coverage thresholds prevent untested code from merging, affected detection keeps checks fast while maintaining quality, bundle size check prevents performance regressions

```yaml
# ❌ Bad Example - Minimal or missing quality gates
jobs:
  test:
    steps:
      - run: bun run test # No lint, no type-check, no coverage
```

**Why bad:** Single gate (test) misses linting issues code style and syntax errors, no type checking allows TypeScript errors to merge, no coverage tracking lets test coverage decay over time, no bundle size check allows performance regressions

#### Branch Protection Rules

```yaml
# ✅ Good Example - GitHub branch protection settings
# .github/settings.yml (using probot/settings app)
branches:
  - name: main
    protection:
      required_pull_request_reviews:
        required_approving_review_count: 1
        dismiss_stale_reviews: true
        require_code_owner_reviews: true

      required_status_checks:
        strict: true
        contexts:
          - "quality-checks / Lint affected packages"
          - "quality-checks / Type check affected packages"
          - "quality-checks / Test with coverage"
          - "quality-checks / Build affected apps"

      enforce_admins: true
      required_linear_history: true
      allow_force_pushes: false
      allow_deletions: false
```

**Why good:** Required status checks block merge until all quality gates pass, strict mode requires branch to be up-to-date before merge preventing integration issues, code owner reviews ensure domain experts approve changes, linear history prevents confusing merge commits

---

### Pattern 5: OIDC Authentication

Use OpenID Connect for secure, keyless authentication to cloud providers (no static credentials).

#### AWS OIDC Authentication

```typescript
// aws-oidc-config.ts
export const AWS_OIDC_CONFIG = {
  ROLE_SESSION_NAME: "github-actions-deployment",
  ROLE_DURATION_SECONDS: 3600,
  AWS_REGION: "us-east-1",
} as const;
```

```yaml
# ✅ Good Example - AWS OIDC authentication (no access keys)
name: Deploy to AWS

on:
  push:
    branches: [main]

permissions:
  id-token: write # CRITICAL: Required for OIDC token
  contents: read

jobs:
  deploy-aws:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeployRole
          role-session-name: github-actions-deployment
          aws-region: us-east-1
          # No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY needed!

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Build
        run: bun run build

      - name: Deploy to S3
        run: |
          aws s3 sync ./dist s3://my-production-bucket --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id EDFDVBD6EXAMPLE \
            --paths "/*"
```

**Why good:** No static AWS credentials to rotate or leak, temporary credentials auto-expire after 1 hour reducing blast radius, GitHub's OIDC token proves identity without secrets, auditable in AWS CloudTrail with GitHub metadata (repo commit SHA)

**Setup (AWS side):**

```bash
# 1. Create IAM OIDC identity provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 2. Create IAM role with trust policy
```

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:your-org/your-repo:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

```yaml
# ❌ Bad Example - Static AWS credentials (security risk)
jobs:
  deploy:
    steps:
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }} # Long-lived secret
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }} # Never expires
          aws-region: us-east-1

      - name: Deploy
        run: aws s3 sync ./dist s3://bucket
```

**Why bad:** Static AWS credentials never expire creating permanent security risk, compromised credentials grant full access until manually rotated, no audit trail linking deployment to specific GitHub commit or actor, manual rotation burden often leads to credentials never being rotated

#### Vercel Token Authentication

> **Note:** Vercel does not yet support OIDC authentication for GitHub Actions deployments. Token-less deployments via OIDC is an [open feature request](https://community.vercel.com/t/feature-request-token-less-github-actions-deployments-via-oidc/15908). Use static Vercel tokens stored in GitHub Secrets until OIDC support is available.

```yaml
# ✅ Good Example - Vercel token-based deployment
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy-vercel:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://example.com

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install Vercel CLI
        run: bun add -g vercel

      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project Artifacts
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

**Why good:** Vercel token scoped to specific project limits blast radius, environment protection requires manual approval for production, prebuilt deployment separates build from deploy for consistency, url annotation links GitHub environment to live deployment

**Security best practices for Vercel tokens:**
- Generate project-scoped tokens (not account-level) at https://vercel.com/account/tokens
- Set token expiration (90 days recommended) and rotate before expiry
- Use GitHub environment secrets to isolate production tokens from preview deployments
- Consider storing in HashiCorp Vault or AWS Secrets Manager for automated rotation (see Pattern 6)

---

### Pattern 6: Automated Secrets Rotation

Automatically rotate secrets and credentials to reduce security risk.

#### HashiCorp Vault Integration

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

```yaml
# ✅ Good Example - Fetch secrets from Vault at runtime
name: Deploy with Vault Secrets

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Import secrets from Vault
        uses: hashicorp/vault-action@v2
        with:
          url: https://vault.example.com
          method: jwt
          role: github-actions-role
          secrets: |
            secret/data/production/database DATABASE_URL ;
            secret/data/production/api API_KEY ;
            secret/data/production/vercel VERCEL_TOKEN

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Build with secrets
        env:
          DATABASE_URL: ${{ env.DATABASE_URL }}
          API_KEY: ${{ env.API_KEY }}
        run: bun run build

      - name: Deploy
        env:
          VERCEL_TOKEN: ${{ env.VERCEL_TOKEN }}
        run: vercel deploy --prod
```

**Why good:** Secrets fetched at runtime always current (rotated in Vault propagates immediately), JWT authentication via OIDC means no static Vault tokens in GitHub, centralized secret management in Vault with audit logging, secrets never stored in GitHub reducing attack surface

#### AWS Secrets Manager Rotation

```yaml
# ✅ Good Example - AWS Secrets Manager with automatic rotation
name: Deploy with AWS Secrets

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: us-east-1

      - name: Retrieve secrets from AWS Secrets Manager
        run: |
          # Fetch database credentials (auto-rotated every 30 days)
          DB_SECRET=$(aws secretsmanager get-secret-value \
            --secret-id production/database \
            --query SecretString --output text)

          echo "DATABASE_URL=$(echo $DB_SECRET | jq -r .url)" >> $GITHUB_ENV
          echo "DATABASE_PASSWORD=$(echo $DB_SECRET | jq -r .password)" >> $GITHUB_ENV

          # Fetch API key
          API_KEY=$(aws secretsmanager get-secret-value \
            --secret-id production/api-key \
            --query SecretString --output text)

          echo "API_KEY=$API_KEY" >> $GITHUB_ENV

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Build
        run: bun run build

      - name: Deploy
        run: bun run deploy
```

**Why good:** AWS Secrets Manager auto-rotates credentials on schedule (every 30 days), Lambda rotation function updates database passwords without manual intervention, OIDC authentication means no AWS keys to manage, secrets fetched just-in-time for each deployment minimizing exposure window

**Setup (AWS Secrets Manager rotation):**

```bash
# 1. Enable automatic rotation
aws secretsmanager rotate-secret \
  --secret-id production/database \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:RotateDatabasePassword \
  --rotation-rules AutomaticallyAfterDays=30
```

```yaml
# ❌ Bad Example - Static secrets in GitHub, never rotated
jobs:
  deploy:
    steps:
      - name: Deploy
        env:
          DATABASE_PASSWORD: ${{ secrets.DB_PASSWORD }} # Added 2 years ago, never rotated
          API_KEY: ${{ secrets.API_KEY }} # No rotation policy
        run: bun run deploy
```

**Why bad:** Static GitHub secrets never expire and rarely rotated in practice, compromised secrets remain valid indefinitely, no centralized audit trail of secret access, manual rotation process error-prone and often skipped

---

### Pattern 7: CI Monitoring and Observability

Track CI/CD performance, reliability, and costs to identify bottlenecks.

#### Datadog CI Visibility

```typescript
// datadog-ci-config.ts
export const DATADOG_CONFIG = {
  SITE: "datadoghq.com",
  SERVICE_NAME: "cv-launch-ci",
  ENV: process.env.GITHUB_REF === "refs/heads/main" ? "production" : "staging",
  TRACE_SAMPLING_RATE: 1.0, // 100% for CI
} as const;
```

```yaml
# ✅ Good Example - Datadog CI Visibility integration
name: CI with Datadog Monitoring

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests with Datadog
        env:
          DD_API_KEY: ${{ secrets.DATADOG_API_KEY }}
          DD_SITE: datadoghq.com
          DD_SERVICE: cv-launch-ci
          DD_ENV: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
          DD_CIVISIBILITY_AGENTLESS_ENABLED: true
        run: |
          # Datadog automatically instruments and tracks:
          # - Test duration, flakiness, failures
          # - Code coverage trends
          # - Branch/commit correlation
          bunx turbo run test --filter=...[origin/main]

      - name: Track deployment metrics
        if: github.ref == 'refs/heads/main'
        run: |
          # Send custom deployment event to Datadog
          curl -X POST "https://api.datadoghq.com/api/v1/events" \
            -H "Content-Type: application/json" \
            -H "DD-API-KEY: ${{ secrets.DATADOG_API_KEY }}" \
            -d @- <<EOF
          {
            "title": "Deployment to Production",
            "text": "Deployed commit ${{ github.sha }} to production",
            "tags": ["env:production", "service:cv-launch", "version:${{ github.sha }}"],
            "alert_type": "info"
          }
          EOF
```

**Why good:** Datadog automatically tracks test performance trends and identifies flaky tests, code coverage tracked over time to prevent regressions, deployment markers correlated with error rates and performance metrics, agentless mode no infrastructure to manage

**Datadog dashboards show:**

- CI pipeline duration trends (identify slowdowns)
- Test flakiness rate (prioritize fixing flaky tests)
- Cache hit rates (optimize Turborepo caching)
- Deployment frequency and failure rate (DORA metrics)

#### GitHub Actions Insights

```yaml
# ✅ Good Example - Track CI metrics with GitHub Insights
name: CI with Metrics Tracking

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Start timer
        id: timer
        run: echo "start=$(date +%s)" >> $GITHUB_OUTPUT

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        id: install
        run: |
          INSTALL_START=$(date +%s)
          bun install --frozen-lockfile
          INSTALL_END=$(date +%s)
          INSTALL_DURATION=$((INSTALL_END - INSTALL_START))
          echo "duration=${INSTALL_DURATION}" >> $GITHUB_OUTPUT

      - name: Run tests
        id: test
        run: |
          TEST_START=$(date +%s)
          bunx turbo run test --filter=...[origin/main]
          TEST_END=$(date +%s)
          TEST_DURATION=$((TEST_END - TEST_START))
          echo "duration=${TEST_DURATION}" >> $GITHUB_OUTPUT

      - name: Calculate total duration
        run: |
          END=$(date +%s)
          TOTAL_DURATION=$((END - ${{ steps.timer.outputs.start }}))

          echo "### CI Performance Metrics" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Total Duration:** ${TOTAL_DURATION}s" >> $GITHUB_STEP_SUMMARY
          echo "- **Install Duration:** ${{ steps.install.outputs.duration }}s" >> $GITHUB_STEP_SUMMARY
          echo "- **Test Duration:** ${{ steps.test.outputs.duration }}s" >> $GITHUB_STEP_SUMMARY

      - name: Check performance threshold
        run: |
          THRESHOLD=300 # 5 minutes max
          DURATION=$(($(date +%s) - ${{ steps.timer.outputs.start }}))
          if [ $DURATION -gt $THRESHOLD ]; then
            echo "⚠️ CI exceeded ${THRESHOLD}s threshold (took ${DURATION}s)"
            exit 1
          fi
```

**Why good:** Job summaries provide at-a-glance performance metrics in GitHub UI, timing each step identifies bottlenecks (install vs test vs build), performance thresholds alert when CI becomes too slow, granular metrics help optimize specific stages

**GitHub Insights (built-in) shows:**

- Workflow run times (median, p95, p99)
- Success rate per workflow
- Queue times and runner utilization
- Cost per workflow (for private repos)

---

### Pattern 8: Deployment Workflows

Multi-environment deployment strategy with preview/staging/production.

#### Multi-Environment Deployment

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

```yaml
# ✅ Good Example - Multi-environment deployment with build promotion
name: Deploy Multi-Environment

on:
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bunx turbo run test

      - name: Build for production
        run: bunx turbo run build
        env:
          NODE_ENV: production

      # Upload build artifact (used by all environments)
      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-${{ github.sha }}
          path: |
            apps/*/dist
            apps/*/.next
          retention-days: 30

  deploy-preview:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    environment:
      name: preview
      url: https://pr-${{ github.event.pull_request.number }}.example.com

    steps:
      - uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-${{ github.sha }}

      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          github-comment: true # Post preview URL as PR comment
          alias-domains: pr-${{ github.event.pull_request.number }}.example.com

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.example.com

    steps:
      - uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-${{ github.sha }}

      - name: Deploy to Vercel Staging
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--env=staging"
          alias-domains: staging.example.com

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://example.com

    steps:
      - uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-${{ github.sha }}

      - name: Deploy to Vercel Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          body: |
            Deployed commit ${{ github.sha }} to production.

            ### Changes
            ${{ github.event.head_commit.message }}
```

**Why good:** Single build artifact promoted through all environments ensures consistency, preview deployments for every PR enable visual review before merge, environment protection on production requires manual approval, artifact retention preserves builds for rollback capability

```yaml
# ❌ Bad Example - Rebuild for each environment
jobs:
  deploy-staging:
    steps:
      - run: bun run build # Build with staging config
      - run: deploy-staging

  deploy-production:
    steps:
      - run: bun run build # Rebuild with production config
      - run: deploy-production
```

**Why bad:** Rebuilding for each environment creates "works in staging but not production" bugs, different build artifacts per environment violates immutable infrastructure principle, slower deployments waiting for rebuild, wasted CI resources rebuilding identical code

#### Rollback Procedures

```yaml
# ✅ Good Example - Rollback to previous deployment
name: Rollback Production

on:
  workflow_dispatch:
    inputs:
      deployment-id:
        description: "Vercel deployment ID to rollback to"
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment:
      name: production

    steps:
      - name: Rollback Vercel deployment
        run: |
          # Promote previous deployment to production
          curl -X PATCH "https://api.vercel.com/v9/deployments/${{ github.event.inputs.deployment-id }}/promote" \
            -H "Authorization: Bearer ${{ secrets.VERCEL_TOKEN }}" \
            -H "Content-Type: application/json"

      - name: Notify team
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          text: "⚠️ Production rolled back to deployment ${{ github.event.inputs.deployment-id }}"
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Why good:** Manual trigger (workflow_dispatch) prevents accidental rollbacks, deployment-id parameter allows rollback to any previous version, instant rollback via Vercel API no rebuild required, Slack notification alerts team immediately

</patterns>

---

<performance>

## Performance Optimization

**Goal: CI runtime < 5 minutes for PR builds**

### Parallelization Strategies

Run independent jobs in parallel to minimize total CI time:

```typescript
// ci-performance-config.ts
export const CI_PERFORMANCE_CONFIG = {
  TARGET_PR_DURATION_SECONDS: 300, // 5 minutes
  TARGET_MAIN_DURATION_SECONDS: 600, // 10 minutes
  TARGET_CACHE_HIT_RATE: 0.8, // 80%
  MAX_PARALLEL_JOBS: 10,
} as const;
```

**Parallelization techniques:**

- Separate install job, parallel lint/test/type-check jobs (saves 40% time)
- Matrix builds for multiple OS/versions (only on main, not PRs)
- Split test suites (unit || integration || e2e)
- Use GitHub's `concurrency` to cancel outdated runs

### Resource Management

```yaml
# ✅ Good Example - Concurrency control and resource optimization
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

### Monitoring Targets

Track these metrics to ensure CI stays fast:

- **CI runtime:** < 5 min (PR), < 10 min (main)
- **Cache hit rate:** > 80% (Turborepo remote cache)
- **Failure rate:** < 5% (excluding flaky tests)
- **Time to deploy:** < 10 min (commit to production)

</performance>

---

<decision_framework>

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

</decision_framework>

---

<integration>

## Integration Guide

CI/CD pipelines integrate with multiple parts of the stack:

**Works with:**

- **Turborepo**: Affected detection, remote caching, parallel task execution
- **Bun**: Fast package installation, test runner, build tool
- **GitHub Actions**: Workflow orchestration, secret management, environments
- **Vercel**: Preview deployments, production hosting, remote cache provider
- **React Query**: No CI impact (client-side only)
- **Zustand**: No CI impact (client-side only)
- **Testing libraries**: Vitest/Jest run via `turbo run test`

**Authentication integrations:**

- **AWS**: OIDC for S3, CloudFront, Lambda deployments
- **Vercel**: Project tokens (OIDC not yet supported for GitHub Actions)
- **Datadog**: API keys for CI monitoring
- **HashiCorp Vault**: JWT authentication for secret retrieval

</integration>

---

<red_flags>

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

</red_flags>

---

<anti_patterns>

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

</anti_patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Turborepo affected detection `--filter=...[origin/main]` for PR builds - NEVER run full test suite on PRs)**

**(You MUST cache Bun dependencies `~/.bun/install/cache/` and Turborepo `.turbo/` - CI without caching wastes 70% of runtime)**

**(You MUST use named constants for all timeouts, retry counts, and thresholds - NO magic numbers in CI configs)**

**(You MUST implement quality gates (lint + type-check + test + build) as required status checks - block merge on failures)**

**(You MUST use GitHub Secrets for sensitive data and rotate them quarterly - NEVER commit secrets to repository)**

**Failure to follow these rules will result in slow CI (10+ min), security vulnerabilities (leaked credentials), and broken builds (missing quality gates).**

</critical_reminders>
