# Observability Setup - CI/CD Examples

> GitHub Actions workflow for source maps upload and Sentry release tracking.

**Navigation:** [Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [sentry-config.md](sentry-config.md) | [pino-logger.md](pino-logger.md) | [axiom-integration.md](axiom-integration.md) | [health-check.md](health-check.md)

---

## Pattern 7: GitHub Actions Source Maps Upload

**File: `.github/workflows/deploy.yml`**

```yaml
# Good Example - Source maps upload in GitHub Actions
name: Deploy

on:
  push:
    branches: [main]

env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
  SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build with source maps
        run: npm run build
        env:
          CI: true
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}
          NEXT_PUBLIC_AXIOM_TOKEN: ${{ secrets.NEXT_PUBLIC_AXIOM_TOKEN }}
          NEXT_PUBLIC_AXIOM_DATASET: ${{ secrets.NEXT_PUBLIC_AXIOM_DATASET }}
          NEXT_PUBLIC_ENVIRONMENT: production
          NEXT_PUBLIC_APP_VERSION: ${{ github.sha }}

      - name: Create Sentry release
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        with:
          environment: production
          version: ${{ github.sha }}

      # Deploy to Vercel/other platform...
```

**Why good:** Environment variables from secrets (not hardcoded), `CI=true` enables source map upload in build, version tied to git SHA for release tracking, Sentry release action notifies Sentry of deployment

---

### Bad Example

```yaml
# Bad Example - Missing source maps configuration
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      # No Sentry release, no source maps
```

**Why bad:** No source maps upload means Sentry shows minified stack traces (unreadable), no release tracking means can't correlate errors with deployments
