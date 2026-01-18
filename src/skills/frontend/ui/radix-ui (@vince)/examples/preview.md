# Radix UI - Preview Components

> Preview components with unstable APIs. Import using `unstable_` prefix. **Updated: May 2025** - Includes OneTimePasswordField, PasswordToggleField, and Form primitives.

---

## Pattern 1: OneTimePasswordField (Preview)

OneTimePasswordField provides OTP input with keyboard navigation, paste support, and password manager integration.

### Good Example - OTP Verification

```typescript
import {
  unstable_OneTimePasswordField as OneTimePasswordField,
} from "radix-ui";

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
      {/* Hidden input for form submission */}
      <OneTimePasswordField.HiddenInput name="otp" />
    </OneTimePasswordField.Root>
  );
}

// Usage
function VerificationForm() {
  const handleOTPComplete = (otp: string) => {
    console.log("OTP entered:", otp);
    // Submit verification
  };

  return (
    <form>
      <label htmlFor="otp-input">Enter verification code</label>
      <OTPInput onComplete={handleOTPComplete} />
      <button type="submit">Verify</button>
    </form>
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

**Why good:** Named constant for OTP length, HiddenInput enables form submission, onComplete callback for completion handling, autoSubmit for automatic form submission, validationType restricts input, aria-label for accessibility, data-invalid for error styling

**Key Features:**

- Keyboard navigation mimics single input field (arrow keys, backspace)
- Paste support (auto-fills from clipboard)
- Password manager autofill compatibility
- Validation support via `validationType` prop (numeric/alphanumeric)
- `autoSubmit` prop for automatic form submission when complete
- `sanitizeValue` prop for custom value processing
- Hidden input for form data submission
- Support for `disabled`, `readOnly`, `placeholder` props

**Keyboard Shortcuts:**

| Key | Behavior |
|-----|----------|
| Enter | Submit associated form |
| Tab/Shift+Tab | Navigate outside root |
| Arrow Keys | Move between inputs |
| Home/End | Jump to first/last input |
| Delete | Clear current, shift values back |
| Backspace | Clear current, move focus left |
| Cmd+Backspace | Clear all inputs |

---

## Pattern 2: PasswordToggleField (Preview)

PasswordToggleField provides password input with visibility toggle and accessibility.

### Good Example - Password Input with Toggle

```typescript
import {
  unstable_PasswordToggleField as PasswordToggleField,
} from "radix-ui";

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

// Icon components (example)
function EyeIcon() {
  return <span aria-hidden="true">👁</span>;
}

function EyeOffIcon() {
  return <span aria-hidden="true">👁‍🗨</span>;
}

// Usage
function LoginForm() {
  return (
    <form>
      <PasswordInput name="password" label="Password" />
      <PasswordInput
        name="confirmPassword"
        label="Confirm Password"
        error="Passwords do not match"
      />
      <button type="submit">Sign In</button>
    </form>
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

**Why good:** Implicit accessible labeling for toggle button, Icon component switches based on visibility state, focus returns to input after pointer toggle, aria-invalid and aria-describedby for error states, onVisibilityChange for controlled visibility

**Key Features:**

- Focus returns to input after pointer toggle
- Focus maintained with keyboard navigation
- Visibility resets after form submission
- Implicit accessible labeling for icon buttons
- `data-visible` attribute for styling
- Controlled visibility via `visible`/`onVisibilityChange` props
- `Slot` component for alternative rendering with `visible`/`hidden` props or `render` function
- `autoComplete` defaults to `"current-password"` (configurable)

---

## Pattern 3: Form Validation (Preview)

Form provides accessible form validation with constraint API support.

### Good Example - Form with Validation Messages

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
        {/* Custom validation */}
        <Form.Message
          match={(value) => !/[A-Z]/.test(value)}
          className="form-message"
        >
          Password must contain at least one uppercase letter
        </Form.Message>
      </Form.Field>

      {/* Server-side validation */}
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

**Why good:** Built-in constraint validation matching (`valueMissing`, `typeMismatch`, `tooShort`), custom validation via `match` function, server-side validation with `serverInvalid` and `forceMatch`, automatic label association, focus management to first invalid field

**Key Features:**

- Built on native browser constraint validation API
- `match` prop supports built-in validators or custom functions
- Custom validation functions receive `(value, formData)` and support async
- `serverInvalid` prop marks fields with server-side errors
- `forceMatch` displays message regardless of client validation
- `onClearServerErrors` callback for clearing server state
- `ValidityState` component exposes raw validity state via render prop
- Automatic `aria-describedby` connection between controls and messages
- Focus management routes to first invalid field on submission

**Built-in Match Values:**

| Match | Constraint |
|-------|------------|
| `valueMissing` | Required field empty |
| `typeMismatch` | Type doesn't match (email, url, etc.) |
| `tooShort` | Below minLength |
| `tooLong` | Above maxLength |
| `rangeUnderflow` | Below min |
| `rangeOverflow` | Above max |
| `stepMismatch` | Doesn't match step |
| `patternMismatch` | Doesn't match pattern |
| `badInput` | Invalid input |

---

## Important Notes

### Unstable API Warning

Preview components use the `unstable_` prefix because their APIs may change:

```typescript
// Current import pattern (May 2025)
import {
  unstable_OneTimePasswordField as OneTimePasswordField,
  unstable_PasswordToggleField as PasswordToggleField,
  unstable_Form as Form,
} from "radix-ui";
```

### Best Practices

1. **Don't rely on exact APIs** - Test thoroughly with each Radix update
2. **Provide fallbacks** - Consider progressive enhancement
3. **Watch release notes** - API may stabilize or change
4. **TypeScript users** - Types may be incomplete or change

### When to Use Preview Components

- **Use when:** You need the specific functionality and can accept API changes
- **Avoid when:** Building critical production features that can't tolerate breaking changes
