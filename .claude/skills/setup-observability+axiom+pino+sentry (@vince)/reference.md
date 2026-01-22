# Observability Setup - Reference

> Decision frameworks, red flags, and anti-patterns for Pino + Axiom + Sentry setup.

---

## Decision Framework

### Choosing Log Destinations

```
Where should logs go?
├─ Local development?
│   ├─ Console with pino-pretty (human readable)
│   └─ Optionally also to local Axiom dataset
├─ CI/Test environment?
│   ├─ Console only (JSON format)
│   └─ No external services (fast, isolated)
└─ Production?
    ├─ Axiom (primary - searchable, dashboards)
    └─ Console (fallback - captured by hosting platform)
```

### Sentry vs Axiom for Errors

```
Where should errors go?
├─ Application errors (exceptions, crashes)?
│   └─ Sentry (source maps, stack traces, releases)
├─ Expected errors (404s, validation)?
│   └─ Axiom logs (don't pollute Sentry quota)
└─ Performance issues?
    └─ Axiom traces (longer retention, cheaper)
```

---

## RED FLAGS

**High Priority Issues:**

- Committing Axiom tokens or Sentry DSN to version control
- Using pino-pretty in production (performance degradation)
- Missing source maps upload (unreadable stack traces in Sentry)
- Same Axiom dataset for all environments (data mixing)
- Missing `sentry.edge.config.ts` (middleware errors not tracked)

**Medium Priority Issues:**

