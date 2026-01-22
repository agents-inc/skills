# T3 Env Pattern

> T3 Env (`@t3-oss/env-nextjs`, `@t3-oss/env-core`) provides type-safe environment variables with client/server separation. See [SKILL.md](../SKILL.md) for core concepts.

**Related Examples:**

- [core.md](core.md) - Basic Zod validation pattern
- [naming-and-templates.md](naming-and-templates.md) - Framework prefixes, .env.example
- [security-and-secrets.md](security-and-secrets.md) - Secret management

---

## T3 Env for Next.js

### Good Example - T3 Env with Next.js

```typescript
// app/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  // Server-side variables (never exposed to client)
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET_KEY: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
  },

  // Client-side variables (embedded in bundle)
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    // Use z.stringbool() for boolean env vars (Zod 4+)
    NEXT_PUBLIC_ENABLE_ANALYTICS: z.stringbool().default(false),
  },

  // Explicit runtime env mapping (required for tree-shaking)
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    API_SECRET_KEY: process.env.API_SECRET_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
  },

  // Treat empty strings as undefined (recommended)
  emptyStringAsUndefined: true,
});
```

**Why good:** Separates client/server variables preventing accidental secret exposure, tree-shaking ensures only accessed vars included in bundle, emptyStringAsUndefined handles blank .env values correctly

---

## Build-Time Validation

### Good Example - Validate at build time via next.config

```typescript
// next.config.ts (Next.js 16+)
import "./app/env"; // Validates env vars at build time

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Your config here
};

export default nextConfig;
```

```typescript
// next.config.mjs (Next.js < 16, uses jiti for TypeScript)
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const jiti = createJiti(fileURLToPath(import.meta.url));

// Validate env vars at build time
jiti("./app/env");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your config here
};

export default nextConfig;
```

**Why good:** Build fails immediately if env vars are missing or invalid, prevents deploying broken builds, catches configuration errors before runtime

---

## T3 Env for Vite

### Good Example - T3 Env Core with Vite

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  // Client-side variables (Vite uses VITE_ prefix)
  clientPrefix: "VITE_",

  client: {
    VITE_API_URL: z.string().url(),
    VITE_ENABLE_ANALYTICS: z.stringbool().default(false),
    VITE_ENVIRONMENT: z.enum(["development", "staging", "production"]),
  },

  // Server variables (build-time only in Vite)
  server: {
    // Vite doesn't expose non-prefixed vars to client
    API_SECRET: z.string().min(1).optional(),
  },

  runtimeEnv: import.meta.env,

  emptyStringAsUndefined: true,
});
```

**Why good:** Uses Vite's VITE\_ prefix convention, works with import.meta.env, type-safe access throughout app

---

## Skip Validation for CI/Linting

### Good Example - Skip validation when env vars not needed

```typescript
// app/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Skip validation for linting/type-checking in CI
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

**Why good:** Allows running type checks and linting in CI without setting all env vars, controlled via SKIP_ENV_VALIDATION flag, still validates in actual builds/runtime

---

## Custom Error Handling

### Good Example - Custom validation error handler

```typescript
// app/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Custom error handler for validation failures
  onValidationError: (error) => {
    console.error("Invalid environment variables:");
    console.error(error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  },

  // Custom handler for accessing server vars on client
  onInvalidAccess: (variable) => {
    throw new Error(
      `Attempted to access server-side env var "${variable}" on the client`,
    );
  },
});
```

**Why good:** Custom error messages improve debugging, onInvalidAccess prevents silent failures when server vars accessed on client

---

## Type-Safe Usage

```typescript
// Any file in your app
import { env } from "~/env"; // Same import everywhere

// Server-side (API routes, server components, etc.)
const dbUrl = env.DATABASE_URL; // string - type-safe!

// Client-side (client components, hooks, etc.)
const apiUrl = env.NEXT_PUBLIC_API_URL; // string - type-safe!

// Accessing server var on client throws error at runtime
const secret = env.DATABASE_URL; // Error: Can't access server var on client
```

---

## Anti-Patterns

### Bad Example - Manual process.env access

```typescript
// components/api-client.ts - WRONG!
const apiUrl = process.env.NEXT_PUBLIC_API_URL; // No type safety!
const timeout = Number(process.env.NEXT_PUBLIC_TIMEOUT); // Could be NaN!
```

**Why bad:** No validation, no type safety, silent failures at runtime

### Bad Example - Missing runtimeEnv mapping

```typescript
// app/env.ts - WRONG!
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  // Missing runtimeEnv - Next.js won't include the var in bundle!
});
```

**Why bad:** Next.js tree-shakes unused process.env access, missing runtimeEnv means vars are undefined at runtime
