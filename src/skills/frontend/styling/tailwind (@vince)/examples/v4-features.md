# Tailwind CSS v4 Features

> Code examples for Tailwind CSS v4 new features. See [SKILL.md](../SKILL.md) for core concepts.

---

## CSS-First Configuration with @theme

### Good Example - Defining custom design tokens

```css
/* app.css */
@import "tailwindcss";

@theme {
  /* Custom colors using OKLCH for P3 wide gamut */
  --color-brand-500: oklch(0.72 0.11 178);
  --color-brand-600: oklch(0.62 0.13 178);

  /* Custom fonts */
  --font-display: "TT Photoroom", sans-serif;

  /* Custom spacing */
  --spacing-18: 4.5rem;

  /* Custom border radius */
  --radius-400: 0.75rem;

  /* Custom breakpoints */
  --breakpoint-3xl: 120rem;
}
```

**Why good:** CSS-first configuration eliminates JavaScript config file, design tokens are defined where they are used, automatically generates utility classes like `bg-brand-500`, `font-display`, `p-18`, `rounded-400`

### Bad Example - Still using JavaScript config for simple customization

```javascript
// tailwind.config.js (v3 approach - no longer needed for most cases)
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#72c1b8",
        },
      },
    },
  },
};
```

**Why bad:** Requires separate JavaScript file, adds build complexity, v4 CSS-first approach is simpler for most projects

---

## New Import Syntax

### Good Example - v4 single import

```css
/* v4 - Simple single import */
@import "tailwindcss";

/* Your custom styles below */
@theme {
  --color-primary: oklch(0.65 0.15 240);
}
```

**Why good:** Single import includes all layers (base, components, utilities), cleaner CSS file, no need for separate @tailwind directives

### Bad Example - v3 multi-directive (deprecated)

```css
/* v3 approach - no longer used */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Why bad:** Deprecated in v4, more verbose, unnecessary complexity

---

## OKLCH Color System

### Good Example - Defining colors in OKLCH

```css
@import "tailwindcss";

@theme {
  /* OKLCH format: oklch(lightness chroma hue) */
  --color-primary-50: oklch(0.97 0.02 250);
  --color-primary-500: oklch(0.65 0.15 250);
  --color-primary-900: oklch(0.25 0.08 250);

  /* With alpha */
  --color-overlay: oklch(0 0 0 / 0.5);
}
```

```tsx
// Usage in components - generates utilities automatically
<div className="bg-primary-500 text-primary-50">
  <div className="bg-overlay">Overlay content</div>
</div>
```

**Why good:** OKLCH provides perceptually uniform colors, supports P3 wide gamut for more vivid colors on modern displays, automatic fallback for older browsers, better gradient interpolation

### Good Example - Gradient interpolation in OKLCH

```tsx
// v4 uses OKLAB by default for gradients, can specify OKLCH
<div className="bg-linear-to-r/oklch from-red-500 to-blue-500">
  Smooth gradient without muddy middle colors
</div>
```

**Why good:** OKLCH interpolation produces more vibrant gradients without muddy colors in the middle

---

## Renamed Utilities (v3 to v4)

### Shadow, Blur, and Radius Scale Changes

```tsx
// v3 → v4 mapping
// shadow-sm → shadow-xs
// shadow → shadow-sm
// blur-sm → blur-xs
// blur → blur-sm
// rounded-sm → rounded-xs
// rounded → rounded-sm

// v4 example
<div className="shadow-xs rounded-xs blur-xs">
  {/* These are the new "small" sizes */}
</div>

<div className="shadow-sm rounded-sm blur-sm">
  {/* These were the default sizes in v3 */}
</div>
```

**Why this changed:** v4 introduces new `-xs` sizes at the small end, making the scale more consistent

### Ring Width Default

```tsx
// v3: ring was 3px by default
// v4: ring is 1px by default

// To get v3 behavior in v4
<input className="focus:ring-3 focus:ring-blue-500" />

