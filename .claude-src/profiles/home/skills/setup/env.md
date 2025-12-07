# Environment Management

> **Quick Guide:** Per-app .env files (apps/client-next/.env). Framework-specific prefixes (NEXT*PUBLIC*\_, VITE\_\_). Zod validation at startup. Maintain .env.example templates. Never commit secrets (.gitignore). Environment-based feature flags.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST validate ALL environment variables with Zod at application startup)**

**(You MUST use framework-specific prefixes for client-side variables - NEXT_PUBLIC_\* for Next.js, VITE_\* for Vite)**

**(You MUST maintain .env.example templates with ALL required variables documented)**

**(You MUST never commit secrets to version control - use .env.local and CI secrets)**

**(You MUST use per-app .env files - NOT root-level .env files)**

</critical_requirements>

---

**Auto-detection:** Environment variables, .env files, Zod validation, secrets management, NEXT*PUBLIC* prefix, VITE\_ prefix, feature flags

**When to use:**

- Setting up Zod validation for type-safe environment variables at startup
- Managing per-app .env files with framework-specific prefixes
- Securing secrets (never commit, use .env.local and CI secrets)
- Implementing environment-based feature flags

**Key patterns covered:**

- Per-app .env files (not root-level, prevents conflicts)
- Zod validation at startup for type safety and early failure
- Framework-specific prefixes (NEXT*PUBLIC*\_ for client, VITE\_\_ for Vite client)
- .env.example templates for documentation and onboarding

---

<philosophy>

## Philosophy

Environment management follows the principle that **configuration is code** - it should be validated, typed, and versioned. The system uses per-app .env files with framework-specific prefixes, Zod validation at startup, and strict security practices to prevent secret exposure.

**When to use this environment management approach:**

- Managing environment-specific configuration (API URLs, feature flags, credentials)
- Setting up type-safe environment variables with Zod validation
- Securing secrets with .gitignore and CI/CD secret management
- Implementing feature flags without external services
- Documenting required environment variables for team onboarding

**When NOT to use:**

- Runtime configuration changes (use external feature flag services like LaunchDarkly)
- User-specific settings (use database or user preferences)
- Frequently changing values (use configuration API or database)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Per-App Environment Files

Each app/package has its own `.env` file to prevent conflicts and clarify ownership.

#### File Structure

```
apps/
├── client-next/
│   ├── .env                    # Local development (NEXT_PUBLIC_API_URL)
│   └── .env.production         # Production overrides
├── client-react/
│   ├── .env                    # Local development
│   └── .env.production         # Production overrides
└── server/
    ├── .env                    # Local server config
    ├── .env.example            # Template for new developers
    └── .env.local.example      # Local overrides template

packages/
├── api/
│   └── .env                    # API package config
└── api-mocks/
    └── .env                    # Mock server config
```

#### File Types and Purpose

1. **`.env`** - Default development values (committed for apps, gitignored for sensitive packages)
2. **`.env.example`** - Documentation template (committed, shows all required variables)
3. **`.env.local`** - Local developer overrides (gitignored, takes precedence over `.env`)
4. **`.env.production`** - Production configuration (committed or in CI secrets)
5. **`.env.local.example`** - Local override template (committed)

#### Loading Order and Precedence

**Next.js loading order (highest to lowest priority):**

1. `.env.$(NODE_ENV).local` (e.g., `.env.production.local`)
2. `.env.local` (not loaded when `NODE_ENV=test`)
3. `.env.$(NODE_ENV)` (e.g., `.env.production`)
4. `.env`

**Vite loading order:**

1. `.env.[mode].local` (e.g., `.env.production.local`)
2. `.env.[mode]` (e.g., `.env.production`)
3. `.env.local`
4. `.env`

**Exception:** Shared variables can go in `turbo.json` `env` array (see setup/monorepo/basic.md)

```typescript
// ✅ Good Example - Per-app environment files
// apps/client-next/.env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

// apps/server/.env.example
# Base configuration
NODE_ENV=development
PORT=1337
```

**Why good:** Per-app configuration prevents conflicts in monorepo, clear defaults reduce onboarding friction, .env.example serves as documentation template

