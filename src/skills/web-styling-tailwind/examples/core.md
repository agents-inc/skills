# Tailwind CSS v4 - Core Examples

> Essential patterns for Tailwind CSS v4. See [SKILL.md](../SKILL.md) for concepts and decision frameworks.

**Additional Examples:**

- [Advanced Patterns](advanced.md) - Custom utilities, custom variants, container queries, 3D transforms, animations, component extraction

---

## Pattern 1: CSS-First Setup and Configuration

### Vite Setup (Recommended)

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ✅ Good Example - Vite plugin for optimal performance
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

```css
/* app.css */
/* ✅ Good Example - v4 CSS-first import */
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.7 0.15 250);
  --font-display: "Satoshi", "sans-serif";
}
```

**Why good:** single CSS import replaces three `@tailwind` directives, `@theme` replaces `tailwind.config.js`, Vite plugin provides fastest builds

### PostCSS Setup (Non-Vite Projects)

```javascript
// postcss.config.mjs
// ✅ Good Example - v4 PostCSS plugin
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Why good:** dedicated `@tailwindcss/postcss` package, no autoprefixer needed (built-in), no postcss-import needed

### Bad Example - v3 Syntax

```css
/* ❌ Bad Example - v3 syntax does NOT work in v4 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```javascript
// ❌ Bad Example - v3 PostCSS config
export default {
  plugins: {
    "postcss-import": {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

```javascript
// ❌ Bad Example - v3 JavaScript config
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#3b82f6",
      },
    },
  },
};
```

**Why bad:** `@tailwind` directives removed in v4, `tailwindcss` is no longer a direct PostCSS plugin, JavaScript config not auto-detected, `content` array not needed (auto-detection), hex colors miss P3 gamut benefits

### Source Detection

```css
/* ✅ Good Example - explicit source for packages not auto-detected */
@import "tailwindcss";
@source "../node_modules/@my-company/ui-lib";
@source "../shared-components";
```

**Why good:** automatic detection skips node_modules, `@source` ensures Tailwind scans those paths for class usage

---

## Pattern 2: Responsive Design

### Mobile-First Breakpoints

```tsx
// ✅ Good Example - mobile-first responsive layout
function ProductGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Base: 1 column, sm: 2 columns, lg: 3 columns, xl: 4 columns */}
    </div>
  );
}

export { ProductGrid };
```

**Why good:** mobile-first (base styles for smallest screens), breakpoints add complexity progressively, named exports

```tsx
// ❌ Bad Example - desktop-first approach (fighting the framework)
function ProductGrid() {
  return (
    <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
      {/* Desktop-first with max-width overrides */}
    </div>
  );
}

export { ProductGrid };
```

**Why bad:** desktop-first requires more overrides, harder to reason about, fights Tailwind's mobile-first design

### Custom Breakpoints

```css
/* ✅ Good Example - custom breakpoints in @theme */
@import "tailwindcss";

@theme {
  --breakpoint-3xl: 120rem; /* 1920px */
  --breakpoint-4xl: 160rem; /* 2560px - ultra-wide */
}
```

```tsx
// Usage in component
function WideLayout() {
  return (
    <div className="max-w-7xl 3xl:max-w-screen-3xl 4xl:max-w-screen-4xl mx-auto">
      {/* Expands on ultra-wide monitors */}
    </div>
  );
}

export { WideLayout };
```

**Why good:** custom breakpoints defined in CSS alongside other tokens, available as variants immediately

### Responsive Typography

```tsx
// ✅ Good Example - responsive text sizing
function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl xl:text-5xl">
      {children}
    </h1>
  );
}

export { PageTitle };
```

**Why good:** text scales up with viewport, base size readable on mobile

---

## Pattern 3: Dark Mode

### Strategy 1: System Preference (Default - Zero Config)

```tsx
// ✅ Good Example - dark mode with system preference (no config needed)
function Card({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
}

export { Card };
```

**Why good:** zero configuration, respects user system preference, pairs light/dark values for every color

### Strategy 2: Class-Based Toggle

```css
/* app.css */
/* ✅ Good Example - class-based dark mode override */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

```tsx
// theme-toggle.tsx
// ✅ Good Example - theme toggle with localStorage
const THEME_KEY = "theme";
const DARK_CLASS = "dark";

function applyTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = stored === DARK_CLASS || (!stored && prefersDark);

  document.documentElement.classList.toggle(DARK_CLASS, isDark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains(DARK_CLASS);
  const nextTheme = isDark ? "light" : DARK_CLASS;
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme();
}

export { applyTheme, toggleTheme };
```

**Why good:** `@custom-variant` overrides default media query behavior, toggle persists to localStorage, respects system preference as fallback, named constants for strings

### Strategy 3: Data-Attribute Toggle

```css
/* app.css */
/* ✅ Good Example - data-attribute dark mode */
@import "tailwindcss";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

```html
<!-- ✅ Good Example - data attribute on html element -->
<html data-theme="dark">
  <body>
    <div class="bg-white dark:bg-gray-900">
      <!-- dark: variants still work, driven by data-theme attribute -->
    </div>
  </body>
</html>
```

**Why good:** data attributes are more semantic than class toggling, aligns with CLAUDE.md data-attribute conventions, easy to extend for multi-theme support

### Dark Mode with CSS Variables (Advanced)

```css
/* ✅ Good Example - semantic colors with CSS variables for dark mode */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-surface: var(--surface);
  --color-on-surface: var(--on-surface);
  --color-primary: var(--primary);
  --color-on-primary: var(--on-primary);
}

