# Security Patterns - Reference Guide

This file contains decision frameworks, red flags, and anti-patterns for security. Referenced from [SKILL.md](SKILL.md).

**Examples:**
- [examples/core.md](examples/core.md) - Essential patterns (secrets, CSRF, cookies)
- [examples/xss-prevention.md](examples/xss-prevention.md) - XSS protection, DOMPurify, CSP headers
- [examples/dependency-security.md](examples/dependency-security.md) - Dependabot, CI security checks
- [examples/access-control.md](examples/access-control.md) - CODEOWNERS, rate limiting, branch protection

---

<decision_framework>

## Decision Framework

```
Is it a secret (API key, password, token)?
├─ YES → Environment variable (.env.local for dev, CI secrets for production)
│   └─ Rotate quarterly or on team member departure
└─ NO → Is it user input being rendered?
    ├─ YES → Does it need to be HTML?
    │   ├─ YES → Sanitize with DOMPurify first
    │   └─ NO → Use React's auto-escaping (default)
    └─ NO → Is it an authentication token?
        ├─ YES → HttpOnly cookie (server-side)
        │   └─ Short-lived access token in memory (client-side)
        └─ NO → Is it a dependency with vulnerabilities?
            ├─ YES → Severity?
            │   ├─ Critical → Patch within 24 hours
            │   ├─ High → Patch within 1 week
            │   ├─ Medium → Patch within 1 month
            │   └─ Low → Next regular update
            └─ NO → Is it a state-changing operation (POST/PUT/DELETE)?
                ├─ YES → Use CSRF token + SameSite cookies
                └─ NO → Configure CODEOWNERS for sensitive files
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Committing secrets to repository (.env files, API keys in code)
- Using `dangerouslySetInnerHTML` with unsanitized user input (enables XSS attacks)
- Storing authentication tokens in localStorage/sessionStorage (accessible to XSS)
- No CSRF protection on state-changing operations (allows forged requests)
- Critical/high vulnerabilities unpatched (exploit window open)

**Medium Priority Issues:**

- No Dependabot configuration (manual vulnerability detection only)
- Missing CODEOWNERS for security-sensitive files (no automatic review)
- No CSP headers configured (no script execution controls)
- Trusting client-side validation only (easily bypassed)
- Exposing internal error details to users (information leakage)

**Common Mistakes:**

- Using `.env` instead of `.env.local` (committed to repository by default)
- Forgetting `HttpOnly` flag on authentication cookies (XSS can steal tokens)
- Not rotating secrets after team member departure (orphaned access)
- Auto-merging major dependency updates without testing (breaking changes)
- Using hardcoded CSRF tokens (defeats the purpose)
- Overly permissive CSP policies (allows too many script sources)
- Individual CODEOWNERS instead of teams (single point of failure)
- No rate limiting on API endpoints (abuse and brute force)

**Gotchas & Edge Cases:**

- `.env.local` is gitignored by default in Next.js, but not in all frameworks - verify
- DOMPurify sanitization happens client-side - also sanitize on server for defense in depth
- CSRF tokens need refresh on expiration - handle gracefully without breaking UX
- SameSite=Strict blocks legitimate cross-site requests - use Lax for non-critical cookies
- Dependabot PRs can be noisy - group non-security updates to reduce noise
- HttpOnly cookies not accessible in JavaScript - plan token refresh strategy accordingly
- CSP nonces must be unique per request - generate fresh nonces server-side
- Branch protection "enforce_admins" can lock out admins during emergencies - plan hotfix process

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Committing Secrets to Repository

```typescript
// ANTI-PATTERN: Hardcoded secrets
const API_KEY = "sk_live_1234567890abcdef";
const DATABASE_URL = "postgresql://admin:password@prod.example.com:5432/db";
```

**Why it's wrong:** Secrets in git history are exposed forever even after deletion, anyone with repo access can extract credentials.

**What to do instead:** Use .env.local (gitignored) for development, CI/CD secrets for production.

---

### Storing Tokens in localStorage

```typescript
// ANTI-PATTERN: localStorage for auth tokens
function storeAuthToken(token: string) {
  localStorage.setItem("authToken", token);
}
```

**Why it's wrong:** localStorage is accessible to any JavaScript including XSS attacks, tokens persist indefinitely enabling session hijacking.

**What to do instead:** Use HttpOnly cookies for authentication tokens (server-set).

---

### Unsanitized HTML Rendering

```typescript
// ANTI-PATTERN: dangerouslySetInnerHTML without sanitization
function UserComment({ comment }: { comment: string }) {
  return <div dangerouslySetInnerHTML={{ __html: comment }} />;
}
```

**Why it's wrong:** Allows arbitrary script execution via user input, XSS attacks can steal cookies/tokens or perform actions as user.

**What to do instead:** Use DOMPurify to sanitize before rendering, or use React's default text escaping.

---

### Individual CODEOWNERS Instead of Teams

```
# ANTI-PATTERN: Individual owners
.env.example @john-developer
packages/auth/* @jane-engineer
```

**Why it's wrong:** Single points of failure during vacations/departures, no backup reviewers available.

**What to do instead:** Use team-based ownership: `@security-team @backend-team`.

</anti_patterns>
