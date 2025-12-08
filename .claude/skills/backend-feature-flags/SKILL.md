# Feature Flags with PostHog

> **Quick Guide:** Use PostHog feature flags for gradual rollouts, A/B testing, and remote configuration. Client-side: `useFeatureFlagEnabled` hook. Server-side: `posthog-node` with local evaluation. Always pair `useFeatureFlagPayload` with `useFeatureFlagEnabled` for experiments.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always pair `useFeatureFlagPayload` with `useFeatureFlagEnabled` or `useFeatureFlagVariantKey` for experiments - payload hooks don't send exposure events)**

**(You MUST use the feature flag secure API key for server-side local evaluation - NEVER expose it on the client)**

**(You MUST handle the `undefined` state when flags are loading - never assume a flag is immediately available)**

**(You MUST include flag owner and expiry date in flag metadata - flags without owners become orphaned debt)**

**(You MUST wrap flag usage in a single function when used in multiple places - prevents orphaned flag code on cleanup)**

</critical_requirements>

---

**Auto-detection:** PostHog feature flags, useFeatureFlagEnabled, useFeatureFlagPayload, useFeatureFlagVariantKey, PostHogFeature, isFeatureEnabled, getFeatureFlag, gradual rollout, A/B test, experiment, multivariate flag

**When to use:**

- Gradual rollouts (deploy to 10% users, then 50%, then 100%)
- A/B testing with experiments (measure impact of changes)
- Kill switches (instantly disable features without deploy)
- Remote configuration (change behavior without code changes)
- Beta features opt-in (let users try new features)
- User targeting (show features to specific cohorts)

**When NOT to use:**

- Simple on/off switches that never change (use environment variables)
- Configuration that must be compile-time (use build flags)
- Secrets or sensitive data (use secret management)
- Features that should always be on (just ship the code)

**Key patterns covered:**

- Client-side flag evaluation with React hooks
- Server-side local evaluation for performance
- Boolean vs multivariate flags
- Gradual rollouts with percentage targeting
- User and cohort targeting
- A/B testing and experiments
- Payloads for remote configuration
- Local development overrides
- Flag cleanup and lifecycle management

---

<philosophy>

## Philosophy

Feature flags decouple deployment from release. You can ship code to production but control who sees it and when. This enables:

1. **Safe releases** - Roll out to 1% first, monitor, then expand
2. **Fast rollback** - Toggle off instantly without deploying
3. **Data-driven decisions** - A/B test to measure impact
4. **Progressive delivery** - Beta users first, then everyone

**Core principles:**

- Flags are temporary - plan for cleanup from day one
- Flags have owners - someone is responsible for each flag
- Simple flags are better - percentage rollouts over complex conditions
- Handle undefined - flags load asynchronously

**When to use feature flags:**

- Risky features that need gradual rollout
- Features requiring A/B testing for validation
- Features that may need instant rollback
- Beta programs with user opt-in

**When NOT to use feature flags:**

- Every feature (creates maintenance burden)
- Permanent configuration (use config files)
- Features that are ready for 100% release

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client-Side Boolean Flags

Use `useFeatureFlagEnabled` for simple on/off features. Handle the `undefined` loading state.

#### Constants

```typescript
// lib/feature-flags.ts
export const FLAG_NEW_CHECKOUT = "new-checkout-flow";
export const FLAG_DARK_MODE = "dark-mode-enabled";
export const FLAG_BETA_DASHBOARD = "beta-dashboard";
```

#### Implementation

```typescript
// components/checkout-button.tsx
import { useFeatureFlagEnabled } from "posthog-js/react";

import { FLAG_NEW_CHECKOUT } from "@/lib/feature-flags";

// ✅ Good Example - Handle undefined state
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

```typescript
// ❌ Bad Example - No loading state, magic string
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

### Pattern 2: Multivariate Flags and Variants

Use `useFeatureFlagVariantKey` for A/B tests with multiple variants.

#### Constants

