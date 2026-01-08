---
name: Accessibility
description: WCAG, ARIA, keyboard navigation
---

# Accessibility

> **Quick Guide:** All interactive elements keyboard accessible. Use Radix UI for ARIA patterns. WCAG AA minimum (4.5:1 text contrast). Proper form labels and error handling. Test with axe DevTools and screen readers.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST ensure all interactive elements are keyboard accessible with visible focus indicators)**

**(You MUST use Radix UI components for built-in ARIA patterns instead of manual implementation)**

**(You MUST maintain WCAG AA minimum contrast ratios - 4.5:1 for text, 3:1 for UI components)**

**(You MUST never use color alone to convey information - always add icons, text, or patterns)**

</critical_requirements>

---

**Auto-detection:** Accessibility (a11y), WCAG compliance, ARIA patterns, keyboard navigation, screen reader support, Radix UI, focus management

**When to use:**

- Implementing keyboard navigation and focus management
- Using Radix UI for accessible component patterns (built-in a11y)
- Ensuring WCAG AA color contrast (4.5:1 text, 3:1 UI components)
- Testing with axe DevTools and screen readers
- Building interactive components (buttons, forms, modals, tables)
- Adding dynamic content updates (live regions, status messages)

**When NOT to use:**

- Working on backend/API code with no UI
- Writing build scripts or configuration files
- Creating documentation or non-rendered content
- Working with CLI tools (different accessibility considerations)

**Target:** WCAG 2.1 Level AA compliance (minimum), AAA where feasible

**Key patterns covered:**

- Keyboard navigation standards (tab order, focus management, skip links, Escape to close)
- ARIA patterns with Radix UI components (prefer Radix for built-in accessibility)
- WCAG AA compliance minimum (contrast ratios, semantic HTML, touch targets 44×44px)
- Screen reader support (role-based queries, hidden content, live regions)

---

<philosophy>

## Philosophy

Accessibility ensures digital products are usable by everyone, including users with disabilities. This skill applies the principle that **accessibility is a requirement, not a feature** - it should be built in from the start, not retrofitted.

Key philosophy:
- **Semantic HTML first** - Use native elements for built-in accessibility
- **Radix UI for complex patterns** - Leverage tested, accessible component primitives
- **Progressive enhancement** - Start with keyboard, add mouse interactions on top
- **WCAG as baseline** - Meet AA minimum, aim for AAA where feasible

</philosophy>

---

<patterns>

## Keyboard Navigation Standards

**CRITICAL: All interactive elements must be keyboard accessible**

### Tab Order

- **Logical flow** - Tab order must follow visual reading order (left-to-right, top-to-bottom)
- **No keyboard traps** - Users can always tab away from any element
- **Skip repetitive content** - Provide skip links to main content
- **tabindex rules:**
  - `tabindex="0"` - Adds element to natural tab order (use sparingly)
  - `tabindex="-1"` - Programmatic focus only (modal content, headings)
  - Never use `tabindex > 0` (creates unpredictable tab order)

### Focus Management

- **Visible focus indicators** - Always show clear focus state (never `outline: none` without replacement)
- **Focus on open** - When opening modals/dialogs, move focus to first interactive element or close button
- **Focus on close** - Restore focus to trigger element when closing modals/dialogs
- **Focus trapping** - Trap focus inside modals using Radix UI or manual implementation
- **Programmatic focus** - Use `element.focus()` for dynamic content (search results, error messages)

### Keyboard Shortcuts

- **Standard patterns:**
  - `Escape` - Close modals, cancel actions, clear selections
  - `Enter/Space` - Activate buttons and links
  - `Arrow keys` - Navigate lists, tabs, menus, sliders
  - `Home/End` - Jump to first/last item
  - `Tab/Shift+Tab` - Navigate between interactive elements

### Skip Links

**MANDATORY for pages with navigation**

- Place skip link as first focusable element
- Visually hidden until focused
- Allow users to skip navigation and jump to main content
- Multiple skip links for complex layouts (skip to navigation, skip to sidebar, etc.)

