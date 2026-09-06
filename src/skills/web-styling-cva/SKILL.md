---
name: web-styling-cva
description: Class Variance Authority - type-safe component variant styling with cva(), compound variants, and VariantProps
---

# CVA (Class Variance Authority) Patterns

> **Quick Guide:** `cva()` turns a component's visual states into one typed configuration object: base classes, variant groups (size, intent, state), `compoundVariants` for combinations that need their own styles, and `defaultVariants` for what a caller omits. `VariantProps<typeof variants>` derives the prop types from that object. It emits class-name strings and settles nothing about what those class names mean, so it works with utility classes, CSS modules or plain CSS alike.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — basic variants, boolean states, multiple variant groups, required variants
- [examples/compound-variants.md](examples/compound-variants.md) — multi-condition styles, array syntax, state matrices
- [examples/composition.md](examples/composition.md) — `VariantProps`, class names from a scoped stylesheet, call-site appending and merging, multi-part components, extending variants
- [reference.md](reference.md) — API signatures, pattern-selection table, pre-ship checklist

---

<critical_requirements>

## Before writing CVA code

**Define every variant option inside the `variants` object.** Conditional class logic outside `cva()` splits the definition in two, and the derived types stop describing the component.

**Extract prop types with `VariantProps<typeof variants>`.** A hand-written variant type drifts the moment a variant is added or renamed; a derived one cannot.

**Set `defaultVariants` for every variant a caller may omit.** Calling with no arguments otherwise returns the base classes alone — no intent, no size.

**Reach for `compoundVariants` when two variants together need a third style.** It states "when X and Y, also Z" once, in the definition, rather than at each call site.

</critical_requirements>

---

**Auto-detection:** cva, class-variance-authority, VariantProps, compoundVariants, defaultVariants, cx

**Applies to:**

- Components with more than one visual dimension — size, intent, tone, state
- Combinations that need their own styles ("large primary is uppercase")
- Deriving component prop types from the style definition
- Multi-part components whose parts must stay visually in step

**Handled elsewhere:**

- What the class names mean — `cva()` emits strings, and the CSS behind them is settled by whatever owns it
- Conflict resolution between two competing class names — `cx()` concatenates and filters falsy values; deciding which of `px-2` and `px-8` wins is a merge utility's job
- Styles that change with the viewport — a variant is chosen once per render, so breakpoints belong in the stylesheet
- Values computed at runtime (a measured width, a colour from data) — a variant is a fixed set of options; runtime values belong in inline styles or custom properties

---

<philosophy>

CVA treats variants as a type system for UI states. The variant table is the single source of truth: the class strings and the prop types both come from it, so adding an option changes one object and TypeScript propagates the rest. What the definition describes is what each state _looks like_, never how to compute a class list — which is why the same definition ports across UI frameworks and CSS approaches unchanged.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Basic variant definition

Base classes plus one entry per variant group. Arrays read better than space-separated strings once a group has more than two classes.

```typescript
import { cva } from "class-variance-authority";

const buttonVariants = cva(["font-semibold", "border", "rounded"], {
  variants: {
    intent: {
      primary: ["bg-blue-600", "text-white"],
      secondary: ["bg-white", "text-gray-800"],
    },
    size: {
      sm: ["text-sm", "py-1", "px-2"],
      md: ["text-base", "py-2", "px-4"],
    },
  },
  defaultVariants: { intent: "primary", size: "md" },
});

buttonVariants(); // primary + md
buttonVariants({ intent: "secondary" }); // secondary + md
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Boolean variants

`true`/`false` keys model a binary state. Define both sides — the `false` branch is where the normal-state styles live.

```typescript
const inputVariants = cva(["border", "rounded", "px-3", "py-2"], {
  variants: {
    disabled: {
      false: ["bg-white", "cursor-text"],
      true: ["bg-gray-100", "cursor-not-allowed"],
    },
    error: { false: ["border-gray-300"], true: ["border-red-500"] },
  },
  defaultVariants: { disabled: false, error: false },
});
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Compound variants

A `compoundVariants` entry fires when every key on it matches. An array value matches any of its members, which collapses near-identical rules.

```typescript
const buttonVariants = cva(["font-semibold", "rounded"], {
  variants: {
    intent: { primary: ["bg-blue-600"], secondary: ["bg-white"] },
    disabled: { false: null, true: ["opacity-50", "cursor-not-allowed"] },
  },
  compoundVariants: [
    // Hover only where the button is interactive
    { intent: "primary", disabled: false, class: ["hover:bg-blue-700"] },
    { intent: "secondary", disabled: false, class: ["hover:bg-gray-100"] },
    {
      intent: ["primary", "secondary"],
      disabled: true,
      class: ["pointer-events-none"],
    },
  ],
  defaultVariants: { intent: "primary", disabled: false },
});
```

