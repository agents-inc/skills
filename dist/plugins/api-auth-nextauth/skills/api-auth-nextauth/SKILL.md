---
name: api-auth-nextauth
description: Auth.js (NextAuth v5) authentication patterns - configuration, providers, session strategies, middleware, database adapters, role-based access, Edge compatibility
---

# Auth.js (NextAuth v5) Patterns

> **Quick Guide:** Configure Auth.js in a root `auth.ts` file exporting `{ auth, handlers, signIn, signOut }` from `NextAuth()`. Use the unified `auth()` function everywhere (Server Components, Route Handlers, middleware). Default session strategy is JWT (cookie-based); add a database adapter for persistent sessions. Protect routes via middleware or per-page `auth()` checks.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST configure Auth.js in a root `auth.ts` file and export `{ auth, handlers, signIn, signOut }` from `NextAuth()`)**

**(You MUST use the unified `auth()` function for session access - NOT the deprecated `getServerSession()`, `getSession()`, `getToken()`, or `useSession()`)**

**(You MUST use `AUTH_SECRET` environment variable - `NEXTAUTH_SECRET` is deprecated in v5)**

**(You MUST use `AUTH_` prefixed environment variables for provider credentials (e.g., `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`) - they are auto-detected)**

**(You MUST split auth config into `auth.config.ts` (Edge-compatible) and `auth.ts` (with adapter) when using database sessions with middleware)**

**(You MUST check session inside Server Actions and API routes - middleware alone is NOT sufficient for authorization)**

</critical_requirements>

---

**Auto-detection:** Auth.js, NextAuth, next-auth, authjs, auth.ts, auth.config.ts, NextAuth(), signIn, signOut, auth(), handlers, SessionProvider, useSession, AUTH_SECRET, OAuth provider, credentials provider, database adapter, @auth/prisma-adapter, @auth/drizzle-adapter, authorized callback, jwt callback, session callback, middleware auth

**When to use:**

- Adding authentication to Next.js, SvelteKit, Express, or Qwik apps
- Implementing OAuth login (GitHub, Google, Discord, etc.) with 80+ built-in providers
- Building email/magic link authentication flows
- Need JWT or database-backed session management
- Projects requiring Edge-compatible middleware authentication

**When NOT to use:**

- Building a custom auth system from scratch (Auth.js is opinionated)
- Need fine-grained organization/team management (consider Better Auth)
- Mobile-only apps without web frontend (consider Firebase Auth)
- Need self-hosted auth with plugin architecture (consider Better Auth)

**Key patterns covered:**

- Auth configuration (`auth.ts`, `auth.config.ts`)
- OAuth providers (GitHub, Google, Credentials, Email)
- Session strategies (JWT vs database)
- Session access (Server Components, Route Handlers, Client Components)
- Middleware/proxy route protection
- Database adapters (Prisma, Drizzle)
- Callbacks (jwt, session, signIn, redirect)
- Role-based access control
- Edge compatibility split configuration

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Core patterns:**

- [examples/core.md](examples/core.md) - Auth configuration, providers, callbacks
- [examples/session.md](examples/session.md) - Session strategies, session access patterns
- [examples/middleware.md](examples/middleware.md) - Route protection, middleware, Edge compatibility
- [examples/database.md](examples/database.md) - Database adapters, Prisma, Drizzle
- [examples/patterns.md](examples/patterns.md) - Role-based access, magic links, account linking

---

<philosophy>

## Philosophy

Auth.js (v5) consolidates authentication into a **single, unified API**. The `auth()` function replaces `getServerSession`, `getSession`, `withAuth`, `getToken`, and `useSession` from v4. Configuration lives in a root file, not in API routes.

**Core principles:**

1. **Framework-agnostic** - Works with Next.js, SvelteKit, Express, Qwik
2. **Unified API** - Single `auth()` function for all contexts
3. **Provider ecosystem** - 80+ built-in OAuth providers with auto-detection of `AUTH_*` env vars
4. **JWT by default** - Stateless sessions in encrypted cookies, no database required
5. **Edge-compatible** - Middleware runs on Edge runtime with split configuration
6. **Progressive complexity** - Start with OAuth, add database adapter, then customize callbacks

**When to use Auth.js:**

- Need quick OAuth/social login setup with many providers
- Building Next.js apps where middleware route protection is important
- Want JWT sessions without managing a session store
- Need magic link / email authentication
- Multi-framework teams (Next.js + SvelteKit sharing auth patterns)

**When NOT to use Auth.js:**

- Need organization/team management out of the box (Better Auth)
- Need stateful sessions with full audit trail by default (Better Auth)
- Building a pure API without web framework (use passport.js or custom)
- Need 2FA / TOTP built-in (Auth.js requires custom implementation; Better Auth has plugins)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Auth Configuration

The central configuration file exports everything you need from `NextAuth()`.