:root {
  --surface: oklch(0.99 0 0);
  --on-surface: oklch(0.15 0 0);
  --primary: oklch(0.55 0.2 260);
  --on-primary: oklch(0.99 0 0);
}

.dark {
  --surface: oklch(0.15 0 0);
  --on-surface: oklch(0.95 0 0);
  --primary: oklch(0.75 0.15 260);
  --on-primary: oklch(0.1 0 0);
}
```

```tsx
// ✅ Good Example - component using semantic tokens (theme-agnostic)
function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-lg bg-primary px-4 py-2 text-on-primary hover:opacity-90">
      {children}
    </button>
  );
}

export { Button };
```

**Why good:** components use semantic tokens (`bg-primary`, `text-on-surface`), no `dark:` prefix needed in components, theme changes only update CSS variables, oklch colors for consistent perceptual brightness

### Bad Dark Mode Examples

```css
/* ❌ Bad Example - v3 dark mode config */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkmode: "class";
  /* ... */
}
```

**Why bad:** JavaScript config not used in v4, `darkMode` option replaced by `@custom-variant dark`

---

## Pattern 4: State Variants

### Interactive States

```tsx
// ✅ Good Example - comprehensive interactive states
function InteractiveButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className="
        rounded-lg bg-blue-600 px-4 py-2 text-white
        hover:bg-blue-700
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        active:bg-blue-800
        disabled:cursor-not-allowed disabled:opacity-50
      "
    >
      {children}
    </button>
  );
}

export { InteractiveButton };
```

**Why good:** covers all interaction states, focus ring for accessibility, disabled state prevents interaction cues

### Group and Peer Patterns

```tsx
// ✅ Good Example - group pattern for parent-driven child styles
function CardWithHover() {
  return (
    <div className="group rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-lg">
      <h3 className="text-gray-900 group-hover:text-blue-600">Card Title</h3>
      <p className="text-gray-500 group-hover:text-gray-700">
        Description changes when card is hovered
      </p>
      <span className="opacity-0 transition-opacity group-hover:opacity-100">
        Arrow Icon
      </span>
    </div>
  );
}

export { CardWithHover };
```

```tsx
// ✅ Good Example - peer pattern for sibling-driven styles
function FormField() {
  return (
    <div className="relative">
      <input
        type="email"
        placeholder=" "
        className="peer w-full rounded-lg border border-gray-300 px-3 pb-2 pt-5 focus:border-blue-500 focus:outline-none"
      />
      <label
        className="
        pointer-events-none absolute left-3 top-4 text-gray-400
        transition-all
        peer-placeholder-shown:top-4 peer-placeholder-shown:text-base
        peer-focus:top-1 peer-focus:text-xs peer-focus:text-blue-500
      "
      >
        Email Address
      </label>
      <p className="mt-1 hidden text-sm text-red-500 peer-invalid:block">
        Please enter a valid email
      </p>
    </div>
  );
}

export { FormField };
```

**Why good:** `group` allows parent hover to style children, `peer` allows input state to style siblings, floating label pattern without JavaScript

### Named Groups and Peers

```tsx
// ✅ Good Example - named groups for nested group contexts
function NestedCards() {
  return (
    <div className="group/card rounded-lg border p-4 hover:bg-gray-50">
      <h3 className="group-hover/card:text-blue-600">Card Title</h3>

      <button className="group/button rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">
        <span className="group-hover/button:underline">Click me</span>
      </button>
    </div>
  );
}

export { NestedCards };
```

**Why good:** named groups (`group/card`, `group/button`) prevent ambiguity in nested group contexts

### not-\* Variant (New in v4)

```tsx
// ✅ Good Example - not-* variant for inverse conditions
function HoverFade() {
  return (
    <div className="space-y-2">
      <div className="not-hover:opacity-75 transition-opacity cursor-pointer rounded-lg bg-gray-100 p-4">
        Fades when NOT hovered (75% opacity normally, 100% on hover)
      </div>
    </div>
  );
}

