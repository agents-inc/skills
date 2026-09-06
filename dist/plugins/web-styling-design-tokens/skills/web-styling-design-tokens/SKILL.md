---
name: web-styling-design-tokens
description: Design token architecture - primitive/semantic/component tiers, naming grammar, CSS custom property delivery, and DTCG build pipelines
---

# Design Token Patterns

> **Quick Guide:** A token system is a one-way dependency graph — primitives hold raw values, semantic tokens name intent, component tokens hold local exceptions, and consumers only ever touch the top two tiers. Deliver tokens as CSS custom properties: primitives in `:root`, semantic aliases reassigned per scope, component tokens on the component's own selector. Name a token for its **role**, never for the mode it happens to appear in (`--color-surface-raised`, never `--color-dark-bg`). Store complete colour values rather than bare channel triplets. Where tokens must exist in more than one language, generate every output from one DTCG source.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — tier construction, aliasing, naming grammar, custom property delivery, `@property` registration
- [examples/scales.md](examples/scales.md) — generated spacing and type series, modular scales, fluid type, density multipliers
- [examples/pipeline.md](examples/pipeline.md) — DTCG source files, build platforms, typed TypeScript export, publishing outside the owning repository
- [examples/utility-framework-bridge.md](examples/utility-framework-bridge.md) — projecting tokens into a layer that generates utility classes
- [reference.md](reference.md) — naming grammar table, DTCG `$type` reference, build config shape, authoring checklist

---

## Which path applies

- **Tokens live only in this repository and are only ever read from CSS** — hand-write the custom properties. Follow [examples/core.md](examples/core.md) and [examples/scales.md](examples/scales.md); a build step producing one file nobody else reads is cost with no payoff.
- **Tokens must exist in a second language or platform, or ship outside the repository that owns them** — author a DTCG source and generate every output from it. Follow [examples/pipeline.md](examples/pipeline.md); the tiers and names are identical, the source is JSON instead of CSS.

---

<critical_requirements>

## Before writing design token code

**Route every component style through a semantic or component token.** A component that reads a primitive or a raw literal has bypassed the indirection layer, so a rebrand has to visit it individually.

**Name tokens for their role.** `--color-surface-raised` stays true in every mode; `--color-dark-bg` is only true in one, and every additional mode forks the name and every consumer.

**Store complete colour values.** A bare channel triplet (`0 0% 100%`) is not a colour, so `color-mix()`, `oklch()` interpolation and every opacity modifier produce invalid CSS that is dropped rather than reported.

**Keep the dependency flow one-way: primitive → semantic → component.** A primitive that references a semantic token has inverted the graph and made the palette un-regenerable; a cycle resolves to nothing at runtime.

**Generate every additional output from one source once tokens exist in more than one language.** A TypeScript constant maintained beside a CSS variable drifts on the first edit made in only one of them, and nothing fails loudly.

</critical_requirements>

---

**Auto-detection:** design tokens, primitive tokens, semantic tokens, component tokens, token tiers, token aliasing, DTCG, Design Tokens Community Group, `$value`, `$type`, Style Dictionary, `transformGroup`, `buildPath`, `css/variables`, `outputReferences`, `@property`, `--color-`, `--space-`, modular scale, density tokens

**Applies to:**

- Standing up the token layer a design system sits on
- Deciding how many tiers a token set needs and what belongs in each
- Naming tokens so they survive a rebrand, a new mode, or a density change
- Delivering tokens as custom properties with correct scoping
- Building tokens from a DTCG source into CSS, TypeScript, or other platform outputs
- Generating spacing and type series rather than hand-listing every step
- Auditing an existing set for tier leaks, mode-named tokens, or drift between languages

**Handled elsewhere:**

- Runtime mode selection — how a theme is chosen, persisted and applied without a flash of the wrong one. This skill defines the token _contract_ those mechanics switch between
- Writing markup against generated utility classes — this skill covers where tokens are _declared_, not how a generated class is _used_
- Mapping component props to class combinations — a variant API consumes component tokens and defines none
- A project with a handful of colours and no theming ambition — a short `:root` block is the right amount of structure, and tiers would be indirection nobody reads

---

<philosophy>

A token system is not a list of values. It is a one-way dependency graph with a naming contract, and its purpose is to put a layer of indirection between what a value _is_ and what a value _means_, so the two can change independently.

