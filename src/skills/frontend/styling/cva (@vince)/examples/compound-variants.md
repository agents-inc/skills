# CVA - Compound Variants Examples

> Multi-condition styles and complex variant combinations. See [SKILL.md](../SKILL.md) for core concepts.

---

## Basic Compound Variants

### Good Example - Hover States When Enabled

```typescript
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  ["font-semibold", "border", "rounded", "transition-colors"],
  {
    variants: {
      intent: {
        primary: ["bg-blue-600", "text-white", "border-transparent"],
        secondary: ["bg-white", "text-gray-800", "border-gray-400"],
        danger: ["bg-red-600", "text-white", "border-transparent"],
      },
      disabled: {
        false: null,
        true: ["opacity-50", "cursor-not-allowed"],
      },
    },
    compoundVariants: [
      // Hover states ONLY when not disabled
      {
        intent: "primary",
        disabled: false,
        class: ["hover:bg-blue-700", "focus:ring-2", "focus:ring-blue-500"],
      },
      {
        intent: "secondary",
        disabled: false,
        class: ["hover:bg-gray-100", "focus:ring-2", "focus:ring-gray-400"],
      },
      {
        intent: "danger",
        disabled: false,
        class: ["hover:bg-red-700", "focus:ring-2", "focus:ring-red-500"],
      },
    ],
    defaultVariants: {
      intent: "primary",
      disabled: false,
    },
  }
);

// Usage
buttonVariants({ intent: "primary" }); // Includes hover styles
buttonVariants({ intent: "primary", disabled: true }); // No hover styles
```

**Why good:** Hover/focus styles only when interactive, compound variants express "when X AND Y" cleanly, avoids CSS :not(:disabled) complexity

### Bad Example - Nested Ternaries Instead

```typescript
// WRONG - Complex ternaries for combined states
function getButtonClasses(intent: string, disabled: boolean) {
  const base = "font-semibold border rounded";
  const intentClass = intent === "primary" ? "bg-blue-600" : "bg-white";
  // Nested ternary mess for hover
  const hoverClass = !disabled
    ? intent === "primary"
      ? "hover:bg-blue-700"
      : intent === "secondary"
        ? "hover:bg-gray-100"
        : "hover:bg-red-700"
    : "";
  return `${base} ${intentClass} ${hoverClass}`;
}
```

**Why bad:** Hard to read and maintain, easy to miss cases, no type safety

---

## Array Syntax for Multiple Matches

### Good Example - Shared Styles Across Intents

```typescript
import { cva } from "class-variance-authority";

const alertVariants = cva(
  ["p-4", "rounded-lg", "border"],
  {
    variants: {
      intent: {
        info: ["bg-blue-50", "border-blue-200", "text-blue-800"],
        success: ["bg-green-50", "border-green-200", "text-green-800"],
        warning: ["bg-yellow-50", "border-yellow-200", "text-yellow-800"],
        error: ["bg-red-50", "border-red-200", "text-red-800"],
      },
      size: {
        sm: ["text-sm", "p-2"],
        md: ["text-base", "p-4"],
        lg: ["text-lg", "p-6"],
      },
      dismissible: {
        false: null,
        true: ["pr-10"], // Extra padding for close button
      },
    },
    compoundVariants: [
      // Array syntax: applies to info AND success
      {
        intent: ["info", "success"],
        size: "lg",
        class: ["shadow-lg"],
      },
      // Array syntax: warning OR error at medium or large
      {
        intent: ["warning", "error"],
        size: ["md", "lg"],
        class: ["font-medium", "shadow-md"],
      },
      // Dismissible alerts need icon alignment
      {
        dismissible: true,
        size: ["sm", "md"],
        class: ["relative"],
      },
    ],
    defaultVariants: {
      intent: "info",
      size: "md",
      dismissible: false,
    },
  }
);
```

**Why good:** Array syntax reduces duplication, "any of these" matching is clear, combines size and intent dimensions

---

## Size-Specific Intent Styles

### Good Example - Large Primary is Special

```typescript
import { cva } from "class-variance-authority";

const ctaButtonVariants = cva(
  ["font-semibold", "rounded", "transition-all"],
  {
    variants: {
      intent: {
        primary: ["bg-blue-600", "text-white"],
        secondary: ["bg-gray-200", "text-gray-800"],
      },
      size: {
        sm: ["text-sm", "py-1", "px-2"],
        md: ["text-base", "py-2", "px-4"],
        lg: ["text-lg", "py-3", "px-6"],
        xl: ["text-xl", "py-4", "px-8"],
      },
    },
    compoundVariants: [
      // Large and XL primary get special treatment
      {
        intent: "primary",
        size: ["lg", "xl"],
        class: ["uppercase", "tracking-wider", "shadow-lg"],
      },
      // XL gets even more
      {
        intent: "primary",
        size: "xl",
        class: ["font-bold"],
      },
    ],
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  }
);

// Usage
ctaButtonVariants({ size: "md" }); // Normal primary
ctaButtonVariants({ size: "lg" }); // Uppercase, tracking, shadow
ctaButtonVariants({ size: "xl" }); // Above + font-bold
```

**Why good:** Progressive enhancement for larger sizes, multiple compound variants can apply, specific overrides

---

## State Combinations

