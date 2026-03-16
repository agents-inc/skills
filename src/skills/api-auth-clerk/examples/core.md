# Clerk Core Setup Examples

> Provider setup, environment variables, and middleware configuration. See [SKILL.md](../SKILL.md) for core concepts.

**UI components:** See [components.md](components.md). **Client hooks:** See [hooks.md](hooks.md). **Server auth:** See [server.md](server.md). **Organizations:** See [organizations.md](organizations.md).

---

## Pattern 1: Environment Variables

### Good Example -- Complete Environment Setup

```env
# .env.local

# Required: Clerk API keys (from Dashboard > Configure > API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_abc123...
CLERK_SECRET_KEY=sk_test_xyz789...

# Optional: Custom auth page paths
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Optional: Post-auth redirect destinations
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding

# Optional: Webhook signing secret (from Dashboard > Webhooks > Endpoint)
CLERK_WEBHOOK_SIGNING_SECRET=whsec_abc123...
```

**Why good:** All keys sourced from environment variables, public keys prefixed with `NEXT_PUBLIC_`, secret keys server-only, webhook secret separate from API keys

### Bad Example -- Hardcoded Keys

```tsx
// BAD: Keys in source code
<ClerkProvider publishableKey="pk_test_abc123">{children}</ClerkProvider>
```

**Why bad:** Secrets in source code get committed to version control, no environment separation between dev/staging/prod

---

## Pattern 2: ClerkProvider Setup

### Good Example -- Minimal Provider

```tsx
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
```

**Why good:** Provider inside `<body>` (not wrapping `<html>`), reads publishable key from env automatically, named export, minimal config

### Good Example -- Provider with Appearance and Localization

```tsx
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: "#3b82f6",
              borderRadius: "0.5rem",
            },
          }}
          localization={{
            signIn: {
              start: {
                title: "Welcome back",
                subtitle: "Sign in to your account",
              },
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

**Why good:** Theme applied globally to all Clerk components, CSS variables for brand consistency, localization for custom copy

### Good Example -- Dynamic Provider for Client-Side Auth

```tsx
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider dynamic>{children}</ClerkProvider>
      </body>
    </html>
  );
}
```

**Why good:** `dynamic` prop required when routes need runtime authentication access with Next.js static rendering

---

## Pattern 3: Middleware Configuration

### Good Example -- Protect All Routes Except Public

```ts
// proxy.ts (Next.js 16+) or middleware.ts (Next.js <=15)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/about",
  "/pricing",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

**Why good:** Explicit public route list, everything else requires auth, webhook endpoints public (verified separately), standard matcher pattern excludes static assets

### Good Example -- Role-Based Route Protection

```ts
// proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isBillingRoute = createRouteMatcher(["/billing(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Admin routes: require org:admin role
  if (isAdminRoute(req)) {
    await auth.protect((has) => has({ role: "org:admin" }));
    return;
  }

  // Billing routes: require billing permission
  if (isBillingRoute(req)) {
    await auth.protect((has) => has({ permission: "org:billing:manage" }));
    return;
  }

  // All other non-public routes: require authentication
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Why good:** Tiered protection (admin > billing > authenticated), role and permission checks at middleware level, early return after specific checks

### Good Example -- Combining with Other Middleware

```ts
// proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Import your other middleware (i18n, rate limiting, etc.)
import { otherMiddleware } from "./lib/middleware";

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Chain other middleware after Clerk auth
  return otherMiddleware(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Why good:** Clerk middleware wraps other middleware, auth runs first then additional middleware, return value from clerkMiddleware callback becomes the response

### Bad Example -- No Route Protection

```ts
// BAD: clerkMiddleware with no protection
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next).*)", "/(api|trpc)(.*)"],
};
```

**Why bad:** `clerkMiddleware()` without callback leaves ALL routes public by default, auth data is available but routes are not protected

### Bad Example -- Using Deprecated authMiddleware

```ts
// BAD: Deprecated API
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/sign-in", "/sign-up"],
});
```

**Why bad:** `authMiddleware` is deprecated and removed in recent versions, replaced by `clerkMiddleware` with `createRouteMatcher`

---

## Pattern 4: Sign-In and Sign-Up Pages

### Good Example -- Dedicated Auth Pages

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export function SignInPage() {
  return (
    <main className="auth-page">
      <SignIn />
    </main>
  );
}
```

```tsx
// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export function SignUpPage() {
  return (
    <main className="auth-page">
      <SignUp />
    </main>
  );
}
```

**Why good:** Catch-all route `[[...sign-in]]` handles multi-step flows (MFA, OAuth callbacks), named exports, minimal wrapper lets Clerk handle the form

### Bad Example -- Missing Catch-All Segment

```tsx
// BAD: app/sign-in/page.tsx (no catch-all)
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <SignIn />;
}
```

**Why bad:** Without `[[...sign-in]]` catch-all, multi-step auth flows (MFA verification, OAuth callbacks) return 404, default export

---

## Pattern 5: Debugging Middleware

### Good Example -- Debug Mode

```ts
// proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/"]);

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  },
  { debug: process.env.NODE_ENV === "development" },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Why good:** Debug logging only in development, helps diagnose route protection and auth state issues, no performance impact in production

---

_For pre-built components, see [components.md](components.md). For client hooks, see [hooks.md](hooks.md). For server-side auth, see [server.md](server.md)._
