---
name: shared-ci-cd-github-actions
description: GitHub Actions, pipelines, deployment
---

# CI/CD Pipelines

> **Quick Guide:** GitHub Actions for CI. Turborepo affected detection (`--affected` or `--filter=...[origin/main]`) for monorepo optimization. Remote cache for shared build artifacts. Quality gates: lint + type-check + test + build + coverage as required status checks. Multi-environment deployments with build promotion. OIDC authentication for cloud providers. Pin all action and runtime versions.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use Turborepo affected detection for PR builds - NEVER run full test suite on PRs)**

**(You MUST cache package manager dependencies and Turborepo `.turbo/` - CI without caching wastes 70% of runtime)**

**(You MUST pin action versions (`actions/checkout@v6`, `oven-sh/setup-bun@v2`, `actions/cache@v5`) - NEVER use `@main` or unversioned)**

**(You MUST implement quality gates (lint + type-check + test + build) as required status checks - block merge on failures)**

**(You MUST use OIDC for cloud provider auth where supported - NEVER use static long-lived credentials)**

</critical_requirements>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Pipeline config, jobs, caching, reusable workflows, composite actions, matrix builds
- [examples/testing.md](examples/testing.md) - Affected detection, quality gates
- [examples/caching.md](examples/caching.md) - Remote caching, Turborepo
- [examples/security.md](examples/security.md) - OIDC auth, secrets rotation, artifact attestations
- [examples/deployment.md](examples/deployment.md) - Multi-env, rollback
- [examples/monitoring.md](examples/monitoring.md) - CI metrics, GitHub Insights
- [reference.md](reference.md) - Decision frameworks, anti-patterns, constants reference

---

**Auto-detection:** GitHub Actions, CI/CD pipelines, `.github/workflows`, Turborepo affected detection, remote cache, deployment automation, quality gates, OIDC authentication, secret rotation, artifact attestations, SLSA provenance, reusable workflows, composite actions, matrix builds, workflow_call

**When to use:**

- Setting up GitHub Actions workflows for monorepos
- Implementing affected detection for faster PR builds
- Configuring remote cache for shared build artifacts
- Setting up quality gates and branch protection rules
- Implementing OIDC authentication for cloud deployments
- Adding artifact attestations for supply chain security

**When NOT to use:**