### Good Example - Interactive States Matrix

```typescript
import { cva } from "class-variance-authority";

const toggleVariants = cva(
  ["rounded-full", "transition-colors", "duration-200"],
  {
    variants: {
      size: {
        sm: ["w-8", "h-4"],
        md: ["w-11", "h-6"],
        lg: ["w-14", "h-7"],
      },
      checked: {
        false: ["bg-gray-300"],
        true: ["bg-blue-600"],
      },
      disabled: {
        false: null,
        true: ["opacity-50", "cursor-not-allowed"],
      },
    },
    compoundVariants: [
      // Enabled + unchecked: hover to darker gray
      {
        checked: false,
        disabled: false,
        class: ["hover:bg-gray-400", "cursor-pointer"],
      },
      // Enabled + checked: hover to darker blue
      {
        checked: true,
        disabled: false,
        class: ["hover:bg-blue-700", "cursor-pointer"],
      },
      // Disabled overrides any hover
      {
        disabled: true,
        class: ["hover:bg-current"], // Cancel hover effect
      },
    ],
    defaultVariants: {
      size: "md",
      checked: false,
      disabled: false,
    },
  }
);
```

**Why good:** Clear state matrix (checked x disabled), hover only when enabled, cursor indicates interactivity

---

## Loading State Compounds

### Good Example - Loading Overrides Intent

```typescript
import { cva } from "class-variance-authority";

const submitButtonVariants = cva(
  ["font-semibold", "rounded", "transition-colors", "relative"],
  {
    variants: {
      intent: {
        primary: ["bg-blue-600", "text-white"],
        secondary: ["bg-gray-200", "text-gray-800"],
      },
      size: {
        sm: ["text-sm", "py-1", "px-3"],
        md: ["text-base", "py-2", "px-4"],
      },
      loading: {
        false: null,
        true: ["pointer-events-none"],
      },
    },
    compoundVariants: [
      // Loading primary: muted blue
      {
        intent: "primary",
        loading: true,
        class: ["bg-blue-400", "text-blue-100"],
      },
      // Loading secondary: muted gray
      {
        intent: "secondary",
        loading: true,
        class: ["bg-gray-100", "text-gray-400"],
      },
      // Non-loading gets hover
      {
        loading: false,
        intent: "primary",
        class: ["hover:bg-blue-700"],
      },
      {
        loading: false,
        intent: "secondary",
        class: ["hover:bg-gray-300"],
      },
    ],
    defaultVariants: {
      intent: "primary",
      size: "md",
      loading: false,
    },
  }
);
```

**Why good:** Loading modifies intent colors, no hover when loading, pointer-events-none prevents interaction

---

## Multi-Part Components

### Good Example - Card with Header Compound

```typescript
import { cva } from "class-variance-authority";

// Separate cva for each part
const cardVariants = {
  root: cva(
    ["rounded-lg", "border", "overflow-hidden"],
    {
      variants: {
        elevation: {
          flat: ["shadow-none"],
          raised: ["shadow-md"],
          floating: ["shadow-xl"],
        },
        intent: {
          default: ["bg-white", "border-gray-200"],
          primary: ["bg-blue-50", "border-blue-200"],
          danger: ["bg-red-50", "border-red-200"],
        },
      },
      defaultVariants: {
        elevation: "flat",
        intent: "default",
      },
    }
  ),

  header: cva(
    ["px-4", "py-3", "border-b"],
    {
      variants: {
        intent: {
          default: ["bg-gray-50", "border-gray-200"],
          primary: ["bg-blue-100", "border-blue-200"],
          danger: ["bg-red-100", "border-red-200"],
        },
        size: {
          sm: ["text-sm"],
          md: ["text-base"],
          lg: ["text-lg", "font-medium"],
        },
      },
      compoundVariants: [
        // Large headers in primary/danger get emphasis
        {
          intent: ["primary", "danger"],
          size: "lg",
          class: ["font-semibold"],
        },
      ],
      defaultVariants: {
        intent: "default",
        size: "md",
      },
    }
  ),

  body: cva(
    ["p-4"],
    {
      variants: {
        size: {
          sm: ["text-sm"],
          md: ["text-base"],
          lg: ["text-lg"],
        },
      },
      defaultVariants: {
        size: "md",
      },
    }
  ),
};

// Usage
function getCardClasses(intent: "default" | "primary" | "danger", size: "sm" | "md" | "lg") {
  return {
    root: cardVariants.root({ intent }),
    header: cardVariants.header({ intent, size }),
    body: cardVariants.body({ size }),
  };
}
```

**Why good:** Each part has own cva, shared variants (intent, size) for consistency, compound for part-specific combinations

---

## Quick Reference

| Compound Syntax | Meaning |
|-----------------|---------|
| `{ intent: "primary", disabled: false, class: [...] }` | When intent=primary AND disabled=false |
| `{ intent: ["primary", "secondary"], class: [...] }` | When intent=primary OR intent=secondary |
| `{ size: ["md", "lg"], intent: "primary", class: [...] }` | When size is md OR lg, AND intent=primary |

| Use Compound Variants For |
|---------------------------|
| Hover/focus states only when enabled |
| Size-specific intent modifications |
| Loading states that override intent |
| Disabled states that cancel interactions |
| State combinations (checked + focused) |
