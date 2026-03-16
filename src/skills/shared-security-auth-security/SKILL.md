---
name: security-auth-security
description: Secrets management, XSS prevention, CSRF protection, dependency scanning, DOMPurify sanitization, CSP headers, CODEOWNERS, HttpOnly cookies
---

# Security Patterns

> **Quick Guide:** Managing secrets? Use .env.local (gitignored), CI secrets, rotate on compromise or team changes. Dependency security? Enable automated scanning (Dependabot), patch critical vulns within 24hrs. XSS prevention? Modern frameworks auto-escape output by default - never bypass with raw HTML injection unless sanitized with DOMPurify. Set CSP headers. CODEOWNERS? Require security team review for auth/, .env.example, workflows.

**Detailed Resources:**

- For code examples, see [examples/core.md](examples/core.md) (essential patterns)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Additional Examples:**

- [examples/xss-prevention.md](examples/xss-prevention.md) - XSS protection, DOMPurify, CSP headers
- [examples/dependency-security.md](examples/dependency-security.md) - Dependabot, CI security checks
- [examples/access-control.md](examples/access-control.md) - CODEOWNERS, rate limiting, branch protection

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST NEVER commit secrets to the repository - use .env.local and CI secrets only)**

**(You MUST sanitize ALL user input before rendering raw HTML - use DOMPurify before any HTML injection)**

**(You MUST patch critical/high vulnerabilities within 24 hours - use Dependabot for automated scanning)**

**(You MUST use HttpOnly cookies for authentication tokens - NEVER localStorage or sessionStorage)**

**(You MUST configure CODEOWNERS for security-sensitive files - require security team approval)**

</critical_requirements>

---

**Auto-detection:** security, secrets management, XSS prevention, CSRF protection, Dependabot, vulnerability scanning, authentication, DOMPurify, CSP headers, CODEOWNERS, HttpOnly cookies

**When to use:**

- Managing secrets securely (never commit, use .env.local and CI secrets)
- Setting up Dependabot for automated vulnerability scanning
- Preventing XSS attacks (framework auto-escaping, DOMPurify, CSP headers)
- Configuring CODEOWNERS for security-sensitive code
- Implementing secure authentication and token storage

**When NOT to use:**

- For general code quality reviews (not a security concern)
- For performance optimization (different domain)
- For CI/CD pipeline setup (security patterns here are for code, not infrastructure)
- When security review would delay critical hotfixes (document for follow-up)

**Key patterns covered:**

- Never commit secrets (.gitignore, CI secrets, rotation policies quarterly)
- Automated dependency scanning with Dependabot (critical within 24h)
- XSS prevention (framework auto-escaping, DOMPurify for HTML, CSP headers)
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

**Note:** NIST SP 800-63-4 (2025) recommends against mandatory periodic password rotation for users. Instead, use event-based rotation (on compromise, team member departure, or security incident). Periodic rotation is still recommended for service accounts and privileged access.

| Secret Type                  | Rotation Frequency                      |
| ---------------------------- | --------------------------------------- |
| Service account credentials  | 90 days (quarterly)                     |
| API keys                     | 365 days (annually) or on compromise    |
| User passwords               | On compromise only (NIST 2025 guidance) |
| Privileged account passwords | 90 days (quarterly)                     |
| Certificates                 | 30 days warning before expiry           |
| All secrets                  | Immediately on team member departure    |

**See [examples/core.md](examples/core.md#pattern-1-secret-management) for code examples.**

---

### Pattern 2: Dependency Security

Enable automated vulnerability scanning with Dependabot to catch security issues in dependencies. Patch critical vulnerabilities within 24 hours, high within 1 week, medium within 1 month.

#### Update Policies

**Security updates:**

- **Critical vulnerabilities** - Immediate (within 24 hours)
- **High vulnerabilities** - Within 1 week
- **Medium vulnerabilities** - Within 1 month
- **Low vulnerabilities** - Next regular update cycle

**Regular updates:**

- **Patch updates** (1.2.3 -> 1.2.4) - Auto-merge if tests pass
- **Minor updates** (1.2.0 -> 1.3.0) - Review changes, test, merge
- **Major updates** (1.0.0 -> 2.0.0) - Plan migration, test thoroughly

**See [examples/dependency-security.md](examples/dependency-security.md) for Dependabot configuration and CI security check scripts.**

---

### Pattern 3: XSS Prevention

Modern UI frameworks auto-escape user input by default. Never bypass this protection with raw HTML injection unless sanitized with DOMPurify. Configure Content Security Policy (CSP) headers to block unauthorized scripts.

#### Framework Auto-escaping

Most frameworks escape text content automatically. Only explicit HTML injection APIs (e.g., `dangerouslySetInnerHTML`, `v-html`, `{@html}`) bypass this protection.

#### DOMPurify Sanitization

When HTML rendering is required, use DOMPurify with a whitelist of allowed tags and attributes.

#### Content Security Policy

Configure CSP headers to prevent unauthorized script execution even if XSS occurs.

**See [examples/xss-prevention.md](examples/xss-prevention.md) for DOMPurify and CSP code examples.**

---

### OWASP Top 10:2025 Coverage

This skill addresses the following [OWASP Top 10:2025](https://owasp.org/Top10/2025/) categories:

| OWASP Category                             | Coverage                                          |
| ------------------------------------------ | ------------------------------------------------- |
| A01: Broken Access Control                 | CODEOWNERS, branch protection, rate limiting      |
| A02: Security Misconfiguration             | CSP headers, security headers, Dependabot         |
| A03: Software Supply Chain Failures        | Dependabot, CI security audits, dependency review |
| A04: Cryptographic Failures                | HttpOnly/Secure cookies, HTTPS enforcement        |
| A05: Injection                             | DOMPurify, framework auto-escaping, CSP           |
| A07: Authentication Failures               | HttpOnly cookies, session management              |
| A10: Mishandling of Exceptional Conditions | Fail securely principle, error handling           |

</patterns>

---

**Defense in depth layers:**

- **Secrets**: .env.local (dev) -> CI secrets -> Environment variables (production)
- **XSS**: Framework auto-escaping -> DOMPurify sanitization -> CSP headers
- **CSRF**: Tokens -> SameSite cookies -> Server-side validation
- **Dependencies**: Automated scanning -> CI security audit -> Manual review

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST NEVER commit secrets to the repository - use .env.local and CI secrets only)**

**(You MUST sanitize ALL user input before rendering raw HTML - use DOMPurify before any HTML injection)**

**(You MUST patch critical/high vulnerabilities within 24 hours - use Dependabot for automated scanning)**

**(You MUST use HttpOnly cookies for authentication tokens - NEVER localStorage or sessionStorage)**

**(You MUST configure CODEOWNERS for security-sensitive files - require security team approval)**

**Failure to follow these rules will create security vulnerabilities enabling XSS attacks, token theft, CSRF attacks, and data breaches.**

</critical_reminders>
