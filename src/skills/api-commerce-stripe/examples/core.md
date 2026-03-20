# Stripe Core Examples

> Client setup, Checkout Sessions, Payment Intents, and error handling patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Webhooks:** See [webhooks.md](webhooks.md). **Subscriptions:** See [subscriptions.md](subscriptions.md). **Connect:** See [connect.md](connect.md).

---

## Pattern 1: Client Setup

### Good Example — Typed Singleton with Pinned API Version

```typescript
// lib/stripe.ts
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});
```

**Why good:** Secret key from environment variable, API version pinned for predictable behavior, singleton export for reuse

### Bad Example — Hardcoded Key, No Version Pin

```typescript
import Stripe from "stripe";

// BAD: Hardcoded secret, no version pin
const stripe = new Stripe("sk_live_abc123...");
```

**Why bad:** Hardcoded secret key leaks in source control, no `apiVersion` means silent behavior changes on Stripe updates

---

## Pattern 2: Checkout Session — One-Time Payment

### Good Example — With Metadata and Customer

```typescript
async function createCheckoutSession(
  priceId: string,
  quantity: number,
  customerId?: string,
) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity }],
    success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/cancel`,
    customer: customerId,
    payment_intent_data: {
      metadata: { source: "web_checkout" },
    },
  });

  return { sessionId: session.id, url: session.url };
}
```

**Why good:** `{CHECKOUT_SESSION_ID}` is a Stripe template variable (replaced automatically), metadata for tracking, `session.url` returned for redirect

### Bad Example — Hardcoded URLs

```typescript
// BAD: Hardcoded URLs, no metadata
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [{ price: "price_abc", quantity: 1 }],
  success_url: "http://localhost:3000/success", // Hardcoded, no session ID
  cancel_url: "http://localhost:3000/cancel",
});
```

**Why bad:** Hardcoded URLs break in production, missing `{CHECKOUT_SESSION_ID}` prevents retrieval on success page, no metadata for tracking

---

## Pattern 3: Checkout Session — Subscription

### Good Example — With Trial and Metadata

```typescript
const TRIAL_DAYS = 14;

async function createSubscriptionCheckout(priceId: string, customerId: string) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: customerId,
    success_url: `${process.env.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/pricing`,
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { plan: "pro" },
    },
  });

  return { sessionId: session.id, url: session.url };
}
```

**Why good:** Named constant for trial days, `subscription_data.metadata` carries through to the subscription object, customer pre-linked

---

## Pattern 4: Payment Intent — Custom Flow

### Good Example — With Idempotency Key

```typescript
const CURRENCY = "usd";

async function createPaymentIntent(
  amountInCents: number,
  customerId: string,
  orderId: string,
) {
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountInCents,
      currency: CURRENCY,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { order_id: orderId },
    },
    { idempotencyKey: `pi_${orderId}` },
  );

  return { clientSecret: paymentIntent.client_secret };
}
```

**Why good:** Parameter named `amountInCents` removes ambiguity, idempotency key tied to order ID (same order = same payment), `automatic_payment_methods` is the modern approach, `client_secret` returned for frontend

### Bad Example — No Idempotency, Legacy Payment Methods

```typescript
// BAD: Missing idempotency key, legacy approach
async function createPayment(amount: number) {
  const pi = await stripe.paymentIntents.create({
    amount, // Dollars or cents? Ambiguous!
    currency: "usd",
    payment_method_types: ["card"], // Legacy array
  });
  return pi;
}
```

**Why bad:** No idempotency key risks duplicate charges, `amount` parameter name is ambiguous, `payment_method_types` is legacy (use `automatic_payment_methods`), no customer or metadata

---

## Pattern 5: Retrieving and Expanding Objects

### Good Example — Expand Related Objects

```typescript
// Retrieve a checkout session with expanded payment intent and line items
async function getCheckoutDetails(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent", "line_items"],
  });

  // session.payment_intent is now a full PaymentIntent object, not just an ID
  const paymentIntent = session.payment_intent as Stripe.PaymentIntent;
  const lineItems = session.line_items?.data ?? [];

  return { session, paymentIntent, lineItems };
}

// Retrieve subscription with latest invoice and payment intent
async function getSubscriptionPaymentStatus(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice.payment_intent"],
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const pi = invoice.payment_intent as Stripe.PaymentIntent;

  return { status: pi.status, subscription };
}
```

**Why good:** `expand` fetches nested objects in a single API call (avoids multiple round-trips), cast to full type since Stripe returns expanded objects as `string | Object`

---

## Pattern 6: Error Handling — Complete Pattern

### Good Example — Typed Error Handling

```typescript
import Stripe from "stripe";

