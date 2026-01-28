---
name: tailwind (@vince)
description: Tailwind CSS, clsx, design tokens for Photoroom webapp
---

# Styling Patterns

> **Quick Guide:** Tailwind CSS v4 is the primary styling approach. Use `clsx` for class composition. Design tokens via `@theme` directive in CSS. SCSS is minimal (global styles only). Always expose `className` prop on components for composability.

**Detailed Resources:**

- For code examples, see [examples/](examples/) (core, variants, responsive, global-styles, icons, v4-features)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)
- For Tailwind v4 specific features, see [examples/v4-features.md](examples/v4-features.md)

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase components, named exports, import ordering, `import type`, named constants)

**(You MUST use Tailwind CSS as the primary styling approach for all components)**

**(You MUST use `clsx` for combining and conditionally applying classes - use this instead of template literals or string concatenation)**

**(You MUST use design tokens from `@photoroom/ui` preset via Tailwind - use these instead of hardcoded values)**

**(You MUST always expose `className` prop on components and merge it with internal classes using `clsx`)**

**(You MUST use `@photoroom/icons` for icons - use this instead of external libraries like lucide-react or react-icons)**

</critical_requirements>

---

**Auto-detection:** Tailwind CSS, Tailwind v4, clsx, className, styling, design tokens, SCSS, custom fonts, CSS composition, @theme, @container, container queries, 3D transforms, OKLCH

**When to use:**

- Styling React components in the webapp
- Composing utility classes conditionally
- Working with design tokens and theming
- Extending components with custom styles
- Implementing responsive designs
- Container queries for component-based responsive design
- 3D transforms and animations

**Key patterns covered:**

- Tailwind CSS v4 utility-first styling
- CSS-first configuration with @theme directive
- clsx for class composition
- Design tokens via @theme (replaces tailwind.config.js)
- OKLCH color system for P3 wide gamut support
- Container queries (@container, @sm:, @max-sm:)
- 3D transforms (perspective-_, rotate-x-_, translate-z-\*)
- SCSS usage (minimal - global styles only)
- Custom font definitions
- Exposing className prop on components
- Props extending HTML attributes

**When NOT to use:**

- Component structure and props (see component patterns skill)
- State-driven styling logic (see state management skill)
- Focus states and ARIA attributes (see accessibility skill)

---

<philosophy>

## Philosophy

The webapp follows a **Tailwind-first** styling approach where utility classes are the primary way to style components. This provides rapid development, consistent design tokens, and eliminates naming decisions.

**Core Principles:**

- **Utility-first:** Tailwind classes are the default - no separate CSS files for components
- **Design tokens:** Use the `@photoroom/ui` Tailwind preset for consistent spacing, colors, typography
- **Composability:** Components expose `className` prop for easy customization
- **Minimal SCSS:** Only for global styles and custom font definitions
- **Internal icon library:** Use `@photoroom/icons` for design system compliance

**When to use Tailwind CSS:**

- All component styling
- Responsive designs
- Hover/focus/active states
- Layout and spacing

**When to use SCSS instead:**

- Global font-face definitions
- CSS animations that require keyframes
- Third-party library style overrides

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Tailwind CSS Utility-First Styling

Tailwind is the primary styling approach. Use utility classes directly in JSX. No separate CSS files for components.

