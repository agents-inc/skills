---
name: web-animation-framer-motion
description: Motion (formerly Framer Motion) patterns - motion components, variants, AnimatePresence, gestures, layout animations, scroll-linked motion, reduced-motion handling
---

# Motion Animation Patterns

> **Quick Guide:** `motion.*` components take `initial`, `animate`, `exit` and `transition` props;
> variants lift those states into named sets a parent can orchestrate; `AnimatePresence` is what
> keeps a removed component mounted long enough to animate out; `layout` and `layoutId` run FLIP
> animations over layout changes; `useScroll` and `useInView` drive motion from scroll position.
> Animate `x`, `y`, `scale`, `rotate` and `opacity`, and set `MotionConfig reducedMotion="user"` at
> the root.

> **Import:** `import { motion } from "motion/react"` — the package was renamed from `framer-motion`
> at v11.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — motion components, variants, AnimatePresence, gestures, reduced motion
- [examples/layout.md](examples/layout.md) — `layout`, `layoutId`, expandable cards, tab indicators
- [examples/scroll.md](examples/scroll.md) — scroll progress, reveal on view, parallax
- [examples/sequences.md](examples/sequences.md) — `useAnimation` chains, keyframe arrays, `stagger()` shaping
- [examples/svg.md](examples/svg.md) — `pathLength` drawing effects
- [reference.md](reference.md) — v11/v12 migration, transition presets, prop and hook tables

---

## Which path applies

- **The element enters or leaves the React tree** — the animation needs `AnimatePresence` around it
  and a `key` on it; follow [examples/core.md](examples/core.md).
- **The element stays mounted while its size or position changes** — `layout` measures before and
  after and animates the difference; follow [examples/layout.md](examples/layout.md).
- **The same element appears in two places at different times** — a shared `layoutId` makes one
  travel into the other; follow [examples/layout.md](examples/layout.md).
- **Scroll position drives the value** — `useScroll` with `useTransform`, or `whileInView` for a
  one-shot trigger; follow [examples/scroll.md](examples/scroll.md).
- **Something outside React state triggers the animation** — a timer, a response, an error — then
  `useAnimation` gives the imperative handle; follow [examples/sequences.md](examples/sequences.md).

---

<critical_requirements>

## Before writing Motion code

**Wrap anything that animates on removal in `AnimatePresence`.** React unmounts the node the instant
its condition goes false, so `exit` has nothing left to run against without the wrapper holding the
node in the tree until the animation finishes.

**Give every direct child of `AnimatePresence` a stable, unique `key`.** The key is what
`AnimatePresence` matches the departing element against; an index key re-points to a different item
when the list changes and animates the wrong element out.

**Animate `x`, `y`, `scale`, `rotate` and `opacity`.** Motion writes these to `transform` and
`opacity`, which the compositor owns; `height`, `width` and `marginTop` re-run layout on each frame
instead.

**Set `MotionConfig reducedMotion="user"` at the app root.** Transform and layout animations then
disable themselves for users who asked their OS for reduced motion, while opacity and colour keep
working — so state changes stay legible rather than becoming instant.

</critical_requirements>

---

**Auto-detection:** motion/react, framer-motion, motion.div, AnimatePresence, MotionConfig,
LayoutGroup, LazyMotion, layoutId, whileHover, whileTap, whileDrag, whileInView, useAnimation,
useScroll, useTransform, useMotionValue, useSpring, useInView, usePageInView, useReducedMotion,
useDragControls, staggerChildren, delayChildren, Variants

**Applies to:**

- Enter, exit and presence animation tied to React's mount lifecycle
- Orchestrating several elements from one parent with variants and stagger
- Gesture-driven motion — hover, tap, drag, focus
- Scroll-triggered and scroll-linked effects
- Layout changes and shared-element transitions between containers
- Imperative sequences fired by events React state does not model

**Handled elsewhere:**

- Purely declarative state feedback — a hover colour, a focus ring — where nothing mounts, unmounts
  or moves. The styling layer settles those without a component wrapper
