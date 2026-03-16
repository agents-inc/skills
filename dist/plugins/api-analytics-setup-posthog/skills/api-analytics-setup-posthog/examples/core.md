# PostHog Setup - Core Examples

> Essential patterns for PostHog setup. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.
>
> **Related examples:** [server.md](server.md)

---

## Pattern 1: instrumentation-client.js Setup (Next.js 15.3+)

For Next.js 15.3+, use `instrumentation-client.js` for the simplest setup. PostHog auto-initializes on the client.

```typescript
// ✅ Good Example - instrumentation-client.js (Next.js 15.3+)
// instrumentation-client.js (in project root)
import posthog from "posthog-js";

const POSTHOG_DEFAULTS_VERSION = "2026-01-30";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: POSTHOG_DEFAULTS_VERSION,
  person_profiles: "identified_only",
});

if (process.env.NODE_ENV === "development") {
  posthog.debug();
}
```

**Why good:** Simplest setup, no provider component needed, `defaults` date enables all recommended behaviors for that snapshot, `person_profiles: "identified_only"` reduces costs

**When to use:** Next.js 15.3+ projects. For older versions, use the PostHogProvider pattern below.

---

## Pattern 2: PostHogProvider Component

Create the provider component for client-side analytics.

```typescript
// ✅ Good Example - PostHog Provider (Next.js < 15.3)
// lib/posthog/provider.tsx
"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const POSTHOG_DEFAULTS_VERSION = "2026-01-30";

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && !posthog.__loaded) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
        defaults: POSTHOG_DEFAULTS_VERSION,
        person_profiles: "identified_only",
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
            posthog.debug();
          }
        },
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

**Why good:** `defaults` date enables all recommended behaviors for that snapshot, `person_profiles: "identified_only"` reduces costs, `'use client'` ensures browser context, debug mode aids development

---

## Pattern 3: Root Layout Integration

Wrap the app with PostHogProvider in the root layout.

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

## Pattern 4: User Identification

Identify users after authentication to link anonymous and authenticated sessions.

```typescript
// ✅ Good Example - Identifying user after sign in
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

export function usePostHogIdentify(
  user: { id: string; email: string; name: string } | null,
) {
  const posthog = usePostHog();

  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
      });
    }
  }, [user, posthog]);
}
```

**Why good:** `identify()` links anonymous to authenticated sessions, user properties enable cohort analysis, decoupled from any specific auth library

---

## Pattern 5: Reset on Sign Out

Clear user identity when signing out to prevent data bleed.

```typescript
// ✅ Good Example - Reset PostHog on sign out
import { usePostHog } from "posthog-js/react";

function handleSignOut() {
  const posthog = usePostHog();

  // After your auth sign-out logic completes:
  posthog.reset();
}
```

**Why good:** `reset()` clears identity on sign out preventing data bleed between users on shared devices

```typescript
// ❌ Bad Example - Missing reset on sign out
function handleSignOut() {
  // Sign out logic runs but no posthog.reset()
  // Next user inherits previous identity!
}
```

**Why bad:** User identity bleeds between sessions, corrupts analytics data

---

## Pattern 6: Environment Variables

Client-side variables need the `NEXT_PUBLIC_` prefix. Server-side variables should NOT have it.

```bash
# ✅ Good Example - .env.local
# Client-side (embedded in browser bundle)
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Server-side (API routes, never exposed to client)
POSTHOG_API_KEY=phc_your_project_api_key
POSTHOG_HOST=https://us.i.posthog.com
```

```bash
# ❌ Bad Example - Wrong prefixes
POSTHOG_KEY=phc_xxx              # Missing NEXT_PUBLIC_, undefined in browser
NEXT_PUBLIC_SECRET_KEY=xxx       # Exposes server secret to client!
```

**Why bad:** First var is undefined in browser, second leaks secrets into the client bundle

---
