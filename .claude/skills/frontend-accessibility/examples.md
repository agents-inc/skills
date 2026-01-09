# Accessibility Code Examples

> All code examples for the Accessibility skill. For core patterns and concepts, see [skill.md](skill.md).

---

## Skip Links

### Example: Skip Link Component

```typescript
// components/SkipLink/SkipLink.tsx
import styles from './SkipLink.module.css';

export function SkipLink() {
  return (
    <a href="#main-content" className={styles.skipLink}>
      Skip to main content
    </a>
  );
}
```

```css
/* SkipLink.module.css */
.skipLink {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 1rem;
  background: var(--color-primary);
  color: white;
  text-decoration: none;
  z-index: 9999;
}

.skipLink:focus {
  top: 0;
}
```

```typescript
// Layout.tsx
function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
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
// components/Dialog/Dialog.tsx
import * as RadixDialog from '@radix-ui/react-dialog';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
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
        <RadixDialog.Overlay className={styles.overlay} />

        <RadixDialog.Content className={styles.content}>
          <RadixDialog.Title className={styles.title}>
            {title}
          </RadixDialog.Title>

          {description && (
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
          )}

          <div className={styles.body}>
            {children}
          </div>

          <RadixDialog.Close
            ref={closeButtonRef}
            className={styles.close}
            aria-label="Close dialog"
          >
            <Icon name="x" />
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
// components/PasswordInput/PasswordInput.tsx
import { useState, type ComponentPropsWithoutRef } from 'react';
import styles from './PasswordInput.module.css';

interface PasswordInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  label: string;
  error?: string;
  showRequirements?: boolean;
}

export function PasswordInput({
  label,
  error,
  showRequirements = true,
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

  const allRequirementsMet = requirements.every(r => r.met);

  return (
    <div className={styles.wrapper}>
      <label htmlFor={props.id} className={styles.label}>
        {label}
      </label>

      <div className={styles.inputWrapper}>
        <input
          type={showPassword ? 'text' : 'password'}
          className={`${styles.input} ${error ? styles.error : ''}`}
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
          className={styles.toggleButton}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          <Icon name={showPassword ? 'eye-off' : 'eye'} />
        </button>
      </div>

      {showRequirements && (
        <ul
          id={`${props.id}-requirements`}
          className={styles.requirements}
          aria-label="Password requirements"
        >
          {requirements.map((req, index) => (
            <li
              key={index}
              className={req.met ? styles.met : styles.unmet}
              aria-live="polite"
            >
              <Icon name={req.met ? 'check' : 'x'} size={16} />
              <span>{req.label}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <span
          id={`${props.id}-error`}
          className={styles.errorMessage}
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
// components/DataTable/DataTable.tsx
import { useState } from 'react';
import styles from './DataTable.module.css';

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
}

export function DataTable<T>({
  data,
  columns,
  caption,
  rowKey,
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
    <table className={styles.table}>
      <caption className={styles.caption}>{caption}</caption>

      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={String(column.key)}
              scope="col"
              className={styles.th}
            >
              {column.sortable ? (
                <button
                  onClick={() => handleSort(column.key)}
                  className={styles.sortButton}
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
                    <Icon
                      name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={16}
                      aria-hidden="true"
                    />
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
              <td key={String(column.key)} className={styles.td}>
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
function StatusBadge({ status }: { status: 'success' | 'error' | 'warning' }) {
  const config = {
    success: { icon: Check, text: 'Success', color: 'var(--color-success)' },
    error: { icon: X, text: 'Error', color: 'var(--color-error)' },
    warning: { icon: AlertTriangle, text: 'Warning', color: 'var(--color-warning)' },
  };

  const { icon: Icon, text, color } = config[status];

  return (
    <div className={styles.badge} style={{ color }}>
      <Icon size={16} aria-hidden="true" />
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
// packages/ui/src/patterns/feature/feature.tsx
// GOOD: Uses <li> for list item
export const Feature = ({ id, title, description, status }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li  // Semantic HTML element
      className={styles.feature}
      onClick={() => setIsExpanded(!isExpanded)}
      data-expanded={isExpanded}
      data-testid="feature"
    >
      <div className={styles.header}>
        <Switch
          id={`${id}-switch`}
          checked={status === "done"}
          // Radix UI Switch has built-in role="switch" and ARIA
        />
        <h2 className={styles.title}>{title}</h2>
        <Button variant="ghost" size="icon">
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>
      {isExpanded && <p>{description}</p>}
    </li>
  );
};
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
// Simplified from packages/ui/src/components/select/select.tsx
import * as Select from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";

export const CustomSelect = () => {
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
          <ChevronDown />
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
};
```

**Why good:** Radix UI components include all required ARIA attributes and keyboard support automatically.

---

### Example: Form with Error Handling

```typescript
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data);
    } catch (error) {
      setSubmitError('Login failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Error summary for screen readers */}
      {(Object.keys(errors).length > 0 || submitError) && (
        <div role="alert" className={styles.errorSummary}>
          <h2>There are {Object.keys(errors).length} errors in this form</h2>
          <ul>
            {errors.email && <li><a href="#email">{errors.email.message}</a></li>}
            {errors.password && <li><a href="#password">{errors.password.message}</a></li>}
            {submitError && <li>{submitError}</li>}
          </ul>
        </div>
      )}

      {/* Email field */}
      <div className={styles.field}>
        <label htmlFor="email">
          Email <span aria-label="required">*</span>
        </label>
        <input
          id="email"
          type="email"
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        {errors.email && (
          <span id="email-error" role="alert" className={styles.error}>
            {errors.email.message}
          </span>
        )}
      </div>

      {/* Password field */}
      <div className={styles.field}>
        <label htmlFor="password">
          Password <span aria-label="required">*</span>
        </label>
        <input
          id="password"
          type="password"
          aria-required="true"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <span id="password-error" role="alert" className={styles.error}>
            {errors.password.message}
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
<div className={styles.field}>
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
  <p className={styles.helperText}>
    We'll never share your email.
  </p>
</div>

// Add legend explaining asterisks
<form>
  <p className={styles.formLegend}>
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
  <Icon name="trash" />
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
<div className={styles.banner}>
  <Icon name="sparkles" aria-hidden="true" />  {/* Decorative */}
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

### Example: Testing Library Accessibility Queries

```typescript
// apps/client-react/src/home/__tests__/features.test.tsx

// Role-based queries
import { screen, within } from '@testing-library/react';

it('should toggle the feature', async () => {
  renderApp();

  // Query by role (encourages accessible markup)
  const feature = await screen.findByTestId('feature');
  const switchElement = within(feature).getByRole('switch');

  expect(switchElement).toBeChecked();

  userEvent.click(switchElement);
  await waitFor(() => expect(switchElement).not.toBeChecked());
});

it('should render button with accessible name', () => {
  render(<Button>Click me</Button>);

  // Query by role and accessible name
  const button = screen.getByRole('button', { name: 'Click me' });
  expect(button).toBeInTheDocument();
});
```

**Why good:** Role-based queries fail if markup isn't accessible, catching issues early.

---

### Example: jest-axe Integration

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('LoginForm', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('should have no violations with errors', async () => {
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
