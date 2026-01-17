# Tailwind CSS Core Examples

> Complete code examples for core Tailwind styling patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**For specialized patterns**: See topic-specific files in this folder:
- [variants.md](variants.md) - Variant objects for component states
- [responsive.md](responsive.md) - Responsive breakpoints, mobile-first design
- [global-styles.md](global-styles.md) - SCSS for fonts and global styles
- [icons.md](icons.md) - @photoroom/icons usage

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
