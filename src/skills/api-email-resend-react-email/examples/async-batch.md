# Email - Async and Batch Sending Examples

> Non-blocking email sending and batch API patterns. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

---

## Pattern 1: Fire and Forget

Send emails without blocking the response.

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
```

---

## Pattern 2: Usage in API Route

Non-blocking email in a signup flow.

```typescript
// api/signup/route.ts
import { sendEmailAsync } from "./lib/email/async-email";
import { WelcomeEmail } from "./templates/welcome-email";

// Adapt to your web framework's route handler
export async function handleSignup(request: Request) {
  const body = await request.json();

  // Create user (blocking - required for response)
  const user = await createUser(body);

  // Send welcome email asynchronously (non-blocking)
  sendEmailAsync({
    to: user.email,
    subject: "Welcome to Your App!",
    react: WelcomeEmail({
      userName: user.name ?? "there",
      loginUrl: `${process.env.APP_URL}/login`,
    }),
  });

  // Return immediately - email sends in background
  return Response.json({ success: true, user });
}
```

**Why good:** Signup response is fast (doesn't wait for email), email failures don't break the signup flow, flushPendingEmails enables graceful shutdown

---

## Pattern 3: Batch Email Function

Send to multiple recipients efficiently using Resend's batch API.

```typescript
// lib/email/batch-email.ts
import { Resend } from "resend";
import { render } from "@react-email/components";

const resend = new Resend(process.env.RESEND_API_KEY);

const MAX_BATCH_SIZE = 100; // Resend limit per batch request
const DEFAULT_FROM = `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`;

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
  emails: BatchEmailItem[],
): Promise<BatchSendResult> {
  const results: { id: string }[] = [];
  const errors: string[] = [];

  // Split into batches of MAX_BATCH_SIZE
  for (let i = 0; i < emails.length; i += MAX_BATCH_SIZE) {
    const batch = emails.slice(i, i + MAX_BATCH_SIZE);

    // Render all emails in batch in parallel
    const renderedEmails = await Promise.all(
      batch.map(async (email) => ({
        from: DEFAULT_FROM,
        to: email.to,
        subject: email.subject,
        html: await render(email.react),
      })),
    );

    try {
      const { data, error } = await resend.batch.send(renderedEmails);

      if (error) {
        errors.push(
          `Batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}: ${error.message}`,
        );
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

export type { BatchEmailItem, BatchSendResult };
```

---

## Pattern 4: Batch Usage Example

Send notifications to all team members.

```typescript
// Send notifications to all team members
import { sendBatchEmails } from "./lib/email/batch-email";
import { NotificationEmail } from "./templates/notification-email";

async function notifyTeamMembers(
  members: { email: string; name: string }[],
  notification: { title: string; body: string; actionUrl: string },
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
      unsubscribeUrl: `${process.env.APP_URL}/unsubscribe?email=${member.email}`,
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

## Batch API Limitations

**Not Supported in Batch:**

- `attachments` field - use single send for emails with attachments
- `scheduledAt` field - use single send for scheduled emails

**Supported in Batch:**

- `tags` - for analytics and tracking
- `headers` (custom email headers)
- `cc` and `bcc` recipients
- Up to 50 recipients per email (`to` field)
