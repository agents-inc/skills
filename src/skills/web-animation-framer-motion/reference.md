# Motion Reference

> Decision frameworks, anti-patterns, and quick reference for Motion (formerly Framer Motion) development. See [SKILL.md](SKILL.md) for core concepts and red flags, and [examples/](examples/) for code examples.

---

## v11/v12 Migration Guide

### Package Rename (CRITICAL - v11+)

The package has been renamed from `framer-motion` to `motion`:

```bash
npm uninstall framer-motion
npm install motion
```

Update imports:

```typescript
// Old (framer-motion)
import { motion } from "framer-motion";

// New (motion v11+)
import { motion } from "motion/react";
```

### Breaking Changes in v11

#### Render Scheduling

Motion component renders moved from synchronous to microtask scheduling. Update tests accordingly:

```typescript
// Before v11 - synchronous
render(<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />);
expect(element).toHaveStyle("opacity: 1");

// v11+ - await animation frame
import { frame } from "motion";

async function nextFrame() {
  return new Promise<void>((resolve) => {
    frame.postRender(() => resolve());
  });
}

render(<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />);
await nextFrame();
expect(element).toHaveStyle("opacity: 1");
```

#### Velocity Calculation

Velocity is now calculated based on the value at end of previous frame, not intermediate synchronous updates:

```typescript
// v11+ behavior
const x = motionValue(0);

requestAnimationFrame(() => {
  x.set(100);
  x.getVelocity(); // Velocity of 0 -> 100
  x.set(200);
  x.getVelocity(); // Velocity of 0 -> 200 (not 100 -> 200)
});
```

#### Removed APIs

- `glide` function removed - use `type: "inertia"` instead:

```typescript
// Old
animate(element, { x: 100 }, { type: "glide" });

// New
animate(element, { x: 100 }, { type: "inertia" });
```

### New in v12

**No breaking changes in v12 for React.** New features include:

- **usePageInView** (v12.19+): Pause animations when tab is in background
- **Enhanced stagger()**: Now accepts `from` ("first", "center", "last", index) and `ease` options
- **resize()** (v12.16+): New function for resize-linked animations
- **useDragControls.stop()/cancel()**: Programmatic control over drag operations
- **animateView** (v12.6+): Renamed from `view`, with `interrupt: "wait"` as default

```typescript
// v12 enhanced stagger example
import { stagger } from "motion/react";

const containerVariants = {
  visible: {
    transition: {
      delayChildren: stagger(0.05, {
        from: "center", // Ripple from center
        ease: "easeOut",
      }),
    },
  },
};
```

---

## Decision Framework

### When to Use Motion vs CSS

```
Is this animation triggered by user interaction?
├─ YES → Is it complex (multi-step, physics-based)?
│   ├─ YES → Use Motion ✓
│   └─ NO → Is it hover/focus only?
│       ├─ YES → CSS transitions work fine
│       └─ NO → Use Motion for consistency
└─ NO → Is it a simple infinite loop (pulse, spin)?
    ├─ YES → CSS animation is sufficient
    └─ NO → Does it need to animate on mount/unmount?
        ├─ YES → Use Motion (AnimatePresence) ✓
        └─ NO → Either works, prefer consistency
```

### When to Use Variants vs Direct Props

```
Are you animating multiple elements together?
├─ YES → Do they need coordinated timing (stagger)?
│   ├─ YES → Use variants with staggerChildren ✓
│   └─ NO → Do they share animation states?
│       ├─ YES → Use variants for reusability ✓
│       └─ NO → Direct props are fine
└─ NO → Is the animation complex (many properties)?
    ├─ YES → Variants improve readability
    └─ NO → Direct props are simpler
```

### When to Use Spring vs Tween

```
What type of motion do you want?
├─ Natural, physics-based bounce → Use spring ✓
├─ Precise timing control → Use tween
├─ Interactive element feedback → Use spring ✓
└─ UI transitions (modals, pages) → Use tween with easing
```

### When to Use layout vs layoutId

```
What are you animating?
├─ Single element changing size/position → Use layout ✓
├─ Element moving between containers → Use layoutId ✓
├─ List reordering → Use layout on items ✓
└─ Shared element between routes → Use layoutId ✓
```

### When to Use useAnimation vs Declarative

```
How is the animation triggered?
├─ React state change → Declarative (animate prop) ✓
├─ External event (timer, API response) → useAnimation ✓
├─ Complex sequence/chain → useAnimation ✓
└─ User gesture → Gesture props (whileHover, etc.) ✓
```