// v4 default
<input className="focus:ring focus:ring-blue-500" />
```

**Why this changed:** Aligns ring with border and outline defaults (1px)

---

## Removed Deprecated Utilities

### Opacity Utilities (Use Color Modifiers Instead)

```tsx
// v3 (deprecated) → v4 (use color modifiers)
// bg-opacity-50 → bg-black/50
// text-opacity-50 → text-black/50
// border-opacity-50 → border-black/50

// Good - v4 approach
<div className="bg-black/50 text-white/80 border-gray-200/60">
  Opacity via color modifier
</div>

// Bad - v3 deprecated utilities
<div className="bg-black bg-opacity-50">
  {/* These utilities removed in v4 */}
</div>
```

### Flex Grow/Shrink Utilities

```tsx
// v3 (deprecated) → v4 (shorter)
// flex-shrink-0 → shrink-0
// flex-grow → grow

// Good - v4 approach
<div className="shrink-0 grow">
  Using shorter utility names
</div>

// Bad - v3 deprecated utilities
<div className="flex-shrink-0 flex-grow">
  {/* These utilities removed in v4 */}
</div>
```

### Other Renamed Utilities

```tsx
// overflow-ellipsis → text-ellipsis
// decoration-slice → box-decoration-slice
// decoration-clone → box-decoration-clone

<p className="text-ellipsis overflow-hidden">
  Truncated text with ellipsis
</p>
```

---

## Container Queries (Built-in)

### Good Example - Basic container query

```tsx
// Mark parent as container
<div className="@container">
  {/* Child responds to container width, not viewport */}
  <div className="flex flex-col @md:flex-row @lg:grid @lg:grid-cols-3">
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
  </div>
</div>
```

**Why good:** Built-in v4 feature (no plugin needed), enables component-based responsive design, child elements respond to their container rather than viewport

### Good Example - Max-width container queries

```tsx
<div className="@container">
  {/* Apply styles below a certain container width */}
  <div className="@max-sm:text-xs @max-md:text-sm text-base">
    Text size based on container width
  </div>
</div>
```

### Good Example - Container query ranges

```tsx
<div className="@container">
  {/* Target specific container width range */}
  <div className="@sm:@max-lg:bg-blue-100">
    Blue background only between sm and lg container sizes
  </div>
</div>
```

### Good Example - Named containers

```tsx
<div className="@container/sidebar">
  <nav className="@md/sidebar:flex-row flex-col">
    Navigation responds to sidebar container width
  </nav>
</div>

<div className="@container/main">
  <article className="@lg/main:max-w-prose">
    Article responds to main container width
  </article>
</div>
```

### Good Example - Custom container breakpoints

```css
@import "tailwindcss";

@theme {
  --container-2xs: 16rem;
  --container-xs: 20rem;
}
```

```tsx
<div className="@container">
  <div className="@2xs:text-sm @xs:text-base">
    Custom container breakpoints
  </div>
</div>
```

---

## 3D Transforms

### Good Example - Perspective and 3D rotation

```tsx
<div className="perspective-normal">
  <div className="rotate-y-12 transform-3d hover:rotate-y-0 transition-transform">
    Card with 3D rotation
  </div>
</div>
```

**Why good:** Native v4 utilities, no plugin required, combines with transitions seamlessly

### Good Example - 3D card flip

```tsx
<div className="perspective-distant group">
  <div className="relative transform-3d transition-transform duration-500 group-hover:rotate-y-180">
    {/* Front face */}
    <div className="absolute inset-0 backface-hidden">
      Front of card
    </div>
    {/* Back face */}
    <div className="absolute inset-0 backface-hidden rotate-y-180">
      Back of card
    </div>
  </div>
</div>
```

### 3D Transform Utilities Reference

```tsx
// Perspective (applied to parent)
// perspective-dramatic (100px)
// perspective-near (300px)
// perspective-normal (500px)
// perspective-midrange (800px)
// perspective-distant (1200px)
// perspective-none

// 3D Rotations
// rotate-x-{deg} - rotation around X axis
// rotate-y-{deg} - rotation around Y axis
// rotate-z-{deg} - rotation around Z axis

