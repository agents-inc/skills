# Focus Management Patterns

> Modal dialogs, focus indicators, and focus trapping patterns.

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
