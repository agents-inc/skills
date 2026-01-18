# Feature Flags Core Examples

> Essential patterns for PostHog feature flags. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**
- [payloads.md](payloads.md) - Remote configuration with JSON payloads
- [server-side.md](server-side.md) - Server-side evaluation with posthog-node
- [rollouts.md](rollouts.md) - Gradual rollouts and user targeting
- [experiments.md](experiments.md) - A/B testing with experiments
- [development.md](development.md) - Local development overrides
- [lifecycle.md](lifecycle.md) - Flag cleanup and lifecycle management

---

## Pattern 1: Client-Side Boolean Flags

Use `useFeatureFlagEnabled` for simple on/off features. Handle the `undefined` loading state.

### Constants

```typescript
// lib/feature-flags.ts
export const FLAG_NEW_CHECKOUT = "new-checkout-flow";
export const FLAG_DARK_MODE = "dark-mode-enabled";
export const FLAG_BETA_DASHBOARD = "beta-dashboard";
```

### Good Example - Handle undefined state

```typescript
// components/checkout-button.tsx
import { useFeatureFlagEnabled } from "posthog-js/react";

import { FLAG_NEW_CHECKOUT } from "@/lib/feature-flags";

export const CheckoutButton = () => {
  const isNewCheckout = useFeatureFlagEnabled(FLAG_NEW_CHECKOUT);

  // Flag is loading - show nothing or skeleton
  if (isNewCheckout === undefined) {
    return <ButtonSkeleton />;
  }

  // Flag resolved - render appropriate UI
  if (isNewCheckout) {
    return <NewCheckoutButton />;
  }

  return <LegacyCheckoutButton />;
};
```

**Why good:** Named constant prevents typos, undefined check prevents flash of wrong content, explicit handling of all states

### Bad Example - No loading state, magic string

```typescript
import { useFeatureFlagEnabled } from "posthog-js/react";

export const CheckoutButton = () => {
  // BAD: Magic string for flag key
  // BAD: Treating undefined as false causes flash of legacy UI
  const isNewCheckout = useFeatureFlagEnabled("new-checkout-flow");

  if (isNewCheckout) {
    return <NewCheckoutButton />;
  }

  return <LegacyCheckoutButton />; // Shows briefly while loading!
};
```

**Why bad:** Magic string causes typos and makes flag hard to find for cleanup, undefined treated as false shows wrong UI briefly before flag loads

---

## Pattern 2: Multivariate Flags and Variants

Use `useFeatureFlagVariantKey` for A/B tests with multiple variants.

### Constants

```typescript
// lib/feature-flags.ts
export const FLAG_PRICING_PAGE = "pricing-page-experiment";

// Variant constants prevent typos
export const VARIANT_CONTROL = "control";
export const VARIANT_SIMPLE = "simple";
export const VARIANT_DETAILED = "detailed";
```

### Good Example - Multivariate flag with loading state

```typescript
// components/pricing-page.tsx
import { useFeatureFlagVariantKey } from "posthog-js/react";

import {
  FLAG_PRICING_PAGE,
  VARIANT_CONTROL,
  VARIANT_SIMPLE,
  VARIANT_DETAILED,
} from "@/lib/feature-flags";

export const PricingPage = () => {
  const variant = useFeatureFlagVariantKey(FLAG_PRICING_PAGE);

  // Loading state
  if (variant === undefined) {
    return <PricingPageSkeleton />;
  }

  // Render based on variant
  switch (variant) {
    case VARIANT_SIMPLE:
      return <SimplePricing />;
    case VARIANT_DETAILED:
      return <DetailedPricing />;
    case VARIANT_CONTROL:
    default:
      return <ControlPricing />;
  }
};
```

**Why good:** Variant constants prevent typos, switch statement handles all cases, default fallback to control variant, loading state prevents flash

---

## Pattern 3: PostHogFeature Component

Use the `PostHogFeature` component for automatic exposure tracking and cleaner code.

### Good Example - PostHogFeature handles exposure tracking

```typescript
import { PostHogFeature } from "posthog-js/react";

import { FLAG_BETA_DASHBOARD } from "@/lib/feature-flags";

export const Dashboard = () => {
  return (
    <PostHogFeature
      flag={FLAG_BETA_DASHBOARD}
      match={true} // Show when flag is true
      fallback={<LegacyDashboard />}
    >
      <BetaDashboard />
    </PostHogFeature>
  );
};
```

**Why good:** Automatic exposure event tracking, cleaner JSX, built-in fallback handling, less boilerplate than hooks

### Good Example - PostHogFeature with variant matching

```typescript
import { PostHogFeature } from "posthog-js/react";

import { FLAG_PRICING_PAGE, VARIANT_SIMPLE } from "@/lib/feature-flags";

export const PricingSection = () => {
  return (
    <PostHogFeature
      flag={FLAG_PRICING_PAGE}
      match={VARIANT_SIMPLE} // Show when variant is "simple"
      fallback={<DefaultPricing />}
    >
      <SimplePricing />
    </PostHogFeature>
  );
};
```

**Why good:** Match specific variant values, automatic exposure tracking for experiment

---

_Back to [SKILL.md](../SKILL.md) | Extended examples: [payloads.md](payloads.md) | [server-side.md](server-side.md) | [rollouts.md](rollouts.md) | [experiments.md](experiments.md) | [development.md](development.md) | [lifecycle.md](lifecycle.md)_
