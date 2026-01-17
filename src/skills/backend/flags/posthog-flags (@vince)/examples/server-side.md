# Server-Side Flag Evaluation Examples

> Server-side evaluation with posthog-node. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern: Server-Side Flag Evaluation

Use `posthog-node` for server-side evaluation. Use local evaluation for performance.

### Setup

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

### Good Example - Server-side flag evaluation

```typescript
// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";

import { posthog } from "@/lib/posthog-server";
import { FLAG_BETA_DASHBOARD } from "@/lib/feature-flags";

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

### Good Example - Local-only evaluation for performance

```typescript
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

### Bad Example - Server-side without local evaluation

```typescript
import { PostHog } from "posthog-node";

// BAD: No personalApiKey = no local evaluation
const posthog = new PostHog(process.env.POSTHOG_API_KEY!);

// BAD: Every call makes a network request (500ms latency)
const flag = await posthog.isFeatureEnabled("beta-dashboard", userId);
```

**Why bad:** No local evaluation = network request per flag check, high latency (500ms vs 50ms), increases PostHog API costs

---

_Back to [SKILL.md](../SKILL.md) | [core.md](core.md)_
