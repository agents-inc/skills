# Email Examples

> All code examples for the Email skill - templates, sending patterns, integrations.

---

## Email Template Examples

### Welcome Email Template

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

### Password Reset Email Template

```typescript
// packages/emails/src/templates/password-reset.tsx
import { Button, Heading, Text } from "@react-email/components";

import { BaseLayout } from "../layouts/base-layout";

const CTA_PADDING_X = 24;
const CTA_PADDING_Y = 12;
const LINK_EXPIRY_MINUTES = 60;

interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
}

export function PasswordResetEmail({
  userName,
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <BaseLayout preview="Reset your password">
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Reset your password
      </Heading>

      <Text className="text-gray-600 mb-4">Hi {userName},</Text>

      <Text className="text-gray-600 mb-6">
        We received a request to reset your password. Click the button below to
        create a new password.
      </Text>

      <Button
        href={resetUrl}
        className="bg-blue-600 text-white font-semibold rounded-md"
        style={{
          paddingLeft: CTA_PADDING_X,
          paddingRight: CTA_PADDING_X,
          paddingTop: CTA_PADDING_Y,
          paddingBottom: CTA_PADDING_Y,
        }}
      >
        Reset Password
      </Button>

      <Text className="text-sm text-gray-500 mt-6">
        This link will expire in {LINK_EXPIRY_MINUTES} minutes.
      </Text>

      <Text className="text-sm text-gray-500 mt-4">
        If you didn&apos;t request a password reset, you can safely ignore this
        email. Your password will remain unchanged.
      </Text>
    </BaseLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  userName: "John",
  resetUrl: "https://example.com/reset?token=abc123",
} satisfies PasswordResetEmailProps;

// Named exports
export { PasswordResetEmail };
export type { PasswordResetEmailProps };
```

**Why good:** Clear security messaging, expiry time communicated, reassurance for users who didn't request reset

---

### Notification Email with Unsubscribe

```typescript
// packages/emails/src/templates/notification-email.tsx
import { Button, Heading, Link, Text } from "@react-email/components";

import { BaseLayout } from "../layouts/base-layout";

const CTA_PADDING_X = 20;
const CTA_PADDING_Y = 10;

interface NotificationEmailProps {
  userName: string;
  notificationType: "mention" | "comment" | "update";
  title: string;
  body: string;
  actionUrl: string;
  actionText: string;
  unsubscribeUrl: string;
}

const NOTIFICATION_TITLES: Record<string, string> = {
  mention: "You were mentioned",
  comment: "New comment on your post",
  update: "Project update",
};

export function NotificationEmail({
  userName,
  notificationType,
  title,
  body,
  actionUrl,
  actionText,
  unsubscribeUrl,
}: NotificationEmailProps) {
  return (
    <BaseLayout preview={title}>
      <Text className="text-sm text-blue-600 font-medium mb-2">
        {NOTIFICATION_TITLES[notificationType]}
      </Text>

      <Heading className="text-xl font-bold text-gray-900 mb-4">
        {title}
      </Heading>

      <Text className="text-gray-600 mb-4">Hi {userName},</Text>

      <Text className="text-gray-600 mb-6">{body}</Text>

      <Button
        href={actionUrl}
        className="bg-blue-600 text-white font-semibold rounded-md"
        style={{
          paddingLeft: CTA_PADDING_X,
          paddingRight: CTA_PADDING_X,
          paddingTop: CTA_PADDING_Y,
          paddingBottom: CTA_PADDING_Y,
        }}
      >
        {actionText}
      </Button>

      {/* REQUIRED: Unsubscribe link for CAN-SPAM compliance */}
      <Text className="text-xs text-gray-400 mt-8 text-center">
        <Link href={unsubscribeUrl} className="text-gray-400 underline">
          Unsubscribe from these notifications
        </Link>
      </Text>
    </BaseLayout>
  );
}

NotificationEmail.PreviewProps = {
  userName: "John",
  notificationType: "mention",
  title: "Sarah mentioned you in a comment",
  body: 'Sarah said: "@John can you review this?"',
  actionUrl: "https://example.com/comments/123",
  actionText: "View Comment",
  unsubscribeUrl: "https://example.com/unsubscribe?token=abc",
} satisfies NotificationEmailProps;

// Named exports
export { NotificationEmail };
export type { NotificationEmailProps };
```

**Why good:** Unsubscribe link is required for compliance, notification type enables different styling, props are fully typed

---

## Email Sending Examples

### Basic Send Pattern

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

### Bad Example - Common Mistakes

