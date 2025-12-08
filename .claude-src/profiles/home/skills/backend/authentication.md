# Authentication with Better Auth

> **Quick Guide:** Use Better Auth for type-safe, self-hosted authentication in TypeScript apps. It provides email/password, OAuth, 2FA, sessions, and organization multi-tenancy out of the box. Integrates seamlessly with Hono and Drizzle ORM.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST mount Better Auth handler on `/api/auth/*` BEFORE any other middleware that depends on session)**

**(You MUST configure CORS middleware BEFORE auth routes when client and server are on different origins)**

**(You MUST use environment variables for ALL secrets (clientId, clientSecret, BETTER_AUTH_SECRET) - NEVER hardcode)**

**(You MUST run `npx @better-auth/cli generate` after adding plugins to update database schema)**

**(You MUST use `auth.$Infer.Session` types for type-safe session access in middleware)**

</critical_requirements>

---

**Auto-detection:** Better Auth, betterAuth, createAuthClient, auth.handler, auth.api.getSession, socialProviders, twoFactor plugin, organization plugin, drizzleAdapter, session management, OAuth providers

**When to use:**

- Building self-hosted authentication (no vendor lock-in)
- Need email/password + OAuth + 2FA in one solution
- Multi-tenant SaaS with organization/team management
- Type-safe session management with Hono
- Projects requiring database-stored sessions

**When NOT to use:**

- Serverless with strict cold start requirements (consider Clerk/Auth0)
- Need managed authentication with zero setup (use Auth.js/NextAuth)
- Simple static sites without user accounts
- Mobile-only apps (consider Firebase Auth)

**Key patterns covered:**

- Server configuration (auth.ts) with plugins
- Hono integration with session middleware
- Email/password authentication flows
- OAuth providers (GitHub, Google, etc.)
- Two-factor authentication (TOTP)
- Organization and multi-tenancy
- Session management and cookie configuration
- Drizzle ORM database adapter
- Client-side React integration

---

<philosophy>

## Philosophy

Better Auth follows a **TypeScript-first, self-hosted** approach to authentication. Your user data stays in your database, with no vendor lock-in. The plugin architecture enables progressive complexity - start simple and add features as needed.

**Core principles:**

1. **Type safety throughout** - Session types flow from server to client
2. **Database as source of truth** - Sessions stored in your DB, not JWTs only
3. **Plugin-based extensibility** - Add 2FA, organizations, etc. when needed
4. **Framework-agnostic** - Works with Hono, Next.js, SvelteKit, etc.

**When to use Better Auth:**

- Self-hosted authentication with full control
- Multi-tenant SaaS with organizations/teams
- Need 2FA, passkeys, or enterprise SSO
- TypeScript projects requiring type-safe auth

**When NOT to use:**

- Need managed auth with zero maintenance
- Serverless with aggressive cold start budgets
- Simple apps where Auth.js suffices

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Server Configuration (auth.ts)

Create the auth instance with database adapter and configuration. This is the single source of truth for authentication.

#### Constants

```typescript
// lib/auth.ts
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24; // 1 day (refresh daily)
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
```

#### Basic Setup

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "sqlite" or "mysql"
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ],
});

// Named export (project convention)
export { auth };
```

**Why good:** Single auth instance exported for reuse, drizzleAdapter connects to existing DB, named constants make session policy clear, environment variables for URLs

```typescript
// BAD Example - Anti-patterns
import { betterAuth } from "better-auth";

const auth = betterAuth({
  database: {
    url: "postgres://user:pass@localhost:5432/db", // BAD: Hardcoded credentials
  },
  session: {
    expiresIn: 604800, // BAD: Magic number (what is this?)
  },
  trustedOrigins: ["http://localhost:3000"], // BAD: Hardcoded URL
});

