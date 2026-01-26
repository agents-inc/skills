# PostHog Setup - Core Examples

> Essential patterns for PostHog setup. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.
>
> **Related examples:** [server.md](server.md) | [deployment.md](deployment.md)

---

## Pattern 1: Constants

Define version constants for PostHog defaults.

```typescript
// lib/posthog/constants.ts
export const POSTHOG_DEFAULTS_VERSION = "2025-11-30";
```

**Why good:** Named constant avoids magic strings, version is documented and easy to update when PostHog releases new defaults

---

## Pattern 1b: Next.js 15.3+ with instrumentation-client.js

For Next.js 15.3+, use the simpler `instrumentation-client.js` approach instead of a provider.

```typescript
// ✅ Good Example - instrumentation-client.js (Next.js 15.3+)
// instrumentation-client.js (in project root)
import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2025-11-30",
  person_profiles: "identified_only",
});

// Optional: Enable debug mode in development
if (process.env.NODE_ENV === "development") {
  posthog.debug();
}
```

**Why good:** Simpler setup for Next.js 15.3+, no provider component needed, PostHog auto-initializes on client, works with both App Router and Pages Router

**When to use:** Next.js 15.3+ projects. For older versions, use the PostHogProvider pattern below.

---

## Pattern 2: PostHogProvider Component

Create the provider component for client-side analytics.

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

## Pattern 4: Client-Side User Identification

Identify users after authentication to link anonymous and authenticated sessions.

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

**Why good:** `identify()` links anonymous to authenticated sessions, user properties enable cohort analysis, runs once on session change

---

## Pattern 5: Reset on Sign Out

Clear user identity when signing out to prevent data bleed.

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

**Why good:** `reset()` clears identity on sign out preventing data bleed between users on shared devices

---
