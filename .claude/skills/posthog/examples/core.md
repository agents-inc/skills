# PostHog Analytics - Core Examples

> Essential patterns for PostHog analytics: naming conventions and user identification.
>
> **Return to:** [SKILL.md](../SKILL.md)

**Extended Examples:**

- [client-tracking.md](client-tracking.md) - React Hooks, Provider Setup
- [server-tracking.md](server-tracking.md) - posthog-node, Hono Routes
- [group-analytics.md](group-analytics.md) - B2B Organization Tracking
- [privacy-gdpr.md](privacy-gdpr.md) - GDPR Consent, Cookieless Mode
- [funnel-analysis.md](funnel-analysis.md) - Funnel Analysis Setup
- [type-safety.md](type-safety.md) - Type-Safe Event Tracking

---

## Pattern 1: Event Naming Conventions

### Naming Rules

```typescript
// Good Example - Structured event names
// Format: category:object_action
// - category: Context (signup_flow, settings, dashboard)
// - object: Component/location (password_button, pricing_page)
// - action: Present-tense verb (click, submit, view)

// Signup flow events
"signup_flow:email_form_submit";
"signup_flow:google_oauth_click";
"signup_flow:verification_email_sent";

// Dashboard events
"dashboard:project_create";
"dashboard:invite_member_click";
"dashboard:export_data_download";

// Settings events
"settings:password_change_submit";
"settings:notification_toggle";
"settings:billing_plan_upgrade";

// Alternative format: object_verb (simpler, still good)
"project_created";
"user_signed_up";
"invite_sent";
```

**Why good:** category prefix groups related events in PostHog UI, present-tense verbs are consistent, snake_case is lowercase and readable, structured names enable wildcard queries like `signup_flow:*`

```typescript
// Bad Example - Inconsistent naming
"UserSignedUp"; // BAD: PascalCase
"user-signed-up"; // BAD: kebab-case (use snake_case)
"clicked_button"; // BAD: Past tense
"button click"; // BAD: Spaces
"signup"; // BAD: Too vague
"signUpFormSubmittedByUserOnPage"; // BAD: Too verbose
```

**Why bad:** Inconsistent casing makes queries impossible, past tense mixes with present, vague names don't tell you what happened, verbose names are hard to type

### Property Naming

```typescript
// Good Example - Structured property names
const eventProperties = {
  // Object_adjective pattern
  project_id: "proj_abc123",
  plan_name: "pro",
  item_count: 5,

  // Boolean: is_ or has_ prefix
  is_first_purchase: true,
  has_completed_onboarding: false,
  is_annual_billing: true,

  // Dates: _date or _timestamp suffix
  trial_end_date: "2025-01-15",
  last_login_timestamp: 1704067200,

  // Enums: use the actual value
  payment_method: "stripe",
  source: "google_ads",
};
```

**Why good:** Consistent patterns enable filtering and grouping, boolean prefixes make type obvious, date suffixes clarify format expectations

---

## Pattern 2: User Identification with Authentication

### Constants

```typescript
// lib/analytics/constants.ts
export const POSTHOG_EVENTS = {
  // Auth events (server-side)
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  USER_LOGGED_OUT: "user_logged_out",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",

  // Subscription events (server-side)
  SUBSCRIPTION_CREATED: "subscription_created",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  PLAN_UPGRADED: "plan_upgraded",

  // UI events (client-side)
  SIGNUP_FORM_SUBMIT: "signup_flow:form_submit",
  ONBOARDING_STEP_COMPLETED: "onboarding:step_completed",
  FEATURE_USED: "feature:used",
} as const;

export type PostHogEvent = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];
```

### Client-Side Identification

```typescript
// Good Example - Identify on auth state change
"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

import { authClient } from "@/lib/auth-client";

export function useAnalyticsIdentify() {
  const posthog = usePostHog();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!posthog) return;

    if (session?.user) {
      // Only identify if not already identified
      if (!posthog._isIdentified()) {
        posthog.identify(session.user.id, {
          // Safe properties only - no PII in properties
          plan: session.user.plan ?? "free",
          created_at: session.user.createdAt,
          is_verified: session.user.emailVerified ?? false,
        });
      }
    }
  }, [posthog, session?.user]);
}

// Named export
export { useAnalyticsIdentify };
```

**Why good:** `_isIdentified()` prevents duplicate calls, uses database user ID (not email) as distinct_id, only safe properties stored (no PII), runs once on session change

```typescript
// Bad Example - Over-identifying
"use client";

import { usePostHog } from "posthog-js/react";

export function BadIdentify() {
  const posthog = usePostHog();

  // BAD: Runs on every render
  posthog?.identify("user@example.com", {
    // BAD: Email as ID
    email: "user@example.com", // BAD: PII in properties
    name: "John Doe", // BAD: PII in properties
    phone: "+1234567890", // BAD: PII in properties
  });
}
```

**Why bad:** Runs on every render (performance issue), email as distinct_id is PII, storing PII in properties violates privacy regulations

### Logout Reset

```typescript
// Good Example - Reset on logout
"use client";

import { usePostHog } from "posthog-js/react";

import { authClient } from "@/lib/auth-client";

export function useLogout() {
  const posthog = usePostHog();

  const handleLogout = async () => {
    // Track logout event before reset
    posthog?.capture("user_logged_out");

    // Reset PostHog to unlink future events
    posthog?.reset();

    // Then sign out
    await authClient.signOut();
  };

  return { logout: handleLogout };
}

export { useLogout };
```

**Why good:** Captures logout event before reset, reset() unlinks future events from this user, prevents shared computer user mixing
