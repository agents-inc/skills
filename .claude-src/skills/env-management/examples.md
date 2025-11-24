# Environment Management - Examples

---

## File Hierarchy

### Example: ACTUAL .env Files

**apps/client-next/.env:**

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

**apps/server/.env.example:**

```bash
# base configuration
NODE_ENV=development
PORT=1337
```

**Why:** Per-app configuration. Clear defaults. Template for new developers.

---

### Example: Multiple Environment Files with Loading Order

```
# Project structure
apps/client-react/
├── .env                    # Default values (committed)
├── .env.local              # Local overrides (gitignored)
├── .env.development        # Development defaults
├── .env.staging            # Staging configuration
├── .env.production         # Production configuration
└── .env.example            # Documentation template
```

**Contents:**

```bash
# .env - Default values (committed)
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
VITE_ENABLE_ANALYTICS=false
```

```bash
# .env.local - Local overrides (gitignored)
VITE_API_URL=http://localhost:3001
VITE_ENABLE_ANALYTICS=true
```

```bash
# .env.development - Development defaults
VITE_ENVIRONMENT=development
VITE_API_URL=https://dev-api.example.com
VITE_ENABLE_ERROR_TRACKING=false
```

```bash
# .env.staging - Staging configuration
VITE_ENVIRONMENT=staging
VITE_API_URL=https://staging-api.example.com
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_TRACKING=true
```

```bash
# .env.production - Production configuration
VITE_ENVIRONMENT=production
VITE_API_URL=https://api.example.com
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_TRACKING=true
```

```gitignore
# .gitignore
.env.local
.env.*.local
```

**Why:** Environment-specific configs. Local development flexibility. Secure defaults. Clear separation.

**Edge Cases:**
- Load priority: .env.{mode}.local > .env.{mode} > .env.local > .env
- Never commit secrets
- Document all variables in .env.example

---

### Example: Vite Type-Safe Environment Variables

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  // Public variables (VITE_ prefix)
  VITE_API_URL: z.string().url(),
  VITE_API_TIMEOUT: z.coerce.number().default(30000),
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

```typescript
// env.d.ts - TypeScript types
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_TIMEOUT: number;
  readonly VITE_ENABLE_ANALYTICS: boolean;
  readonly VITE_ENVIRONMENT: "development" | "staging" | "production";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Why:** Type safety. Runtime validation. Clear error messages. IDE autocomplete.

---

## Naming Conventions

### Example: ACTUAL Framework-Specific Prefixes

**Next.js naming patterns:**

```bash
# apps/client-next/.env

# ✅ Client-side variables (embedded in bundle)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_ANALYTICS_ID=UA-123456789-1
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=true

# ✅ Server-side variables (not exposed to client)
DATABASE_URL=postgresql://localhost:5432/mydb
API_SECRET_KEY=super-secret-key-12345
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=jwt-secret-key
```

**Why:**
- `NEXT_PUBLIC_*` variables are embedded in JavaScript bundle
- Server-side variables never exposed to client
- Clear separation prevents accidental secret exposure

**Edge Cases:**
- Never put secrets in `NEXT_PUBLIC_*` variables
- Use `NEXT_PUBLIC_*` for API URLs, feature flags, public config
- Keep database credentials, API keys server-side only

---

### Example: Consistent Grouping by Purpose

```bash
# .env

# ==================
# API Configuration
# ==================
API_BASE_URL=https://api.example.com
API_TIMEOUT_MS=30000
API_RETRY_ATTEMPTS=3
API_RETRY_DELAY_MS=1000

# =====================
# Database Configuration
# =====================
DATABASE_URL=postgresql://localhost:5432/mydb
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_SSL_MODE=require

# =================
# Cache Configuration
# =================
CACHE_REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600
CACHE_MAX_SIZE=1000

# =============
# Feature Flags
# =============
FEATURE_NEW_DASHBOARD=true
FEATURE_BETA_EDITOR=false
FEATURE_AB_TEST_CHECKOUT=true
FEATURE_EXPORT_CSV=true

# =======================
# Third-Party Services
# =======================
STRIPE_PUBLIC_KEY=pk_test_123
STRIPE_SECRET_KEY=sk_test_456
SENDGRID_API_KEY=SG.xxx
SENTRY_DSN=https://xxx@sentry.io/123
GOOGLE_ANALYTICS_ID=UA-123456789-1