export { HoverFade };
```

**Why good:** `not-hover:` is clearer than setting base opacity and overriding on hover, reduces class count

### Data Attribute Variants

```tsx
// ✅ Good Example - data attribute driven styling
const STATES = { active: "active", inactive: "inactive" } as const;

function Tab({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      data-state={isActive ? STATES.active : STATES.inactive}
      className="
        rounded-t-lg px-4 py-2
        data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600
        data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-gray-700
      "
    >
      {children}
    </button>
  );
}

export { Tab };
```

**Why good:** data attributes for state styling (CLAUDE.md convention), named constants for state values, variant-driven styling without conditional class logic

---

## Pattern 5: Theme Customization

### Extending the Default Theme

```css
/* ✅ Good Example - adding custom tokens alongside defaults */
@import "tailwindcss";

@theme {
  /* Custom colors (defaults preserved) */
  --color-brand-50: oklch(0.97 0.02 250);
  --color-brand-100: oklch(0.93 0.04 250);
  --color-brand-500: oklch(0.55 0.2 250);
  --color-brand-600: oklch(0.48 0.2 250);
  --color-brand-700: oklch(0.4 0.18 250);
  --color-brand-900: oklch(0.25 0.12 250);

  /* Custom font */
  --font-display: "Satoshi", "sans-serif";

  /* Custom easing */
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);

  /* Custom breakpoint */
  --breakpoint-3xl: 120rem;

  /* Custom spacing token */
  --spacing-18: 4.5rem;

  /* Custom border radius */
  --radius-card: 1rem;

  /* Custom shadow */
  --shadow-card: 0 2px 8px oklch(0 0 0 / 0.08);
}
```

```tsx
// Usage - all generate utility classes automatically
function BrandCard() {
  return (
    <div className="rounded-card bg-brand-50 p-6 shadow-card 3xl:p-8">
      <h2 className="font-display text-2xl text-brand-900">
        Custom tokens in action
      </h2>
      <p className="mt-2 text-brand-700">
        All defined in CSS, no JavaScript config needed
      </p>
    </div>
  );
}

export { BrandCard };
```

**Why good:** custom tokens extend defaults (not replace), oklch colors for consistent perceptual brightness, every `@theme` variable generates both CSS variable and utility class

### Replacing Default Colors Entirely

```css
/* ✅ Good Example - custom-only color palette */
@import "tailwindcss";

@theme {
  --color-*: initial; /* Remove ALL default colors */

  /* Define only project colors */
  --color-white: oklch(1 0 0);
  --color-black: oklch(0 0 0);

  --color-surface: oklch(0.98 0 0);
  --color-surface-elevated: oklch(1 0 0);
  --color-on-surface: oklch(0.15 0 0);
  --color-on-surface-muted: oklch(0.45 0 0);

  --color-primary: oklch(0.55 0.2 260);
  --color-primary-hover: oklch(0.48 0.2 260);
  --color-on-primary: oklch(0.99 0 0);

  --color-destructive: oklch(0.55 0.2 25);
  --color-on-destructive: oklch(0.99 0 0);
}
```

**Why good:** `--color-*: initial` removes all defaults cleanly, only project-specific colors available, prevents accidental use of non-brand colors, semantic naming makes purpose clear

### Animation Tokens in @theme

```css
/* ✅ Good Example - animation keyframes inside @theme */
@import "tailwindcss";

@theme {
  --animate-fade-in: fade-in 0.3s ease-out;
  --animate-slide-up: slide-up 0.4s cubic-bezier(0.3, 0, 0, 1);
  --animate-scale-in: scale-in 0.2s ease-out;

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
}
```

```tsx
// Usage
function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-in">
      <div className="animate-scale-in rounded-xl bg-white p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}

export { Modal };
```

**Why good:** `@keyframes` defined inside `@theme` alongside animation token, utility classes `animate-fade-in` auto-generated, reusable across components

### @theme inline for Variable References

```css
/* ✅ Good Example - @theme inline for referencing other variables */
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-inter);
  --color-primary: var(--color-brand);
}

/* Variables set elsewhere (e.g., by a CMS or runtime) */
:root {
  --font-inter: "Inter", sans-serif;
  --color-brand: oklch(0.55 0.2 260);
}
```

**Why good:** `inline` resolves the variable at build time, prevents CSS variable scoping issues where child elements can't resolve parent references

### Bad Theme Examples

```css
/* ❌ Bad Example - hex colors in @theme */
@import "tailwindcss";

@theme {
  --color-brand: #3b82f6;
  --color-brand-dark: #1d4ed8;
}
```

**Why bad:** hex colors limited to sRGB gamut, miss P3 wide-gamut on modern displays, oklch provides perceptually uniform brightness

```javascript
// ❌ Bad Example - v3 JavaScript config
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
    },
  },
};
```

**Why bad:** v4 does not auto-detect `tailwind.config.js`, JavaScript config is legacy (requires `@config` directive to load)
