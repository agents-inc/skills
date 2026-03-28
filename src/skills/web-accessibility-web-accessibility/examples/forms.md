# Form Accessibility Patterns

> Form validation, error handling, accessible select, and required field patterns.

---

## Form Validation

### Example: Accessible Password Input with Requirements

```typescript
// components/password-input.tsx
import { useState, type ComponentPropsWithoutRef } from 'react';

interface PasswordInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  label: string;
  error?: string;
  showRequirements?: boolean;
  className?: string;
}

export function PasswordInput({
  label,
  error,
  showRequirements = true,
  className,
  ...props
}: PasswordInputProps) {
  const [value, setValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const requirements = [
    { label: 'At least 8 characters', met: value.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(value) },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(value) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(value) },
  ];

  return (
    <div className={className}>
      <label htmlFor={props.id}>
        {label}
      </label>

      <div>
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={
            [
              error && `${props.id}-error`,
              showRequirements && `${props.id}-requirements`
            ].filter(Boolean).join(' ')
          }
          {...props}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {/* Use your icon component here */}
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>

      {showRequirements && (
        <ul
          id={`${props.id}-requirements`}
          aria-label="Password requirements"
        >
          {requirements.map((req, index) => (
            <li
              key={index}
              data-met={req.met}
              aria-live="polite"
            >
              {/* Use your icon component: check or x */}
              <span aria-hidden="true">{req.met ? '✓' : '×'}</span>
              <span>{req.label}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <span
          id={`${props.id}-error`}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
```

**Why good:** Live validation feedback. Screen reader announcements. Keyboard accessible toggle. Clear error messages.

**Edge Cases:**

- Debounce validation to reduce announcements
- Support paste events
- Handle autofill gracefully

---

## Accessible Select Pattern

### Example: Headless Component Library Select

Use your headless component library for select/listbox patterns. They handle all ARIA attributes and keyboard navigation automatically:

- `aria-haspopup="listbox"` on trigger
- `aria-expanded` state management
- `aria-controls` linking trigger to content
- Arrow key navigation, Enter to select, Escape to close
- Focus management between trigger and options

```typescript
// Your component library's Select handles ARIA automatically
// This shows the accessibility contract, not a specific library's API:

// The trigger needs:
<button aria-haspopup="listbox" aria-expanded={open} aria-label="Select option">
  {selectedValue || "Choose an option"}
  <span aria-hidden="true">▼</span>
</button>

// The listbox needs:
<ul role="listbox">
  <li role="option" aria-selected={selected}>Option 1</li>
  <li role="option" aria-selected={selected}>Option 2</li>
</ul>
```

**Why good:** Shows the ARIA contract that headless libraries implement automatically. Never build this manually.

---

## Form with Error Handling

### Example: Login Form with Accessible Errors

```typescript
// components/login-form.tsx
// This example shows pure accessibility patterns - integrate with your form library

import { useState, type FormEvent } from 'react';

interface FormErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};
    if (!email || !email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!password || password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    return newErrors;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      try {
        // Submit form data
      } catch {
        setSubmitError('Login failed. Please try again.');
      }
    }
  };

  const errorCount = Object.keys(errors).length + (submitError ? 1 : 0);

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Error summary for screen readers */}
      {errorCount > 0 && (
        <div role="alert">
          <h2>There are {errorCount} errors in this form</h2>
          <ul>
            {errors.email && <li><a href="#email">{errors.email}</a></li>}
            {errors.password && <li><a href="#password">{errors.password}</a></li>}
            {submitError && <li>{submitError}</li>}
          </ul>
        </div>
      )}

      {/* Email field */}
      <div>
        <label htmlFor="email">
          Email <span aria-label="required">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <span id="email-error" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      {/* Password field */}
      <div>
        <label htmlFor="password">
          Password <span aria-label="required">*</span>
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-required="true"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <span id="password-error" role="alert">
            {errors.password}
          </span>
        )}
      </div>

      <button type="submit">
        Log In
      </button>
    </form>
  );
}
```

**Why good:**

- Error summary helps users understand all errors at once
- `aria-invalid` announces invalid state
- `aria-describedby` links to error message
- `role="alert"` announces errors to screen readers
- `aria-required` indicates required fields

---

## Required Field Indicators

### Example: Multiple Indicators Pattern

```typescript
// GOOD: Multiple indicators
<div className="field">
  <label htmlFor="email">
    Email
    <abbr title="required" aria-label="required">*</abbr>
  </label>
  <input
    id="email"
    type="email"
    required  // Browser validation
    aria-required="true"  // Screen reader announcement
  />
  <p className="helper-text">
    We'll never share your email.
  </p>
</div>

// Add legend explaining asterisks
<form>
  <p className="form-legend">
    <abbr title="required" aria-label="required">*</abbr> indicates required fields
  </p>
  {/* fields */}
</form>
```
