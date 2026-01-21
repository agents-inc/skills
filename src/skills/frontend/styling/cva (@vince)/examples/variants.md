# CVA - Variant Definition Examples

> Basic variants, boolean states, and default values. See [SKILL.md](../SKILL.md) for core concepts.

---

## Basic Variant Structure

### Good Example - Button Variants

```typescript
import { cva, type VariantProps } from "class-variance-authority";

// Good: Base classes as array, clear variant structure
const buttonVariants = cva(
  // Base classes applied to all variants
  ["font-semibold", "border", "rounded", "transition-colors", "inline-flex", "items-center", "justify-center"],
  {
    variants: {
      intent: {
        primary: ["bg-blue-600", "text-white", "border-transparent", "hover:bg-blue-700"],
        secondary: ["bg-white", "text-gray-800", "border-gray-400", "hover:bg-gray-100"],
        danger: ["bg-red-600", "text-white", "border-transparent", "hover:bg-red-700"],
        ghost: ["bg-transparent", "text-gray-600", "border-transparent", "hover:bg-gray-100"],
      },
      size: {
        sm: ["text-sm", "py-1", "px-2", "gap-1"],
        md: ["text-base", "py-2", "px-4", "gap-2"],
        lg: ["text-lg", "py-3", "px-6", "gap-3"],
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  }
);

// Usage
buttonVariants(); // Uses defaults: primary + md
buttonVariants({ intent: "secondary" }); // secondary + md (size from default)
buttonVariants({ intent: "danger", size: "lg" }); // danger + lg

// Extract types
type ButtonVariants = VariantProps<typeof buttonVariants>;
// { intent?: "primary" | "secondary" | "danger" | "ghost" | null; size?: "sm" | "md" | "lg" | null }
```

**Why good:** Base classes in array for readability, all variants explicit, defaultVariants ensures consistent initial state, VariantProps for type extraction

### Bad Example - Missing Defaults

```typescript
// WRONG - No defaultVariants
const buttonVariants = cva("font-semibold border rounded", {
  variants: {
    intent: {
      primary: "bg-blue-600 text-white",
      secondary: "bg-white text-gray-800",
    },
    // No size variant defined
  },
  // No defaultVariants!
});

// Caller problems:
buttonVariants(); // No intent classes applied!
buttonVariants({ size: "lg" }); // Error: size doesn't exist
```

**Why bad:** No defaults means empty variant classes, missing variants cause confusion, string classes harder to read

---

## Boolean Variants

### Good Example - Disabled and Loading States

```typescript
import { cva } from "class-variance-authority";

const inputVariants = cva(
  ["w-full", "border", "rounded", "px-3", "py-2", "transition-colors"],
  {
    variants: {
      size: {
        sm: ["text-sm", "h-8"],
        md: ["text-base", "h-10"],
        lg: ["text-lg", "h-12"],
      },
      // Boolean variant - define both true and false
      disabled: {
        false: ["bg-white", "cursor-text", "focus:ring-2", "focus:ring-blue-500"],
        true: ["bg-gray-100", "cursor-not-allowed", "opacity-60"],
      },
      error: {
        false: ["border-gray-300", "focus:border-blue-500"],
        true: ["border-red-500", "focus:border-red-600", "text-red-900"],
      },
      loading: {
        false: null, // No additional classes when not loading
        true: ["animate-pulse", "pointer-events-none"],
      },
    },
    defaultVariants: {
      size: "md",
      disabled: false,
      error: false,
      loading: false,
    },
  }
);

// Usage
inputVariants({ disabled: true }); // Disabled styles
inputVariants({ error: true }); // Error state
inputVariants({ loading: true, disabled: true }); // Combined states
```

**Why good:** Both true and false cases defined, null for "no additional classes", explicit defaults prevent undefined behavior

### Bad Example - Only True Case

```typescript
// WRONG - Only defining true case
const inputVariants = cva("border rounded px-3 py-2", {
  variants: {
    disabled: {
      true: "bg-gray-100 cursor-not-allowed opacity-60",
      // Missing false case!
    },
  },
});

// Problem:
inputVariants({ disabled: false }); // No enabled styles applied
```

**Why bad:** Missing false case means no styles when enabled, must handle enabled state elsewhere

---

## Multiple Variant Groups

