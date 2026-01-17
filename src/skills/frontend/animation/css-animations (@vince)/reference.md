# CSS Animations Reference

> Decision frameworks, anti-patterns, and red flags for CSS animation development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Transitions vs Keyframe Animations

```
Is the animation triggered by state change (hover, focus, class toggle)?
├─ YES → Is it a simple A→B transition?
│   ├─ YES → CSS Transition ✓
│   └─ NO → Does it need multiple steps?
│       ├─ YES → CSS @keyframes Animation
│       └─ NO → CSS Transition is fine
└─ NO → Does it auto-play on mount or loop?
    ├─ YES → CSS @keyframes Animation ✓
    └─ NO → CSS Transition (triggered by class toggle)
```

### When to Use CSS vs JavaScript Animation

```
Does the animation need...
├─ Pause/play/reverse/seek control?
│   └─ YES → JavaScript (Web Animations API or library)
├─ Dynamic values calculated at runtime?
│   └─ YES → JavaScript or CSS custom properties
├─ Physics-based springs?
│   └─ YES → JavaScript animation library
├─ Orchestrated staggering across many elements?
│   └─ YES → JavaScript for complex, CSS for simple (nth-child delays)
├─ Scroll-linked progress?
│   └─ YES → CSS scroll-driven animations (if browser support sufficient)
└─ Simple state transitions?
    └─ YES → CSS Transitions ✓
```

### Which Easing to Use

```
What type of motion?
├─ Element entering screen → ease-out (fast start, slow end) ✓
├─ Element exiting screen → ease-in (slow start, fast end) ✓
├─ Symmetric back-and-forth → ease-in-out
├─ Continuous rotation (spinner) → linear ✓
├─ Playful/bouncy feel → custom cubic-bezier with overshoot
│   └─ Example: cubic-bezier(0.175, 0.885, 0.32, 1.275)
├─ Snappy professional UI → ease-out ✓
└─ Default unknown → ease-out ✓

Never use:
├─ linear for UI transitions (feels robotic)
└─ ease (default) for production (too generic)
```

### Which Property to Animate

```
Need movement?
├─ Position change → transform: translate(x, y) ✓
├─ Grow/shrink → transform: scale() ✓
├─ Rotation → transform: rotate() ✓
└─ Visibility → opacity ✓

Need to avoid (trigger layout/paint)?
├─ width, height → Use transform: scale() instead
├─ top, left, right, bottom → Use transform: translate() instead
├─ margin, padding → Use transform: translate() instead
├─ box-shadow → Use pseudo-element with opacity animation
├─ border-width → Avoid or use pseudo-element
└─ border-radius → Use clip-path or accept the cost
```

### When to Use will-change

```
Is animation already performant?
├─ YES → Don't use will-change
└─ NO → Is it a critical interaction?
    ├─ NO → Optimize animation first, then consider will-change
    └─ YES → Apply will-change on hover/focus, remove after animation
        └─ NEVER: permanent will-change on static elements
```

### Scroll-Driven Animations Decision

```
Do you need scroll-linked animation?
├─ Is target browser support sufficient? (Chrome 115+, Edge 115+)
│   ├─ YES → Use CSS scroll-driven animations ✓
│   │   ├─ Progress bar → animation-timeline: scroll()
│   │   ├─ Element reveal → animation-timeline: view()
│   │   └─ Parallax → named scroll-timeline
│   └─ NO → Use JavaScript (Intersection Observer or scroll listener)
```

---

## Timing Reference

### Duration Guidelines

| Animation Type | Duration | Reason |
|---------------|----------|--------|
| Micro-interactions (button feedback) | 100-150ms | Must feel instant |
| Simple transitions (hover states) | 150-200ms | Quick but visible |
| UI transitions (dropdowns, modals) | 200-300ms | Sweet spot for perception |
| Page/view transitions | 300-500ms | Major context change |
| Complex sequences | 500-1000ms | Story-telling, rare |

### Easing Functions Reference

```css
/* Standard easings */
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* Material Design easings */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);

/* Bounce/spring easings */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* Smooth easings (Apple-style) */
--ease-smooth: cubic-bezier(0.45, 0, 0.55, 1);
```

---

## RED FLAGS

### High Priority Issues

- **Animating layout-triggering properties** (width, height, top, left, margin, padding) - These cause expensive reflows every frame; use transform instead
- **Magic numbers for timing** - All durations and delays must be CSS custom properties or named constants
- **Missing prefers-reduced-motion support** - Every animation must respect user preferences
- **Linear easing for UI transitions** - Linear feels robotic; use ease-out for enter, ease-in for exit
- **Permanent will-change on elements** - Creates GPU layers permanently, wasting memory; apply only during animation

### Medium Priority Issues

- **Using `transition: all`** - Transitions unnecessary properties, can cause unexpected behavior when properties are added
- **Animating box-shadow directly** - Causes repaint every frame; use pseudo-element with opacity animation
- **Missing `forwards` on enter animations** - Element snaps back to initial state after animation
- **Wrong easing for motion type** - Exit animations should use ease-in, enter should use ease-out
- **Very long animation durations (>1s)** - Users perceive as slow; rarely appropriate outside special effects

