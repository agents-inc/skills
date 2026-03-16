# Focus Management Patterns

> Modal dialogs, focus indicators, and focus trapping patterns.

---

## Modal Dialogs

### Example: Accessible Modal Dialog

Use your headless component library for dialogs - they handle focus trapping, Escape to close, and ARIA attributes automatically.

**Key accessibility requirements for dialogs:**

- Focus trapped inside dialog while open
- Escape key closes dialog
- Focus moves to dialog on open
- Focus returns to trigger element on close
- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` pointing to dialog title

```typescript
// components/dialog.tsx
// Use your headless component library (Radix UI, Headless UI, React Aria, Ariakit)
// This shows the accessibility contract:

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

  // Your headless component library handles:
  // - Focus trapping (Tab cycles within dialog)
  // - Escape to close
  // - Click outside to close (overlay)
  // - aria-modal="true"
  // - Scroll lock on body

  return (
    // Wrap with your component library's Dialog primitive
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-desc" : undefined}
      className={className}
    >
      <h2 id="dialog-title">{title}</h2>

      {description && (
        <p id="dialog-desc">{description}</p>
      )}

      <div>{children}</div>

      <button
        ref={closeButtonRef}
        onClick={() => onOpenChange(false)}
        aria-label="Close dialog"
      >
        <span aria-hidden="true">X</span>
      </button>
    </div>
  );
}
```

**Why good:** Traps focus in dialog. Closes on Escape. Restores focus on close. Screen reader announcements. ARIA attributes handled by library.

**Edge Cases:**

- Handle long content with scrolling
- Prevent body scroll when open
- Support initial focus on specific element

---

## Focus Indicators

### Example: Focus Styles with :focus-visible

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

**Why good:**

- `:focus-visible` shows focus ring only for keyboard navigation
- Mouse users don't see annoying focus ring on click
- Keyboard users always see clear focus state
- 3:1 contrast ratio meets WCAG requirements