- Frame-level timeline authoring, where the deliverable is a scrubbable timeline rather than a set of
  component states
- Whole-document view swaps where the browser composites an outgoing and incoming page together

---

<philosophy>

Motion animates state rather than time. A component declares what it looks like in each state, and
Motion works out the interpolation, the interruption and the velocity carried across it — which is
why a spring interrupted mid-flight continues from where it was rather than restarting.

</philosophy>

---

<decision_framework>

## When Motion earns its place

Motion is worth the component wrapper and the bundle when at least one is true:

- The element is being **removed** from the tree and must animate before it goes
- The **from** value is measured rather than authored — a layout change, a drag release, an
  interrupted spring
- Several elements must be **orchestrated** from one trigger, with stagger and reverse-on-exit
- The animated value is **derived from a continuous input** such as scroll progress

None of those true means the motion is a state change with both ends known in advance, which needs no
runtime.

## Variants or direct props

Reach for variants once more than one element shares the animation, or once the parent needs to
control child timing — `staggerChildren` and `delayChildren` only exist on the variant path, and
children inherit the parent's variant name without being passed anything. A single element with two
states is clearer with `initial`/`animate` written inline.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Motion Components

Any HTML or SVG tag prefixed with `motion.` accepts `initial`, `animate`, `exit` and `transition`.

```typescript
import { motion } from "motion/react";

export const FadeIn = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);
```

`y` compiles to a transform; `marginTop` or `top` would relayout each frame.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Variants for Orchestration

Variants name animation states so a parent can drive its children by name and control their timing.

```typescript
import { motion, type Variants } from "motion/react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
```

Children inherit the parent's current variant name, so the item elements carry no `animate` prop of
their own. `staggerDirection: -1` reverses the cascade on exit, so a list unwinds from the bottom.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: AnimatePresence

Keeps a removed component in the tree until its `exit` animation finishes.

```typescript
import { AnimatePresence, motion } from "motion/react";

<AnimatePresence>
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    />
  )}
</AnimatePresence>
```

`mode="sync"` (default) overlaps the exit and the enter; `mode="wait"` holds the enter until the exit
finishes, which is what page transitions want; `mode="popLayout"` takes the exiting element out of
flow so the remaining siblings animate into place.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Gestures

`whileHover`, `whileTap`, `whileFocus` and `whileDrag` describe a state that holds for the duration
of the gesture and unwinds when it ends.

```typescript
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
/>
```

Drag adds `drag`, `dragConstraints` (a ref or a pixel box), `dragElastic` for resistance past the
bounds, and `useDragControls` when something other than the element itself starts the drag.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Layout Animations

`layout` measures the element before and after a React commit and animates the difference, so a
change to flex order, grid placement or content size animates without any from-value being authored.

```typescript
<motion.div layout transition={LAYOUT_SPRING}>
  <motion.h2 layout="position">Title</motion.h2>
</motion.div>

{activeTab === tab && <motion.div layoutId="indicator" />}
```

`layout="position"` animates a child's position but not its scale, which is what keeps text from
stretching while the parent resizes. `layoutId` matches two elements that are never mounted at once
and animates one into the other; the id is global, so `LayoutGroup id={...}` scopes it when the
component can appear more than once on a page.

Full code: [examples/layout.md](examples/layout.md)

---

### Pattern 6: Scroll-Driven Motion

`whileInView` fires once on entry; `useScroll` with `useTransform` maps continuous scroll progress
onto a value.

```typescript
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
/>;

const { scrollYProgress } = useScroll({
  target: ref,
  offset: ["start end", "end start"],
});
const y = useTransform(scrollYProgress, [0, 1], [-100, 100]);
```

The value returned by `useScroll` is a motion value, which updates outside React — no re-render runs
per scroll frame.

Full code: [examples/scroll.md](examples/scroll.md)

---

### Pattern 7: Spring and Tween Transitions

