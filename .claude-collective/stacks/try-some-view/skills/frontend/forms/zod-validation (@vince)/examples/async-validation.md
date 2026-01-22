# Zod Async Validation Examples

> Async refinement patterns for server-side validation. See [SKILL.md](../SKILL.md) for core concepts.

---

## Async Refinements

### Good Example - Username Availability Check

```typescript
import { z } from "zod";

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

// Async refinement for uniqueness check
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
      // Async check against database/API
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
    return { success: false, errors: result.error.flatten().fieldErrors };
  }

  return { success: true, data: result.data };
}
```

**Why good:** async refinement integrates network check into validation, safeParseAsync handles async correctly, all validation errors returned together
