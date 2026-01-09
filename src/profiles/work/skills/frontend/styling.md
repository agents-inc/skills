---
name: Styling
description: Tailwind CSS, clsx, design tokens for Photoroom webapp
---

# Styling Patterns

> **Quick Guide:** Tailwind CSS is the primary styling approach. Use `clsx` for class composition. Design tokens from `@photoroom/ui` preset. SCSS is minimal (global styles only). Always expose `className` prop on components for composability.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

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

- Refer to React skill for component structure
- Refer to MobX skill for state-driven styling
- Refer to Accessibility skill for focus states and ARIA

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

Tailwind is the primary styling approach. Use utility classes directly in JSX.

#### Implementation

```tsx
// ✅ Good Example
export const Alert = ({ severity = "warning", children }: AlertProps) => {
  const { outerClassNames, icon: Icon } = severityVariants[severity];

  return (
    <div className="flex w-full items-center gap-2 rounded-400 p-2 text-500 text-black-alpha-8">
      <Icon className="h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
};
```

**Why good:** Utility classes are co-located with JSX, design tokens ensure consistency, no separate CSS files to manage, rapid iteration

```tsx
// ❌ Bad Example
import styles from "./Alert.module.scss";

export const Alert = ({ severity = "warning", children }: AlertProps) => {
  return (
    <div className={styles.alert}>
      <Icon className={styles.icon} />
      <div>{children}</div>
    </div>
  );
};
```

**Why bad:** Separate CSS files add indirection, class names need to be invented, harder to see styling at component level, more files to maintain

---

### Pattern 2: clsx for Class Composition

Use `clsx` for combining and conditionally applying Tailwind classes.

#### Import

```typescript
import clsx from "clsx";
```

#### Basic Composition

```tsx
// ✅ Good Example - Combining multiple class sources
<div
  className={clsx(
    "relative flex w-full max-w-[464px] items-center",
    "rounded-lg border border-gray-200",
    className,
    isActive && "border-blue-500"
  )}
>
```

**Why good:** Clear separation of concerns (base classes, modifiers, passed className, conditionals), readable multi-line format, type-safe conditionals

#### Conditional Classes

```tsx
// ✅ Good Example - Conditional class application
<button
  className={clsx(
    "px-4 py-2 rounded-md font-medium",
    variant === "primary" && "bg-gray-900 text-white",
    variant === "secondary" && "bg-gray-100 text-gray-900",
    variant === "ghost" && "bg-transparent hover:bg-gray-50",
    disabled && "opacity-50 cursor-not-allowed"
  )}
>
```

**Why good:** Each variant is clearly defined, easy to add/remove variants, conditions are explicit and type-checked

```tsx
// ❌ Bad Example - Template literals
<div className={`base-class ${isActive ? "active-class" : ""} ${className}`}>

// ❌ Bad Example - String concatenation
<div className={"base-class " + (isActive ? "active-class" : "") + " " + className}>
```

**Why bad:** Template literals produce trailing spaces when conditions are false, string concatenation is error-prone and hard to read, no type safety for class names

---

### Pattern 3: Design Tokens from @photoroom/ui Preset

Use the extended Tailwind config from `@photoroom/ui` for consistent design tokens.

#### Configuration

```javascript
// tailwind.config.js
module.exports = {
  presets: [require("@photoroom/ui/tailwind.config.js")],
  // Custom extensions...
};
```

#### Token Categories

**Spacing tokens:**
- `p-2`, `gap-2`, `m-4` - Standard Tailwind spacing
- Custom tokens from preset for consistent component sizing

**Color tokens:**
- `text-black-alpha-8` - Alpha-based text colors
- `bg-gray-100`, `border-gray-200` - Gray scale
- `text-500` - Typography-specific colors

**Border radius tokens:**
- `rounded-400` - Custom rounded values from preset
- `rounded-lg` - Standard Tailwind rounded values

#### Usage

