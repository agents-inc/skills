# CVA - Composition Examples

> VariantProps, class merging, and component integration. See [SKILL.md](../SKILL.md) for core concepts.

---

## VariantProps Type Extraction

### Good Example - Component Props Integration

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  ["font-semibold", "rounded", "transition-colors"],
  {
    variants: {
      intent: {
        primary: ["bg-blue-600", "text-white"],
        secondary: ["bg-gray-200", "text-gray-800"],
      },
      size: {
        sm: ["text-sm", "py-1", "px-2"],
        md: ["text-base", "py-2", "px-4"],
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  }
);

// Extract variant types from cva definition
type ButtonVariants = VariantProps<typeof buttonVariants>;
// Result: { intent?: "primary" | "secondary" | null; size?: "sm" | "md" | null }

// Component props extend variant types
interface ButtonProps extends ButtonVariants {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

// Framework-agnostic class generation
function getButtonClasses(props: ButtonVariants, className?: string): string {
  const { intent, size } = props;
  const baseClasses = buttonVariants({ intent, size });
  return className ? `${baseClasses} ${className}` : baseClasses;
}
```

**Why good:** VariantProps extracts exact types from cva, props always match available variants, single source of truth

### Bad Example - Manual Type Definition

```typescript
// WRONG - Manually defining types
type ButtonVariants = {
  intent?: "primary" | "secondary";
  size?: "sm" | "md";
};

// Later add "lg" size to cva but forget to update type
const buttonVariants = cva("...", {
  variants: {
    size: {
      sm: "...",
      md: "...",
      lg: "...", // Added here but not in ButtonVariants!
    },
  },
});

// "lg" works at runtime but TypeScript doesn't know about it
```

**Why bad:** Manual types drift from cva definition, defeats type safety purpose

---

## Class Merging with cx()

### Good Example - Combining Classes

```typescript
import { cva, cx, type VariantProps } from "class-variance-authority";

const cardVariants = cva(
  ["rounded-lg", "border", "p-4"],
  {
    variants: {
      elevation: {
        flat: ["shadow-none"],
        raised: ["shadow-md"],
      },
    },
    defaultVariants: {
      elevation: "flat",
    },
  }
);

type CardVariants = VariantProps<typeof cardVariants>;

interface CardProps extends CardVariants {
  className?: string;
  highlighted?: boolean;
}

function getCardClasses(props: CardProps): string {
  const { elevation, className, highlighted } = props;

  return cx(
    // Base variant classes
    cardVariants({ elevation }),
    // Conditional classes
    highlighted && "ring-2 ring-blue-500",
    // Additional classes from props
    className
  );
}

// Usage
getCardClasses({ elevation: "raised" });
// "rounded-lg border p-4 shadow-md"

getCardClasses({ elevation: "raised", highlighted: true });
// "rounded-lg border p-4 shadow-md ring-2 ring-blue-500"

getCardClasses({ elevation: "flat", className: "my-custom-class" });
// "rounded-lg border p-4 shadow-none my-custom-class"
```

**Why good:** cx() handles concatenation, falsy values are filtered, className prop allows customization

---

## Class Conflict Resolution

### Good Example - External Merge Utility

```typescript
import { cva, type VariantProps } from "class-variance-authority";
// Hypothetical utility that merges and dedupes classes
// (e.g., clsx + tailwind-merge combination)
import { cn } from "./utils";

const buttonVariants = cva(
  ["px-4", "py-2", "rounded", "font-semibold"],
  {
    variants: {
      size: {
        sm: ["px-2", "py-1", "text-sm"],
        lg: ["px-6", "py-3", "text-lg"],
      },
    },
    defaultVariants: {
      size: "sm",
    },
  }
);

// Wrapper function for conflict resolution
function button(
  variants: VariantProps<typeof buttonVariants>,
  className?: string
): string {
  return cn(buttonVariants(variants), className);
}

// When className overrides variant styles
button({ size: "sm" }, "px-8");
// Without merge: "px-4 py-2 rounded font-semibold px-2 py-1 text-sm px-8" (conflicts!)
// With merge: "py-1 rounded font-semibold text-sm px-8" (px-8 wins)
```

**Why good:** cn() resolves class conflicts, caller can override variant styles, escape hatch for customization

---

## Composing Multiple CVA Definitions

### Good Example - Base + Specific Variants

```typescript
import { cva, cx, type VariantProps } from "class-variance-authority";

// Base interactive styles (reusable)
const interactiveVariants = cva(
  ["transition-colors", "focus:outline-none", "focus-visible:ring-2", "focus-visible:ring-offset-2"],
  {
    variants: {
      focusColor: {
        blue: ["focus-visible:ring-blue-500"],
        green: ["focus-visible:ring-green-500"],
        red: ["focus-visible:ring-red-500"],
      },
    },
    defaultVariants: {
      focusColor: "blue",
    },
  }
);

// Button-specific variants
const buttonVariants = cva(
  ["font-semibold", "rounded", "inline-flex", "items-center", "justify-center"],
  {
    variants: {
      intent: {
        primary: ["bg-blue-600", "text-white", "hover:bg-blue-700"],
        secondary: ["bg-gray-200", "text-gray-800", "hover:bg-gray-300"],
      },
      size: {
        sm: ["text-sm", "h-8", "px-3"],
        md: ["text-base", "h-10", "px-4"],
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  }
);

// Combined types
type InteractiveVariants = VariantProps<typeof interactiveVariants>;
type ButtonVariants = VariantProps<typeof buttonVariants>;
type CombinedButtonProps = InteractiveVariants & ButtonVariants;

// Composition function
function button(props: CombinedButtonProps): string {
  const { focusColor, intent, size } = props;

  return cx(
    interactiveVariants({ focusColor }),
    buttonVariants({ intent, size })
  );
}

// Usage
button({ intent: "primary", size: "md", focusColor: "blue" });
// Combines both sets of classes
```

**Why good:** Shared base styles reused, specific variants for component type, cx() combines cleanly

---

## Multi-Part Component Pattern

### Good Example - Form Field Parts

```typescript
import { cva, type VariantProps } from "class-variance-authority";

// Variants for each part of the form field
const formFieldVariants = {
  label: cva(
    ["block", "font-medium", "text-gray-700"],
    {
      variants: {
        size: {
          sm: ["text-sm", "mb-1"],
          md: ["text-base", "mb-1.5"],
        },
        required: {
          false: null,
          true: ["after:content-['*']", "after:ml-0.5", "after:text-red-500"],
        },
      },
      defaultVariants: {
        size: "md",
        required: false,
      },
    }
  ),

  input: cva(
    ["w-full", "rounded", "border", "transition-colors"],
    {
      variants: {
        size: {
          sm: ["text-sm", "px-2", "py-1"],
          md: ["text-base", "px-3", "py-2"],
        },
        error: {
          false: ["border-gray-300", "focus:border-blue-500", "focus:ring-blue-500"],
          true: ["border-red-500", "focus:border-red-500", "focus:ring-red-500"],
        },
      },
      defaultVariants: {
        size: "md",
        error: false,
      },
    }
  ),

  helper: cva(
    ["mt-1"],
    {
      variants: {
        size: {
          sm: ["text-xs"],
          md: ["text-sm"],
        },
        error: {
          false: ["text-gray-500"],
          true: ["text-red-600"],
        },
      },
      defaultVariants: {
        size: "md",
        error: false,
      },
    }
  ),
};

// Shared size type for consistency
type FormFieldSize = NonNullable<VariantProps<typeof formFieldVariants.input>["size"]>;

// Get all classes for the form field
interface FormFieldClassesProps {
  size?: FormFieldSize;
  error?: boolean;
  required?: boolean;
}

function getFormFieldClasses(props: FormFieldClassesProps = {}) {
  const { size = "md", error = false, required = false } = props;

  return {
    label: formFieldVariants.label({ size, required }),
    input: formFieldVariants.input({ size, error }),
    helper: formFieldVariants.helper({ size, error }),
  };
}

// Usage
const classes = getFormFieldClasses({ size: "sm", error: true, required: true });
// classes.label, classes.input, classes.helper
```

**Why good:** Each part has own cva, shared size ensures visual consistency, error state propagates appropriately

---

## Extending Variants

### Good Example - Specialized Component

```typescript
import { cva, cx, type VariantProps } from "class-variance-authority";

// Base link variants
const linkVariants = cva(
  ["underline-offset-2", "transition-colors"],
  {
    variants: {
      color: {
        primary: ["text-blue-600", "hover:text-blue-800"],
        secondary: ["text-gray-600", "hover:text-gray-800"],
      },
      underline: {
        always: ["underline"],
        hover: ["hover:underline"],
        none: ["no-underline"],
      },
    },
    defaultVariants: {
      color: "primary",
      underline: "hover",
    },
  }
);

// Navigation link extends base link
const navLinkVariants = cva(
  ["font-medium", "px-3", "py-2", "rounded"],
  {
    variants: {
      active: {
        false: null,
        true: ["bg-blue-100"],
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

// Combined navigation link
type NavLinkProps = VariantProps<typeof linkVariants> &
  VariantProps<typeof navLinkVariants>;

function navLink(props: NavLinkProps): string {
  const { color, underline, active } = props;

  return cx(
    linkVariants({ color, underline: underline ?? "none" }), // Override default underline
    navLinkVariants({ active })
  );
}
```

**Why good:** Base link reusable, nav link extends with specific styling, can override base defaults

---

## Quick Reference

| Function/Type | Purpose |
|---------------|---------|
| `VariantProps<typeof cva>` | Extract variant types |
| `cx(...classes)` | Concatenate classes |
| `cn(...)` | Merge with conflict resolution |

| Pattern | Use When |
|---------|----------|
| Single cva | Simple component, few variants |
| Multiple cva (parts) | Multi-part component (form field, card) |
| Composed cva | Shared base + specific variants |
| Extended variants | Specialized component from base |
