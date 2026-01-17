# CSS @keyframes Examples

> Multi-step and looping animation patterns. See [core.md](core.md) for basic examples.

---

## Pattern 1: Scroll-Driven Progress Bar

Modern CSS allows animations tied to scroll position without JavaScript.

### Good Example - Scroll Progress Indicator

```css
/* Page scroll progress bar */
.progress-bar {
  --progress-height: 4px;

  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--progress-height);
  background-color: var(--color-primary);
  transform-origin: left;
  animation: grow-width linear;
  animation-timeline: scroll();
}

@keyframes grow-width {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
```

**Why good:** No JavaScript needed, uses scaleX (GPU-accelerated), linear is correct for progress representation

**Browser support:** Chrome 115+, Edge 115+, Safari 26 beta

---

## Pattern 2: View-Based Scroll Animation

Animate elements as they enter the viewport.

### Good Example - Reveal on Scroll

```css
.reveal-on-scroll {
  animation: fade-slide-in linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 40%;
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(100px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Accessibility - disable scroll animations */
@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

**Why good:** Native scroll-triggered animation, animation-range controls when it starts/ends, respects reduced motion

---

## Pattern 3: Parallax Effect

Create depth with scroll-driven parallax.

### Good Example - CSS Parallax Layer

```css
.parallax-container {
  overflow-y: scroll;
  scroll-timeline: --parallax-scroll block;
}

.parallax-bg {
  animation: parallax linear;
  animation-timeline: --parallax-scroll;
}

@keyframes parallax {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);
  }
}
```

**Why good:** Pure CSS parallax, no JavaScript calculations needed, uses named scroll timeline

---

## Pattern 4: Typewriter Effect

Character-by-character reveal using steps().

### Good Example - Typewriter Animation

```css
.typewriter {
  --char-count: 20;
  --type-duration: 2s;
  --cursor-duration: 0.7s;

  width: calc(var(--char-count) * 1ch);
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid currentColor;
  animation:
    typing var(--type-duration) steps(var(--char-count)) forwards,
    cursor var(--cursor-duration) step-end infinite;
}

@keyframes typing {
  from {
    width: 0;
  }
  to {
    width: calc(var(--char-count) * 1ch);
  }
}

@keyframes cursor {
  50% {
    border-color: transparent;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .typewriter {
    animation: none;
    width: auto;
    border-right: none;
  }
}
```

**Why good:** Uses steps() for discrete frames, ch unit for character width, cursor blinks independently

---

## Pattern 5: Bouncing Animation

Physics-like bounce using keyframe percentages.

### Good Example - Bounce In

```css
@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
  }
}

.bounce-in {
  --bounce-duration: 500ms;

  animation: bounce-in var(--bounce-duration) var(--ease-default);
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .bounce-in {
    animation: fade-in calc(var(--bounce-duration) / 2) var(--ease-out);
  }
}
```

**Why good:** Overshoots and settles for bouncy feel, reduced motion gets simple fade

---

## Pattern 6: Shake for Error

Attention-grabbing shake animation.

### Good Example - Error Shake

```css
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-4px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(4px);
  }
}

.input-error {
  --shake-duration: 400ms;

  animation: shake var(--shake-duration) var(--ease-default);
}

/* Accessibility - no shake, just highlight */
@media (prefers-reduced-motion: reduce) {
  .input-error {
    animation: none;
    outline: 2px solid var(--color-error);
  }
}
```

**Why good:** Decreasing amplitude feels natural, reduced motion provides visual alternative

---

## Pattern 7: Gradient Animation with @property

Animate gradient properties using CSS Houdini.

### Good Example - Animated Gradient Border

```css
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@property --gradient-position {
  syntax: "<percentage>";
  initial-value: 0%;
  inherits: false;
}

.gradient-border {
  --gradient-duration: 3s;

  border: 2px solid transparent;
  background:
    linear-gradient(var(--color-surface), var(--color-surface)) padding-box,
    linear-gradient(
        var(--gradient-angle),
        var(--color-primary),
        var(--color-secondary)
      )
      border-box;
  animation: rotate-gradient var(--gradient-duration) linear infinite;
}