#### Example: Skip Links

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

**Why:** Keyboard users can skip navigation. WCAG requirement. Better UX for screen reader users.

**Edge Cases:**

- Add multiple skip links for complex layouts
- Focus main content programmatically
- Ensure visible focus indicator

---

## ARIA Patterns

### Example: Accessible Modal Dialog

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

**Why:** Traps focus in dialog. Closes on Escape. Restores focus on close. Screen reader announcements. ARIA attributes automatic.

**Edge Cases:**

- Handle long content with scrolling
- Prevent body scroll when open
- Support initial focus on specific element

---

### Example: Accessible Form Validation

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

**Why:** Live validation feedback. Screen reader announcements. Keyboard accessible toggle. Clear error messages.

**Edge Cases:**

- Debounce validation to reduce announcements
- Support paste events
- Handle autofill gracefully

---

### Example: Accessible Data Table

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

**Why:** Semantic HTML. Proper scope attributes. Sortable columns announced. Screen reader navigation.

**Edge Cases:**

- Add row selection with checkboxes
- Support keyboard navigation between cells
- Provide row/column headers for complex tables

### Component-Specific ARIA

**Buttons:**

- `aria-label` - For icon-only buttons
- `aria-pressed` - For toggle buttons
- `aria-expanded` - For expandable sections
- `aria-disabled` - Use with `disabled` attribute

**Forms:**

- `aria-required` - Required fields (use with `required`)
- `aria-invalid` - Invalid fields
- `aria-describedby` - Link to error messages, helper text
- `aria-errormessage` - Explicit error message reference

**Navigation:**

- `aria-current="page"` - Current page in navigation
- `aria-label` - Describe navigation purpose ("Main navigation", "Footer navigation")

**Modals/Dialogs:**

- `role="dialog"` or `role="alertdialog"`
- `aria-modal="true"`
- `aria-labelledby` - Points to dialog title
- `aria-describedby` - Points to dialog description

**Tables:**

- `scope="col"` and `scope="row"` for headers
- `<caption>` for table description
- `aria-sort` for sortable columns

### Live Regions

**Use for dynamic content updates:**

- `aria-live="polite"` - Announce when user is idle (status messages, non-critical updates)
- `aria-live="assertive"` - Announce immediately (errors, critical alerts)
- `aria-atomic="true"` - Announce entire region content
- `role="status"` - For status messages (implies `aria-live="polite"`)
- `role="alert"` - For error messages (implies `aria-live="assertive"`)

**Best practices:**

- Keep messages concise and meaningful
- Clear old messages before new ones
- Don't spam with rapid updates (debounce)

### Landmarks

**Use semantic HTML5 elements (implicit ARIA roles):**

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

### Accessible Names

**Priority order (first found wins):**

1. `aria-labelledby` - Reference to another element
2. `aria-label` - Direct string label
3. Element content (button text, link text)
4. `title` attribute (last resort, not well supported)

**Rules:**

- Icon-only buttons MUST have `aria-label`
- Form inputs MUST have associated `<label>` or `aria-label`
- Images MUST have descriptive `alt` text (empty `alt=""` for decorative images)

---

## Color Contrast Requirements

### Example: Checking Contrast Ratios

```scss
// ✅ GOOD: Sufficient contrast
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

// ❌ BAD: Insufficient contrast
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
// ✅ GOOD: Color + Icon + Text
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

// ❌ BAD: Color only
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
// ✅ GOOD: Underlined links in body text
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

// ❌ BAD: Color-only links
.bad-content {
  a {
    color: var(--color-primary);
    text-decoration: none; // Only color distinguishes links
  }
}
```

**Why:** Underlines ensure links are identifiable regardless of color perception.

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

### Contrast Ratios

**Text contrast (AA):**

- Normal text (< 18px): 4.5:1 minimum
- Large text (≥ 18px or ≥ 14px bold): 3:1 minimum
- AAA (recommended): 7:1 for normal, 4.5:1 for large

