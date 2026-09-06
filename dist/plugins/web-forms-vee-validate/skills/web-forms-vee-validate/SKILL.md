---
name: web-forms-vee-validate
description: VeeValidate v4 patterns - useForm, useField, defineField, useFieldArray, schema validation with Composition API
---

# VeeValidate Form Validation Patterns

> **Quick Guide:** `useForm` owns the form state; `defineField` returns a `[model, attrs]` tuple to
> `v-model` onto a native input, and `useField` binds a field inside a reusable input component —
> with its name passed as a getter so it stays reactive. A schema reaches `validationSchema` through
> `toTypedSchema()`, which is also what supplies the types. `useFieldArray` drives repeatable groups
> and iterates on `field.key`. Everything here is v4; v5 removes the adapter, so check
> [reference.md](reference.md) before targeting it.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — `defineField`, inline rules, a reusable input built on `useField`, form meta, eager validation
- [examples/validation.md](examples/validation.md) — schema through `toTypedSchema`, conditional schemas, all errors per field
- [examples/arrays.md](examples/arrays.md) — `useFieldArray`, nested arrays, reordering
- [reference.md](reference.md) — return-value tables, composition helpers, worked anti-patterns, v5 migration

---

## Which path applies

- **The form is built in the component around native inputs** — `useForm` plus `defineField`, and
  `v-model` on the returned model. Follow [examples/core.md](examples/core.md).
- **A reusable input component** — `useField` inside the component, taking its name as
  `() => props.name`. Follow [examples/core.md](examples/core.md) Pattern 3.
- **The renderless `<Form>` and `<Field>` components** — an alternative to the Composition API
  rather than a companion to it. Each creates its own form context, so a component that calls
  `useForm` and also renders `<Form>` has two, and the fields register with whichever they are
  nested in.

---

<critical_requirements>

## Before writing VeeValidate code

**Wrap a schema in `toTypedSchema()` before handing it to `validationSchema`.** The adapter converts
the schema's result into the shape the form reads and is what supplies the value types; a raw schema
is accepted without complaint and then validates nothing.

**Pass `useField` its name as `() => props.name` or `toRef(props, "name")`.** A plain `props.name` is
read once at setup, so the field keeps binding to the name the component first mounted with.

**Give `initialValues` an entry for every field, arrays included.** Field arrays iterate their value
and fail on `undefined`, and a cross-field rule is skipped entirely when one of the keys it compares
is missing.

**Iterate `useFieldArray` on `field.key`.** It is the identity VeeValidate assigns each entry and it
survives insertion and reordering, which a positional index does not.

</critical_requirements>

---

**Auto-detection:** vee-validate, @vee-validate/zod, @vee-validate/yup, @vee-validate/valibot,
useForm, useField, defineField, useFieldArray, toTypedSchema, validationSchema, errorBag,
handleSubmit, resetForm, setFieldError, setErrors, validateOnValueUpdate, keepValuesOnUnmount,
ErrorMessage, useFormContext

**Applies to:**

- Vue form state, validation timing and submission
- Reusable input components that bind themselves to a named field
- Repeatable field groups that add, remove and reorder
- Surfacing server-side validation failures against individual fields
- Multi-step forms where fields unmount between steps

**Handled elsewhere:**

- Authoring the validation schema — `toTypedSchema` adapts whatever schema it is given, and how that
  schema states its rules is settled by whatever owns it.
- Choosing a schema library — an adapter package exists for each, and the choice sits outside this
  skill.
- Markup and styling of the inputs — every example uses plain elements, so the classes are yours.
- Where the initial values came from — `initialValues` is a plain object the form does not fetch.

---

<philosophy>

Validation is declared once, at the form, and read per field. `useForm` holds the schema and the
values; each field asks the form for its own slice, so a field knows its error without knowing the
rule that produced it. That is what lets an input component be written without knowing which form it
will be dropped into — it takes a name and binds itself.

Reactivity is the thing to keep intact. Everything a field receives from the form is a ref or a
getter, and the common failure is flattening one of them: reading `props.name` instead of passing a
getter, or unwrapping a computed schema with `.value` before the form can track it.

</philosophy>

---

<decision_framework>

## defineField or useField

|              | `defineField`                               | `useField`                                    |
| ------------ | ------------------------------------------- | --------------------------------------------- |
| Returns      | `[model, attrs]` for `v-model` and `v-bind` | `value`, `errorMessage`, `meta`, handlers     |
| Form context | Required — it comes off a `useForm` result  | Optional; falls back to standalone validation |
| Best for     | The form's own template, native inputs      | A component that binds itself by name         |

`defineField` where the form and the inputs are in one component. `useField` where the input is a
component in its own right, or where the binding needs handlers rather than a `v-model`.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: useForm with defineField

`defineField` returns a tuple: the model for `v-model`, and the attrs carrying the event handlers
that drive validation timing.