# ===================
# Environment Info
# ===================
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

**Why:** Easier to find related variables. Clear separation of concerns. Better documentation.

---

### Example: Naming Anti-Patterns

```bash
# ❌ BAD: Inconsistent casing
apiUrl=https://api.example.com
Database_Url=postgresql://localhost/db
TIMEOUT=30000

# ✅ GOOD: SCREAMING_SNAKE_CASE
API_URL=https://api.example.com
DATABASE_URL=postgresql://localhost/db
API_TIMEOUT_MS=30000

# ❌ BAD: Unclear names
URL=https://api.example.com
KEY=12345
FLAG=true

# ✅ GOOD: Descriptive names
NEXT_PUBLIC_API_URL=https://api.example.com
STRIPE_SECRET_KEY=12345
FEATURE_NEW_DASHBOARD=true

# ❌ BAD: Missing framework prefix
API_URL=https://api.example.com  # Will this be client-side?

# ✅ GOOD: Clear framework prefix
NEXT_PUBLIC_API_URL=https://api.example.com  # Explicitly client-side
VITE_API_URL=https://api.example.com  # Explicitly client-side (Vite)
```

---

## Type-Safe Environment Variables

### Example: ACTUAL Zod Validation (from codebase)

**Client-side validation:**

```typescript
// apps/client-next/app/env.ts (ACTUAL)
import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export function getClientEnv() {
  try {
    const clientEnv = {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NODE_ENV: process.env.NODE_ENV,
    };

    return clientSchema.parse(clientEnv);
  } catch (error) {
    console.error("❌ Invalid client environment variables:", error);
    throw new Error("Invalid client environment configuration");
  }
}
```

**Server-side validation:**

```typescript
// server/env.ts
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  API_SECRET_KEY: z.string().min(32),
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export function getServerEnv() {
  try {
    return serverSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid server environment variables:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      throw new Error("Invalid server environment configuration");
    }
    throw error;
  }
}
```

**Why:** Type safety. Runtime validation. Clear errors. Default values.

---

### Example: Comprehensive Environment Schema

```typescript
// lib/env.ts
import { z } from "zod";

// Environment schema with detailed validation
const envSchema = z.object({
  // API Configuration
  VITE_API_URL: z.string().url("Must be a valid URL"),
  VITE_API_TIMEOUT: z.coerce.number().min(1000).max(60000).default(30000),
  VITE_API_RETRY_ATTEMPTS: z.coerce.number().min(0).max(5).default(3),

  // Environment
  VITE_ENVIRONMENT: z.enum(["development", "staging", "production"]),
  MODE: z.enum(["development", "production"]),

  // Feature Flags
  VITE_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  VITE_ENABLE_ERROR_TRACKING: z.coerce.boolean().default(false),
  VITE_ENABLE_DEBUG_MODE: z.coerce.boolean().default(false),

  // Third-Party Services
  VITE_GOOGLE_ANALYTICS_ID: z.string().regex(/^UA-\d+-\d+$/).optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_STRIPE_PUBLIC_KEY: z.string().startsWith("pk_").optional(),

  // Build-time
  DEV: z.boolean(),
  PROD: z.boolean(),
});

// Infer TypeScript type from schema
export type Env = z.infer<typeof envSchema>;

// Validate and export environment
export const env = envSchema.parse(import.meta.env);
```

**Why:** Detailed validation rules. Type inference. Format validation.

---

### Example: Error Handling with Helpful Messages

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_API_TIMEOUT: z.coerce.number(),
});

function validateEnv() {
  try {
    return envSchema.parse(import.meta.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Invalid environment variables:");
      console.error("");

      error.errors.forEach((err) => {
        const path = err.path.join(".");
        const message = err.message;
        const value = err.path.reduce((obj, key) => obj?.[key], import.meta.env as any);

        console.error(`  Variable: ${path}`);
        console.error(`  Error: ${message}`);
        if (value !== undefined) {
          console.error(`  Current value: ${value}`);
        } else {
          console.error(`  Current value: undefined (missing)`);
        }
        console.error("");
      });

      console.error("Please check your .env file and ensure all variables are correctly set.");
      console.error("See .env.example for reference.");

      throw new Error("Invalid environment configuration");
    }
    throw error;
  }
}

