# Better Auth - OAuth Examples

> OAuth provider patterns for GitHub, Google, and other social providers. See [SKILL.md](../SKILL.md) for core concepts.

**Additional Examples:**

- [core.md](core.md) - Sign up, sign in, client setup
- [two-factor.md](two-factor.md) - TOTP setup and verification
- [organizations.md](organizations.md) - Multi-tenancy and invitations
- [sessions.md](sessions.md) - Session configuration and revocation

---

## Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Always get refresh token (Google only issues on first consent)
      accessType: "offline",
      prompt: "consent",
    },
  },
});

export { auth };
```

**Why good:** Environment variables protect secrets, accessType: "offline" ensures refresh tokens from Google, prompt: "consent" forces token refresh

---

## Environment Variables

```bash
# .env.local
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Required for Better Auth
BETTER_AUTH_SECRET=your_32_character_random_string
BETTER_AUTH_URL=http://localhost:3000
```

---

## Client-Side OAuth Sign In

```typescript
// components/oauth-buttons.tsx
import { authClient } from "@/lib/auth-client";

export function OAuthButtons() {
  const handleGitHubSignIn = async () => {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    });
  };

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button onClick={handleGitHubSignIn} type="button">
        Continue with GitHub
      </button>
      <button onClick={handleGoogleSignIn} type="button">
        Continue with Google
      </button>
    </div>
  );
}

// Named export
export { OAuthButtons };
```

**Why good:** callbackURL handles post-auth redirect, social provider string is type-safe from Better Auth types

---

## Bad Example - Hardcoded Secrets

```typescript
// BAD Example - Hardcoded secrets
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  socialProviders: {
    github: {
      clientId: "abc123", // BAD: Hardcoded in source
      clientSecret: "secret456", // BAD: Commits to git
    },
  },
});
```

**Why bad:** Hardcoded secrets committed to version control, exposed in build logs, impossible to rotate without code change
