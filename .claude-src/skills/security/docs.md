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
