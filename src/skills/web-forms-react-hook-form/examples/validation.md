# React Hook Form - Schema Validation

> Wiring a validation schema into the form through `resolver`. See [core.md](core.md) for the basic
> form and per-field `register` rules.

**Prerequisites:** Pattern 1 from [core.md](core.md).

---

## Pattern 3: Resolver

The schema is authored in its own module and imported. This file shows only the wiring: `resolver`
receives the schema, and the form drops its per-field `rules`.

`@hookform/resolvers` publishes one adapter per schema library — import the one matching the schema
in use. The form code below is identical whichever it is.

### Good Example - Schema wired in, form unaware of the schema's rules

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SubmitHandler } from "react-hook-form";
import type { z } from "zod";
// Authored separately — see whichever skill owns your schema library
import { registrationSchema } from "./schemas/registration";

type RegistrationFormData = z.infer<typeof registrationSchema>;

export function RegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
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
    // data has already passed the schema
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

**Why good:** `register` calls carry no rules, so validation has exactly one home. The form type is
derived from the schema, so adding a field to the schema surfaces as a type error here rather than
as a silently unvalidated input. Cross-field rules — `confirmPassword` matching `password` — report
against `errors.confirmPassword` because the schema names that path, which per-field `rules` cannot
express.

### Two Things the Resolver Changes

- **Error messages come from the schema.** A `message` on a `register` rule is ignored once a
  resolver is set.
- **The error path must match the field name.** A cross-field rule reports wherever the schema
  points it; pointed at a path no input registers, the message renders nowhere.

---
