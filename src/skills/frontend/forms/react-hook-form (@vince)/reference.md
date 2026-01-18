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

### Form Library Integration

```
Which component library are you using?
├─ Native HTML inputs → Use register
├─ Radix UI / Headless UI → Depends on component
│   ├─ Simple components (Checkbox, Radio) → May work with register
│   └─ Complex components (Select, Combobox) → Use Controller ✓
├─ Material UI / Ant Design / Chakra → Use Controller ✓
└─ Custom components → Does it forward ref to input?
    ├─ YES → Use register
    └─ NO → Use Controller ✓
```

---

## RED FLAGS

### High Priority Issues

- **Using array index as key in useFieldArray** - Causes form state corruption when items are added/removed. Always use `field.id`.
- **Missing TypeScript generics on useForm** - Loses type safety for field names, values, and errors. Always use `useForm<FormData>()`.
- **Using `mode: "onChange"` without reason** - Validates on every keystroke which is noisy UX. Use `mode: "onBlur"` or `mode: "onTouched"`.
- **Using register for controlled components** - register doesn't work with components that don't expose ref. Use Controller instead.
- **Not providing defaultValues** - Can cause hydration mismatches and undefined value warnings. Always provide defaultValues.

### Medium Priority Issues

- **Destructuring many formState properties** - Subscribes to all of them, causing unnecessary re-renders. Only destructure what you need.
- **Using watch() in render body** - Causes re-render on every field change. Use useWatch for isolated subscriptions.
- **Calling setValue without shouldValidate** - May leave form in invalid state. Consider `setValue(name, value, { shouldValidate: true })`.
- **Not using trigger() for step validation** - Multi-step forms need per-step validation. Use `trigger(fieldNames)`.
- **Forgetting valueAsNumber on number inputs** - Values come as strings without it. Add `valueAsNumber: true` to register options.

### Common Mistakes

- **Stacking useFieldArray operations** - Don't call append then remove in sequence. Use useEffect for dependent operations.
- **Not handling form reset after submission** - Form stays dirty after success. Call `reset(data)` to clear dirty state.
- **Using defaultValue prop on registered inputs** - Conflicts with RHF's defaultValues. Only use defaultValues in useForm.
- **Forgetting to pass control to useFieldArray** - Required unless using FormProvider. Always pass `control` prop.
- **Not typing the resolver schema** - Loses type inference. Use `z.infer<typeof schema>` for Zod schemas.

### Gotchas & Edge Cases

- **reset() behavior varies** - `reset()` reverts to defaultValues, `reset(newData)` updates both values AND defaultValues.
- **Controller re-renders on every form change** - By design. For expensive renders, wrap child in React.memo.
- **useFieldArray requires complete objects** - append/prepend/insert need full objects, not partial data.
- **Errors object structure** - Array errors are at `errors.arrayName[index].fieldName`, array-level errors at `errors.arrayName.root`.
- **shouldUnregister removes data** - When true, unmounted fields lose their values. Keep false (default) for multi-step forms.
- **resolver validation runs async** - May cause flash of invalid state. Use `isValid` from formState for button states.
- **values vs defaultValues** - Use `values` for reactive external data (v7.x+), `defaultValues` for static initial values.
- **useWatch initial value** - Returns `defaultValue` or `defaultValues` from useForm on first render before subscription.
- **setValue and useFieldArray** - `setValue` no longer directly updates useFieldArray. Use `replace()` API instead.
- **FormStateSubscribe requires FormProvider** - Must wrap form with FormProvider to use FormStateSubscribe component.
- **handleSubmit no longer catches errors** - Since v7.42.0, errors in onSubmit callback are not caught. Handle errors in your callback.

---

## Anti-Patterns

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
  remove(index);  // May remove wrong item!
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

| Property | Description | Re-render Trigger |
|----------|-------------|-------------------|
| `errors` | Validation errors object | On validation |
| `isSubmitting` | True during handleSubmit | On submit start/end |
| `isValid` | True when no errors | On validation |
| `isDirty` | True if any field changed | On any change |
| `dirtyFields` | Object of dirty field names | On any change |
| `touchedFields` | Object of touched field names | On blur |
| `isSubmitted` | True after first submit | On first submit |
| `submitCount` | Number of submit attempts | On each submit |

### useFieldArray Methods

| Method | Description | Usage |
|--------|-------------|-------|
| `append(obj)` | Add to end | `append({ name: "" })` |
| `prepend(obj)` | Add to start | `prepend({ name: "" })` |
| `insert(index, obj)` | Add at index | `insert(1, { name: "" })` |
| `remove(index)` | Remove at index | `remove(2)` or `remove()` for all |
| `swap(from, to)` | Swap positions | `swap(0, 1)` |
| `move(from, to)` | Move to position | `move(0, 2)` |
| `update(index, obj)` | Replace at index | `update(0, { name: "new" })` |
| `replace(arr)` | Replace all | `replace([{ name: "" }])` |

### Reset Options (v7.47+)

| Option | Description |
|--------|-------------|
| `keepErrors` | Preserve all errors |
| `keepDirty` | Preserve isDirty and dirtyFields |
| `keepDirtyValues` | Preserve dirty field values, update only non-dirty |
| `keepValues` | Preserve all input values |
| `keepDefaultValues` | Keep original defaultValues |
| `keepIsSubmitted` | Preserve isSubmitted state |
| `keepTouched` | Preserve touchedFields |
| `keepIsValid` | Preserve isValid state |
| `keepSubmitCount` | Preserve submitCount |
| `keepIsSubmitSuccessful` | Preserve isSubmitSuccessful (v7.47.0+) |
| `keepFieldsRef` | Skip input ref re-registration (v7.60.0+) |

### New Components (v7.46+)

| Component | Version | Use Case |
|-----------|---------|----------|
| `<Form />` | v7.46.0 | Progressive enhancement, Server Actions |
| `<FormStateSubscribe />` | v7.68.0 | Targeted re-renders for specific formState |

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
