# PostHog Analytics - Code Examples

> All code examples for PostHog analytics patterns. Return to [skill.md](skill.md) for core concepts.

---

## Pattern 1: Event Naming Conventions

### Naming Rules

```typescript
// ✅ Good Example - Structured event names
// Format: category:object_action
// - category: Context (signup_flow, settings, dashboard)
// - object: Component/location (password_button, pricing_page)
// - action: Present-tense verb (click, submit, view)

// Signup flow events
"signup_flow:email_form_submit"
"signup_flow:google_oauth_click"
"signup_flow:verification_email_sent"

// Dashboard events
"dashboard:project_create"
"dashboard:invite_member_click"
"dashboard:export_data_download"

// Settings events
"settings:password_change_submit"
"settings:notification_toggle"
"settings:billing_plan_upgrade"

// Alternative format: object_verb (simpler, still good)
"project_created"
"user_signed_up"
"invite_sent"
```

**Why good:** category prefix groups related events in PostHog UI, present-tense verbs are consistent, snake_case is lowercase and readable, structured names enable wildcard queries like `signup_flow:*`

```typescript
// ❌ Bad Example - Inconsistent naming
"UserSignedUp"           // BAD: PascalCase
"user-signed-up"         // BAD: kebab-case (use snake_case)
"clicked_button"         // BAD: Past tense
"button click"           // BAD: Spaces
"signup"                 // BAD: Too vague
"signUpFormSubmittedByUserOnPage" // BAD: Too verbose
```

**Why bad:** Inconsistent casing makes queries impossible, past tense mixes with present, vague names don't tell you what happened, verbose names are hard to type

### Property Naming

```typescript
// ✅ Good Example - Structured property names
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

export type PostHogEvent = typeof POSTHOG_EVENTS[keyof typeof POSTHOG_EVENTS];
```

### Client-Side Identification

```typescript
// ✅ Good Example - Identify on auth state change
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
// ❌ Bad Example - Over-identifying
"use client";

import { usePostHog } from "posthog-js/react";

export function BadIdentify() {
  const posthog = usePostHog();

  // BAD: Runs on every render
  posthog?.identify("user@example.com", { // BAD: Email as ID
    email: "user@example.com",    // BAD: PII in properties
    name: "John Doe",             // BAD: PII in properties
    phone: "+1234567890",         // BAD: PII in properties
  });
}
```

**Why bad:** Runs on every render (performance issue), email as distinct_id is PII, storing PII in properties violates privacy regulations

### Logout Reset

```typescript
// ✅ Good Example - Reset on logout
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

---

## Pattern 3: Client-Side Tracking with React Hooks

### Provider Setup

```typescript
// providers/posthog-provider.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY!;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

// Initialize PostHog
if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only", // Only create profiles for identified users
    capture_pageview: false, // Disable automatic pageviews (we handle manually)
    capture_pageleave: true, // Track when users leave pages
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      const url = window.origin + pathname;
      const search = searchParams?.toString();
      const fullUrl = search ? `${url}?${search}` : url;

      posthog.capture("$pageview", { $current_url: fullUrl });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}

export { PostHogProvider };
```

**Why good:** `person_profiles: "identified_only"` reduces costs (anonymous events 4x cheaper), manual pageview capture gives control over URL tracking, pageleave helps measure engagement

### Event Tracking Hook

```typescript
// hooks/use-analytics.ts
"use client";

import { useCallback } from "react";
import { usePostHog } from "posthog-js/react";

import type { PostHogEvent } from "@/lib/analytics/constants";

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export function useAnalytics() {
  const posthog = usePostHog();

  const track = useCallback(
    (event: PostHogEvent | string, properties?: EventProperties) => {
      if (!posthog) {
        console.warn("PostHog not initialized");
        return;
      }
      posthog.capture(event, properties);
    },
    [posthog]
  );

  const trackFeatureUsed = useCallback(
    (featureName: string, properties?: EventProperties) => {
      track("feature:used", {
        feature_name: featureName,
        ...properties,
      });
    },
    [track]
  );

  const trackOnboardingStep = useCallback(
    (stepNumber: number, stepName: string) => {
      track("onboarding:step_completed", {
        step_number: stepNumber,
        step_name: stepName,
      });
    },
    [track]
  );

  return { track, trackFeatureUsed, trackOnboardingStep };
}

