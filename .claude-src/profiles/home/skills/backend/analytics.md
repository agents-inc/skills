---
name: Analytics
description: PostHog event tracking, user identification
---

# PostHog Analytics Patterns

> **Quick Guide:** Use PostHog for product analytics with structured event naming (category:object_action), server-side tracking for reliability, and proper user identification integrated with Better Auth. Client-side for UI interactions, server-side for business events.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST call `posthog.identify()` ONLY when a user signs up or logs in - never on every page load)**

**(You MUST include the user's database ID as `distinct_id` in ALL server-side events)**

**(You MUST call `posthog.reset()` when a user logs out to unlink future events)**

**(You MUST use the `category:object_action` naming convention for all custom events)**

**(You MUST NEVER include PII (email, name, phone) in event properties - use user IDs only)**

</critical_requirements>

---

**Auto-detection:** PostHog, posthog-js, posthog-node, usePostHog, PostHogProvider, capture, identify, group analytics, product analytics, event tracking, funnel analysis

**When to use:**

- Tracking user behavior and product analytics
- Setting up conversion funnels and retention analysis
- Implementing group analytics for B2B multi-tenant apps
- Understanding feature adoption and user journeys
- A/B testing analysis (in conjunction with feature flags)

**When NOT to use:**

- Feature flag implementation (use `backend/feature-flags.md` skill)
- PostHog setup and installation (use `setup/posthog.md` skill)
- Error tracking and logging (use dedicated error tracking tools)
- Infrastructure monitoring (use observability tools)

**Key patterns covered:**

- Event naming conventions (category:object_action)
- Property naming patterns (object_adjective, is_/has_ booleans)
- User identification with Better Auth integration
- Client-side tracking with React hooks
- Server-side tracking with posthog-node
- Group analytics for B2B organizations
- Privacy and GDPR consent patterns
- Funnel and cohort setup
- TypeScript patterns for type-safe events

---

<philosophy>

## Philosophy

PostHog analytics follows a **structured taxonomy** approach: consistent naming conventions, meaningful properties, and strategic placement (client vs server). Track what matters for product decisions, not everything.

**Core principles:**

1. **Server-side for business events** - User signups, purchases, subscriptions (reliable, not blocked)
2. **Client-side for UI interactions** - Button clicks, page views, form interactions
3. **Identify once per session** - Not on every page load
4. **Structured naming** - Makes querying and analysis possible at scale

**When to use PostHog analytics:**

- Product decisions need data (feature adoption, conversion funnels)
- B2B apps needing organization-level metrics
- User journey analysis and retention tracking
- A/B test result analysis

**When NOT to use analytics:**

- Debug logging (use structured logs instead)
- Error tracking (use Sentry or similar)
- Infrastructure metrics (use observability tools)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Event Naming Conventions

Use the **category:object_action** framework for consistent, queryable event names.

#### Naming Rules

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

#### Property Naming

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

### Pattern 2: User Identification with Better Auth

Integrate PostHog identification with your authentication flow.

#### Constants

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

#### Client-Side Identification

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

#### Logout Reset

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

### Pattern 3: Client-Side Tracking with React Hooks

Track UI interactions using PostHog React hooks.

#### Provider Setup

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

#### Event Tracking Hook

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

#### Component Usage

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

### Pattern 4: Server-Side Tracking with posthog-node

Track business events reliably from your backend.

#### PostHog Client Setup

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

#### Server-Side Event Tracking

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

#### Tracking Auth Events

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

### Pattern 5: Group Analytics for B2B

Track events at the organization level for multi-tenant apps.

#### Group Identification

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

#### Server-Side Group Events

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

#### Querying Group Metrics

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

### Pattern 6: Privacy and GDPR Consent

Handle tracking consent and privacy requirements.

#### Cookieless Mode Configuration

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

#### Consent Banner Integration

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

#### What NOT to Track

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

### Pattern 7: Funnel Analysis Setup

Structure events to enable funnel analysis in PostHog.

#### Funnel-Ready Events

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

#### PostHog Funnel Configuration

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

### Pattern 8: TypeScript Type-Safe Events

Create type-safe event tracking for compile-time safety.

#### Event Type Definitions

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

#### Type-Safe Track Function

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

</patterns>

---

<performance>

## Performance Optimization

### Batching in Web Apps

```typescript
// For web apps (not serverless), use default batching
posthog.init(POSTHOG_KEY, {
  api_host: "/ingest",
  // Default batching is efficient for web apps
  // Don't override flushAt/flushInterval unless serverless
});
```

### Serverless Optimization

```typescript
// For serverless, flush immediately
const posthogServer = new PostHog(POSTHOG_KEY, {
  host: POSTHOG_HOST,
  flushAt: 1,        // Flush after 1 event
  flushInterval: 0,  // No interval batching
});

// Always await flush before response
await posthogServer.flush();
```

### Reducing Event Volume

```typescript
// Use person_profiles: "identified_only" to reduce costs
// Anonymous events are 4x cheaper than identified events

posthog.init(POSTHOG_KEY, {
  person_profiles: "identified_only",

  // Optionally disable autocapture for high-traffic sites
  autocapture: false,
});
```

</performance>

---

<decision_framework>

## Decision Framework

### Client-Side vs Server-Side Tracking

```
Is the event a business action (signup, purchase, subscription)?
├── YES → Server-side (posthog-node)
│   └── More reliable, not blocked by ad blockers
└── NO → Is it a UI interaction (click, scroll, form input)?
    ├── YES → Client-side (posthog-js/react)
    └── NO → Consider if you need to track it at all
```

### Anonymous vs Identified Events

```
Do you need to associate events with a user profile?
├── YES → Identified events
│   └── Use posthog.identify() with user database ID
└── NO → Anonymous events (4x cheaper)
    └── Use person_profiles: "identified_only"
```

### When to Use Groups

```
Is this a B2B product with multi-user accounts?
├── YES → Use group analytics
│   ├── company: Organization/team accounts
│   ├── project: Multi-project workspaces
│   └── Max 5 group types per project
└── NO → Standard user-level analytics
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Better Auth**: Call identify() on login/signup, reset() on logout
- **React Query**: Track data fetch success/failure events
- **Hono API Routes**: Server-side event tracking with posthog-node
- **Feature Flags**: Same PostHog instance handles both (separate skill)

**Replaces / Conflicts with:**

- **Google Analytics**: Can use alongside, but PostHog is more product-focused
- **Mixpanel/Amplitude**: Direct competitors - choose one
- **Segment**: PostHog can be a Segment destination, or replace it

</integration>

---

<anti_patterns>

## Anti-Patterns

### Identifying on Every Page Load

```typescript
// ANTI-PATTERN: Identify on every render
function App() {
  const posthog = usePostHog();

  // BAD: Runs on every render!
  posthog?.identify(userId);
}
```

**Why it's wrong:** Creates unnecessary API calls, degrades performance, may cause rate limiting.

**What to do instead:** Check `_isIdentified()` first, or only identify on auth state changes.

---

### PII in Event Properties

```typescript
// ANTI-PATTERN: Storing PII
posthog.capture("user_action", {
  email: user.email,      // BAD
  name: user.name,        // BAD
  phone: user.phone,      // BAD
});
```

**Why it's wrong:** Violates GDPR, creates liability, can't be easily deleted.

**What to do instead:** Use user ID only, set safe properties on person profile.

---

### Missing Server-Side Flush

```typescript
// ANTI-PATTERN: No flush in serverless
export async function handler() {
  posthogServer.capture({
    distinctId: userId,
    event: "important_event",
  });

  return response; // Event may be lost!
}
```

**Why it's wrong:** Serverless functions terminate before batch flush.

**What to do instead:** Always `await posthogServer.flush()` before returning.

---

### Vague Event Names

```typescript
// ANTI-PATTERN: Unhelpful event names
posthog.capture("click");
posthog.capture("submit");
posthog.capture("action");
```

**Why it's wrong:** Can't distinguish between different clicks/submits, analysis impossible.

**What to do instead:** Use `category:object_action` format.

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using email as `distinct_id` - PII should not be the identifier
- Missing `posthog.reset()` on logout - Users get mixed together
- No `await flush()` in serverless - Events are lost
- PII in event properties - GDPR violation risk
- Calling `identify()` on every render - Performance degradation

**Medium Priority Issues:**

- Inconsistent event naming - Makes analysis difficult
- No category prefix in events - Hard to find related events
- Tracking everything with autocapture only - Signal-to-noise problem
- Missing group analytics for B2B - Can't measure organization metrics
- Not using `person_profiles: "identified_only"` - Higher costs

**Common Mistakes:**

- Importing `posthog` directly instead of using `usePostHog` hook
- Not setting up reverse proxy - Events blocked by ad blockers
- Different event names for same action on frontend vs backend
- Not testing events in development before production
- Forgetting to filter internal/test traffic

**Gotchas & Edge Cases:**

- `distinct_id` is required for ALL server-side events (unlike client-side)
- `group()` must include group ID with every event (not like `identify()`)
- Maximum 5 group types per project
- Cookieless mode doesn't support `identify()` - privacy trade-off
- Session IDs must be manually passed to server-side events
- PostHog web SDK is client-side only - won't work in Server Components

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST call `posthog.identify()` ONLY when a user signs up or logs in - never on every page load)**

**(You MUST include the user's database ID as `distinct_id` in ALL server-side events)**

**(You MUST call `posthog.reset()` when a user logs out to unlink future events)**

**(You MUST use the `category:object_action` naming convention for all custom events)**

**(You MUST NEVER include PII (email, name, phone) in event properties - use user IDs only)**

**Failure to follow these rules will cause analytics data quality issues, privacy violations, or lost events.**

</critical_reminders>

---

## Sources

- [PostHog Event Tracking Guide](https://posthog.com/tutorials/event-tracking-guide)
- [PostHog Best Practices](https://posthog.com/docs/product-analytics/best-practices)
- [PostHog User Identification](https://posthog.com/docs/getting-started/identify-users)
- [PostHog Group Analytics](https://posthog.com/docs/product-analytics/group-analytics)
- [PostHog GDPR Compliance](https://posthog.com/docs/privacy/gdpr-compliance)
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node)
- [PostHog Next.js Integration](https://posthog.com/docs/libraries/next-js)
- [PostHog React Integration](https://posthog.com/docs/libraries/react)
