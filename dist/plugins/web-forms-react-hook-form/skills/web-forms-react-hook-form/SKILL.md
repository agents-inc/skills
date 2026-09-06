---
name: web-forms-react-hook-form
description: React Hook Form patterns - useForm, Controller, useFieldArray, validation resolver, performance optimization
---

# React Hook Form Patterns

> **Quick Guide:** `register` binds native inputs and keeps them uncontrolled; `Controller` wraps
> components that hold their own value; `useFieldArray` drives repeatable rows and is keyed on
> `field.id`. Validation arrives either as `register` rules or as a schema through `resolver`.
> Re-renders are the thing to watch: `useWatch` and `useFormState` subscribe to named fields,
> whereas `watch()` and a wide `formState` destructure subscribe to the whole form.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — a type-safe form with `register`, error display and accessibility attributes
- [examples/controlled-components.md](examples/controlled-components.md) — `Controller` around a select, a date picker and a checkbox group
- [examples/validation.md](examples/validation.md) — wiring a schema in through `resolver`
- [examples/arrays.md](examples/arrays.md) — `useFieldArray` line items with a live total
- [examples/performance.md](examples/performance.md) — isolated subscriptions, `FormStateSubscribe`, `useWatch` `exact` and `compute`
- [examples/form-options.md](examples/form-options.md) — the `values` prop for async data, `disabled`, the `<Form />` component
- [examples/wizard.md](examples/wizard.md) — multi-step form with per-step `trigger()`
- [reference.md](reference.md) — decision trees, API tables, version-to-feature lookup

---

## Which path applies

- **A native `input`, `select` or `textarea`** — `register` hands the ref to the form, the field
  stays uncontrolled, and typing re-renders nothing. Follow [examples/core.md](examples/core.md).
- **A component that owns its value** — a custom select, date picker or rich text editor exposes no
  usable ref, so `Controller` supplies `value` and `onChange` and confines the re-render to that
  field. Follow [examples/controlled-components.md](examples/controlled-components.md).
- **Validation stated as a schema rather than as `register` rules** — pass it through `resolver` and
  the field-level `rules` drop out. Follow [examples/validation.md](examples/validation.md).

---

<critical_requirements>

## Before writing React Hook Form code

**Call `useForm<FormData>()` with a generic and with `defaultValues` for every field.** The generic
types each field path and the submit payload; the defaults mount every input controlled from the
first render.

**Key `useFieldArray` rows on `field.id`.** It is the identity RHF assigns the row and it survives
add, remove and reorder, which an array index does not.

**Reach for `Controller` as soon as a component holds its own value.** `register` needs a ref that
reaches a native input, and a component that does not forward one never joins the form.

**Set `mode` to `"onBlur"` or `"onTouched"`.** The default `"onSubmit"` withholds feedback until the
first submit, and `"onChange"` validates on every keystroke.

**Pass schema validation through `resolver`, with the schema in its own module.** A schema outside
the component is testable on its own and reusable across forms, and the form keeps only the wiring.

</critical_requirements>

---

**Auto-detection:** react-hook-form, useForm, register, handleSubmit, formState, Controller,
useFieldArray, useWatch, useFormContext, useFormState, FormProvider, FormStateSubscribe, SubmitHandler,
resolver, shouldUnregister, valueAsNumber

**Applies to:**

- Form state, submission and validation wiring in React
- Repeatable field groups that add, remove and reorder
- Components that hold their own value and need bridging into the form
- Multi-step flows where one form spans several screens
- Narrowing re-renders in a form with many fields

**Handled elsewhere:**

- Authoring the validation schema — `resolver` accepts a schema object and this skill only wires it
  in; how the schema states its rules is settled by whatever owns it.
- Where the initial values came from — the form receives them as a prop or through the `values`
  option and fetches nothing itself.
- Markup and styling of the inputs — every example uses plain elements, so the class names are yours.

---

<philosophy>

Form state lives outside React state. Inputs register themselves with the form and report through a
ref, so a keystroke updates the form's own store without re-rendering the component that owns the
field. Everything that reads form state — an error message, a computed total, a submit button — opts
in by subscribing to a named slice, and a component that subscribes to nothing never re-renders.

This is why the wide reads cost so much. `watch()` in a render body and a `formState` destructure
that pulls six properties both subscribe to the entire form, undoing the isolation the library was
built for.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: useForm with a generic

The generic, `mode` and `defaultValues` together settle type safety, validation timing and
controlled-input warnings.

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

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Controller for components that own their value

`Controller` renders the field itself and hands it `value` and `onChange`. The test for which to
reach for: a component whose `ref` forwards to a native input works with `register`, and anything
else needs `Controller`.

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

Full code: [examples/controlled-components.md](examples/controlled-components.md)

---

### Pattern 3: useFieldArray for repeatable rows

`fields` carries a generated `id` per row, and that is the React key. Array-level rules go on the
hook, and their errors land at `errors.items.root`.

```typescript
const { fields, append, remove } = useFieldArray({ control, name: "items" });

{fields.map((field, index) => (
  <div key={field.id}>
    <input {...register(`items.${index}.name`)} />
    <button type="button" onClick={() => remove(index)}>Remove</button>
  </div>
))}
```

