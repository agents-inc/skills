# View Transitions API Best Practices Research

> Research Date: 2026-01-17
> Purpose: Comprehensive skill creation for View Transitions API
> Status: Complete

---

## Table of Contents

1. [Core Concepts and Browser Support](#1-core-concepts-and-browser-support)
2. [Same-Document (SPA) Transitions](#2-same-document-spa-transitions)
3. [Cross-Document (MPA) Transitions](#3-cross-document-mpa-transitions)
4. [Pseudo-Element Tree and CSS Animations](#4-pseudo-element-tree-and-css-animations)
5. [Framework Integration](#5-framework-integration)
6. [view-transition-name Patterns](#6-view-transition-name-patterns)
7. [Performance Considerations](#7-performance-considerations)
8. [Accessibility Requirements](#8-accessibility-requirements)
9. [Anti-Patterns and Common Mistakes](#9-anti-patterns-and-common-mistakes)
10. [Practical Examples](#10-practical-examples)

---

## 1. Core Concepts and Browser Support

### What is the View Transition API?

The View Transition API provides a mechanism for easily creating animated transitions between different website views. It enables:

- Animating between DOM states in single-page applications (SPAs)
- Animating navigation between documents in multi-page applications (MPAs)
- Shared element transitions (hero animations)
- Reducing cognitive load and perceived loading latency

### Browser Support (2025/2026)

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Same-document transitions | 111+ | 18+ | 144+ | 111+ |
| Cross-document transitions | 126+ | Partial | Planned | 126+ |
| `view-transition-class` | 125+ | 18+ | 144+ | 125+ |
| `match-element` auto-naming | 137+ | 18.4+ | Planned | 137+ |
| Scoped view transitions | 140+ (flag) | - | - | 140+ (flag) |

**Baseline Status:** Same-document view transitions became "Baseline Newly Available" in October 2025 with Firefox 144 release.

### Key API Components

| Component | Description |
|-----------|-------------|
| `document.startViewTransition()` | Starts a same-document transition |
| `ViewTransition` object | Represents active transition with promise members |
| `@view-transition` CSS at-rule | Opts pages into cross-document transitions |
| `view-transition-name` CSS property | Names elements for individual transitions |
| `::view-transition-*` pseudo-elements | Style transition animations |

---

## 2. Same-Document (SPA) Transitions

### Basic Pattern

```typescript
// Constants
const TRANSITION_TIMEOUT_MS = 4000;

// Feature detection with fallback
function updateWithTransition(updateFn: () => void | Promise<void>): void {
  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  document.startViewTransition(() => updateFn());
}

// Usage
function handleNavigation(): void {
  updateWithTransition(() => {
    setCurrentPage('details');
  });
}
```

### ViewTransition Object

The `startViewTransition()` method returns a `ViewTransition` object with promise members:

```typescript
interface ViewTransitionPromises {
  ready: Promise<void>;           // Pseudo-element tree created, animation about to start
  updateCallbackDone: Promise<void>; // DOM update callback completed
  finished: Promise<void>;        // Transition complete, new view visible
}

// Usage example
async function navigateWithTransition(to: string): Promise<void> {
  if (!document.startViewTransition) {
    navigate(to);
    return;
  }

  const transition = document.startViewTransition(() => {
    navigate(to);
  });

  // Wait for pseudo-element tree to be ready (for custom animations)
  await transition.ready;

  // Custom Web Animations API animation
  document.documentElement.animate(
    { opacity: [0, 1] },
    {
      duration: 300,
      easing: 'ease-out',
      pseudoElement: '::view-transition-new(root)',
    }
  );

  await transition.finished;
  console.log('Transition complete');
}
```

### How It Works Internally

1. Browser captures snapshot of current state ("old" view)
2. Callback executes, updating the DOM
3. Browser captures snapshot of new state ("new" view)
4. Creates pseudo-element tree overlaying the page
5. Animates from old to new (default: cross-fade)
6. Removes pseudo-elements, reveals live DOM

**Important:** The old view is a static screenshot, but the new view is a "live representation" allowing dynamic content like videos to continue playing.

---

## 3. Cross-Document (MPA) Transitions

### Enabling Cross-Document Transitions

Cross-document transitions require no JavaScript. Enable with CSS on **both** pages:

```css
/* Both origin and destination pages must include this */
@view-transition {
  navigation: auto;
}
```

### Navigation Descriptor Values

| Value | Description |
|-------|-------------|
| `auto` | Enable for `traverse`, `push`, `replace` navigations |
| `none` | Disable view transitions (default) |

### Events for Customization

```typescript
// pageswap - fires before final frame on outgoing page
window.addEventListener('pageswap', (e) => {
  if (e.viewTransition) {
    const fromUrl = new URL(e.activation.from.url);
    const toUrl = new URL(e.activation.entry.url);

    // Dynamically set view-transition-name based on navigation
    const productId = extractProductId(toUrl);
    if (productId) {
      const thumbnail = document.querySelector(`[data-product="${productId}"]`);
      if (thumbnail) {
        thumbnail.style.viewTransitionName = 'product-hero';
      }
    }

    // Clean up after transition
    e.viewTransition.finished.then(() => {
      // Remove temporary names
    });
  }
});

// pagereveal - fires after DOM initialized on incoming page
window.addEventListener('pagereveal', (e) => {
  if (e.viewTransition) {
    // Customize incoming page before first render
    const heroImage = document.querySelector('.hero-image');
    if (heroImage) {
      heroImage.style.viewTransitionName = 'product-hero';
    }

    e.viewTransition.ready.then(() => {
      // Names can be removed after snapshots taken
      heroImage?.style.removeProperty('view-transition-name');
    });
  }
});
```

**Critical:** Register `pagereveal` listeners in parser-blocking scripts within `<head>`, or mark async scripts with `blocking="render"`.

### Navigation Types

Use `:active-view-transition-type()` for direction-aware animations:

```css
/* Forward navigation */
html:active-view-transition-type(forwards) {
  &::view-transition-old(content) {
    animation-name: slide-out-left;
  }
  &::view-transition-new(content) {
    animation-name: slide-in-right;
  }
}

/* Backward navigation */
html:active-view-transition-type(backwards) {
  &::view-transition-old(content) {
    animation-name: slide-out-right;
  }
  &::view-transition-new(content) {
    animation-name: slide-in-left;
  }
}
```

Set types dynamically:

```typescript
window.addEventListener('pagereveal', (e) => {
  if (e.viewTransition) {
    const from = new URL(navigation.activation.from.url);
    const current = new URL(navigation.activation.entry.url);

    if (isDetailPage(current) && isListPage(from)) {
      e.viewTransition.types.add('forwards');
    } else if (isListPage(current) && isDetailPage(from)) {
      e.viewTransition.types.add('backwards');
    }
  }
});
```

---

## 4. Pseudo-Element Tree and CSS Animations

### Pseudo-Element Hierarchy

```
::view-transition                          /* Root overlay */
├── ::view-transition-group(root)          /* Container for root snapshot */
│   └── ::view-transition-image-pair(root)
│       ├── ::view-transition-old(root)    /* Old state (screenshot) */
│       └── ::view-transition-new(root)    /* New state (live) */
└── ::view-transition-group(hero-image)    /* Named element container */
    └── ::view-transition-image-pair(hero-image)
        ├── ::view-transition-old(hero-image)
        └── ::view-transition-new(hero-image)
```

### Pseudo-Element Descriptions

| Pseudo-Element | Purpose | Default Animation |
|----------------|---------|-------------------|
| `::view-transition` | Root overlay above all content | None |
| `::view-transition-group(*)` | Container for each snapshot pair | Width/height/transform |
| `::view-transition-image-pair(*)` | Wraps old and new snapshots | None |
| `::view-transition-old(*)` | Static screenshot of old state | `opacity: 1 -> 0` |
| `::view-transition-new(*)` | Live representation of new state | `opacity: 0 -> 1` |

### Custom Animations

#### Modify Default Duration

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 400ms;
}
```

#### Slide Transition

```css
@keyframes slide-out-left {
  to {
    transform: translateX(-100%);
  }
}

@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
}

::view-transition-old(root) {
  animation: slide-out-left 300ms ease-in-out;
}

::view-transition-new(root) {
  animation: slide-in-right 300ms ease-in-out;
}
```

#### Scale and Fade

```css
@keyframes scale-down {
  to {
    transform: scale(0.9);
    opacity: 0;
  }
}

@keyframes scale-up {
  from {
    transform: scale(1.1);
    opacity: 0;
  }
}

::view-transition-old(root) {
  animation: scale-down 250ms ease-in;
}

::view-transition-new(root) {
  animation: scale-up 250ms ease-out;
}
```

#### Circular Reveal (JavaScript + Web Animations API)

```typescript
let lastClickPosition = { x: 0, y: 0 };

document.addEventListener('click', (e) => {
  lastClickPosition = { x: e.clientX, y: e.clientY };
});

async function navigateWithCircularReveal(updateFn: () => void): Promise<void> {
  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  const { x, y } = lastClickPosition;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = document.startViewTransition(updateFn);

  await transition.ready;

  document.documentElement.animate(
    {
      clipPath: [
        `circle(0 at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ],
    },
    {
      duration: 500,
      easing: 'ease-in-out',
      pseudoElement: '::view-transition-new(root)',
    }
  );
}
```

Supporting CSS:

```css
::view-transition-image-pair(root) {
  isolation: auto;
}

::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
  display: block;
}
```

---

## 5. Framework Integration

### React (Native ViewTransition Component)

React's experimental `<ViewTransition>` component (Canary/Experimental channels):

```tsx
import { ViewTransition, startTransition } from 'react';

// Basic enter/exit animation
function AnimatedChild({ show }: { show: boolean }) {
  return show ? (
    <ViewTransition>
      <div className="content">Animated content</div>
    </ViewTransition>
  ) : null;
}

function Parent() {
  const [show, setShow] = useState(false);

  const handleToggle = () => {
    // Must wrap in startTransition for ViewTransition to activate
    startTransition(() => {
      setShow((prev) => !prev);
    });
  };

  return (
    <>
      <button onClick={handleToggle}>Toggle</button>
      <AnimatedChild show={show} />
    </>
  );
}
```

#### Shared Element Transitions

```tsx
const THUMBNAIL_NAME = 'video-thumbnail';

function Thumbnail({ video, onSelect }: ThumbnailProps) {
  return (
    <ViewTransition name={THUMBNAIL_NAME}>
      <button onClick={() => startTransition(() => onSelect(video.id))}>
        <img src={video.thumbnail} alt={video.title} />
      </button>
    </ViewTransition>
  );
}

function FullscreenVideo({ video, onExit }: FullscreenProps) {
  return (
    <ViewTransition name={THUMBNAIL_NAME}>
      <div className="fullscreen">
        <video src={video.src} autoPlay />
        <button onClick={() => startTransition(() => onExit())}>Close</button>
      </div>
    </ViewTransition>
  );
}
```

**Critical:** Only one `<ViewTransition>` with the same name can be mounted simultaneously.

#### ViewTransition Props

| Prop | Type | Description |
|------|------|-------------|
| `enter` | `string \| object` | Class applied when element enters |
| `exit` | `string \| object` | Class applied when element exits |
| `update` | `string \| object` | Class applied during DOM mutations |
| `share` | `string \| object` | Class for shared element transitions |
| `name` | `string` | Unique identifier for shared elements |

#### React Router Integration

```tsx
import { Link, NavLink, useViewTransitionState } from 'react-router-dom';

function ProductCard({ product }: { product: Product }) {
  const href = `/products/${product.id}`;
  const isTransitioning = useViewTransitionState(href);

  return (
    <Link
      to={href}
      viewTransition
      style={{
        viewTransitionName: isTransitioning ? `product-${product.id}` : '',
      }}
    >
      <img
        src={product.image}
        alt={product.name}
        style={{
          viewTransitionName: isTransitioning ? `product-image-${product.id}` : '',
        }}
      />
      <h3>{product.name}</h3>
    </Link>
  );
}
```

### Vue Integration

Using `vue-view-transitions` library:

```vue
<script setup lang="ts">
import { useViewTransition } from 'vue-view-transitions';

const { startViewTransition } = useViewTransition();

async function handleNavigation() {
  await startViewTransition(() => {
    // Update state
    currentPage.value = 'details';
  });
}
</script>

<template>
  <div v-view-transition-name="'hero-image'">
    <img :src="imageUrl" />
  </div>
</template>
```

Vue core integration uses `nextTick` to await DOM updates:

```typescript
import { nextTick } from 'vue';

async function updateWithTransition(updateFn: () => void) {
  if (!document.startViewTransition) {
    updateFn();
    await nextTick();
    return;
  }

  const transition = document.startViewTransition(async () => {
    updateFn();
    await nextTick();
  });

  await transition.finished;
}
```

### Nuxt Integration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    viewTransition: true,
  },
});
```

```vue
<template>
  <NuxtPage />
</template>

<style>
@view-transition {
  navigation: auto;
}
</style>
```

### Angular Integration (17+)

```typescript
import { provideRouter, withViewTransitions } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withViewTransitions()
    ),
  ],
};
```

### Next.js Integration

```typescript
// next.config.js
module.exports = {
  experimental: {
    viewTransition: true,
  },
};
```

```tsx
// Using with App Router
'use client';

import { ViewTransition } from 'react';

function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <ViewTransition name="product-hero">
      <img src={src} alt={alt} />
    </ViewTransition>
  );
}
```

---

## 6. view-transition-name Patterns

### Basic Usage

```css
.hero-image {
  view-transition-name: hero;
}

.page-title {
  view-transition-name: title;
}
```

### Valid Values

| Value | Description |
|-------|-------------|
| `none` | Element doesn't participate (default) |
| `<custom-ident>` | Unique identifier for the element |
| `match-element` | Auto-generate name based on element identity |
| `root` | Reserved for document root (auto-applied) |

### Naming Rules

- Must be a valid CSS `<custom-ident>`
- Cannot use reserved words: `inherit`, `unset`, `auto`, `none`
- Cannot start with a number
- Cannot contain forward slashes

```css
/* Valid */
view-transition-name: hero-image;
view-transition-name: product-123;
view-transition-name: my_element;

/* Invalid */
view-transition-name: auto;        /* Reserved */
view-transition-name: 123-product; /* Starts with number */
view-transition-name: item/detail; /* Contains slash */
```

### Auto-Naming with match-element (Chrome 137+)

For large lists without manually naming each element:

```css
.product-card {
  view-transition-name: match-element;
  view-transition-class: card;
}
```

The browser generates unique internal names based on element identity.

### Dynamic Names with attr() (Chrome 133+)

```css
.card[id] {
  view-transition-name: attr(id type(<custom-ident>), none);
  view-transition-class: card;
}
```

```html
<div class="card" id="product-001">...</div>
<div class="card" id="product-002">...</div>
```

### view-transition-class for Grouped Styling

Style multiple named elements together:

```css
.card {
  view-transition-name: var(--card-name);
  view-transition-class: card-transition;
}

::view-transition-group(.card-transition) {
  animation-duration: 300ms;
  animation-timing-function: ease-out;
}
```

### Dynamic Name Assignment

```typescript
// Apply names just before transition
function setTransitionNames(elements: [HTMLElement, string][]): void {
  elements.forEach(([el, name]) => {
    el.style.viewTransitionName = name;
  });
}

// Clean up after transition
async function transitionWithNames(
  elements: [HTMLElement, string][],
  updateFn: () => void
): Promise<void> {
  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  setTransitionNames(elements);

  const transition = document.startViewTransition(updateFn);

  await transition.finished;

  // Remove names to avoid conflicts
  elements.forEach(([el]) => {
    el.style.viewTransitionName = '';
  });
}
```

---

## 7. Performance Considerations

### Core Web Vitals Impact

Real-user monitoring shows:

- **LCP Impact:** Approximately 70ms added to Largest Contentful Paint for repeat mobile pageviews
- **CPU Correlation:** Slower CPUs experience more pronounced negative effects
- **INP Concern:** Long animations can harm Interaction to Next Paint

### Optimization Strategies

#### 1. Selective Implementation

```typescript
// Only enable on capable devices
function shouldEnableTransitions(): boolean {
  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }

  // Check for low-end device indicators
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || connection?.effectiveType === 'slow-2g') {
    return false;
  }

  return 'startViewTransition' in document;
}
```

#### 2. Keep Animations Short

```css
/* Recommended durations */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms; /* Max 300ms for page transitions */
}
```

#### 3. Use Speculation Rules for MPA

```html
<script type="speculationrules">
{
  "prerender": [
    { "source": "list", "urls": ["/products", "/about"] }
  ]
}
</script>
```

Combined with view transitions, prerendering makes transitions feel instant.

#### 4. Avoid Heavy Paint Operations

```css
/* Prefer transform/opacity over layout-triggering properties */
::view-transition-group(card) {
  /* GOOD */
  animation: slide-in 200ms;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
}
```

### Benefits for Perceived Performance

- Transitions can mask loading time
- Maintains user context during navigation
- Reduces cognitive load of state changes

---

## 8. Accessibility Requirements

### Respecting prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  /* Or disable entirely */
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

### React's ViewTransition and Accessibility

React does NOT auto-disable for `prefers-reduced-motion`. Handle manually:

```tsx
function AccessibleViewTransition({ children, name }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return <ViewTransition name={name}>{children}</ViewTransition>;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}
```

### Provide Alternative Feedback

Don't eliminate all motion. Provide subtle alternatives:

```css
@media (prefers-reduced-motion: reduce) {
  /* Replace movement with fade */
  ::view-transition-old(root) {
    animation: fade-out 150ms ease-out;
  }

  ::view-transition-new(root) {
    animation: fade-in 150ms ease-in;
  }
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
```

### User-Controlled Toggle

```tsx
function MotionToggle() {
  const { reduceMotion, setReduceMotion } = useMotionPreference();

  return (
    <button
      role="switch"
      aria-checked={reduceMotion}
      onClick={() => setReduceMotion(!reduceMotion)}
    >
      {reduceMotion ? 'Enable animations' : 'Reduce motion'}
    </button>
  );
}
```

### WCAG Compliance

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| 2.3.1 (A) | No content flashes > 3x/second | Avoid rapid flashing |
| 2.3.3 (AAA) | Disable non-essential motion | Support `prefers-reduced-motion` |
| 2.2.2 (A) | Pause/stop/hide auto-playing > 5s | Add pause controls |

---

## 9. Anti-Patterns and Common Mistakes

### Duplicate view-transition-name

```css
/* BAD: Same name on multiple visible elements */
.card {
  view-transition-name: card; /* All cards have same name! */
}

/* GOOD: Unique names */
.card:nth-child(1) { view-transition-name: card-1; }
.card:nth-child(2) { view-transition-name: card-2; }

/* BETTER: Use match-element */
.card {
  view-transition-name: match-element;
}
```

### Missing Feature Detection

```typescript
// BAD: Crashes in unsupported browsers
document.startViewTransition(() => updateDOM());

// GOOD: Feature detection
if (document.startViewTransition) {
  document.startViewTransition(() => updateDOM());
} else {
  updateDOM();
}
```

### Not Opting In for MPA

```css
/* BAD: Expecting transitions without opt-in */
/* (no @view-transition rule) */

/* GOOD: Both pages must opt in */
@view-transition {
  navigation: auto;
}
```

### Using Obsolete Syntax

```html
<!-- BAD: Obsolete meta tag syntax -->
<meta name="view-transition" content="same-origin">

<!-- GOOD: Use CSS at-rule -->
<style>
@view-transition {
  navigation: auto;
}
</style>
```

### React: Not Using startTransition

```tsx
// BAD: ViewTransition won't activate
function handleClick() {
  setPage('new');
}

// GOOD: Wrap in startTransition
function handleClick() {
  startTransition(() => {
    setPage('new');
  });
}
```

### Long Animation Durations

```css
/* BAD: Too long, blocks interaction */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 2s;
}

/* GOOD: Quick, responsive */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
}
```

### Not Cleaning Up Names

```typescript
// BAD: Names persist, cause conflicts on next navigation
element.style.viewTransitionName = 'hero';
// Never removed

