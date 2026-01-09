# Authentication Examples

> All code examples for Better Auth patterns. See [skill.md](skill.md) for core concepts.

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

## OAuth Providers (GitHub, Google)

### Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Always get refresh token (Google only issues on first consent)
      accessType: "offline",
      prompt: "consent",
    },
  },
});

export { auth };
```

**Why good:** Environment variables protect secrets, accessType: "offline" ensures refresh tokens from Google, prompt: "consent" forces token refresh

### Environment Variables

```bash
# .env.local
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Required for Better Auth
BETTER_AUTH_SECRET=your_32_character_random_string
BETTER_AUTH_URL=http://localhost:3000
```

### Client-Side OAuth Sign In

```typescript
// components/oauth-buttons.tsx
import { authClient } from "@/lib/auth-client";

export function OAuthButtons() {
  const handleGitHubSignIn = async () => {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    });
  };

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button onClick={handleGitHubSignIn} type="button">
        Continue with GitHub
      </button>
      <button onClick={handleGoogleSignIn} type="button">
        Continue with Google
      </button>
    </div>
  );
}

// Named export
export { OAuthButtons };
```

**Why good:** callbackURL handles post-auth redirect, social provider string is type-safe from Better Auth types

```typescript
// BAD Example - Hardcoded secrets
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  socialProviders: {
    github: {
      clientId: "abc123", // BAD: Hardcoded in source
      clientSecret: "secret456", // BAD: Commits to git
    },
  },
});
```

**Why bad:** Hardcoded secrets committed to version control, exposed in build logs, impossible to rotate without code change

---

## Two-Factor Authentication (2FA/TOTP)

### Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    twoFactor({
      issuer: "MyApp", // Shown in authenticator app
      // Optional: skip verification on enable (not recommended)
      // skipVerificationOnEnable: false,
    }),
  ],
});

export { auth };
```

After adding the plugin, run:
```bash
npx @better-auth/cli generate
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Client Configuration

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    twoFactorClient({
      twoFactorPage: "/auth/two-factor", // Redirect for 2FA verification
    }),
  ],
});

export { authClient };
```

### Enable 2FA Flow

```typescript
// components/enable-2fa.tsx
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function Enable2FA() {
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async (password: string) => {
    try {
      const result = await authClient.twoFactor.enable({
        password,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      // Get TOTP URI for QR code generation
      setTotpUri(result.data?.totpURI ?? null);
      setBackupCodes(result.data?.backupCodes ?? []);
    } catch (err) {
      setError("Failed to enable 2FA");
    }
  };

  return (
    <div>
      {/* Render QR code from totpUri */}
      {/* Display backup codes for user to save */}
    </div>
  );
}

// Named export
export { Enable2FA };
```

### Verify 2FA on Sign In

```typescript
// components/verify-2fa.tsx
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function Verify2FA() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      const result = await authClient.twoFactor.verifyTOTP({
        code,
        trustDevice: true, // Skip 2FA on this device for future logins
      });

      if (result.error) {
        setError("Invalid code. Please try again.");
        return;
      }

      // Redirect to dashboard on success
      window.location.href = "/dashboard";
    } catch (err) {
      setError("Verification failed");
    }
  };

  return (
    <div>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter 6-digit code"
        maxLength={6}
      />
      <button onClick={handleVerify} type="button">
        Verify
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}

// Named export
export { Verify2FA };
```

**Why good:** trustDevice reduces friction for trusted devices, backup codes stored for recovery, TOTP secrets encrypted in database

---

## Organization Multi-Tenancy

### Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const ORG_LIMIT_PER_USER = 5;
const INVITATION_EXPIRY_SECONDS = 48 * 60 * 60; // 48 hours

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    organization({
      organizationLimit: ORG_LIMIT_PER_USER,
      invitationExpiresIn: INVITATION_EXPIRY_SECONDS,
      sendInvitationEmail: async ({ email, invitationId, organization }) => {
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?id=${invitationId}`;
        await sendEmail({
          to: email,
          subject: `Join ${organization.name}`,
          html: `<a href="${inviteUrl}">Accept invitation</a>`,
        });
      },
    }),
  ],
});

export { auth };
```

### Client Configuration

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [organizationClient()],
});

export { authClient };
```

### Create Organization

```typescript
// hooks/use-create-org.ts
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

interface CreateOrgData {
  name: string;
  slug: string;
}

export function useCreateOrg() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrg = async (data: CreateOrgData) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.organization.create({
        name: data.name,
        slug: data.slug,
      });

      if (result.error) {
        setError(result.error.message);
        return { success: false };
      }

      // Set as active organization
      await authClient.organization.setActive({
        organizationId: result.data.id,
      });

      return { success: true, organization: result.data };
    } catch (err) {
      setError("Failed to create organization");
      return { success: false };
    } finally {
      setIsPending(false);
    }
  };

  return { createOrg, isPending, error };
}

// Named export
export { useCreateOrg };
```

### Invite Members

```typescript
// hooks/use-invite-member.ts
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

type Role = "owner" | "admin" | "member";

interface InviteData {
  email: string;
  role: Role;
  organizationId: string;
}

export function useInviteMember() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteMember = async (data: InviteData) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.organization.inviteMember({
        email: data.email,
        role: data.role,
        organizationId: data.organizationId,
      });

      if (result.error) {
        setError(result.error.message);
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      setError("Failed to send invitation");
      return { success: false };
    } finally {
      setIsPending(false);
    }
  };

  return { inviteMember, isPending, error };
}

// Named export
export { useInviteMember };
```

**Why good:** organizationLimit prevents abuse, invitation emails customizable, setActive switches org context for session

---

## Session Management

### Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24; // Refresh daily
const CACHE_MAX_AGE_SECONDS = 5 * 60; // 5 minutes
const FRESH_AGE_SECONDS = 60 * 5; // 5 minutes for sensitive operations

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
    freshAge: FRESH_AGE_SECONDS,
    // Cookie caching reduces database hits
    cookieCache: {
      enabled: true,
      maxAge: CACHE_MAX_AGE_SECONDS,
      strategy: "compact", // or "jwt" or "jwe"
    },
  },
});

export { auth };
```

**Why good:** cookieCache reduces DB queries (verify signature instead), freshAge requires recent auth for sensitive ops, named constants make policy auditable

### Revoke Sessions

```typescript
// hooks/use-sessions.ts
import { authClient } from "@/lib/auth-client";

export async function listSessions() {
  const result = await authClient.session.listSessions();
  return result.data ?? [];
}

export async function revokeSession(token: string) {
  await authClient.session.revokeSession({ token });
}

export async function revokeOtherSessions() {
  await authClient.session.revokeOtherSessions();
}

// Named exports
export { listSessions, revokeSession, revokeOtherSessions };
```

**Why good:** listSessions enables "active sessions" UI, revokeOtherSessions useful after password change

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
# Generate schema from Better Auth
npx @better-auth/cli generate

# Generate and apply migrations with Drizzle Kit
npx drizzle-kit generate
npx drizzle-kit migrate
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