export { useAnalytics };
```

**Why good:** Centralized tracking with type hints, convenience methods for common patterns, null-safe with warning for debugging

### Component Usage

```typescript
// ✅ Good Example - Tracking in components
"use client";

import { useAnalytics } from "@/hooks/use-analytics";
import { POSTHOG_EVENTS } from "@/lib/analytics/constants";

export function CreateProjectButton() {
  const { track } = useAnalytics();

  const handleClick = () => {
    track(POSTHOG_EVENTS.FEATURE_USED, {
      feature_name: "create_project",
      source: "dashboard_header",
    });

    // ... create project logic
  };

  return (
    <button onClick={handleClick} type="button">
      Create Project
    </button>
  );
}

export { CreateProjectButton };
```

**Why good:** Uses constant for event name, includes context (source), clean separation of tracking from business logic

---

## Pattern 4: Server-Side Tracking with posthog-node

### PostHog Client Setup

```typescript
// lib/analytics/posthog-server.ts
import { PostHog } from "posthog-node";

const POSTHOG_KEY = process.env.POSTHOG_API_KEY!;
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://app.posthog.com";

// Serverless-optimized settings
const FLUSH_AT = 1; // Flush immediately in serverless
const FLUSH_INTERVAL_MS = 0; // Don't wait

export const posthogServer = new PostHog(POSTHOG_KEY, {
  host: POSTHOG_HOST,
  flushAt: FLUSH_AT, // Flush after 1 event (serverless)
  flushInterval: FLUSH_INTERVAL_MS, // Don't batch (serverless)
});

// Named export
export { posthogServer };
```

**Why good:** `flushAt: 1` and `flushInterval: 0` ensure events are sent before serverless function terminates, prevents lost events in short-lived functions

### Server-Side Event Tracking

```typescript
// ✅ Good Example - Server-side tracking in Hono route
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { posthogServer } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/analytics/constants";

const app = new OpenAPIHono();

const createProjectRoute = createRoute({
  method: "post",
  path: "/projects",
  operationId: "createProject",
  tags: ["Projects"],
  // ... route config
});

app.openapi(createProjectRoute, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  // ... create project logic
  const project = await createProject(body);

  // Track server-side event
  posthogServer.capture({
    distinctId: user.id, // REQUIRED: User's database ID
    event: POSTHOG_EVENTS.PROJECT_CREATED,
    properties: {
      project_id: project.id,
      project_name: project.name, // OK if not PII
      plan: user.plan,
      is_first_project: user.projectCount === 0,
    },
  });

  // Ensure event is sent before response
  await posthogServer.flush();

  return c.json({ project }, 201);
});

export { app as projectsRoutes };
```

**Why good:** `distinctId` uses database user ID, flush() ensures delivery before function ends, business event captured reliably on server

```typescript
// ❌ Bad Example - Missing required fields
posthogServer.capture({
  // BAD: Missing distinctId - event will fail
  event: "project_created",
  properties: {
    email: user.email, // BAD: PII in properties
  },
});
// BAD: No flush() - event may be lost in serverless
```

**Why bad:** Missing distinctId causes event failure, PII in properties violates privacy, no flush() risks losing events in serverless

### Tracking Auth Events

```typescript
// lib/auth-events.ts
import { posthogServer } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/analytics/constants";

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

  await posthogServer.flush();
}

export async function trackUserLoggedIn(user: AuthEventUser) {
  posthogServer.capture({
    distinctId: user.id,
    event: POSTHOG_EVENTS.USER_LOGGED_IN,
    properties: {
      login_timestamp: new Date().toISOString(),
    },
  });

  await posthogServer.flush();
}

export { trackUserSignedUp, trackUserLoggedIn };
```

**Why good:** Centralized auth event tracking, identify() sets user properties once, flush() ensures delivery

---

## Pattern 5: Group Analytics for B2B

### Group Identification

```typescript
// ✅ Good Example - Identify organization group
"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

import { authClient } from "@/lib/auth-client";

export function useOrganizationAnalytics() {
  const posthog = usePostHog();
  const activeOrg = authClient.useActiveOrganization();

  useEffect(() => {
    if (!posthog || !activeOrg.data) return;

    // Identify the organization group
    posthog.group("company", activeOrg.data.id, {
      name: activeOrg.data.name,
      plan: activeOrg.data.plan ?? "free",
      member_count: activeOrg.data.memberCount,
      created_at: activeOrg.data.createdAt,
    });
  }, [posthog, activeOrg.data]);
}

