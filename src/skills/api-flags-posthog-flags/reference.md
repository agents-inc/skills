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

| Use Case           | Flag Type         | Evaluation  |
| ------------------ | ----------------- | ----------- |
| Gradual rollout    | Boolean           | Client      |
| A/B test           | Multivariate      | Client      |
| Kill switch        | Boolean           | Both        |
| Beta access        | Boolean + cohort  | Client      |
| API behavior       | Boolean           | Server      |
| Remote config      | Boolean + payload | Client      |
| Pricing experiment | Multivariate      | Client      |
| Security feature   | Boolean           | Server only |

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

> See [SKILL.md](SKILL.md) for red flags, gotchas, and edge cases.
