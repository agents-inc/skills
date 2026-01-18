# Resend Setup - Integration Examples

> Better Auth email callbacks and Next.js API route patterns.

[Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [templates.md](templates.md) | [deployment.md](deployment.md)

---

## Better Auth Integration

Configure Better Auth to use Resend for email verification and password reset.

### Auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { render } from "@react-email/components";

import { db } from "@/lib/db";
import {
  getResendClient,
  VerificationEmail,
  PasswordResetEmail,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

const PASSWORD_RESET_EXPIRY_SECONDS = 3600; // 1 hour

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const resend = getResendClient();
      const html = await render(
        PasswordResetEmail({
          userName: user.name ?? "there",
          resetUrl: url,
        })
      );

      await resend.emails.send({
        from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
        to: user.email,
        subject: "Reset your password",
        html,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const resend = getResendClient();
      const html = await render(
        VerificationEmail({
          userName: user.name ?? "there",
          verificationUrl: url,
        })
      );

      await resend.emails.send({
        from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
        to: user.email,
        subject: "Verify your email address",
        html,
      });
    },
  },
});

// Named export
export { auth };
```

**Why good:** Uses React Email templates with `render()`, imports from @repo/emails package, integrates cleanly with Better Auth callbacks

---

## Next.js API Route for Email

Create an API route for sending emails from your app.

```typescript
// app/api/email/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/components";

import { auth } from "@/lib/auth";
import {
  getResendClient,
  WelcomeEmail,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_UNAUTHORIZED }
    );
  }

  try {
    const resend = getResendClient();
    const html = await render(
      WelcomeEmail({
        userName: session.user.name ?? "there",
      })
    );

    const { data, error } = await resend.emails.send({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
      to: session.user.email,
      subject: "Welcome to Your App!",
      html,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: HTTP_STATUS_INTERNAL_ERROR }
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: HTTP_STATUS_INTERNAL_ERROR }
    );
  }
}
```

**Why good:** Session verification prevents abuse, error handling with proper status codes, returns email ID for tracking

---

## Related Examples

- For client setup and exports, see [core.md](core.md)
- For email templates and components, see [templates.md](templates.md)
- For deployment and preview server, see [deployment.md](deployment.md)
