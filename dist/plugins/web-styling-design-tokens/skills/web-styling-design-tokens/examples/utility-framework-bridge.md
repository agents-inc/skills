# Design Tokens - Projecting into a Generated-Class Layer

> Extended examples for feeding a token set into something that generates utility classes from a theme surface. See [core.md](core.md) for the tier and delivery patterns this builds on.

**Prerequisites**: Understand [Pattern 1: Token Tiers](core.md#pattern-1-token-tiers-and-the-one-way-graph) and [Pattern 3: CSS Custom Properties as Delivery](core.md#pattern-3-css-custom-properties-as-delivery) first.

The theme surface is a **projection** of the token set — one alias per token that should become a class — and never a second place a value is typed. The enclosing syntax belongs to whatever does the generating; every decision below holds regardless of which one it is.

---

## Pattern 4: The Projection

### Good Example - The Mode-Swappable Projection

```css
/* 1. Primitives. Literal values, never reassigned. */
:root {
  --palette-slate-50: oklch(0.98 0.003 250);
  --palette-slate-900: oklch(0.21 0.02 250);
  --palette-blue-600: oklch(0.55 0.19 258);
  --palette-blue-400: oklch(0.72 0.15 258);
}

/* 2. Semantics. The real tokens, and the only tier a mode reassigns.
      These live outside the theme surface: a generated class is produced at
      build time, so it cannot itself be conditional on a runtime scope. */
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
```

```
/* 3. Projection, inside the generator's own theme surface.
      Every entry is an alias; no value appears here for the first time. */

   --color-canvas: var(--app-canvas);
   --color-ink:    var(--app-ink);
   --color-action: var(--app-action);
```

**Why good:** every value is typed exactly once, in the semantic block; a mode swap is a scope reassignment with no rebuild; and anything that resolves `var()` reads the same tokens without going through the generated classes at all.

**The mechanic to check in the generator's own documentation:** whether an aliased theme entry is resolved _into_ each class it emits, or emitted as a chained reference resolved where the theme entry was declared. Only the first follows a runtime scope reassignment. The second leaves the dark values unreachable, with no build warning and nothing in the console — which is exactly why the mode-conditional values belong in the semantic tier and only the mode-independent alias goes in the theme surface.

---

### Bad Example - Duplicated Source of Truth

```
/* :root */
   --app-canvas: oklch(0.98 0.003 250);

/* the theme surface — BAD: the value is typed a second time. The two copies
   are free to drift, and nothing fails when they do. */
   --color-canvas: oklch(0.98 0.003 250);
```

**Why bad:** the next edit lands in one of them, and the mismatch shows up as a subtle colour difference between class-styled and token-styled elements — a class of bug no type checker or build step catches.

---

### Bad Example - Mode Values in the Theme Surface

```
/* BAD: a theme surface is read once, at build time. Wrapping it in a runtime
   selector or a media query does not make the classes it generates
   conditional — it makes the block invalid or ineffective. */

   [data-theme="dark"] { <theme surface> { --color-canvas: oklch(0.21 …); } }
```

**Why bad:** the placement restriction is the whole reason the projection pattern exists. Classes are emitted at build time, so a mode-conditional value cannot live where they are declared. Mode belongs in the semantic tier, which the cascade re-evaluates at runtime.

---

### Bad Example - Channel Triplets in a Projected Token

```css
:root {
  /* BAD: not a colour. A bare triplet only works when something wraps it. */
  --app-canvas: 0 0% 100%;
}

/* An opacity modifier on a generated class typically compiles to
   color-mix(in oklab, var(--color-canvas) 50%, transparent)
   which receives "0 0% 100%" where a colour is required -> invalid -> dropped. */
```

**Why bad:** the modifier resolves against the raw token value, so a triplet produces invalid CSS that is discarded rather than reported. The element renders with no background at all, and only the classes carrying a modifier are affected — so the failure looks intermittent.

### The Fix

```css
:root {
  /* A complete colour works with color-mix(), oklch() interpolation,
     relative colour syntax, and every opacity modifier. */
  --app-canvas: oklch(1 0 0);
}
```

**Why good:** the token is a colour in every context that consumes it, so the generator's opacity maths, any `color-mix()` in hand-written CSS, and a direct `var()` read all behave identically.

---

### Good Example - Projecting Only What Needs a Class

```css
:root {
  --app-canvas: oklch(0.98 0.003 250);
  --app-action: oklch(0.55 0.19 258);
  /* Internal plumbing - no class should exist for these */
  --app-focus-ring-width: 2px;
  --app-transition-interaction: 150ms ease-out;
}

.control:focus-visible {
  /* Plumbing tokens are read directly - no class, no theme entry */
  outline: var(--app-focus-ring-width) solid var(--app-action);
  transition: outline-color var(--app-transition-interaction);
}
```

**Why good:** only `--app-canvas` and `--app-action` are worth a class, so only those are projected. The rule of thumb — project a token when it should map to a class, leave everything else in `:root` — keeps the generated surface to what anyone would actually write in markup, instead of emitting classes nobody will use.

---

### Replace the Generator's Default Palette Rather Than Extending It

Most generators ship a default palette and offer a way to clear a namespace before your own tokens are defined. Clearing it is the right default: a palette left in place is an untracked parallel token set, and every default colour class is a value that bypasses the semantic tier. Reset it and a tier leak becomes a build-time missing class rather than a plausible-looking colour.

**When not to:** during an incremental migration, where removing the defaults breaks existing markup faster than it can be converted. Reset the namespace once the last default-palette class is gone.
