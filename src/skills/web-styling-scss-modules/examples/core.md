# SCSS Modules Core Examples

> Local scoping, cascade layer setup, layered component styles, and unlayered application overrides. See [SKILL.md](../SKILL.md) for decision guidance and [reference.md](../reference.md) for anti-patterns with fixes.

**For additional patterns**: see the topic files in this folder:

- [modules.md](modules.md) - `@use`, `@forward`, built-in modules, migrating off `@import`
- [tokens.md](tokens.md) - reading tokens from module styles, component-scoped custom properties
- [theming.md](theming.md) - keeping a module free of theme branching
- [patterns.md](patterns.md) - module file structure, data-attributes, mixins, global styles, icons
- [advanced.md](advanced.md) - `:has()`, `:global()`, nesting depth

---

## Local Scoping: From a Stylesheet to a `styles` Object

The `.module.` in the filename is what turns the file into a module. Every class it declares is rewritten to a name that is unique across the whole build, and the file's default export is the map from what you wrote to what was emitted.

### The Two Halves

```scss
// button.module.scss
@layer components {
  .button {
    padding: var(--space-md);
    border-radius: var(--radius-sm);
  }

  .sizeSm {
    padding: var(--space-sm);
  }

  .isLoading {
    pointer-events: none;
    opacity: 0.5;
  }
}
```

```tsx
// button.tsx
import styles from "./button.module.scss";

// The import is an object: { button: "…", sizeSm: "…", isLoading: "…" }
function Button({ small, loading, children }: ButtonProps) {
  const classNames = [
    styles.button,
    small && styles.sizeSm,
    loading && styles.isLoading,
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classNames}>{children}</button>;
}
```

```css
/* What the browser actually receives — the shape of the generated name is a
   build setting, so nothing may depend on it beyond "it is unique". */
@layer components {
  .button-module__button--x7f2q {
    padding: var(--space-md);
    border-radius: var(--radius-sm);
  }
}
```

**Why good:** the stylesheet gets short, obvious names because uniqueness is the build's problem rather than a naming convention's, two components can both declare `.button` without colliding, and deleting the component deletes its styles — nothing else could have referenced them.

### Bad Example - Writing the Name Instead of Reading It

```tsx
// BAD: the literal name is not the name in the CSS. This matches no rule,
// nothing errors, and the element renders unstyled.
<button className="button" />;

// BAD: for a class authored as `.size-sm`, this parses as `styles.size - sm`
// — a subtraction, not a lookup. Use styles["size-sm"].
<button className={styles.size - sm} />;
```

**Why bad:** the first failure is silent — an unstyled element carrying a class name that looks entirely correct in the inspector. The second is not a lookup at all: the dash is an operator, so the expression either throws on the undefined identifier or produces `NaN`, and neither outcome mentions the class.

### Class Names Are Keys Exactly As Authored

The object's keys are the names in the stylesheet, so a dashed or snake-cased class needs bracket access:

```tsx
import styles from "./button.module.scss";

styles["size-sm"]; // a class authored as .size-sm
styles.sizeSm; // a class authored as .sizeSm
```

Some build setups add camelCase aliases for dashed names; relying on that ties the component to one build configuration. Authoring the class names in camelCase in the first place is why every stylesheet in this skill reads `.sizeSm` and `.btnDefault` rather than `.size-sm` and `.btn-default`.

### What Stays Global

Class names are what the transform rewrites. Element selectors, custom property names and anything inside `:global()` come through unchanged — which is why the reset, the layer declaration and the design tokens live outside the modules entirely.

```scss
// button.module.scss
.button {
  // A token read: --space-md is global, and is meant to be
  padding: var(--space-md);

  // A local class name, rewritten
  &.sizeSm {
    padding: var(--space-sm);
  }
}
```

---

## Cascade Layers for Predictable Precedence

### Layer Declaration

The order is established by this one statement, and it applies wherever the layers are later written. Load it before anything it names.

```scss
// styles/layers.scss
@layer reset, components;
```

Everything unlayered ranks above both, which is what makes an application override work without a specificity hack.

### Reset Layer

```scss
// styles/reset.scss
@layer reset {
  * {
    margin: unset;
    padding: unset;
    border: unset;
    background: unset;
  }

  html {
    box-sizing: border-box;
  }

  button {
    all: unset;
  }
}
```

**Why good:** a reset is the one thing every rule should beat, so it goes in the lowest layer rather than being fought with specificity at each call site.

### Component Layer

```scss
// Good Example - a library component
// button.module.scss
@layer components {
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);

    &:hover {
      background-color: var(--color-primary-hover);
    }
  }

  .destructive {
    background-color: var(--color-destructive);
    color: var(--color-destructive-foreground);
  }
}
```

**Why good:** the layer wrapper makes precedence a property of the file rather than of the bundler's ordering, so a consumer can override any of it without knowing how the stylesheets were concatenated.

### Application Override

```scss
// Good Example - an application stylesheet
// No @layer wrapper: unlayered outranks every layer.
.myCustomButton {
  background-color: var(--color-accent);
  padding: var(--space-12);
}
```

**Why good:** the override needs no `!important`, no extra selector and no assumption about load order — only the absence of a layer.

### Bad Example - The Wrapper on the Wrong Side

```scss
// BAD: a library component with no layer. Precedence now depends on which
// stylesheet the bundler emitted first.
.button {
  background: var(--color-primary);
}

// BAD: an application override inside the component layer. It sits at library
// priority, so overriding the library needs a specificity contest after all.
@layer components {
  .myCustomButton {
    background-color: var(--color-accent);
  }
}
```

**Why bad:** each half defeats the mechanism from one end. The unlayered library rule cannot be overridden predictably, and the layered application rule has given up the rank it needed.

---

## Component Styles That Survive a Theme Change

```scss
// Good Example
@layer components {
  .btn {
    font-size: var(--font-size-body);
    padding: var(--space-md);
    border-radius: var(--radius-sm);
  }

  .btnDefault {
    background-color: var(--color-background-surface);
    color: var(--color-text-default);
  }

  .btnSizeLarge {
    padding: var(--space-lg) var(--space-xlg);
  }
}
```

**Why good:** every value is a token read, so a theme swap or a rebrand reaches this file without editing it, and each name says what the rule is for rather than what it currently looks like.

```scss
// Bad Example
.btn {
  // BAD: hard-coded values. Nothing reaches them - not a theme, not a rebrand,
  // not an audit.
  font-size: 16px;
  border-radius: 4px;
  padding: 8px;

  // BAD: a raw colour, so the dark theme has nothing to reassign
  background: #0f172a;
}

// BAD: a name that describes the current appearance
.blueButton {
  background: var(--color-primary);
}
```

**Why bad:** the literals are invisible to every mechanism the system has, and `.blueButton` becomes a lie the first time the brand colour moves — with the markup that references it spread across the codebase.
