---
name: web-animation-css-animations
description: CSS Animation patterns - transitions, keyframes, scroll-driven animations, @property, GPU-accelerated properties, accessibility with prefers-reduced-motion
---

# CSS Animation Patterns

> **Quick Guide:** Use CSS transitions for state changes (hover, focus), `@keyframes` for autonomous/looping animations, scroll-driven animations for scroll-linked effects. Animate only `transform` and `opacity` for 60fps. Always respect `prefers-reduced-motion`.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST animate ONLY transform and opacity for GPU-accelerated 60fps performance)**

**(You MUST respect prefers-reduced-motion using @media (prefers-reduced-motion: no-preference) for opt-in or @media (prefers-reduced-motion: reduce) for opt-out)**

**(You MUST use CSS custom properties for ALL timing values - NO magic numbers like `0.3s`)**

**(You MUST use ease-out for enter animations and ease-in for exit animations - NEVER linear for UI transitions)**

**(You MUST remove will-change after animation completes - permanent will-change wastes GPU memory)**

</critical_requirements>

---

**Auto-detection:** CSS animation, CSS transition, @keyframes, transform, opacity, transition-duration, animation-duration, prefers-reduced-motion, scroll-timeline, animation-timeline, will-change, cubic-bezier, ease-out, ease-in, @property

**When to use:**

- Simple state change animations (hover, focus, active states)
- Autonomous looping animations (spinners, pulses, attention grabbers)
- Scroll-linked animations and parallax effects
- Micro-interactions that don't need JavaScript control

**When NOT to use:**

- Animations requiring JavaScript control (pause, reverse, seek) -- use Web Animations API
- Complex orchestrated animations with staggered timing -- use your animation library
- Physics-based spring animations -- use your animation library
- Drag-and-drop or gesture-driven animations -- use your animation library

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Token system, interactive states, shadows, loading, reduced motion
- [examples/transitions.md](examples/transitions.md) - Multi-property transitions, accordions, color, links
- [examples/keyframes.md](examples/keyframes.md) - Scroll-driven, @property gradients, typewriter, stagger, shapes
- [reference.md](reference.md) - Decision frameworks, timing reference, browser support

---

<philosophy>

## Philosophy

CSS animations leverage the browser's compositor thread for smooth, 60fps animations that don't block JavaScript execution. By animating only GPU-accelerated properties (`transform` and `opacity`), animations run on a separate thread from the main JavaScript thread.

**Core principles:**

1. **Performance first** - Animate only `transform` and `opacity` to avoid layout/paint triggers
2. **Accessibility built-in** - Always respect `prefers-reduced-motion` user preferences
3. **Transitions for state changes** - Use CSS transitions for hover, focus, and state-driven animations
4. **Keyframes for autonomous motion** - Use `@keyframes` for animations that loop, auto-play, or have multiple steps
5. **Design tokens for consistency** - Use CSS custom properties for durations, easings, and distances

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Animation Token System

Define timing, easing, and distance tokens as CSS custom properties for consistency. See [examples/core.md](examples/core.md) for the full token setup.

```css
:root {
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;

  --ease-out: cubic-bezier(0, 0, 0.2, 1); /* Enter */
  --ease-in: cubic-bezier(0.4, 0, 1, 1); /* Exit */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* Symmetric */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Bouncy */

  --lift-sm: -2px;
  --lift-md: -4px;
}
```

**Why tokens matter:** Consistent timing across application, easy to adjust globally, semantic naming communicates intent

---

### Pattern 2: GPU-Accelerated Transitions

Only animate `transform` and `opacity`. Never animate layout properties like `width`, `height`, `top`, `left`, `margin`, or `padding`.

```css
/* CORRECT - GPU-accelerated */
.card {
  transition:
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}
.card:hover {
  transform: translateY(var(--lift-md)) scale(1.02);
}
```

```css
/* WRONG - triggers layout recalculation every frame */
.card {
  transition: all 0.3s linear;
}
.card:hover {
  top: -8px;
  margin-top: -8px;
}
```

**Transform mapping:** Use `translate()` instead of `top/left`, `scale()` instead of `width/height`, pseudo-element opacity instead of `box-shadow`.

See [examples/core.md](examples/core.md) for button states, card hover effects, and the pseudo-element shadow technique.