```typescript
// ❌ Bad Example - Root-level .env
// .env (root level - AVOID)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
DATABASE_URL=postgresql://localhost:5432/mydb
PORT=1337
```

**Why bad:** Root-level .env causes shared variables across apps with different needs, larger blast radius when misconfigured, unclear ownership

---

### Pattern 2: Type-Safe Environment Variables with Zod

Validate environment variables at application startup using Zod schemas.

#### Constants

```typescript
const DEFAULT_API_TIMEOUT_MS = 30000;
const DEFAULT_API_RETRY_ATTEMPTS = 3;
```

#### Validation Schema

```typescript
// ✅ Good Example - Zod validation at startup
// lib/env.ts
import { z } from "zod";

const DEFAULT_API_TIMEOUT_MS = 30000;

const envSchema = z.object({
  // Public variables (VITE_ prefix)
  VITE_API_URL: z.string().url(),
  VITE_API_TIMEOUT: z.coerce.number().default(DEFAULT_API_TIMEOUT_MS),
  VITE_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  VITE_ENVIRONMENT: z.enum(["development", "staging", "production"]),

  // Build-time variables
  MODE: z.enum(["development", "production"]),
  DEV: z.boolean(),
  PROD: z.boolean(),
});

// Validate and export
function validateEnv() {
  try {
    return envSchema.parse(import.meta.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid environment variables:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      throw new Error("Invalid environment configuration");
    }
    throw error;
  }
}

export const env = validateEnv();

// Type-safe usage
console.log(env.VITE_API_URL); // string
console.log(env.VITE_API_TIMEOUT); // number
console.log(env.VITE_ENABLE_ANALYTICS); // boolean
```

**Why good:** Type safety prevents runtime errors from typos or wrong types, runtime validation fails fast at startup with clear error messages, default values reduce required configuration, IDE autocomplete improves DX

```typescript
// ❌ Bad Example - No validation
// lib/config.ts
const API_URL = import.meta.env.VITE_API_URL; // Could be undefined!
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT); // Could be NaN!
```

**Why bad:** No validation means runtime failures with unclear error messages, type coercion fails silently (NaN), missing variables only discovered during usage not startup

### Pattern 3: Framework-Specific Naming Conventions

Use framework-specific prefixes for client-side variables and SCREAMING_SNAKE_CASE for all environment variables.

#### Mandatory Conventions

1. **SCREAMING_SNAKE_CASE** - All environment variables use uppercase with underscores
2. **Descriptive names** - Variable names clearly indicate purpose
3. **Framework prefixes** - Use `NEXT_PUBLIC_*` (Next.js) or `VITE_*` (Vite) for client-side variables

#### Framework Prefixes

**Next.js:**
- `NEXT_PUBLIC_*` - Client-side accessible (embedded in bundle) - use for API URLs, public keys, feature flags
- No prefix - Server-side only (database URLs, secret keys, API tokens)

**Vite:**
- `VITE_*` - Client-side accessible (embedded in bundle) - use for API URLs, public configuration
- No prefix - Build-time only (not exposed to client)

**Node.js/Server:**
- `NODE_ENV` - Standard environment (`development`, `production`, `test`)
- `PORT` - Server port number
- No prefix - All variables available server-side

```bash
# ✅ Good Example - Framework-specific prefixes
# apps/client-next/.env

# Client-side variables (embedded in bundle)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_ANALYTICS_ID=UA-123456789-1
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=true

# Server-side variables (not exposed to client)
DATABASE_URL=postgresql://localhost:5432/mydb
API_SECRET_KEY=super-secret-key-12345
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=jwt-secret-key
```

**Why good:** NEXT_PUBLIC_* prefix makes client-side variables explicit preventing accidental secret exposure, server-side variables never embedded in bundle, clear separation improves security

```bash
# ❌ Bad Example - Missing prefixes and poor naming
# .env

# No framework prefix - unclear if client-side
API_URL=http://localhost:3000/api/v1

# Inconsistent casing
apiUrl=https://api.example.com
Database_Url=postgresql://localhost/db

# Unclear names
URL=https://api.example.com
KEY=12345
FLAG=true
```

