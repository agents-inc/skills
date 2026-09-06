# CSS Animations - Core Examples

> Full code for the core patterns. See [SKILL.md](../SKILL.md) for the decisions and
> [reference.md](../reference.md) for lookup tables.

**Related examples:**

- [transitions.md](transitions.md) — state-triggered transitions (Patterns 11–20)
- [keyframes.md](keyframes.md) — multi-step, looping and scroll-driven animations (Patterns 21–30)

---

## Pattern 1: Animation Token System

### Good Example - Full Token Set

```css
:root {
  /* Duration */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 600ms;

  /* Easing */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1); /* enter: fast start, slow settle */
  --ease-in: cubic-bezier(0.4, 0, 1, 1); /* exit: slow start, fast departure */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* overshoot */

  /* Travel distance */
  --distance-xs: 4px;
  --distance-sm: 8px;
  --distance-md: 16px;
  --distance-lg: 24px;
  --distance-xl: 48px;

  /* Lift (negative = upward) */
  --lift-sm: -2px;
  --lift-md: -4px;
  --lift-lg: -8px;

  /* Composite: duration and easing together, for the common cases */
  --transition-fast: var(--duration-fast) var(--ease-out);
  --transition-normal: var(--duration-normal) var(--ease-default);
  --transition-slow: var(--duration-slow) var(--ease-in-out);
}
```

**Why good:** Composite tokens keep a duration and its matching curve paired at every call site, so
retuning one component's feel does not drift the two apart.

---

## Pattern 2: Interactive Button States

### Good Example - Every State Covered

```css
.button {
  position: relative;
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);

  /* Shadow lives on a pseudo-element so only its opacity animates */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transition: opacity var(--transition-fast);
    pointer-events: none;
  }
}

.button:hover {
  transform: translateY(var(--lift-sm));

  &::after {
    opacity: 1;
  }
}

.button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.button:active {
  transform: translateY(0) scale(0.98);

  &::after {
    opacity: 0;
  }
}

.button:disabled {
  opacity: 0.5;
  pointer-events: none;
}
```

**Why good:** `:focus-visible` rather than `:focus` keeps the ring off mouse users; the pressed state
cancels the lift and the shadow together, so the button reads as going down rather than flickering.

### Bad Example - Layout and Repaint Per Frame

```css
.button {
  transition: all 300ms linear;
}

.button:hover {
  margin-top: -4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

**Why bad:** `margin-top` re-runs layout each frame, the shadow repaints each frame, `all` will pick
up whatever property is added next, and `linear` reads mechanically.

---

## Pattern 3: Card Hover Effect

### Good Example - Lift with Touch Opt-Out

```css
.card {
  --card-lift: var(--lift-md);
  --card-scale: 1.02;

  position: relative;
  transition: transform var(--transition-fast);

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow:
      0 4px 8px rgba(0, 0, 0, 0.1),
      0 16px 32px rgba(0, 0, 0, 0.1);
    opacity: 0;
    transition: opacity var(--transition-fast);
    pointer-events: none;
    z-index: -1;
  }
}

.card:hover {
  transform: translateY(var(--card-lift)) scale(var(--card-scale));

  &::after {
    opacity: 1;
  }
}

@media (hover: none) {
  .card:hover {
    transform: none;

    &::after {
      opacity: 0;
    }
  }
}
```

**Why good:** The `(hover: none)` block matters because touch browsers latch `:hover` after a tap and
leave the card stuck in its raised state.

---

## Pattern 4: Fade In on Mount

### Good Example - Entrance Without JavaScript

```css
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(var(--distance-md));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fade-in var(--duration-normal) var(--ease-out);
}

