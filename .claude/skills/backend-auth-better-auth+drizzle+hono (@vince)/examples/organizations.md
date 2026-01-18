# Better Auth - Organization Multi-Tenancy Examples

> Organization and multi-tenancy patterns for team management. See [SKILL.md](../SKILL.md) for core concepts.

**Additional Examples:**
- [core.md](core.md) - Sign up, sign in, client setup
- [oauth.md](oauth.md) - GitHub, Google OAuth providers
- [two-factor.md](two-factor.md) - TOTP setup and verification
- [sessions.md](sessions.md) - Session configuration and revocation

---

## Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const ORG_LIMIT_PER_USER = 5;
const INVITATION_EXPIRY_SECONDS = 48 * 60 * 60; // 48 hours

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    organization({
      organizationLimit: ORG_LIMIT_PER_USER,
      invitationExpiresIn: INVITATION_EXPIRY_SECONDS,
      sendInvitationEmail: async ({ email, invitationId, organization }) => {
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?id=${invitationId}`;
        await sendEmail({
          to: email,
          subject: `Join ${organization.name}`,
          html: `<a href="${inviteUrl}">Accept invitation</a>`,
        });
      },
    }),
  ],
});

export { auth };
```

---

## Client Configuration

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [organizationClient()],
});

export { authClient };
```

---

## Create Organization

```typescript
// hooks/use-create-org.ts
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

interface CreateOrgData {
  name: string;
  slug: string;
}

export function useCreateOrg() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrg = async (data: CreateOrgData) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.organization.create({
        name: data.name,
        slug: data.slug,
      });

      if (result.error) {
        setError(result.error.message);
        return { success: false };
      }

      // Set as active organization
      await authClient.organization.setActive({
        organizationId: result.data.id,
      });

      return { success: true, organization: result.data };
    } catch (err) {
      setError("Failed to create organization");
      return { success: false };
    } finally {
      setIsPending(false);
    }
  };

  return { createOrg, isPending, error };
}

// Named export
export { useCreateOrg };
```

---

## Invite Members

```typescript
// hooks/use-invite-member.ts
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

type Role = "owner" | "admin" | "member";

interface InviteData {
  email: string;
  role: Role;
  organizationId: string;
}

export function useInviteMember() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteMember = async (data: InviteData) => {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.organization.inviteMember({
        email: data.email,
        role: data.role,
        organizationId: data.organizationId,
      });

      if (result.error) {
        setError(result.error.message);
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      setError("Failed to send invitation");
      return { success: false };
    } finally {
      setIsPending(false);
    }
  };

  return { inviteMember, isPending, error };
}

// Named export
export { useInviteMember };
```

**Why good:** organizationLimit prevents abuse, invitation emails customizable, setActive switches org context for session
