# CVA Reference

> API signatures, pattern selection, and the pre-ship checklist. Decision guidance and red flags live in [SKILL.md](SKILL.md).

---

## Choosing a variant pattern

| Pattern           | Use when                                            |
| ----------------- | --------------------------------------------------- |
| Basic variants    | One dimension varies (size, intent)                 |
| Boolean variants  | A binary state (disabled, loading, error)           |
| Compound variants | A combination needs its own style (large + primary) |
| Array syntax      | The same style applies to several variant values    |
| Multi-part        | One component with several styled elements          |
| Composition       | A base definition shared across several components  |

### Compound-variant matching

| Entry                                                     | Matches when                            |
| --------------------------------------------------------- | --------------------------------------- |
| `{ intent: "primary", disabled: false, class: [...] }`    | intent is primary AND disabled is false |
| `{ intent: ["primary", "secondary"], class: [...] }`      | intent is primary OR secondary          |
| `{ size: ["md", "lg"], intent: "primary", class: [...] }` | size is md OR lg, AND intent is primary |

### Naming the groups

| Group     | Conventional values               |
| --------- | --------------------------------- |
| `intent`  | primary, secondary, danger, ghost |
| `size`    | sm, md, lg, xl                    |
| `variant` | solid, outline, ghost, link       |
| `color`   | gray, red, green, blue            |
| booleans  | disabled, error, loading, active  |

---

## API

### `cva(base, options)`

```typescript
const variants = cva(base, options);

// base: string | string[] — classes applied to every result
// options: {
//     variants: Record<string, Record<string, string | string[] | null>>,
//     compoundVariants: Array<{ [variantKey]: value | value[], class: string | string[] }>,
//     defaultVariants: Record<string, string | boolean>
//   }
// Returns: (props?) => string
//   props: the variant keys, plus an optional `class` or `className`
//          whose value is appended to the generated string
```

### `VariantProps<typeof variants>`

```typescript
import { cva, type VariantProps } from "class-variance-authority";

type ButtonVariants = VariantProps<typeof buttonVariants>;
// Every variant arrives optional and nullable:
// { intent?: "primary" | "secondary" | null; size?: "sm" | "md" | null }
```

### `cx(...classes)`

```typescript
import { cx } from "class-variance-authority";

cx("base-class", condition && "conditional-class", { active: isActive });
// "base-class conditional-class active" — falsy values dropped, no deduplication
```

---

## Before shipping a definition

- [ ] Base classes hold only what every variant shares
- [ ] Boolean variants define both `true` and `false`
- [ ] `defaultVariants` covers every variant a caller may omit
- [ ] Combinations use `compoundVariants` rather than logic at the call site
- [ ] Prop types come from `VariantProps`
- [ ] No class decisions live outside the definition
