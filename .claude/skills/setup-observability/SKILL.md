# Observability Setup (Pino + Axiom + Sentry)

> **Quick Guide:** One-time project setup for observability. Install `pino`, `next-axiom`, `@sentry/nextjs`. Configure Axiom dataset + Vercel integration. Set up Sentry DSN and config files. Wrap `next.config.js` with `withAxiom`. Add source maps upload to GitHub Actions.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST create separate Axiom datasets for each environment - development, staging, production)**

**(You MUST use `NEXT_PUBLIC_` prefix for client-side Axiom token but NEVER for Sentry DSN in production)**

**(You MUST configure all three Sentry config files - `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`)**

**(You MUST add source maps upload to CI/CD - Sentry needs source maps for readable stack traces)**

**(You MUST install `pino-pretty` as a devDependency only - never use in production)**

</critical_requirements>

---

**Auto-detection:** pino, next-axiom, @sentry/nextjs, Axiom, Sentry, observability, logging, error tracking, source maps, health check

**When to use:**

- Setting up a new Next.js application that needs logging and error tracking
- Adding observability to an existing project without it
- Migrating from another logging/error tracking solution to Axiom + Sentry

**When NOT to use:**

- Adding new log statements to existing code (use `backend/observability.md` instead)
- Configuring alerts and monitors (use `backend/observability.md` instead)
- Debugging production issues (use `backend/observability.md` instead)

**Key patterns covered:**

- Dependency installation (Pino, next-axiom, @sentry/nextjs, pino-pretty)
- Environment variables template (`.env.example`)
- Axiom dataset creation and Vercel integration
- Sentry project setup with DSN configuration
- `next.config.js` with `withAxiom()` wrapper
- Sentry configuration files (client, server, edge)
- `instrumentation.ts` for Sentry initialization
- GitHub Actions for source maps upload
- Health check endpoint for Hono API
- Initial Axiom dashboard setup

---

<philosophy>

## Philosophy

**Observability is not optional for production apps.** Without logging and error tracking, debugging production issues becomes guesswork. The Pino + Axiom + Sentry stack provides:

- **Pino**: Fast structured JSON logging (5x faster than Winston)
- **Axiom**: Unified logs, traces, and metrics with 1TB free tier and Vercel integration
- **Sentry**: Best-in-class error tracking with source maps and release tracking

**This skill covers one-time setup. For ongoing usage patterns (log levels, structured fields, correlation IDs), see `backend/observability.md`.**

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Dependency Installation

Install all observability packages with correct dependency types.

```bash
# ✅ Good Example - Production dependencies
npm install pino next-axiom @sentry/nextjs

# Development dependencies (pretty printing for local dev)
npm install -D pino-pretty
```

**Why good:** `pino-pretty` as devDependency prevents production bundle bloat, all core packages are production dependencies for runtime use

```bash
# ❌ Bad Example - pino-pretty as production dependency
npm install pino pino-pretty next-axiom @sentry/nextjs
```

**Why bad:** `pino-pretty` adds ~500KB to production bundle unnecessarily, degrades performance in production where JSON logs should be sent directly to Axiom

---

### Pattern 2: Environment Variables Template

Create `.env.example` with all required observability variables documented.

**File: `apps/client-next/.env.example`**

```bash
# ✅ Good Example - Complete observability env template
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
# ❌ Bad Example - Incomplete template
AXIOM_TOKEN=
SENTRY_DSN=
```

**Why bad:** Missing `NEXT_PUBLIC_` prefix means variables undefined in client, no documentation for where to get values, no dataset separation per environment

---

### Pattern 3: next.config.js with withAxiom

Wrap Next.js config with `withAxiom` for automatic logging integration.

**File: `apps/client-next/next.config.js`**

```javascript
// ✅ Good Example - withAxiom wrapper with Sentry
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
// ❌ Bad Example - Missing wrappers
/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
};
```

**Why bad:** No Axiom integration means logs don't reach Axiom, no Sentry integration means source maps not uploaded and errors not tracked

---

### Pattern 4: Sentry Configuration Files

Create all three Sentry config files for client, server, and edge runtimes.

**File: `apps/client-next/sentry.client.config.ts`**

