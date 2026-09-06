---
name: web-animation-css-animations
description: CSS animation patterns - transitions, keyframes, scroll-driven timelines, @property, compositor-friendly properties, prefers-reduced-motion
---

# CSS Animation Patterns

> **Quick Guide:** Transitions carry state changes (hover, focus, a toggled attribute); `@keyframes`
> carries motion that loops, auto-plays, or has more than two steps; `animation-timeline` carries
> scroll- and viewport-linked progress. Confining animation to `transform` and `opacity` keeps the
> frames on the compositor thread, and every animation gets a `prefers-reduced-motion` branch.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — token system, interactive states, entrance, spinner, toast, reduced-motion
- [examples/transitions.md](examples/transitions.md) — multi-property transitions, staggered delays, accordions, colour, links
- [examples/keyframes.md](examples/keyframes.md) — scroll-driven timelines, `@property` gradients, typewriter, stagger, clip-path morphs
- [reference.md](reference.md) — easing catalogue, property cost table, duration guidance, browser support

---

## Which path applies

- **The motion is a state change** — `:hover`, `:focus-visible`, a data attribute, a toggled class —
  then a `transition` on the base rule is the whole mechanism; follow
  [examples/transitions.md](examples/transitions.md).
- **The motion loops, auto-plays on mount, or passes through more than two states** — then it needs
  `@keyframes` and an `animation` shorthand; follow [examples/keyframes.md](examples/keyframes.md).
- **The motion tracks scroll position or viewport entry** — then the driver is
  `animation-timeline: scroll()` or `view()` rather than time, and the keyframes describe progress
  from 0 to 1; follow [examples/keyframes.md](examples/keyframes.md).

---

<critical_requirements>

## Before writing CSS animation code

**Animate `transform` and `opacity`.** Both are composited, so the frames run off the main thread and
survive a busy tab; `width`, `top` and `margin` re-run layout on every frame instead.

**Give every animation a `prefers-reduced-motion` branch.** The preference is a vestibular safety
setting rather than an off switch — an opacity fade at a shorter duration usually satisfies it while
keeping the state change legible.

**Use `ease-out` on enter and `ease-in` on exit.** An element arriving decelerates into place and one
leaving accelerates away; `linear` reads as mechanical for anything but continuous rotation.

**Scope `will-change` to the interaction that needs it.** Each declaration holds a compositing layer
for as long as the rule applies, so a blanket selector holds one per element on the page at once.

</critical_requirements>

---

**Auto-detection:** @keyframes, transition-property, transition-duration, animation-timeline,
scroll-timeline, view-timeline, animation-range, animation-fill-mode, prefers-reduced-motion,
will-change, cubic-bezier, linear(), @property, steps(), transform-origin

**Applies to:**

- State-change motion driven by a pseudo-class, a data attribute or a toggled class
- Autonomous motion — spinners, pulses, shimmer, attention cues
- Scroll-linked and viewport-entry progress
- Entrance and exit motion whose trigger is a class or attribute the page already sets

**Handled elsewhere:**

- Playback control at runtime — pause, reverse, seek, or read progress. A CSS declaration exposes no
  handle; the Web Animations API is where one comes from, either `element.animate()` or
  `element.getAnimations()` over what CSS already declared
- Motion whose velocity carries across an interruption, such as a spring picked up mid-gesture
- Pointer-tracking drag, where the animated value is the pointer position itself
- Compositing an outgoing and an incoming view together across a navigation or view swap

---

<decision_framework>

## Easing selection

```
Element entering        -> ease-out (fast start, slow settle)
Element exiting         -> ease-in (slow start, fast departure)
Symmetric motion        -> ease-in-out
Continuous rotation     -> linear
Playful, overshooting   -> cubic-bezier with a control point past 1
Anything else           -> ease-out
```

`ease`, the browser default, is generic enough that two adjacent animations using it read as
unrelated; name the curve instead.

## What CSS expresses

- **Scroll and viewport progress** — `animation-timeline: scroll()` or `view()`, with
  `animation-range` deciding where progress starts and ends
- **Sequencing across elements** — `animation-delay` computed from an `--index` custom property, with
  `backwards` fill so the pre-animation state holds during the delay
- **Values computed at runtime** — write them into a custom property; the animation itself stays
  declarative and reads the property each frame
- **Overshoot and arbitrary curves** — a `cubic-bezier` past the 0–1 range, or `linear()` with a
  point list for a curve no cubic can express

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Animation Token System

