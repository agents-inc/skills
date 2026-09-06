# SCSS Modules - Structure and Reuse

> Module file structure, data-attribute state, mixins, global style organisation, and icon sizing. See [SKILL.md](../SKILL.md) for decision guidance and [core.md](core.md) for the layer setup.

---

## Module File Structure

One base class, then variant classes, then size classes — all inside the layer.

```scss
// Good Example
// button.module.scss
@layer components {
  .button {
    // Component-scoped, because the variants below reassign them
    --button-accent-bg: transparent;
    --button-border-width: 1px;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;

    border-radius: var(--radius-sm);
    font-size: var(--font-size-body);
    color: var(--color-text-default);

    &:disabled {
      pointer-events: none;
      opacity: 0.5;
    }

    &:focus-visible {
      border-color: var(--color-ring);
    }

    &[aria-invalid="true"] {
      border-color: var(--color-destructive);
    }
  }

  .default {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);

    &:hover {
      background-color: var(--color-primary-hover);
    }
  }

  .destructive {
    background-color: var(--color-destructive);
    color: var(--color-destructive-foreground);

    &:hover {
      background-color: var(--color-destructive-hover);
    }
  }

  .ghost {
    background-color: transparent;

    &:hover {
      background-color: var(--color-background-muted);
    }
  }

  .outline {
    --button-border-width: 2px;

    border: var(--button-border-width) solid var(--color-border-default);
    background-color: var(--color-background-base);

    &:hover,
    &[data-state="open"] {
      background-color: var(--button-accent-bg);
      --button-accent-bg: var(--color-background-muted);
    }
  }

  .sizeSm {
    padding: var(--space-sm) var(--space-md);
  }

  .sizeDefault {
    padding: var(--space-md) var(--space-lg);
  }

  .sizeLg {
    padding: var(--space-lg) var(--space-xlg);
  }

  .sizeIcon {
    padding: var(--space-md);
    aspect-ratio: 1;
  }
}
```

**Why good:** one structure repeated across every component means a reader knows where to look; the disabled and focus rules live on the base so no variant can forget them; and the size classes vary only padding, so any size composes with any variant.

```scss
// Bad Example
// BAD: no layer wrapper, so precedence depends on bundler ordering
.button {
  display: inline-flex;
}

// BAD: a second name for a value that already has one
.card {
  --card-border-radius: 0.5rem; // there is already a --radius-sm
  border-radius: var(--card-border-radius);
}

// BAD: names describing the current appearance rather than the role
.blueButton {
  background: var(--color-primary);
}

.bigText {
  font-size: var(--font-size-heading);
}
```

**Why bad:** the missing wrapper reintroduces load-order dependence, the duplicate property stops tracking the design system, and the appearance-based names become wrong the moment the design changes — with every usage site to update.

---

## Data-Attributes for State

```scss
// Good Example
.dropdown {
  &[data-open="true"] {
    display: block;
  }

  &[data-state="error"] {
    border-color: var(--color-destructive);
  }

  // States combine without a class per combination
  &[data-size="large"][data-variant="primary"] {
    padding: var(--space-xlg);
  }
}

.button {
  &[data-active="true"] {
    color: var(--color-accent);
  }

  &[aria-invalid="true"] {
    border-color: var(--color-destructive);
  }
}
```

**Why good:** every state of the component is in the component's stylesheet, the combinations fall out of selector syntax rather than needing a name each, and the DOM inspector shows what the component believes its state to be.

```scss
// Bad Example
.dropdownOpen {
  display: block;
}

.dropdownClosed {
  display: none;
}
```

**Why bad:** two states need two exported classes and something outside the stylesheet to choose between them; four states across two dimensions need eight, and the combinations have to be enumerated by hand.

---

## Mixins for Repeated Declaration Blocks

```scss
// styles/_mixins.scss
@mixin focus-ring {
  &:focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
  }
}

@mixin disabled-state {
  &:disabled {
    pointer-events: none;
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@mixin truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@mixin sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border-width: 0;
}
```

```scss
// Usage
@use "../../styles/mixins" as m;

@layer components {
  .button {
    @include m.focus-ring;
    @include m.disabled-state;
  }
}
```

**Why good:** the accessibility blocks are the ones where a partial copy is a real defect — a focus ring missing its offset, an `sr-only` missing its clip — so centralising them removes the chance of writing seven-eighths of one.

**Extract at the third user, not the first.** A mixin with one call site is a block of declarations plus a hop.

---

## Global Styles Organisation

Everything genuinely global sits outside the modules, in one directory with a fixed load order.

```
styles/
  layers.scss          # layer declarations - loaded first
  reset.scss           # inside @layer reset
  design-tokens.scss   # unlayered custom properties
  mixins.scss          # Sass members, emits nothing on its own
  utility-classes.scss # the few classes worth having globally
```

```scss
// styles/global.scss
// @use rules come before any other rule, except @forward and @charset
@use "layers"; // declares the order the rest depend on
@use "reset"; // writes into @layer reset
@use "design-tokens"; // unlayered custom properties
@use "utility-classes";
```

**Why this order:** the layer declaration has to be evaluated before anything that writes into a layer, and the token declarations have to precede nothing in particular — a custom property is resolved where it is _used_, not where it is declared.

```scss
// styles/utility-classes.scss
@use "mixins" as m;

.sr-only {
  @include m.sr-only;
}

.truncate {
  @include m.truncate;
}
```

**Why good:** a mixin serves Sass and a class serves markup, so the handful of blocks needed in both places are written once and exposed twice — rather than a class and a mixin drifting apart.

---

## Icon Sizing and Colour

```scss
// Good Example
.icon {
  width: var(--font-size-icon);
  height: var(--font-size-icon);
  // No colour declaration: an icon drawn with currentColor follows its parent
}

.button {
  color: var(--color-text-default);

  &:hover {
    color: var(--color-accent); // the icon follows
  }
}
```

**Why good:** one colour declaration covers the label and the icon, so they cannot disagree, and a hover state needs one line rather than two that must be kept in step.

```scss
// Bad Example
.icon {
  // BAD: a fixed size that no type-scale change reaches
  width: 16px;
  height: 16px;

  // BAD: an explicit colour, which now has to be restated for every state
  // of every parent that contains an icon
  color: var(--color-text-default);
}

.button .icon {
  color: var(--color-primary);
}
```

**Why bad:** the explicit colour breaks inheritance, so every parent state needs a matching icon rule — and the pair goes out of sync the first time only one of them is updated.
