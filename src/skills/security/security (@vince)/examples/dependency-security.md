# Security Patterns - Dependency Security Examples

> Automated vulnerability scanning with Dependabot and CI security checks. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related Examples:**
- [core.md](core.md) - Essential patterns (secrets, CSRF, cookies)
- [xss-prevention.md](xss-prevention.md) - XSS protection, DOMPurify, CSP headers
- [access-control.md](access-control.md) - CODEOWNERS, rate limiting, branch protection

---

## Pattern 1: Dependabot Configuration

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

---

## Pattern 2: CI Security Checks

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
