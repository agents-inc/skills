---
name: web-styling-scss-modules
description: SCSS Modules - locally scoped component stylesheets, cascade layers, the Sass module system, mixins, and build-time versus runtime values
---

# SCSS Modules Patterns

> **Quick Guide:** A `*.module.scss` file is a locally scoped stylesheet: its class names are rewritten at build time and reached through an imported object, so a component's styles cannot collide with anyone else's. Wrap library styles in `@layer components {}` so an application overrides them with an unlayered rule and no specificity contest. Load Sass with `@use` and `@forward` — `@import` is deprecated and going away. Style state with attribute selectors rather than a class per state, and keep anything that must change without a rebuild in a custom property rather than a Sass variable.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — local scoping and the `styles` object, cascade layer setup, layered component styles, unlayered application overrides
- [examples/modules.md](examples/modules.md) — `@use`, `@forward`, namespaces, `with` configuration, built-in modules, migrating off `@import`
- [examples/patterns.md](examples/patterns.md) — module file structure, data-attribute state, mixins, global styles, icon sizing
- [examples/tokens.md](examples/tokens.md) — reading design tokens from module styles, component-scoped custom properties
- [examples/theming.md](examples/theming.md) — keeping a module free of theme branching
- [examples/advanced.md](examples/advanced.md) — `:has()`, `:global()`, nesting depth
- [reference.md](reference.md) — anti-patterns with fixes, `@use` versus `@import`, Sass deprecation notes

---

<critical_requirements>

## Before writing SCSS Modules code

**Reach every class through the imported object.** The name in the stylesheet is not the name in the CSS the browser receives, so a literal `className="button"` matches nothing — no error, no styles, no clue.

**Wrap library component styles in `@layer components {}`.** An application then overrides them with an ordinary unlayered rule, with no specificity contest and regardless of which stylesheet loaded first.

**Load Sass files with `@use`.** It namespaces what it loads, evaluates each file once per compilation, and makes `_`-prefixed members private — none of which `@import` does, and `@import` is deprecated as of Dart Sass 1.80.0 and removed in 3.0.0.

**Keep any value that must change without a rebuild in a custom property.** A Sass variable and `darken()` are resolved at compile time, so nothing at runtime can reach them.

**Style state with attribute selectors on the component's own class.** `&[data-state="open"]` keeps every state in the stylesheet, where a class per state spreads the component's appearance across the markup that chooses between them.

</critical_requirements>

---

**Auto-detection:** `.module.scss`, `.module.css`, `styles.` class access, `@use`, `@forward`, `@layer components`, `:global()`, `@mixin`, `@include`, `!default`, `sass:math`, `math.div`, `sass:color`, `color.scale`, `@import` in Sass, sass-migrator

**Applies to:**

- Writing component styles in `*.module.scss` with locally scoped class names
- Organising Sass across files with `@use` and `@forward`, and migrating off `@import`
- Controlling precedence between library styles and application overrides with cascade layers
- Deciding what belongs in a build-time Sass value and what belongs in a runtime custom property
- Extracting repeated declarations into mixins
- Escaping module scope deliberately with `:global()`

**Handled elsewhere:**

- Which design tokens exist, how they are tiered and what they are called — module styles read them through `var()` and define none of them
- How a theme is selected, persisted and applied at runtime — a module's part is to carry no theme branching at all, so it adapts without being told
- Turning a set of component props into a class list — a module _exports_ class names; what composes them is a separate concern
- Generated utility classes covering the whole design space — a module system scopes hand-written CSS, which is a different trade

---

<philosophy>

The scoping is the point. Because uniqueness is the build's problem, a stylesheet can use short, obvious names without a naming convention holding the codebase together — no BEM-style prefixes, and deleting a component deletes its styles.

Two consequences follow, and most of this skill is downstream of them. **Nothing global happens by accident**, so anything genuinely global — a reset, a layer declaration, design tokens — is written deliberately and outside a module. And **a module cannot reach another module's names**, so shared decisions travel as Sass members through `@use`, or as custom properties through the cascade, rather than as a class name two files agree about.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Local scoping — a class name becomes an object key

