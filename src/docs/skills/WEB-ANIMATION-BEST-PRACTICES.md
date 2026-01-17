# Web Animation Best Practices Research

> Research Date: 2026-01-15
> Purpose: Atomic skill creation for web animations
> Status: Complete

---

## Table of Contents

1. [Framer Motion Patterns](#1-framer-motion-patterns)
2. [CSS Animations Patterns](#2-css-animations-patterns)
3. [View Transitions API](#3-view-transitions-api)
4. [GSAP Patterns](#4-gsap-patterns)
5. [React Spring Patterns](#5-react-spring-patterns)
6. [Animation Performance](#6-animation-performance)
7. [Reduced Motion Accessibility](#7-reduced-motion-accessibility)
8. [Scroll-Triggered Animations](#8-scroll-triggered-animations)
9. [Page Transition Patterns](#9-page-transition-patterns)
10. [Micro-Interactions Patterns](#10-micro-interactions-patterns)

---

## 1. Framer Motion Patterns

### Core Patterns

#### Basic Motion Component

```typescript
import { motion } from 'framer-motion';

// Simple fade-in animation
export function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

#### Variants for Orchestrated Animations

```typescript
import { motion, type Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

export function StaggeredList({ items }: { items: string[] }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => (
        <motion.li key={item} variants={itemVariants}>
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

#### Gesture Animations

```typescript
import { motion } from 'framer-motion';

export function InteractiveButton({ children }: { children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.button>
  );
}
```

#### AnimatePresence for Exit Animations

```typescript
import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="modal-backdrop"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="modal-content"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

#### Layout Animations with Shared Layout

```typescript
import { motion, LayoutGroup } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function AnimatedTabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <LayoutGroup>
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="tab"
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab-indicator"
                className="tab-indicator"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
```

#### Scroll-Linked Animations

```typescript
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function ParallaxSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);

  return (
    <motion.div ref={ref} style={{ y, opacity }}>
      {children}
    </motion.div>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Animating layout-affecting properties directly
<motion.div
  animate={{ width: isExpanded ? 500 : 200 }} // Triggers reflow
/>

// GOOD: Use layout prop for automatic FLIP animations
<motion.div
  layout
  style={{ width: isExpanded ? 500 : 200 }}
/>

// BAD: Not cleaning up animations
useEffect(() => {
  // Missing cleanup can cause memory leaks
  const controls = animate(element, { x: 100 });
}, []);

// GOOD: Proper cleanup
useEffect(() => {
  const controls = animate(element, { x: 100 });
  return () => controls.stop();
}, []);

// BAD: Excessive animations everywhere
// Every single element animated, overwhelming the user

// GOOD: Strategic, purposeful animations
// Only animate elements that benefit UX
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| UI transitions and micro-interactions | Simple show/hide (use CSS) |
| Page/route animations | Performance-critical scenarios on low-end devices |
| Shared element transitions | Server-side rendering without hydration strategy |
| Gesture-based interactions | Animations that don't enhance UX |
| Complex orchestrated sequences | Simple opacity/transform (CSS is lighter) |
| Layout animations (FLIP) | When bundle size is critical concern |

---

## 2. CSS Animations Patterns

### Core Patterns

#### Keyframe Animations

```css
/* Base animation with GPU-accelerated properties */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out forwards;
}

/* Staggered children with CSS custom properties */
.stagger-list > * {
  animation: fade-in-up 0.3s ease-out forwards;
  animation-delay: calc(var(--index) * 0.05s);
  opacity: 0;
}
```

#### Transition Utilities

```css
/* Reusable transition classes */
.transition-base {
  transition-property: transform, opacity;
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.transition-colors {
  transition-property: color, background-color, border-color;
  transition-duration: 150ms;
  transition-timing-function: ease-in-out;
}

/* Hover states */
.hover-lift {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
}
```

#### GPU-Accelerated Transforms

```css
/* GOOD: GPU-accelerated properties */
.slide-in {
  transform: translateX(-100%);
  transition: transform 300ms ease-out;
}

.slide-in.is-visible {
  transform: translateX(0);
}

/* Force GPU layer for complex animations */
.gpu-accelerated {
  will-change: transform;
  transform: translateZ(0); /* Creates compositing layer */
}

/* Remove will-change after animation */
.gpu-accelerated.animation-complete {
  will-change: auto;
}
```

#### Loading States

```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  background: linear-gradient(
    90deg,
    var(--skeleton-base) 25%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 75%
  );
  background-size: 200% 100%;
}

.spinner {
  animation: spin 1s linear infinite;
}
```

#### TypeScript Integration with CSS Modules

```typescript
import styles from './button.module.scss';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(styles.button, {
  variants: {
    animated: {
      true: styles.animated,
      false: '',
    },
  },
  defaultVariants: {
    animated: true,
  },
});

type ButtonProps = VariantProps<typeof buttonVariants> & {
  children: React.ReactNode;
};

export function Button({ animated, children }: ButtonProps) {
  return (
    <button className={buttonVariants({ animated })}>
      {children}
    </button>
  );
}
```

```scss
// button.module.scss
.button {
  transition: transform 150ms ease-out, background-color 150ms ease-out;

  &:hover {
    background-color: var(--color-primary-hover);
  }

  &:active {
    transform: scale(0.98);
  }
}

.animated {
  &:hover {
    transform: translateY(-1px);
  }
}
```

### Anti-Patterns

```css
/* BAD: Animating layout properties */
.bad-animation {
  transition: width 300ms, height 300ms, margin 300ms;
}

/* GOOD: Use transform instead */
.good-animation {
  transition: transform 300ms;
}

/* BAD: will-change on everything */
* {
  will-change: transform, opacity;
}

/* GOOD: will-change only when needed */
.will-animate:hover {
  will-change: transform;
}

.will-animate.animating {
  transform: scale(1.1);
}

.will-animate:not(:hover) {
  will-change: auto;
}

/* BAD: Long animation durations */
.slow-animation {
  transition: all 2s; /* Too slow, feels sluggish */
}

/* GOOD: Appropriate durations */
.micro-interaction {
  transition: transform 150ms; /* Quick feedback */
}

.page-transition {
  transition: opacity 300ms; /* Context switch */
}
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Simple hover/focus states | Complex orchestrated sequences |
| Loading indicators | Animations requiring JS state |
| State transitions (active, disabled) | Dynamic timing based on data |
| Performance is critical | Exit animations needed |
| No JS dependencies preferred | Gesture-based interactions |
| Design system tokens | Shared element transitions |

---

## 3. View Transitions API

### Core Patterns

#### Basic Same-Document Transition

```typescript
// Check for browser support
function supportsViewTransitions(): boolean {
  return 'startViewTransition' in document;
}

// Basic transition wrapper
async function withViewTransition(updateFn: () => void | Promise<void>) {
  if (!supportsViewTransitions()) {
    await updateFn();
    return;
  }

  const transition = document.startViewTransition(async () => {
    await updateFn();
  });

  await transition.finished;
}

// Usage
async function handleNavigation() {
  await withViewTransition(() => {
    setCurrentPage('details');
  });
}
```

#### React ViewTransition Component (Experimental)

```typescript
import { ViewTransition, startTransition } from 'react';

interface CardProps {
  id: string;
  title: string;
  onSelect: (id: string) => void;
}

export function Card({ id, title, onSelect }: CardProps) {
  const handleClick = () => {
    // Must wrap in startTransition for ViewTransition to activate
    startTransition(() => {
      onSelect(id);
    });
  };

  return (
    <ViewTransition name={`card-${id}`}>
      <article onClick={handleClick}>
        <h2>{title}</h2>
      </article>
    </ViewTransition>
  );
}

// Detail view with matching name for shared element transition
export function CardDetail({ id, title }: { id: string; title: string }) {
  return (
    <ViewTransition name={`card-${id}`}>
      <article className="card-detail">
        <h1>{title}</h1>
        <ViewTransition name={`card-${id}-content`}>
          <div className="content">
            {/* Detail content */}
          </div>
        </ViewTransition>
      </article>
    </ViewTransition>
  );
}
```

#### React Router Integration

```typescript
import { Link, useViewTransitionState } from 'react-router-dom';

interface ProductCardProps {
  id: string;
  name: string;
  image: string;
}

export function ProductCard({ id, name, image }: ProductCardProps) {
  const href = `/products/${id}`;
  const isTransitioning = useViewTransitionState(href);

  return (
    <Link
      to={href}
      viewTransition
      style={{
        viewTransitionName: isTransitioning ? `product-${id}` : '',
      }}
    >
      <img
        src={image}
        alt={name}
        style={{
          viewTransitionName: isTransitioning ? `product-image-${id}` : '',
        }}
      />
      <h3>{name}</h3>
    </Link>
  );
}
```

#### CSS for View Transitions

```css
/* Default crossfade transition */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 300ms;
}

/* Custom animation for specific elements */
::view-transition-old(card-image) {
  animation: fade-out 200ms ease-out;
}

::view-transition-new(card-image) {
  animation: fade-in 200ms ease-in 200ms;
}

/* Shared element transition styling */
::view-transition-group(product-*) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Match-element auto-naming (2025) */
.product-card {
  view-transition-name: match-element;
}

/* Scoped transitions */
.gallery {
  view-transition-name: gallery-scope;
}
```

#### Fallback Pattern

```typescript
import { useCallback } from 'react';

export function useNavigateWithTransition() {
  const navigate = useNavigate();

  return useCallback(
    (to: string) => {
      if (!document.startViewTransition) {
        navigate(to);
        return;
      }

      document.startViewTransition(() => {
        navigate(to);
      });
    },
    [navigate]
  );
}
```

### Anti-Patterns

```typescript
// BAD: Not wrapping in startTransition (React)
function handleClick() {
  setPage('new'); // ViewTransition won't activate
}

// GOOD: Wrap state updates in startTransition
function handleClick() {
  startTransition(() => {
    setPage('new');
  });
}

// BAD: Not providing fallback for unsupported browsers
document.startViewTransition(() => {
  // Crashes in Safari < 18
});

// GOOD: Feature detection
if (document.startViewTransition) {
  document.startViewTransition(updateFn);
} else {
  updateFn();
}

// BAD: Using same view-transition-name on multiple visible elements
// This causes undefined behavior

// GOOD: Unique names or use match-element
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Page-to-page navigation | Older browser support required |
| Shared element transitions | Complex gesture-driven animations |
| SPA route changes | Need fine-grained control |
| MPA with modern browsers | Animation timing varies by data |
| Native app-like feel | Bundle size is critical |
| Progressive enhancement OK | Need consistent cross-browser behavior |

---

## 4. GSAP Patterns

### Core Patterns

#### Basic Setup in React

```typescript
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register plugin once at app level
gsap.registerPlugin(ScrollTrigger);

export function useGsapAnimation() {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Create GSAP context for proper cleanup
    const ctx = gsap.context(() => {
      gsap.from(element, {
        opacity: 0,
        y: 50,
        duration: 0.6,
        ease: 'power2.out',
      });
    }, element);

    // Cleanup on unmount
    return () => ctx.revert();
  }, []);

  return elementRef;
}
```

#### ScrollTrigger Integration

```typescript
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollAnimationOptions {
  start?: string;
  end?: string;
  scrub?: boolean | number;
  pin?: boolean;
}

export function useScrollAnimation(options: ScrollAnimationOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const ctx = gsap.context(() => {
      gsap.to(content, {
        x: '-50%',
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: options.start ?? 'top top',
          end: options.end ?? '+=200%',
          scrub: options.scrub ?? 1,
          pin: options.pin ?? true,
          anticipatePin: 1,
        },
      });
    }, container);

    return () => ctx.revert();
  }, [options.start, options.end, options.scrub, options.pin]);

  return { containerRef, contentRef };
}
```

#### Timeline Animations

```typescript
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function useTimelineAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out', duration: 0.5 },
      });

      tl.from('.hero-title', { opacity: 0, y: 30 })
        .from('.hero-subtitle', { opacity: 0, y: 20 }, '-=0.3')
        .from('.hero-cta', { opacity: 0, scale: 0.9 }, '-=0.2')
        .from('.hero-image', {
          opacity: 0,
          x: 50,
          duration: 0.8,
        }, '-=0.4');
    }, container);

    return () => ctx.revert();
  }, []);

  return containerRef;
}
```

#### Scrub Animation with Progress

```typescript
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useScrubProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: element,
        start: 'top center',
        end: 'bottom center',
        onUpdate: (self) => {
          setProgress(self.progress);
        },
      });
    }, element);

    return () => ctx.revert();
  }, []);

  return { ref, progress };
}
```

#### Responsive Handling

```typescript
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useResponsiveScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 768px)', () => {
        gsap.to('.panel', {
          xPercent: -100,
          scrollTrigger: {
            trigger: element,
            pin: true,
            scrub: 1,
          },
        });
      });

      mm.add('(max-width: 767px)', () => {
        // Different animation for mobile
        gsap.from('.panel', {
          opacity: 0,
          y: 50,
          stagger: 0.2,
        });
      });
    }, element);

    return () => ctx.revert();
  }, []);

  return ref;
}
```

### Anti-Patterns

```typescript
// BAD: Not using GSAP context in React
useEffect(() => {
  gsap.to('.element', { x: 100 });
  // No cleanup - causes issues on re-render/unmount
}, []);

// GOOD: Always use gsap.context()
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to('.element', { x: 100 });
  });
  return () => ctx.revert();
}, []);

// BAD: Animating pinned element directly
gsap.to('.pinned-section', {
  x: 100,
  scrollTrigger: { pin: true }, // Breaks measurements
});

// GOOD: Animate children of pinned element
gsap.to('.pinned-section .content', {
  x: 100,
  scrollTrigger: {
    trigger: '.pinned-section',
    pin: true,
  },
});

// BAD: Not refreshing on resize
// ScrollTrigger positions become stale

// GOOD: Handle resize
window.addEventListener('resize', () => {
  ScrollTrigger.refresh();
});
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Complex scroll-based animations | Simple UI transitions |
| Precise timeline control | Bundle size is critical |
| SVG morphing (MorphSVG plugin) | Only need basic animations |
| Text splitting (SplitText plugin) | Declarative API preferred |
| Draggable interactions | React state-driven animations |
| Professional-grade requirements | Framework has built-in solution |

---

## 5. React Spring Patterns

### Core Patterns

#### useSpring for Single Animations

```typescript
import { useSpring, animated } from '@react-spring/web';

interface FadeProps {
  show: boolean;
  children: React.ReactNode;
}

export function Fade({ show, children }: FadeProps) {
  const styles = useSpring({
    opacity: show ? 1 : 0,
    transform: show ? 'translateY(0px)' : 'translateY(20px)',
    config: { tension: 300, friction: 20 },
  });

  return <animated.div style={styles}>{children}</animated.div>;
}
```

#### useTransition for Lists

```typescript
import { useTransition, animated } from '@react-spring/web';

interface Item {
  id: string;
  text: string;
}

interface AnimatedListProps {
  items: Item[];
}

export function AnimatedList({ items }: AnimatedListProps) {
  const transitions = useTransition(items, {
    keys: (item) => item.id,
    from: { opacity: 0, transform: 'translateX(-20px)' },
    enter: { opacity: 1, transform: 'translateX(0px)' },
    leave: { opacity: 0, transform: 'translateX(20px)' },
    config: { tension: 220, friction: 20 },
  });

  return (
    <ul>
      {transitions((style, item) => (
        <animated.li style={style}>{item.text}</animated.li>
      ))}
    </ul>
  );
}
```

#### useTrail for Staggered Animations

```typescript
import { useTrail, animated } from '@react-spring/web';

interface StaggeredCardsProps {
  items: string[];
  show: boolean;
}

export function StaggeredCards({ items, show }: StaggeredCardsProps) {
  const trail = useTrail(items.length, {
    opacity: show ? 1 : 0,
    transform: show ? 'scale(1)' : 'scale(0.9)',
    config: { mass: 1, tension: 280, friction: 20 },
  });

  return (
    <div className="cards">
      {trail.map((style, index) => (
        <animated.div key={items[index]} style={style} className="card">
          {items[index]}
        </animated.div>
      ))}
    </div>
  );
}
```

#### useChain for Sequenced Animations

```typescript
import {
  useSpring,
  useTransition,
  useChain,
  useSpringRef,
  animated,
} from '@react-spring/web';

interface ModalWithContentProps {
  isOpen: boolean;
  items: string[];
}

export function ModalWithContent({ isOpen, items }: ModalWithContentProps) {
  const backdropRef = useSpringRef();
  const contentRef = useSpringRef();

  const backdropStyle = useSpring({
    ref: backdropRef,
    opacity: isOpen ? 1 : 0,
  });

  const contentTransitions = useTransition(isOpen ? items : [], {
    ref: contentRef,
    from: { opacity: 0, y: 20 },
    enter: { opacity: 1, y: 0 },
    leave: { opacity: 0, y: -20 },
    trail: 100,
  });

  // Chain: backdrop first, then content
  useChain(isOpen ? [backdropRef, contentRef] : [contentRef, backdropRef], [
    0,
    isOpen ? 0.3 : 0,
  ]);

  return (
    <animated.div style={backdropStyle} className="modal-backdrop">
      <div className="modal-content">
        {contentTransitions((style, item) => (
          <animated.div style={style}>{item}</animated.div>
        ))}
      </div>
    </animated.div>
  );
}
```

#### Physics-Based Drag

```typescript
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

export function DraggableCard({ children }: { children: React.ReactNode }) {
  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }));

  const bind = useDrag(
    ({ down, movement: [mx, my] }) => {
      api.start({
        x: down ? mx : 0,
        y: down ? my : 0,
        immediate: down,
        config: { tension: 500, friction: 30 },
      });
    },
    { bounds: { left: -100, right: 100, top: -50, bottom: 50 } }
  );

  return (
    <animated.div {...bind()} style={{ x, y, touchAction: 'none' }}>
      {children}
    </animated.div>
  );
}
```

#### Configuration Presets

```typescript
import { config } from '@react-spring/web';

// Built-in presets
const presets = {
  default: config.default,    // { tension: 170, friction: 26 }
  gentle: config.gentle,      // { tension: 120, friction: 14 }
  wobbly: config.wobbly,      // { tension: 180, friction: 12 }
  stiff: config.stiff,        // { tension: 210, friction: 20 }
  slow: config.slow,          // { tension: 280, friction: 60 }
  molasses: config.molasses,  // { tension: 280, friction: 120 }
};

// Custom configuration
const customConfig = {
  tension: 300,
  friction: 20,
  mass: 1,
  clamp: false, // Allow overshoot
};
```

### Anti-Patterns

```typescript
// BAD: Using duration instead of physics
const styles = useSpring({
  opacity: 1,
  config: { duration: 300 }, // Loses spring physics benefits
});

// GOOD: Use tension/friction for natural motion
const styles = useSpring({
  opacity: 1,
  config: { tension: 300, friction: 20 },
});

// BAD: Creating new config objects on every render
function Component() {
  const styles = useSpring({
    opacity: 1,
    config: { tension: 300, friction: 20 }, // New object each render
  });
}

// GOOD: Memoize or define outside component
const SPRING_CONFIG = { tension: 300, friction: 20 };

function Component() {
  const styles = useSpring({
    opacity: 1,
    config: SPRING_CONFIG,
  });
}

// BAD: Not using animated components
function Component() {
  const { opacity } = useSpring({ opacity: 1 });
  return <div style={{ opacity }}>{/* Won't animate */}</div>;
}

// GOOD: Use animated.* components
function Component() {
  const { opacity } = useSpring({ opacity: 1 });
  return <animated.div style={{ opacity }}>{/* Animates */}</animated.div>;
}
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Physics-based natural motion | Simple CSS transitions suffice |
| Complex spring interactions | Timeline-based animations |
| Gesture-driven animations | Scroll-linked animations (use GSAP) |
| List enter/exit animations | Need declarative variants API |
| Fine-grained physics control | Bundle size is critical |
| Interactive demos/tools | Simple fade/slide animations |

---

## 6. Animation Performance

### Core Patterns

#### GPU-Accelerated Properties Only

```typescript
// Constants for animation properties
const GPU_SAFE_PROPERTIES = ['transform', 'opacity'] as const;
const AVOID_PROPERTIES = ['width', 'height', 'top', 'left', 'margin', 'padding'] as const;

// GOOD: GPU-accelerated animation
const goodAnimation = {
  initial: { opacity: 0, transform: 'translateY(20px) scale(0.95)' },
  animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
};

// BAD: Layout-triggering animation
const badAnimation = {
  initial: { width: 0, marginLeft: 100 },
  animate: { width: 200, marginLeft: 0 },
};
```

#### will-change Management

```typescript
import { useCallback, useRef, useEffect } from 'react';

export function useWillChange<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const timeoutRef = useRef<number>();

  const prepareAnimation = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.willChange = 'transform, opacity';
  }, []);

  const cleanupWillChange = useCallback(() => {
    // Delay cleanup to ensure animation completes
    timeoutRef.current = window.setTimeout(() => {
      if (ref.current) {
        ref.current.style.willChange = 'auto';
      }
    }, 100);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    ref,
    prepareAnimation,
    cleanupWillChange,
  };
}

// Usage
function AnimatedCard() {
  const { ref, prepareAnimation, cleanupWillChange } = useWillChange<HTMLDivElement>();

  return (
    <div
      ref={ref}
      onMouseEnter={prepareAnimation}
      onMouseLeave={cleanupWillChange}
      className="card"
    >
      Content
    </div>
  );
}
```

#### Animation Frame Budgeting

```typescript
// Target: 16.67ms per frame for 60fps
const FRAME_BUDGET_MS = 16.67;
const ANIMATION_DURATION_MICRO = 150; // Quick micro-interactions
const ANIMATION_DURATION_STANDARD = 300; // Standard transitions
const ANIMATION_DURATION_COMPLEX = 500; // Complex animations

// Batch DOM operations
function batchDOMUpdates(updates: (() => void)[]) {
  requestAnimationFrame(() => {
    // Read phase
    const measurements = updates.map(() => null);

    // Write phase - all writes together
    updates.forEach((update) => update());
  });
}
```

#### Reducing Paint Areas

```css
/* Isolate animated elements to their own layer */
.animated-element {
  /* Creates new stacking context and compositing layer */
  isolation: isolate;
  contain: layout style paint;
}

/* For complex animations, force new layer */
.complex-animation {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Limit animation scope */
.animation-container {
  contain: content;
  overflow: hidden;
}
```

#### Performance Monitoring Hook

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  fps: number;
  frameDrops: number;
}

export function useAnimationPerformance(
  onMetrics?: (metrics: PerformanceMetrics) => void
) {
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const frameDropsRef = useRef(0);

  const checkPerformance = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;

    frameCountRef.current++;

    // Check for frame drops (> 20ms between frames)
    if (delta > 20) {
      frameDropsRef.current++;
    }

    // Report every second
    if (delta >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);

      onMetrics?.({
        fps,
        frameDrops: frameDropsRef.current,
      });

      frameCountRef.current = 0;
      frameDropsRef.current = 0;
      lastTimeRef.current = now;
    }

    requestAnimationFrame(checkPerformance);
  }, [onMetrics]);

  useEffect(() => {
    const frameId = requestAnimationFrame(checkPerformance);
    return () => cancelAnimationFrame(frameId);
  }, [checkPerformance]);
}
```

#### Lazy Animation Loading

```typescript
import { useInView } from 'framer-motion';
import { useRef, lazy, Suspense } from 'react';

// Lazy load heavy animation components
const HeavyAnimation = lazy(() => import('./heavy-animation'));

export function LazyAnimatedSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '100px' });

  return (
    <div ref={ref}>
      {isInView && (
        <Suspense fallback={<div className="skeleton" />}>
          <HeavyAnimation />
        </Suspense>
      )}
    </div>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Animating during critical load
function App() {
  return (
    <motion.div animate={{ x: 100 }}> {/* Competes with LCP */}
      <HeroImage /> {/* Critical content delayed */}
    </motion.div>
  );
}

// GOOD: Defer non-critical animations
function App() {
  const [canAnimate, setCanAnimate] = useState(false);

  useEffect(() => {
    // Wait for critical content to load
    requestIdleCallback(() => setCanAnimate(true));
  }, []);

  return (
    <motion.div animate={canAnimate ? { x: 100 } : undefined}>
      <HeroImage />
    </motion.div>
  );
}

// BAD: Too many simultaneous animations
function Gallery({ items }) {
  return items.map((item) => (
    <motion.div
      key={item.id}
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ repeat: Infinity }}
    />
  ));
}

// GOOD: Limit concurrent animations
function Gallery({ items }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return items.map((item, index) => (
    <motion.div
      key={item.id}
      animate={activeIndex === index ? { scale: 1.1 } : { scale: 1 }}
      onHoverStart={() => setActiveIndex(index)}
      onHoverEnd={() => setActiveIndex(null)}
    />
  ));
}
```

### Performance Tier List

| Tier | Technology | Notes |
|------|-----------|-------|
| S | CSS Animations/Transitions | Compositor thread, doesn't block main thread |
| S | Web Animations API (WAAPI) | Same as CSS but controllable via JS |
| A | Framer Motion (transform/opacity) | Efficient, uses WAAPI under hood |
| A | GSAP (transform/opacity) | Highly optimized, main thread |
| B | React Spring | Main thread, but efficient |
| C | JavaScript DOM manipulation | Avoid for animations |

---

## 7. Reduced Motion Accessibility

### Core Patterns

#### CSS Media Query Approach

```scss
// Base animations
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animated-element {
  animation: fade-in-up 0.3s ease-out;
}

// Reduced motion override
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

// Alternative: Provide simpler animation instead of removing
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    opacity: 1; // Instant appearance instead
  }
}
```

#### JavaScript Detection Hook

```typescript
import { useState, useEffect } from 'react';

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// Usage with Framer Motion
import { motion } from 'framer-motion';

