# SVG Animations

> SVG path animations and drawing effects. See [core.md](core.md) for basic patterns.

> **Import Note:** Examples show `from "framer-motion"` for compatibility. For v11+, use `from "motion/react"` instead.

---

## Animated Checkmark

### Good Example - Drawing Effect with pathLength

```typescript
import { motion } from "framer-motion";

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

**Why good:** pathLength creates drawing effect, staggered opacity and pathLength for polish, aria-hidden when not visible
