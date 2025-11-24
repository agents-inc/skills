# CI/CD Pipelines

**Auto-detection:** GitHub Actions, CI/CD pipelines, Turborepo affected detection, Vercel remote cache, deployment automation, quality gates

**When to use:**

- Setting up GitHub Actions workflows with Bun and Turborepo
- Implementing Turborepo affected detection for faster PR builds
- Configuring Vercel remote cache for team sharing
- Setting up quality gates and branch protection rules

**Key patterns covered:**

- GitHub Actions with Bun 1.2.2 and Turborepo caching
- Affected detection (turbo run test --filter=...[origin/main] for PRs)
- Vercel remote cache (free, zero-config for Turborepo)
- Quality gates (lint, type-check, test, build - parallel jobs with dependencies)

---

# CI/CD Pipelines

> **Quick Guide:** GitHub Actions with Bun 1.2.2 for CI. Turborepo affected detection for monorepo optimization. Vercel remote cache (free). Quality gates: lint + type-check + test + build + coverage. Multi-environment deployments (preview/staging/prod). Secret scanning and dependency audits.

**CURRENT STATE: NO CI/CD IMPLEMENTED**

This document outlines **recommended best practices** for CI/CD pipelines in a Turborepo monorepo using Bun.

---

## Pipeline Configuration

**RECOMMENDED: GitHub Actions with Bun 1.2.2**

**Location:** `.github/workflows/` directory

### CI Platform Choice

**Recommended: GitHub Actions** (native integration, free tier, marketplace, secrets management)

**Alternatives:** GitLab CI, CircleCI, Buildkite, Azure Pipelines

### Workflow Structure

**Pattern: Separate workflows for different concerns**

**Recommended workflows:**

- `ci.yml` - Continuous integration (lint, test, type-check, build)
- `preview.yml` - Preview deployments for pull requests
- `deploy.yml` - Production deployment from main branch
- `release.yml` - Semantic versioning and changelog generation
- `dependabot.yml` - Automated dependency updates (optional)

### Job Dependencies

**Pattern: Parallel jobs with dependencies**

```yaml
jobs:
  install:
    # Install dependencies once, cache for other jobs

  lint:
    needs: install
    # Run in parallel with test and type-check

  test:
    needs: install
    # Run in parallel with lint and type-check

  type-check:
    needs: install
    # Run in parallel with lint and test

  build:
    needs: [lint, test, type-check]
    # Only run after all checks pass
```

### Caching Strategies

**CRITICAL: Proper caching dramatically speeds up CI**

**What to cache:**

1. **Bun dependencies** - `~/.bun/install/cache/`
2. **Turborepo cache** - `.turbo/` directory
3. **Next.js cache** - `.next/cache/` (per app)
4. **TypeScript incremental builds** - `tsconfig.tsbuildinfo`

**Cache invalidation:**

- Dependencies: Hash of `bun.lockb`
- Source code: Turborepo handles automatically
- Build cache: Based on input files

**Cache strategy:**

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
    restore-keys: |
      ${{ runner.os }}-bun-
```

### Environment Variables

**Pattern: Use GitHub secrets for sensitive data**

**Types of variables:**

- **Secrets** - API keys, tokens (encrypted, not visible in logs)
- **Variables** - Non-sensitive config (visible in logs)
- **Environment-specific** - Different values per environment

**Example:**

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  NODE_ENV: production
  NEXT_PUBLIC_API_URL: https://api.example.com
```

**Best practices:**

