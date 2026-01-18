# Email - Core Examples

> Essential email patterns - template structure and basic sending. See [SKILL.md](../SKILL.md) for core concepts.

**Extended Examples:**
- [templates.md](templates.md) - Password Reset, Notification Templates
- [retry.md](retry.md) - Retry Logic with Exponential Backoff
- [async-batch.md](async-batch.md) - Async Sending, Batch API
- [auth-integration.md](auth-integration.md) - Auth System Integration
- [webhooks.md](webhooks.md) - Webhook Handler for Tracking
- [preferences.md](preferences.md) - Unsubscribe, Email Preferences
- [testing.md](testing.md) - Template Testing Patterns

---

## Pattern 1: Email Template Structure

Create well-structured email templates with proper typing.

```typescript
// packages/emails/src/templates/welcome-email.tsx
import { Button, Heading, Link, Text } from "@react-email/components";

import { BaseLayout } from "../layouts/base-layout";

const CTA_PADDING_X = 24;
const CTA_PADDING_Y = 12;

// Always define props interface
interface WelcomeEmailProps {
  userName: string;
  loginUrl: string;
  features?: string[];
}

export function WelcomeEmail({
  userName,
  loginUrl,
  features = [],
}: WelcomeEmailProps) {
  return (
    <BaseLayout preview={`Welcome to Your App, ${userName}!`}>
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Welcome to Your App!
      </Heading>

      <Text className="text-gray-600 mb-4">Hi {userName},</Text>

      <Text className="text-gray-600 mb-6">
        Thanks for joining! We&apos;re excited to have you on board.
      </Text>

      {features.length > 0 && (
        <>
          <Text className="text-gray-600 mb-2 font-semibold">
            Here&apos;s what you can do:
          </Text>
          <ul className="text-gray-600 mb-6 pl-4">
            {features.map((feature) => (
              <li key={feature} className="mb-1">
                {feature}
              </li>
            ))}
          </ul>
        </>
      )}

      <Button
        href={loginUrl}
        className="bg-blue-600 text-white font-semibold rounded-md"
        style={{
          paddingLeft: CTA_PADDING_X,
          paddingRight: CTA_PADDING_X,
          paddingTop: CTA_PADDING_Y,
          paddingBottom: CTA_PADDING_Y,
        }}
      >
        Get Started
      </Button>
    </BaseLayout>
  );
}

// Preview props for development server
WelcomeEmail.PreviewProps = {
  userName: "John",
  loginUrl: "https://example.com/login",
  features: ["Create projects", "Invite team members", "Track progress"],
} satisfies WelcomeEmailProps;

// Named export with type
export { WelcomeEmail };
export type { WelcomeEmailProps };
```

**Why good:** Typed props catch errors at compile time, PreviewProps enable dev server preview, optional props have defaults, BaseLayout ensures consistency

---

## Pattern 2: Basic Send with Error Handling

Send emails with proper error handling and logging.

```typescript
// lib/email/send-email.ts
import { render } from "@react-email/components";

import {
  getResendClient,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const resend = getResendClient();

  try {
    // CRITICAL: Always await render()
    const html = await render(options.react);

    const { data, error } = await resend.emails.send({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
    });

    if (error) {
      console.error("[Email] Send failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log("[Email] Sent successfully:", data?.id);
    return {
      success: true,
      id: data?.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Unexpected error:", message);
    return {
      success: false,
      error: message,
    };
  }
}

// Named export
export { sendEmail };
export type { SendEmailOptions, SendEmailResult };
```

**Why good:** Wraps Resend client with consistent interface, always awaits render(), returns typed result, logs for debugging

---

## Anti-Pattern: Common Mistakes

```typescript
// BAD Example - Common mistakes
async function sendEmailBad(to: string, subject: string, react: React.ReactElement) {
  const resend = getResendClient();

  // BAD: Not awaiting render - sends "[object Promise]"
  const html = render(react);

  // BAD: No error handling - silent failures
  await resend.emails.send({
    from: "noreply@example.com", // BAD: Hardcoded
    to,
    subject,
    html, // This is a Promise, not a string!
  });

  // BAD: No return value - caller has no idea if it worked
}
```

**Why bad:** Not awaiting render() sends garbage, no error handling means silent failures, hardcoded from address breaks when domain changes
