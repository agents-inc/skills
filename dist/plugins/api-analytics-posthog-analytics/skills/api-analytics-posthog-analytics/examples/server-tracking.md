# PostHog Analytics - Server-Side Tracking

> Server-side tracking patterns with posthog-node for backend events.
>
> **Return to:** [SKILL.md](../SKILL.md) | **Prerequisites:** [core.md](core.md)
>
> **Related:** [group-analytics.md](group-analytics.md) | [privacy-gdpr.md](privacy-gdpr.md)

---

## PostHog Client Setup

```typescript
// lib/analytics/posthog-server.ts
import { PostHog } from "posthog-node";

const POSTHOG_KEY = process.env.POSTHOG_API_KEY!;
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

// Serverless-optimized settings
const FLUSH_AT = 1; // Flush immediately in serverless
const FLUSH_INTERVAL_MS = 0; // Don't wait

export const posthogServer = new PostHog(POSTHOG_KEY, {
  host: POSTHOG_HOST,
  flushAt: FLUSH_AT,
  flushInterval: FLUSH_INTERVAL_MS,
});
```

**Why good:** `flushAt: 1` and `flushInterval: 0` ensure events are sent before serverless function terminates, prevents lost events in short-lived functions

---

## Serverless Best Practices

For serverless environments, use `captureImmediate()` instead of `capture()`:

```typescript
// Preferred for serverless - guarantees HTTP request completes
await posthogServer.captureImmediate({
  distinctId: user.id,
  event: "subscription_created",
  properties: {
    plan: "pro",
    is_annual: true,
  },
});
```

**Why `captureImmediate` over `capture`:** Even with `flushAt: 1`, `capture()` is still async. Serverless environments can freeze or terminate before the request completes. `captureImmediate()` guarantees the HTTP request finishes before your function continues.

**Always call `shutdown()` at the end:**

```typescript
// Ensures all queued events are sent before function terminates
await posthogServer.shutdown();
```

---

## Server-Side Event Tracking

```typescript
// Good Example - Server-side tracking in an API route handler
import { posthogServer } from "../lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "../lib/analytics/constants";

// Inside your route handler:
async function handleCreateProject(user: AuthUser, body: CreateProjectBody) {
  const project = await createProject(body);

  // Track server-side event
  posthogServer.capture({
    distinctId: user.id, // REQUIRED: User's database ID
    event: "project_created",
    properties: {
      project_id: project.id,
      project_name: project.name, // OK if not PII
      plan: user.plan,
      is_first_project: user.projectCount === 0,
    },
  });

  // Ensure event is sent before response
  await posthogServer.shutdown();

  return { project };
}
```

**Why good:** `distinctId` uses database user ID, `shutdown()` ensures delivery before function ends, business event captured reliably on server

```typescript
// Bad Example - Missing required fields
posthogServer.capture({
  // BAD: Missing distinctId - event will fail
  event: "project_created",
  properties: {
    email: user.email, // BAD: PII in properties
  },
});
// BAD: No shutdown() - event may be lost in serverless
```

**Why bad:** Missing distinctId causes event failure, PII in properties violates privacy, no shutdown() risks losing events in serverless

---

## Tracking Auth Events

```typescript
// lib/auth-events.ts
import { posthogServer } from "../lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "../lib/analytics/constants";

interface AuthEventUser {
  id: string;
  plan?: string;
  createdAt?: Date;
}

export async function trackUserSignedUp(user: AuthEventUser) {
  posthogServer.capture({
    distinctId: user.id,
    event: POSTHOG_EVENTS.USER_SIGNED_UP,
    properties: {
      plan: user.plan ?? "free",
      signup_timestamp: new Date().toISOString(),
    },
  });

  // Set user properties
  posthogServer.identify({
    distinctId: user.id,
    properties: {
      plan: user.plan ?? "free",
      created_at: user.createdAt?.toISOString(),
    },
  });

  await posthogServer.shutdown();
}

export async function trackUserLoggedIn(user: AuthEventUser) {
  posthogServer.capture({
    distinctId: user.id,
    event: POSTHOG_EVENTS.USER_LOGGED_IN,
    properties: {
      login_timestamp: new Date().toISOString(),
    },
  });

  await posthogServer.shutdown();
}
```

**Why good:** Centralized auth event tracking, `identify()` sets user properties once, `shutdown()` ensures delivery
