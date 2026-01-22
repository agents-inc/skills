# Security Patterns - XSS Prevention Examples

> XSS prevention patterns including React escaping, DOMPurify sanitization, and CSP headers. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related Examples:**

- [core.md](core.md) - Essential patterns (secrets, CSRF, cookies)
- [dependency-security.md](dependency-security.md) - Dependabot, CI security checks
- [access-control.md](access-control.md) - CODEOWNERS, rate limiting, branch protection

---

## Pattern 1: React Auto-escaping

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

// IMPORTANT: DOMPurify's default allows <style> (CSS exfiltration) and <form> (CSRF).
// Always use explicit whitelist for security-critical applications.
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

---

## Pattern 2: Content Security Policy

### Good Example - Content Security Policy

```typescript
// next.config.js or middleware
const CSP_NONCE_LENGTH = 32;

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Strict CSP with nonce + strict-dynamic for CSP Level 3
      // 'strict-dynamic' allows trusted scripts to load additional scripts
      // 'unsafe-inline' is ignored by browsers when nonce is present (fallback for old browsers)
      "script-src 'nonce-{NONCE}' 'strict-dynamic' https: 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'", // Needed for CSS-in-JS temporarily
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.example.com",
      "object-src 'none'", // Prevent plugin execution (Flash, Java)
      "frame-ancestors 'none'",
      "base-uri 'none'", // Prevent base tag hijacking
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Note: X-XSS-Protection is deprecated and removed from modern browsers.
  // Setting to "0" explicitly disables it to prevent legacy browser issues.
  // Rely on CSP for XSS protection instead.
  {
    key: "X-XSS-Protection",
    value: "0",
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
