# Motion - Sequence Examples

> Imperative sequences and keyframe arrays, continuing the numbering from [core.md](core.md).

---

## Pattern 11: Multi-Step Sequence with useAnimation

### Good Example - Notification Badge

```typescript
import { motion, useAnimation } from "motion/react";
import { useEffect } from "react";

const STEP_DURATION_S = 0.3;
const BOUNCE_SCALE = 1.2;
const SHAKE_DISTANCE_PX = 5;

type NotificationBadgeProps = {
  count: number;
  className?: string;
};

export const NotificationBadge = ({
  count,
  className,
}: NotificationBadgeProps) => {
  const controls = useAnimation();

  useEffect(() => {
    if (count > 0) {
      controls.start([
        { scale: BOUNCE_SCALE, transition: { duration: STEP_DURATION_S / 2 } },
        {
          x: [0, -SHAKE_DISTANCE_PX, SHAKE_DISTANCE_PX, -SHAKE_DISTANCE_PX, 0],
          transition: { duration: STEP_DURATION_S },
        },
        { scale: 1, transition: { duration: STEP_DURATION_S / 2 } },
      ]);
    }
  }, [count, controls]);

  return (
    <motion.span
      className={className}
      animate={controls}
      aria-live="polite"
      aria-atomic="true"
    >
      {count}
    </motion.span>
  );
};
```

**Why good:** An array passed to `controls.start` runs the steps in order, each awaiting the last —
the same sequence written as three `animate` props would run all at once. `aria-live` carries the
change to a screen reader, which the motion cannot.

---

## Pattern 12: Keyframe Arrays

### Good Example - Pulsing Indicator

```typescript
import { motion } from "motion/react";

const PULSE_DURATION_S = 2;
const PULSE_MIN_SCALE = 0.9;
const PULSE_MAX_SCALE = 1.1;

type PulsingDotProps = {
  color?: string;
  className?: string;
};

export const PulsingDot = ({
  color = "currentColor",
  className,
}: PulsingDotProps) => {
  return (
    <motion.span
      className={className}
      animate={{
        scale: [PULSE_MIN_SCALE, PULSE_MAX_SCALE, PULSE_MIN_SCALE],
        opacity: [0.7, 1, 0.7],
      }}
      transition={{
        duration: PULSE_DURATION_S,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
      }}
      aria-hidden="true"
    />
  );
};
```

**Why good:** The array starts and ends on the same value, which is what hides the seam when
`repeat: Infinity` loops it. `aria-hidden` keeps a purely decorative pulse out of the accessibility
tree.

---

## Pattern 13: Stagger Shaping

### Good Example - Ripple from the Centre

```typescript
import { motion, stagger, type Variants } from "motion/react";

const STAGGER_STEP_S = 0.05;

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: stagger(STAGGER_STEP_S, {
        from: "center",
        ease: "easeOut",
      }),
    },
  },
};

const cellVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};
```

**Why good:** `stagger()` belongs on `delayChildren` because it returns a per-child delay function;
`staggerChildren` takes a plain number and has no `from` or `ease` to give. `from: "center"` makes
the cascade read as a ripple out of the middle rather than a sweep from one corner.
