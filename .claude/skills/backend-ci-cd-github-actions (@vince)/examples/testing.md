# GitHub Actions - Testing Examples

> Affected detection and quality gates for CI pipelines. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [core.md](core.md) - Pipeline config, jobs, caching basics
- [caching.md](caching.md) - Remote caching, Turborepo
- [security.md](security.md) - OIDC auth, secrets rotation
- [deployment.md](deployment.md) - Multi-env, rollback
- [monitoring.md](monitoring.md) - Datadog, GitHub Insights

---

## Pattern 2: Affected Detection Examples

### PR vs Main Branch Strategy

```yaml
# Good Example - Affected detection for PRs, full suite for main
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
# Bad Example - Always run full test suite
jobs:
  test:
    steps:
      - uses: actions/checkout@v4 # fetch-depth: 1 by default
      - run: bunx turbo run test # Always runs ALL tests
```

**Why bad:** Running full test suite on every PR wastes CI resources and slows feedback (10+ min vs 3 min), shallow clone (fetch-depth 1) breaks git comparison for affected detection, no differentiation between PR and main wastes thoroughness on fast iteration

---

### Handling New Packages

```yaml
# Good Example - Detect new packages, run full tests
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
# Bad Example - New packages silently skipped
jobs:
  test:
    steps:
      - run: bunx turbo run test --filter=...[origin/main]
        # New packages have no git history - gets skipped!
```

**Why bad:** New packages are completely untested because they have no git history for comparison, silent failure means PR appears green but new package could be completely broken, no safeguard for edge case that occurs frequently in active monorepos

---

## Pattern 4: Quality Gates Examples

### Comprehensive Quality Gates

```yaml
# Good Example - Comprehensive quality gates
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
# Bad Example - Minimal or missing quality gates
jobs:
  test:
    steps:
      - run: bun run test # No lint, no type-check, no coverage
```

**Why bad:** Single gate (test) misses linting issues code style and syntax errors, no type checking allows TypeScript errors to merge, no coverage tracking lets test coverage decay over time, no bundle size check allows performance regressions

---

### Branch Protection Rules

```yaml
# Good Example - GitHub branch protection settings
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