```typescript
// lib/feature-flags.ts
export const FLAG_PRICING_PAGE = "pricing-page-experiment";

// Variant constants prevent typos
export const VARIANT_CONTROL = "control";
export const VARIANT_SIMPLE = "simple";
export const VARIANT_DETAILED = "detailed";
```

#### Implementation

```typescript
// components/pricing-page.tsx
import { useFeatureFlagVariantKey } from "posthog-js/react";

import {
  FLAG_PRICING_PAGE,
  VARIANT_CONTROL,
  VARIANT_SIMPLE,
  VARIANT_DETAILED,
} from "@/lib/feature-flags";

// ✅ Good Example - Multivariate flag with loading state
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

### Pattern 3: Feature Flag Payloads for Remote Configuration

Use `useFeatureFlagPayload` for dynamic configuration. Always pair with `useFeatureFlagEnabled` for experiments.

#### Constants

```typescript
// lib/feature-flags.ts
export const FLAG_BANNER_CONFIG = "homepage-banner";

// Default payload for fallback
export const DEFAULT_BANNER_CONFIG = {
  title: "Welcome",
  ctaText: "Get Started",
  ctaUrl: "/signup",
  backgroundColor: "#3B82F6",
};
```

#### Implementation

```typescript
// components/homepage-banner.tsx
import { useFeatureFlagEnabled, useFeatureFlagPayload } from "posthog-js/react";

import { FLAG_BANNER_CONFIG, DEFAULT_BANNER_CONFIG } from "@/lib/feature-flags";

interface BannerConfig {
  title: string;
  ctaText: string;
  ctaUrl: string;
  backgroundColor: string;
}

// ✅ Good Example - Payload with enabled check for experiment tracking
export const HomepageBanner = () => {
  // CRITICAL: Call useFeatureFlagEnabled to send exposure event
  const isEnabled = useFeatureFlagEnabled(FLAG_BANNER_CONFIG);

  // Get the payload configuration
  const payload = useFeatureFlagPayload(FLAG_BANNER_CONFIG) as BannerConfig | undefined;

  // Not enabled or loading
  if (!isEnabled) {
    return null;
  }

  // Use payload or fall back to defaults
  const config = payload ?? DEFAULT_BANNER_CONFIG;

  return (
    <div style={{ backgroundColor: config.backgroundColor }}>
      <h2>{config.title}</h2>
      <a href={config.ctaUrl}>{config.ctaText}</a>
    </div>
  );
};
```

**Why good:** useFeatureFlagEnabled sends $feature_flag_called event for experiment tracking, payload provides dynamic config, default config prevents undefined errors

```typescript
// ❌ Bad Example - Payload without enabled check
export const HomepageBanner = () => {
  // BAD: Only using payload - no $feature_flag_called event sent!
  // Experiments won't track exposure correctly
  const payload = useFeatureFlagPayload("homepage-banner");

  if (!payload) return null;

  return <Banner {...payload} />;
};
```

**Why bad:** useFeatureFlagPayload alone does NOT send exposure events, A/B test results will be incorrect, PostHog won't know user was exposed to experiment

---

### Pattern 4: PostHogFeature Component

Use the `PostHogFeature` component for automatic exposure tracking and cleaner code.

```typescript
// ✅ Good Example - PostHogFeature handles exposure tracking
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

```typescript
// ✅ Good Example - PostHogFeature with variant matching
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

### Pattern 5: Server-Side Flag Evaluation

Use `posthog-node` for server-side evaluation. Use local evaluation for performance.

#### Setup

```typescript
// lib/posthog-server.ts
import { PostHog } from "posthog-node";

const POSTHOG_POLL_INTERVAL_MS = 30000; // 30 seconds

// Initialize with local evaluation
export const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST || "https://app.posthog.com",
  // Enable local evaluation with feature flag secure key
  personalApiKey: process.env.POSTHOG_FEATURE_FLAGS_KEY,
  // Poll for flag definition updates
  featureFlagsPollingInterval: POSTHOG_POLL_INTERVAL_MS,
});

