# React Hook Form Reference

> Decision trees, API tables, worked anti-patterns and version-to-feature lookup. See
> [SKILL.md](SKILL.md) for the decisions and [examples/](examples/) for full code.

---

## Decision Trees

### register or Controller

```
Does the component forward a ref to a native input?
├─ YES → register
│   └─ Native input, select, textarea always do
└─ NO → Controller
    └─ Custom selects, comboboxes, date pickers, rich text editors,
       and most fully styled component libraries
```

Uncertain about a third-party component: spread `register("name")` onto it and submit. A field
absent from the payload never received the ref, so it needs `Controller`.

### useWatch, watch or getValues

```
Where is the value read?
├─ In render, and only some fields matter → useWatch({ control, name })
├─ In render, and all fields matter       → useWatch({ control })
├─ In an event handler                    → getValues() — no subscription, no re-render
└─ Outside the component (logging, sync)  → watch(callback) subscription
```

### useFormContext or props

```
How deep are the form methods needed?
├─ 1–2 levels          → pass control or register as props
├─ 3+ levels           → FormProvider + useFormContext
└─ A section rendered
   more than once      → FormProvider + useFormContext
```

### Validation mode

| Mode          | Validates                        | Use for                            |
| ------------- | -------------------------------- | ---------------------------------- |
| `"onBlur"`    | When the field loses focus       | The default choice                 |
| `"onTouched"` | First blur, then on every change | Long forms where re-checking helps |
| `"onSubmit"`  | On submit only (library default) | Short forms with obvious rules     |
| `"onChange"`  | Every keystroke                  | Live search or preview fields      |
| `"all"`       | Blur and change                  | Rarely worth the validation runs   |

---

## Anti-Patterns

> One-line statements of these are in [SKILL.md](SKILL.md) under Red flags. This section carries the
> before/after code.

### Index as key in useFieldArray

React matches rows by key. With an index, removing item 2 of 5 leaves keys `0..3` addressing
different data than before, and every value below the removed row shifts up one input.

```typescript
// WRONG
{fields.map((field, index) => (
  <div key={index}>
    <input {...register(`items.${index}.name`)} />
  </div>
))}

// CORRECT
{fields.map((field, index) => (
  <div key={field.id}>
    <input {...register(`items.${index}.name`)} />
  </div>
))}
```

### Subscribing to the whole formState

Each destructured property is a subscription. Six of them re-render the form on any change.

```typescript
// WRONG
const {
  formState: { errors, isValid, isDirty, touchedFields, dirtyFields, isSubmitting }
} = useForm();

// CORRECT — take only what this component renders
const { formState: { errors, isSubmitting } } = useForm();

// BETTER — move the subscription to the component that reads it
function SubmitButton({ control }) {
  const { isSubmitting, isValid } = useFormState({ control });
  return <button disabled={isSubmitting || !isValid}>Submit</button>;
}
```

### watch() in the render body

```typescript
// WRONG — re-renders on every field's every keystroke
function MyForm() {
  const { register, watch } = useForm();
  const allValues = watch();
  return <div>{allValues.name}</div>;
}

// CORRECT — the subscription lives in the component that reads it
function NameDisplay({ control }) {
  const name = useWatch({ control, name: "name" });
  return <div>{name}</div>;
}
```

### defaultValue prop alongside register

The prop and the form's own defaults are two sources for one value, and `reset()` restores the
form's, not the prop's.

```typescript
// WRONG
<input defaultValue="John" {...register("name")} />

// CORRECT
const { register } = useForm({ defaultValues: { name: "John" } });
<input {...register("name")} />
```

### Undefined reaching a controlled component

`field.value` is `undefined` until defaults are applied, and a controlled component handed
`undefined` switches to uncontrolled and warns.

```typescript
// WRONG
<Controller
  name="date"
  control={control}
  render={({ field }) => <DatePicker value={field.value} />}
/>

// CORRECT
<Controller
  name="date"
  control={control}
  render={({ field }) => (
    <DatePicker value={field.value ?? null} onChange={field.onChange} />
  )}
/>
```

### Stacked useFieldArray operations

Each operation reads the array as it was at render, so the second acts on stale indices.

