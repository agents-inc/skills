---
name: api-auth-clerk
description: Clerk managed authentication - ClerkProvider, middleware, pre-built components, hooks, server-side auth, organizations, webhooks
---

# Clerk Authentication Patterns

> **Quick Guide:** Clerk provides managed authentication with pre-built UI components, server-side helpers, and organization-based multi-tenancy. Use `clerkMiddleware()` for route protection, `<Show>` for conditional rendering, hooks for client state, and `auth()`/`currentUser()` for server-side auth. Clerk Core 3 (2026) replaces `<SignedIn>`/`<SignedOut>` with `<Show>`, renames the middleware file to `proxy.ts` (Next.js 16+), and consolidates packages.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `@clerk/nextjs/server` for ALL server-side imports — NEVER import server helpers from `@clerk/nextjs`)**

**(You MUST verify webhooks using Clerk's `verifyWebhook` helper — NEVER trust unverified webhook payloads)**

**(You MUST use `<Show>` component instead of deprecated `<SignedIn>`/`<SignedOut>`/`<Protect>` — these are removed in Core 3)**

**(You MUST NOT pass the full `currentUser()` object to the client — it contains `privateMetadata` that must stay server-side)**

**(You MUST protect routes in BOTH middleware AND data access layer — middleware alone is insufficient)**

</critical_requirements>

---

**Auto-detection:** Clerk, ClerkProvider, clerkMiddleware, @clerk/nextjs, useUser, useAuth, useClerk, useSession, useOrganization, SignIn, SignUp, UserButton, UserProfile, OrganizationSwitcher, auth(), currentUser(), CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, Show when="signed-in"

**When to use:**

- Adding authentication and user management to a Next.js application
- Building multi-tenant B2B apps with organization-based access control
- Using pre-built sign-in/sign-up UI components with customizable theming
- Protecting routes with middleware and server-side authorization checks
- Syncing Clerk user data to your database via webhooks

**Key patterns covered:**

- ClerkProvider setup, environment variables, middleware configuration
- Pre-built UI components (`<SignIn>`, `<SignUp>`, `<UserButton>`, `<Show>`)
- Client-side hooks (`useUser`, `useAuth`, `useSession`, `useOrganization`)
- Server-side auth (`auth()`, `currentUser()`) in Server Components, Route Handlers, Server Actions
- Middleware route protection with `clerkMiddleware()` and `createRouteMatcher()`
- Organization-based multi-tenancy with roles and permissions
- Webhook handling with Svix signature verification

**When NOT to use:**

- Self-hosted auth (use NextAuth.js or custom JWT/session implementation)
- Auth without a third-party service (use Lucia or iron-session)
- Simple API key authentication (use custom middleware)

**Detailed Resources:**

- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Setup & Configuration:**

- [examples/core.md](examples/core.md) - ClerkProvider, environment variables, middleware configuration

**UI Components:**

- [examples/components.md](examples/components.md) - Pre-built components, customization, appearance prop

**Client Hooks:**

- [examples/hooks.md](examples/hooks.md) - useUser, useAuth, useSession, loading states, conditional rendering

**Server-Side Auth:**

- [examples/server.md](examples/server.md) - Server Components, API routes, Server Actions, webhook handling

**Organizations & Multi-Tenancy:**

- [examples/organizations.md](examples/organizations.md) - Organization management, roles, permissions, RBAC

---

<philosophy>

## Philosophy

Clerk is a **managed authentication platform** that handles the entire auth lifecycle: sign-up, sign-in, session management, user profiles, organizations, and MFA. Instead of building auth from scratch, you integrate Clerk's SDK and pre-built components.

**Core principles:**

1. **Defense in depth** -- Protect routes at the middleware layer AND verify auth at every data access point. Middleware alone is insufficient (CVE-2025-29927 demonstrated middleware bypass vulnerabilities).
2. **Server-first auth** -- Use `auth()` and `currentUser()` in Server Components and Route Handlers. Only use client hooks (`useUser`, `useAuth`) when you need reactive client-side state.
3. **Pre-built over custom** -- Use Clerk's `<SignIn>`, `<SignUp>`, `<UserButton>` components. Only build custom flows when the pre-built components genuinely cannot meet requirements.
4. **Organizations for multi-tenancy** -- Use Clerk Organizations with roles and permissions for B2B apps. Do not build custom tenant systems on top of Clerk's user model.
5. **Webhook-driven sync** -- Sync Clerk data to your database via webhooks, not by polling. Always verify webhook signatures with `verifyWebhook`.

**When to use Clerk:**

- You need auth quickly with minimal custom code
- You want pre-built UI components for sign-in/sign-up/user management
- You need organization-based multi-tenancy with RBAC
- You want managed MFA, SSO (SAML/OIDC), and social login
- Your framework is Next.js, React, Remix, Astro, or Express

**When NOT to use Clerk:**

- You need full control over auth data storage (self-hosted requirement)
- You cannot use a third-party auth service (compliance/regulatory)
- Your app only needs simple API key authentication
- Budget constraints prevent using a managed service

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: ClerkProvider and Middleware Setup

Every Clerk app needs two things: `<ClerkProvider>` wrapping the app and `clerkMiddleware()` protecting routes.

#### Environment Variables

```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Optional: custom sign-in/sign-up URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# Webhook secret (from Clerk Dashboard)
CLERK_WEBHOOK_SECRET=whsec_...
```

#### Provider Setup

```tsx
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

**Why good:** ClerkProvider inside `<body>`, named export, minimal setup provides auth context to entire app

```tsx
// BAD: Provider outside body or with unnecessary config
import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey="pk_test_hardcoded">
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

**Why bad:** Default export, hardcoded publishable key (use env var), provider wrapping `<html>` instead of inside `<body>`

#### Middleware Configuration

```ts
// proxy.ts (Next.js 16+) or middleware.ts (Next.js <=15)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/",
]);

export default clerkMiddleware(async (auth, req) => {
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

**Why good:** Public routes explicitly whitelisted, all other routes require auth, webhook endpoint is public (verified separately), matcher excludes static assets

---

### Pattern 2: Pre-Built UI Components

Clerk provides drop-in components for authentication flows. Use `<Show>` for conditional rendering (Core 3 replacement for `<SignedIn>`/`<SignedOut>`).

```tsx
// app/layout.tsx (header with auth)
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <header>
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          <main>{children}</main>
        </ClerkProvider>
      </body>
    </html>
  );
}
```

**Why good:** `<Show>` is the Core 3 API, clean conditional rendering, `<UserButton>` provides profile/sign-out UI with zero config

```tsx
// BAD: Using deprecated components
import { SignedIn, SignedOut, Protect } from "@clerk/nextjs";

