# Better Auth - Core Examples

> Essential patterns for authentication. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [oauth.md](oauth.md) - Social providers, Generic OAuth, OAuth Provider plugin
- [two-factor.md](two-factor.md) - TOTP setup and verification
- [organizations.md](organizations.md) - Multi-tenancy and invitations
- [sessions.md](sessions.md) - Session configuration, cookie caching, stateless

---

## Client-Side Sign Up

```typescript
// hooks/use-sign-up.ts
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

interface SignUpData {
  name: string;
  email: string;
  password: string;
}

export function useSignUp() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signUp = async (data: SignUpData) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message);
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      setError("An unexpected error occurred");
      return { success: false };
    } finally {
      setIsPending(false);
    }
  };

  return { signUp, isPending, error };
}
```

**Why good:** Handles loading and error states, callbackURL redirects after signup, error from Better Auth surfaced to UI

---

## Client-Side Sign In

```typescript
// hooks/use-sign-in.ts
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

interface SignInData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export function useSignIn() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requires2FA, setRequires2FA] = useState(false);

  const signIn = async (data: SignInData) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe ?? false,
        callbackURL: "/dashboard",
      });

      // Handle 2FA requirement
      if (result.data?.twoFactorRedirect) {
        setRequires2FA(true);
        return { success: false, requires2FA: true };
      }

      if (result.error) {
        setError(result.error.message);
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      setError("An unexpected error occurred");
      return { success: false };
    } finally {
      setIsPending(false);
    }
  };

  return { signIn, isPending, error, requires2FA };
}
```

**Why good:** rememberMe extends session duration, twoFactorRedirect flag enables 2FA flow, structured return type for component handling

---

## Drizzle Database Adapter

### Database Setup

```typescript
// lib/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

### Auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle"; // or "@better-auth/drizzle-adapter" (v1.5+)

import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "sqlite" or "mysql"
    // Optional: use your existing schema table names
    // schema: {
    //   user: schema.users,
    //   session: schema.sessions,
    // },
  }),
  // Enable experimental joins for 2-3x faster queries
  experimental: {
    joins: true,
  },
});
```

### Schema Generation Commands

```bash
# For Drizzle adapter, use this 3-step workflow:

# Step 1: Generate Better Auth schema
npx auth@latest generate

# Step 2: Generate Drizzle migration file
npx drizzle-kit generate

# Step 3: Apply migration to database
npx drizzle-kit migrate

# NOTE: Better Auth's own `migrate` command only works with Kysely adapter
# For Drizzle, always use the 3-step workflow above
```

**Why good:** drizzleAdapter integrates with existing Drizzle setup, experimental joins improve performance, schema customization for existing tables

---

## Client Configuration

Better Auth provides framework-specific clients: `better-auth/react`, `better-auth/vue`, `better-auth/svelte`, `better-auth/solid`, and `better-auth/client` (vanilla). All share the same API -- only the import path differs. Examples below use the React client.

### Basic Client

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react"; // or /vue, /svelte, /solid, /client

export const authClient = createAuthClient({
  baseURL: process.env.APP_URL || "http://localhost:3000",
});
```

### With Plugins

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.APP_URL || "http://localhost:3000",
  plugins: [
    twoFactorClient({
      twoFactorPage: "/auth/two-factor",
    }),
    organizationClient(),
  ],
});
```

### useSession Hook

```typescript
// components/user-menu.tsx
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
  // Reactive session - updates on auth state changes
  const { data: session, isPending, error } = authClient.useSession();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session?.user) {
    return <a href="/auth/sign-in">Sign In</a>;
  }

  return (
    <div>
      <span>{session.user.email}</span>
      <button
        onClick={() => authClient.signOut()}
        type="button"
      >
        Sign Out
      </button>
    </div>
  );
}
```

**Why good:** useSession is reactive and updates on auth changes, includes `refetch` method for manual refresh, signOut handles cookie cleanup

---

## Password Reset

Use `authClient.requestPasswordReset` (renamed from `forgotPassword` in v1.4).

```typescript
// hooks/use-password-reset.ts
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function usePasswordReset() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const requestReset = async (email: string) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/auth/reset-password",
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError("Failed to send reset email");
    } finally {
      setIsPending(false);
    }
  };

  return { requestReset, isPending, error, success };
}
```

---

## Server-Side Password Verification

Use `auth.api.verifyPassword` to confirm identity before sensitive operations (e.g., email change, account deletion).

```typescript
// routes/settings.ts
import { auth } from "@/lib/auth";

const HTTP_STATUS_UNAUTHORIZED = 401;

app.post("/settings/change-email", async (c) => {
  const session = c.get("session");
  const { password, newEmail } = await c.req.json();

  const isValid = await auth.api.verifyPassword({
    body: { email: session.user.email, password },
  });

  if (!isValid) {
    return c.json({ error: "Invalid password" }, HTTP_STATUS_UNAUTHORIZED);
  }

  // Proceed with email change...
  return c.json({ success: true }, 200);
});
```

---

## Bundle Size Optimization

Use `better-auth/minimal` to reduce bundle size when using ORM adapters (excludes Kysely).

```typescript
// lib/auth.ts - Use minimal entry point for smaller bundles
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
});
```

**When to use:** Projects using Drizzle, Prisma, or MongoDB adapters (not direct database connections)