export default auth; // BAD: Default export
```

**Why bad:** Hardcoded credentials leak in source control, magic numbers obscure session policy, hardcoded URLs break in production, default export prevents tree-shaking

---

### Pattern 2: Hono Integration with Session Middleware

Mount Better Auth handler and create middleware for session access in routes.

#### Handler Setup

```typescript
// app/api/[[...route]]/route.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

import { auth } from "@/lib/auth";

const CORS_MAX_AGE_SECONDS = 86400;

const app = new Hono().basePath("/api");

// CRITICAL: CORS must be configured BEFORE auth routes
app.use(
  "/auth/*",
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    credentials: true,
    maxAge: CORS_MAX_AGE_SECONDS,
  })
);

// Mount Better Auth handler on /api/auth/*
app.on(["POST", "GET"], "/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Named exports for Next.js
export const GET = handle(app);
export const POST = handle(app);
export { app };
```

**Why good:** CORS before auth prevents preflight failures, `c.req.raw` provides Web Standard Request that Better Auth expects, named exports follow convention

#### Session Middleware

```typescript
// middleware/auth-middleware.ts
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

import { auth } from "@/lib/auth";

type AuthVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c: Context, next: Next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    c.set("user", session?.user ?? null);
    c.set("session", session?.session ?? null);

    await next();
  }
);

// Named export
export { authMiddleware };
```

**Why good:** Type-safe Variables with `auth.$Infer.Session` ensures c.get("user") is correctly typed, null fallback prevents undefined access

#### Protected Routes

```typescript
// routes/protected.ts
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { authMiddleware } from "@/middleware/auth-middleware";
import { ErrorResponseSchema, UserSchema } from "@/schemas";

const HTTP_STATUS_UNAUTHORIZED = 401;

const app = new OpenAPIHono();

// Apply auth middleware globally or per-route
app.use("*", authMiddleware);

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "getCurrentUser",
  tags: ["Auth"],
  responses: {
    200: {
      description: "Current user",
      content: { "application/json": { schema: UserSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

app.openapi(getMeRoute, async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json(
      { error: "unauthorized", message: "Authentication required" },
      HTTP_STATUS_UNAUTHORIZED
    );
  }

  return c.json({ user }, 200);
});

export { app as protectedRoutes };
```

**Why good:** authMiddleware sets typed user/session, null check returns proper 401, OpenAPI route documents auth requirement

```typescript
// BAD Example - No type safety
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  // BAD: No type annotation - c.user is any
  c.user = session?.user;

  await next();
});

app.get("/me", async (c) => {
  // BAD: c.user is any - no autocomplete, no type checking
  if (!c.user) {
    return c.json({ error: "Unauthorized" }, 401); // BAD: Magic number
  }
  return c.json(c.user);
});
```

**Why bad:** No AuthVariables type = any access, magic 401 requires hunting for status meaning, direct c.user assignment bypasses Hono's type system

---

### Pattern 3: Email/Password Authentication

Configure email/password auth with proper password requirements and error handling.

#### Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const PASSWORD_RESET_EXPIRY_SECONDS = 3600; // 1 hour

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `<a href="${url}">Click here to reset your password</a>`,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: `<a href="${url}">Click here to verify your email</a>`,
      });
    },
  },
});

export { auth };
```

**Why good:** Email verification prevents fake signups, custom email sender integrates with your email service, password requirements enforced server-side

#### Client-Side Sign Up

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

#### Client-Side Sign In

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

### Pattern 4: OAuth Providers (GitHub, Google)

Configure OAuth providers with environment variables and proper scopes.

#### Server Configuration

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

#### Environment Variables

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

#### Client-Side OAuth Sign In

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

### Pattern 5: Two-Factor Authentication (2FA/TOTP)

Add TOTP-based two-factor authentication with backup codes.

#### Server Configuration

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

#### Client Configuration

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

#### Enable 2FA Flow

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

#### Verify 2FA on Sign In

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

### Pattern 6: Organization Multi-Tenancy

Add organization management for multi-tenant SaaS applications.

