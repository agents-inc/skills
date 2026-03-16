# Route Protection & Middleware

> Code examples for Auth.js route protection - middleware patterns, Edge compatibility, per-page checks. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Basic Middleware Protection

### Good Example - Protect All Routes with Exceptions

```typescript
// middleware.ts
export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    // Match all routes except static files and public paths
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
```

```typescript
// auth.ts - with authorized callback
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isPublicRoute = ["/", "/about", "/pricing"].includes(
        request.nextUrl.pathname,
      );

      if (isPublicRoute) return true;
      return isLoggedIn; // false redirects to sign-in
    },
  },
});
```

**Why good:** Centralized auth check for all routes, public routes explicitly allowed, `authorized` callback returns boolean (false = redirect to sign-in)

---

## Pattern 2: Custom Middleware with Redirect Logic

### Good Example - Role-Based Redirect

```typescript
// middleware.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/about", "/pricing", "/login"];
const ADMIN_ROUTES = ["/admin"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    nextUrl.pathname.startsWith(route),
  );
  const isAdminRoute = ADMIN_ROUTES.some((route) =>
    nextUrl.pathname.startsWith(route),
  );

  // Public routes: always accessible
  if (isPublicRoute) return NextResponse.next();

  // Not logged in: redirect to login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes: check role (available in JWT)
  if (isAdminRoute && req.auth?.user?.role !== "admin") {
    return NextResponse.redirect(new URL("/unauthorized", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

**Why good:** Named route arrays for maintainability, preserves callback URL for post-login redirect, role check in middleware for admin routes

### Bad Example - No Public Route Handling

```typescript
// BAD: All routes require auth including landing page
export { auth as middleware } from "@/auth";

// No matcher config - catches everything
// No authorized callback - defaults to requiring auth
```

**Why bad:** Blocks public pages (landing, pricing, about), no matcher excludes static assets, forces login on every route

---

## Pattern 3: Edge-Compatible Split Configuration

### Good Example - Split Config for Database Sessions + Middleware

```typescript
// auth.config.ts - Edge-compatible (NO database imports)
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

const PUBLIC_ROUTES = ["/", "/about", "/login"];

export const authConfig = {
  providers: [GitHub],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = PUBLIC_ROUTES.some((route) =>
        request.nextUrl.pathname.startsWith(route),
      );
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
```

```typescript
// auth.ts - Full config with database adapter (Node.js only)
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
});
```

```typescript
// middleware.ts - Uses Edge-compatible config
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

**Why good:** `auth.config.ts` has no database imports (Edge-safe), `auth.ts` adds adapter for full Node.js runtime, middleware uses the slim Edge config

### Bad Example - Database Adapter in Middleware

```typescript
// BAD: Importing Prisma in middleware breaks Edge runtime
// middleware.ts
import { auth } from "@/auth"; // auth.ts imports PrismaAdapter

export { auth as middleware };
// ERROR: PrismaClient cannot run on Edge runtime
```

**Why bad:** Prisma/Drizzle can't run on Edge runtime, middleware crashes at deploy time, must split config

---

## Pattern 4: Per-Page Protection

### Good Example - Authorization in Server Components

```typescript
// app/admin/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/unauthorized");
  }

  // Only admins reach here
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {session.user.name}</p>
    </div>
  );
}
```

### Good Example - Protected Server Action

```typescript
// app/actions/admin-actions.ts
"use server";

import { auth } from "@/auth";

export async function deleteUser(userId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Authentication required");
  }

  if (session.user.role !== "admin") {
    throw new Error("Admin access required");
  }

  // Proceed with deletion
  await db.user.delete({ where: { id: userId } });

  return { success: true };
}
```

**Why good:** Defense in depth - middleware provides first check, Server Component/Action provides authorization check, both session and role verified

---

## Pattern 5: Protecting API Routes

### Good Example - Authenticated API Endpoint

```typescript
// app/api/users/route.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const GET = auth(async function GET(req) {
  if (!req.auth?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (req.auth.user.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(users);
});
```

**Why good:** Wrapped with `auth()` for automatic session injection, 401 for unauthenticated, 403 for unauthorized, proper HTTP status codes

---

_See [database.md](database.md) for adapter setup and [patterns.md](patterns.md) for advanced auth patterns._