export const env = validateEnv();
```

**Output example:**

```
❌ Invalid environment variables:

  Variable: VITE_API_URL
  Error: Invalid url
  Current value: not-a-url

  Variable: VITE_API_TIMEOUT
  Error: Expected number, received nan
  Current value: invalid

Please check your .env file and ensure all variables are correctly set.
See .env.example for reference.
```

**Why:** Clear error messages. Shows current values. Guides developers to fix issues.

---

## Environment File Templates

### Example: ACTUAL .env.example Template

**Comprehensive .env.example:**

```bash
# .env.example

# ================================================================
# IMPORTANT: Copy this file to .env and fill in the values
# ================================================================
# cp .env.example .env

# ====================================
# Environment
# ====================================

# Node environment (development, production, test)
NODE_ENV=development

# ====================================
# API Configuration (Required)
# ====================================

# Base URL for API requests
# Development: http://localhost:3000/api/v1
# Staging: https://staging-api.example.com/api/v1
# Production: https://api.example.com/api/v1
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# API request timeout in milliseconds (optional, default: 30000)
# Range: 1000-60000
NEXT_PUBLIC_API_TIMEOUT=30000

# Number of retry attempts for failed API requests (optional, default: 3)
# Range: 0-5
NEXT_PUBLIC_API_RETRY_ATTEMPTS=3

# ====================================
# Database Configuration (Server-side only)
# ====================================

# PostgreSQL connection string (required for server)
# Format: postgresql://username:password@host:port/database
# Example: postgresql://postgres:password@localhost:5432/mydb
DATABASE_URL=

# Database connection pool size (optional, default: 10)
DATABASE_POOL_SIZE=10

# ====================================
# Feature Flags (Optional)
# ====================================

# Enable new dashboard (default: false)
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=false

# Enable beta editor (default: false)
NEXT_PUBLIC_FEATURE_BETA_EDITOR=false

# Enable A/B testing (default: false)
NEXT_PUBLIC_FEATURE_AB_TEST=false

# ====================================
# Analytics & Monitoring (Optional)
# ====================================

# Enable analytics tracking (default: false)
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Google Analytics tracking ID
# Get from: https://analytics.google.com/
# Format: UA-XXXXXXXXX-X or G-XXXXXXXXXX
NEXT_PUBLIC_GA_TRACKING_ID=

# Enable error tracking with Sentry (default: false)
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=false

# Sentry DSN for error tracking
# Get from: https://sentry.io/settings/projects/
# Format: https://[key]@[organization].ingest.sentry.io/[project]
SENTRY_DSN=

# ====================================
# Third-Party Services (Optional)
# ====================================

# Stripe public key (for client-side)
# Get from: https://dashboard.stripe.com/apikeys
# Format: pk_test_... (test) or pk_live_... (production)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=

# Stripe secret key (for server-side only)
# Get from: https://dashboard.stripe.com/apikeys
# Format: sk_test_... (test) or sk_live_... (production)
# ⚠️  NEVER commit this to version control
STRIPE_SECRET_KEY=

# SendGrid API key (for email sending)
# Get from: https://app.sendgrid.com/settings/api_keys
# Format: SG.xxxxxxxxxxxxxxxxxxxx
SENDGRID_API_KEY=

# ====================================
# Cache Configuration (Optional)
# ====================================

# Redis connection URL (optional)
# Format: redis://username:password@host:port
REDIS_URL=

# Cache TTL in seconds (default: 3600 = 1 hour)
CACHE_TTL_SECONDS=3600

# ====================================
# Security (Server-side only)
# ====================================

# JWT secret for authentication (required for server)
# Generate a strong random string (min 32 characters)
# Command: openssl rand -base64 32
JWT_SECRET=

# API secret key for server-to-server communication
# Generate a strong random string (min 32 characters)
API_SECRET_KEY=

# ====================================
# Server Configuration (Server-side only)
# ====================================

# Server port (default: 3000)
PORT=3000

# Log level (debug, info, warn, error)
LOG_LEVEL=debug
```

**Why:** Comprehensive documentation. Example values. Links to get keys. Clear comments.

---

### Example: Minimal .env.example

```bash
# .env.example (minimal)

