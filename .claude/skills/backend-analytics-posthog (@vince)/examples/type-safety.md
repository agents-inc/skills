# PostHog Analytics - TypeScript Type-Safe Events

> Type-safe event tracking patterns with TypeScript compile-time validation.
>
> **Return to:** [SKILL.md](../SKILL.md) | **Prerequisites:** [core.md](core.md)
>
> **Related:** [server-tracking.md](server-tracking.md) | [funnel-analysis.md](funnel-analysis.md)

---

## Official Types Package

For type safety with `window.posthog`, install the official types package:

```bash
npm install @posthog/types
```

This provides TypeScript definitions for the global PostHog object when using the script tag method.

---

## Event Type Definitions

```typescript
// lib/analytics/types.ts

// Event name union type
export type AnalyticsEvent =
  | "user_signed_up"
  | "user_logged_in"
  | "user_logged_out"
  | "project_created"
  | "project_deleted"
  | "subscription_created"
  | "subscription_cancelled"
  | "feature:used"
  | "onboarding:step_completed"
  | "signup_flow:form_submitted";

// Base properties all events should have
interface BaseEventProperties {
  timestamp?: string;
}

// Event-specific property types
interface UserSignedUpProperties extends BaseEventProperties {
  plan: "free" | "pro" | "enterprise";
  source?: string;
}

interface ProjectCreatedProperties extends BaseEventProperties {
  project_id: string;
  is_first_project: boolean;
}

interface FeatureUsedProperties extends BaseEventProperties {
  feature_name: string;
  source?: string;
}

interface OnboardingStepProperties extends BaseEventProperties {
  step_number: number;
  step_name: string;
}

// Event property map
export interface EventPropertyMap {
  user_signed_up: UserSignedUpProperties;
  project_created: ProjectCreatedProperties;
  "feature:used": FeatureUsedProperties;
  "onboarding:step_completed": OnboardingStepProperties;
  // Add more as needed...
}

// Named exports
export type {
  AnalyticsEvent,
  EventPropertyMap,
  UserSignedUpProperties,
  ProjectCreatedProperties,
};
```

---

## Type-Safe Track Function

```typescript
// ✅ Good Example - Type-safe tracking
import type { AnalyticsEvent, EventPropertyMap } from "@/lib/analytics/types";

export function useTypedAnalytics() {
  const posthog = usePostHog();

  // Overloaded track function for type safety
  function track<E extends keyof EventPropertyMap>(
    event: E,
    properties: EventPropertyMap[E],
  ): void;
  function track(
    event: AnalyticsEvent,
    properties?: Record<string, unknown>,
  ): void;
  function track(event: string, properties?: Record<string, unknown>): void {
    posthog?.capture(event, properties);
  }

  return { track };
}

// Usage - TypeScript catches errors at compile time
const { track } = useTypedAnalytics();

// ✅ Correct - TypeScript validates properties
track("user_signed_up", {
  plan: "pro",
  source: "google_ads",
});

// ❌ Error - Missing required property "plan"
track("user_signed_up", {
  source: "google_ads",
});

// ❌ Error - Invalid plan value
track("user_signed_up", {
  plan: "invalid_plan", // Type error!
});
```

**Why good:** Compile-time validation catches typos and missing properties, IDE autocomplete for event names and properties, type definitions serve as documentation

---

## Benefits of Type-Safe Events

| Benefit                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| Compile-time validation | Catch typos and missing properties before runtime |
| IDE autocomplete        | Get suggestions for event names and properties    |
| Self-documenting        | Type definitions serve as living documentation    |
| Refactor-safe           | Rename events/properties with confidence          |
| Team alignment          | Shared types ensure consistent tracking           |

**When to use:**

- Teams with multiple developers tracking events
- Products with many events and properties
- Codebases where analytics accuracy is critical
