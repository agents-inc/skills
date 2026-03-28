---
name: web-forms-tanstack-form
description: TanStack Form patterns - useForm, form.Field, validators, arrays, linked fields, createFormHook, type safety
---

# TanStack Form Patterns

> **Quick Guide:** Use `useForm` with `defaultValues` and typed generics. Render fields with `form.Field` using the render-prop `children` pattern. Validation lives in the `validators` prop on both form and field level — use `onChange`, `onBlur`, `onSubmit` (sync) and their `Async` variants. Use `mode="array"` for dynamic field lists with `pushValue`/`removeValue`. Use `onChangeListenTo` for cross-field validation. For app-wide consistency, create a shared `useAppForm` via `createFormHook`. Always provide `defaultValues` — TanStack Form infers types from them.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST provide `defaultValues` to `useForm` — TanStack Form infers field types from them)**

**(You MUST use `form.Field` with the `children` render prop — TanStack Form does not use `register` or `Controller`)**

**(You MUST use the `validators` prop for validation — NOT inline `rules` or external resolver wrappers)**

**(You MUST handle `field.state.meta.errors` as an array — always `.map()` over errors)**

**(You MUST call `form.handleSubmit()` inside the form's `onSubmit` handler with `e.preventDefault()`)**

</critical_requirements>

---

**Auto-detection:** TanStack Form, @tanstack/react-form, @tanstack/vue-form, @tanstack/solid-form, @tanstack/angular-form, @tanstack/lit-form, useForm from tanstack, form.Field, createFormHook, createFormHookContexts, useAppForm, fieldContext, formContext, handleSubmit tanstack, pushValue, removeValue, onChangeListenTo, field.handleChange, field.handleBlur, field.state, formDevtoolsPlugin

**When to use:**

- Building type-safe forms where field types are inferred from `defaultValues`
- Managing complex validation with sync, async, and cross-field rules
- Dynamic forms with add/remove field groups (array fields)
- Multi-framework projects (React, Vue, Solid, Angular, Lit)
- Projects already using the TanStack ecosystem

**When NOT to use:**

- Single input without validation (use native state)
- Server-only forms with server actions (use native form + action)
- Read-only data display (not a form scenario)

---

## Table of Contents

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Basic form, Field component, TypeScript, form submission
- [examples/validation.md](examples/validation.md) - Sync/async validation, validator adapters, form-level validation
- [examples/arrays.md](examples/arrays.md) - Dynamic array fields with pushValue/removeValue
- [examples/composition.md](examples/composition.md) - createFormHook, useAppForm, listeners, side effects
- [reference.md](reference.md) - API tables, validator events, decision frameworks

---

<philosophy>

## Philosophy

TanStack Form is **headless and type-safe by design**. It owns zero UI — you render every input yourself. The library provides form state, validation orchestration, and field management. Types flow from `defaultValues` through every field name, value, and error — no manual generics required (though you can provide them).

**Core Principles:**

1. **Type inference from defaults** - `defaultValues` defines the form shape; field names and values are fully typed
2. **Headless** - Zero UI opinions; works with any component library or native inputs
3. **Validation-event-driven** - Validators attach to specific events (`onChange`, `onBlur`, `onSubmit`) per field or per form
4. **Framework-agnostic core** - Same mental model across React, Vue, Solid, Angular, and Lit
5. **Composition via factory** - `createFormHook` shares field/form components across an app

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Basic useForm + form.Field

Every form starts with `useForm` and renders fields via `form.Field`. The `children` render prop receives the field API with `state`, `handleChange`, and `handleBlur`.

```tsx
import { useForm } from "@tanstack/react-form";

const form = useForm({
  defaultValues: { name: "", email: "" },
  onSubmit: async ({ value }) => {
    await submitToApi(value);
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
      children={(field) => (
        <input
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
        />
      )}
    />
  </form>
);
```

**Key difference from other form libraries:** No `register`, no `Controller`, no `ref` forwarding. You always use `field.handleChange` and `field.state.value` explicitly.

See [examples/core.md](examples/core.md) for complete form with error display and accessibility.

---

### Pattern 2: Field-Level Validation

Validators are functions on the `validators` prop. Sync validators return a string (error) or `undefined` (valid). Async validators use `onChangeAsync`, `onBlurAsync`, `onSubmitAsync`.

```tsx
<form.Field
  name="age"
  validators={{
    onChange: ({ value }) => (value < 13 ? "Must be 13 or older" : undefined),
    onBlurAsync: async ({ value }) => {
      const exists = await checkAge(value);
      return exists ? undefined : "Age not valid on server";
    },
  }}
  children={(field) => (
    <div>
      <input
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
```

**Sync-first gating:** When both `onBlur` and `onBlurAsync` exist, the async validator only runs if the sync validator passes. Same for `onChange`/`onChangeAsync`.

See [examples/validation.md](examples/validation.md) for all validation patterns and adapter integration.

---

### Pattern 3: Linked Fields (Cross-Field Validation)

Use `onChangeListenTo` to re-run a field's validator when another field changes. This solves the stale-validation problem (e.g., confirm password).

```tsx
<form.Field
  name="confirm_password"
  validators={{
    onChangeListenTo: ["password"],
    onChange: ({ value, fieldApi }) => {
      if (value !== fieldApi.form.getFieldValue("password")) {
        return "Passwords do not match";
      }
      return undefined;
    },
  }}
  children={(field) => (/* ... */)}
/>
```

**Why this matters:** Without `onChangeListenTo`, changing the `password` field does not re-validate `confirm_password`. The error stays stale until the user interacts with the confirm field again.

See [examples/validation.md](examples/validation.md) Pattern 4 for a complete linked fields example.

---

### Pattern 4: Array Fields

Use `mode="array"` on `form.Field` to get `pushValue`, `removeValue`, `swapValues`, `moveValue`, and `insertValue` for dynamic field groups.

```tsx
<form.Field
  name="hobbies"
  mode="array"
  children={(hobbiesField) => (
    <div>
      {hobbiesField.state.value.map((_, i) => (
        <div key={i}>
          <form.Field
            name={`hobbies[${i}].name`}
            children={(field) => (
              <input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          />
          <button type="button" onClick={() => hobbiesField.removeValue(i)}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => hobbiesField.pushValue({ name: "" })}
      >
        Add hobby
      </button>
    </div>
  )}
/>
```

**Important:** `pushValue` requires a complete object matching the array item shape. Partial objects will cause type errors.

See [examples/arrays.md](examples/arrays.md) for a complete dynamic list form.

---

### Pattern 5: Form-Level Validation

Validators on `useForm` apply to the entire form. Use `onSubmitAsync` for server-side validation that returns field-specific errors.

```tsx
const form = useForm({
  defaultValues: { username: "", age: 0 },
  validators: {
    onSubmitAsync: async ({ value }) => {
      const errors = await validateOnServer(value);
      if (errors) {
        return {
          form: "Submission failed",
          fields: {
            username: errors.username,
            age: errors.age,
          },
        };
      }
      return null;
    },
  },
});
```

**Return shape:** `{ form?: string, fields: Record<string, string> }` — the `form` key is optional for form-level errors, `fields` maps field names to their error messages. Return `null` when valid.

See [examples/validation.md](examples/validation.md) Pattern 3 for complete form-level validation.

---

### Pattern 6: createFormHook (App-Wide Composition)

Use `createFormHook` to share custom field components and form components across the app. This eliminates boilerplate and enforces consistency.

```tsx
import { createFormHookContexts, createFormHook } from "@tanstack/react-form";

export const { fieldContext, formContext, useFieldContext } =
  createFormHookContexts();

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField: TextFieldComponent,
    SelectField: SelectFieldComponent,
  },
  formComponents: {
    SubmitButton: SubmitButtonComponent,
  },
});
```

**Usage:** `useAppForm` accepts all `useForm` options. Registered `fieldComponents` and `formComponents` are available on the returned form instance: `form.AppField` for custom field components, `form.AppForm` for form-level components.

See [examples/composition.md](examples/composition.md) for the full factory setup and custom component patterns.

---

### Pattern 7: Listeners (Side Effects)

Listeners react to field events and perform side effects like resetting related fields. Use the `listeners` prop on `form.Field`.

```tsx
<form.Field
  name="country"
  listeners={{
    onChange: ({ value }) => {
      form.setFieldValue("province", "");
    },
  }}
  children={(field) => (/* ... */)}
/>
```

**Available events:** `onChange`, `onBlur`, `onMount`, `onSubmit`. Listeners are for side effects only — they do not return validation errors.

See [examples/composition.md](examples/composition.md) Pattern 3 for a complete country/province cascade.

---

### Pattern 8: form.Subscribe for Reactive UI

Use `form.Subscribe` to reactively render UI based on form state without re-rendering the entire form. Takes a `selector` to pick specific state.

```tsx
<form.Subscribe
  selector={(state) => [state.canSubmit, state.isSubmitting]}
  children={([canSubmit, isSubmitting]) => (
    <button type="submit" disabled={!canSubmit || isSubmitting}>
      {isSubmitting ? "Submitting..." : "Submit"}
    </button>
  )}
/>
```

**Why this matters:** Without `form.Subscribe`, reading `form.state` directly causes the parent component to re-render on every state change. The selector narrows the subscription.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `register` or `Controller` patterns — TanStack Form uses `form.Field` with `children` render prop, not register/Controller
- Missing `defaultValues` in `useForm` — types cannot be inferred, fields start as `undefined`
- Calling `form.handleSubmit()` without `e.preventDefault()` — causes page reload
- Reading `form.state` directly in the component body — causes full re-render on every change; use `form.Subscribe` or `useStore`

**Medium Priority Issues:**

- Using `onChange` validator for expensive checks — use `onChangeAsync` with debounce or `onBlurAsync` instead
- Providing partial objects to `pushValue` in array fields — must provide complete objects matching the array item type
- Not using `onChangeListenTo` for cross-field validation — related field errors go stale
- Wrapping `form.handleSubmit()` in another async function without error handling — `handleSubmit` does not catch errors thrown in `onSubmit`

**Gotchas & Edge Cases:**

- `field.state.meta.errors` is always an array — never compare with `===`, always `.map()` or `.length`
- Sync validators gate async validators — if `onChange` fails, `onChangeAsync` does not run
- Form-level `onSubmitAsync` validator returns `{ fields: { fieldName: "error" } }` — not the same shape as field-level validators
- `field.state.meta.isTouched` only becomes `true` after `handleBlur` fires — not on first `handleChange`
- Array field access uses bracket notation: `name={`items[${i}].name`}` — not dot notation like `items.${i}.name`
- `form.Subscribe` uses a `selector` prop to pick state — passing no selector subscribes to everything
- `createFormHook` components are available as `form.AppField` and `form.AppForm` — not on `form.Field`

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST provide `defaultValues` to `useForm` — TanStack Form infers field types from them)**

**(You MUST use `form.Field` with the `children` render prop — TanStack Form does not use `register` or `Controller`)**

**(You MUST use the `validators` prop for validation — NOT inline `rules` or external resolver wrappers)**

**(You MUST handle `field.state.meta.errors` as an array — always `.map()` over errors)**

**(You MUST call `form.handleSubmit()` inside the form's `onSubmit` handler with `e.preventDefault()`)**

**Failure to follow these rules will break form state, lose type safety, and produce incorrect validation behavior.**

</critical_reminders>
