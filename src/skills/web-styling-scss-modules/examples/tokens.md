# SCSS Modules - Reading Design Tokens

> How a module consumes design tokens, and when a module declares a custom property of its own. Which tokens exist and how they are tiered is settled by whatever owns the token layer; this file covers the consuming side only. See [core.md](core.md) for the layer setup and [SKILL.md](../SKILL.md) for decision guidance.

---

## Reading Tokens

A module reads tokens through `var()` and defines none of them. That is the whole of the contract: the stylesheet names what a value is _for_, and the token layer decides what it currently _is_.

```scss
// Good Example
@layer components {
  .button {
    padding: var(--space-md);
    font-size: var(--font-size-body);
    border-radius: var(--radius-sm);
    color: var(--color-text-default);
    background: var(--color-background-surface);
  }

  .container {
    gap: var(--space-lg);
  }

  .section {
    margin-bottom: var(--space-xlg);
  }
}
```

**Why good:** a spacing change, a type-scale change and a theme swap all land in the token layer, and this file follows without being edited.

```scss
// Bad Example
.button {
  // BAD: hard-coded values, unreachable by any token change
  padding: 8px;
  margin: 12px;
  font-size: 16px;
}

.heading {
  // BAD: reaching past the semantic names into the raw scale. The value is
  // correct today and stops tracking the moment the scale is regenerated.
  font-size: var(--core-text-size-3);
  color: var(--color-gray-900);
}
```

**Why bad:** the literals never move, and the raw-scale reads move for the wrong reasons — a palette regeneration changes what `--color-gray-900` means without anyone deciding that this heading should change.

---

## Component-Scoped Custom Properties

Declare a custom property inside a module when a value has to vary _within_ the component. Declared on the component's own class, it inherits into that subtree and reaches nothing else.

```scss
// Good Example
@layer components {
  .button {
    // Scoped to .button: the variant classes below reassign it
    --button-accent-bg: transparent;
    --button-border-width: 1px;

    border: var(--button-border-width) solid transparent;
    background: var(--button-accent-bg);
    padding: var(--space-md);
  }

  .outline {
    --button-border-width: 2px;

    box-shadow: 0 0 0 var(--button-border-width) var(--color-border-default);

    &:hover,
    &[data-state="open"] {
      --button-accent-bg: var(--color-background-muted);
    }
  }
}
```

**Why good:** the variant classes change one declaration each rather than restating the whole rule, and the property cannot leak to another component because it is declared on a scoped class.

```scss
// Bad Example
@layer components {
  .card {
    // BAD: a second name for a value that already has one. The two are now
    // free to disagree, and only one of them follows the token layer.
    --card-border-radius: 0.5rem;
    // BAD: used exactly once, and never reassigned. A hop with nothing on
    // the other end.
    --card-border-width: 1px;

    border: var(--card-border-width) solid var(--color-border-default);
    border-radius: var(--card-border-radius);
  }
}

// BAD: a component-scoped property declared globally. It reaches every element
// on the page and collides with the next component that wants the name.
:root {
  --card-padding: 1rem;
}
```

**Why bad:** the duplicate radius stops tracking the design system, the single-use property is indirection earning nothing, and the global declaration has thrown away the scoping the module exists to provide.

---

Which form a given value should take — token layer custom property, component-scoped custom property, Sass variable, or a plain declaration — is tabulated in [reference.md](../reference.md#where-a-value-lives).
