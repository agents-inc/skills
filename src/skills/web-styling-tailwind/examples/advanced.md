# Tailwind CSS v4 - Advanced Examples

> Advanced patterns for Tailwind CSS v4. See [SKILL.md](../SKILL.md) for concepts and decision frameworks.

**Additional Examples:**

- [Core Patterns](core.md) - Setup, responsive design, dark mode, state variants, theme customization

---

## Pattern 6: Custom Utilities

### Static Custom Utility

```css
/* ✅ Good Example - simple static utility */
@import "tailwindcss";

@utility content-auto {
  content-visibility: auto;
}

@utility scrollbar-hidden {
  &::-webkit-scrollbar {
    display: none;
  }
}
```

```tsx
// Usage - works with all variants
function LazySection({ children }: { children: React.ReactNode }) {
  return <section className="content-auto lg:content-auto">{children}</section>;
}

export { LazySection };
```

**Why good:** `@utility` integrates with all Tailwind variants (hover, focus, lg, etc.), replaces v3's `@layer utilities {}` syntax

```css
/* ❌ Bad Example - v3 custom utility syntax */
@layer utilities {
  .content-auto {
    content-visibility: auto;
  }
}
```

**Why bad:** `@layer utilities {}` is v3 syntax, does not work with v4 variant system, classes won't respond to `hover:`, `lg:`, etc.

### Functional Utility with --value()

```css
/* ✅ Good Example - functional utility accepting values */
@import "tailwindcss";

@theme {
  --tab-size-2: 2;
  --tab-size-4: 4;
  --tab-size-8: 8;
}

@utility tab-* {
  /* Match theme variables first */
  tab-size: --value(--tab-size-*);
  /* Fall back to bare integers */
  tab-size: --value(integer);
  /* Allow arbitrary values */
  tab-size: --value([integer]);
}
```

```html
<!-- Usage examples -->
<pre class="tab-4">></pre>
```

**Why good:** multiple `--value()` declarations cascade (last match wins), supports theme values, bare values, and arbitrary values, type constraints (`integer`) prevent invalid inputs

### Functional Utility with Spacing

```css
/* ✅ Good Example - custom spacing utility using --spacing() */
@import "tailwindcss";

@utility gutter-* {
  padding-inline: --spacing(--value(integer));
  padding-inline: --value([length], [percentage]);
}

@utility -gutter-* {
  padding-inline: --spacing(--value(integer) * -1);
  padding-inline: calc(--value([length], [percentage]) * -1);
}
```

```html
<!-- Usage -->
<div class="gutter-4">
  <!-- padding-inline: calc(var(--spacing) * 4) -->
  <div class="gutter-8">
    <!-- padding-inline: calc(var(--spacing) * 8) -->
    <div class="gutter-[2rem]"><!-- padding-inline: 2rem --></div>
  </div>
</div>
```

**Why good:** `--spacing()` integrates with the theme spacing scale, negative variant for inverse values, arbitrary values as escape hatch

### Functional Utility with Modifiers

```css
/* ✅ Good Example - utility with modifier for secondary value */
@import "tailwindcss";

@utility text-* {
  font-size: --value(--text-*, [length]);
  line-height: --modifier(--leading-*, [length], [*]);
}
```

```html
<!-- Usage -->
<p class="text-lg"><!-- font-size only --></p>
<p class="text-lg/relaxed"><!-- font-size + line-height from theme --></p>
<p class="text-lg/[1.8]"><!-- font-size + arbitrary line-height --></p>
<p class="text-[1.25rem]/[1.75rem]"><!-- both arbitrary --></p>
```

**Why good:** `--modifier()` handles the optional `/modifier` syntax, omitted modifier means the line-height declaration is skipped entirely, supports theme references and arbitrary values

### Fraction Utility

```css
/* ✅ Good Example - ratio/fraction utility */
@import "tailwindcss";

@utility aspect-* {
  aspect-ratio: --value(--aspect-ratio-*, ratio, [ratio]);
}
```

```html
<!-- Usage -->
<div class="aspect-video">
  <!-- matches --aspect-ratio-video -->
  <div class="aspect-3/4">
    <!-- ratio type: 3/4 -->
    <div class="aspect-[7/9]"><!-- arbitrary ratio --></div>
  </div>
</div>
```

**Why good:** `ratio` type matches fraction syntax like `3/4` naturally

---

## Pattern 7: Custom Variants

### Shorthand Syntax

```css
/* ✅ Good Example - custom theme variant (shorthand) */
@import "tailwindcss";

@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
```

```html
<!-- Usage -->
<html data-theme="midnight">
  <body>
    <div
      class="bg-white theme-midnight:bg-gray-900 text-gray-900 theme-midnight:text-white"
    >
      <!-- Styled when data-theme="midnight" is set -->
    </div>
  </body>
</html>
```

