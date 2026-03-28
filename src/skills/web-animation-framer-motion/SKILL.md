---
name: web-animation-framer-motion
description: Motion (formerly Framer Motion) animation patterns - motion components, variants, gestures, layout animations, scroll-linked animations, accessibility
---

# Motion Animation Patterns

> **Quick Guide:** Use Motion for declarative React animations. `motion.*` components for basic animations, variants for orchestrated sequences, AnimatePresence for exit animations, `layout`/`layoutId` for FLIP animations, `useScroll`/`useInView` for scroll-triggered effects. Always animate transform properties (x, y, scale, rotate, opacity) for GPU performance. Always respect reduced motion via `MotionConfig reducedMotion="user"`.

> **Import:** `import { motion } from "motion/react"` (v11+ package rename from `framer-motion`)

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap exiting components in AnimatePresence for exit animations to work)**

**(You MUST provide unique `key` prop to direct children of AnimatePresence)**

**(You MUST animate transform properties (x, y, scale, rotate, opacity) for GPU-accelerated performance)**

**(You MUST respect reduced motion preferences using MotionConfig or useReducedMotion)**

**(You MUST use named constants for all animation timing values - NO magic numbers)**

</critical_requirements>

---

**Auto-detection:** Motion, Framer Motion, motion.div, motion.button, AnimatePresence, useAnimation, useScroll, useInView, usePageInView, variants, whileHover, whileTap, layoutId, spring, tween, stagger, "motion/react", "framer-motion"

**When to use:**

- Animating component enter/exit/presence
- Orchestrating complex multi-element animations with variants
- Implementing gesture-based interactions (hover, tap, drag)
- Creating scroll-triggered or scroll-linked animations
- Animating layout changes and shared element transitions
- Building micro-interactions and UI feedback

**When NOT to use:**

- Simple CSS transitions (use CSS transitions instead)
- Complex timeline-based animations requiring frame-level control (consider a dedicated timeline animation library)
- Performance-critical animations on low-powered devices without careful optimization

**Key patterns covered:**

- motion components and animation props (initial, animate, exit, transition)
- Variants for reusable, orchestrated animations
- AnimatePresence for exit animations and animation modes
- Gesture props (whileHover, whileTap, whileDrag, drag)
- Layout animations (layout prop, layoutId, LayoutGroup)
- Scroll animations (useScroll, useInView, whileInView)
- Spring and tween transitions
- useAnimation for imperative control
- Reduced motion accessibility
- v12: usePageInView, enhanced stagger(), drag stop/cancel

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Motion components, variants, AnimatePresence, gestures, accessibility
- [examples/layout.md](examples/layout.md) - Layout animations, shared elements, expandable cards
- [examples/scroll.md](examples/scroll.md) - Scroll progress, reveal, parallax
- [examples/sequences.md](examples/sequences.md) - Complex sequences, keyframes
- [examples/svg.md](examples/svg.md) - SVG path animations
- [reference.md](reference.md) - Decision frameworks, migration guide, anti-patterns, performance, quick reference

---

<philosophy>

## Philosophy

Motion is a declarative animation library for React that makes animations feel natural and accessible. It uses a physics-based approach with spring animations as defaults, creating fluid motion that matches real-world expectations.

**Core principles:**

1. **Declarative over imperative** - Describe what the animation should look like, not how to achieve it
2. **Props over keyframes** - Use `initial`, `animate`, `exit` props instead of CSS keyframes
3. **Variants for orchestration** - Group related animations and control timing with parent-child relationships
4. **Performance through transforms** - Animate GPU-accelerated properties (transform, opacity) for smooth 60fps
5. **Accessibility built-in** - Respect user preferences for reduced motion

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Basic Motion Components

Prefix any HTML or SVG element with `motion.` to make it animatable. Use `initial`, `animate`, `exit`, and `transition` props.

```typescript
import { motion } from "motion/react";

const FADE_DURATION_S = 0.3;
const SLIDE_DISTANCE_PX = 20;

export const FadeIn = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: SLIDE_DISTANCE_PX }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: FADE_DURATION_S }}
  >
    {children}
  </motion.div>
);
```

**Why good:** Named constants, declarative intent, `y` is GPU-accelerated (never animate `top`/`left`/`margin`)

See [examples/core.md](examples/core.md) Pattern 1 for full examples with className, delay props, and bad examples.

---

### Pattern 2: Variants for Orchestrated Animations

