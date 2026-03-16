# Security Patterns - XSS Prevention Examples

> XSS prevention patterns including framework auto-escaping, DOMPurify sanitization, and CSP headers. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related Examples:**

- [core.md](core.md) - Essential patterns (secrets, CSRF, cookies)
- [dependency-security.md](dependency-security.md) - Dependabot, CI security checks
- [access-control.md](access-control.md) - CODEOWNERS, rate limiting, branch protection

---

## Pattern 1: Framework Auto-escaping and DOMPurify

### Good Example - Framework Auto-escaping

```typescript
// Most frameworks auto-escape text content by default.
// This is safe - user input is rendered as text, not HTML.
function UserComment({ comment }: { comment: string }) {
  return <div>{comment}</div>; // Auto-escaped by framework
}
```

### Good Example - Sanitize with DOMPurify

```typescript
import DOMPurify from "dompurify";

// IMPORTANT: DOMPurify's default allows <style> (CSS exfiltration) and <form> (CSRF).
// Always use explicit whitelist for security-critical applications.
const ALLOWED_TAGS = ["b", "i", "em", "strong", "a", "p", "br"];
const ALLOWED_ATTR = ["href", "title"];

function sanitizeHTML(untrusted: string): string {
  return DOMPurify.sanitize(untrusted, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

// Usage: sanitize BEFORE injecting raw HTML into the DOM
const safeHTML = sanitizeHTML(userContent);
element.innerHTML = safeHTML;
```

**Why good:** Framework auto-escaping prevents XSS by converting user input to safe text, DOMPurify whitelist approach only allows explicitly permitted tags, named constants make security policy clear and auditable

### Bad Example - Unsanitized HTML Injection

```typescript
// BAD: Injecting raw user content as HTML
element.innerHTML = userContent; // Arbitrary script execution!

// BAD: Magic array values hide security policy
const clean = DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ["b", "i"], // What's the policy? Why these tags?
});
```

**Why bad:** Raw HTML injection without sanitization allows arbitrary script execution via user input, XSS attacks can steal cookies/tokens or perform actions as the user, magic array values hide security policy decisions

---

## Pattern 2: Content Security Policy

### Good Example - Content Security Policy

```typescript
// Security headers - apply via your framework's middleware or server config
const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    // Strict CSP with nonce + strict-dynamic for CSP Level 3
    // 'strict-dynamic' allows trusted scripts to load additional scripts
    // 'unsafe-inline' is ignored by browsers when nonce is present (fallback for old browsers)
    "script-src 'nonce-{NONCE}' 'strict-dynamic' https: 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.example.com",
    "object-src 'none'", // Prevent plugin execution (Flash, Java)
    "frame-ancestors 'none'",
    "base-uri 'none'", // Prevent base tag hijacking
    "form-action 'self'",
  ].join("; "),
  // Prevent MIME-type sniffing
  "X-Content-Type-Options": "nosniff",
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // X-XSS-Protection is deprecated - set to "0" to prevent legacy browser issues.
  // Rely on CSP for XSS protection instead.
  "X-XSS-Protection": "0",
};

// Apply headers in your server/middleware
for (const [key, value] of Object.entries(securityHeaders)) {
  response.headers.set(key, value);
}
```

**Why good:** CSP prevents unauthorized script execution even if XSS occurs, nonce + strict-dynamic is the modern best practice (CSP Level 3), object-src 'none' blocks plugin exploits, base-uri 'none' prevents base tag hijacking, X-Frame-Options prevents clickjacking, X-XSS-Protection set to 0 disables deprecated browser filter that can cause vulnerabilities

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
