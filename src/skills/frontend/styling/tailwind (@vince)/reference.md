# Tailwind CSS Reference

> Decision frameworks, anti-patterns, and red flags for Tailwind v4 development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

```
Need to style a component?
|-- Use Tailwind CSS utility classes
|   |-- Apply directly in className
|   |-- Use clsx for composition
|   |-- Use design tokens from @theme
|
Need to combine multiple class sources?
|-- Use clsx()
|   |-- Base classes first
|   |-- Conditional classes second
|   |-- Passed className last (for overrides)
|
Need to create variants (primary/secondary/ghost)?
|-- Create variant object mapping
|   |-- Keys become type union
|   |-- Values contain class strings
|   |-- Apply with severityVariants[variant]
|
Need responsive behavior?
|-- Viewport-based?
|   |-- Use breakpoint prefixes: sm:, md:, lg:
|   |-- Mobile-first approach
|-- Container-based? (v4)
|   |-- Use @container on parent
|   |-- Use @sm:, @md:, @lg: on children
|   |-- Use @max-sm: for max-width queries
|
Need 3D transforms? (v4)
|-- Apply perspective to parent
|   |-- perspective-normal, perspective-distant
|-- Apply transforms to children
|   |-- rotate-x-*, rotate-y-*, translate-z-*
|   |-- transform-3d for preserve-3d
|
Need custom design tokens? (v4)
|-- Use @theme directive in CSS
|   |-- --color-* for colors
|   |-- --font-* for fonts
|   |-- --spacing-* for spacing
|   |-- Generates utility classes automatically
|
Need icons?
|-- Use @photoroom/icons
|   |-- Import from lib/monochromes
|   |-- Style with Tailwind classes
|   |-- Use internal icons for design system compliance
|
Need to make component customizable?
|-- Expose className prop
|   |-- Extend HTML attributes
|   |-- Merge with clsx, className last
|   |-- Use spread for rest props
|
Need global styles or fonts?
|-- Use SCSS (minimal)
|   |-- src/index.scss for fonts
|   |-- Keep component styles in Tailwind
```

---

## RED FLAGS

### High Priority Issues

- Using external icon libraries (lucide-react, react-icons) - use @photoroom/icons for design system compliance
- Template literals for class composition - use clsx for clean composition and conditional classes
- Hardcoded pixel/color values - use Tailwind design tokens via @theme
- Component-level SCSS files - use Tailwind for component styling
- Components without className prop - expose for composability
- **v4 Deprecated:** Using `bg-opacity-*`, `text-opacity-*` - use color modifiers like `bg-black/50` instead
- **v4 Deprecated:** Using `flex-shrink-*`, `flex-grow-*` - use `shrink-*`, `grow-*` instead
- **v4 Deprecated:** Using `!flex` leading bang syntax - use `flex!` trailing bang instead

### Medium Priority Issues

- Arbitrary Tailwind values like `p-[8px]` - Prefer preset tokens
- Inline styles with style prop - Use Tailwind classes
- Missing shrink-0 on flex icons - Icons may get crushed
- Desktop-first responsive design - Use mobile-first approach
- **v4 Changed:** Using `shadow-sm` expecting small shadow - it's now `shadow-xs` in v4
- **v4 Changed:** Using `rounded` expecting default radius - it's now `rounded-sm` in v4
- **v4 Changed:** Using `bg-[--brand-color]` for CSS variables - use `bg-(--brand-color)` parentheses syntax in v4
- **v4 Changed:** Using `outline-none` for focus ring hiding - use `outline-hidden` in v4 (new `outline-none` sets `outline-style: none`)

### Common Mistakes

- Forgetting to spread `...rest` props after extracting className
- Placing className before base classes in clsx (prevents consumer overrides)
- Using string concatenation instead of clsx
- Creating SCSS modules for components (use Tailwind)
- Hardcoding colors instead of using token classes
- **v4:** Using old `@tailwind base/components/utilities` - use `@import "tailwindcss"` instead
- **v4:** Not specifying border color - v4 defaults to currentColor, not gray-200

### Gotchas & Edge Cases

- **clsx order matters:** Base classes first, conditionals second, className prop last for proper override behavior
- **Tailwind purge:** Dynamically constructed class names like `bg-${color}-500` are not included in build - use complete class names in variant objects
- **Icon sizing:** @photoroom/icons use currentColor for fill - set color on parent or icon directly
- **Arbitrary values:** Use sparingly and only for truly one-off values not in the design system
- **v4 Ring default:** `ring` is now 1px (was 3px) - use `ring-3` for v3 behavior
- **v4 Button cursor:** Buttons now use `cursor-default` - add `cursor-pointer` explicitly if needed
- **v4 Container queries:** Use `@container` on parent, then `@sm:`, `@md:` on children (not `sm:`, `md:`)
- **v4 @theme vs :root:** Use `@theme` for design tokens that should generate utilities, `:root` for regular CSS variables

---

## Anti-Patterns

### Using External Icon Libraries

Using libraries like `lucide-react` or `react-icons` breaks design system compliance and increases bundle size.

