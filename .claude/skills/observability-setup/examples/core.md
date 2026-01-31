# Observability Setup - Core Examples

> Essential patterns for initial Pino + Axiom + Sentry setup. Always review these first.

**Navigation:** [Back to SKILL.md](../SKILL.md) | [sentry-config.md](sentry-config.md) | [pino-logger.md](pino-logger.md) | [axiom-integration.md](axiom-integration.md) | [ci-cd.md](ci-cd.md) | [health-check.md](health-check.md)

---

## Pattern 1: Dependency Installation

```bash
# Good Example - Production dependencies
npm install pino next-axiom @sentry/nextjs

# Development dependencies (pretty printing for local dev)
npm install -D pino-pretty
```

**Why good:** `pino-pretty` as devDependency prevents production bundle bloat, all core packages are production dependencies for runtime use

```bash
# Bad Example - pino-pretty as production dependency
npm install pino pino-pretty next-axiom @sentry/nextjs
```

**Why bad:** `pino-pretty` adds ~500KB to production bundle unnecessarily, degrades performance in production where JSON logs should be sent directly to Axiom

---

## Pattern 2: Environment Variables Template

**File: `apps/client-next/.env.example`**

```bash
# Good Example - Complete observability env template
# ================================================================
# OBSERVABILITY CONFIGURATION
# ================================================================

# ====================================
# Axiom (Logging & Traces)
# ====================================

# Axiom dataset name (create at https://app.axiom.co/datasets)
# Use separate datasets per environment: myapp-dev, myapp-staging, myapp-prod
NEXT_PUBLIC_AXIOM_DATASET=myapp-dev

# Axiom API token (create at https://app.axiom.co/settings/api-tokens)
# Requires ingest permission for the dataset
NEXT_PUBLIC_AXIOM_TOKEN=

# ====================================
# Sentry (Error Tracking)
# ====================================

# Sentry DSN (from Project Settings > Client Keys)
# https://docs.sentry.io/platforms/javascript/guides/nextjs/
NEXT_PUBLIC_SENTRY_DSN=

# Sentry auth token (for source maps upload in CI)
# Create at https://sentry.io/settings/auth-tokens/
# Required scopes: project:releases, org:read
SENTRY_AUTH_TOKEN=

# Sentry organization slug
SENTRY_ORG=your-org

# Sentry project slug
SENTRY_PROJECT=your-project

# ====================================
# Environment Identification
# ====================================

# Current environment (development, staging, production)
NEXT_PUBLIC_ENVIRONMENT=development

# App version (set by CI, used for Sentry releases)
NEXT_PUBLIC_APP_VERSION=0.0.0-local
```

**Why good:** Grouped by service for easy navigation, comments explain where to get each value, separate datasets per environment prevents data mixing, `NEXT_PUBLIC_` prefix makes client-side accessible variables explicit

```bash
# Bad Example - Incomplete template
AXIOM_TOKEN=
SENTRY_DSN=
```

**Why bad:** Missing `NEXT_PUBLIC_` prefix means variables undefined in client, no documentation for where to get values, no dataset separation per environment

---

## Pattern 3: next.config.js with withAxiom

**File: `apps/client-next/next.config.js`**

```javascript
// Good Example - withAxiom wrapper with Sentry
const { withAxiom } = require("next-axiom");
const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing config...
  reactStrictMode: true,
};

// Wrap with Axiom first, then Sentry
const configWithAxiom = withAxiom(nextConfig);

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,

  // Organization and project from env vars
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map upload
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only in CI (not local builds)
  disableServerWebpackPlugin: !process.env.CI,
  disableClientWebpackPlugin: !process.env.CI,

  // Hide source maps from production bundle
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
};

module.exports = withSentryConfig(configWithAxiom, sentryWebpackPluginOptions);
```

**Why good:** `withAxiom` wraps first for logging integration, Sentry wraps outer for source map handling, source map upload disabled locally to speed up dev builds, `hideSourceMaps` prevents exposing source code in production

```javascript
// Bad Example - Missing wrappers
/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
};
```

**Why bad:** No Axiom integration means logs don't reach Axiom, no Sentry integration means source maps not uploaded and errors not tracked
