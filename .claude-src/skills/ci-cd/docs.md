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