export default function Layout({ children }) {
  return (
    <SignedIn>{/* Deprecated in Core 3 */}</SignedIn>
    <SignedOut>{/* Deprecated in Core 3 */}</SignedOut>
    <Protect role="admin">{/* Deprecated in Core 3 */}</Protect>
  );
}
```

**Why bad:** `<SignedIn>`, `<SignedOut>`, `<Protect>` removed in Core 3, use `<Show>` with `when` prop instead

#### Dedicated Sign-In/Sign-Up Pages

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export function SignInPage() {
  return (
    <div className="auth-container">
      <SignIn />
    </div>
  );
}
```

```tsx
// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export function SignUpPage() {
  return (
    <div className="auth-container">
      <SignUp />
    </div>
  );
}
```

**Why good:** Catch-all route segments `[[...sign-in]]` handle Clerk's multi-step flows, named exports, minimal wrapper

---

### Pattern 3: Client-Side Hooks

Use hooks in Client Components for reactive auth state. Always check `isLoaded` before accessing data.

```tsx
"use client";

import { useUser } from "@clerk/nextjs";

export function UserGreeting() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.firstName}</h1>
      <p>{user.emailAddresses[0]?.emailAddress}</p>
    </div>
  );
}
```

**Why good:** Checks `isLoaded` before accessing data (prevents hydration errors), checks `isSignedIn` before accessing `user`, named export

```tsx
// BAD: Accessing user without loading/auth checks
"use client";
import { useUser } from "@clerk/nextjs";

export default function Profile() {
  const { user } = useUser();
  // Crashes when isLoaded is false or user is signed out
  return <p>{user.firstName}</p>;
}
```

**Why bad:** No `isLoaded` check (undefined during init), no `isSignedIn` check (null when signed out), runtime error accessing `.firstName` on null, default export

#### useAuth for Token and Session Data

```tsx
"use client";

import { useAuth } from "@clerk/nextjs";

export function AuthenticatedFetch() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  async function fetchProtectedData() {
    if (!isSignedIn) return;

    const token = await getToken();
    const response = await fetch("/api/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  }

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Sign in required</div>;

  return <button onClick={fetchProtectedData}>Fetch Data</button>;
}
```

**Why good:** `getToken()` retrieves session JWT for API calls, loading/auth checks before rendering, `userId` available for user-specific logic

---

### Pattern 4: Server-Side Authentication

Use `auth()` and `currentUser()` from `@clerk/nextjs/server` in Server Components, Route Handlers, and Server Actions.

#### Server Components

```tsx
// app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { userId, isAuthenticated, redirectToSignIn } = await auth();

  if (!isAuthenticated) {
    return redirectToSignIn();
  }

  return <h1>Dashboard for user {userId}</h1>;
}
```

**Why good:** `auth()` is lightweight (returns session claims, no API call), `redirectToSignIn()` handles redirect, checks auth before rendering

