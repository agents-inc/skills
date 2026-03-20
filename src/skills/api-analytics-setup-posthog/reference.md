# PostHog Setup - Reference Guide

> Decision frameworks, anti-patterns, and red flags for PostHog analytics and feature flags setup.

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

## RED FLAGS

**High Priority Issues:**

- Initializing posthog-js on the server (requires browser APIs - crashes)
- No `flush()` or `captureImmediate()` after server-side capture (events lost in serverless)
- Client-side env vars not exposed to the browser bundle (check your framework's prefix convention)
- Hardcoding API keys in source code (security vulnerability)

**Medium Priority Issues:**

- Not using `defaults: '2026-01-30'` (manual pageview tracking required)
- Missing `posthog.reset()` on sign out (user identity bleeds to next session)
- No `person_profiles: 'identified_only'` (unnecessary anonymous profiles created)
- Not calling `posthog.identify()` after authentication (anonymous/auth sessions unlinked)

**Common Mistakes:**

- Initializing posthog-js in a server-rendered context (requires browser APIs)
- Forgetting to add environment variables to deployment platform
- Using different PostHog projects for dev/prod without realizing (separate data)
- Not wrapping app with PostHogProvider (hooks return null)

**Gotchas & Edge Cases:**

- `posthog-js` must be initialized after `window` is available (hence useEffect or instrumentation-client.js)
- Server-side SDK requires explicit `flush()`, `shutdown()`, or `captureImmediate()` - doesn't auto-flush like client
- `captureImmediate()` is simpler for serverless but sends one HTTP request per event (no batching)
- Free tier resets monthly - 1M events then stops capturing until next month
- `person_profiles: 'identified_only'` reduces costs but means no anonymous user profiles
- When using framework-specific auto-initialization (e.g., instrumentation hooks), values remain fixed for the session - bootstrapping only works if flags are evaluated on the server before render

---

> **Code examples:** See [examples/core.md](examples/core.md) and [examples/server.md](examples/server.md) for full good/bad comparisons.
