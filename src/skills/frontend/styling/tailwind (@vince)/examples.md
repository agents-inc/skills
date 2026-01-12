# Tailwind CSS Examples

> Complete code examples for Tailwind styling patterns. See [SKILL.md](SKILL.md) for core concepts.

---

## Pattern 1: Tailwind CSS Utility-First Styling

### Good Example - Utility classes directly in JSX

```tsx
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

### Bad Example - Separate SCSS modules

```tsx
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

## Pattern 2: clsx for Class Composition

### Import

```typescript
import clsx from "clsx";
```

### Good Example - Combining multiple class sources

```tsx
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

### Good Example - Conditional class application

```tsx
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

### Bad Example - Template literals

```tsx
<div className={`base-class ${isActive ? "active-class" : ""} ${className}`}>
```

**Why bad:** Template literals produce trailing spaces when conditions are false, string concatenation is error-prone and hard to read, no type safety for class names

### Bad Example - String concatenation

```tsx
<div className={"base-class " + (isActive ? "active-class" : "") + " " + className}>
```

**Why bad:** Error-prone, hard to read, produces inconsistent spacing

---

## Pattern 3: Design Tokens from @photoroom/ui Preset

### Configuration

```javascript
// tailwind.config.js
module.exports = {
  presets: [require("@photoroom/ui/tailwind.config.js")],
  // Custom extensions...
};
```

### Token Categories

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

### Good Example - Using design tokens

```tsx
<div className="flex w-full items-center gap-2 rounded-400 p-2 text-500 text-black-alpha-8">
  {children}
</div>
```

**Why good:** Design tokens ensure visual consistency, preset values are pre-approved by design team, automatic dark mode support if configured

### Bad Example - Hardcoded values

```tsx
<div style={{ padding: "8px", borderRadius: "4px", color: "rgba(0,0,0,0.8)" }}>
  {children}
</div>
```

**Why bad:** Hardcoded values break design system consistency, can't be themed

### Bad Example - Arbitrary values instead of tokens

```tsx
<div className="p-[8px] rounded-[4px] text-[rgba(0,0,0,0.8)]">
  {children}
</div>
```

**Why bad:** Arbitrary values bypass design token system, inconsistent with rest of app

---

## Pattern 4: Exposing className Prop for Composability

### Good Example - Props extending HTML attributes

```tsx
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

### Good Example - Consumer overriding styles

```tsx
<LightPromoBanner
  title="Welcome"
  className="bg-blue-50 border-blue-200"
/>
```

**Why good:** Consumer can add or override styles without forking the component

### Bad Example - No className prop

```tsx
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

## Pattern 5: SCSS Usage (Minimal - Global Styles Only)

### File Locations

- `src/index.scss` - Global font definitions and base styles
- Component-specific SCSS is rare and discouraged

### Good Example - Custom Font Definition

```scss
// src/index.scss
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

### Bad Example - Component-level SCSS

```scss
// src/components/Button/Button.module.scss
.button {
  padding: 8px 16px;
  border-radius: 4px;
}
```

**Why bad:** Creates parallel styling system, loses Tailwind benefits, harder to maintain consistency

---

## Pattern 6: Variant Objects with Tailwind

### Good Example - Variant mapping object

```tsx
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

### Bad Example - Inline conditionals for many variants

```tsx
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

## Pattern 7: Icons from @photoroom/icons

### Good Example - Import Pattern

```tsx
import { ExclamationTriangleIcon } from "@photoroom/icons/lib/monochromes";
import { SaveIcon, TrashIcon } from "@photoroom/icons/lib/monochromes";
```

**Why good:** Design system compliance, consistent icon sizing and styling, smaller bundle size

### Bad Example - External libraries

```tsx
import { Save } from "lucide-react";
import { FaSave } from "react-icons/fa";
```

**Why bad:** External libraries have inconsistent styling, increase bundle size, do not match design system

### Good Example - Icon with Tailwind classes

```tsx
<Icon className="h-4 w-4 shrink-0" />
<Icon className="h-5 w-5 text-gray-500" />
```

**Why good:** Icons use currentColor by default for color inheritance, explicit sizing with Tailwind, shrink-0 prevents icon compression in flex containers

---

## Pattern 8: Responsive Design with Tailwind Breakpoints

### Breakpoint Prefixes

- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

### Good Example - Mobile-first responsive design

```tsx
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

### Bad Example - Desktop-first (harder to reason about)

```tsx
<div className="flex-row lg:flex-col">
```

**Why bad:** Desktop-first is harder to maintain, mobile becomes afterthought
