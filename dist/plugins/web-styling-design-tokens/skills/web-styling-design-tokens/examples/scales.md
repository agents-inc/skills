# Design Tokens - Scale Examples

> Extended examples for spacing and type scales as generated series, and density as a multiplier. See [core.md](core.md) for the tier structure these scales live inside.

**Prerequisites**: Understand [Pattern 1: Token Tiers](core.md#pattern-1-token-tiers-and-the-one-way-graph) first -- scales are a primitive-tier concern, density is a semantic-tier one.

---

## Pattern 6: Scales as Generated Series

A scale is a series with a generator, not a set of independently chosen values. Expressing the generator makes every step derivable and makes it impossible for one step to be individually wrong.

### Good Example - Spacing from a Base Unit

```css
:root {
  /* The generator. Every step below is derived from it. */
  --space-base: 0.25rem;

  --space-1: calc(var(--space-base) * 1); /* 0.25rem */
  --space-2: calc(var(--space-base) * 2); /* 0.5rem  */
  --space-3: calc(var(--space-base) * 3); /* 0.75rem */
  --space-4: calc(var(--space-base) * 4); /* 1rem    */
  --space-6: calc(var(--space-base) * 6); /* 1.5rem  */
  --space-8: calc(var(--space-base) * 8); /* 2rem    */
  --space-12: calc(var(--space-base) * 12); /* 3rem  */
}
```

**Why good:** rebasing the whole system is a one-line change, the multiplier in each name is checkable at a glance, and a mistyped step is visible as a broken sequence rather than as a plausible-looking number.

---

### Bad Example - A Hand-Listed Scale

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.4rem; /* wrong - should be 1.5rem, and nothing says so */
  --space-8: 2rem;
}
```

**Why bad:** each value is independently typed, so the sequence carries no constraint that would catch the bad step -- `1.4rem` looks entirely reasonable in isolation and only shows up as a barely-off gap somewhere on a page. Rebasing means recomputing every line by hand.

---

### Good Example - A Modular Type Scale

```css
:root {
  --font-size-base: 1rem;
  --font-scale-ratio: 1.25; /* major third */

  --font-size-sm: calc(var(--font-size-base) / var(--font-scale-ratio));
  --font-size-md: var(--font-size-base);
  --font-size-lg: calc(var(--font-size-base) * var(--font-scale-ratio));
  --font-size-xl: calc(var(--font-size-lg) * var(--font-scale-ratio));
  --font-size-2xl: calc(var(--font-size-xl) * var(--font-scale-ratio));
}
```

**Why good:** the ratio is a single tunable that changes the character of the whole scale, and each step is anchored to the one below it so the progression cannot drift.

**Gotcha:** each step here adds a `calc()` hop, so `--font-size-2xl` resolves through three of them. That is still readable; a chain much deeper becomes genuinely hard to debug because a unit error anywhere in it surfaces as a silently dropped declaration at the consumer with no indication of which link broke. Past about three levels, resolve the values in the build pipeline and emit literals for the primitive tier.

---

### Good Example - Fluid Steps Derived from the Scale

```css
:root {
  --font-size-lg: calc(var(--font-size-base) * var(--font-scale-ratio));
  --font-size-xl: calc(var(--font-size-lg) * var(--font-scale-ratio));

  /* Both bounds come from the scale - neither is hand-picked */
  --font-size-display: clamp(
    var(--font-size-lg),
    calc(var(--font-size-lg) + 2vw),
    var(--font-size-xl)
  );
}
```

**Why good:** the fluid range is bounded by real scale steps, so a fluid heading can never land outside the type system. Hand-picked `clamp()` bounds are two more untracked literals that drift away from the scale the first time the ratio changes.

---

### Good Example - Density as a Multiplier

```css
:root {
  --space-base: 0.25rem;
  --space-4: calc(var(--space-base) * 4);
  --space-6: calc(var(--space-base) * 6);

  /* One token controls density for the entire system */
  --density-scale: 1;
}

[data-density="compact"] {
  --density-scale: 0.75;
}

[data-density="comfortable"] {
  --density-scale: 1.25;
}

/* The multiplier applies where primitives become semantics, so every
   component token downstream inherits density for free. */
:root {
  --space-inline-md: calc(var(--space-4) * var(--density-scale));
  --space-block-md: calc(var(--space-6) * var(--density-scale));
}

.card {
  --card-padding: var(--space-inline-md); /* density-aware, no extra work */
  padding: var(--card-padding);
}
```

**Why good:** density is one number rather than a parallel scale, applying it at the primitive-to-semantic boundary means no component ever mentions density, and it composes with a mode swap because the two scopes reassign different tokens.

---

### Bad Example - Density as a Second Scale

```css
:root {
  --space-inline-md: 1rem;
  /* BAD: a parallel set that must be kept in step with the first by hand */
  --space-inline-md-compact: 0.75rem;
  --space-inline-md-comfortable: 1.25rem;
}

.card {
  /* BAD: every component now needs a density-aware selector, and a third
     density level means a third branch in every one of them */
  padding: var(--space-inline-md);
}

[data-density="compact"] .card {
  padding: var(--space-inline-md-compact);
}
```

**Why bad:** the token count multiplies by the number of density levels, the parallel sets drift the moment one is updated alone, and every component acquires a density branch -- exactly the failure mode of putting a mode in the name, applied to density instead.

---

### Bad Example - Applying Density at the Primitive Tier

```css
:root {
  --density-scale: 0.75;
  /* BAD: the primitive is no longer a fixed value, so "space-4" means
     different things depending on the active density */
  --space-4: calc(var(--space-base) * 4 * var(--density-scale));
}
```

**Why bad:** the primitive tier stops being a stable reference, so nothing in the system can express "4 base units" any more. Anything that legitimately must not scale with density -- a hairline border, an icon's optical alignment, a fixed-size control -- loses its only escape hatch. Apply the multiplier where primitives become semantics, and leave the primitives fixed.

---

### Good Example - Opting a Token Out of Density

```css
:root {
  --density-scale: 1;

  /* Density-aware: layout rhythm should breathe with the setting */
  --space-inline-md: calc(var(--space-4) * var(--density-scale));

  /* Deliberately fixed: an icon's optical size and a hairline border are
     not layout rhythm and should not shrink with density. Reading the
     primitive directly here is the documented exception, not a leak. */
  --size-icon-md: var(--space-4);
  --border-width-hairline: 1px;
}
```

**Why good:** the opt-out is explicit and sits beside the tokens that do scale, so the difference reads as a decision rather than an oversight. This is the one case where a semantic token aliasing a primitive without a multiplier is correct -- and a comment is what distinguishes it from a mistake.
