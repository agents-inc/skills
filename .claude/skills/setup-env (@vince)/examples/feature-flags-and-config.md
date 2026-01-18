# Feature Flags and Configuration

> Environment-based feature flags and centralized configuration patterns. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for essential patterns.

**Related Examples:**
- [core.md](core.md) - Per-app .env, Zod validation
- [naming-and-templates.md](naming-and-templates.md) - Framework prefixes, .env.example
- [security-and-secrets.md](security-and-secrets.md) - Secret management

---

## Feature Flags with Environment Variables

### Good Example - Type-safe feature flags

```typescript
// lib/feature-flags.ts
export const FEATURES = {
  // Core features
  NEW_DASHBOARD: import.meta.env.VITE_FEATURE_NEW_DASHBOARD === "true",
  BETA_EDITOR: import.meta.env.VITE_FEATURE_BETA_EDITOR === "true",

  // Analytics & Monitoring
  ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === "true",
  ERROR_TRACKING: import.meta.env.VITE_ENABLE_ERROR_TRACKING === "true",

  // Environment-specific
  DEBUG_MODE: import.meta.env.DEV,
  MOCK_API: import.meta.env.VITE_MOCK_API === "true",
} as const;

// Type-safe feature check
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}

export const { NEW_DASHBOARD, BETA_EDITOR, ANALYTICS } = FEATURES;
```

```typescript
// Usage in components
import { NEW_DASHBOARD } from "@/lib/feature-flags";
import { lazy } from "react";

// Code splitting based on feature flag
const Dashboard = NEW_DASHBOARD
  ? lazy(() => import("@/features/dashboard-v2"))
  : lazy(() => import("@/features/dashboard-v1"));
```

**Why good:** Type-safe flags prevent typos, centralized configuration makes flags discoverable, code splitting reduces bundle size for disabled features, no external dependencies reduces complexity

### Bad Example - Inline feature checks

```typescript
// components/dashboard.tsx
function Dashboard() {
  // Reading env var directly everywhere
  if (process.env.NEXT_PUBLIC_FEATURE_NEW_DASHBOARD === "true") {
    return <NewDashboard />;
  }
  return <LegacyDashboard />;
}
```

**Why bad:** Inline checks scatter feature flag logic across codebase, no type safety means typos fail silently, hard to discover all feature flags, duplicated string comparisons

---

## Environment-Specific Configuration

### Good Example - Centralized config with env overrides

```typescript
// lib/config.ts
import { env } from "./env";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX_SIZE = 100;
const DEFAULT_RETRY_ATTEMPTS = 3;

interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  features: {
    analytics: boolean;
    errorTracking: boolean;
    debugMode: boolean;
  };
  cache: {
    ttl: number;
    maxSize: number;
  };
}

function getConfig(): AppConfig {
  const baseConfig: AppConfig = {
    api: {
      baseUrl: env.VITE_API_URL,
      timeout: env.VITE_API_TIMEOUT,
      retryAttempts: DEFAULT_RETRY_ATTEMPTS,
    },
    features: {
      analytics: env.VITE_ENABLE_ANALYTICS,
      errorTracking: false,
      debugMode: env.DEV,
    },
    cache: {
      ttl: DEFAULT_CACHE_TTL_MS,
      maxSize: DEFAULT_CACHE_MAX_SIZE,
    },
  };

  // Environment-specific overrides
  const envConfigs: Record<string, Partial<AppConfig>> = {
    development: {
      cache: { ttl: 0, maxSize: 0 }, // No caching in dev
      features: { debugMode: true },
    },
    production: {
      cache: { ttl: 15 * 60 * 1000, maxSize: 500 },
      features: { errorTracking: true, debugMode: false },
    },
  };

  const envOverrides = envConfigs[env.VITE_ENVIRONMENT] || {};

  return {
    ...baseConfig,
    ...envOverrides,
    api: { ...baseConfig.api, ...envOverrides.api },
    features: { ...baseConfig.features, ...envOverrides.features },
    cache: { ...baseConfig.cache, ...envOverrides.cache },
  };
}

export const config = getConfig();
```

```typescript
// Usage
import { config } from "@/lib/config";

fetch(config.api.baseUrl, {
  signal: AbortSignal.timeout(config.api.timeout),
});

if (config.features.analytics) {
  trackEvent("page_view");
}
```

**Why good:** Centralized configuration provides single source of truth for app behavior, environment-specific overrides enable different settings per environment (dev vs prod), type-safe access prevents runtime errors from typos, easy to test with mock config injection

### Bad Example - Scattered configuration

```typescript
// Multiple files reading env vars directly
// api-client.ts
const timeout = Number(process.env.VITE_API_TIMEOUT);

// analytics.ts
const enabled = process.env.VITE_ENABLE_ANALYTICS === "true";

// cache.ts
const ttl = process.env.VITE_CACHE_TTL || "300000";
```

**Why bad:** Scattered configuration makes it hard to understand app behavior, no centralized type safety, duplicated env var parsing logic, difficult to test or mock