function AnimatedComponent() {
  const prefersReducedMotion = usePrefersReducedMotion();

  const variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      transition={{
        duration: prefersReducedMotion ? 0 : 0.3,
      }}
    >
      Content
    </motion.div>
  );
}
```

#### Framer Motion Integration

```typescript
import { motion, useReducedMotion } from 'framer-motion';

function AccessibleAnimation({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: shouldReduceMotion ? 'linear' : 'easeOut',
      }}
    >
      {children}
    </motion.div>
  );
}
```

#### Manual Toggle Control

```typescript
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface MotionPreferenceContextValue {
  reduceMotion: boolean;
  toggleReduceMotion: () => void;
  setReduceMotion: (value: boolean) => void;
}

const MotionPreferenceContext = createContext<MotionPreferenceContextValue | null>(null);

export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const systemPreference = usePrefersReducedMotion();
  const [userPreference, setUserPreference] = useState<boolean | null>(null);

  // User preference overrides system preference
  const reduceMotion = userPreference ?? systemPreference;

  const toggleReduceMotion = useCallback(() => {
    setUserPreference((prev) => !(prev ?? systemPreference));
  }, [systemPreference]);

  const setReduceMotion = useCallback((value: boolean) => {
    setUserPreference(value);
  }, []);

  return (
    <MotionPreferenceContext.Provider
      value={{ reduceMotion, toggleReduceMotion, setReduceMotion }}
    >
      {children}
    </MotionPreferenceContext.Provider>
  );
}

