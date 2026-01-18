# Better Auth - Core Examples

> Essential patterns for authentication. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [oauth.md](oauth.md) - GitHub, Google OAuth providers
- [two-factor.md](two-factor.md) - TOTP setup and verification
- [organizations.md](organizations.md) - Multi-tenancy and invitations
- [sessions.md](sessions.md) - Session configuration and revocation

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

// Named export
export { useSignUp };
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

// Named export
export { useSignIn };
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

// Named export
export { db };
```

### Auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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

export { auth };
```

### Schema Generation Commands

```bash
# For Drizzle adapter, use this 3-step workflow:

# Step 1: Generate Better Auth schema
npx @better-auth/cli generate

# Step 2: Generate Drizzle migration file
npx drizzle-kit generate

# Step 3: Apply migration to database
npx drizzle-kit migrate

# NOTE: The `migrate` command only works with Kysely adapter
# For Drizzle, always use the 3-step workflow above
```

**Why good:** drizzleAdapter integrates with existing Drizzle setup, experimental joins improve performance, schema customization for existing tables

---

## Client Configuration (React)

### Basic Client

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

// Named export
export { authClient };
```

### With Plugins

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    twoFactorClient({
      twoFactorPage: "/auth/two-factor",
    }),
    organizationClient(),
  ],
});

// Named export
export { authClient };
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

// Named export
export { UserMenu };
```

**Why good:** useSession is reactive and updates on auth changes, signOut handles cookie cleanup
