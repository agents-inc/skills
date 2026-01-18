# Email - Advanced Features Examples

> Scheduled sending, idempotency keys, and tags. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

---

## Pattern 1: Scheduled Email Sending

Send emails at a future time using the `scheduledAt` parameter.

```typescript
// lib/email/scheduled-email.ts
import { render } from "@react-email/components";

import {
  getResendClient,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

const MAX_SCHEDULE_DAYS = 30; // Resend allows scheduling up to 30 days in advance

interface ScheduledEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  scheduledAt: Date;
  tags?: Array<{ name: string; value: string }>; // Supported in v4+
}

interface ScheduledEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendScheduledEmail(
  options: ScheduledEmailOptions
): Promise<ScheduledEmailResult> {
  const resend = getResendClient();

  // Validate scheduling window (up to 30 days in advance)
  const now = new Date();
  const maxScheduleDate = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);

  if (options.scheduledAt <= now) {
    return { success: false, error: "Scheduled time must be in the future" };
  }

  if (options.scheduledAt > maxScheduleDate) {
    return { success: false, error: `Cannot schedule more than ${MAX_SCHEDULE_DAYS} days in advance` };
  }

  try {
    const html = await render(options.react);

    const { data, error } = await resend.emails.send({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html,
      scheduledAt: options.scheduledAt.toISOString(),
      tags: options.tags, // Tags now supported with scheduled emails
    });

    if (error) {
      console.error("[Email] Scheduled send failed:", error);
      return { success: false, error: error.message };
    }

    console.log("[Email] Scheduled successfully:", data?.id, "for", options.scheduledAt);
    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Unexpected error:", message);
    return { success: false, error: message };
  }
}

// Named exports
export { sendScheduledEmail };
export type { ScheduledEmailOptions, ScheduledEmailResult };
```

**Why good:** Validates scheduling window (up to 30 days), converts Date to ISO string for API, logs scheduled time for debugging, supports tags with scheduled emails (v4+ feature)

---

## Pattern 2: Usage - Schedule Reminder Email

Schedule a reminder email for the next day.

```typescript
// Example: Schedule reminder email for tomorrow at 9 AM
import { sendScheduledEmail } from "@/lib/email/scheduled-email";
import { ReminderEmail } from "@repo/emails";

const REMINDER_HOUR = 9;

async function scheduleReminderForTomorrow(user: { email: string; name: string }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(REMINDER_HOUR, 0, 0, 0);

  const result = await sendScheduledEmail({
    to: user.email,
    subject: "Your daily reminder",
    react: ReminderEmail({ userName: user.name }),
    scheduledAt: tomorrow,
    tags: [
      { name: "email_type", value: "reminder" },
      { name: "schedule_type", value: "daily" },
    ],
  });

  return result;
}
```

---

## Pattern 3: Idempotency Keys

Prevent duplicate email sends using idempotency keys.

```typescript
// lib/email/idempotent-email.ts
import { render } from "@react-email/components";

import {
  getResendClient,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

const IDEMPOTENCY_KEY_MAX_LENGTH = 256;

interface IdempotentEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  idempotencyKey: string; // Unique identifier for this email request
}

interface IdempotentEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  isDuplicate?: boolean;
}

export async function sendIdempotentEmail(
  options: IdempotentEmailOptions
): Promise<IdempotentEmailResult> {
  const resend = getResendClient();

  // Validate idempotency key length
  if (options.idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return {
      success: false,
      error: `Idempotency key must be ${IDEMPOTENCY_KEY_MAX_LENGTH} characters or less`,
    };
  }

  try {
    const html = await render(options.react);

    const { data, error } = await resend.emails.send({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html,
      headers: {
        "Idempotency-Key": options.idempotencyKey,
      },
    });

    if (error) {
      // Check for idempotency-related errors
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

// Named exports
export { sendIdempotentEmail };
export type { IdempotentEmailOptions, IdempotentEmailResult };
```

**Why good:** Validates key length, handles idempotency-specific errors, returns `isDuplicate` flag for caller handling

---

## Pattern 4: Usage - Idempotent Order Confirmation

Use order ID as idempotency key to prevent duplicate confirmation emails.

```typescript
// Example: Send order confirmation with idempotency
import { sendIdempotentEmail } from "@/lib/email/idempotent-email";
import { OrderConfirmationEmail } from "@repo/emails";

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
    console.log("[Order] Confirmation email already sent for order:", order.id);
  }

  return result;
}
```

---

## Pattern 5: Email Tags for Tracking