// Named export
export { posthog };
```

#### API Route Usage

```typescript
// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";

import { posthog } from "@/lib/posthog-server";
import { FLAG_BETA_DASHBOARD } from "@/lib/feature-flags";

// ✅ Good Example - Server-side flag evaluation
export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Evaluate flag server-side with user context
  const isBetaDashboard = await posthog.isFeatureEnabled(
    FLAG_BETA_DASHBOARD,
    userId,
    {
      // Provide person properties for targeting rules
      personProperties: {
        email: request.headers.get("x-user-email"),
        plan: request.headers.get("x-user-plan"),
      },
    }
  );

  if (isBetaDashboard) {
    return NextResponse.json({ dashboard: "beta", features: [...] });
  }

  return NextResponse.json({ dashboard: "stable", features: [...] });
}
```

**Why good:** Local evaluation reduces latency (500ms to 50ms), personProperties enable targeting, server-side prevents client manipulation

#### Local Evaluation Performance

```typescript
// ✅ Good Example - Local-only evaluation for performance
const flag = await posthog.isFeatureEnabled(
  FLAG_BETA_DASHBOARD,
  userId,
  {
    personProperties: { plan: "enterprise" },
    // Only evaluate locally - don't fall back to server
    onlyEvaluateLocally: true,
  }
);

// Returns undefined if local evaluation fails
if (flag === undefined) {
  // Fall back to default behavior
  return defaultDashboard();
}
```

**Why good:** onlyEvaluateLocally prevents server roundtrips, explicit undefined handling for fallback

```typescript
// ❌ Bad Example - Server-side without local evaluation
import { PostHog } from "posthog-node";

// BAD: No personalApiKey = no local evaluation
const posthog = new PostHog(process.env.POSTHOG_API_KEY!);

// BAD: Every call makes a network request (500ms latency)
const flag = await posthog.isFeatureEnabled("beta-dashboard", userId);
```

**Why bad:** No local evaluation = network request per flag check, high latency (500ms vs 50ms), increases PostHog API costs

---

### Pattern 6: Gradual Rollouts

Use percentage-based rollouts for safe feature releases.

#### Rollout Strategy

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

#### Implementation

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

### Pattern 7: User and Cohort Targeting

Target specific users based on properties or cohorts.

#### Person Property Targeting

```typescript
// lib/posthog-server.ts

// ✅ Good Example - Targeting with person properties
export async function checkFeatureForUser(
  userId: string,
  userProperties: {
    email: string;
    plan: string;
    company?: string;
  }
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
    }
  );

  return isEnabled;
}
```

**Why good:** Person properties enable targeting (e.g., plan = "enterprise"), server-side evaluation prevents client manipulation of targeting

#### Cohort Targeting in PostHog Dashboard

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

### Pattern 8: A/B Testing with Experiments

Run experiments to measure feature impact.

#### Setting Up an Experiment

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

#### Implementation

```typescript
// components/signup-flow.tsx
import { useFeatureFlagVariantKey } from "posthog-js/react";

import {
  FLAG_SIGNUP_EXPERIMENT,
  VARIANT_CONTROL,
  VARIANT_STREAMLINED,
  VARIANT_SOCIAL_FIRST,
} from "@/lib/feature-flags";

// ✅ Good Example - Experiment with variant tracking
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

#### Tracking Experiment Goals

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

### Pattern 9: Local Development Overrides

Override flags locally without affecting other users.

#### Method 1: Toolbar Override (Browser)

```typescript
// Use PostHog toolbar in development
// 1. Enable toolbar in PostHog project settings
// 2. Click feature flags icon in toolbar
// 3. Toggle flags on/off for your session only

// This only affects YOUR browser, not other users
// Does NOT affect server-side evaluation
```

#### Method 2: Code Override (Development Only)

