# CVA Reference

> Decision frameworks, API signatures, and checklists for Class Variance Authority.

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

| Pattern           | When to Use                                           |
| ----------------- | ----------------------------------------------------- |
| Basic variants    | Single-dimension variations (size, intent)            |
| Boolean variants  | Binary states (disabled, loading, error)              |
| Compound variants | Multi-condition styling (large + primary = uppercase) |
| Array syntax      | Same style for multiple variant values                |
| Multi-part        | Components with multiple styled elements              |
| Composition       | Sharing base styles across components                 |

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

## Best Practices Summary

> For red flags, anti-patterns, and gotchas, see the `<red_flags>` section in [SKILL.md](SKILL.md).

| Practice         | Do                                | Don't                        |
| ---------------- | --------------------------------- | ---------------------------- |
| Type extraction  | `VariantProps<typeof variants>`   | Manual interface definitions |
| Boolean variants | Define both `true` and `false`    | Only define `true` case      |
| Combined states  | Use `compoundVariants`            | Nested ternaries             |
| Class format     | Use arrays `["class1", "class2"]` | Space-separated strings      |
| Defaults         | Always set `defaultVariants`      | Rely on undefined behavior   |
| Composition      | Use `cx()` to combine             | Manual string concatenation  |
| Dynamic values   | CSS variables / inline styles     | Runtime variant switching    |
| Responsive       | CSS breakpoint classes            | Complex runtime logic        |