**Non-text contrast:**

- UI components (buttons, form inputs): 3:1 minimum
- Focus indicators: 3:1 against background
- Icons (functional): 3:1 minimum

### Color Independence

**CRITICAL: Never use color alone to convey information**

- Add icons to color-coded states (✓ success, ✕ error)
- Use text labels with status colors
- Provide patterns/textures in charts
- Underline links in body text

---

## Semantic HTML

**ACTUAL IMPLEMENTATION: Semantic elements used consistently**

**Always use semantic HTML:**

- `<button>` for actions (not `<div onclick>`)
- `<a>` for navigation (not `<div onclick>`)
- `<nav>` for navigation sections
- `<main>` for primary content (one per page)
- `<header>` and `<footer>` for page sections
- `<ul>/<ol>` for lists
- `<table>` for tabular data (not divs with grid CSS)
- `<form>` with proper `<label>` associations

**Never:**

- ❌ Use `<div>` or `<span>` for interactive elements
- ❌ Use click handlers on non-interactive elements without proper role
- ❌ Use tables for layout
- ❌ Use placeholder as label replacement

---

### Example: Semantic List

```typescript
// packages/ui/src/patterns/feature/feature.tsx
// ✅ GOOD: Uses <li> for list item
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

**Why:** Screen readers announce "list, 5 items" and provide list navigation shortcuts.

---

### Example: Button vs Link

```typescript
// ✅ GOOD: Button for actions
<button onClick={handleSubmit}>
  Submit Form
</button>

// ✅ GOOD: Link for navigation
<a href="/dashboard">
  Go to Dashboard
</a>

// ❌ BAD: Div for button
<div onClick={handleSubmit}>  // Missing role, keyboard support, focus
  Submit Form
</div>

// ❌ BAD: Button for navigation
<button onClick={() => navigate('/dashboard')}>  // Should be a link!
  Go to Dashboard
</button>
```

**Rule:** Buttons for actions, links for navigation.

---

## Form Accessibility

### Example: Accessible Form Field

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

**Why:** Radix UI components include all required ARIA attributes and keyboard support automatically.

### Label Associations

**Always use proper label associations:**

```html
<!-- ✅ Explicit association (recommended) -->
<label for="email">Email</label>
<input id="email" type="email" />

<!-- ✅ Implicit association -->
<label>
  Email
  <input type="email" />
</label>
```

### Error Handling

**Required patterns:**

- `aria-invalid="true"` on invalid fields
- `aria-describedby` linking to error message
- `role="alert"` on error messages for screen reader announcement
- Visual error indicators (icons, border color)
- Error summary at top of form for multiple errors

#### Example: Form with Error Handling

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

**Why:**

- Error summary helps users understand all errors at once
- `aria-invalid` announces invalid state
- `aria-describedby` links to error message
- `role="alert"` announces errors to screen readers
- `aria-required` indicates required fields

### Required Fields

**Multiple indicators:**

- `required` attribute for browser validation
- `aria-required="true"` for screen readers
- Visual indicator (asterisk, "required" text)
- Legend/description explaining required fields

#### Example: Required Field Indicators

```typescript
// ✅ GOOD: Multiple indicators
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

### Input Types

**Use correct input types for better mobile keyboards:**

- `type="email"` - Email keyboard
- `type="tel"` - Phone keyboard
- `type="number"` - Number keyboard
- `type="date"` - Date picker
- `type="search"` - Search keyboard

---

## Focus Indicators

**MANDATORY: Visible focus states for all interactive elements**

### Focus Styles

**Minimum requirements:**

- 3:1 contrast ratio against background
- 2px minimum thickness
- Clear visual difference from unfocused state
- Consistent across all interactive elements

#### Example: Focus Styles

