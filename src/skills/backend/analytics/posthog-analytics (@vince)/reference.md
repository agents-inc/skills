# PostHog Analytics - Reference Guide

> Decision frameworks, anti-patterns, and red flags for PostHog analytics.
>
> **Return to:** [SKILL.md](SKILL.md) for core concepts.

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

- **Authentication flows**: Call identify() on login/signup, reset() on logout
- **API routes**: Server-side event tracking with posthog-node
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

## Event Taxonomy Reference

### Naming Convention

| Pattern | Example | Use Case |
|---------|---------|----------|
| `category:object_action` | `signup_flow:form_submit` | Grouped events for funnels |
| `object_action` | `project_created` | Simple business events |
| `$pageview` | `$pageview` | Page views (PostHog standard) |

### Property Conventions

| Pattern | Example | Description |
|---------|---------|-------------|
| `object_adjective` | `project_id`, `plan_name` | Entity references |
| `is_*` | `is_first_purchase` | Boolean flags |
| `has_*` | `has_completed_onboarding` | Boolean state |
| `*_date` | `trial_end_date` | Date strings |
| `*_timestamp` | `last_login_timestamp` | Unix timestamps |
| `*_count` | `item_count` | Numeric counts |

### Standard PostHog Events

| Event | Description |
|-------|-------------|
| `$pageview` | Page view (capture manually in Next.js) |
| `$pageleave` | User leaves page |
| `$autocapture` | Automatic click/form tracking |
| `$feature_flag_called` | Feature flag evaluated |

---

## Troubleshooting

### Events Not Appearing

1. **Check initialization**: Ensure `posthog.init()` called with valid key
2. **Check distinct_id**: Server-side events require explicit `distinctId`
3. **Check flush**: Serverless needs `await posthogServer.flush()`
4. **Check filters**: Verify not filtering by environment/user

### User Profiles Not Linked

1. **Check identify timing**: Only identify on auth changes
2. **Check distinct_id consistency**: Use same ID client and server
3. **Check reset on logout**: Missing `reset()` causes profile mixing

### High Costs

1. **Enable `person_profiles: "identified_only"`**: 4x cheaper anonymous events
2. **Disable autocapture**: If not using automatic click tracking
3. **Reduce pageview tracking**: Only track meaningful pages

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
