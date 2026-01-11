# Environment Examples

> Complete code examples for environment configuration patterns. See [skill.md](skill.md) for core concepts.

---

## Per-App Environment Files

### Good Example - Per-app environment files

```typescript
// apps/client-next/.env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

// apps/server/.env.example
# Base configuration
NODE_ENV=development
PORT=1337
```

**Why good:** Per-app configuration prevents conflicts in monorepo, clear defaults reduce onboarding friction, .env.example serves as documentation template

### Bad Example - Root-level .env

```typescript
// .env (root level - AVOID)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
DATABASE_URL=postgresql://localhost:5432/mydb
PORT=1337
```

**Why bad:** Root-level .env causes shared variables across apps with different needs, larger blast radius when misconfigured, unclear ownership

---

## Type-Safe Environment Variables with Zod

### Good Example - Zod validation at startup

```typescript
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
      console.error("Invalid environment variables:");
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

### Bad Example - No validation

```typescript
// lib/config.ts
const API_URL = import.meta.env.VITE_API_URL; // Could be undefined!
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT); // Could be NaN!
```

**Why bad:** No validation means runtime failures with unclear error messages, type coercion fails silently (NaN), missing variables only discovered during usage not startup

---

## Framework-Specific Naming Conventions

### Good Example - Framework-specific prefixes

```bash
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

### Bad Example - Missing prefixes and poor naming

```bash
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

---

## .env.example Templates

### Good Example - Comprehensive .env.example

```bash
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
# WARNING: NEVER commit this to version control
STRIPE_SECRET_KEY=
```

**Why good:** Grouped related variables for easy navigation, comments explain purpose and format reducing onboarding friction, example values show expected format, links to third-party services speed up setup

### Bad Example - Poor .env.example

```bash
# .env.example

NEXT_PUBLIC_API_URL=
DATABASE_URL=
STRIPE_SECRET_KEY=
```

**Why bad:** No comments explaining purpose or format, no grouping makes it hard to find related variables, no example values leaving developers guessing, no links to get third-party keys

---

## Secret Management

### Good Example - Comprehensive .gitignore

```gitignore
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

### Bad Example - Secrets committed to repository

```bash
# .env (committed with actual secrets)
DATABASE_URL=postgresql://admin:SuperSecret123@prod.example.com:5432/mydb
STRIPE_SECRET_KEY=sk_live_actual_secret_key
JWT_SECRET=my-production-jwt-secret

# Committed to git = security breach!
```

**Why bad:** Committing secrets to git exposes them permanently in history, anyone with repo access can extract production credentials, secret rotation requires coordinating with all developers

---

## Feature Flags with Environment Variables

### Good Example - Type-safe feature flags

```typescript
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

### Bad Example - Inline feature checks

```typescript
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

---

## Environment-Specific Configuration

### Good Example - Centralized config with env overrides

```typescript
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

### Bad Example - Scattered configuration

```typescript
// Multiple files reading env vars directly
// api-client.ts
const timeout = Number(process.env.VITE_API_TIMEOUT);

// analytics.ts
const enabled = process.env.VITE_ENABLE_ANALYTICS === "true";

// cache.ts
const ttl = process.env.VITE_CACHE_TTL || "300000";
```

**Why bad:** Scattered configuration makes it hard to understand app behavior, no centralized type safety, duplicated env var parsing logic, difficult to test or mock
