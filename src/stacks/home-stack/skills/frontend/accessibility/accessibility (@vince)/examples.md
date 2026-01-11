# Accessibility Code Examples

> All code examples for the Accessibility skill. For core patterns and concepts, see [skill.md](skill.md).

---

## Skip Links

### Example: Skip Link Component

```typescript
// components/skip-link.tsx
interface SkipLinkProps {
  className?: string;
}

export function SkipLink({ className }: SkipLinkProps) {
  return (
    <a href="#main-content" className={className}>
      Skip to main content
    </a>
  );
}
```

```css
/* Skip link styling pattern - apply via your styling solution */
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 1rem;
  background: var(--color-primary);
  color: white;
  text-decoration: none;
  z-index: 9999;
}

.skip-link:focus {
  top: 0;
}
```

```typescript
// layout.tsx
import type { ReactNode } from 'react';

function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink className="skip-link" />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
```

**Why good:** Keyboard users can skip navigation. WCAG requirement. Better UX for screen reader users.

**Edge Cases:**
- Add multiple skip links for complex layouts
- Focus main content programmatically
- Ensure visible focus indicator

---

## Modal Dialogs

### Example: Accessible Modal Dialog with Radix UI

```typescript
// components/dialog.tsx
import * as RadixDialog from '@radix-ui/react-dialog';
import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button when dialog opens
  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />

        <RadixDialog.Content className={className}>
          <RadixDialog.Title>
            {title}
          </RadixDialog.Title>

          {description && (
            <RadixDialog.Description>
              {description}
            </RadixDialog.Description>
          )}

          <div>
            {children}
          </div>

          <RadixDialog.Close
            ref={closeButtonRef}
            aria-label="Close dialog"
          >
            {/* Use your icon component here */}
            <span aria-hidden="true">X</span>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
```

**Why good:** Traps focus in dialog. Closes on Escape. Restores focus on close. Screen reader announcements. ARIA attributes automatic.

**Edge Cases:**
- Handle long content with scrolling
- Prevent body scroll when open
- Support initial focus on specific element

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

## Data Tables

### Example: Accessible Sortable Data Table

```typescript
// components/data-table.tsx
import { useState, type ReactNode } from 'react';

interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  caption: string;
  rowKey: keyof T;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  caption,
  rowKey,
  className,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;

    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <table className={className}>
      <caption>{caption}</caption>

      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={String(column.key)}
              scope="col"
            >
              {column.sortable ? (
                <button
                  onClick={() => handleSort(column.key)}
                  aria-sort={
                    sortColumn === column.key
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  {column.header}
                  {sortColumn === column.key && (
                    <span aria-hidden="true">
                      {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </button>
              ) : (
                column.header
              )}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {sortedData.map((row) => (
          <tr key={String(row[rowKey])}>
            {columns.map((column) => (
              <td key={String(column.key)}>
                {column.render
                  ? column.render(row[column.key], row)
                  : String(row[column.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Why good:** Semantic HTML. Proper scope attributes. Sortable columns announced. Screen reader navigation.

**Edge Cases:**
- Add row selection with checkboxes
- Support keyboard navigation between cells
- Provide row/column headers for complex tables

---

## Color Contrast

### Example: Checking Contrast Ratios

```scss
// Sufficient contrast
.button-primary {
  background: #0066cc; // Blue
  color: #ffffff; // White
  // Contrast ratio: 7.37:1 (Passes AAA)
}

.text-body {
  color: #333333; // Dark gray
  background: #ffffff; // White
  // Contrast ratio: 12.6:1 (Passes AAA)
}

// Insufficient contrast
.button-bad {
  background: #ffeb3b; // Yellow
  color: #ffffff; // White
  // Contrast ratio: 1.42:1 (Fails AA - needs 4.5:1)
}

.text-bad {
  color: #999999; // Light gray
  background: #ffffff; // White
  // Contrast ratio: 2.85:1 (Fails AA for normal text)
}
```

**Testing:** Use WebAIM Contrast Checker or axe DevTools to verify ratios.

---

### Example: Color-Independent Status Indicators

```typescript
// GOOD: Color + Icon + Text
interface StatusBadgeProps {
  status: 'success' | 'error' | 'warning';
  className?: string;
}

function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    success: { symbol: '✓', text: 'Success', color: 'var(--color-success)' },
    error: { symbol: '×', text: 'Error', color: 'var(--color-error)' },
    warning: { symbol: '!', text: 'Warning', color: 'var(--color-warning)' },
  };

  const { symbol, text, color } = config[status];

  return (
    <div className={className} style={{ color }}>
      {/* Use your icon component here, or simple symbol */}
      <span aria-hidden="true">{symbol}</span>
      <span>{text}</span>
    </div>
  );
}

