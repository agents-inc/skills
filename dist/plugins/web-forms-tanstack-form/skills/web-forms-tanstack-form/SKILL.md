---
name: web-forms-tanstack-form
description: TanStack Form patterns - useForm, form.Field, validators, arrays, linked fields, createFormHook, type safety
---

# TanStack Form Patterns

> **Quick Guide:** `useForm` takes `defaultValues`, and every field name, value type and the submit
> payload are inferred from that object. Fields render through `form.Field` with a `children` render
> prop that supplies `field.state.value`, `field.handleChange` and `field.handleBlur`. Validation
> lives in the `validators` prop — keyed by event (`onChange`, `onBlur`, `onSubmit`) with an `Async`
> variant of each, on the field or on the form. `mode="array"` unlocks `pushValue`/`removeValue`,
> `onChangeListenTo` re-runs a validator when another field changes, and `form.Subscribe` narrows
> which state changes re-render what.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — a form end to end: fields, typing, submission, reset
- [examples/validation.md](examples/validation.md) — sync, async and cross-field validators; schema objects in validators
- [examples/arrays.md](examples/arrays.md) — dynamic field groups with `mode="array"`
- [examples/composition.md](examples/composition.md) — `createFormHook`, `useAppForm`, listeners
- [reference.md](reference.md) — validator events, field and form state tables, API methods, framework packages

---

## Which path applies

- **A single form** — `useForm` plus `form.Field` render props, nothing else to set up. Follow
  [examples/core.md](examples/core.md).
- **Forms across an app that should behave alike** — `createFormHook` registers shared field and
  form components once, and `useAppForm` replaces `useForm` at each call site. Follow
  [examples/composition.md](examples/composition.md).
- **A framework other than React** — the form core is shared and only the package and the field
  binding differ; reference.md's Framework Packages table names both for each.

---

<critical_requirements>

## Before writing TanStack Form code

**Give `useForm` a `defaultValues` entry for every field.** Field names, value types and the submit
payload are all inferred from that object, so a field missing from it is a field the types do not
know about.

**Render every field through `form.Field` and its `children` render prop.** The render prop receives
the value and the handlers explicitly — this library has no field-registration helper and does no
ref forwarding, so an input wired any other way never joins the form.

**Put validation in the `validators` prop, keyed by the event that should run it.** `onChange`,
`onBlur` and `onSubmit` each have an `Async` counterpart, and the same prop exists on the field and
on the form.

**Read `field.state.meta.errors` as an array.** It holds every current error for the field, so
`.map()` over it or check `.length`; compared against a string it is always unequal.

**Call `e.preventDefault()` in the form's `onSubmit` before `form.handleSubmit()`.** The library
does not intercept the native submit, so without it the browser navigates away mid-submission.

</critical_requirements>

---

**Auto-detection:** @tanstack/react-form, @tanstack/vue-form, @tanstack/solid-form,
@tanstack/angular-form, @tanstack/lit-form, @tanstack/form-core, form.Field, form.Subscribe,
createFormHook, createFormHookContexts, useAppForm, withForm, fieldContext, formContext,
field.handleChange, field.handleBlur, field.state.meta, pushValue, removeValue, swapValues,
onChangeListenTo, onBlurListenTo, setErrorMap, formDevtoolsPlugin

**Applies to:**

- Form state, validation timing and submission
- Cross-field rules, where one field's validity depends on another's value
- Dynamic lists of field groups that add, remove and reorder
- Sharing field and form components across an app through the factory
- Forms in Vue, Solid, Angular or Lit as well as React

**Handled elsewhere:**

- Authoring the validation schema — a validator accepts any Standard Schema object, and how that
  schema states its rules is settled by whatever owns it.
- Rendering and styling the inputs — this library owns no UI; the render prop hands over the value
  and the handlers, and the markup is yours.
- Where the initial values came from — `defaultValues` is a plain object, and the form fetches
  nothing.

---

<philosophy>

The form is headless and its types run on inference. `defaultValues` is the schema of record: field
names autocomplete from it, `field.state.value` is typed by it, and the `onSubmit` payload matches
it — without a generic parameter, and without a second type declaration that could drift.

Validation is bound to events rather than to a mode. Each validator declares when it runs, at the
level it belongs to, so a cheap format check can sit on `onChange` while the expensive uniqueness
check waits for `onBlurAsync` on the same field.

State is read by subscription. `form.Subscribe` and `useStore` take a selector and re-render only
when what the selector returns changes, so reading `form.state` directly in a component body opts
out of the whole design.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: useForm and form.Field

The render prop is the whole field API — value in, handlers out, nothing implicit.

```tsx
const form = useForm({
  defaultValues: { name: "", email: "" },
  onSubmit: async ({ value }) => {
    await submitToApi(value);
  },
});

<form
  onSubmit={(e) => {
    e.preventDefault();
    form.handleSubmit();
  }}
>
  <form.Field
    name="email"
    children={(field) => (
      <input
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
    )}
  />
</form>;
```

`onBlur={field.handleBlur}` is what marks the field touched — omit it and `isTouched` stays false
and any `onBlur` validator never runs.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Field-level validators

A sync validator returns a message string, or `undefined` when the value passes.

