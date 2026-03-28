# Authentication Reference

> Decision frameworks, anti-patterns, and version notes for Better Auth. See [SKILL.md](SKILL.md) for core concepts and red flags, and [examples/](examples/) for code examples.

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
+-- NO -> Stateless sessions
    +-- Full stateless (no database)?
        +-- YES -> Omit database option entirely
        +-- NO -> cookieCache only
    +-- Need session data in JWT?
        +-- YES -> strategy: "jwt"
        +-- NO -> strategy: "compact" (smallest)
    +-- Need encrypted session data?
        +-- YES -> strategy: "jwe" (largest, most secure)
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
+-- Passkeys/WebAuthn? -> @better-auth/passkey (separate package!)
+-- Magic links? -> magicLink()
+-- API keys? -> @better-auth/api-key (separate package)
+-- Generic OAuth provider? -> genericOAuth()
+-- Act as OAuth provider? -> oAuthProvider() (replaces deprecated oidcProvider)
+-- Anonymous users? -> anonymous()
+-- Admin impersonation? -> admin() (must explicitly enable)
+-- Enterprise SSO? -> SCIM support
```

</decision_framework>

---

<integration>

## Integration Notes

Better Auth is framework-agnostic - it works with any framework that provides a Web Standard `Request` object. Mount `auth.handler(request)` on your catch-all auth route.

- **Database adapter**: `drizzleAdapter(db, { provider })` connects to your existing Drizzle setup
- **Client**: `createAuthClient()` provides reactive `useSession` hook with `refetch` method
- **Schema generation**: CLI generates ORM-specific schema files; run your ORM migration tool after

**Replaces:**

- Other auth libraries - choose one auth solution per project
- Custom JWT session handling - Better Auth manages sessions end-to-end
- OIDC Provider plugin (deprecated) - use `oAuthProvider()` instead

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
app.use(
  "/auth/*",
  cors({
    /* ... */
  }),
);
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

**What to do instead (Drizzle adapter):** Run the 3-step workflow:

1. `npx auth@latest generate` (generate Better Auth schema)
2. `npx drizzle-kit generate` (generate migration file)
3. `npx drizzle-kit migrate` (apply migration)

**Note:** Better Auth's `migrate` command only works with Kysely adapter. For Drizzle, always use `generate` + Drizzle Kit.

</anti_patterns>

---

<version_notes>

## Version Notes

**Better Auth v1.5 Breaking Changes (from v1.4):**

- CLI changed: `npx @better-auth/cli` replaced by `npx auth@latest`
- Database adapters extracted to separate packages (e.g. `@better-auth/drizzle-adapter`) - old import paths still work via re-exports
- API key plugin extracted to `@better-auth/api-key` (separate install)
- `InferUser` and `InferSession` types removed - use generic `User` and `Session` types from `better-auth`
- All previously deprecated APIs removed (e.g. `createAdapter` -> `createAdapterFactory`)
- `$ERROR_CODES` field on plugins now expects `Record<string, RawError>` not `Record<string, string>`
- After hooks execute post-transaction instead of during
- `/forget-password/email-otp` endpoint removed - use standard password reset flow

**Better Auth v1.4 Breaking Changes (still relevant):**

- `authClient.forgotPassword` renamed to `authClient.requestPasswordReset`
- Account info endpoint changed from POST to GET `/account-info`
- Passkey plugin moved to separate package: `@better-auth/passkey`
- Plugin callbacks receive `ctx` instead of `request` (access via `ctx.request`)
- Admin impersonation disabled by default (v1.4.9+) - must explicitly enable

</version_notes>