@keyframes rotate-gradient {
  to {
    --gradient-angle: 360deg;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .gradient-border {
    animation: none;
    --gradient-angle: 45deg;
  }
}
```

**Why good:** @property enables gradient animation, background-clip creates border effect

---

## Pattern 8: Morphing Shape

SVG-like morphing using clip-path.

### Good Example - Shape Morph

```css
@keyframes morph {
  0%,
  100% {
    clip-path: polygon(
      50% 0%,
      100% 38%,
      82% 100%,
      18% 100%,
      0% 38%
    ); /* Pentagon */
  }
  50% {
    clip-path: polygon(
      50% 0%,
      100% 50%,
      50% 100%,
      0% 50%,
      0% 50%
    ); /* Diamond */
  }
}

.morphing-shape {
  --morph-duration: 4s;

  animation: morph var(--morph-duration) ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .morphing-shape {
    animation: none;
  }
}
```

**Why good:** clip-path is composited (GPU-friendly), smooth interpolation between polygon points

---

## Pattern 9: Stagger with Animation Delay

Multiple elements with cascading delays.

### Good Example - Staggered Grid Items

```css
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.grid-item {
  --stagger-delay: 50ms;
  --item-duration: 300ms;

  animation: scale-in var(--item-duration) var(--ease-spring) backwards;
  animation-delay: calc(var(--index) * var(--stagger-delay));
}

/* Set index via CSS custom property or inline style */
.grid-item:nth-child(1) {
  --index: 0;
}
.grid-item:nth-child(2) {
  --index: 1;
}
.grid-item:nth-child(3) {
  --index: 2;
}
/* ... or use inline: style="--index: 0" */

@media (prefers-reduced-motion: reduce) {
  .grid-item {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

**Why good:** backwards fill mode shows initial state during delay, spring easing adds polish

---

## Pattern 10: View Transitions API

Modern page transitions between navigations.

### Good Example - Basic View Transition (SPA)

```css
/* Default crossfade */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 300ms;
}

/* Custom slide transition */
@keyframes slide-out-left {
  to {
    transform: translateX(-100%);
  }
}

@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
}

::view-transition-old(root) {
  animation: slide-out-left 300ms var(--ease-in) forwards;
}

::view-transition-new(root) {
  animation: slide-in-right 300ms var(--ease-out) forwards;
}

/* Named transitions for specific elements */
.hero-image {
  view-transition-name: hero;
}

::view-transition-old(hero),
::view-transition-new(hero) {
  animation-duration: 500ms;
}
```

**Usage with JavaScript:**

```typescript
// Trigger view transition
document.startViewTransition(() => {
  // Update DOM here
  updateContent();
});
```

**Why good:** Native browser-level transitions, smooth between DOM updates, named transitions for shared elements

**Browser support:** Chrome 111+, Edge 111+, Safari 18+

---

## Pattern 11: Cross-Document View Transitions (MPA)

Enable transitions between full page navigations.

### Good Example - MPA View Transitions

```css
/* Enable on both source and destination pages */
@view-transition {
  navigation: auto;
}

/* Customize the transition */
::view-transition-old(root) {
  animation: fade-out 200ms var(--ease-in);
}

::view-transition-new(root) {
  animation: fade-in 200ms var(--ease-out);
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: auto;
  }

  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.01ms;
  }
}
```

**Why good:** Works with traditional multi-page apps, no JavaScript needed, respects reduced motion

---

## Pattern 12: Chained Animations

Sequential animations using animation-delay.

### Good Example - Multi-Stage Entrance

```css
@keyframes fade-in {
  to {
    opacity: 1;
  }
}

@keyframes slide-up {
  to {
    transform: translateY(0);
  }
}

.hero {
  --fade-duration: 300ms;
  --slide-duration: 400ms;
  --slide-delay: 200ms;

  opacity: 0;
  transform: translateY(20px);
}

.hero[data-state="visible"] {
  animation:
    fade-in var(--fade-duration) var(--ease-out) forwards,
    slide-up var(--slide-duration) var(--ease-out) var(--slide-delay) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .hero[data-state="visible"] {
    animation: fade-in calc(var(--fade-duration) * 0.5) var(--ease-out) forwards;
    transform: translateY(0);
  }
}
```

**Why good:** Multiple animations with independent timing, delay creates sequence effect, reduced motion simplifies
