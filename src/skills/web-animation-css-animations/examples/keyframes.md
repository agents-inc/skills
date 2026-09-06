# CSS Animations - Keyframe Examples

> Multi-step, looping and scroll-driven animations, continuing the numbering from
> [core.md](core.md) and [transitions.md](transitions.md).

**Prerequisites:** the token set from [core.md](core.md) Pattern 1.

---

## Pattern 21: Scroll-Driven Progress Bar

### Good Example - Reading Progress

```css
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

**Why good:** `linear` is correct here because the keyframes map to scroll position rather than to
time — any other curve would make the bar lag or lead the page.

**Browser support:** Chrome/Edge 115+, Safari 26+, Firefox behind a flag.

---

## Pattern 22: Viewport-Entry Reveal

### Good Example - Fade as the Element Enters

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

@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

**Why good:** `animation-range` finishes the reveal at 40% coverage rather than at full coverage, so
the element is settled by the time the reader reaches it. `both` holds the end state once the range
is passed.

---

## Pattern 23: Parallax Layer

### Good Example - Named Scroll Timeline

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

**Why good:** A named timeline lets an element outside the scroller drive from it, which the anonymous
`scroll()` cannot do.

---

## Pattern 24: Typewriter

### Good Example - Discrete Character Reveal

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

@media (prefers-reduced-motion: reduce) {
  .typewriter {
    animation: none;
    width: auto;
    border-right: none;
  }
}
```

**Why good:** `steps()` matched to the character count is what lands each frame on a glyph boundary;
`ch` makes the width arithmetic exact for a monospace face. This is the rare case where animating
`width` is intended — the reveal is the effect.

---

## Pattern 25: Bounce In

### Good Example - Overshoot and Settle

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

@media (prefers-reduced-motion: reduce) {
  .bounce-in {
    animation: fade-in calc(var(--bounce-duration) / 2) var(--ease-out);
  }
}
```

**Why good:** Decaying overshoot at 50% and 70% approximates a spring in pure keyframes; reduced
motion swaps in a fade rather than dropping the entrance entirely.

---

## Pattern 26: Error Shake

### Good Example - Decaying Horizontal Shake

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

@media (prefers-reduced-motion: reduce) {
  .input-error {
    animation: none;
    outline: 2px solid var(--color-error);
  }
}
```

**Why good:** The reduced-motion branch replaces the shake with a static outline rather than removing
it — the error still has to be noticeable without motion.

---

## Pattern 27: Gradient Animation with @property

### Good Example - Rotating Gradient Border

```css
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
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

@media (prefers-reduced-motion: reduce) {
  .gradient-border {
    animation: none;
    --gradient-angle: 45deg;
  }
}
```

**Why good:** `@property` gives the angle a type, which is what makes it interpolable; an
unregistered custom property jumps from 0deg to 360deg with no frames in between. The two-layer
background with `padding-box` and `border-box` is what confines the gradient to the border.

---

## Pattern 28: Morphing Shape

### Good Example - clip-path Interpolation

```css
@keyframes morph {
  0%,
  100% {
    clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);
  }
  50% {
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%, 0% 50%);
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

**Why good:** Both polygons carry the same point count, which is the condition for interpolation —
the diamond repeats its last point to reach five.

---

## Pattern 29: Stagger with Animation Delay

### Good Example - Index-Driven Cascade

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

.grid-item:nth-child(1) {
  --index: 0;
}
.grid-item:nth-child(2) {
  --index: 1;
}
.grid-item:nth-child(3) {
  --index: 2;
}
/* or set it inline: style="--index: 0" for a list of unknown length */

@media (prefers-reduced-motion: reduce) {
  .grid-item {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

**Why good:** `backwards` fill is what holds the scaled-down start during the delay — without it
every item renders full-size, then jumps back to start when its turn arrives.

---

## Pattern 30: Chained Animations

### Good Example - Two Animations, One Declaration

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

**Why good:** Two animations on one element, each with its own delay, sequence without any
JavaScript; because each touches a different property they never fight over the same value.
