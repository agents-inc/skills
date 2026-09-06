# VeeValidate Reference

> Decision frameworks, anti-patterns, and API reference for VeeValidate v4. See [SKILL.md](SKILL.md) for core concepts and red flags, [examples/](examples/) for code examples.

---

## Decision Framework

> `defineField` or `useField` is settled in [SKILL.md](SKILL.md) under the decision framework.

### validationSchema or an inline validator function

```
What does the rule need to see?
├─ More than one field (password confirmation, date range) → validationSchema ✓
├─ A value the input delivers as a string but the rule treats
│  as a number or date                                      → validationSchema ✓
├─ The same rule already stated elsewhere in the codebase    → validationSchema ✓
├─ One field, one condition, used nowhere else               → inline function on useField
└─ No schema library in the project                          → inline function on useField
```

An inline validator is a function of one value returning a message or `true`. It cannot see a
sibling field, which is the line between the two.

### Validation timing

```
When should a field validate?
├─ On blur (the default)                       → leave validateOnValueUpdate alone ✓
├─ On submit only                              → validateOnValueUpdate: false, then validate()
├─ On every keystroke                          → validateOnValueUpdate: true
└─ On blur, then every keystroke once it fails → the eager pattern
```

The eager pattern is [examples/core.md](examples/core.md) Pattern 5: `handleBlur(evt, true)` on
blur, and `handleChange(evt, !!errorMessage.value)` on input so re-validation starts only after the
first failure.

### Form-level or field-level

```
Where does the rule belong?
├─ It compares fields                  → form level, on validationSchema ✓
├─ It validates an array's length or
│  the shape of its items              → form level, on validationSchema ✓
├─ It is reused across forms           → form level, as a shared schema ✓
└─ It concerns one field in one form   → either; field level is less to wire
```

---

## Anti-Patterns

### Using Index as Key in useFieldArray

Using array index as key causes Vue to incorrectly reconcile elements when items are added, removed, or reordered.

```vue
<!-- WRONG - Index as key -->
<template>
  <div v-for="(field, index) in fields" :key="index">
    <input v-model="field.value.name" />
  </div>
</template>

<!-- CORRECT - field.key as key -->
<template>
  <div v-for="(field, index) in fields" :key="field.key">
    <input v-model="field.value.name" />
  </div>
</template>
```

### Direct Prop Access in useField

Passing props directly loses reactivity when prop value changes.

```typescript
// WRONG - Loses reactivity
const props = defineProps<{ name: string }>();
const { value } = useField(props.name);

// CORRECT - Function form maintains reactivity
const { value } = useField(() => props.name);

// ALSO CORRECT - toRef maintains reactivity
const nameRef = toRef(props, "name");
const { value } = useField(nameRef);
```

### Missing toTypedSchema Wrapper

Raw schemas won't work with VeeValidate without the adapter.

```typescript
// WRONG - Raw schema won't work
const schema = z.object({ email: z.string().email() });
const { handleSubmit } = useForm({ validationSchema: schema });

// CORRECT - Wrapped schema works
import { toTypedSchema } from "@vee-validate/zod";
const schema = toTypedSchema(z.object({ email: z.string().email() }));
const { handleSubmit } = useForm({ validationSchema: schema });
```

### Uninitialized Field Arrays

Undefined arrays cause errors when useFieldArray tries to iterate.

```typescript
// WRONG - Undefined array
const { handleSubmit } = useForm({
  initialValues: {
    users: undefined, // Will cause errors!
  },
});

// CORRECT - Initialized array
const { handleSubmit } = useForm({
  initialValues: {
    users: [{ name: "", email: "" }], // At least empty array
  },
});
```

### Mixing Form Component with useForm

Using both creates conflicting form contexts.

```vue
<!-- WRONG - Conflicting contexts -->
<script setup>
import { useForm, Form, Field } from "vee-validate";
const { handleSubmit } = useForm(); // Creates context
</script>

<template>
  <Form>
    <!-- Creates ANOTHER context -->
    <Field name="email" />
  </Form>
</template>

<!-- CORRECT - Pick one approach -->
<!-- Option A: useForm with native elements -->
<script setup>
import { useForm } from "vee-validate";
const { handleSubmit, defineField } = useForm();
const [email] = defineField("email");
</script>

<template>
  <form @submit="handleSubmit(onSubmit)">
    <input v-model="email" />
  </form>
</template>

<!-- Option B: Form/Field components only -->
<template>
  <Form @submit="onSubmit">
    <Field name="email" />
  </Form>
</template>
```

### Not Using meta.touched for Error Display

Shows errors immediately before user has interacted with field.

```vue
<!-- WRONG - Shows error immediately -->
<template>
  <input v-model="value" />
  <span v-if="errorMessage">{{ errorMessage }}</span>
</template>

<!-- CORRECT - Shows error after interaction -->
<template>
  <input v-model="value" @blur="handleBlur" />
  <span v-if="meta.touched && errorMessage">{{ errorMessage }}</span>
</template>
```

---

## Quick Reference

### useForm Return Values