```typescript
// lib/posthog-client.ts
import posthog from "posthog-js";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

// ✅ Good Example - Development-only flag overrides
export function initPostHog() {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    loaded: (posthog) => {
      if (IS_DEVELOPMENT) {
        // Override specific flags for local development
        posthog.featureFlags.overrideFeatureFlags({
          "new-checkout-flow": true,
          "beta-dashboard": "variant-a",
        });
      }
    },
  });
}
```

**Why good:** IS_DEVELOPMENT check ensures production isn't affected, overrideFeatureFlags works immediately, supports both boolean and variant values

#### Method 3: Bootstrapping for SSR

```typescript
// lib/posthog-client.ts
import posthog from "posthog-js";

// ✅ Good Example - Bootstrap flags for immediate availability
export function initPostHogWithBootstrap(bootstrapFlags: Record<string, boolean | string>) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    bootstrap: {
      featureFlags: bootstrapFlags,
    },
  });
}

// Usage in server component
// Fetch flags server-side, pass to client for immediate availability
```

**Why good:** Bootstrap eliminates flash of wrong content, flags available immediately on page load, essential for SSR/SSG

---

### Pattern 10: Flag Cleanup and Lifecycle Management

Plan for flag removal from day one. Stale flags become technical debt.

#### Flag Documentation Pattern

```typescript
// lib/feature-flags.ts

/**
 * Flag: new-checkout-flow
 * Owner: @john-doe
 * Created: 2025-01-15
 * Expected Removal: 2025-02-15 (after 30 days at 100%)
 * Purpose: Test streamlined checkout with fewer steps
 * Rollout Status: 50% as of 2025-01-20
 */
export const FLAG_NEW_CHECKOUT = "new-checkout-flow";

/**
 * Flag: holiday-banner
 * Owner: @marketing-team
 * Created: 2025-12-01
 * Expected Removal: 2025-01-02 (seasonal)
 * Purpose: Holiday promotion banner
 */
export const FLAG_HOLIDAY_BANNER = "holiday-banner";
```

**Why good:** Documentation makes ownership clear, expected removal date prevents flags from becoming stale, purpose helps future developers understand intent

#### Wrapper Pattern for Easy Cleanup

```typescript
// lib/feature-flags.ts

// ✅ Good Example - Single wrapper function for flag
export function isNewCheckoutEnabled(flagValue: boolean | undefined): boolean {
  // Single point of truth for this flag's behavior
  // When removing flag, only update this function
  return flagValue === true;
}

// Usage in components
const flagValue = useFeatureFlagEnabled(FLAG_NEW_CHECKOUT);
if (isNewCheckoutEnabled(flagValue)) {
  // New checkout code
}

// When removing flag, change to:
export function isNewCheckoutEnabled(_flagValue: boolean | undefined): boolean {
  return true; // Always enabled, ready for code cleanup
}
```

**Why good:** Single function to update when removing flag, grep for function name finds all usages, gradual cleanup possible

#### Stale Flag Detection

```typescript
// scripts/check-stale-flags.ts
// Run in CI to detect stale flags

/**
 * PostHog marks a flag as stale when:
 * 1. Rolled out to 100% AND
 * 2. Not evaluated in last 30 days
 *
 * Check stale flags in PostHog dashboard:
 * Feature Flags > Filter by "Stale"
 */

const STALE_FLAGS_QUERY = `
  SELECT key, created_at, last_evaluated_at
  FROM feature_flags
  WHERE rollout_percentage = 100
    AND last_evaluated_at < NOW() - INTERVAL '30 days'
`;
```

**Best practices for flag cleanup:**

1. Set expiry date when creating flag
2. Assign owner who is responsible for removal
3. Create cleanup ticket when flag hits 100%
4. Wrap flag in single function for easy grep
5. Run weekly "flag debt" review
6. Archive flag in PostHog before removing code

</patterns>

---

<decision_framework>

## Decision Framework

### Flag Type Selection