The three tiers separate three kinds of change:

| Tier          | Answers                      | Changes when                          | Who reads it                     |
| ------------- | ---------------------------- | ------------------------------------- | -------------------------------- |
| **Primitive** | "What is this value?"        | The palette or scale is regenerated   | Semantic tokens only             |
| **Semantic**  | "What is this value _for_?"  | The design language shifts, or a mode | Components, and component tokens |
| **Component** | "What does _this part_ use?" | One component needs a local exception | That component only              |

- **Consumers touch semantics, never primitives.** `background: var(--color-surface-raised)` survives a rebrand; `var(--color-gray-100)` does not.
- **Every tier is indirection paid for on every read.** Three is the ceiling, not the target — component tokens are exceptions rather than a mirror of the component tree.
- **The token set is the contract; the delivery format is an implementation detail.** Custom properties, a typed TypeScript object and a native platform file are three renderings of one graph, which is exactly why they are generated rather than typed twice.

**A value used in one place still deserves a semantic token** when the question "will everyone using this want it to change together?" has the answer yes. A token is a statement that a set of usages share a fate.

**Two tiers suffice** for a single brand, a single mode and no white-labelling: components read semantics directly.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Token tiers and the one-way graph

Primitives are the only tier holding literals. Semantic tokens alias primitives and name intent. Component tokens alias semantics and exist only where a component diverges.

```css
:root {
  /* Tier 1 — literal values, no meaning attached */
  --palette-slate-50: oklch(0.98 0.003 250);
  --palette-slate-900: oklch(0.21 0.02 250);

  /* Tier 2 — names intent, aliases a primitive */
  --color-surface-default: var(--palette-slate-50);
  --color-text-default: var(--palette-slate-900);

  /* Tier 3 — a local exception, aliases a semantic */
  --card-surface: var(--color-surface-default);
}
```

A primitive references nothing, a semantic holds no literal, and a component token never reaches past the semantic tier. Cycles are a hard error in every conforming pipeline; in hand-written CSS they resolve to nothing at runtime. A component token that overrides nothing anywhere is indirection earning nothing — delete it and read the semantic directly.

