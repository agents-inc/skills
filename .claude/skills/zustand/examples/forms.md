# Client State - Form Examples

Form state and validation patterns with good/bad comparisons.

**Related Examples:**

- [Core Examples](core.md) - Essential state management patterns (useState, Zustand, Context, URL state)

---

## Pattern 6: Form State and Validation

### Controlled Component Pattern

```typescript
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

const MIN_PASSWORD_LENGTH = 8;
const INITIAL_EMAIL = "";
const INITIAL_PASSWORD = "";

export const LoginForm = () => {
  const [email, setEmail] = useState(INITIAL_EMAIL);
  const [password, setPassword] = useState(INITIAL_PASSWORD);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email) {
      setErrors({ ...errors, email: "" });
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password) {
      setErrors({ ...errors, password: "" });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = "Email is required";
    if (password.length < MIN_PASSWORD_LENGTH) {
      newErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (error) {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={handleEmailChange}
        aria-invalid={!!errors.email}
      />
      {errors.email && <span className="error">{errors.email}</span>}

      <input
        type="password"
        value={password}
        onChange={handlePasswordChange}
        aria-invalid={!!errors.password}
      />
      {errors.password && <span className="error">{errors.password}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
};
```

**Why good:** Named constants for validation rules and initial values, errors clear when user starts fixing field, explicit event typing for type safety, loading state prevents double-submission, aria-invalid for accessibility

### Zod Schema Validation

```typescript
import { z } from "zod";

const MIN_DESCRIPTION_LENGTH = 10;
const MIN_SALARY = 0;

const JobFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z
      .string()
      .min(
        MIN_DESCRIPTION_LENGTH,
        `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`,
      ),
    salaryMin: z.number().positive().optional(),
    salaryMax: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.salaryMin && data.salaryMax) {
        return data.salaryMax > data.salaryMin;
      }
      return true;
    },
    {
      message: "Maximum salary must be greater than minimum salary",
      path: ["salaryMax"],
    },
  );

type JobFormData = z.infer<typeof JobFormSchema>;

export { JobFormSchema };
export type { JobFormData };
```

**Why good:** Named constants for validation thresholds, type inference from schema, cross-field validation with refine, descriptive error messages, named exports

**When to use:** Forms with validation requirements, especially with cross-field validation or complex rules.

**When not to use:** Simple single-input forms like search boxes.
