---
name: frontend/styling-tailwind (@photoroom)
description: Tailwind CSS, clsx, design tokens for Photoroom webapp
---

# Styling Patterns

> **Quick Guide:** Tailwind CSS is the primary styling approach. Use `clsx` for class composition. Design tokens from `@photoroom/ui` preset. SCSS is minimal (global styles only). Always expose `className` prop on components for composability.

**Detailed Resources:**
- For code examples, see [examples.md](examples.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

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

**Auto-detection:** Tailwind CSS, clsx, className, styling, design tokens, SCSS, custom fonts, CSS composition

**When to use:**

- Styling React components in the webapp
- Composing utility classes conditionally
- Working with design tokens and theming
- Extending components with custom styles
- Implementing responsive designs

**Key patterns covered:**

- Tailwind CSS utility-first styling
- clsx for class composition
- Design tokens from @photoroom/ui preset
- SCSS usage (minimal - global styles only)
- Custom font definitions (TT Photoroom)
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

See [examples.md](examples.md#pattern-1-tailwind-css-utility-first-styling) for implementation examples.

---

### Pattern 2: clsx for Class Composition

Use `clsx` for combining and conditionally applying Tailwind classes. Avoids template literal issues with trailing spaces.

See [examples.md](examples.md#pattern-2-clsx-for-class-composition) for composition patterns.

---

### Pattern 3: Design Tokens from @photoroom/ui Preset

Use the extended Tailwind config from `@photoroom/ui` for consistent design tokens (spacing, colors, typography, border radius).

See [examples.md](examples.md#pattern-3-design-tokens-from-photoroomui-preset) for token usage.

---

### Pattern 4: Exposing className Prop for Composability

Always expose `className` prop on components and merge it with internal classes using `clsx`. This enables consumer customization.

See [examples.md](examples.md#pattern-4-exposing-classname-prop-for-composability) for props patterns.

---

### Pattern 5: SCSS Usage (Minimal - Global Styles Only)

SCSS is minimal - primarily for global styles and font definitions. Component styling should use Tailwind.

See [examples.md](examples.md#pattern-5-scss-usage-minimal---global-styles-only) for when to use SCSS.

---

### Pattern 6: Variant Objects with Tailwind

Use objects to map variants to class names for consistent variant handling with type-safe keys.

See [examples.md](examples.md#pattern-6-variant-objects-with-tailwind) for variant patterns.

---

### Pattern 7: Icons from @photoroom/icons

Use the internal `@photoroom/icons` package for consistent icon styling. Icons use currentColor for color inheritance.

See [examples.md](examples.md#pattern-7-icons-from-photoroomicons) for icon patterns.

---

### Pattern 8: Responsive Design with Tailwind Breakpoints

Use Tailwind's responsive prefixes for mobile-first responsive design. Start with mobile styles, add breakpoint overrides.

See [examples.md](examples.md#pattern-8-responsive-design-with-tailwind-breakpoints) for responsive patterns.

</patterns>

---

<integration>

## Integration Guide

**Integrates with:**

- **@photoroom/ui**: Tailwind preset with design tokens
- **@photoroom/icons**: Icon components with currentColor inheritance
- **clsx**: Class composition utility
- **React components**: Via className prop and HTML attributes

**Token Sources:**

```javascript
// tailwind.config.js
module.exports = {
  presets: [require("@photoroom/ui/tailwind.config.js")],
  // Custom extensions...
};
```

**Token Categories:**

- **Spacing:** `p-2`, `gap-2`, `m-4`
- **Colors:** `text-black-alpha-8`, `bg-gray-100`
- **Border radius:** `rounded-400`, `rounded-lg`
- **Typography:** `text-500`

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
