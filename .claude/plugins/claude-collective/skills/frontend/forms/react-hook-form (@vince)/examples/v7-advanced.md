# React Hook Form - v7.6x+ Advanced Features

> Advanced patterns and new features added in React Hook Form v7.46-v7.71. See [core.md](core.md) for basic form patterns.

**Prerequisites:** Understand Basic Forms from [core.md](core.md), [controlled-components.md](controlled-components.md), and [performance.md](performance.md) first.

---

## Pattern 1: values Prop for Async Data

Use `values` instead of `defaultValues` when loading async data. The `values` prop reactively updates the form when external data changes.

### Good Example - Reactive form with async data

```typescript
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import type { SubmitHandler } from "react-hook-form";

interface UserProfileFormData {
  displayName: string;
  email: string;
  bio: string;
}

interface UserProfileFormProps {
  userId: string;
}

export function UserProfileForm({ userId }: UserProfileFormProps) {
  // Fetch user data with your data fetching solution
  const { data: userData } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UserProfileFormData>({
    mode: "onBlur",
    // values prop reactively updates form when userData changes
    values: userData,
    // resetOptions controls what happens when values change
    resetOptions: {
      keepDirtyValues: true, // Keep user edits when data refreshes
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

**Why good:** `values` prop automatically updates form when data changes without manual reset() calls, `keepDirtyValues: true` preserves user edits during data refreshes, cleaner than useEffect + reset pattern, isDirty works correctly with external data

### Bad Example - Using defaultValues with async data

```typescript
// WRONG: defaultValues only works on first render
export function UserProfileForm({ userId }: UserProfileFormProps) {
  const { data: userData } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
  });

  const { register, handleSubmit, reset } = useForm<UserProfileFormData>({
    // defaultValues doesn't update when userData changes!
    defaultValues: userData,
  });

  // Need manual reset - error-prone and verbose
  useEffect(() => {
    if (userData) {
      reset(userData);
    }
  }, [userData, reset]);

  // ...
}
```

**Why bad:** defaultValues only initializes once on first render, requires manual useEffect + reset pattern, easy to forget dependency array or create stale closures, doesn't preserve user edits by default

---

## Pattern 2: disabled Form Option

Use the `disabled` prop on `useForm` to disable an entire form and all its inputs (v7.48.0+).

### Good Example - Form with disabled state

```typescript
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

interface OrderFormData {
  product: string;
  quantity: number;
}

interface OrderFormProps {
  isReadOnly: boolean;
}

export function OrderForm({ isReadOnly }: OrderFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormData>({
    mode: "onBlur",
    // disabled prop disables entire form and all registered inputs
    disabled: isReadOnly,
    defaultValues: {
      product: "",
      quantity: 1,
    },
  });

  const onSubmit: SubmitHandler<OrderFormData> = async (data) => {
    await createOrder(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* All inputs automatically disabled when form is disabled */}
      <input {...register("product", { required: "Required" })} />
      {errors.product && <span role="alert">{errors.product.message}</span>}

      <input
        type="number"
        {...register("quantity", { valueAsNumber: true, min: 1 })}
      />

      <button type="submit" disabled={isReadOnly}>
        Submit
      </button>
    </form>
  );
}
```

**Why good:** single prop disables entire form consistently, no need to add disabled to each input individually, works with all registered inputs and Controller components, cleaner than passing disabled prop to every field

---

## Pattern 3: Form Component for Progressive Enhancement

Use the `<Form />` component for progressive enhancement with server actions or native form submissions (v7.46.0+).

### Good Example - Form with action support

```typescript
import { useForm, Form } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

const API_ENDPOINT = "/api/contact";

