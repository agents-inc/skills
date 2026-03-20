# Stripe Subscription Examples

> Subscription lifecycle, trials, proration, and billing patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand [Pattern 1: Client Setup](core.md#pattern-1-client-setup) and [Pattern 7: Customer Management](core.md#pattern-7-customer-management) from core examples first.

---

## Pattern 1: Create Subscription

### Good Example — With Default Payment Method

```typescript
async function createSubscription(
  customerId: string,
  priceId: string,
  trialDays?: number,
) {
  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      metadata: { created_via: "api" },
    },
    { idempotencyKey: `sub_${customerId}_${priceId}` },
  );

  // For "default_incomplete", the first invoice needs payment confirmation
  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent | null;

  return {
    subscriptionId: subscription.id,
    clientSecret: paymentIntent?.client_secret,
    status: subscription.status,
  };
}
```

**Why good:** `payment_behavior: "default_incomplete"` creates the subscription but waits for payment confirmation (SCA-ready), `save_default_payment_method` stores the card for future invoices, `expand` fetches nested objects in one call, idempotency key prevents duplicate subscriptions

### Bad Example — No Payment Behavior

```typescript
// BAD: Missing payment handling
const sub = await stripe.subscriptions.create({
  customer: "cus_abc",
  items: [{ price: "price_xyz" }],
  // No payment_behavior — defaults to "allow_incomplete"
  // No expand — requires extra API calls for invoice/payment intent
});
```

**Why bad:** `allow_incomplete` creates subscription even if first payment fails, no expand means extra API calls, no idempotency key, hardcoded IDs

---

## Pattern 2: Update Subscription (Plan Change)

### Good Example — Upgrade with Proration

```typescript
async function changeSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string,
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: "create_prorations", // Default — charge difference
      expand: ["latest_invoice.payment_intent"],
    },
  );

  return updatedSubscription;
}
```

**Why good:** Retrieves existing subscription to get the item ID, `proration_behavior` is explicit (even though "create_prorations" is the default), expand for immediate access to invoice

### Good Example — Downgrade Without Proration

```typescript
async function downgradeAtPeriodEnd(
  subscriptionId: string,
  newPriceId: string,
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: "none", // No proration — takes effect at period end
    },
  );

  return updatedSubscription;
}
```

**Why good:** `proration_behavior: "none"` avoids immediate charges, plan change takes effect at next billing cycle, appropriate for downgrades

---

## Pattern 3: Cancel Subscription

### Good Example — Immediate and End-of-Period Cancellation

```typescript
// Cancel at end of billing period (customer keeps access until then)
async function cancelAtPeriodEnd(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  return {
    cancelAt: subscription.cancel_at,
    currentPeriodEnd: subscription.current_period_end,
  };
}

// Cancel immediately (prorated refund if applicable)
async function cancelImmediately(subscriptionId: string) {
  const subscription = await stripe.subscriptions.cancel(subscriptionId, {
    prorate: true, // Refund unused time
  });

  return { status: subscription.status }; // "canceled"
}

// Reactivate a subscription scheduled for cancellation
async function reactivateSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });

  return subscription;
}
```

**Why good:** Two cancellation strategies (end-of-period vs immediate), `cancel_at_period_end: true` is user-friendly (keeps access), `prorate: true` refunds unused time on immediate cancel, reactivation by setting `cancel_at_period_end: false`

---

## Pattern 4: Trial Periods

### Good Example — Free Trial with Payment Method Required

```typescript
const TRIAL_DAYS = 14;

async function createTrialSubscription(customerId: string, priceId: string) {
  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: TRIAL_DAYS,
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      // trial_settings controls what happens when the trial ends
      trial_settings: {
        end_behavior: {
          missing_payment_method: "cancel", // Cancel if no card on file
        },
      },
      expand: ["latest_invoice.payment_intent"],
    },
    { idempotencyKey: `trial_${customerId}_${priceId}` },
  );

  return {
    subscriptionId: subscription.id,
    trialEnd: subscription.trial_end,
    status: subscription.status, // "trialing"
  };
}
```

**Why good:** Named constant for trial days, `trial_settings.end_behavior` prevents zombie subscriptions (cancels if no payment method), saves payment method for post-trial billing

---

## Pattern 5: Subscription Webhook Handling

### Good Example — Lifecycle Event Handlers

```typescript
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) {
    return; // One-time payment invoice, not subscription
  }

  // Extend access until the subscription's current_period_end
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await updateUserAccess({
    customerId:
      typeof invoice.customer === "string"
        ? invoice.customer
        : (invoice.customer?.id ?? ""),
    subscriptionId,
    accessUntil: new Date(subscription.current_period_end * 1000),
    plan: subscription.metadata.plan,
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) {
    return;
  }

  // Notify customer to update payment method
  await notifyPaymentFailed({
    customerId,
    invoiceUrl: invoice.hosted_invoice_url,
    attemptCount: invoice.attempt_count,
  });
}

async function handleSubscriptionCanceled(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) {
    return;
  }

  await revokeAccess({
    customerId,
    subscriptionId: subscription.id,
    canceledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000)
      : new Date(),
  });
}

// Placeholder functions — implement with your database solution
async function updateUserAccess(data: {
  customerId: string;
  subscriptionId: string;
  accessUntil: Date;
  plan?: string;
}): Promise<void> {}

async function notifyPaymentFailed(data: {
  customerId: string;
  invoiceUrl?: string | null;
  attemptCount: number;
}): Promise<void> {}

async function revokeAccess(data: {
  customerId: string;
  subscriptionId: string;
  canceledAt: Date;
}): Promise<void> {}
```

**Why good:** Handles the three critical subscription events, `invoice.customer` and `invoice.subscription` can be string IDs or expanded objects (handles both), timestamps converted from Unix to Date, `hosted_invoice_url` for customer self-service payment retry

---

## Pattern 6: Preview Upcoming Invoice

### Good Example — Show Proration Preview Before Plan Change

```typescript
async function previewPlanChange(
  subscriptionId: string,
  newPriceId: string,
): Promise<{
  amountDue: number;
  prorationAmount: number;
  currency: string;
}> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const invoice = await stripe.invoices.createPreview({
    customer:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    subscription: subscriptionId,
    subscription_details: {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: "create_prorations",
    },
  });

  const prorationItems = (invoice.lines?.data ?? []).filter(
    (line) => line.proration,
  );
  const prorationAmount = prorationItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  return {
    amountDue: invoice.amount_due,
    prorationAmount,
    currency: invoice.currency,
  };
}
```

**Why good:** Uses `invoices.createPreview` (the current API — replaces the deprecated `invoices.retrieveUpcoming`), shows customer exactly what they'll be charged before confirming, proration items extracted for transparent breakdown

---

_For core patterns, see [core.md](core.md). For webhooks, see [webhooks.md](webhooks.md). For Connect, see [connect.md](connect.md)._