```scss
// ✅ GOOD: Clear focus indicator using :focus-visible
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

// ✅ GOOD: High-contrast focus indicator for links
.link {
  &:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }
}

// ❌ NEVER do this - removes focus indicator completely
.bad-button {
  outline: none; // Keyboard users can't see focus!

  &:focus {
    outline: none;
  }
}
```

### :focus vs :focus-visible

**Use `:focus-visible` for better UX:**

- `:focus` - Shows on mouse click (annoying)
- `:focus-visible` - Shows only for keyboard navigation (better)

---

## Touch Target Sizes

**TARGET: 44×44px minimum (WCAG 2.1 Level AAA)**

### Minimum Sizes

**Interactive elements:**

- Buttons: 44×44px minimum
- Links in text: Increase padding to meet 44×44px
- Form inputs: 44px height minimum
- Icons: 24×24px minimum, 44×44px touch target

#### Example: Touch Target Sizing

```scss
// ✅ GOOD: Meets 44×44px minimum
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

// ✅ GOOD: Link with sufficient touch target using negative margins
.inline-link {
  padding: var(--space-sm) var(--space-md);
  margin: calc(var(--space-sm) * -1) calc(var(--space-md) * -1);
  // Negative margin expands clickable area without affecting layout
}

// ❌ BAD: Too small for touch
.bad-button {
  width: 24px; // Too small!
  height: 24px;
  padding: 0;
}
```

### Spacing

**Minimum spacing between targets:**

- 8px minimum between adjacent touch targets
- More spacing on mobile (12-16px recommended)

#### Example: Spacing Between Touch Targets

```scss
// ✅ GOOD: Adequate spacing
.button-group {
  display: flex;
  gap: var(--space-md); // 8px minimum between buttons
}

.mobile-nav {
  display: flex;
  gap: var(--space-lg); // 12px spacing on mobile
}

// ❌ BAD: No spacing
.bad-button-group {
  display: flex;
  gap: 0; // Buttons are touching - hard to tap accurately
}
```

---

## Screen Reader Support

**ACTUAL IMPLEMENTATION: Radix UI provides built-in screen reader support**

### Hidden Content

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

### Hidden from Screen Readers

**Decorative content:**

```html
<img src="decorative.png" alt="" />
<!-- Empty alt for decorative images -->
<Icon aria-hidden="true" />
<!-- Hide decorative icons -->
```

### Example: Hiding Decorative Content

```typescript
// ✅ GOOD: Hide decorative icons from screen readers
<div className={styles.banner}>
  <Icon name="sparkles" aria-hidden="true" />  {/* Decorative */}
  <h1>Welcome to our site!</h1>
</div>

// ✅ GOOD: Empty alt for decorative images
<img src="decorative-pattern.png" alt="" />

// ❌ BAD: Redundant alt text
<button>
  <img src="save-icon.png" alt="Save" />  {/* Redundant! */}
  Save
</button>

// ✅ GOOD: Icon marked as decorative
<button>
  <img src="save-icon.png" alt="" />  {/* Decorative */}
  Save
</button>
```

---

</patterns>

---

<decision_framework>

## Decision Framework

```
Need to make content accessible?
├─ Is it interactive (button, input, link)?
│   ├─ YES → Use semantic HTML (<button>, <a>, <input>)
│   │        Add keyboard support (Enter/Space activation)
│   │        Ensure visible focus indicator (:focus-visible)
│   │        Add ARIA if needed (aria-label for icon-only)
│   └─ NO → Is it complex (modal, dropdown, table)?
│       ├─ YES → Use Radix UI component (built-in a11y)
│       └─ NO → Is it informational (status, error)?
│           ├─ YES → Add role="alert" or role="status"
│           │        Use aria-live for dynamic updates
│           │        Never use color alone (add icon/text)
│           └─ NO → Use semantic HTML (<nav>, <main>, <header>)
│                    Add landmarks for navigation
│                    Provide skip links for complex layouts
├─ Does it use color to convey information?
│   └─ YES → Add icon, text label, or pattern (never color alone)
└─ Is contrast ratio sufficient?
    ├─ Text → 4.5:1 minimum (AA), 7:1 ideal (AAA)
    ├─ UI components → 3:1 minimum
    └─ Focus indicators → 3:1 minimum, 2px thickness
```