```tsx
// ✅ Good Example - Using design tokens
<div className="flex w-full items-center gap-2 rounded-400 p-2 text-500 text-black-alpha-8">
  {children}
</div>
```

**Why good:** Design tokens ensure visual consistency, preset values are pre-approved by design team, automatic dark mode support if configured

```tsx
// ❌ Bad Example - Hardcoded values
<div style={{ padding: "8px", borderRadius: "4px", color: "rgba(0,0,0,0.8)" }}>
  {children}
</div>

// ❌ Bad Example - Arbitrary values instead of tokens
<div className="p-[8px] rounded-[4px] text-[rgba(0,0,0,0.8)]">
  {children}
</div>
```

**Why bad:** Hardcoded values break design system consistency, can't be themed, arbitrary values bypass design token system

---

### Pattern 4: Exposing className Prop for Composability

Always expose `className` prop on components and merge it with internal classes using `clsx`.

#### Props Pattern

```tsx
// ✅ Good Example - Props extending HTML attributes
export type LightPromoBannerProps = {
  title?: string;
  subtitle?: string;
  image?: React.ReactNode;
  className?: string;
  cta?: React.ReactNode;
  onClick?: () => void;
  onDismiss?: (event: React.MouseEvent<HTMLButtonElement>) => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const LightPromoBanner = ({
  title,
  subtitle,
  className,
  ...rest
}: LightPromoBannerProps) => {
  return (
    <div className={clsx("relative flex items-center gap-4 p-4", className)} {...rest}>
      {/* content */}
    </div>
  );
};
```

**Why good:** Component styles can be extended without wrapper divs, spread operator passes through all native HTML attributes, className is always last in clsx to allow overrides

#### Consumer Usage

```tsx
// ✅ Good Example - Consumer overriding styles
<LightPromoBanner
  title="Welcome"
  className="bg-blue-50 border-blue-200"
/>
```

**Why good:** Consumer can add or override styles without forking the component

```tsx
// ❌ Bad Example - No className prop
export type AlertProps = {
  children: React.ReactNode;
};

export const Alert = ({ children }: AlertProps) => {
  return (
    <div className="fixed-styles-that-cannot-be-overridden">
      {children}
    </div>
  );
};
```

**Why bad:** Consumers cannot customize appearance, leads to wrapper divs with overriding styles, creates specificity wars

---

### Pattern 5: SCSS Usage (Minimal - Global Styles Only)

SCSS is minimal in the webapp - primarily for global styles and font definitions.

#### File Locations

- `src/index.scss` - Global font definitions and base styles
- Component-specific SCSS is rare and discouraged

#### Custom Font Definition

```scss
// ✅ Good Example - src/index.scss
@font-face {
  font-family: "TT Photoroom";
  src: url("https://font-cdn.photoroom.com/fonts/tt-photoroom/TT_Photoroom_Regular.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: "TT Photoroom";
  src: url("https://font-cdn.photoroom.com/fonts/tt-photoroom/TT_Photoroom_Medium.woff2") format("woff2");
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: "TT Photoroom";
  src: url("https://font-cdn.photoroom.com/fonts/tt-photoroom/TT_Photoroom_Bold.woff2") format("woff2");
  font-weight: 700;
  font-display: swap;
}
```

**Why good:** CDN-hosted fonts for performance, font-display swap for better LCP, custom brand font with system fallbacks

```scss
// ❌ Bad Example - Component-level SCSS
// src/components/Button/Button.module.scss
.button {
  padding: 8px 16px;
  border-radius: 4px;
}
```

**Why bad:** Creates parallel styling system, loses Tailwind benefits, harder to maintain consistency

**When to use SCSS:**
- Global font-face definitions
- CSS reset/normalize if needed
- Third-party library style overrides

**When to use Tailwind instead:**
- Component styling
- Responsive designs
- Hover/focus states

---

### Pattern 6: Variant Objects with Tailwind

Use objects to map variants to class names for consistent variant handling.

#### Implementation

