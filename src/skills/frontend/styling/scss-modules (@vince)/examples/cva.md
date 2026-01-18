# SCSS Modules cva Integration Examples

> Class Variance Authority (cva) integration patterns for SCSS Modules. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for foundational patterns.

**Current Version:** v0.7.1 (`class-variance-authority`) | v1.0 Beta (`cva` package)

---

## Pattern 12: cva (Class Variance Authority) Integration

### Core Concepts

cva provides type-safe variant management for components with multiple variants. It works seamlessly with SCSS Modules.

**Key features:**
- Type-safe variant props with autocomplete
- `VariantProps` utility for extracting TypeScript types
- Built-in `cx` utility (alias of clsx)
- Support for compound variants and boolean variants
- v1 Beta: `defineConfig`, `compose`, and `onComplete` hooks

### Basic Implementation

```typescript
import { cva, cx, type VariantProps } from "class-variance-authority";
import styles from "./alert.module.scss";

const ANIMATION_DURATION_MS = 200;

const alertVariants = cva(styles.alert, {
  variants: {
    variant: {
      info: styles.alertInfo,
      warning: styles.alertWarning,
      error: styles.alertError,
      success: styles.alertSuccess,
    },
    size: {
      sm: styles.alertSm,
      md: styles.alertMd,
      lg: styles.alertLg,
    },
  },
  defaultVariants: {
    variant: "info",
    size: "md",
  },
});

export type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants>;

export const Alert = ({ variant, size, className, ...props }: AlertProps) => {
  return (
    <div
      className={alertVariants({ variant, size, className })}
      style={{ transition: `all ${ANIMATION_DURATION_MS}ms ease` }}
      {...props}
    />
  );
};
```

**Why good:** cva provides type-safe variant props with autocomplete, defaultVariants prevent undefined behavior, named constant for animation duration prevents magic numbers, VariantProps extracts correct TypeScript types from cva definition, base class passed as first argument

---

### cx Utility (Built-in clsx Alias)

cva exports a `cx` utility that is an alias of `clsx` for concatenating class names:

```typescript
import { cva, cx } from "class-variance-authority";
import styles from "./card.module.scss";

// Use cx to combine classes
const cardClasses = cx(
  styles.card,
  styles.cardElevated,
  isActive && styles.cardActive,
  { [styles.cardHighlighted]: isHighlighted }
);

// cx also works with arrays
const dynamicClasses = cx([
  styles.base,
  condition && styles.conditional,
]);
```

**Why use cx:** Built-in with cva (no extra import), same API as clsx, handles conditional classes

### Button Example with Full States

```scss
// packages/ui/src/components/button/button.module.scss
.btn {
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: var(--text-size-body);
  font-weight: 600;

  border-radius: var(--radius-sm);
  border: 1px solid transparent;

  cursor: pointer;
  transition: all 0.2s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btnDefault {
  background-color: var(--color-surface-base);
  color: var(--color-text-default);
  border-color: var(--color-surface-subtle);

  &:hover:not(:disabled) {
    background-color: var(--color-surface-subtle);
  }

  &[data-active="true"] {
    color: var(--color-text-muted);
    background: var(--color-surface-strong);
  }
}

.btnGhost {
  background-color: transparent;

  &:hover:not(:disabled) {
    background-color: var(--color-surface-subtle);
  }
}

.btnSizeDefault {
  padding: var(--space-md);
}

.btnSizeLarge {
  padding: var(--space-xlg) var(--space-xxlg);
}

.btnSizeIcon {
  padding: var(--space-md);
  aspect-ratio: 1;
}
```

**Why good:** design tokens ensure consistency across components, data-attributes for state styling separate state from presentation, scoped styles prevent global namespace pollution, disabled and hover states properly handled

### Bad Example - Hardcoded Values

```scss
.button {
  padding: 12px 24px; // Magic numbers
  background: #3b82f6; // Hardcoded color
  border-radius: 8px; // Magic number
}

.button.active {
  background: #2563eb; // className toggling for state
}
```

**Why bad:** hardcoded values prevent theme switching and break design system consistency, magic numbers are unmaintainable and inconsistent across components, className toggling for state is harder to manage than data-attributes

---

### Compound Variants

Compound variants apply styles when multiple variant conditions are met simultaneously:

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import styles from "./button.module.scss";

