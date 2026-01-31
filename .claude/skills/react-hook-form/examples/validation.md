# React Hook Form - Zod Validation

> Resolver pattern for schema-based validation with Zod. See [core.md](core.md) for basic form patterns.

**Prerequisites:** Understand Basic Forms from [core.md](core.md) first.

---

## Pattern 3: Resolver with Zod

### Good Example - Zod resolver integration

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SubmitHandler } from "react-hook-form";
import type { z } from "zod";
// Schema defined elsewhere - import from validation module
import { registrationSchema } from "./schemas/registration";

type RegistrationFormData = z.infer<typeof registrationSchema>;

export function RegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    watch,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: "onBlur",
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const onSubmit: SubmitHandler<RegistrationFormData> = async (data) => {
    // data is validated by schema before reaching here
    await registerUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input {...register("username")} placeholder="Username" />
        {errors.username && <span role="alert">{errors.username.message}</span>}
      </div>

      <div>
        <input {...register("email")} type="email" placeholder="Email" />
        {errors.email && <span role="alert">{errors.email.message}</span>}
      </div>

      <div>
        <input {...register("password")} type="password" placeholder="Password" />
        {errors.password && <span role="alert">{errors.password.message}</span>}
      </div>

      <div>
        <input
          {...register("confirmPassword")}
          type="password"
          placeholder="Confirm password"
        />
        {errors.confirmPassword && (
          <span role="alert">{errors.confirmPassword.message}</span>
        )}
      </div>

      <div>
        <label>
          <input type="checkbox" {...register("acceptTerms")} />
          I accept the terms and conditions
        </label>
        {errors.acceptTerms && (
          <span role="alert">{errors.acceptTerms.message}</span>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Registering..." : "Register"}
      </button>
    </form>
  );
}
```

**Why good:** zodResolver integrates schema validation seamlessly, z.infer generates types from schema automatically, all validation logic is in the schema (testable and reusable), cross-field validation (confirmPassword) handled by schema, error messages come from schema

### Schema Example (defined in validation skill)

```typescript
// schemas/registration.ts - This is validation skill territory
import { z } from "zod";

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 8;

export const registrationSchema = z
  .object({
    username: z
      .string()
      .min(MIN_USERNAME_LENGTH, `At least ${MIN_USERNAME_LENGTH} characters`)
      .max(MAX_USERNAME_LENGTH, `Max ${MAX_USERNAME_LENGTH} characters`)
      .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
```

**Note:** Schema creation is covered in the Zod validation skill. This example shows the integration point.

---