export function useMotionPreference() {
  const context = useContext(MotionPreferenceContext);
  if (!context) {
    throw new Error('useMotionPreference must be used within MotionPreferenceProvider');
  }
  return context;
}

// Toggle component
export function MotionToggle() {
  const { reduceMotion, toggleReduceMotion } = useMotionPreference();

  return (
    <button
      onClick={toggleReduceMotion}
      aria-pressed={reduceMotion}
      aria-label={reduceMotion ? 'Enable animations' : 'Reduce animations'}
    >
      {reduceMotion ? 'Enable motion' : 'Reduce motion'}
    </button>
  );
}
```

#### Categorizing Animations

```typescript
// Different handling for different animation types
type AnimationType = 'essential' | 'decorative' | 'feedback';

interface AnimationConfig {
  type: AnimationType;
  reducedMotionBehavior: 'remove' | 'simplify' | 'keep';
}

const ANIMATION_CONFIGS: Record<string, AnimationConfig> = {
  pageTransition: {
    type: 'essential',
    reducedMotionBehavior: 'simplify', // Fade only, no movement
  },
  loadingSpinner: {
    type: 'feedback',
    reducedMotionBehavior: 'keep', // Keep but maybe slower
  },
  parallaxBackground: {
    type: 'decorative',
    reducedMotionBehavior: 'remove', // Remove entirely
  },
  buttonHover: {
    type: 'feedback',
    reducedMotionBehavior: 'simplify', // Color change only
  },
};