Full code: [examples/core.md](examples/core.md#pattern-1-token-tiers-and-the-one-way-graph)

---

### Pattern 2: Naming grammar

A name is a path read left to right, general to specific. Fix the segment order once and every name becomes predictable.

```
[namespace-]category-concept[-variant][-state][-scale]

--color-text-default            category=color  concept=text   variant=default
--color-text-danger-hover       + variant=danger + state=hover
--space-inline-sm               category=space  concept=inline scale=sm
--acme-color-surface-raised     namespace=acme (only when tokens ship outside the app)
```

Category first so tokens sort into groups; state always last so `-hover` and `-pressed` read consistently; an absent segment means "default". The mode belongs in the _scope that assigns the value_, never in the identifier:

```css
--color-surface-default: var(--palette-slate-50);
[data-theme="dark"] {
  --color-surface-default: var(--palette-slate-900);
}
```

Numeric steps (`50`–`950`) suit primitive ramps where the number is a real position; t-shirt sizes (`xs`–`xl`) suit semantic steps where a number would imply arithmetic that does not hold. One convention per namespace.

Full code: [examples/core.md](examples/core.md#pattern-2-naming-grammar)

---

### Pattern 3: CSS custom properties as the delivery format

Custom properties are the delivery format because they participate in the cascade — reassigning a semantic token inside a scope re-themes every descendant with no rebuild and no re-render.

```css
:root {
  --palette-blue-600: oklch(0.55 0.19 258);
  --color-action-default: var(--palette-blue-600); /* semantic default */
}

/* A scope reassigns semantics; primitives never move */
[data-density="compact"] {
  --space-inline-md: var(--space-2);
}

.card {
  --card-padding: var(--space-inline-md); /* component token reads a semantic */
  padding: var(--card-padding);
}
```

Primitives live in `:root` and are never reassigned. Semantic tokens are the only tier a scope selector touches. Component tokens are declared on the component's own selector, so they inherit into its subtree and nowhere else.

**Register a token with `@property`** when it is animated, or when unintended inheritance would be a bug. `syntax` and `inherits` are both required descriptors, and `initial-value` is required for any `syntax` other than `*`:

```css
@property --card-elevation-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}
```

Registration buys typed interpolation — an unregistered custom property cannot be transitioned — plus a fallback to `initial-value` instead of an inherited garbage value. It costs a declaration per token, so register the animated and the leak-prone ones rather than the whole set.

Full code: [examples/core.md](examples/core.md#pattern-3-css-custom-properties-as-delivery)

---

### Pattern 4: Projecting tokens into a generated-class layer

Where something generates classes from a theme surface, that surface is a **projection** of the token set rather than a second place values are typed. Three decisions make the projection safe, and they hold whatever generates the classes:

```css
/* 1. The tokens. Literal values and every mode swap live here. */
:root {
  --app-canvas: oklch(0.98 0.003 250);
}
[data-theme="dark"] {
  --app-canvas: oklch(0.21 0.02 250);
}

/* 2. The theme surface aliases them — one entry per token that should
      become a class. Nothing is re-typed. */
```

- **Alias, never redeclare.** A value written in both places drifts on the first edit that lands in one of them, and the mismatch surfaces as a subtle colour difference no checker catches.
- **Project only what should become a class.** Internal plumbing — a focus-ring width, an interaction duration — stays in `:root` and is read directly, so the generated surface stays to things anyone would write in markup.
- **Replace the generator's default palette rather than extending it.** Defaults left in place are an untracked parallel token set, and every default colour class is a value that bypasses the semantic tier.

Full code: [examples/utility-framework-bridge.md](examples/utility-framework-bridge.md)

---

### Pattern 5: DTCG source and a build pipeline

Source lives in DTCG format (`$value` / `$type` / `$description`, `{alias}` references), and every output — CSS, typed TypeScript, native files — is generated from it.

```json
{
  "color": {
    "$type": "color",
    "palette": { "slate-50": { "$value": "#f8fafc" } },
    "surface": {
      "default": {
        "$value": "{color.palette.slate-50}",
        "$description": "Page background in the default mode"
      }
    }
  }
}
```

```javascript
// one source, many platforms
export const config = {
  source: ["tokens/**/*.json"],
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: "build/css/", // trailing slash is required
      files: [
        {
          destination: "tokens.css",
          format: "css/variables",
          options: { outputReferences: true }, // preserves var() aliasing
        },
      ],
    },
    ts: {
      transformGroup: "js",
      buildPath: "build/ts/",
      files: [{ destination: "tokens.ts", format: "javascript/es6" }],
    },
  },
};
```

`$type` hoists to the closest ancestor group that declares it, so declare it once per group. A `{group.token}` alias always resolves to a whole `$value` — property-level access needs JSON Pointer (`#/color/blue/$value`). DTCG (`$value`) and the original format (`value`) cannot be combined in one instance. `outputReferences: true` is what keeps `var()` aliasing in the CSS output instead of flattening every semantic token to a literal.

Full code: [examples/pipeline.md](examples/pipeline.md)

---

### Pattern 6: Scales as generated series

Spacing and type are series, not sets. Express the generator — a base and a ratio, or a base and a multiplier — so every step is derivable and no step can be individually wrong.

```css
:root {
  --space-base: 0.25rem;
  --space-1: calc(var(--space-base) * 1);
  --space-2: calc(var(--space-base) * 2);
  --space-4: calc(var(--space-base) * 4);
  --space-8: calc(var(--space-base) * 8);
}
```

**Density is a multiplier on the semantic tier, not a second scale.** Applied where primitives become semantics, one token re-scales the system and component tokens inherit density for free:

```css
:root {
  --density-scale: 1;
  --space-inline-md: calc(var(--space-4) * var(--density-scale));
}
[data-density="compact"] {
  --density-scale: 0.75;
}
```

Type scales take the same shape with a ratio in place of the multiplier, and fluid steps use `clamp()` with both bounds derived from the scale rather than hand-picked. A `calc()` chain much past three levels becomes hard to debug — resolve those in the pipeline instead.

Full code: [examples/scales.md](examples/scales.md)

</patterns>

---

<decision_framework>

## Decision framework

### How many tiers?

```
Does the product need more than one visual mode, brand, or tenant?
|-- NO --> Does any component need a value that diverges from the system default?
|   |-- NO  --> Two tiers: primitive + semantic
|   |-- YES --> Two tiers, plus component tokens for the divergent components only
|-- YES --> Three tiers. Semantic tokens are the swap point; primitives never move.
```

### Which tier does this value belong to?

```
Is it a literal (a hex, a rem, a ms)?
|-- YES --> Primitive. It gets a position-in-a-ramp name, not a meaning name.
|-- NO  --> Does more than one component share this decision?
    |-- YES --> Semantic. Name the role.
    |-- NO  --> Is the component genuinely diverging, or just the only current user?
        |-- Diverging --> Component token
        |-- Only user --> Semantic. One user today is still a shared decision tomorrow.
```

### Where does this token get declared?

```
Is it a primitive?
|-- YES --> :root, once, never reassigned
|-- NO  --> Does it change per mode, density, or tenant?
    |-- YES --> :root for the default, reassigned on the scope selector
    |-- NO  --> Is it local to one component?
        |-- YES --> On the component's own selector
        |-- NO  --> :root alongside the other semantics
```

</decision_framework>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- **Channel triplets as token values** (`--color-surface: 0 0% 100%`) — not a colour, so `color-mix()`, `oklch()` interpolation and every opacity modifier produce invalid CSS that is silently dropped. Store complete colour values.
- **An inverted or cyclic graph** — a primitive referencing a semantic, or two tokens aliasing each other. Pipelines error on cycles; hand-written CSS resolves to nothing and the declaration disappears.
- **A `@property` rule missing `syntax` or `inherits`** — the whole rule is invalid and ignored, so the property stays unregistered and the transition that depended on it does nothing.
- **`initial-value` that is not computationally independent** (`3em`) — same outcome: the rule is dropped whole with nothing in the console.
- **Fallbacks in consumers** (`var(--color-surface, #fff)`) — hides a missing token behind a plausible value, so the bug ships looking almost right.

**Costs a rebrand:**

- **A component reading a primitive** (`background: var(--palette-slate-100)`) — the indirection layer is bypassed, so a palette change has to visit every component instead of one semantic file.
- **Hex or px literals in component CSS** — an untracked token. It will not move with the system, will not respond to a mode change, and will not appear in any audit.
- **Mode baked into the name** (`--color-dark-bg`, `--text-light-muted`) — the token count multiplies by the number of modes and every consumer needs a conditional. Reassign one role-named token per scope.
- **Semantic names that describe appearance** (`--color-blue-action`) — half a semantic token. The role survives a rebrand; the colour word becomes a lie.
- **Parallel hand-maintained copies** in TypeScript and CSS — they drift on the first one-sided change and nothing fails.
- **Skipping `outputReferences` in a generated CSS platform** — every semantic token flattens to a literal, so the aliasing the tiers were built for disappears from the output.

**Surprising behaviour:**

- **Custom properties inherit by default**, so a component token declared on a component selector reaches every descendant including slotted children. `inherits: false` via `@property` is the fix where that matters.
- **`CSS.registerProperty()` takes precedence over `@property`** for the same name, so a stray JS registration silently overrides the stylesheet.
- **`calc()` chains through several tiers resolve at use time**, so a unit error three aliases up surfaces as a dropped declaration at the consumer with no indication of which link broke.
- **DTCG `{alias}` always resolves to a complete `$value`.** Reaching into part of a composite needs JSON Pointer; referencing a group is an error.
- **`$type` flows from the closest ancestor group that declares it**, and a node must never carry both `$value` and child tokens — that shape is neither a group nor a token.
- **Token names cannot start with `$` or contain `{`, `}` or `.`** — the period is reserved for alias paths, so a name containing one produces an unresolvable reference.
- **Mixing DTCG (`$value`) with the original format (`value`) in one instance** makes the unrecognised half read as plain groups, so a half-finished migration looks like tokens that simply vanished.

**Sprawl:**

- **Token-per-usage** (`--button-primary-hover-icon-margin-left`) — a token per property per element is a stylesheet with extra steps. Tokens encode shared decisions; a value shared with nothing is just a value.
- **A component tier mirroring the component tree** — component tokens are exceptions, not coverage.
- **Mixed scale conventions in one namespace** (`--space-sm` beside `--space-400`) — every lookup becomes a guess about which convention applies.
- **Density as a second spacing scale** rather than a multiplier applied where primitives become semantics — the token count multiplies by the number of density levels and every component gains a branch.

</red_flags>
