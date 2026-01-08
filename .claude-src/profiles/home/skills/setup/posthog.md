---
name: PostHog Setup
description: PostHog analytics and feature flags setup
---

# PostHog Analytics & Feature Flags Setup

> **Quick Guide:** One-time setup for PostHog in Next.js App Router monorepo. Covers `posthog-js` client provider, `posthog-node` server client, environment variables, and Vercel deployment. PostHog handles both analytics AND feature flags with a generous free tier (1M events + 1M flag requests/month).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `NEXT_PUBLIC_` prefix for client-side PostHog environment variables)**

**(You MUST create PostHogProvider as a 'use client' component - posthog-js requires browser APIs)**

**(You MUST call `posthog.shutdown()` or `posthog.flush()` after server-side event capture to prevent lost events)**

**(You MUST use `defaults: '2025-11-30'` or `capture_pageview: 'history_change'` for automatic SPA page tracking)**

**(You MUST use a single PostHog organization for all monorepo apps - projects are usage-based, not per-project pricing)**

</critical_requirements>

---

**Auto-detection:** PostHog setup, posthog-js, posthog-node, PostHogProvider, analytics setup, feature flags setup, event tracking setup, NEXT_PUBLIC_POSTHOG_KEY

**When to use:**

- Initial PostHog setup in a Next.js App Router project
- Configuring PostHogProvider for client-side analytics
- Setting up posthog-node for server-side/API route event capture
- Deploying to Vercel with PostHog environment variables

**When NOT to use:**

- Event tracking patterns (use `backend/analytics.md` for that)
- Feature flag usage patterns (use `backend/feature-flags.md` for that)
- Complex multi-environment setups with separate staging/production projects

**Key patterns covered:**

- PostHog project creation (single org for monorepo)
- Client-side setup with PostHogProvider
- Server-side setup with posthog-node
- Environment variables configuration
- Vercel deployment integration
- Initial dashboard recommendations

---

<philosophy>

## Philosophy

PostHog is a **product analytics + feature flags platform** that consolidates multiple tools into one. It's open-source, can be self-hosted, and has a generous free tier. For solo developers and small teams, PostHog eliminates the need for separate analytics (Mixpanel/Amplitude) and feature flag (LaunchDarkly) services.

**Core principles:**

1. **One platform for analytics + feature flags** - Reduces tool sprawl and cost
2. **Usage-based pricing** - Pay for what you use, not per-project
3. **Autocapture by default** - Automatic event tracking reduces manual instrumentation
4. **Server and client SDKs** - Full coverage for SSR and client-side apps

**When to use PostHog:**

- Need both analytics and feature flags in one platform
- Want generous free tier (1M events + 1M flag requests/month)
- Prefer open-source with self-host option
- Building product analytics (funnels, retention, sessions)

**When NOT to use PostHog:**

- Need advanced A/B testing with statistical rigor (use Statsig)
- Require real-time event streaming (use Segment)
- Need complex user journey mapping (use Amplitude)
- Already have established analytics + flag tools

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: PostHog Project Setup

Create a single PostHog organization for your monorepo. You can either use one project for all apps or create separate projects per app.

#### Organization Structure

```
PostHog Organization: "Your Company"
├── Project: "Main App" (or separate per app)
│   ├── API Key: phc_xxx
│   └── Host: https://us.i.posthog.com (or eu.i.posthog.com)
```

#### Getting API Keys