### When to Use AnimatePresence Modes

```
What's the transition behavior?
├─ Elements should animate simultaneously → mode="sync" (default)
├─ New element waits for old to exit → mode="wait" ✓
│   └─ Best for: page transitions, modals
├─ Layout should animate during exit → mode="popLayout" ✓
│   └─ Best for: shared layout transitions
```

---

## Transition Type Reference

### Spring Configuration

```typescript
// Bouncy - playful, attention-grabbing
const BOUNCY_SPRING = { type: "spring", stiffness: 300, damping: 10 };

// Snappy - responsive, professional
const SNAPPY_SPRING = { type: "spring", stiffness: 500, damping: 30 };

// Gentle - subtle, elegant
const GENTLE_SPRING = { type: "spring", stiffness: 100, damping: 20 };

// No bounce - smooth stop
const NO_BOUNCE_SPRING = { type: "spring", stiffness: 300, damping: 30 };
```

### Tween Easing Reference

```typescript
// Enter animations - ease out (fast start, slow end)
const ENTER_EASE = { type: "tween", ease: "easeOut", duration: 0.3 };

// Exit animations - ease in (slow start, fast end)
const EXIT_EASE = { type: "tween", ease: "easeIn", duration: 0.2 };

// Symmetric - ease in-out
const SYMMETRIC_EASE = { type: "tween", ease: "easeInOut", duration: 0.3 };

// Custom cubic bezier - Material Design style
const MATERIAL_EASE = { type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.3 };
```

---

## Anti-Patterns

### Animating Layout-Triggering Properties

Animating properties that trigger layout recalculations causes jank on every frame.

```typescript
// WRONG - triggers layout on every frame
<motion.div
  initial={{ height: 0, marginTop: 20 }}
  animate={{ height: 100, marginTop: 0 }}
/>

// CORRECT - GPU-accelerated transform
<motion.div
  initial={{ scaleY: 0, y: 20 }}
  animate={{ scaleY: 1, y: 0 }}
  style={{ transformOrigin: "top" }}
/>
```

### Missing Keys on AnimatePresence Children

AnimatePresence tracks components by key. Missing or unstable keys break exit animations.

```typescript
// WRONG - index changes when list changes
<AnimatePresence>
  {items.map((item, index) => (
    <motion.div key={index} exit={{ opacity: 0 }}>
      {item.name}
    </motion.div>
  ))}
</AnimatePresence>

// CORRECT - stable unique ID
<AnimatePresence>
  {items.map((item) => (
    <motion.div key={item.id} exit={{ opacity: 0 }}>
      {item.name}
    </motion.div>
  ))}
</AnimatePresence>
```

### Fragments Inside AnimatePresence

React fragments break AnimatePresence tracking because they don't support keys.

```typescript
// WRONG - fragment has no key
<AnimatePresence>
  {isOpen && (
    <>
      <motion.div exit={{ opacity: 0 }}>Backdrop</motion.div>
      <motion.div exit={{ opacity: 0 }}>Modal</motion.div>
    </>
  )}
</AnimatePresence>

// CORRECT - keyed motion components
<AnimatePresence>
  {isOpen && (
    <motion.div key="backdrop" exit={{ opacity: 0 }}>Backdrop</motion.div>
  )}
  {isOpen && (
    <motion.div key="modal" exit={{ opacity: 0 }}>Modal</motion.div>
  )}
</AnimatePresence>
```

### Magic Numbers in Transitions

Magic numbers make animations hard to maintain and adjust consistently.

```typescript
// WRONG - magic numbers everywhere
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, delay: 0.1 }}
/>

// CORRECT - named constants
const FADE_DURATION_S = 0.3;
const FADE_DELAY_S = 0.1;
const FADE_DISTANCE_PX = 20;

<motion.div
  initial={{ opacity: 0, y: FADE_DISTANCE_PX }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: FADE_DURATION_S, delay: FADE_DELAY_S }}
/>
```

### Ignoring Reduced Motion

Animations can cause motion sickness. Always provide reduced motion support.

```typescript
// WRONG - no reduced motion support
<motion.div
  initial={{ x: -100, rotate: 360 }}
  animate={{ x: 0, rotate: 0 }}
/>

// CORRECT - respects user preferences
const shouldReduceMotion = useReducedMotion();

<motion.div
  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -100 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: shouldReduceMotion ? 0.2 : 0.5 }}
/>
```

### Overusing willChange

