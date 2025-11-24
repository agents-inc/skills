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