const buttonVariants = cva(styles.btn, {
  variants: {
    intent: {
      primary: styles.btnPrimary,
      secondary: styles.btnSecondary,
      danger: styles.btnDanger,
    },
    size: {
      sm: styles.btnSm,
      md: styles.btnMd,
      lg: styles.btnLg,
    },
    disabled: {
      true: styles.btnDisabled,
      false: null,
    },
  },
  compoundVariants: [
    // Apply hover styles only when not disabled
    {
      intent: "primary",
      disabled: false,
      class: styles.btnPrimaryHover,
    },
    // Target multiple intents with same compound style
    {
      intent: ["primary", "secondary"],
      size: "lg",
      class: styles.btnLargeElevated,
    },
  ],
  defaultVariants: {
    intent: "primary",
    size: "md",
    disabled: false,
  },
});
```

**Why use compound variants:** Apply styles only when specific combinations occur, avoid complex CSS selectors, keep styling logic in one place

---

### Boolean Variants

Boolean variants simplify true/false state management:

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import styles from "./input.module.scss";

const inputVariants = cva(styles.input, {
  variants: {
    size: {
      sm: styles.inputSm,
      md: styles.inputMd,
      lg: styles.inputLg,
    },
    disabled: {
      true: styles.inputDisabled,
      false: null,
    },
    hasError: {
      true: styles.inputError,
      false: null,
    },
    fullWidth: {
      true: styles.inputFullWidth,
      false: null,
    },
  },
  defaultVariants: {
    size: "md",
    disabled: false,
    hasError: false,
    fullWidth: false,
  },
});

export type InputProps = React.ComponentProps<"input"> &
  VariantProps<typeof inputVariants>;

export const Input = ({ size, disabled, hasError, fullWidth, className, ...props }: InputProps) => {
  return (
    <input
      className={inputVariants({ size, disabled, hasError, fullWidth, className })}
      disabled={disabled === true}
      {...props}
    />
  );
};
```

**Why use boolean variants:** Type-safe boolean props, cleaner API than string enums for true/false states, `null` value means no class applied

---

### Required Variants (TypeScript Pattern)

cva keeps API minimal by delegating variant requirement enforcement to TypeScript:

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import styles from "./badge.module.scss";

const badgeVariants = cva(styles.badge, {
  variants: {
    // Optional variant (has default)
    size: {
      sm: styles.badgeSm,
      md: styles.badgeMd,
    },
    // Required variant (no default, must be provided)
    color: {
      info: styles.badgeInfo,
      success: styles.badgeSuccess,
      warning: styles.badgeWarning,
      error: styles.badgeError,
    },
  },
  defaultVariants: {
    size: "md",
    // Note: color has no default - we make it required via TypeScript
  },
});

// Extract base variant props
type BadgeVariantProps = VariantProps<typeof badgeVariants>;

// Make 'color' required using TypeScript utilities
export interface BadgeProps
  extends Omit<BadgeVariantProps, "color">,
    Required<Pick<BadgeVariantProps, "color">> {}

// Usage: color is now required, size is optional
export const Badge = ({ size, color, className, children }: BadgeProps & { children: React.ReactNode; className?: string }) => {
  return (
    <span className={badgeVariants({ size, color, className })}>
      {children}
    </span>
  );
};
```

**Why this pattern:** TypeScript enforces required variants at compile time, keeps cva API simple, explicit about what's required vs optional

---

### Extending Components (className prop)

cva supports extending components with additional classes via `class` or `className`:

```typescript
// Base button variants
const button = cva(styles.btn, {
  variants: {
    intent: { primary: styles.btnPrimary, secondary: styles.btnSecondary },
    size: { sm: styles.btnSm, md: styles.btnMd },
  },
  defaultVariants: { intent: "primary", size: "md" },
});

// Usage - extend with additional className
button({ intent: "primary", className: styles.customMargin });
// Result: "btn btnPrimary btnMd customMargin"

// Both 'class' and 'className' work identically
button({ intent: "primary", class: styles.customMargin });
```

**Why good:** Additional classes append to component classes, enables composition without modifying base component

---

### v1 Beta Features (Preview)

> **Note:** v1.0 is in beta. These features may change before stable release. Install with `npm i cva@beta`.

#### defineConfig with Hooks

v1 introduces `defineConfig` for configuring cva behavior, including hooks for class processing:

```typescript
// lib/cva.ts
import { defineConfig } from "cva";
import { twMerge } from "tailwind-merge";

// Create configured cva instance with tailwind-merge
export const { cva, cx, compose } = defineConfig({
  hooks: {
    // onComplete runs after class generation
    onComplete: (className) => twMerge(className),
  },
});
```

```typescript
// components/button.tsx
// Import from your configured cva, not the package
import { cva, type VariantProps } from "@/lib/cva";
import styles from "./button.module.scss";

// Now all cva classes automatically go through twMerge
const buttonVariants = cva(styles.btn, {
  variants: {
    intent: { primary: styles.btnPrimary },
  },
});
```

**Why defineConfig:** Centralized configuration, automatic tailwind-merge integration, no manual twMerge calls

#### compose Function

v1 adds `compose` for combining multiple cva components:

```typescript
import { cva, compose, type VariantProps } from "cva";
import styles from "./card.module.scss";

// Base spacing variants
const box = cva("", {
  variants: {
    padding: {
      sm: styles.paddingSm,
      md: styles.paddingMd,
      lg: styles.paddingLg,
    },
  },
});

// Card-specific variants
const cardBase = cva(styles.card, {
  variants: {
    shadow: {
      none: styles.shadowNone,
      sm: styles.shadowSm,
      md: styles.shadowMd,
    },
  },
});

// Compose both into single component
const card = compose(box, cardBase);

// Usage - accepts variants from both components
card({ padding: "md", shadow: "sm" });
```

**Why compose:** Combine variants from multiple sources, better code reuse, cleaner than manual cx composition
