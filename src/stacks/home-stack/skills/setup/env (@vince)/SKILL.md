---
name: setup/env (@vince)
description: Environment configuration, Zod validation
---

# Environment Management

> **Quick Guide:** Per-app .env files (apps/client-next/.env). Framework-specific prefixes (NEXT*PUBLIC*\_, VITE\_\_). Zod validation at startup. Maintain .env.example templates. Never commit secrets (.gitignore). Environment-based feature flags.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

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

**When NOT to use:**

- Runtime configuration changes (use external feature flag services like LaunchDarkly)
- User-specific settings (use database or user preferences)
- Frequently changing values (use configuration API or database)
- Complex A/B testing with gradual rollouts (use dedicated feature flag services)

**Key patterns covered:**

- Per-app .env files (not root-level, prevents conflicts)
- Zod validation at startup for type safety and early failure
- Framework-specific prefixes (NEXT*PUBLIC*\_ for client, VITE\_\_ for Vite client)
- .env.example templates for documentation and onboarding

**Detailed Resources:**
- For code examples, see [examples.md](examples.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

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

See [examples.md](examples.md) for complete code examples.

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

See [examples.md](examples.md) for complete good/bad comparisons.

---

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

See [examples.md](examples.md) for complete code examples with good/bad comparisons.

</patterns>

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

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST validate ALL environment variables with Zod at application startup)**

**(You MUST use framework-specific prefixes for client-side variables - NEXT_PUBLIC_\* for Next.js, VITE_\* for Vite)**

**(You MUST maintain .env.example templates with ALL required variables documented)**

**(You MUST never commit secrets to version control - use .env.local and CI secrets)**

**(You MUST use per-app .env files - NOT root-level .env files)**

**Failure to follow these rules will cause runtime errors, security vulnerabilities, and configuration confusion.**

</critical_reminders>
