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
