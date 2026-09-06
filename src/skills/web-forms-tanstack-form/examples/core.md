# TanStack Form - Core Examples

> Essential patterns for TanStack Form. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API tables.

**Additional Examples:**

- [validation.md](validation.md) - Sync/async validation, validator adapters, cross-field
- [arrays.md](arrays.md) - Dynamic array fields
- [composition.md](composition.md) - createFormHook, listeners, side effects

---

## Pattern 1: Basic Form with Error Display

### Good Example - Type-safe form with accessibility

```tsx
import { useForm } from "@tanstack/react-form";

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export function ContactForm() {
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      message: "",
    } satisfies ContactFormData,
    onSubmit: async ({ value }) => {
      await submitContact(value);
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
        name="name"
        validators={{
          onChange: ({ value }) => (!value ? "Name is required" : undefined),
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Name</label>
            <input
              id={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.map((error) => (
              <span key={error} role="alert">
                {error}
              </span>
            ))}
          </div>
        )}
      />

      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) =>
            !value
              ? "Email is required"
              : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                ? "Invalid email"
                : undefined,
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Email</label>
            <input
              id={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.map((error) => (
              <span key={error} role="alert">
                {error}
              </span>
            ))}
          </div>
        )}
      />

      <form.Field
        name="message"
        validators={{
          onChange: ({ value }) => (!value ? "Message is required" : undefined),
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Message</label>
            <textarea
              id={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.map((error) => (
              <span key={error} role="alert">
                {error}
              </span>
            ))}
          </div>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        children={([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Sending..." : "Send"}
          </button>
        )}
      />
    </form>
  );
}
```

**Why good:** `defaultValues` provides type inference, `e.preventDefault()` prevents page reload, `aria-invalid` and `role="alert"` ensure accessibility, errors are `.map()`'d as an array, `form.Subscribe` scopes re-renders to only the submit button state.

### Bad Example - Missing fundamentals

```tsx
// WRONG: No defaultValues, no preventDefault, errors not handled as array
export function ContactForm() {
  const form = useForm({
    onSubmit: async ({ value }) => {
      await submitContact(value);
    },
  });

  return (
    <form onSubmit={() => form.handleSubmit()}>
      {" "}
      {/* Missing preventDefault */}
      <form.Field
        name="name"
        children={(field) => (
          <div>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors && <span>{field.state.meta.errors}</span>}
            {/* WRONG: errors is an array, not a string */}
          </div>
        )}
      />
      <button type="submit">Send</button> {/* No disabled state */}
    </form>
  );
}
```

**Why bad:** No `defaultValues` means field values start as `undefined` and types are not inferred. Missing `e.preventDefault()` causes page reload. Treating `errors` as a string instead of an array silently fails. No `onBlur` handler means `isTouched` never updates. Submit button has no loading or disabled state.

---

## Pattern 2: TypeScript — everything is inferred from defaultValues

`defaultValues` is the only place the form's shape is declared. Field names, `field.state.value` and the `onSubmit` payload all come from it.

```tsx
const form = useForm({
  defaultValues: {
    name: "",
    age: 0,
    role: "user" as "user" | "admin",
  },
  onSubmit: async ({ value }) => {
    // value is { name: string; age: number; role: "user" | "admin" }
    await saveUser(value);
  },
});
```

### Where a default cannot represent the type on its own

A union that starts as one variant, or a value that is only ever `null` until the user supplies it, needs the widening written into the default — a cast at the property, not a generic on the hook.

```tsx
const form = useForm({
  defaultValues: {
    name: "",
    role: "user" as "user" | "admin",
    avatar: null as File | null,
    tags: [] as string[],
  },
  onSubmit: async ({ value }) => {
    await saveUser(value);
  },
});
```

**Do not reach for `useForm<UserFormData>()`.** `useForm` carries a generic parameter per validator slot, and TypeScript requires all or none — supplying only the form-data one is a compile error, and supplying the rest by hand defeats the point. The library's [philosophy page](https://tanstack.com/form/latest/docs/philosophy) states the rule directly: "You should never need to pass a generic or use an internal type when leveraging TanStack Form."

---

## Pattern 3: Form Submission with Error Handling

```tsx
const form = useForm({
  defaultValues: { email: "", password: "" },
  onSubmit: async ({ value }) => {
    try {
      await loginUser(value);
    } catch (error) {
      // handleSubmit does NOT catch errors in onSubmit — you must handle them
      form.setErrorMap({ onSubmit: getErrorMessage(error) });
    }
  },
});

return (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      form.handleSubmit();
    }}
  >
    {/* fields */}

    <form.Subscribe
      selector={(state) => state.errorMap}
      children={(errorMap) =>
        errorMap.onSubmit ? <div role="alert">{errorMap.onSubmit}</div> : null
      }
    />

    <form.Subscribe
      selector={(state) => [state.canSubmit, state.isSubmitting] as const}
      children={([canSubmit, isSubmitting]) => (
        <button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      )}
    />
  </form>
);
```

**Key point:** `form.handleSubmit()` does not catch errors thrown inside your `onSubmit` callback. Always wrap async operations in try/catch and use `form.setErrorMap()` to surface errors to the UI.

---

## Pattern 4: Form Reset

```tsx
const form = useForm({
  defaultValues: { name: "", email: "" },
  onSubmit: async ({ value }) => {
    await saveProfile(value);
    // Reset to defaults after successful save
    form.reset();
  },
});

// Reset to specific values (also updates defaultValues for isDirty tracking)
function handleLoadProfile(profile: ProfileData) {
  form.reset(profile);
}

// Reset a single field
function handleClearEmail() {
  form.resetField("email");
}
```

**`reset()` behavior:** Without arguments, reverts to original `defaultValues`. With arguments, updates both values AND defaultValues — so `isDirty` correctly reflects the new baseline.