| Property          | Type           | Description                                    |
| ----------------- | -------------- | ---------------------------------------------- |
| `handleSubmit`    | `function`     | Wraps submit handler with validation           |
| `errors`          | `object`       | First error per field                          |
| `errorBag`        | `object`       | All errors per field as arrays                 |
| `values`          | `object`       | Current form values (reactive)                 |
| `meta`            | `object`       | Form metadata (valid, dirty, touched, pending) |
| `isSubmitting`    | `Ref<boolean>` | True during async submit                       |
| `isValidating`    | `Ref<boolean>` | True during async validation                   |
| `submitCount`     | `Ref<number>`  | Number of submission attempts                  |
| `defineField`     | `function`     | Creates field model and attrs tuple            |
| `setFieldValue`   | `function`     | Set field value programmatically               |
| `setValues`       | `function`     | Set multiple field values at once              |
| `setFieldError`   | `function`     | Set field error programmatically               |
| `setErrors`       | `function`     | Set multiple errors at once                    |
| `setFieldTouched` | `function`     | Set field touched state                        |
| `setTouched`      | `function`     | Set multiple touched states at once            |
| `resetForm`       | `function`     | Reset form to initial values                   |
| `handleReset`     | `function`     | Reset handler for native form reset events     |
| `submitForm`      | `function`     | Native form submission handler                 |
| `validate`        | `function`     | Trigger form validation manually               |
| `validateField`   | `function`     | Trigger single field validation                |

### useField Return Values

| Property       | Type            | Description                                     |
| -------------- | --------------- | ----------------------------------------------- |
| `value`        | `Ref`           | Field value (reactive)                          |
| `errorMessage` | `Ref<string>`   | Current error message                           |
| `errors`       | `Ref<string[]>` | All error messages                              |
| `meta`         | `object`        | Field metadata (valid, touched, dirty, pending) |
| `handleChange` | `function`      | Input change handler                            |
| `handleBlur`   | `function`      | Input blur handler                              |
| `validate`     | `function`      | Trigger validation                              |
| `resetField`   | `function`      | Reset field to initial value                    |
| `setTouched`   | `function`      | Mark field as touched                           |
| `setErrors`    | `function`      | Set field error messages                        |
| `setValue`     | `function`      | Set value programmatically                      |
| `handleReset`  | `function`      | Safe event handler for resetting                |
| `checked`      | `Computed`      | Checked state (checkbox/radio only)             |

### useFieldArray Return Values

| Property  | Type         | Description                                   |
| --------- | ------------ | --------------------------------------------- |
| `fields`  | `Ref<Array>` | Array of field objects with `key` and `value` |
| `push`    | `function`   | Add to end                                    |
| `prepend` | `function`   | Add to start                                  |
| `insert`  | `function`   | Add at index                                  |
| `remove`  | `function`   | Remove at index                               |
| `swap`    | `function`   | Swap two items                                |
| `move`    | `function`   | Move item to new position                     |
| `replace` | `function`   | Replace entire array                          |
| `update`  | `function`   | Update item at index                          |

### Meta Object Properties

| Property       | Type      | Description                  |
| -------------- | --------- | ---------------------------- |
| `valid`        | `boolean` | Passes all validation        |
| `dirty`        | `boolean` | Value differs from initial   |
| `touched`      | `boolean` | Has been blurred             |
| `pending`      | `boolean` | Async validation in progress |
| `initialValue` | `any`     | Initial field value          |

### Performance Optimization Checklist

- [ ] Use `defineField` for native inputs (simpler, less overhead)
- [ ] Set `validateOnValueUpdate: false` for lazy validation
- [ ] Use `meta.touched` to defer error display
- [ ] Initialize all field array values to prevent errors
- [ ] Use `field.key` as iteration key (never index)
- [ ] Define schemas outside component (prevent recreation)
- [ ] Use `keepValuesOnUnmount: true` for multi-step forms

### Composition Helpers Reference

These helpers enable building custom components without the full `useForm` or `useField` composables:

| Helper                    | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `useFieldError(name)`     | Access single field's first error message          |
| `useFieldValue(name)`     | Access single field's current value                |
| `useIsFieldDirty(name)`   | Check if a field is dirty                          |
| `useIsFieldTouched(name)` | Check if a field is touched                        |
| `useIsFieldValid(name)`   | Check if a field is valid                          |
| `useValidateField(name)`  | Returns function to validate a specific field      |
| `useFormErrors()`         | Access entire error bag                            |
| `useFormValues()`         | Access all current form values                     |
| `useIsFormDirty()`        | Check if form has any dirty fields                 |
| `useIsFormTouched()`      | Check if form has any touched fields               |
| `useIsFormValid()`        | Check if all fields are validated and valid        |
| `useValidateForm()`       | Returns function to validate entire form           |
| `useResetForm()`          | Returns function to reset form                     |
| `useSubmitForm(handler)`  | Creates submission function with validation        |
| `useIsSubmitting()`       | Check if form is currently submitting              |
| `useIsValidating()`       | Check if form is currently validating              |
| `useSubmitCount()`        | Track number of submission attempts                |
| `useFormContext()`        | Access parent form context (for nested components) |

---

## VeeValidate v5 Migration Note

VeeValidate v5 is in beta with breaking changes. When migrating:

**Key Changes:**

- `toTypedSchema()` is removed - pass schemas directly to `validationSchema`
- `@vee-validate/zod`, `@vee-validate/yup`, `@vee-validate/valibot` packages deprecated
- Minimum versions: Zod 3.24.0+, Yup 1.7.0+, Valibot 1.0+

**v4 (current):**

```typescript
import { toTypedSchema } from '@vee-validate/zod';
const schema = toTypedSchema(z.object({ ... }));
```

**v5 (beta):**

```typescript
// No import needed - pass schema directly
const schema = z.object({ ... });
```

**Lost Features in v5:**

- Required meta flag resolution from schemas
- Using schema defaults to initialize form values

---
