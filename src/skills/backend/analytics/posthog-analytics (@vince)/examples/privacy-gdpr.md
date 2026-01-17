# PostHog Analytics - Privacy and GDPR Consent

> Privacy-compliant analytics patterns for GDPR, cookieless mode, and consent management.
>
> **Return to:** [SKILL.md](../SKILL.md) | **Prerequisites:** [core.md](core.md)
>
> **Related:** [group-analytics.md](group-analytics.md) | [type-safety.md](type-safety.md)

---

## Cookieless Mode Configuration

```typescript
// ✅ Good Example - GDPR-compliant initialization
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY!;

// Initialize with consent-aware settings
posthog.init(POSTHOG_KEY, {
  api_host: "/ingest", // Use reverse proxy to avoid ad blockers
  person_profiles: "identified_only",
  capture_pageview: false,

  // GDPR: Don't set cookies until consent
  persistence: "localStorage+cookie",

  // Option 1: Full cookieless (no consent banner needed)
  // cookieless_mode: "always",

  // Option 2: Cookieless until consent (show banner)
  cookieless_mode: "on_reject",
});
```

**Why good:** `cookieless_mode: "on_reject"` respects user choice, reverse proxy increases delivery rate, `person_profiles: "identified_only"` reduces cost and data

---

## Consent Banner Integration

```typescript
// ✅ Good Example - Consent management
"use client";

import { useState, useEffect } from "react";
import { usePostHog } from "posthog-js/react";

const CONSENT_STORAGE_KEY = "analytics_consent";

type ConsentStatus = "granted" | "denied" | "pending";

export function useCookieConsent() {
  const posthog = usePostHog();
  const [consent, setConsent] = useState<ConsentStatus>("pending");

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY) as ConsentStatus | null;
    if (stored) {
      setConsent(stored);
      if (stored === "granted") {
        posthog?.opt_in_capturing();
      }
    }
  }, [posthog]);

  const acceptCookies = () => {
    setConsent("granted");
    localStorage.setItem(CONSENT_STORAGE_KEY, "granted");
    posthog?.opt_in_capturing();
  };

  const rejectCookies = () => {
    setConsent("denied");
    localStorage.setItem(CONSENT_STORAGE_KEY, "denied");
    posthog?.opt_out_capturing();
  };

  return { consent, acceptCookies, rejectCookies };
}

export { useCookieConsent };
```

**Why good:** Persists consent choice, `opt_in_capturing()` and `opt_out_capturing()` are PostHog's official consent methods, handles pending state for first-time visitors

---

## What NOT to Track

```typescript
// ❌ NEVER include PII in event properties
const badProperties = {
  email: "user@example.com",      // PII
  name: "John Doe",               // PII
  phone: "+1234567890",           // PII
  ip_address: "192.168.1.1",      // PII
  address: "123 Main St",         // PII
  credit_card: "4111...",         // PII + Payment data
  password: "secret",             // Sensitive
  ssn: "123-45-6789",             // PII
};

// ✅ Safe properties to include
const goodProperties = {
  user_id: "user_abc123",         // Pseudonymized ID
  plan: "pro",                    // Account metadata
  feature_name: "export",         // Product data
  is_enterprise: true,            // Boolean flags
  source: "google_ads",           // Attribution
  page_path: "/dashboard",        // Navigation (no PII in URL)
};
```

**Key rule:** Never store data that can identify a specific individual. Use pseudonymized IDs (database UUIDs) instead of emails or names.
