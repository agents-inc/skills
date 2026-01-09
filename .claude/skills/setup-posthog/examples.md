# PostHog Setup - Code Examples

> All code examples for PostHog analytics and feature flags setup patterns.

---

## PostHogProvider Component

Create the provider component for client-side analytics.

### Constants

```typescript
// lib/posthog/constants.ts
export const POSTHOG_DEFAULTS_VERSION = "2025-11-30";
```

### Provider Implementation

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

### Root Layout Integration

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

## Server Client Singleton

Create a singleton for server-side event capture.

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

---

## API Route Usage

Capture events in Next.js API routes.

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

## Hono Middleware Usage

Create analytics middleware for Hono API routes.

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

---

## User Identification

Identify users after authentication to link anonymous and authenticated sessions.

### Client-Side Identification

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

### Reset on Sign Out

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

## Environment Variables Template

Create `.env.example` for team onboarding.

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

## Vercel Deployment Configuration

Configure PostHog environment variables for production.

### Vercel Environment Variables

| Variable | Environment | Value |
|----------|-------------|-------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Production, Preview, Development | `phc_xxx` |
| `NEXT_PUBLIC_POSTHOG_HOST` | Production, Preview, Development | `https://us.i.posthog.com` |
| `POSTHOG_API_KEY` | Production, Preview, Development | `phc_xxx` |
| `POSTHOG_HOST` | Production, Preview, Development | `https://us.i.posthog.com` |

### Local Development Override

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

## Initial Dashboard Setup

Configure PostHog dashboards after setup completion.

### Recommended Initial Dashboards

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

### Initial Configuration Checklist

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
