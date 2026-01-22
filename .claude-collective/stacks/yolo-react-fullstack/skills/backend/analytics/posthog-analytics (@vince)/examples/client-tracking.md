# PostHog Analytics - Client-Side Tracking

> Client-side tracking patterns with React hooks and PostHog provider.
>
> **Return to:** [SKILL.md](../SKILL.md) | **Prerequisites:** [core.md](core.md)
>
> **Related:** [server-tracking.md](server-tracking.md) | [privacy-gdpr.md](privacy-gdpr.md)

---

## Provider Setup

```typescript
// providers/posthog-provider.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY!;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

// Initialize PostHog
if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: "2025-05-24", // Use versioned config defaults for stability
    person_profiles: "identified_only", // Only create profiles for identified users
    capture_pageview: false, // Disable automatic pageviews (we handle manually)
    capture_pageleave: true, // Track when users leave pages
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      const url = window.origin + pathname;
      const search = searchParams?.toString();
      const fullUrl = search ? `${url}?${search}` : url;

      posthog.capture("$pageview", { $current_url: fullUrl });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}

export { PostHogProvider };
```

**Why good:** `person_profiles: "identified_only"` reduces costs (anonymous events 4x cheaper), manual pageview capture gives control over URL tracking, pageleave helps measure engagement

---

## Event Tracking Hook

```typescript
// hooks/use-analytics.ts
"use client";

import { useCallback } from "react";
import { usePostHog } from "posthog-js/react";

import type { PostHogEvent } from "@/lib/analytics/constants";

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export function useAnalytics() {
  const posthog = usePostHog();

  const track = useCallback(
    (event: PostHogEvent | string, properties?: EventProperties) => {
      if (!posthog) {
        console.warn("PostHog not initialized");
        return;
      }
      posthog.capture(event, properties);
    },
    [posthog],
  );

  const trackFeatureUsed = useCallback(
    (featureName: string, properties?: EventProperties) => {
      track("feature:used", {
        feature_name: featureName,
        ...properties,
      });
    },
    [track],
  );

  const trackOnboardingStep = useCallback(
    (stepNumber: number, stepName: string) => {
      track("onboarding:step_completed", {
        step_number: stepNumber,
        step_name: stepName,
      });
    },
    [track],
  );

  return { track, trackFeatureUsed, trackOnboardingStep };
}

export { useAnalytics };
```

**Why good:** Centralized tracking with type hints, convenience methods for common patterns, null-safe with warning for debugging

---

## Component Usage

```typescript
// Good Example - Tracking in components
"use client";

import { useAnalytics } from "@/hooks/use-analytics";
import { POSTHOG_EVENTS } from "@/lib/analytics/constants";

export function CreateProjectButton() {
  const { track } = useAnalytics();

  const handleClick = () => {
    track(POSTHOG_EVENTS.FEATURE_USED, {
      feature_name: "create_project",
      source: "dashboard_header",
    });

    // ... create project logic
  };

  return (
    <button onClick={handleClick} type="button">
      Create Project
    </button>
  );
}

export { CreateProjectButton };
```

**Why good:** Uses constant for event name, includes context (source), clean separation of tracking from business logic