function getAnimationVariants(
  configKey: string,
  reduceMotion: boolean
) {
  const config = ANIMATION_CONFIGS[configKey];

  if (!reduceMotion) {
    return getFullAnimationVariants(configKey);
  }

  switch (config.reducedMotionBehavior) {
    case 'remove':
      return null;
    case 'simplify':
      return getSimplifiedVariants(configKey);
    case 'keep':
      return getFullAnimationVariants(configKey);
  }
}
```

### Anti-Patterns

```typescript
// BAD: Just slowing down animations
@media (prefers-reduced-motion: reduce) {
  .animation {
    animation-duration: 2s; // Still causes motion sickness!
  }
}

// GOOD: Remove or fundamentally change the animation
@media (prefers-reduced-motion: reduce) {
  .animation {
    animation: none;
    /* OR use opacity-only animation */
    animation: fade-in 0.2s ease-out;
  }
}

// BAD: Ignoring system preferences
function AnimatedComponent() {
  return (
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity }}>
      Always spinning regardless of user preference
    </motion.div>
  );
}

// GOOD: Respect preferences
function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={shouldReduceMotion ? {} : { rotate: 360 }}
      transition={shouldReduceMotion ? {} : { repeat: Infinity }}
    >
      Respects user preference
    </motion.div>
  );
}

