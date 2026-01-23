# A/B Testing with Experiments Examples

> A/B testing patterns with PostHog experiments. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern: A/B Testing with Experiments

Run experiments to measure feature impact.

### Setting Up an Experiment

```typescript
// lib/feature-flags.ts

// Experiment flag with variants
export const FLAG_SIGNUP_EXPERIMENT = "signup-flow-experiment";
export const VARIANT_CONTROL = "control";
export const VARIANT_STREAMLINED = "streamlined";
export const VARIANT_SOCIAL_FIRST = "social-first";

// Minimum exposures for statistical significance
export const MIN_EXPERIMENT_EXPOSURES = 50;
```

### Good Example - Experiment with variant tracking

```typescript
// components/signup-flow.tsx
import { useFeatureFlagVariantKey } from "posthog-js/react";

import {
  FLAG_SIGNUP_EXPERIMENT,
  VARIANT_CONTROL,
  VARIANT_STREAMLINED,
  VARIANT_SOCIAL_FIRST,
} from "@/lib/feature-flags";

export const SignupFlow = () => {
  const variant = useFeatureFlagVariantKey(FLAG_SIGNUP_EXPERIMENT);

  // Handle loading
  if (variant === undefined) {
    return <SignupSkeleton />;
  }

  // Render variant - PostHog automatically tracks exposure
  switch (variant) {
    case VARIANT_STREAMLINED:
      return <StreamlinedSignup />;
    case VARIANT_SOCIAL_FIRST:
      return <SocialFirstSignup />;
    case VARIANT_CONTROL:
    default:
      return <ControlSignup />;
  }
};
```

### Tracking Experiment Goals

```typescript
// components/signup-success.tsx
import { usePostHog } from "posthog-js/react";

const EVENT_SIGNUP_COMPLETED = "signup_completed";

export const SignupSuccess = () => {
  const posthog = usePostHog();

  useEffect(() => {
    // Track conversion event - PostHog links to experiment exposure
    posthog.capture(EVENT_SIGNUP_COMPLETED, {
      method: "email", // Additional properties for analysis
    });
  }, [posthog]);

  return <SuccessMessage />;
};
```

**Why good:** useFeatureFlagVariantKey sends exposure event, capture sends conversion event, PostHog calculates statistical significance automatically

**Experiment requirements:**

- Minimum 50 exposures per variant for results
- Define primary metric before starting
- Don't peek at results early (statistical errors)
- Run for predetermined duration

---

_Back to [SKILL.md](../SKILL.md) | [core.md](core.md)_