### Common Mistakes

- **Forgetting transform-origin** - Scale animations scale from center by default; set origin for directional scaling
- **Animating during layout shifts** - Animations during CLS (Cumulative Layout Shift) cause jank
- **Not testing on mobile** - Animations that work on desktop may jank on mobile GPUs
- **Forgetting fill-mode: backwards for delayed animations** - Element shows in final state during delay instead of initial
- **Using px for transforms that should scale** - Consider rem or % for responsive animations

### Gotchas & Edge Cases

- **Transform + position: fixed can break** - Fixed positioning is relative to viewport, but transform creates new containing block
- **will-change creates stacking context** - Can affect z-index behavior unexpectedly
- **Animation on display: none elements** - Cannot animate to/from display: none; use opacity + visibility or height
- **SVG elements need different properties** - Use `stroke-dashoffset` and `stroke-dasharray` for SVG path animations
- **Print media** - Animations don't print; ensure content is visible without animation
- **Reduced motion ≠ no animation** - Users may still want subtle feedback; consider safe alternatives like opacity
- **Safari quirks with view-transition** - May need -webkit- prefix or different syntax
- **Scroll-driven animations in containers** - overflow: hidden parent breaks scroll-timeline

---

## Anti-Patterns

### Animating Layout Properties

Animating properties that trigger layout causes full-page recalculation every frame.

```css
/* WRONG - triggers layout every frame */
.card:hover {
  height: 200px;
  margin-top: -10px;
  padding: 20px;
}

/* CORRECT - GPU-accelerated */
.card:hover {
  transform: translateY(-10px) scale(1.05);
}
```

### Using "all" in Transitions

Transitions every property, including ones you don't intend.

```css
/* WRONG - transitions everything */
.button {
  transition: all 0.3s ease;
}

/* CORRECT - explicit property list */
.button {
  transition:
    transform 150ms ease-out,
    opacity 150ms ease-out;
}
```

### Magic Numbers in Timing

Hard-coded numbers make maintenance difficult and inconsistent.

```css
/* WRONG - magic numbers */
.modal {
  animation: fade-in 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* CORRECT - design tokens */
.modal {
  animation: fade-in var(--duration-normal) var(--ease-out);
}
```

### Ignoring Reduced Motion

Animations can cause motion sickness, seizures, or distraction.

```css
/* WRONG - no reduced motion support */
.hero {
  animation: bounce 2s infinite;
}

/* CORRECT - respects user preference */
.hero {
  animation: bounce 2s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .hero {
    animation: none;
  }
}
```

### Permanent will-change

Creates GPU layers that consume memory even when not animating.

```css
/* WRONG - permanent GPU layer */
.card {
  will-change: transform, opacity;
}

/* CORRECT - only during animation */
.card:hover {
  will-change: transform;
}

/* Or via JavaScript, remove after transition */
```

### Direct Box-Shadow Animation

Box-shadow triggers repaint on every frame.

```css
/* WRONG - repaint every frame */
.card {
  transition: box-shadow 300ms;
}
.card:hover {
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

/* CORRECT - opacity on pseudo-element */
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 300ms;
}
.card:hover::after {
  opacity: 1;
}
```

---

## Performance Checklist

### Safe Properties (Composite Only - GPU)

- `opacity`
- `transform` (translate, scale, rotate, skew)
- `filter` (on some browsers)

### Caution Properties (Paint Only)

- `color`
- `background-color`
- `border-color`
- `visibility`
- `text-decoration`

### Avoid Properties (Trigger Layout)

- `width`, `height`
- `top`, `right`, `bottom`, `left`
- `margin`, `padding`
- `border-width`
- `font-size`
- `line-height`

### Testing Performance

1. Open DevTools → Performance panel
2. Enable "Paint flashing" in Rendering tab
3. Record during animation
4. Check for:
   - Green flashes (repaints) - minimize these
   - Layout events in flame chart - eliminate if possible
   - Frame rate drops below 60fps

---

## Browser Support Quick Reference

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| CSS Transitions | Full | Full | Full | Full |
| CSS Animations | Full | Full | Full | Full |
| @property | 85+ | 85+ | 128+ | 15.4+ |
| scroll-timeline | 115+ | 115+ | Flag | 26 beta |
| animation-timeline: view() | 115+ | 115+ | Flag | 26 beta |
| View Transitions (SPA) | 111+ | 111+ | 144+ | 18+ |
| View Transitions (MPA) | 126+ | 126+ | - | - |
| linear() easing | 113+ | 113+ | 112+ | 17.4+ |

---

## Accessibility Checklist

- [ ] Uses `@media (prefers-reduced-motion)` for all animations
- [ ] Provides safe alternatives (opacity fade) for motion-sensitive effects
- [ ] Auto-playing animations can be paused or have user control
- [ ] Decorative animations don't interfere with content comprehension
- [ ] Focus indicators remain visible during animations
- [ ] Animation duration doesn't prevent interaction (not blocking click)
- [ ] Flashing content is under 3 flashes per second (WCAG 2.3.1)
- [ ] Essential information isn't conveyed by animation alone