export { useOrganizationAnalytics };
```

**Why good:** Uses database org ID as group key, sets useful org properties, runs when org context changes

### Server-Side Group Events

```typescript
// ✅ Good Example - Group event on server
import { posthogServer } from "@/lib/analytics/posthog-server";

interface InviteEventData {
  userId: string;
  organizationId: string;
  inviteeEmail: string; // Don't include in properties!
  role: string;
}

export async function trackMemberInvited(data: InviteEventData) {
  posthogServer.capture({
    distinctId: data.userId,
    event: "organization:member_invited",
    properties: {
      role: data.role,
      // Note: inviteeEmail NOT included (PII)
    },
    groups: {
      company: data.organizationId,
    },
  });

  // Update organization properties
  posthogServer.groupIdentify({
    groupType: "company",
    groupKey: data.organizationId,
    properties: {
      last_invite_sent_at: new Date().toISOString(),
    },
  });

  await posthogServer.flush();
}

export { trackMemberInvited };
```

**Why good:** Event associated with both user AND organization, groupIdentify updates org properties, PII (email) excluded from properties

### Querying Group Metrics

```markdown
In PostHog:
- Trends: "Unique companies" aggregation
- Funnels: "Aggregating by Unique organizations"
- Retention: Organization-level retention curves
- Metrics: "Daily Active Companies" instead of DAU
```

**When to use groups:**

- B2B SaaS with team/organization accounts
- Marketplaces tracking buyer and seller companies
- Enterprise features needing org-level rollout

**Limitations:**

- Maximum 5 group types per project
- One group per type per event (can't have Company A AND Company B)

---

## Pattern 6: Privacy and GDPR Consent

### Cookieless Mode Configuration

```typescript
// ✅ Good Example - GDPR-compliant initialization
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY!;

// Initialize with consent-aware settings
posthog.init(POSTHOG_KEY, {
  api_host: "/ingest", // Use reverse proxy to avoid ad blockers
  person_profiles: "identified_only",
  capture_pageview: false,

  // GDPR: Don't set cookies until consent
  persistence: "localStorage+cookie",

  // Option 1: Full cookieless (no consent banner needed)
  // cookieless_mode: "always",

  // Option 2: Cookieless until consent (show banner)
  cookieless_mode: "on_reject",
});
```

**Why good:** `cookieless_mode: "on_reject"` respects user choice, reverse proxy increases delivery rate, `person_profiles: "identified_only"` reduces cost and data

### Consent Banner Integration

```typescript
// ✅ Good Example - Consent management
"use client";

import { useState, useEffect } from "react";
import { usePostHog } from "posthog-js/react";

const CONSENT_STORAGE_KEY = "analytics_consent";

type ConsentStatus = "granted" | "denied" | "pending";

export function useCookieConsent() {
  const posthog = usePostHog();
  const [consent, setConsent] = useState<ConsentStatus>("pending");

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY) as ConsentStatus | null;
    if (stored) {
      setConsent(stored);
      if (stored === "granted") {
        posthog?.opt_in_capturing();
      }
    }
  }, [posthog]);

  const acceptCookies = () => {
    setConsent("granted");
    localStorage.setItem(CONSENT_STORAGE_KEY, "granted");
    posthog?.opt_in_capturing();
  };

  const rejectCookies = () => {
    setConsent("denied");
    localStorage.setItem(CONSENT_STORAGE_KEY, "denied");
    posthog?.opt_out_capturing();
  };

  return { consent, acceptCookies, rejectCookies };
}

export { useCookieConsent };
```

**Why good:** Persists consent choice, `opt_in_capturing()` and `opt_out_capturing()` are PostHog's official consent methods, handles pending state for first-time visitors

### What NOT to Track

```typescript
// ❌ NEVER include PII in event properties
const badProperties = {
  email: "user@example.com",      // PII
  name: "John Doe",               // PII
  phone: "+1234567890",           // PII
  ip_address: "192.168.1.1",      // PII
  address: "123 Main St",         // PII
  credit_card: "4111...",         // PII + Payment data
  password: "secret",             // Sensitive
  ssn: "123-45-6789",             // PII
};

