# SCSS Modules - Theme-Agnostic Styles

> Keeping a module free of theme branching, so it adapts to any number of themes without being edited. How a theme is chosen, persisted and applied at runtime is settled elsewhere; this file covers what the stylesheet has to do — and not do — for that to work. See [core.md](core.md) for the layer setup.

---

## The Module Carries No Theme Logic

```scss
// Good Example - a component that works in every theme
@layer components {
  .button {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);

    &:hover {
      background-color: var(--color-primary-hover);
    }
  }
}
```

**Why good:** there is no theme to be aware of. The names say what the values are for, whatever they currently are, so a second theme is a set of token reassignments elsewhere and zero edits here.

```scss
// Bad Example - the theme reaches into the component
.button {
  background: var(--color-primary);

  // BAD: the module now knows how themes are implemented, and a third theme
  // needs a third branch here and in every other component with one.
  .dark & {
    background: var(--color-dark-primary);
  }

  // BAD: a token named for a mode. It can only be correct in one.
  &:hover {
    background: var(--color-dark-primary-hover);
  }
}
```

**Why bad:** the branch couples one stylesheet to one theme mechanism, and the mode-named token means the light value has to live under a second name — so every consumer needs a conditional and the token count multiplies by the number of themes.

---

## Organising Overrides as a Mixin

Where the override block is long, a mixin keeps it in one place and keeps the selector that applies it to a single line. The mixin belongs with the other shared Sass, not inside a component module.

```scss
// styles/_mixins.scss
@mixin dark-theme {
  --color-background-base: var(--color-gray-900);
  --color-background-muted: var(--color-gray-800);
  --color-text-default: var(--color-gray-200);
  --color-primary: var(--color-gray-50);
  --color-primary-foreground: var(--color-gray-950);
  --color-primary-hover: color-mix(in srgb, var(--color-primary), white 5%);
}
```

```scss
// styles/_design-tokens.scss
@use "mixins" as m;

.dark {
  @include m.dark-theme;
}
```

**Why good:** the selector that switches themes appears once, the override list is editable without scrolling past a selector, and the same mixin can be applied to a second selector — a media query, a preview container — without repeating it.

**Reassign the named-by-role tokens only.** An override that reaches the raw scale (`--color-gray-900: …`) makes the scale mean different things in different subtrees, and anything that legitimately needs the real grey loses its reference.

---

## `:global()` Is Not a Theme Mechanism

```scss
// Acceptable, and rarely the right answer
.component {
  padding: var(--space-md);

  // Reaching a class this module does not own, applied by something outside it
  :global(.dark) & {
    background: var(--color-background-muted);
  }
}
```

**Why to avoid it:** it works, and it is the branch above wearing different syntax — the module still knows the theme's class name, and the styles still fork per theme. Reach for it only where a token cannot express the difference, such as swapping an entire layout in a high-contrast mode.
