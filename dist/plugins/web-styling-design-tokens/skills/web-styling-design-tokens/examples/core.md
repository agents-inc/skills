# Design Tokens - Core Examples

> Essential patterns for token tiers, naming, and CSS custom property delivery. See [SKILL.md](../SKILL.md) for concepts and decision frameworks.

**Additional Examples:**

- [scales.md](scales.md) - Generated spacing and type series, density multipliers
- [pipeline.md](pipeline.md) - DTCG source and build platforms
- [utility-framework-bridge.md](utility-framework-bridge.md) - Feeding tokens into a utility-class framework

---

## Pattern 1: Token Tiers and the One-Way Graph

### Good Example - A Complete Three-Tier Set

```css
/* tokens/primitives.css
   Tier 1. Literal values only. Named by position in a ramp, never by meaning.
   Nothing in this file references anything else. */
:root {
  --palette-slate-50: oklch(0.98 0.003 250);
  --palette-slate-100: oklch(0.96 0.005 250);
  --palette-slate-200: oklch(0.92 0.008 250);
  --palette-slate-700: oklch(0.42 0.02 250);
  --palette-slate-900: oklch(0.21 0.02 250);

  --palette-blue-500: oklch(0.62 0.18 258);
  --palette-blue-600: oklch(0.55 0.19 258);

  --palette-red-600: oklch(0.55 0.21 27);

  --space-base: 0.25rem;
  --radius-base: 0.25rem;
  --duration-base: 150ms;
}
```

```css
/* tokens/semantic.css
   Tier 2. Names intent. Every value is an alias - never a literal.
   This is the only tier a mode, density, or tenant scope reassigns. */
:root {
  --color-surface-default: var(--palette-slate-50);
  --color-surface-raised: var(--palette-slate-100);
  --color-surface-sunken: var(--palette-slate-200);

  --color-text-default: var(--palette-slate-900);
  --color-text-muted: var(--palette-slate-700);

  --color-action-default: var(--palette-blue-600);
  --color-action-hover: var(--palette-blue-500);
  --color-action-danger: var(--palette-red-600);

  --space-inline-sm: calc(var(--space-base) * 2);
  --space-inline-md: calc(var(--space-base) * 4);
  --space-block-md: calc(var(--space-base) * 4);

  --radius-control: var(--radius-base);
  --duration-interaction: var(--duration-base);
}

/* The swap point. Primitives never move; only semantics are reassigned. */
[data-theme="dark"] {
  --color-surface-default: var(--palette-slate-900);
  --color-surface-raised: var(--palette-slate-700);
  --color-text-default: var(--palette-slate-50);
  --color-text-muted: var(--palette-slate-200);
}
```

```css
/* tokens/components.css
   Tier 3. Exceptions only. Declared on the component's own selector so the
   token inherits into that subtree and nowhere else. */
.card {
  --card-surface: var(--color-surface-raised);
  --card-padding: var(--space-inline-md);
  /* A genuine divergence: cards use a softer radius than every other control */
  --card-radius: calc(var(--radius-control) * 2);

  background: var(--card-surface);
  padding: var(--card-padding);
  border-radius: var(--card-radius);
  color: var(--color-text-default);
}
```

**Why good:** each tier has exactly one job so each kind of change lands in exactly one file, the dark-mode block touches five semantic lines instead of every component, and `--card-radius` documents that the divergence is deliberate rather than an accident of a magic number.

---

### Good Example - The Two-Tier Collapse

```css
/* A single brand, a single mode, no white-labelling.
   Components read semantics directly - no component tier at all. */
:root {
  --palette-slate-50: oklch(0.98 0.003 250);
  --palette-slate-900: oklch(0.21 0.02 250);

  --color-surface-default: var(--palette-slate-50);
  --color-text-default: var(--palette-slate-900);
}

.card {
  background: var(--color-surface-default);
  color: var(--color-text-default);
}
```

**Why good:** the component tier would add a hop with nothing on the other end. Add it at the first genuine divergence, not preemptively.

**When to use:** one brand, one mode, and no component that needs a value diverging from the system default.

---

### Bad Example - Tier Leaks and an Inverted Graph

```css
:root {
  /* BAD: primitive references a semantic - the graph is now inverted and the
     palette can no longer be regenerated independently */
  --palette-blue-600: var(--color-action-default);

  /* BAD: semantic holds a literal - regenerating the ramp does not reach it */
  --color-surface-default: #f8fafc;

  /* BAD: mutual aliasing - a cycle. Pipelines error; plain CSS resolves to
     nothing and the declaration is silently dropped. */
  --color-text-default: var(--color-text-primary);
  --color-text-primary: var(--color-text-default);
}

.card {
  /* BAD: component reads a primitive, bypassing the whole indirection layer */
  background: var(--palette-slate-100);
  /* BAD: untracked literal - invisible to every audit, immune to mode changes */
  padding: 16px;
  border: 1px solid #e2e8f0;
}
```