Importing a `*.module.scss` file yields an object whose keys are the classes the file declares and whose values are the globally unique names the build emitted. That object is the only route to the name that is actually in the CSS.

```scss
// button.module.scss
.button {
  padding: var(--space-md);
}
.sizeSm {
  padding: var(--space-sm);
}
```

```tsx
// button.tsx
import styles from "./button.module.scss";

// styles.button is something like "button-module__x7f2q" — never "button"
<button className={`${styles.button} ${styles.sizeSm}`} />;
```

The emitted name's shape is a build setting, so nothing may depend on it. The keys are the class names **as authored**: `.size-sm` is reached as `styles["size-sm"]` unless the build is configured to add camelCase aliases — which is why these stylesheets name classes in camelCase to begin with.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Cascade layers for predictable precedence

Declare the layer order once, and put library component styles inside `@layer components`. Application styles stay unlayered, which the cascade ranks above every layer whatever the load order.

```scss
// layers.scss — loaded first, before anything it names
@layer reset, components;
```

```scss
// button.module.scss — a library component
@layer components {
  .button {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);
  }
}
```

```scss
// an application stylesheet — no layer, so it wins
.myCustomButton {
  background-color: var(--color-accent);
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: The Sass module system

`@use` loads a file under a namespace, once per compilation. `@forward` re-exports one file's members through another, which is how a directory gets a single entry point.

```scss
// styles/_index.scss — the public surface
@forward "layers";
@forward "design-tokens";
@forward "mixins";
```

```scss
// button.module.scss
@use "../../styles" as s;

@layer components {
  .button {
    padding: s.$space-md;
    @include s.focus-ring;
  }
}
```

`@use "…" as *` drops the namespace and suits only a foundational module used everywhere. A module configured with `with` keeps that configuration for the whole compilation — the first load wins.

Full code: [examples/modules.md](examples/modules.md)

---

### Pattern 4: Build-time Sass values versus runtime custom properties

A Sass variable is gone by the time the browser sees the CSS. Anything that must respond to a theme, a density setting or a media condition has to be a custom property.

```scss
@use "sass:math";

// Build-time: a value computed once, that never changes at runtime
$column-width: math.div(100%, 12);

.grid {
  grid-template-columns: repeat(12, $column-width);

  // Runtime: reassigning this token elsewhere re-styles the element
  gap: var(--space-md);
  background: color-mix(in srgb, var(--color-primary), black 5%);
}
```

`math.div()` replaces `/`, which is ambiguous with the CSS slash separator (`grid-template: 1fr / 2fr`). `color.scale()` replaces `darken()` and `lighten()` for genuine build-time colour maths — but a colour that a theme must be able to change belongs in a custom property, mixed with `color-mix()` or relative colour syntax.

Full code: [examples/modules.md](examples/modules.md)

---

### Pattern 5: Reading tokens, never redeclaring them

A module consumes design tokens through `var()`. It declares a custom property of its own only where a value has to vary _within_ the component — and then on the component's own class, which scopes it to that subtree.

```scss
@layer components {
  .button {
    // Component-scoped: the variants below reassign it
    --button-accent-bg: transparent;

    padding: var(--space-md);
    font-size: var(--font-size-body);
    color: var(--color-text-default);
    background: var(--button-accent-bg);
  }

  .outline:hover {
    --button-accent-bg: var(--color-background-muted);
  }
}
```

Redeclaring a token that already exists (`--card-radius: 0.5rem` beside a `--radius-sm`) creates a second value that no longer follows the first.

Full code: [examples/tokens.md](examples/tokens.md)

---

### Pattern 6: Data-attributes for state

One class carries the component, and attribute selectors carry its states. States then combine without a class for each combination.

```scss
.dropdown {
  &[data-open="true"] {
    display: block;
  }

  &[data-size="large"][data-variant="primary"] {
    padding: var(--space-xlg);
  }

  &[aria-invalid="true"] {
    border-color: var(--color-destructive);
  }
}
```

Use string values (`data-state="open"`) rather than bare boolean attributes — an attribute-value selector reads the same for every state, and the DOM shows what the component thinks it is.

Full code: [examples/patterns.md](examples/patterns.md)

---

### Pattern 7: Mixins for repeated declaration blocks

A mixin is the right shape when several components need the same block of declarations — particularly the accessibility ones, where a partial copy is a bug.

```scss
@mixin focus-ring {
  &:focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
  }
}