**Why bad:** Missing framework prefix makes it unclear if variable is client-side or server-side, inconsistent casing reduces readability, unclear names make purpose ambiguous

### Pattern 4: .env.example Templates

Maintain `.env.example` files to document all required variables for team onboarding.

#### Constants

```typescript
const DEFAULT_API_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_DATABASE_POOL_SIZE = 10;
const DEFAULT_CACHE_TTL_SECONDS = 3600;
const DEFAULT_PORT = 3000;
```

#### Template Structure

```bash
# ✅ Good Example - Comprehensive .env.example
# .env.example

# ================================================================
# IMPORTANT: Copy this file to .env and fill in the values
# ================================================================
# cp .env.example .env

# ====================================
# API Configuration (Required)
# ====================================

# Base URL for API requests
# Development: http://localhost:3000/api/v1
# Production: https://api.example.com/api/v1
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# API request timeout in milliseconds (optional, default: 30000)
# Range: 1000-60000
NEXT_PUBLIC_API_TIMEOUT_MS=30000

# Number of retry attempts (optional, default: 3)
NEXT_PUBLIC_API_RETRY_ATTEMPTS=3

# ====================================
# Database Configuration (Server-side)
# ====================================

# PostgreSQL connection string (required for server)
# Format: postgresql://username:password@host:port/database
DATABASE_URL=

# Database pool size (optional, default: 10)
DATABASE_POOL_SIZE=10

# ====================================
# Feature Flags (Optional)
# ====================================

# Enable new dashboard (default: false)
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=false

# ====================================
# Third-Party Services (Optional)
# ====================================

# Stripe public key
# Get from: https://dashboard.stripe.com/apikeys
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=

# Stripe secret key (server-side only)
# ⚠️ NEVER commit this to version control
STRIPE_SECRET_KEY=
```

**Why good:** Grouped related variables for easy navigation, comments explain purpose and format reducing onboarding friction, example values show expected format, links to third-party services speed up setup

```bash
# ❌ Bad Example - Poor .env.example
# .env.example

NEXT_PUBLIC_API_URL=
DATABASE_URL=
STRIPE_SECRET_KEY=
```

**Why bad:** No comments explaining purpose or format, no grouping makes it hard to find related variables, no example values leaving developers guessing, no links to get third-party keys

### Pattern 5: Secret Management

Never commit secrets to version control. Use .gitignore and CI/CD secret management.

#### What are Secrets

- API keys, tokens, passwords
- Database credentials
- Private keys, certificates
- OAuth client secrets
- Encryption keys

#### .gitignore Configuration

```gitignore
# ✅ Good Example - Comprehensive .gitignore
# .gitignore

# Environment files
.env.local
.env.*.local

# Optional: ignore all .env files except example
# .env
# !.env.example

# Sensitive files
*.key
*.pem
*.p12
*.pfx
```

**Why good:** .env.local and .env.*.local patterns prevent committing local secrets, sensitive file extensions (*.key, *.pem) prevent accidental key commits, optional .env ignore with !.env.example allows flexibility

```bash
# ❌ Bad Example - Secrets committed to repository
# .env (committed with actual secrets)
DATABASE_URL=postgresql://admin:SuperSecret123@prod.example.com:5432/mydb
STRIPE_SECRET_KEY=sk_live_actual_secret_key
JWT_SECRET=my-production-jwt-secret

# Committed to git = security breach!
```

**Why bad:** Committing secrets to git exposes them permanently in history, anyone with repo access can extract production credentials, secret rotation requires coordinating with all developers

**When to use:** All projects should have .gitignore configured before first commit

**When not to use:** Never commit .env.local or .env files containing actual secrets (use CI/CD secrets instead)

### Pattern 6: Feature Flags with Environment Variables

Use environment-based boolean feature flags for simple toggles. Upgrade to external services for gradual rollouts and user targeting.

#### Simple Feature Flags