```tsx
// BAD
import { Save } from "lucide-react";
import { FaSave } from "react-icons/fa";

// GOOD
import { SaveIcon } from "@photoroom/icons/lib/monochromes";
```

**Why this matters:** External icons have inconsistent visual weight, sizing, and styling that disrupts the unified design language.

### Template Literals for Class Composition

Template literals create subtle bugs with trailing spaces and are harder to read.

```tsx
// BAD
<div className={`base-class ${isActive ? "active" : ""}`}>

// GOOD
<div className={clsx("base-class", isActive && "active")}>
```

**Why this matters:** Template literals produce `"base-class "` (trailing space) when conditions are false, which can cause styling issues.

### Hardcoded Style Values

Using inline styles or arbitrary Tailwind values bypasses the design token system.

```tsx
// BAD
<div style={{ padding: "8px", color: "rgba(0,0,0,0.8)" }}>
<div className="p-[8px] text-[rgba(0,0,0,0.8)]">

// GOOD
<div className="p-2 text-black-alpha-8">
```

**Why this matters:** Hardcoded values cannot be themed, break visual consistency, and make design system updates impossible.

### Component-Level SCSS Files

Creating SCSS modules for individual components duplicates the styling system.

```scss
// BAD - src/components/Button/Button.module.scss
.button {
  padding: 8px 16px;
  border-radius: 4px;
}
```

**Why this matters:** Maintains two parallel styling systems, loses Tailwind benefits like responsive utilities and design tokens.

### Components Without className Prop

Components that do not expose `className` cannot be customized by consumers.

```tsx
// BAD
export const Card = ({ children }: { children: React.ReactNode }) => {
  return <div className="p-4 rounded-lg">{children}</div>;
};

// GOOD
export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={clsx("p-4 rounded-lg", className)}>{children}</div>;
};
```

**Why this matters:** Consumers must wrap components in extra divs to override styles, creating DOM bloat and specificity issues.

### Desktop-First Responsive Design

Starting with desktop styles and overriding for mobile is harder to maintain.

```tsx
// BAD
<div className="flex-row lg:flex-col">

// GOOD
<div className="flex-col lg:flex-row">
```

**Why this matters:** Mobile-first ensures the base experience works on all devices, with enhancements layered on for larger screens.

---

## Quick Reference

### Styling Checklist

- [ ] Uses Tailwind utility classes (not SCSS modules)
- [ ] Uses clsx for class composition
- [ ] Uses design tokens via @theme directive (v4)
- [ ] Exposes className prop on components
- [ ] Uses @photoroom/icons (not external icon libraries)
- [ ] Uses mobile-first responsive design
- [ ] Uses v4 syntax (color modifiers, shrink-*, trailing bang)

### clsx Order

1. Base classes (always applied)
2. Variant classes (from variant object or conditions)
3. Conditional classes (based on props/state)
4. className prop (consumer overrides - always last)

### Viewport Breakpoint Reference

| Prefix | Min Width | Usage |
|--------|-----------|-------|
| (none) | 0px | Mobile base styles |
| `sm:` | 640px | Small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Desktops |
| `xl:` | 1280px | Large desktops |
| `2xl:` | 1536px | Extra large |

### Container Query Breakpoints (v4)

| Prefix | Min Width | Usage |
|--------|-----------|-------|
| `@xs:` | 20rem | Extra small container |
| `@sm:` | 24rem | Small container |
| `@md:` | 28rem | Medium container |
| `@lg:` | 32rem | Large container |
| `@xl:` | 36rem | Extra large container |
| `@max-sm:` | max 24rem | Below small container |

### v4 Utility Renames

| v3 | v4 |
|----|-----|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `drop-shadow-sm` | `drop-shadow-xs` |
| `drop-shadow` | `drop-shadow-sm` |
| `blur-sm` | `blur-xs` |
| `blur` | `blur-sm` |
| `backdrop-blur-sm` | `backdrop-blur-xs` |
| `backdrop-blur` | `backdrop-blur-sm` |
| `rounded-sm` | `rounded-xs` |
| `rounded` | `rounded-sm` |
| `outline-none` | `outline-hidden` |
| `flex-shrink-0` | `shrink-0` |
| `flex-grow` | `grow` |
| `bg-opacity-50` | `bg-black/50` |
| `!flex` | `flex!` |
| `bg-[--var]` | `bg-(--var)` |

### 3D Transform Utilities (v4)

| Utility | Description |
|---------|-------------|
| `perspective-dramatic` | 100px perspective (extreme) |
| `perspective-near` | 300px perspective |
| `perspective-normal` | 500px perspective |
| `perspective-midrange` | 800px perspective |
| `perspective-distant` | 1200px perspective |
| `perspective-none` | No perspective |
| `rotate-x-{deg}` | X-axis rotation |
| `rotate-y-{deg}` | Y-axis rotation |
| `rotate-z-{deg}` | Z-axis rotation |
| `translate-z-{size}` | Z-axis translation |
| `scale-z-{ratio}` | Z-axis scaling |
| `transform-3d` | preserve-3d for children |
| `transform-flat` | flat (default) |
| `backface-visible` | Show backface |
| `backface-hidden` | Hide backface |
