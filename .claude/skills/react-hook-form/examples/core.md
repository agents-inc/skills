# React Hook Form - Core Examples

> Essential patterns for React Hook Form. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [controlled-components.md](controlled-components.md) - Controller for controlled components
- [validation.md](validation.md) - Zod resolver integration
- [arrays.md](arrays.md) - useFieldArray for dynamic forms
- [performance.md](performance.md) - Performance optimization patterns
- [wizard.md](wizard.md) - Multi-step wizard forms

---

## Pattern 1: Basic Forms

### Good Example - Type-safe form with validation

```typescript
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const MIN_PASSWORD_LENGTH = 8;

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    await loginUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register("email", {
            required: "Email is required",
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: "Invalid email address",
            },
          })}
          aria-invalid={errors.email ? "true" : "false"}
        />
        {errors.email && (
          <span role="alert">{errors.email.message}</span>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register("password", {
            required: "Password is required",
            minLength: {
              value: MIN_PASSWORD_LENGTH,
              message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            },
          })}
          aria-invalid={errors.password ? "true" : "false"}
        />
        {errors.password && (
          <span role="alert">{errors.password.message}</span>
        )}
      </div>

      <div>
        <label>
          <input type="checkbox" {...register("rememberMe")} />
          Remember me
        </label>
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
```

**Why good:** TypeScript generics provide type safety, mode: "onBlur" validates only on blur for better UX, aria-invalid and role="alert" ensure accessibility, named constant for MIN_PASSWORD_LENGTH, defaultValues prevent undefined values, isSubmitting disables button during submission

### Bad Example - Missing types and poor patterns

```typescript
// WRONG: Missing types, using onChange mode, missing accessibility
export function LoginForm() {
  const { register, handleSubmit, errors } = useForm({
    mode: "onChange", // Validates on every keystroke - poor UX
  });

  const onSubmit = (data) => {
    // data is 'any' - no type safety
    loginUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email", { required: true })} />
      {errors.email && <span>Email required</span>}

      <input
        {...register("password", { minLength: 8 })} // Magic number
        type="password"
      />
      {errors.password && <span>Password too short</span>}

      <button type="submit">Login</button>
    </form>
  );
}
```

**Why bad:** no TypeScript generics means no autocomplete or type checking, mode: "onChange" shows errors while user is still typing which is jarring, magic number 8 is not documented or maintainable, missing aria attributes breaks accessibility, formState.errors destructured incorrectly in newer RHF versions

---
