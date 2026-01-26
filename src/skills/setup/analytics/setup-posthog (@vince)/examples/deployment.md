# PostHog Setup - Deployment Examples

> Environment configuration and deployment patterns for PostHog. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.
>
> **Related examples:** [core.md](core.md) | [server.md](server.md)

---

## Pattern 1: Environment Variables Template

Create `.env.example` for team onboarding with clear documentation.

```bash
# ✅ Good Example - Comprehensive .env.example
# apps/client-next/.env.example

# ================================================================
# PostHog Analytics & Feature Flags
# ================================================================
# Get your API key from: https://posthog.com -> Project Settings -> API Keys
#
# Host options:
#   US Cloud: https://us.i.posthog.com
#   EU Cloud: https://eu.i.posthog.com
#   Self-hosted: https://your-posthog-instance.com

# Client-side (embedded in browser bundle)
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Server-side (API routes, never exposed to client)
POSTHOG_API_KEY=phc_your_project_api_key
POSTHOG_HOST=https://us.i.posthog.com
```

**Why good:** Comments explain where to get keys, host options documented, clear separation between client and server variables

---

## Pattern 2: Vercel Deployment Configuration

Configure PostHog environment variables for production deployment.

### Vercel Environment Variables

| Variable                   | Environment                      | Value                      |
| -------------------------- | -------------------------------- | -------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | Production, Preview, Development | `phc_xxx`                  |
| `NEXT_PUBLIC_POSTHOG_HOST` | Production, Preview, Development | `https://us.i.posthog.com` |
| `POSTHOG_API_KEY`          | Production, Preview, Development | `phc_xxx`                  |
| `POSTHOG_HOST`             | Production, Preview, Development | `https://us.i.posthog.com` |

**Why good:** Same project for dev/prod simplifies setup, Vercel handles env var injection at build time

### Local Development Override

```bash
# apps/client-next/.env.local (gitignored)

# Use the same keys for development
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_API_KEY=phc_your_project_api_key
POSTHOG_HOST=https://us.i.posthog.com
```

**Why good:** `.env.local` is gitignored, allows local overrides, matches production config for consistency

---

## Pattern 3: Initial Dashboard Setup

Configure PostHog dashboards after setup completion.

### Recommended Initial Dashboards

1. **Web Analytics Dashboard** (built-in)
   - Page views, unique visitors, bounce rate
   - Traffic sources, referrers
   - Geographic distribution

2. **Product Analytics Dashboard** (create)
   - Key conversion funnels
   - Feature adoption rates
   - Retention cohorts

3. **Error Tracking** (enable plugin)
   - Error rate trends
   - Most common errors
   - Affected users

---

## Pattern 4: Initial Configuration Checklist

Use this checklist to verify complete PostHog setup.

```markdown
## PostHog Setup Checklist

### Account Setup

- [ ] Created PostHog account and organization
- [ ] Created project for app
- [ ] Copied API key to .env.local

### Client-Side Setup

- [ ] Installed posthog-js (client)
- [ ] Created PostHogProvider component
- [ ] Wrapped app in provider (layout.tsx)

### Server-Side Setup

- [ ] Installed posthog-node (server)
- [ ] Created server client singleton
- [ ] Added flush() to API routes

### Verification

- [ ] Verified events appearing in PostHog dashboard
- [ ] Tested in development mode (debug enabled)

### Deployment

- [ ] Set up Vercel environment variables
- [ ] Created .env.example for team
- [ ] Verified events in production
```

**Why good:** Step-by-step verification prevents missed configuration, covers all critical paths, easy to share with team

---
