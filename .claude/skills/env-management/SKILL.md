# Environment Management

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

# Environment Management

> **Quick Guide:** Per-app .env files (apps/client-next/.env). Framework-specific prefixes (NEXT*PUBLIC*\_, VITE\_\_). Zod validation at startup. Maintain .env.example templates. Never commit secrets (.gitignore). Environment-based feature flags.

**ACTUAL IMPLEMENTATION: Per-app `.env` files with Zod validation**

---

## File Hierarchy

**ACTUAL PATTERN: Per-app environment files**

**Location:** Each app/package has its own `.env` file

### File Structure

**Actual files in this codebase:**

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

### File Types and Purpose

**File types:**

1. **`.env`** - Default development values (committed for apps, gitignored for sensitive packages)

   - Contains non-sensitive defaults
   - Used for local development
   - Framework-specific prefixes for client-side variables

2. **`.env.example`** - Documentation template (committed)

   - Shows all required variables (no values)
   - Includes comments explaining each variable
   - Used for onboarding new developers

3. **`.env.local`** - Local developer overrides (gitignored)

   - Personal development settings
   - Never committed
   - Takes precedence over `.env`

4. **`.env.production`** - Production configuration (committed or in CI secrets)

   - Production-specific values (URLs, feature flags)
   - Sensitive values stored in CI secrets
   - Loaded during production builds

5. **`.env.local.example`** - Local override template (committed)
   - Shows example local overrides
   - Helps developers configure local environment

### Loading Order and Precedence

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

**Best practice:**

- Use `.env` for defaults (committed)
- Use `.env.local` for personal overrides (gitignored)
- Use `.env.production` for production config (committed or CI secrets)
- Never commit secrets (use CI secrets or secret management service)

### Per-App vs Root Environment Files

**Pattern: Per-app environment files (ACTUAL IMPLEMENTATION)**

Per-app prevents conflicts, clarifies ownership. Root-level causes shared variables and larger blast radius.

**Exception:** Shared variables can go in `turbo.json` `env` array

---

## Naming Conventions

**ACTUAL IMPLEMENTATION: Framework-specific prefixes**

### Variable Naming Rules

**Mandatory conventions:**

1. **SCREAMING_SNAKE_CASE** - All environment variables must use uppercase with underscores

   ```bash
   # ✅ GOOD
   NEXT_PUBLIC_API_URL=https://api.example.com
   DATABASE_URL=postgresql://localhost:5432/mydb

   # ❌ BAD
   apiUrl=https://api.example.com
   database_url=postgresql://localhost:5432/mydb
   ```

2. **Descriptive names** - Variable names should clearly indicate purpose

   ```bash
   # ✅ GOOD
   NEXT_PUBLIC_API_URL=https://api.example.com
   NEXT_PUBLIC_API_TIMEOUT_MS=30000

   # ❌ BAD
   URL=https://api.example.com
   TIMEOUT=30000
   ```

3. **Consistent prefixes** - Use framework prefixes for client-side variables

   ```bash
   # Next.js - NEXT_PUBLIC_*
   NEXT_PUBLIC_API_URL=https://api.example.com
   NEXT_PUBLIC_ANALYTICS_ID=UA-123456

   # Vite - VITE_*
   VITE_API_URL=https://api.example.com
   VITE_ANALYTICS_ID=UA-123456
   ```

### Framework-Specific Prefixes

**Next.js variables:**

- **`NEXT_PUBLIC_*`** - Client-side accessible (embedded in bundle)

  - Use for: API URLs, public keys, feature flags
  - Avoid: Secrets, API keys, tokens

- **No prefix** - Server-side only
  - Use for: Database URLs, secret keys, API tokens
  - Never exposed to client

**Example:**

```bash
# Client-side (embedded in JavaScript bundle)
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=UA-123456

# Server-side only (not embedded in bundle)
DATABASE_URL=postgresql://localhost:5432/mydb
API_SECRET_KEY=super-secret-key
```

**Vite variables:**

- **`VITE_*`** - Client-side accessible (embedded in bundle)

  - Use for: API URLs, public configuration
  - Avoid: Secrets

- **No prefix** - Build-time only (not exposed)
  - Use for: Build configuration, secrets

**Node.js/Server variables:**

- **`NODE_ENV`** - Standard Node.js environment (`development`, `production`, `test`)
- **`PORT`** - Server port number
- **No prefix** - All variables available server-side

### Grouping by Purpose

**Pattern: Use consistent prefixes for related variables**

```bash
# API configuration
API_BASE_URL=https://api.example.com
API_TIMEOUT_MS=30000
API_RETRY_ATTEMPTS=3

# Database configuration
DATABASE_URL=postgresql://localhost:5432/mydb
DATABASE_POOL_SIZE=10
DATABASE_SSL_MODE=require

# Feature flags
FEATURE_NEW_DASHBOARD=true
FEATURE_BETA_EDITOR=false
FEATURE_AB_TEST_CHECKOUT=true

# Third-party services
STRIPE_PUBLIC_KEY=pk_test_123
STRIPE_SECRET_KEY=sk_test_456
SENTRY_DSN=https://...
```

