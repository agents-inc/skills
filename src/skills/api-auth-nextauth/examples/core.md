# Auth Configuration & Providers

> Complete code examples for Auth.js configuration, providers, and callbacks. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Basic OAuth Configuration

### Good Example - Multi-Provider Setup

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub, // Auto-detects AUTH_GITHUB_ID, AUTH_GITHUB_SECRET
    Google, // Auto-detects AUTH_GOOGLE_CLIENT_ID, AUTH_GOOGLE_CLIENT_SECRET
    Discord, // Auto-detects AUTH_DISCORD_CLIENT_ID, AUTH_DISCORD_CLIENT_SECRET
  ],
  pages: {
    signIn: "/login", // Custom sign-in page
    error: "/auth/error", // Custom error page
  },
});
```

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

```bash
# .env.local
AUTH_SECRET="npx auth secret"
AUTH_GITHUB_ID="..."
AUTH_GITHUB_SECRET="..."
AUTH_GOOGLE_CLIENT_ID="..."
AUTH_GOOGLE_CLIENT_SECRET="..."
AUTH_DISCORD_CLIENT_ID="..."
AUTH_DISCORD_CLIENT_SECRET="..."
```

**Why good:** Providers auto-detect env vars (zero config), custom pages override defaults, single route file handles all auth endpoints

### Bad Example - v4 Style Configuration

```typescript
// BAD: v4 pattern - authOptions export in API route
// pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth";

export const authOptions = {
  providers: [
    // ...
  ],
  secret: process.env.NEXTAUTH_SECRET, // BAD: deprecated env var
};

export default NextAuth(authOptions);
```

**Why bad:** v4 pattern (authOptions export), deprecated `NEXTAUTH_SECRET`, Pages Router API route, no typed exports

---

## Pattern 2: Credentials Provider

### Good Example - Email/Password with Validation

```typescript
// auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate input
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Look up user
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.hashedPassword) return null;

        // Verify password
        const isValid = await bcrypt.compare(
          parsed.data.password,
          user.hashedPassword,
        );
        if (!isValid) return null;

        // Return user object (becomes `user` in jwt callback)
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" }, // Credentials requires JWT strategy
});
```

**Why good:** Zod validates input before DB query, bcrypt for password verification, null return on any failure (doesn't reveal which step failed), explicit JWT strategy

### Bad Example - Insecure Credentials

```typescript
// BAD: No validation, plain text comparison
Credentials({
  async authorize(credentials) {
    const user = await db.user.findUnique({
      where: { email: credentials.email as string },
    });
    if (user?.password === credentials.password) {
      // BAD: plain text compare
      return user;
    }
    throw new Error("Invalid credentials"); // BAD: throws instead of returning null
  },
});
```

**Why bad:** No input validation, plain text password comparison, throwing error leaks information to client (return null instead)

---

## Pattern 3: Callbacks

### Good Example - JWT and Session Callbacks with Custom Data

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async jwt({ token, user, account }) {
      // `user` is only available on first sign-in
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "user";
      }
      // `account` has OAuth tokens on first sign-in
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose only what the client needs
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      // Do NOT expose accessToken to client
      return session;
    },

    async signIn({ user, account, profile }) {
      // Restrict to specific email domains
      if (account?.provider === "google") {
        return user.email?.endsWith("@company.com") ?? false;
      }
      return true;
    },

    async redirect({ url, baseUrl }) {
      // Prevent open redirect attacks
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
});
```

**Why good:** Custom data flows from jwt -> session callback, sensitive tokens kept server-side, email domain restriction for corporate SSO, redirect validation prevents open redirects

### Bad Example - Leaking Tokens to Client

```typescript
// BAD: Exposing OAuth access token to client
callbacks: {
  async session({ session, token }) {
    session.accessToken = token.accessToken; // BAD: exposed to client
    session.refreshToken = token.refreshToken; // BAD: exposed to client
    return session;
  },
}
```

**Why bad:** Access and refresh tokens exposed to browser, allows token theft via XSS, should stay server-side only

---

## Pattern 4: Sign In / Sign Out

### Good Example - Server Actions for Auth

```typescript
// components/auth-buttons.tsx
import { signIn, signOut } from "@/auth";

export function SignInButton({ provider = "github" }: { provider?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn(provider, { redirectTo: "/dashboard" });
      }}
    >
      <button type="submit">Sign in with {provider}</button>
    </form>
  );
}

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

**Why good:** Server Actions for progressive enhancement (works without JS), `redirectTo` controls destination, imported from server-side `@/auth`

### Good Example - Client-Side Sign In

```typescript
// components/client-auth.tsx
"use client";

import { signIn, signOut } from "next-auth/react";

export function ClientSignIn() {
  return (
    <button onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
      Sign in
    </button>
  );
}

export function ClientSignOut() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </button>
  );
}
```

**Why good:** Client-side import from `next-auth/react` (not `@/auth`), `callbackUrl` for client-side redirect

---

## Pattern 5: TypeScript Type Extensions

### Good Example - Extending Session Types

```typescript
// types/next-auth.d.ts
import type { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "editor" | "user";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "admin" | "editor" | "user";
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: "admin" | "editor" | "user";
    accessToken?: string;
  }
}
```

**Why good:** Type-safe custom fields on session and JWT, extends defaults rather than replacing, union type for role values

---

_See [session.md](session.md) for session strategies and [middleware.md](middleware.md) for route protection._