// GOOD: Clean up after transition
const transition = document.startViewTransition(updateFn);
await transition.finished;
element.style.viewTransitionName = '';
```

### Ignoring User Preferences

```tsx
// BAD: No reduced motion support
<ViewTransition name="hero">
  <HeroImage />
</ViewTransition>

// GOOD: Respect preferences
const prefersReducedMotion = usePrefersReducedMotion();

{prefersReducedMotion ? (
  <HeroImage />
) : (
  <ViewTransition name="hero">
    <HeroImage />
  </ViewTransition>
)}
```

### API Naming Misconception

**Correct:** "View Transition API" (singular)
**Incorrect:** "View Transitions API" (plural)

The API creates view transitions, but the API itself is singular.

---

## 10. Practical Examples

### Page Navigation (SPA)

```typescript
// navigation-hook.ts
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useTransitionNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (!document.startViewTransition) {
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

### Product Gallery with Shared Element

```tsx
// product-gallery.tsx
import { ViewTransition, startTransition } from 'react';
import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  image: string;
}

export function ProductGallery({ products }: { products: Product[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedProduct = products.find((p) => p.id === selectedId);

  const handleSelect = (id: string) => {
    startTransition(() => {
      setSelectedId(id);
    });
  };

  const handleClose = () => {
    startTransition(() => {
      setSelectedId(null);
    });
  };

  return (
    <>
      <div className="gallery-grid">
        {products.map((product) => (
          <ViewTransition key={product.id} name={`product-${product.id}`}>
            <button
              className="product-card"
              onClick={() => handleSelect(product.id)}
            >
              <img src={product.image} alt={product.name} />
              <h3>{product.name}</h3>
            </button>
          </ViewTransition>
        ))}
      </div>

      {selectedProduct && (
        <div className="product-modal-backdrop" onClick={handleClose}>
          <ViewTransition name={`product-${selectedProduct.id}`}>
            <article
              className="product-detail"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={selectedProduct.image} alt={selectedProduct.name} />
              <h2>{selectedProduct.name}</h2>
              <p>Product details...</p>
              <button onClick={handleClose}>Close</button>
            </article>
          </ViewTransition>
        </div>
      )}
    </>
  );
}
```

### Multi-Step Form with Transitions

```typescript
// multi-step-form.ts
const TOTAL_STEPS = 3;

class MultiStepForm {
  private currentStep = 1;

  async goToStep(step: number): Promise<void> {
    if (step < 1 || step > TOTAL_STEPS) return;

    const updateFn = () => {
      this.hideStep(this.currentStep);
      this.showStep(step);
      this.currentStep = step;
    };

    if (!document.startViewTransition) {
      updateFn();
      return;
    }

    const transition = document.startViewTransition(updateFn);
    await transition.finished;
  }

  private hideStep(step: number): void {
    document.querySelector(`[data-step="${step}"]`)?.classList.add('hidden');
  }

  private showStep(step: number): void {
    document.querySelector(`[data-step="${step}"]`)?.classList.remove('hidden');
  }
}
```

```css
/* Form step transitions */
[data-step] {
  view-transition-name: form-step;
}

::view-transition-old(form-step) {
  animation: slide-out-left 200ms ease-in;
}

::view-transition-new(form-step) {
  animation: slide-in-right 200ms ease-out;
}
```

### Table Row Reordering

```css
/* Auto-name each row */
tr {
  view-transition-name: match-element;
  view-transition-class: table-row;
}

::view-transition-group(.table-row) {
  animation-duration: 200ms;
  animation-timing-function: ease-out;
}
```

### Theme Switcher with Circular Reveal

```typescript
// theme-switcher.ts
export function toggleTheme(event: MouseEvent): void {
  const { clientX: x, clientY: y } = event;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = document.startViewTransition(() => {
    document.documentElement.classList.toggle('dark');
  });

  transition.ready.then(() => {
    const clipPath = [
      `circle(0 at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`,
    ];

    document.documentElement.animate(
      { clipPath: document.documentElement.classList.contains('dark') ? clipPath : clipPath.reverse() },
      {
        duration: 400,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  });
}
```

### Cross-Document Hero Transition (MPA)

```css
/* styles.css - included on both pages */
@view-transition {
  navigation: auto;
}

.hero-image {
  view-transition-name: hero;
}

::view-transition-group(hero) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

```html
<!-- list.html -->
<a href="/detail/1">
  <img class="hero-image" src="product1.jpg" alt="Product 1">
</a>

<!-- detail.html -->
<img class="hero-image" src="product1.jpg" alt="Product 1">
```

---

## Summary: Decision Tree

```
Need page/state transitions?
│
├── Is it SPA (single-page)?
│   ├── Using React 19+?
│   │   └── Use <ViewTransition> + startTransition
│   ├── Using React Router?
│   │   └── Use viewTransition prop on Link
│   ├── Using Vue/Nuxt?
│   │   └── Use vue-view-transitions or Nuxt experimental
│   ├── Using Angular 17+?
│   │   └── Use withViewTransitions()
│   └── Vanilla JS?
│       └── Use document.startViewTransition()
│
├── Is it MPA (multi-page)?
│   └── Add @view-transition { navigation: auto; } to CSS
│       └── Use pageswap/pagereveal events for customization
│
├── Need shared element transitions?
│   └── Give matching elements same view-transition-name
│       └── Ensure only one instance visible at a time
│
├── Need direction-aware transitions?
│   └── Use :active-view-transition-type() + types
│
└── Always:
    ├── Feature detect before using API
    ├── Support prefers-reduced-motion
    ├── Keep animations < 300ms
    ├── Clean up view-transition-name after transitions
    └── Test on low-end devices
```

---

## Sources

### Official Documentation
- [MDN - View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [MDN - Using the View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using)
- [MDN - view-transition-name](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/view-transition-name)
- [Chrome Developers - View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions)
- [Chrome Developers - Same-Document View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document)
- [Chrome Developers - Cross-Document View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)

### 2025 Updates
- [Chrome Developers - What's New in View Transitions (2025)](https://developer.chrome.com/blog/view-transitions-in-2025)
- [Chrome Developers - View Transitions Misconceptions](https://developer.chrome.com/blog/view-transitions-misconceptions)

### Framework Integration
- [React - ViewTransition Component](https://react.dev/reference/react/ViewTransition)
- [React Labs - View Transitions Blog Post](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more)
- [React Router - View Transitions](https://reactrouter.com/how-to/view-transitions)
- [Next.js - viewTransition Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition)
- [vue-view-transitions GitHub](https://github.com/Clarkkkk/vue-view-transitions)
- [Nuxt - View Transitions](https://nuxt.com/docs/4.x/getting-started/transitions)

### Performance and Best Practices
- [Core Web Vitals - View Transition Performance Impact](https://www.corewebvitals.io/pagespeed/view-transition-web-performance)
- [DebugBear - View Transitions for SPAs](https://www.debugbear.com/blog/view-transitions-spa-without-framework)

### Accessibility
- [MDN - prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- [web.dev - prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)

### Practical Tutorials
- [Piccalilli - Practical View Transition Examples](https://piccalil.li/blog/some-practical-examples-of-view-transitions-to-elevate-your-ui/)
- [Piccalilli - Start Implementing View Transitions](https://piccalil.li/blog/start-implementing-view-transitions-on-your-websites-today/)
- [Smashing Magazine - View Transitions API Part 1](https://www.smashingmagazine.com/2023/12/view-transitions-api-ui-animations-part1/)

### Specifications
- [WICG - View Transitions Explainer](https://github.com/WICG/view-transitions/blob/main/explainer.md)
- [CSS View Transitions Module Level 2](https://drafts.csswg.org/css-view-transitions-2/)
