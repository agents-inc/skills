# TanStack Form Reference

> Decision frameworks, API tables, and quick lookups for TanStack Form. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use onChange vs onBlur vs onSubmit Validators

```
What validation UX do you need?
├─ Validate while user is typing → onChange (use sparingly — noisy)
├─ Validate after user leaves field → onBlur (recommended default)
├─ Validate only on form submit → onSubmit
├─ Validate with async check while typing → onChangeAsync (auto-debounced)
├─ Validate with async check on blur → onBlurAsync (recommended for server checks)
└─ Validate with async check on submit → onSubmitAsync (server-side validation)
```

### When to Use form.Field vs form.AppField

```
Are you using createFormHook?
├─ YES → Do you need a custom registered component?
│   ├─ YES → Use form.AppField with the component name ✓
│   └─ NO → Use form.Field with inline children ✓
└─ NO → Use form.Field (form.AppField is not available) ✓
```

### When to Use form.Subscribe vs useStore

```
Do you need reactive form state in JSX?
├─ YES → Is it a simple conditional (submit button, error display)?
│   ├─ YES → Use form.Subscribe with selector ✓
│   └─ NO → Use useStore(form.store, selector) in a component ✓
└─ NO → Use form.getFieldValue() or form.state in event handlers
```

### Array Fields: pushValue vs setValue

```
Are you working with a dynamic list of fields?
├─ YES → Use mode="array" on form.Field
│   ├─ Adding items → pushValue (complete objects only)
│   ├─ Removing items → removeValue(index)
│   ├─ Reordering → swapValues(indexA, indexB) or moveValue(from, to)
│   └─ Inserting → insertValue(index, value)
└─ NO → Use form.setFieldValue for single field updates
```

---

## Anti-Patterns

### Binding an Input Without form.Field

There is no field-registration helper and no ref forwarding. An input joins the form only by being
rendered inside `form.Field`'s `children`, reading `field.state.value` and calling
`field.handleChange`. Spreading anything onto an input, or wiring it to component state, leaves the
field absent from the submit payload and unvalidated.

```tsx
// WRONG — the field never joins the form
const [name, setName] = useState("");
<input value={name} onChange={(e) => setName(e.target.value)} />;

// CORRECT — form.Field owns the value and the handlers
<form.Field
  name="name"
  children={(field) => (
    <input
      value={field.state.value}
      onBlur={field.handleBlur}
      onChange={(e) => field.handleChange(e.target.value)}
    />
  )}
/>;
```

### Reading form.state Directly

Accessing `form.state` in the component body subscribes to ALL state changes.

```tsx
// WRONG — re-renders on every state change
function MyForm() {
  const form = useForm({
    /* ... */
  });
  const canSubmit = form.state.canSubmit; // Triggers re-render on ANY change
  return <button disabled={!canSubmit}>Submit</button>;
}

// CORRECT — scoped subscription
<form.Subscribe
  selector={(state) => state.canSubmit}
  children={(canSubmit) => <button disabled={!canSubmit}>Submit</button>}
/>;
```

### Missing e.preventDefault() on Form Submit

```tsx
// WRONG — page reloads
<form onSubmit={() => form.handleSubmit()}>

// CORRECT
<form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
```

### Partial Objects in pushValue

```tsx
// WRONG — type error, incomplete object
hobbiesField.pushValue({ name: "" });
// when shape is { name: string; description: string; level: number }

// CORRECT — complete object
hobbiesField.pushValue({ name: "", description: "", level: 0 });
```

---

## Validator Events Reference

| Event      | Sync       | Async           | When It Fires                        |
| ---------- | ---------- | --------------- | ------------------------------------ |
| `onChange` | `onChange` | `onChangeAsync` | Every call to `field.handleChange`   |
| `onBlur`   | `onBlur`   | `onBlurAsync`   | Every call to `field.handleBlur`     |
| `onSubmit` | `onSubmit` | `onSubmitAsync` | When `form.handleSubmit()` is called |
| `onMount`  | `onMount`  | —               | When field component mounts          |

**Sync-first gating:** When both sync and async validators exist for the same event, the async validator only runs if the sync validator passes.

**`onChangeListenTo`:** Array of field names. When any listed field changes, this field's `onChange`/`onChangeAsync` validators re-run.

**`onBlurListenTo`:** Same as `onChangeListenTo` but for blur events.

---

## Field State Reference

