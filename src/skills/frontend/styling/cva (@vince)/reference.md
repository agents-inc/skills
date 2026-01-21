# CVA Reference

> Decision frameworks, red flags, and anti-patterns for Class Variance Authority.

---

## Decision Framework

```
Need component variant styling?
├─ Does component have visual variants (size, color, state)?
│   ├─ YES → Use CVA for type-safe variant definitions
│   └─ NO → Use plain classes (no CVA needed)
├─ Do multiple variants combine for special styles?
│   ├─ YES → Use compoundVariants
│   └─ NO → Regular variants sufficient
├─ Need boolean states (disabled, loading, active)?
│   ├─ YES → Use boolean variants with true/false keys
│   └─ NO → String variants are fine
├─ Need to share styling across frameworks/projects?
│   ├─ YES → CVA is excellent for this (framework-agnostic)
│   └─ NO → CVA still helps with type safety
└─ Is styling dynamic based on runtime values?
    ├─ YES → Use CSS variables or inline styles (not CVA)
    └─ NO → CVA variants work great
```

**Choosing variant patterns:**

| Pattern | When to Use |
|---------|-------------|
| Basic variants | Single-dimension variations (size, intent) |
| Boolean variants | Binary states (disabled, loading, error) |
| Compound variants | Multi-condition styling (large + primary = uppercase) |
| Array syntax | Same style for multiple variant values |
| Multi-part | Components with multiple styled elements |
| Composition | Sharing base styles across components |

---

## Quick Reference

### cva() Function Signature

```typescript
const variants = cva(base, options);

// Parameters:
// - base: string | string[] - Base classes applied to all variants
// - options: {
//     variants: Record<string, Record<string, string | string[]>>,
//     compoundVariants: Array<{ [variantKey]: value, class: string | string[] }>,
//     defaultVariants: Record<string, string | boolean>
//   }

// Returns: function that accepts variant props and returns class string
```

### VariantProps Type Helper

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(/* ... */);

// Extract types from cva definition
type ButtonVariants = VariantProps<typeof buttonVariants>;

// All variant props are optional (can be null or undefined)
// { intent?: "primary" | "secondary" | null; size?: "sm" | "md" | null }
```

### cx() Function

```typescript
import { cx } from "class-variance-authority";

// Concatenates classes (alias for clsx)
cx("base-class", condition && "conditional-class", { active: isActive });
// Returns: "base-class conditional-class active" (when conditions true)
```

---

## Variant Definition Checklist

Before shipping a CVA definition:

- [ ] Base classes contain styles shared across ALL variants
- [ ] All variant options defined (no relying on absent variants)
- [ ] Boolean variants have both `true` and `false` keys
- [ ] `defaultVariants` set for all variants that need defaults
- [ ] `compoundVariants` used for multi-condition styles (not nested ternaries)
- [ ] Types extracted with `VariantProps` (not manually defined)
- [ ] Class arrays used for readability (not space-separated strings)
- [ ] No conditional logic outside the cva definition

---

## RED FLAGS

**High Priority Issues:**

- ❌ **Manual variant type definitions** - Types will drift from actual cva definition, defeating type safety
- ❌ **Conditional class logic outside cva** - Defeats purpose of centralized variant definitions
- ❌ **Missing defaultVariants** - Calling without props returns incomplete classes
- ❌ **Nested ternaries for combined states** - Use compoundVariants instead
- ❌ **Only defining `true` for boolean variants** - `false` case should provide base/normal styles

**Medium Priority Issues:**

- ⚠️ **Space-separated class strings instead of arrays** - Arrays are more readable and maintainable
- ⚠️ **Not using cx() for class merging** - Manual concatenation is error-prone
- ⚠️ **Duplicating variant styles across components** - Compose from shared base variants
- ⚠️ **Putting responsive logic in cva** - Keep cva simple, handle responsiveness in CSS or helpers

**Common Mistakes:**

- Forgetting to import `type VariantProps` with `import type`
- Using `className` instead of `class` in compoundVariants configuration
- Not handling the `null` possibility in VariantProps types
- Defining variants that could be CSS variables (use CSS for truly dynamic values)

**Gotchas & Edge Cases:**

- `VariantProps` makes all variants optional (nullable) - use TypeScript utilities to make specific ones required
- `compoundVariants` are applied AFTER regular variants - order matters for class specificity
- Empty variant values (`null` or empty string) are valid - useful for "no additional styles" case
- Base classes are always applied - can't conditionally remove them via variants

---

## Anti-Patterns to Avoid

### Conditional Logic Outside CVA

```typescript
// ❌ ANTI-PATTERN: Logic outside cva
const buttonVariants = cva("btn", {
  variants: {
    intent: {
      primary: "btn-primary",
      secondary: "btn-secondary",
    },
  },
});