export function ContactForm() {
  const {
    register,
    control,
    formState: { errors },
  } = useForm<ContactFormData>({
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });

  const onSubmit: SubmitHandler<ContactFormData> = async (data) => {
    console.log("Form submitted:", data);
  };

  const onError = (error: unknown) => {
    console.error("Submission error:", error);
  };

  return (
    <Form
      control={control}
      action={API_ENDPOINT}
      onSubmit={({ data }) => onSubmit(data)}
      onError={({ error }) => onError(error)}
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

**Why good:** supports native form action for progressive enhancement, works with Next.js Server Actions, provides onSubmit and onError callbacks with typed data, validates before submission like handleSubmit

---

## Pattern 4: FormStateSubscribe for Targeted Re-renders

Use `FormStateSubscribe` to create components that only re-render when specific form state changes (v7.68.0+).

**FormStateSubscribe Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `control` | Object | - | Control from useForm (optional with FormProvider) |
| `name` | string \| string[] | - | Subscribe to specific field(s) or all fields |
| `disabled` | boolean | false | Disable the subscription |
| `exact` | boolean | false | Enable exact match for field name subscriptions |
| `render` | Function | - | Render function receiving form state |

### Good Example - Isolated submit button state

```typescript
import { useForm, FormProvider, FormStateSubscribe } from "react-hook-form";
import type { SubmitHandler, Control } from "react-hook-form";

interface RegistrationFormData {
  username: string;
  email: string;
  password: string;
}

// Submit button that only re-renders when isValid/isSubmitting changes
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

// Error summary that only re-renders when errors change
function ErrorSummary() {
  return (
    <FormStateSubscribe
      render={({ errors }) => {
        const errorMessages = Object.values(errors)
          .filter(Boolean)
          .map((error) => error?.message);

        if (errorMessages.length === 0) return null;

        return (
          <div role="alert">
            <strong>Please fix the following errors:</strong>
            <ul>
              {errorMessages.map((msg, index) => (
                <li key={index}>{msg as string}</li>
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
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
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

**Why good:** FormStateSubscribe isolates re-renders to only when subscribed state changes, SubmitButton doesn't re-render when errors change, ErrorSummary doesn't re-render when isSubmitting changes, better performance than destructuring entire formState

### Good Example - Field-specific error with name prop

```typescript
import { useForm, FormStateSubscribe } from "react-hook-form";

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
      {/* Only re-renders when email field errors change */}
      <FormStateSubscribe
        control={control}
        name="email"
        exact={true}
        render={({ errors }) => (
          errors.email ? <span role="alert">{errors.email.message}</span> : null
        )}
      />

      <input {...register("password", { required: "Password required" })} type="password" />
      {/* Only re-renders when password field errors change */}
      <FormStateSubscribe
        control={control}
        name="password"
        exact={true}
        render={({ errors }) => (
          errors.password ? <span role="alert">{errors.password.message}</span> : null
        )}
      />

      <button type="submit">Login</button>
    </form>
  );
}
```

**Why good:** `name` prop targets specific field, `exact: true` prevents matching nested paths, each FormStateSubscribe only re-renders when its field's error changes, more performant than useFormState hook in some cases

---

## Pattern 5: reset with keepFieldsRef Option

Use `keepFieldsRef` option when resetting to avoid re-registering input refs (v7.60.0+).

### Good Example - Reset with preserved refs

```typescript
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

interface FormData {
  name: string;
  email: string;
}

interface FormProps {
  initialData: FormData;
}

export function FormWithPreservedRefs({ initialData }: FormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    mode: "onBlur",
    defaultValues: initialData,
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    await saveData(data);
    // Reset with keepFieldsRef to avoid re-registering inputs
    // Useful for performance in forms with many fields
    reset(data, { keepFieldsRef: true });
  };

  const handleExternalDataUpdate = (newData: FormData) => {
    // keepFieldsRef prevents DOM manipulation of input refs
    reset(newData, { keepFieldsRef: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("name", { required: "Required" })} />
      <input {...register("email", { required: "Required" })} type="email" />

      <button type="submit" disabled={isSubmitting}>
        Save
      </button>
    </form>
  );
}
```

**Why good:** `keepFieldsRef: true` avoids re-registering input refs after reset, improves performance in forms with many fields, prevents unnecessary DOM operations, useful when frequently resetting with new data

---

## Pattern 6: useWatch with exact Option

Use the `exact` option with `useWatch` to match field names exactly (v7.47.0+).

### Good Example - Exact field name matching

```typescript
import { useForm, useWatch } from "react-hook-form";

interface FormData {
  items: { name: string; price: number }[];
  itemsCount: number;
}

function ItemsCounter({ control }: { control: Control<FormData> }) {
  // Without exact, "items" would also trigger on "items.0.name" changes
  // With exact: true, only triggers when "itemsCount" changes
  const count = useWatch({
    control,
    name: "itemsCount",
    exact: true, // Only match "itemsCount" exactly, not "itemsCountSomething"
  });

  return <span>Count: {count}</span>;
}

function ItemsPriceTotal({ control }: { control: Control<FormData> }) {
  // Watch entire items array - triggers on any items change
  const items = useWatch({
    control,
    name: "items",
    exact: false, // Default - matches "items" and all nested paths
  });

  const total = items?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;

  return <span>Total: ${total.toFixed(2)}</span>;
}