| Property                         | Type       | Description                           |
| -------------------------------- | ---------- | ------------------------------------- |
| `field.state.value`              | `T`        | Current field value                   |
| `field.state.meta.errors`        | `string[]` | All current validation errors         |
| `field.state.meta.isValidating`  | `boolean`  | True while async validator is running |
| `field.state.meta.isTouched`     | `boolean`  | True after `handleBlur` has fired     |
| `field.state.meta.isDirty`       | `boolean`  | True if value differs from default    |
| `field.state.meta.isPristine`    | `boolean`  | True if value equals default          |
| `field.state.meta.touchedErrors` | `string[]` | Errors only shown after touch         |

---

## Form State Reference

| Property                        | Type                       | Description                                |
| ------------------------------- | -------------------------- | ------------------------------------------ |
| `form.state.values`             | `TFormData`                | Current form values                        |
| `form.state.errors`             | `string[]`                 | Form-level errors                          |
| `form.state.errorMap`           | `Record<string, string[]>` | Errors keyed by event type                 |
| `form.state.canSubmit`          | `boolean`                  | True when form is valid and not submitting |
| `form.state.isSubmitting`       | `boolean`                  | True during `handleSubmit` execution       |
| `form.state.isValid`            | `boolean`                  | True when no validation errors             |
| `form.state.isDirty`            | `boolean`                  | True if any field changed from default     |
| `form.state.isTouched`          | `boolean`                  | True if any field has been blurred         |
| `form.state.isFieldsValid`      | `boolean`                  | True when all field-level validations pass |
| `form.state.isFormValid`        | `boolean`                  | True when form-level validations pass      |
| `form.state.submissionAttempts` | `number`                   | Count of submit attempts                   |

---

## Form API Methods

| Method              | Signature                       | Description                                     |
| ------------------- | ------------------------------- | ----------------------------------------------- |
| `handleSubmit`      | `() => Promise<void>`           | Runs validators, then calls `onSubmit` if valid |
| `setFieldValue`     | `(name, value, opts?) => void`  | Programmatically set a field value              |
| `getFieldValue`     | `(name) => T`                   | Get current value of a field                    |
| `setFieldMeta`      | `(name, updater) => void`       | Update field metadata                           |
| `resetField`        | `(name, opts?) => void`         | Reset a single field to default                 |
| `reset`             | `(values?, opts?) => void`      | Reset entire form                               |
| `validateAllFields` | `(cause) => Promise<...>`       | Trigger validation on all fields                |
| `validateField`     | `(name, cause) => Promise<...>` | Trigger validation on a specific field          |

---

## Array Field API

| Method         | Signature                  | Description                         |
| -------------- | -------------------------- | ----------------------------------- |
| `pushValue`    | `(value) => void`          | Append complete item to array       |
| `removeValue`  | `(index) => void`          | Remove item at index                |
| `insertValue`  | `(index, value) => void`   | Insert item at index                |
| `swapValues`   | `(indexA, indexB) => void` | Swap two items                      |
| `moveValue`    | `(from, to) => void`       | Move item from one index to another |
| `replaceValue` | `(index, value) => void`   | Replace item at index               |

---

## Framework Packages

| Framework       | Package                  | Form Hook/Controller        |
| --------------- | ------------------------ | --------------------------- |
| React           | `@tanstack/react-form`   | `useForm`, `createFormHook` |
| Vue             | `@tanstack/vue-form`     | `useForm`                   |
| Solid           | `@tanstack/solid-form`   | `createForm`                |
| Angular         | `@tanstack/angular-form` | `TanStackField` directive   |
| Lit             | `@tanstack/lit-form`     | `TanStackFormController`    |
| Core (headless) | `@tanstack/form-core`    | `FormApi`, `FieldApi`       |

---

## Standard Schema Adapter

A validator slot accepts a schema object directly, for any validation library implementing the
Standard Schema spec. No adapter package sits between them.

```tsx
import { z } from "zod";

<form.Field
  name="email"
  validators={{
    onChange: z.email("Invalid email"),
  }}
  children={(field) => (/* ... */)}
/>
```

**How it works:** a validator slot holding a schema object rather than a function is detected
through the Standard Schema interface and run directly, and the schema's own messages become the
field's errors.

**Mixing the two:** one field can take a schema while another takes a function, and the same field
can take a schema on `onChange` and a function on `onBlurAsync`.