willChange creates GPU layers. Too many layers waste memory and can hurt performance.

```typescript
// WRONG - willChange on every element
{items.map((item) => (
  <motion.div
    key={item.id}
    style={{ willChange: "transform" }}  // Creates layer for every item
    whileHover={{ scale: 1.05 }}
  />
))}

// CORRECT - only when needed, typically handled by Motion automatically
{items.map((item) => (
  <motion.div
    key={item.id}
    whileHover={{ scale: 1.05 }}  // Motion handles optimization
  />
))}
```

---

## Performance Checklist

### Properties to Animate (GPU-Accelerated)

- `opacity` - Always safe
- `x`, `y` - Transform translate
- `scale`, `scaleX`, `scaleY` - Transform scale
- `rotate`, `rotateX`, `rotateY`, `rotateZ` - Transform rotate
- `skew`, `skewX`, `skewY` - Transform skew

### Properties to Avoid Animating

- `width`, `height` - Use scale instead
- `top`, `left`, `right`, `bottom` - Use x, y instead
- `margin`, `padding` - Use transform or change layout
- `border-width` - Triggers layout
- `box-shadow` - Use filter: drop-shadow() instead
- `border-radius` - Use clipPath: inset() instead

### Optimization Techniques

```typescript
// Use motion values to avoid React re-renders
const x = useMotionValue(0);
const scale = useTransform(x, [0, 100], [1, 1.5]);

// Lazy load off-screen animations
<motion.div
  initial={false}  // Skip initial animation
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
/>

// Use layout="position" on children to prevent distortion
<motion.div layout>
  <motion.h2 layout="position">Title</motion.h2>
  <motion.p layout="position">Content</motion.p>
</motion.div>
```

---

## Quick Reference

### Essential Props

| Prop          | Purpose          | Example                                        |
| ------------- | ---------------- | ---------------------------------------------- |
| `initial`     | Starting state   | `initial={{ opacity: 0 }}`                     |
| `animate`     | Target state     | `animate={{ opacity: 1 }}`                     |
| `exit`        | Exit state       | `exit={{ opacity: 0 }}`                        |
| `transition`  | Animation config | `transition={{ duration: 0.3 }}`               |
| `variants`    | Named states     | `variants={{ hidden: {...}, visible: {...} }}` |
| `whileHover`  | Hover state      | `whileHover={{ scale: 1.05 }}`                 |
| `whileTap`    | Press state      | `whileTap={{ scale: 0.95 }}`                   |
| `whileDrag`   | Drag state       | `whileDrag={{ scale: 1.1 }}`                   |
| `whileInView` | In viewport      | `whileInView={{ opacity: 1 }}`                 |
| `layout`      | Layout animation | `layout` or `layout="position"`                |
| `layoutId`    | Shared element   | `layoutId="unique-id"`                         |
| `drag`        | Enable dragging  | `drag` or `drag="x"`                           |

### Essential Hooks

| Hook               | Purpose                  | Returns                                                |
| ------------------ | ------------------------ | ------------------------------------------------------ |
| `useAnimation`     | Imperative control       | AnimationControls                                      |
| `useMotionValue`   | Non-reactive value       | MotionValue                                            |
| `useTransform`     | Derived value            | MotionValue                                            |
| `useSpring`        | Springy value            | MotionValue                                            |
| `useScroll`        | Scroll position          | { scrollX, scrollY, scrollXProgress, scrollYProgress } |
| `useInView`        | Visibility               | boolean                                                |
| `usePageInView`    | Tab visibility (v12.19+) | boolean                                                |
| `useReducedMotion` | Accessibility            | boolean \| null                                        |
| `useDragControls`  | Programmatic drag        | DragControls (with .stop()/.cancel() in v12)           |

### Essential Components

| Component         | Purpose                   |
| ----------------- | ------------------------- |
| `motion.*`        | Animatable element        |
| `AnimatePresence` | Exit animation wrapper    |
| `LayoutGroup`     | Scope layoutId            |
| `MotionConfig`    | Global configuration      |
| `LazyMotion`      | Tree-shaking optimization |

---

## Accessibility Checklist

- [ ] Uses MotionConfig reducedMotion="user" at app root
- [ ] Complex animations have useReducedMotion fallback
- [ ] Decorative animations have aria-hidden="true"
- [ ] Interactive elements maintain keyboard accessibility
- [ ] Motion doesn't interfere with screen reader announcements
- [ ] Auto-playing animations can be paused
- [ ] Large-scale motion respects prefers-reduced-motion