**Why bad:** the inverted primitive makes the palette unregenerable, the literal semantic silently ignores palette updates, the cycle resolves to nothing at runtime with no error, and the component's primitive read plus two literals mean a rebrand has to touch this file -- which is the exact cost the tier system was built to remove.

---

## Pattern 2: Naming Grammar

### Good Example - Fixed Segment Order

```css
:root {
  /* [namespace-]category-concept[-variant][-state][-scale]
     Category first so tokens sort into groups. State always last. */

  /* category=color, concept=text, variant=default */
  --color-text-default: var(--palette-slate-900);
  --color-text-muted: var(--palette-slate-700);
  --color-text-danger: var(--palette-red-600);

  /* + state, always the trailing modifier */
  --color-action-default: var(--palette-blue-600);
  --color-action-default-hover: var(--palette-blue-500);
  --color-action-danger-hover: var(--palette-red-500);

  /* category=space, concept=inline, scale=sm|md|lg */
  --space-inline-sm: calc(var(--space-base) * 2);
  --space-inline-md: calc(var(--space-base) * 4);
  --space-inline-lg: calc(var(--space-base) * 6);

  /* Namespace segment only when tokens ship outside the repo that owns them */
  --acme-color-surface-raised: var(--palette-slate-100);
}
```

**Why good:** the order is predictable so a name can be guessed rather than looked up, an absent segment means "default" so the common case stays short, and state trailing consistently prevents `-hover-danger` and `-danger-hover` both existing.

---

### Good Example - Scale Conventions, Not Mixed

```css
:root {
  /* Numeric steps for primitive ramps - the number is a position in a series */
  --palette-slate-50: oklch(0.98 0.003 250);
  --palette-slate-500: oklch(0.55 0.02 250);
  --palette-slate-900: oklch(0.21 0.02 250);

  /* T-shirt sizes for semantic steps - a number would imply false precision
     ("is space-400 twice space-200?" has no answer at this tier) */
  --space-inline-xs: calc(var(--space-base) * 1);
  --space-inline-sm: calc(var(--space-base) * 2);
  --space-inline-md: calc(var(--space-base) * 4);
}
```

**Why good:** each convention carries information -- position for primitives, relative step for semantics -- and keeping them in separate namespaces means a caller never has to guess which one a given name uses.

---

### Bad Example - Mode in the Name

```css
/* BAD: the name is only true in one mode */
:root {
  --color-dark-bg: oklch(0.21 0.02 250);
  --color-light-bg: oklch(0.98 0.003 250);
  --text-light-muted: oklch(0.42 0.02 250);
}

.card {
  /* Every consumer now needs a conditional, and a third mode forks all of it */
  background: var(--color-light-bg);
}

[data-theme="dark"] .card {
  background: var(--color-dark-bg);
}
```

**Why bad:** the identifier encodes the mode instead of the role, so the token count multiplies by the number of modes, every consumer needs a mode-aware selector, and adding a high-contrast mode means a third name plus a third branch in every component.

### The Refactor

```css
/* GOOD: one role-named token, value reassigned per scope */
:root {
  --color-surface-default: var(--palette-slate-50);
  --color-text-muted: var(--palette-slate-700);
}

[data-theme="dark"] {
  --color-surface-default: var(--palette-slate-900);
  --color-text-muted: var(--palette-slate-200);
}

[data-theme="high-contrast"] {
  --color-surface-default: oklch(1 0 0);
  --color-text-muted: oklch(0 0 0);
}

.card {
  background: var(--color-surface-default); /* unchanged in every mode */
}
```

**Why good:** the consumer is written once and never revisited, and adding a mode is a block of semantic reassignments with zero component churn.

---

### Bad Example - Appearance Names and Mixed Conventions

```css
:root {
  /* BAD: half-semantic. The role survives a rebrand; "blue" does not. */
  --color-blue-action: var(--palette-blue-600);

  /* BAD: value baked into the name - a rebrand makes the name a lie */
  --color-gray-900-bg: var(--palette-slate-900);

  /* BAD: two scale conventions in one namespace - callers cannot predict which */
  --space-sm: 0.5rem;
  --space-400: 1rem;
}
```

**Why bad:** appearance-based names go stale the moment the value changes, leaving a token called `blue` holding green, and the mixed conventions turn every lookup into a guess between two systems.

---

## Pattern 3: CSS Custom Properties as Delivery

### Good Example - Scope-Correct Declaration