// 3D Translation
// translate-z-{size} - Z axis translation

// 3D Scaling
// scale-z-{ratio} - Z axis scaling

// Transform style
// transform-3d - preserve-3d for children
// transform-flat - flat (default)

// Backface visibility
// backface-visible
// backface-hidden

// Custom values
<div className="rotate-x-[25deg] translate-z-[100px] perspective-[600px]">
  Custom 3D values
</div>
```

---

## CSS Variable Syntax Change

### Good Example - v4 parentheses syntax

```tsx
// v4 - use parentheses for CSS variables
<div className="bg-(--brand-color) text-(--text-color)">
  CSS variable with parentheses
</div>

// With fallback
<div className="bg-(--brand-color,theme(colors.blue.500))">
  Variable with fallback
</div>
```

### Bad Example - v3 bracket syntax (deprecated)

```tsx
// v3 - square brackets no longer work for variables
<div className="bg-[--brand-color]">
  {/* This syntax changed in v4 */}
</div>
```

**Why this changed:** CSS has evolved to allow ambiguous parsing with square brackets, parentheses provide clearer distinction

---

## Important Modifier Position

### Good Example - v4 trailing bang

```tsx
// v4 - ! at the end
<div className="flex! bg-red-500! hover:bg-red-600!">
  Important declarations
</div>
```

### Bad Example - v3 leading bang (deprecated)

```tsx
// v3 - ! at the beginning
<div className="!flex !bg-red-500">
  {/* This syntax changed in v4 */}
</div>
```

---

## Preflight Changes

### Default Border Color

```tsx
// v3: borders were gray-200 by default
// v4: borders use currentColor by default

// v4 - must specify color
<div className="border border-gray-200 px-2 py-3">
  Explicit border color required
</div>
```

### Button Cursor

```tsx
// v4: buttons use cursor-default (browser native)
// To restore pointer cursor, add explicitly
<button className="cursor-pointer">
  Click me
</button>
```

---

## Custom Utilities with @utility

### Good Example - v4 @utility directive

```css
@import "tailwindcss";

/* Define custom utilities */
@utility tab-4 {
  tab-size: 4;
}

@utility scrollbar-hidden {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

```tsx
<pre className="tab-4">
  Code with 4-space tabs
</pre>

<div className="scrollbar-hidden overflow-auto">
  Scrollable without visible scrollbar
</div>
```

### Bad Example - v3 @layer utilities (no longer auto-detected)

```css
/* v3 approach - utilities won't be detected in v4 */
@layer utilities {
  .tab-4 {
    tab-size: 4;
  }
}
```

**Why this changed:** `@utility` directive explicitly marks utilities for Tailwind processing, `@layer utilities` is now just for CSS cascade layers

---

## PostCSS Configuration (v4)

### Good Example - v4 PostCSS plugin

```javascript
// postcss.config.js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Why good:** Single plugin handles CSS processing and autoprefixing, simpler configuration

### Bad Example - v3 multi-plugin (deprecated)

```javascript
// v3 approach - no longer needed
export default {
  plugins: {
    "postcss-import": {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## Vite Integration (Recommended)

### Good Example - v4 Vite plugin

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

**Why good:** Maximum performance with tight Vite integration, simpler than PostCSS setup

---

## @theme vs :root

### When to use @theme (design tokens with utilities)

```css
@import "tailwindcss";

/* @theme creates utility classes */
@theme {
  --color-brand: oklch(0.65 0.15 240);
  /* Generates: bg-brand, text-brand, border-brand, etc. */
}
```

### When to use :root (CSS variables without utilities)

```css
@import "tailwindcss";

/* :root for variables that shouldn't generate utilities */
:root {
  --sidebar-width: 280px;
  --header-height: 64px;
}

/* Use in arbitrary values */
.sidebar {
  width: var(--sidebar-width);
}
```

**Why this matters:** `@theme` variables automatically generate Tailwind utilities, `:root` variables are just CSS custom properties
