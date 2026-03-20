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
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";

const POSTHOG_KEY = process.env.POSTHOG_KEY!;
const POSTHOG_HOST =
  process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

// Initialize PostHog
if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: "2026-01-30", // Use versioned config defaults for stability
    person_profiles: "identified_only", // Only create profiles for identified users
    capture_pageview: false, // Disable automatic pageviews (we handle manually)
    capture_pageleave: true, // Track when users leave pages
  });
}

// Manual pageview tracking - use your router's pathname hook
function PostHogPageView() {
  const pathname = useCurrentPathname(); // Your router's pathname hook
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      const url = window.origin + pathname;
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, posthog]);

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
```

**Why good:** `person_profiles: "identified_only"` reduces costs (anonymous events 4x cheaper), manual pageview capture gives control over URL tracking, `defaults` date pins config behavior for stability

---

## Event Tracking Hook

```typescript
// hooks/use-analytics.ts
"use client";

import { useCallback } from "react";
import { usePostHog } from "posthog-js/react";

import type { PostHogEvent } from "../lib/analytics/constants";

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export function useAnalytics() {
  const posthog = usePostHog();

  const track = useCallback(
    (event: PostHogEvent | string, properties?: EventProperties) => {
      posthog?.capture(event, properties);
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

  return { track, trackFeatureUsed };
}
```

**Why good:** Centralized tracking with type hints, convenience methods for common patterns, null-safe via optional chaining

---

## Component Usage

```typescript
// Good Example - Tracking in components
"use client";

import { useAnalytics } from "../hooks/use-analytics";
import { POSTHOG_EVENTS } from "../lib/analytics/constants";

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
```

**Why good:** Uses constant for event name, includes context (source), clean separation of tracking from business logic
