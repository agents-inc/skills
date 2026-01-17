# Email - Webhook Examples

> Webhook handler for tracking email events. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

---

## Pattern 1: Webhook Handler for Email Tracking

Process Resend webhook events with signature verification.

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

---

## Pattern 2: Webhook Configuration

Steps to configure webhooks in Resend Dashboard:

1. Go to Resend Dashboard > Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/resend`
3. Select events: sent, delivered, opened, clicked, bounced, complained
4. Copy the signing secret to `RESEND_WEBHOOK_SECRET`

---

## Event Types Reference

| Event | Description |
|-------|-------------|
| `email.sent` | Email accepted by Resend |
| `email.delivered` | Email delivered to recipient |
| `email.opened` | Recipient opened the email |
| `email.clicked` | Recipient clicked a link |
| `email.bounced` | Email bounced (invalid address) |
| `email.complained` | Recipient marked as spam |

---

## Security Notes

- **Always verify webhook signatures** - prevents spoofed events
- Use `svix-signature` header for verification
- Store `RESEND_WEBHOOK_SECRET` in environment variables
- Return 401 for invalid signatures, 200 for valid events