1. Sign up at [posthog.com](https://posthog.com)
2. Create a new organization (or use existing)
3. Create a project for your app(s)
4. Copy the Project API Key from Settings > Project > API Keys

```bash
# Example API key format
phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Why good:** Single organization pools billing across all projects, 6 projects included on paid tier, usage-based pricing means you're not penalized for multiple apps

---

### Pattern 2: Client-Side Setup with PostHogProvider

Install dependencies and create the provider component for Next.js App Router.

#### Installation

```bash
# Install client-side SDK
bun add posthog-js
```

#### Environment Variables

```bash
# apps/client-next/.env.local

# PostHog Configuration
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

#### Constants

```typescript
// lib/posthog/constants.ts
export const POSTHOG_DEFAULTS_VERSION = "2025-11-30";
```

#### Provider Component

```typescript
// ✅ Good Example - PostHog Provider with modern defaults
// lib/posthog/provider.tsx
"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

import { POSTHOG_DEFAULTS_VERSION } from "./constants";

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && !posthog.__loaded) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
        // Use 2025 defaults for automatic SPA page tracking
        defaults: POSTHOG_DEFAULTS_VERSION,
        // Alternatively, set these explicitly:
        // capture_pageview: "history_change",
        // capture_pageleave: "if_capture_pageview",

        // Recommended settings
        person_profiles: "identified_only", // Only create profiles for identified users
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
            // Enable debug mode in development
            posthog.debug();
          }
        },
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Named export
export { PostHogProvider };
```

**Why good:** `defaults: "2025-11-30"` enables automatic SPA page/leave tracking, `person_profiles: "identified_only"` reduces event costs, debug mode in development aids troubleshooting, named export follows convention

#### Root Layout Integration

```typescript
// ✅ Good Example - Root layout with PostHog
// app/layout.tsx
import type { Metadata } from "next";

import { PostHogProvider } from "@/lib/posthog/provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "My App",
  description: "My awesome app",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
```

**Why good:** PostHogProvider wraps entire app, layout remains a Server Component, children passed through correctly

```typescript
// ❌ Bad Example - Provider without 'use client' or inline initialization
// app/layout.tsx
import posthog from "posthog-js";

// BAD: posthog-js requires browser APIs, fails on server
posthog.init("phc_xxx", { api_host: "https://us.i.posthog.com" });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Why bad:** posthog-js uses browser APIs (localStorage, window), initializing in Server Component crashes on server render, no provider means hooks won't work

---

### Pattern 3: Server-Side Setup with posthog-node

Install and configure the Node.js SDK for server-side event capture in API routes and Hono middleware.

#### Installation

```bash
# Install server-side SDK
bun add posthog-node
```

#### Environment Variables

```bash
# apps/client-next/.env.local (or apps/server/.env.local)

# Server-side PostHog (no NEXT_PUBLIC_ prefix needed)
POSTHOG_API_KEY=phc_your_project_api_key_here
POSTHOG_HOST=https://us.i.posthog.com
```

#### Server Client Singleton

```typescript
// ✅ Good Example - PostHog server client singleton
// lib/posthog/server.ts
import { PostHog } from "posthog-node";

const FLUSH_INTERVAL_MS = 10000;
const FLUSH_AT_COUNT = 20;

let posthogClient: PostHog | null = null;

export function getPostHogServerClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      flushInterval: FLUSH_INTERVAL_MS,
      flushAt: FLUSH_AT_COUNT,
    });
  }
  return posthogClient;
}

// For graceful shutdown in serverless environments
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
}

// Named exports
export { getPostHogServerClient, shutdownPostHog };
```

**Why good:** Singleton prevents multiple client instances, flushInterval/flushAt configure batching, shutdown function for graceful cleanup, works in serverless (Vercel)

#### Usage in API Routes (Next.js)

```typescript
// ✅ Good Example - Capturing events in API route
// app/api/signup/route.ts
import { NextResponse } from "next/server";

import { getPostHogServerClient } from "@/lib/posthog/server";

export async function POST(request: Request) {
  const posthog = getPostHogServerClient();
  const body = await request.json();

  // Capture signup event
  posthog.capture({
    distinctId: body.email,
    event: "user_signed_up",
    properties: {
      plan: body.plan,
      source: body.source,
    },
  });

  // CRITICAL: Flush events before response in serverless
  await posthog.flush();

  return NextResponse.json({ success: true });
}
```

**Why good:** `flush()` ensures events are sent before function terminates (important for serverless), distinctId uses user identifier, properties add context

#### Usage in Hono Middleware

```typescript
// ✅ Good Example - PostHog middleware for Hono
// middleware/analytics-middleware.ts
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

import { getPostHogServerClient } from "@/lib/posthog/server";

interface AnalyticsVariables {
  posthog: ReturnType<typeof getPostHogServerClient>;
}

export const analyticsMiddleware = createMiddleware<{
  Variables: AnalyticsVariables;
}>(async (c: Context, next: Next) => {
  const posthog = getPostHogServerClient();
  c.set("posthog", posthog);

  await next();

  // Flush after response is sent
  await posthog.flush();
});

// Named export
export { analyticsMiddleware };
```

```typescript
// ❌ Bad Example - Not flushing events
// app/api/action/route.ts
import { getPostHogServerClient } from "@/lib/posthog/server";

export async function POST(request: Request) {
  const posthog = getPostHogServerClient();

  posthog.capture({
    distinctId: "user-123",
    event: "action_performed",
  });

  // BAD: No flush() - events may be lost in serverless!
  return NextResponse.json({ success: true });
}
```

**Why bad:** PostHog batches events by default, serverless function may terminate before batch is sent, events are silently lost

---

### Pattern 4: User Identification

Identify users after authentication to link anonymous and authenticated sessions.

#### Client-Side Identification

```typescript
// ✅ Good Example - Identifying user after sign in
// hooks/use-auth.ts
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

import { authClient } from "@/lib/auth-client";

export function useAuthIdentify() {
  const posthog = usePostHog();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session?.user) {
      // Identify user with PostHog
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
        // Add other user properties
      });
    }
  }, [session?.user, posthog]);
}