```tsx
// ✅ Good Example - Variant mapping object
const severityVariants = {
  warning: {
    outerClassNames: "bg-yellow-50 border-yellow-200",
    icon: ExclamationTriangleIcon,
  },
  error: {
    outerClassNames: "bg-red-50 border-red-200",
    icon: XCircleIcon,
  },
  success: {
    outerClassNames: "bg-green-50 border-green-200",
    icon: CheckCircleIcon,
  },
  info: {
    outerClassNames: "bg-blue-50 border-blue-200",
    icon: InformationCircleIcon,
  },
} as const;

export type AlertSeverity = keyof typeof severityVariants;

export type AlertProps = {
  severity?: AlertSeverity;
  children: React.ReactNode;
};

export const Alert = ({ severity = "warning", children }: AlertProps) => {
  const { outerClassNames, icon: Icon } = severityVariants[severity];

  return (
    <div className={clsx("flex w-full items-center gap-2", outerClassNames)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
};
```

**Why good:** Type-safe variants derived from object keys, centralized variant definitions, easy to add new variants, icon and styles co-located

```tsx
// ❌ Bad Example - Inline conditionals for many variants
<div className={clsx(
  "flex items-center",
  severity === "warning" && "bg-yellow-50",
  severity === "error" && "bg-red-50",
  severity === "success" && "bg-green-50",
  severity === "info" && "bg-blue-50",
  // ... more conditions
)}>
```

**Why bad:** Repetitive and verbose, harder to maintain, variant-specific logic scattered throughout

---

### Pattern 7: Icons from @photoroom/icons

Use the internal `@photoroom/icons` package for consistent icon styling.

#### Import Pattern

```tsx
// ✅ Good Example
import { ExclamationTriangleIcon } from "@photoroom/icons/lib/monochromes";
import { SaveIcon, TrashIcon } from "@photoroom/icons/lib/monochromes";
```

**Why good:** Design system compliance, consistent icon sizing and styling, smaller bundle size

```tsx
// ❌ Bad Example
import { Save } from "lucide-react";
import { FaSave } from "react-icons/fa";
```

**Why bad:** External libraries have inconsistent styling, increase bundle size, do not match design system

#### Icon Styling

```tsx
// ✅ Good Example - Icon with Tailwind classes
<Icon className="h-4 w-4 shrink-0" />
<Icon className="h-5 w-5 text-gray-500" />
```

**Why good:** Icons use currentColor by default for color inheritance, explicit sizing with Tailwind, shrink-0 prevents icon compression in flex containers

---

### Pattern 8: Responsive Design with Tailwind Breakpoints

Use Tailwind's responsive prefixes for mobile-first responsive design.

#### Breakpoint Prefixes

- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

#### Implementation

```tsx
// ✅ Good Example - Mobile-first responsive design
<div className={clsx(
  "flex flex-col gap-2",           // Mobile: stack vertically
  "sm:flex-row sm:gap-4",          // Small+: horizontal layout
  "lg:max-w-[800px] lg:mx-auto"    // Large+: constrain width
)}>
  <div className="w-full sm:w-1/2 lg:w-1/3">
    {/* Content */}
  </div>
</div>
```

**Why good:** Mobile-first approach, clear progression through breakpoints, all responsive behavior visible in one place

```tsx
// ❌ Bad Example - Desktop-first (harder to reason about)
<div className="flex-row lg:flex-col">
```

**Why bad:** Desktop-first is harder to maintain, mobile becomes afterthought

</patterns>

---

<anti_patterns>

## Anti-Patterns

### ❌ Using External Icon Libraries

Using libraries like `lucide-react` or `react-icons` breaks design system compliance and increases bundle size.

```tsx
// ❌ Avoid
import { Save } from "lucide-react";
import { FaSave } from "react-icons/fa";

// ✅ Instead use
import { SaveIcon } from "@photoroom/icons/lib/monochromes";
```

**Why this matters:** External icons have inconsistent visual weight, sizing, and styling that disrupts the unified design language.

---

### ❌ Template Literals for Class Composition

Template literals create subtle bugs with trailing spaces and are harder to read.

