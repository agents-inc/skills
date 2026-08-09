---
name: web-styling-design-tokens
description: Design token architecture - primitive/semantic/component tiers, naming grammar, CSS custom property delivery, and DTCG build pipelines
---

# Design Token Patterns

> **Quick Guide:** A design token system is a one-way dependency graph: primitives hold raw values, semantic tokens name intent, component tokens hold local exceptions. Consumers only ever touch the top two tiers. Deliver tokens as CSS custom properties -- primitives in `:root`, semantic aliases per scope, component tokens reading semantics. Name tokens for their **role**, never for the mode they happen to appear in (`--color-surface-raised`, never `--color-dark-bg`). Store complete color values, never bare channel triplets. When tokens must exist in more than one language, generate every output from one DTCG source rather than hand-maintaining parallel copies.

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Tier construction, aliasing, naming grammar, CSS custom property delivery, `@property` registration
- [examples/scales.md](examples/scales.md) - Generated spacing and type series, modular scales, fluid type, density multipliers
- [examples/pipeline.md](examples/pipeline.md) - DTCG source files, Style Dictionary platforms, typed TypeScript export
- [examples/utility-framework-bridge.md](examples/utility-framework-bridge.md) - Feeding tokens into a utility-class framework without duplicating the source of truth
- [reference.md](reference.md) - Naming grammar table, DTCG `$type` reference, format names, authoring checklist

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST route every component style through a semantic or component token - NEVER let component CSS read a primitive token or a raw hex/px literal)**

**(You MUST name tokens for their role, NEVER for a mode or a literal value - `--color-surface-raised`, never `--color-dark-bg` or `--color-gray-900-bg`)**

**(You MUST store complete color values in tokens - NEVER bare channel triplets like `0 0% 100%`, which break `color-mix()` opacity math and `oklch()` interpolation)**

**(You MUST keep the dependency flow one-way: primitive -> semantic -> component - NEVER let a primitive reference a semantic token, and NEVER create a cycle)**

**(You MUST generate every additional output from one source when tokens exist in more than one language - NEVER hand-maintain a TypeScript constant beside a CSS variable)**

</critical_requirements>

---

**Auto-detection:** design tokens, design token, token tiers, primitive tokens, semantic tokens, component tokens, token aliasing, token naming, token taxonomy, DTCG, Design Tokens Community Group, `$value`, `$type`, Style Dictionary, style-dictionary, `transformGroup`, `buildPath`, `css/variables`, CSS custom properties, `--color-`, `@property`, token pipeline, spacing scale, type scale, modular scale, density tokens

**When to use:**

- Standing up the token layer a design system will sit on
- Deciding how many tiers a token set needs and what belongs in each
- Naming tokens so they survive a rebrand, a new mode, or a density change
- Delivering tokens as CSS custom properties with correct scoping
- Building tokens from a DTCG source into CSS, TypeScript, or other platform outputs
- Generating spacing and type series instead of hand-listing every step
- Auditing an existing token set for tier leaks, mode-named tokens, or drift between languages

**When NOT to use:**

- A project with a handful of colors and no theming ambitions -- a short `:root` block is the right amount of structure
- A single-surface prototype that will not outlive the sprint
- A codebase whose values are already fully derived from an upstream system you do not own

**This skill does NOT cover:**

- **Runtime theme application, mode switching, and FOUC prevention** -- how a theme gets selected, persisted, and applied without a flash is a separate concern (`web-styling-theming`). This skill defines the token _contract_ those mechanics switch between.
- **Utility-class authoring and usage** -- writing markup with utility classes, variants, and responsive prefixes (`web-styling-tailwind`). This skill covers where tokens are _declared_; that skill covers how the generated classes are _used_.
- **Component variant APIs** -- mapping props to class combinations (`web-styling-cva`). Variants consume component tokens; they do not define them.

**Key patterns covered:**

- Token tiers: primitive -> semantic -> component, and when two tiers are enough
- Naming grammar: category-property-variant-state, scale conventions, mode-free names
- CSS custom properties as the delivery format, with scope-aware semantic aliases
- `@property` registration where typed, animatable, non-inherited tokens earn it
- Feeding tokens into a utility-class framework without forking the source of truth
- DTCG-format source plus a build pipeline producing CSS and typed TypeScript
- Scales as generated series, and density as a multiplier token

---

<philosophy>

## Philosophy

