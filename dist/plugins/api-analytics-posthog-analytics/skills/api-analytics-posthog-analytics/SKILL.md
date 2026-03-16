---
name: api-analytics-posthog-analytics
description: PostHog event tracking, user identification, group analytics for B2B, GDPR consent patterns. Use when implementing product analytics, tracking user behavior, setting up funnels, or configuring privacy-compliant tracking.
---

# PostHog Analytics Patterns

> **Quick Guide:** Use PostHog for product analytics with structured event naming (`category:object_action`), server-side tracking for reliability, and proper user identification integrated with your authentication flow. Client-side for UI interactions, server-side for business events. Always call `reset()` on logout, never store PII in event properties, and use `captureImmediate()` or `await shutdown()` in serverless environments.

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Event naming, user identification, property conventions
- [examples/client-tracking.md](examples/client-tracking.md) - React hooks, provider setup, component tracking
- [examples/server-tracking.md](examples/server-tracking.md) - posthog-node, serverless patterns, auth events
- [examples/group-analytics.md](examples/group-analytics.md) - B2B organization tracking
- [examples/privacy-gdpr.md](examples/privacy-gdpr.md) - GDPR consent, cookieless mode, PII filtering
- [reference.md](reference.md) - Decision frameworks, anti-patterns, event taxonomy

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

- Feature flag implementation (separate concern)
- Error tracking and logging (use dedicated error tracking tools)
- Infrastructure monitoring (use observability tools)

**Key patterns covered:**

- Event naming conventions (`category:object_action`)
- Property naming patterns (`object_adjective`, `is_`/`has_` booleans)
- User identification with authentication flow integration
- Client-side tracking with React hooks
- Server-side tracking with posthog-node
- Group analytics for B2B organizations
- Privacy and GDPR consent patterns
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

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Event Naming Conventions

Use the **`category:object_action`** framework for consistent, queryable event names.

```typescript
// category: Context (signup_flow, settings, dashboard)
// object: Component/location (password_button, pricing_page)
// action: Present-tense verb (click, submit, view)

"signup_flow:email_form_submit";
"dashboard:project_create";
"settings:billing_plan_upgrade";

// Simpler alternative: object_verb
"project_created";
"user_signed_up";
```

**Why good:** Category prefix groups related events in PostHog UI, enables wildcard queries like `signup_flow:*`, consistent naming makes analysis possible at scale.

**Property naming rules:**

- `object_adjective`: `project_id`, `plan_name`, `item_count`
- `is_` / `has_` for booleans: `is_first_purchase`, `has_completed_onboarding`
- `_date` / `_timestamp` suffix: `trial_end_date`, `last_login_timestamp`

See [examples/core.md](examples/core.md) for complete naming examples.

---

### Pattern 2: User Identification with Authentication

Call `identify()` only on auth state change (not every render). Use database user ID as `distinct_id`. Call `reset()` on logout.

```typescript
// Check _isIdentified() to prevent duplicate calls
useEffect(() => {
  if (session?.user && !posthog._isIdentified()) {
    posthog.identify(session.user.id, {
      plan: session.user.plan ?? "free",
      created_at: session.user.createdAt,
      is_verified: session.user.emailVerified ?? false,
    });
  }
}, [session?.user]);
```

```typescript
// Always reset on logout
posthog?.capture("user_logged_out");
posthog?.reset(); // Unlink future events from this user
```

See [examples/core.md](examples/core.md) for full identification hook and logout handler.

---

### Pattern 3: Server-Side Tracking

Track business events reliably from your backend with posthog-node.

```typescript
// Serverless: use captureImmediate (guarantees HTTP completion)
await posthogServer.captureImmediate({
  distinctId: user.id,
  event: "subscription_created",
  properties: { plan: "pro", is_annual: true },
});

// Always call shutdown before returning in serverless
await posthogServer.shutdown();
```

**Key rules:**

1. Always include `distinctId` (user's database ID)
2. Use `captureImmediate()` for serverless (guarantees HTTP completion)
3. Always call `shutdown()` before returning in serverless
4. Configure `flushAt: 1` and `flushInterval: 0` for serverless

See [examples/server-tracking.md](examples/server-tracking.md) for complete server setup and route examples.

---

### Pattern 4: Group Analytics (B2B)

Associate events with organizations using PostHog groups for B2B metrics.

```typescript
// Client-side: identify organization
posthog.group("company", org.id, {
  name: org.name,
  plan: org.plan ?? "free",
  member_count: org.memberCount,
});

// Server-side: include groups in event
posthogServer.capture({
  distinctId: user.id,
  event: "organization:member_invited",
  properties: { role: data.role },
  groups: { company: data.organizationId },
});
```

**Limitations:** Maximum 5 group types per project. One group per type per event.

See [examples/group-analytics.md](examples/group-analytics.md) for complete group patterns.

---

### Pattern 5: Privacy and GDPR Consent

PostHog supports cookieless tracking and consent management.

```typescript
// Cookieless mode: "always" (no consent needed) or "on_reject" (with banner)
posthog.init(POSTHOG_KEY, {
  cookieless_mode: "on_reject",
  person_profiles: "identified_only",
});

// Consent methods
posthog.opt_in_capturing(); // User accepts
posthog.opt_out_capturing(); // User rejects
```

**Key rule:** Never store PII (email, name, phone, IP, address) in event properties. Use pseudonymized IDs only.

See [examples/privacy-gdpr.md](examples/privacy-gdpr.md) for consent banner integration and `before_send` filtering.

</patterns>

---

<performance>

## Performance Optimization

**Web Apps (default batching):** Use default settings -- PostHog batches efficiently out of the box.

**Serverless (immediate delivery):**

```typescript
const posthogServer = new PostHog(POSTHOG_KEY, {
  flushAt: 1, // Flush after 1 event
  flushInterval: 0, // No interval batching
});
// Use captureImmediate() or capture() + await shutdown()
```

**Reducing Costs:**

```typescript
posthog.init(POSTHOG_KEY, {
  person_profiles: "identified_only", // Anonymous events 4x cheaper
  autocapture: false, // Disable for high-traffic sites
});
```

</performance>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using email as `distinct_id` -- PII should not be the identifier
- Missing `posthog.reset()` on logout -- users get mixed together
- No `await shutdown()` in serverless -- events are lost
- PII in event properties -- GDPR violation risk
- Calling `identify()` on every render -- performance degradation

**Common Mistakes:**

- Importing `posthog` directly instead of using `usePostHog` hook in React
- Not setting up reverse proxy (`api_host: "/ingest"`) -- events blocked by ad blockers
- Different event names for same action on frontend vs backend
- Not using `person_profiles: "identified_only"` -- 4x higher costs on anonymous events
- Using `capture()` instead of `captureImmediate()` in serverless -- events may not complete

**Gotchas & Edge Cases:**

- `distinct_id` is required for ALL server-side events (unlike client-side which auto-generates one)
- `group()` must include group ID with every event (not persisted like `identify()`)
- Maximum 5 group types per project
- `cookieless_mode: "always"` disables `identify()` entirely -- privacy trade-off
- PostHog web SDK is client-side only -- will not work in server components
- Session IDs must be manually passed to server-side events for session linking

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