```tsx
// ❌ Avoid
<div className={`base-class ${isActive ? "active" : ""}`}>

// ✅ Instead use
<div className={clsx("base-class", isActive && "active")}>
```

**Why this matters:** Template literals produce `"base-class "` (trailing space) when conditions are false, which can cause styling issues.

---

### ❌ Hardcoded Style Values

Using inline styles or arbitrary Tailwind values bypasses the design token system.

```tsx
// ❌ Avoid
<div style={{ padding: "8px", color: "rgba(0,0,0,0.8)" }}>
<div className="p-[8px] text-[rgba(0,0,0,0.8)]">

// ✅ Instead use
<div className="p-2 text-black-alpha-8">
```

**Why this matters:** Hardcoded values cannot be themed, break visual consistency, and make design system updates impossible.

---

### ❌ Component-Level SCSS Files

Creating SCSS modules for individual components duplicates the styling system.

```scss
// ❌ Avoid - src/components/Button/Button.module.scss
.button {
  padding: 8px 16px;
  border-radius: 4px;
}
```

**Why this matters:** Maintains two parallel styling systems, loses Tailwind benefits like responsive utilities and design tokens.

---

### ❌ Components Without className Prop

Components that do not expose `className` cannot be customized by consumers.

```tsx
// ❌ Avoid
export const Card = ({ children }: { children: React.ReactNode }) => {
  return <div className="p-4 rounded-lg">{children}</div>;
};

// ✅ Instead use
export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={clsx("p-4 rounded-lg", className)}>{children}</div>;
};
```

**Why this matters:** Consumers must wrap components in extra divs to override styles, creating DOM bloat and specificity issues.

---

### ❌ Desktop-First Responsive Design

Starting with desktop styles and overriding for mobile is harder to maintain.

```tsx
// ❌ Avoid
<div className="flex-row lg:flex-col">

// ✅ Instead use
<div className="flex-col lg:flex-row">
```

**Why this matters:** Mobile-first ensures the base experience works on all devices, with enhancements layered on for larger screens.

</anti_patterns>

---

<decision_framework>

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

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using external icon libraries (lucide-react, react-icons) - use @photoroom/icons for design system compliance
- Template literals for class composition - use clsx for clean composition and conditional classes
- Hardcoded pixel/color values - use Tailwind design tokens from @photoroom/ui preset
- Component-level SCSS files - use Tailwind for component styling
- Components without className prop - expose for composability

**Medium Priority Issues:**

- Arbitrary Tailwind values like `p-[8px]` - Prefer preset tokens
- Inline styles with style prop - Use Tailwind classes
- Missing shrink-0 on flex icons - Icons may get crushed
- Desktop-first responsive design - Use mobile-first approach

**Common Mistakes:**

- Forgetting to spread `...rest` props after extracting className
- Placing className before base classes in clsx (prevents consumer overrides)
- Using string concatenation instead of clsx
- Creating SCSS modules for components (use Tailwind)
- Hardcoding colors instead of using token classes

**Gotchas & Edge Cases:**

- **clsx order matters:** Base classes first, conditionals second, className prop last for proper override behavior
- **Tailwind purge:** Dynamically constructed class names like `bg-${color}-500` are not included in build - use complete class names in variant objects
- **Icon sizing:** @photoroom/icons use currentColor for fill - set color on parent or icon directly
- **Arbitrary values:** Use sparingly and only for truly one-off values not in the design system

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Tailwind CSS as the primary styling approach for all components)**

**(You MUST use `clsx` for combining and conditionally applying classes - use this instead of template literals or string concatenation)**

**(You MUST use design tokens from `@photoroom/ui` preset via Tailwind - use these instead of hardcoded values)**

**(You MUST always expose `className` prop on components and merge it with internal classes using `clsx`)**

**(You MUST use `@photoroom/icons` for icons - use this instead of external libraries like lucide-react or react-icons)**

**Failure to follow these rules will break design system consistency and component composability.**

</critical_reminders>