function getButtonClasses(intent: string, disabled: boolean) {
  const base = buttonVariants({ intent });
  // BAD: Disabled logic is outside cva
  return disabled ? `${base} opacity-50 cursor-not-allowed` : base;
}
```

**Why it's wrong:** Disabled styling is scattered, not type-safe, and not discoverable in the cva definition.

**What to do instead:** Add `disabled` as a boolean variant in cva.

---

### Manual Type Definitions

```typescript
// ❌ ANTI-PATTERN: Manual types
type ButtonVariants = {
  intent: "primary" | "secondary";
  size: "sm" | "md" | "lg";
};

const buttonVariants = cva("btn", {
  variants: {
    intent: {
      primary: "btn-primary",
      secondary: "btn-secondary",
      danger: "btn-danger", // Added but not in type!
    },
    size: {
      sm: "btn-sm",
      md: "btn-md",
      lg: "btn-lg",
    },
  },
});
```

**Why it's wrong:** Manual types don't include "danger" intent, creating a mismatch.

**What to do instead:** Use `VariantProps<typeof buttonVariants>` to derive types.

---

### Missing Boolean False Case

```typescript
// ❌ ANTI-PATTERN: Only true case defined
const inputVariants = cva("input", {
  variants: {
    error: {
      true: "border-red-500 text-red-900",
      // No false case - normal border styles missing
    },
  },
});

// When error=false, no border color applied at all
inputVariants({ error: false }); // Just "input"
```

**Why it's wrong:** Non-error state has no border color, relying on global CSS or defaults.

**What to do instead:** Define `false: "border-gray-300 text-gray-900"` for complete styling.

---

### Nested Ternaries for Combinations

```typescript
// ❌ ANTI-PATTERN: Nested ternaries
function getClasses(intent: string, size: string, disabled: boolean) {
  return `
    btn
    ${intent === "primary" ? "bg-blue-600" : "bg-gray-200"}
    ${size === "lg" ? "text-lg py-3" : "text-base py-2"}
    ${disabled ? "opacity-50" : ""}
    ${!disabled && intent === "primary" ? "hover:bg-blue-700" : ""}
    ${!disabled && intent === "secondary" ? "hover:bg-gray-300" : ""}
    ${intent === "primary" && size === "lg" ? "uppercase" : ""}
  `;
}
```

**Why it's wrong:** Hard to read, hard to maintain, no type safety, easy to miss combinations.

**What to do instead:** Use cva with compoundVariants for all conditional combinations.

---

### Duplicating Variants Across Components

```typescript
// ❌ ANTI-PATTERN: Copy-pasted variants
const buttonVariants = cva("btn", {
  variants: {
    size: {
      sm: "text-sm px-2 py-1",
      md: "text-base px-4 py-2",
      lg: "text-lg px-6 py-3",
    },
  },
});

const linkVariants = cva("link", {
  variants: {
    // Same size variants copy-pasted!
    size: {
      sm: "text-sm px-2 py-1",
      md: "text-base px-4 py-2",
      lg: "text-lg px-6 py-3",
    },
  },
});
```

**Why it's wrong:** Duplication leads to drift, harder to maintain consistent sizing.

**What to do instead:** Create shared size variants and compose with cx().

---

## Best Practices Summary

| Practice | Do | Don't |
|----------|-----|-------|
| Type extraction | `VariantProps<typeof variants>` | Manual interface definitions |
| Boolean variants | Define both `true` and `false` | Only define `true` case |
| Combined states | Use `compoundVariants` | Nested ternaries |
| Class format | Use arrays `["class1", "class2"]` | Space-separated strings |
| Defaults | Always set `defaultVariants` | Rely on undefined behavior |
| Composition | Use `cx()` to combine | Manual string concatenation |
| Dynamic values | CSS variables / inline styles | Runtime variant switching |
| Responsive | CSS breakpoint classes | Complex runtime logic |