#### Server Components with User Data

```tsx
// app/profile/page.tsx
import { currentUser } from "@clerk/nextjs/server";

export default async function ProfilePage() {
  const user = await currentUser();

  if (!user) {
    return <div>Not signed in</div>;
  }

  // SAFE: Only pass specific fields to client components
  const safeUserData = {
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
  };

  return <ProfileView user={safeUserData} />;
}
```

**Why good:** `currentUser()` returns full user object for server use, explicitly picks safe fields before passing to client (never pass full object)

#### Route Handlers

```ts
// app/api/user/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user-specific data from your database
  const data = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });

  return NextResponse.json(data);
}
```

**Why good:** Auth check in API route (defense in depth), returns 401 for unauthenticated requests, uses `userId` to scope database query

#### Server Actions

```ts
// app/actions.ts
"use server";

import { auth } from "@clerk/nextjs/server";

export async function updateProfile(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;

  await db.update(users)
    .set({ name })
    .where(eq(users.clerkId, userId));

  return { success: true };
}
```

**Why good:** Auth verified in server action (not just middleware), `userId` scopes mutation to current user, throws on unauthorized

---

### Pattern 5: Authorization with Roles and Permissions

Use `auth().protect()` with roles/permissions for granular access control. Works in middleware, Server Components, and Route Handlers.

#### Middleware-Level Authorization

```ts
// proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    await auth.protect((has) => has({ role: "org:admin" }));
  }

  if (isDashboardRoute(req)) {
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

**Why good:** Role-based protection at middleware level, admin routes require `org:admin` role, dashboard routes require any auth, public routes fall through

#### Component-Level Authorization

```tsx
// app/admin/page.tsx
import { auth } from "@clerk/nextjs/server";

export default async function AdminPage() {
  const { protect } = await auth();

  // Redirects to sign-in if unauthenticated, returns 404 if unauthorized
  await protect({ role: "org:admin" });

  return <h1>Admin Panel</h1>;
}
```

```tsx
// Client-side authorization check
"use client";

import { Show } from "@clerk/nextjs";

export function AdminSection() {
  return (
    <>
      <Show when={{ role: "org:admin" }} fallback={<p>Access denied</p>}>
        <AdminPanel />
      </Show>

      <Show when={(has) => has({ permission: "org:invoices:manage" })}>
        <InvoiceManager />
      </Show>
    </>
  );
}
```

**Why good:** `<Show>` accepts role/permission objects or callback functions, fallback for unauthorized users, permission-based checks for granular access

---

### Pattern 6: Webhook Handling

Use Clerk webhooks (via Svix) to sync user data to your database. Always verify signatures.

```ts
// app/api/webhooks/clerk/route.ts
import { verifyWebhook } from "@clerk/nextjs/webhooks";

import type { UserJSON, OrganizationJSON } from "@clerk/types";

export async function POST(req: Request) {
  const evt = await verifyWebhook(req);

  const eventType = evt.type;

  switch (eventType) {
    case "user.created":
    case "user.updated": {
      const { id, email_addresses, first_name, last_name, image_url } =
        evt.data as UserJSON;
      const primaryEmail = email_addresses.find(
        (e) => e.id === evt.data.primary_email_address_id,
      )?.email_address;

      await db
        .insert(users)
        .values({
          clerkId: id,
          email: primaryEmail,
          firstName: first_name,
          lastName: last_name,
          imageUrl: image_url,
        })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: {
            email: primaryEmail,
            firstName: first_name,
            lastName: last_name,
            imageUrl: image_url,
          },
        });
      break;
    }

    case "user.deleted": {
      const { id } = evt.data;
      if (id) {
        await db.delete(users).where(eq(users.clerkId, id));
      }
      break;
    }

    default:
      break;
  }

  return new Response("OK", { status: 200 });
}
```

**Why good:** Uses `verifyWebhook` for signature verification, handles create/update/delete events, upsert pattern for user sync, webhook route must be public in middleware

```ts
// BAD: Trusting unverified webhook payload
export async function POST(req: Request) {
  const body = await req.json(); // No verification!
  await db.insert(users).values(body.data); // Trusting raw input
  return new Response("OK");
}
```

**Why bad:** No signature verification (anyone can send fake webhooks), trusting raw input directly into database, security vulnerability

</patterns>

---

<decision_framework>

## Decision Framework

### Client vs Server Auth

```
Where do you need auth data?
|-- Server Component, Route Handler, Server Action
|   |-- Need just userId/sessionId? --> auth()
|   |-- Need full user object? --> currentUser()
|   |-- Need to protect the route? --> auth().protect()
|   +-- Need org context? --> auth() returns orgId, orgRole
|
+-- Client Component (interactive UI)
    |-- Need user profile data? --> useUser()
    |-- Need session/token data? --> useAuth()
    |-- Need org data? --> useOrganization()
    +-- Need low-level Clerk API? --> useClerk()