**Why good:** shorthand syntax for simple selector-based variants, `&:where()` keeps specificity low

### Block Syntax with @slot

```css
/* ✅ Good Example - complex variant with media query */
@import "tailwindcss";

@custom-variant any-hover {
  @media (any-hover: hover) {
    &:hover {
      @slot;
    }
  }
}

@custom-variant pointer-coarse {
  @media (pointer: coarse) {
    @slot;
  }
}
```

```tsx
// ✅ Good Example - touch-device-aware component
const TOUCH_TARGET_SIZE = 44; // minimum touch target in px

function TouchButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="
      rounded-lg bg-blue-600 px-4 py-2 text-white
      any-hover:bg-blue-700
      pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]
    "
    >
      {children}
    </button>
  );
}

export { TouchButton };
```

**Why good:** `@slot` marks where utility styles are inserted, `any-hover` prevents phantom hover on touch devices, `pointer-coarse` increases touch targets for mobile, named constant for magic number

### Multiple Custom Variants for Multi-Theme

```css
/* ✅ Good Example - multi-theme system */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@custom-variant theme-ocean (&:where([data-theme="ocean"] *));
@custom-variant theme-forest (&:where([data-theme="forest"] *));
@custom-variant theme-sunset (&:where([data-theme="sunset"] *));
```

```tsx
// ✅ Good Example - multi-theme component
function ThemedCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
      rounded-lg p-6
      bg-white dark:bg-gray-900
      theme-ocean:bg-cyan-50 theme-ocean:dark:bg-cyan-950
      theme-forest:bg-green-50 theme-forest:dark:bg-green-950
      theme-sunset:bg-orange-50 theme-sunset:dark:bg-orange-950
    "
    >
      {children}
    </div>
  );
}

export { ThemedCard };
```

**Why good:** themes compose with dark mode (theme-ocean + dark), data-attributes for theme selection, each variant generates proper CSS

### Bad Variant Examples

```javascript
// ❌ Bad Example - v3 plugin API for variants
const plugin = require("tailwindcss/plugin");

module.exports = {
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("theme-midnight", '[data-theme="midnight"] &');
    }),
  ],
};
```

**Why bad:** JavaScript plugin API replaced by `@custom-variant` directive, no `tailwind.config.js` needed in v4

---

## Pattern 8: Container Queries

### Basic Container Query

```tsx
// ✅ Good Example - container-responsive card layout
function DashboardWidget({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @sm:flex-row @lg:gap-6">
        <div className="@sm:w-1/3">{/* Sidebar content */}</div>
        <div className="@sm:w-2/3">{children}</div>
      </div>
    </div>
  );
}

export { DashboardWidget };
```

**Why good:** `@container` makes the wrapper a query container, `@sm:` and `@lg:` respond to container width (not viewport), widget adapts to its actual space regardless of page layout

```tsx
// ❌ Bad Example - using viewport breakpoints for widget layout
function DashboardWidget({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row lg:gap-6">
        {/* sm: responds to viewport, not the widget's actual space */}
      </div>
    </div>
  );
}

export default DashboardWidget;
```

**Why bad:** viewport breakpoints don't know widget's actual size, widget in sidebar may still show mobile layout even on desktop, default export violates conventions

### Max-Width Container Queries

```tsx
// ✅ Good Example - max-width container queries
function ResponsiveNav({ items }: { items: string[] }) {
  return (
    <nav className="@container">
      {/* Full nav at large container sizes, hamburger at small */}
      <ul className="flex gap-4 @max-md:hidden">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button className="hidden @max-md:block" aria-label="Menu">
        Menu Icon
      </button>
    </nav>
  );
}

export { ResponsiveNav };
```

**Why good:** `@max-md:` shows/hides based on container max-width, nav adapts to its container regardless of viewport

### Named Containers

```tsx
// ✅ Good Example - named containers for nested queries
function Dashboard() {
  return (
    <div className="@container/main">
      <aside className="@container/sidebar w-64">
        <div className="p-4 @sm/sidebar:p-6">
          {/* Responds to sidebar container */}
        </div>
      </aside>
      <main>
        <div className="grid grid-cols-1 @md/main:grid-cols-2 @xl/main:grid-cols-3">
          {/* Responds to main container */}
        </div>
      </main>
    </div>
  );
}

export { Dashboard };
```

**Why good:** named containers (`/main`, `/sidebar`) prevent ambiguity when containers are nested, each section responds to its own container

### Container Query Range

```tsx
// ✅ Good Example - container query range
function AdaptiveCard() {
  return (
    <div className="@container">
      <div className="@min-sm:@max-lg:bg-blue-100 @min-sm:@max-lg:p-4 p-2">
        {/* Special styling only between sm and lg container widths */}
      </div>
    </div>
  );
}

export { AdaptiveCard };
```

