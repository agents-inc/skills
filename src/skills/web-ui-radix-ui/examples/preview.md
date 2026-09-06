# Radix UI - Preview Components

> The `unstable_`-prefixed primitives. They ship and work; their props change between minor
> versions. Lookup tables for the OTP keyboard map and the Form `match` values are in
> [reference.md](../reference.md).

```typescript
import {
  unstable_OneTimePasswordField as OneTimePasswordField,
  unstable_PasswordToggleField as PasswordToggleField,
  unstable_Form as Form,
} from "radix-ui";
```

The prefix is a statement about the API surface rather than the implementation. Reach for these when
the behaviour is worth owning an upgrade cost for, and pin the version when it is not.

---

## Pattern 1: OneTimePasswordField

A row of single-character inputs that behaves as one field: arrow keys and backspace move between
them, a pasted code fills them all, and password managers autofill it.

### Good Example - OTP Verification

```typescript
import { unstable_OneTimePasswordField as OneTimePasswordField } from "radix-ui";

const OTP_LENGTH = 6;

type OTPInputProps = {
  onComplete: (otp: string) => void;
  onAutoSubmit?: () => void;
  length?: number;
  autoSubmit?: boolean;
  validationType?: "numeric" | "alphanumeric";
};

export function OTPInput({
  onComplete,
  onAutoSubmit,
  length = OTP_LENGTH,
  autoSubmit = false,
  validationType = "numeric",
}: OTPInputProps) {
  return (
    <OneTimePasswordField.Root
      onComplete={onComplete}
      onAutoSubmit={onAutoSubmit}
      autoSubmit={autoSubmit}
      validationType={validationType}
      className="otp-root"
    >
      {Array.from({ length }, (_, i) => (
        <OneTimePasswordField.Input
          key={i}
          index={i}
          className="otp-input"
          aria-label={`Digit ${i + 1} of ${length}`}
        />
      ))}
      <OneTimePasswordField.HiddenInput name="otp" />
    </OneTimePasswordField.Root>
  );
}
```

```css
.otp-root {
  display: flex;
  gap: 8px;
}

.otp-input {
  width: 48px;
  height: 56px;
  text-align: center;
  font-size: 24px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
}

.otp-input:focus {
  outline: none;
  border-color: var(--focus-color);
}

.otp-input[data-invalid] {
  border-color: var(--error-color);
}
```

**Why good:** `HiddenInput` is what carries the assembled value into a native form submission — the
visible inputs are unnamed, so without it the form posts nothing. Each `Input` needs its own
`aria-label`, since "Digit 3 of 6" is the only thing distinguishing it by ear. `validationType`
rejects unwanted characters at the input rather than at submit, and drives the mobile keyboard.

---

## Pattern 2: PasswordToggleField

A password input with a show/hide control that keeps focus and caret position across the toggle.

### Good Example - Password Input with Toggle

```typescript
import { unstable_PasswordToggleField as PasswordToggleField } from "radix-ui";

type PasswordInputProps = {
  name: string;
  label: string;
  error?: string;
  defaultVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
};

export function PasswordInput({
  name,
  label,
  error,
  defaultVisible = false,
  onVisibilityChange,
}: PasswordInputProps) {
  return (
    <PasswordToggleField.Root
      className="password-field"
      defaultVisible={defaultVisible}
      onVisibilityChange={onVisibilityChange}
    >
      <label htmlFor={name} className="password-label">
        {label}
      </label>
      <div className="password-input-wrapper">
        <PasswordToggleField.Input
          id={name}
          name={name}
          className="password-input"
          aria-describedby={error ? `${name}-error` : undefined}
          aria-invalid={!!error}
        />
        <PasswordToggleField.Toggle
          className="password-toggle"
          aria-label="Toggle password visibility"
        >
          <PasswordToggleField.Icon
            visible={<EyeIcon />}
            hidden={<EyeOffIcon />}
          />
        </PasswordToggleField.Toggle>
      </div>
      {error && (
        <span id={`${name}-error`} className="password-error">
          {error}
        </span>
      )}
    </PasswordToggleField.Root>
  );
}
```

```css
.password-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  width: 100%;
  padding: 12px 48px 12px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.password-toggle {
  position: absolute;
  right: 8px;
  padding: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
}

.password-toggle:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

.password-error {
  color: var(--error-color);
  font-size: 14px;
}
```

**Why good:** `Icon` swaps on visibility state, so the two glyphs need no conditional and no state of
their own. Focus returns to the input after a pointer toggle, which is the behaviour a hand-rolled
button loses. Visibility resets on form submission, so a revealed password does not persist into the
next render. `autoComplete` defaults to `"current-password"`; set it to `"new-password"` on a
sign-up form or password managers will offer the wrong entry.

---

## Pattern 3: Form Validation

Form builds on the browser's own constraint validation API rather than a schema. `Message` renders
when its `match` condition holds, and Radix wires `aria-describedby` between the control and
whichever messages are showing.

### Good Example - Sign-up Form with Validation Messages

```typescript
import { unstable_Form as Form } from "radix-ui";

export function SignUpForm() {
  return (
    <Form.Root
      className="form-root"
      onClearServerErrors={() => {
        // Clear server-side validation state
      }}
    >
      <Form.Field name="email" className="form-field">
        <Form.Label className="form-label">Email</Form.Label>
        <Form.Control asChild>
          <input type="email" required className="form-input" />
        </Form.Control>
        <Form.Message match="valueMissing" className="form-message">
          Please enter your email
        </Form.Message>
        <Form.Message match="typeMismatch" className="form-message">
          Please enter a valid email address
        </Form.Message>
      </Form.Field>

      <Form.Field name="password" className="form-field">
        <Form.Label className="form-label">Password</Form.Label>
        <Form.Control asChild>
          <input type="password" required minLength={8} className="form-input" />
        </Form.Control>
        <Form.Message match="valueMissing" className="form-message">
          Please enter a password
        </Form.Message>
        <Form.Message match="tooShort" className="form-message">
          Password must be at least 8 characters
        </Form.Message>
        {/* A custom match receives (value, formData) and may be async */}
        <Form.Message
          match={(value) => !/[A-Z]/.test(value)}
          className="form-message"
        >
          Password must contain at least one uppercase letter
        </Form.Message>
      </Form.Field>

      {/* forceMatch shows a message the client cannot derive */}
      <Form.Field name="username" serverInvalid={false} className="form-field">
        <Form.Label className="form-label">Username</Form.Label>
        <Form.Control asChild>
          <input type="text" required className="form-input" />
        </Form.Control>
        <Form.Message match="valueMissing" className="form-message">
          Please enter a username
        </Form.Message>
        <Form.Message forceMatch className="form-message">
          This username is already taken
        </Form.Message>
      </Form.Field>

      <Form.Submit className="form-submit">Sign Up</Form.Submit>
    </Form.Root>
  );
}
```

```css
.form-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-weight: 500;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.form-field[data-invalid] .form-input {
  border-color: var(--error-color);
}

.form-message {
  color: var(--error-color);
  font-size: 14px;
}
```

**Why good:** `Field`'s `name` is what associates the label, the control and every message, so no
`htmlFor` or `id` is written by hand. The built-in matches map onto `ValidityState` flags the browser
already computes, so `required` and `minLength` on the input are the validation rather than a
duplicate of it. `serverInvalid` plus `forceMatch` is the pair that surfaces an error only the server
knows — "username taken" has no client-side test — and `onClearServerErrors` retires it once the
field is edited. Submission moves focus to the first invalid field.
