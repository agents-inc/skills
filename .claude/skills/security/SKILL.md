# Security Patterns

**Auto-detection:** Security, secrets management, XSS prevention, CSRF protection, Dependabot, vulnerability scanning, authentication, DOMPurify, CSP headers

**When to use:**

- Managing secrets securely (never commit, use .env.local and CI secrets)
- Setting up Dependabot for automated vulnerability scanning
- Preventing XSS attacks (React escaping, DOMPurify, CSP headers)
- Configuring CODEOWNERS for security-sensitive code

**Key patterns covered:**

- Never commit secrets (.gitignore, CI secrets, rotation policies quarterly)
- Automated dependency scanning with Dependabot (critical within 24h)
- XSS prevention (React's built-in escaping, DOMPurify for HTML, CSP headers)
- CODEOWNERS for security-sensitive areas (.env.example, auth code, workflows)

---

# Security Patterns

> **Quick Guide:** Managing secrets? § (never commit). Dependency security? § (Dependabot). XSS prevention? CODEOWNERS?

---

## Secret Management

**CRITICAL: Never commit secrets to repository**

### What Are Secrets

**Secrets include:**
- API keys, tokens, passwords
- Database credentials
- Private keys, certificates
- OAuth client secrets
- Encryption keys
- JWT secrets

### Where to Store Secrets

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

### Rotation Policies

**Recommended schedule:**
- **Critical secrets** - Quarterly or on team member departure
- **API keys** - Annually or on suspicious activity
- **Passwords** - Every 90 days (or use OAuth/SSO)
- **Certificates** - Before expiration (30 days notice)

**Rotation process:**
1. Generate new secret
2. Add to secret management system
3. Update applications (blue-green or rolling deploy)
4. Monitor for issues (24-48 hours)
5. Revoke old secret

### Access Control

**Principle of least privilege:**
- Separate secrets per environment (dev/staging/prod)
- Limit access to production secrets (admins only)
- Use service accounts for automation
- Audit secret access regularly

---

## Dependency Security

**RECOMMENDED: Automated vulnerability scanning**

### Vulnerability Scanning

**Tools:**

**Dependabot (GitHub):**
- Automatic security updates
- Creates PRs for vulnerable dependencies
- Free for all GitHub repos
- Configure in `.github/dependabot.yml`

**Snyk:**
- Comprehensive security scanning
- License compliance checking
- Container scanning
- Paid service (free tier available)

**npm audit / bun audit:**
- Built-in vulnerability checking
- Run in CI pipeline
- Fix vulnerabilities automatically

### Update Policies

**Security updates:**
- **Critical vulnerabilities** - Immediate (within 24 hours)
- **High vulnerabilities** - Within 1 week
- **Medium vulnerabilities** - Within 1 month
- **Low vulnerabilities** - Next regular update cycle

**Regular updates:**
- **Patch updates** (1.2.3 → 1.2.4) - Auto-merge if tests pass
- **Minor updates** (1.2.0 → 1.3.0) - Review changes, test, merge
- **Major updates** (1.0.0 → 2.0.0) - Plan migration, test thoroughly

### Automated Security Checks

**CI pipeline security:**

```yaml
# .github/workflows/security.yml
name: Security Checks

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  audit:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Audit dependencies
        run: bun audit

      - name: Check for security vulnerabilities
        run: bun run check:security

  snyk:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Patch Management

**Process:**
1. Automated tools identify vulnerability
2. PR created with patch/update
3. CI runs tests automatically
4. Security team reviews changes
5. Merge if tests pass
6. Deploy to staging
7. Deploy to production

**For critical vulnerabilities:**
- Skip staging (deploy directly to production)
- Monitor closely post-deployment
- Rollback plan ready

---

## XSS Prevention

**CRITICAL: Prevent Cross-Site Scripting attacks**

### React's Built-in Protection

**React automatically escapes:**
```typescript
// ✅ SAFE: React escapes user input
<div>{userInput}</div>
<input value={userInput} />

// ❌ DANGEROUS: Bypasses React's protection
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**Never use `dangerouslySetInnerHTML` with user input!**

### Sanitizing User Input

**If you must render HTML:**

```typescript
import DOMPurify from 'dompurify';

// ✅ SAFE: Sanitize before rendering
const clean = DOMPurify.sanitize(dirtyHTML);
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

### Content Security Policy

**Recommended CSP headers:**

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
```

**Next.js configuration:**

```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline';",
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

## Code Ownership (CODEOWNERS)

**RECOMMENDED: Define code owners for security-sensitive areas**

**Example `.github/CODEOWNERS`:**

```
# Security-sensitive files require security team review
.env.example @security-team
.github/workflows/* @devops-team
packages/auth/* @security-team @backend-team

# Frontend patterns require frontend team review
frontend-patterns/* @frontend-team

# Build configuration
turbo.json @devops-team
package.json @tech-leads
```

**Benefits:**
- Automatic reviewer assignment
- Prevents unauthorized changes to sensitive code
- Ensures expertise reviews critical changes
- Audit trail for security-sensitive changes

---

## Authentication & Authorization

**Best practices:**

- Use established libraries (NextAuth, Auth0, Clerk)
- Never roll your own authentication
- Use OAuth 2.0 / OpenID Connect
- Implement proper session management
- Use HTTPS only (no HTTP)
- Set secure cookie flags (`httpOnly`, `secure`, `sameSite`)
- Implement rate limiting
- Use CSRF tokens for state-changing operations

---

## Common Security Anti-Patterns

**❌ NEVER do these:**

- Committing secrets to repository
- Using `dangerouslySetInnerHTML` with user input
- Storing passwords in plain text
- Skipping HTTPS in production
- Trusting client-side validation only
- Exposing internal error details to users
- Not sanitizing user input
- Hardcoding API keys in code
- Using weak session management
- Not implementing rate limiting

---

## Security Checklist

**Pre-deployment:**
- [ ] No secrets committed to repository
- [ ] Environment variables properly configured
- [ ] Dependencies scanned for vulnerabilities
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Authentication properly implemented
- [ ] Authorization checks in place
- [ ] Input validation on server-side
- [ ] Rate limiting implemented
- [ ] Error handling doesn't leak sensitive info

**Ongoing:**
- [ ] Regular security audits
- [ ] Dependency updates (weekly)
- [ ] Secret rotation (quarterly)
- [ ] Security training for team
- [ ] Incident response plan documented

---

## Resources

**Tools:**
- Dependabot: https://github.com/dependabot
- Snyk: https://snyk.io/
- DOMPurify: https://github.com/cure53/DOMPurify
- OWASP Top 10: https://owasp.org/www-project-top-ten/

**Guides:**
- OWASP Cheat Sheets: https://cheatsheetseries.owasp.org/
- Web Security Academy: https://portswigger.net/web-security


---

# Security Patterns - Examples

---

## Secret Management

### Example: Secure Token Storage

```typescript
// ❌ BAD: Storing tokens in localStorage
function storeAuthToken(token: string) {
  localStorage.setItem("authToken", token);
}

// ✅ GOOD: HttpOnly cookies (handled by server)
// Frontend: Don't store token at all
// Backend sets: Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict

// ✅ GOOD: For refresh tokens, use secure storage
import { SecureStore } from "expo-secure-store"; // Mobile
// Or encrypted storage on desktop

async function storeRefreshToken(token: string) {
  await SecureStore.setItemAsync("refreshToken", token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

// ✅ BEST: Short-lived access tokens in memory
let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token; // In-memory only
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

**Why:** Prevents XSS token theft. HttpOnly cookies inaccessible to JavaScript. Secure storage for sensitive data.

**Edge Cases:**

- Rotate tokens regularly
- Clear on logout
- Handle token refresh failures
- Consider device fingerprinting

---

## Dependency Security

### Example: Dependabot Configuration

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

**Why:** Automated security updates. Reduces manual work. Keeps dependencies current. Catches vulnerabilities early.

**Edge Cases:**
- Review breaking changes before merging
- Test thoroughly in CI
- Group minor updates to reduce PR noise
- Pin major versions that need careful migration

---

### Example: Security Audit Script

```json
// package.json
{
  "scripts": {
    "audit": "bun audit",
    "audit:fix": "bun audit --fix",
    "check:security": "bun run audit && bun run check:licenses",
    "check:licenses": "license-checker --production --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC'"
  }
}
```

```typescript
// scripts/security-check.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
    if (vulnerabilities.critical > 0 || vulnerabilities.high > 0) {
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

**Why:** Automated security checks in CI. Blocks PRs with vulnerabilities. License compliance. Early detection.

**Edge Cases:**
- Allow certain vulnerabilities temporarily with audit overrides
- Check both dev and production dependencies
- Run weekly scheduled checks, not just on PRs
- Notify team on Slack/email for new vulnerabilities

---

### Example: Snyk Integration

```yaml
# .github/workflows/security.yml
name: Security Checks

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  snyk:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Upload Snyk results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: snyk.sarif
```

**Why:** Comprehensive vulnerability scanning. Container and code scanning. License compliance. GitHub Security integration.

**Edge Cases:**
- Configure severity threshold per project
- Exclude dev dependencies in production scans
- Monitor trends over time
- Set up Slack notifications for new vulnerabilities

---

## Code Ownership

### Example: CODEOWNERS Configuration

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
frontend-patterns/* @frontend-team @tech-leads
.claude/* @frontend-team

# Backend packages
packages/api/* @backend-team
packages/database/* @backend-team @dba-team

# Build and infrastructure
turbo.json @devops-team @tech-leads
package.json @tech-leads
.github/dependabot.yml @devops-team @security-team
Dockerfile @devops-team

# Documentation
*.md @docs-team
README.md @tech-leads

# Critical business logic
apps/*/features/payment/* @backend-team @security-team @product-team
apps/*/features/auth/* @security-team @backend-team

# Design system
packages/ui/* @frontend-team @design-team
```

**Why:** Automatic reviewer assignment. Expertise ensures quality. Prevents unauthorized changes. Security guardrails. Audit trail.

**Edge Cases:**
- Use teams instead of individuals for better coverage
- More specific rules override general rules
- Require approval from all teams with `CODEOWNERS` for critical files
- Review CODEOWNERS quarterly as team structure changes

---

### Example: Branch Protection with CODEOWNERS

```yaml
# GitHub branch protection configuration (via API or UI)
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "ci/test",
      "ci/lint",
      "ci/type-check",
      "ci/security-audit"
    ]
  },
  "enforce_admins": true,
  "restrictions": null
}
```

**Why:** Enforces code owner approval. Cannot bypass security reviews. Ensures quality checks pass. Prevents accidental merges.

**Edge Cases:**
- Allow hotfix process for emergencies
- Require security team for production deployments
- Set up on-call rotation for code reviews
- Configure different rules per branch (main vs staging)

---

## Security best practices

### Example: XSS Prevention with DOMPurify

```typescript
// ❌ BAD: Dangerous HTML injection
function UserComment({ comment }: { comment: string }) {
  return <div dangerouslySetInnerHTML={{ __html: comment }} />;
}

// ✅ GOOD: Sanitize HTML content
import DOMPurify from 'dompurify';

function UserComment({ comment }: { comment: string }) {
  const sanitizedHTML = useMemo(
    () => DOMPurify.sanitize(comment, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
      ALLOWED_ATTR: ['href']
    }),
    [comment]
  );

  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
}
```

**Why:** Prevents XSS attacks. Whitelisted tags only. Removes malicious scripts. Safe HTML rendering.

**Edge Cases:**

- Configure allowed tags per use case
- Consider markdown parsing instead for rich text
- Sanitize on server too - defense in depth

---

### Example: CSRF Protection with Tokens

```typescript
// ❌ BAD: No CSRF protection
async function updateProfile(data: ProfileData) {
  return fetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ✅ GOOD: Include CSRF token
async function updateProfile(data: ProfileData) {
  const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;

  return fetch("/api/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken!,
    },
    body: JSON.stringify(data),
  });
}

// ✅ BETTER: Axios interceptor for all requests
import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;

  if (token) {
    config.headers["X-CSRF-Token"] = token;
  }

  return config;
});
```

**Why:** Prevents CSRF attacks. Validates request origin. Protects state-changing operations.

**Edge Cases:**

- Refresh token if expired
- Handle missing token gracefully
- Use SameSite cookies as additional protection

---

### Example: Content Security Policy

```typescript
// ❌ BAD: No CSP configuration
// Allows inline scripts, any external resources

// ✅ GOOD: Strict CSP configuration
// In Next.js middleware or Express
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Content-Security-Policy',
    [
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
  );

  return response;
}

// Use nonce in scripts
<script nonce={nonce} src="/app.js" />
```

**Why:** Prevents XSS. Blocks unauthorized resources. Controls what can execute. Industry standard for web security.

**Edge Cases:**

- Generate unique nonce per request
- Report violations with report-uri
- Start with report-only mode before enforcing
- Gradually tighten policy

---

### Example: Rate Limiting API Calls

```typescript
// ❌ BAD: No rate limiting
async function sendMessage(message: string) {
  return fetch("/api/messages", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ✅ GOOD: Client-side rate limiting
import pLimit from "p-limit";

const limit = pLimit(5); // Max 5 concurrent requests

const rateLimitedFetch = (url: string, options?: RequestInit) => {
  return limit(() => fetch(url, options));
};

// ✅ BETTER: Rate limiting with retry and backoff
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
const api = new RateLimitedClient(100, 60000); // 100 requests per minute
```

**Why:** Prevents abuse. Protects backend. Better UX with queuing. Avoids 429 errors.

**Edge Cases:**

- Handle 429 responses with exponential backoff
- Show user feedback when throttled
- Consider per-endpoint limits
- Server-side rate limiting is still required