</decision_framework>

---

<testing>

## Testing Approach

**RECOMMENDED: Multi-layered testing strategy**

### Automated Testing

**ACTUAL IMPLEMENTATION: Use Testing Library's role-based queries**

```typescript
// ✅ Encourages accessible markup
const button = screen.getByRole('button', { name: 'Submit' });
const switch = within(feature).getByRole('switch');
```

**Additional tools:**

- **jest-axe** - Automated accessibility testing in unit tests
- **axe-core** - Runtime accessibility testing
- **eslint-plugin-jsx-a11y** - Lint-time accessibility checks

### Example: Testing Library Accessibility Queries

```typescript
// apps/client-react/src/home/__tests__/features.test.tsx

// ✅Role-based queries
import { screen, within } from '@testing-library/react';

it('should toggle the feature', async () => {
  renderApp();

  // ✅ Query by role (encourages accessible markup)
  const feature = await screen.findByTestId('feature');
  const switchElement = within(feature).getByRole('switch');

  expect(switchElement).toBeChecked();

  userEvent.click(switchElement);
  await waitFor(() => expect(switchElement).not.toBeChecked());
});

it('should render button with accessible name', () => {
  render(<Button>Click me</Button>);

  // ✅ Query by role and accessible name
  const button = screen.getByRole('button', { name: 'Click me' });
  expect(button).toBeInTheDocument();
});
```

**Why:** Role-based queries fail if markup isn't accessible, catching issues early.

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

**Why:** Automated testing catches common issues (missing labels, insufficient contrast, etc.).

### Manual Testing Checklist

**Keyboard navigation:**

- [ ] Tab through all interactive elements in logical order
- [ ] Activate buttons with Enter/Space
- [ ] Close modals with Escape
- [ ] Navigate dropdowns with arrows
- [ ] No keyboard traps
- [ ] Focus indicators visible on all elements

**Screen reader:**

- [ ] All images have alt text (or alt="" if decorative)
- [ ] Form inputs have labels
- [ ] Error messages are announced
- [ ] Button purposes are clear
- [ ] Headings create logical outline
- [ ] Landmarks are labeled
- [ ] Live regions announce updates
- [ ] Tables have proper headers

**Visual:**

- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Information not conveyed by color alone
- [ ] Text resizable to 200% without horizontal scroll
- [ ] Touch targets meet 44×44px minimum
- [ ] Focus indicators have 3:1 contrast

### Screen Reader Testing

**Test with multiple screen readers:**

- **NVDA** (Windows) - Free, most popular
- **JAWS** (Windows) - Industry standard
- **VoiceOver** (macOS/iOS) - Built-in
- **TalkBack** (Android) - Built-in

### Browser Testing

**Test in multiple browsers:**

- Chrome (most users)
- Safari (macOS/iOS accessibility)
- Firefox (strong accessibility support)
- Edge (enterprise users)

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

**Why:** Automated accessibility audits in CI prevent regressions.

</testing>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **Removing focus outlines without replacement** - Keyboard users can't navigate, violates WCAG 2.4.7
- ❌ **Using `div` or `span` for buttons/links** - No semantic meaning, no keyboard support, screen readers can't identify
- ❌ **Click handlers on non-interactive elements without role/keyboard support** - Keyboard inaccessible, violates WCAG 2.1.1
- ❌ **Form inputs without labels** - Screen readers can't announce purpose, violates WCAG 1.3.1

**Medium Priority Issues:**

- ⚠️ **Color-only error indicators** - Color-blind users can't distinguish, needs icon or text
- ⚠️ **Placeholder text as label replacement** - Disappears on input, not read by all screen readers
- ⚠️ **Disabled form submit buttons** - Show validation errors instead, don't hide submit button
- ⚠️ **Auto-playing audio/video without controls** - Violates WCAG 1.4.2, disrupts screen readers