Add metadata tags to emails for analytics and organization.

```typescript
// lib/email/tagged-email.ts
import { render } from "@react-email/components";

import {
  getResendClient,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

const TAG_KEY_MAX_LENGTH = 256;
const TAG_VALUE_MAX_LENGTH = 256;

interface EmailTag {
  name: string;
  value: string;
}

interface TaggedEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  tags: EmailTag[];
}

interface TaggedEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendTaggedEmail(
  options: TaggedEmailOptions
): Promise<TaggedEmailResult> {
  const resend = getResendClient();

  // Validate tags
  for (const tag of options.tags) {
    if (tag.name.length > TAG_KEY_MAX_LENGTH || tag.value.length > TAG_VALUE_MAX_LENGTH) {
      return {
        success: false,
        error: `Tag keys and values must be ${TAG_KEY_MAX_LENGTH} characters or less`,
      };
    }
    // Tags must be ASCII alphanumeric, underscore, or dash
    if (!/^[a-zA-Z0-9_-]+$/.test(tag.name)) {
      return {
        success: false,
        error: "Tag names must contain only ASCII alphanumeric characters, underscores, or dashes",
      };
    }
  }

  try {
    const html = await render(options.react);

    const { data, error } = await resend.emails.send({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html,
      tags: options.tags,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// Named exports
export { sendTaggedEmail };
export type { EmailTag, TaggedEmailOptions, TaggedEmailResult };
```

**Why good:** Validates tag format constraints, enables filtering and analytics in Resend dashboard, supports multiple tags per email

---

## Pattern 6: Usage - Tagged Campaign Email

Track email campaigns with tags for analytics.

```typescript
// Example: Send marketing email with campaign tags
import { sendTaggedEmail } from "@/lib/email/tagged-email";
import { NewsletterEmail } from "@repo/emails";

async function sendCampaignEmail(
  user: { email: string; name: string },
  campaign: { id: string; name: string; variant: "A" | "B" }
) {
  const result = await sendTaggedEmail({
    to: user.email,
    subject: "This week's updates",
    react: NewsletterEmail({
      userName: user.name,
      variant: campaign.variant,
    }),
    tags: [
      { name: "campaign_id", value: campaign.id },
      { name: "campaign_name", value: campaign.name },
      { name: "ab_variant", value: campaign.variant },
      { name: "email_type", value: "newsletter" },
    ],
  });

  return result;
}
```

---

## Pattern 7: Combining Features - Scheduled Email with Tags

Send scheduled emails with tracking tags (v4+ feature).

```typescript
// lib/email/scheduled-tagged-email.ts
import { render } from "@react-email/components";

import {
  getResendClient,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

const MAX_SCHEDULE_DAYS = 30;

interface ScheduledTaggedEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  scheduledAt: Date;
  tags: Array<{ name: string; value: string }>;
}

export async function sendScheduledTaggedEmail(
  options: ScheduledTaggedEmailOptions
) {
  const resend = getResendClient();

  const now = new Date();
  const maxScheduleDate = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);

  if (options.scheduledAt <= now || options.scheduledAt > maxScheduleDate) {
    return {
      success: false,
      error: "Invalid schedule time",
    };
  }

  try {
    const html = await render(options.react);

    const { data, error } = await resend.emails.send({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html,
      scheduledAt: options.scheduledAt.toISOString(),
      tags: options.tags, // Now supported together!
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// Named exports
export { sendScheduledTaggedEmail };
export type { ScheduledTaggedEmailOptions };
```

**Why good:** Combines scheduled sending with tags (v4+ feature), validates scheduling constraints, enables analytics tracking for scheduled campaigns

---

## Feature Comparison

| Feature | Use Case | Limit | Batch Support |
|---------|----------|-------|---------------|
| Scheduled sending | Reminders, time-zone aware | Up to 30 days in advance | ❌ Not supported |
| Idempotency keys | Prevent duplicates, retry safety | 256 chars, expires 24 hours | ✅ Supported |
| Tags | Analytics, filtering, A/B testing | 256 chars per key/value | ✅ Supported |
| Tags + Scheduled | Campaign tracking for scheduled emails | Combined limits apply | ❌ Not supported |

---

## Notes

- **Scheduled emails** cannot be used with batch API
- **Attachments** cannot be used with batch API (40MB max per single send)
- **Idempotency keys** expire after 24 hours
- **Tags** support ASCII alphanumeric characters, underscores, and dashes only
- **Tags with scheduled emails** is a v4+ feature (2025 update)
- All features work with the standard `resend.emails.send()` method
