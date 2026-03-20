---
name: api-analytics-setup-posthog
description: PostHog analytics and feature flags setup
---

# PostHog Analytics & Feature Flags Setup

> **Quick Guide:** One-time setup for PostHog analytics and feature flags. Covers `posthog-js` client provider, `posthog-node` server client, and environment variables. PostHog handles both analytics AND feature flags with a generous free tier (1M events + 1M flag requests/month).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST initialize posthog-js only in a client/browser context - it requires browser APIs like window and localStorage)**

**(You MUST call `posthog.shutdown()`, `posthog.flush()`, or use `captureImmediate()` after server-side event capture to prevent lost events)**

**(You MUST use `defaults: '2026-01-30'` for automatic SPA page tracking and latest recommended behaviors)**

</critical_requirements>

---

**Auto-detection:** PostHog setup, posthog-js, posthog-node, PostHogProvider, analytics setup, feature flags setup, event tracking setup, posthog.init

**When to use:**

- Initial PostHog setup in a project
- Configuring PostHogProvider for client-side analytics
- Setting up posthog-node for server-side/API route event capture
- Configuring environment variables for PostHog

**When NOT to use:**

- Event tracking patterns after setup (use analytics event tracking skill)
- Feature flag usage patterns (use feature flags skill)
- Complex multi-environment setups with separate staging/production projects

**Key patterns covered:**

- Client-side setup with PostHogProvider or framework initialization hook
- Server-side setup with posthog-node
- Environment variables (client vs server prefix)
- User identification and reset flows
- Serverless flush patterns (captureImmediate vs flush)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Provider setup, layout integration, user identification, env vars
- [examples/server.md](examples/server.md) - Server client singleton, API routes, serverless patterns
- [reference.md](reference.md) - Decision frameworks, red flags

---

<philosophy>

## Philosophy

PostHog is a **product analytics + feature flags platform** that consolidates multiple tools into one. It's open-source, can be self-hosted, and has a generous free tier. For solo developers and small teams, PostHog eliminates the need for separate analytics and feature flag services.

**Core principles:**

1. **One platform for analytics + feature flags** - Reduces tool sprawl and cost
2. **Usage-based pricing** - Pay for what you use, not per-project
3. **Autocapture by default** - Automatic event tracking reduces manual instrumentation
4. **Server and client SDKs** - Full coverage for SSR and client-side apps

**When to use PostHog:**

- Need both analytics and feature flags in one platform
- Want generous free tier (1M events + 1M flag requests/month)
- Prefer open-source with self-host option
- Building product analytics (funnels, retention, sessions)

**When NOT to use PostHog:**

- Need advanced A/B testing with statistical rigor
- Require real-time event streaming
- Already have established analytics + flag tools

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: PostHog Project Structure

Use a single PostHog organization for your apps. One org pools billing. Use separate projects per app, or one project with custom properties to filter.

```
PostHog Organization: "Your Company"
├── Project: "Main App" (or separate per app)
│   ├── API Key: phc_xxx
│   └── Host: https://us.i.posthog.com (or eu.i.posthog.com)
```

**Why good:** Single org pools billing across all projects, usage-based pricing, 6 projects included on paid tier

---

### Pattern 2: Client-Side Setup

Install `posthog-js` and configure a provider or use your framework's client-side initialization hook.

Key config options: `defaults: "2026-01-30"` enables recommended behaviors, `person_profiles: "identified_only"` reduces costs.

See [examples/core.md](examples/core.md) for full implementation of both approaches.

**Why good:** `defaults` date enables automatic SPA page/leave tracking, `person_profiles: "identified_only"` reduces event costs, debug mode in development aids troubleshooting

---

### Pattern 3: Server-Side Setup with posthog-node

Install `posthog-node` and create a singleton for server-side event capture.

**Serverless flush options:**

- `captureImmediate()` - simplest, awaits HTTP request directly (one request per event)
- `capture()` + `await flush()` - batched, requires explicit flush before response returns

See [examples/server.md](examples/server.md) for singleton setup, API route usage, and the flush anti-pattern.

**Why good:** Singleton prevents multiple client instances, flushInterval/flushAt configure batching, captureImmediate simplifies serverless usage

</patterns>

---

<red_flags>

## RED FLAGS

- Initializing posthog-js on the server (requires browser APIs - will crash)
- No `flush()` or `captureImmediate()` after server-side capture in serverless environments (events silently lost)
- Hardcoding API keys in source code instead of environment variables
- Missing `posthog.reset()` on sign out (user identity bleeds to next session)
- Not using `defaults` date option (manual pageview tracking required, misses recommended behaviors)
- Not calling `posthog.identify()` after authentication (anonymous and authenticated sessions remain unlinked)

**Gotchas & Edge Cases:**

- Server-side SDK does NOT auto-flush like the client - you must explicitly call `flush()`, `shutdown()`, or use `captureImmediate()`
- `captureImmediate()` is simpler for serverless but sends one HTTP request per event (no batching)
- Free tier resets monthly (1M events then stops capturing until next month)
- `person_profiles: 'identified_only'` reduces costs but means no anonymous user profiles are created

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST initialize posthog-js only in a client/browser context - it requires browser APIs like window and localStorage)**

**(You MUST call `posthog.shutdown()`, `posthog.flush()`, or use `captureImmediate()` after server-side event capture to prevent lost events)**

**(You MUST use `defaults: '2026-01-30'` for automatic SPA page tracking and latest recommended behaviors)**

**Failure to follow these rules will cause lost analytics events, broken tracking, or security vulnerabilities.**

</critical_reminders>

---

## Sources

- [PostHog JavaScript SDK](https://posthog.com/docs/libraries/js)
- [PostHog JavaScript Configuration](https://posthog.com/docs/libraries/js/config)
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node)