# Required
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# Optional
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

**Why:** Simpler for small projects. Less overwhelming for new developers.

---

## Security Best Practices

### Example: .gitignore Configuration

```gitignore
# .gitignore (ACTUAL recommended)

# Environment files
.env.local
.env.*.local
.env.development.local
.env.test.local
.env.production.local

# Optional: ignore all .env files except example
# Uncomment if you want to be extra safe
# .env
# !.env.example

# Sensitive files
*.key
*.pem
*.p12
*.pfx
*.crt
*.cer
*.der

# Backup files
*.backup
*.bak

# OS files
.DS_Store
Thumbs.db
```

**Why:** Prevents committing secrets. Protects sensitive files.

---

### Example: CI/CD Secret Management (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production # Uses GitHub environment secrets

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build with secrets
        run: bun run build
        env:
          # These are injected from GitHub Secrets
          NEXT_PUBLIC_API_URL: ${{ secrets.PROD_API_URL }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          API_SECRET_KEY: ${{ secrets.API_SECRET_KEY }}
          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Why:** Secrets stored securely in GitHub. Masked in logs. Easy rotation.

---

### Example: Vercel Environment Variables

```bash
# Add secrets via Vercel CLI

# Production environment
vercel env add NEXT_PUBLIC_API_URL production
# Enter value: https://api.example.com/api/v1

vercel env add DATABASE_URL production
# Enter value: postgresql://...

# Preview environment (for pull requests)
vercel env add NEXT_PUBLIC_API_URL preview
# Enter value: https://staging-api.example.com/api/v1

# Development environment
vercel env add NEXT_PUBLIC_API_URL development
# Enter value: http://localhost:3000/api/v1
```

**Why:** Environment-specific values. Easy to manage via CLI or dashboard.

---

### Example: ACTUAL Turborepo Environment Variable Validation

**From turbo.json (RECOMMENDED):**

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": [
        "NEXT_PUBLIC_API_URL",
        "NODE_ENV",
        "DATABASE_URL"
      ],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "env": [
        "NEXT_PUBLIC_API_URL",
        "NODE_ENV"
      ]
    }
  }
}
```

**From packages/eslint-config/base.js (ACTUAL):**

```javascript
export const baseConfig = [
  // ... other configs
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
];
```

**Why:** Catches undeclared variables at lint time. Ensures proper turbo.json configuration.

---

## Feature Flags

### Example: Simple Feature Flags System

```typescript
// lib/feature-flags.ts
export const FEATURES = {
  // Core features
  NEW_DASHBOARD: import.meta.env.VITE_FEATURE_NEW_DASHBOARD === "true",
  BETA_EDITOR: import.meta.env.VITE_FEATURE_BETA_EDITOR === "true",

  // Analytics & Monitoring
  ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === "true",
  ERROR_TRACKING: import.meta.env.VITE_ENABLE_ERROR_TRACKING === "true",

  // A/B Testing
  AB_TEST_CHECKOUT: import.meta.env.VITE_AB_TEST_CHECKOUT === "true",

  // Environment-specific
  DEBUG_MODE: import.meta.env.DEV,
  MOCK_API: import.meta.env.VITE_MOCK_API === "true",
} as const;

// Type-safe feature check
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}

// Export individual flags for convenience
export const {
  NEW_DASHBOARD,
  BETA_EDITOR,
  ANALYTICS,
  ERROR_TRACKING,
  AB_TEST_CHECKOUT,
  DEBUG_MODE,
  MOCK_API,
} = FEATURES;
```

```typescript
// Usage in components
import { FEATURES, NEW_DASHBOARD } from "@/lib/feature-flags";

function Dashboard() {
  if (NEW_DASHBOARD) {
    return <NewDashboard />;
  }

  return <LegacyDashboard />;
}

// Or with dynamic imports for code splitting
import { lazy } from "react";

const Dashboard = FEATURES.NEW_DASHBOARD
  ? lazy(() => import("@/features/dashboard-v2"))
  : lazy(() => import("@/features/dashboard-v1"));
