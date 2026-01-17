# GitHub Actions - Deployment Examples

> Multi-environment deployments and rollback procedures. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [core.md](core.md) - Pipeline config, jobs, caching basics
- [testing.md](testing.md) - Affected detection, quality gates
- [caching.md](caching.md) - Remote caching, Turborepo
- [security.md](security.md) - OIDC auth, secrets rotation
- [monitoring.md](monitoring.md) - Datadog, GitHub Insights

---

## Pattern 8: Deployment Workflows Examples

### Multi-Environment Deployment

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
# Good Example - Multi-environment deployment with build promotion
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
# Bad Example - Rebuild for each environment
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

---

### Rollback Procedures

```yaml
# Good Example - Rollback to previous deployment
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
          text: "Warning: Production rolled back to deployment ${{ github.event.inputs.deployment-id }}"
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Why good:** Manual trigger (workflow_dispatch) prevents accidental rollbacks, deployment-id parameter allows rollback to any previous version, instant rollback via Vercel API no rebuild required, Slack notification alerts team immediately