Full code: [examples/arrays.md](examples/arrays.md)

---

### Pattern 4: Schema validation through resolver

`resolver` replaces the per-field `rules`: the schema decides what is valid and reports errors
against field paths, and the form does the wiring.

```typescript
const { register, handleSubmit } = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: "onBlur",
  defaultValues: { username: "", email: "" },
});
```

A schema kept in its own module is testable without rendering, reusable across forms, and can state
cross-field rules — matching passwords, a date range — that per-field `rules` cannot express.

Full code: [examples/validation.md](examples/validation.md)

---

### Pattern 5: useWatch for derived values

`useWatch` in a child component subscribes to named fields, so only that child re-renders when they
change.

```typescript
function PriceDisplay({ control }: { control: Control<PricingFormData> }) {
  const [plan, seats] = useWatch({ control, name: ["plan", "seats"] });
  return <div>Total: ${PLAN_PRICES[plan] * seats}</div>;
}
```

The `compute` option narrows the subscription further — the component re-renders when the computed
result changes rather than when an input to it does.

Full code: [examples/performance.md](examples/performance.md) Pattern 11 and Pattern 12

---

### Pattern 6: useFormContext for nested fields

`FormProvider` puts the form methods on context so a nested or reused section reaches them without
prop drilling. Worth it at three levels of nesting or for a section rendered more than once; below
that, passing `control` is simpler.

```typescript
<FormProvider {...methods}>
  <form onSubmit={methods.handleSubmit(onSubmit)}>
    <AddressFields prefix="shippingAddress" />
    <AddressFields prefix="billingAddress" />
  </form>
</FormProvider>

function AddressFields({ prefix }) {
  const { register } = useFormContext<CheckoutFormData>();
  return <input {...register(`${prefix}.street`)} />;
}
```

Full code: [examples/wizard.md](examples/wizard.md)

---

### Pattern 7: Loading external data

`values` is reactive — the form follows the data as it changes — while `defaultValues` is read once
on mount. Pair `values` with `resetOptions: { keepDirtyValues: true }` so a background refresh does
not discard what the user has typed.

```typescript
useForm<FormData>({
  values: userData,
  resetOptions: { keepDirtyValues: true },
});
```

After a successful save, `reset(data)` replaces the values and the defaults together, which is what
clears `isDirty`. `reset()` with no argument reverts to the original defaults — the cancel button.

Full code: [examples/form-options.md](examples/form-options.md) Pattern 7

---

### Pattern 8: Isolated error display

`useFormState` with a `name` re-renders only when that field's state changes, which keeps an error
message from re-rendering the form around it.

```typescript
function FieldError<T extends FieldValues>({ control, name }: Props<T>) {
  const { errors } = useFormState({ control, name });
  const error = errors[name];
  if (!error) return null;
  return <span role="alert">{error.message as string}</span>;
}
```

Full code: [examples/performance.md](examples/performance.md) — Pattern 5 for the hook, Pattern 10
for the `FormStateSubscribe` component form

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- An array index as the `useFieldArray` key — React matches the wrong rows, so removing a middle
  item shifts every value below it up one. Key on `field.id`.
- `register` on a component that holds its own value — no ref arrives, the field never registers,
  and its value is absent from the submit payload. Wrap it in `Controller`.
- No `defaultValues` — inputs mount uncontrolled and flip to controlled on the first keystroke,
  which React warns about and SSR reports as a hydration mismatch. Seed every field, `""` included.
- A partial object handed to `append`, `prepend` or `insert` — the absent keys arrive as `undefined`
  and their inputs read as uncontrolled. Pass a complete item.
- An error thrown inside `onSubmit` — `handleSubmit` does not catch it, so the rejection escapes
  unhandled. Catch inside the callback.
- `setValue` against a field array's own name — the row ids do not move with the values. Use
  `replace()`.

**Surprising behaviour:**

- No generic on `useForm` leaves field paths and the submit payload as `any`, so `register("emial")`
  is accepted in silence.
- Destructuring several `formState` properties subscribes to all of them, and the form then
  re-renders on any change. Take only what the component reads, or isolate it with `useFormState`.
- `watch()` in a render body subscribes to every field; `useWatch` in a child narrows it to named ones.
- `setValue` without `shouldValidate: true` leaves the previous error on screen.
- Array-level errors sit at `errors.items.root`; per-item errors at `errors.items[index].field`.
- `shouldUnregister: true` discards the values of unmounted fields. Leave it `false` (the default)
  for anything that hides fields, wizards especially.
- `useWatch` returns its `defaultValue` on the first render, before the subscription attaches.
- `values` is for external data that keeps changing and `defaultValues` for static initial values;
  supplying both makes which one wins depend on `resetOptions`.
- Per-step validation needs `trigger(fieldNames)` — `isValid` reflects the whole form, so a wizard
  gated on it is stuck on step one.

Worked before/after code for the most common of these is in [reference.md](reference.md).

</red_flags>
