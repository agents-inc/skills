---
name: api-auth-better-auth-drizzle-hono
description: Better Auth patterns, sessions, OAuth
---

# Authentication with Better Auth

> **Quick Guide:** Use Better Auth (v1.5+) for type-safe, self-hosted authentication in TypeScript apps. It provides email/password, OAuth, 2FA, sessions, stateless auth, and organization multi-tenancy. Plugin architecture enables progressive complexity. Mount auth handler before session-dependent middleware, configure CORS first for cross-origin deployments, and always run schema generation after adding plugins.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST mount Better Auth handler on the auth route BEFORE any other middleware that depends on session)**

**(You MUST configure CORS middleware BEFORE auth routes when client and server are on different origins)**

**(You MUST use environment variables for ALL secrets (clientId, clientSecret, BETTER_AUTH_SECRET) - NEVER hardcode)**

**(You MUST run `npx auth@latest generate` then your ORM migration tool after adding plugins)**

**(You MUST use `auth.$Infer.Session` types for type-safe session access in middleware)**

</critical_requirements>

---

**Auto-detection:** Better Auth, betterAuth, createAuthClient, auth.handler, auth.api.getSession, socialProviders, twoFactor plugin, organization plugin, drizzleAdapter, session management, OAuth providers, stateless sessions, cookieCache, genericOAuth, oAuthProvider, passkey, SCIM

**When to use:**

- Building self-hosted authentication (no vendor lock-in)
- Need email/password + OAuth + 2FA in one solution
- Multi-tenant SaaS with organization/team management
- Type-safe session management
- Projects requiring database-stored or stateless sessions

**When NOT to use:**

- Need managed authentication with zero maintenance (consider hosted auth solutions)
- Simple static sites without user accounts
- Projects where serverless cold starts are critical (though stateless mode helps)

**Key patterns covered:**

- Server configuration (auth.ts) with plugins
- Session middleware and type-safe route protection
- Email/password authentication flows
- OAuth providers (GitHub, Google, Generic OAuth)
- Two-factor authentication (TOTP)
- Organization and multi-tenancy
- Session strategies: database, cookie cache, stateless
- Database adapter integration
- Client-side useSession hook
- Performance: experimental joins, cookie caching, stateless sessions

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Sign up, sign in, client setup, database adapter
- [examples/oauth.md](examples/oauth.md) - GitHub, Google, Generic OAuth providers
- [examples/two-factor.md](examples/two-factor.md) - TOTP setup, enable, verify
- [examples/organizations.md](examples/organizations.md) - Multi-tenancy, invitations
- [examples/sessions.md](examples/sessions.md) - Session config, cookie caching, stateless
- [reference.md](reference.md) - Decision frameworks, anti-patterns, red flags

---

<philosophy>

## Philosophy

Better Auth follows a **TypeScript-first, self-hosted** approach to authentication. Your user data stays in your database, with no vendor lock-in. The plugin architecture enables progressive complexity - start simple and add features as needed.

**Core principles:**

1. **Type safety throughout** - Session types flow from server to client via `auth.$Infer.Session`
2. **Database as source of truth** - Sessions stored in your DB (with optional stateless mode)
3. **Plugin-based extensibility** - Add 2FA, organizations, passkeys, SCIM, OAuth provider when needed
4. **Framework-agnostic** - Works with any TypeScript web framework
5. **Performance-focused** - Experimental joins (2-3x faster), cookie caching, stateless sessions

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Server Configuration (auth.ts)