// BAD: Only relying on system setting
// Users might not know about the setting or use shared computers

// GOOD: Provide in-app control too
<MotionToggle />
```

### WCAG Compliance Checklist

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| 2.3.1 (A) | No content flashes > 3x/second | Avoid rapid flashing |
| 2.3.3 (AAA) | Disable non-essential motion | `prefers-reduced-motion` |
| 2.2.2 (A) | Pause/stop/hide for content > 5s | Add pause controls |

---

## 8. Scroll-Triggered Animations

### Core Patterns

#### CSS Scroll-Driven Animations (Modern)

```css
/* Scroll-driven animation using view() */
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.scroll-reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

/* Scrub animation that follows scroll position */
.progress-bar {
  transform-origin: left;
  animation: grow-width linear both;
  animation-timeline: scroll();
}

@keyframes grow-width {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

/* Parallax with scroll timeline */
.parallax-element {
  animation: parallax linear both;
  animation-timeline: scroll();
}

@keyframes parallax {
  from {
    transform: translateY(100px);
  }
  to {
    transform: translateY(-100px);
  }
}
```

#### Intersection Observer Hook

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseIntersectionOptions {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useIntersection<T extends HTMLElement>(
  options: UseIntersectionOptions = {}
) {
  const { threshold = 0, rootMargin = '0px', triggerOnce = true } = options;
  const ref = useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || (triggerOnce && hasTriggered)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setIsIntersecting(isVisible);

        if (isVisible && triggerOnce) {
          setHasTriggered(true);
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce, hasTriggered]);

  return { ref, isIntersecting };
}

// Usage
function ScrollReveal({ children }: { children: React.ReactNode }) {
  const { ref, isIntersecting } = useIntersection<HTMLDivElement>({
    threshold: 0.2,
    rootMargin: '-50px',
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}
```

#### Framer Motion useInView

```typescript
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

function ScrollSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once: true,
    margin: '-100px 0px',
  });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 75 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 75 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  );
}
```

#### Staggered Scroll Reveal

```typescript
import { motion, useInView, type Variants } from 'framer-motion';
import { useRef } from 'react';

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

interface StaggeredGridProps {
  items: Array<{ id: string; content: string }>;
}

function StaggeredGrid({ items }: StaggeredGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className="grid"
    >
      {items.map((item) => (
        <motion.div key={item.id} variants={itemVariants} className="grid-item">
          {item.content}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

#### Scroll Progress Indicator

```typescript
import { motion, useScroll, useSpring } from 'framer-motion';

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="scroll-progress"
      style={{
        scaleX,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'var(--color-primary)',
        transformOrigin: '0%',
        zIndex: 100,
      }}
    />
  );
}
```

#### Section-Specific Scroll Progress

```typescript
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

function ScrollLinkedSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.8, 1, 1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

  return (
    <div ref={containerRef} className="scroll-section">
      <motion.div style={{ opacity, scale, y }}>
        Scroll-linked content
      </motion.div>
    </div>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Using scroll event listener
useEffect(() => {
  const handleScroll = () => {
    // Fires too often, causes jank
    setPosition(window.scrollY);
  };
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

// GOOD: Use Intersection Observer or scroll-driven CSS
const { ref, isIntersecting } = useIntersection();

// BAD: Animating on every scroll position change
<motion.div animate={{ y: scrollY }} />

// GOOD: Use useTransform for scroll-linked values
const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
<motion.div style={{ y }} />

// BAD: Not cleaning up observers
useEffect(() => {
  const observer = new IntersectionObserver(callback);
  observer.observe(element);
  // Missing cleanup!
}, []);

// GOOD: Always cleanup
useEffect(() => {
  const observer = new IntersectionObserver(callback);
  observer.observe(element);
  return () => observer.disconnect();
}, []);
```

### When to Use Each Approach

| Approach | Best For | Browser Support |
|----------|----------|-----------------|
| CSS `animation-timeline: view()` | Simple reveal animations | Chrome 115+, Safari 26+ |
| CSS `animation-timeline: scroll()` | Progress indicators, parallax | Chrome 115+, Safari 26+ |
| Intersection Observer | Trigger-based animations | All modern browsers |
| Framer Motion `useInView` | React component reveals | All (polyfilled) |
| Framer Motion `useScroll` | Scroll progress, parallax | All (polyfilled) |
| GSAP ScrollTrigger | Complex timelines, pinning | All (library) |

---

## 9. Page Transition Patterns

### Core Patterns

#### View Transitions API (Native)

```typescript
// Utility for safe view transitions
export async function withViewTransition(
  updateFn: () => void | Promise<void>
): Promise<void> {
  if (!('startViewTransition' in document)) {
    await updateFn();
    return;
  }

  const transition = document.startViewTransition(async () => {
    await updateFn();
  });

  try {
    await transition.finished;
  } catch {
    // Transition was skipped or cancelled
  }
}

// React hook for view transitions
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useViewTransitionNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (!('startViewTransition' in document)) {
        navigate(to, options);
        return;
      }

      document.startViewTransition(() => {
        navigate(to, options);
      });
    },
    [navigate]
  );
}
```

#### React Router View Transitions

```typescript
import { Link, NavLink, Outlet } from 'react-router-dom';

// Enable view transitions on links
function Navigation() {
  return (
    <nav>
      <NavLink to="/" viewTransition>
        Home
      </NavLink>
      <NavLink to="/about" viewTransition>
        About
      </NavLink>
      <NavLink to="/products" viewTransition>
        Products
      </NavLink>
    </nav>
  );
}

// Layout with transition wrapper
function Layout() {
  return (
    <div className="layout">
      <Navigation />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

```css
/* View transition styles */
::view-transition-old(root) {
  animation: fade-out 200ms ease-out;
}

::view-transition-new(root) {
  animation: fade-in 200ms ease-in 200ms;
}

@keyframes fade-out {
  to {
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

/* Shared element transitions */
.product-image {
  view-transition-name: product-hero;
}

::view-transition-group(product-hero) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

#### Framer Motion AnimatePresence

```typescript
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, Routes, Route } from 'react-router-dom';

const pageVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.3,
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <HomePage />
            </motion.div>
          }
        />
        <Route
          path="/about"
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <AboutPage />
            </motion.div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}
```

#### Page Wrapper Component

```typescript
import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type TransitionType = 'fade' | 'slide' | 'scale' | 'slideUp';

const transitionVariants: Record<TransitionType, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
};

interface PageTransitionProps {
  children: ReactNode;
  transition?: TransitionType;
}

