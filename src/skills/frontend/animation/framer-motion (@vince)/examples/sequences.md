# Animation Sequences

> Complex animation sequences using useAnimation and keyframes. See [core.md](core.md) for basic patterns.

> **Import Note:** Examples show `from "framer-motion"` for compatibility. For v11+, use `from "motion/react"` instead.

---

## Multi-Step Animation with useAnimation

### Good Example - Notification Badge Sequence

```typescript
import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";

const STEP_DURATION_S = 0.3;
const BOUNCE_SCALE = 1.2;
const SHAKE_DISTANCE_PX = 5;

type NotificationBadgeProps = {
  count: number;
  className?: string;
};

export const NotificationBadge = ({ count, className }: NotificationBadgeProps) => {
  const controls = useAnimation();

  useEffect(() => {
    if (count > 0) {
      // Sequence: scale up, shake, settle
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

**Why good:** Sequenced animations create attention-grabbing effect, aria-live announces changes to screen readers, effect triggers on count change

---

## Keyframe Animations

### Good Example - Pulsing Indicator

```typescript
import { motion } from "framer-motion";

const PULSE_DURATION_S = 2;
const PULSE_MIN_SCALE = 0.9;
const PULSE_MAX_SCALE = 1.1;

type PulsingDotProps = {
  color?: string;
  className?: string;
};

export const PulsingDot = ({ color = "currentColor", className }: PulsingDotProps) => {
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

**Why good:** Keyframe arrays create smooth loop, repeat: Infinity for continuous animation, aria-hidden for decorative element