export function ItemsForm() {
  const { control, register } = useForm<FormData>({
    defaultValues: {
      items: [{ name: "", price: 0 }],
      itemsCount: 1,
    },
  });

  return (
    <form>
      {/* Form fields */}
      <ItemsCounter control={control} />
      <ItemsPriceTotal control={control} />
    </form>
  );
}
```

**Why good:** `exact: true` prevents unintended re-renders from similarly named fields, useful when you have fields like "items" and "itemsCount" in same form, provides fine-grained control over subscription behavior

---

## Pattern 7: useWatch with compute Option

Use the `compute` function for selective/computed subscriptions with conditional logic.

### Good Example - Computed subscription

```typescript
import { useForm, useWatch } from "react-hook-form";

interface PricingFormData {
  plan: "basic" | "pro" | "enterprise";
  seats: number;
  billingCycle: "monthly" | "annual";
  couponCode: string;
}

const PLAN_PRICES = {
  basic: 10,
  pro: 25,
  enterprise: 50,
} as const;

const ANNUAL_DISCOUNT = 0.2;
const COUPON_DISCOUNT = 0.1;
const VALID_COUPON = "SAVE10";

function PriceDisplay({ control }: { control: Control<PricingFormData> }) {
  // compute allows selective subscription with transformation
  const price = useWatch({
    control,
    // compute function receives all watched values
    compute: ({ plan, seats, billingCycle, couponCode }) => {
      const basePrice = PLAN_PRICES[plan] * seats;
      let total = billingCycle === "annual"
        ? basePrice * 12 * (1 - ANNUAL_DISCOUNT)
        : basePrice;

      // Apply coupon if valid
      if (couponCode === VALID_COUPON) {
        total = total * (1 - COUPON_DISCOUNT);
      }

      return total;
    },
  });

  return <div>Total: ${price.toFixed(2)}</div>;
}

export function PricingForm() {
  const { control, register } = useForm<PricingFormData>({
    defaultValues: {
      plan: "basic",
      seats: 1,
      billingCycle: "monthly",
      couponCode: "",
    },
  });

  return (
    <form>
      <select {...register("plan")}>
        <option value="basic">Basic</option>
        <option value="pro">Pro</option>
        <option value="enterprise">Enterprise</option>
      </select>

      <input type="number" {...register("seats", { valueAsNumber: true })} />

      <select {...register("billingCycle")}>
        <option value="monthly">Monthly</option>
        <option value="annual">Annual</option>
      </select>

      <input {...register("couponCode")} placeholder="Coupon code" />

      <PriceDisplay control={control} />
    </form>
  );
}
```

**Why good:** compute function transforms watched values before subscription, only re-renders when computed result changes (not on every field change), cleaner than separate useWatch + useMemo, encapsulates business logic in single location

---

## Quick Reference

### New useForm Options (v7.46+)

| Option         | Version | Description                                                         |
| -------------- | ------- | ------------------------------------------------------------------- |
| `values`       | v7.x    | Reactive values for external state updates (replaces reset pattern) |
| `disabled`     | v7.48.0 | Disable entire form and all inputs                                  |
| `resetOptions` | v7.x    | Controls behavior when values/defaultValues update                  |

### New reset Options (v7.47+)

| Option                   | Version | Description                       |
| ------------------------ | ------- | --------------------------------- |
| `keepIsSubmitSuccessful` | v7.47.0 | Preserve isSubmitSuccessful state |
| `keepFieldsRef`          | v7.60.0 | Skip input ref re-registration    |

### New Components (v7.46+)

| Component                | Version | Use Case                                   |
| ------------------------ | ------- | ------------------------------------------ |
| `<Form />`               | v7.46.0 | Progressive enhancement, Server Actions    |
| `<FormStateSubscribe />` | v7.68.0 | Targeted re-renders for specific formState |

### New useWatch Options (v7.47+)

| Option    | Version | Description                                  |
| --------- | ------- | -------------------------------------------- |
| `exact`   | v7.47.0 | Match field names exactly                    |
| `compute` | v7.x    | Transform/compute values before subscription |

### v7.71 Performance Improvements

| Improvement              | Version | Description                                              |
| ------------------------ | ------- | -------------------------------------------------------- |
| FormProvider memoization | v7.71.0 | Context value memoized to prevent unnecessary rerenders  |
| Separate control context | v7.71.0 | Control context separated to reduce rerender scope       |
| Ghost elements fix       | v7.70.0 | Prevents field array ghost elements with keepDirtyValues |
