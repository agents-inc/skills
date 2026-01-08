---
name: Security
description: Authentication, authorization, secrets
---

# Security Patterns

> **Quick Guide:** Managing secrets? Use .env.local (gitignored), CI secrets (GitHub/Vercel), rotate quarterly. Dependency security? Enable Dependabot, audit weekly, patch critical vulns within 24hrs. XSS prevention? React escapes by default - never use dangerouslySetInnerHTML with user input. Sanitize with DOMPurify if needed. Set CSP headers. CODEOWNERS? Require security team review for auth/, .env.example, workflows.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST NEVER commit secrets to the repository - use .env.local and CI secrets only)**

**(You MUST sanitize ALL user input before rendering HTML - use DOMPurify with dangerouslySetInnerHTML)**

**(You MUST patch critical/high vulnerabilities within 24 hours - use Dependabot for automated scanning)**

**(You MUST use HttpOnly cookies for authentication tokens - NEVER localStorage or sessionStorage)**

**(You MUST configure CODEOWNERS for security-sensitive files - require security team approval)**

</critical_requirements>

---

**Auto-detection:** security, secrets management, XSS prevention, CSRF protection, Dependabot, vulnerability scanning, authentication, DOMPurify, CSP headers, CODEOWNERS, HttpOnly cookies

**When to use:**

- Managing secrets securely (never commit, use .env.local and CI secrets)
- Setting up Dependabot for automated vulnerability scanning
- Preventing XSS attacks (React escaping, DOMPurify, CSP headers)
- Configuring CODEOWNERS for security-sensitive code
- Implementing secure authentication and token storage

**When NOT to use:**

- For general code quality (use reviewing skill instead)
- For performance optimization (use performance skills)
- For CI/CD pipeline setup (use ci-cd skill - security patterns here are for code, not pipelines)
- When security review would delay critical hotfixes (document for follow-up)

**Key patterns covered:**

