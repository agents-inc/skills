# Better Auth - OAuth Examples

> OAuth provider patterns for social login, Generic OAuth, and OAuth Provider plugin. See [SKILL.md](../SKILL.md) for core concepts.

**Additional Examples:**

- [core.md](core.md) - Sign up, sign in, client setup, database adapter
- [two-factor.md](two-factor.md) - TOTP setup and verification
- [organizations.md](organizations.md) - Multi-tenancy and invitations
- [sessions.md](sessions.md) - Session configuration, cookie caching, stateless

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

---

## Generic OAuth Plugin

Use any OAuth 2.0 or OIDC provider with the Generic OAuth plugin. Supports discovery URL for auto-configuration.

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "custom-idp",
          discoveryUrl:
            "https://idp.example.com/.well-known/openid-configuration",
          clientId: process.env.CUSTOM_IDP_CLIENT_ID!,
          clientSecret: process.env.CUSTOM_IDP_CLIENT_SECRET!,
          scopes: ["openid", "email", "profile"],
          pkce: true,
          mapProfileToUser: (profile) => ({
            name: profile.name,
            email: profile.email,
            image: profile.picture,
          }),
        },
        // Pre-configured helpers: auth0(), keycloak(), okta(), microsoftEntraId(), slack()
      ],
    }),
  ],
});
```

Client-side usage with Generic OAuth:

```typescript
await authClient.signIn.oauth2({
  providerId: "custom-idp",
  callbackURL: "/dashboard",
});
```

**Why good:** Works with any OAuth2/OIDC provider, PKCE for enhanced security, pre-configured helpers for common providers

---

## OAuth Provider Plugin (Act as OAuth Server)

Use `oAuthProvider()` to let your app act as an OAuth 2.1 provider for other services. Replaces deprecated `oidcProvider`.

```typescript
import { oAuthProvider } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    oAuthProvider({
      clients: [
        {
          clientId: "first-party-app",
          clientSecret: process.env.FIRST_PARTY_SECRET!,
          redirectUris: ["https://app.example.com/callback"],
          skipConsent: true, // Trusted clients skip consent screen
        },
        {
          clientId: "third-party",
          clientSecret: process.env.THIRD_PARTY_SECRET!,
          redirectUris: ["https://partner.example.com/oauth/callback"],
          skipConsent: false,
        },
      ],
    }),
  ],
});
```

**Why good:** OAuth 2.1 compliant, trusted client support for first-party apps, consent screen control
