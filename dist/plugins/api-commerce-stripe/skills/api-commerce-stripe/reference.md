# Stripe Reference

> Decision frameworks, API quick reference, and error code lookup tables. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Payment Flow Decision Framework

```
What type of payment?
├─ One-time payment
│   ├─ Simple (no custom UI needed) → Checkout Session (mode: "payment")
│   └─ Custom UI (Stripe Elements) → Payment Intent
├─ Recurring subscription
│   ├─ Simple checkout → Checkout Session (mode: "subscription")
│   └─ Custom billing logic → stripe.subscriptions.create()
├─ Save card for later
│   └─ Checkout Session (mode: "setup") or Setup Intent
└─ Marketplace / split payment
    ├─ Pay seller directly → Destination charge (Connect)
    └─ Platform collects, distributes → Separate charges + transfers (Connect)
```

---

## Connect Charge Type Decision

```
Who processes the payment?
├─ Platform processes, sends to seller
│   ├─ Single recipient per payment → Destination charge
│   │   └─ stripe.paymentIntents.create({ transfer_data: { destination } })
│   └─ Multiple recipients per payment → Separate charges + transfers
│       └─ stripe.paymentIntents.create({ transfer_group })
│       └─ stripe.transfers.create({ destination, transfer_group })
└─ Seller processes directly
    └─ Direct charge (on_behalf_of)
        └─ stripe.paymentIntents.create({}, { stripeAccount })
```

---

## Webhook Event Priority

Handle these events for a robust integration:

| Event                           | When                          | Action                            |
| ------------------------------- | ----------------------------- | --------------------------------- |
| `checkout.session.completed`    | Customer completes checkout   | Fulfill order, provision access   |
| `payment_intent.succeeded`      | Payment confirmed             | Update order status               |
| `payment_intent.payment_failed` | Payment failed                | Notify customer, retry            |
| `invoice.paid`                  | Subscription invoice paid     | Extend subscription access        |
| `invoice.payment_failed`        | Subscription payment failed   | Notify, handle grace period       |
| `customer.subscription.updated` | Subscription changed          | Update plan in database           |
| `customer.subscription.deleted` | Subscription canceled         | Revoke access                     |
| `charge.dispute.created`        | Chargeback filed              | Flag order, gather evidence       |
| `account.updated`               | Connect account status change | Check requirements, update status |

---

## Stripe Error Types

| Error Type                  | HTTP Status | Meaning                  | Action                          |
| --------------------------- | ----------- | ------------------------ | ------------------------------- |
| `StripeCardError`           | 402         | Card declined            | Show `error.message` to user    |
| `StripeInvalidRequestError` | 400         | Invalid parameters       | Fix code (developer error)      |
| `StripeAPIError`            | 500         | Stripe internal error    | Retry with backoff              |
| `StripeConnectionError`     | N/A         | Network failure          | Retry with same idempotency key |
| `StripeAuthenticationError` | 401         | Invalid API key          | Check key configuration         |
| `StripeRateLimitError`      | 429         | Too many requests        | Retry with exponential backoff  |
| `StripePermissionError`     | 403         | Insufficient permissions | Check API key scope             |
| `StripeIdempotencyError`    | 400         | Idempotency key conflict | Generate new idempotency key    |

---

## Common Card Decline Codes

| Code                 | Meaning              | User Message              |
| -------------------- | -------------------- | ------------------------- |
| `card_declined`      | Generic decline      | "Your card was declined"  |
| `insufficient_funds` | Not enough balance   | "Insufficient funds"      |
| `expired_card`       | Card expired         | "Your card has expired"   |
| `incorrect_cvc`      | Wrong CVC            | "Incorrect security code" |
| `processing_error`   | Processing failed    | "Please try again"        |
| `lost_card`          | Card reported lost   | "Your card was declined"  |
| `stolen_card`        | Card reported stolen | "Your card was declined"  |

---

## Subscription Status Lifecycle

```
incomplete → active → past_due → canceled
                   → trialing → active
                   → paused → active
                   → unpaid → canceled
```

| Status               | Meaning                                    |
| -------------------- | ------------------------------------------ |
| `incomplete`         | First invoice not paid (within 23 hours)   |
| `incomplete_expired` | First invoice not paid within 23 hours     |
| `trialing`           | In trial period, no charge yet             |
| `active`             | Paid and current                           |
| `past_due`           | Latest invoice unpaid, retrying            |
| `unpaid`             | All retry attempts exhausted               |
| `canceled`           | Terminated (by API or failed payments)     |
| `paused`             | Temporarily paused (no invoices generated) |

---

## Currency Amounts Quick Reference

| Currency | Smallest Unit      | `amount: 1000` means |
| -------- | ------------------ | -------------------- |
| USD      | cent               | $10.00               |
| EUR      | cent               | 10.00 euro           |
| GBP      | penny              | 10.00 pound          |
| JPY      | yen (zero-decimal) | 1000 yen             |
| KRW      | won (zero-decimal) | 1000 won             |

**Zero-decimal currencies** do not need multiplication by 100. Check the Stripe docs for the full list.

---

## Idempotency Key Patterns

| Operation           | Key Pattern                           | Example                        |
| ------------------- | ------------------------------------- | ------------------------------ |
| Create customer     | `cus_create_${email}`                 | `cus_create_alice@example.com` |
| Create payment      | `pi_${orderId}`                       | `pi_order_12345`               |
| Create subscription | `sub_${customerId}_${priceId}`        | `sub_cus_abc_price_xyz`        |
| Refund              | `refund_${paymentIntentId}_${amount}` | `refund_pi_abc_2000`           |
| Transfer            | `transfer_${orderId}_${accountId}`    | `transfer_order_123_acct_xyz`  |

---

## Environment Variables

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...       # Server only — NEVER expose to client
STRIPE_PUBLISHABLE_KEY=pk_test_...  # Safe for client-side (Stripe.js)
STRIPE_WEBHOOK_SECRET=whsec_...     # Per-endpoint, used in constructEvent()
APP_URL=http://localhost:3000        # For success/cancel URLs
```

---

## Stripe CLI (Local Development)

```bash
# Install
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Listen for webhook events and forward to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Outputs: whsec_... (use as STRIPE_WEBHOOK_SECRET locally)

# Trigger a specific event for testing
stripe trigger payment_intent.succeeded
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created

# View recent events
stripe events list --limit 5
```