```typescript
// ✅ Good Example - Client-side Sentry config
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT || "development";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0-local";

const SAMPLE_RATE_DEVELOPMENT = 1.0;
const SAMPLE_RATE_PRODUCTION = 0.1;
const TRACES_SAMPLE_RATE = 0.2;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  release: APP_VERSION,

  // Sample rate for error events (1.0 = 100%)
  sampleRate: ENVIRONMENT === "production" ? SAMPLE_RATE_PRODUCTION : SAMPLE_RATE_DEVELOPMENT,

  // Sample rate for performance transactions
  tracesSampleRate: TRACES_SAMPLE_RATE,

  // Enable debug in development
  debug: ENVIRONMENT === "development",

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Replay settings
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Filter out expected errors
  beforeSend(event, hint) {
    // Ignore cancelled requests
    if (event.exception?.values?.[0]?.value?.includes("AbortError")) {
      return null;
    }
    return event;
  },
});
```

**Why good:** Named constants for sample rates, environment-specific configuration, replay integration for debugging user sessions, `beforeSend` filters expected errors to reduce noise

**File: `apps/client-next/sentry.server.config.ts`**

```typescript
// ✅ Good Example - Server-side Sentry config
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT || "development";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0-local";

const TRACES_SAMPLE_RATE = 0.2;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  release: APP_VERSION,

  tracesSampleRate: TRACES_SAMPLE_RATE,

  // Enable debug in development
  debug: ENVIRONMENT === "development",

  // Server-specific: capture more context
  includeLocalVariables: true,
});
```

**File: `apps/client-next/sentry.edge.config.ts`**

```typescript
// ✅ Good Example - Edge runtime Sentry config
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT || "development";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0-local";

const TRACES_SAMPLE_RATE = 0.2;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  release: APP_VERSION,

  tracesSampleRate: TRACES_SAMPLE_RATE,

  // Edge runtime has limited features
  debug: false,
});
```

```typescript
// ❌ Bad Example - Single config for all runtimes
// sentry.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://xxx@sentry.io/123", // Hardcoded DSN
  tracesSampleRate: 1.0, // Magic number, too high for production
});
```

**Why bad:** Single config doesn't handle different runtime requirements, hardcoded DSN is a security risk and prevents environment separation, 100% trace rate overwhelms Sentry quota in production

---

### Pattern 5: Instrumentation File

Create `instrumentation.ts` for proper Sentry initialization in Next.js.

**File: `apps/client-next/instrumentation.ts`**

```typescript
// ✅ Good Example - Instrumentation for Sentry
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js 15+ error handling hook
export const onRequestError = Sentry.captureRequestError;
```

**Why good:** Dynamic imports prevent loading wrong config for runtime, `onRequestError` hook captures Server Component errors automatically (Next.js 15+)

---

### Pattern 6: Web Vitals Component

Add Web Vitals tracking to your root layout.

**File: `apps/client-next/app/layout.tsx`**

```typescript
// ✅ Good Example - Web Vitals in root layout
import { AxiomWebVitals } from "next-axiom";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AxiomWebVitals />
        {children}
      </body>
    </html>
  );
}
```

**Why good:** `AxiomWebVitals` component automatically reports Core Web Vitals (LCP, FID, CLS) to Axiom, no additional configuration needed

**Note:** Web Vitals are only sent from production deployments, not local development.

---

### Pattern 7: GitHub Actions Source Maps Upload

Configure CI/CD to upload source maps to Sentry on deployment.

**File: `.github/workflows/deploy.yml`**

```yaml
# ✅ Good Example - Source maps upload in GitHub Actions
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

```yaml
# ❌ Bad Example - Missing source maps configuration
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

---

### Pattern 8: Health Check Endpoint for Hono

Add health check endpoints for monitoring and load balancer integration.

**File: `apps/client-next/app/api/health/route.ts`**

```typescript
// ✅ Good Example - Health check endpoint
import { NextResponse } from "next/server";

const HTTP_STATUS_OK = 200;

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
    },
    { status: HTTP_STATUS_OK }
  );
}
```

**File: `packages/api/src/routes/health.ts` (for Hono API)**

