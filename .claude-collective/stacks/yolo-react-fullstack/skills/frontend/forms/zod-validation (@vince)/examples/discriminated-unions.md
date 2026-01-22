# Zod Discriminated Union Examples

> Type-safe union patterns with discriminator fields. See [SKILL.md](../SKILL.md) for core concepts.

---

## Discriminated Unions

### Good Example - Payment Method Union

```typescript
import { z } from "zod";

const CARD_NUMBER_LENGTH = 16;
const CVV_LENGTH = 3;

// Each variant has a discriminator field "type"
const PaymentMethodSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("card"),
    cardNumber: z
      .string()
      .length(
        CARD_NUMBER_LENGTH,
        `Card number must be ${CARD_NUMBER_LENGTH} digits`,
      ),
    expiryMonth: z.number().int().min(1).max(12),
    expiryYear: z.number().int().min(2024),
    cvv: z.string().length(CVV_LENGTH),
    cardholderName: z.string().min(1),
  }),
  z.object({
    type: z.literal("bank_transfer"),
    accountNumber: z.string(),
    routingNumber: z.string(),
    accountHolderName: z.string(),
  }),
  z.object({
    type: z.literal("paypal"),
    paypalEmail: z.string().email(),
  }),
]);

type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

// Type narrowing in switch
function processPayment(payment: PaymentMethod) {
  switch (payment.type) {
    case "card":
      // payment.cardNumber is typed as string
      return processCardPayment(payment.cardNumber, payment.cvv);

    case "bank_transfer":
      // payment.accountNumber is typed as string
      return processBankTransfer(payment.accountNumber, payment.routingNumber);

    case "paypal":
      // payment.paypalEmail is typed as string
      return processPayPalPayment(payment.paypalEmail);
  }
}
```

**Why good:** discriminatedUnion provides clear error messages about which variant failed, TypeScript narrows types correctly in switch, each variant can have completely different fields
