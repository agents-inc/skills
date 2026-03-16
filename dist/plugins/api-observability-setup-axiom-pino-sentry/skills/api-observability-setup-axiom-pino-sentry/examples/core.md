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

**Why bad:** `pino-pretty` adds ~500KB to production bundle unnecessarily, degrades performance in production where JSON logs should be sent directly to your log aggregator

---

## Pattern 2: Environment Variables Template

**File: `.env.example`**

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

## Pattern 3: next.config.ts with withAxiom

**File: `next.config.ts`**

```typescript
// Good Example - withAxiom wrapper with Sentry (v9+ compatible)
import { withSentryConfig } from "@sentry/nextjs";
import { withAxiom } from "next-axiom";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Your existing config...
  reactStrictMode: true,
};

// Wrap with Axiom first (inner), then Sentry (outer)
export default withSentryConfig(withAxiom(nextConfig), {
  // Organization and project from env vars
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map upload
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print source map upload logs in CI
  silent: !process.env.CI,
});
```

**Why good:** ESM imports with TypeScript (`next.config.ts`), `withAxiom` wraps first for logging integration, Sentry wraps outer for source map handling, `silent: !process.env.CI` suppresses upload noise locally, source maps are hidden by default in v9+ (no `hideSourceMaps` needed)

```typescript
// Bad Example - Using removed v7/v8 options
import { withSentryConfig } from "@sentry/nextjs";

export default withSentryConfig(nextConfig, {
  disableServerWebpackPlugin: !process.env.CI, // REMOVED in v8+
  disableClientWebpackPlugin: !process.env.CI, // REMOVED in v8+
  hideSourceMaps: true, // REMOVED in v9 (now default behavior)
  disableLogger: true, // REMOVED in v9
});
```

**Why bad:** `disableServerWebpackPlugin`, `disableClientWebpackPlugin` removed in v8, `hideSourceMaps` removed in v9 (SDK emits hidden source maps by default), `disableLogger` removed in v9
