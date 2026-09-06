# Motion - Core Examples

> Full code for the core patterns. See [SKILL.md](../SKILL.md) for the decisions and
> [reference.md](../reference.md) for migration notes and API tables.

**Related examples:**

- [layout.md](layout.md) — `layout`, `layoutId`, shared elements
- [scroll.md](scroll.md) — scroll progress, reveal, parallax
- [sequences.md](sequences.md) — `useAnimation` chains, keyframe arrays
- [svg.md](svg.md) — `pathLength` drawing

---

## Pattern 1: Motion Components

### Good Example - Fade In with Transform

```typescript
import { motion } from "motion/react";

const FADE_DURATION_S = 0.4;
const FADE_DISTANCE_PX = 20;

type FadeInProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

export const FadeIn = ({ children, delay = 0, className }: FadeInProps) => {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: FADE_DISTANCE_PX }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: FADE_DURATION_S, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};
```

**Why good:** The `delay` prop lets a caller stagger several of these without the component knowing
about its siblings, and `className` keeps the styling decision outside the wrapper.

### Bad Example - Layout on Every Frame

```typescript
export const FadeIn = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, marginTop: 20 }}
      animate={{ opacity: 1, marginTop: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
};
```

**Why bad:** `marginTop` reflows the document on every frame and moves the elements below it as it
animates; `y` moves only the painted element.

---

## Pattern 2: Variants for Lists

### Good Example - Staggered List with Reverse Exit

```typescript
import { motion, type Variants } from "motion/react";

const STAGGER_DELAY_S = 0.08;
const ITEM_DISTANCE_PX = 20;
const CONTAINER_DELAY_S = 0.1;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: CONTAINER_DELAY_S,
      staggerChildren: STAGGER_DELAY_S,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: STAGGER_DELAY_S,
      staggerDirection: -1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -ITEM_DISTANCE_PX },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
  exit: { opacity: 0, x: ITEM_DISTANCE_PX },
};

type ListItem = { id: string; label: string };

type AnimatedListProps = {
  items: ListItem[];
  className?: string;
};

export const AnimatedList = ({ items, className }: AnimatedListProps) => {
  return (
    <motion.ul
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {items.map((item) => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.label}
        </motion.li>
      ))}
    </motion.ul>
  );
};
```

**Why good:** The items carry no `animate` prop — they inherit the variant name from the list, which
is what makes `staggerChildren` possible at all. `staggerDirection: -1` unwinds the list from the
bottom on exit, so the reverse reads as an undo rather than a repeat.

### Bad Example - Per-Item Delays and Index Keys

```typescript
export const AnimatedList = ({ items }) => {
  return (
    <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {items.map((item, index) => (
        <motion.li
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          {item.label}
        </motion.li>
      ))}
    </motion.ul>
  );
};
```

**Why bad:** The index key re-points to a different item whenever the list is sorted or spliced, so
the wrong element animates; and the hand-computed delay is fixed at mount, so an item inserted later
animates with a stale offset.

---

## Pattern 3: AnimatePresence

### Good Example - Modal with Keyed Backdrop

```typescript
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

const MODAL_DURATION_S = 0.25;
const BACKDROP_OPACITY = 0.5;
const MODAL_SCALE_HIDDEN = 0.96;

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: BACKDROP_OPACITY }}
          exit={{ opacity: 0 }}
          transition={{ duration: MODAL_DURATION_S }}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "black" }}
          aria-hidden="true"
        />
      )}
      {isOpen && (
        <motion.div
          key="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          initial={{ opacity: 0, scale: MODAL_SCALE_HIDDEN, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: MODAL_SCALE_HIDDEN, y: 10 }}
          transition={{ duration: MODAL_DURATION_S, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <h2 id="modal-title">{title}</h2>
          {children}
          <button onClick={onClose} aria-label="Close modal">
            Close
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

**Why good:** Two sibling conditionals rather than one wrapping both elements — each is a keyed
direct child, which is what `AnimatePresence` tracks.

### Bad Example - Fragment Wrapper

```typescript
<AnimatePresence>
  {isOpen && (
    <>
      <motion.div exit={{ opacity: 0 }}>Backdrop</motion.div>
      <motion.div exit={{ opacity: 0 }}>Modal</motion.div>
    </>
  )}