```css
/* Primitives: :root, once, never reassigned anywhere */
:root {
  --palette-slate-50: oklch(0.98 0.003 250);
  --palette-slate-900: oklch(0.21 0.02 250);
  --space-base: 0.25rem;
}

/* Semantics: :root holds the default; scope selectors reassign */
:root {
  --color-surface-default: var(--palette-slate-50);
  --space-inline-md: calc(var(--space-base) * 4);
}

[data-theme="dark"] {
  --color-surface-default: var(--palette-slate-900);
}

[data-density="compact"] {
  --space-inline-md: calc(var(--space-base) * 2);
}

/* Component tokens: on the component's own selector, so they inherit into
   its subtree and nowhere else */
.dialog {
  --dialog-surface: var(--color-surface-default);
  --dialog-padding: var(--space-inline-md);

  background: var(--dialog-surface);
  padding: var(--dialog-padding);
}
```

**Why good:** a mode swap and a density swap are independent scope reassignments that compose (a compact dark dialog needs no extra rule), and the component token cannot leak outside `.dialog` because it is declared there.

---

### Bad Example - Fallbacks and Misplaced Scopes

```css
.dialog {
  /* BAD: fallback hides a missing token behind a plausible value, so a typo
     or a deleted token ships looking almost right */
  background: var(--color-surface-default, #ffffff);
  padding: var(--space-inline-md, 16px);
}

/* BAD: primitive reassigned in a scope - now "slate-900" means different
   things in different subtrees and the ramp is no longer a ramp */
[data-theme="dark"] {
  --palette-slate-900: oklch(0.98 0.003 250);
}

/* BAD: component token declared globally - leaks into every element on the
   page and collides with any other component using the same name */
:root {
  --dialog-padding: 1rem;
}
```

**Why bad:** the fallbacks turn a hard failure into a silent visual bug that reaches production, reassigning the primitive means the palette no longer describes a single set of values, and the global component token is a name collision waiting for the second component that wants `--dialog-padding`.

---

### Good Example - `@property` Registration Where It Earns It

```css
/* Registered: this token is animated. An unregistered custom property is
   untyped and jumps between values instead of interpolating. */
@property --card-glow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}

/* Registered: this token must not reach descendants. Custom properties
   inherit by default, including into slotted children. */
@property --card-surface {
  syntax: "<color>";
  inherits: false;
  initial-value: transparent;
}

.card {
  --card-surface: var(--color-surface-raised);
  background: var(--card-surface);
  box-shadow: 0 0 1rem
    color-mix(
      in oklab,
      var(--color-action-default) var(--card-glow-alpha),
      transparent
    );
  transition: --card-glow-alpha var(--duration-interaction) ease-out;
}

.card:hover {
  --card-glow-alpha: 40%;
}
```

**Why good:** the registration is what makes `transition: --card-glow-alpha` work at all, `inherits: false` stops `--card-surface` bleeding into nested cards and slotted content, and an invalid computed value falls back to `initial-value` instead of inheriting an unrelated value from an ancestor.

**When to use:** animated tokens, and component tokens whose inheritance would be a bug. Registering the whole token set is a declaration per token for no benefit on the ones that are neither animated nor leak-prone.

---

### Bad Example - Invalid Registrations

```css
/* BAD: missing `inherits` - the entire rule is invalid and silently ignored,
   so the property stays unregistered and the transition below does nothing */
@property --card-glow-alpha {
  syntax: "<percentage>";
  initial-value: 0%;
}

/* BAD: non-universal syntax with no `initial-value` - also invalid and ignored */
@property --card-radius {
  syntax: "<length>";
  inherits: false;
}

/* BAD: `initial-value` is not computationally independent. `em` depends on the
   parent font-size, so the rule is invalid. */
@property --card-padding {
  syntax: "<length>";
  inherits: false;
  initial-value: 1em;
}
```

**Why bad:** each of these is dropped whole rather than partially applied, so the property remains unregistered and every capability that depended on registration -- interpolation, type checking, the `initial-value` fallback -- quietly does not happen, with nothing in the console to say so.

---

## Auditing an Existing Token Set

> Not a numbered pattern -- a procedure that applies across Patterns 1-3.

### What a Clean Audit Looks For

```css
/* Run these four questions over any token file:

   1. Does any component selector reference a --palette-* token or a literal?
      -> tier leak. Introduce a semantic alias.

   2. Does any token name contain a mode word (dark, light, contrast) or a
      colour/value word (blue, gray, 900, 16px)?
      -> rename to the role; reassign per scope.

   3. Does any semantic token hold a literal instead of a var()?
      -> it will not follow a palette regeneration. Alias it.

   4. Does any component token override nothing, anywhere?
      -> pass-through indirection. Delete it; read the semantic directly. */
```

**Why good:** the four questions map one-to-one onto the four failure modes that make a token system stop paying for itself, and each has a mechanical fix rather than a judgement call.
