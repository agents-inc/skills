# CSS Animations Best Practices Research (2025/2026)

> **Research Date:** January 2026
> **Focus:** Modern CSS animation techniques, performance optimization, accessibility, and emerging browser features

---

## Table of Contents

1. [Core Concepts: Transitions vs Animations vs WAAPI](#core-concepts)
2. [GPU-Accelerated Properties](#gpu-accelerated-properties)
3. [Performance-First Principles](#performance-first-principles)
4. [CSS Custom Properties for Animation](#css-custom-properties-for-animation)
5. [Accessibility: prefers-reduced-motion](#accessibility-prefers-reduced-motion)
6. [Modern CSS Features](#modern-css-features)
   - [View Transitions API](#view-transitions-api)
   - [Scroll-Driven Animations](#scroll-driven-animations)
   - [linear() Easing Function](#linear-easing-function)
7. [Web Animations API (WAAPI)](#web-animations-api-waapi)
8. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
9. [Decision Framework](#decision-framework)
10. [Sources](#sources)

---

## Core Concepts

### Transitions vs Animations vs WAAPI

| Feature | CSS Transitions | CSS Animations | Web Animations API |
|---------|-----------------|----------------|-------------------|
| **Trigger** | State change (hover, focus) | Automatic or class-based | JavaScript |
| **Keyframes** | 2 states (from/to) | Multiple keyframes | Multiple keyframes |
| **Looping** | No native support | `animation-iteration-count` | `iterations: Infinity` |
| **Control** | Limited | Limited | Full (play, pause, reverse, seek) |
| **Complexity** | Simple | Medium | Complex |
| **Use Case** | Hover effects, state changes | Loading spinners, attention | Interactive, dynamic |

### When to Use Each

**CSS Transitions** - Best for:
```css
/* Simple state changes triggered by user interaction */
.button {
  background-color: var(--color-primary);
  transition: background-color 200ms ease-out, transform 150ms ease-out;
}

.button:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-2px);
}
```

**CSS Animations** - Best for:
```css
/* Autonomous, multi-step, or looping animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-indicator {
  animation: pulse 1.5s ease-in-out infinite;
}
```

**Web Animations API** - Best for:
```javascript
// Dynamic, interactive, or state-dependent animations
element.animate(
  [
    { transform: 'translateX(0)' },
    { transform: `translateX(${dynamicValue}px)` }
  ],
  { duration: 300, easing: 'ease-out', fill: 'forwards' }
);
```

---

## GPU-Accelerated Properties

### The Golden Rule

**Only animate `transform` and `opacity` for 60fps performance.**

These properties:
- Do not trigger layout recalculation
- Do not require repaint
- Are composited on the GPU
- Run on a separate thread from JavaScript

```css
/* GOOD - GPU accelerated */
.card {
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}

.card:hover {
  transform: translateY(-8px) scale(1.02);
  opacity: 0.95;
}

/* BAD - Triggers layout/repaint */
.card:hover {
  top: -8px;           /* Triggers layout */
  width: 102%;         /* Triggers layout */
  background-color: #f00; /* Triggers repaint */
}
```

### Using `will-change` Correctly

```css
/* GOOD - Applied temporarily before animation */
.card {
  /* No will-change by default */
}

.card:hover {
  will-change: transform;
  transform: scale(1.05);
}

/* Remove after animation completes (via JS or transitionend) */
```

```javascript
// JavaScript approach for complex animations
element.addEventListener('mouseenter', () => {
  element.style.willChange = 'transform';
});

element.addEventListener('transitionend', () => {
  element.style.willChange = 'auto';
});
```

**will-change Pitfalls:**
- Each element with `will-change` creates a new compositing layer
- A 320x240px element consumes ~307KB of GPU memory
- Overuse crashes browsers on mobile devices
- Use as last resort, not preventively

### Transform Property Breakdown

```css
/* Individual transform properties (cleaner, easier to optimize) */
.element {
  translate: 0 0;
  scale: 1;
  rotate: 0deg;
}

.element:hover {
  translate: 0 -10px;
  scale: 1.05;
  rotate: 5deg;
}

/* Combined transform (use when properties must animate together) */
.element {
  transform: translateY(0) scale(1) rotate(0deg);
}
```

---

## Performance-First Principles

### The 16.67ms Budget

For 60fps, each frame must complete in 16.67ms. Exceeding this causes jank.

```css
/* Performance-optimized animation */
@keyframes slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.modal {
  animation: slide-in 300ms ease-out forwards;
}
```

### Duration Guidelines

| Animation Type | Recommended Duration | Reason |
|---------------|---------------------|--------|
| Micro-interactions | 100-200ms | Feels instant |
| UI transitions | 200-300ms | Sweet spot |
| Page transitions | 300-500ms | Noticeable but quick |
| Complex animations | 500-1000ms | Story-telling |

```css
:root {
  /* Animation duration tokens */
  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  /* Easing tokens */
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

### Stagger Animations to Prevent Jank

```css
/* Avoid: Multiple simultaneous animations */
.card {
  animation: fade-in 300ms ease-out;
}

/* Better: Staggered animations */
.card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2) { animation-delay: 50ms; }
.card:nth-child(3) { animation-delay: 100ms; }
.card:nth-child(4) { animation-delay: 150ms; }

/* Best: CSS custom properties for dynamic stagger */
.card {
  animation: fade-in 300ms ease-out backwards;
  animation-delay: calc(var(--index) * 50ms);
}
```

```javascript
// Set index via JavaScript
cards.forEach((card, index) => {
  card.style.setProperty('--index', index);
});
```

---

## CSS Custom Properties for Animation

### Typed Custom Properties with @property

```css
/* Define typed custom properties for animation */
@property --gradient-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@property --progress {
  syntax: '<number>';
  initial-value: 0;
  inherits: false;
}

/* Now these can be animated! */
.gradient-border {
  background: linear-gradient(var(--gradient-angle), #ff0080, #7928ca);
  animation: rotate-gradient 3s linear infinite;
}

@keyframes rotate-gradient {
  to {
    --gradient-angle: 360deg;
  }
}
```

### Animation Token System

```css
:root {
  /* Duration tokens */
  --dur-instant: 100ms;
  --dur-fast: 150ms;
  --dur-normal: 250ms;
  --dur-slow: 400ms;
  --dur-slower: 600ms;

  /* Easing tokens */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* Reusable animation configurations */
  --transition-default: var(--dur-normal) var(--ease-default);
  --transition-fast: var(--dur-fast) var(--ease-out);
}

.button {
  transition: transform var(--transition-fast),
              background-color var(--transition-default);
}
```

---

## Accessibility: prefers-reduced-motion

### Core Implementation Pattern

```css
/* Approach 1: Remove motion when reduced motion is preferred */
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

/* Approach 2: Only apply motion when NO preference (recommended) */
.card {
  /* Base styles - no animation */
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: no-preference) {
  .card {
    animation: fade-slide-in 300ms ease-out;
  }
}
```

### Provide Alternative Animations

```css
/* Full motion experience */
@media (prefers-reduced-motion: no-preference) {
  .notification {
    animation: slide-in-bounce 400ms ease-out;
  }
}

/* Reduced motion alternative - use opacity instead of movement */
@media (prefers-reduced-motion: reduce) {
  .notification {
    animation: fade-in 200ms ease-out;
  }
}

@keyframes slide-in-bounce {
  0% { transform: translateX(100%); opacity: 0; }
  70% { transform: translateX(-10px); }
  100% { transform: translateX(0); opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### JavaScript Detection

```javascript
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
);

// Initial check
if (prefersReducedMotion.matches) {
  // Disable JS animations
}

// Listen for changes
prefersReducedMotion.addEventListener('change', (event) => {
  if (event.matches) {
    // User enabled reduced motion
    pauseAllAnimations();
  } else {
    // User disabled reduced motion
    resumeAnimations();
  }
});
```

### Conditional Asset Loading

```html
<!-- Load animated assets only when motion is acceptable -->
<picture>
  <source
    srcset="hero-animation.webp"
    type="image/webp"
    media="(prefers-reduced-motion: no-preference)">
  <img src="hero-static.jpg" alt="Hero image">
</picture>
```

---

## Modern CSS Features

### View Transitions API

**Browser Support (2025):** Chrome 111+, Edge 111+, Safari 18+, Firefox 144+

#### Same-Document Transitions (SPAs)

```javascript
// Basic view transition
document.startViewTransition(() => {
  // Update DOM here
  updateContent(newContent);
});

// With async operations
document.startViewTransition(async () => {
  const data = await fetchData();
  renderData(data);
});
```

```css
/* Customize the transition */
::view-transition-old(root) {
  animation: fade-out 300ms ease-out;
}

::view-transition-new(root) {
  animation: fade-in 300ms ease-out;
}

/* Named transitions for specific elements */
.hero-image {
  view-transition-name: hero;
}

::view-transition-old(hero),
::view-transition-new(hero) {
  animation-duration: 500ms;
}
```

#### Cross-Document Transitions (MPAs)

```css
/* Enable on both pages */
@view-transition {
  navigation: auto;
}

/* Page-specific customization */
@view-transition {
  navigation: auto;
  types: slide-left;
}
```

#### Auto-Naming with match-element (Chrome 137+)

```css
/* Automatically generate unique names for list items */
.product-card {
  view-transition-name: match-element;
}

/* Style all product cards collectively */
.product-card {
  view-transition-class: card;
}

::view-transition-group(.card) {
  animation-duration: 400ms;
}
```

### Scroll-Driven Animations

**Browser Support (2025):** Chrome 115+, Edge 115+, Firefox (flag), Safari 26 beta

#### Scroll Progress Timeline

```css
/* Animate based on page scroll */
.progress-bar {
  transform-origin: left;
  animation: grow-width linear;
  animation-timeline: scroll();
}

@keyframes grow-width {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

#### View Progress Timeline

```css
/* Animate when element enters viewport */
.reveal-on-scroll {
  animation: fade-slide-in linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 40%;
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(100px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Named Scroll Timeline

```css
/* Define timeline on scroll container */
.scroll-container {
  overflow-y: scroll;
  scroll-timeline: --container-scroll block;
}

/* Use timeline on descendant */
.parallax-bg {
  animation: parallax linear;
  animation-timeline: --container-scroll;
}

@keyframes parallax {
  from { transform: translateY(0); }
  to { transform: translateY(-50%); }
}
```

#### Animation Range Control

```css
.element {
  animation: reveal linear;
  animation-timeline: view();

  /* Start at 25% entry, end at 75% cover */
  animation-range: entry 25% cover 75%;

  /* Or use longhand */
  animation-range-start: entry 25%;
  animation-range-end: cover 75%;
}
```

### linear() Easing Function

**Browser Support (2025):** Chrome 113+, Edge 113+, Firefox 112+

```css
/* Simple linear with custom curve */
.bounce-in {
  animation-timing-function: linear(
    0, 0.25, 0.5, 0.75, 1, 0.95, 0.9, 0.95, 1
  );
}

/* Precise control with percentages */
.elastic {
  animation-timing-function: linear(
    0,
    0.22 27.27%,
    0.59 40.91%,
    0.81 50%,
    0.94 59.09%,
    0.99 68.18%,
    1 77.27%,
    0.99 86.36%,
    1
  );
}

/* Overshoot effect */
.overshoot {
  animation-timing-function: linear(
    0,
    0.7 30%,
    1.1 70%,
    1
  );
}
```

#### Fallback Pattern

```css
.element {
  /* Fallback for unsupported browsers */
  animation: slide-in 300ms ease-out;
  /* Modern browsers use linear() */
  animation-timing-function: linear(0, 0.5 20%, 1);
}

/* Or with @supports */
@supports (animation-timing-function: linear(0, 1)) {
  .element {
    animation-timing-function: linear(0, 0.7 30%, 1.1 70%, 1);
  }
}
```

---

## Web Animations API (WAAPI)

### Basic Usage

```javascript
// Simple animation
const animation = element.animate(
  [
    { transform: 'translateX(0)', opacity: 1 },
    { transform: 'translateX(100px)', opacity: 0 }
  ],
  {
    duration: 300,
    easing: 'ease-out',
    fill: 'forwards'
  }
);

// With offset for non-uniform keyframes
const bounceAnimation = element.animate(
  [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-30px)', offset: 0.3 },
    { transform: 'translateY(0)' }
  ],
  { duration: 500, easing: 'ease-in-out' }
);
```

### Playback Control

```javascript
const anim = element.animate(keyframes, options);

// Control methods
anim.play();
anim.pause();
anim.reverse();
anim.finish();
anim.cancel();

// Playback rate
anim.playbackRate = 2;    // 2x speed
anim.playbackRate = 0.5;  // Half speed
anim.playbackRate = -1;   // Reverse

// Seek to specific time
anim.currentTime = 150;   // 150ms into animation

// Dynamic rate change (smooth)
anim.updatePlaybackRate(1.5);
```

### Promises and Events

```javascript
// Promise-based
animation.finished.then(() => {
  console.log('Animation complete');
  element.remove();
});

// Event-based
animation.onfinish = () => {
  console.log('Finished');
};

animation.oncancel = () => {
  console.log('Cancelled');
};
```

### Committing Styles

```javascript
// Instead of keeping animation active with fill: forwards
animation.finished.then(() => {
  animation.commitStyles();
  animation.cancel();
});
```

### Getting All Animations

```javascript
// Reduce motion for accessibility
if (prefersReducedMotion.matches) {
  document.getAnimations().forEach(animation => {
    animation.finish();
  });
}

// Pause all animations when tab is hidden
document.addEventListener('visibilitychange', () => {
  const method = document.hidden ? 'pause' : 'play';
  document.getAnimations().forEach(anim => anim[method]());
});
```

---

## Anti-Patterns to Avoid

### Performance Anti-Patterns

```css
/* BAD: Animating layout properties */
.card:hover {
  width: 110%;        /* Triggers layout */
  height: auto;       /* Triggers layout */
  margin-top: -10px;  /* Triggers layout */
  left: 10px;         /* Triggers layout */
}

/* GOOD: Use transform instead */
.card:hover {
  transform: scale(1.1) translateY(-10px);
}
```

```css
/* BAD: Animating box-shadow (expensive) */
.card {
  transition: box-shadow 300ms;
}
.card:hover {
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
}

/* GOOD: Animate pseudo-element opacity */
.card {
  position: relative;
}
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  opacity: 0;
  transition: opacity 300ms;
}
.card:hover::after {
  opacity: 1;
}
```

### will-change Abuse

```css
/* BAD: Applying will-change to everything */
* {
  will-change: transform;  /* Memory disaster */
}

/* BAD: Permanent will-change */
.card {
  will-change: transform, opacity;  /* Always active */
}

/* GOOD: Apply only when needed */
.card:hover {
  will-change: transform;
}

/* BEST: Remove after animation */
.card.animating {
  will-change: transform;
}
```

### Accessibility Anti-Patterns

```css
/* BAD: No reduced motion consideration */
.hero {
  animation: bounce 1s infinite;
}

/* GOOD: Respect user preferences */
@media (prefers-reduced-motion: no-preference) {
  .hero {
    animation: bounce 1s infinite;
  }
}
```

### Timing Anti-Patterns

```css
/* BAD: Linear easing for UI (feels robotic) */
.button {
  transition: transform 300ms linear;
}

/* GOOD: Natural easing */
.button {
  transition: transform 300ms ease-out;
}

/* BAD: Too slow for micro-interactions */
.button:hover {
  transition: transform 800ms;
}

/* GOOD: Snappy micro-interactions */
.button:hover {
  transition: transform 150ms ease-out;
}
```

### Animation Cleanup

```javascript
// BAD: Memory leak from uncleaned animations
function animateElement() {
  element.animate(keyframes, { fill: 'forwards' });
  // Animation stays active forever
}

// GOOD: Clean up after animation
function animateElement() {
  const animation = element.animate(keyframes, { fill: 'forwards' });
  animation.finished.then(() => {
    animation.commitStyles();
    animation.cancel();
  });
}
```

---

## Decision Framework

```
Need animation?
├─ Is it triggered by user interaction (hover, focus, click)?
│   ├─ YES → Is it a simple A→B transition?
│   │   ├─ YES → CSS Transition
│   │   └─ NO → CSS Animation or WAAPI
│   └─ NO → Does it need to loop or auto-play?
│       ├─ YES → CSS Animation with @keyframes
│       └─ NO → CSS Transition (triggered by class toggle)
│
├─ Does it need JavaScript control (pause, reverse, seek)?
│   └─ YES → Web Animations API
│
├─ Is it scroll-based?
│   └─ YES → Scroll-Driven Animations (animation-timeline: scroll())
│
├─ Is it a page/view transition?
│   └─ YES → View Transitions API
│
└─ Does it need complex easing beyond cubic-bezier?
    └─ YES → linear() function or WAAPI
```

### Property Selection

```
Which property to animate?
├─ Movement → transform: translate()
├─ Scaling → transform: scale()
├─ Rotation → transform: rotate()
├─ Visibility → opacity
├─ Color change → Acceptable but avoid if possible
└─ Size change → Avoid! Use transform: scale() instead
```

---

## Sources

### Official Documentation
- [MDN CSS Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations/Using)
- [MDN CSS Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions/Using_CSS_transitions)
- [MDN Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- [MDN Scroll-Driven Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
- [MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)

### Browser Vendor Resources
- [Chrome View Transitions 2025 Updates](https://developer.chrome.com/blog/view-transitions-in-2025)
- [Chrome Hardware Accelerated Animations](https://developer.chrome.com/blog/hardware-accelerated-animations)
- [WebKit Scroll-Driven Animations Guide](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/)

### Expert Blogs & Articles
- [Josh W. Comeau - Keyframe Animations](https://www.joshwcomeau.com/animation/keyframe-animations/)
- [Josh W. Comeau - Partial Keyframes](https://www.joshwcomeau.com/animation/partial-keyframes/)
- [Josh Collinsworth - Ten Tips for Better Transitions](https://joshcollinsworth.com/blog/great-transitions)
- [Smashing Magazine - GPU Animation](https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/)
- [Smashing Magazine - Keyframes Tokens](https://www.smashingmagazine.com/2025/11/keyframes-tokens-standardizing-animation-across-projects/)
- [Smashing Magazine - Scroll-Driven Animations](https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/)
- [CSS-Tricks - linear() Easing](https://css-tricks.com/creating-scroll-based-animations-in-full-view/)
- [web.dev - prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)

### Performance Resources
- [MDN Animation Performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate)
- [Algolia - 60 FPS Animations](https://www.algolia.com/blog/engineering/60-fps-performant-web-animations-for-optimal-ux)
- [Lexo - GPU Acceleration Guide](https://www.lexo.ch/blog/2025/01/boost-css-performance-with-will-change-and-transform-translate3d-why-gpu-acceleration-matters/)

### Accessibility Resources
- [W3C WCAG - Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [W3C - CSS prefers-reduced-motion Technique](https://www.w3.org/WAI/WCAG21/Techniques/css/C39)
- [Pope Tech - Accessible Animation](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)
