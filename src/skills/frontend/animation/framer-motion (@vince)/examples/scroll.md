# Scroll Animations

> Scroll-linked animations including progress bars, reveal effects, and parallax. See [core.md](core.md) for basic patterns.

---

## Scroll Progress Indicator

### Good Example - Page Progress Bar

```typescript
import { motion, useScroll, useSpring } from "framer-motion";

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

**Why good:** useSpring smooths scroll progress, scaleX is GPU-accelerated, transformOrigin ensures correct anchor, aria-hidden for decorative element

---

## Section Reveal on Scroll

### Good Example - Fade In When Visible

```typescript
import { motion, useInView } from "framer-motion";
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
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: REVEAL_DISTANCE_PX }}
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

**Why good:** useInView with once: true prevents re-animation, negative margin triggers before element is fully visible, custom easing for polish

---

## Parallax Effect

### Good Example - Parallax Image Container

```typescript
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const PARALLAX_SPEED_FACTOR = 0.5;

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

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    ["-20%", "20%"]
  );

  return (
    <div ref={ref} style={{ overflow: "hidden" }} className={className}>
      <motion.img
        src={src}
        alt={alt}
        style={{
          y,
          scale: 1.2,
        }}
      />
    </div>
  );
};
```

**Why good:** overflow: hidden contains the parallax movement, scale: 1.2 prevents gaps at edges, offset tracks element through viewport