**Common Mistakes:**

- Not using `aria-label` on icon-only buttons
- Missing `alt` text on images (or using redundant alt text)
- Not trapping focus in modals
- Forgetting to restore focus when closing modals
- Using `tabindex > 0` (creates unpredictable tab order)
- Not providing skip links on pages with navigation
- Missing `aria-invalid` and `aria-describedby` on form errors

**Gotchas & Edge Cases:**

- **`:focus` vs `:focus-visible`** - Use `:focus-visible` to avoid showing focus rings on mouse clicks
- **Empty `alt=""` is correct for decorative images** - Don't skip the alt attribute entirely
- **`aria-hidden="true"` also hides from keyboard** - Don't use on focusable elements
- **Radix UI handles most ARIA automatically** - Don't add redundant ARIA attributes
- **Live regions announce ALL content** - Keep messages concise to avoid spam
- **`role="button"` on `<div>` doesn't add keyboard support** - Still need to handle Enter/Space keys manually

</red_flags>

---

<anti_patterns>

## Anti-Patterns

### ❌ Removing Focus Outlines

Never remove focus outlines (`outline: none`) without providing a visible replacement. This makes the site unusable for keyboard users and violates WCAG 2.4.7.

```css
/* ❌ WRONG - Removes focus visibility */
button:focus {
  outline: none;
}

/* ✅ CORRECT - Custom focus indicator */
button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

### ❌ Using Divs for Buttons

Using `<div onclick>` instead of `<button>` removes semantic meaning, keyboard support, and screen reader identification.

```tsx
// ❌ WRONG - No keyboard support, no semantics
<div onClick={handleClick}>Click me</div>

// ✅ CORRECT - Native button with all a11y built-in
<button onClick={handleClick}>Click me</button>
```

### ❌ Color-Only Information

Never convey information using color alone. Color-blind users cannot distinguish between success/error states.

```tsx
// ❌ WRONG - Color only
<span className={isError ? "text-red" : "text-green"}>Status</span>

// ✅ CORRECT - Color + icon
<span className={isError ? "text-red" : "text-green"}>
  {isError ? <XIcon /> : <CheckIcon />} Status
</span>
```

### ❌ Placeholder as Label

Placeholders disappear on input and are not reliably announced by screen readers.

```tsx
// ❌ WRONG - No visible label
<input placeholder="Email" />

// ✅ CORRECT - Visible label
<label htmlFor="email">Email</label>
<input id="email" placeholder="user@example.com" />
```

### ❌ Manual ARIA Instead of Radix UI

Don't manually implement complex ARIA patterns when Radix UI provides tested, accessible alternatives.

```tsx
// ❌ WRONG - Manual ARIA implementation
<div role="dialog" aria-modal="true" aria-labelledby="title">...</div>

// ✅ CORRECT - Radix handles ARIA automatically
<Dialog.Root>
  <Dialog.Content>...</Dialog.Content>
</Dialog.Root>
```

</anti_patterns>

---

## Resources

**Official guidelines:**

- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

**Tools:**

- axe DevTools: https://www.deque.com/axe/devtools/
- WAVE: https://wave.webaim.org/
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

**Testing:**

- NVDA Screen Reader: https://www.nvaccess.org/
- Keyboard Navigation Guide: https://webaim.org/articles/keyboard/

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST ensure all interactive elements are keyboard accessible with visible focus indicators)**

**(You MUST use Radix UI components for built-in ARIA patterns instead of manual implementation)**

**(You MUST maintain WCAG AA minimum contrast ratios - 4.5:1 for text, 3:1 for UI components)**

**(You MUST never use color alone to convey information - always add icons, text, or patterns)**

**Failure to follow these rules will make the site unusable for keyboard users, screen reader users, and color-blind users - violating WCAG 2.1 Level AA compliance.**

</critical_reminders>