---

### Pattern 3: Prefers-Reduced-Motion

Every animation must respect user motion preferences. Two strategies:

#### Progressive Enhancement (Recommended)

```css
/* Base: no motion */
.element {
  opacity: 1;
  transform: translateY(0);
}

/* Opt-in to motion */
@media (prefers-reduced-motion: no-preference) {
  .element {
    animation: fade-slide-in var(--duration-normal) var(--ease-out);
  }
}
```

#### Graceful Degradation

```css
.notification {
  animation: slide-in-bounce var(--notification-duration) var(--ease-spring);
}

@media (prefers-reduced-motion: reduce) {
  .notification {
    animation: fade-in calc(var(--notification-duration) * 0.5) var(--ease-out);
  }
}
```

**Key insight:** Reduced motion does not mean no animation. Opacity fades are generally safe. Replace spatial movement with opacity-only alternatives.

See [examples/core.md](examples/core.md) for the complete reduced motion pattern.

---

### Pattern 4: CSS @keyframes

Use `@keyframes` for animations that loop, auto-play on mount, or have more than two states.

```css
@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal {
  --modal-enter-duration: 300ms;
  animation: fade-slide-in var(--modal-enter-duration) var(--ease-out) forwards;
}
```

**Key details:**

- Use `forwards` fill mode to retain final state after animation
- Use `backwards` fill mode to show initial state during `animation-delay`
- Use `ease-out` for enter, `ease-in` for exit
- `linear` is only appropriate for continuous rotation (spinners)

See [examples/core.md](examples/core.md) for spinners, pulses, skeleton loaders, and toast animations. See [examples/keyframes.md](examples/keyframes.md) for scroll-driven animations, @property gradients, and complex sequences.

---

### Pattern 5: Will-Change Optimization

`will-change` creates a GPU layer (~307KB per 320x240px element). Apply only when needed, remove after.

```css
/* CORRECT - only during interaction */
.card:hover {
  will-change: transform;
}

/* WRONG - permanent GPU layer on every element */
* {
  will-change: transform;
}
```

Never apply `will-change` permanently. Each element with `will-change` creates a separate compositing layer that consumes GPU memory. On mobile devices, this can crash the browser.

---

### Pattern 6: Scroll-Driven Animations

CSS `animation-timeline` allows scroll-linked animations without JavaScript.