export function PageTransition({
  children,
  transition = 'fade',
}: PageTransitionProps) {
  return (
    <motion.div
      variants={transitionVariants[transition]}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

#### Shared Element Transitions

```typescript
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  image: string;
}

function ProductGallery({ products }: { products: Product[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedProduct = products.find((p) => p.id === selectedId);

  return (
    <LayoutGroup>
      <div className="gallery-grid">
        {products.map((product) => (
          <motion.div
            key={product.id}
            layoutId={`product-${product.id}`}
            onClick={() => setSelectedId(product.id)}
            className="product-card"
          >
            <motion.img
              layoutId={`product-image-${product.id}`}
              src={product.image}
              alt={product.name}
            />
            <motion.h3 layoutId={`product-name-${product.id}`}>
              {product.name}
            </motion.h3>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            className="product-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedId(null)}
          >
            <motion.div
              layoutId={`product-${selectedProduct.id}`}
              className="product-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                layoutId={`product-image-${selectedProduct.id}`}
                src={selectedProduct.image}
                alt={selectedProduct.name}
              />
              <motion.h2 layoutId={`product-name-${selectedProduct.id}`}>
                {selectedProduct.name}
              </motion.h2>
              <p>Product details...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
```

### Anti-Patterns

```typescript
// BAD: No exit animation handling
<Routes>
  <Route path="/" element={<motion.div animate={{ opacity: 1 }}><Home /></motion.div>} />
</Routes>

// GOOD: Use AnimatePresence for exit animations
<AnimatePresence mode="wait">
  <Routes location={location} key={location.pathname}>
    <Route path="/" element={<PageTransition><Home /></PageTransition>} />
  </Routes>
</AnimatePresence>

// BAD: Missing key on Routes
<AnimatePresence>
  <Routes location={location}>
    {/* Won't animate - React doesn't know routes changed */}
  </Routes>
</AnimatePresence>

// GOOD: Key based on pathname
<AnimatePresence>
  <Routes location={location} key={location.pathname}>
    {/* Animates correctly */}
  </Routes>
</AnimatePresence>

// BAD: Not handling View Transitions API absence
document.startViewTransition(() => navigate(to)); // Crashes in unsupported browsers

// GOOD: Feature detection
if ('startViewTransition' in document) {
  document.startViewTransition(() => navigate(to));
} else {
  navigate(to);
}
```

### When to Use Each Approach

| Approach | Best For | Considerations |
|----------|----------|----------------|
| View Transitions API | Native feel, simple transitions | Limited browser support |
| React Router + viewTransition | React apps with router | Chrome/Edge primary |
| Framer Motion AnimatePresence | Complex exit animations | Larger bundle |
| React's `<ViewTransition>` | React 19+ apps | Experimental |
| CSS-only transitions | Simple fades | No exit animations |

---

## 10. Micro-Interactions Patterns

### Core Patterns

#### Button Press Feedback

```typescript
import { motion } from 'framer-motion';
import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
};

export function Button({ children, variant = 'primary', ...props }: ButtonProps) {
  return (
    <motion.button
      {...props}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 17,
      }}
      className={`button button--${variant}`}
    >
      {children}
    </motion.button>
  );
}
```

```scss
// CSS-only alternative
.button {
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
  }

  &:active {
    transform: translateY(0) scale(0.98);
    box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
  }
}
```

#### Ripple Effect

```typescript
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ripple-button.module.scss';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export function RippleButton({ children }: { children: React.ReactNode }) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple: Ripple = { id: Date.now(), x, y };
    setRipples((prev) => [...prev, newRipple]);

    // Cleanup after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  }, []);

  return (
    <button className={styles.button} onClick={handleClick}>
      {children}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className={styles.ripple}
            style={{ left: ripple.x, top: ripple.y }}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </button>
  );
}
```

```scss
// ripple-button.module.scss
.button {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

.ripple {
  position: absolute;
  width: 20px;
  height: 20px;
  margin-left: -10px;
  margin-top: -10px;
  background: rgb(255 255 255 / 30%);
  border-radius: 50%;
  pointer-events: none;
}
```

#### Input Focus Animation

```typescript
import { motion } from 'framer-motion';
import { useState, useId } from 'react';

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextInput({ label, value, onChange }: TextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const id = useId();
  const hasValue = value.length > 0;

  return (
    <div className="input-wrapper">
      <motion.label
        htmlFor={id}
        animate={{
          y: isFocused || hasValue ? -24 : 0,
          scale: isFocused || hasValue ? 0.85 : 1,
          color: isFocused ? 'var(--color-primary)' : 'var(--color-text-secondary)',
        }}
        transition={{ duration: 0.2 }}
        className="input-label"
      >
        {label}
      </motion.label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="input-field"
      />
      <motion.div
        className="input-underline"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: isFocused ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
    </div>
  );
}
```

#### Toggle Switch

```typescript
import { motion } from 'framer-motion';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="toggle-track"
      data-checked={checked}
    >
      <motion.div
        className="toggle-thumb"
        layout
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
      />
    </button>
  );
}
```

```scss
.toggle-track {
  width: 48px;
  height: 28px;
  padding: 2px;
  border-radius: 14px;
  background: var(--color-gray-300);
  display: flex;
  justify-content: flex-start;
  cursor: pointer;
  transition: background-color 200ms;

  &[data-checked='true'] {
    background: var(--color-primary);
    justify-content: flex-end;
  }
}

.toggle-thumb {
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgb(0 0 0 / 20%);
}
```

#### Loading States

```typescript
import { motion } from 'framer-motion';

// Spinner
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeDasharray="31.4 31.4"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

// Skeleton loader
export function Skeleton({
  width,
  height,
}: {
  width: number | string;
  height: number | string;
}) {
  return (
    <motion.div
      style={{ width, height }}
      className="skeleton"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Button with loading state
interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

export function LoadingButton({
  isLoading,
  children,
  onClick,
}: LoadingButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={isLoading}
      whileHover={!isLoading ? { scale: 1.02 } : {}}
      whileTap={!isLoading ? { scale: 0.98 } : {}}
    >
      <motion.span
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.span>
      {isLoading && (
        <motion.div
          className="button-spinner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <Spinner size={16} />
        </motion.div>
      )}
    </motion.button>
  );
}
```

#### Success/Error Feedback

```typescript
import { motion, AnimatePresence } from 'framer-motion';

type FeedbackType = 'success' | 'error' | null;

interface FeedbackIconProps {
  type: FeedbackType;
}

export function FeedbackIcon({ type }: FeedbackIconProps) {
  return (
    <AnimatePresence mode="wait">
      {type === 'success' && (
        <motion.svg
          key="success"
          viewBox="0 0 24 24"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <motion.path
            d="M5 12l5 5L20 7"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          />
        </motion.svg>
      )}
      {type === 'error' && (
        <motion.svg
          key="error"
          viewBox="0 0 24 24"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          <path
            d="M6 6l12 12M6 18L18 6"
            fill="none"
            stroke="var(--color-error)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}
```

#### Card Hover Effects

```typescript
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface HoverCardProps {
  children: ReactNode;
}

export function HoverCard({ children }: HoverCardProps) {
  return (
    <motion.article
      className="hover-card"
      whileHover="hover"
      initial="rest"
      animate="rest"
    >
      <motion.div
        className="hover-card-content"
        variants={{
          rest: { y: 0 },
          hover: { y: -8 },
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {children}
      </motion.div>
      <motion.div
        className="hover-card-shadow"
        variants={{
          rest: { opacity: 0, scale: 0.95 },
          hover: { opacity: 1, scale: 1 },
        }}
        transition={{ duration: 0.2 }}
      />
    </motion.article>
  );
}
```

### Timing Guidelines

```typescript
// Animation duration constants
export const ANIMATION_DURATION = {
  INSTANT: 0,           // Immediate state changes
  MICRO: 100,           // Micro-interactions (button press)
  FAST: 150,            // Quick feedback (hover states)
  NORMAL: 200,          // Standard transitions
  MEDIUM: 300,          // Page transitions
  SLOW: 500,            // Complex animations
  EMPHASIS: 700,        // Attention-grabbing
} as const;

// Easing presets
export const EASING = {
  // Standard Material Design easings
  STANDARD: [0.4, 0, 0.2, 1],
  DECELERATE: [0, 0, 0.2, 1],
  ACCELERATE: [0.4, 0, 1, 1],
  // Custom
  BOUNCE: [0.68, -0.55, 0.265, 1.55],
  SMOOTH: [0.25, 0.1, 0.25, 1],
} as const;
```

### Anti-Patterns

```typescript
// BAD: Inconsistent timing across similar interactions
<Button transition={{ duration: 0.1 }} />
<Button transition={{ duration: 0.5 }} /> // Different button, different timing

// GOOD: Consistent timing from design tokens
<Button transition={{ duration: ANIMATION_DURATION.FAST / 1000 }} />

// BAD: Animation without purpose
<motion.div
  animate={{ rotate: [0, 360] }}
  transition={{ repeat: Infinity }}
>
  Static content that doesn't need animation
</motion.div>

// GOOD: Animation that provides feedback
<motion.button whileTap={{ scale: 0.98 }}>
  Click me
</motion.button>

// BAD: Too slow for micro-interactions
<Button
  whileHover={{ scale: 1.05 }}
  transition={{ duration: 0.8 }} // Way too slow!
/>

// GOOD: Snappy micro-interactions
<Button
  whileHover={{ scale: 1.02 }}
  transition={{ duration: 0.15 }}
/>
```

### When to Use vs When Not to Use

| Use Micro-Interactions For | Avoid Micro-Interactions For |
|---------------------------|------------------------------|
| Button press feedback | Static informational content |
| Form input states | Every single element |
| Loading/success states | When they slow down workflows |
| Hover affordances | Users who prefer reduced motion |
| Toggle/switch changes | Non-interactive elements |
| Navigation feedback | Decorative-only purposes |

---

## Summary: Animation Technology Decision Tree

```
What are you animating?

├── Simple hover/focus states?
│   └── CSS transitions/animations
│
├── Page/route transitions?
│   ├── Modern browsers only? → View Transitions API
│   └── Cross-browser? → Framer Motion AnimatePresence
│
├── Scroll-linked animations?
│   ├── Simple reveals? → CSS animation-timeline / Intersection Observer
│   ├── Complex timelines? → GSAP ScrollTrigger
│   └── React scroll progress? → Framer Motion useScroll
│
├── Physics-based motion?
│   ├── UI transitions? → Framer Motion (spring animations)
│   └── Full physics control? → React Spring
│
├── Complex choreographed sequences?
│   └── GSAP timelines
│
├── Micro-interactions?
│   ├── CSS-only possible? → CSS transitions
│   └── Need gesture support? → Framer Motion
│
└── Always remember:
    ├── GPU-accelerated properties only (transform, opacity)
    ├── Respect prefers-reduced-motion
    ├── 150-300ms for micro, 300-500ms for page transitions
    └── Test on low-end devices
```

---

## Sources

### Framer Motion
- [Magic UI - Guide to Framer Motion React Animation](https://magicui.design/blog/framer-motion-react)
- [Maxime Heckel - Advanced Animation Patterns](https://blog.maximeheckel.com/posts/advanced-animation-patterns-with-framer-motion/)
- [Framer Motion Official Docs](https://www.framer.com/motion/component/)
- [Luxis Design - Mastering Framer Motion 2025](https://www.luxisdesign.io/blog/mastering-framer-motion-advanced-animation-techniques-for-2025)

### CSS Animations
- [MDN - CSS and JavaScript Animation Performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance)
- [Lexo - CSS GPU Acceleration Guide](https://www.lexo.ch/blog/2025/01/boost-css-performance-with-will-change-and-transform-translate3d-why-gpu-acceleration-matters/)
- [Motion Magazine - Web Animation Performance Tier List](https://motion.dev/blog/web-animation-performance-tier-list)

### View Transitions API
- [MDN - View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [Chrome Developers - View Transitions 2025 Update](https://developer.chrome.com/blog/view-transitions-in-2025)
- [React Labs - View Transitions](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more)
- [React Router - View Transitions](https://reactrouter.com/how-to/view-transitions)

### GSAP
- [GSAP - ScrollTrigger Documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [GSAPify - ScrollTrigger Complete Guide 2025](https://gsapify.com/gsap-scrolltrigger)
- [LogRocket - GSAP ScrollTrigger in React](https://blog.logrocket.com/how-to-use-the-gsap-scrolltrigger-plugin-in-react/)

### React Spring
- [SitePoint - React Spring Interactive Animations](https://www.sitepoint.com/react-spring-interactive-animations/)
- [LogRocket - Animations with React Spring](https://blog.logrocket.com/animations-with-react-spring/)
- [React Spring Official Examples](https://react-spring.dev/examples)

### Performance
- [Chrome Developers - Hardware Accelerated Animations](https://developer.chrome.com/blog/hardware-accelerated-animations)
- [TestMu - CSS GPU Acceleration](https://www.testmu.ai/blog/css-gpu-acceleration/)

### Accessibility
- [MDN - prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- [Pope Tech - Accessible Animation](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)
- [W3C - Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)

### Scroll Animations
- [CSS-Tricks - Scroll-Driven Animations](https://css-tricks.com/unleash-the-power-of-scroll-driven-animations/)
- [CSS-Tricks - Creating Scroll-Based Animations](https://css-tricks.com/creating-scroll-based-animations-in-full-view/)

### Page Transitions
- [Creole Studios - View Transitions in React](https://medium.com/@creolestudios/view-transitions-in-react-how-to-build-smooth-page-transitions-without-spa-headaches-48f1dca22176)
- [Smashing Magazine - View Transitions API](https://www.smashingmagazine.com/2024/01/view-transitions-api-ui-animations-part2/)

### Micro-Interactions
- [Bricx Labs - Micro Animation Examples 2025](https://bricxlabs.com/blogs/micro-interactions-2025-examples)
- [Beta Soft Technology - Motion UI Trends 2025](https://www.betasofttechnology.com/motion-ui-trends-and-micro-interactions/)
- [Stan Vision - Micro Interactions 2025](https://www.stan.vision/journal/micro-interactions-2025-in-web-design)
- [Mockplus - Button State Design](https://www.mockplus.com/blog/post/button-state-design)
