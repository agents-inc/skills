# SCSS Modules Reference

> Comparison tables, anti-patterns with their fixes, and deprecation notes. Decision guidance and red flags are in [SKILL.md](SKILL.md).

---

## `@use` versus `@import`

| Feature            | `@import` (deprecated)     | `@use`                       |
| ------------------ | -------------------------- | ---------------------------- |
| Scope              | Global; pollutes namespace | Namespaced and explicit      |
| Loading            | Re-evaluated per import    | Once per compilation         |
| Private members    | Not supported              | `_` or `-` prefix is private |
| Configuration      | Implicit, via global vars  | Explicit, via `with`         |
| Built-in functions | Global (`darken()`)        | Namespaced (`color.scale()`) |

`@import` is deprecated as of Dart Sass 1.80.0 and removed in 3.0.0.

---

## Where a Value Lives

| The value…                                        | Belongs in                                     |
| ------------------------------------------------- | ---------------------------------------------- |
| Changes with a theme, density or tenant           | A custom property in the token layer           |
| Varies between variants of one component          | A custom property on the component's own class |
| Is fixed for the life of the build                | A Sass variable, resolved at compile time      |
| Is a size, colour or radius from the design scale | A token read, never a literal                  |
| Appears once and means nothing outside the rule   | The declaration itself — no name needed        |

---

## Anti-Patterns and Their Fixes

### Component styles with no layer wrapper

Precedence falls back to load order, and an override needs a specificity hack that the next override has to beat.

```scss
// Wrong
.button {
  padding: var(--space-md);
}

// Right
@layer components {
  .button {
    padding: var(--space-md);
  }
}
```

### Application styles inside the component layer

They sit at library priority, which removes the one advantage an application stylesheet has.

```scss
// Wrong
@layer components {
  .myCustomButton {
    background: var(--color-accent);
  }
}

// Right — unlayered outranks every layer
.myCustomButton {
  background: var(--color-accent);
}
```

### Sass colour functions on a themeable colour

Resolved at build time, so nothing at runtime can reach the result.

```scss
// Wrong
.hover {
  background: darken($primary, 10%);
}

// Right
.hover {
  background: color-mix(in srgb, var(--color-primary), black 10%);
}
```

### `@import` instead of `@use`

```scss
// Wrong
@import "variables";
@import "mixins";

// Right
@use "variables" as *;
@use "mixins" as m;
```

`sass-migrator module --migrate-deps <entrypoint>.scss` performs most of the conversion. `--built-in-only` converts the global functions while leaving the imports, which is the smaller first step for a large tree.

### `/` for division

```scss
// Wrong
$half-width: 100% / 2;
$column: 1 / 12 * 100%;

// Right
@use "sass:math";

$half-width: math.div(100%, 2);
$column: math.div(1, 12) * 100%;
```

`/` inside `calc()` is still division and needs no change.

### Hard-coded design values

```scss
// Wrong
.card {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

// Right
.card {
  padding: var(--space-lg);
  background: var(--color-background-surface);
  border-radius: var(--radius-md);
}
```

### A theme selector inside a module

A `.dark &` block ties the component to one theme mechanism. Name the role, read the token, and let the theme reassign it elsewhere.

---

## Silencing Deprecation Warnings During a Migration

Warnings from a dependency you do not control can be quieted while your own tree is converted:

```bash
sass --quiet-deps input.scss output.css
sass --silence-deprecation=import input.scss output.css
```

```javascript
// Through a bundler's Sass options
{
  sassOptions: {
    quietDeps: true,
    silenceDeprecations: ["import"],
  }
}
```

These buy time rather than a solution — `@import` is removed in Dart Sass 3.0.0 whether the warning was shown or not.
