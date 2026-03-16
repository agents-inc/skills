# GitHub Actions - Monitoring Examples

> CI monitoring and metrics tracking. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [core.md](core.md) - Pipeline config, jobs, caching basics
- [testing.md](testing.md) - Affected detection, quality gates
- [caching.md](caching.md) - Remote caching, Turborepo
- [security.md](security.md) - OIDC auth, secrets rotation
- [deployment.md](deployment.md) - Multi-env, rollback

---

## Pattern 8: CI Monitoring Examples

### CI Observability Integration

```yaml
# Good Example - CI observability integration (e.g., Datadog CI Visibility)
name: CI with Monitoring

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.2.2"

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests with CI observability
        env:
          # Configure your CI observability tool (Datadog, Buildkite Analytics, etc.)
          CI_OBSERVABILITY_API_KEY: ${{ secrets.CI_OBSERVABILITY_API_KEY }}
          CI_SERVICE: my-project-ci
          CI_ENV: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
        run: |
          # CI observability tools automatically track:
          # - Test duration, flakiness, failures
          # - Code coverage trends
          # - Branch/commit correlation
          bunx turbo run test --filter=...[origin/main]

      - name: Track deployment event
        if: github.ref == 'refs/heads/main'
        run: |
          # Send deployment event to your observability platform
          # Example: POST to your monitoring API with deployment metadata
          echo "Deployed commit ${{ github.sha }} to production"
```

**Why good:** CI observability tracks test performance trends and identifies flaky tests, code coverage tracked over time to prevent regressions, deployment markers correlated with error rates and performance metrics

**CI observability platforms typically show:**

- CI pipeline duration trends (identify slowdowns)
- Test flakiness rate (prioritize fixing flaky tests)
- Cache hit rates (optimize caching)
- Deployment frequency and failure rate (DORA metrics)

---

### GitHub Actions Insights

```yaml
# Good Example - Track CI metrics with GitHub Insights
name: CI with Metrics Tracking

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6

      - name: Start timer
        id: timer
        run: echo "start=$(date +%s)" >> $GITHUB_OUTPUT

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.2.2"

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
            echo "Warning: CI exceeded ${THRESHOLD}s threshold (took ${DURATION}s)"
            exit 1
          fi
```

**Why good:** Job summaries provide at-a-glance performance metrics in GitHub UI, timing each step identifies bottlenecks (install vs test vs build), performance thresholds alert when CI becomes too slow, granular metrics help optimize specific stages

**GitHub Insights (built-in) shows:**

- Workflow run times (median, p95, p99)
- Success rate per workflow
- Queue times and runner utilization
- Cost per workflow (for private repos)
