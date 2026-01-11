# Feature Flags Reference

> Decision frameworks, anti-patterns, and red flags for PostHog feature flags.

---

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

---

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

---

## Anti-Patterns

### Using Payload Without Enabled Check

```typescript
// ANTI-PATTERN: Payload alone doesn't send exposure event
const payload = useFeatureFlagPayload("experiment-flag");
// PostHog won't know user was exposed!

// CORRECT: Always pair with enabled check
const isEnabled = useFeatureFlagEnabled("experiment-flag");
const payload = useFeatureFlagPayload("experiment-flag");
```

**Why it's wrong:** Experiments require exposure events to calculate results. Payload hook doesn't send them.

---

### Ignoring Loading State

```typescript
// ANTI-PATTERN: Treating undefined as false
const isEnabled = useFeatureFlagEnabled("new-feature");
if (isEnabled) { /* new */ } else { /* old - shows briefly! */ }

// CORRECT: Handle all three states
if (isEnabled === undefined) return <Skeleton />;
if (isEnabled) return <NewFeature />;
return <OldFeature />;
```

**Why it's wrong:** Users see flash of old UI before flag loads, looks buggy.

---

### Flags Without Owners

```typescript
// ANTI-PATTERN: No documentation
export const FLAG_SOMETHING = "some-feature";

// CORRECT: Document owner and lifecycle
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
// ANTI-PATTERN: Flag checked in multiple places
// file1.tsx
if (useFeatureFlagEnabled("new-feature")) { ... }
// file2.tsx
if (useFeatureFlagEnabled("new-feature")) { ... }
// file3.tsx
if (useFeatureFlagEnabled("new-feature")) { ... }

// CORRECT: Wrapper function in one place
// lib/feature-flags.ts
export function isNewFeatureEnabled(flag: boolean | undefined) {
  return flag === true;
}
```

**Why it's wrong:** Hard to find all usages during cleanup, easy to miss one.

---

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