```typescript
// ✅ Good Example - Hono health check with dependency checks
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { db } from "@/lib/db";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HEALTH_CHECK_TIMEOUT_MS = 5000;

const HealthStatusSchema = z
  .object({
    status: z.enum(["healthy", "unhealthy"]),
    timestamp: z.string(),
    version: z.string(),
    dependencies: z
      .object({
        database: z.enum(["connected", "disconnected"]),
      })
      .optional(),
  })
  .openapi("HealthStatus");

const app = new OpenAPIHono();

// Shallow health check (fast, for load balancers)
const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  tags: ["Health"],
  responses: {
    200: {
      description: "Service is healthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
  },
});

app.openapi(healthRoute, async (c) => {
  return c.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || "unknown",
    },
    HTTP_STATUS_OK
  );
});

// Deep health check (with dependency checks)
const healthDeepRoute = createRoute({
  method: "get",
  path: "/health/deep",
  operationId: "getHealthDeep",
  tags: ["Health"],
  responses: {
    200: {
      description: "Service and dependencies healthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
    503: {
      description: "Service unhealthy",
      content: { "application/json": { schema: HealthStatusSchema } },
    },
  },
});

app.openapi(healthDeepRoute, async (c) => {
  let dbStatus: "connected" | "disconnected" = "disconnected";

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), HEALTH_CHECK_TIMEOUT_MS)
    );

    await Promise.race([db.execute("SELECT 1"), timeoutPromise]);
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  const isHealthy = dbStatus === "connected";

  return c.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || "unknown",
      dependencies: {
        database: dbStatus,
      },
    },
    isHealthy ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE
  );
});

export { app as healthRoutes };
```

**Why good:** Two endpoints - shallow for frequent LB checks, deep for thorough monitoring, timeout prevents health check from hanging indefinitely, returns 503 when unhealthy so LB routes traffic elsewhere

---

### Pattern 9: Pino Logger Setup for Hono

Configure Pino with development/production modes for Hono API routes.

**File: `packages/api/src/lib/logger.ts`**

```typescript
// ✅ Good Example - Pino logger configuration
import pino from "pino";

const LOG_LEVEL_DEVELOPMENT = "debug";
const LOG_LEVEL_PRODUCTION = "info";

const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino({
  level: isDevelopment ? LOG_LEVEL_DEVELOPMENT : LOG_LEVEL_PRODUCTION,

  // Use pino-pretty in development only
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Base fields included in every log
  base: {
    service: "api",
    version: process.env.APP_VERSION || "unknown",
  },

  // Redact sensitive fields
  redact: ["req.headers.authorization", "req.headers.cookie", "password", "token", "apiKey"],
});

// Create child logger for specific context
export const createLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};
```

**Why good:** Development gets pretty-printed logs for readability, production gets JSON for Axiom ingestion, base fields provide context in every log, sensitive fields redacted automatically

```typescript
// ❌ Bad Example - pino-pretty in production
import pino from "pino";

export const logger = pino({
  transport: {
    target: "pino-pretty", // Always pretty - BAD in production
  },
});
```

**Why bad:** pino-pretty adds significant overhead in production, defeats Pino's performance advantages, should be development-only

---

### Pattern 10: Axiom Dashboard Setup

After setting up, create an initial dashboard in Axiom for monitoring.

**Dashboard Components to Create:**

1. **Request Volume** - Count of requests over time
2. **Error Rate** - Percentage of 4xx/5xx responses
3. **Response Time P95** - 95th percentile latency
4. **Top Errors** - Most frequent error messages
5. **Web Vitals** - LCP, FID, CLS metrics

**Axiom APL Queries:**

```apl
// Request volume per minute
['myapp-prod']
| summarize count() by bin_auto(_time)

// Error rate
['myapp-prod']
| where level == "error"
| summarize errors = count() by bin(_time, 1m)

// Response time P95
['myapp-prod']
| where isnotnull(duration)
| summarize p95 = percentile(duration, 95) by bin(_time, 5m)

// Top errors
['myapp-prod']
| where level == "error"
| summarize count() by message
| top 10 by count_
```

</patterns>

---

<decision_framework>

## Decision Framework

### Choosing Log Destinations

