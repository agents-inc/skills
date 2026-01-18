# Email - Authentication Integration Examples

> Integrating email sending with auth system callbacks. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

---

## Pattern 1: Auth Email Functions

Connect email templates to authentication flows.

```typescript
// lib/email/auth-emails.ts
import { sendEmailWithRetry } from "@/lib/email/send-with-retry";
import { VerificationEmail, PasswordResetEmail } from "@repo/emails";

interface AuthUser {
  email: string;
  name?: string | null;
}

// Use these functions in your auth system's email callbacks
export async function sendVerificationEmail(user: AuthUser, verificationUrl: string) {
  const result = await sendEmailWithRetry({
    to: user.email,
    subject: "Verify your email address",
    react: VerificationEmail({
      userName: user.name ?? "there",
      verificationUrl,
    }),
  });

  if (!result.success) {
    console.error("[Auth] Failed to send verification email:", result.error);
  }

  return result;
}

export async function sendPasswordResetEmail(user: AuthUser, resetUrl: string) {
  const result = await sendEmailWithRetry({
    to: user.email,
    subject: "Reset your password",
    react: PasswordResetEmail({
      userName: user.name ?? "there",
      resetUrl,
    }),
  });

  if (!result.success) {
    console.error("[Auth] Failed to send password reset email:", result.error);
    // Don't throw - let auth system show generic error to user
  }

  return result;
}

// Named exports
export { sendVerificationEmail, sendPasswordResetEmail };
```

**Why good:** Uses retry wrapper for reliability, logs failures without throwing, extracts user name with fallback, decoupled from specific auth library

---

## Pattern 2: Better Auth Integration

Example integration with Better Auth email callbacks.

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email/auth-emails";

export const auth = betterAuth({
  // ... other config
  emailAndPassword: {
    enabled: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user, url);
    },
    sendResetPasswordEmail: async ({ user, url }) => {
      await sendPasswordResetEmail(user, url);
    },
  },
});
```

---

## Key Integration Points

**Works with:**
- Authentication systems: sendVerificationEmail and sendResetPassword callbacks
- API routes: Server-side email sending
- Analytics: Track email events via webhooks
- Databases: Store email preferences and events

**Security considerations:**
- Never expose email sending to unauthenticated routes
- Log failures for monitoring, but don't leak details to users
- Use retry logic for critical auth emails (verification, password reset)