- Never commit secrets (.gitignore, CI secrets, rotation policies quarterly)
- Automated dependency scanning with Dependabot (critical within 24h)
- XSS prevention (React's built-in escaping, DOMPurify for HTML, CSP headers)
- CSRF protection with tokens and SameSite cookies
- CODEOWNERS for security-sensitive areas (.env.example, auth code, workflows)
- Secure token storage (HttpOnly cookies, in-memory access tokens)

---

<philosophy>

## Philosophy

Security is not a feature - it's a foundation. Every line of code must be written with security in mind. Defense in depth means multiple layers of protection, so if one fails, others catch the attack.

**When to use security patterns:**

- Always - security is not optional
- When handling user input (sanitize and validate)
- When managing secrets (environment variables, rotation)
- When storing authentication tokens (HttpOnly cookies)
- When setting up CI/CD (vulnerability scanning, CODEOWNERS)

**When NOT to compromise:**

- Never skip HTTPS in production
- Never trust client-side validation alone
- Never commit secrets to repository
- Never use localStorage for sensitive tokens
- Never bypass security reviews for critical code

**Core principles:**

- **Least privilege**: Grant minimum necessary access
- **Defense in depth**: Multiple layers of security
- **Fail securely**: Default to deny, not allow
- **Don't trust user input**: Always validate and sanitize
- **Assume breach**: Plan for when (not if) attacks happen

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Secret Management

Never commit secrets to the repository. Use environment variables in .env.local (gitignored) for development, and CI/CD secret managers for production. Rotate secrets quarterly or on team member departure.

#### What Are Secrets

Secrets include: API keys, tokens, passwords, database credentials, private keys, certificates, OAuth client secrets, encryption keys, JWT secrets.

#### Where to Store Secrets

**Development:**
- `.env.local` (gitignored)
- Per-developer local overrides
- Never committed to repository

**CI/CD:**
- GitHub Secrets
- Vercel Environment Variables
- GitLab CI/CD Variables
- Other platform secret managers

**Production:**
- Environment variables (injected by platform)
- Secret management services (AWS Secrets Manager, HashiCorp Vault)
- Never hardcoded in code

#### Rotation Policies

```typescript
const ROTATION_CRITICAL_DAYS = 90; // Quarterly
const ROTATION_API_KEYS_DAYS = 365; // Annually
const ROTATION_PASSWORDS_DAYS = 90; // Every 90 days
const CERT_EXPIRY_WARNING_DAYS = 30; // 30 days notice

// ✅ Good Example - Secure token storage
// Frontend: Don't store token at all
// Backend sets: Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict

// In-memory access token
let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token; // In-memory only, lost on refresh
}

export function getAccessToken() {
  return accessToken;
}

// Auto-refresh from HttpOnly cookie
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const newToken = await refreshAccessToken(); // Uses HttpOnly cookie
      setAccessToken(newToken);
      return axios.request(error.config);
    }
    return Promise.reject(error);
  },
);
```

**Why good:** HttpOnly cookies inaccessible to JavaScript prevents XSS token theft, in-memory tokens cleared on tab close, automatic refresh maintains user session without exposing credentials

```typescript
// ❌ Bad Example - Storing tokens in localStorage
function storeAuthToken(token: string) {
  localStorage.setItem("authToken", token);
}

// ❌ Bad Example - Committing secrets
const API_KEY = "sk_live_1234567890abcdef"; // NEVER do this
```

**Why bad:** localStorage accessible to any JavaScript including XSS attacks, tokens persist indefinitely enabling session hijacking, committed secrets exposed in git history forever even after deletion

**When to use:** Always use HttpOnly cookies for authentication tokens, environment variables for API keys and secrets, secret rotation for all credentials quarterly or on team changes.

**When not to use:** Never store authentication tokens in localStorage/sessionStorage, never commit secrets to repository, never hardcode credentials in source code.

---

### Pattern 2: Dependency Security

Enable automated vulnerability scanning with Dependabot to catch security issues in dependencies. Patch critical vulnerabilities within 24 hours, high within 1 week, medium within 1 month.

#### Tools and Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  # Enable version updates for npm
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    assignees:
      - "tech-lead"
    # Group non-security updates
    groups:
      development-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
      production-dependencies:
        dependency-type: "production"
        update-types:
          - "patch"
    # Auto-merge patch updates if tests pass
    allow:
      - dependency-type: "all"
    # Ignore specific packages if needed
    ignore:
      - dependency-name: "eslint"
        versions:
          - ">= 9.0.0"

  # GitHub Actions security updates
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Why good:** Automated security updates reduce manual work, weekly scans catch vulnerabilities early, grouped updates reduce PR noise, reviewer assignment ensures expertise reviews changes

```yaml
# ❌ Bad Example - No Dependabot configuration
# No automated security scanning
# Manual dependency updates only
# Vulnerabilities go unnoticed
```

**Why bad:** Manual dependency updates are error-prone and often forgotten, vulnerabilities remain unpatched for weeks or months, no visibility into security issues, increased risk of exploitation

#### Update Policies

**Security updates:**
- **Critical vulnerabilities** - Immediate (within 24 hours)
- **High vulnerabilities** - Within 1 week
- **Medium vulnerabilities** - Within 1 month
- **Low vulnerabilities** - Next regular update cycle

**Regular updates:**
- **Patch updates** (1.2.3 → 1.2.4) - Auto-merge if tests pass
- **Minor updates** (1.2.0 → 1.3.0) - Review changes, test, merge
- **Major updates** (1.0.0 → 2.0.0) - Plan migration, test thoroughly

#### CI Security Checks

```typescript
// scripts/security-check.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CRITICAL_THRESHOLD = 0;
const HIGH_THRESHOLD = 0;

interface AuditResult {
  vulnerabilities: {
    info: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
}

async function runSecurityAudit() {
  try {
    console.log("🔍 Running security audit...");
    const { stdout } = await execAsync("bun audit --json");
    const result: AuditResult = JSON.parse(stdout);

    const { vulnerabilities } = result;
    const total =
      vulnerabilities.info +
      vulnerabilities.low +
      vulnerabilities.moderate +
      vulnerabilities.high +
      vulnerabilities.critical;

    console.log("\n📊 Security Audit Results:");
    console.log(`  Critical: ${vulnerabilities.critical}`);
    console.log(`  High: ${vulnerabilities.high}`);
    console.log(`  Moderate: ${vulnerabilities.moderate}`);
    console.log(`  Low: ${vulnerabilities.low}`);
    console.log(`  Info: ${vulnerabilities.info}`);
    console.log(`  Total: ${total}\n`);

    // Fail CI if critical or high vulnerabilities
    if (vulnerabilities.critical > CRITICAL_THRESHOLD || vulnerabilities.high > HIGH_THRESHOLD) {
      console.error("❌ Security audit failed: Critical or high vulnerabilities found!");
      process.exit(1);
    }

    console.log("✅ Security audit passed!");
  } catch (error) {
    console.error("❌ Security audit failed:", error);
    process.exit(1);
  }
}

runSecurityAudit();
```

**Why good:** Automated CI security checks block PRs with vulnerabilities, named constants for thresholds enable easy policy changes, detailed logging provides visibility into security posture, early detection prevents vulnerable code from reaching production

```typescript
// ❌ Bad Example - No CI security checks
// No automated vulnerability scanning in CI
// PRs merge without security validation
// Magic numbers instead of named constants
if (vulns.critical > 0) { // What's the threshold policy?
  process.exit(1);
}
```

**Why bad:** No CI security checks allow vulnerable code to merge undetected, magic numbers obscure security policy decisions, manual security reviews are inconsistent and often skipped, vulnerabilities discovered after deployment are costly to fix

---

### Pattern 3: XSS Prevention

React automatically escapes user input by default. Never use `dangerouslySetInnerHTML` with user input unless sanitized with DOMPurify. Configure Content Security Policy (CSP) headers to block unauthorized scripts.

#### React's Built-in Protection

```typescript
const USER_COMMENT_MAX_LENGTH = 500;

// ✅ Good Example - React auto-escaping
function UserComment({ comment }: { comment: string }) {
  return <div>{comment}</div>; // React escapes automatically
}

// ✅ Good Example - Sanitize if HTML needed
import DOMPurify from 'dompurify';
import { useMemo } from 'react';

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br'];
const ALLOWED_ATTR = ['href', 'title'];

function RichUserComment({ comment }: { comment: string }) {
  const sanitizedHTML = useMemo(
    () => DOMPurify.sanitize(comment, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    }),
    [comment]
  );

  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
}
```

**Why good:** React's auto-escaping prevents XSS by converting user input to safe text, DOMPurify whitelist approach only allows explicitly permitted tags, useMemo prevents re-sanitization on every render, named constants make security policy clear and auditable

```typescript
// ❌ Bad Example - Dangerous HTML injection
function UserComment({ comment }: { comment: string }) {
  return <div dangerouslySetInnerHTML={{ __html: comment }} />;
}

// ❌ Bad Example - Magic array values
function BadSanitize({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i'], // What's the policy?
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

**Why bad:** dangerouslySetInnerHTML without sanitization allows arbitrary script execution via user input, XSS attacks can steal cookies/tokens or perform actions as the user, magic array values hide security policy decisions, no useMemo causes performance issues and repeated sanitization

#### Content Security Policy

```typescript
// next.config.js or middleware
const CSP_NONCE_LENGTH = 32;

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'nonce-{NONCE}'", // Dynamically generated nonce
      "style-src 'self' 'unsafe-inline'", // Needed for CSS-in-JS temporarily
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  securityHeaders.forEach(({ key, value }) => {
    response.headers.set(key, value);
  });

  return response;
}
```

**Why good:** CSP prevents unauthorized script execution even if XSS occurs, nonce-based script allowlist is more secure than 'unsafe-inline', X-Frame-Options prevents clickjacking attacks, named constant for nonce length makes security policy auditable

```typescript
// ❌ Bad Example - No CSP configuration
// No Content-Security-Policy headers
// Allows inline scripts from anywhere
// No XSS protection headers

