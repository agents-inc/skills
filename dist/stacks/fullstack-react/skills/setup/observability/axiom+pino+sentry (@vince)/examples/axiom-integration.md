# Observability Setup - Axiom Integration Examples

> Axiom Web Vitals component and dashboard configuration.

**Navigation:** [Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [sentry-config.md](sentry-config.md) | [pino-logger.md](pino-logger.md) | [ci-cd.md](ci-cd.md) | [health-check.md](health-check.md)

---

## Pattern 6: Web Vitals Component

**File: `apps/client-next/app/layout.tsx`**

```typescript
// Good Example - Web Vitals in root layout
import { AxiomWebVitals } from "next-axiom";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My App",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AxiomWebVitals />
        {children}
      </body>
    </html>
  );
}
```

**Why good:** `AxiomWebVitals` component automatically reports Core Web Vitals (LCP, FID, CLS) to Axiom, no additional configuration needed

**Note:** Web Vitals are only sent from production deployments, not local development.

---

## Pattern 10: Axiom Dashboard Setup

**Dashboard Components to Create:**

1. **Request Volume** - Count of requests over time
2. **Error Rate** - Percentage of 4xx/5xx responses
3. **Response Time P95** - 95th percentile latency
4. **Top Errors** - Most frequent error messages
5. **Web Vitals** - LCP, FID, CLS metrics

**Axiom APL Queries:**

```apl
// Request volume per minute
['myapp-prod']
| summarize count() by bin_auto(_time)

// Error rate
['myapp-prod']
| where level == "error"
| summarize errors = count() by bin(_time, 1m)

// Response time P95
['myapp-prod']
| where isnotnull(duration)
| summarize p95 = percentile(duration, 95) by bin(_time, 5m)

// Top errors
['myapp-prod']
| where level == "error"
| summarize count() by message
| top 10 by count_
```