```typescript
// ❌ Bad Example - Common mistakes
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

---

### Retry Logic Implementation

```typescript
// lib/email/constants.ts
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY_MS = 1000;
export const RETRY_BACKOFF_MULTIPLIER = 2;
```

```typescript
// lib/email/send-with-retry.ts
import { render } from "@react-email/components";

import {
  getResendClient,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

import {
  MAX_RETRY_ATTEMPTS,
  INITIAL_RETRY_DELAY_MS,
  RETRY_BACKOFF_MULTIPLIER,
} from "./constants";

// Errors that are safe to retry
const RETRYABLE_ERRORS = [
  "rate_limit_exceeded",
  "internal_server_error",
  "service_unavailable",
];

interface SendWithRetryOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  maxRetries?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmailWithRetry(
  options: SendWithRetryOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
  const resend = getResendClient();
  const maxRetries = options.maxRetries ?? MAX_RETRY_ATTEMPTS;

  let lastError: string | undefined;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;

    try {
      const html = await render(options.react);

      const { data, error } = await resend.emails.send({
        from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        html,
      });

      if (error) {
        lastError = error.message;

        // Check if error is retryable
        const isRetryable = RETRYABLE_ERRORS.some((e) =>
          error.name?.toLowerCase().includes(e)
        );

        if (isRetryable && attempt < maxRetries) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt - 1);
          console.log(`[Email] Retry ${attempt}/${maxRetries} after ${delay}ms`);
          await sleep(delay);
          continue;
        }

        return { success: false, error: error.message };
      }

      return { success: true, id: data?.id };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";

      if (attempt < maxRetries) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt - 1);
        console.log(`[Email] Retry ${attempt}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
        continue;
      }
    }
  }

  return { success: false, error: lastError ?? "Max retries exceeded" };
}

// Named export
export { sendEmailWithRetry };
```

**Why good:** Exponential backoff prevents overwhelming the API, only retries transient errors, configurable retry count, logs retry attempts

---

## Authentication Integration Examples

### Verification Email Integration

Integrate email sending with your authentication system's email callbacks.

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

## Async Email Sending Examples

### Fire and Forget Pattern

```typescript
// lib/email/async-email.ts
import type { SendEmailOptions } from "./send-email";
import { sendEmailWithRetry } from "./send-with-retry";

// Queue for tracking in-flight emails (for graceful shutdown)
const inFlightEmails = new Set<Promise<unknown>>();

export function sendEmailAsync(options: SendEmailOptions): void {
  const promise = sendEmailWithRetry(options)
    .catch((err) => {
      console.error("[Email] Async send failed:", err);
    })
    .finally(() => {
      inFlightEmails.delete(promise);
    });

  inFlightEmails.add(promise);
}

// For graceful shutdown - wait for all emails to complete
export async function flushPendingEmails(): Promise<void> {
  await Promise.all(inFlightEmails);
}

// Named exports
export { sendEmailAsync, flushPendingEmails };
```

### Usage in API Route

```typescript
// app/api/signup/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sendEmailAsync } from "@/lib/email/async-email";
import { WelcomeEmail } from "@repo/emails";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Create user (blocking - required for response)
  const user = await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.name,
    },
  });

  // Send welcome email asynchronously (non-blocking)
  sendEmailAsync({
    to: user.email,
    subject: "Welcome to Your App!",
    react: WelcomeEmail({
      userName: user.name ?? "there",
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    }),
  });

  // Return immediately - email sends in background
  return NextResponse.json({ success: true, user });
}
```

**Why good:** Signup response is fast (doesn't wait for email), email failures don't break the signup flow, flushPendingEmails enables graceful shutdown

---

## Batch Email Sending Examples

### Batch Email Function

```typescript
// lib/email/batch-email.ts
import { render } from "@react-email/components";

import { getResendClient, DEFAULT_FROM_ADDRESS, DEFAULT_FROM_NAME } from "@repo/emails";

const MAX_BATCH_SIZE = 100; // Resend limit per batch request

interface BatchEmailItem {
  to: string;
  subject: string;
  react: React.ReactElement;
}

interface BatchSendResult {
  success: boolean;
  data?: { id: string }[];
  errors?: string[];
}

export async function sendBatchEmails(
  emails: BatchEmailItem[]
): Promise<BatchSendResult> {
  const resend = getResendClient();
  const results: { id: string }[] = [];
  const errors: string[] = [];

  // Split into batches of MAX_BATCH_SIZE
  for (let i = 0; i < emails.length; i += MAX_BATCH_SIZE) {
    const batch = emails.slice(i, i + MAX_BATCH_SIZE);

    // Render all emails in batch
    const renderedEmails = await Promise.all(
      batch.map(async (email) => ({
        from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
        to: email.to,
        subject: email.subject,
        html: await render(email.react),
      }))
    );

    try {
      const { data, error } = await resend.batch.send(renderedEmails);

      if (error) {
        errors.push(`Batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}: ${error.message}`);
      } else if (data) {
        results.push(...data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}: ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    data: results.length > 0 ? results : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Named export
export { sendBatchEmails };
export type { BatchEmailItem, BatchSendResult };
```

### Usage Example

```typescript
// Send notifications to all team members
import { sendBatchEmails } from "@/lib/email/batch-email";
import { NotificationEmail } from "@repo/emails";

async function notifyTeamMembers(
  members: { email: string; name: string }[],
  notification: { title: string; body: string; actionUrl: string }
) {
  const emails = members.map((member) => ({
    to: member.email,
    subject: notification.title,
    react: NotificationEmail({
      userName: member.name,
      notificationType: "update" as const,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      actionText: "View Update",
      unsubscribeUrl: `https://example.com/unsubscribe?email=${member.email}`,
    }),
  }));

  const result = await sendBatchEmails(emails);

  if (!result.success) {
    console.error("[Email] Batch send had errors:", result.errors);
  }

  return result;
}
```

**Why good:** Handles Resend's 100-email batch limit, renders all templates in parallel, returns detailed results per batch

---

## Webhook Examples

### Webhook Handler for Email Tracking

```typescript
// app/api/webhooks/resend/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { db } from "@/lib/db";
import { emailEvents } from "@/lib/db/schema";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET!;