```

### Route Protection Strategy

```
What kind of route is it?
|-- Public (landing, sign-in, sign-up, webhooks)
|   +-- Add to isPublicRoute matcher, skip auth.protect()
|
|-- Authenticated (dashboard, profile, settings)
|   +-- auth.protect() in middleware + auth() check in data layer
|
+-- Authorized (admin, org-specific, permission-gated)
    |-- Role-based? --> auth.protect({ role: "org:admin" })
    +-- Permission-based? --> auth.protect((has) => has({ permission: "org:feature:action" }))
```

### Component Choice

```
What auth UI do you need?
|-- Full sign-in page --> <SignIn /> on catch-all route
|-- Full sign-up page --> <SignUp /> on catch-all route
|-- Sign-in button (modal) --> <SignInButton />
|-- User avatar + menu --> <UserButton />
|-- Full profile editor --> <UserProfile />
|-- Org switcher --> <OrganizationSwitcher />
+-- Conditional content --> <Show when="signed-in"> or <Show when={{ role: "..." }}>
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Next.js App Router**: First-class support with `auth()`, `currentUser()`, Server Components, Route Handlers, Server Actions
- **Next.js Pages Router**: Supported via `getAuth()` in `getServerSideProps` and `withAuth()` HOC
- **React (Vite/CRA)**: `@clerk/react` with hooks and components (no server-side helpers)
- **Remix/React Router**: `@clerk/react-router` with loader-based auth
- **Express**: `@clerk/express` with `clerkMiddleware()` and `getAuth()`
- **Astro**: `@clerk/astro` with middleware integration
- **Database ORMs**: Use webhook-synced `clerkId` as foreign key to connect Clerk users to your database records

**Replaces / Conflicts with:**

- **NextAuth.js (Auth.js)**: Both handle auth for Next.js -- pick one, not both
- **Lucia Auth**: Self-hosted session management -- use instead of Clerk for full control
- **Firebase Auth**: Google's managed auth -- overlapping feature set with Clerk

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Importing server helpers from `@clerk/nextjs` instead of `@clerk/nextjs/server` (breaks in Server Components)
- Using deprecated `<SignedIn>`/`<SignedOut>`/`<Protect>` components (removed in Core 3)
- Passing full `currentUser()` object to client components (leaks `privateMetadata`)
- Trusting webhook payloads without `verifyWebhook` signature verification
- Relying solely on middleware for route protection (middleware can be bypassed)

**Medium Priority Issues:**

- Not checking `isLoaded` before accessing hook data (causes hydration errors)
- Using `currentUser()` on the client side (it is server-only)
- Hardcoding Clerk keys instead of using environment variables
- Using `authMiddleware()` (deprecated, replaced by `clerkMiddleware()`)
- Not making webhook endpoint public in middleware matcher

**Common Mistakes:**

- Naming middleware file `middleware.ts` on Next.js 16+ (should be `proxy.ts`) or `proxy.ts` on Next.js <=15 (should be `middleware.ts`)
- Forgetting catch-all segments `[[...sign-in]]` on sign-in/sign-up pages (breaks multi-step flows)
- Using `getToken()` without try/catch in Core 3 (throws `ClerkOfflineError` when offline instead of returning null)
- Not adding `prefetch={false}` to `<Link>` components pointing at protected routes from public pages

**Gotchas & Edge Cases:**

- `currentUser()` counts against Backend API rate limits -- prefer `useUser()` hook on the client when possible
- `auth()` in Server Components is deduplicated per request (safe to call multiple times)
- `<Show when={{ role: "org:admin" }}>` requires an active organization in the session
- Organization roles use the `org:` prefix (e.g., `org:admin`, `org:member`, `org:billing`)
- Clerk Core 3 requires Node.js 20.9.0+, Next.js 15.2.3+
- `@clerk/clerk-react` renamed to `@clerk/react` in Core 3 -- update imports after upgrade

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `@clerk/nextjs/server` for ALL server-side imports — NEVER import server helpers from `@clerk/nextjs`)**

**(You MUST verify webhooks using Clerk's `verifyWebhook` helper — NEVER trust unverified webhook payloads)**

**(You MUST use `<Show>` component instead of deprecated `<SignedIn>`/`<SignedOut>`/`<Protect>` — these are removed in Core 3)**

**(You MUST NOT pass the full `currentUser()` object to the client — it contains `privateMetadata` that must stay server-side)**

**(You MUST protect routes in BOTH middleware AND data access layer — middleware alone is insufficient)**

**Failure to follow these rules will create authentication vulnerabilities or break on Clerk Core 3.**

</critical_reminders>