```

**Why:** Easy experimentation. No code deploys for toggles. Type-safe. Simple.

---

### Example: Advanced Feature Flags with LaunchDarkly

```typescript
// lib/launchdarkly.ts
import { LDClient, initialize } from "launchdarkly-js-client-sdk";

const LD_CLIENT_ID = import.meta.env.VITE_LAUNCHDARKLY_CLIENT_ID;

let ldClient: LDClient | null = null;

export async function initFeatureFlags(user: { key: string; email?: string }) {
  ldClient = initialize(LD_CLIENT_ID, {
    key: user.key,
    email: user.email,
  });

  await ldClient.waitForInitialization();

  return ldClient;
}

export function getFeatureFlag(flagKey: string, defaultValue: boolean = false): boolean {
  if (!ldClient) {
    console.warn(`LaunchDarkly not initialized, using default value for ${flagKey}`);
    return defaultValue;
  }

  return ldClient.variation(flagKey, defaultValue);
}

// React hook for feature flags
import { useState, useEffect } from "react";

export function useFeatureFlag(flagKey: string, defaultValue: boolean = false): boolean {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (!ldClient) return;

    // Get initial value
    setValue(ldClient.variation(flagKey, defaultValue));

    // Listen for changes
    const listener = (newValue: boolean) => setValue(newValue);
    ldClient.on(`change:${flagKey}`, listener);

    return () => {
      ldClient?.off(`change:${flagKey}`, listener);
    };
  }, [flagKey, defaultValue]);

  return value;
}
```

```typescript
// Usage in components
import { useFeatureFlag } from "@/lib/launchdarkly";

function Dashboard() {
  const showNewDashboard = useFeatureFlag("new-dashboard", false);

  if (showNewDashboard) {
    return <NewDashboard />;
  }

  return <LegacyDashboard />;
}
```

**Why:** Runtime toggling. Gradual rollouts. User targeting. A/B testing.

---

## Configuration by Environment

### Example: Centralized Configuration Object

```typescript
// lib/config.ts
import { env } from "./env";

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
  performance: {
    imageLazyLoading: boolean;
    codeSplitting: boolean;
  };
}

function getConfig(): AppConfig {
  const baseConfig: AppConfig = {
    api: {
      baseUrl: env.VITE_API_URL,
      timeout: env.VITE_API_TIMEOUT,
      retryAttempts: 3,
    },
    features: {
      analytics: env.VITE_ENABLE_ANALYTICS,
      errorTracking: false,
      debugMode: env.DEV,
    },
    cache: {
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
    },
    performance: {
      imageLazyLoading: true,
      codeSplitting: true,
    },
  };

  // Environment-specific overrides
  const envConfigs: Record<string, Partial<AppConfig>> = {
    development: {
      cache: {
        ttl: 0, // No caching in dev
        maxSize: 0,
      },
      features: {
        errorTracking: false,
        debugMode: true,
      },
      performance: {
        imageLazyLoading: false, // Easier debugging
      },
    },
    staging: {
      features: {
        errorTracking: true,
      },
      cache: {
        ttl: 10 * 60 * 1000, // 10 minutes
      },
    },
    production: {
      cache: {
        ttl: 15 * 60 * 1000, // 15 minutes
        maxSize: 500,
      },
      features: {
        errorTracking: true,
        debugMode: false,
      },
    },
  };

  const envOverrides = envConfigs[env.VITE_ENVIRONMENT] || {};

  // Deep merge base config with environment overrides
  return {
    ...baseConfig,
    ...envOverrides,
    api: { ...baseConfig.api, ...envOverrides.api },
    features: { ...baseConfig.features, ...envOverrides.features },
    cache: { ...baseConfig.cache, ...envOverrides.cache },
    performance: { ...baseConfig.performance, ...envOverrides.performance },
  };
}

export const config = getConfig();
```

```typescript
// Usage
import { config } from "@/lib/config";

// API configuration
fetch(config.api.baseUrl, {
  signal: AbortSignal.timeout(config.api.timeout),
});

// Feature flags
if (config.features.analytics) {
  trackEvent("page_view");
}

// Cache configuration
const cache = new LRUCache({
  max: config.cache.maxSize,
  ttl: config.cache.ttl,
});
```

**Why:** Centralized configuration. Environment-specific behavior. Type-safe access. Easy to test.
