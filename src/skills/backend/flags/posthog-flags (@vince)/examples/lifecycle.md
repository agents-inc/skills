# Flag Cleanup and Lifecycle Management Examples

> Plan for flag removal from day one. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern: Flag Cleanup and Lifecycle Management

Plan for flag removal from day one. Stale flags become technical debt.

### Flag Documentation Pattern

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

### Wrapper Pattern for Easy Cleanup

```typescript
// lib/feature-flags.ts

// Good Example - Single wrapper function for flag
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

### Stale Flag Detection

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

---

_Back to [SKILL.md](../SKILL.md) | [core.md](core.md)_
