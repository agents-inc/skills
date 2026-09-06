# Radix UI - Animation Examples

> Enter and exit animation driven by `data-state`. See [navigation.md](navigation.md) for the
> accordion height animation this file's Pattern 2 points at.

---

## Pattern 1: CSS Animations with data-state

Radix sets `data-state="open"` and `"closed"` on the animatable parts and holds the unmount until
`animationend` fires. The markup needs nothing beyond a class to hang the animation on.

```typescript
import { Dialog } from "radix-ui";

<Dialog.Portal>
  <Dialog.Overlay className="dialog-overlay" />
  <Dialog.Content className="dialog-content">
    <Dialog.Title>Animated Dialog</Dialog.Title>
    <Dialog.Description>This dialog animates in and out.</Dialog.Description>
  </Dialog.Content>
</Dialog.Portal>;
```

```css
@keyframes overlayShow {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes overlayHide {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
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

**Why good:** the exit keyframes are what keep the element alive long enough to be seen — declaring
only the `open` pair gives a dialog that fades in and vanishes. Overlay and Content animate
separately so the backdrop can outlast the panel. The `-48%` start on the Y translate makes the
panel rise into place rather than scaling from dead centre.

---

## Pattern 2: Accordion Height Animation

Height cannot be animated from `auto`, so Radix measures the content and publishes the result as
`--radix-accordion-content-height` for the duration of the animation. The full keyframes are in
[navigation.md](navigation.md).
