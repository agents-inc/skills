# Zod Nested Schema Examples

> Complex nested object patterns with cross-field validation. See [SKILL.md](../SKILL.md) for core concepts.

---

## Complex Nested Schemas

### Good Example - E-commerce Order Schema

```typescript
import { z } from "zod";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

// Address schema (reusable)
const AddressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid postal code"),
  country: z.string().length(2, "Use 2-letter country code"),
});

// Order item schema
const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  price: z.number().positive(),
  quantity: z
    .number()
    .int()
    .min(MIN_QUANTITY, `Minimum quantity is ${MIN_QUANTITY}`)
    .max(MAX_QUANTITY, `Maximum quantity is ${MAX_QUANTITY}`),
});

// Complete order schema
const OrderSchema = z
  .object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    items: z.array(OrderItemSchema).min(1, "Order must have at least one item"),
    shippingAddress: AddressSchema,
    billingAddress: AddressSchema.optional(),
    useSameAddressForBilling: z.boolean().default(true),
    notes: z.string().max(500).optional(),
    createdAt: z.string().datetime(),
  })
  .refine(
    (order) => {
      // If not using same address, billing address is required
      if (!order.useSameAddressForBilling && !order.billingAddress) {
        return false;
      }
      return true;
    },
    {
      message: "Billing address is required when not using shipping address",
      path: ["billingAddress"],
    },
  );

type Order = z.infer<typeof OrderSchema>;
type Address = z.infer<typeof AddressSchema>;
type OrderItem = z.infer<typeof OrderItemSchema>;

export { OrderSchema, AddressSchema, OrderItemSchema };
export type { Order, Address, OrderItem };
```

**Why good:** nested schemas are reusable, array validation with min, cross-field refinement for conditional requirement, all types derived from schemas
