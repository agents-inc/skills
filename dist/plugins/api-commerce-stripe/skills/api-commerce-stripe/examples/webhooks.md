# Stripe Webhook Examples

> Signature verification, event handling, and idempotent processing. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand [Pattern 1: Client Setup](core.md#pattern-1-client-setup) from core examples first.

---

## Pattern 1: Webhook Signature Verification (Express)

### Good Example — Raw Body with constructEvent

```typescript
import express from "express";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

const app = express();

// CRITICAL: Webhook route MUST use raw body — place BEFORE express.json()
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      res.status(400).send("Missing Stripe-Signature header");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body, // Raw Buffer — NOT parsed JSON
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Webhook signature verification failed: ${message}`);
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    // Handle the event
    await handleStripeEvent(event);

    // Return 200 immediately — do not block on long operations
    res.json({ received: true });
  },
);

// Other routes use parsed JSON
app.use(express.json());
```

**Why good:** `express.raw()` preserves the raw body needed for signature verification, webhook route placed BEFORE `express.json()` middleware, `constructEvent` verifies HMAC-SHA256 signature, 200 returned immediately

### Bad Example — Parsed Body Breaks Verification

```typescript
// BAD: express.json() applied globally BEFORE webhook route
app.use(express.json()); // Parses body into object

app.post("/webhook", (req, res) => {
  // req.body is now a parsed object — signature verification WILL FAIL
  const event = stripe.webhooks.constructEvent(
    req.body, // Object, not raw string/buffer!
    req.headers["stripe-signature"]!,
    "whsec_...",
  );
});
```

**Why bad:** `express.json()` parses the body before the webhook route, changing the byte representation. Signature verification requires the exact bytes Stripe sent. This fails silently with a cryptographic mismatch.

---

## Pattern 2: Webhook Handler — Generic Framework (Non-Express)

### Good Example — Framework-Agnostic Handler

```typescript
// Works with any framework that gives you the raw request body
async function handleWebhook(
  rawBody: string | Buffer,
  signatureHeader: string,
): Promise<{ status: number; body: string }> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { status: 400, body: `Webhook Error: ${message}` };
  }

  await handleStripeEvent(event);

  return { status: 200, body: JSON.stringify({ received: true }) };
}
```

**Why good:** Works with any HTTP framework or serverless runtime, accepts raw body as parameter, returns status and body for the caller to send

---

## Pattern 3: Event Routing and Processing

### Good Example — Type-Safe Event Handling

```typescript
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // Checkout completed — fulfill order or provision access
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }

    // Payment succeeded
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentSuccess(paymentIntent);
      break;
    }

    // Payment failed
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentFailure(paymentIntent);
      break;
    }

    // Subscription invoice paid
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice);
      break;
    }

    // Subscription invoice failed
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentFailed(invoice);
      break;
    }

    // Subscription canceled
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCanceled(subscription);
      break;
    }

    // Dispute created
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      await handleDisputeCreated(dispute);
      break;
    }

    default:
      // Unhandled event — log but don't error
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }
}
```

**Why good:** Each event type gets its own handler, `event.data.object` cast to correct Stripe type, switch with default for unhandled events, async handlers for database operations

---

## Pattern 4: Idempotent Webhook Processing

### Good Example — Track Processed Event IDs

```typescript
// Ensure each webhook event is processed exactly once
async function handleStripeEventIdempotent(event: Stripe.Event): Promise<void> {
  // Check if this event was already processed
  const alreadyProcessed = await isEventProcessed(event.id);

  if (alreadyProcessed) {
    console.log(`Skipping already processed event: ${event.id}`);
    return;
  }

  // Process the event
  await handleStripeEvent(event);

  // Mark as processed AFTER successful handling
  await markEventProcessed(event.id, event.type);
}

// Example database functions (implement with your database solution)
async function isEventProcessed(eventId: string): Promise<boolean> {
  // Query your database for the event ID
  // e.g., SELECT 1 FROM processed_stripe_events WHERE event_id = $1
  return false; // placeholder
}

async function markEventProcessed(
  eventId: string,
  eventType: string,
): Promise<void> {
  // Insert into your database
  // e.g., INSERT INTO processed_stripe_events (event_id, event_type, processed_at)
  //       VALUES ($1, $2, NOW())
  //       ON CONFLICT (event_id) DO NOTHING
}
```

**Why good:** Prevents duplicate processing when Stripe retries delivery, event ID is globally unique, processing marked AFTER success (not before), `ON CONFLICT DO NOTHING` handles race conditions

---

## Pattern 5: Async Processing for Long Operations

### Good Example — Return 200 Immediately, Process Later

```typescript
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"]!,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    // Return 200 IMMEDIATELY — Stripe expects a response within 20 seconds
    res.json({ received: true });

    // Process asynchronously (outside the request lifecycle)
    // In production, use a message queue (not shown — use your queue solution)
    try {
      await handleStripeEventIdempotent(event);
    } catch (error) {
      // Log but don't crash — event will be retried by Stripe
      console.error(`Failed to process event ${event.id}:`, error);
    }
  },
);
```

**Why good:** 200 returned before processing, Stripe won't time out or retry unnecessarily, processing failure is logged but doesn't crash the server, Stripe will retry on next delivery

### Bad Example — Synchronous Processing

```typescript
// BAD: Processing before responding
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const event = stripe.webhooks.constructEvent(/* ... */);

    // Slow operations block the response
    await updateDatabase(event); // 500ms
    await sendConfirmationEmail(event); // 2000ms
    await notifyExternalService(event); // 1500ms

    res.json({ received: true }); // 4+ seconds later — may timeout
  },
);
```

**Why bad:** Stripe expects a response within 20 seconds, slow operations may cause timeouts, Stripe will retry the event if it times out, leading to duplicate processing

---

## Pattern 6: Webhook in Serverless Functions

### Good Example — Serverless Handler (Generic)

```typescript
// Works with serverless platforms that provide raw body access
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text(); // Raw string, not parsed JSON
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  await handleStripeEventIdempotent(event);

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Why good:** Uses Web-standard `Request`/`Response` (works in any serverless runtime), `request.text()` preserves raw body, no framework-specific middleware needed

---

_For core patterns, see [core.md](core.md). For subscriptions, see [subscriptions.md](subscriptions.md). For Connect, see [connect.md](connect.md)._
