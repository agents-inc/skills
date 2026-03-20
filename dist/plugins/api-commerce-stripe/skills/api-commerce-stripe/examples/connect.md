# Stripe Connect Examples

> Connected accounts, transfers, destination charges, and platform fees. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand [Pattern 1: Client Setup](core.md#pattern-1-client-setup) and [Pattern 3: Payment Intent](core.md#pattern-4-payment-intent--custom-flow) from core examples first.

---

## Pattern 1: Create Connected Account

### Good Example — Express Account (Recommended for Most Platforms)

```typescript
async function createConnectedAccount(email: string, country: string = "US") {
  const account = await stripe.accounts.create({
    type: "express", // Stripe-hosted onboarding
    country,
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { platform_user_id: email },
  });

  return account;
}
```

**Why good:** `express` type uses Stripe-hosted onboarding (least work for platforms), `card_payments` and `transfers` capabilities are the minimum for receiving payments, metadata links to your platform's user

### Good Example — Generate Onboarding Link

```typescript
async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl, // If link expires, user returns here
    return_url: returnUrl, // After completing onboarding
    type: "account_onboarding",
  });

  return accountLink.url;
}
```

**Why good:** `refresh_url` handles expired links gracefully, `return_url` redirects after successful onboarding, `account_onboarding` type for initial setup

---

## Pattern 2: Destination Charges (Single Recipient)

Use when each payment goes to one connected account. The platform can take an application fee.

### Good Example — Payment with Application Fee

```typescript
const PLATFORM_FEE_PERCENT = 10;
const CENTS_PER_DOLLAR = 100;

async function createDestinationCharge(
  amountInCents: number,
  currency: string,
  connectedAccountId: string,
  customerId?: string,
) {
  const applicationFee = Math.round(
    amountInCents * (PLATFORM_FEE_PERCENT / CENTS_PER_DOLLAR),
  );

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountInCents,
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: connectedAccountId,
      },
      metadata: {
        seller_account: connectedAccountId,
        platform_fee: String(applicationFee),
      },
    },
    { idempotencyKey: `dest_${connectedAccountId}_${Date.now()}` },
  );

  return { clientSecret: paymentIntent.client_secret };
}
```

**Why good:** `application_fee_amount` is the platform's cut (goes to platform's Stripe balance), `transfer_data.destination` sends the remainder to the connected account, fee calculated as percentage with named constants, metadata for audit trail

---

## Pattern 3: Separate Charges and Transfers (Multiple Recipients)

Use when a single payment needs to be split among multiple connected accounts (e.g., marketplace with multiple sellers in one cart).

### Good Example — Payment with Transfer Group

```typescript
async function createMarketplacePayment(
  amountInCents: number,
  currency: string,
  orderId: string,
  customerId?: string,
) {
  const transferGroup = `order_${orderId}`;

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountInCents,
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      transfer_group: transferGroup,
      metadata: { order_id: orderId },
    },
    { idempotencyKey: `pi_${orderId}` },
  );

  return {
    clientSecret: paymentIntent.client_secret,
    transferGroup,
  };
}

// After payment succeeds (typically in a webhook handler)
async function distributePayment(
  transferGroup: string,
  distributions: Array<{
    accountId: string;
    amountInCents: number;
  }>,
) {
  const transfers = await Promise.all(
    distributions.map((dist) =>
      stripe.transfers.create(
        {
          amount: dist.amountInCents,
          currency: "usd",
          destination: dist.accountId,
          transfer_group: transferGroup,
        },
        {
          idempotencyKey: `transfer_${transferGroup}_${dist.accountId}`,
        },
      ),
    ),
  );

  return transfers;
}
```

**Why good:** `transfer_group` links payment and transfers for reconciliation, transfers created after payment succeeds (via webhook), idempotency keys prevent duplicate transfers, each seller gets their own transfer

**When to use:** Marketplaces with multi-seller carts, food delivery (restaurant + driver), service platforms (provider + platform)

---

## Pattern 4: Direct Charges (On Behalf Of)

Use when the connected account processes the payment directly. The platform can still take a fee.

### Good Example — Charge on Connected Account

```typescript
async function createDirectCharge(
  amountInCents: number,
  currency: string,
  connectedAccountId: string,
  platformFeeInCents: number,
) {
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFeeInCents,
    },
    {
      stripeAccount: connectedAccountId, // Charge on connected account
      idempotencyKey: `direct_${connectedAccountId}_${Date.now()}`,
    },
  );

  return { clientSecret: paymentIntent.client_secret };
}
```

**Why good:** `stripeAccount` in request options makes the API call on behalf of the connected account, `application_fee_amount` goes to the platform, the connected account handles disputes and refunds

---

## Pattern 5: Check Account Status

### Good Example — Verify Onboarding and Capabilities

```typescript
interface AccountStatus {
  isOnboarded: boolean;
  canReceivePayments: boolean;
  canReceiveTransfers: boolean;
  requiresAction: boolean;
  disabledReason?: string;
}

async function getAccountStatus(accountId: string): Promise<AccountStatus> {
  const account = await stripe.accounts.retrieve(accountId);

  const cardPayments = account.capabilities?.card_payments;
  const transfers = account.capabilities?.transfers;

  return {
    isOnboarded: account.details_submitted ?? false,
    canReceivePayments: cardPayments === "active",
    canReceiveTransfers: transfers === "active",
    requiresAction: (account.requirements?.currently_due?.length ?? 0) > 0,
    disabledReason: account.requirements?.disabled_reason ?? undefined,
  };
}
```

**Why good:** Checks both `details_submitted` and capability status, `requirements.currently_due` indicates what Stripe still needs, `disabled_reason` explains why an account can't transact

---

## Pattern 6: Connect Webhook Handling

### Good Example — Listen for Connect Events

```typescript
// Connect events arrive on a SEPARATE webhook endpoint
// Register at: Dashboard > Developers > Webhooks > "Connected accounts"

async function handleConnectEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;

      // Check if onboarding is complete
      if (account.details_submitted && account.charges_enabled) {
        await activateSellerAccount(account.id);
      }

      // Check if account has issues
      if (
        account.requirements?.currently_due &&
        account.requirements.currently_due.length > 0
      ) {
        await notifySellerRequirements(
          account.id,
          account.requirements.currently_due,
        );
      }
      break;
    }

    case "payout.failed": {
      // Payout to connected account's bank failed
      const payout = event.data.object as Stripe.Payout;
      await handlePayoutFailure(event.account!, payout);
      break;
    }

    default:
      console.log(`Unhandled Connect event: ${event.type}`);
  }
}

// Placeholder functions
async function activateSellerAccount(accountId: string): Promise<void> {}
async function notifySellerRequirements(
  accountId: string,
  requirements: string[],
): Promise<void> {}
async function handlePayoutFailure(
  accountId: string,
  payout: Stripe.Payout,
): Promise<void> {}
```

**Why good:** Connect events are on a separate webhook endpoint, `event.account` identifies which connected account triggered the event, checks both `details_submitted` and `charges_enabled`, tracks outstanding requirements

---

_For core patterns, see [core.md](core.md). For webhooks, see [webhooks.md](webhooks.md). For subscriptions, see [subscriptions.md](subscriptions.md)._
