# React Hook Form Reference

> Decision frameworks, anti-patterns, and red flags for React Hook Form. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use register vs Controller

```
Is the input a native HTML element?
├─ YES → Does it expose a ref? (input, select, textarea)
│   ├─ YES → Use register ✓
│   └─ NO → Use Controller
└─ NO → Is it a controlled component (UI library)?
    ├─ YES → Use Controller ✓
    └─ NO → Evaluate if it can accept ref
        ├─ YES → Use register with ref
        └─ NO → Use Controller ✓
```

### When to Use useWatch vs watch

```
Do you need reactive value in render?
├─ YES → Should only specific fields trigger re-render?
│   ├─ YES → Use useWatch with name(s) ✓
│   └─ NO → Use useWatch without name (all fields)
└─ NO → Do you need value in event handler?
    ├─ YES → Use getValues() ✓
    └─ NO → Do you need value outside component?
        ├─ YES → Use watch() subscription ✓
        └─ NO → Reconsider if you need the value at all
```

### When to Use useFormContext

```
Are form methods needed in nested component?
├─ YES → Is prop drilling acceptable (1-2 levels)?
│   ├─ YES → Pass control/register as props
│   └─ NO → Use FormProvider + useFormContext ✓
└─ NO → Keep form methods in parent component
```

### Validation Mode Selection

```
What validation UX do you need?
├─ Validate after user leaves field → mode: "onBlur" ✓ (recommended)
├─ Validate after first submit, then on change → mode: "onTouched" ✓
├─ Validate only on submit → mode: "onSubmit"
├─ Validate on every keystroke → mode: "onChange" (use sparingly)
└─ Validate on all events → mode: "all" (rarely needed)
```

### Component Library Integration

```
What kind of component are you integrating?
├─ Native HTML inputs (input, select, textarea) → Use register
├─ Headless/unstyled components → Depends on component
│   ├─ Simple (checkbox, radio with ref forwarding) → May work with register
│   └─ Complex (custom select, combobox) → Use Controller ✓
├─ Fully styled component libraries → Use Controller ✓
└─ Custom components → Does it forward ref to a native input?
    ├─ YES → Use register
    └─ NO → Use Controller ✓
```

---

## Anti-Patterns

> See [SKILL.md](SKILL.md) RED FLAGS section for the full list of issues and gotchas.

### Using Index as Key in useFieldArray

Using array index as key causes React to incorrectly reconcile elements when items are added, removed, or reordered. Form values get associated with wrong inputs.

```typescript
// WRONG - Index as key
{fields.map((field, index) => (
  <div key={index}>  {/* WRONG */}
    <input {...register(`items.${index}.name`)} />
  </div>
))}

// CORRECT - field.id as key
{fields.map((field, index) => (
  <div key={field.id}>  {/* CORRECT */}
    <input {...register(`items.${index}.name`)} />
  </div>
))}
```

### Subscribing to Entire formState

Destructuring many formState properties subscribes to all of them, triggering re-renders when any change.

```typescript
// WRONG - Subscribing to everything
const {
  formState: { errors, isValid, isDirty, touchedFields, dirtyFields, isSubmitting }
} = useForm();

// CORRECT - Subscribe only to what you need
const { formState: { errors, isSubmitting } } = useForm();

// BETTER - Isolate subscriptions
function SubmitButton({ control }) {
  const { isSubmitting, isValid } = useFormState({ control });
  return <button disabled={isSubmitting || !isValid}>Submit</button>;
}
```

### Using watch() in Render Body

Calling `watch()` in the component body subscribes to all field changes and triggers re-renders.

```typescript
// WRONG - Causes re-render on any field change
function MyForm() {
  const { register, watch } = useForm();
  const allValues = watch(); // Re-renders on EVERY change

  return <div>{allValues.name}</div>;
}

// CORRECT - Isolated subscription
function NameDisplay({ control }) {
  const name = useWatch({ control, name: "name" });
  return <div>{name}</div>;
}
```

### Mixing defaultValue Prop with register

Using `defaultValue` prop on registered inputs conflicts with RHF's defaultValues.

```typescript
// WRONG - defaultValue prop conflicts
<input defaultValue="John" {...register("name")} />

// CORRECT - Use defaultValues in useForm
const { register } = useForm({
  defaultValues: { name: "John" }
});
<input {...register("name")} />
```

### Not Handling Controlled Component Values

Controller's field.value can be undefined before defaultValues are set, causing controlled component errors.

```typescript
// WRONG - May pass undefined to controlled component
<Controller
  name="date"
  control={control}
  render={({ field }) => (
    <DatePicker value={field.value} />  {/* value could be undefined */}
  )}
/>

// CORRECT - Handle undefined case
<Controller
  name="date"
  control={control}
  render={({ field }) => (
    <DatePicker value={field.value ?? null} onChange={field.onChange} />
  )}
/>
```

### Calling Multiple useFieldArray Operations Sequentially

Stacking operations like append then remove doesn't work as expected due to React's batching.

```typescript
// WRONG - Operations may conflict
const handleDuplicate = (index) => {
  const item = getValues(`items.${index}`);
  append(item);
  remove(index); // May remove wrong item!
};

// CORRECT - Use single operation or useEffect
const handleDuplicate = (index) => {
  const items = getValues("items");
  const newItems = [...items];
  const duplicated = { ...newItems[index] };
  newItems.splice(index + 1, 0, duplicated);
  setValue("items", newItems);
};
```

---

## Quick Reference

### useForm Options Checklist

- [ ] `defaultValues` - Always provide to prevent undefined warnings
- [ ] `mode` - Set to "onBlur" or "onTouched" for optimal UX
- [ ] `resolver` - Use for schema-based validation (Zod, Yup)
- [ ] Generic type - Always use `useForm<FormData>()` for type safety
- [ ] `values` - Use for reactive external data (v7.x+), replaces reset pattern
- [ ] `disabled` - Disable entire form and all inputs (v7.48.0+)
- [ ] `resetOptions` - Control behavior when values/defaultValues update

### register Options Checklist

- [ ] `required` - With message: `required: "Field is required"`
- [ ] `valueAsNumber` - For number inputs: `valueAsNumber: true`
- [ ] `min`/`max` - With message: `min: { value: 0, message: "Min is 0" }`
- [ ] `minLength`/`maxLength` - For string length validation
- [ ] `pattern` - For regex validation with message

### formState Properties

| Property        | Description                   | Re-render Trigger   |
| --------------- | ----------------------------- | ------------------- |
| `errors`        | Validation errors object      | On validation       |
| `isSubmitting`  | True during handleSubmit      | On submit start/end |
| `isValid`       | True when no errors           | On validation       |
| `isDirty`       | True if any field changed     | On any change       |
| `dirtyFields`   | Object of dirty field names   | On any change       |
| `touchedFields` | Object of touched field names | On blur             |
| `isSubmitted`   | True after first submit       | On first submit     |
| `submitCount`   | Number of submit attempts     | On each submit      |

### Performance Optimization Checklist

- [ ] Use `mode: "onBlur"` instead of `mode: "onChange"`
- [ ] Use `useFormState` for isolated subscriptions
- [ ] Use `useWatch` instead of `watch()` in render
- [ ] Only destructure needed formState properties
- [ ] Use `React.memo` for expensive Controller children
- [ ] Use `field.id` as key in useFieldArray (never index)
- [ ] Provide complete objects to append/prepend/insert
- [ ] Use `FormStateSubscribe` for targeted re-renders (v7.68.0+)
- [ ] Use `values` prop instead of reset pattern for async data
