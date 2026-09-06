# SCSS Modules - Escaping and Nesting

> `:has()`, `:global()`, and how deep to nest. See [SKILL.md](../SKILL.md) for decision guidance and [core.md](core.md) for the layer setup.

---

## `:has()` — Styling a Parent from Its Children

```scss
// Good Example
.form:has(.inputError) {
  border-color: var(--color-destructive);
}

.formGroup:has(input:focus) {
  background: var(--color-background-muted);
}

.card:has(> img) {
  padding-block-start: 0;
}
```

**Why good:** the relationship is expressed where the styles are, so no component has to observe its own children and set a class to describe them. The rule stays correct when the children change, because it asks about them rather than being told.

---

## `:global()` — Leaving the Scope Deliberately

Class names in a module are rewritten at build time, so a module cannot name a class it does not own. `:global()` is the opt-out.

```scss
// Good Example - reaching a class applied by something outside this module
.component {
  padding: var(--space-md);

  :global(.third-party-widget) & {
    padding: 0;
  }
}
```

**Why good:** the escape is one selector wide, and the surrounding class is still scoped — so the exception is visible rather than being a whole file quietly opted out.

```scss
// Bad Example
.component {
  :global {
    .everything {
      .is {
        .global {
          // every name in here is now globally reachable
        }
      }
    }
  }
}
```

**Why bad:** a `:global` block containing a tree of selectors gives back exactly the collisions the module system exists to prevent, and does it somewhere nobody reading the markup will look.

---

## Nesting Depth

```scss
// Good Example - modifiers beside what they modify, about three levels
.nav {
  display: flex;

  .navItem {
    &:hover {
      background: var(--color-background-muted);
    }
  }
}
```

```scss
// Bad Example
.nav .navList .navItem .navLink .navIcon {
  color: var(--color-primary);
}
```

**Why bad:** five levels of specificity have to be beaten by anything that wants to override the icon colour, and the generated selector no longer resembles the one class name that appears in the markup — so a search for `navIcon` does not find the rule that styles it.

**Rules of thumb:** nest to attach a state or a modifier to the thing above it, and stop at about three levels. A descendant chain that exists only to describe the DOM is specificity paid for nothing — the innermost class alone usually selects the same elements.

---

## Where a Class Ends and an Attribute Begins

```scss
// Variants are classes: they are alternatives, and exactly one applies
.btnDefault {
  background: var(--color-background-surface);
}

.btnGhost {
  background: transparent;
}

// States are attributes: they are independent, and several apply at once
.button {
  &[data-loading="true"] {
    pointer-events: none;
  }

  &[data-active="true"] {
    color: var(--color-accent);
  }
}
```

**Why this split:** a variant is a choice between mutually exclusive appearances, which a class expresses exactly. A state is a fact about the component right now, and several are true simultaneously — so an attribute per state combines without a name per combination.