// Named export
export { useAuthIdentify };
```

#### Reset on Sign Out

```typescript
// ✅ Good Example - Reset PostHog on sign out
// components/sign-out-button.tsx
import { usePostHog } from "posthog-js/react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const posthog = usePostHog();

  const handleSignOut = async () => {
    await authClient.signOut();

    // Reset PostHog to clear user identity
    posthog.reset();
  };

  return (
    <button onClick={handleSignOut} type="button">
      Sign Out
    </button>
  );
}

// Named export
export { SignOutButton };
```

**Why good:** `identify()` links anonymous to authenticated sessions, `reset()` clears identity on sign out preventing data bleed, user properties enable cohort analysis

---

### Pattern 5: Environment Variables Template

Create `.env.example` for team onboarding.

#### .env.example Template

```bash
# ✅ Good Example - Comprehensive .env.example
# apps/client-next/.env.example

# ================================================================
# PostHog Analytics & Feature Flags
# ================================================================
# Get your API key from: https://posthog.com -> Project Settings -> API Keys
#
# Host options:
#   US Cloud: https://us.i.posthog.com
#   EU Cloud: https://eu.i.posthog.com
#   Self-hosted: https://your-posthog-instance.com

# Client-side (embedded in browser bundle)
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Server-side (API routes, never exposed to client)
POSTHOG_API_KEY=phc_your_project_api_key
POSTHOG_HOST=https://us.i.posthog.com
```

**Why good:** Comments explain where to get keys, host options documented, clear separation between client and server variables

---

### Pattern 6: Vercel Deployment

Configure PostHog environment variables in Vercel for production.

#### Vercel Environment Setup

1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add the following variables:

| Variable | Environment | Value |
|----------|-------------|-------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Production, Preview, Development | `phc_xxx` |
| `NEXT_PUBLIC_POSTHOG_HOST` | Production, Preview, Development | `https://us.i.posthog.com` |
| `POSTHOG_API_KEY` | Production, Preview, Development | `phc_xxx` |
| `POSTHOG_HOST` | Production, Preview, Development | `https://us.i.posthog.com` |

#### Local Development Override

```bash
# apps/client-next/.env.local (gitignored)

# Use the same keys for development
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_API_KEY=phc_your_project_api_key
POSTHOG_HOST=https://us.i.posthog.com
```

**Why good:** Same project for dev/prod simplifies setup, Vercel handles env var injection, .env.local for local development

---

### Pattern 7: Initial Dashboard Setup

Configure PostHog dashboards after setup completion.

#### Recommended Initial Dashboards

1. **Web Analytics Dashboard** (built-in)
   - Page views, unique visitors, bounce rate
   - Traffic sources, referrers
   - Geographic distribution

2. **Product Analytics Dashboard** (create)
   - Key conversion funnels
   - Feature adoption rates
   - Retention cohorts

3. **Error Tracking** (enable plugin)
   - Error rate trends
   - Most common errors
   - Affected users

#### Initial Configuration Checklist

```markdown
## PostHog Setup Checklist

- [ ] Created PostHog account and organization
- [ ] Created project for app
- [ ] Copied API key to .env.local
- [ ] Installed posthog-js (client)
- [ ] Created PostHogProvider component
- [ ] Wrapped app in provider (layout.tsx)
- [ ] Installed posthog-node (server)
- [ ] Created server client singleton
- [ ] Added flush() to API routes
- [ ] Verified events appearing in PostHog dashboard
- [ ] Set up Vercel environment variables
- [ ] Created .env.example for team
```

</patterns>

---

<decision_framework>

## Decision Framework

### PostHog Project Structure

```
Single app or tight monorepo?
├─ YES → One PostHog project for all apps
│   └─ Use custom properties to filter (app: "web", app: "admin")
└─ NO → Multiple distinct products?
    └─ Separate projects per product
        └─ Still use ONE organization (pools billing)
```

### Client vs Server SDK

```
Where is the event triggered?
├─ Browser/React component → posthog-js (usePostHog hook)
├─ API route/server action → posthog-node (getPostHogServerClient)
├─ React Server Component → posthog-node (but consider if needed)
└─ Hono middleware → posthog-node with analyticsMiddleware
```

### US vs EU Hosting

