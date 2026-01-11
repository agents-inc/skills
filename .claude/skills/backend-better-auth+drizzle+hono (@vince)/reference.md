# Authentication Reference

> Decision frameworks, anti-patterns, and red flags for Better Auth. See [skill.md](skill.md) for core concepts and [examples.md](examples.md) for code examples.

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
