# PostHog Analytics - Group Analytics for B2B

> Group analytics patterns for B2B SaaS with team/organization accounts.
>
> **Return to:** [SKILL.md](../SKILL.md) | **Prerequisites:** [core.md](core.md), [server-tracking.md](server-tracking.md)
>
> **Related:** [privacy-gdpr.md](privacy-gdpr.md) | [core.md](core.md)

---

## Group Identification (Client-Side)

```typescript
// Good Example - Identify organization group
"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

// Use your auth solution's hook to get the active organization
interface ActiveOrg {
  id: string;
  name: string;
  plan?: string;
  memberCount: number;
  createdAt: string;
}

export function useOrganizationAnalytics(activeOrg: ActiveOrg | null) {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog || !activeOrg) return;

    // Identify the organization group
    posthog.group("company", activeOrg.id, {
      name: activeOrg.name,
      plan: activeOrg.plan ?? "free",
      member_count: activeOrg.memberCount,
      created_at: activeOrg.createdAt,
    });
  }, [posthog, activeOrg]);
}
```

**Why good:** Uses database org ID as group key, sets useful org properties, runs when org context changes

---

## Server-Side Group Events

```typescript
// Good Example - Group event on server
import { posthogServer } from "../lib/analytics/posthog-server";

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

  await posthogServer.shutdown();
}
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
