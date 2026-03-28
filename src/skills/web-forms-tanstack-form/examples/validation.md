# TanStack Form - Validation Examples

> Validation patterns for TanStack Form. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for the validator events table.

**Related Examples:**

- [core.md](core.md) - Basic form, TypeScript, submission
- [arrays.md](arrays.md) - Dynamic array fields
- [composition.md](composition.md) - createFormHook, listeners

---

## Pattern 1: Sync Field Validation

Validators return a string (error message) or `undefined` (valid).

```tsx
<form.Field
  name="username"
  validators={{
    onChange: ({ value }) => {
      if (!value) return "Username is required";
      if (value.length < 3) return "Must be at least 3 characters";
      if (!/^[a-z0-9_-]+$/.test(value))
        return "Only lowercase, numbers, hyphens, underscores";
      return undefined;
    },
  }}
  children={(field) => (
    <div>
      <label htmlFor={field.name}>Username</label>
      <input
        id={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={field.state.meta.errors.length > 0}
      />
      {field.state.meta.errors.map((err) => (
        <em key={err} role="alert">
          {err}
        </em>
      ))}
    </div>
  )}
/>
```

---

## Pattern 2: Async Field Validation

Use `onChangeAsync` or `onBlurAsync` for server-side checks. Combine with a sync validator — the async validator only runs if the sync one passes.

```tsx
<form.Field
  name="username"
  validators={{
    onChange: ({ value }) =>
      value.length < 3 ? "Must be at least 3 characters" : undefined,
    onBlurAsync: async ({ value }) => {
      const available = await checkUsernameAvailability(value);
      return available ? undefined : "Username is already taken";
    },
  }}
  children={(field) => (
    <div>
      <label htmlFor={field.name}>Username</label>
      <input
        id={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {field.state.meta.isValidating && <span>Checking...</span>}
      {field.state.meta.errors.map((err) => (
        <em key={err} role="alert">
          {err}
        </em>
      ))}
    </div>
  )}
/>
```

**Sync-first gating:** If `onChange` returns an error (e.g., too short), `onBlurAsync` does not run. This avoids unnecessary API calls for obviously invalid input.

**`isValidating`:** `field.state.meta.isValidating` is `true` while an async validator is running. Use it for loading indicators.

---

## Pattern 3: Form-Level Validation with Server Errors

Form-level `onSubmitAsync` can return errors for specific fields. This is ideal for server-side validation where multiple fields may be invalid.

```tsx
const form = useForm({
  defaultValues: {
    username: "",
    email: "",
    age: 0,
  },
  validators: {
    onSubmitAsync: async ({ value }) => {
      const result = await registerUser(value);

      if (!result.success) {
        return {
          form: "Registration failed",
          fields: {
            ...(result.errors.username
              ? { username: result.errors.username }
              : {}),
            ...(result.errors.email ? { email: result.errors.email } : {}),
          },
        };
      }
      return null;
    },
  },
  onSubmit: async ({ value }) => {
    await finalizeRegistration(value);
  },
});
```

**Return shape:** `{ form?: string, fields: Record<string, string> }`. The `form` key sets a form-level error; `fields` maps field names to their error strings. Return `null` when valid.

**Order:** Form-level validators run before `onSubmit`. If `onSubmitAsync` returns errors, `onSubmit` does not fire.

---

## Pattern 4: Linked Fields (Cross-Field Validation)

Use `onChangeListenTo` to re-run a field's validator when a related field changes.

```tsx
import { useForm } from "@tanstack/react-form";

export function PasswordForm() {
  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      await changePassword(value.password);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) =>
            value.length < 8 ? "Must be at least 8 characters" : undefined,
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Password</label>
            <input
              id={field.name}
              type="password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((err) => (
              <em key={err} role="alert">
                {err}
              </em>
            ))}
          </div>
        )}
      />

      <form.Field
        name="confirmPassword"
        validators={{
          onChangeListenTo: ["password"],
          onChange: ({ value, fieldApi }) => {
            if (value !== fieldApi.form.getFieldValue("password")) {
              return "Passwords do not match";
            }
            return undefined;
          },
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Confirm Password</label>
            <input
              id={field.name}
              type="password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((err) => (
              <em key={err} role="alert">
                {err}
              </em>
            ))}
          </div>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        children={([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Saving..." : "Change Password"}
          </button>
        )}
      />
    </form>
  );
}
```

**Why `onChangeListenTo` is essential:** Without it, changing the password field does NOT re-validate `confirmPassword`. The "passwords do not match" error remains stale until the user interacts with the confirm field. With `onChangeListenTo: ["password"]`, changing either field triggers the match check.

---

## Pattern 5: Standard Schema Integration

TanStack Form accepts any Standard Schema-compatible library (Zod, Valibot, ArkType) directly in validators — no adapter/resolver package needed.

```tsx
import { z } from "zod";

const emailSchema = z.string().email("Invalid email address");
const ageSchema = z
  .number()
  .min(13, "Must be at least 13")
  .max(120, "Invalid age");

export function ProfileForm() {
  const form = useForm({
    defaultValues: { email: "", age: 0 },
    onSubmit: async ({ value }) => {
      await saveProfile(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="email"
        validators={{ onBlur: emailSchema }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Email</label>
            <input
              id={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((err) => (
              <em key={err} role="alert">
                {err}
              </em>
            ))}
          </div>
        )}
      />

      <form.Field
        name="age"
        validators={{ onBlur: ageSchema }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Age</label>
            <input
              id={field.name}
              type="number"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.valueAsNumber)}
            />
            {field.state.meta.errors.map((err) => (
              <em key={err} role="alert">
                {err}
              </em>
            ))}
          </div>
        )}
      />
    </form>
  );
}
```

**How it works:** TanStack Form detects the Standard Schema interface on the validator value and uses it directly. No `zodResolver` import. The schema's error messages are used as-is.

**Mixing schemas and functions:** You can use a schema for one event and a function for another on the same field:

```tsx
validators={{
  onChange: z.string().min(1, "Required"),
  onBlurAsync: async ({ value }) => {
    const exists = await checkEmail(value);
    return exists ? "Email already registered" : undefined;
  },
}}
```
