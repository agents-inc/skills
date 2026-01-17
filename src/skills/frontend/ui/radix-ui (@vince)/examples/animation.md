# Radix UI - Animation Examples

> CSS animations using data-state attributes for enter/exit transitions.

---

## Pattern 1: CSS Animations with data-state

Radix components expose `data-state` attributes that enable CSS-driven animations without JavaScript.

### Good Example - CSS Animation with data-state

```typescript
import { Dialog } from "radix-ui";

export function AnimatedDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>Animated Dialog</Dialog.Title>
          <Dialog.Description>This dialog animates in and out.</Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

```css
/* CSS animations - Radix suspends unmount until animation completes */
@keyframes overlayShow {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes overlayHide {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes contentShow {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes contentHide {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
}

.dialog-overlay[data-state="open"] {
  animation: overlayShow 150ms ease-out;
}

.dialog-overlay[data-state="closed"] {
  animation: overlayHide 150ms ease-in;
}

.dialog-content[data-state="open"] {
  animation: contentShow 150ms ease-out;
}

.dialog-content[data-state="closed"] {
  animation: contentHide 150ms ease-in;
}
```

**Why good:** data-state attribute automatically set by Radix, exit animation triggers on close, Radix detects animation end and then unmounts

---

## Pattern 2: Accordion Height Animation

CSS custom properties exposed by Radix enable smooth height animations.

```css
/* Animate accordion content height */
.accordion-content {
  overflow: hidden;
}

.accordion-content[data-state="open"] {
  animation: slideDown 300ms ease-out;
}

.accordion-content[data-state="closed"] {
  animation: slideUp 300ms ease-out;
}

@keyframes slideDown {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes slideUp {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

/* Rotate chevron on open */
.accordion-trigger[data-state="open"] > .accordion-chevron {
  transform: rotate(180deg);
}
```

**Why good:** --radix-accordion-content-height CSS variable provides actual content height for smooth animation, data-state on trigger enables icon rotation