// BAD: Color only
function BadStatusBadge({ status }: { status: 'success' | 'error' }) {
  const color = status === 'success' ? 'green' : 'red';

  return (
    <div style={{ backgroundColor: color, width: 20, height: 20 }} />
    // No way for color-blind users to distinguish!
  );
}
```

---

### Example: Accessible Link Styling

```scss
// GOOD: Underlined links in body text
.content {
  a {
    color: var(--color-primary);
    text-decoration: underline; // Color + underline

    &:hover {
      text-decoration-thickness: 2px;
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  }
}

// BAD: Color-only links
.bad-content {
  a {
    color: var(--color-primary);
    text-decoration: none; // Only color distinguishes links
  }
}
```

**Why good:** Underlines ensure links are identifiable regardless of color perception.

---

### Example: Using Design Tokens for Accessible Colors

```scss
// packages/ui/src/styles/variables.scss
:root {
  // Text colors with sufficient contrast
  --color-text-default: var(--gray-12); // #1a1a1a - 16.1:1 on white
  --color-text-muted: var(--gray-10); // #4a4a4a - 9.7:1 on white
  --color-text-subtle: var(--gray-8); // #6b6b6b - 5.7:1 on white

  // Surface colors
  --color-surface-base: var(--gray-0); // #ffffff
  --color-surface-subtle: var(--gray-2); // #f5f5f5

  // Ensure all tokens meet WCAG AA minimum
}
```

---

## Semantic HTML

### Example: Semantic List

```typescript
// components/feature.tsx
// GOOD: Uses <li> for list item

interface FeatureProps {
  id: string;
  title: string;
  description: string;
  status: 'done' | 'pending';
  className?: string;
}

export function Feature({ id, title, description, status, className }: FeatureProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li  // Semantic HTML element
      className={className}
      data-expanded={isExpanded}
    >
      <div>
        {/* Radix UI Switch has built-in role="switch" and ARIA */}
        <Switch
          id={`${id}-switch`}
          checked={status === "done"}
        />
        <h2>{title}</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          {/* Use your icon component here */}
          <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
        </button>
      </div>
      {isExpanded && <p>{description}</p>}
    </li>
  );
}
```

```typescript
// Usage: Wrapped in semantic <ul>
<ul>
  {features.map(feature => (
    <Feature key={feature.id} {...feature} />
  ))}
</ul>
```

**Why good:** Screen readers announce "list, 5 items" and provide list navigation shortcuts.

---

### Example: Button vs Link

```typescript
// GOOD: Button for actions
<button onClick={handleSubmit}>
  Submit Form
</button>

// GOOD: Link for navigation
<a href="/dashboard">
  Go to Dashboard
</a>

// BAD: Div for button
<div onClick={handleSubmit}>  // Missing role, keyboard support, focus
  Submit Form
</div>

// BAD: Button for navigation
<button onClick={() => navigate('/dashboard')}>  // Should be a link!
  Go to Dashboard
</button>
```

**Rule:** Buttons for actions, links for navigation.

---

## Landmarks

### Example: Semantic HTML Landmarks

```html
<header>
  <!-- role="banner" -->
  <nav>
    <!-- role="navigation" -->
    <main>
      <!-- role="main" -->
      <aside>
        <!-- role="complementary" -->
        <footer>
          <!-- role="contentinfo" -->
          <section><!-- role="region" with aria-label --></section>
        </footer>
      </aside>
    </main>
  </nav>
</header>
```

**Multiple landmarks of same type need labels:**

```html
<nav aria-label="Main navigation">
<nav aria-label="Footer navigation"></nav>
</nav>
```

---

## Form Accessibility

### Example: Accessible Form Field with Radix UI

```typescript
// components/custom-select.tsx
import * as Select from "@radix-ui/react-select";