Variants define reusable animation states and enable parent-child orchestration with `staggerChildren`.

```typescript
import { motion, type Variants } from "motion/react";

const STAGGER_DELAY_S = 0.1;

const ITEM_DISTANCE_PX = 20;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: STAGGER_DELAY_S } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: ITEM_DISTANCE_PX },
  visible: { opacity: 1, y: 0 },
};
```

Children automatically inherit animation state from parent. Use `staggerDirection: -1` for reverse stagger on exit.

See [examples/core.md](examples/core.md) Pattern 2 for complete list animation with exit variants.

---

### Pattern 3: AnimatePresence for Exit Animations

AnimatePresence enables exit animations for components being removed from the React tree. Direct children **must** have unique `key` props.

```typescript
import { AnimatePresence, motion } from "motion/react";

const MODAL_SCALE_HIDDEN = 0.95;

<AnimatePresence>
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, scale: MODAL_SCALE_HIDDEN }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: MODAL_SCALE_HIDDEN }}
    />
  )}
</AnimatePresence>
```

**Animation modes:** `mode="sync"` (default, simultaneous), `mode="wait"` (wait for exit before enter - ideal for page transitions), `mode="popLayout"` (for shared layout transitions).

See [examples/core.md](examples/core.md) Pattern 3 for modal and page transition examples.

---

### Pattern 4: Gesture Animations

Gesture props enable hover, tap, focus, and drag interactions.

```typescript
const HOVER_SCALE = 1.05;
const TAP_SCALE = 0.95;
const GESTURE_SPRING = { type: "spring" as const, stiffness: 400, damping: 17 };

<motion.button
  whileHover={{ scale: HOVER_SCALE }}
  whileTap={{ scale: TAP_SCALE }}
  transition={GESTURE_SPRING}
/>
```

For drag: use `drag`, `dragConstraints`, `dragElastic`, `whileDrag`. Use `useDragControls` for programmatic drag (v12+ adds `.stop()`/`.cancel()`).

See [examples/core.md](examples/core.md) Pattern 4 for interactive card and draggable element examples.

---

### Pattern 5: Layout Animations

The `layout` prop animates layout changes automatically using FLIP technique. Use `layout="position"` on children to prevent text distortion. Use `layoutId` for shared element transitions across different containers.

```typescript
<motion.div layout transition={LAYOUT_SPRING}>
  <motion.h2 layout="position">Title</motion.h2>
</motion.div>

// Shared element: layoutId creates seamless transitions
{activeTab === tab && <motion.div layoutId="indicator" />}
```

Use `LayoutGroup` with `id` prop to scope `layoutId` to component instances (layoutId is global by default).

See [examples/layout.md](examples/layout.md) for expandable cards and tab indicator examples.

---

### Pattern 6: Scroll-Triggered Animations

`whileInView` for scroll-triggered animations. `useScroll` + `useTransform` for scroll-linked effects.

```typescript
const REVEAL_DISTANCE_PX = 50;
const PARALLAX_RANGE_PX = 100;

// Scroll-triggered (fires once)
<motion.div
  initial={{ opacity: 0, y: REVEAL_DISTANCE_PX }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
/>

// Scroll-linked (continuous)
const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
const y = useTransform(scrollYProgress, [0, 1], [-PARALLAX_RANGE_PX, PARALLAX_RANGE_PX]);
```

Motion values from `useScroll` update without React re-renders.

See [examples/scroll.md](examples/scroll.md) for progress bar, parallax, and reveal examples.

---

### Pattern 7: Spring and Tween Transitions

```typescript
// Springs - physics-based, natural feel
const BOUNCY = { type: "spring", stiffness: 300, damping: 10 }; // Playful
const SNAPPY = { type: "spring", stiffness: 500, damping: 30 }; // Responsive
const GENTLE = { type: "spring", stiffness: 100, damping: 20 }; // Subtle

// Tweens - duration-based, precise control
const ENTER = { type: "tween", ease: "easeOut", duration: 0.3 }; // Enter
const EXIT = { type: "tween", ease: "easeIn", duration: 0.2 }; // Exit
```

**Rule of thumb:** Springs for interactive elements (buttons, cards), tweens for UI transitions (modals, page changes).

See [reference.md](reference.md) for full transition type reference with additional presets.

---

### Pattern 8: useAnimation for Imperative Control

