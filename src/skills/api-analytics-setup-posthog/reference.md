# PostHog Setup - Reference Guide

> Decision frameworks, anti-patterns, and red flags for PostHog analytics and feature flags setup.

---

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
│   └─ Serverless environment?
│       ├─ YES → Use captureImmediate() (simplest)
│       └─ Or → Use capture() + await flush()
├─ React Server Component → posthog-node (but consider if needed)
└─ API middleware → posthog-node, flush after response
```

### Next.js Setup Approach

```
Which Next.js version?
├─ 15.3+ → Use instrumentation-client.js (simpler)
└─ < 15.3 → Use PostHogProvider component
```

### US vs EU Hosting

```
Where are your users?
├─ Primarily US/Americas → https://us.i.posthog.com
├─ Primarily EU/GDPR concerns → https://eu.i.posthog.com
└─ Self-hosting required → Your own PostHog instance URL
```

---

## RED FLAGS

**High Priority Issues:**

- Missing `'use client'` directive on PostHogProvider component (crashes on server)
- No `flush()` call after server-side event capture (events lost in serverless)
- Using `POSTHOG_API_KEY` without `NEXT_PUBLIC_` prefix for client-side (undefined in browser)
- Hardcoding API keys in source code (security vulnerability)

**Medium Priority Issues:**

- Not using `defaults: '2026-01-30'` (manual pageview tracking required)
- Missing `posthog.reset()` on sign out (user identity bleeds to next session)
- No `person_profiles: 'identified_only'` (unnecessary anonymous profiles created)
- Not calling `posthog.identify()` after authentication (anonymous/auth sessions unlinked)

**Common Mistakes:**

- Initializing posthog-js in a Server Component (requires browser APIs)
- Forgetting to add environment variables to deployment platform
- Using different PostHog projects for dev/prod without realizing (separate data)
- Not wrapping app with PostHogProvider (hooks return null)

**Gotchas & Edge Cases:**

- `posthog-js` must be initialized after `window` is available (hence useEffect or instrumentation-client.js)
- Server-side SDK requires explicit `flush()`, `shutdown()`, or `captureImmediate()` - doesn't auto-flush like client
- `captureImmediate()` is simpler for serverless but sends one HTTP request per event (no batching)
- Free tier resets monthly - 1M events then stops capturing until next month
- `person_profiles: 'identified_only'` reduces costs but means no anonymous user profiles
- Next.js 15.3+ `instrumentation-client.js` values remain fixed for the session - bootstrapping only works if flags are evaluated on the server before render

---

## Good vs Bad Comparisons

### Client-Side Initialization

```typescript
// ✅ Good Example - Proper client provider
"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogProvider({ children }) {
  useEffect(() => {
    if (typeof window !== "undefined" && !posthog.__loaded) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
        defaults: "2026-01-30",
      });
    }
  }, []);

  return children;
}
```

**Why good:** 'use client' ensures browser context, useEffect waits for window, env vars properly prefixed

```typescript
// ❌ Bad Example - Server Component initialization
// app/layout.tsx
import posthog from "posthog-js";

// Crashes: window is undefined on server
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {});

export default function RootLayout({ children }) {
  return children;
}
```

**Why bad:** No 'use client', runs on server where window/localStorage don't exist, crashes the app

---

### Server-Side Event Capture

```typescript
// ✅ Good Example - With flush
export async function POST(request: Request) {
  const posthog = getPostHogServerClient();

  posthog.capture({
    distinctId: "user-123",
    event: "action_performed",
  });

  await posthog.flush(); // Ensures events are sent

  return NextResponse.json({ success: true });
}
```

**Why good:** flush() guarantees events reach PostHog before function terminates

```typescript
// ❌ Bad Example - Without flush
export async function POST(request: Request) {
  const posthog = getPostHogServerClient();

  posthog.capture({
    distinctId: "user-123",
    event: "action_performed",
  });

  // Missing flush - events may be lost!
  return NextResponse.json({ success: true });
}
```

**Why bad:** Serverless function terminates immediately, batched events never sent

---

### Environment Variable Usage

```bash
# ✅ Good Example - Proper prefixes
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx  # Client-side, with prefix
POSTHOG_API_KEY=phc_xxx          # Server-side, no prefix needed
```

**Why good:** NEXT*PUBLIC* exposes to client bundle, server vars stay server-only

```bash
# ❌ Bad Example - Wrong prefixes
POSTHOG_KEY=phc_xxx              # Missing NEXT_PUBLIC_, undefined in browser
NEXT_PUBLIC_SECRET_KEY=xxx       # Exposes server secret to client!
```

**Why bad:** First var is undefined in browser, second exposes secrets to client bundle

---

### User Identity Management

```typescript
// ✅ Good Example - Proper identify/reset flow
// On sign in:
posthog.identify(user.id, { email: user.email, name: user.name });

// On sign out:
posthog.reset();
```

**Why good:** Links anonymous to authenticated sessions, clears identity on logout

```typescript
// ❌ Bad Example - Missing reset
// On sign in:
posthog.identify(user.id, { email: user.email });

// On sign out:
// No reset called - next user inherits previous identity!
```

**Why bad:** User identity bleeds between sessions, corrupts analytics data
