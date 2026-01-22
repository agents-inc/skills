# Security Patterns - Core Examples

> Essential security patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [xss-prevention.md](xss-prevention.md) - XSS protection, DOMPurify, CSP headers
- [dependency-security.md](dependency-security.md) - Dependabot, CI security checks
- [access-control.md](access-control.md) - CODEOWNERS, rate limiting, branch protection

---

## Pattern 1: Secret Management

### Rotation Policy Constants

```typescript
// NIST SP 800-63-4 (2025): Avoid mandatory periodic rotation for user passwords.
// Use event-based rotation (on compromise) instead.
// Periodic rotation is still recommended for service/privileged accounts.
const ROTATION_SERVICE_ACCOUNT_DAYS = 90; // Quarterly for service accounts
const ROTATION_PRIVILEGED_ACCOUNT_DAYS = 90; // Quarterly for privileged access
const ROTATION_API_KEYS_DAYS = 365; // Annually or on compromise
const CERT_EXPIRY_WARNING_DAYS = 30; // 30 days notice before expiry
// User passwords: rotate on compromise only (NIST 2025 guidance)
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

## Pattern 2: CSRF Protection

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
  const token = document.querySelector<HTMLMetaElement>(
    `meta[name="${CSRF_TOKEN_META_NAME}"]`,
  )?.content;

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

res.cookie("authToken", token, {
  httpOnly: true, // Prevents JavaScript access
  secure: true, // HTTPS only
  sameSite: "lax", // Modern default - balances security and UX (use 'strict' for sensitive operations only)
  maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
  path: "/",
});
```

**Why good:** HttpOnly prevents XSS token theft via JavaScript, Secure ensures cookies only sent over HTTPS preventing interception, SameSite=Lax is the modern browser default providing CSRF protection while allowing legitimate cross-site navigation, named constant makes expiration policy clear and auditable

> **Note:** Use `sameSite: 'strict'` only for cookies used in sensitive state-changing operations. For general session cookies, `'lax'` provides better UX while maintaining security.
