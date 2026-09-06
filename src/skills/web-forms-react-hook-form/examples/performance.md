# React Hook Form - Isolated Subscriptions

> Keeping re-renders inside the component that reads the state. See [core.md](core.md) for the basic
> form and [form-options.md](form-options.md) for `useForm` options.

**Prerequisites:** Pattern 1 from [core.md](core.md).

---

## Pattern 5: Isolated Error and Derived-Value Components

Each subscribing component re-renders on its own. The form component subscribes to nothing, so
typing anywhere re-renders only the one field's error and any derived display that names it.

### Good Example - Subscriptions pushed into leaf components

```typescript
import { useForm, useFormState, useWatch } from "react-hook-form";
import type { Control, FieldPath, FieldValues, SubmitHandler } from "react-hook-form";

interface LargeFormData {
  firstName: string;
  lastName: string;
  email: string;
  notes: string;
}

const MAX_NOTES_LENGTH = 500;

// Re-renders only when this field's error changes
function FieldError<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const { errors } = useFormState({ control, name });
  const error = errors[name];

  if (!error) return null;
  return <span role="alert">{error.message as string}</span>;
}

// Re-renders only when notes changes
function NotesCounter({ control }: { control: Control<LargeFormData> }) {
  const notes = useWatch({ control, name: "notes" });

  return (
    <span>
      {notes?.length || 0} / {MAX_NOTES_LENGTH}
    </span>
  );
}

export function LargeForm() {
  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LargeFormData>({
    mode: "onBlur",
    defaultValues: { firstName: "", lastName: "", email: "", notes: "" },
  });

  const onSubmit: SubmitHandler<LargeFormData> = async (data) => {
    await saveForm(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input {...register("firstName", { required: "Required" })} />
        <FieldError control={control} name="firstName" />
      </div>

      <div>
        <input {...register("lastName", { required: "Required" })} />
        <FieldError control={control} name="lastName" />
      </div>

      <div>
        <input {...register("email", { required: "Required" })} type="email" />
        <FieldError control={control} name="email" />
      </div>

      <div>
        <textarea {...register("notes")} />
        <NotesCounter control={control} />
        <FieldError control={control} name="notes" />
      </div>

      <button type="submit" disabled={isSubmitting}>
        Submit
      </button>
    </form>
  );
}
```

**Why good:** `useFormState` with `name` narrows the subscription to one field, `useWatch` isolates
the counter, and the form component destructures only `isSubmitting` so nothing else re-renders it.

### Bad Example - One wide subscription at the top

```typescript
// WRONG: the form component subscribes to everything
export function LargeForm() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid, isDirty, touchedFields, dirtyFields },
  } = useForm();

  return (
    <form>
      <input {...register("field1")} />
      {errors.field1 && <span>{errors.field1.message}</span>}

      <textarea {...register("notes")} />
      <span>{watch("notes")?.length} characters</span>
    </form>
  );
}
```

**Why bad:** destructuring five `formState` properties subscribes to all five, and `watch()` in the
render body subscribes to every field — so each keystroke re-renders the whole form, including
fields that cannot have changed.

---

## Pattern 10: FormStateSubscribe

`FormStateSubscribe` is the component form of `useFormState`: the subscription lives in the element
rather than in a wrapper component, so no extra component is needed per subscription.

**Props:**

| Prop       | Type               | Default | Description                                      |
| ---------- | ------------------ | ------- | ------------------------------------------------ |
| `control`  | Object             | —       | From `useForm`; optional inside a `FormProvider` |
| `name`     | string \| string[] | —       | Field(s) to subscribe to; omit for all           |
| `disabled` | boolean            | `false` | Suspend the subscription                         |
| `exact`    | boolean            | `false` | Match the field name exactly, not nested paths   |
| `render`   | Function           | —       | Receives the subscribed form state               |

### Good Example - Submit button and error summary, each isolated