#### Server Configuration

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

#### Client Configuration

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

#### Create Organization

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

#### Invite Members

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

### Pattern 7: Session Management

Configure session behavior for security and user experience.

#### Server Configuration

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

#### Revoke Sessions

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

### Pattern 8: Drizzle Database Adapter

Configure Drizzle ORM adapter with schema generation.

#### Database Setup

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

#### Auth Configuration

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

#### Schema Generation Commands

```bash
# Generate schema from Better Auth
npx @better-auth/cli generate

# Generate and apply migrations with Drizzle Kit
npx drizzle-kit generate
npx drizzle-kit migrate
```

**Why good:** drizzleAdapter integrates with existing Drizzle setup, experimental joins improve performance, schema customization for existing tables

---

### Pattern 9: Client Configuration (React)

Set up the auth client for React applications.

#### Basic Client

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

// Named export
export { authClient };
```

#### With Plugins

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

#### useSession Hook

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

</patterns>

---

<decision_framework>

## Decision Framework

### Session Storage Strategy

```
Need to revoke individual sessions?
+-- YES -> Database sessions (default)
|   +-- Need reduced DB load?
|       +-- YES -> Enable cookieCache with maxAge
|       +-- NO -> Default database sessions
+-- NO -> Stateless sessions (cookieCache only)
    +-- Need session data in JWT?
        +-- YES -> strategy: "jwt"
        +-- NO -> strategy: "compact" (smallest)
```

### Authentication Method Selection

```
User authentication method?
+-- Email/password only?
|   +-- YES -> emailAndPassword: { enabled: true }
+-- OAuth providers?
|   +-- YES -> Add to socialProviders
|   +-- Need refresh tokens from Google?
|       +-- YES -> accessType: "offline", prompt: "consent"
+-- Need 2FA?
|   +-- YES -> Add twoFactor() plugin
+-- Multi-tenant SaaS?
    +-- YES -> Add organization() plugin
```

### Plugin Selection

```
Which plugins do you need?
+-- Two-factor auth? -> twoFactor()
+-- Organizations/teams? -> organization()
+-- Custom session data? -> customSession()
+-- Passkeys/WebAuthn? -> passkey()
+-- Magic links? -> magicLink()
+-- API keys? -> apiKey()
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Hono**: Mount auth.handler on `/api/auth/*`, use authMiddleware for session access
- **Drizzle ORM**: drizzleAdapter connects to existing database, schema generation via CLI
- **React**: createAuthClient with useSession hook for reactive auth state
- **Next.js**: Works with App Router and Pages Router via Hono adapter
- **React Query**: Wrap authClient calls in custom hooks for caching/invalidation

**Replaces / Conflicts with:**

- **Auth.js/NextAuth**: Better Auth is a complete replacement - don't use both
- **Clerk/Auth0**: Better Auth is self-hosted alternative - choose one
- **Custom JWT auth**: Better Auth handles sessions - don't roll your own
- **Firebase Auth**: Different approach - choose based on hosting needs

</integration>

---

<anti_patterns>

## Anti-Patterns

### Hardcoded Secrets

```typescript
// ANTI-PATTERN: Secrets in code
export const auth = betterAuth({
  socialProviders: {
    github: {
      clientId: "abc123", // Commits to version control!
      clientSecret: "secret456", // Exposed in build logs!
    },
  },
});
```

**Why it's wrong:** Secrets committed to git, visible in build logs, impossible to rotate without code change.

**What to do instead:** Use environment variables for all secrets.

---

### Missing CORS Configuration

```typescript
// ANTI-PATTERN: Auth routes before CORS
app.on(["POST", "GET"], "/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// CORS after auth - preflight requests fail!
app.use("/auth/*", cors({ /* ... */ }));
```

**Why it's wrong:** CORS middleware must run before route handlers to handle OPTIONS preflight requests.