</AnimatePresence>
```

**Why bad:** The fragment is the direct child and takes no key, so nothing is tracked and both exits
are skipped — the modal disappears instantly while looking correct on the way in.

### Good Example - Page Transitions with mode="wait"

```typescript
import { AnimatePresence, motion } from "motion/react";

const PAGE_DURATION_S = 0.3;
const PAGE_DISTANCE_PX = 20;

const pageVariants = {
  initial: { opacity: 0, x: PAGE_DISTANCE_PX },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -PAGE_DISTANCE_PX },
};

const pageTransition = { duration: PAGE_DURATION_S, ease: "easeInOut" };

type PageWrapperProps = {
  pageKey: string;
  children: React.ReactNode;
};

export const PageWrapper = ({ pageKey, children }: PageWrapperProps) => {
  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={pageKey}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
};
```

**Why good:** The changing `key` is what makes one page an exit and the next an enter; `mode="wait"`
stops the two overlapping, which would otherwise show both pages' content at once.

---

## Pattern 4: Gestures

### Good Example - Interactive Card

```typescript
import { motion } from "motion/react";

const HOVER_Y_PX = -8;
const TAP_SCALE = 0.98;
const CARD_SPRING = { type: "spring" as const, stiffness: 400, damping: 25 };

type CardProps = {
  title: string;
  description: string;
  onClick?: () => void;
  className?: string;
};

export const InteractiveCard = ({
  title,
  description,
  onClick,
  className,
}: CardProps) => {
  return (
    <motion.article
      className={className}
      whileHover={{ y: HOVER_Y_PX }}
      whileTap={{ scale: TAP_SCALE }}
      transition={CARD_SPRING}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <h3>{title}</h3>
      <p>{description}</p>
    </motion.article>
  );
};
```

**Why good:** A gesture prop makes the element look interactive without making it operable — the
role, `tabIndex` and key handler are what a keyboard user needs, and they are applied only when a
handler exists.

### Good Example - Drag Bounded by a Parent

```typescript
import { motion, useDragControls } from "motion/react";
import { useRef } from "react";

const DRAG_ELASTIC = 0.1;
const DRAG_SCALE = 1.05;
const DRAG_SPRING = { type: "spring" as const, damping: 20 };

type DraggableItemProps = {
  children: React.ReactNode;
  className?: string;
};

export const DraggableItem = ({ children, className }: DraggableItemProps) => {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  return (
    <div ref={constraintsRef} style={{ overflow: "hidden" }}>
      <motion.div
        className={className}
        drag
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragElastic={DRAG_ELASTIC}
        whileDrag={{ scale: DRAG_SCALE, cursor: "grabbing" }}
        transition={DRAG_SPRING}
      >
        {children}
      </motion.div>
    </div>
  );
};
```

**Why good:** `dragElastic` at 0.1 lets the element travel slightly past the bounds and spring back,
which reads as a boundary rather than as a stuck element.

---

## Pattern 5: Reduced Motion

### Good Example - Reduced Form With Its Own Values

```typescript
import { motion, useReducedMotion, type Variants } from "motion/react";

const FULL_DISTANCE_PX = 30;
const FULL_DURATION_S = 0.5;
const REDUCED_DURATION_S = 0.2;

type FadeInMotionProps = {
  children: React.ReactNode;
  className?: string;
};

export const FadeInMotion = ({ children, className }: FadeInMotionProps) => {
  const shouldReduceMotion = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : FULL_DISTANCE_PX },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
      transition={{
        duration: shouldReduceMotion ? REDUCED_DURATION_S : FULL_DURATION_S,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
};
```

**Why good:** Drops the travel and shortens the fade rather than removing the animation, so the
element still reads as arriving. `MotionConfig reducedMotion="user"` covers the common case; this
shape is for when the reduced form needs different values rather than no transform.