- No health check endpoints (can't monitor service status)
- 100% trace sample rate in production (expensive, unnecessary)
- Missing `beforeSend` filter (noise from expected errors)
- No Web Vitals tracking (missing performance insights)

**Common Mistakes:**

- Forgetting to wrap `next.config.js` with `withAxiom`
- Using `SENTRY_DSN` without `NEXT_PUBLIC_` prefix (undefined in client)
- Not setting `hideSourceMaps: true` (source code exposed)
- Missing `instrumentation.ts` (Sentry not initialized properly)
- Hardcoding sample rates instead of using named constants

**Gotchas & Edge Cases:**

- Web Vitals only sent in production, not development
- Source maps upload requires `CI=true` environment variable
- Edge runtime has limited Sentry features (no replay)
- Axiom token needs ingest permission for the specific dataset
- Sentry auth token needs `project:releases` and `org:read` scopes

---

## Anti-Patterns to Avoid

### Hardcoded Credentials

```typescript
// ❌ ANTI-PATTERN: Hardcoded DSN
Sentry.init({
  dsn: "https://abc123@sentry.io/456789",
});
```

**Why it's wrong:** Credentials in code get committed to git, can't rotate without code change.

**What to do instead:** Use environment variables: `process.env.NEXT_PUBLIC_SENTRY_DSN`

---

### pino-pretty in Production

```typescript
// ❌ ANTI-PATTERN: Always using pino-pretty
import pino from "pino";

export const logger = pino({
  transport: {
    target: "pino-pretty",
  },
});
```

**Why it's wrong:** pino-pretty is slow, adds ~500KB, defeats Pino's performance benefits.

**What to do instead:** Conditionally use pino-pretty only when `NODE_ENV === 'development'`

---

### Missing Environment Separation

```bash
# ❌ ANTI-PATTERN: Same dataset for all environments
NEXT_PUBLIC_AXIOM_DATASET=myapp
```

**Why it's wrong:** Development logs mixed with production, hard to filter, pollutes dashboards.

**What to do instead:** Use `myapp-dev`, `myapp-staging`, `myapp-prod`

---

### No Source Maps in CI

```yaml
# ❌ ANTI-PATTERN: Build without source maps
- run: npm run build
# No SENTRY_AUTH_TOKEN, no CI=true
```

**Why it's wrong:** Sentry shows minified code in stack traces, impossible to debug.

**What to do instead:** Set `CI=true` and provide Sentry secrets in GitHub Actions.

---

### Magic Numbers for Sample Rates

```typescript
// ❌ ANTI-PATTERN: Magic numbers
Sentry.init({
  sampleRate: 0.1,
  tracesSampleRate: 0.2,
});
```

**Why it's wrong:** Unclear what these values mean, hard to change consistently.

**What to do instead:** Use named constants:

```typescript
const SAMPLE_RATE_PRODUCTION = 0.1;
const TRACES_SAMPLE_RATE = 0.2;

Sentry.init({
  sampleRate: SAMPLE_RATE_PRODUCTION,
  tracesSampleRate: TRACES_SAMPLE_RATE,
});
```

---

### Missing beforeSend Filter

```typescript
// ❌ ANTI-PATTERN: No error filtering
Sentry.init({
  dsn: SENTRY_DSN,
  // No beforeSend - all errors sent
});
```

**Why it's wrong:** Expected errors (cancelled requests, validation) pollute Sentry, waste quota.

**What to do instead:** Add `beforeSend` to filter expected errors:

```typescript
beforeSend(event, hint) {
  if (event.exception?.values?.[0]?.value?.includes("AbortError")) {
    return null;
  }
  return event;
}
```

---

### Single Sentry Config for All Runtimes

```typescript
// ❌ ANTI-PATTERN: One config file for everything
// sentry.config.ts
Sentry.init({
  /* ... */
});
```

**Why it's wrong:** Client, server, and edge runtimes have different capabilities and requirements.

**What to do instead:** Create three separate config files:

- `sentry.client.config.ts` - With replay integration
- `sentry.server.config.ts` - With local variables capture
- `sentry.edge.config.ts` - With limited features

---

## Checklist: First-Time Setup

- [ ] Install dependencies: `pino`, `next-axiom`, `@sentry/nextjs`, `pino-pretty` (dev)
- [ ] Create Axiom account and datasets (dev, staging, prod)
- [ ] Create Axiom API token with ingest permission
- [ ] Create Sentry project and get DSN
- [ ] Create Sentry auth token with `project:releases` scope
- [ ] Add all environment variables to `.env.example`
- [ ] Configure environment variables in Vercel/hosting
- [ ] Wrap `next.config.js` with `withAxiom` and `withSentryConfig`
- [ ] Create `sentry.client.config.ts`
- [ ] Create `sentry.server.config.ts`
- [ ] Create `sentry.edge.config.ts`
- [ ] Create `instrumentation.ts`
- [ ] Add `<AxiomWebVitals />` to root layout
- [ ] Add health check endpoints
- [ ] Configure GitHub Actions for source maps upload
- [ ] Create initial Axiom dashboard
- [ ] Test error tracking (throw test error)
- [ ] Test log ingestion (log test message)
- [ ] Verify Web Vitals appearing in Axiom

---

## Sentry v9 Migration Checklist

If upgrading from v8 to v9:

- [ ] Remove `enableTracing` option (use `tracesSampleRate` directly)
- [ ] Remove `hideSourceMaps` option (now default behavior)
- [ ] Update `beforeSendSpan` if returning null (no longer supported)
- [ ] Rename `captureUserFeedback()` to `captureFeedback()`
- [ ] Rename `comments` field to `message` in feedback
- [ ] Remove any Metrics API usage (completely removed)
- [ ] Ensure Node.js 18.0.0+ (minimum version)
- [ ] Add explicit `unmask`/`unblock` selectors if relying on defaults
- [ ] Test React 19 error hooks if using React 19

---

## Resources

**Official Documentation:**

- [Axiom Documentation](https://axiom.co/docs)
- [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry v8 to v9 Migration](https://docs.sentry.io/platforms/javascript/guides/nextjs/migration/v8-to-v9/)
- [Pino Documentation](https://getpino.io/)
- [next-axiom GitHub](https://github.com/axiomhq/next-axiom)

**Related Skills:**

- `backend/observability.md` - Ongoing logging patterns and alerts
- `setup/env.md` - Environment variable management
- `backend/ci-cd.md` - GitHub Actions configuration
