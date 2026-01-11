# Security Patterns - Code Examples

This file contains all code examples for security patterns. Referenced from [skill.md](skill.md).

---

## Pattern 1: Secret Management

### Rotation Policy Constants

```typescript
const ROTATION_CRITICAL_DAYS = 90; // Quarterly
const ROTATION_API_KEYS_DAYS = 365; // Annually
const ROTATION_PASSWORDS_DAYS = 90; // Every 90 days
const CERT_EXPIRY_WARNING_DAYS = 30; // 30 days notice
```

### Good Example - Secure Token Storage

```typescript
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

### Bad Example - Storing Tokens in localStorage

```typescript
// BAD: Storing tokens in localStorage
function storeAuthToken(token: string) {
  localStorage.setItem("authToken", token);
}

// BAD: Committing secrets
const API_KEY = "sk_live_1234567890abcdef"; // NEVER do this
```

**Why bad:** localStorage accessible to any JavaScript including XSS attacks, tokens persist indefinitely enabling session hijacking, committed secrets exposed in git history forever even after deletion

**When to use:** Always use HttpOnly cookies for authentication tokens, environment variables for API keys and secrets, secret rotation for all credentials quarterly or on team changes.

**When not to use:** Never store authentication tokens in localStorage/sessionStorage, never commit secrets to repository, never hardcode credentials in source code.

---

## Pattern 2: Dependency Security

### Good Example - Dependabot Configuration

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

### Bad Example - No Dependabot Configuration

```yaml
# BAD: No Dependabot configuration
# No automated security scanning
# Manual dependency updates only
# Vulnerabilities go unnoticed
```

**Why bad:** Manual dependency updates are error-prone and often forgotten, vulnerabilities remain unpatched for weeks or months, no visibility into security issues, increased risk of exploitation

### Good Example - CI Security Checks

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
    console.log("Running security audit...");
    const { stdout } = await execAsync("bun audit --json");
    const result: AuditResult = JSON.parse(stdout);

    const { vulnerabilities } = result;
    const total =
      vulnerabilities.info +
      vulnerabilities.low +
      vulnerabilities.moderate +
      vulnerabilities.high +
      vulnerabilities.critical;

    console.log("\nSecurity Audit Results:");
    console.log(`  Critical: ${vulnerabilities.critical}`);
    console.log(`  High: ${vulnerabilities.high}`);
    console.log(`  Moderate: ${vulnerabilities.moderate}`);
    console.log(`  Low: ${vulnerabilities.low}`);
    console.log(`  Info: ${vulnerabilities.info}`);
    console.log(`  Total: ${total}\n`);

    // Fail CI if critical or high vulnerabilities
    if (vulnerabilities.critical > CRITICAL_THRESHOLD || vulnerabilities.high > HIGH_THRESHOLD) {
      console.error("Security audit failed: Critical or high vulnerabilities found!");
      process.exit(1);
    }

    console.log("Security audit passed!");
  } catch (error) {
    console.error("Security audit failed:", error);
    process.exit(1);
  }
}

runSecurityAudit();
```

**Why good:** Automated CI security checks block PRs with vulnerabilities, named constants for thresholds enable easy policy changes, detailed logging provides visibility into security posture, early detection prevents vulnerable code from reaching production

### Bad Example - No CI Security Checks

```typescript
// BAD: No CI security checks
// No automated vulnerability scanning in CI
// PRs merge without security validation
// Magic numbers instead of named constants
if (vulns.critical > 0) { // What's the threshold policy?
  process.exit(1);
}
```

**Why bad:** No CI security checks allow vulnerable code to merge undetected, magic numbers obscure security policy decisions, manual security reviews are inconsistent and often skipped, vulnerabilities discovered after deployment are costly to fix

---

## Pattern 3: XSS Prevention

### Good Example - React Auto-escaping

```typescript
const USER_COMMENT_MAX_LENGTH = 500;

// React auto-escaping
function UserComment({ comment }: { comment: string }) {
  return <div>{comment}</div>; // React escapes automatically
}
```

### Good Example - Sanitize with DOMPurify

```typescript
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

### Bad Example - Dangerous HTML Injection

```typescript
// BAD: Dangerous HTML injection
function UserComment({ comment }: { comment: string }) {
  return <div dangerouslySetInnerHTML={{ __html: comment }} />;
}

// BAD: Magic array values
function BadSanitize({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i'], // What's the policy?
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

**Why bad:** dangerouslySetInnerHTML without sanitization allows arbitrary script execution via user input, XSS attacks can steal cookies/tokens or perform actions as the user, magic array values hide security policy decisions, no useMemo causes performance issues and repeated sanitization

### Good Example - Content Security Policy

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

### Bad Example - No CSP Configuration

```typescript
// BAD: No CSP configuration
// No Content-Security-Policy headers
// Allows inline scripts from anywhere
// No XSS protection headers

// BAD: Overly permissive CSP
const badCSP = "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'";
```

**Why bad:** Missing CSP headers allow any script to execute enabling XSS exploitation, overly permissive CSP defeats the purpose of having a policy, 'unsafe-inline' and 'unsafe-eval' allow common XSS attack vectors, no X-Frame-Options enables clickjacking attacks

---

## Pattern 4: CSRF Protection

### Good Example - CSRF Token with Axios Interceptor

```typescript
const CSRF_TOKEN_META_NAME = "csrf-token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

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

### Bad Example - No CSRF Protection

```typescript
// BAD: No CSRF protection
async function updateProfile(data: ProfileData) {
  return fetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// BAD: Manual token per request
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

### Good Example - Cookie Security

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

## Pattern 5: Code Ownership (CODEOWNERS)

### Good Example - CODEOWNERS Configuration

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
src/skillsNew/* @frontend-team @tech-leads

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

### Bad Example - No CODEOWNERS or Individual Owners

```
# BAD: No CODEOWNERS
# No automatic reviewer assignment
# Anyone can modify security-sensitive files
# No audit trail for critical changes

# BAD: Individual owners
.env.example @john-developer
packages/auth/* @jane-engineer
```

**Why bad:** Missing CODEOWNERS allows unauthorized changes to critical code, individual owners create single points of failure during vacations/departures, no automatic assignment leads to missed security reviews, lack of audit trail makes incident investigation difficult

### Good Example - Branch Protection Configuration

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

## Pattern 6: Rate Limiting

### Good Example - Client-Side Rate Limiting

```typescript
const MAX_REQUESTS_PER_WINDOW = 100;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

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

### Bad Example - No Rate Limiting

```typescript
// BAD: No rate limiting
async function sendMessage(message: string) {
  return fetch("/api/messages", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// BAD: Magic numbers
if (this.requestsInWindow >= 100) { // What's the policy?
  await new Promise(resolve => setTimeout(resolve, 60000)); // Why 60 seconds?
}
```

**Why bad:** No rate limiting allows rapid-fire requests that overwhelm servers, users receive 429 errors with poor UX, magic numbers obscure rate limit policy, no queuing means requests fail instead of being delayed