export function CustomSelect() {
  return (
    <Select.Root>
      {/* Radix UI automatically handles:
          - aria-haspopup="listbox"
          - aria-expanded
          - aria-controls
          - Keyboard navigation (arrows, enter, escape)
          - Focus management
      */}
      <Select.Trigger aria-label="Select option">
        <Select.Value placeholder="Choose an option" />
        <Select.Icon>
          {/* Use your icon component here */}
          <span aria-hidden="true">▼</span>
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content>
          <Select.Viewport>
            <Select.Item value="option1">
              <Select.ItemText>Option 1</Select.ItemText>
            </Select.Item>
            <Select.Item value="option2">
              <Select.ItemText>Option 2</Select.ItemText>
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
```

**Why good:** Radix UI components include all required ARIA attributes and keyboard support automatically.

---

### Example: Form with Error Handling

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

### Example: Required Field Indicators

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

---

## Focus Indicators

### Example: Focus Styles

```scss
// GOOD: Clear focus indicator using :focus-visible
.button {
  position: relative;
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color 150ms ease;

  // Only show focus ring for keyboard navigation
  &:focus-visible {
    outline-color: var(--color-primary);
  }

  // Hide focus ring for mouse clicks
  &:focus:not(:focus-visible) {
    outline-color: transparent;
  }
}

// GOOD: High-contrast focus indicator for links
.link {
  &:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }
}

// NEVER do this - removes focus indicator completely
.bad-button {
  outline: none; // Keyboard users can't see focus!

  &:focus {
    outline: none;
  }
}
```

---

## Touch Targets

### Example: Touch Target Sizing

```scss
// GOOD: Meets 44x44px minimum
.button {
  min-width: 44px;
  min-height: 44px;
  padding: var(--space-md) var(--space-lg);
}

.icon-button {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 24px; // Visual size smaller than touch target
    height: 24px;
  }
}

// GOOD: Link with sufficient touch target using negative margins
.inline-link {
  padding: var(--space-sm) var(--space-md);
  margin: calc(var(--space-sm) * -1) calc(var(--space-md) * -1);
  // Negative margin expands clickable area without affecting layout
}

// BAD: Too small for touch
.bad-button {
  width: 24px; // Too small!
  height: 24px;
  padding: 0;
}
```

---

### Example: Spacing Between Touch Targets

```scss
// GOOD: Adequate spacing
.button-group {
  display: flex;
  gap: var(--space-md); // 8px minimum between buttons
}

.mobile-nav {
  display: flex;
  gap: var(--space-lg); // 12px spacing on mobile
}

// BAD: No spacing
.bad-button-group {
  display: flex;
  gap: 0; // Buttons are touching - hard to tap accurately
}
```

---

## Screen Reader Support

### Example: Hidden Content for Screen Readers

```typescript
// Usage: Additional context for screen readers
<button>
  {/* Use your icon component here */}
  <span aria-hidden="true">🗑</span>
  <span className="sr-only">Delete item</span>
</button>

// Screen readers announce: "Delete item, button"
// Sighted users see: Only the trash icon
```

```scss
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

### Example: Hiding Decorative Content

```typescript
// GOOD: Hide decorative icons from screen readers
<div className="banner">
  {/* Use your icon component with aria-hidden */}
  <span aria-hidden="true">✨</span>  {/* Decorative */}
  <h1>Welcome to our site!</h1>
</div>

// GOOD: Empty alt for decorative images
<img src="decorative-pattern.png" alt="" />

// BAD: Redundant alt text
<button>
  <img src="save-icon.png" alt="Save" />  {/* Redundant! */}
  Save
</button>

// GOOD: Icon marked as decorative
<button>
  <img src="save-icon.png" alt="" />  {/* Decorative */}
  Save
</button>
```

---

## Testing Examples

### Example: Role-Based Accessibility Queries

```typescript
// Role-based queries encourage accessible markup
// These examples use Testing Library patterns - adapt to your testing framework

it('should toggle the feature', async () => {
  // Render your component

  // Query by role (encourages accessible markup)
  const feature = await screen.findByTestId('feature');
  const switchElement = within(feature).getByRole('switch');

  expect(switchElement).toBeChecked();

  // Simulate user interaction
  await userEvent.click(switchElement);
  await waitFor(() => expect(switchElement).not.toBeChecked());
});

it('should render button with accessible name', () => {
  // Render your button component

  // Query by role and accessible name
  const button = screen.getByRole('button', { name: 'Click me' });
  expect(button).toBeInTheDocument();
});
```

**Why good:** Role-based queries fail if markup isn't accessible, catching issues early.

**Key accessibility query patterns:**
- `getByRole('button')` - Finds buttons by ARIA role
- `getByRole('link', { name: 'Home' })` - Finds links by accessible name
- `getByRole('textbox')` - Finds inputs by role
- `getByRole('switch')` - Finds toggle controls
- `getByLabelText('Email')` - Finds inputs by label association

---

### Example: jest-axe Integration

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('LoginForm', () => {
  it('should have no accessibility violations', async () => {
    // Render your component and get the container element
    const { container } = render(<LoginForm />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('should have no violations with errors', async () => {
    // Test with error state
    const { container } = render(
      <LoginForm errors={{ email: 'Invalid email' }} />
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
```

**Why good:** Automated testing catches common issues (missing labels, insufficient contrast, etc.).

---

### Example: Lighthouse CI Integration

```json
// .lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }]
      }
    }
  }
}
```

```bash
# Run Lighthouse CI
npm install -g @lhci/cli
lhci autorun
```

**Why good:** Automated accessibility audits in CI prevent regressions.
