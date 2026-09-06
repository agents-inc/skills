# CVA — Composition Examples

> Deriving types, sourcing class names, merging and appending classes, and building definitions out of other definitions. See [core.md](core.md) for the base patterns, [compound-variants.md](compound-variants.md) for combinations, [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites:** basic variant definitions from [core.md](core.md).

---

## Type extraction with VariantProps

### Good — props derived from the definition

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(["font-semibold", "rounded", "transition-colors"], {
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
  defaultVariants: { intent: "primary", size: "md" },
});

type ButtonVariants = VariantProps<typeof buttonVariants>;
// { intent?: "primary" | "secondary" | null; size?: "sm" | "md" | null }

interface ButtonProps extends ButtonVariants {
  children: unknown;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

function getButtonClasses(props: ButtonVariants, className?: string): string {
  const { intent, size } = props;
  const baseClasses = buttonVariants({ intent, size });
  return className ? `${baseClasses} ${className}` : baseClasses;
}
```

**Why good:** the component's accepted values and the definition's available values are the same list, so they cannot fall out of step.

### Bad — types written by hand

```typescript
type ButtonVariants = {
  intent?: "primary" | "secondary";
  size?: "sm" | "md";
};

const buttonVariants = cva("...", {
  variants: {
    size: { sm: "...", md: "...", lg: "..." }, // added here, not above
  },
});
```

**Why bad:** `lg` works at runtime and is a type error at every call site, which reads as a bug in the caller.

---

## Variant values from a scoped stylesheet

`cva()` only ever concatenates strings, so a variant value can just as well be a class name read from a stylesheet that exports a class-name map as a utility class. Nothing about the definition changes.

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import styles from "./alert.module.css";

const alertVariants = cva(styles.alert, {
  variants: {
    tone: {
      info: styles.alertInfo,
      warning: styles.alertWarning,
      error: styles.alertError,
    },
    size: { sm: styles.alertSm, md: styles.alertMd },
  },
  defaultVariants: { tone: "info", size: "md" },
});

type AlertVariants = VariantProps<typeof alertVariants>;

alertVariants({ tone: "error" });
// "alert-module__alert--a1b2 alert-module__alertError--c3d4 alert-module__alertMd--e5f6"
```

**Why good:** the variant table stays the single source of truth for which states exist, while what each state looks like stays in the stylesheet — so the same definition survives a move between styling approaches, and a variant whose class was deleted from the stylesheet resolves to `undefined` and drops out of the string rather than silently applying the wrong rule.

---

## Appending at the call site with `class` / `className`

The function `cva()` returns accepts `class` or `className` alongside the variants, and appends it to the result. The two keys are interchangeable; pick one per project so the calls do not read as two different APIs.

```typescript
const button = cva("btn", {
  variants: { intent: { primary: "btn-primary", secondary: "btn-secondary" } },
  defaultVariants: { intent: "primary" },
});

button({ intent: "primary", className: "mt-4" });
// "btn btn-primary mt-4"

button({ intent: "primary", class: "mt-4" }); // identical result
```

Appending is not merging: the extra class lands after the variant classes in the string, and string order is not CSS precedence. Where a caller must be able to _override_ a variant's own property, wrap the call in a merging utility as below.

---

## Class merging with cx()

```typescript
import { cva, cx, type VariantProps } from "class-variance-authority";

const cardVariants = cva(["rounded-lg", "border", "p-4"], {
  variants: {
    elevation: { flat: ["shadow-none"], raised: ["shadow-md"] },
  },
  defaultVariants: { elevation: "flat" },
});

type CardVariants = VariantProps<typeof cardVariants>;

interface CardProps extends CardVariants {
  className?: string;
  highlighted?: boolean;
}

function getCardClasses({
  elevation,
  className,
  highlighted,
}: CardProps): string {
  return cx(
    cardVariants({ elevation }),
    highlighted && "ring-2 ring-blue-500",
    className,
  );
}

getCardClasses({ elevation: "raised" });
// "rounded-lg border p-4 shadow-md"

getCardClasses({ elevation: "raised", highlighted: true });
// "rounded-lg border p-4 shadow-md ring-2 ring-blue-500"
```

**Why good:** `cx()` drops the falsy branches, so a conditional class needs no ternary and an absent `className` contributes nothing.

---

## Conflict resolution with a merging utility

`cx()` concatenates; it does not know that two class names govern the same property. Where a caller must be able to override a variant's own padding, wrap the call.

```typescript
import { cva, type VariantProps } from "class-variance-authority";
// A utility that merges class names and lets the last one win for a given property
import { cn } from "./utils";

const buttonVariants = cva(["px-4", "py-2", "rounded", "font-semibold"], {
  variants: {
    size: {
      sm: ["px-2", "py-1", "text-sm"],
      lg: ["px-6", "py-3", "text-lg"],
    },
  },
  defaultVariants: { size: "sm" },
});

function button(
  variants: VariantProps<typeof buttonVariants>,
  className?: string,
): string {
  return cn(buttonVariants(variants), className);
}

button({ size: "sm" }, "px-8");
// concatenated: "px-4 py-2 rounded font-semibold px-2 py-1 text-sm px-8" — three paddings
// merged:       "py-1 rounded font-semibold text-sm px-8" — px-8 wins
```

**Why good:** the escape hatch is one wrapper rather than a variant for every value a caller might want.

---

## Composing two definitions

```typescript
import { cva, cx, type VariantProps } from "class-variance-authority";

// Reusable across every interactive element
const interactiveVariants = cva(
  [
    "transition-colors",
    "focus:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-offset-2",
  ],
  {
    variants: {
      focusColor: {
        blue: ["focus-visible:ring-blue-500"],
        green: ["focus-visible:ring-green-500"],
        red: ["focus-visible:ring-red-500"],
      },
    },
    defaultVariants: { focusColor: "blue" },
  },
);

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
    defaultVariants: { intent: "primary", size: "md" },
  },
);

type CombinedButtonProps = VariantProps<typeof interactiveVariants> &
  VariantProps<typeof buttonVariants>;

function button({ focusColor, intent, size }: CombinedButtonProps): string {
  return cx(
    interactiveVariants({ focusColor }),
    buttonVariants({ intent, size }),
  );
}
```

**Why good:** the focus treatment is defined once and reaches every control that composes it, while each control keeps its own variants private.

---

## Multi-part components

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const formFieldVariants = {
  label: cva(["block", "font-medium", "text-gray-700"], {
    variants: {
      size: { sm: ["text-sm", "mb-1"], md: ["text-base", "mb-1.5"] },
      required: {
        false: null,
        true: ["after:content-['*']", "after:ml-0.5", "after:text-red-500"],
      },
    },
    defaultVariants: { size: "md", required: false },
  }),

  input: cva(["w-full", "rounded", "border", "transition-colors"], {
    variants: {
      size: {
        sm: ["text-sm", "px-2", "py-1"],
        md: ["text-base", "px-3", "py-2"],
      },
      error: {
        false: [
          "border-gray-300",
          "focus:border-blue-500",
          "focus:ring-blue-500",
        ],
        true: ["border-red-500", "focus:border-red-500", "focus:ring-red-500"],
      },
    },
    defaultVariants: { size: "md", error: false },
  }),

  helper: cva(["mt-1"], {
    variants: {
      size: { sm: ["text-xs"], md: ["text-sm"] },
      error: { false: ["text-gray-500"], true: ["text-red-600"] },
    },
    defaultVariants: { size: "md", error: false },
  }),
};

// One part's variant type becomes the shared vocabulary for all three
type FormFieldSize = NonNullable<
  VariantProps<typeof formFieldVariants.input>["size"]
>;

interface FormFieldClassesProps {
  size?: FormFieldSize;
  error?: boolean;
  required?: boolean;
}

function getFormFieldClasses({
  size = "md",
  error = false,
  required = false,
}: FormFieldClassesProps = {}) {
  return {
    label: formFieldVariants.label({ size, required }),
    input: formFieldVariants.input({ size, error }),
    helper: formFieldVariants.helper({ size, error }),
  };
}
```

**Why good:** `size` and `error` are passed to every part that has them, so the three elements cannot end up at different scales; deriving `FormFieldSize` from one part keeps the shared vocabulary honest.

---

## Extending a base definition

```typescript
import { cva, cx, type VariantProps } from "class-variance-authority";

const linkVariants = cva(["underline-offset-2", "transition-colors"], {
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
  defaultVariants: { color: "primary", underline: "hover" },
});

const navLinkVariants = cva(["font-medium", "px-3", "py-2", "rounded"], {
  variants: {
    active: { false: null, true: ["bg-blue-100"] },
  },
  defaultVariants: { active: false },
});

type NavLinkProps = VariantProps<typeof linkVariants> &
  VariantProps<typeof navLinkVariants>;

function navLink({ color, underline, active }: NavLinkProps): string {
  return cx(
    linkVariants({ color, underline: underline ?? "none" }), // navigation opts out of the base default
    navLinkVariants({ active }),
  );
}
```

**Why good:** the specialised wrapper overrides one of the base defaults at the call site rather than forking the base definition.