Durations, easings and travel distances defined once as custom properties, so motion stays consistent
across components and is retunable in one place.

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1); /* enter */
  --ease-in: cubic-bezier(0.4, 0, 1, 1); /* exit */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* overshoot */
  --lift-md: -4px;
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Compositor-Only Transitions

Name each property being transitioned, and express movement and size as `transform` so no frame
triggers layout.

```css
.card {
  transition:
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}
.card:hover {
  transform: translateY(var(--lift-md)) scale(1.02);
}
```

`translate()` replaces `top`/`left`, `scale()` replaces `width`/`height`, and a pseudo-element whose
`opacity` animates replaces an animated `box-shadow`.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Prefers-Reduced-Motion

Two shapes. Progressive enhancement makes the still state the base and opts motion in, so an
animation added later cannot escape the check:

```css
.element {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: no-preference) {
  .element {
    animation: fade-slide-in var(--duration-normal) var(--ease-out);
  }
}
```

Graceful degradation animates by default and overrides under `reduce` — the right shape when the
reduced form is a shorter fade rather than nothing:

```css
@media (prefers-reduced-motion: reduce) {
  .notification {
    animation: fade-in calc(var(--notification-duration) * 0.5) var(--ease-out);
  }
}
```

Reduced motion does not mean no animation. Opacity is generally safe; what it replaces is spatial
travel, scale and rotation.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: @keyframes

For motion that loops, auto-plays on mount, or passes through more than two states.

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
  animation: fade-slide-in var(--modal-enter-duration) var(--ease-out) forwards;
}
```

`forwards` holds the final state after the run; `backwards` shows the initial state during
`animation-delay`.

Full code: [examples/core.md](examples/core.md) and
[examples/keyframes.md](examples/keyframes.md)

---

### Pattern 5: Will-Change Scoping

`will-change` promotes the element to its own compositing layer, which costs GPU memory
proportional to the element's painted area. Declare it on the rule that is about to animate.

```css
.card:hover {
  will-change: transform;
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Scroll-Driven Animations

`animation-timeline` drives keyframes from scroll progress instead of elapsed time, with no
scroll listener and no per-frame JavaScript.

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

`scroll()` tracks a scroll container's position; `view()` tracks the element's own passage through
the viewport, with `animation-range` bounding it.

**Browser support:** Chrome/Edge 115+, Safari 26+, Firefox behind a flag.

Full code: [examples/keyframes.md](examples/keyframes.md)

---

### Pattern 7: @property for Custom Property Animation

Registering a custom property gives it a type, which is what makes it interpolable — gradient angles
and colour stops animate only once registered.

```css
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes rotate-gradient {
  to {
    --gradient-angle: 360deg;
  }
}
```

**Browser support:** Chrome/Edge 85+, Safari 16.4+, Firefox 128+.

Full code: [examples/keyframes.md](examples/keyframes.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `transition: all` — picks up every property a later edit adds, including layout-triggering ones —
  name each transitioned property explicitly
- Animating `width`, `height`, `top`, `left`, `margin` or `padding` — re-runs layout every frame and
  drops frames as soon as the main thread is busy — animate `transform` and leave layout still
- Animating `box-shadow` — repaints the element and its shadow each frame — animate the `opacity` of
  a pseudo-element that carries the shadow
- `will-change` on a permanent or broad selector — holds one compositing layer per matched element,
  and on mobile enough layers exhaust GPU memory and kill the tab — declare it on the interaction
  rule only
- An animation with no `prefers-reduced-motion` branch — full-travel motion reaches users who have
  asked their OS for none — add the branch when the animation is written, not afterwards
- An enter animation without `forwards` — the element snaps back to its pre-animation state on the
  final frame — add the fill mode

**Surprising behaviour:**

- `transform` on an ancestor creates a containing block, so a `position: fixed` descendant anchors to
  that ancestor rather than to the viewport
- `will-change` creates a stacking context, changing how `z-index` resolves against siblings
- Without `animation-fill-mode: backwards`, a delayed animation renders its final state during the
  delay instead of its first frame
- `display: none` cannot be animated — use `opacity` with `visibility`, or `grid-template-rows`
  animating `0fr` to `1fr`
- SVG path drawing animates `stroke-dasharray` and `stroke-dashoffset`; `transform` moves the path
  rather than drawing it
- A `scroll()` timeline needs a scrollable ancestor — an `overflow: hidden` parent yields no progress
- Animations do not run in print, so the pre-animation state has to be legible on paper
- Durations past roughly 1s read as sluggish rather than deliberate

</red_flags>