**Why good:** range queries with `@min-*:@max-*:` apply styles only within a container size range

---

## Pattern 9: 3D Transforms and Modern CSS

### 3D Card Effect

```tsx
// ✅ Good Example - 3D card with perspective
function Card3D({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="perspective-distant">
      <div
        className="
        transform-3d rounded-xl bg-white p-6 shadow-lg
        transition-transform duration-300
        hover:rotate-x-2 hover:rotate-y-3 hover:scale-105
      "
      >
        <h3 className="text-xl font-bold">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export { Card3D };
```

**Why good:** `perspective-distant` sets 3D context on parent, `transform-3d` enables 3D transforms on child, hover creates subtle 3D tilt effect, smooth transitions

### Card Flip Effect

```tsx
// ✅ Good Example - card flip with backface-hidden
function FlipCard({
  front,
  back,
}: {
  front: React.ReactNode;
  back: React.ReactNode;
}) {
  return (
    <div className="group perspective-near h-64 w-48">
      <div
        className="
        relative h-full w-full transform-3d
        transition-transform duration-500
        group-hover:rotate-y-180
      "
      >
        {/* Front face */}
        <div className="absolute inset-0 backface-hidden rounded-xl bg-white p-4 shadow-lg">
          {front}
        </div>
        {/* Back face */}
        <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-xl bg-blue-600 p-4 text-white shadow-lg">
          {back}
        </div>
      </div>
    </div>
  );
}

export { FlipCard };
```

**Why good:** `backface-hidden` prevents showing the reverse side, `rotate-y-180` pre-rotates the back face, group hover triggers flip animation, perspective on parent creates depth

### @starting-style for Enter/Exit Animations

```tsx
// ✅ Good Example - popover with entrance animation
function Popover({
  trigger,
  content,
}: {
  trigger: string;
  content: React.ReactNode;
}) {
  return (
    <div>
      <button popovertarget="info-popover">{trigger}</button>
      <div
        popover="auto"
        id="info-popover"
        className="
          rounded-xl bg-white p-6 shadow-2xl
          transition-all duration-300 ease-out
          open:opacity-100 open:scale-100
          starting:open:opacity-0 starting:open:scale-95
          not-open:opacity-0 not-open:scale-95
        "
      >
        {content}
      </div>
    </div>
  );
}

export { Popover };
```

**Why good:** `starting:open:` uses CSS `@starting-style` for entrance animation (no JavaScript), `open:` for visible state, `not-open:` for exit state, native HTML popover API, smooth scale + opacity transition

### Gradient Enhancements

```tsx
// ✅ Good Example - v4 gradient features
function GradientShowcase() {
  return (
    <div className="space-y-4">
      {/* Angled linear gradient */}
      <div className="h-32 rounded-lg bg-linear-45 from-indigo-500 via-purple-500 to-pink-500" />

      {/* OKLCH interpolation for smoother gradients */}
      <div className="h-32 rounded-lg bg-linear-to-r/oklch from-blue-500 to-green-500" />

      {/* Radial gradient with position */}
      <div className="h-32 rounded-lg bg-radial-[at_25%_25%] from-white to-zinc-900 to-75%" />

      {/* Conic gradient */}
      <div className="h-32 rounded-full bg-conic from-red-500 via-yellow-500 to-red-500" />
    </div>
  );
}

export { GradientShowcase };
```

**Why good:** `bg-linear-45` replaces verbose `bg-gradient-to-*` for angled gradients, `/oklch` modifier for perceptually smooth color interpolation, radial and conic gradients built-in

### Modern CSS Utilities

```tsx
// ✅ Good Example - modern CSS features in v4
function ModernFeatures() {
  return (
    <div>
      {/* Auto-resizing textarea (no JS needed) */}
      <textarea className="field-sizing-content w-full rounded-lg border border-gray-300 p-3" />

      {/* Proper dark mode scrollbars */}
      <div className="dark:color-scheme-dark overflow-auto">
        {/* Scrollbars match dark theme */}
      </div>

      {/* Inert content (disabled/non-interactive) */}
      <div className="inert:opacity-50 inert:pointer-events-none">
        {/* Content becomes non-interactive when inert attribute is set */}
      </div>

      {/* Multiple box shadow layers */}
      <div className="shadow-lg inset-shadow-sm inset-ring inset-ring-white/10 rounded-xl bg-gray-800 p-6">
        {/* Layered shadows for depth */}
      </div>
    </div>
  );
}

export { ModernFeatures };
```

**Why good:** `field-sizing-content` replaces JavaScript auto-resize, `color-scheme-dark` fixes ugly scrollbars in dark mode, `inert:` variant styles non-interactive elements, layered shadows without custom CSS

---

## Pattern 10: Component Extraction

### cn() Utility Setup

