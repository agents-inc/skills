# CVA — Compound Variant Examples

> Styles that belong to a _combination_ rather than to any single variant. See [core.md](core.md) for the base definitions these build on, [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites:** basic variant definitions and boolean variants from [core.md](core.md).

---

## Hover states only where the control is interactive

### Good

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
  },
);

buttonVariants({ intent: "primary" }); // hover and focus classes present
buttonVariants({ intent: "primary", disabled: true }); // neither
```

**Why good:** the interactive styles depend on two variants at once, and the compound entry is the only place that pairing is written down.

### Bad — the same rules as nested ternaries

```typescript
function getButtonClasses(intent: string, disabled: boolean) {
  const base = "font-semibold border rounded";
  const intentClass = intent === "primary" ? "bg-blue-600" : "bg-white";
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

**Why bad:** the `intent` list appears twice and the two copies can disagree; a new intent silently falls through to the danger hover, and nothing types the arguments.

---

## Array syntax for several matching values

```typescript
import { cva } from "class-variance-authority";

const alertVariants = cva(["p-4", "rounded-lg", "border"], {
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
      true: ["pr-10"], // room for the close control
    },
  },
  compoundVariants: [
    // info OR success, at lg
    { intent: ["info", "success"], size: "lg", class: ["shadow-lg"] },
    // warning OR error, at md OR lg
    {
      intent: ["warning", "error"],
      size: ["md", "lg"],
      class: ["font-medium", "shadow-md"],
    },
    { dismissible: true, size: ["sm", "md"], class: ["relative"] },
  ],
  defaultVariants: {
    intent: "info",
    size: "md",
    dismissible: false,
  },
});
```

**Why good:** an array value means "any of these", so four rules collapse into two and stay in step when a fifth intent arrives.

---

## Progressive emphasis by size

```typescript
import { cva } from "class-variance-authority";

const ctaButtonVariants = cva(["font-semibold", "rounded", "transition-all"], {
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
    {
      intent: "primary",
      size: ["lg", "xl"],
      class: ["uppercase", "tracking-wider", "shadow-lg"],
    },
    { intent: "primary", size: "xl", class: ["font-bold"] },
  ],
  defaultVariants: {
    intent: "primary",
    size: "md",
  },
});

ctaButtonVariants({ size: "lg" }); // uppercase, tracking, shadow
ctaButtonVariants({ size: "xl" }); // the above, plus font-bold
```

**Why good:** several compound entries can match one call, so emphasis stacks rather than needing an entry per size.

---

## A state matrix

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
      {
        checked: false,
        disabled: false,
        class: ["hover:bg-gray-400", "cursor-pointer"],
      },
      {
        checked: true,
        disabled: false,
        class: ["hover:bg-blue-700", "cursor-pointer"],
      },
      { disabled: true, class: ["hover:bg-current"] }, // cancels any hover
    ],
    defaultVariants: {
      size: "md",
      checked: false,
      disabled: false,
    },
  },
);
```

**Why good:** checked × disabled is a four-cell matrix and every cell is named, so no combination falls through to a default nobody chose.

---

## A state that overrides another variant's colours

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
      {
        intent: "primary",
        loading: true,
        class: ["bg-blue-400", "text-blue-100"],
      },
      {
        intent: "secondary",
        loading: true,
        class: ["bg-gray-100", "text-gray-400"],
      },
      { intent: "primary", loading: false, class: ["hover:bg-blue-700"] },
      { intent: "secondary", loading: false, class: ["hover:bg-gray-300"] },
    ],
    defaultVariants: {
      intent: "primary",
      size: "md",
      loading: false,
    },
  },
);
```

**Why good:** loading mutes whichever intent is in play instead of introducing a "loading" colour of its own, so a new intent needs two entries rather than a new palette.

---

## A variant whose only job is to trigger compounds

An icon-only button keeps its height and drops to a square footprint, which is a different width per size.

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const iconButtonVariants = cva(
  [
    "inline-flex",
    "items-center",
    "justify-center",
    "rounded",
    "font-medium",
    "transition-colors",
  ],
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
      iconOnly: {
        false: null,
        true: null, // every style for this option is size-dependent
      },
    },
    compoundVariants: [
      { iconOnly: true, size: "sm", class: ["w-8", "px-0"] },
      { iconOnly: true, size: "md", class: ["w-10", "px-0"] },
      { iconOnly: true, size: "lg", class: ["w-12", "px-0"] },
    ],
    defaultVariants: {
      intent: "primary",
      size: "md",
      iconOnly: false,
    },
  },
);

type IconButtonVariants = VariantProps<typeof iconButtonVariants>;
```

**Why good:** `iconOnly` is `null` on both sides because it has no size-independent styles — the variant exists to be matched on, and the compounds do the work.

---

## Compounds inside a multi-part component

Each part gets its own definition; the compound lives on the part it affects. See [composition.md](composition.md) for the full multi-part pattern.

```typescript
import { cva } from "class-variance-authority";

const cardVariants = {
  root: cva(["rounded-lg", "border", "overflow-hidden"], {
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
    defaultVariants: { elevation: "flat", intent: "default" },
  }),

  header: cva(["px-4", "py-3", "border-b"], {
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
      // a large header carries more weight when the card is signalling something
      { intent: ["primary", "danger"], size: "lg", class: ["font-semibold"] },
    ],
    defaultVariants: { intent: "default", size: "md" },
  }),

  body: cva(["p-4"], {
    variants: {
      size: { sm: ["text-sm"], md: ["text-base"], lg: ["text-lg"] },
    },
    defaultVariants: { size: "md" },
  }),
};

function getCardClasses(
  intent: "default" | "primary" | "danger",
  size: "sm" | "md" | "lg",
) {
  return {
    root: cardVariants.root({ intent }),
    header: cardVariants.header({ intent, size }),
    body: cardVariants.body({ size }),
  };
}
```

**Why good:** the compound sits on `header` alone, so the root and body definitions stay unaware of it.
