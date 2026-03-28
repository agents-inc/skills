# PostHog Setup - Reference Guide

> Decision frameworks for PostHog analytics and feature flags setup. See [SKILL.md](SKILL.md) for red flags and gotchas.

---

## Decision Framework

### PostHog Project Structure

```
Single app or tight monorepo?
├─ YES → One PostHog project for all apps
│   └─ Use custom properties to filter (app: "web", app: "admin")
└─ NO → Multiple distinct products?
    └─ Separate projects per product
        └─ Still use ONE organization (pools billing)
```

### Client vs Server SDK

```
Where is the event triggered?
├─ Browser/React component → posthog-js (usePostHog hook)
├─ API route/server action → posthog-node (getPostHogServerClient)
│   └─ Serverless environment?
│       ├─ YES → Use captureImmediate() (simplest)
│       └─ Or → Use capture() + await flush()
├─ Server-rendered component → posthog-node (but consider if needed)
└─ API middleware → posthog-node, flush after response
```

### US vs EU Hosting

```
Where are your users?
├─ Primarily US/Americas → https://us.i.posthog.com
├─ Primarily EU/GDPR concerns → https://eu.i.posthog.com
└─ Self-hosting required → Your own PostHog instance URL
```

---

> **Code examples:** See [examples/core.md](examples/core.md) and [examples/server.md](examples/server.md) for full good/bad comparisons.