```
Where should logs go?
├─ Local development?
│   ├─ Console with pino-pretty (human readable)
│   └─ Optionally also to local Axiom dataset
├─ CI/Test environment?
│   ├─ Console only (JSON format)
│   └─ No external services (fast, isolated)
└─ Production?
    ├─ Axiom (primary - searchable, dashboards)
    └─ Console (fallback - captured by hosting platform)
```

### Sentry vs Axiom for Errors

```
Where should errors go?
├─ Application errors (exceptions, crashes)?
│   └─ Sentry (source maps, stack traces, releases)
├─ Expected errors (404s, validation)?
│   └─ Axiom logs (don't pollute Sentry quota)
└─ Performance issues?
    └─ Axiom traces (longer retention, cheaper)
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **backend/api.md**: Hono health check endpoints, logging middleware
- **backend/database.md**: Database connection health checks
- **setup/env.md**: Environment variable patterns for secrets
- **backend/ci-cd.md**: GitHub Actions source maps upload

**Replaces:**

- console.log debugging (use structured logging instead)
- Manual error tracking (Sentry automates this)
- Custom logging solutions (standardize on Pino + Axiom)

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Committing Axiom tokens or Sentry DSN to version control
- Using pino-pretty in production (performance degradation)
- Missing source maps upload (unreadable stack traces in Sentry)
- Same Axiom dataset for all environments (data mixing)
- Missing `sentry.edge.config.ts` (middleware errors not tracked)

**Medium Priority Issues:**

- No health check endpoints (can't monitor service status)
- 100% trace sample rate in production (expensive, unnecessary)
- Missing `beforeSend` filter (noise from expected errors)
- No Web Vitals tracking (missing performance insights)

**Common Mistakes:**

- Forgetting to wrap `next.config.js` with `withAxiom`
- Using `SENTRY_DSN` without `NEXT_PUBLIC_` prefix (undefined in client)
- Not setting `hideSourceMaps: true` (source code exposed)
- Missing `instrumentation.ts` (Sentry not initialized properly)
- Hardcoding sample rates instead of using named constants

**Gotchas & Edge Cases:**

- Web Vitals only sent in production, not development
- Source maps upload requires `CI=true` environment variable
- Edge runtime has limited Sentry features (no replay)
- Axiom token needs ingest permission for the specific dataset
- Sentry auth token needs `project:releases` and `org:read` scopes

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Hardcoded Credentials

```typescript
// ❌ ANTI-PATTERN: Hardcoded DSN
Sentry.init({
  dsn: "https://abc123@sentry.io/456789",
});
```

**Why it's wrong:** Credentials in code get committed to git, can't rotate without code change.

**What to do instead:** Use environment variables: `process.env.NEXT_PUBLIC_SENTRY_DSN`

---

### pino-pretty in Production

```typescript
// ❌ ANTI-PATTERN: Always using pino-pretty
import pino from "pino";

export const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});
```

**Why it's wrong:** pino-pretty is slow, adds ~500KB, defeats Pino's performance benefits.

**What to do instead:** Conditionally use pino-pretty only when `NODE_ENV === 'development'`

---

### Missing Environment Separation

```bash
# ❌ ANTI-PATTERN: Same dataset for all environments
NEXT_PUBLIC_AXIOM_DATASET=myapp
```

**Why it's wrong:** Development logs mixed with production, hard to filter, pollutes dashboards.

**What to do instead:** Use `myapp-dev`, `myapp-staging`, `myapp-prod`

---

### No Source Maps in CI

```yaml
# ❌ ANTI-PATTERN: Build without source maps
- run: npm run build
# No SENTRY_AUTH_TOKEN, no CI=true
```

**Why it's wrong:** Sentry shows minified code in stack traces, impossible to debug.

**What to do instead:** Set `CI=true` and provide Sentry secrets in GitHub Actions.

</anti_patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST create separate Axiom datasets for each environment - development, staging, production)**

**(You MUST use `NEXT_PUBLIC_` prefix for client-side Axiom token but NEVER for Sentry DSN in production)**

**(You MUST configure all three Sentry config files - `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`)**

**(You MUST add source maps upload to CI/CD - Sentry needs source maps for readable stack traces)**

**(You MUST install `pino-pretty` as a devDependency only - never use in production)**

**Failure to follow these rules will result in missing logs, unreadable errors, and security vulnerabilities.**

</critical_reminders>
