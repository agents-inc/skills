# PostHog Setup - Core Examples

> Essential patterns for PostHog setup. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.
>
> **Related examples:** [server.md](server.md)

---

## Pattern 1: Client-Side Initialization (Standalone)

Initialize posthog-js in a client-side entry point. This is the simplest approach when your framework supports a client initialization hook (e.g., an instrumentation or bootstrap file that runs only in the browser).

```typescript
// ✅ Good Example - Client-side init in entry point
import posthog from "posthog-js";

const POSTHOG_DEFAULTS_VERSION = "2026-01-30";

posthog.init(process.env.POSTHOG_KEY, {
  api_host: process.env.POSTHOG_HOST,
  defaults: POSTHOG_DEFAULTS_VERSION,
  person_profiles: "identified_only",
});

if (process.env.NODE_ENV === "development") {
  posthog.debug();
}
```

**Why good:** Simplest setup, no provider component needed, `defaults` date enables all recommended behaviors for that snapshot, `person_profiles: "identified_only"` reduces costs

**When to use:** When your framework provides a client-side initialization hook. For React apps needing context-based access via hooks, use the PostHogProvider pattern below.

---

## Pattern 2: PostHogProvider Component (React)

Create a provider component for React apps that need hook-based access to the PostHog client.

```typescript
// ✅ Good Example - PostHog Provider (React)
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
      posthog.init(process.env.POSTHOG_KEY!, {
        api_host: process.env.POSTHOG_HOST!,
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

## Pattern 3: App-Level Provider Integration

Wrap the app with PostHogProvider at the root of your component tree.

```typescript
// ✅ Good Example - Root layout with PostHog
import { PostHogProvider } from "./lib/posthog/provider";

interface RootLayoutProps {
  children: React.ReactNode;
}

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
```

**Why good:** PostHogProvider wraps entire app, provider handles client-only initialization, children passed through correctly

```typescript
// ❌ Bad Example - Initializing posthog-js outside a client context
import posthog from "posthog-js";

// BAD: posthog-js requires browser APIs, fails on server
posthog.init("phc_xxx", { api_host: "https://us.i.posthog.com" });

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Why bad:** posthog-js uses browser APIs (localStorage, window), initializing in a server-rendered context crashes, no provider means hooks won't work

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

export function useSignOut() {
  const posthog = usePostHog();

  return () => {
    // After your auth sign-out logic completes:
    posthog.reset();
  };
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

Client-side variables must be exposed to the browser bundle (check your framework's prefix convention). Server-side variables should NOT be exposed.

```bash
# ✅ Good Example - .env.local
# Client-side (exposed to browser bundle)
# Use your framework's public prefix: NEXT_PUBLIC_, VITE_, EXPO_PUBLIC_, etc.
POSTHOG_KEY=phc_your_project_api_key
POSTHOG_HOST=https://us.i.posthog.com

# Server-side only (API routes, never exposed to client)
POSTHOG_API_KEY=phc_your_project_api_key
```

**Why good:** Separate client and server env vars, keys never hardcoded in source

```bash
# ❌ Bad Example - Hardcoded keys
# API keys directly in source code instead of environment variables
posthog.init("phc_hardcoded_key_123", { api_host: "..." });
```

**Why bad:** Hardcoded keys are committed to version control, cannot be rotated, and differ between environments

---
