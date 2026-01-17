# Local Development Overrides Examples

> Override flags locally without affecting other users. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern: Local Development Overrides

Override flags locally without affecting other users.

### Method 1: Toolbar Override (Browser)

```typescript
// Use PostHog toolbar in development
// 1. Enable toolbar in PostHog project settings
// 2. Click feature flags icon in toolbar
// 3. Toggle flags on/off for your session only

// This only affects YOUR browser, not other users
// Does NOT affect server-side evaluation
```

### Method 2: Code Override (Development Only)

```typescript
// lib/posthog-client.ts
import posthog from "posthog-js";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

// Good Example - Development-only flag overrides
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

### Method 3: Bootstrapping for SSR

```typescript
// lib/posthog-client.ts
import posthog from "posthog-js";

// Good Example - Bootstrap flags for immediate availability
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

_Back to [SKILL.md](../SKILL.md) | [core.md](core.md)_