```
What kind of feature flag do you need?

Is it a simple on/off switch?
+-- YES -> Boolean flag
|   +-- Need to target specific users?
|   |   +-- YES -> Add release conditions (cohorts, properties)
|   |   +-- NO -> Use percentage rollout only
|   +-- Need remote configuration?
|       +-- YES -> Add JSON payload to flag
|       +-- NO -> Boolean value is sufficient
+-- NO -> Is it an A/B test with variants?
    +-- YES -> Multivariate flag
    |   +-- How many variants?
    |       +-- 2 (A/B) -> control + test
    |       +-- 3+ (MVT) -> control + multiple tests
    +-- NO -> Is it for experiments with metrics?
        +-- YES -> Create as Experiment in PostHog
        +-- NO -> Consider if you really need a flag
```

### Client vs Server Evaluation

```
Where should you evaluate the flag?

Is the feature visible in UI?
+-- YES -> Client-side (useFeatureFlagEnabled)
|   +-- Need to prevent content flash?
|       +-- YES -> Bootstrap flags from server
|       +-- NO -> Handle undefined loading state
+-- NO -> Is it API/backend behavior?
    +-- YES -> Server-side (posthog-node)
    |   +-- High traffic endpoint?
    |       +-- YES -> Use local evaluation
    |       +-- NO -> Regular evaluation is fine
    +-- NO -> Evaluate in component

Is the flag security-sensitive?
+-- YES -> Server-side only (prevents client manipulation)
+-- NO -> Either works
```

### Quick Reference

| Use Case | Flag Type | Evaluation |
|----------|-----------|------------|
| Gradual rollout | Boolean | Client |
| A/B test | Multivariate | Client |
| Kill switch | Boolean | Both |
| Beta access | Boolean + cohort | Client |
| API behavior | Boolean | Server |
| Remote config | Boolean + payload | Client |
| Pricing experiment | Multivariate | Client |
| Security feature | Boolean | Server only |

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **PostHog Analytics**: Flags and analytics share the same PostHog instance
- **React Query**: Combine flag checks with data fetching for conditional endpoints
- **Better Auth**: Use session user ID as PostHog distinct_id for targeting
- **Hono API Routes**: Evaluate flags server-side in API handlers

**Example: React Query + Feature Flags**

```typescript
// hooks/use-dashboard-data.ts
import { useQuery } from "@tanstack/react-query";
import { useFeatureFlagEnabled } from "posthog-js/react";

import { FLAG_BETA_DASHBOARD } from "@/lib/feature-flags";

export function useDashboardData() {
  const isBetaDashboard = useFeatureFlagEnabled(FLAG_BETA_DASHBOARD);

  return useQuery({
    queryKey: ["dashboard", isBetaDashboard ? "beta" : "stable"],
    queryFn: () =>
      fetch(isBetaDashboard ? "/api/dashboard/beta" : "/api/dashboard").then(
        (r) => r.json()
      ),
    enabled: isBetaDashboard !== undefined, // Wait for flag to load
  });
}
```

**Conflicts with:**

- Other feature flag services (LaunchDarkly, Split) - use one provider
- Environment variable flags - migrate to PostHog for consistency

</integration>

---

<anti_patterns>

## Anti-Patterns

### Using Payload Without Enabled Check

```typescript
// ❌ ANTI-PATTERN: Payload alone doesn't send exposure event
const payload = useFeatureFlagPayload("experiment-flag");
// PostHog won't know user was exposed!

// ✅ CORRECT: Always pair with enabled check
const isEnabled = useFeatureFlagEnabled("experiment-flag");
const payload = useFeatureFlagPayload("experiment-flag");
```

**Why it's wrong:** Experiments require exposure events to calculate results. Payload hook doesn't send them.

---

### Ignoring Loading State

```typescript
// ❌ ANTI-PATTERN: Treating undefined as false
const isEnabled = useFeatureFlagEnabled("new-feature");
if (isEnabled) { /* new */ } else { /* old - shows briefly! */ }

// ✅ CORRECT: Handle all three states
if (isEnabled === undefined) return <Skeleton />;
if (isEnabled) return <NewFeature />;
return <OldFeature />;
```

**Why it's wrong:** Users see flash of old UI before flag loads, looks buggy.