```tsx
<form.Field
  name="age"
  validators={{
    onChange: ({ value }) => (value < 13 ? "Must be 13 or older" : undefined),
    onBlurAsync: async ({ value }) => {
      const ok = await checkAge(value);
      return ok ? undefined : "Age not valid on server";
    },
  }}
  children={(field) => (/* ... */)}
/>
```

Sync gates async: when `onBlur` and `onBlurAsync` are both present, the async one runs only after
the sync one passes — so a network call never fires on a value already known to be invalid.

Full code: [examples/validation.md](examples/validation.md)

---

### Pattern 3: Linked fields

`onChangeListenTo` names the fields whose changes should re-run this field's validators.

```tsx
<form.Field
  name="confirm_password"
  validators={{
    onChangeListenTo: ["password"],
    onChange: ({ value, fieldApi }) =>
      value !== fieldApi.form.getFieldValue("password")
        ? "Passwords do not match"
        : undefined,
  }}
  children={(field) => (/* ... */)}
/>
```

Without it, editing `password` leaves the error on `confirm_password` showing the verdict from the
old comparison until the user touches the confirm field again.

Full code: [examples/validation.md](examples/validation.md)

---

### Pattern 4: Array fields

`mode="array"` gives the field `pushValue`, `removeValue`, `insertValue`, `swapValues` and
`moveValue`. Nested fields address items by index.

```tsx
<form.Field
  name="hobbies"
  mode="array"
  children={(hobbies) => (
    <div>
      {hobbies.state.value.map((_, i) => (
        <form.Field
          key={i}
          name={`hobbies[${i}].name`}
          children={(field) => (
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        />
      ))}
      <button type="button" onClick={() => hobbies.pushValue({ name: "" })}>
        Add hobby
      </button>
    </div>
  )}
/>
```

Full code: [examples/arrays.md](examples/arrays.md)

---

### Pattern 5: Form-level validators

Validators on `useForm` see every value at once, which is where server-side validation belongs
because it can attribute errors back to individual fields.

```tsx
const form = useForm({
  defaultValues: { username: "", age: 0 },
  validators: {
    onSubmitAsync: async ({ value }) => {
      const errors = await validateOnServer(value);
      if (!errors) return null;
      return {
        form: "Submission failed",
        fields: { username: errors.username, age: errors.age },
      };
    },
  },
});
```

The return shape is `{ form?: string, fields: Record<string, string> }`, and `null` means valid.
This differs from a field validator, which returns a bare string.

Full code: [examples/validation.md](examples/validation.md)

---

### Pattern 6: createFormHook

The factory registers field and form components once, so each form reaches them as `form.AppField`
and `form.AppForm` instead of repeating the render-prop markup.

```tsx
export const { fieldContext, formContext, useFieldContext } =
  createFormHookContexts();

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, SelectField },
  formComponents: { SubmitButton },
});
```

`useAppForm` accepts everything `useForm` does.

Full code: [examples/composition.md](examples/composition.md)

---

### Pattern 7: Listeners

Listeners react to a field event and cause an effect. They return nothing — a validator is what
returns errors.

```tsx
<form.Field
  name="country"
  listeners={{
    onChange: () => form.setFieldValue("province", ""),
  }}
  children={(field) => (/* ... */)}
/>
```

Available events: `onChange`, `onBlur`, `onMount`, `onSubmit`.

Full code: [examples/composition.md](examples/composition.md)

---

### Pattern 8: form.Subscribe

The `selector` decides what re-renders. Narrow it to the state actually rendered.

```tsx
<form.Subscribe
  selector={(state) => [state.canSubmit, state.isSubmitting] as const}
  children={([canSubmit, isSubmitting]) => (
    <button type="submit" disabled={!canSubmit || isSubmitting}>
      {isSubmitting ? "Submitting..." : "Submit"}
    </button>
  )}
/>
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `form.handleSubmit()` without `e.preventDefault()` — the browser submits the form natively and the
  page reloads mid-submission.
- `defaultValues` missing a field — its `field.state.value` is `undefined`, the input mounts
  uncontrolled, and the field's type is unknown.
- `field.state.meta.errors` compared as a string — it is an array, so the comparison is always false
  and the message never renders. `.map()` over it.
- A partial object handed to `pushValue` — it does not match the array's element type, and the
  absent keys leave their inputs uncontrolled.
- An error thrown inside `onSubmit` — `form.handleSubmit()` does not catch it. Catch inside the
  callback and surface it with `form.setErrorMap()`.
- Dot notation for an array item — the field path is `items[0].name`, and `items.0.name` addresses
  nothing.

**Surprising behaviour:**

- `form.state` read in a component body subscribes to every state change. `form.Subscribe` with a
  selector, or `useStore(form.store, selector)`, narrows it.
- `form.Subscribe` with no `selector` subscribes to everything, which is the same cost.
- A sync validator failing stops its async counterpart from running at all — deliberate, and it means
  an async validator alone carries no cheap pre-check.
- A form-level validator returns `{ form?, fields }` while a field validator returns a string — the
  field shape returned from the form level is ignored in silence.
- Components registered through `createFormHook` live on `form.AppField` and `form.AppForm`;
  `form.Field` still exists and still takes a plain render prop.

Worked before/after code for the most common of these is in [reference.md](reference.md).

</red_flags>
