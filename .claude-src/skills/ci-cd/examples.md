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
