# Auth.js (NextAuth v5) Reference

> Decision frameworks, anti-patterns, and red flags for Auth.js development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Session Strategy Selection

```
Do you need to revoke sessions immediately?
├─ YES → Database sessions (adapter required)
│   └─ Deleting a session row instantly invalidates it
└─ NO → Do you need Edge runtime support (middleware)?
    ├─ YES → JWT sessions (default, no adapter needed)
    │   └─ Split config: auth.config.ts (Edge) + auth.ts (Node)
    └─ NO → Do you need to store session data server-side?
        ├─ YES → Database sessions
        └─ NO → JWT sessions (simpler, no database dependency)
```

### Provider Selection

```
What sign-in method do users need?
├─ Social login (Google, GitHub, etc.) → OAuth provider
│   └─ Auto-detects AUTH_PROVIDER_ID and AUTH_PROVIDER_SECRET
├─ Email with magic link → Email provider
│   └─ Requires database adapter for verification tokens
├─ Username/password → Credentials provider
│   └─ You handle password hashing and validation
├─ Passkeys → WebAuthn provider (experimental)
│   └─ Requires database adapter
└─ Multiple methods → Combine providers in the array
```

### Where to Check Session

```
Where is the code running?
├─ Server Component → const session = await auth()
├─ Route Handler → export const GET = auth(function GET(req) { req.auth })
├─ Server Action → const session = await auth()
├─ Middleware → export { auth as middleware } from "@/auth"
├─ Client Component → useSession() (requires SessionProvider)
└─ API Route (Pages Router) → const session = await auth(req, res)
```

### Middleware vs Per-Page Protection

```
What level of protection do you need?
├─ Redirect unauthenticated users globally → Middleware
│   └─ Use matcher to exclude public routes
├─ Different behavior per page → Per-page auth() checks
│   └─ More granular, handles authorization too
├─ Role-based access → Per-page checks (middleware can't easily do RBAC)
└─ Both → Middleware for basic auth + per-page for authorization
```

### Database Adapter Selection

```
What ORM/database are you using?
├─ Prisma → @auth/prisma-adapter
├─ Drizzle → @auth/drizzle-adapter
├─ MongoDB → @auth/mongodb-adapter
├─ Supabase → @auth/supabase-adapter
├─ Firebase → @auth/firebase-adapter
├─ Other → Check authjs.dev/reference/core/adapters
└─ None → No adapter needed (JWT sessions work without database)
```

---

## RED FLAGS

### High Priority Issues

- **Using `getServerSession(authOptions)`** - Deprecated in v5; use `auth()` from your `auth.ts` export
- **Using `NEXTAUTH_SECRET`** - Deprecated; use `AUTH_SECRET`
- **Using `NEXTAUTH_URL`** - Usually unnecessary in v5; auto-detected in most deployments
- **Missing `AUTH_SECRET` in production** - Auth will fail silently or throw cryptic errors
- **Middleware as sole authorization** - Middleware runs before rendering but doesn't replace per-route authorization checks
- **Credentials provider without rate limiting** - Vulnerable to brute-force attacks
- **Storing passwords in plain text** - Always hash with bcrypt/argon2 in the `authorize` function

### Medium Priority Issues

- **Not splitting config for Edge** - Database adapters don't work on Edge runtime; split into `auth.config.ts` + `auth.ts`
- **Using `useSession()` without `SessionProvider`** - Returns undefined, fails silently
- **Exposing access tokens to client** - Only put necessary data in the session callback
- **Not customizing the redirect callback** - Default behavior may allow open redirect vulnerabilities
- **Missing TypeScript type extensions** - Custom session fields are untyped without declaration merging
- **Using `session.user.id` without JWT callback** - `id` is not in the default JWT; must be added in `jwt` callback

### Common Mistakes

- **Importing `signIn`/`signOut` from wrong package** - Server: `import { signIn } from "@/auth"`; Client: `import { signIn } from "next-auth/react"`
- **Calling `auth()` in Client Components** - `auth()` is server-only; use `useSession()` in Client Components
- **Not handling the `user` parameter in JWT callback** - `user` is only available on first sign-in; check for it before accessing
- **Forgetting `authorized` callback returns boolean** - Return `true` to allow, `false` to deny, or `Response` for redirect
- **Cookie name change from v4** - Cookies changed from `next-auth.*` to `authjs.*` prefix
- **Wrapping `signIn()` in try/catch expecting a return value** - `signIn()` throws a NEXT_REDIRECT internally; call it directly in a form action, not inside try/catch