- Never commit secrets to repository
- Use different secrets per environment (staging vs production)
- Rotate secrets regularly
- Use least-privilege access (don't share prod secrets with preview deploys)

---

## Affected Detection

**CRITICAL: Only test/build changed packages in monorepo**

**Pattern: Turborepo filters with git comparison**

### Turborepo Filter Syntax

**Filter options:**

```bash
# All packages affected since main branch
turbo run test --filter=...[origin/main]

# Specific package and its dependencies
turbo run build --filter=@repo/ui...

# Specific package and its dependents
turbo run test --filter=...@repo/api

# Multiple filters
turbo run lint --filter=@repo/ui... --filter=...@repo/api
```

**Syntax breakdown:**

- `...` - Include dependents
- `[origin/main]` - Compare against main branch
- `^` - Include dependencies

### PR vs Main Branch Strategy

**Pull Requests:**

- Run affected tests: `--filter=...[origin/main]`
- Only test what changed + dependents
- Fast feedback loop

**Main branch:**

- Run full test suite: `turbo run test`
- Ensure everything still works together
- Catch integration issues

**Why:**

- PRs need fast feedback (< 5 minutes ideal)
- Main branch needs comprehensive validation
- Balance speed vs thoroughness

### Handling New Packages

**Problem:** New packages have no git history, may be skipped by affected detection

**Solution:**

```yaml
# Check if this is a new package
- name: Detect new packages
  run: |
    if git diff --name-only origin/main | grep -q "packages/.*/package.json"; then
      echo "NEW_PACKAGE=true" >> $GITHUB_ENV
    fi

# Run full tests if new package detected
- name: Test
  run: |
    if [ "$NEW_PACKAGE" = "true" ]; then
      turbo run test
    else
      turbo run test --filter=...[origin/main]
    fi
```

### Affected Build Optimization

**Pattern: Only build what needs deploying**

```bash
# Build only affected apps (not packages)
turbo run build --filter=./apps/*...[origin/main]

# Build specific app and its dependencies
turbo run build --filter=@repo/client-next...
```

**Benefits:**

- Faster CI (don't build unchanged apps)
- Faster deployments (only deploy what changed)
- Reduced resource usage

---

## Remote Caching

**RECOMMENDED: Vercel Remote Cache (free for Turborepo)**

**Pattern: Share build cache across team and CI**

### Cache Providers

**Vercel (recommended):**

- ✅ Free for Turborepo users
- ✅ Zero configuration
- ✅ Global CDN
- ✅ Team sharing built-in

**Self-hosted alternatives:**

- **AWS S3** - Pay per storage/transfer
- **Google Cloud Storage** - Similar to S3
- **Custom server** - Full control, more work

### Setup Remote Caching

**Step 1: Sign up for Vercel**

```bash
bun add -g vercel
vercel login
vercel link
```

**Step 2: Get team/token**

```bash
# Get your team ID and token
vercel team ls
```

**Step 3: Configure CI**

```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

**Step 4: Enable in turbo.json**

```json
{
  "remoteCache": {
    "signature": true
  }
}
```

### Cache Hit Optimization

**What affects cache hits:**

- Input files (source code, configs)
- Environment variables (declared in `turbo.json`)
- Dependencies (package.json, lockfile)
- Task outputs

**Best practices:**

- Declare all env vars in `turbo.json` (cache invalidation)
- Use deterministic builds (no timestamps in output)
- Don't cache tasks with side effects (`cache: false`)
- Use granular tasks (separate lint/test/build)

**Cache hit rate:**

- 80%+ is excellent
- 50-80% is good
- <50% needs optimization

### Cache Invalidation

**Automatic invalidation:**

- Source file changes
- Dependency updates
- Environment variable changes (if declared)
- Turborepo version changes

**Manual invalidation:**

```bash
# Clear local cache
turbo run build --force

# Bypass remote cache
TURBO_FORCE=true turbo run build
```

---

## Quality Gates

**MANDATORY: Automated checks before merge**

### Required Checks

**Minimum required checks:**

1. **Linting** - Code style, no errors

   - `turbo run lint`
   - Must pass, no warnings allowed in CI

2. **Type checking** - TypeScript compilation

   - `turbo run type-check` (or `tsc --noEmit`)
   - Zero TypeScript errors

3. **Tests** - Unit and integration tests

   - `turbo run test`
   - All tests must pass

4. **Build** - Production build succeeds
   - `turbo run build`
   - Build must complete without errors

**Optional but recommended:** 5. **Coverage thresholds** - Minimum test coverage 6. **Bundle size check** - Prevent bundle bloat 7. **Security audit** - Check for vulnerabilities 8. **Accessibility audit** - Check for a11y issues

### Coverage Thresholds

**Pattern: Enforce minimum test coverage**

**Recommended thresholds:**

- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

**Configuration:**

```json
{
  "coverageThreshold": {
    "global": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    }
  }
}
```

**Why:**

- Prevents untested code from merging
- Encourages comprehensive testing
- Catches regression in coverage

### Branch Protection Rules

**GitHub branch protection (recommended):**

**For `main` branch:**

- ✅ Require pull request before merging
- ✅ Require status checks to pass
  - Lint
  - Type check
  - Test
  - Build
- ✅ Require branches to be up to date
- ✅ Require linear history (no merge commits)
- ❌ Allow force pushes (dangerous!)
- ✅ Require code review (1+ approvers)

**For `develop` branch:**

- ✅ Require pull request
- ✅ Require status checks
- ❌ Require code review (optional, for faster iteration)

### Automated vs Manual Gates

**Automated gates:**

- Lint, test, type-check, build (always automated)
- Coverage thresholds
- Bundle size checks
- Security scans

**Manual gates:**

- Code review (human judgment)
- QA testing (exploratory testing)
- Product approval (feature validation)
- Security review (sensitive changes)

**Best practice:**

- Automate everything possible
- Use manual gates for human judgment only
- Don't block on manual gates for hotfixes

---

## Deployment Workflows

**RECOMMENDED: Automatic deployment from main, manual approval for production**

### Branch Deployment Strategy

**Recommended strategy:**

```
main branch → Production (automatic)
└── Requires: All checks pass + approval

develop branch → Staging (automatic)
└── Requires: All checks pass

feature/* → Preview (automatic on PR)
└── Requires: None (for testing)
```

**Why:**

- Fast feedback with preview deploys
- Staging mirrors production config
- Production requires approval (safety)

**Alternative strategies:**

**Trunk-based development:**

- All commits to `main`
- Deploy to production automatically
- Feature flags for incomplete features

**GitFlow:**

- `develop` → staging
- `release/*` → UAT
- `main` → production (tag-based)

### Environment Promotion

**Pattern: Promote builds through environments**

```
Code → Build → Test → Deploy Staging → Test Staging → Deploy Prod
```

**Why:**

- Same build artifact across environments
- Reduces "works on my machine" issues
- Faster deployments (no rebuild)

**Implementation:**

- Build once in CI
- Upload artifact
- Download and deploy to each environment
- Use environment-specific config (env vars)

### Rollback Procedures

**CRITICAL: Always have rollback plan**

**Strategies:**

1. **Revert commit** - Git revert, trigger new deploy

   - Simple, clean git history
   - Slow (requires new build)

2. **Redeploy previous version** - Vercel/Netlify built-in

   - Fast (instant rollback)
   - Easy with platforms like Vercel

3. **Blue-green deployment** - Two identical environments
   - Zero downtime
   - Instant switchback
   - More complex setup

**Best practice:**

- Use platform rollback for speed (Vercel, Netlify)
- Test rollback procedure regularly
- Monitor post-deployment (catch issues early)

### Preview Deployments

**MANDATORY for PR-based workflow**

**Pattern: Deploy every PR to unique URL**

**Benefits:**

- Visual review before merge
- Test on production-like environment
- Share with stakeholders
- Catch issues early

**Providers:**

- **Vercel** - Automatic preview deploys for Next.js
- **Netlify** - Automatic deploy previews
- **Cloudflare Pages** - Preview deployments
- **Custom** - Deploy to subdomain per PR

**URL patterns:**

- `pr-123.example.com`
- `feature-auth.staging.example.com`
- `pr-123-client-next.vercel.app`

**Cleanup:**

- Delete preview deploys after PR merge/close
- Saves costs
- Reduces clutter

---

## Security and Secrets

**CRITICAL: Never commit secrets**

### Secret Management

**GitHub Secrets:**

- Encrypted at rest
- Masked in logs
- Per-environment secrets
- Audit log

**Best practices:**

- Use least-privilege access (separate secrets per environment)
- Rotate secrets regularly (quarterly minimum)
- Don't share secrets across repos
- Use environment protection rules (require approval for production secrets)

### Dependency Security

**Automated scanning:**

**Dependabot:**

- Automatic security updates
- Creates PRs for vulnerable dependencies
- Free for GitHub

**Alternative tools:**

- **Snyk** - Comprehensive security scanning
- **npm audit** - Built-in npm vulnerability check
- **bun audit** - Bun vulnerability scanning

**Best practice:**

- Enable Dependabot
- Review security PRs within 24 hours
- Auto-merge low-risk patches

### Code Scanning

**GitHub Advanced Security:**

- CodeQL scanning (free for public repos)
- Secret scanning
- Dependency review

**Configuration:**

```yaml
# .github/workflows/codeql.yml
- uses: github/codeql-action/analyze@v3
```

---

## Performance Optimization

**Goal: CI runtime < 5 minutes**

### Parallelization

**Strategies:**

- Run independent jobs in parallel (lint || test || type-check)
- Use matrix builds for multiple Node/Bun versions
- Split test suites (unit || integration || e2e)

### Resource Management

**Runners:**

- Use GitHub-hosted runners (free, no maintenance)
- Use self-hosted runners for speed (private repos, large teams)
- Use larger runners for build-heavy tasks

**Concurrency:**

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Why:**

- Cancels outdated runs (saves resources)
- Only run latest commit

### Monitoring and Metrics

**Track:**

- CI runtime per workflow
- Cache hit rate
- Failure rate per check
- Time to deploy

**Tools:**

- GitHub Insights (built-in)
- Datadog CI Visibility
- CircleCI Insights

**Targets:**

- CI runtime: < 5 minutes
- Cache hit rate: > 80%
- Failure rate: < 5%
- Time to deploy: < 10 minutes

---

## Common Anti-Patterns

**❌ NEVER do these:**

- Running full test suite on every PR (use affected detection)
- Not using caching (wastes time and money)
- Building dependencies separately (use Turborepo pipeline)
- Rebuilding for each environment (build once, deploy many)
- Committing secrets to repository
- Not testing rollback procedures
- Running CI on draft PRs (waste of resources)
- Not parallelizing independent jobs
- Using `latest` Docker tags in CI (non-deterministic)
- Not setting concurrency limits (multiple runs on same PR)

---

## Resources

**Official documentation:**

- GitHub Actions: https://docs.github.com/en/actions
- Turborepo CI/CD: https://turbo.build/repo/docs/ci
- Vercel Deployment: https://vercel.com/docs/deployments

**Tools:**

- Bun CI setup: https://bun.sh/docs/install/ci
- Dependabot: https://docs.github.com/en/code-security/dependabot

**Best practices:**

- GitHub Actions Best Practices: https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions


---

# CI/CD Pipelines - Examples

---

## Pipeline Configuration

### Example: Deployment to Production

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

concurrency:
  group: production-deployment
  cancel-in-progress: false  # Don't cancel production deploys

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires approval

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun run test

      - name: Build for production
        run: bun run build
        env:
          NODE_ENV: production
          NEXT_PUBLIC_API_URL: ${{ secrets.PROD_API_URL }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"

      - name: Notify Slack on Success
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: success
          text: "🚀 Production deployment successful!"
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

      - name: Notify Slack on Failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: "❌ Production deployment failed!"
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Why:**
- Automatic deployments to production from main
- Uses `environment: production` for approval gates
- Notifies team on success/failure
- Uses concurrency to prevent overlapping deploys

**Edge Cases:**
- Use `cancel-in-progress: false` for production (don't cancel ongoing deploys)
- Require environment approval for safety
- Tag releases with semantic versioning

---

### Example: Matrix Build (Multiple Environments)

```yaml
# .github/workflows/matrix.yml
name: Matrix Build

on:
  pull_request:
    branches: [main]

jobs:
  test-matrix:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        bun-version: [1.2.2, latest]

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ matrix.bun-version }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun run test

      - name: Build
        run: bun run build
```

**Why:** Tests across multiple OS and Bun versions. Catches platform-specific issues.

**Edge Cases:**
- Matrix builds can be expensive (use sparingly)
- Only run on main branch or schedule (not every PR)
- Consider using `fail-fast: false` to see all failures

---

## Affected Detection

### Example: RECOMMENDED Turborepo Affected Detection

**RECOMMENDED for Turborepo monorepos:**

```yaml
# .github/workflows/affected.yml
name: CI - Affected Packages

on:
  pull_request:
    branches: [main]

jobs:
  affected:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # CRITICAL: Fetch all history for git diff

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Cache Bun dependencies
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      # Run affected tests (changed packages + dependents)
      - name: Test affected packages
        run: bunx turbo run test --filter=...[origin/main]

      # Run affected lint
      - name: Lint affected packages
        run: bunx turbo run lint --filter=...[origin/main]

      # Run affected type-check
      - name: Type-check affected packages
        run: bunx turbo run type-check --filter=...[origin/main]

      # Build affected apps (not packages)
      - name: Build affected apps
        run: bunx turbo run build --filter=./apps/*...[origin/main]
```

**Why:**
- Only tests changed code (fast feedback)
- `--filter=...[origin/main]` includes changed packages + dependents
- Separate build for apps only (don't build library packages)
- Uses `bunx turbo` instead of global installation

**Edge Cases:**
- Must use `fetch-depth: 0` for git history
- On main branch, run full test suite (not affected)
- Handle new packages correctly (no git history)

---

### Example: Handling New Packages

```yaml
# .github/workflows/ci-smart.yml
name: CI - Smart Detection

on:
  pull_request:
    branches: [main]

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
          if git diff --name-only origin/main | grep -E "(apps|packages)/.*/package.json" | grep -v "^[MDR]"; then
            echo "new-packages=true" >> $GITHUB_OUTPUT
          else
            echo "new-packages=false" >> $GITHUB_OUTPUT
          fi

  test:
    runs-on: ubuntu-latest
    needs: detect-changes

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      # Run full tests if new package, affected tests otherwise
      - name: Test
        run: |
          if [ "${{ needs.detect-changes.outputs.has-new-packages }}" = "true" ]; then
            echo "New package detected - running full test suite"
            bunx turbo run test
          else
            echo "Running affected tests only"
            bunx turbo run test --filter=...[origin/main]
          fi
```

**Why:** New packages have no git history, so affected detection might skip them. This ensures new packages are always tested.

**Edge Cases:**
- Check for new package.json files in apps/ or packages/
- Exclude modified/deleted files (grep -v "^[MDR]")
- Fall back to full test suite for safety

---

### Example: Monorepo Build Optimization

```yaml
# Build only what changed
- name: Build affected apps
  run: bunx turbo run build --filter=./apps/*...[origin/main]

# Build specific app and dependencies
- name: Build client-next
  run: bunx turbo run build --filter=@repo/client-next...

# Build all apps in apps/ directory
- name: Build all apps
  run: bunx turbo run build --filter=./apps/*

# Build changed packages + their dependents
- name: Build affected with dependents
  run: bunx turbo run build --filter=...[origin/main]
```

**Why:**
- `./apps/*...[origin/main]` - Only changed apps
- `@repo/client-next...` - Specific app + its dependencies
- `./apps/*` - All apps (ignores packages)
- `...[origin/main]` - Changed + dependents

---

## Remote Caching

### Example: RECOMMENDED Vercel Remote Cache Setup

**RECOMMENDED for Turborepo:**

```yaml
# .github/workflows/ci.yml
name: CI with Remote Cache

on:
  pull_request:
    branches: [main]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

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

      - name: Build with remote cache
        run: bunx turbo run build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

      - name: Check cache hit rate
        run: |
          echo "Turborepo cache statistics:"
          cat .turbo/runs/*.json | jq '.execution'
```

**Why:**
- Remote cache shared across CI runs and local development
- Massive speed improvements (cache hits = instant builds)
- Free for Turborepo users via Vercel

**Setup Steps:**

1. **Sign up for Vercel:**
```bash
bun add -g vercel
vercel login
vercel link
```

2. **Get team and token:**
```bash
# Get team ID
vercel team ls

# Generate token at: https://vercel.com/account/tokens
```

3. **Add to GitHub Secrets:**
- `TURBO_TOKEN` - Your Vercel token
- `TURBO_TEAM` - Your team ID

4. **Enable in turbo.json:**
```json
{
  "remoteCache": {
    "signature": true
  }
}
```

**Edge Cases:**
- Cache is disabled for tasks with `cache: false` (dev servers, generate tasks)
- Cache includes environment variables declared in `env` array
- Use `--force` to bypass cache when needed

---

### Example: Custom S3 Remote Cache

**Alternative: Self-hosted S3 cache**

```yaml
# .github/workflows/ci-s3-cache.yml
name: CI with S3 Remote Cache

on:
  pull_request:
    branches: [main]

env:
  TURBO_API: https://your-turbo-cache-server.com
  TURBO_TOKEN: ${{ secrets.TURBO_S3_TOKEN }}

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build with S3 remote cache
        run: bunx turbo run build
```

**Why:** Self-hosted cache for sensitive projects or cost optimization.

**Requirements:**
- Custom Turborepo cache server (turborepo-remote-cache)
- S3 bucket for storage
- More complex setup than Vercel

---

## Quality Gates

### Example: RECOMMENDED Quality Gates Configuration

```yaml
# .github/workflows/quality-gates.yml
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
      - name: Lint
        run: bunx turbo run lint

      # Gate 2: Type checking
      - name: Type check
        run: bunx turbo run type-check

      # Gate 3: Tests with coverage
      - name: Test with coverage
        run: bunx turbo run test -- --coverage

      # Gate 4: Coverage threshold
      - name: Check coverage threshold
        run: |
          bunx turbo run test -- --coverage --coverageThreshold='{"global":{"statements":80,"branches":75,"functions":80,"lines":80}}'

      # Gate 5: Build
      - name: Build
        run: bunx turbo run build

      # Gate 6: Bundle size check
      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          skip_step: install

      # Gate 7: Security audit
      - name: Security audit
        run: bun audit

      # Gate 8: Check for TypeScript errors
      - name: TypeScript strict check
        run: bunx tsc --noEmit --strict
```

**Why:** Multiple quality gates ensure code quality before merge.

**Gates explained:**
1. **Lint** - Code style and best practices
2. **Type check** - TypeScript compilation
3. **Test** - Unit/integration tests pass
4. **Coverage** - Minimum test coverage
5. **Build** - Production build succeeds
6. **Bundle size** - Prevent bundle bloat
7. **Security** - No vulnerable dependencies
8. **TypeScript** - Strict mode compliance

---

### Example: Branch Protection Rules (GitHub Settings)

**Recommended settings for `main` branch:**

```yaml
# .github/settings.yml (using probot/settings)
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
          - "quality-checks / Lint"
          - "quality-checks / Type check"
          - "quality-checks / Test with coverage"
          - "quality-checks / Build"

      enforce_admins: true

      required_linear_history: true

      restrictions: null

      allow_force_pushes: false
      allow_deletions: false
```

**Why:** Enforces quality standards, prevents accidental force pushes, requires code review.

---

### Example: Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  # Enable version updates for Bun packages
  - package-ecosystem: "npm"  # Works for Bun too
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    reviewers:
      - "your-team"
    labels:
      - "dependencies"
      - "automated"

    # Automatically merge patch updates
    versioning-strategy: auto

  # Enable security updates
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 5
    labels:
      - "security"
      - "dependencies"
```

**Why:** Automated dependency updates, security patches, reduces maintenance burden.

---

## Deployment Workflows

### Example: RECOMMENDED Multi-Environment Deployment

```yaml
# .github/workflows/deploy-multi-env.yml
name: Deploy Multi-Environment

on:
  push:
    branches:
      - main
      - develop
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
        run: bun run test

      - name: Build
        run: bun run build
        env:
          NODE_ENV: production

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
          github-comment: true
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
          draft: false
          prerelease: false
```

**Why:**
- Single build artifact deployed to all environments
- Preview deploys for PRs
- Staging for develop branch
- Production for main branch
- Uses GitHub environments for approval gates

---

### Example: Blue-Green Deployment

```yaml
# .github/workflows/blue-green.yml
name: Blue-Green Deployment

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build
        run: bun run build

      # Deploy to inactive environment (blue or green)
      - name: Deploy to inactive slot
        run: |
          ACTIVE=$(curl -s https://api.example.com/deployment/active)
          if [ "$ACTIVE" = "blue" ]; then
            DEPLOY_TO="green"
          else
            DEPLOY_TO="blue"
          fi

          echo "Deploying to $DEPLOY_TO environment"
          # Deploy to inactive environment
          # ... deployment commands ...

      # Run smoke tests on inactive environment
      - name: Smoke tests
        run: bun run test:smoke
        env:
          API_URL: https://${{ env.DEPLOY_TO }}.example.com

      # Switch traffic to new environment
      - name: Switch traffic
        run: |
          curl -X POST https://api.example.com/deployment/switch \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_TOKEN }}"

      # Keep old environment running for quick rollback
      - name: Wait for stability
        run: sleep 300  # 5 minutes

      # If no issues, tear down old environment
      - name: Cleanup old environment
        run: |
          # ... cleanup commands ...
```

**Why:** Zero-downtime deployments, instant rollback capability.

---

## Security and Secrets

### Example: Secret Scanning and Prevention

```yaml
# .github/workflows/security.yml
name: Security Checks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  secret-scan:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Scan for secrets in code
      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

      # Scan dependencies for vulnerabilities
      - name: Dependency vulnerability scan
        run: bun audit

      # Check for hardcoded credentials
      - name: Detect hardcoded secrets
        uses: reviewdog/action-detect-secrets@v1

  codeql:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

**Why:** Prevents secrets from being committed, scans for vulnerabilities.

---

## Performance Optimization

### Example: RECOMMENDED Performance Optimizations

```yaml
# .github/workflows/ci-optimized.yml
name: CI - Optimized

on:
  pull_request:
    branches: [main]

# Cancel outdated runs
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # Single install job
  install:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Cache dependencies
        id: cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.bun/install/cache
            node_modules
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}

      - name: Install dependencies
        if: steps.cache.outputs.cache-hit != 'true'
        run: bun install --frozen-lockfile

      - name: Cache node_modules
        uses: actions/cache/save@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('**/bun.lockb') }}

  # Parallel jobs
  lint:
    runs-on: ubuntu-latest
    needs: install
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2
      - name: Restore node_modules
        uses: actions/cache/restore@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('**/bun.lockb') }}
      - run: bunx turbo run lint --filter=...[origin/main]

  test:
    runs-on: ubuntu-latest
    needs: install
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2
      - name: Restore node_modules
        uses: actions/cache/restore@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('**/bun.lockb') }}
      - run: bunx turbo run test --filter=...[origin/main]

  type-check:
    runs-on: ubuntu-latest
    needs: install
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2
      - name: Restore node_modules
        uses: actions/cache/restore@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('**/bun.lockb') }}
      - run: bunx turbo run type-check --filter=...[origin/main]