### Good Example - Badge Component

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  ["inline-flex", "items-center", "rounded-full", "font-medium"],
  {
    variants: {
      color: {
        gray: ["bg-gray-100", "text-gray-800"],
        red: ["bg-red-100", "text-red-800"],
        yellow: ["bg-yellow-100", "text-yellow-800"],
        green: ["bg-green-100", "text-green-800"],
        blue: ["bg-blue-100", "text-blue-800"],
        purple: ["bg-purple-100", "text-purple-800"],
      },
      size: {
        sm: ["text-xs", "px-2", "py-0.5"],
        md: ["text-sm", "px-2.5", "py-0.5"],
        lg: ["text-base", "px-3", "py-1"],
      },
      variant: {
        solid: null, // Uses color's background
        outline: ["bg-transparent", "ring-1", "ring-inset"],
        subtle: ["bg-opacity-50"],
      },
    },
    defaultVariants: {
      color: "gray",
      size: "md",
      variant: "solid",
    },
  }
);

// Usage
badgeVariants({ color: "green", size: "sm" }); // Small green badge
badgeVariants({ color: "red", variant: "outline" }); // Red outline badge

type BadgeVariants = VariantProps<typeof badgeVariants>;
```

**Why good:** Multiple variant dimensions, null for no-op variant option, clear naming conventions

---

## Icon + Text Pattern

### Good Example - Button with Icon Sizes

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const iconButtonVariants = cva(
  ["inline-flex", "items-center", "justify-center", "rounded", "font-medium", "transition-colors"],
  {
    variants: {
      intent: {
        primary: ["bg-blue-600", "text-white", "hover:bg-blue-700"],
        secondary: ["bg-gray-200", "text-gray-800", "hover:bg-gray-300"],
      },
      size: {
        sm: ["h-8", "px-2", "text-sm", "gap-1"],
        md: ["h-10", "px-3", "text-base", "gap-2"],
        lg: ["h-12", "px-4", "text-lg", "gap-2"],
      },
      // Icon-only variant adjusts width
      iconOnly: {
        false: null,
        true: null, // Handled by compoundVariants
      },
    },
    compoundVariants: [
      // Icon-only buttons are square
      { iconOnly: true, size: "sm", class: ["w-8", "px-0"] },
      { iconOnly: true, size: "md", class: ["w-10", "px-0"] },
      { iconOnly: true, size: "lg", class: ["w-12", "px-0"] },
    ],
    defaultVariants: {
      intent: "primary",
      size: "md",
      iconOnly: false,
    },
  }
);

// Usage
iconButtonVariants({ size: "sm" }); // Normal button
iconButtonVariants({ size: "sm", iconOnly: true }); // Square icon button

type IconButtonVariants = VariantProps<typeof iconButtonVariants>;
```

**Why good:** iconOnly variant with compoundVariants for size-specific adjustments, maintains consistent height

---

## Required Variants (No Defaults)

### Good Example - Status Indicator

```typescript
import { cva, type VariantProps } from "class-variance-authority";

// Status MUST be specified - no default
const statusIndicatorVariants = cva(
  ["inline-flex", "items-center", "gap-2", "text-sm", "font-medium"],
  {
    variants: {
      status: {
        pending: ["text-yellow-700"],
        active: ["text-green-700"],
        inactive: ["text-gray-500"],
        error: ["text-red-700"],
      },
    },
    // No defaultVariants for status - caller MUST specify
  }
);

// Type extraction with required variant
type StatusVariants = VariantProps<typeof statusIndicatorVariants>;
// { status?: "pending" | "active" | "inactive" | "error" | null }

// Make status required in component props
type StatusIndicatorProps = Omit<StatusVariants, "status"> &
  Required<Pick<StatusVariants, "status">> & {
    label: string;
  };

// Usage function enforcing required status
function createStatusClasses(props: StatusIndicatorProps): string {
  return statusIndicatorVariants({ status: props.status });
}

// Compile error if status not provided
// createStatusClasses({ label: "Test" }); // Error: status is required
createStatusClasses({ status: "active", label: "Test" }); // OK
```

**Why good:** No default forces explicit status, TypeScript utility types enforce required prop

---

## Quick Reference

| Pattern | Use When |
|---------|----------|
| String base | Simple, few base classes |
| Array base | Many base classes, readability |
| Boolean variant (true/false) | Toggle states (disabled, error, loading) |
| null variant value | No additional classes for that option |
| defaultVariants | Always, unless variant is intentionally required |
| No defaultVariants | Caller must always specify |

| Naming Convention | Examples |
|-------------------|----------|
| `intent` | primary, secondary, danger, ghost |
| `size` | sm, md, lg, xl |
| `variant` | solid, outline, ghost, link |
| `color` | gray, red, green, blue |
| Boolean | disabled, error, loading, active |