```typescript
// ✅ Good Example - Type-safe feature flags
// lib/feature-flags.ts
export const FEATURES = {
  // Core features
  NEW_DASHBOARD: import.meta.env.VITE_FEATURE_NEW_DASHBOARD === "true",
  BETA_EDITOR: import.meta.env.VITE_FEATURE_BETA_EDITOR === "true",

  // Analytics & Monitoring
  ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === "true",
  ERROR_TRACKING: import.meta.env.VITE_ENABLE_ERROR_TRACKING === "true",

  // Environment-specific
  DEBUG_MODE: import.meta.env.DEV,
  MOCK_API: import.meta.env.VITE_MOCK_API === "true",
} as const;

// Type-safe feature check
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}

export const { NEW_DASHBOARD, BETA_EDITOR, ANALYTICS } = FEATURES;
```

```typescript
// Usage in components
import { NEW_DASHBOARD } from "@/lib/feature-flags";
import { lazy } from "react";

// Code splitting based on feature flag
const Dashboard = NEW_DASHBOARD
  ? lazy(() => import("@/features/dashboard-v2"))
  : lazy(() => import("@/features/dashboard-v1"));
```

**Why good:** Type-safe flags prevent typos, centralized configuration makes flags discoverable, code splitting reduces bundle size for disabled features, no external dependencies reduces complexity

```typescript
// ❌ Bad Example - Inline feature checks
// components/dashboard.tsx
function Dashboard() {
  // Reading env var directly everywhere
  if (process.env.NEXT_PUBLIC_FEATURE_NEW_DASHBOARD === "true") {
    return <NewDashboard />;
  }
  return <LegacyDashboard />;
}
```

**Why bad:** Inline checks scatter feature flag logic across codebase, no type safety means typos fail silently, hard to discover all feature flags, duplicated string comparisons

**When to use:** Simple boolean toggles, offline-first apps, development environment flags

**When not to use:** Need gradual rollouts (5% → 50% → 100%), user targeting required, A/B testing with analytics

### Pattern 7: Environment-Specific Configuration

Create centralized configuration objects with environment-specific overrides.

#### Constants

```typescript
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CACHE_MAX_SIZE = 100;
const DEFAULT_RETRY_ATTEMPTS = 3;
const STAGING_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PRODUCTION_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const PRODUCTION_CACHE_MAX_SIZE = 500;
```

#### Configuration Structure

```typescript
// ✅ Good Example - Centralized config with env overrides
// lib/config.ts
import { env } from "./env";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX_SIZE = 100;
const DEFAULT_RETRY_ATTEMPTS = 3;

interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  features: {
    analytics: boolean;
    errorTracking: boolean;
    debugMode: boolean;
  };
  cache: {
    ttl: number;
    maxSize: number;
  };
}

function getConfig(): AppConfig {
  const baseConfig: AppConfig = {
    api: {
      baseUrl: env.VITE_API_URL,
      timeout: env.VITE_API_TIMEOUT,
      retryAttempts: DEFAULT_RETRY_ATTEMPTS,
    },
    features: {
      analytics: env.VITE_ENABLE_ANALYTICS,
      errorTracking: false,
      debugMode: env.DEV,
    },
    cache: {
      ttl: DEFAULT_CACHE_TTL_MS,
      maxSize: DEFAULT_CACHE_MAX_SIZE,
    },
  };

  // Environment-specific overrides
  const envConfigs: Record<string, Partial<AppConfig>> = {
    development: {
      cache: { ttl: 0, maxSize: 0 }, // No caching in dev
      features: { debugMode: true },
    },
    production: {
      cache: { ttl: 15 * 60 * 1000, maxSize: 500 },
      features: { errorTracking: true, debugMode: false },
    },
  };

  const envOverrides = envConfigs[env.VITE_ENVIRONMENT] || {};

  return {
    ...baseConfig,
    ...envOverrides,
    api: { ...baseConfig.api, ...envOverrides.api },
    features: { ...baseConfig.features, ...envOverrides.features },
    cache: { ...baseConfig.cache, ...envOverrides.cache },
  };
}

export const config = getConfig();
```

```typescript
// Usage
import { config } from "@/lib/config";

fetch(config.api.baseUrl, {
  signal: AbortSignal.timeout(config.api.timeout),
});

if (config.features.analytics) {
  trackEvent("page_view");
}
```

