# Better Auth - Session Management Examples

> Session configuration and management patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Additional Examples:**
- [core.md](core.md) - Sign up, sign in, client setup
- [oauth.md](oauth.md) - GitHub, Google OAuth providers
- [two-factor.md](two-factor.md) - TOTP setup and verification
- [organizations.md](organizations.md) - Multi-tenancy and invitations

---

## Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24; // Refresh daily
const CACHE_MAX_AGE_SECONDS = 5 * 60; // 5 minutes
const FRESH_AGE_SECONDS = 60 * 5; // 5 minutes for sensitive operations

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
    freshAge: FRESH_AGE_SECONDS,
    // Cookie caching reduces database hits
    cookieCache: {
      enabled: true,
      maxAge: CACHE_MAX_AGE_SECONDS,
      strategy: "compact", // or "jwt" or "jwe"
    },
  },
});

export { auth };
```

**Why good:** cookieCache reduces DB queries (verify signature instead), freshAge requires recent auth for sensitive ops, named constants make policy auditable

---

## Revoke Sessions

```typescript
// hooks/use-sessions.ts
import { authClient } from "@/lib/auth-client";

export async function listSessions() {
  const result = await authClient.session.listSessions();
  return result.data ?? [];
}

export async function revokeSession(token: string) {
  await authClient.session.revokeSession({ token });
}

export async function revokeOtherSessions() {
  await authClient.session.revokeOtherSessions();
}

// Named exports
export { listSessions, revokeSession, revokeOtherSessions };
```

**Why good:** listSessions enables "active sessions" UI, revokeOtherSessions useful after password change