See [examples/core.md](examples/core.md#pattern-1-tailwind-css-utility-first-styling) for implementation examples.

---

### Pattern 2: clsx for Class Composition

Use `clsx` for combining and conditionally applying Tailwind classes. Avoids template literal issues with trailing spaces.

See [examples/core.md](examples/core.md#pattern-2-clsx-for-class-composition) for composition patterns.

---

### Pattern 3: Design Tokens from @photoroom/ui Preset

Use the extended Tailwind config from `@photoroom/ui` for consistent design tokens (spacing, colors, typography, border radius).

See [examples/core.md](examples/core.md#pattern-3-design-tokens-from-photoroomui-preset) for token usage.

---

### Pattern 4: Exposing className Prop for Composability

Always expose `className` prop on components and merge it with internal classes using `clsx`. This enables consumer customization.

See [examples/core.md](examples/core.md#pattern-4-exposing-classname-prop-for-composability) for props patterns.

---

### Pattern 5: SCSS Usage (Minimal - Global Styles Only)

SCSS is minimal - primarily for global styles and font definitions. Component styling should use Tailwind.

See [examples/global-styles.md](examples/global-styles.md) for when to use SCSS.

---

### Pattern 6: Variant Objects with Tailwind

Use objects to map variants to class names for consistent variant handling with type-safe keys.

See [examples/variants.md](examples/variants.md) for variant patterns.

---

### Pattern 7: Icons from @photoroom/icons

Use the internal `@photoroom/icons` package for consistent icon styling. Icons use currentColor for color inheritance.

See [examples/icons.md](examples/icons.md) for icon patterns.

---

### Pattern 8: Responsive Design with Tailwind Breakpoints

Use Tailwind's responsive prefixes for mobile-first responsive design. Start with mobile styles, add breakpoint overrides.

See [examples/responsive.md](examples/responsive.md) for responsive patterns.

---

### Pattern 9: CSS-First Configuration with @theme (v4)

Tailwind v4 uses CSS-first configuration. Define design tokens directly in CSS using the `@theme` directive instead of JavaScript.

See [examples/v4-features.md](examples/v4-features.md#css-first-configuration-with-theme) for @theme patterns.

---

### Pattern 10: Container Queries (v4)

Use built-in container queries for component-based responsive design. Elements respond to their container size, not viewport.

See [examples/v4-features.md](examples/v4-features.md#container-queries-built-in) for container query patterns.

---

### Pattern 11: 3D Transforms (v4)

Use native 3D transform utilities for perspective, rotation, and translation in 3D space.

See [examples/v4-features.md](examples/v4-features.md#3d-transforms) for 3D transform patterns.

---

### Pattern 12: OKLCH Color System (v4)

Tailwind v4 uses OKLCH colors for P3 wide gamut support. More vivid colors with better gradient interpolation.

See [examples/v4-features.md](examples/v4-features.md#oklch-color-system) for OKLCH color patterns.

</patterns>

---

<integration>

## Integration Guide

**Integrates with:**

- **@photoroom/ui**: Tailwind preset with design tokens
- **@photoroom/icons**: Icon components with currentColor inheritance
- **clsx**: Class composition utility
- **React components**: Via className prop and HTML attributes
- **Vite**: First-party `@tailwindcss/vite` plugin for maximum performance

**Token Sources (v4 CSS-first):**

```css
/* app.css - v4 CSS-first configuration */
@import "tailwindcss";

/* Import preset tokens (if using shared theme) */
@import "../packages/photoroom-ui/theme.css";

/* Or define tokens directly with @theme */
@theme {
  --color-brand-500: oklch(0.72 0.11 178);
  --radius-400: 0.75rem;
}
```

**Legacy JavaScript Config (for advanced cases):**

```css
/* Reference JS config when needed */
@config "../../tailwind.config.js";
```

**Token Categories:**

- **Spacing:** `p-2`, `gap-2`, `m-4`
- **Colors:** `text-black-alpha-8`, `bg-gray-100` (now in OKLCH)
- **Border radius:** `rounded-400`, `rounded-lg`
- **Typography:** `text-500`
- **Container queries:** `@sm:`, `@md:`, `@lg:`
- **3D transforms:** `perspective-*`, `rotate-x-*`, `translate-z-*`

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Tailwind CSS as the primary styling approach for all components)**

**(You MUST use `clsx` for combining and conditionally applying classes - use this instead of template literals or string concatenation)**

**(You MUST use design tokens from `@photoroom/ui` preset via Tailwind - use these instead of hardcoded values)**

**(You MUST always expose `className` prop on components and merge it with internal classes using `clsx`)**

**(You MUST use `@photoroom/icons` for icons - use this instead of external libraries like lucide-react or react-icons)**

**Failure to follow these rules will break design system consistency and component composability.**

</critical_reminders>
