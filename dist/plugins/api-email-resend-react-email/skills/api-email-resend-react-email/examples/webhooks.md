# Email - Webhook Examples

> Webhook handler for tracking email events. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

---

## Pattern 1: Webhook Handler Using Resend SDK (Recommended)

Process Resend webhook events with the built-in SDK verification method.

```typescript
// api/webhooks/resend/route.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface ResendWebhookPayload {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.opened"
    | "email.clicked"
    | "email.bounced"
    | "email.complained";
  data: {
    email_id: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: { link: string };
  };
}

// Adapt to your web framework's request/response API
export async function handleWebhook(request: Request) {
  try {
    // CRITICAL: Use raw text payload - JSON parsing breaks signature verification
    const payload = await request.text();

    // Use Resend SDK's built-in verification (recommended approach)
    // Note: header keys are short-form: id, timestamp, signature
    const event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    }) as ResendWebhookPayload;

    // Store event in your database
    await saveEmailEvent({
      emailId: event.data.email_id,
      type: event.type,
      recipient: event.data.to[0],
      subject: event.data.subject,
      clickedLink: event.data.click?.link,
      occurredAt: new Date(event.data.created_at),
    });

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("[Webhook] Verification failed:", err);
    return new Response(
      JSON.stringify({ error: "Invalid webhook signature" }),
      { status: 400 },
    );
  }
}
```

**Why good:** Uses SDK's built-in verification, uses correct `webhookSecret` parameter and short-form header keys (`id`, `timestamp`, `signature`), returns 400 on invalid signatures

---

## Pattern 2: Manual Verification with Svix (Alternative)

For environments where Resend SDK isn't suitable, use Svix library directly.

```typescript
// api/webhooks/resend/route.ts
import { Webhook } from "svix";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET!;

// Adapt to your web framework's request/response API
export async function handleWebhook(request: Request) {
  try {
    // CRITICAL: Use raw text payload - JSON parsing breaks signature verification
    const payload = await request.text();

    // All three headers are required for Svix verification
    const headers = {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    };

    // Verify using Svix library
    const wh = new Webhook(WEBHOOK_SECRET);
    const event = wh.verify(payload, headers);

    // Process the verified event...

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("[Webhook] Verification failed:", err);
    return new Response(
      JSON.stringify({ error: "Invalid webhook signature" }),
      { status: 400 },
    );
  }
}
```

**Why good:** Uses Svix library directly for signature verification, includes all three required headers, handles errors gracefully

---

## Pattern 3: Webhook Configuration

Steps to configure webhooks in Resend Dashboard:

1. Go to Resend Dashboard > Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/resend`
3. Select events: sent, delivered, opened, clicked, bounced, complained
4. Copy the signing secret to `RESEND_WEBHOOK_SECRET`

---

## Event Types Reference

| Event              | Description                     |
| ------------------ | ------------------------------- |
| `email.sent`       | Email accepted by Resend        |
| `email.delivered`  | Email delivered to recipient    |
| `email.opened`     | Recipient opened the email      |
| `email.clicked`    | Recipient clicked a link        |
| `email.bounced`    | Email bounced (invalid address) |
| `email.complained` | Recipient marked as spam        |

---

## Security Notes

- **Always verify webhook signatures** - prevents spoofed and replay attacks
- **Use raw request body** (`request.text()`) - JSON parsing/stringifying breaks signature verification
- **SDK method uses `webhookSecret`** parameter (not `secret`)
- **SDK header keys are short-form:** `id`, `timestamp`, `signature` (mapped from `svix-id`, `svix-timestamp`, `svix-signature`)
- **Svix method uses full header names:** `svix-id`, `svix-timestamp`, `svix-signature`
- Store `RESEND_WEBHOOK_SECRET` in environment variables
- Return 400 for invalid signatures, 200 for valid events
- Prefer `resend.webhooks.verify()` SDK method over manual Svix verification