- Single-package projects without monorepo architecture
- Simple static sites with no build step
- Projects not using GitHub (use your CI provider's native docs)

**Key patterns covered:**

- Pipeline configuration with parallel jobs and dependency caching
- Affected detection (Turborepo `--affected` flag or `--filter=...[origin/main]`)
- Quality gates (lint, type-check, test, build as parallel jobs with dependencies)
- OIDC authentication (no static credentials for cloud providers)
- Reusable workflows (`workflow_call`, up to 10 nested levels)
- Composite actions (`using: composite`, shared setup logic)
- Matrix builds (include/exclude, fail-fast, dynamic matrices)
- Artifact attestations (SLSA v1.0 Build Level 2 provenance)
- Multi-environment deployment with build promotion

---

<philosophy>

## Philosophy

CI/CD pipelines automate testing, building, and deployment. In a monorepo, intelligent caching and affected detection are critical for maintaining fast CI as the codebase grows.

**Core principles:**

- **Fast feedback:** PR builds should complete in < 5 minutes via affected detection and caching
- **Build once, promote everywhere:** Single build artifact deployed through preview/staging/production
- **No static credentials:** OIDC for cloud providers, secrets managers for rotating credentials
- **Quality gates block merge:** Lint, type-check, test, and build must all pass before merge

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Pipeline Configuration

Separate install, parallel quality checks, then build.

```yaml
# Recommended workflow structure:
# ci.yml      - lint, test, type-check, build (PR + main)
# deploy.yml  - production deployment from main
# preview.yml - preview deployments for PRs
```

**Key decisions:**

- Pin runtime and action versions (never use `latest`)
- Separate install job with cached dependencies, then fan out to parallel lint/test/type-check
- Build only after all quality gates pass
- Use `concurrency` with `cancel-in-progress: true` to avoid wasting resources

See [examples/core.md](examples/core.md) for complete workflow examples.

---

### Pattern 2: Affected Detection

Only test and build changed packages using Turborepo.

**Two approaches (choose one):**

```bash
# Modern: --affected flag (auto-detects CI environment)
turbo run test --affected

# Manual: --filter with git comparison
turbo run test --filter=...[origin/main]
```

**Key principle:** PRs use affected detection for fast feedback (< 5 min). Main branch runs full suite.

**Gotcha:** New packages have no git history and get skipped by affected detection. Always check for new `package.json` files and fall back to full suite.

See [examples/testing.md](examples/testing.md) for PR vs main branch workflow examples.

---

### Pattern 3: Quality Gates

Automated checks that must pass before merge.

**Quality gate order:**

1. Linting (code style and static analysis)
2. Type checking (TypeScript errors)
3. Tests with coverage (functionality validation)
4. Build verification (production build succeeds)
5. Bundle size check (performance regression prevention)
6. Security audit (dependency vulnerabilities)

Configure as required status checks in branch protection. Use `strict: true` to require branches be up-to-date before merge.

See [examples/testing.md](examples/testing.md) for comprehensive quality gate workflow.

---

### Pattern 4: OIDC Authentication

Eliminate static credentials for cloud deployments.

```yaml
# Key requirement for OIDC:
permissions:
  id-token: write # Required for OIDC token generation
  contents: read
```

**OIDC eliminates:** manual key rotation, permanent security risk from leaked keys, and untraceable deployments. Temporary credentials auto-expire (typically 1 hour).

See [examples/security.md](examples/security.md) for AWS OIDC and token-based authentication examples.

---

### Pattern 5: Reusable Workflows vs Composite Actions

Centralize CI/CD logic across repositories.

| Feature | Reusable Workflow         | Composite Action      |
| ------- | ------------------------- | --------------------- |
| Scope   | Multiple jobs             | Steps within a job    |
| Secrets | Native `secrets` context  | Must pass via inputs  |
| Nesting | Up to 10 levels, 50 total | N/A                   |
| Use for | Full pipeline templates   | Shared setup/teardown |

See [examples/core.md](examples/core.md) for implementation examples.

</patterns>

---

<performance>

## Performance Optimization

**Goal: CI runtime < 5 minutes for PR builds**

**Parallelization techniques:**

- Separate install job, parallel lint/test/type-check jobs (saves 40% time)
- Matrix builds for multiple OS/versions (only on main, not PRs)
- Split test suites (unit, integration, e2e as parallel jobs)
- Use `concurrency` with `cancel-in-progress: true` to cancel outdated runs

**Monitoring targets:**

- **CI runtime:** < 5 min (PR), < 10 min (main)
- **Cache hit rate:** > 80% (remote cache)
- **Failure rate:** < 5% (excluding flaky tests)
- **Time to deploy:** < 10 min (commit to production)

</performance>

---

<red_flags>

## RED FLAGS

**High Priority:**

- **Running full test suite on every PR** - Use affected detection or CI takes 10+ minutes
- **No caching configured** - Reinstalling dependencies every run wastes 2-3 minutes
- **Using `latest` for runtime versions** - Non-deterministic builds break reproducibility
- **Static cloud credentials in secrets** - Use OIDC authentication, never store long-lived access keys
- **No quality gates on main branch** - Missing lint/test/type-check allows broken code to merge

**Medium Priority:**

- **Sequential jobs instead of parallel** - Lint/test/type-check should fan out after install
- **No `concurrency` limits** - Multiple CI runs on same PR waste resources
- **Rebuilding for each environment** - Build once, promote artifact through environments
- **Magic numbers in workflows** - Hardcoded timeouts and thresholds with no documentation of intent

**Gotchas & Edge Cases:**

- `fetch-depth: 0` required for affected detection (shallow clone breaks git diff)
- New packages have no git history so affected detection skips them
- `actions/cache` limit is 10GB free per repo (configurable/pay-as-you-go beyond that)
- OIDC requires `id-token: write` permission or token generation fails silently
- Environment secrets override repository secrets with the same name
- Artifact attestations require `attestations: write` AND `id-token: write` AND `contents: read`
- Reusable workflows support 10 nested levels (increased from 4) and 50 total per run

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Turborepo affected detection for PR builds - NEVER run full test suite on PRs)**

**(You MUST cache package manager dependencies and Turborepo `.turbo/` - CI without caching wastes 70% of runtime)**

**(You MUST pin action versions (`actions/checkout@v6`, `oven-sh/setup-bun@v2`, `actions/cache@v5`) - NEVER use `@main` or unversioned)**

**(You MUST implement quality gates (lint + type-check + test + build) as required status checks - block merge on failures)**

**(You MUST use OIDC for cloud provider auth where supported - NEVER use static long-lived credentials)**

**Failure to follow these rules will result in slow CI (10+ min), security vulnerabilities (leaked credentials), and broken builds (missing quality gates).**

</critical_reminders>
