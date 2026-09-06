# Motion - SVG Animation Examples

> Path drawing, continuing the numbering from [core.md](core.md).

---

## Pattern 14: Path Drawing with pathLength

### Good Example - Animated Checkmark

```typescript
import { motion } from "motion/react";

const DRAW_DURATION_S = 0.3;
const CIRCLE_DURATION_S = 0.2;

const pathVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: DRAW_DURATION_S, ease: "easeOut" },
      opacity: { duration: CIRCLE_DURATION_S },
    },
  },
};

type AnimatedCheckProps = {
  isVisible: boolean;
  size?: number;
  className?: string;
};

export const AnimatedCheck = ({
  isVisible,
  size = 24,
  className,
}: AnimatedCheckProps) => {
  return (
    <motion.svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      aria-hidden={!isVisible}
    >
      <motion.circle cx="12" cy="12" r="10" variants={pathVariants} />
      <motion.path d="M9 12l2 2 4-4" variants={pathVariants} />
    </motion.svg>
  );
};
```

**Why good:** `pathLength` is normalised to 0–1 regardless of the path's real length, so the circle
and the tick draw over the same span without either being measured. Both shapes are `motion.*`
elements — a plain `<path>` here would appear instantly while its sibling drew. Per-property
transitions let the opacity settle faster than the stroke, so the shape is visible while it draws.