**What to do instead:** Register CORS middleware before auth routes.

---

### No Type Safety for Session

```typescript
// ANTI-PATTERN: Untyped session access
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.user = session?.user; // No type - c.user is any
  await next();
});
```

**Why it's wrong:** No TypeScript safety, c.user is any, no autocomplete.

**What to do instead:** Use `createMiddleware<{ Variables: AuthVariables }>` with `auth.$Infer.Session`.

---

### Magic Numbers for Session Config

```typescript
// ANTI-PATTERN: Magic numbers
export const auth = betterAuth({
  session: {
    expiresIn: 604800, // What is this?
    updateAge: 86400, // Days? Hours?
    freshAge: 300, // No idea
  },
});
```

**Why it's wrong:** Numbers scattered in code, meaning unclear, policy changes require hunting.

**What to do instead:** Use named constants like `SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7`.

---

### Forgetting Schema Generation

```typescript
// ANTI-PATTERN: Adding plugins without schema update
import { twoFactor, organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [twoFactor(), organization()],
  // Error: Missing tables for plugins!
});
```

**Why it's wrong:** Plugins require database tables that don't exist yet.

**What to do instead:** Run `npx @better-auth/cli generate` and migrate after adding plugins.

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Hardcoded secrets** - clientId/clientSecret must be in environment variables
- **CORS after auth routes** - preflight requests will fail, users can't sign in
- **Missing BETTER_AUTH_SECRET** - sessions won't work without this env variable
- **No schema generation after plugins** - database errors at runtime
- **Default exports** - should use named exports per project convention

**Medium Priority Issues:**

- **No session cookie caching** - every request hits database
- **Magic numbers for timeouts** - use named constants for session config
- **No type annotations on middleware** - loses TypeScript benefits
- **Hardcoded URLs** - use NEXT_PUBLIC_APP_URL environment variable
- **Missing error handling** - authClient calls should handle errors

**Common Mistakes:**

- Forgetting `c.req.raw` when calling `auth.handler()` (must pass raw Request)
- Not running migrations after `@better-auth/cli generate`
- Using `signIn.email` without handling `twoFactorRedirect` response
- Not configuring `trustedOrigins` for production deployment
- Missing `credentials: true` in CORS config for cookie authentication

**Gotchas & Edge Cases:**

- Google only issues refresh token on first consent - use `accessType: "offline"` and `prompt: "consent"`
- GitHub OAuth apps don't issue refresh tokens (access tokens are long-lived)
- Session cookies need `SameSite=None` + `Secure` for cross-domain deployments
- `cookieCache` with `strategy: "jwe"` encrypts session data (largest but most secure)
- Stateless sessions can't be revoked individually - increment `version` to invalidate all
- Organization plugin requires invitation email callback for member invites

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST mount Better Auth handler on `/api/auth/*` BEFORE any other middleware that depends on session)**

**(You MUST configure CORS middleware BEFORE auth routes when client and server are on different origins)**

**(You MUST use environment variables for ALL secrets (clientId, clientSecret, BETTER_AUTH_SECRET) - NEVER hardcode)**

**(You MUST run `npx @better-auth/cli generate` after adding plugins to update database schema)**

**(You MUST use `auth.$Infer.Session` types for type-safe session access in middleware)**

**Failure to follow these rules will cause authentication failures, security vulnerabilities, or runtime errors.**

</critical_reminders>

---

## Sources

- [Better Auth Official Documentation](https://www.better-auth.com/)
- [Better Auth GitHub Repository](https://github.com/better-auth/better-auth)
- [Hono Integration Guide](https://www.better-auth.com/docs/integrations/hono)
- [Two-Factor Authentication Plugin](https://www.better-auth.com/docs/plugins/2fa)
- [Organization Plugin](https://www.better-auth.com/docs/plugins/organization)
- [Drizzle Adapter Documentation](https://www.better-auth.com/docs/adapters/drizzle)