```

**Why:**
- Concurrency cancels outdated runs (saves resources)
- Single install job (cache node_modules, share with other jobs)
- Parallel lint/test/type-check (faster CI)
- Affected detection (only test changed code)

**Performance gains:**
- Without optimization: ~10 minutes
- With optimization: ~3 minutes
- 70% faster CI runtime

---

### Example: Monitoring CI Performance

```yaml
# .github/workflows/ci-metrics.yml
name: CI with Metrics

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Start timer
        id: timer
        run: echo "start=$(date +%s)" >> $GITHUB_OUTPUT

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bunx turbo run test

      - name: Calculate duration
        run: |
          END=$(date +%s)
          DURATION=$((END - ${{ steps.timer.outputs.start }}))
          echo "CI Duration: ${DURATION}s"
          echo "duration=${DURATION}" >> $GITHUB_OUTPUT

      # Send metrics to monitoring service
      - name: Send metrics to Datadog
        uses: masci/datadog@v1
        with:
          api-key: ${{ secrets.DATADOG_API_KEY }}
          metrics: |
            - type: "gauge"
              name: "ci.duration"
              value: ${{ steps.timer.outputs.duration }}
              tags:
                - "workflow:${{ github.workflow }}"
                - "branch:${{ github.ref }}"
```

**Why:** Track CI performance over time, identify bottlenecks, set alerts for slow builds.

