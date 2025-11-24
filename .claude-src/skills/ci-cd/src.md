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

@include(./docs.md)

---

@include(./examples.md)
