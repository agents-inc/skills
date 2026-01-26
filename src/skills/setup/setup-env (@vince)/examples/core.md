# Environment Core Examples

> Essential environment configuration patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [naming-and-templates.md](naming-and-templates.md) - Framework prefixes, .env.example
- [security-and-secrets.md](security-and-secrets.md) - Secret management
- [feature-flags-and-config.md](feature-flags-and-config.md) - Feature flags, centralized config

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
  // Use z.stringbool() for boolean env vars (Zod 4+)
  // Correctly handles "true"/"false"/"1"/"0"/"yes"/"no"
  VITE_ENABLE_ANALYTICS: z.stringbool().default(false),
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

### Bad Example - Using z.coerce.boolean() for env vars

```typescript
// lib/env.ts - WRONG!
const envSchema = z.object({
  // DON'T use z.coerce.boolean() for env vars!
  VITE_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
});

// Problem: z.coerce.boolean() uses JavaScript's Boolean()
// Boolean("false") === true (non-empty string is truthy!)
// Boolean("0") === true
// This breaks env var semantics where "false" should mean false
```

**Why bad:** `z.coerce.boolean()` converts ANY non-empty string to `true` including "false", "0", "no" - use `z.stringbool()` (Zod 4+) which correctly parses "true"/"false"/"1"/"0"/"yes"/"no"