interface ResendWebhookPayload {
  type: "email.sent" | "email.delivered" | "email.opened" | "email.clicked" | "email.bounced" | "email.complained";
  data: {
    email_id: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: { link: string };
  };
}

function verifySignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  return signature === expectedSignature;
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("svix-signature") ?? "";

  // Verify webhook signature
  if (!verifySignature(payload, signature)) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  const event = JSON.parse(payload) as ResendWebhookPayload;

  // Store event in database
  await db.insert(emailEvents).values({
    emailId: event.data.email_id,
    type: event.type,
    recipient: event.data.to[0],
    subject: event.data.subject,
    clickedLink: event.data.click?.link,
    occurredAt: new Date(event.data.created_at),
  });

  // Track in analytics (optional - see analytics skill)
  // posthogServer.capture({
  //   distinctId: event.data.to[0],
  //   event: `email:${event.type.replace("email.", "")}`,
  //   properties: { emailId: event.data.email_id },
  // });

  return NextResponse.json({ received: true });
}
```

**Why good:** Signature verification prevents spoofed webhooks, stores events for analysis, optional analytics integration

### Webhook Configuration in Resend

1. Go to Resend Dashboard > Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/resend`
3. Select events: sent, delivered, opened, clicked, bounced, complained
4. Copy the signing secret to `RESEND_WEBHOOK_SECRET`

---

## Email Preferences Examples

> **Database examples below use Drizzle ORM.** Adapt to your ORM of choice (Prisma, Kysely, raw SQL, etc.) - the patterns remain the same.

### Preferences Schema

```typescript
// lib/db/schema/email-preferences.ts
// Example using Drizzle ORM - adapt to your database solution
import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const emailPreferences = pgTable("email_preferences", {
  userId: text("user_id").primaryKey(),
  marketingEmails: boolean("marketing_emails").default(true),
  productUpdates: boolean("product_updates").default(true),
  teamNotifications: boolean("team_notifications").default(true),
  securityAlerts: boolean("security_alerts").default(true), // Cannot be disabled
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Unsubscribe Endpoint

```typescript
// app/api/email/unsubscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm"; // Adapt to your ORM
import jwt from "jsonwebtoken";

import { db } from "@/lib/db";
import { emailPreferences } from "@/lib/db/schema";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET!;

