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

@include(./docs.md)

---

@include(./examples.md)
