# Resend Setup - Core Examples

> Essential patterns for Resend client setup, email templates, and preview server.

---

## Resend Client Singleton

```typescript
// packages/emails/src/client.ts
import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }

    resendClient = new Resend(apiKey);
  }

  return resendClient;
}
```

**Why good:** Singleton prevents multiple client instances, throws clear error if API key missing, lazy initialization

---

## Environment Variables

```bash
# .env.local

# Required
RESEND_API_KEY=re_your_api_key_here

# Email "from" address (must be verified domain or onboarding@resend.dev for testing)
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME="Your App"

# Optional: webhook signing secret
RESEND_WEBHOOK_SECRET=whsec_your_secret_here
```

---

## Base Layout Component

```typescript
// packages/emails/src/layouts/base-layout.tsx
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
} from "@react-email/components";

const CONTAINER_MAX_WIDTH = 600;

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container
            className="mx-auto my-10 bg-white rounded-lg"
            style={{ maxWidth: CONTAINER_MAX_WIDTH }}
          >
            <Section className="px-8 py-6">{children}</Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

**Why good:** Tailwind wrapper enables utility classes, consistent structure across all emails, preview text for inbox snippets

---

## Email Template with PreviewProps

```typescript
// packages/emails/src/templates/verification-email.tsx
import { Button, Heading, Text } from "@react-email/components";

import { BaseLayout } from "../layouts/base-layout";

const CTA_PADDING_X = 20;
const CTA_PADDING_Y = 12;
const LINK_EXPIRY_HOURS = 24;

interface VerificationEmailProps {
  userName: string;
  verificationUrl: string;
}

export function VerificationEmail({
  userName,
  verificationUrl,
}: VerificationEmailProps) {
  return (
    <BaseLayout preview="Verify your email address">
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Verify your email address
      </Heading>

      <Text className="text-gray-600 mb-4">Hi {userName},</Text>

      <Text className="text-gray-600 mb-6">
        Please verify your email address by clicking the button below.
      </Text>

      <Button
        href={verificationUrl}
        className="bg-blue-600 text-white font-semibold rounded-md"
        style={{
          paddingLeft: CTA_PADDING_X,
          paddingRight: CTA_PADDING_X,
          paddingTop: CTA_PADDING_Y,
          paddingBottom: CTA_PADDING_Y,
        }}
      >
        Verify Email Address
      </Button>

      <Text className="text-sm text-gray-500 mt-6">
        This link expires in {LINK_EXPIRY_HOURS} hours.
      </Text>
    </BaseLayout>
  );
}

// PreviewProps for react-email dev server
VerificationEmail.PreviewProps = {
  userName: "John",
  verificationUrl: "https://example.com/verify?token=abc123",
};

export type { VerificationEmailProps };
```

**Why good:** Uses BaseLayout for consistency, named constants, PreviewProps for dev server preview, proper prop typing with exported type

---

## Package Exports

```typescript
// packages/emails/src/index.ts

// Client
export { getResendClient } from "./client";

// Templates
export { VerificationEmail } from "./templates/verification-email";
export { PasswordResetEmail } from "./templates/password-reset";
export { WelcomeEmail } from "./templates/welcome-email";

// Types
export type { VerificationEmailProps } from "./templates/verification-email";
export type { PasswordResetEmailProps } from "./templates/password-reset";
export type { WelcomeEmailProps } from "./templates/welcome-email";
```

---

## Sending with the `react` Prop

The primary pattern -- pass the component directly to `resend.emails.send()`.

```typescript
import { getResendClient, WelcomeEmail } from "./emails";

const resend = getResendClient();

const { data, error } = await resend.emails.send({
  from: "Your App <noreply@yourdomain.com>",
  to: ["user@example.com"],
  subject: "Welcome!",
  react: WelcomeEmail({ userName: "John" }),
});

if (error) {
  console.error("[Email] Send failed:", error.name, error.message);
  return { success: false, error: error.message };
}

return { success: true, id: data?.id };
```

**Why good:** No manual render step, SDK handles conversion, explicit error handling

---

## Manual Render (Non-Resend Senders Only)

Only use `render()` when you need an HTML string for a non-Resend email provider.

```typescript
// Import render from @react-email/render -- NOT from @react-email/components
import { render } from "@react-email/render";
import { WelcomeEmail } from "./templates/welcome-email";

const html = await render(WelcomeEmail({ userName: "John" }));

// Now use `html` with any email provider that accepts HTML strings
await someOtherEmailProvider.send({ html, to, from, subject });
```

**Gotcha:** `render()` is async -- always `await` it. Forgetting `await` sends `[object Promise]` as the email body.

---

## Preview Server Setup

```json
// packages/emails/package.json (scripts section)
{
  "scripts": {
    "dev": "email dev --port 3001",
    "export": "email export --outDir dist"
  }
}
```

Add a workspace-level script to run the preview server from the project root. The exact syntax depends on your package manager's workspace support.

Run the email dev script to start the preview server at `http://localhost:3001`. Templates with `PreviewProps` will render with sample data.

---

## Email Client Compatibility

| Property           | Gmail | Outlook | Apple Mail |
| ------------------ | ----- | ------- | ---------- |
| `background-color` | Yes   | Yes     | Yes        |
| `padding`          | Yes   | Yes     | Yes        |
| `border-radius`    | Yes   | No      | Yes        |
| `display: flex`    | No    | No      | Yes        |
| `display: grid`    | No    | No      | Yes        |
| `box-shadow`       | No    | No      | Yes        |

**Key rules:** Use tables for layout (React Email handles this). Use `px` units, not `rem`. Inline styles over classes (Tailwind wrapper converts automatically). Test in Gmail, Outlook, Apple Mail at minimum.