interface UnsubscribeToken {
  userId: string;
  category: "marketing" | "product_updates" | "team_notifications";
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect("/unsubscribe-error");
  }

  try {
    const decoded = jwt.verify(token, UNSUBSCRIBE_SECRET) as UnsubscribeToken;

    // Map category to column
    const columnMap = {
      marketing: "marketingEmails",
      product_updates: "productUpdates",
      team_notifications: "teamNotifications",
    } as const;

    const column = columnMap[decoded.category];

    // Update preference
    await db
      .update(emailPreferences)
      .set({ [column]: false, updatedAt: new Date() })
      .where(eq(emailPreferences.userId, decoded.userId));

    return NextResponse.redirect("/unsubscribe-success");
  } catch (err) {
    return NextResponse.redirect("/unsubscribe-error");
  }
}
```

### Generating Unsubscribe URL

```typescript
// lib/email/unsubscribe.ts
import jwt from "jsonwebtoken";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET!;
const UNSUBSCRIBE_TOKEN_EXPIRY = "30d";

type EmailCategory = "marketing" | "product_updates" | "team_notifications";

export function generateUnsubscribeUrl(
  userId: string,
  category: EmailCategory
): string {
  const token = jwt.sign(
    { userId, category },
    UNSUBSCRIBE_SECRET,
    { expiresIn: UNSUBSCRIBE_TOKEN_EXPIRY }
  );

  return `${process.env.NEXT_PUBLIC_APP_URL}/api/email/unsubscribe?token=${token}`;
}

// Named export
export { generateUnsubscribeUrl };
export type { EmailCategory };
```

**Why good:** Token-based unsubscribe prevents unauthorized changes, security alerts cannot be disabled, preferences stored in database for checking before send

---

### Checking Preferences Before Sending

```typescript
// lib/email/send-notification.ts
import { eq } from "drizzle-orm"; // Adapt to your ORM

import { db } from "@/lib/db";
import { emailPreferences } from "@/lib/db/schema";
import { sendEmail } from "./send-email";
import { generateUnsubscribeUrl } from "./unsubscribe";
import { NotificationEmail } from "@repo/emails";

interface NotificationOptions {
  userId: string;
  email: string;
  userName: string;
  category: "marketing" | "product_updates" | "team_notifications";
  title: string;
  body: string;
  actionUrl: string;
  actionText: string;
}

export async function sendNotificationEmail(
  options: NotificationOptions
): Promise<{ sent: boolean; reason?: string }> {
  // Check user preferences
  const prefs = await db
    .select()
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, options.userId))
    .limit(1);

  const preferences = prefs[0];

  // Check if user has opted out of this category
  const categoryMap = {
    marketing: preferences?.marketingEmails ?? true,
    product_updates: preferences?.productUpdates ?? true,
    team_notifications: preferences?.teamNotifications ?? true,
  };

  if (!categoryMap[options.category]) {
    return { sent: false, reason: "User has opted out of this category" };
  }

  // Generate unsubscribe URL
  const unsubscribeUrl = generateUnsubscribeUrl(options.userId, options.category);

  // Send email
  const result = await sendEmail({
    to: options.email,
    subject: options.title,
    react: NotificationEmail({
      userName: options.userName,
      notificationType: "update",
      title: options.title,
      body: options.body,
      actionUrl: options.actionUrl,
      actionText: options.actionText,
      unsubscribeUrl,
    }),
  });

  return { sent: result.success, reason: result.error };
}

// Named export
export { sendNotificationEmail };
```

**Why good:** Respects user preferences, includes proper unsubscribe link, returns reason if not sent

---

## Testing Examples

### Preview Server

```bash
# Start React Email preview server
bun run email:dev

# View at http://localhost:3001
# - See all templates
# - Modify PreviewProps
# - View HTML source
```

### Unit Testing Templates

```typescript
// packages/emails/src/templates/__tests__/welcome-email.test.tsx
import { render } from "@react-email/components";
import { describe, it, expect } from "vitest";

import { WelcomeEmail } from "../welcome-email";

describe("WelcomeEmail", () => {
  it("renders with required props", async () => {
    const html = await render(
      WelcomeEmail({
        userName: "John",
        loginUrl: "https://example.com/login",
      })
    );

    expect(html).toContain("Welcome to Your App!");
    expect(html).toContain("John");
    expect(html).toContain("https://example.com/login");
  });

  it("renders optional features list", async () => {
    const html = await render(
      WelcomeEmail({
        userName: "John",
        loginUrl: "https://example.com/login",
        features: ["Feature 1", "Feature 2"],
      })
    );

    expect(html).toContain("Feature 1");
    expect(html).toContain("Feature 2");
  });

  it("handles empty features gracefully", async () => {
    const html = await render(
      WelcomeEmail({
        userName: "John",
        loginUrl: "https://example.com/login",
        features: [],
      })
    );

    expect(html).not.toContain("Here's what you can do:");
  });
});
```

**Why good:** Tests actual rendered output, covers edge cases, catches rendering issues before sending
