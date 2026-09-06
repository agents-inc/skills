# CVA — Core Variant Examples

> The foundational definitions: base classes, variant groups, boolean states and deliberately required variants. See [SKILL.md](../SKILL.md) for decision guidance, [compound-variants.md](compound-variants.md) for combinations, [composition.md](composition.md) for types and merging.

---

## Basic variant definition

### Good — button variants

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  [
    "font-semibold",
    "border",
    "rounded",
    "transition-colors",
    "inline-flex",
    "items-center",
    "justify-center",
  ],
  {
    variants: {
      intent: {
        primary: [
          "bg-blue-600",
          "text-white",
          "border-transparent",
          "hover:bg-blue-700",
        ],
        secondary: [
          "bg-white",
          "text-gray-800",
          "border-gray-400",
          "hover:bg-gray-100",
        ],
        danger: [
          "bg-red-600",
          "text-white",
          "border-transparent",
          "hover:bg-red-700",
        ],
        ghost: [
          "bg-transparent",
          "text-gray-600",
          "border-transparent",
          "hover:bg-gray-100",
        ],
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
  },
);

buttonVariants(); // primary + md
buttonVariants({ intent: "secondary" }); // secondary + md
buttonVariants({ intent: "danger", size: "lg" });

type ButtonVariants = VariantProps<typeof buttonVariants>;
// { intent?: "primary" | "secondary" | "danger" | "ghost" | null; size?: "sm" | "md" | "lg" | null }
```

**Why good:** every visual dimension is a named group, `defaultVariants` makes a bare call complete, and the prop type is derived rather than restated.

### Bad — no defaults

```typescript
const buttonVariants = cva("font-semibold border rounded", {
  variants: {
    intent: {
      primary: "bg-blue-600 text-white",
      secondary: "bg-white text-gray-800",
    },
  },
});

buttonVariants(); // base classes only — no intent applied
buttonVariants({ size: "lg" }); // type error: no size group exists
```

**Why bad:** a caller that omits `intent` gets an unstyled button, and there is no size dimension to reach for at all.

---

## Boolean variants

### Good — disabled, error and loading states

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
      disabled: {
        false: [
          "bg-white",
          "cursor-text",
          "focus:ring-2",
          "focus:ring-blue-500",
        ],
        true: ["bg-gray-100", "cursor-not-allowed", "opacity-60"],
      },
      error: {
        false: ["border-gray-300", "focus:border-blue-500"],
        true: ["border-red-500", "focus:border-red-600", "text-red-900"],
      },
      loading: {
        false: null, // nothing to add in the resting state
        true: ["animate-pulse", "pointer-events-none"],
      },
    },
    defaultVariants: {
      size: "md",
      disabled: false,
      error: false,
      loading: false,
    },
  },
);

inputVariants({ disabled: true });
inputVariants({ loading: true, disabled: true }); // both sets apply
```

**Why good:** the `false` branch carries the resting styles, `null` says "this state adds nothing" explicitly, and the defaults mean no caller can land in an undefined state.

### Bad — only the `true` key

```typescript
const inputVariants = cva("border rounded px-3 py-2", {
  variants: {
    disabled: {
      true: "bg-gray-100 cursor-not-allowed opacity-60",
    },
  },
});

inputVariants({ disabled: false }); // no background, no cursor — nothing at all
```

**Why bad:** the enabled state has to be styled somewhere else, which puts half the component's appearance outside the definition.

---

## Multiple variant groups

Groups are independent dimensions, and every combination of them is valid.

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
        solid: null, // keeps the colour group's background
        outline: ["bg-transparent", "ring-1", "ring-inset"],
        subtle: ["bg-opacity-50"],
      },
    },
    defaultVariants: {
      color: "gray",
      size: "md",
      variant: "solid",
    },
  },
);

badgeVariants({ color: "green", size: "sm" });
badgeVariants({ color: "red", variant: "outline" });

type BadgeVariants = VariantProps<typeof badgeVariants>;
```

**Why good:** colour, scale and treatment vary independently, so three groups of six, three and three options cover fifty-four appearances without an entry per appearance.

---

## Required variants

Leaving a variant out of `defaultVariants` is how a caller is forced to choose — the type still arrives optional, so narrow it.

```typescript
import { cva, type VariantProps } from "class-variance-authority";

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
    // no defaultVariants: there is no sensible default status
  },
);

type StatusVariants = VariantProps<typeof statusIndicatorVariants>;
// { status?: "pending" | "active" | "inactive" | "error" | null }

type StatusIndicatorProps = Omit<StatusVariants, "status"> &
  Required<Pick<StatusVariants, "status">> & { label: string };

function createStatusClasses(props: StatusIndicatorProps): string {
  return statusIndicatorVariants({ status: props.status });
}

createStatusClasses({ label: "Test" }); // type error: status is required
createStatusClasses({ status: "active", label: "Test" });
```

**Why good:** the missing default and the narrowed type work together — one makes the omission meaningful at runtime, the other makes it a compile error.
