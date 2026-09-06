# Accessibility — Focus Management

> Dialogs, focus trapping and restoration, and focus indicators. See [SKILL.md](../SKILL.md) for the decisions.

---

## Pattern 7: The dialog contract

A modal owes six things. A tested primitive gives you all of them; this is what to check it against,
and what to implement if you are not using one.

1. Focus moves into the dialog when it opens — the first control, or the dialog itself
2. Tab and Shift+Tab cycle within it and never reach the page behind
3. Escape closes it
4. Focus returns to the element that opened it
5. `role="dialog"` with `aria-modal="true"`, and a name from `aria-labelledby`
6. Content behind it is inert — not merely covered

```typescript
import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Dialog({ isOpen, onClose, title, description, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember what to give focus back to
    triggerRef.current = document.activeElement;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      (triggerRef.current as HTMLElement | null)?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
      tabIndex={-1}
    >
      <h2 id="dialog-title">{title}</h2>
      {description && <p id="dialog-description">{description}</p>}
      <div>{children}</div>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

**Why good:** the trigger is captured from `document.activeElement` before focus moves, which is the
only moment it is still available; restoring it in the effect's cleanup means the restore happens
however the dialog closed — Escape, the button, or the parent unmounting it. `tabIndex={-1}` on the
container makes it focusable programmatically without adding it to the tab order.

**What this does not do:** trap focus. That needs the tab cycle handled explicitly, or the `<dialog>`
element's own `showModal()`, which supplies trapping and inertness from the platform. Everything
outside also needs `inert` or `aria-hidden`, or a screen reader will happily read the page behind the
modal.

**Also owed:** the body must not scroll behind the dialog, and a dialog taller than the viewport must
scroll internally with its own controls reachable.

---

## Pattern 6: Focus indicators

```css
.button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.link:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
```

**Why good:** `:focus-visible` shows the ring when the browser judges it useful — keyboard and
assistive input — and withholds it after a mouse click, which is the complaint that leads people to
remove focus styles altogether. `outline-offset` separates the ring from the element's own border so
it stays visible against a busy background, and `outline` rather than `box-shadow` means it survives
forced-colors mode.

```css
/* Bad */
.button:focus {
  outline: none;
}
```

**Why bad:** a keyboard user now has no way to tell where they are. If the default ring is wrong for
the design, replace it; removing it is not a design decision but a functional one.

**The requirements:** at least 2px thick, at least 3:1 against the adjacent background, and
consistent across every interactive element so its meaning is learnable. WCAG 2.2 adds that the
focused element must not be entirely hidden behind sticky headers and footers — worth a scroll test
on any page that has one.
