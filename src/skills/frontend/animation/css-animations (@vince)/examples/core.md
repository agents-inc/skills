# CSS Animations Examples

> Complete code examples for CSS animation patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**For advanced patterns**: See topic-specific files in this folder:
- [transitions.md](transitions.md) - State-triggered transitions
- [keyframes.md](keyframes.md) - Multi-step and looping animations

---

## Pattern 1: Animation Token System

### Good Example - Complete Design Token Setup

```css
:root {
  /* =========================
     Duration Tokens
     ========================= */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 600ms;

  /* =========================
     Easing Tokens
     ========================= */
  /* Default - general purpose */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);

  /* Enter - fast start, slow end (elements appearing) */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);

  /* Exit - slow start, fast end (elements leaving) */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);

  /* Symmetric - equal acceleration/deceleration */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* Bouncy - playful overshoot */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* =========================
     Distance Tokens
     ========================= */
  --distance-xs: 4px;
  --distance-sm: 8px;
  --distance-md: 16px;
  --distance-lg: 24px;
  --distance-xl: 48px;

  /* Lift effects (negative = upward) */
  --lift-sm: -2px;
  --lift-md: -4px;
  --lift-lg: -8px;

  /* =========================
     Composite Tokens
     ========================= */
  --transition-fast: var(--duration-fast) var(--ease-out);
  --transition-normal: var(--duration-normal) var(--ease-default);
  --transition-slow: var(--duration-slow) var(--ease-in-out);
}
```

**Why good:** Consistent timing across application, easy to adjust globally, semantic naming communicates intent

---

## Pattern 2: Interactive Button States

### Good Example - Complete Button with All States

```css
.button {
  /* Base state */
  position: relative;
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);

  /* Prepare for shadow animation */
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

/* Hover state - lift with shadow */
.button:hover {
  transform: translateY(var(--lift-sm));

  &::after {
    opacity: 1;
  }
}

/* Focus state - visible ring */
.button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* Active state - pressed feedback */
.button:active {
  transform: translateY(0) scale(0.98);

  &::after {
    opacity: 0;
  }
}

/* Disabled state - reduced opacity */
.button:disabled {
  opacity: 0.5;
  pointer-events: none;
}
```

**Why good:** All interaction states covered, lift effect creates depth, shadow uses pseudo-element technique, focus state is accessible

### Bad Example - Performance Problems

```css
.button {
  transition: all 300ms linear;
}

.button:hover {
  margin-top: -4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

**Why bad:** `all` transitions unnecessary properties, `linear` feels mechanical, `margin-top` triggers layout, direct box-shadow animation causes repaint

---

## Pattern 3: Card Hover Effect

### Good Example - Performant Card Lift

```css
.card {
  --card-lift: var(--lift-md);
  --card-scale: 1.02;

  position: relative;
  transition: transform var(--transition-fast);

  /* Shadow layer */
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

/* Prevent hover on touch devices */
@media (hover: none) {
  .card:hover {
    transform: none;

    &::after {
      opacity: 0;
    }
  }
}
```

**Why good:** Combines lift and scale for depth, shadow is GPU-accelerated via opacity, respects touch devices

---

## Pattern 4: Fade In on Mount

### Good Example - CSS-Only Entrance Animation

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

/* Apply to elements */
.fade-in {
  animation: fade-in var(--duration-normal) var(--ease-out);
}

.fade-slide-in {
  animation: fade-slide-in var(--duration-normal) var(--ease-out);
}

/* Accessibility - disable for reduced motion */
@media (prefers-reduced-motion: reduce) {
  .fade-in,
  .fade-slide-in {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

**Why good:** Separate keyframes for different effects, ease-out for enter animations, respects reduced motion preference

---

## Pattern 5: Loading Spinner

### Good Example - Accessible Spinner

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

/* Size variants */
.spinner--sm {
  --spinner-size: 16px;
  --spinner-border: 2px;
}

.spinner--lg {
  --spinner-size: 48px;
  --spinner-border: 4px;
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 1.5s; /* Slow down instead of stopping */
  }
}
```

**Why good:** Uses currentColor for theming, size variants use custom properties, reduced motion slows rather than disables (spinner serves a purpose)

---

## Pattern 6: Notification Toast Animation

### Good Example - Enter and Exit States

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

/* Accessibility alternative */
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
    animation: toast-enter-reduced calc(var(--toast-duration) / 2) var(--ease-out)
      forwards;
  }

  .toast[data-state="exiting"] {
    animation: toast-exit-reduced calc(var(--toast-duration) / 2) var(--ease-in)
      forwards;
  }
}
```

**Why good:** Uses data attributes for state, ease-out for enter / ease-in for exit, reduced motion provides fade-only alternative

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

/* Only animate when not reduced motion */
@media (prefers-reduced-motion: reduce) {
  .badge-pulse {
    animation: none;
  }
}
```

**Why good:** Combines opacity and scale for emphasis, uses ease-in-out for smooth oscillation, disabled for reduced motion

---

## Pattern 8: Skeleton Loading Animation

### Good Example - Shimmer Effect

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

/* Accessibility - stop animation */
@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    animation: none;
  }
}
```

**Why good:** Uses transform (GPU-accelerated), overflow: hidden contains the effect, respects reduced motion

---

## Pattern 9: Reduced Motion Complete Pattern

### Good Example - Progressive Enhancement Approach

```scss
/* Base styles - no motion */
.element {
  opacity: 1;
  transform: translateY(0);
}

/* Motion opt-in */
@media (prefers-reduced-motion: no-preference) {
  .element {
    opacity: 0;
    transform: translateY(var(--distance-md));
    animation: fade-slide-in var(--duration-normal) var(--ease-out) forwards;
  }
}

/* Alternative: Motion opt-out */
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

**Why good:** Progressive enhancement (opt-in) is safest approach, provides clear patterns for both opt-in and opt-out

---

## Pattern 10: Focus Ring Animation

### Good Example - Accessible Focus Indicator

```css
.interactive-element {
  /* Remove default outline */
  outline: none;

  /* Custom focus ring */
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

/* Ensure visibility for all users */
@media (prefers-reduced-motion: reduce) {
  .interactive-element::before {
    transition: none;
  }
}
```

**Why good:** Custom focus ring with animation, still visible instantly for reduced motion users, uses :focus-visible (not :focus)
