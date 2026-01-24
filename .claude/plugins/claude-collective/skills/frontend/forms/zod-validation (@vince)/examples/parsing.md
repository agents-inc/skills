# Zod Parsing & Error Handling Examples

> Safe parsing and error formatting patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Safe Parsing

### Good Example - Comprehensive Error Handling

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

// Type-safe result type
type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };

function validateContactForm(input: unknown): ValidationResult<ContactForm> {
  const result = ContactFormSchema.safeParse(input);

  if (!result.success) {
    // Flatten errors to field -> messages format
    const flattened = result.error.flatten();
    return {
      success: false,
      errors: flattened.fieldErrors as Record<string, string[]>,
    };
  }

  return { success: true, data: result.data };
}

// Usage
const formData = {
  name: "",
  email: "invalid",
  message: "Hi",
};

const validation = validateContactForm(formData);

if (!validation.success) {
  // validation.errors: { name: ["Name is required"], email: ["Invalid email format"], message: ["..."] }
  console.log(validation.errors);
}
```

**Why good:** safeParse never throws, flattened errors are easy to display per-field, discriminated union result is type-safe

### Good Example - API Response Validation

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
type ApiResponse = z.infer<typeof ApiResponseSchema>;

async function fetchUser(id: string): Promise<ApiUser> {
  const response = await fetch(`/api/users/${id}`);
  const json = await response.json();

  // Validate API response at trust boundary
  const result = ApiResponseSchema.safeParse(json);

  if (!result.success) {
    // Log validation errors for debugging
    console.error("API response validation failed:", result.error.issues);
    throw new Error("Invalid API response format");
  }

  return result.data.data;
}
```

**Why good:** validates response before using data, catches backend breaking changes at runtime, logs specific issues for debugging

---

## Error Formatting

### Good Example - User-Friendly Error Messages

```typescript
import { z } from "zod";

const FormSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  age: z.number().min(18, "You must be at least 18 years old"),
});

type FormErrors = Record<string, string>;

function formatZodErrors(error: z.ZodError): FormErrors {
  const errors: FormErrors = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    // Only keep first error per field
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return errors;
}

// Alternative: use built-in flatten
function flattenErrors(error: z.ZodError): Record<string, string[]> {
  const flattened = error.flatten();
  return flattened.fieldErrors as Record<string, string[]>;
}

// Usage
const result = FormSchema.safeParse({ email: "invalid", age: 16 });

if (!result.success) {
  const errors = formatZodErrors(result.error);
  // { email: "Please enter a valid email", age: "You must be at least 18 years old" }
}
```

**Why good:** custom formatter gives first error per field for cleaner UI, flatten provides all errors per field if needed