**Benefits:**

- Easier to find related variables
- Clear separation of concerns
- Easier to document

---

## Type-Safe Environment Variables

**ACTUAL IMPLEMENTATION: Zod validation (apps/client-next/app/env.ts)**

### Validation Pattern

**Pattern: Validate environment variables at startup with Zod**

**Why validate:**

- Catch missing variables early (at startup, not runtime)
- Enforce correct types (URL, number, boolean, enum)
- Provide helpful error messages
- Single source of truth for environment schema

**Benefits:**

- ✅ Type safety (TypeScript knows variable types)
- ✅ Runtime validation (fails fast with clear errors)
- ✅ Default values (optional variables with defaults)
- ✅ Format validation (URLs must be valid URLs)

### Validation Location

**Where to validate:**

1. **Client-side variables** - Validate in `app/env.ts` or `src/lib/env.ts`
2. **Server-side variables** - Validate in server entry point
3. **Shared variables** - Validate in shared package

**When to validate:**

- ✅ At app startup (before rendering)
- ✅ In provider setup (before API client initialization)
- ❌ Not during import (can cause circular dependencies)

### Error Handling

**Pattern: Fail fast with helpful errors**

```typescript
// ✅ GOOD: Clear error message, fail fast
try {
  return schema.parse(env);
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

// ❌ BAD: Silent failure or unclear error
return schema.parse(env); // Throws cryptic Zod error
```

**Benefits:**

- Clear error messages for developers
- Identifies exactly which variable is invalid
- Suggests correct format

---

## Environment File Templates

**RECOMMENDED: Maintain `.env.example` for documentation**

### Template Structure

**Pattern: Document all variables with comments**

```bash
# .env.example

# ===================
# API Configuration
# ===================

# Base URL for API requests (required)
# Development: http://localhost:3000/api/v1
# Production: https://api.example.com/api/v1
NEXT_PUBLIC_API_URL=

# API request timeout in milliseconds (optional, default: 30000)
NEXT_PUBLIC_API_TIMEOUT_MS=30000

# ===================
# Feature Flags
# ===================

# Enable analytics tracking (optional, default: false)
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Enable error tracking with Sentry (optional, default: false)
NEXT_PUBLIC_ENABLE_ERROR_TRACKING=false

# ===================
# Third-Party Services
# ===================

# Google Analytics tracking ID (optional)
# Get from: https://analytics.google.com
NEXT_PUBLIC_GA_TRACKING_ID=

# Sentry DSN for error tracking (optional)
# Get from: https://sentry.io/settings/projects/
SENTRY_DSN=
```

**Template best practices:**

- Group related variables
- Include comments explaining purpose
- Show example values
- Indicate required vs optional
- Link to documentation for third-party services
- No actual values (just placeholders)

### Onboarding Process

**Recommended onboarding steps:**

1. **Clone repository**
2. **Copy `.env.example` to `.env`**
   ```bash
   cp .env.example .env
   ```
3. **Fill in required values**
   - API URLs (usually localhost for development)
   - Service keys (get from team or create new)
4. **Run application**
   - Validation will catch missing required variables

**Documentation:**

- README should mention environment setup
- Link to `.env.example` file
- Document where to get third-party service keys
- Include troubleshooting guide

---

## Security Best Practices

**CRITICAL: Never commit secrets to repository**

### Secret Management

**What are secrets:**

- API keys, tokens, passwords
- Database credentials
- Private keys, certificates
- OAuth client secrets
- Encryption keys

**What NOT to commit:**

- ❌ `.env.local` (local secrets)
- ❌ `.env.production` with real secrets
- ❌ Any file containing actual credentials

**What to commit:**

- ✅ `.env` with non-sensitive defaults
- ✅ `.env.example` with placeholders
- ✅ `.env.production` with variable names only (values in CI)

### .gitignore Configuration

**Recommended .gitignore:**

