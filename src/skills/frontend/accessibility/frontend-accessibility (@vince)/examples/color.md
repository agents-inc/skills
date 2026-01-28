# Color Accessibility Patterns

> Contrast ratios, color-independent indicators, accessible link styling, and design tokens.

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

## Color-Independent Status Indicators

### Example: Using Color + Icon + Text

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

## Accessible Link Styling

### Example: Underlined Links in Body Text

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

## Design Tokens for Accessible Colors

### Example: Token Definitions with Contrast Ratios

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
