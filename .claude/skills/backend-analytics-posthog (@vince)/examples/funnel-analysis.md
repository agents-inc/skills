# PostHog Analytics - Funnel Analysis Setup

> Designing events for conversion funnel analysis in PostHog.
>
> **Return to:** [SKILL.md](../SKILL.md) | **Prerequisites:** [core.md](core.md)
>
> **Related:** [server-tracking.md](server-tracking.md) | [type-safety.md](type-safety.md)

---

## Funnel-Ready Events

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

---

## PostHog Funnel Configuration

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

## Funnel Design Guidelines

**Event naming for funnels:**

1. Use consistent prefix for all funnel steps (e.g., `signup_flow:`, `checkout:`, `onboarding:`)
2. Each step should have a unique action verb
3. Include properties that enable segmentation

**Common funnel breakdowns:**

| Property | Purpose |
|----------|---------|
| `source` | Attribution analysis |
| `method` | Compare auth methods |
| `plan` | Compare conversion by tier |
| `has_referral_code` | Measure referral impact |

**Funnel tips:**

- Track both client-side (UI interactions) and server-side (business events)
- Server-side events are more reliable for critical conversions
- Include timestamps in properties for time-to-convert analysis