A token system is not a list of values. It is a **one-way dependency graph with a naming contract**, and its whole purpose is to put a layer of indirection between "what the value is" and "what the value means" so the two can change independently.

**The three tiers exist to separate three kinds of change:**

| Tier          | Answers                      | Changes when                          | Who reads it                     |
| ------------- | ---------------------------- | ------------------------------------- | -------------------------------- |
| **Primitive** | "What is this value?"        | The palette or scale is regenerated   | Semantic tokens only             |
| **Semantic**  | "What is this value _for_?"  | The design language shifts, or a mode | Components, and component tokens |
| **Component** | "What does _this part_ use?" | One component needs a local exception | That component only              |

**Core principles:**

- **One-way flow.** Primitive -> semantic -> component. A primitive that references a semantic token has inverted the graph and made the palette un-regenerable.
- **Consumers touch semantics, never primitives.** `background: var(--color-surface-raised)` survives a rebrand. `background: var(--color-gray-100)` does not.
- **Names encode role, not appearance, and never mode.** The moment a token is called `--color-dark-bg`, it can only ever be correct in one mode, and every additional mode forks the name.
- **Every tier you add is indirection you pay for on every read.** Three tiers is the ceiling, not the target. Component tokens are exceptions, not a mirror of the component tree.
- **The token set is the contract; the delivery format is an implementation detail.** CSS custom properties, a typed TypeScript object, and a native platform file are three renderings of the same graph -- which is exactly why they must be generated, not typed twice.

**Why a value that appears once still deserves a semantic token:** the question is not "how many places use this?" but "when this changes, will everyone who uses it want to change together?" A token is a statement that a set of usages share a fate.

**When two tiers suffice:** a product with a single brand, a single mode, and no white-labelling can collapse component tokens away and let components read semantics directly. Add the component tier the first time a component needs a value that genuinely diverges from the semantic default -- not preemptively.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Token Tiers and the One-Way Graph

Primitives are the only tier holding literal values. Semantic tokens alias primitives and name intent. Component tokens alias semantics and exist only where a component diverges.

```css
:root {
  /* Tier 1 - primitives: literal values, no meaning attached */
  --palette-slate-50: oklch(0.98 0.003 250);
  --palette-slate-900: oklch(0.21 0.02 250);

  /* Tier 2 - semantic: names intent, aliases a primitive */
  --color-surface-default: var(--palette-slate-50);
  --color-text-default: var(--palette-slate-900);

  /* Tier 3 - component: a local exception, aliases a semantic */
  --card-surface: var(--color-surface-default);
}
```

**Key rules:** a primitive never references anything, a semantic never holds a literal, a component token never reaches past the semantic tier. Circular references are a hard error in every conforming pipeline -- the graph must be acyclic.

**Two tiers is a valid answer.** Add the component tier at the first genuine divergence, not before. A component token that is a straight pass-through of a semantic token (`--card-surface: var(--color-surface-default)` with no override anywhere) is indirection that earns nothing -- delete it and let the component read the semantic directly.

