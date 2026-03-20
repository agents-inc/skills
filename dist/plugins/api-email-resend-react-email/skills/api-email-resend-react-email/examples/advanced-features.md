# Email - Advanced Features Examples

> Scheduled sending, idempotency keys, and tags. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

---

## Pattern 1: Scheduled Email Sending

Send emails at a future time using the `scheduledAt` parameter.

```typescript
// lib/email/scheduled-email.ts
import { Resend } from "resend";
import { render } from "@react-email/components";

const resend = new Resend(process.env.RESEND_API_KEY);
const MAX_SCHEDULE_DAYS = 30; // Resend allows scheduling up to 30 days in advance

interface ScheduledEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  scheduledAt: Date;
  tags?: Array<{ name: string; value: string }>;
}

export async function sendScheduledEmail(
  options: ScheduledEmailOptions,
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Validate scheduling window (up to 30 days in advance)
  const now = new Date();
  const maxScheduleDate = new Date(
    now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000,
  );

  if (options.scheduledAt <= now) {
    return { success: false, error: "Scheduled time must be in the future" };
  }

  if (options.scheduledAt > maxScheduleDate) {
    return {
      success: false,
      error: `Cannot schedule more than ${MAX_SCHEDULE_DAYS} days in advance`,
    };
  }

  try {
    const html = await render(options.react);

    const { data, error } = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html,
      scheduledAt: options.scheduledAt.toISOString(),
      tags: options.tags,
    });

    if (error) {
      console.error("[Email] Scheduled send failed:", error);
      return { success: false, error: error.message };
    }

    console.log("[Email] Scheduled:", data?.id, "for", options.scheduledAt);
    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export type { ScheduledEmailOptions };
```

**Why good:** Validates scheduling window (up to 30 days), converts Date to ISO string for API, supports tags with scheduled emails

---

## Pattern 2: Idempotency Keys

Prevent duplicate email sends using idempotency keys.

```typescript
// lib/email/idempotent-email.ts
import { Resend } from "resend";
import { render } from "@react-email/components";

const resend = new Resend(process.env.RESEND_API_KEY);
const IDEMPOTENCY_KEY_MAX_LENGTH = 256;

interface IdempotentEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  idempotencyKey: string;
}

export async function sendIdempotentEmail(
  options: IdempotentEmailOptions,
): Promise<{
  success: boolean;
  id?: string;
  error?: string;
  isDuplicate?: boolean;
}> {
  if (options.idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return {
      success: false,
      error: `Idempotency key must be ${IDEMPOTENCY_KEY_MAX_LENGTH} characters or less`,
    };
  }

  try {
    const html = await render(options.react);

    const { data, error } = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html,
      headers: {
        "Idempotency-Key": options.idempotencyKey,
      },
    });

    if (error) {
      const errorName = error.name?.toLowerCase() ?? "";

      if (errorName.includes("invalid_idempotent_request")) {
        return {
          success: false,
          error: "This idempotency key was already used with different payload",
          isDuplicate: true,
        };
      }

      if (errorName.includes("concurrent_idempotent_requests")) {
        return {
          success: false,
          error: "Another request with this idempotency key is in progress",
          isDuplicate: true,
        };
      }

      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export type { IdempotentEmailOptions };
```

**Why good:** Validates key length, handles idempotency-specific errors, returns `isDuplicate` flag for caller handling

---

## Pattern 3: Usage - Idempotent Order Confirmation

Use order ID as idempotency key to prevent duplicate confirmation emails.

```typescript
import { sendIdempotentEmail } from "./lib/email/idempotent-email";
import { OrderConfirmationEmail } from "./templates/order-confirmation";

async function sendOrderConfirmation(order: {
  id: string;
  userEmail: string;
  userName: string;
  total: number;
}) {
  // Use order ID as idempotency key - guarantees one email per order
  const result = await sendIdempotentEmail({
    to: order.userEmail,
    subject: `Order #${order.id} confirmed`,
    react: OrderConfirmationEmail({
      userName: order.userName,
      orderId: order.id,
      total: order.total,
    }),
    idempotencyKey: `order-confirmation-${order.id}`,
  });

  if (result.isDuplicate) {
    console.log("[Order] Confirmation already sent for:", order.id);
  }

  return result;
}
```

---

## Pattern 4: Email Tags for Tracking

Add metadata tags to emails for analytics and organization.

```typescript
// Tags are passed directly to resend.emails.send()
const { data, error } = await resend.emails.send({
  from,
  to,
  subject,
  html,
  tags: [
    { name: "campaign_id", value: campaign.id },
    { name: "email_type", value: "newsletter" },
    { name: "ab_variant", value: "A" },
  ],
});
```

**Tag constraints:**

- Names and values: max 256 characters each
- Characters: ASCII alphanumeric, underscores, dashes only (`/^[a-zA-Z0-9_-]+$/`)
- Supported in both single send and batch API
- Supported with scheduled emails

---

## Feature Comparison

| Feature           | Use Case                          | Limit                       | Batch Support |
| ----------------- | --------------------------------- | --------------------------- | ------------- |
| Scheduled sending | Reminders, time-zone aware        | Up to 30 days in advance    | Not supported |
| Idempotency keys  | Prevent duplicates, retry safety  | 256 chars, expires 24 hours | Supported     |
| Tags              | Analytics, filtering, A/B testing | 256 chars per key/value     | Supported     |

---

## Notes

- **Scheduled emails** cannot be used with batch API
- **Attachments** cannot be used with batch API
- **Idempotency keys** expire after 24 hours
- **Tags** support ASCII alphanumeric characters, underscores, and dashes only
- All features work with the standard `resend.emails.send()` method
