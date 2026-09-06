# Accessibility — Forms

> Labels, error handling, required fields and the listbox contract. See [SKILL.md](../SKILL.md) for the decisions.

---

## Pattern 5: A field and its error

```typescript
import { useState, type FormEvent } from "react";

interface FormErrors {
  email?: string;
  password?: string;
}

const MIN_PASSWORD_LENGTH = 8;

function validate(formData: FormData): FormErrors {
  const errors: FormErrors = {};
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) errors.email = "Please enter a valid email";
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  return errors;
}

export function LoginForm() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  const errorCount = Object.keys(errors).length + (submitError ? 1 : 0);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const validationErrors = validate(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    try {
      // your own sign-in call — this file is only about what the form says
      await submitLogin(formData);
    } catch {
      setSubmitError("Login failed. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errorCount > 0 && (
        <div role="alert">
          <h2>There {errorCount === 1 ? "is 1 error" : `are ${errorCount} errors`} in this form</h2>
          <ul>
            {errors.email && (
              <li>
                <a href="#email">{errors.email}</a>
              </li>
            )}
            {errors.password && (
              <li>
                <a href="#password">{errors.password}</a>
              </li>
            )}
            {submitError && <li>{submitError}</li>}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="email">
          Email <span aria-hidden="true">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          aria-required="true"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <span id="email-error" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="password">
          Password <span aria-hidden="true">*</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          aria-required="true"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        {errors.password && (
          <span id="password-error" role="alert">
            {errors.password}
          </span>
        )}
      </div>

      <button type="submit">Log in</button>
    </form>
  );
}
```

**Why good:** the summary announces how many problems there are and links to each field, which is
what a screen reader user needs before they start hunting. `aria-invalid` marks the field itself,
`aria-describedby` attaches the message so it is read as part of the field rather than as loose text,
and `role="alert"` announces it on appearance. `noValidate` turns off the browser's own bubbles,
which are inconsistently announced and cannot be styled — worth doing only because the form then
validates fully itself.

`aria-describedby` is set to `undefined` rather than an empty string when there is no error, so React
omits the attribute entirely; an empty one points at nothing and is read as such by some
combinations.

**The asterisk:** `aria-hidden` on it, because `aria-required` already announces the requirement —
otherwise the field is read as "Email star, required".

---

## Validation timing

Validating on every keystroke inside a `role="alert"` interrupts continuously and makes a field
unusable. Validate on blur, and on submit, and downgrade in-progress feedback to `role="status"`, or
to no live region at all.

```typescript
const [value, setValue] = useState("");
const [isVisible, setIsVisible] = useState(false);

const requirements = [
  { id: "length", label: "At least 8 characters", isMet: value.length >= 8 },
  { id: "digit", label: "Contains a number", isMet: /\d/.test(value) },
  { id: "upper", label: "Contains uppercase", isMet: /[A-Z]/.test(value) },
];

<ul id="password-requirements" aria-live="polite">
  {requirements.map((requirement) => (
    <li key={requirement.id} data-met={requirement.isMet}>
      <span aria-hidden="true">{requirement.isMet ? "✓" : "×"}</span>
      <span>{requirement.label}</span>
    </li>
  ))}
</ul>;

<input
  type={isVisible ? "text" : "password"}
  value={value}
  onChange={(event) => setValue(event.target.value)}
  aria-describedby="password-requirements"
/>;
```

**Why good:** `aria-live="polite"` on the list waits for a pause in speech, so requirements being
ticked off do not interrupt the reader's own typing; the tick and cross are hidden and the state
lives on `data-met`, where CSS can reach it and the adjacent text already carries the meaning.

---

## Required fields

```typescript
<label htmlFor="email">
  Email
  <span aria-hidden="true">*</span>
</label>
<input
  id="email"
  type="email"
  required
  aria-required="true"
  aria-describedby="email-hint"
/>
<p id="email-hint">We will never share your email.</p>
```

```typescript
<p>
  <span aria-hidden="true">*</span> indicates a required field
</p>
```

**Why good:** the legend explains the convention for readers who meet the asterisk before the field,
and `required` gives the browser its own constraint validation while `aria-required` covers the
assistive layer — they are not redundant, because `noValidate` disables the first and not the second.

The asterisk is hidden in both places, for the reason Pattern 5 gives: `aria-required` already
announces the requirement, so labelling the star as well reads it twice.

A hint element needs `aria-describedby` on the input to be announced with it; a `<p>` sitting nearby
is read only if the reader happens to continue past the field.

---

## Show-password toggle

```typescript
<button type="button" onClick={() => setIsVisible(!isVisible)} aria-pressed={isVisible}>
  {isVisible ? "Hide" : "Show"} password
</button>
```

**Why good:** it is a real button so Enter and Space work, `type="button"` stops it submitting the
form, and `aria-pressed` announces the state rather than leaving the reader to infer it from a label
that has already changed.

---

## The listbox contract

Whatever implements a custom select owes all of this. Check a component library against it rather
than building it — the keyboard half is where hand-written versions fail.

```typescript
// Trigger
<button aria-haspopup="listbox" aria-expanded={isOpen} aria-controls="options" id="select-label">
  {selectedLabel ?? "Choose an option"}
  <span aria-hidden="true">▼</span>
</button>

// Popup
<ul role="listbox" id="options" aria-labelledby="select-label" aria-activedescendant={activeId}>
  <li role="option" id="option-1" aria-selected={selectedId === "option-1"}>Option 1</li>
  <li role="option" id="option-2" aria-selected={selectedId === "option-2"}>Option 2</li>
</ul>
```

**Keyboard:** Down and Up move the active option, Home and End jump to the ends, typing a character
jumps to the next option starting with it, Enter selects, Escape closes and returns focus to the
trigger.

**Why good:** `aria-activedescendant` keeps DOM focus on the trigger while the announced option
moves, which is what lets typing keep working. `aria-selected` is the chosen value and the active
descendant is the highlighted one — conflating them announces every option a reader arrows past as
selected.

A native `<select>` gives all of this for free, including on mobile where it becomes a platform
picker. Reach for the custom one only when the design genuinely cannot use it.
