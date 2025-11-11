## Brief overview

Project-specific guidelines for converting Tailwind-based components to CSS Modules with SCSS syntax. All conversions must comply with the component styling standards defined in `.claude/component-styling-standards.md`.

## Conversion methodology

- Analyze the Tailwind component structure, variants, states, and responsive behavior before starting
- Create the `.module.scss` file following the component styling standards for structure and organization
- Update the component file to use CSS Modules with class-variance-authority (cva) for variants
- Test the converted component in both light and dark modes to ensure proper functionality

## Component variable patterns from existing components

Based on existing components like Button and Card, create component-specific variables only when they add value:

```scss
.button {
  // Component-specific variables that are reused or change with variants
  --button-accent-bg: transparent;
  --button-focus-ring-width: 3px;
  --button-border-width: 1px;
  --button-border-width-hover: 2px;
  --button-underline-offset: 4px;

  // Use design tokens directly for standard properties
  border-radius: var(--space-3);
  font-size: var(--font-size-body);
  color: var(--color-text-default);
}
```

## TypeScript component structure with cva

Use class-variance-authority (cva) only for components with multiple variants and states (like Button with variant + size combinations). For simpler components with few or no variants, use direct CSS Modules imports without cva.

**Use cva for complex components:**

```tsx
// Button component with multiple variants and sizes
import { cva, type VariantProps } from "class-variance-authority";
import styles from "./button.module.scss";

const buttonVariants = cva(styles.button, {
  variants: {
    variant: {
      default: styles.default,
      destructive: styles.destructive,
      outline: styles.outline,
    },
    size: {
      default: styles.sizeDefault,
      sm: styles.sizeSm,
      lg: styles.sizeLg,
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
```

**Use simple CSS Modules for basic components:**

```tsx
// Simple component with minimal variants
import styles from "./component.module.scss";

function Component({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(styles.component, className)} {...props} />;
}
```

**Full cva example for complex components:**

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import styles from "./component.module.scss";

const componentVariants = cva(styles.component, {
  variants: {
    variant: {
      default: styles.default,
      destructive: styles.destructive,
      outline: styles.outline,
    },
    size: {
      default: styles.sizeDefault,
      sm: styles.sizeSm,
      lg: styles.sizeLg,
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

function Component({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof componentVariants>) {
  return <div className={cn(componentVariants({ variant, size, className }))} {...props} />;
}
```

## Advanced CSS patterns from existing components

Use modern CSS features as demonstrated in existing components:

```scss
.cardHeader {
  // Use CSS Grid for complex layouts
  display: grid;
  grid-template-columns: 1fr auto;

  // Use :has() for conditional styling
  &:has([data-slot="card-action"]) {
    grid-template-columns: 1fr auto;
  }

  // Use :global() for handling global classes
  &:global(.border-b) {
    padding-bottom: var(--space-12);
  }
}

.button {
  // Use data-attributes for state management
  &[data-state="open"],
  &:hover {
    background-color: var(--button-accent-bg);
  }

  // Use :has() for conditional padding
  &:has(> svg) {
    padding-left: var(--space-6);
    padding-right: var(--space-6);
  }
}
```

## Color and spacing conversion examples

Convert Tailwind utilities to design tokens following existing patterns:

```scss
// From Tailwind: bg-slate-900 text-white hover:bg-slate-800
// To CSS Modules:
.default {
  background-color: var(--color-background-dark);
  color: var(--color-text-light);

  &:hover {
    background-color: var(--color-primary-hover);
  }
}

// From Tailwind: border border-slate-200 hover:bg-slate-100
// To CSS Modules:
.outline {
  border: var(--button-border-width-hover) solid transparent;
  box-shadow: 0 0 0 var(--button-border-width) var(--color-border-default);
  background-color: var(--color-background-base);

  &:hover {
    background-color: var(--button-accent-bg);
    border: var(--button-border-width-hover) solid var(--color-border-darkish);
  }
}
```

## Size and spacing patterns

Follow existing size variant patterns:

```scss
// Size variants with consistent spacing tokens
.sizeDefault {
  height: var(--space-18);
  padding: var(--space-6) var(--space-6);
}

.sizeSm {
  height: var(--space-14);
  gap: var(--space-3);
  padding: var(--space-1) var(--space-6);
}

.sizeLg {
  height: var(--space-20);
  padding: var(--space-6) var(--space-10);
}
```

## State handling patterns

Convert Tailwind state modifiers to proper CSS selectors:

```scss
.button {
  // Disabled state
  &:disabled {
    pointer-events: none;
    opacity: 0.5;
  }

  // Focus state
  &:focus-visible {
    border-color: var(--color-ring);
  }

  // Invalid state
  &[aria-invalid="true"] {
    border-color: var(--color-destructive);
  }
}
```

## Conversion validation checklist

- All Tailwind classes removed and replaced with CSS Modules following existing component patterns
- Component-specific variables created only when they add value (reuse, variants, calculations)
- Design tokens used directly from design-tokens.scss wherever possible
- cva used for variant management with proper TypeScript integration
- Modern CSS features (:has(), :global(), data-attributes) used appropriately
- Size and spacing follow existing token patterns (var(--space-X))
- State management follows existing patterns (disabled, focus-visible, data-state)
- Component functionality preserved with improved maintainability
- Testing completed in both light and dark modes