.fade-slide-in {
  animation: fade-slide-in var(--duration-normal) var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .fade-in,
  .fade-slide-in {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

**Why good:** The reduced-motion block restates the end state as well as cancelling the animation —
without it the element keeps the keyframe's starting opacity and never appears.

---

## Pattern 5: Loading Spinner

### Good Example - Sized by Custom Property

```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  --spinner-size: 24px;
  --spinner-border: 3px;
  --spinner-duration: 0.8s;

  width: var(--spinner-size);
  height: var(--spinner-size);
  border: var(--spinner-border) solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin var(--spinner-duration) linear infinite;
}

.spinner--sm {
  --spinner-size: 16px;
  --spinner-border: 2px;
}

.spinner--lg {
  --spinner-size: 48px;
  --spinner-border: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 1.5s;
  }
}
```

**Why good:** Variants override two custom properties rather than restating the rule, and reduced
motion slows the spinner instead of stopping it — a still spinner reads as a hung page.

---

## Pattern 6: Notification Toast

### Good Example - Distinct Enter and Exit

```css
@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toast-exit {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

.toast {
  --toast-duration: 300ms;
}

.toast[data-state="entering"] {
  animation: toast-enter var(--toast-duration) var(--ease-out) forwards;
}

.toast[data-state="exiting"] {
  animation: toast-exit var(--toast-duration) var(--ease-in) forwards;
}

@media (prefers-reduced-motion: reduce) {
  @keyframes toast-enter-reduced {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes toast-exit-reduced {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  .toast[data-state="entering"] {
    animation: toast-enter-reduced calc(var(--toast-duration) / 2)
      var(--ease-out) forwards;
  }

  .toast[data-state="exiting"] {
    animation: toast-exit-reduced calc(var(--toast-duration) / 2) var(--ease-in)
      forwards;
  }
}
```

**Why good:** A data attribute drives both directions, so the same element animates in and out
without being remounted; the reduced-motion pair drops the travel and keeps the fade.

---

## Pattern 7: Pulse for Attention

### Good Example - Notification Indicator

```css
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.badge-pulse {
  --pulse-duration: 2s;

  animation: pulse var(--pulse-duration) ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .badge-pulse {
    animation: none;
  }
}
```

**Why good:** `ease-in-out` on a symmetric loop hides the seam at 100%, where a `linear` pulse
visibly restarts.

---

## Pattern 8: Skeleton Shimmer

### Good Example - Contained Sweep

```css
@keyframes shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

.skeleton {
  --skeleton-base: #e2e8f0;
  --skeleton-highlight: #f8fafc;
  --shimmer-duration: 1.5s;

  position: relative;
  background-color: var(--skeleton-base);
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      var(--skeleton-highlight),
      transparent
    );
    animation: shimmer var(--shimmer-duration) infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    animation: none;
  }
}
```

**Why good:** `overflow: hidden` on the parent is what clips the sweep — without it the highlight
travels across neighbouring content.

---

## Pattern 9: Reduced Motion, Both Shapes

### Good Example - Opt-In and Opt-Out

```css
/* Opt-in: still state is the base, motion is added under no-preference */
.element {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: no-preference) {
  .element {
    opacity: 0;
    transform: translateY(var(--distance-md));
    animation: fade-slide-in var(--duration-normal) var(--ease-out) forwards;
  }
}

/* Opt-out: motion is the base, reduce overrides it */
.animated-element {
  animation: fade-slide-in var(--duration-normal) var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

**Why good:** The opt-in shape fails safe — an animation added to `.element` later without a
reduced-motion branch simply never runs for users who asked for none.

---

## Pattern 10: Focus Ring Animation

### Good Example - Animated Ring That Never Delays Focus

```css
.interactive-element {
  outline: none;

  &::before {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    border: 2px solid transparent;
    transition:
      border-color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
    pointer-events: none;
  }

  &:focus-visible::before {
    border-color: var(--color-focus);
    transform: scale(1.02);
  }
}

@media (prefers-reduced-motion: reduce) {
  .interactive-element::before {
    transition: none;
  }
}
```

**Why good:** Removing `outline` is only safe because the pseudo-element replaces it; under reduced
motion the ring appears instantly rather than fading in, which keeps focus position unambiguous.