Create the auth instance with database adapter. Single source of truth for all authentication config.

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24; // Refresh daily

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  trustedOrigins: [process.env.APP_URL || "http://localhost:3000"],
});
```

**Why good:** Named constants make session policy auditable, env vars for URLs, single exported instance

```typescript
// BAD: Magic numbers, hardcoded secrets, default export
const auth = betterAuth({
  database: { url: "postgres://user:pass@localhost/db" },
  session: { expiresIn: 604800 },
});
export default auth;
```

**Why bad:** Hardcoded credentials leak in source control, magic numbers obscure policy, default export

See [examples/core.md](examples/core.md) for full setup with email verification and Drizzle adapter configuration.

---

### Pattern 2: Session Middleware with Type Safety

Mount auth handler and create typed middleware for session access in routes.

```typescript
// CRITICAL: CORS must be configured BEFORE auth routes
app.use("/auth/*", cors({ origin: APP_URL, credentials: true }));
app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));
```

```typescript
// middleware/auth-middleware.ts - Type-safe session access
type AuthVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set("user", session?.user ?? null);
    c.set("session", session?.session ?? null);
    await next();
  },
);
```

**Why good:** `auth.$Infer.Session` ensures `c.get("user")` is correctly typed, CORS before auth prevents preflight failures, `c.req.raw` provides the Web Standard Request that Better Auth expects

```typescript
// BAD: No type annotation - c.user is any, bypasses type system
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.user = session?.user; // any - no autocomplete
  await next();
});
```

**Why bad:** No AuthVariables type = any access, direct property assignment bypasses typed Variables

See [examples/core.md](examples/core.md) for protected route patterns.

---

### Pattern 3: Schema Generation After Plugins

Every plugin adds database tables. Run the CLI after adding or modifying plugins:

```bash
# Step 1: Generate Better Auth schema (outputs ORM-specific files)
npx auth@latest generate

# Step 2: Generate migration with your ORM tool
npx drizzle-kit generate

# Step 3: Apply migration
npx drizzle-kit migrate
```

Always run all 3 steps. The Better Auth `migrate` command only works with the Kysely adapter - for Drizzle, use `generate` + Drizzle Kit.

---

### Pattern 4: Email/Password with Verification

Configure email/password auth with verification and password reset callbacks.

```typescript
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
        subject: "Reset password",
        html: `<a href="${url}">Reset</a>`,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify email",
        html: `<a href="${url}">Verify</a>`,
      });
    },
  },
});
```

**Why good:** Email verification prevents fake signups, password requirements enforced server-side

See [examples/core.md](examples/core.md) for client-side sign up/in hooks with error handling.

---

### Pattern 5: Session Strategies

Three session approaches with different trade-offs:

| Strategy           | DB Required | Revocable         | Best For        |
| ------------------ | ----------- | ----------------- | --------------- |
| Database (default) | Yes         | Yes               | Most apps       |
| Cookie cache + DB  | Yes         | Yes (delayed)     | Reduce DB load  |
| Stateless          | No          | No (version-only) | Edge/serverless |

```typescript
// Cookie cache: reduces DB hits by caching session in signed cookie
session: {
  cookieCache: { enabled: true, maxAge: CACHE_SECONDS, strategy: "compact" },
}

// Stateless: omit database option entirely
const auth = betterAuth({
  // No database = fully stateless
  session: { cookieCache: { enabled: true, strategy: "jwe" } },
});
```

Cookie cache strategies: `compact` (smallest, internal), `jwt` (standard, third-party verifiable), `jwe` (encrypted, hides data).

See [examples/sessions.md](examples/sessions.md) for full configuration and revocation patterns.

</patterns>

---

<red_flags>

## RED FLAGS

- Hardcoded secrets (clientId/clientSecret in source) - must use environment variables
- CORS configured after auth routes - preflight requests will fail
- Missing `BETTER_AUTH_SECRET` env var - sessions will not work
- No schema generation after adding plugins - database errors at runtime
- Untyped session middleware - loses TypeScript safety, `c.user` becomes `any`
- Using `auth.migrate()` with Drizzle adapter - only works with Kysely, use `generate` + Drizzle Kit
- Missing `c.req.raw` when calling `auth.handler()` - must pass the raw Web Standard Request

**Gotchas & Edge Cases:**

- Google only issues refresh tokens on first consent - use `accessType: "offline"` and `prompt: "consent"`
- Stateless sessions cannot be revoked individually - increment `version` to invalidate all
- Cookie cache revocation is delayed until `maxAge` expires on other devices
- `authClient.forgotPassword` was renamed to `authClient.requestPasswordReset` in v1.4

See [reference.md](reference.md) for full anti-patterns with code examples and the decision framework.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST mount Better Auth handler on the auth route BEFORE any other middleware that depends on session)**

**(You MUST configure CORS middleware BEFORE auth routes when client and server are on different origins)**

**(You MUST use environment variables for ALL secrets (clientId, clientSecret, BETTER_AUTH_SECRET) - NEVER hardcode)**

**(You MUST run `npx auth@latest generate` then your ORM migration tool after adding plugins)**

**(You MUST use `auth.$Infer.Session` types for type-safe session access in middleware)**

**Failure to follow these rules will cause authentication failures, security vulnerabilities, or runtime errors.**

</critical_reminders>