```typescript
// lib/utils.ts
// ✅ Good Example - cn() utility combining clsx and tailwind-merge
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export { cn };
```

**Why good:** `clsx` handles conditional class logic, `twMerge` resolves Tailwind class conflicts, composable and reusable across all components, named export

### React Component with cn()

```tsx
// components/button.tsx
// ✅ Good Example - reusable component with className forwarding
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive";
  size?: "sm" | "md" | "lg";
}

const VARIANT_CLASSES = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
  destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
} as const;

const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
} as const;

function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Button };
export type { ButtonProps };
```

```tsx
// Usage
import { Button } from "./components/button";

function Page() {
  return (
    <div>
      {/* Default */}
      <Button>Click me</Button>

      {/* Override styles - cn() resolves conflicts */}
      <Button className="bg-purple-600 hover:bg-purple-700">
        Custom color
      </Button>

      {/* Destructive + large */}
      <Button variant="destructive" size="lg">
        Delete
      </Button>
    </div>
  );
}

export { Page };
```

**Why good:** `className` is last in `cn()` so caller can override any style, variant/size as named constant objects (not inline strings), `twMerge` resolves `bg-purple-600` overriding `bg-blue-600`, named exports, `import type` for type-only imports

### Component with CVA + cn()

```tsx
// components/badge.tsx
// ✅ Good Example - CVA + cn() for complex variants
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  [
    "inline-flex",
    "items-center",
    "rounded-full",
    "px-2.5",
    "py-0.5",
    "text-xs",
    "font-medium",
  ],
  {
    variants: {
      variant: {
        default: ["bg-blue-100", "text-blue-800"],
        success: ["bg-green-100", "text-green-800"],
        warning: ["bg-yellow-100", "text-yellow-800"],
        error: ["bg-red-100", "text-red-800"],
        outline: ["border", "border-gray-300", "text-gray-700"],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeVariants = VariantProps<typeof badgeVariants>;

interface BadgeProps extends BadgeVariants {
  children: React.ReactNode;
  className?: string;
}

function Badge({ variant, className, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
```

**Why good:** CVA handles variant logic declaratively, `cn()` allows className overrides, VariantProps extracts types from cva definition, array syntax for classes (easier to read/diff), named exports

### Bad Component Extraction Examples

```tsx
// ❌ Bad Example - @apply for component extraction
// components/button.module.css
// .btn {
//   @apply rounded-lg px-4 py-2 font-medium transition-colors;
// }
// .btn-primary {
//   @apply bg-blue-600 text-white hover:bg-blue-700;
// }
```

**Why bad:** `@apply` hides utility classes from markup (harder to see what styles are applied), creates CSS abstraction layer that fights utility-first philosophy, harder to override than `cn()` approach, mixing concerns between CSS files and component logic

```tsx
// ❌ Bad Example - string concatenation for classes
function Button({
  variant,
  className,
}: {
  variant: string;
  className?: string;
}) {
  const classes = `rounded-lg px-4 py-2 ${variant === "primary" ? "bg-blue-600" : "bg-gray-100"} ${className || ""}`;
  return <button className={classes}>Click</button>;
}

export default Button;
```

**Why bad:** string concatenation doesn't resolve class conflicts, no type safety for variants, `className || ""` adds trailing space, default export violates conventions

---

## Migration Notes: v3 to v4

### Quick Reference of Renamed Utilities

| v3              | v4               | Notes                            |
| --------------- | ---------------- | -------------------------------- |
| `shadow-sm`     | `shadow-xs`      | Scale shifted down               |
| `shadow`        | `shadow-sm`      | Scale shifted down               |
| `rounded-sm`    | `rounded-xs`     | Scale shifted down               |
| `rounded`       | `rounded-sm`     | Scale shifted down               |
| `blur-sm`       | `blur-xs`        | Scale shifted down               |
| `blur`          | `blur-sm`        | Scale shifted down               |
| `ring`          | `ring-3`         | Default width changed 3px -> 1px |
| `outline-none`  | `outline-hidden` | Accessibility improvement        |
| `!flex`         | `flex!`          | Important modifier moved to end  |
| `bg-[--var]`    | `bg-(--var)`     | Parentheses for CSS variables    |
| `bg-opacity-50` | `bg-black/50`    | Use opacity modifier syntax      |
| `flex-shrink`   | `shrink`         | Renamed                          |
| `flex-grow`     | `grow`           | Renamed                          |

### Automated Migration

```bash
# Run the official upgrade tool (Node.js 20+ required)
npx @tailwindcss/upgrade
```

**What it handles:** dependency updates, config migration to CSS, template utility renames, syntax changes.

**What it does NOT handle:** custom plugin logic (needs manual @utility/@custom-variant conversion), complex JavaScript config transformations, third-party plugin compatibility.