```typescript
import { useForm, FormProvider, FormStateSubscribe } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

interface RegistrationFormData {
  username: string;
  email: string;
  password: string;
}

function SubmitButton() {
  return (
    <FormStateSubscribe
      render={({ isValid, isSubmitting }) => (
        <button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? "Registering..." : "Register"}
        </button>
      )}
    />
  );
}

function ErrorSummary() {
  return (
    <FormStateSubscribe
      render={({ errors }) => {
        const messages = Object.values(errors)
          .filter(Boolean)
          .map((error) => error?.message);

        if (messages.length === 0) return null;

        return (
          <div role="alert">
            <strong>Please fix the following errors:</strong>
            <ul>
              {messages.map((msg) => (
                <li key={msg as string}>{msg as string}</li>
              ))}
            </ul>
          </div>
        );
      }}
    />
  );
}

export function RegistrationForm() {
  const methods = useForm<RegistrationFormData>({
    mode: "onBlur",
    defaultValues: { username: "", email: "", password: "" },
  });

  const onSubmit: SubmitHandler<RegistrationFormData> = async (data) => {
    await registerUser(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <input {...methods.register("username", { required: "Username required" })} />
        <input {...methods.register("email", { required: "Email required" })} type="email" />
        <input {...methods.register("password", { required: "Password required" })} type="password" />

        <ErrorSummary />
        <SubmitButton />
      </form>
    </FormProvider>
  );
}
```

**Why good:** the submit button does not re-render when an error appears, and the summary does not
re-render when `isSubmitting` flips. Inside `FormProvider`, neither needs `control` passed down.

### Good Example - Per-field errors with name and exact

```typescript
interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const { register, control, handleSubmit } = useForm<LoginFormData>({
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email", { required: "Email required" })} />
      <FormStateSubscribe
        control={control}
        name="email"
        exact={true}
        render={({ errors }) =>
          errors.email ? <span role="alert">{errors.email.message}</span> : null
        }
      />

      <input {...register("password", { required: "Password required" })} type="password" />
      <FormStateSubscribe
        control={control}
        name="password"
        exact={true}
        render={({ errors }) =>
          errors.password ? <span role="alert">{errors.password.message}</span> : null
        }
      />

      <button type="submit">Login</button>
    </form>
  );
}
```

**Why good:** `exact: true` stops `email` from also matching nested paths beneath it, so each
message re-renders only for its own field.

---

## Pattern 11: useWatch with exact

Without `exact`, a name matches itself and everything nested under it. That is what you want for an
array and not what you want when one field name is a prefix of another.

```typescript
import { useForm, useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";

interface FormData {
  items: { name: string; price: number }[];
  itemsCount: number;
}

function ItemsCounter({ control }: { control: Control<FormData> }) {
  const count = useWatch({
    control,
    name: "itemsCount",
    exact: true, // without this, "items" changes would also fire
  });

  return <span>Count: {count}</span>;
}

function ItemsPriceTotal({ control }: { control: Control<FormData> }) {
  const items = useWatch({
    control,
    name: "items",
    exact: false, // default — also fires on items.0.price
  });

  const total = items?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;

  return <span>Total: ${total.toFixed(2)}</span>;
}
```

**Why good:** the counter ignores edits inside `items`, while the total deliberately watches nested
paths so a price change reaches it.

---

## Pattern 12: useWatch with compute

`compute` runs on every change but re-renders only when its return value differs. Use it when many
fields feed one displayed number.

```typescript
interface PricingFormData {
  plan: "basic" | "pro" | "enterprise";
  seats: number;
  billingCycle: "monthly" | "annual";
  couponCode: string;
}

const PLAN_PRICES = { basic: 10, pro: 25, enterprise: 50 } as const;
const MONTHS_PER_YEAR = 12;
const ANNUAL_DISCOUNT = 0.2;
const COUPON_DISCOUNT = 0.1;
const VALID_COUPON = "SAVE10";

function PriceDisplay({ control }: { control: Control<PricingFormData> }) {
  const price = useWatch({
    control,
    compute: ({ plan, seats, billingCycle, couponCode }) => {
      const base = PLAN_PRICES[plan] * seats;
      const cycled =
        billingCycle === "annual"
          ? base * MONTHS_PER_YEAR * (1 - ANNUAL_DISCOUNT)
          : base;

      return couponCode === VALID_COUPON ? cycled * (1 - COUPON_DISCOUNT) : cycled;
    },
  });

  return <div>Total: ${price.toFixed(2)}</div>;
}
```

**Why good:** typing an invalid coupon code changes no price, so the component does not re-render —
which a plain `useWatch` over the four fields plus a `useMemo` could not achieve.

---
