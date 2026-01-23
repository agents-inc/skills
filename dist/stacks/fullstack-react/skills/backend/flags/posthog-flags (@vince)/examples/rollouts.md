# Gradual Rollouts and Targeting Examples

> Gradual rollouts and user targeting patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Gradual Rollouts

Use percentage-based rollouts for safe feature releases.

### Rollout Strategy

```typescript
// lib/feature-flags.ts

// Document rollout plan in constants
export const FLAG_NEW_PAYMENT_FLOW = "new-payment-flow";

// Rollout phases (configured in PostHog dashboard)
// Phase 1: 5% - Internal testing
// Phase 2: 25% - Beta users
// Phase 3: 50% - Half of users
// Phase 4: 100% - General availability
```

### Implementation

```typescript
// components/payment-form.tsx
import { useFeatureFlagEnabled } from "posthog-js/react";

import { FLAG_NEW_PAYMENT_FLOW } from "@/lib/feature-flags";

export const PaymentForm = () => {
  const isNewFlow = useFeatureFlagEnabled(FLAG_NEW_PAYMENT_FLOW);

  // Loading state
  if (isNewFlow === undefined) {
    return <PaymentFormSkeleton />;
  }

  // PostHog assigns users deterministically based on distinct_id
  // Same user always gets same variant (sticky assignment)
  if (isNewFlow) {
    return <NewPaymentFlow />;
  }

  return <LegacyPaymentFlow />;
};
```

**Why good:** Deterministic assignment ensures consistent experience per user, gradual rollout catches issues before 100% exposure

**Rollout best practices:**

1. Start at 5% and monitor error rates
2. Increase to 25% after 24 hours if stable
3. Increase to 50% after another 24 hours
4. Roll out to 100% if all metrics look good
5. Keep kill switch ready for instant rollback

---

## Pattern 2: User and Cohort Targeting

Target specific users based on properties or cohorts.

### Good Example - Targeting with person properties

```typescript
// lib/posthog-server.ts

export async function checkFeatureForUser(
  userId: string,
  userProperties: {
    email: string;
    plan: string;
    company?: string;
  },
) {
  const isEnabled = await posthog.isFeatureEnabled(
    FLAG_ENTERPRISE_FEATURE,
    userId,
    {
      // Properties used for targeting rules in PostHog
      personProperties: {
        email: userProperties.email,
        plan: userProperties.plan,
        company: userProperties.company,
      },
    },
  );

  return isEnabled;
}
```

**Why good:** Person properties enable targeting (e.g., plan = "enterprise"), server-side evaluation prevents client manipulation of targeting

### Cohort Targeting in PostHog Dashboard

```markdown
## PostHog Dashboard Configuration

1. Create cohort: "Beta Users"
   - Condition: email contains "@beta.example.com" OR
   - Condition: has property beta_tester = true

2. Create feature flag: "beta-feature"
   - Release condition: cohort = "Beta Users"
   - Rollout: 100%

3. Add second condition set:
   - Condition: All users
   - Rollout: 0% (default off for everyone else)
```

**Why good:** Cohorts are reusable across flags, easy to add/remove users from cohort, phased rollouts just swap cohorts

---

_Back to [SKILL.md](../SKILL.md) | [core.md](core.md)_