**Why good:** Centralized configuration provides single source of truth for app behavior, environment-specific overrides enable different settings per environment (dev vs prod), type-safe access prevents runtime errors from typos, easy to test with mock config injection

```typescript
// ❌ Bad Example - Scattered configuration
// Multiple files reading env vars directly
// api-client.ts
const timeout = Number(process.env.VITE_API_TIMEOUT);

// analytics.ts
const enabled = process.env.VITE_ENABLE_ANALYTICS === "true";

// cache.ts
const ttl = process.env.VITE_CACHE_TTL || "300000";
```

**Why bad:** Scattered configuration makes it hard to understand app behavior, no centralized type safety, duplicated env var parsing logic, difficult to test or mock

</patterns>

---

<decision_framework>

## Decision Framework

```
Need environment configuration?
├─ Is it a secret (API key, password)?
│   ├─ YES → Use .env.local (gitignored) + CI secrets
│   └─ NO → Can it be public (embedded in client bundle)?
│       ├─ YES → Use NEXT_PUBLIC_* or VITE_* prefix
│       └─ NO → Server-side only (no prefix)
├─ Does it change per environment?
│   ├─ YES → Use .env.{environment} files
│   └─ NO → Use .env with defaults
├─ Does it need validation?
│   ├─ YES → Add to Zod schema (recommended for all)
│   └─ NO → Document in .env.example at minimum
└─ Is it app-specific or shared?
    ├─ App-specific → Per-app .env file
    └─ Shared → Declare in turbo.json env array
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Zod**: Runtime validation and type inference for environment variables
- **Turborepo**: Declare shared env vars in turbo.json for cache invalidation (see setup/monorepo/basic.md)
- **CI/CD**: GitHub Secrets, Vercel Environment Variables for production secrets (see backend/ci-cd/basic.md)
- **Next.js**: Automatic .env file loading with NEXT_PUBLIC_* prefix for client-side
- **Vite**: Automatic .env file loading with VITE_* prefix for client-side

**Replaces / Conflicts with:**

- Hardcoded configuration values (use env vars instead)
- Runtime feature flag services for simple boolean flags (use env vars first, upgrade to LaunchDarkly if needed)

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Committing secrets to version control (.env files with real credentials)
- ❌ Using environment variables directly without Zod validation (causes runtime errors)
- ❌ Using NEXT_PUBLIC_* or VITE_* prefix for secrets (embeds in client bundle)
- ❌ Sharing .env files via Slack/email (insecure secret distribution)

**Medium Priority Issues:**

- ⚠️ Missing .env.example documentation (poor onboarding experience)
- ⚠️ Using production secrets in development (security risk)
- ⚠️ Not rotating secrets regularly (stale credentials)
- ⚠️ Inconsistent variable names across environments (confusion)

**Common Mistakes:**

- Using `process.env.VARIABLE` directly without validation (fails at runtime with unclear errors)
- Forgetting to add new variables to .env.example (team members don't know about them)
- Not using framework-specific prefixes for client-side variables (values are undefined)
- Using root-level .env instead of per-app .env files (conflicts in monorepo)

**Gotchas & Edge Cases:**

- Next.js embeds NEXT_PUBLIC_* variables at build time (not runtime) - requires rebuild to change
- Vite embeds VITE_* variables at build time - same limitation as Next.js
- Environment variables are strings - use z.coerce.number() or z.coerce.boolean() for non-string types
- .env.local takes precedence over .env - can cause confusion when local overrides exist
- Turborepo cache is NOT invalidated by env changes unless declared in turbo.json env array

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST validate ALL environment variables with Zod at application startup)**

**(You MUST use framework-specific prefixes for client-side variables - NEXT_PUBLIC_\* for Next.js, VITE_\* for Vite)**

**(You MUST maintain .env.example templates with ALL required variables documented)**

**(You MUST never commit secrets to version control - use .env.local and CI secrets)**

**(You MUST use per-app .env files - NOT root-level .env files)**

**Failure to follow these rules will cause runtime errors, security vulnerabilities, and configuration confusion.**

</critical_reminders>

