# Framer Motion Examples

> Complete code examples for Framer Motion animation patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**For advanced patterns**: See topic-specific files in this folder:
- [layout.md](layout.md) - Layout animations, shared elements
- [scroll.md](scroll.md) - Scroll progress, reveal, parallax
- [sequences.md](sequences.md) - Complex sequences, keyframes
- [svg.md](svg.md) - SVG path animations

---

## Pattern 1: Basic Motion Components

### Good Example - Fade In with Transform

```typescript
import { motion } from "framer-motion";

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
      transition={{
        duration: FADE_DURATION_S,
        delay,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
};
```

**Why good:** Named constants for timing, className exposed for styling flexibility, delay prop enables staggering, y transform is GPU-accelerated

### Bad Example - Layout-Triggering Animation

```typescript
export const FadeIn = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, marginTop: 20 }}  // Bad: marginTop triggers layout
      animate={{ opacity: 1, marginTop: 0 }}
      transition={{ duration: 0.4 }}            // Bad: magic number
    >
      {children}
    </motion.div>
  );
};
```

**Why bad:** marginTop triggers expensive layout recalculations on every frame, magic number 0.4 is not maintainable, no className prop

---

## Pattern 2: Variants for Lists

### Good Example - Staggered List Animation

```typescript
import { motion, type Variants } from "framer-motion";

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
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    x: ITEM_DISTANCE_PX,
  },
};

type ListItem = {
  id: string;
  label: string;
};

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

**Why good:** Variants are reusable and type-safe, staggerDirection: -1 reverses exit animation, spring transition feels natural, items have stable keys

### Bad Example - Inline Variants Without Types

```typescript
export const AnimatedList = ({ items }) => {
  return (
    <motion.ul
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {items.map((item, index) => (
        <motion.li
          key={index}  // Bad: using index as key
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}  // Bad: calculated delay
        >
          {item.label}
        </motion.li>
      ))}
    </motion.ul>
  );
};
```

**Why bad:** Using index as key causes animation issues on list changes, calculated delays are less maintainable than staggerChildren, no type safety on variants

---

## Pattern 3: AnimatePresence Patterns

### Good Example - Modal with Exit Animation

```typescript
import { AnimatePresence, motion } from "framer-motion";
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
  // Close on Escape key
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
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: BACKDROP_OPACITY }}
            exit={{ opacity: 0 }}
            transition={{ duration: MODAL_DURATION_S }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "black",
            }}
            aria-hidden="true"
          />

          {/* Modal content */}
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ opacity: 0, scale: MODAL_SCALE_HIDDEN, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: MODAL_SCALE_HIDDEN, y: 10 }}
            transition={{
              duration: MODAL_DURATION_S,
              ease: [0.16, 1, 0.3, 1],
            }}
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
        </>
      )}
    </AnimatePresence>
  );
};
```

**Why good:** Unique keys on both backdrop and modal, keyboard accessibility with Escape, proper ARIA attributes, custom easing for polished feel, transform properties for performance

### Good Example - Page Transitions with mode="wait"

```typescript
import { AnimatePresence, motion } from "framer-motion";

const PAGE_DURATION_S = 0.3;
const PAGE_DISTANCE_PX = 20;

const pageVariants = {
  initial: { opacity: 0, x: PAGE_DISTANCE_PX },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -PAGE_DISTANCE_PX },
};

const pageTransition = {
  duration: PAGE_DURATION_S,
  ease: "easeInOut",
};

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

**Why good:** mode="wait" ensures clean transition without overlap, semantic main element, pageKey changes trigger animation cycle

---

## Pattern 4: Gesture Animations

### Good Example - Interactive Card

```typescript
import { motion } from "framer-motion";

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

**Why good:** Lift effect on hover, subtle scale on tap, keyboard accessible with Enter/Space, proper ARIA role for interactive cards

### Good Example - Draggable Element with Constraints

```typescript
import { motion, useDragControls } from "framer-motion";
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

**Why good:** Constraints bound dragging to parent, elastic provides resistance at bounds, visual feedback during drag

---

## Pattern 5: Reduced Motion (Accessibility)

### Good Example - Accessible Animation Component

```typescript
import { motion, useReducedMotion, type Variants } from "framer-motion";

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
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : FULL_DISTANCE_PX,
    },
    visible: {
      opacity: 1,
      y: 0,
    },
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

**Why good:** Respects prefers-reduced-motion setting, still provides visual feedback with opacity, shorter duration for reduced motion users
