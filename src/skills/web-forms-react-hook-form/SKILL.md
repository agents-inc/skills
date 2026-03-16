---
name: web-forms-react-hook-form
description: React Hook Form patterns - useForm, Controller, useFieldArray, validation resolver, performance optimization
---

# React Hook Form Patterns

> **Quick Guide:** Use `register` for native inputs, `Controller` for controlled components, `useFieldArray` for dynamic fields. Always provide `useForm<FormData>()` generics. Set `mode: "onBlur"` for optimal UX. Use resolver pattern for schema validation. Use `useWatch` instead of `watch()` in render to avoid re-rendering the whole form. Use `field.id` as key in useFieldArray -- never array index.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST provide generic types to `useForm<FormData>()` for type-safe form handling)**

**(You MUST use `field.id` as key prop in useFieldArray - NEVER use array index)**

**(You MUST use Controller for controlled components that don't expose a ref)**

**(You MUST use resolver pattern for schema validation - keep schemas separate from form logic)**

**(You MUST set `mode: "onBlur"` or `mode: "onTouched"` for optimal UX - avoid `mode: "onChange"` unless needed)**

</critical_requirements>

---

**Auto-detection:** React Hook Form, useForm, register, handleSubmit, formState, Controller, useFieldArray, useWatch, useFormContext, resolver, zodResolver, FormProvider, useFormState, FormStateSubscribe

**When to use:**

- Building forms with validation requirements
- Managing complex form state with many fields
- Creating dynamic forms with add/remove fields
- Integrating with controlled component libraries
- Handling multi-step or wizard forms

**When NOT to use:**

- Single input without validation (use useState)
- Server-only forms with server actions (use native form + action)
- Read-only data display (not a form scenario)

**Key patterns covered:**

- useForm hook with TypeScript generics
- register vs Controller decision
- useFieldArray for dynamic fields
- Resolver integration for schema validation
- useWatch and useFormState for performance
- FormProvider/useFormContext for nested components
- Form reset, async data loading, and `values` prop
- FormStateSubscribe for targeted re-renders (v7.68+)

---

<philosophy>

## Philosophy

React Hook Form prioritizes performance through uncontrolled inputs and subscription-based updates. Only fields that change re-render, not the entire form. The library isolates form state from component state, minimizing re-renders and keeping forms responsive even with many fields.

**Core Principles:**

1. **Uncontrolled by default** - Use `register` for native inputs to avoid re-renders
2. **Controlled when needed** - Use `Controller` for UI library components that don't expose a ref
3. **Schema validation via resolver** - Separate validation logic from form logic
4. **Subscription-based** - Subscribe to only the form state you need (`useWatch`, `useFormState`)
5. **Type safety** - Always provide TypeScript generics for form data

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Basic useForm with TypeScript

Always provide a type parameter, `mode`, and `defaultValues`. These three prevent the most common issues (no type safety, validation noise, undefined warnings).

```typescript
const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<ContactFormData>({
  mode: "onBlur",
  defaultValues: { name: "", email: "", message: "" },
});
```

**Why this matters:** Without generics, field names are `any`. Without `defaultValues`, values are `undefined` and cause hydration mismatches. Without `mode: "onBlur"`, the default `"onSubmit"` gives no feedback until first submit.

See [examples/core.md](examples/core.md) for complete form with accessibility attributes and error display.

---

### Pattern 2: Controller for Controlled Components

Use `Controller` when a component doesn't expose a native ref (custom selects, date pickers, rich text editors). Use `register` for standard HTML inputs.

```typescript
<Controller
  name="service"
  control={control}
  rules={{ required: "Service is required" }}
  render={({ field, fieldState: { error } }) => (
    <>
      <Select {...field} options={serviceOptions} />
      {error && <span role="alert">{error.message}</span>}
    </>
  )}
/>
```

**Key decision:** If the component accepts a `ref` prop that forwards to a native input, `register` works. Otherwise, use `Controller`.

See [examples/controlled-components.md](examples/controlled-components.md) for single select, date picker, and multi-select checkbox patterns.

---

### Pattern 3: useFieldArray for Dynamic Fields

Use `useFieldArray` for repeatable field groups. **Always use `field.id` as the React key** -- array index causes state corruption on add/remove.

```typescript
const { fields, append, remove } = useFieldArray({ control, name: "items" });

{fields.map((field, index) => (
  <div key={field.id}> {/* CRITICAL: field.id, never index */}
    <input {...register(`items.${index}.name`)} />
    <button type="button" onClick={() => remove(index)}>Remove</button>
  </div>
))}
```

**Gotcha:** `append`/`prepend`/`insert` require complete objects (not partial). Use `rules.minLength` on `useFieldArray` for minimum item validation. Array-level errors live at `errors.items.root`.

See [examples/arrays.md](examples/arrays.md) for a complete invoice form with calculated totals.

---

### Pattern 4: Resolver for Schema Validation

Use `resolver` to integrate validation schemas. The resolver handles validation; you wire it to the form. Keep schema definition separate from form code.

```typescript
import { zodResolver } from "@hookform/resolvers/zod";

const { register, handleSubmit } = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: "onBlur",
  defaultValues: { username: "", email: "" },
});
```

**Why resolver over inline rules:** Schemas are testable independently, reusable across forms, support cross-field validation (e.g. confirmPassword), and generate TypeScript types via `z.infer`.

See [examples/validation.md](examples/validation.md) for resolver integration with a registration form.

---

### Pattern 5: useWatch for Reactive Derived Values

Use `useWatch` in a separate component to subscribe to specific fields without re-rendering the entire form. Prefer `useWatch` over `watch()` in render.

```typescript
function PriceDisplay({ control }: { control: Control<PricingFormData> }) {
  const [plan, seats] = useWatch({ control, name: ["plan", "seats"] });
  return <div>Total: ${PLAN_PRICES[plan] * seats}</div>;
}
```

**v7.61+ `compute` option:** Transform watched values before subscription -- component only re-renders when the computed result changes.

```typescript
const total = useWatch({
  control,
  compute: ({ plan, seats, billingCycle }) => {
    const base = PLAN_PRICES[plan] * seats;
    return billingCycle === "annual" ? base * 12 * (1 - ANNUAL_DISCOUNT) : base;
  },
});
```

See [examples/v7-advanced.md](examples/v7-advanced.md) Pattern 7 for complete compute example.

---

### Pattern 6: useFormContext for Nested Components

Use `FormProvider` + `useFormContext` to share form methods across deeply nested components without prop drilling. Ideal for multi-section forms and wizard steps.

```typescript
// Parent
<FormProvider {...methods}>
  <form onSubmit={methods.handleSubmit(onSubmit)}>
    <AddressFields prefix="shippingAddress" />
    <AddressFields prefix="billingAddress" />
  </form>
</FormProvider>

// Child - no props needed
function AddressFields({ prefix }) {
  const { register } = useFormContext<CheckoutFormData>();
  return <input {...register(`${prefix}.street`)} />;
}
```

**When to use:** 3+ levels of nesting or reusable form sections. For 1-2 levels, passing `control`/`register` as props is simpler.

See [examples/wizard.md](examples/wizard.md) for a complete multi-step wizard using FormProvider with per-step validation via `trigger()`.

---

### Pattern 7: Form Reset and Async Data

**Two approaches for loading external data into a form:**

1. **`values` prop (v7.x+, preferred):** Reactively updates form when external data changes. Pair with `resetOptions: { keepDirtyValues: true }` to preserve user edits.

2. **`reset()` in useEffect (legacy):** Manually reset when data arrives. Use `reset(data)` which updates both values AND defaultValues for proper `isDirty` tracking.

```typescript
// Modern: values prop (reactive, auto-updates)
useForm<FormData>({
  values: userData,
  resetOptions: { keepDirtyValues: true },
});

// Legacy: manual reset
useEffect(() => {
  if (data) reset(data);
}, [data, reset]);
```

**Cancel/save pattern:** `reset()` without args reverts to defaultValues. After save, call `reset(data)` to update defaultValues and clear `isDirty`.

See [examples/v7-advanced.md](examples/v7-advanced.md) Pattern 1 for `values` prop with async data.

---

### Pattern 8: Isolated Error Display

Use `useFormState` with `name` to create error components that only re-render when their specific field's error changes. For v7.68+, `FormStateSubscribe` provides the same isolation as a component.

```typescript
function FieldError<T extends FieldValues>({ control, name }: Props<T>) {
  const { errors } = useFormState({ control, name });
  const error = errors[name];
  if (!error) return null;
  return <span role="alert">{error.message as string}</span>;
}
```

See [examples/performance.md](examples/performance.md) for a complete large form with isolated subscriptions, and [examples/v7-advanced.md](examples/v7-advanced.md) Pattern 4 for `FormStateSubscribe`.

</patterns>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Basic form with accessibility and error display
- [examples/controlled-components.md](examples/controlled-components.md) - Controller for select, date picker, multi-select
- [examples/validation.md](examples/validation.md) - Resolver integration with Zod
- [examples/arrays.md](examples/arrays.md) - useFieldArray with invoice line items
- [examples/performance.md](examples/performance.md) - Isolated subscriptions for large forms
- [examples/wizard.md](examples/wizard.md) - Multi-step wizard with per-step validation
- [examples/v7-advanced.md](examples/v7-advanced.md) - values prop, Form component, FormStateSubscribe, compute
- [reference.md](reference.md) - Decision frameworks, checklists, anti-patterns

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using array index as key in useFieldArray -- causes state corruption on add/remove/reorder
- Missing TypeScript generics on `useForm` -- loses type safety for field names and values
- Using `register` for components that don't expose ref -- use Controller instead
- Not providing `defaultValues` -- causes hydration mismatches and undefined warnings

**Medium Priority Issues:**

- Using `mode: "onChange"` without reason -- validates on every keystroke, noisy UX
- Destructuring many `formState` properties -- subscribes to all, causes unnecessary re-renders
- Using `watch()` in render body -- triggers re-render on every field change; use `useWatch` instead
- Calling `setValue` without `shouldValidate: true` -- may leave form in invalid state
- Not using `trigger(fieldNames)` for step validation in wizard forms

**Gotchas & Edge Cases:**

- `reset()` reverts to defaultValues; `reset(newData)` updates both values AND defaultValues
- `handleSubmit` does not catch errors thrown in your `onSubmit` callback -- handle errors yourself with try/catch
- `append`/`prepend`/`insert` require complete objects, not partial data
- Array-level errors live at `errors.arrayName.root`, item errors at `errors.arrayName[index].fieldName`
- `shouldUnregister: true` removes unmounted field values -- keep `false` (default) for wizard forms
- `useWatch` returns `defaultValue` on first render before subscription kicks in
- `setValue` does not directly update `useFieldArray` -- use `replace()` API instead
- `FormStateSubscribe` requires `FormProvider` wrapping the form
- `values` prop (reactive external data) vs `defaultValues` (static initial values) -- do not mix their use cases

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST provide generic types to `useForm<FormData>()` for type-safe form handling)**

**(You MUST use `field.id` as key prop in useFieldArray - NEVER use array index)**

**(You MUST use Controller for controlled components that don't expose a ref)**

**(You MUST use resolver pattern for schema validation - keep schemas separate from form logic)**

**(You MUST set `mode: "onBlur"` or `mode: "onTouched"` for optimal UX - avoid `mode: "onChange"` unless needed)**

**Failure to follow these rules will break form validation, cause re-render issues, and reduce type safety.**

</critical_reminders>
