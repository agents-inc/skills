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
    const stored = localStorage.getItem(
      CONSENT_STORAGE_KEY,
    ) as ConsentStatus | null;
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

## Filtering Events with `before_send` Hook

Since posthog-js v1.187.0, you can use `before_send` to filter, amend, or redact events before they're sent:

```typescript
// ✅ Good Example - Redact PII and filter internal traffic
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY!;
const INTERNAL_DOMAINS = ["@mycompany.com", "@test.com"];

posthog.init(POSTHOG_KEY, {
  api_host: "/ingest",
  person_profiles: "identified_only",

  // Filter or modify events before sending
  before_send: (event) => {
    // Skip internal user traffic
    const email = event.properties?.$email as string | undefined;
    if (email && INTERNAL_DOMAINS.some((d) => email.endsWith(d))) {
      return null; // Don't send this event
    }

    // Redact sensitive URL parameters
    if (event.properties?.$current_url) {
      const url = new URL(event.properties.$current_url as string);
      url.searchParams.delete("token");
      url.searchParams.delete("secret");
      event.properties.$current_url = url.toString();
    }

    return event;
  },
});
```

**Why good:** Filters internal/test traffic at source, redacts sensitive URL params, reduces noise and costs, ensures PII doesn't reach PostHog servers

**Warning:** Modifying or sampling events is advanced functionality. Core PostHog features may require 100% of unmodified events. Only modify your own custom events if possible.

---

## What NOT to Track

```typescript
// ❌ NEVER include PII in event properties
const badProperties = {
  email: "user@example.com", // PII
  name: "John Doe", // PII
  phone: "+1234567890", // PII
  ip_address: "192.168.1.1", // PII
  address: "123 Main St", // PII
  credit_card: "4111...", // PII + Payment data
  password: "secret", // Sensitive
  ssn: "123-45-6789", // PII
};

// ✅ Safe properties to include
const goodProperties = {
  user_id: "user_abc123", // Pseudonymized ID
  plan: "pro", // Account metadata
  feature_name: "export", // Product data
  is_enterprise: true, // Boolean flags
  source: "google_ads", // Attribution
  page_path: "/dashboard", // Navigation (no PII in URL)
};
```

**Key rule:** Never store data that can identify a specific individual. Use pseudonymized IDs (database UUIDs) instead of emails or names.