#### Basic OAuth Setup

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub, // Auto-detects AUTH_GITHUB_ID and AUTH_GITHUB_SECRET
    Google, // Auto-detects AUTH_GOOGLE_CLIENT_ID and AUTH_GOOGLE_CLIENT_SECRET
  ],
});
```

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

**Why good:** Single config file exports all auth utilities, providers auto-detect `AUTH_*` env vars, API route is minimal

#### Environment Variables

```bash
# .env.local
AUTH_SECRET="generate-with-npx-auth-secret"  # Required
AUTH_GITHUB_ID="your-github-client-id"       # Auto-detected by GitHub provider
AUTH_GITHUB_SECRET="your-github-secret"      # Auto-detected by GitHub provider
AUTH_GOOGLE_CLIENT_ID="your-google-id"       # Auto-detected by Google provider
AUTH_GOOGLE_CLIENT_SECRET="your-google-secret"
```

**Why good:** `AUTH_` prefix is standardized in v5, `AUTH_SECRET` replaces deprecated `NEXTAUTH_SECRET`, providers auto-detect credentials

---

### Pattern 2: Providers

Auth.js supports OAuth, email/magic link, and credentials authentication.

#### OAuth Provider with Custom Profile

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      // Customize the profile data mapped to the user
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          role: "user", // Custom field
        };
      },
    }),
  ],
});
```

#### Credentials Provider

```typescript
// auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await getUserByEmail(parsed.data.email);
        if (!user) return null;

        const passwordMatch = await verifyPassword(
          parsed.data.password,
          user.hashedPassword,
        );
        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
});
```

**Why good:** Zod validation on credentials, null return signals failed auth, user object returned on success

---

### Pattern 3: Callbacks

Callbacks customize auth behavior - extending tokens, sessions, controlling sign-in, and redirects.

#### JWT and Session Callbacks for Custom Data

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    // Called when JWT is created (sign in) or updated (session access)
    async jwt({ token, user, account }) {
      // On first sign in, user and account are available
      if (user) {
        token.role = user.role ?? "user";
        token.id = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },

    // Called whenever session is checked - shapes what client sees
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },

    // Control who can sign in
    async signIn({ user, account, profile }) {
      // Example: Only allow users with verified email
      if (account?.provider === "github") {
        return profile?.email_verified === true;
      }
      return true;
    },

    // Control redirect after sign in/out
    async redirect({ url, baseUrl }) {
      // Allow relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow same-origin URLs
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
});
```

**Why good:** JWT callback enriches token with custom data, session callback exposes only what the client needs, signIn callback controls access, redirect callback prevents open redirects

---

### Pattern 4: Session Access

The unified `auth()` function works in every context.

#### Server Component

```typescript
// app/dashboard/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Role: {session.user.role}</p>
    </div>
  );
}
```

#### Route Handler

```typescript
// app/api/user/route.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const GET = auth(function GET(req) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: req.auth.user });
});
```

#### Client Component

```typescript
// app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

```typescript
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```typescript
// components/user-menu.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div>Loading...</div>;

  if (!session) {
    return <button onClick={() => signIn()}>Sign in</button>;
  }

  return (
    <div>
      <span>{session.user.name}</span>
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
```

**Why good:** `auth()` works in Server Components without context, `auth(handler)` wraps Route Handlers, `SessionProvider` enables `useSession` in client components

---

### Pattern 5: Sign In / Sign Out Actions

#### Server-Side Sign In (Recommended)

```typescript
// components/sign-in-button.tsx
import { signIn } from "@/auth";

export function SignInButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("github", { redirectTo: "/dashboard" });
      }}
    >
      <button type="submit">Sign in with GitHub</button>
    </form>
  );
}
```

#### Server-Side Sign Out

```typescript
// components/sign-out-button.tsx
import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit">Sign out</button>
    </form>
  );
}
```

**Why good:** Server Actions for sign in/out (progressive enhancement), `redirectTo` controls post-auth destination, works without client-side JavaScript

---

### Pattern 6: TypeScript Extensions

#### Extending Session and JWT Types

```typescript
// types/next-auth.d.ts
import type { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    accessToken?: string;
  }
}
```

**Why good:** Type-safe custom session fields, extends default types instead of replacing, declaration merging for all auth contexts

</patterns>

---

<integration>

## Integration Guide

**Auth.js is the authentication layer.** It handles identity verification, session management, and route protection. It does NOT handle authorization logic (role checks, permission systems) - that is application code.

**Works with:**

- **Next.js** - Primary framework, full App Router support with Server Actions
- **SvelteKit** - Via `@auth/sveltekit` package
- **Express** - Via `@auth/express` package
- **Prisma** - Via `@auth/prisma-adapter` for database sessions
- **Drizzle** - Via `@auth/drizzle-adapter` for database sessions

**Session strategy depends on stack:**

- **JWT (default)** - No database needed, works on Edge, stateless
- **Database** - Requires adapter, server-side session store, supports revocation

**Defers to:**

- **Database/ORM** - For user data storage and queries beyond auth
- **Authorization libraries** - For role/permission systems (CASL, etc.)
- **Rate limiting** - For brute-force protection on sign-in endpoints

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST configure Auth.js in a root `auth.ts` file and export `{ auth, handlers, signIn, signOut }` from `NextAuth()`)**

**(You MUST use the unified `auth()` function for session access - NOT the deprecated `getServerSession()`, `getSession()`, `getToken()`, or `useSession()`)**

**(You MUST use `AUTH_SECRET` environment variable - `NEXTAUTH_SECRET` is deprecated in v5)**

**(You MUST use `AUTH_` prefixed environment variables for provider credentials (e.g., `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`) - they are auto-detected)**

**(You MUST split auth config into `auth.config.ts` (Edge-compatible) and `auth.ts` (with adapter) when using database sessions with middleware)**

**(You MUST check session inside Server Actions and API routes - middleware alone is NOT sufficient for authorization)**

**Failure to follow these rules will cause authentication failures, expose deprecated patterns, or create security vulnerabilities.**

</critical_reminders>
