# Motion - Scroll Animation Examples

> Scroll-linked and scroll-triggered motion, continuing the numbering from [core.md](core.md).

---

## Pattern 8: Scroll Progress Indicator

### Good Example - Page Progress Bar

```typescript
import { motion, useScroll, useSpring } from "motion/react";

const PROGRESS_SPRING = { stiffness: 100, damping: 30, restDelta: 0.001 };
const PROGRESS_HEIGHT_PX = 4;

export const ScrollProgressBar = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, PROGRESS_SPRING);

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: PROGRESS_HEIGHT_PX,
        background: "currentColor",
        transformOrigin: "0%",
        scaleX,
      }}
      aria-hidden="true"
    />
  );
};
```

**Why good:** `scaleX` is handed a motion value directly, so the bar updates outside React and no
render runs per scroll frame. `useSpring` smooths the discrete scroll steps a trackpad produces, and
`transformOrigin: "0%"` is what makes it grow from the left rather than from the middle.

---

## Pattern 9: Reveal on Entering View

### Good Example - Section Fade

```typescript
import { motion, useInView } from "motion/react";
import { useRef } from "react";

const REVEAL_DURATION_S = 0.6;
const REVEAL_DISTANCE_PX = 40;
const REVEAL_DELAY_S = 0.15;

type SectionRevealProps = {
  children: React.ReactNode;
  className?: string;
};

export const SectionReveal = ({ children, className }: SectionRevealProps) => {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.section
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: REVEAL_DISTANCE_PX }}
      animate={
        isInView
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: REVEAL_DISTANCE_PX }
      }
      transition={{
        duration: REVEAL_DURATION_S,
        delay: REVEAL_DELAY_S,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      {children}
    </motion.section>
  );
};
```

**Why good:** `once: true` stops the section re-animating every time it scrolls back into view, which
otherwise makes a long page feel unstable. The negative margin shrinks the trigger area so the reveal
starts before the element is fully on screen and is settled by the time it is read.

---

## Pattern 10: Parallax

### Good Example - Image Drifting Against the Scroll

```typescript
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

type ParallaxImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export const ParallaxImage = ({ src, alt, className }: ParallaxImageProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);

  return (
    <div ref={ref} style={{ overflow: "hidden" }} className={className}>
      <motion.img src={src} alt={alt} style={{ y, scale: 1.2 }} />
    </div>
  );
};
```

**Why good:** The `offset` pair tracks the element from entering the viewport to leaving it, so
progress runs 0 to 1 over exactly the window the reader sees it in. `scale: 1.2` gives the drift
somewhere to come from — without the oversize the parallax would expose empty space at one edge, and
`overflow: hidden` is what crops the surplus.