> See [examples/core.md](examples/core.md#pattern-1-token-tiers-and-the-one-way-graph) for a full three-tier set, the two-tier collapse, and the inverted-graph anti-pattern.

---

### Pattern 2: Naming Grammar

A token name is a path read left to right, from most general to most specific. Fix the segment order once and every name in the system becomes predictable.

```
[namespace-]category-concept[-variant][-state][-scale]

--color-text-default            category=color  concept=text   variant=default
--color-text-danger-hover       + variant=danger + state=hover
--space-inline-sm               category=space  concept=inline scale=sm
--acme-color-surface-raised     namespace=acme (only when tokens ship outside the app)
```

**Key rules:** the category segment comes first so tokens sort into groups; state is always the last modifier so `-hover` and `-pressed` read consistently; a segment that is absent means "default" rather than being spelled out at every level.

**Never bake the mode into the name.** `--color-dark-bg` cannot be correct in light mode, so a second name has to exist, and now every consumer needs a conditional. The mode belongs in the _scope that assigns the value_, not in the _identifier_:

```css
/* Bad - the name is only true in one mode */
--color-dark-bg: oklch(0.21 0.02 250);

/* Good - one name, value reassigned per scope */
--color-surface-default: var(--palette-slate-50);
[data-theme="dark"] {
  --color-surface-default: var(--palette-slate-900);
}
```

**Scale conventions:** numeric steps (`50`-`950`) for primitive ramps where the number is a position, t-shirt sizes (`xs`-`xl`) for semantic steps where the number would imply false precision. Do not mix the two conventions inside one namespace.

> See [examples/core.md](examples/core.md#pattern-2-naming-grammar) for the full segment table, scale conventions, and the mode-in-name refactor.

---

### Pattern 3: CSS Custom Properties as the Delivery Format

Custom properties are the delivery format because they are the only one that participates in the cascade -- reassigning a semantic token inside a scope re-themes every descendant with no rebuild and no re-render.

```css
:root {
  --palette-blue-600: oklch(0.55 0.19 258);
  --color-action-default: var(
    --palette-blue-600
  ); /* semantic, global default */
}

/* A scope reassigns semantics; primitives never move */
[data-density="compact"] {
  --space-inline-md: var(--space-2);
}

.card {
  --card-padding: var(--space-inline-md); /* component token reads semantic */
  padding: var(--card-padding);
}
```

**Key rules:** primitives live in `:root` and are never reassigned; semantic tokens are the only tier a scope selector touches; component tokens are declared on the component's own selector so they inherit into its subtree and nowhere else. Never assign a fallback in the consumer (`var(--color-x, #fff)`) -- a missing token should be visible, not silently papered over.

**Register a token with `@property` when it is animated, or when unintended inheritance would be a bug.** Both `syntax` and `inherits` are required descriptors, and `initial-value` is required for any `syntax` other than `*`:

```css
@property --card-elevation-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}
```

Registration buys typed interpolation (an unregistered custom property cannot be transitioned), plus a fallback to `initial-value` instead of an inherited garbage value when a computed value is invalid. It costs a declaration per token, so register selectively -- animated tokens and component-local tokens that must not leak, not the whole set.

> See [examples/core.md](examples/core.md#pattern-3-css-custom-properties-as-delivery) for scoping rules, inheritance traps, and `@property` registration in full.

---

### Pattern 4: The Utility-Framework Bridge

When a utility-class framework consumes the token set, the CSS custom properties stay the single source of truth and the framework's theme block is a **projection** of them -- never a second place values are typed.

In Tailwind v4, `@theme` is a token-declaration surface: each variable in it generates utility classes _and_ a standard CSS variable. `@theme inline` resolves the value directly into the generated utilities, which is what makes the mode-swappable bridge work:

```css
@import "tailwindcss";

/* 1. Real tokens live here, mode-swappable, framework-agnostic */
:root {
  --app-canvas: oklch(0.98 0.003 250);
}
[data-theme="dark"] {
  --app-canvas: oklch(0.21 0.02 250);
}

/* 2. Projection - the framework consumes tokens, it does not define them */
@theme inline {
  --color-canvas: var(--app-canvas);
}
```

**Key rules:** `@theme` must be top-level -- it cannot be nested inside a selector or media query, which is precisely why the mode-swappable values live in `:root`/`[data-theme]` and only the alias goes in `@theme`. Without `inline`, the generated utility emits a variable reference that resolves at the wrong scope and the mode swap silently fails. Rule of thumb: put a token in `@theme` only when it should map to a utility class; everything else stays in `:root`.

**Values must be complete colors.** Opacity modifiers compile to `color-mix(in oklab, var(--color-canvas) 50%, transparent)`, which requires a real color -- a bare channel triplet (`0 0% 100%`) produces invalid CSS and the utility silently drops.

> See [examples/utility-framework-bridge.md](examples/utility-framework-bridge.md) for the full bridge, namespace resets, and the duplicated-source-of-truth anti-pattern.

---

### Pattern 5: DTCG Source and a Build Pipeline

A pipeline earns its keep the moment the same token must exist in a second language or a second platform. Source lives in DTCG format (`$value` / `$type` / `$description`, `{alias}` references), and every output -- CSS, typed TypeScript, native files -- is generated from it.

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
// style-dictionary config: one source, many platforms
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

**Key rules:** `$type` hoists to the closest ancestor group that declares it, so declare it once per group rather than on every token. The `{group.token}` alias always resolves to a whole `$value` -- property-level access needs JSON Pointer (`#/color/blue/$value`). DTCG (`$value`) and the original format (`value`) **cannot be combined in a single instance** -- pick one for the whole source tree. `outputReferences: true` is what keeps `var()` aliasing in the CSS output instead of flattening every semantic token to a literal.

**When a pipeline does not earn its keep:** one platform, one language, and hand-written CSS custom properties that nothing else consumes. A build step that produces exactly one file nobody else reads is cost with no payoff -- reach for it when a second consumer appears, not before.

> See [examples/pipeline.md](examples/pipeline.md) for the full DTCG source tree, platform configs, typed TypeScript export, and the drift anti-pattern.

---

### Pattern 6: Scales as Generated Series

Spacing and type are series, not sets. Express the generator -- a base and a ratio, or a base and a multiplier -- so every step is derivable and no step can be individually wrong.

```css
:root {
  --space-base: 0.25rem;
  --space-1: calc(var(--space-base) * 1);
  --space-2: calc(var(--space-base) * 2);
  --space-4: calc(var(--space-base) * 4);
  --space-8: calc(var(--space-base) * 8);
}
```

**Density is a multiplier on the semantic tier, not a second scale.** One multiplier token re-scales the whole system without touching a single component:

```css
:root {
  --density-scale: 1;
}
[data-density="compact"] {
  --density-scale: 0.75;
}

:root {
  --space-inline-md: calc(var(--space-4) * var(--density-scale));
}
```

**Key rules:** the multiplier applies where primitives become semantics, so component tokens inherit density for free. Type scales follow the same shape with a ratio instead of a multiplier, and fluid steps use `clamp()` with the min and max both derived from the scale rather than hand-picked. A `calc()` chain nested more than about three levels deep gets hard to debug -- if that happens, generate the resolved values in the pipeline instead.

> See [examples/scales.md](examples/scales.md) for modular type scales, fluid `clamp()` steps, density multipliers, and generated-vs-hand-listed comparisons.

</patterns>

---

<decision_framework>

## Decision Framework

### How many tiers?

```
Does the product need more than one visual mode, brand, or tenant?
|-- NO --> Does any component need a value that diverges from the system default?
|   |-- NO  --> Two tiers: primitive + semantic
|   |-- YES --> Two tiers plus component tokens only for the divergent components
|-- YES --> Three tiers. Semantic tokens are the swap point; primitives never move.
```

### Which tier does this value belong to?

```
Is it a literal (a hex, a rem, a ms)?
|-- YES --> Primitive. It gets a position-in-a-ramp name, not a meaning name.
|-- NO  --> Does more than one component share this decision?
    |-- YES --> Semantic. Name the role.
    |-- NO  --> Is the component genuinely diverging, or just the only current user?
        |-- Diverging   --> Component token
        |-- Only user   --> Semantic. One user today is still a shared decision tomorrow.
```

### Does this need a build pipeline?

```
Do tokens need to exist in more than one language or platform?
|-- YES --> Pipeline. Generate every output; hand-maintaining two copies guarantees drift.
|-- NO  --> Are tokens consumed by anything outside this repository?
    |-- YES --> Pipeline. The published artifact needs a stable, versioned shape.
    |-- NO  --> Hand-written CSS custom properties. Add the pipeline at the second consumer.
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

<integration>

## Integration Notes

**Consuming surfaces:** the token set is a contract, and every consumer reads the same custom properties. A styling approach that can read `var(--token)` -- stylesheets, scoped component styles, inline styles, a utility framework's theme block -- needs no adapter. One that cannot read custom properties at runtime needs a generated artifact from the pipeline instead, which is exactly what a second platform target is for.

**Publishing tokens:** when tokens ship outside the repository that owns them, add the namespace segment to every name and version the generated artifact, not the source. Consumers pin the artifact; the source is free to reorganise as long as the generated names hold.

**What the token layer does NOT own:** how a mode is selected and applied at runtime, how utility classes are written, and how component props map to styles. Those consume tokens; they do not define them.

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **A component reading a primitive** (`background: var(--palette-slate-100)`) -- the indirection layer is bypassed, so a rebrand has to touch every component instead of one semantic file. Alias a semantic token and use that.
- **Hex or px literals in component CSS** -- an untracked token. It will not move with the system, will not respond to a mode change, and will not appear in any audit.
- **Mode baked into the token name** (`--color-dark-bg`, `--text-light-muted`) -- the name is only true in one mode, so every additional mode forks the name and every consumer needs a conditional. Reassign one role-named token per scope instead.
- **Channel triplets as token values** (`--color-surface: 0 0% 100%`) -- not a color, so `color-mix()`, `oklch()` interpolation, and every opacity modifier produce invalid CSS that silently drops the declaration. Store complete color values.
- **TypeScript constants and CSS variables maintained side by side** -- they drift on the first change made in only one of them, and nothing fails loudly. Generate both from one source or keep only one.
- **An inverted or cyclic graph** -- a primitive referencing a semantic token, or two tokens aliasing each other. Conforming pipelines error on cycles; hand-written CSS just resolves to nothing at runtime.

**Medium Priority Issues:**

- **Token-per-usage sprawl** (`--button-primary-hover-icon-margin-left`) -- a token per property per element is a stylesheet with extra steps. Tokens encode shared decisions; a value used in exactly one declaration and shared with nothing is just a value.
- **A component tier that mirrors the component tree** -- component tokens are exceptions, not coverage. A pass-through token that overrides nothing anywhere is indirection with no payoff.
- **Fallbacks in consumers** (`var(--color-surface, #fff)`) -- hides a missing token behind a plausible value, so the bug ships. Let it be visibly broken.
- **Mixed scale conventions in one namespace** (`--space-sm` beside `--space-400`) -- callers cannot predict which convention a given name uses, so every lookup is a guess.
- **Semantic names that describe appearance** (`--color-blue-action`) -- half a semantic token. The role survives a rebrand; the colour name does not.
- **Skipping `outputReferences` in a generated CSS platform** -- every semantic token flattens to a literal, so the aliasing that made the tier system worth building disappears from the output.

**Common Mistakes:**

- Adding the component tier preemptively rather than at the first genuine divergence
- Regenerating a primitive ramp and expecting semantics to follow, when semantics hold literals instead of aliases
- Declaring `$type` on every token when it hoists from the closest ancestor group that declares it
- Naming a state segment somewhere other than last, so `-hover-danger` and `-danger-hover` both exist
- Treating density as a second spacing scale instead of a multiplier applied where primitives become semantics

**Gotchas & Edge Cases:**

- **`@theme` cannot be nested** under a selector or media query -- it is top-level only. Mode-swappable values therefore live in `:root` / `[data-theme]`, and only the alias goes in `@theme inline`. Omitting `inline` makes the generated utility resolve the reference at the wrong scope, and the mode swap fails silently rather than erroring.
- **`@property` requires both `syntax` and `inherits`**; if either is missing the whole rule is invalid and ignored. `initial-value` is required for every `syntax` except `*`, and must be computationally independent -- `10px` is valid, `3em` is not.
- **An unregistered custom property cannot be transitioned or animated.** It is treated as an untyped token and jumps between values. Registration is the only way to interpolate one.
- **`CSS.registerProperty()` takes precedence over `@property`** for the same name, so a stray JS registration silently overrides the stylesheet.
- **DTCG `{alias}` syntax always resolves to a complete `$value`.** Reaching into part of a composite token needs JSON Pointer (`#/color/blue/$value`). Referencing a group rather than a token is an error in current tooling.
- **DTCG (`$value`) and the original format (`value`) cannot be combined in one instance** -- a half-migrated token tree fails in ways that look like missing tokens.
- **`$type` inheritance flows from the closest ancestor group that declares it**, and a group must never contain both `$value` and child tokens -- that shape is neither a group nor a token.
- **Token names cannot start with `$` or contain `{`, `}`, or `.`** -- the period is reserved for alias path construction, so a name containing one produces an unresolvable reference.
- **Custom properties inherit by default**, so a component token declared on a component selector leaks into every descendant including slotted children. `inherits: false` via `@property` is the fix when that matters.
- **`calc()` chains through several tiers resolve at use time, not at declaration time** -- a unit error three aliases up surfaces as a silently dropped declaration at the consumer, with no indication of which link broke.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST route every component style through a semantic or component token - NEVER let component CSS read a primitive token or a raw hex/px literal)**

**(You MUST name tokens for their role, NEVER for a mode or a literal value - `--color-surface-raised`, never `--color-dark-bg` or `--color-gray-900-bg`)**

**(You MUST store complete color values in tokens - NEVER bare channel triplets like `0 0% 100%`, which break `color-mix()` opacity math and `oklch()` interpolation)**

**(You MUST keep the dependency flow one-way: primitive -> semantic -> component - NEVER let a primitive reference a semantic token, and NEVER create a cycle)**

**(You MUST generate every additional output from one source when tokens exist in more than one language - NEVER hand-maintain a TypeScript constant beside a CSS variable)**

**Failure to follow these rules produces a token set that cannot be rebranded, cannot gain a mode without forking every name, and drifts silently between languages.**

</critical_reminders>
