# Motion Reference

> Migration notes, presets and API tables. See [SKILL.md](SKILL.md) for the decisions and the red
> flags, [examples/](examples/) for full code.

---

## v11 / v12 Migration

### Package rename (v11)

```bash
npm uninstall framer-motion
npm install motion
```

```typescript
// before
import { motion } from "framer-motion";

// v11+
import { motion } from "motion/react";
```

### Breaking changes in v11

**Renders are scheduled on a microtask** rather than synchronously. Any code that reads a computed
style straight after mounting a `motion` element now reads the pre-animation value; await a frame
first, using Motion's own scheduler:

```typescript
import { frame } from "motion";

const nextFrame = () =>
  new Promise<void>((resolve) => frame.postRender(() => resolve()));
```

**Velocity is measured against the previous frame's value**, not against intermediate synchronous
writes. Two `set` calls inside one frame report the velocity from the frame's start to the last
value, rather than between the two writes.

```typescript
const x = motionValue(0);

requestAnimationFrame(() => {
  x.set(100);
  x.getVelocity(); // 0 -> 100
  x.set(200);
  x.getVelocity(); // 0 -> 200, not 100 -> 200
});
```

**`glide` was removed** — `type: "inertia"` replaces it.

```typescript
animate(element, { x: 100 }, { type: "inertia" });
```

### Added in v12

No breaking changes for React. New surface:

| Addition                             | Since  | What it gives                                           |
| ------------------------------------ | ------ | ------------------------------------------------------- |
| `usePageInView`                      | 12.19+ | Tab visibility, for pausing loops in background tabs    |
| `stagger()` on `delayChildren`       | 12+    | `from` ("first", "center", "last", index) and `ease`    |
| `resize()`                           | 12.16+ | Resize-linked animations                                |
| `useDragControls().stop()/.cancel()` | 12+    | Programmatic end to an in-flight drag                   |
| `animateView`                        | 12.6+  | Renamed from `view`; `interrupt: "wait"` is the default |

---

## Transition Presets

```typescript
// Springs
const BOUNCY_SPRING = { type: "spring", stiffness: 300, damping: 10 };
const SNAPPY_SPRING = { type: "spring", stiffness: 500, damping: 30 };
const GENTLE_SPRING = { type: "spring", stiffness: 100, damping: 20 };
const NO_BOUNCE_SPRING = { type: "spring", stiffness: 300, damping: 30 };

// Tweens
const ENTER_EASE = { type: "tween", ease: "easeOut", duration: 0.3 };
const EXIT_EASE = { type: "tween", ease: "easeIn", duration: 0.2 };
const SYMMETRIC_EASE = { type: "tween", ease: "easeInOut", duration: 0.3 };
const MATERIAL_EASE = { type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.3 };
```

With Motion's default `mass: 1`, a spring stops overshooting once `damping` reaches `2 × √stiffness`.
`GENTLE_SPRING` sits exactly on that line, `NO_BOUNCE_SPRING` just under it, and `BOUNCY_SPRING` far
below — which is why it bounces.

---

## Property Cost

| Animate these                             | Instead of                         |
| ----------------------------------------- | ---------------------------------- |
| `opacity`                                 | —                                  |
| `x`, `y`                                  | `top`, `left`, `right`, `bottom`   |
| `scale`, `scaleX`, `scaleY`               | `width`, `height`                  |
| `rotate`, `rotateX`, `rotateY`, `rotateZ` | —                                  |
| `skew`, `skewX`, `skewY`                  | —                                  |
| `filter: "drop-shadow(...)"`              | `boxShadow`                        |
| `clipPath: "inset(... round ...)"`        | `borderRadius`                     |
| a `layout` animation                      | `margin`, `padding`, `borderWidth` |

### Keeping work off the render path

```typescript
// A motion value updates without re-rendering the component
const x = useMotionValue(0);
const scale = useTransform(x, [0, 100], [1, 1.5]);

// initial={false} skips the mount animation for content already on screen
<motion.div initial={false} whileInView={{ opacity: 1 }} viewport={{ once: true }} />
```

---

## API Tables

### Props

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

### Hooks

| Hook               | Purpose                            | Returns                                                |
| ------------------ | ---------------------------------- | ------------------------------------------------------ |
| `useAnimation`     | Imperative start, stop and chain   | AnimationControls                                      |
| `useMotionValue`   | A value held outside React state   | MotionValue, updated outside React                     |
| `useTransform`     | Map one motion value onto another  | MotionValue derived from another                       |
| `useSpring`        | Spring-smooth another motion value | MotionValue that springs toward its source             |
| `useScroll`        | Scroll position and progress       | { scrollX, scrollY, scrollXProgress, scrollYProgress } |
| `useInView`        | Is the element in the viewport     | boolean (false during server rendering)                |
| `usePageInView`    | Is the tab visible                 | boolean (true during server rendering)                 |
| `useReducedMotion` | Has the user asked for less motion | boolean \| null                                        |
| `useDragControls`  | Start a drag from another element  | DragControls, with `.stop()`/`.cancel()` from v12      |

### Components

| Component         | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `motion.*`        | Animatable element                                 |
| `AnimatePresence` | Holds removed children until `exit` completes      |
| `LayoutGroup`     | Scopes `layoutId` to an instance                   |
| `MotionConfig`    | Defaults for the subtree, including reduced motion |
| `LazyMotion`      | Defers the feature bundle                          |

---

## Accessibility Checklist

- [ ] `MotionConfig reducedMotion="user"` at the app root
- [ ] Components whose reduced form differs from "no transform" use `useReducedMotion`
- [ ] Decorative motion carries `aria-hidden="true"`
- [ ] Elements made interactive by a gesture prop keep a keyboard path and a role
- [ ] Content that changes as a result of motion is announced, not just moved
- [ ] Looping motion is pausable, or gated on tab visibility
