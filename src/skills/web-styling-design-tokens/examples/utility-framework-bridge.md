# Design Tokens - Utility-Framework Bridge Examples

> Extended examples for projecting a token set into a utility-class framework's theme surface. See [core.md](core.md) for the tier and delivery patterns this builds on.

**Prerequisites**: Understand [Pattern 1: Token Tiers](core.md#pattern-1-token-tiers-and-the-one-way-graph) and [Pattern 3: CSS Custom Properties as Delivery](core.md#pattern-3-css-custom-properties-as-delivery) first.

---

## Pattern 4: The Utility-Framework Bridge

A utility-class framework that generates classes from theme variables needs those variables declared in its own theme block. That block must be a **projection** of the token set, not a second place values are typed.

In Tailwind v4, `@theme` is a token-declaration surface: every variable inside it generates utility classes _and_ emits a standard CSS custom property. That dual role is what makes it a token concern rather than a utility-usage concern.

### Good Example - The Canonical Mode-Swappable Bridge

```css
@import "tailwindcss";

/* 1. Primitives. Literal values, never reassigned. */
:root {
  --palette-slate-50: oklch(0.98 0.003 250);
  --palette-slate-900: oklch(0.21 0.02 250);
  --palette-blue-600: oklch(0.55 0.19 258);
  --palette-blue-400: oklch(0.72 0.15 258);
}

/* 2. Semantics. The real tokens - framework-agnostic, mode-swappable.
      These live outside @theme precisely because @theme cannot be nested
      under a selector or a media query. */
:root {
  --app-canvas: var(--palette-slate-50);
  --app-ink: var(--palette-slate-900);
  --app-action: var(--palette-blue-600);
}

[data-theme="dark"] {
  --app-canvas: var(--palette-slate-900);
  --app-ink: var(--palette-slate-50);
  --app-action: var(--palette-blue-400);
}

/* 3. Projection. The framework consumes the tokens; it does not define them.
      `inline` resolves the value into the generated utilities directly. */
@theme inline {
  --color-canvas: var(--app-canvas);
  --color-ink: var(--app-ink);
  --color-action: var(--app-action);
}
```

**Why good:** the token set stays readable by anything that can resolve `var()`, the mode swap is a scope reassignment with no rebuild, and `@theme inline` is what makes the generated `bg-canvas` utility follow that reassignment. Every value is typed exactly once, in the semantic block.

---

### Bad Example - Omitting `inline`

```css
@import "tailwindcss";

:root {
  --app-canvas: oklch(0.98 0.003 250);
}

[data-theme="dark"] {
  --app-canvas: oklch(0.21 0.02 250);
}

/* BAD: without `inline`, the theme variable emits a reference that the
   generated utility resolves at the wrong scope. The dark value never
   applies, and nothing errors. */
@theme {
  --color-canvas: var(--app-canvas);
}
```

**Why bad:** the generated utility carries a chained variable reference that is resolved where the theme variable was declared rather than where the utility is used, so the `[data-theme="dark"]` reassignment is invisible to it -- the page silently stays in light mode with no build warning and no console message.

---

### Bad Example - Nesting `@theme`

```css
@import "tailwindcss";

/* BAD: @theme is top-level only. Nested under a selector or a media query it
   is not a valid theme block. */
[data-theme="dark"] {
  @theme {
    --color-canvas: oklch(0.21 0.02 250);
  }
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-canvas: oklch(0.21 0.02 250);
  }
}
```

**Why bad:** the placement restriction is the whole reason the bridge exists -- theme variables generate utilities at build time, so they cannot be conditional on a runtime selector. Mode-conditional values belong in the semantic layer; only the mode-independent alias goes in `@theme`.

---

### Bad Example - Duplicated Source of Truth

```css
@import "tailwindcss";

:root {
  --app-canvas: oklch(0.98 0.003 250);
}

/* BAD: the value is typed a second time. The two copies are now free to drift,
   and nothing fails when they do. */
@theme {
  --color-canvas: oklch(0.98 0.003 250);
}
```

**Why bad:** two declarations of the same decision means the next edit lands in one of them, and the resulting mismatch shows up as a subtle colour difference between utility-styled and token-styled elements -- a class of bug that no type checker or build step catches.

---

### Bad Example - Channel Triplets as Token Values

```css
@import "tailwindcss";

:root {
  /* BAD: not a color. A bare triplet only works when something wraps it. */
  --app-canvas: 0 0% 100%;
}

@theme inline {
  --color-canvas: var(--app-canvas);
}

/* `bg-canvas/50` compiles to:
   color-mix(in oklab, var(--color-canvas) 50%, transparent)
   which receives "0 0% 100%" where a color is required -> invalid -> dropped. */
```

**Why bad:** opacity modifiers compile to `color-mix()` against the raw token value, so a triplet produces invalid CSS and the declaration is discarded rather than erroring. The element renders with no background at all, and the failure only appears on the utilities that use a modifier.

### The Fix

```css
:root {
  /* Complete color values. Works with color-mix(), oklch() interpolation,
     relative color syntax, and every opacity modifier. */
  --app-canvas: oklch(1 0 0);
}

@theme inline {
  --color-canvas: var(--app-canvas);
}
```

**Why good:** the token is a color in every context that consumes it, so the framework's opacity math, any `color-mix()` in hand-written CSS, and direct `var()` reads all behave identically.

---

### Good Example - Projecting Only What Needs a Utility

```css
@import "tailwindcss";

:root {
  --app-canvas: oklch(0.98 0.003 250);
  --app-action: oklch(0.55 0.19 258);
  /* No utility should exist for these - they are internal plumbing */
  --app-focus-ring-width: 2px;
  --app-transition-interaction: 150ms ease-out;
}

/* Only tokens that should become utility classes go in @theme */
@theme inline {
  --color-canvas: var(--app-canvas);
  --color-action: var(--app-action);
}

.control:focus-visible {
  /* Plumbing tokens are read directly - no utility, no theme entry */
  outline: var(--app-focus-ring-width) solid var(--app-action);
  transition: outline-color var(--app-transition-interaction);
}
```

**Why good:** the rule of thumb -- `@theme` only when a token should map to a utility class, `:root` for everything else -- keeps the generated utility surface to things anyone would actually write in markup, instead of emitting classes nobody will ever use.

---

### Good Example - Replacing a Namespace Rather Than Extending It

```css
@import "tailwindcss";

@theme {
  /* Drop the framework's default palette so only project tokens generate
     colour utilities. Prevents `bg-red-500` from silently working and
     bypassing the token set. */
  --color-*: initial;
}

@theme inline {
  --color-canvas: var(--app-canvas);
  --color-ink: var(--app-ink);
  --color-action: var(--app-action);
}
```

**Why good:** a default palette left in place is an untracked parallel token set -- every default colour utility is a value that bypasses the semantic tier. Resetting the namespace makes the token set the only source of colour, so a tier leak becomes a build-time missing class rather than a silently plausible colour.

**When not to use:** during an incremental migration, where removing the defaults breaks existing markup faster than it can be converted. Reset the namespace once the last default-palette utility is gone.
