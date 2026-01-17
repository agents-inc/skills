# PostHog Analytics - Group Analytics for B2B

> Group analytics patterns for B2B SaaS with team/organization accounts.
>
> **Return to:** [SKILL.md](../SKILL.md) | **Prerequisites:** [core.md](core.md), [server-tracking.md](server-tracking.md)
>
> **Related:** [funnel-analysis.md](funnel-analysis.md) | [privacy-gdpr.md](privacy-gdpr.md)

---

## Group Identification (Client-Side)

```typescript
// ✅ Good Example - Identify organization group
"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

import { authClient } from "@/lib/auth-client";

export function useOrganizationAnalytics() {
  const posthog = usePostHog();
  const activeOrg = authClient.useActiveOrganization();

  useEffect(() => {
    if (!posthog || !activeOrg.data) return;

    // Identify the organization group
    posthog.group("company", activeOrg.data.id, {
      name: activeOrg.data.name,
      plan: activeOrg.data.plan ?? "free",
      member_count: activeOrg.data.memberCount,
      created_at: activeOrg.data.createdAt,
    });
  }, [posthog, activeOrg.data]);
}

export { useOrganizationAnalytics };
```

**Why good:** Uses database org ID as group key, sets useful org properties, runs when org context changes

---

## Server-Side Group Events

```typescript
// ✅ Good Example - Group event on server
import { posthogServer } from "@/lib/analytics/posthog-server";

interface InviteEventData {
  userId: string;
  organizationId: string;
  inviteeEmail: string; // Don't include in properties!
  role: string;
}

export async function trackMemberInvited(data: InviteEventData) {
  posthogServer.capture({
    distinctId: data.userId,
    event: "organization:member_invited",
    properties: {
      role: data.role,
      // Note: inviteeEmail NOT included (PII)
    },
    groups: {
      company: data.organizationId,
    },
  });

  // Update organization properties
  posthogServer.groupIdentify({
    groupType: "company",
    groupKey: data.organizationId,
    properties: {
      last_invite_sent_at: new Date().toISOString(),
    },
  });

  await posthogServer.flush();
}

export { trackMemberInvited };
```

**Why good:** Event associated with both user AND organization, groupIdentify updates org properties, PII (email) excluded from properties

---

## Querying Group Metrics

```markdown
In PostHog:
- Trends: "Unique companies" aggregation
- Funnels: "Aggregating by Unique organizations"
- Retention: Organization-level retention curves
- Metrics: "Daily Active Companies" instead of DAU
```

---

## When to Use Groups

**Use groups for:**

- B2B SaaS with team/organization accounts
- Marketplaces tracking buyer and seller companies
- Enterprise features needing org-level rollout

**Limitations:**

- Maximum 5 group types per project
- One group per type per event (can't have Company A AND Company B)
