# Authentication and Authorization Best Practices

> **Research Document** for creating atomic auth/authz skills. Covers JWT, OAuth, sessions, RBAC/ABAC, MFA, social login, password handling, protected routes, auth state management, and security considerations.

---

## Table of Contents

1. [JWT Patterns (Access/Refresh Tokens)](#1-jwt-patterns-accessrefresh-tokens)
2. [OAuth 2.0/OIDC Patterns](#2-oauth-20oidc-patterns)
3. [Session-Based Auth Patterns](#3-session-based-auth-patterns)
4. [RBAC/ABAC Patterns](#4-rbacabac-patterns)
5. [Multi-Factor Authentication](#5-multi-factor-authentication)
6. [Social Login Integration](#6-social-login-integration)
7. [Password Handling](#7-password-handling)
8. [Protected Routes Patterns](#8-protected-routes-patterns)
9. [Auth State Management](#9-auth-state-management)
10. [Security Considerations](#10-security-considerations)

---

## 1. JWT Patterns (Access/Refresh Tokens)

### Core Patterns

#### Pattern 1A: Dual Token Architecture

```typescript
// types/auth.ts
interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  sub: string;
  tokenFamily: string; // For rotation detection
  iat: number;
  exp: number;
}

// Constants - NEVER use magic numbers
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const TOKEN_ALGORITHM = "RS256" as const;
```

**Why good:** Short-lived access tokens limit damage window; refresh tokens enable seamless UX; RS256 allows public key verification without sharing secrets.

#### Pattern 1B: Token Generation (Server-Side)

```typescript
// lib/jwt.ts
import { SignJWT, jwtVerify } from "jose";

import type { AccessTokenPayload, RefreshTokenPayload } from "@/types/auth";

const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// Load keys from environment (NEVER hardcode)
const privateKey = await importPKCS8(process.env.JWT_PRIVATE_KEY!, "RS256");
const publicKey = await importSPKI(process.env.JWT_PUBLIC_KEY!, "RS256");

export async function generateAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRY_SECONDS}s`)
    .setIssuer(process.env.JWT_ISSUER!)
    .setAudience(process.env.JWT_AUDIENCE!)
    .sign(privateKey);
}

export async function generateRefreshToken(
  userId: string,
  tokenFamily: string
): Promise<string> {
  return new SignJWT({ sub: userId, tokenFamily })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_EXPIRY_SECONDS}s`)
    .sign(privateKey);
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: process.env.JWT_ISSUER!,
      audience: process.env.JWT_AUDIENCE!,
    });
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}
```

#### Pattern 1C: Refresh Token Rotation

```typescript
// lib/token-rotation.ts
import { randomUUID } from "crypto";

import { db } from "@/lib/db";
import { refreshTokens } from "@/schema";

export async function rotateRefreshToken(
  oldToken: string
): Promise<TokenPair | null> {
  const payload = await verifyRefreshToken(oldToken);
  if (!payload) return null;

  // Check if token family is compromised (reuse detection)
  const storedToken = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.token, oldToken),
  });

  if (!storedToken || storedToken.revoked) {
    // Token reuse detected - revoke entire family
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.tokenFamily, payload.tokenFamily));

    return null; // Force re-authentication
  }

  // Revoke old token
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.id, storedToken.id));

  // Generate new token pair with same family
  const newRefreshToken = await generateRefreshToken(
    payload.sub,
    payload.tokenFamily
  );

  // Store new refresh token
  await db.insert(refreshTokens).values({
    id: randomUUID(),
    userId: payload.sub,
    token: newRefreshToken,
    tokenFamily: payload.tokenFamily,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000),
    revoked: false,
  });

  const accessToken = await generateAccessToken({
    sub: payload.sub,
    email: storedToken.userEmail,
    roles: storedToken.userRoles,
  });

  return { accessToken, refreshToken: newRefreshToken };
}
```

**Why good:** Token family tracking detects refresh token theft; revoking entire family on reuse prevents attacker from maintaining access.

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Long-lived access tokens
const accessToken = jwt.sign(payload, secret, { expiresIn: "30d" }); // BAD

// ANTI-PATTERN 2: Storing sensitive data in JWT
const payload = {
  sub: userId,
  password: hashedPassword, // NEVER include
  creditCard: cardNumber, // NEVER include
};

// ANTI-PATTERN 3: Using HS256 with shared secrets across services
jwt.sign(payload, "shared-secret", { algorithm: "HS256" }); // BAD for microservices

// ANTI-PATTERN 4: No token rotation
async function refresh(token: string) {
  const payload = verify(token);
  return generateAccessToken(payload); // BAD: Same refresh token reused forever
}

// ANTI-PATTERN 5: Storing JWTs in localStorage
localStorage.setItem("accessToken", token); // XSS vulnerable
```

### When to Use vs When NOT to Use

| Use JWT When | Do NOT Use JWT When |
|--------------|---------------------|
| Stateless authentication needed | Need instant token revocation |
| Microservices architecture | Simple monolith with sessions |
| Mobile/SPA clients | Server-rendered apps only |
| Cross-domain authentication | Single domain only |
| Need offline token validation | Can always hit database |

---

## 2. OAuth 2.0/OIDC Patterns

### Core Patterns

#### Pattern 2A: Authorization Code Flow with PKCE

```typescript
// lib/oauth/pkce.ts
import { randomBytes, createHash } from "crypto";

const CODE_VERIFIER_LENGTH = 64;

export function generateCodeVerifier(): string {
  return randomBytes(CODE_VERIFIER_LENGTH)
    .toString("base64url")
    .slice(0, CODE_VERIFIER_LENGTH);
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// Usage in authorization request
export function buildAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  codeVerifier: string
): string {
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    response_type: "code",
    scope: provider.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${provider.authorizationEndpoint}?${params.toString()}`;
}
```

#### Pattern 2B: Token Exchange

```typescript
// lib/oauth/token-exchange.ts
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

const TOKEN_EXCHANGE_TIMEOUT_MS = 10000;

export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const response = await fetch(provider.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: provider.clientId,
      client_secret: process.env[`${provider.name}_CLIENT_SECRET`]!,
      code,
      redirect_uri: provider.redirectUri,
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new OAuthError(error.error, error.error_description);
  }

  return response.json();
}
```

#### Pattern 2C: OIDC ID Token Validation

```typescript
// lib/oauth/oidc.ts
import { createRemoteJWKSet, jwtVerify } from "jose";

import type { JWTPayload } from "jose";

interface IDTokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
}

const ID_TOKEN_MAX_AGE_SECONDS = 300; // 5 minutes

export async function validateIDToken(
  idToken: string,
  provider: OAuthProvider,
  expectedNonce: string
): Promise<IDTokenClaims> {
  const jwks = createRemoteJWKSet(new URL(provider.jwksUri));

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: provider.issuer,
    audience: provider.clientId,
    maxTokenAge: ID_TOKEN_MAX_AGE_SECONDS,
  });

  // Validate nonce to prevent replay attacks
  if (payload.nonce !== expectedNonce) {
    throw new Error("Invalid nonce - possible replay attack");
  }

  // Validate email verification if required
  if (provider.requireEmailVerification && !payload.email_verified) {
    throw new Error("Email not verified");
  }

  return payload as IDTokenClaims;
}
```

#### Pattern 2D: State and Nonce Management

```typescript
// lib/oauth/state.ts
import { randomBytes } from "crypto";

import { redis } from "@/lib/redis";

const STATE_EXPIRY_SECONDS = 600; // 10 minutes
const STATE_LENGTH = 32;

interface OAuthState {
  codeVerifier: string;
  nonce: string;
  returnUrl: string;
  provider: string;
}

export async function createOAuthState(
  provider: string,
  returnUrl: string
): Promise<{ state: string; nonce: string; codeVerifier: string }> {
  const state = randomBytes(STATE_LENGTH).toString("hex");
  const nonce = randomBytes(STATE_LENGTH).toString("hex");
  const codeVerifier = generateCodeVerifier();

  const stateData: OAuthState = {
    codeVerifier,
    nonce,
    returnUrl,
    provider,
  };

  await redis.setex(
    `oauth:state:${state}`,
    STATE_EXPIRY_SECONDS,
    JSON.stringify(stateData)
  );

  return { state, nonce, codeVerifier };
}

export async function validateAndConsumeState(
  state: string
): Promise<OAuthState | null> {
  const key = `oauth:state:${state}`;
  const data = await redis.get(key);

  if (!data) return null;

  // Delete immediately to prevent reuse
  await redis.del(key);

  return JSON.parse(data);
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Implicit flow (deprecated, insecure)
const params = new URLSearchParams({
  response_type: "token", // BAD: Token in URL fragment
  // ...
});

// ANTI-PATTERN 2: No PKCE for public clients
// Missing code_challenge and code_verifier

// ANTI-PATTERN 3: Reusable state parameter
const state = "static-state-value"; // BAD: Enables CSRF

// ANTI-PATTERN 4: No nonce validation
// Skipping nonce check enables ID token replay

// ANTI-PATTERN 5: Trusting unverified emails
if (idToken.email) {
  // BAD: Should check email_verified
  createUser({ email: idToken.email });
}
```

### When to Use vs When NOT to Use

| Use OAuth 2.0/OIDC When | Do NOT Use When |
|-------------------------|-----------------|
| Third-party login (Google, GitHub) | Internal-only authentication |
| Delegated authorization needed | Simple username/password sufficient |
| Single sign-on (SSO) requirements | No external identity providers |
| Enterprise integrations (SAML/OIDC) | Small internal tools |
| Mobile apps needing secure auth | Server-to-server only |

---

## 3. Session-Based Auth Patterns

### Core Patterns

#### Pattern 3A: Database-Stored Sessions

```typescript
// schema/sessions.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
});

// lib/sessions.ts
import { randomBytes } from "crypto";

import { db } from "@/lib/db";

const SESSION_TOKEN_LENGTH = 32;
const SESSION_EXPIRY_DAYS = 30;
const SESSION_REFRESH_THRESHOLD_DAYS = 7;

export async function createSession(
  userId: string,
  metadata: { userAgent?: string; ipAddress?: string }
): Promise<string> {
  const token = randomBytes(SESSION_TOKEN_LENGTH).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  await db.insert(sessions).values({
    userId,
    token,
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
    expiresAt,
  });

  return token;
}

export async function validateSession(token: string): Promise<Session | null> {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.token, token),
      gt(sessions.expiresAt, new Date())
    ),
    with: { user: true },
  });

  if (!session) return null;

  // Sliding window: extend session if close to expiry
  const daysUntilExpiry = Math.floor(
    (session.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < SESSION_REFRESH_THRESHOLD_DAYS) {
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + SESSION_EXPIRY_DAYS);

    await db
      .update(sessions)
      .set({ expiresAt: newExpiresAt, lastActiveAt: new Date() })
      .where(eq(sessions.id, session.id));
  }

  return session;
}

export async function revokeSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function revokeAllUserSessions(
  userId: string,
  exceptToken?: string
): Promise<void> {
  const conditions = [eq(sessions.userId, userId)];
  if (exceptToken) {
    conditions.push(ne(sessions.token, exceptToken));
  }
  await db.delete(sessions).where(and(...conditions));
}
```

#### Pattern 3B: Secure Cookie Configuration

```typescript
// lib/cookies.ts
import type { CookieOptions } from "hono/utils/cookie";

const SESSION_COOKIE_NAME = "__Host-session";
const CSRF_COOKIE_NAME = "__Host-csrf";

// Production cookie settings
export function getSessionCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true, // Prevents XSS access
    secure: isProduction, // HTTPS only in production
    sameSite: "Lax", // CSRF protection + allows navigation
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    // __Host- prefix enforces: Secure, no Domain, Path=/
  };
}

export function getCSRFCookieOptions(): CookieOptions {
  return {
    httpOnly: false, // JavaScript needs to read for header
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict", // Strictest CSRF protection
    path: "/",
  };
}

// Hono middleware for session cookie
export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
}
```

#### Pattern 3C: Session Middleware

```typescript
// middleware/session.ts
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";

import { validateSession } from "@/lib/sessions";

import type { Session, User } from "@/types";

type SessionVariables = {
  session: Session | null;
  user: User | null;
};

const SESSION_COOKIE_NAME = "__Host-session";

export const sessionMiddleware = createMiddleware<{
  Variables: SessionVariables;
}>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);

  if (!token) {
    c.set("session", null);
    c.set("user", null);
    return next();
  }

  const session = await validateSession(token);

  c.set("session", session);
  c.set("user", session?.user ?? null);

  await next();
});

// Require authentication middleware
export const requireAuth = createMiddleware<{
  Variables: SessionVariables;
}>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json(
      { error: "unauthorized", message: "Authentication required" },
      401
    );
  }

  await next();
});
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Session ID in URL
app.get("/dashboard?sessionId=abc123"); // BAD: Logged, cached, shared

// ANTI-PATTERN 2: Predictable session tokens
const sessionId = `user_${userId}_${Date.now()}`; // BAD: Guessable

// ANTI-PATTERN 3: No HttpOnly flag
setCookie(c, "session", token, { httpOnly: false }); // BAD: XSS can steal

// ANTI-PATTERN 4: SameSite=None without Secure
setCookie(c, "session", token, {
  sameSite: "None",
  secure: false, // BAD: Browser will reject or enable CSRF
});

// ANTI-PATTERN 5: No session expiry
await db.insert(sessions).values({
  token,
  userId,
  // Missing expiresAt - sessions live forever
});

// ANTI-PATTERN 6: Not revoking sessions on password change
async function changePassword(userId: string, newPassword: string) {
  await updatePassword(userId, newPassword);
  // BAD: Old sessions still valid - attacker maintains access
}
```

### When to Use vs When NOT to Use

| Use Session-Based Auth When | Do NOT Use When |
|-----------------------------|-----------------|
| Server-rendered applications | Stateless microservices |
| Need instant session revocation | Can tolerate token expiry delay |
| Single server or shared session store | No shared state available |
| Traditional web applications | Mobile apps or SPAs primarily |
| Compliance requires session tracking | Cross-domain authentication needed |

---

## 4. RBAC/ABAC Patterns

### Core Patterns

#### Pattern 4A: Role-Based Access Control (RBAC)

```typescript
// types/rbac.ts
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  // User management
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",

  // Content management
  CONTENT_READ: "content:read",
  CONTENT_WRITE: "content:write",
  CONTENT_PUBLISH: "content:publish",
  CONTENT_DELETE: "content:delete",

  // Settings
  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role-to-permission mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS), // All permissions
  [ROLES.MANAGER]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_WRITE,
    PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.SETTINGS_READ,
  ],
  [ROLES.MEMBER]: [
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_WRITE,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.CONTENT_READ,
  ],
};

// lib/rbac.ts
export function hasPermission(
  userRoles: Role[],
  requiredPermission: Permission
): boolean {
  return userRoles.some((role) =>
    ROLE_PERMISSIONS[role]?.includes(requiredPermission)
  );
}

export function hasAnyPermission(
  userRoles: Role[],
  permissions: Permission[]
): boolean {
  return permissions.some((p) => hasPermission(userRoles, p));
}

export function hasAllPermissions(
  userRoles: Role[],
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(userRoles, p));
}
```

#### Pattern 4B: Permission Middleware

```typescript
// middleware/authorize.ts
import { createMiddleware } from "hono/factory";

import { hasPermission, hasAllPermissions } from "@/lib/rbac";

import type { Permission } from "@/types/rbac";

const HTTP_STATUS_FORBIDDEN = 403;

export function requirePermission(permission: Permission) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "unauthorized" }, 401);
    }

    if (!hasPermission(user.roles, permission)) {
      return c.json(
        {
          error: "forbidden",
          message: `Missing required permission: ${permission}`,
        },
        HTTP_STATUS_FORBIDDEN
      );
    }

    await next();
  });
}

export function requirePermissions(...permissions: Permission[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "unauthorized" }, 401);
    }

    if (!hasAllPermissions(user.roles, permissions)) {
      return c.json(
        {
          error: "forbidden",
          message: "Insufficient permissions",
        },
        HTTP_STATUS_FORBIDDEN
      );
    }

    await next();
  });
}

// Usage
app.delete(
  "/api/users/:id",
  requirePermission(PERMISSIONS.USERS_DELETE),
  deleteUserHandler
);
```

#### Pattern 4C: Attribute-Based Access Control (ABAC)

```typescript
// types/abac.ts
interface PolicyContext {
  user: {
    id: string;
    roles: string[];
    department: string;
    clearanceLevel: number;
  };
  resource: {
    id: string;
    type: string;
    ownerId: string;
    classification: string;
    department: string;
  };
  action: string;
  environment: {
    ipAddress: string;
    time: Date;
    isWorkHours: boolean;
  };
}

type PolicyRule = (context: PolicyContext) => boolean;

// lib/abac.ts
const WORK_HOURS_START = 9;
const WORK_HOURS_END = 18;
const MIN_CLEARANCE_FOR_CONFIDENTIAL = 3;

export const policies: Record<string, PolicyRule[]> = {
  "document:read": [
    // Owner can always read their documents
    (ctx) => ctx.resource.ownerId === ctx.user.id,

    // Same department can read
    (ctx) => ctx.resource.department === ctx.user.department,

    // Admins can read anything
    (ctx) => ctx.user.roles.includes("admin"),
  ],

  "document:write": [
    // Only owner can write
    (ctx) => ctx.resource.ownerId === ctx.user.id,

    // Must be during work hours for non-admins
    (ctx) =>
      ctx.user.roles.includes("admin") || ctx.environment.isWorkHours,
  ],

  "confidential:read": [
    // Requires minimum clearance level
    (ctx) => ctx.user.clearanceLevel >= MIN_CLEARANCE_FOR_CONFIDENTIAL,

    // Must be on company network (example IP check)
    (ctx) => ctx.environment.ipAddress.startsWith("10.0."),

    // Work hours only
    (ctx) => ctx.environment.isWorkHours,
  ],
};

export function evaluatePolicy(
  action: string,
  context: Omit<PolicyContext, "action">
): boolean {
  const rules = policies[action];

  if (!rules || rules.length === 0) {
    return false; // Deny by default
  }

  // Any rule passing grants access (OR logic)
  return rules.some((rule) => rule({ ...context, action }));
}

// Alternative: All rules must pass (AND logic)
export function evaluatePolicyStrict(
  action: string,
  context: Omit<PolicyContext, "action">
): boolean {
  const rules = policies[action];

  if (!rules || rules.length === 0) {
    return false;
  }

  return rules.every((rule) => rule({ ...context, action }));
}
```

#### Pattern 4D: Resource-Level Authorization

```typescript
// lib/resource-auth.ts
interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}

export async function canAccessResource(
  userId: string,
  resourceId: string,
  action: "read" | "write" | "delete"
): Promise<AuthorizationResult> {
  const [user, resource] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.resources.findFirst({ where: eq(resources.id, resourceId) }),
  ]);

  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  if (!resource) {
    return { allowed: false, reason: "Resource not found" };
  }

  // Check ownership
  if (resource.ownerId === userId) {
    return { allowed: true };
  }

  // Check organization membership
  if (resource.organizationId) {
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, resource.organizationId)
      ),
    });

    if (membership) {
      // Check role permissions within organization
      const orgRole = membership.role;
      if (canOrgRolePerformAction(orgRole, action)) {
        return { allowed: true };
      }
    }
  }

  // Check explicit sharing
  const share = await db.query.shares.findFirst({
    where: and(
      eq(shares.resourceId, resourceId),
      eq(shares.userId, userId),
      gte(shares.permission, actionToPermissionLevel(action))
    ),
  });

  if (share) {
    return { allowed: true };
  }

  return { allowed: false, reason: "Access denied" };
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Hardcoded role checks everywhere
if (user.role === "admin" || user.role === "manager") {
  // BAD: Scattered role logic, hard to maintain
}

// ANTI-PATTERN 2: Client-side only authorization
// React component
if (user.isAdmin) {
  return <AdminPanel />; // BAD: Must also check server-side
}

// ANTI-PATTERN 3: No default deny
function checkAccess(role: string, action: string): boolean {
  if (role === "admin") return true;
  // BAD: Returns undefined (falsy) for unknown cases
  // Should explicitly return false
}

// ANTI-PATTERN 4: Mutable role definitions
const rolePermissions = {
  admin: ["read", "write"],
};
rolePermissions.admin.push("delete"); // BAD: Runtime mutation

// ANTI-PATTERN 5: Not checking resource ownership
app.delete("/api/posts/:id", async (c) => {
  const postId = c.req.param("id");
  await db.delete(posts).where(eq(posts.id, postId)); // BAD: No ownership check
});
```

### When to Use vs When NOT to Use

| Use RBAC When | Use ABAC When |
|---------------|---------------|
| Simple permission model | Complex, dynamic rules needed |
| Roles map cleanly to permissions | Context-dependent access |
| Small number of roles (<10) | Many attributes affect decisions |
| Static organizational structure | Policies change frequently |

---

## 5. Multi-Factor Authentication

### Core Patterns

#### Pattern 5A: TOTP (Time-based One-Time Password)

```typescript
// lib/totp.ts
import { createHmac, randomBytes } from "crypto";

const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1; // Allow 1 period before/after for clock drift
const SECRET_LENGTH = 20;

export function generateTOTPSecret(): string {
  return randomBytes(SECRET_LENGTH).toString("base32");
}

export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });

  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    email
  )}?${params.toString()}`;
}

export function verifyTOTP(
  token: string,
  secret: string,
  window: number = TOTP_WINDOW
): boolean {
  const currentTime = Math.floor(Date.now() / 1000);

  for (let i = -window; i <= window; i++) {
    const timeStep = Math.floor(currentTime / TOTP_PERIOD_SECONDS) + i;
    const expectedToken = generateTOTPToken(secret, timeStep);

    if (timingSafeEqual(token, expectedToken)) {
      return true;
    }
  }

  return false;
}

function generateTOTPToken(secret: string, timeStep: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = createHmac("sha1", Buffer.from(secret, "base32"));
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

// Timing-safe comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

#### Pattern 5B: Backup Codes

```typescript
// lib/backup-codes.ts
import { randomBytes, createHash } from "crypto";

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

interface BackupCode {
  code: string;
  hash: string;
}

export function generateBackupCodes(): BackupCode[] {
  const codes: BackupCode[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = randomBytes(BACKUP_CODE_LENGTH / 2)
      .toString("hex")
      .toUpperCase();

    // Format as XXXX-XXXX for readability
    const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;
    const hash = hashBackupCode(formattedCode);

    codes.push({ code: formattedCode, hash });
  }

  return codes;
}

function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.replace("-", "")).digest("hex");
}

export async function verifyAndConsumeBackupCode(
  userId: string,
  code: string
): Promise<boolean> {
  const hash = hashBackupCode(code);

  const backupCode = await db.query.backupCodes.findFirst({
    where: and(
      eq(backupCodes.userId, userId),
      eq(backupCodes.hash, hash),
      eq(backupCodes.used, false)
    ),
  });

  if (!backupCode) return false;

  // Mark as used (one-time use)
  await db
    .update(backupCodes)
    .set({ used: true, usedAt: new Date() })
    .where(eq(backupCodes.id, backupCode.id));

  return true;
}
```

#### Pattern 5C: MFA Enrollment Flow

```typescript
// routes/mfa.ts
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import { generateTOTPSecret, generateTOTPUri, verifyTOTP } from "@/lib/totp";
import { generateBackupCodes } from "@/lib/backup-codes";

const app = new OpenAPIHono();

// Step 1: Initiate MFA enrollment
app.openapi(
  createRoute({
    method: "post",
    path: "/mfa/enroll",
    operationId: "initiateMFAEnrollment",
    tags: ["MFA"],
    responses: {
      200: {
        description: "MFA enrollment initiated",
        content: {
          "application/json": {
            schema: z.object({
              totpUri: z.string(),
              secret: z.string(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const secret = generateTOTPSecret();

    // Store pending secret (not yet verified)
    await db
      .update(users)
      .set({ pendingTotpSecret: secret })
      .where(eq(users.id, user.id));

    const totpUri = generateTOTPUri(
      secret,
      user.email,
      process.env.APP_NAME!
    );

    return c.json({ totpUri, secret });
  }
);

// Step 2: Verify and complete enrollment
app.openapi(
  createRoute({
    method: "post",
    path: "/mfa/verify-enrollment",
    operationId: "verifyMFAEnrollment",
    tags: ["MFA"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              code: z.string().length(6),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "MFA enrolled successfully",
        content: {
          "application/json": {
            schema: z.object({
              backupCodes: z.array(z.string()),
            }),
          },
        },
      },
      400: { description: "Invalid code" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { code } = c.req.valid("json");

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!dbUser?.pendingTotpSecret) {
      return c.json({ error: "No pending enrollment" }, 400);
    }

    if (!verifyTOTP(code, dbUser.pendingTotpSecret)) {
      return c.json({ error: "Invalid code" }, 400);
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Activate MFA
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          totpSecret: dbUser.pendingTotpSecret,
          pendingTotpSecret: null,
          mfaEnabled: true,
        })
        .where(eq(users.id, user.id));

      // Store hashed backup codes
      await tx.insert(backupCodesTable).values(
        backupCodes.map((bc) => ({
          userId: user.id,
          hash: bc.hash,
          used: false,
        }))
      );
    });

    // Return plaintext codes (only time user sees them)
    return c.json({
      backupCodes: backupCodes.map((bc) => bc.code),
    });
  }
);
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Storing backup codes in plaintext
await db.insert(backupCodes).values({
  code: "1234-5678", // BAD: Store hash, not plaintext
});

// ANTI-PATTERN 2: No rate limiting on MFA verification
app.post("/verify-mfa", async (c) => {
  // BAD: Allows brute force (10^6 attempts for 6-digit code)
  const isValid = verifyTOTP(code, secret);
});

// ANTI-PATTERN 3: Reusable backup codes
if (backupCode.matches(code)) {
  return { success: true }; // BAD: Should mark as used
}

// ANTI-PATTERN 4: No time window for TOTP
function verifyTOTP(token: string, secret: string): boolean {
  const expected = generateToken(secret, getCurrentTimeStep());
  return token === expected; // BAD: No window for clock drift
}

// ANTI-PATTERN 5: SMS as only MFA option
// SMS is vulnerable to SIM swapping - always offer TOTP alternative
```

### When to Use vs When NOT to Use

| MFA Method | Use When | Avoid When |
|------------|----------|------------|
| TOTP | Default recommendation | Users lack smartphones |
| SMS | Secondary option only | High-security contexts |
| Email codes | Low-security apps | Email could be compromised |
| Hardware keys | High-security, enterprise | Consumer apps (friction) |
| Passkeys | Modern, passwordless | Legacy browser support needed |

---

## 6. Social Login Integration

### Core Patterns

#### Pattern 6A: Provider Configuration

```typescript
// config/oauth-providers.ts
export interface OAuthProviderConfig {
  id: string;
  name: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUri?: string;
  scopes: string[];
  clientId: string;
  // clientSecret from environment only
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  github: {
    id: "github",
    name: "GitHub",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    userInfoEndpoint: "https://api.github.com/user",
    scopes: ["read:user", "user:email"],
    clientId: process.env.GITHUB_CLIENT_ID!,
  },
  google: {
    id: "google",
    name: "Google",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    userInfoEndpoint: "https://www.googleapis.com/oauth2/v3/userinfo",
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    scopes: ["openid", "email", "profile"],
    clientId: process.env.GOOGLE_CLIENT_ID!,
  },
  discord: {
    id: "discord",
    name: "Discord",
    authorizationEndpoint: "https://discord.com/api/oauth2/authorize",
    tokenEndpoint: "https://discord.com/api/oauth2/token",
    userInfoEndpoint: "https://discord.com/api/users/@me",
    scopes: ["identify", "email"],
    clientId: process.env.DISCORD_CLIENT_ID!,
  },
};

export function getProviderConfig(
  providerId: string
): OAuthProviderConfig | null {
  return OAUTH_PROVIDERS[providerId] ?? null;
}
```

#### Pattern 6B: Account Linking

```typescript
// lib/account-linking.ts
interface OAuthUserInfo {
  providerId: string;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
}

export async function handleOAuthCallback(
  userInfo: OAuthUserInfo
): Promise<{ user: User; isNewUser: boolean }> {
  // Check for existing linked account
  const existingAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.provider, userInfo.providerId),
      eq(accounts.providerUserId, userInfo.providerUserId)
    ),
    with: { user: true },
  });

  if (existingAccount) {
    // Update user info from provider
    await db
      .update(users)
      .set({
        name: userInfo.name ?? existingAccount.user.name,
        avatarUrl: userInfo.avatarUrl ?? existingAccount.user.avatarUrl,
      })
      .where(eq(users.id, existingAccount.userId));

    return { user: existingAccount.user, isNewUser: false };
  }

  // Check for existing user with same email
  if (userInfo.emailVerified) {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, userInfo.email),
    });

    if (existingUser) {
      // Link account to existing user
      await db.insert(accounts).values({
        userId: existingUser.id,
        provider: userInfo.providerId,
        providerUserId: userInfo.providerUserId,
      });

      return { user: existingUser, isNewUser: false };
    }
  }

  // Create new user and account
  const newUser = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: userInfo.email,
        emailVerified: userInfo.emailVerified,
        name: userInfo.name,
        avatarUrl: userInfo.avatarUrl,
      })
      .returning();

    await tx.insert(accounts).values({
      userId: user.id,
      provider: userInfo.providerId,
      providerUserId: userInfo.providerUserId,
    });

    return user;
  });

  return { user: newUser, isNewUser: true };
}
```

#### Pattern 6C: Fetching User Info

```typescript
// lib/oauth/user-info.ts
interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export async function getGitHubUserInfo(
  accessToken: string
): Promise<OAuthUserInfo> {
  const [userResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }),
  ]);

  const user: GitHubUser = await userResponse.json();
  const emails: GitHubEmail[] = await emailsResponse.json();

  // Get primary verified email
  const primaryEmail = emails.find((e) => e.primary && e.verified);

  if (!primaryEmail) {
    throw new Error("No verified primary email found");
  }

  return {
    providerId: "github",
    providerUserId: String(user.id),
    email: primaryEmail.email,
    emailVerified: true,
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url,
  };
}

export async function getGoogleUserInfo(
  accessToken: string
): Promise<OAuthUserInfo> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  return {
    providerId: "google",
    providerUserId: data.sub,
    email: data.email,
    emailVerified: data.email_verified ?? false,
    name: data.name,
    avatarUrl: data.picture,
  };
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Trusting unverified emails
const userInfo = await getGoogleUserInfo(accessToken);
await createUser({ email: userInfo.email }); // BAD: Should check emailVerified

// ANTI-PATTERN 2: No PKCE for public clients
const authUrl = `${provider.authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}`;
// BAD: Missing code_challenge for SPAs

// ANTI-PATTERN 3: Storing access tokens unnecessarily
await db.insert(accounts).values({
  userId,
  provider: "github",
  accessToken, // BAD: Usually not needed after initial auth
});

// ANTI-PATTERN 4: No email conflict handling
const existingUser = await findUserByEmail(email);
if (existingUser) {
  throw new Error("Email already exists"); // BAD: Should offer account linking
}

// ANTI-PATTERN 5: Same redirect URI for all providers
const REDIRECT_URI = "/api/auth/callback"; // BAD: Use provider-specific URIs
```

### When to Use vs When NOT to Use

| Use Social Login When | Do NOT Use When |
|-----------------------|-----------------|
| Consumer applications | Enterprise with existing IdP |
| Reducing signup friction | Compliance requires password |
| Users already have accounts | Internal tools only |
| Mobile apps (native SDKs available) | Offline-only applications |

---

## 7. Password Handling

### Core Patterns

#### Pattern 7A: Password Hashing with Argon2

```typescript
// lib/password.ts
import { hash, verify } from "@node-rs/argon2";

// Argon2id parameters (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 parallel threads
  hashLength: 32, // 32 bytes output
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await verify(hash, password);
  } catch {
    return false;
  }
}
```

#### Pattern 7B: Password Validation

```typescript
// lib/password-validation.ts
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }

  // Check for common patterns (optional, can be annoying)
  if (/^[a-z]+$/i.test(password)) {
    errors.push("Password should not be only letters");
  }

  if (/^[0-9]+$/.test(password)) {
    errors.push("Password should not be only numbers");
  }

  // Check against common passwords (use a proper list in production)
  const commonPasswords = ["password123", "qwerty123456", "admin123456"];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push("Password is too common");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Zod schema for API validation
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Minimum ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Maximum ${MAX_PASSWORD_LENGTH} characters`);
```

#### Pattern 7C: Password Reset Flow

```typescript
// lib/password-reset.ts
import { randomBytes } from "crypto";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const RESET_TOKEN_EXPIRY_HOURS = 1;
const RESET_TOKEN_LENGTH = 32;

export async function initiatePasswordReset(email: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  // Always respond with success to prevent email enumeration
  if (!user) {
    return;
  }

  // Invalidate existing reset tokens
  await db
    .update(passwordResets)
    .set({ used: true })
    .where(eq(passwordResets.userId, user.id));

  // Generate new token
  const token = randomBytes(RESET_TOKEN_LENGTH).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + RESET_TOKEN_EXPIRY_HOURS);

  await db.insert(passwordResets).values({
    userId: user.id,
    token,
    expiresAt,
    used: false,
  });

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your password",
    html: `
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in ${RESET_TOKEN_EXPIRY_HOURS} hour(s).</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
}

export async function completePasswordReset(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const resetRecord = await db.query.passwordResets.findFirst({
    where: and(
      eq(passwordResets.token, token),
      eq(passwordResets.used, false),
      gt(passwordResets.expiresAt, new Date())
    ),
  });

  if (!resetRecord) {
    return { success: false, error: "Invalid or expired reset link" };
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.errors[0] };
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    // Update password
    await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, resetRecord.userId));

    // Mark token as used
    await tx
      .update(passwordResets)
      .set({ used: true })
      .where(eq(passwordResets.id, resetRecord.id));

    // Revoke all sessions (security measure)
    await tx
      .delete(sessions)
      .where(eq(sessions.userId, resetRecord.userId));
  });

  return { success: true };
}
```

#### Pattern 7D: Password Change (Authenticated)

```typescript
// routes/password.ts
app.openapi(
  createRoute({
    method: "post",
    path: "/account/change-password",
    operationId: "changePassword",
    tags: ["Account"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              currentPassword: z.string(),
              newPassword: passwordSchema,
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Password changed" },
      400: { description: "Invalid current password" },
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { currentPassword, newPassword } = c.req.valid("json");

    // Verify current password
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!dbUser?.passwordHash) {
      return c.json({ error: "No password set" }, 400);
    }

    const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isValid) {
      return c.json({ error: "Current password is incorrect" }, 400);
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return c.json({ error: validation.errors[0] }, 400);
    }

    // Check new password is different
    const isSamePassword = await verifyPassword(newPassword, dbUser.passwordHash);
    if (isSamePassword) {
      return c.json({ error: "New password must be different" }, 400);
    }

    const newHash = await hashPassword(newPassword);

    // Update password and revoke other sessions
    const currentSessionToken = getCookie(c, SESSION_COOKIE_NAME);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: newHash })
        .where(eq(users.id, user.id));

      // Revoke all other sessions
      await tx
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, user.id),
            ne(sessions.token, currentSessionToken!)
          )
        );
    });

    return c.json({ success: true });
  }
);
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Using MD5 or SHA for passwords
import { createHash } from "crypto";
const hash = createHash("sha256").update(password).digest("hex"); // BAD

// ANTI-PATTERN 2: Fixed salt
const salt = "my-app-salt"; // BAD: Same salt for all users
const hash = bcrypt.hashSync(password + salt, 10);

// ANTI-PATTERN 3: Storing plaintext passwords
await db.insert(users).values({ password }); // NEVER

// ANTI-PATTERN 4: Confirming email existence
if (!user) {
  return c.json({ error: "User not found" }, 404); // BAD: Email enumeration
}

// ANTI-PATTERN 5: Not revoking sessions on password change
await updatePassword(userId, newPassword);
// BAD: Old sessions still valid

// ANTI-PATTERN 6: Weak password requirements
const MIN_PASSWORD_LENGTH = 4; // BAD: Too short
```

### When to Use vs When NOT to Use

| Use Password Auth When | Consider Alternatives When |
|------------------------|---------------------------|
| Users prefer passwords | Passwordless viable (magic links) |
| Offline access needed | Always online, social login works |
| Enterprise requirements | Consumer app, reduce friction |
| Compliance mandates | Modern apps with passkey support |

---

## 8. Protected Routes Patterns

### Core Patterns

#### Pattern 8A: React Router Protected Routes

```typescript
// components/protected-route.tsx
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    // Preserve intended destination
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requiredRoles && !requiredRoles.some((role) => user.roles.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

// Usage in routes
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRoles={["admin"]}>
            <AdminPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

#### Pattern 8B: Next.js Middleware Protection

```typescript
// middleware.ts
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/register", "/api/auth"];
const AUTH_PATHS = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path is public
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Get session from cookie
  const sessionToken = request.cookies.get("__Host-session")?.value;

  // Validate session (call your API or verify JWT)
  const session = sessionToken ? await validateSession(sessionToken) : null;

  // Redirect authenticated users away from auth pages
  if (session && AUTH_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users to login
  if (!session && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
```

#### Pattern 8C: Next.js App Router Server Components

```typescript
// app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { validateSession } from "@/lib/auth";

export default async function DashboardPage() {
  const sessionToken = cookies().get("__Host-session")?.value;

  if (!sessionToken) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const session = await validateSession(sessionToken);

  if (!session) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      {/* Dashboard content */}
    </div>
  );
}

// Reusable auth check
// lib/auth-check.ts
export async function requireAuth() {
  const sessionToken = cookies().get("__Host-session")?.value;

  if (!sessionToken) {
    redirect("/login");
  }

  const session = await validateSession(sessionToken);

  if (!session) {
    redirect("/login");
  }

  return session;
}

// Usage in any page
export default async function ProtectedPage() {
  const session = await requireAuth();
  // ... page content
}
```

#### Pattern 8D: Role-Based Route Guards

```typescript
// components/role-guard.tsx
import { useAuth } from "@/hooks/use-auth";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback = <UnauthorizedMessage />,
}: RoleGuardProps) {
  const { user } = useAuth();

  if (!user) {
    return null; // Or redirect
  }

  const hasRequiredRole = allowedRoles.some((role) =>
    user.roles.includes(role)
  );

  if (!hasRequiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage
function AdminSection() {
  return (
    <RoleGuard allowedRoles={["admin", "superadmin"]}>
      <AdminPanel />
    </RoleGuard>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Client-only protection
function AdminPage() {
  const { user } = useAuth();
  if (!user?.isAdmin) return <Redirect to="/" />;
  // BAD: API endpoints must also check authorization
  return <AdminPanel />;
}

// ANTI-PATTERN 2: Checking auth in every component
function SettingsPage() {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  // BAD: Duplicated logic, use route guards
}

// ANTI-PATTERN 3: No loading state
function ProtectedRoute({ children }) {
  const { user } = useAuth(); // isLoading ignored
  if (!user) return <Navigate to="/login" />; // Flash of redirect
  return children;
}

// ANTI-PATTERN 4: Exposing protected routes in bundle
// All routes visible in client bundle regardless of auth
// Consider code splitting for admin routes
```

### When to Use vs When NOT to Use

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| Middleware (Next.js) | Need edge protection, SSR | Client-only SPA |
| Route guards (React Router) | SPA, client-side routing | Need SSR protection |
| Server Components | Next.js App Router | Pages Router |
| API route checks | Always | Never skip server-side |

---

## 9. Auth State Management

### Core Patterns

#### Pattern 9A: React Context for Auth State

```typescript
// context/auth-context.tsx
import { createContext, useContext, useEffect, useState } from "react";

import type { User, Session } from "@/types";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setState({
          user: data.user,
          session: data.session,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch {
      setState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }

  async function signIn(email: string, password: string) {
    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    await checkSession();
  }

  async function signOut() {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
    });

    setState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
        refreshSession: checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

#### Pattern 9B: Zustand Auth Store

```typescript
// stores/auth-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      signOut: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: "auth-storage",
      // Only persist non-sensitive data
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Hook for session sync
export function useSessionSync() {
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    async function syncSession() {
      setLoading(true);
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });

        if (response.ok) {
          const { user } = await response.json();
          setUser(user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    }

    syncSession();
  }, [setUser, setLoading]);
}
```

#### Pattern 9C: React Query for Auth State

```typescript
// hooks/use-session.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const SESSION_QUERY_KEY = ["session"];
const SESSION_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes

async function fetchSession() {
  const response = await fetch("/api/auth/session", {
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: SESSION_STALE_TIME_MS,
    retry: false,
  });
}

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      queryClient.clear(); // Clear all cached data on logout
    },
  });
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Storing tokens in state
const [accessToken, setAccessToken] = useState<string>(); // BAD: XSS vulnerable

// ANTI-PATTERN 2: No loading state handling
function App() {
  const { user } = useAuth(); // isLoading not checked
  // Flash of unauthenticated content
  return user ? <Dashboard /> : <Login />;
}

// ANTI-PATTERN 3: Prop drilling auth state
function App() {
  const [user, setUser] = useState();
  return <Parent user={user} setUser={setUser} />; // BAD: Use context
}

// ANTI-PATTERN 4: Not clearing state on logout
function signOut() {
  await fetch("/api/auth/sign-out");
  setUser(null);
  // BAD: React Query cache still has user data
}

// ANTI-PATTERN 5: Storing sensitive data in localStorage
localStorage.setItem("user", JSON.stringify(user)); // BAD: XSS accessible
```

### When to Use vs When NOT to Use

| Approach | Use When | Avoid When |
|----------|----------|------------|
| React Context | Simple apps, few consumers | Performance-critical updates |
| Zustand | Medium complexity, need persistence | Simple auth only |
| React Query | Already using RQ, need caching | Simple apps |
| Redux | Large app already using Redux | New apps (overkill) |

---

## 10. Security Considerations

### Core Patterns

#### Pattern 10A: CSRF Protection

```typescript
// lib/csrf.ts
import { randomBytes } from "crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = "__Host-csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";

export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

// Middleware to set CSRF token
export const csrfMiddleware = createMiddleware(async (c, next) => {
  // Only for state-changing methods
  const method = c.req.method;
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  // Get or generate token
  let token = getCookie(c, CSRF_COOKIE_NAME);

  if (!token) {
    token = generateCSRFToken();
    setCookie(c, CSRF_COOKIE_NAME, token, {
      httpOnly: false, // JavaScript needs to read
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      path: "/",
    });
  }

  // Validate on state-changing requests
  if (isStateChanging) {
    const headerToken = c.req.header(CSRF_HEADER_NAME);

    if (!headerToken || headerToken !== token) {
      return c.json({ error: "Invalid CSRF token" }, 403);
    }
  }

  await next();
});

// Client-side: Include token in requests
async function apiRequest(url: string, options: RequestInit = {}) {
  const csrfToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("__Host-csrf="))
    ?.split("=")[1];

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "X-CSRF-Token": csrfToken || "",
    },
    credentials: "include",
  });
}
```

#### Pattern 10B: XSS Prevention

```typescript
// lib/sanitize.ts
import DOMPurify from "dompurify";

// Server-side: Sanitize HTML before storage
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "title"],
    ALLOW_DATA_ATTR: false,
  });
}

// Client-side: Safe rendering component
interface SafeHTMLProps {
  html: string;
  className?: string;
}

export function SafeHTML({ html, className }: SafeHTMLProps) {
  const sanitized = useMemo(() => DOMPurify.sanitize(html), [html]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

// Content Security Policy configuration
export const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'strict-dynamic'"],
  "style-src": ["'self'", "'unsafe-inline'"], // For CSS-in-JS
  "img-src": ["'self'", "data:", "https:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'", process.env.API_URL],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "base-uri": ["'self'"],
  "upgrade-insecure-requests": [],
};

export function buildCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}
```

#### Pattern 10C: Rate Limiting

```typescript
// middleware/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Different limiters for different endpoints
const limiters = {
  // Auth endpoints: strict limits
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 per minute
    analytics: true,
  }),

  // API endpoints: moderate limits
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 per minute
    analytics: true,
  }),

  // Password reset: very strict
  passwordReset: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"), // 3 per hour
    analytics: true,
  }),
};

export function createRateLimiter(type: keyof typeof limiters) {
  return createMiddleware(async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const identifier = `${type}:${ip}`;

    const { success, limit, reset, remaining } = await limiters[type].limit(
      identifier
    );

    // Set rate limit headers
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(reset));

    if (!success) {
      return c.json(
        {
          error: "too_many_requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        429
      );
    }

    await next();
  });
}

// Usage
app.post("/api/auth/sign-in", createRateLimiter("auth"), signInHandler);
app.post(
  "/api/auth/forgot-password",
  createRateLimiter("passwordReset"),
  forgotPasswordHandler
);
```

#### Pattern 10D: Security Headers

```typescript
// middleware/security-headers.ts
export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  await next();

  // Prevent clickjacking
  c.header("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  c.header("X-Content-Type-Options", "nosniff");

  // Enable XSS filter (legacy browsers)
  c.header("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === "production") {
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Content Security Policy
  c.header("Content-Security-Policy", buildCSPHeader());
});
```

#### Pattern 10E: Secure Session Handling

```typescript
// lib/secure-session.ts
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true, // Prevent XSS access
  secure: process.env.NODE_ENV === "production", // HTTPS only
  sameSite: "lax" as const, // CSRF protection
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

// Regenerate session ID after privilege escalation
export async function regenerateSession(
  c: Context,
  userId: string
): Promise<string> {
  const oldToken = getCookie(c, SESSION_COOKIE_NAME);

  // Delete old session
  if (oldToken) {
    await db.delete(sessions).where(eq(sessions.token, oldToken));
  }

  // Create new session
  const newToken = await createSession(userId, {
    userAgent: c.req.header("user-agent"),
    ipAddress: c.req.header("x-forwarded-for"),
  });

  setCookie(c, SESSION_COOKIE_NAME, newToken, SESSION_COOKIE_OPTIONS);

  return newToken;
}

// Clear sensitive data from responses
export function sanitizeUserForClient(user: DbUser): ClientUser {
  const { passwordHash, totpSecret, ...safeUser } = user;
  return safeUser;
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: No CSRF protection
app.post("/api/transfer", async (c) => {
  // BAD: Any site can submit this form
  const { amount, to } = await c.req.json();
  await transferMoney(amount, to);
});

// ANTI-PATTERN 2: Trusting client-side validation
if (formData.email.includes("@")) {
  // BAD: Always validate server-side
  await createUser(formData);
}

// ANTI-PATTERN 3: Exposing stack traces
app.onError((err, c) => {
  return c.json({ error: err.stack }); // BAD: Information disclosure
});

// ANTI-PATTERN 4: No rate limiting on auth
app.post("/api/auth/sign-in", signInHandler); // BAD: Brute force possible

// ANTI-PATTERN 5: Logging sensitive data
console.log("Login attempt:", { email, password }); // NEVER log passwords

// ANTI-PATTERN 6: Using eval or Function constructor
const result = eval(userInput); // NEVER
```

### Security Checklist

| Category | Requirement | Priority |
|----------|-------------|----------|
| Transport | HTTPS only in production | Critical |
| Cookies | HttpOnly, Secure, SameSite | Critical |
| Passwords | Argon2/bcrypt, min 12 chars | Critical |
| Tokens | Cryptographically random | Critical |
| Sessions | Regenerate after auth | High |
| CSRF | Token or SameSite=Strict | High |
| XSS | CSP headers, sanitize input | High |
| Rate limiting | On auth endpoints | High |
| Headers | Security headers configured | Medium |
| Logging | No sensitive data logged | Medium |
| Errors | Generic messages to client | Medium |

---

## Summary: When to Use Each Pattern

| Pattern | Best For | Avoid When |
|---------|----------|------------|
| JWT | Stateless, microservices, mobile | Need instant revocation |
| OAuth/OIDC | Third-party login, SSO | Internal-only apps |
| Sessions | Traditional web apps | Stateless required |
| RBAC | Simple role hierarchies | Complex, dynamic rules |
| ABAC | Context-dependent access | Simple permissions |
| TOTP | Default MFA choice | Users lack smartphones |
| Social Login | Consumer apps | Enterprise with IdP |
| Password | When required | Passwordless viable |

---

## Sources

- OWASP Authentication Cheat Sheet
- OWASP Session Management Cheat Sheet
- RFC 7519 (JWT)
- RFC 6749 (OAuth 2.0)
- RFC 7636 (PKCE)
- OpenID Connect Core 1.0
- NIST SP 800-63B (Digital Identity Guidelines)
- Better Auth Documentation
- Auth.js Documentation
- Argon2 Specification

---

_Last Updated: 2026-01-15_