interface PaymentResult {
  success: boolean;
  error?: {
    type: string;
    message: string;
    code?: string;
    declineCode?: string;
    requestId?: string;
  };
}

async function processPayment(paymentIntentId: string): Promise<PaymentResult> {
  try {
    await stripe.paymentIntents.confirm(paymentIntentId);
    return { success: true };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      return {
        success: false,
        error: {
          type: "card_error",
          message: error.message,
          code: error.code,
          declineCode: error.raw?.decline_code as string | undefined,
        },
      };
    }

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      // Developer error — log and throw
      console.error(`[Stripe] Invalid request: ${error.message}`, {
        requestId: error.requestId,
        param: error.raw?.param,
      });
      throw error;
    }

    if (error instanceof Stripe.errors.StripeRateLimitError) {
      // Retry-able
      throw new Error("Rate limited — retry with backoff");
    }

    if (error instanceof Stripe.errors.StripeConnectionError) {
      // Network issue — safe to retry with same idempotency key
      throw new Error("Connection failed — retry");
    }

    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      // Critical configuration error
      throw new Error("Invalid Stripe API key");
    }

    throw error;
  }
}
```

**Why good:** Each error type gets appropriate handling, card errors return user-safe messages, developer errors include `requestId` for Stripe support debugging, connection errors hint at retry safety

### Bad Example — Swallowing Errors

```typescript
// BAD: Silent catch
async function charge(piId: string) {
  try {
    return await stripe.paymentIntents.confirm(piId);
  } catch {
    return null; // Payment failure hidden!
  }
}
```

**Why bad:** Error completely swallowed, caller has no idea payment failed, no logging for debugging, null return hides the actual problem

---

## Pattern 7: Customer Management

### Good Example — Create with Idempotency

```typescript
async function findOrCreateCustomer(
  email: string,
  name: string,
): Promise<Stripe.Customer> {
  // Check if customer exists
  const existing = await stripe.customers.list({ email, limit: 1 });

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Create new customer with idempotency key
  const customer = await stripe.customers.create(
    { email, name, metadata: { source: "api" } },
    { idempotencyKey: `cus_${email}` },
  );

  return customer;
}
```

**Why good:** Checks for existing customer before creating (avoids duplicates), idempotency key based on email, typed return `Stripe.Customer`

### Good Example — Attach Payment Method

```typescript
async function attachAndSetDefault(
  customerId: string,
  paymentMethodId: string,
) {
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}
```

**Why good:** Two-step process: attach first, then set as default for invoices. `invoice_settings.default_payment_method` ensures subscriptions charge the right card.

---

## Pattern 8: Products and Prices

### Good Example — Create Product with Recurring Price

```typescript
async function createProductWithPrice(
  name: string,
  description: string,
  amountInCents: number,
  currency: string,
  interval?: "month" | "year",
) {
  const product = await stripe.products.create({
    name,
    description,
    metadata: { managed_by: "api" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountInCents,
    currency,
    ...(interval ? { recurring: { interval } } : {}),
  });

  return { productId: product.id, priceId: price.id };
}
```

**Why good:** Products and prices are separate resources (Stripe's data model), `unit_amount` named clearly, conditional `recurring` only for subscriptions

### Good Example — List Active Prices for a Product

```typescript
async function getActivePrices(productId: string) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    expand: ["data.product"],
  });

  return prices.data;
}
```

**Why good:** Filters to `active: true` (excludes archived prices), `expand` fetches product data in the same call

---

## Pattern 9: Refunds

### Good Example — Full and Partial Refunds

```typescript
async function refundPayment(
  paymentIntentId: string,
  amountInCents?: number,
  reason?: Stripe.RefundCreateParams.Reason,
) {
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      amount: amountInCents, // Omit for full refund
      reason,
    },
    {
      idempotencyKey: `refund_${paymentIntentId}_${amountInCents ?? "full"}`,
    },
  );

  return refund;
}
```

**Why good:** Omitting `amount` refunds the full payment, `reason` uses Stripe's typed enum, idempotency key unique per refund amount

---

_For webhook handling, see [webhooks.md](webhooks.md). For subscriptions, see [subscriptions.md](subscriptions.md). For Connect, see [connect.md](connect.md)._