```typescript
// Springs: physics, no fixed duration, survive interruption
const BOUNCY = { type: "spring", stiffness: 300, damping: 10 };
const SNAPPY = { type: "spring", stiffness: 500, damping: 30 };

// Tweens: fixed duration and curve
const ENTER = { type: "tween", ease: "easeOut", duration: 0.3 };
const EXIT = { type: "tween", ease: "easeIn", duration: 0.2 };
```

Springs suit anything a user can interrupt — buttons, cards, drags — because velocity carries across
the interruption. Tweens suit motion that has to finish in a known time, such as a modal or a page
change coordinated with something else.

Presets: [reference.md](reference.md)

---

### Pattern 8: Imperative Control with useAnimation

For animations triggered by something React state does not represent — a timer, a response, an
error.

```typescript
const controls = useAnimation();

useEffect(() => {
  if (hasError) {
    controls.start({ x: [0, -10, 10, -10, 0], transition: { duration: 0.3 } });
  }
}, [hasError, controls]);

<motion.div animate={controls}>{children}</motion.div>;
```

Passing an array to `controls.start` runs the steps in sequence, each awaiting the last.

Full code: [examples/sequences.md](examples/sequences.md)

---

### Pattern 9: Reduced Motion

```typescript
// Whole app
<MotionConfig reducedMotion="user">{children}</MotionConfig>

// One component, where the reduced form is different rather than absent
const shouldReduceMotion = useReducedMotion();
<motion.div
  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 50 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: shouldReduceMotion ? 0.2 : 0.5 }}
/>
```

`reducedMotion="user"` disables transform and layout animation while leaving opacity and colour
alone, so the app still shows that something changed. Reach for `useReducedMotion` when the reduced
form needs its own values rather than the transform simply being dropped.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 10: Stagger Shaping and Tab Visibility

`stagger()` (v12+) goes on `delayChildren`, not `staggerChildren` — it returns a function that
computes each child's delay, which is what lets the cascade start from the centre or run to an
easing curve.

```typescript
import { stagger, usePageInView } from "motion/react";

const transition = {
  delayChildren: stagger(0.05, { from: "center", ease: "easeOut" }),
};
// from: "first" (default) | "center" | "last" | an index

const isPageVisible = usePageInView(); // v12.19+, true on the server
```

`usePageInView` reports tab visibility, which is what a looping animation should be gated on so it
stops burning frames in a background tab.

Full code: [examples/sequences.md](examples/sequences.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `exit` on a component with no `AnimatePresence` above it — React removes the node first and the
  prop never runs — wrap the conditional
- A React Fragment as the direct child of `AnimatePresence` — fragments take no `key`, so nothing is
  tracked and every exit is skipped — give each element its own keyed conditional
- `key={index}` on animated list children — the key re-points to a different item on insert or sort,
  and the wrong element animates out — key by a stable id
- Animating `height`, `width`, `top`, `left`, `margin` or `padding` — relayouts each frame — animate
  `scale` and `x`/`y`, with `transformOrigin` set where the growth should start
- A parent with `layout` whose text children lack `layout="position"` — the children scale with the
  box and the type visibly stretches — add the prop to each child
- No reduced-motion handling — full-travel motion reaches users who asked their OS for none — set
  `MotionConfig reducedMotion="user"` at the root

**Surprising behaviour:**

- `layoutId` is global, so two instances of the same component on one page fight over it — scope them
  with `LayoutGroup id={...}`
- `mode="wait"` serialises exit and enter, so the perceived delay is the sum of both durations
- `whileInView` is configured by `viewport`, while `useScroll` is configured by `offset` — the two
  prop names are not interchangeable
- Only `motion.path`, `motion.circle` and their siblings animate; a plain `<path>` inside a
  `motion.svg` is inert
- `useInView` returns `false` during server rendering, so the server markup is the hidden state
  unless the initial state is set to visible
- Motion values deliberately do not re-render — read them through `useMotionValueEvent` when a side
  effect has to run
- `drag` and `layout` on one element contest the same transform; disable layout during the drag
- A spring with high stiffness and low damping overshoots far enough to clip real content, which a
  short placeholder string will not reveal
- `willChange` set by hand competes with Motion's own layer management, which already promotes what
  it is animating

</red_flags>