```vue
<script setup lang="ts">
const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: { email: "", password: "" },
});

const [email, emailAttrs] = defineField("email");

const onSubmit = handleSubmit(async (values) => {
  await login(values);
});
</script>

<template>
  <input v-model="email" v-bind="emailAttrs" />
  <span v-if="errors.email" role="alert">{{ errors.email }}</span>
</template>
```

Dropping `v-bind="emailAttrs"` leaves the model bound but the handlers unattached, so the field
never blurs and never validates.

Full code: [examples/core.md](examples/core.md) Pattern 1

---

### Pattern 2: useField in a reusable input

The name arrives as a getter so the field re-binds if the prop changes.

```vue
<script setup lang="ts">
const props = defineProps<{ name: string }>();

const { value, errorMessage, handleBlur, handleChange, meta } =
  useField<string>(() => props.name, undefined, {
    validateOnValueUpdate: false,
  });
</script>
```

`validateOnValueUpdate: false` holds validation back to blur, which is what stops errors appearing
while the user is still typing the first character.

Full code: [examples/core.md](examples/core.md) Pattern 3

---

### Pattern 3: Schema through toTypedSchema

The adapter is the boundary: the schema states the rules, and `toTypedSchema` renders them as
VeeValidate errors and as the type of `values`.

```typescript
import { toTypedSchema } from "@vee-validate/zod";

const schema = toTypedSchema(registrationSchema);

const { handleSubmit, errors } = useForm({
  validationSchema: schema,
  initialValues: { email: "", password: "", confirmPassword: "" },
});
```

Every key a cross-field rule compares needs an entry in `initialValues` — a rule reading a key that
is `undefined` is skipped rather than failed, so the form submits as valid.

Full code: [examples/validation.md](examples/validation.md)

---

### Pattern 4: useFieldArray

`fields` carries a `key` and a `value` per entry. The key is the iteration key; the value is what
the inputs bind to.

```vue
<script setup lang="ts">
const { handleSubmit } = useForm({
  initialValues: { users: [{ name: "", email: "" }] },
});

const { fields, push, remove } = useFieldArray("users");
</script>

<template>
  <div v-for="(field, index) in fields" :key="field.key">
    <input v-model="field.value.name" />
    <button type="button" @click="remove(index)">Remove</button>
  </div>
</template>
```

Full code: [examples/arrays.md](examples/arrays.md)

---

### Pattern 5: Server-side errors

`setErrors` takes a record of field names to messages, and `setFieldError` sets one. Both put a
server's verdict where the field's own error would go, so the template needs no separate branch.

```typescript
const onSubmit = handleSubmit(async (values) => {
  try {
    await createUser(values);
  } catch (error) {
    const fieldErrors = extractFieldErrors(error);
    if (fieldErrors) {
      setErrors(fieldErrors);
    } else {
      setFieldError("email", "Could not create the account");
    }
  }
});
```

The next validation run clears them — a server error persists only until the field it names changes,
which is why a rejected submission needs the message re-set rather than remembered.

---

### Pattern 6: Form meta

`meta` aggregates the fields: `valid`, `dirty`, `touched` and `pending` describe the form as a whole.

```vue
<template>
  <button :disabled="!meta.valid || !meta.dirty || isSubmitting">
    {{ isSubmitting ? "Saving..." : "Save" }}
  </button>
  <p v-if="meta.dirty">You have unsaved changes</p>
</template>
```

After a successful save, `resetForm({ values: saved })` makes the saved data the new baseline, which
is what returns `meta.dirty` to false.

Full code: [examples/core.md](examples/core.md) Pattern 4

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A schema handed to `validationSchema` without `toTypedSchema()` — it is accepted and then never
  validates, so the form submits whatever it holds.
- `props.name` passed to `useField` instead of a getter — the field binds to the name captured at
  setup and ignores every later change.
- `initialValues` missing a field array — the composable iterates `undefined` and throws.
- An array index as the `useFieldArray` iteration key — Vue matches the wrong entries, so removing
  a middle row shifts every value below it up one.
- `resetForm(data)` in place of `resetForm({ values: data })` — the argument shape is wrong, and the
  reset takes no effect rather than reporting.

**Surprising behaviour:**

- `errors` holds the first error per field; `errorBag` holds all of them as arrays. A password rule
  set showing one unmet requirement at a time is reading the wrong one.
- `meta.valid` is false on the first render, before validation has run — a submit button gated on it
  alone starts disabled.
- `keepValuesOnUnmount` defaults to false, so a field that unmounts loses its value. Set it true for
  anything that hides fields between steps.
- Nested fields address by dot notation (`defineField("user.profile.name")`) and array items by
  brackets (`errors["items[0].name"]`) — the two are not interchangeable.
- A computed schema must be passed as the computed itself, not `.value` — unwrapped, the form binds
  to one snapshot and stops tracking it.
- `validateOnValueUpdate` left on validates every keystroke, including the first.
- Errors shown without checking `meta.touched` appear before the user has reached the field.

Worked before/after code for the most common of these is in [reference.md](reference.md).

</red_flags>