// ✅ Safe properties to include
const goodProperties = {
  user_id: "user_abc123",         // Pseudonymized ID
  plan: "pro",                    // Account metadata
  feature_name: "export",         // Product data
  is_enterprise: true,            // Boolean flags
  source: "google_ads",           // Attribution
  page_path: "/dashboard",        // Navigation (no PII in URL)
};
```

---

## Pattern 7: Funnel Analysis Setup

### Funnel-Ready Events

```typescript
// ✅ Good Example - Events designed for funnel analysis
// Signup funnel: Visit -> Start -> Verify -> Complete

// Step 1: User visits signup page
track("signup_flow:page_view", {
  source: utmSource,
  referrer: document.referrer,
});

// Step 2: User starts signup form
track("signup_flow:form_started", {
  method: "email", // or "google", "github"
});

// Step 3: User submits form
track("signup_flow:form_submitted", {
  method: "email",
  has_referral_code: Boolean(referralCode),
});

// Step 4: User verifies email (server-side)
posthogServer.capture({
  distinctId: userId,
  event: "signup_flow:email_verified",
  properties: {
    verification_time_seconds: verificationTimeSeconds,
  },
});

// Step 5: User completes onboarding (server-side)
posthogServer.capture({
  distinctId: userId,
  event: "signup_flow:onboarding_completed",
  properties: {
    steps_completed: completedSteps.length,
    total_steps: ONBOARDING_STEPS_COUNT,
  },
});
```

**Why good:** Consistent `signup_flow:` prefix groups funnel events, each step has unique action, properties enable breakdown analysis (by method, source)

### PostHog Funnel Configuration

```markdown
In PostHog Funnels:
1. Create new funnel
2. Add steps in order:
   - signup_flow:page_view
   - signup_flow:form_started
   - signup_flow:form_submitted
   - signup_flow:email_verified
   - signup_flow:onboarding_completed
3. Set conversion window (e.g., 7 days)
4. Break down by: method, source, plan

Key metrics:
- Overall conversion rate
- Drop-off at each step
- Time to convert
- Breakdown by acquisition source
```

---

## Pattern 8: TypeScript Type-Safe Events

### Event Type Definitions

```typescript
// lib/analytics/types.ts

// Event name union type
export type AnalyticsEvent =
  | "user_signed_up"
  | "user_logged_in"
  | "user_logged_out"
  | "project_created"
  | "project_deleted"
  | "subscription_created"
  | "subscription_cancelled"
  | "feature:used"
  | "onboarding:step_completed"
  | "signup_flow:form_submitted";

// Base properties all events should have
interface BaseEventProperties {
  timestamp?: string;
}

// Event-specific property types
interface UserSignedUpProperties extends BaseEventProperties {
  plan: "free" | "pro" | "enterprise";
  source?: string;
}

interface ProjectCreatedProperties extends BaseEventProperties {
  project_id: string;
  is_first_project: boolean;
}

interface FeatureUsedProperties extends BaseEventProperties {
  feature_name: string;
  source?: string;
}

interface OnboardingStepProperties extends BaseEventProperties {
  step_number: number;
  step_name: string;
}

// Event property map
export interface EventPropertyMap {
  user_signed_up: UserSignedUpProperties;
  project_created: ProjectCreatedProperties;
  "feature:used": FeatureUsedProperties;
  "onboarding:step_completed": OnboardingStepProperties;
  // Add more as needed...
}

// Named exports
export type {
  AnalyticsEvent,
  EventPropertyMap,
  UserSignedUpProperties,
  ProjectCreatedProperties,
};
```

### Type-Safe Track Function

```typescript
// ✅ Good Example - Type-safe tracking
import type { AnalyticsEvent, EventPropertyMap } from "@/lib/analytics/types";

export function useTypedAnalytics() {
  const posthog = usePostHog();

  // Overloaded track function for type safety
  function track<E extends keyof EventPropertyMap>(
    event: E,
    properties: EventPropertyMap[E]
  ): void;
  function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void;
  function track(event: string, properties?: Record<string, unknown>): void {
    posthog?.capture(event, properties);
  }

  return { track };
}

// Usage - TypeScript catches errors at compile time
const { track } = useTypedAnalytics();

// ✅ Correct - TypeScript validates properties
track("user_signed_up", {
  plan: "pro",
  source: "google_ads",
});

// ❌ Error - Missing required property "plan"
track("user_signed_up", {
  source: "google_ads",
});

// ❌ Error - Invalid plan value
track("user_signed_up", {
  plan: "invalid_plan", // Type error!
});
```

**Why good:** Compile-time validation catches typos and missing properties, IDE autocomplete for event names and properties, type definitions serve as documentation
