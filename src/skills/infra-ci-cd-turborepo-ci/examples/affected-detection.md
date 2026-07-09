# Turborepo CI - Affected Detection Examples

> --affected flag, turbo query affected for conditional CI steps, and PR vs main branch patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for filter syntax cheat sheet.

---

## Pattern 1: --affected for PR Builds

### Basic Usage

```bash
# Auto-detects CI environment (GitHub Actions, GitLab CI, etc.)
# Compares current branch changes against default branch
turbo run build test lint --affected
```

**How --affected works in CI:**

1. Detects CI provider via environment variables (e.g., `GITHUB_BASE_REF` for GitHub Actions)
2. Determines comparison base (PR base branch or push event's before SHA)
3. Identifies packages with file changes between base and HEAD
4. Runs tasks only in those packages (and their dependents if tasks have `dependsOn: ["^..."]`)

**Shallow clone handling:** If git history is insufficient for comparison, `--affected` gracefully falls back to running all tasks. This is safer than `--filter=...[origin/main]` which may fail or produce incorrect results on shallow clones.

### Manual Comparison with --filter

```bash
# Explicit git range comparison (requires sufficient clone depth)
turbo run test --filter=...[origin/main]

# Changed packages in a specific directory
turbo run test --filter={./apps/*}[origin/main]

# Changed packages since last commit
turbo run lint --filter=...[HEAD^1]
```

---

## Pattern 2: PR vs Main Branch Strategy

### PR Builds: Fast Feedback

```bash
# Only changed packages -- target: < 3 minutes
turbo run lint type-check test --affected
```

### Main Branch: Full Validation

```bash
# Full task graph -- catches integration issues
turbo run lint type-check test build
```

### CI Script Pattern

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ]; then
  echo "PR build: running affected tasks only"
  turbo run lint type-check test --affected
else
  echo "Main branch: running full task graph"
  turbo run lint type-check test build
fi
```

**Why separate strategies:** PRs need fast feedback (developer is waiting). Main branch needs comprehensive validation (catching cross-package integration issues that affected detection might miss).

---

## Pattern 3: turbo query affected for Conditional Steps

`turbo query affected` outputs structured JSON, enabling conditional CI steps that skip expensive operations when packages aren't affected.

### Check if Specific Package is Affected

```bash
# Check if 'web' app is affected (any task)
AFFECTED_COUNT=$(turbo query affected --packages web \
  | jq '.data.affectedPackages.length')

if [ "$AFFECTED_COUNT" -gt 0 ]; then
  echo "web app affected -- running deployment"
  # Run expensive deployment steps
else
  echo "web app not affected -- skipping deployment"
fi
```

### Check if Specific Task is Affected

```bash
# Check if any build tasks are affected
turbo query affected --tasks build

# Check if any test tasks are affected
turbo query affected --tasks test
```

### Skip Dependency Installation

```bash
# If no packages are affected, skip the entire CI pipeline
TOTAL_AFFECTED=$(turbo query affected --packages \
  | jq '.data.affectedPackages.length')

if [ "$TOTAL_AFFECTED" -eq 0 ]; then
  echo "No packages affected -- skipping CI"
  exit 0
fi

# Proceed with install and task execution
npm install --frozen-lockfile
turbo run build test lint --affected
```

**Why useful:** Dependency installation itself takes 30-90 seconds. If `turbo query affected` shows zero affected packages, you can skip even the install step, reducing CI time to seconds.

---

## Pattern 4: Clone Depth for Affected Detection

### Sufficient History for --affected

```bash
# Fetch enough history for accurate comparison
# Most CI providers default to shallow clone (depth=1)

# Option 1: Full history (most accurate, slowest)
git clone --depth=0 <repo>
# or in CI: fetch-depth: 0

# Option 2: Reasonable depth (good balance)
git clone --depth=50 <repo>

# Option 3: Rely on --affected fallback
# Shallow clone + --affected falls back to full task graph
# Acceptable if Remote Cache makes full runs fast anyway
```

**Trade-off:** Full clone is most accurate but adds clone time (10-30s for large repos). `--affected` with shallow clone falls back gracefully, so if Remote Cache hit rate is high, the fallback penalty is minimal.

### Fetch Base Branch for PR Comparison

```bash
# Some CI environments only clone the PR branch
# Fetch the base branch for accurate comparison
git fetch origin main --depth=1
turbo run test --filter=...[origin/main]
```

---

## Pattern 5: Combining --affected with --filter

```bash
# Affected packages, but only in the apps directory
turbo run build --affected --filter=./apps/*

# Affected packages, excluding admin app
turbo run test --affected --filter=!admin

# Affected packages that are dependencies of web
turbo run build --affected --filter=web...
```

**Note:** When combining `--affected` with `--filter`, the result is the intersection -- only packages that are both affected AND match the filter.
