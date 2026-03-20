# Zod Validation - Core Examples

> Essential schema definition, parsing, error handling, and composition patterns. See [SKILL.md](../SKILL.md) for decision guidance.

---

## Pattern 1: Complete Schema with Reusable Sub-Schemas

```typescript
import { z } from "zod";

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;
const MIN_PASSWORD_LENGTH = 8;
const MIN_AGE = 13;
const MAX_AGE = 120;
const MAX_BIO_LENGTH = 500;

// Reusable email schema
const EmailSchema = z
  .string()
  .email("Please enter a valid email address")
  .toLowerCase();

// Reusable password schema with refinements
const PasswordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  )
  .refine((pwd) => /[A-Z]/.test(pwd), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((pwd) => /[a-z]/.test(pwd), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((pwd) => /[0-9]/.test(pwd), {
    message: "Password must contain at least one number",
  });

// Complete user schema
const UserSchema = z.object({
  username: z
    .string()
    .min(
      MIN_USERNAME_LENGTH,
      `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
    )
    .max(
      MAX_USERNAME_LENGTH,
      `Username cannot exceed ${MAX_USERNAME_LENGTH} characters`,
    )
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores",
    ),
  email: EmailSchema,
  password: PasswordSchema,
  age: z
    .number()
    .int("Age must be a whole number")
    .min(MIN_AGE, `You must be at least ${MIN_AGE} years old`)
    .max(MAX_AGE, `Age cannot exceed ${MAX_AGE}`)
    .optional(),
  bio: z
    .string()
    .max(MAX_BIO_LENGTH, `Bio cannot exceed ${MAX_BIO_LENGTH} characters`)
    .optional(),
  website: z.string().url("Please enter a valid URL").optional(),
  role: z.enum(["user", "admin", "moderator"]).default("user"),
});

type User = z.infer<typeof UserSchema>;

export { UserSchema, EmailSchema, PasswordSchema };
export type { User };
```

**Why good:** named constants for all limits, reusable sub-schemas, descriptive error messages, proper optional handling, type derived from schema

---

## Pattern 2: Safe Parsing with Error Formatting

### Form Validation

```typescript
import { z } from "zod";

const ContactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message cannot exceed 1000 characters"),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    .optional(),
});

type ContactForm = z.infer<typeof ContactFormSchema>;

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };

function validateContactForm(input: unknown): ValidationResult<ContactForm> {
  const result = ContactFormSchema.safeParse(input);

  if (!result.success) {
    const { fieldErrors } = z.flattenError(result.error);
    return {
      success: false,
      errors: fieldErrors as Record<string, string[]>,
    };
  }

  return { success: true, data: result.data };
}
```

**Why good:** safeParse never throws, flattened errors map to form fields, discriminated union result is type-safe

### API Response Validation

```typescript
import { z } from "zod";

const ApiUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

const ApiResponseSchema = z.object({
  data: ApiUserSchema,
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string().datetime(),
  }),
});

type ApiUser = z.infer<typeof ApiUserSchema>;

async function fetchUser(id: string): Promise<ApiUser> {
  const response = await fetch(`/api/users/${id}`);
  const json = await response.json();

  // Validate at trust boundary
  const result = ApiResponseSchema.safeParse(json);

  if (!result.success) {
    console.error("API response validation failed:", result.error.issues);
    throw new Error("Invalid API response format");
  }

  return result.data.data;
}
```

**Why good:** validates response before using data, catches backend breaking changes at runtime, logs specific issues for debugging

### Error Formatting Helpers

```typescript
import { z } from "zod";

// First error per field (for forms showing one error at a time)
function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return errors;
}

// Custom error map for consistent messaging (v4 uses `error` param)
// Per-schema:
const NameSchema = z.string({
  error: (issue) =>
    issue.input === undefined ? "This field is required" : "Must be a string",
});

// Global error map (v4):
z.config({
  customError: (issue) => {
    if (issue.code === "invalid_type" && issue.input === undefined) {
      return "This field is required";
    }
  },
});
```

---

## Pattern 3: Schema Composition for CRUD

```typescript
import { z } from "zod";

// Base entity schema (shared fields)
const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Article content schema
const ArticleContentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
});

// Full article schema (for reading)
const ArticleSchema = BaseEntitySchema.extend({
  ...ArticleContentSchema.shape,
  author: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

// Create schema (no id, timestamps, or author)
const CreateArticleSchema = ArticleContentSchema;

// Update schema (all content fields optional)
const UpdateArticleSchema = ArticleContentSchema.partial();

// Summary schema (for lists)
const ArticleSummarySchema = ArticleSchema.pick({
  id: true,
  title: true,
  published: true,
  createdAt: true,
  author: true,
});

type Article = z.infer<typeof ArticleSchema>;
type CreateArticle = z.infer<typeof CreateArticleSchema>;
type UpdateArticle = z.infer<typeof UpdateArticleSchema>;
type ArticleSummary = z.infer<typeof ArticleSummarySchema>;

export {
  ArticleSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
  ArticleSummarySchema,
};
export type { Article, CreateArticle, UpdateArticle, ArticleSummary };
```

**Why good:** base schema is reused, pick/partial create focused schemas for specific operations, extend adds fields cleanly

---

## Pattern 4: Discriminated Unions with Type Narrowing

```typescript
import { z } from "zod";

const CARD_NUMBER_LENGTH = 16;
const CVV_LENGTH = 3;

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

// Type narrowing works in switch
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

**Why good:** discriminatedUnion provides clear error messages about which variant failed, TypeScript narrows types correctly in switch

---

## Pattern 5: Nested Schemas with Cross-Field Validation

```typescript
import { z } from "zod";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

const AddressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid postal code"),
  country: z.string().length(2, "Use 2-letter country code"),
});

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

**Why good:** nested schemas are reusable, cross-field refinement for conditional requirement, all types derived from schemas

---

## Pattern 6: Async Validation

Use `refine` with async functions for server-side checks. **Must** use `safeParseAsync`.

```typescript
import { z } from "zod";

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

const UsernameSchema = z
  .string()
  .min(
    MIN_USERNAME_LENGTH,
    `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
  )
  .max(
    MAX_USERNAME_LENGTH,
    `Username cannot exceed ${MAX_USERNAME_LENGTH} characters`,
  )
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores",
  )
  .refine(
    async (username) => {
      const response = await fetch(
        `/api/check-username?username=${encodeURIComponent(username)}`,
      );
      const { available } = await response.json();
      return available;
    },
    { message: "This username is already taken" },
  );

const RegistrationSchema = z.object({
  username: UsernameSchema,
  email: z.string().email(),
  password: z.string().min(8),
});

// MUST use async parsing
async function validateRegistration(data: unknown) {
  const result = await RegistrationSchema.safeParseAsync(data);

  if (!result.success) {
    return { success: false, errors: z.flattenError(result.error).fieldErrors };
  }

  return { success: true, data: result.data };
}
```

**Why good:** async refinement integrates network check into validation, safeParseAsync handles async correctly, all validation errors returned together

**When to use:** Database uniqueness checks, external API validation, permission checks requiring network calls
