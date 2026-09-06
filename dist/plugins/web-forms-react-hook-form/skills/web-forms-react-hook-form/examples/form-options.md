# React Hook Form - Form-Level Options

> Options passed to `useForm` itself, and the `<Form />` component. See [core.md](core.md) for the
> basic form and [performance.md](performance.md) for subscription APIs.

**Prerequisites:** Pattern 1 from [core.md](core.md).

---

## Pattern 7: values for External Data

`values` is reactive — the form follows the data as it changes. `defaultValues` is read once on
mount and ignores every later change.

### Good Example - Form that follows async data

```typescript
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

interface UserProfileFormData {
  displayName: string;
  email: string;
  bio: string;
}

interface UserProfileFormProps {
  userId: string;
  userData: UserProfileFormData | undefined;
}

export function UserProfileForm({ userId, userData }: UserProfileFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UserProfileFormData>({
    mode: "onBlur",
    values: userData,
    resetOptions: {
      keepDirtyValues: true, // a background refresh keeps the user's edits
    },
  });

  const onSubmit: SubmitHandler<UserProfileFormData> = async (data) => {
    await updateUser(userId, data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("displayName", { required: "Required" })} />
      {errors.displayName && <span role="alert">{errors.displayName.message}</span>}

      <input {...register("email", { required: "Required" })} type="email" />
      {errors.email && <span role="alert">{errors.email.message}</span>}

      <textarea {...register("bio")} />

      <button type="submit" disabled={!isDirty || isSubmitting}>
        Save
      </button>
    </form>
  );
}
```

**Why good:** the form tracks `userData` without a `useEffect`, `keepDirtyValues` protects edits
during a refresh, and `isDirty` stays accurate because the defaults move with the data.

### Bad Example - defaultValues for data that arrives later

```typescript
// WRONG: defaultValues is read once, on mount
export function UserProfileForm({ userId, userData }: UserProfileFormProps) {
  const { register, handleSubmit, reset } = useForm<UserProfileFormData>({
    defaultValues: userData, // still undefined on the first render
  });

  useEffect(() => {
    if (userData) {
      reset(userData); // overwrites whatever the user has typed
    }
  }, [userData, reset]);
}
```

**Why bad:** the form renders empty until the effect fires, and each refresh of `userData` resets
the form over the user's in-progress edits.

### Reset After Save

```typescript
const onSubmit: SubmitHandler<UserProfileFormData> = async (data) => {
  const saved = await updateUser(userId, data);
  reset(saved); // new values AND new defaults, so isDirty returns to false
};

// Cancel button: revert to the last saved state
<button type="button" onClick={() => reset()}>Cancel</button>;
```

`reset(next)` replaces values and defaults together. `reset()` with no argument reverts to the
current defaults.

---

## Pattern 8: disabled for the Whole Form

`disabled` on `useForm` disables every registered input and every `Controller` field at once.

```typescript
interface OrderFormData {
  product: string;
  quantity: number;
}

export function OrderForm({ isReadOnly }: { isReadOnly: boolean }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormData>({
    mode: "onBlur",
    disabled: isReadOnly,
    defaultValues: { product: "", quantity: 1 },
  });

  return (
    <form onSubmit={handleSubmit(createOrder)}>
      <input {...register("product", { required: "Required" })} />
      {errors.product && <span role="alert">{errors.product.message}</span>}

      <input type="number" {...register("quantity", { valueAsNumber: true, min: 1 })} />

      <button type="submit" disabled={isReadOnly}>Submit</button>
    </form>
  );
}
```

**Why good:** one option instead of a `disabled` prop threaded through every field, and it reaches
`Controller` fields too. The submit button is not registered, so it still takes its own prop.

---

## Pattern 9: Form Component for Progressive Enhancement

`<Form />` submits to an `action` when scripting is unavailable and validates first when it is.
Use it where the form must work without JavaScript.

```typescript
import { useForm, Form } from "react-hook-form";

const API_ENDPOINT = "/api/contact";

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export function ContactForm() {
  const {
    register,
    control,
    formState: { errors },
  } = useForm<ContactFormData>({
    mode: "onBlur",
    defaultValues: { name: "", email: "", message: "" },
  });

  return (
    <Form
      control={control}
      action={API_ENDPOINT}
      onSubmit={({ data }) => submitContactForm(data)}
      onError={({ error }) => reportError(error)}
    >
      <input {...register("name", { required: "Name required" })} />
      {errors.name && <span role="alert">{errors.name.message}</span>}

      <input {...register("email", { required: "Email required" })} type="email" />
      {errors.email && <span role="alert">{errors.email.message}</span>}

      <textarea {...register("message")} />

      <button type="submit">Send Message</button>
    </Form>
  );
}
```

**Why good:** the `action` attribute gives a native fallback, `onSubmit` receives typed and
validated data, and `onError` gets submission failures that `handleSubmit` would let escape.

---
