# VeeValidate Reference

> Decision frameworks, anti-patterns, and red flags for VeeValidate v4. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use defineField vs useField

```
Are you building the form directly in your component?
├─ YES → Are you using native HTML inputs?
│   ├─ YES → Use defineField ✓
│   └─ NO → Does component accept v-model?
│       ├─ YES → Use defineField with v-model ✓
│       └─ NO → Use useField with manual binding
└─ NO → Are you building a reusable input component?
    ├─ YES → Use useField ✓
    └─ NO → Use defineField for application forms
```

### When to Use Schema vs Inline Validation

```
What type of validation do you need?
├─ Complex cross-field validation (password confirm)? → Schema with refine ✓
├─ Type coercion (string to number)? → Schema with z.coerce ✓
├─ Simple required/email/min checks? → Either works
├─ Validation shared with backend? → Schema ✓
├─ Single field validation? → Inline function
└─ No validation library in project? → Inline function
```

### Schema Library Selection

```
Which schema library should you use?
├─ Need TypeScript inference? → Zod ✓ (recommended)
├─ Smallest bundle size critical? → Valibot
├─ Already using Yup elsewhere? → Yup
├─ Functional composition style? → Valibot
└─ Most ecosystem support? → Zod
```

### Validation Timing Selection

```
When should validation trigger?
├─ After user finishes field → validateOnBlur (default) ✓
├─ Only on submit → validateOnValueUpdate: false + manual trigger
├─ Every keystroke → validateOnValueUpdate: true (use sparingly)
├─ After first error then every change → Eager validation pattern
└─ Custom timing → Use validate() manually
```

### Form vs Field Level Validation

```
Where should validation logic live?
├─ Validation depends on multiple fields?
│   ├─ YES → Form-level schema with refine ✓
│   └─ NO → Field-level is fine
├─ Same validation used elsewhere?
│   ├─ YES → Shared schema ✓
│   └─ NO → Either works
└─ Need array validation?
    ├─ YES → Schema with z.array() ✓
    └─ NO → Inline works
```

---

## RED FLAGS

### High Priority Issues

- **Missing toTypedSchema wrapper** - Raw Zod/Yup schemas won't work. Always use `toTypedSchema(schema)`.
- **Using array index as key in useFieldArray** - Causes form state corruption when items are added/removed. Always use `field.key`.
- **Direct prop access in useField** - `useField(props.name)` loses reactivity. Use `useField(() => props.name)` or `toRef()`.
- **Missing initialValues for field arrays** - Undefined arrays cause errors. Always initialize with at least `[]`.
- **Not initializing refine-dependent fields** - Zod refine/superRefine won't run if fields are undefined.

### Medium Priority Issues

- **Using validateOnValueUpdate everywhere** - Validates on every keystroke which is noisy UX. Disable for non-critical fields.
- **Not handling async validation errors** - API validation failures need `setErrors()` or `setFieldError()`.
- **Forgetting to reset form after submission** - Form stays dirty after success. Call `resetForm()` or `resetForm({ values })`.
- **Multiple useForm calls in same component** - Creates conflicting form contexts. Use one useForm per logical form.
- **Not using meta.touched for error display** - Shows errors before user interacts. Check `meta.touched && errorMessage`.

### Common Mistakes

- **Destructuring values.fieldName** - Loses reactivity. Use `values.fieldName` directly or `toRef(values, 'fieldName')`.
- **Calling resetForm with wrong structure** - `resetForm({ values: data })` not `resetForm(data)`.
- **Not typing useFieldArray generic** - Loses array item type inference. Use `useFieldArray<ItemType>('fieldName')`.
- **Mixing Form component with useForm** - Pick one approach. Don't use `<Form>` component with `useForm()`.
- **Forgetting v-bind for defineField attrs** - defineField returns `[model, attrs]`. Must use `v-bind="attrs"`.

### Gotchas & Edge Cases

- **errorBag vs errors** - `errors` has first error per field, `errorBag` has ALL errors per field as arrays.
- **meta.valid timing** - May be false during initial render before validation runs. Use with `meta.touched`.
- **Nested object dot notation** - Access nested fields with dots: `defineField('user.profile.name')`.
- **Array field error paths** - Access with brackets: `errors['items[0].name']` not `errors.items[0].name`.
- **setFieldValue vs v-model** - Both work, but `setFieldValue` can trigger validation with third param `{ validate: true }`.
- **keepValuesOnUnmount** - When false (default), unmounted fields lose values. Set true for multi-step forms.

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

| Property        | Type           | Description                                    |
| --------------- | -------------- | ---------------------------------------------- |
| `handleSubmit`  | `function`     | Wraps submit handler with validation           |
| `errors`        | `object`       | First error per field                          |
| `errorBag`      | `object`       | All errors per field as arrays                 |
| `values`        | `object`       | Current form values (reactive)                 |
| `meta`          | `object`       | Form metadata (valid, dirty, touched, pending) |
| `isSubmitting`  | `Ref<boolean>` | True during async submit                       |
| `defineField`   | `function`     | Creates field model and attrs tuple            |
| `setFieldValue` | `function`     | Set field value programmatically               |
| `setFieldError` | `function`     | Set field error programmatically               |
| `setErrors`     | `function`     | Set multiple errors at once                    |
| `resetForm`     | `function`     | Reset form to initial values                   |
| `validate`      | `function`     | Trigger form validation manually               |
| `validateField` | `function`     | Trigger single field validation                |

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
| `setValue`     | `function`      | Set value programmatically                      |

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