```
Where are your users?
├─ Primarily US/Americas → https://us.i.posthog.com
├─ Primarily EU/GDPR concerns → https://eu.i.posthog.com
└─ Self-hosting required → Your own PostHog instance URL
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Next.js App Router**: PostHogProvider in layout.tsx, hooks in client components
- **Hono**: analyticsMiddleware for API routes, getPostHogServerClient in handlers
- **Better Auth**: Call posthog.identify() after successful authentication
- **Vercel**: Native support, set env vars in dashboard
- **React Query**: Wrap PostHog calls in hooks for caching (optional)

**Replaces / Conflicts with:**

- **Google Analytics**: PostHog can replace for product analytics (not marketing attribution)
- **Mixpanel/Amplitude**: Direct replacement for product analytics
- **LaunchDarkly/Statsig**: PostHog includes feature flags (simpler use cases)
- **Plausible/Fathom**: PostHog is more feature-rich, but less privacy-focused

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing `'use client'` directive on PostHogProvider component (crashes on server)
- No `flush()` call after server-side event capture (events lost in serverless)
- Using `POSTHOG_API_KEY` without `NEXT_PUBLIC_` prefix for client-side (undefined in browser)
- Hardcoding API keys in source code (security vulnerability)

**Medium Priority Issues:**

- Not using `defaults: '2025-11-30'` (manual pageview tracking required)
- Missing `posthog.reset()` on sign out (user identity bleeds to next session)
- No `person_profiles: 'identified_only'` (unnecessary anonymous profiles created)
- Not calling `posthog.identify()` after authentication (anonymous/auth sessions unlinked)

**Common Mistakes:**

- Initializing posthog-js in a Server Component (requires browser APIs)
- Forgetting to add environment variables to Vercel dashboard
- Using different PostHog projects for dev/prod without realizing (separate data)
- Not wrapping app with PostHogProvider (hooks return null)

**Gotchas & Edge Cases:**

- `posthog-js` must be initialized after `window` is available (hence useEffect)
- Server-side SDK requires explicit `flush()` or `shutdown()` - doesn't auto-flush like client
- Free tier resets monthly - 1M events then stops capturing until next month
- `person_profiles: 'identified_only'` reduces costs but means no anonymous user profiles

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Initializing PostHog in Server Component

```typescript
// ANTI-PATTERN: posthog-js in Server Component
// app/layout.tsx
import posthog from "posthog-js";

// BAD: This runs on server where window is undefined
posthog.init("phc_xxx", { api_host: "https://us.i.posthog.com" });
```

**Why it's wrong:** posthog-js requires browser APIs (window, localStorage), Server Components run on Node.js.

**What to do instead:** Create a 'use client' provider component.

---

### Missing Flush in Serverless

```typescript
// ANTI-PATTERN: No flush in serverless function
export async function POST(request: Request) {
  const posthog = getPostHogServerClient();

  posthog.capture({
    distinctId: "user-123",
    event: "purchase_completed",
    properties: { amount: 99.99 },
  });

  // BAD: Function terminates before batch is sent
  return NextResponse.json({ success: true });
}
```

**Why it's wrong:** PostHog batches events, serverless functions terminate immediately, events never sent.

**What to do instead:** Call `await posthog.flush()` before returning response.

---

### Hardcoded API Keys

```typescript
// ANTI-PATTERN: Hardcoded secrets
posthog.init("phc_actual_api_key_here", {
  api_host: "https://us.i.posthog.com",
});
```

**Why it's wrong:** API keys committed to git, visible in build logs, impossible to rotate without code change.

**What to do instead:** Use environment variables (NEXT_PUBLIC_POSTHOG_KEY).

---

### Wrong Prefix for Client Variables

```bash
# ANTI-PATTERN: Missing NEXT_PUBLIC_ prefix
# .env.local
POSTHOG_KEY=phc_xxx  # BAD: Won't be available in browser
```

**Why it's wrong:** Next.js only exposes `NEXT_PUBLIC_*` variables to client-side code.

**What to do instead:** Use `NEXT_PUBLIC_POSTHOG_KEY` for client-side.

</anti_patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `NEXT_PUBLIC_` prefix for client-side PostHog environment variables)**

**(You MUST create PostHogProvider as a 'use client' component - posthog-js requires browser APIs)**

**(You MUST call `posthog.shutdown()` or `posthog.flush()` after server-side event capture to prevent lost events)**

**(You MUST use `defaults: '2025-11-30'` or `capture_pageview: 'history_change'` for automatic SPA page tracking)**

**(You MUST use a single PostHog organization for all monorepo apps - projects are usage-based, not per-project pricing)**

**Failure to follow these rules will cause lost analytics events, broken tracking, or security vulnerabilities.**

</critical_reminders>

---

## Sources

- [PostHog Next.js Documentation](https://posthog.com/docs/libraries/next-js)
- [PostHog Node.js Documentation](https://posthog.com/docs/libraries/node)
- [PostHog Hono Integration](https://posthog.com/docs/libraries/hono)
- [Vercel + PostHog Guide](https://vercel.com/kb/guide/posthog-nextjs-vercel-feature-flags-analytics)
- [PostHog JavaScript Configuration](https://posthog.com/docs/libraries/js/config)
- [PostHog SPA Pageview Tracking](https://posthog.com/tutorials/single-page-app-pageviews)