```gitignore
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

### CI/CD Secret Management

**Pattern: Store secrets in CI/CD platform**

**GitHub Actions:**

- Use GitHub Secrets (Settings → Secrets and variables → Actions)
- Access via `${{ secrets.SECRET_NAME }}`
- Secrets are encrypted and masked in logs

**Vercel:**

- Use Vercel Environment Variables (Project Settings → Environment Variables)
- Separate values per environment (production, preview, development)
- Access via CLI: `vercel env add VARIABLE_NAME production`

**Best practices:**

- Use different secrets per environment (staging vs production)
- Rotate secrets regularly (quarterly minimum)
- Use least-privilege access (separate secrets for each service)
- Never share secrets in chat or email
- Use secret scanning (GitHub Advanced Security, TruffleHog)

### Secret Rotation

**Recommended rotation schedule:**

- **Critical secrets** - Quarterly or on team member departure
- **API keys** - Annually or on suspicious activity
- **Passwords** - Every 90 days (or use OAuth)

**Rotation process:**

1. Generate new secret
2. Add to CI/CD platform
3. Deploy with new secret
4. Monitor for issues
5. Revoke old secret

### Turbo Environment Variable Validation

**ACTUAL IMPLEMENTATION: Turborepo plugin validates env vars**

**Pattern: Declare environment variables in turbo.json**

```json
{
  "tasks": {
    "build": {
      "env": ["NEXT_PUBLIC_API_URL", "NODE_ENV", "DATABASE_URL"]
    }
  }
}
```

**ESLint validation:**

```javascript
// packages/eslint-config/base.js
{
  plugins: {
    turbo: turboPlugin,
  },
  rules: {
    "turbo/no-undeclared-env-vars": "warn",
  },
}
```

**Why:**

- Catches undeclared environment variables at lint time
- Ensures variables are properly declared in turbo.json
- Prevents accidental reliance on undeclared variables

---

## Feature Flags

**RECOMMENDED: Environment-based feature flags**

### Simple Feature Flags

**Pattern: Boolean environment variables**

```bash
# .env
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=false
NEXT_PUBLIC_FEATURE_BETA_EDITOR=false
NEXT_PUBLIC_FEATURE_AB_TEST=true
```

**Usage:**

```typescript
const FEATURES = {
  NEW_DASHBOARD: process.env.NEXT_PUBLIC_FEATURE_NEW_DASHBOARD === 'true',
  BETA_EDITOR: process.env.NEXT_PUBLIC_FEATURE_BETA_EDITOR === 'true',
  AB_TEST: process.env.NEXT_PUBLIC_FEATURE_AB_TEST === 'true',
} as const;

// Use in components
if (FEATURES.NEW_DASHBOARD) {
  return <NewDashboard />;
}
```

**Benefits:**

- Simple to implement
- No external dependencies
- Works offline
- Fast (no API calls)

**Limitations:**

- Requires rebuild to change flags
- No gradual rollouts (0% or 100%)
- No user targeting
- No runtime toggling

### Advanced Feature Flags

**When to use external service:**

Use services like LaunchDarkly, PostHog, or Unleash when you need:

- Runtime flag toggling (no deploys)
- Gradual rollouts (5% → 25% → 50% → 100%)
- User targeting (beta users, specific companies)
- A/B testing with analytics
- Scheduled releases

**Trade-offs:**

- ✅ No deploys needed to toggle flags
- ✅ Gradual rollouts reduce risk
- ✅ User targeting for beta testing
- ❌ Additional dependency
- ❌ Requires internet connection
- ❌ Cost (most services are paid)

### Feature Flag Hygiene

**Best practices:**

- Clean up old flags (remove after full rollout)
- Document flag dependencies (flag A requires flag B)
- Test both enabled and disabled states
- Use TypeScript for type-safe flags
- Monitor flag usage (which flags are actively used)

**Anti-patterns:**

- ❌ Too many nested flags (complex logic)
- ❌ Flags that never get removed (technical debt)
- ❌ Flags without documentation
- ❌ Flags that depend on each other (complex dependencies)

---

## Configuration by Environment

**RECOMMENDED: Environment-specific configuration object**

### Configuration Pattern

**Pattern: Single configuration object with environment overrides**

**Why:**

- Centralized configuration
- Type-safe access
- Easy to test
- Clear environment differences

**Structure:**

1. Base configuration (shared across environments)
2. Environment-specific overrides (development, staging, production)
3. Merge into single config object

### Configuration Categories

**Common configuration categories:**

1. **API Configuration**

   - Base URL
   - Timeout
   - Retry attempts
   - Rate limits

2. **Cache Configuration**

   - TTL (time to live)
   - Max size
   - Eviction policy

3. **Feature Configuration**

   - Feature flags
   - Analytics
   - Error tracking

4. **Performance Configuration**
   - Bundle size limits
   - Image optimization
   - Lazy loading thresholds

### Environment Detection

**Pattern: Detect environment from env variable**

```typescript
const ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = ENV === "production";
const IS_DEVELOPMENT = ENV === "development";
const IS_TEST = ENV === "test";
```

**Next.js environments:**

- `development` - Local development (`next dev`)
- `production` - Production build (`next build` + `next start`)
- `test` - Testing environment (Vitest, Jest)

---

## Common Anti-Patterns

**❌ NEVER do these:**

- Committing secrets to repository (use .gitignore)
- Using `process.env.VARIABLE` directly without validation
- Hardcoding environment values in code
- Sharing `.env` files via Slack/email
- Using production secrets in development
- Not documenting variables in `.env.example`
- Skipping validation (missing variables cause runtime errors)
- Using different variable names across environments
- Not rotating secrets
- Exposing secrets in client-side code (must use `NEXT_PUBLIC_*` prefix for client-side)

---

## Resources

**Official documentation:**

- Next.js Environment Variables: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
- Vite Environment Variables: https://vitejs.dev/guide/env-and-mode.html
- Turborepo Environment Variables: https://turbo.build/repo/docs/handbook/environment-variables

**Tools:**

- Zod validation: https://zod.dev/
- dotenv: https://github.com/motdotla/dotenv
- TruffleHog (secret scanning): https://github.com/trufflesecurity/trufflehog

**Feature flags:**

- LaunchDarkly: https://launchdarkly.com/
- PostHog: https://posthog.com/
- Unleash: https://www.getunleash.io/


---

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