```css
.progress-bar {
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

**Two timeline types:**

- `scroll()` -- progress based on scroll container position
- `view()` -- progress based on element visibility in viewport

**Browser support:** Chrome/Edge 115+, Safari 26+, Firefox behind flag

See [examples/keyframes.md](examples/keyframes.md) for scroll progress, viewport reveal, and parallax patterns.

---

### Pattern 7: @property for Custom Property Animation

CSS Houdini's `@property` enables animating custom properties like gradient angles that CSS cannot normally interpolate.

```css
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.gradient-border {
  background: linear-gradient(var(--gradient-angle), #ff0080, #7928ca);
  animation: rotate-gradient 3s linear infinite;
}

@keyframes rotate-gradient {
  to {
    --gradient-angle: 360deg;
  }
}
```

**Browser support:** Chrome/Edge 85+, Safari 16.4+, Firefox 128+

</patterns>

---

<performance>

## Performance

### The 16.67ms Budget

For 60fps, each frame must complete in 16.67ms. Layout-triggering animations often exceed this budget.

| Category                   | Properties                                | Impact                               |
| -------------------------- | ----------------------------------------- | ------------------------------------ |
| **Composite only (Best)**  | transform, opacity                        | No layout, no paint, GPU-accelerated |
| **Paint only (Okay)**      | color, background-color, visibility       | No layout, but repaints              |
| **Layout + Paint (Avoid)** | width, height, margin, padding, top, left | Full page recalculation              |

### Duration Guidelines

| Animation Type     | Duration   | Reason                    |
| ------------------ | ---------- | ------------------------- |
| Micro-interactions | 100-150ms  | Feels instant             |
| UI transitions     | 200-300ms  | Sweet spot for perception |
| Page transitions   | 300-500ms  | Major context change      |
| Complex sequences  | 500-1000ms | Story-telling moments     |

### Transform Mapping

| Instead of...       | Use...                          |
| ------------------- | ------------------------------- |
| `top`, `left`       | `translate(x, y)`               |
| `width`, `height`   | `scale()`                       |
| `box-shadow`        | Pseudo-element with opacity     |
| `margin`, `padding` | `translate()` with layout space |

</performance>

---

<decision_framework>

## Decision Framework

### Transitions vs @keyframes

```
Is the animation triggered by user interaction (hover, focus, class toggle)?
├─ YES → Is it a simple A->B state change?
│   ├─ YES -> CSS Transition
│   └─ NO -> Does it need multiple steps?
│       ├─ YES -> CSS @keyframes
│       └─ NO -> CSS Transition is fine
└─ NO -> Does it auto-play or loop?
    ├─ YES -> CSS @keyframes
    └─ NO -> CSS Transition (triggered by class toggle)
```

### Easing Selection

```
What type of motion?
├─ Element entering -> ease-out (fast start, slow end)
├─ Element exiting -> ease-in (slow start, fast end)
├─ Symmetric motion -> ease-in-out
├─ Continuous rotation -> linear
├─ Playful/bouncy -> custom cubic-bezier with overshoot
└─ Default UI -> ease-out

Never use:
├─ linear for UI transitions (feels robotic)
└─ ease (browser default) for production (too generic)
```

### CSS vs JavaScript Animation

```
Does the animation need...
├─ Pause/play/reverse/seek control? -> JavaScript (Web Animations API)
├─ Dynamic values calculated at runtime? -> JavaScript or CSS custom properties
├─ Physics-based springs? -> Your animation library
├─ Orchestrated staggering across many elements? -> JavaScript for complex, CSS for simple
├─ Scroll-linked progress? -> CSS scroll-driven animations
├─ Page/view transitions? -> See the View Transitions skill
└─ Simple state transitions? -> CSS Transitions
```

</decision_framework>

---

<red_flags>

## RED FLAGS

### High Priority

- **Animating layout properties** (`width`, `height`, `top`, `left`, `margin`, `padding`) -- triggers expensive reflows every frame; use `transform` instead
- **Magic numbers for timing** (`0.3s`, `300ms` inline) -- all durations must be CSS custom properties
- **Missing `prefers-reduced-motion`** -- every animation must respect user preferences
- **Linear easing for UI transitions** -- `linear` feels robotic; use `ease-out` for enter, `ease-in` for exit
- **Permanent `will-change`** -- creates GPU layers permanently, wasting memory; apply only during animation

### Medium Priority

- **Using `transition: all`** -- transitions unnecessary properties, causes surprises when new properties are added
- **Animating `box-shadow` directly** -- causes repaint every frame; use pseudo-element with opacity
- **Missing `forwards` on enter animations** -- element snaps back to initial state
- **Very long durations (>1s)** -- users perceive as slow; rarely appropriate outside special effects

### Gotchas & Edge Cases

- **`transform` + `position: fixed`** -- transform creates new containing block, breaking fixed positioning relative to viewport
- **`will-change` creates stacking context** -- can affect z-index behavior unexpectedly
- **Cannot animate `display: none`** -- use `opacity` + `visibility` or `grid-template-rows: 0fr`
- **`fill-mode: backwards` needed for delayed animations** -- without it, element shows in final state during delay
- **SVG uses different properties** -- animate `stroke-dashoffset` and `stroke-dasharray`, not `transform` for path drawing
- **Scroll-driven animations need scrollable container** -- `overflow: hidden` parent breaks `scroll-timeline`
- **Print media** -- animations don't print; ensure content is visible without animation

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST animate ONLY transform and opacity for GPU-accelerated 60fps performance)**

**(You MUST respect prefers-reduced-motion using @media (prefers-reduced-motion: no-preference) for opt-in or @media (prefers-reduced-motion: reduce) for opt-out)**

**(You MUST use CSS custom properties for ALL timing values - NO magic numbers like `0.3s`)**

**(You MUST use ease-out for enter animations and ease-in for exit animations - NEVER linear for UI transitions)**

**(You MUST remove will-change after animation completes - permanent will-change wastes GPU memory)**

**Failure to follow these rules will cause jank, accessibility issues, and degraded user experience.**

</critical_reminders>