---

### Flags Without Owners

```typescript
// ❌ ANTI-PATTERN: No documentation
export const FLAG_SOMETHING = "some-feature";

// ✅ CORRECT: Document owner and lifecycle
/**
 * Owner: @jane-doe
 * Created: 2025-01-15
 * Expected Removal: 2025-02-15
 */
export const FLAG_SOMETHING = "some-feature";
```

**Why it's wrong:** Orphaned flags become permanent technical debt.

---

### Flag Sprawl Across Codebase

```typescript
// ❌ ANTI-PATTERN: Flag checked in multiple places
// file1.tsx
if (useFeatureFlagEnabled("new-feature")) { ... }
// file2.tsx
if (useFeatureFlagEnabled("new-feature")) { ... }
// file3.tsx
if (useFeatureFlagEnabled("new-feature")) { ... }

// ✅ CORRECT: Wrapper function in one place
// lib/feature-flags.ts
export function isNewFeatureEnabled(flag: boolean | undefined) {
  return flag === true;
}
```

**Why it's wrong:** Hard to find all usages during cleanup, easy to miss one.

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `useFeatureFlagPayload` alone for experiments (no exposure tracking)
- Exposing feature flag secure API key on client (security violation)
- No loading state handling (causes UI flash)
- Flags without owners or expiry dates (becomes permanent debt)

**Medium Priority Issues:**

- Magic string flag keys instead of constants (typos, hard to grep)
- Complex targeting rules on high-traffic flags (performance hit)
- Local evaluation in serverless/edge (cold start issues)
- Not using PostHog toolbar for local testing (harder debugging)

**Common Mistakes:**

- Checking flag in multiple places instead of wrapper function
- Not bootstrapping flags for SSR (content flash on hydration)
- Running experiments without defined primary metric
- Peeking at experiment results before completion
- Rolling out to 100% without cleanup plan

**Gotchas & Edge Cases:**

- PostHog uses deterministic hashing - same user always gets same variant
- Decreasing rollout percentage can remove users who were previously included
- Local evaluation requires feature flag secure key (separate from API key)
- Flags load asynchronously - first render always has undefined
- GeoIP targeting uses server IP by default in posthog-node v3+
- Experiments need minimum 50 exposures per variant for results
- Stale flag = 100% rollout + not evaluated in 30 days

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always pair `useFeatureFlagPayload` with `useFeatureFlagEnabled` or `useFeatureFlagVariantKey` for experiments - payload hooks don't send exposure events)**

**(You MUST use the feature flag secure API key for server-side local evaluation - NEVER expose it on the client)**

**(You MUST handle the `undefined` state when flags are loading - never assume a flag is immediately available)**

**(You MUST include flag owner and expiry date in flag metadata - flags without owners become orphaned debt)**

**(You MUST wrap flag usage in a single function when used in multiple places - prevents orphaned flag code on cleanup)**

**Failure to follow these rules will cause incorrect experiment results, security vulnerabilities, UI flashing, and technical debt.**

</critical_reminders>

---

## Sources

- [PostHog React Integration](https://posthog.com/docs/libraries/react)
- [PostHog Feature Flags](https://posthog.com/docs/feature-flags)
- [PostHog Feature Flag Best Practices](https://posthog.com/docs/feature-flags/best-practices)
- [PostHog Server-Side Local Evaluation](https://posthog.com/docs/feature-flags/local-evaluation)
- [PostHog Creating Feature Flags](https://posthog.com/docs/feature-flags/creating-feature-flags)
- [PostHog How to Do a Phased Rollout](https://posthog.com/tutorials/phased-rollout)
- [PostHog Feature Flag Testing](https://posthog.com/docs/feature-flags/testing)
- [PostHog Experiments](https://posthog.com/ab-testing)
- [PostHog Feature Flag Overrides](https://posthog.com/docs/toolbar/override-feature-flags)
- [Don't Make These Feature Flag Mistakes](https://posthog.com/newsletter/feature-flag-mistakes)