Full code: [examples/compound-variants.md](examples/compound-variants.md)

---

### Pattern 4: Type extraction with VariantProps

`VariantProps` reads the definition and produces one optional, nullable prop per variant group.

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const cardVariants = cva(["rounded-lg", "border"], {
  variants: {
    elevation: { flat: ["shadow-none"], raised: ["shadow-md"] },
    padding: { none: ["p-0"], sm: ["p-2"], md: ["p-4"] },
  },
  defaultVariants: { elevation: "flat", padding: "md" },
});

type CardVariants = VariantProps<typeof cardVariants>;
// { elevation?: "flat" | "raised" | null; padding?: "none" | "sm" | "md" | null }

// Make one variant mandatory: leave it out of defaultVariants, then narrow the type
type CardProps = Omit<CardVariants, "padding"> &
  Required<Pick<CardVariants, "padding">>;
```

Full code: [examples/composition.md](examples/composition.md)

---

### Pattern 5: Class merging with cx()

`cx()` ships with the package (a re-export of clsx): it concatenates and drops falsy values. Conflict resolution is a separate utility's job.

```typescript
import { cva, cx } from "class-variance-authority";

cx(buttonVariants({ intent: "primary" }), highlighted && "ring-2", className);

// Where a caller's className must be able to override a variant's own padding,
// wrap the call in a merging utility instead of concatenating
function button(variants: ButtonVariants, className?: string): string {
  return cn(buttonVariants(variants), className);
}
```

Full code: [examples/composition.md](examples/composition.md)

---

### Pattern 6: Multi-part components

One `cva()` per styled part, sharing variant names so the parts move together.

```typescript
const formFieldVariants = {
  label: cva(["block", "font-medium"], {
    variants: { size: { sm: ["text-sm"], md: ["text-base"] } },
    defaultVariants: { size: "md" },
  }),
  input: cva(["w-full", "border", "rounded"], {
    variants: {
      size: { sm: ["text-sm", "px-2"], md: ["text-base", "px-3"] },
      error: { false: ["border-gray-300"], true: ["border-red-500"] },
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
```

Full code: [examples/composition.md](examples/composition.md)

---

### Pattern 7: Composing and extending definitions

Two definitions combined with `cx()` — a shared interactive base plus the component's own variants. Their `VariantProps` intersect into one prop type.

```typescript
const interactiveVariants = cva(["transition-colors", "focus:ring-2"], {
  variants: { focusRing: { blue: ["focus:ring-blue-500"] } },
  defaultVariants: { focusRing: "blue" },
});

type ButtonProps = VariantProps<typeof interactiveVariants> &
  VariantProps<typeof buttonVariants>;

function button({ focusRing, intent }: ButtonProps): string {
  return cx(interactiveVariants({ focusRing }), buttonVariants({ intent }));
}
```

Full code: [examples/composition.md](examples/composition.md)

</patterns>

---

<red_flags>

## Red flags

**Produces the wrong classes:**

- **No `defaultVariants`** — `buttonVariants()` returns the base classes and nothing else, so a component rendered without props loses its intent and size. Give every optional variant a default.
- **Only the `true` key on a boolean variant** — the normal state gets no classes at all. Write the `false` branch with the base styles, or `null` where it genuinely needs none.
- **Hand-written variant prop types** — they accept a value the definition dropped and reject one it gained. `VariantProps<typeof variants>` cannot drift.
- **Conditional class logic outside the definition** — the variant table stops being the source of truth and the derived types describe only half the component. Add the condition as a variant.
- **Nested ternaries for combined states** — an unreachable branch is invisible; `compoundVariants` enumerates the combinations instead.

**Surprising behaviour:**

- `VariantProps` makes every variant optional _and_ nullable. `Required<Pick<T, "color">>` is how one becomes mandatory.
- `compoundVariants` classes land after the regular variant classes in the returned string. String order is not CSS precedence, so two conflicting class names still need a merge utility.
- Base classes always apply, and no variant can remove one. A class only some states want belongs in the variants rather than the base.
- `null` is a valid variant value meaning "this option adds nothing" — distinct from omitting the key, which leaves the option undefined.
- `class` and `className` both work inside a `compoundVariants` entry. Pick one per project; mixing them makes the entries look like different shapes.

</red_flags>