Use `useAnimation` when you need programmatic control over animations triggered by external events, complex sequences, or start/stop behavior.

```typescript
const SHAKE_DISTANCE_PX = 10;
const SHAKE_DURATION_S = 0.3;

const controls = useAnimation();

useEffect(() => {
  if (hasError) {
    controls.start({
      x: [0, -SHAKE_DISTANCE_PX, SHAKE_DISTANCE_PX, -SHAKE_DISTANCE_PX, 0],
      transition: { duration: SHAKE_DURATION_S },
    });
  }
}, [hasError, controls]);

<motion.div animate={controls}>{children}</motion.div>
```

See [examples/sequences.md](examples/sequences.md) for multi-step sequences and keyframe animations.

---

### Pattern 9: Reduced Motion Accessibility

Always respect user preferences for reduced motion.

```typescript
// Site-wide: wrap app root
<MotionConfig reducedMotion="user">{children}</MotionConfig>

// Per-component: custom handling
const FULL_DISTANCE_PX = 50;
const FULL_DURATION_S = 0.5;
const REDUCED_DURATION_S = 0.2;

const shouldReduceMotion = useReducedMotion();
<motion.div
  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : FULL_DISTANCE_PX }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: shouldReduceMotion ? REDUCED_DURATION_S : FULL_DURATION_S }}
/>
```

`MotionConfig reducedMotion="user"` automatically disables transform/layout animations when reduced motion is preferred. Opacity and color animations still work.

See [examples/core.md](examples/core.md) Pattern 5 for complete accessible animation component.

---

### Pattern 10: v12 Features

**usePageInView** (v12.19+): Detect when page/tab is visible to pause animations or videos in background tabs. Returns `boolean`, defaults to `true` on server.

```typescript
import { usePageInView } from "motion/react";
const isPageVisible = usePageInView();
```

**Enhanced stagger()** (v12+): Pass `stagger()` to `delayChildren` in variants for `from` and `ease` options.

```typescript
import { stagger } from "motion/react";

// stagger() is passed to delayChildren, NOT staggerChildren
const transition = {
  delayChildren: stagger(0.05, { from: "center", ease: "easeOut" }),
};
// from options: "first" (default), "center", "last", or number (index)
```

**Drag Controls** (v12+): `useDragControls` gains `.stop()` and `.cancel()` methods.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Missing AnimatePresence for exit animations - exit prop has no effect without it
- Missing unique key on AnimatePresence children - cannot track elements
- Animating layout-triggering properties (height, width, top, left, margin, padding) - use transform (x, y, scale) instead
- Magic numbers for timing values - all durations, delays, distances must be named constants
- Ignoring reduced motion - always use `MotionConfig reducedMotion="user"` or `useReducedMotion`

**Medium Priority Issues:**

- Using index as key in animated lists - causes incorrect animations when list changes
- Missing `layout="position"` on children during parent layout animation - children will distort
- Overusing `willChange` - creates GPU layers; Motion handles optimization automatically
- Not cleaning up `useAnimation` in useEffect - can cause memory leaks

**Gotchas & Edge Cases:**

- `layoutId` is global - use LayoutGroup with id prop to scope to component instances
- `AnimatePresence mode="wait"` blocks enter until exit completes - may cause perceived delay
- `whileInView` uses `viewport` not `offset` for configuration (unlike `useScroll`)
- SVG animations require `motion.path`, `motion.circle`, etc. - regular SVG elements won't animate
- `useInView` returns `false` on server - default to visible state for SSR
- Motion values don't trigger re-renders (by design) - use `useMotionValueEvent` for side effects
- React Fragments inside AnimatePresence break tracking - each direct child must have a key
- `drag` with `layout` can conflict - disable layout during drag or use `dragListener`
- Spring animations can overshoot - high stiffness + low damping; test with real content
- v12 `stagger()` goes on `delayChildren`, not `staggerChildren` - they serve different purposes

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST wrap exiting components in AnimatePresence for exit animations to work)**

**(You MUST provide unique `key` prop to direct children of AnimatePresence)**

**(You MUST animate transform properties (x, y, scale, rotate, opacity) for GPU-accelerated performance)**

**(You MUST respect reduced motion preferences using MotionConfig or useReducedMotion)**

**(You MUST use named constants for all animation timing values - NO magic numbers)**

**Failure to follow these rules will break exit animations, cause performance issues, and create inaccessible experiences.**

</critical_reminders>
