# Strapi Authentication Examples

> JWT authentication, user registration, login, and authenticated requests. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for REST API patterns.

**Prerequisites**: Understand REST API request/response format from core examples first.

---

## Pattern 1: User Registration

### Good Example -- Register with Error Handling

```typescript
const STRAPI_URL = process.env.STRAPI_URL;

interface AuthResponse {
  jwt: string;
  refreshToken?: string;
  user: {
    id: number;
    documentId: string;
    username: string;
    email: string;
  };
}

async function registerUser(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await fetch(`${STRAPI_URL}/api/auth/local/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Registration failed");
  }

  return response.json();
}

// Usage
const { jwt, user } = await registerUser(
  "jane",
  "jane@example.com",
  "SecurePass123!",
);
// jwt: "eyJhbGciOi..." -- store securely
// user: { id: 1, documentId: "...", username: "jane", email: "jane@example.com" }
```

**Why good:** Registration endpoint returns JWT immediately (user is logged in after register), error response parsed for descriptive messages, typed response interface

---

## Pattern 2: User Login

### Good Example -- Login with JWT Storage

```typescript
async function loginUser(
  identifier: string, // Email or username
  password: string,
): Promise<AuthResponse> {
  const response = await fetch(`${STRAPI_URL}/api/auth/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Login failed");
  }

  return response.json();
}

// Usage
const { jwt, refreshToken, user } = await loginUser(
  "jane@example.com",
  "SecurePass123!",
);
```

**Why good:** `identifier` accepts either email or username, returns JWT and optional refresh token (depends on `jwtManagement` config), typed response

### Bad Example -- Insecure Token Storage

```typescript
// BAD: Storing JWT in localStorage (XSS-vulnerable)
const { jwt } = await loginUser("jane@example.com", "pass");
localStorage.setItem("jwt", jwt); // Accessible by any script on the page
```

**Why bad:** `localStorage` is accessible to any JavaScript on the page (XSS vulnerability), consider httpOnly cookies or secure session management for production

---

## Pattern 3: Authenticated Requests

### Good Example -- Bearer Token in Headers

```typescript
async function fetchProtectedData<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${STRAPI_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    throw new Error("Authentication expired -- please login again");
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.statusText}`);
  }

  return response.json();
}

// Fetch current user profile
const me = await fetchProtectedData("/api/users/me", jwt);

// Fetch protected content
const drafts = await fetchProtectedData(`/api/articles?status=draft`, jwt);
```

**Why good:** JWT passed in `Authorization: Bearer` header (Strapi convention), 401 handled separately for auth-specific error flow, reusable for any protected endpoint, `/api/users/me` returns the authenticated user

---

## Pattern 4: Token Refresh

### Good Example -- Refresh Token Flow

```typescript
async function refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
  const response = await fetch(`${STRAPI_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed -- please login again");
  }

  return response.json();
}

// Usage: Auto-refresh on 401
async function fetchWithRefresh<T>(
  path: string,
  accessToken: string,
  refreshToken: string,
): Promise<{ data: T; newTokens?: { jwt: string; refreshToken: string } }> {
  try {
    const data = await fetchProtectedData<T>(path, accessToken);
    return { data };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Authentication expired")
    ) {
      // Attempt refresh
      const newAuth = await refreshAccessToken(refreshToken);
      const data = await fetchProtectedData<T>(path, newAuth.jwt);
      return {
        data,
        newTokens: { jwt: newAuth.jwt, refreshToken: newAuth.refreshToken! },
      };
    }
    throw error;
  }
}
```

**Why good:** Refresh flow only triggers on 401 (expired token), returns new tokens to the caller for storage, falls through to re-throw for non-auth errors

**Note:** Token refresh requires `jwtManagement: 'refresh'` in the Users & Permissions plugin config. The default `'legacy-support'` mode does not support refresh tokens.

---

## Pattern 5: API Token Authentication (Server-to-Server)

### Good Example -- Using API Tokens

```typescript
// For server-to-server or script access (not end-user auth)
const API_TOKEN = process.env.STRAPI_API_TOKEN;

async function fetchWithApiToken<T>(path: string): Promise<T> {
  const response = await fetch(`${STRAPI_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}
```

**Why good:** API tokens are created in the admin panel (Settings > API Tokens), suitable for server-to-server communication, CI/CD scripts, and static site generation where user login is inappropriate

**API Token types:**

- **Read-only** -- Can only `find` and `findOne`
- **Full access** -- All CRUD operations on all content types
- **Custom** -- Fine-grained per-content-type, per-action permissions

---

## Pattern 6: Permissions Configuration

### Configuring Public Access

Permissions are set in the Strapi admin panel under **Settings > Users & Permissions plugin > Roles**.

```
Admin Panel > Settings > Users & Permissions > Roles > Public
  - Application
    - Article
      - [x] find       (GET /api/articles)
      - [x] findOne    (GET /api/articles/:documentId)
      - [ ] create     (POST /api/articles)
      - [ ] update     (PUT /api/articles/:documentId)
      - [ ] delete     (DELETE /api/articles/:documentId)
```

### Configuring Authenticated Access

```
Admin Panel > Settings > Users & Permissions > Roles > Authenticated
  - Application
    - Article
      - [x] find
      - [x] findOne
      - [x] create
      - [x] update
      - [x] delete
```

### JWT Configuration

```typescript
// config/plugins.ts
export default ({ env }) => ({
  "users-permissions": {
    config: {
      jwt: {
        expiresIn: "7d", // Access token expiration
      },
      jwtManagement: "refresh", // Enable refresh tokens
      // or 'legacy-support' for simple JWT (no refresh)
    },
  },
});
```

**Why good:** JWT expiration configured via plugin config (not hardcoded), `jwtManagement: 'refresh'` enables the modern refresh token flow, permissions managed declaratively in the admin panel

---

_For REST API patterns, see [core.md](core.md). For backend customization, see [backend.md](backend.md)._
