# Environment Reference

> Decision frameworks, anti-patterns, and red flags for environment configuration. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

```
Need environment configuration?
├─ Is it a secret (API key, password)?
│   ├─ YES → Use .env.local (gitignored) + CI secrets
│   └─ NO → Can it be public (embedded in client bundle)?
│       ├─ YES → Use NEXT_PUBLIC_* or VITE_* prefix
│       └─ NO → Server-side only (no prefix)
├─ Does it change per environment?
│   ├─ YES → Use .env.{environment} files
│   └─ NO → Use .env with defaults
├─ Does it need validation?
│   ├─ YES → Add to Zod schema (recommended for all)
│   └─ NO → Document in .env.example at minimum
└─ Is it app-specific or shared?
    ├─ App-specific → Per-app .env file
    └─ Shared → Declare in turbo.json env array
```

### Feature Flag Decision

```
Need a feature flag?
├─ Is it a simple boolean toggle?
│   ├─ YES → Use environment variable
│   └─ NO → Need gradual rollout (5% → 50% → 100%)?
│       ├─ YES → Use external service (LaunchDarkly, PostHog)
│       └─ NO → Need user targeting?
│           ├─ YES → Use external service
│           └─ NO → Use environment variable
```

---

## RED FLAGS

### High Priority Issues

- Committing secrets to version control (.env files with real credentials)
- Using environment variables directly without Zod validation (causes runtime errors)
- Using NEXT*PUBLIC*_ or VITE\__ prefix for secrets (embeds in client bundle)
- Sharing .env files via Slack/email (insecure secret distribution)

### Medium Priority Issues

- Missing .env.example documentation (poor onboarding experience)
- Using production secrets in development (security risk)
- Not rotating secrets regularly (stale credentials)
- Inconsistent variable names across environments (confusion)

### Common Mistakes

- Using `process.env.VARIABLE` directly without validation (fails at runtime with unclear errors)
- Forgetting to add new variables to .env.example (team members don't know about them)
- Not using framework-specific prefixes for client-side variables (values are undefined)
- Using root-level .env instead of per-app .env files (conflicts in monorepo)

### Gotchas & Edge Cases

- Next.js embeds NEXT*PUBLIC*\* variables at build time (not runtime) - requires rebuild to change
- Vite embeds VITE\_\* variables at build time - same limitation as Next.js
- Environment variables are strings - use `z.coerce.number()` for numbers
- **CRITICAL: `z.coerce.boolean()` converts "false" to `true`** - JavaScript's `Boolean("false")` is `true` (non-empty string is truthy). Use `z.stringbool()` (Zod 4+) instead which correctly handles "true"/"false"/"1"/"0"/"yes"/"no"
- Empty string env vars (`PORT=`) are NOT `undefined` - use T3 Env's `emptyStringAsUndefined: true` or handle explicitly
- .env.local takes precedence over .env - can cause confusion when local overrides exist
- Turborepo cache is NOT invalidated by env changes unless declared in turbo.json env array
- Next.js tree-shakes unused `process.env` access - use T3 Env's `runtimeEnv` for explicit mapping

---

## Anti-Patterns

### Committing Secrets to Repository

```bash
# ANTI-PATTERN: Real secrets in committed .env
DATABASE_URL=postgresql://admin:SuperSecret123@prod.example.com:5432/mydb
STRIPE_SECRET_KEY=sk_live_actual_secret_key
```

**Why it's wrong:** Exposes secrets permanently in git history, anyone with repo access can extract credentials.

**What to do instead:** Use .env.local (gitignored) for secrets, CI/CD secrets for production.

---

### No Zod Validation

```typescript
// ANTI-PATTERN: Direct env access without validation
const API_URL = import.meta.env.VITE_API_URL; // Could be undefined!
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT); // Could be NaN!
```

**Why it's wrong:** Missing variables cause runtime failures with unclear errors, type coercion fails silently.

**What to do instead:** Validate all env vars with Zod at application startup.

---

### Using z.coerce.boolean() for Env Vars

```typescript
// ANTI-PATTERN: z.coerce.boolean() breaks on "false" string
const envSchema = z.object({
  VITE_ENABLE_FEATURE: z.coerce.boolean().default(false),
});

// .env file: VITE_ENABLE_FEATURE=false
// Result: true (!)

// z.coerce.boolean() uses JavaScript's Boolean()
// Boolean("false") === true because non-empty strings are truthy
```

**Why it's wrong:** `z.coerce.boolean()` converts ANY non-empty string to `true`, including "false", "0", "no". This breaks environment variable semantics.

**What to do instead:** Use `z.stringbool()` (Zod 4+) which correctly parses "true"/"false"/"1"/"0"/"yes"/"no"/"on"/"off".

---

### Using NEXT*PUBLIC*\* for Secrets

```bash
# ANTI-PATTERN: Secret with client-side prefix
NEXT_PUBLIC_DATABASE_URL=postgresql://user:pass@host/db
NEXT_PUBLIC_API_SECRET_KEY=sk_secret_12345
```

**Why it's wrong:** NEXT*PUBLIC*\* variables are embedded in client bundle, visible to anyone.

**What to do instead:** Use non-prefixed variables for server-side secrets only.

---

### Root-Level .env in Monorepo

```
# ANTI-PATTERN: Root-level .env
/.env  <- Variables for all apps (conflicts!)
```

**Why it's wrong:** Shared variables cause conflicts across apps with different needs, unclear ownership.

**What to do instead:** Use per-app .env files in each app directory.

---

### Inline Feature Flag Checks

```typescript
// ANTI-PATTERN: Inline env checks scattered across codebase
if (process.env.NEXT_PUBLIC_FEATURE_NEW_DASHBOARD === "true") {
  return <NewDashboard />;
}
```

**Why it's wrong:** Feature flag logic scattered across codebase, no type safety, hard to discover all flags.

**What to do instead:** Centralize feature flags in a single file with type-safe exports.

---

### Scattered Configuration

```typescript
// ANTI-PATTERN: Multiple files reading env vars directly
// api-client.ts
const timeout = Number(process.env.VITE_API_TIMEOUT);

// analytics.ts
const enabled = process.env.VITE_ENABLE_ANALYTICS === "true";
```

**Why it's wrong:** Scattered configuration makes it hard to understand app behavior, duplicated parsing logic.

**What to do instead:** Create centralized config object with environment-specific overrides.

---

## Quick Reference

### Environment File Checklist

- [ ] Per-app .env files (not root-level)
- [ ] .env.example maintained with all variables documented
- [ ] Comments explain purpose and format
- [ ] Secrets in .env.local (gitignored)
- [ ] Framework-specific prefixes used correctly
- [ ] SCREAMING_SNAKE_CASE naming convention

### Zod Validation Checklist

- [ ] All env vars validated at startup
- [ ] `z.coerce.number()` used for number types
- [ ] `z.stringbool()` used for boolean types (NOT `z.coerce.boolean()`)
- [ ] Default values for optional variables
- [ ] Clear error messages on validation failure
- [ ] Type-safe env object exported
- [ ] Consider T3 Env for Next.js/Vite projects (`@t3-oss/env-nextjs`)

### Secret Management Checklist

- [ ] .gitignore includes .env.local and .env.\*.local
- [ ] No secrets in committed .env files
- [ ] CI/CD secrets used for production
- [ ] Sensitive file extensions (_.key, _.pem) gitignored
- [ ] Secrets rotated regularly

### Feature Flag Checklist

- [ ] Centralized in single file
- [ ] Type-safe exports
- [ ] Named constant exports
- [ ] Code splitting for disabled features
- [ ] Environment-specific defaults