// ❌ Bad Example - Overly permissive CSP
const badCSP = "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'";
```

**Why bad:** Missing CSP headers allow any script to execute enabling XSS exploitation, overly permissive CSP defeats the purpose of having a policy, 'unsafe-inline' and 'unsafe-eval' allow common XSS attack vectors, no X-Frame-Options enables clickjacking attacks

---

### Pattern 4: CSRF Protection

Use CSRF tokens for all state-changing operations (POST, PUT, DELETE). Set SameSite=Strict on cookies to prevent cross-site request forgery.

#### Token-Based Protection

```typescript
const CSRF_TOKEN_META_NAME = "csrf-token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

// ✅ Good Example - CSRF token with axios interceptor
import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = document.querySelector<HTMLMetaElement>(`meta[name="${CSRF_TOKEN_META_NAME}"]`)?.content;

  if (token) {
    config.headers[CSRF_HEADER_NAME] = token;
  }

  return config;
});

export { apiClient };
```

**Why good:** Axios interceptor automatically adds CSRF token to all requests preventing manual errors, withCredentials enables cookie-based authentication, named constants make token source and header name auditable, centralized configuration ensures consistency across the application

```typescript
// ❌ Bad Example - No CSRF protection
async function updateProfile(data: ProfileData) {
  return fetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ❌ Bad Example - Manual token per request
async function badUpdate(data: ProfileData) {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  return fetch("/api/profile", {
    method: "PUT",
    headers: { "X-CSRF-Token": token! }, // Easy to forget
    body: JSON.stringify(data),
  });
}
```

**Why bad:** Missing CSRF protection allows attackers to forge requests from other sites, manual token addition per request is error-prone and often forgotten, magic string selectors obscure security mechanism, non-null assertion (token!) can fail at runtime if token missing

#### Cookie Security

Set HttpOnly, Secure, and SameSite=Strict on all authentication cookies to prevent XSS theft and CSRF attacks.

```typescript
// Backend cookie configuration
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

res.cookie('authToken', token, {
  httpOnly: true, // Prevents JavaScript access
  secure: true, // HTTPS only
  sameSite: 'strict', // Prevents CSRF
  maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
  path: '/',
});
```

**Why good:** HttpOnly prevents XSS token theft via JavaScript, Secure ensures cookies only sent over HTTPS preventing interception, SameSite=Strict blocks cross-site requests preventing CSRF, named constant makes expiration policy clear and auditable

---

### Pattern 5: Code Ownership (CODEOWNERS)

Configure CODEOWNERS to require security team approval for security-sensitive files like .env.example, auth/, and .github/workflows/. This prevents unauthorized changes to critical code.

#### Configuration

```
# .github/CODEOWNERS

# Global owners (fallback)
* @tech-leads

# Security-sensitive files require security team approval
.env.example @security-team @tech-leads
.github/workflows/* @devops-team @security-team
apps/*/env.ts @security-team @backend-team
packages/auth/* @security-team @backend-team

# Frontend patterns require frontend team review
.claude/* @frontend-team
.claude-src/skillsNew/* @frontend-team @tech-leads

# Backend packages
packages/api/* @backend-team
packages/database/* @backend-team @dba-team

# Build and infrastructure
turbo.json @devops-team @tech-leads
package.json @tech-leads
.github/dependabot.yml @devops-team @security-team
Dockerfile @devops-team

# Critical business logic
apps/*/features/payment/* @backend-team @security-team @product-team
apps/*/features/auth/* @security-team @backend-team

# Design system
packages/ui/* @frontend-team @design-team
```

**Why good:** Automatic reviewer assignment ensures expertise reviews critical changes, prevents unauthorized changes to security-sensitive code, creates audit trail for security decisions, teams provide better coverage than individual reviewers

```
# ❌ Bad Example - No CODEOWNERS
# No automatic reviewer assignment
# Anyone can modify security-sensitive files
# No audit trail for critical changes

# ❌ Bad Example - Individual owners
.env.example @john-developer
packages/auth/* @jane-engineer
```

**Why bad:** Missing CODEOWNERS allows unauthorized changes to critical code, individual owners create single points of failure during vacations/departures, no automatic assignment leads to missed security reviews, lack of audit trail makes incident investigation difficult

#### Branch Protection

Enable "Require review from Code Owners" in GitHub branch protection settings to enforce CODEOWNERS approval before merging.

```yaml
# Branch protection configuration (via GitHub API or UI)
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true,
  },
  "required_status_checks": {
    "strict": true,
    "contexts": ["ci/test", "ci/lint", "ci/type-check", "ci/security-audit"]
  },
  "enforce_admins": true,
  "restrictions": null,
}
```

**Why good:** Enforces code owner approval preventing bypass of security reviews, required status checks ensure tests and security audits pass, dismiss_stale_reviews prevents outdated approvals, enforce_admins applies rules even to repository administrators

---

### Pattern 6: Rate Limiting

Implement rate limiting to prevent abuse, brute force attacks, and API overload. Use both client-side queuing and server-side enforcement.

#### Client-Side Rate Limiting

```typescript
const MAX_REQUESTS_PER_WINDOW = 100;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// ✅ Good Example - Rate limiting with retry and backoff
class RateLimitedClient {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsInWindow = 0;
  private windowStart = Date.now();

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  async request<T>(url: string, options?: RequestInit): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await this.waitForRateLimit();
          const response = await fetch(url, options);
          resolve(await response.json());
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    if (elapsed >= this.windowMs) {
      this.requestsInWindow = 0;
      this.windowStart = now;
    }

    if (this.requestsInWindow >= this.maxRequests) {
      const waitTime = this.windowMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.requestsInWindow = 0;
      this.windowStart = Date.now();
    }

    this.requestsInWindow++;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      await request();
    }
    this.processing = false;
  }
}

// Usage
const api = new RateLimitedClient(MAX_REQUESTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS);
```

**Why good:** Prevents hitting server rate limits and getting 429 errors, queuing provides better UX than failing requests, named constants make rate limit policy auditable, sliding window prevents burst requests

```typescript
// ❌ Bad Example - No rate limiting
async function sendMessage(message: string) {
  return fetch("/api/messages", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ❌ Bad Example - Magic numbers
if (this.requestsInWindow >= 100) { // What's the policy?
  await new Promise(resolve => setTimeout(resolve, 60000)); // Why 60 seconds?
}
```

**Why bad:** No rate limiting allows rapid-fire requests that overwhelm servers, users receive 429 errors with poor UX, magic numbers obscure rate limit policy, no queuing means requests fail instead of being delayed

</patterns>

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

<integration>

## Integration Guide

**Works with:**

- **React**: Built-in XSS protection via auto-escaping, use DOMPurify for rich HTML
- **Next.js**: Configure security headers in middleware or next.config.js
- **GitHub**: Dependabot for automated vulnerability scanning, CODEOWNERS for code review
- **Vercel/CI**: Store secrets in environment variables, never commit
- **axios**: Interceptors for automatic CSRF token injection
- **DOMPurify**: Sanitize user HTML before rendering with dangerouslySetInnerHTML

**Security layers:**

- **Secrets**: .env.local (dev) → CI secrets (GitHub/Vercel) → Environment variables (production)
- **XSS**: React auto-escaping → DOMPurify sanitization → CSP headers
- **CSRF**: Tokens → SameSite cookies → Server-side validation
- **Dependencies**: Dependabot → CI security audit → Manual review

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Committing secrets to repository (.env files, API keys in code)
- ❌ Using `dangerouslySetInnerHTML` with unsanitized user input (enables XSS attacks)
- ❌ Storing authentication tokens in localStorage/sessionStorage (accessible to XSS)
- ❌ No CSRF protection on state-changing operations (allows forged requests)
- ❌ Critical/high vulnerabilities unpatched (exploit window open)

**Medium Priority Issues:**

- ⚠️ No Dependabot configuration (manual vulnerability detection only)
- ⚠️ Missing CODEOWNERS for security-sensitive files (no automatic review)
- ⚠️ No CSP headers configured (no script execution controls)
- ⚠️ Trusting client-side validation only (easily bypassed)
- ⚠️ Exposing internal error details to users (information leakage)

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
// ❌ ANTI-PATTERN: Hardcoded secrets
const API_KEY = "sk_live_1234567890abcdef";
const DATABASE_URL = "postgresql://admin:password@prod.example.com:5432/db";
```

**Why it's wrong:** Secrets in git history are exposed forever even after deletion, anyone with repo access can extract credentials.

**What to do instead:** Use .env.local (gitignored) for development, CI/CD secrets for production.

---

### Storing Tokens in localStorage

```typescript
// ❌ ANTI-PATTERN: localStorage for auth tokens
function storeAuthToken(token: string) {
  localStorage.setItem("authToken", token);
}
```

**Why it's wrong:** localStorage is accessible to any JavaScript including XSS attacks, tokens persist indefinitely enabling session hijacking.

**What to do instead:** Use HttpOnly cookies for authentication tokens (server-set).

---

### Unsanitized HTML Rendering

```typescript
// ❌ ANTI-PATTERN: dangerouslySetInnerHTML without sanitization
function UserComment({ comment }: { comment: string }) {
  return <div dangerouslySetInnerHTML={{ __html: comment }} />;
}
```

**Why it's wrong:** Allows arbitrary script execution via user input, XSS attacks can steal cookies/tokens or perform actions as user.

**What to do instead:** Use DOMPurify to sanitize before rendering, or use React's default text escaping.

---

### Individual CODEOWNERS Instead of Teams

```
# ❌ ANTI-PATTERN: Individual owners
.env.example @john-developer
packages/auth/* @jane-engineer
```

**Why it's wrong:** Single points of failure during vacations/departures, no backup reviewers available.

**What to do instead:** Use team-based ownership: `@security-team @backend-team`.

</anti_patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST NEVER commit secrets to the repository - use .env.local and CI secrets only)**

**(You MUST sanitize ALL user input before rendering HTML - use DOMPurify with dangerouslySetInnerHTML)**

**(You MUST patch critical/high vulnerabilities within 24 hours - use Dependabot for automated scanning)**

**(You MUST use HttpOnly cookies for authentication tokens - NEVER localStorage or sessionStorage)**

**(You MUST configure CODEOWNERS for security-sensitive files - require security team approval)**

**Failure to follow these rules will create security vulnerabilities enabling XSS attacks, token theft, CSRF attacks, and data breaches.**

</critical_reminders>