```typescript
// WRONG — remove() uses an index that append() has already invalidated
const handleDuplicate = (index) => {
  const item = getValues(`items.${index}`);
  append(item);
  remove(index);
};

// CORRECT — one operation on a computed array
const handleDuplicate = (index) => {
  const items = getValues("items");
  const next = [...items];
  next.splice(index + 1, 0, { ...next[index] });
  replace(next);
};
```

---

## API Lookup

### useForm options

| Option             | Description                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `defaultValues`    | Initial values, read once on mount                                                              |
| `values`           | Reactive values; the form follows them as they change                                           |
| `resetOptions`     | What survives when `values` changes — `keepDirtyValues`, `keepErrors`                           |
| `mode`             | When validation runs before the first submit                                                    |
| `reValidateMode`   | When it runs after the first submit                                                             |
| `resolver`         | Hands validation to a schema; use the `@hookform/resolvers` adapter matching the schema library |
| `disabled`         | Disables every registered input and `Controller` field                                          |
| `shouldUnregister` | Whether unmounting a field discards its value (default `false`)                                 |
| `criteriaMode`     | `"firstError"` or `"all"` — how many errors a field reports                                     |

### register options

| Option                    | Shape                                             |
| ------------------------- | ------------------------------------------------- |
| `required`                | `"Field is required"`                             |
| `min` / `max`             | `{ value: 0, message: "Min is 0" }`               |
| `minLength` / `maxLength` | `{ value: 3, message: "At least 3" }`             |
| `pattern`                 | `{ value: /regex/, message: "..." }`              |
| `validate`                | `(value) => true \| string`, or a record of them  |
| `valueAsNumber`           | Parses the input's string to a number             |
| `valueAsDate`             | Parses to a `Date`                                |
| `setValueAs`              | Arbitrary transform on the raw string             |
| `disabled`                | Disables the input and sets its value `undefined` |

A `message` on any of these is ignored once `resolver` is set — the schema owns the messages then.

### formState properties

| Property        | Description                                | Changes on       |
| --------------- | ------------------------------------------ | ---------------- |
| `errors`        | Validation errors by path                  | Validation       |
| `isSubmitting`  | True during `handleSubmit`                 | Submit start/end |
| `isValid`       | True when no errors                        | Validation       |
| `isDirty`       | True if any value differs from its default | Any change       |
| `dirtyFields`   | Which fields differ                        | Any change       |
| `touchedFields` | Which fields have been blurred             | Blur             |
| `isSubmitted`   | True after the first submit                | First submit     |
| `submitCount`   | Number of submit attempts                  | Each submit      |

`isValid` reflects the whole form. Gating a wizard step on it never passes — use
`trigger(stepFields)`.

---

## Version Lookup

Features referenced elsewhere in this skill, with the release that introduced them. Check the
installed version before reaching for one.

| Feature                          | Since   | Covered in                                                     |
| -------------------------------- | ------- | -------------------------------------------------------------- |
| `<Form />` component             | v7.46.0 | [examples/form-options.md](examples/form-options.md) Pattern 9 |
| `useWatch` `exact`               | v7.47.0 | [examples/performance.md](examples/performance.md) Pattern 11  |
| `reset` `keepIsSubmitSuccessful` | v7.47.0 | —                                                              |
| `useForm` `disabled`             | v7.48.0 | [examples/form-options.md](examples/form-options.md) Pattern 8 |
| `useWatch` `compute`             | v7.61.0 | [examples/performance.md](examples/performance.md) Pattern 12  |
| `<FormStateSubscribe />`         | v7.68.0 | [examples/performance.md](examples/performance.md) Pattern 10  |
| Field array ghost-element fix    | v7.70.0 | —                                                              |
| `FormProvider` memoization       | v7.71.0 | —                                                              |

`values` and `resetOptions` have been available throughout v7.

---

## Performance Checklist

Items not already covered by the Red flags in [SKILL.md](SKILL.md):

- [ ] `React.memo` around a `Controller` whose rendered component is expensive
- [ ] `criteriaMode: "firstError"` (the default) unless every error per field is displayed
- [ ] `useWatch` `compute` where several fields feed one displayed value
- [ ] `FormStateSubscribe` instead of a wrapper component per subscription (v7.68.0+)
