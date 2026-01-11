# Tailwind CSS Reference

> Decision frameworks, anti-patterns, and red flags for Tailwind development. See [SKILL.md](SKILL.md) for core concepts and [examples.md](examples.md) for code examples.

---

## Decision Framework

```
Need to style a component?
|-- Use Tailwind CSS utility classes
|   |-- Apply directly in className
|   |-- Use clsx for composition
|   |-- Use design tokens from preset
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
|-- Use Tailwind breakpoint prefixes
|   |-- Mobile-first: base, sm:, md:, lg:
|   |-- Start with mobile styles
|   |-- Add breakpoint overrides
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
- Hardcoded pixel/color values - use Tailwind design tokens from @photoroom/ui preset
- Component-level SCSS files - use Tailwind for component styling
- Components without className prop - expose for composability

### Medium Priority Issues

- Arbitrary Tailwind values like `p-[8px]` - Prefer preset tokens
- Inline styles with style prop - Use Tailwind classes
- Missing shrink-0 on flex icons - Icons may get crushed
- Desktop-first responsive design - Use mobile-first approach

### Common Mistakes

- Forgetting to spread `...rest` props after extracting className
- Placing className before base classes in clsx (prevents consumer overrides)
- Using string concatenation instead of clsx
- Creating SCSS modules for components (use Tailwind)
- Hardcoding colors instead of using token classes

### Gotchas & Edge Cases

- **clsx order matters:** Base classes first, conditionals second, className prop last for proper override behavior
- **Tailwind purge:** Dynamically constructed class names like `bg-${color}-500` are not included in build - use complete class names in variant objects
- **Icon sizing:** @photoroom/icons use currentColor for fill - set color on parent or icon directly
- **Arbitrary values:** Use sparingly and only for truly one-off values not in the design system

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
- [ ] Uses design tokens from @photoroom/ui preset
- [ ] Exposes className prop on components
- [ ] Uses @photoroom/icons (not external icon libraries)
- [ ] Uses mobile-first responsive design

### clsx Order

1. Base classes (always applied)
2. Variant classes (from variant object or conditions)
3. Conditional classes (based on props/state)
4. className prop (consumer overrides - always last)

### Breakpoint Reference

| Prefix | Min Width | Usage |
|--------|-----------|-------|
| (none) | 0px | Mobile base styles |
| `sm:` | 640px | Small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Desktops |
| `xl:` | 1280px | Large desktops |
| `2xl:` | 1536px | Extra large |