### Gotchas & Edge Cases

- **`signIn()` throws a NEXT_REDIRECT exception** - Don't wrap in try/catch expecting a return value; it redirects internally
- **JWT callback runs on EVERY `auth()` call** - Keep it lightweight; don't make database queries here
- **`user` parameter in JWT callback is only present at sign-in** - Subsequent calls only have `token`
- **Credentials provider doesn't support database sessions by default** - Use JWT strategy or implement custom session management
- **OAuth providers auto-detect env vars** - `AUTH_GITHUB_ID` is found automatically; explicit `clientId` overrides it
- **Session expiry differs between strategies** - JWT: `maxAge` on the cookie (default 30 days); Database: `expires` column on session row
- **`redirect` callback fires on both sign-in and sign-out** - Handle both cases
- **Middleware runs on every request matching the matcher** - Keep it fast; avoid database calls
- **`auth()` in middleware uses JWT only** - Even with database sessions, middleware reads the JWT (it can't access the database on Edge)
- **Account linking happens automatically** - Users with the same email across providers are linked; control via `allowDangerousEmailAccountLinking`

---

## v4 to v5 Migration Quick Reference

| v4 Pattern                         | v5 Replacement                                                       |
| ---------------------------------- | -------------------------------------------------------------------- |
| `pages/api/auth/[...nextauth].ts`  | `app/api/auth/[...nextauth]/route.ts`                                |
| `export const authOptions = {...}` | `export const { auth, handlers, signIn, signOut } = NextAuth({...})` |
| `getServerSession(authOptions)`    | `auth()`                                                             |
| `getSession()`                     | `auth()`                                                             |
| `getToken()`                       | `auth()` (access token via jwt callback)                             |
| `useSession()` (client)            | `useSession()` (unchanged, still needs SessionProvider)              |
| `withAuth()` middleware            | `export { auth as middleware }` or authorized callback               |
| `NEXTAUTH_SECRET`                  | `AUTH_SECRET`                                                        |
| `NEXTAUTH_URL`                     | Usually auto-detected (optional)                                     |
| `next-auth/next` import            | Deprecated - import from `next-auth` or `@/auth`                     |
| `next-auth/middleware` import      | Deprecated - export from `@/auth`                                    |
| `middleware.ts` (Next.js 16+)      | Renamed to `proxy.ts` - same Auth.js integration pattern             |
| `@next-auth/prisma-adapter`        | `@auth/prisma-adapter`                                               |
| `NextAuthOptions` type             | `NextAuthConfig` type                                                |

---

## Quick Reference

### Configuration Checklist

- [ ] `auth.ts` at project root with `NextAuth()` export
- [ ] `app/api/auth/[...nextauth]/route.ts` with `handlers` export
- [ ] `AUTH_SECRET` set in environment (generate with `npx auth secret`)
- [ ] Provider env vars use `AUTH_` prefix
- [ ] TypeScript types extended in `types/next-auth.d.ts`
- [ ] `SessionProvider` wrapping app for client-side session access

### Security Checklist

- [ ] `AUTH_SECRET` is a strong, randomly generated value
- [ ] Credentials provider uses password hashing (bcrypt/argon2)
- [ ] Rate limiting on sign-in endpoints
- [ ] `redirect` callback validates URLs (prevents open redirects)
- [ ] Session data doesn't expose sensitive tokens to client
- [ ] Server Actions check `auth()` for authorization (not just middleware)
- [ ] `signIn` callback validates allowed users/domains

### Session Strategy Comparison

| Feature            | JWT (default)            | Database                  |
| ------------------ | ------------------------ | ------------------------- |
| Setup complexity   | None (no adapter)        | Requires adapter + DB     |
| Edge compatible    | Yes                      | No (needs Node runtime)   |
| Session revocation | Not immediate            | Immediate (delete row)    |
| Storage            | Encrypted cookie         | Database table            |
| Scalability        | Stateless, scales easily | Depends on DB             |
| Custom data        | Via jwt callback         | Via session table columns |
| Default expiry     | 30 days (cookie maxAge)  | 30 days (session.expires) |
