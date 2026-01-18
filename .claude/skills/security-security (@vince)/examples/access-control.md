# Security Patterns - Access Control Examples

> CODEOWNERS, branch protection, and rate limiting patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related Examples:**
- [core.md](core.md) - Essential patterns (secrets, CSRF, cookies)
- [xss-prevention.md](xss-prevention.md) - XSS protection, DOMPurify, CSP headers
- [dependency-security.md](dependency-security.md) - Dependabot, CI security checks

---

## Pattern 1: Code Ownership (CODEOWNERS)

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

---

## Pattern 2: Branch Protection Configuration

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

## Pattern 3: Rate Limiting

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