@mixin sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.button {
  @include focus-ring;
}
```

Extract at the third user, not the first. A mixin used once is a block of CSS with an extra hop.

Full code: [examples/patterns.md](examples/patterns.md)

---

### Pattern 8: Theme-agnostic component styles

A module names roles and never modes. The stylesheet is written once and every theme reaches it through the tokens it already reads.

```scss
@layer components {
  .button {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);

    // No `.dark &`, no theme conditional — the tokens carry the mode
    &:hover {
      background-color: var(--color-primary-hover);
    }
  }
}
```

A `.dark &` selector inside a module ties that module to one theme implementation, and a third theme means a third branch in every component that has one.

Full code: [examples/theming.md](examples/theming.md)

---

### Pattern 9: Escaping and nesting deliberately

`:global()` opts a selector out of the scoping, which is what makes third-party class names reachable. Nesting with `&` keeps modifiers beside the thing they modify.

```scss
.component {
  padding: var(--space-md);

  // Reach a class this module does not own
  :global(.third-party-widget) & {
    padding: 0;
  }

  // `:has()` styles a parent from its children — no JavaScript needed
  &:has(input:focus) {
    background: var(--color-background-muted);
  }
}
```

Keep nesting to about three levels: each level raises specificity and moves the generated selector further from the name that appears in the markup.

Full code: [examples/advanced.md](examples/advanced.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at build time:**

- **`@import` in new Sass** — deprecated as of Dart Sass 1.80.0 and removed in 3.0.0. `@use` replaces it; `sass-migrator module --migrate-deps` does most of the conversion.
- **`/` for division** (`100% / 2`) — deprecated and ambiguous with the CSS slash separator. `math.div()` from `sass:math` is explicit. `/` inside `calc()` is unaffected.
- **`@use` after a style rule** — it must precede everything except `@forward` and `@charset`, so a rule above it is a compile error. Variable declarations are the documented exception, because configuring a module with `with` needs them above the load.
- **A missing layer declaration** — `@layer reset, components;` has to be evaluated before the layered content, or the order is whatever the files happened to establish.

**Silently applies nothing:**

- **A class name written as a string in markup** (`className="button"`) — the emitted name is generated, so the literal matches no rule. Nothing errors and the element renders unstyled.
- **A dashed class name read as a property** (`styles.size-sm`) — that parses as a subtraction, not a lookup. Author classes in camelCase, or use `styles["size-sm"]`.
- **A class declared in a module but never read through the object** — it is scoped to a name nothing references, so it ships as dead CSS that no search for the class name finds.

**Costs a theme or an override:**

- **Component styles with no layer wrapper** — precedence then depends on load order, and an application override needs a specificity hack that the next one has to beat.
- **Application styles wrapped in `@layer components`** — they land at library priority and can no longer override the library, which is the one thing they exist to do.
- **Sass colour functions on a themeable colour** (`darken($primary, 10%)`) — resolved at build time, so a runtime theme swap cannot reach the result. `color-mix()` and relative colour syntax stay live.
- **A theme selector inside a module** (`.dark & { … }`) — couples the component to one theme mechanism, and each further theme adds a branch to every component carrying one.
- **Hard-coded colours, spacing and radii** — an untracked value that no token change reaches and no audit sees.

**Surprising behaviour:**

- Unlayered styles beat every layer, whatever the load order. That is the mechanism application overrides rely on, and it is also why an accidentally unlayered library rule is hard to override.
- Within a layer, ordinary specificity applies — layers only rank _between_ themselves.
- A module configured with `@use "…" with (…)` keeps that configuration even where another file loads it unconfigured. First load wins.
- Members prefixed `_` or `-` are private to their file and invisible through `@use` and `@forward`.
- Built-in module variables such as `math.$pi` are read-only.
- `:global()` removes scoping for the selector it wraps, so a `:global` block deep in a module quietly reintroduces exactly the collisions the module prevents.

</red_flags>
