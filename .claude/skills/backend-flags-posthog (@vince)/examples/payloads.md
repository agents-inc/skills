# Feature Flag Payloads Examples

> Remote configuration with JSON payloads. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern: Feature Flag Payloads for Remote Configuration

Use `useFeatureFlagPayload` for dynamic configuration. Always pair with `useFeatureFlagEnabled` for experiments.

### Constants

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

### Good Example - Payload with enabled check for experiment tracking

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

### Bad Example - Payload without enabled check

```typescript
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

_Back to [SKILL.md](../SKILL.md) | [core.md](core.md)_
