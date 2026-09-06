# Base UI - Forms Examples

> Field, Fieldset, Form, validation modes and external errors. See [styling.md](styling.md) for field-state selectors, [state.md](state.md) for controlled values.

**Prerequisites**: Understand [Pattern 12: Uncontrolled by Default](state.md#pattern-12-uncontrolled-by-default).

---

## Pattern 16: Field Anatomy

### Good Example - A Field With Every Part

```tsx
import { Field } from "@base-ui/react/field";

export function EmailField() {
  return (
    <Field.Root name="email" className="field">
      <Field.Label className="label">Email</Field.Label>
      <Field.Control type="email" required className="control" />
      <Field.Description className="description">
        We only use this to send receipts.
      </Field.Description>
      <Field.Error className="error" />
    </Field.Root>
  );
}
```

**Why good:** `Field.Root` wires `Label` to `Control` and points `aria-describedby` at both `Description` and `Error` without any manual `id` plumbing, `Error` renders the browser's own validation message for `required`/`type="email"` when no custom text is supplied, `name` includes the control in native `FormData`

**Parts and elements:** `Field.Root` renders a `<div>`, `Field.Label` a `<label>`, `Field.Control` an `<input>`, `Field.Description` a `<p>`, `Field.Error` a `<div>`, and `Field.Validity` takes a function as its child.

### Bad Example - Hand-Rolled Label and Error Wiring

```tsx
<div className="field">
  <label htmlFor="email">Email</label>
  <input id="email" type="email" aria-invalid={hasError} />
  {hasError && <span className="error">Enter a valid email</span>}
</div>
```

**Why bad:** the error text is never associated with the input, so a screen reader announces "invalid" with no reason, the `id` must stay unique by hand across a list of repeated fields, and the error state is tracked in React rather than read from the control's own validity

---

## Pattern 17: Field Around a Non-Native Control

### Good Example - Field Wrapping a Base UI Input Component

```tsx
import { Combobox } from "@base-ui/react/combobox";
import { Field } from "@base-ui/react/field";

export function CountryField({ countries }: { countries: string[] }) {
  return (
    <Field.Root name="country" className="field">
      <Field.Label className="label">Country of residence</Field.Label>
      <Combobox.Root items={countries}>{/* … */}</Combobox.Root>
      <Field.Error className="error" />
    </Field.Root>
  );
}
```

**Why good:** `Field.Root` labels and validates any Base UI control placed inside it, not only `Field.Control`, and the control renders a hidden input so the value participates in native submission and native constraint validation under the `name` on `Field.Root`

---

## Pattern 18: Validation Modes and Custom Validation

### Good Example - Choosing When Validation Runs

```tsx
const VALIDATION_DEBOUNCE_MS = 400;

// Default: validate on submit, then re-validate on change once invalid
<Field.Root name="nickname" />

// Validate when focus leaves — good for formats the user completes in one go
<Field.Root name="email" validationMode="onBlur" />

// Validate per keystroke — reserve for live feedback like password strength
<Field.Root
  name="username"
  validationMode="onChange"
  validationDebounceTime={VALIDATION_DEBOUNCE_MS}
  validate={async (value) => {
    const taken = await isUsernameTaken(String(value));
    return taken ? "That username is taken" : null;
  }}
/>
```

**Why good:** `onSubmit` is the default because it does not scold the user mid-typing, `validationDebounceTime` stops an async `validate` from firing a request per keystroke, returning `null` signals valid and a string signals the message to display

### Bad Example - onChange Validation Without Debounce

```tsx
<Field.Root
  name="username"
  validationMode="onChange"
  validate={async (value) => checkAvailability(String(value))}
/>
```

**Why bad:** one network request per keystroke, responses arrive out of order so the message can reflect a value the user already replaced, and the field flashes "required" the moment the user clears a character

### Good Example - Custom Rendering With Field.Validity

```tsx
<Field.Root name="password">
  <Field.Label>Password</Field.Label>
  <Field.Control type="password" required minLength={8} />
  <Field.Validity>
    {(state) => (
      <ul className="requirements">
        <li data-met={!state.validity.valueMissing || undefined}>Not empty</li>
        <li data-met={!state.validity.tooShort || undefined}>
          At least 8 characters
        </li>
      </ul>
    )}
  </Field.Validity>
</Field.Root>
```

**Why good:** the native `ValidityState` flags drive a checklist instead of a single error string, `|| undefined` omits the attribute rather than writing `data-met="false"`

---

## Pattern 19: Form and Server-Returned Errors

### Good Example - Mapping a Server Response Onto Fields

```tsx
import { useState } from "react";
import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";

type FormErrors = Record<string, string | undefined>;

export function HomepageForm() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsSubmitting(true);
    const response = await submitHomepage(formData);
    // Keys must match the `name` on each Field.Root
    setErrors({ url: response.error });
    setIsSubmitting(false);
  };

  return (
    <Form errors={errors} onClearErrors={setErrors} onSubmit={handleSubmit}>
      <Field.Root name="url" className="field">
        <Field.Label className="label">Homepage</Field.Label>
        <Field.Control type="url" required placeholder="https://example.com" />
        <Field.Error className="error" />
      </Field.Root>
      <button type="submit" disabled={isSubmitting}>
        Submit
      </button>
    </Form>
  );
}
```

**Why good:** `errors` is keyed by `name`, so a server response becomes an inline message with no per-field state, `onClearErrors` lets the form drop a stale error when the user edits the offending field, `FormData` from `event.currentTarget` includes the hidden inputs of non-native controls automatically

### Bad Example - Rendering Server Errors Outside the Fields

```tsx
<form onSubmit={handleSubmit}>
  {serverError && <div className="banner">{serverError}</div>}
  <Field.Root name="url">
    <Field.Control type="url" />
  </Field.Root>
</form>
```

**Why bad:** the message is not associated with the control that caused it, so focus never moves there and a screen reader user has to hunt for the field, and using a bare `<form>` gives up the `errors`/`onClearErrors` wiring entirely

---

## Pattern 20: Fieldset Grouping

### Good Example - Grouping Related Controls

```tsx
import { Field } from "@base-ui/react/field";
import { Fieldset } from "@base-ui/react/fieldset";

<Fieldset.Root className="fieldset">
  <Fieldset.Legend className="legend">Billing address</Fieldset.Legend>
  <Field.Root name="street">
    <Field.Label>Street</Field.Label>
    <Field.Control />
  </Field.Root>
  <Field.Root name="postcode">
    <Field.Label>Postcode</Field.Label>
    <Field.Control />
  </Field.Root>
</Fieldset.Root>;
```

**Why good:** `Fieldset.Root` renders a real `<fieldset>`, so disabling it disables every control inside, and the legend is announced as the group name before each field's own label

**Gotcha:** `Fieldset.Legend` renders a `<div>`, not a `<legend>` — it is associated by ARIA rather than by element. A selector like `fieldset > legend` will not match it; use the class you gave it.

---

## Pattern 21: Integrating an External Form Runtime

### Good Example - The Controlled Surface Any Form Library Can Drive

```tsx
import { Field } from "@base-ui/react/field";

// Whatever library owns the value passes it in; Field owns the presentation.
type ControlledFieldProps = {
  name: string;
  label: string;
  value: string;
  invalid: boolean;
  errorMessage?: string;
  onValueChange: (next: string) => void;
  onBlur: () => void;
  ref?: React.Ref<HTMLInputElement>;
};

export function ControlledField({
  name,
  label,
  value,
  invalid,
  errorMessage,
  onValueChange,
  onBlur,
  ref,
}: ControlledFieldProps) {
  return (
    <Field.Root name={name} invalid={invalid} className="field">
      <Field.Label className="label">{label}</Field.Label>
      <Field.Control
        ref={ref}
        value={value}
        onValueChange={onValueChange}
        onBlur={onBlur}
      />
      <Field.Error match={invalid} className="error">
        {errorMessage}
      </Field.Error>
    </Field.Root>
  );
}
```

**Why good:** `invalid` on `Field.Root` and `match` on `Field.Error` let an external validity source override the built-in one, so any runtime supplying `value`, `onValueChange`, `onBlur`, `ref` and a validity flag plugs in without an adapter package

**When not to use:** if nothing outside the form needs the values before submit, skip the runtime entirely — `name` plus `FormData` plus `validate` already covers most forms.
