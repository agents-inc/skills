# SCSS Modules - The Sass Module System

> `@use`, `@forward`, built-in modules, and migrating off `@import`. See [SKILL.md](../SKILL.md) for decision guidance, [core.md](core.md) for the layer setup, and [reference.md](../reference.md) for the `@use`-versus-`@import` table and the migration commands.

`@import` is **deprecated as of Dart Sass 1.80.0** and **removed in Dart Sass 3.0.0**.

---

### @use Basic Syntax

#### Loading a Module

```scss
// Good Example - @use with default namespace
@use "design-tokens"; // Namespace: design-tokens

.button {
  padding: design-tokens.$space-md;
  color: design-tokens.$color-primary;
}
```

**Why good:** Explicit namespace makes it clear where values come from, prevents naming collisions, module loaded only once

#### Custom Namespace

```scss
// Good Example - Custom namespace with 'as'
@use "design-tokens" as tokens;

.button {
  padding: tokens.$space-md;
  color: tokens.$color-primary;
}
```

**Why good:** Shorter namespace for frequently used modules, still explicit about source

#### No Namespace (Use Sparingly)

```scss
// Good Example - No namespace for design tokens only
@use "design-tokens" as *;

.button {
  padding: $space-md; // Direct access
  color: $color-primary;
}
```

**Why good:** Cleaner syntax when there's no risk of naming collision (e.g., design tokens)

**When to use:** Only for foundational modules like design tokens that are used everywhere

---

### @use Configuration with `with`

Configure module variables using the `with` clause. Variables must have `!default` to be configurable.

#### Configurable Module

```scss
// _theme.scss - Configurable module
$primary-color: #0066cc !default;
$border-radius: 4px !default;
$font-family: system-ui !default;

:root {
  --color-primary: #{$primary-color};
  --radius-default: #{$border-radius};
  --font-family: #{$font-family};
}
```

#### Using with Configuration

```scss
// Good Example - Configure module on load
@use "theme" with (
  $primary-color: #ff6600,
  $border-radius: 8px
);

// Variables are now set to custom values
// Theme module outputs CSS with orange primary, 8px radius
```

**Why good:** Explicit configuration at import time, type-safe (only `!default` vars configurable), prevents accidental overrides

```scss
// Bad Example - Old @import pattern
@import "variables"; // DEPRECATED
$primary-color: #ff6600; // Overwrites globally - dangerous!
@import "theme";
```

**Why bad:** @import is deprecated, global variables cause unpredictable overrides, no type safety

---

### @forward for Module Re-exporting

`@forward` re-exports members from another module through your module.

#### Creating an Entry Point Module

```scss
// styles/_index.scss - Entry point
@forward "design-tokens";
@forward "mixins";
@forward "reset";
```

```scss
// Consumer file
@use "styles" as s;

.button {
  @include s.focus-ring;
  padding: s.$space-md;
}
```

**Why good:** Single import for consumers, organized internal structure, clear public API

#### Adding Prefixes with @forward

```scss
// _forms.scss
$border-width: 1px !default;
@mixin input-base {
}

// _buttons.scss
$border-width: 2px !default;
@mixin button-base {
}

// styles/_index.scss
@forward "forms" as form-*;
@forward "buttons" as btn-*;
```

```scss
// Consumer file
@use "styles" as s;

.input {
  border-width: s.$form-border-width;
  @include s.form-input-base;
}

.button {
  border-width: s.$btn-border-width;
  @include s.btn-button-base;
}
```

**Why good:** Prevents naming collisions between modules, clear origin of each member

#### Controlling Visibility

```scss
// Only expose specific members
@forward "internal" show $public-var, public-mixin;

// Hide specific members (expose everything else)
@forward "internal" hide $_private-var, -private-mixin;
```

---

### Built-in Modules

Sass provides built-in modules for common operations. These replace global functions that are also deprecated.

#### sass:math

```scss
@use "sass:math";

// Division. The / operator is deprecated for this.
$half-width: math.div(100%, 2); // 50%
$column: math.div(1, 12) * 100%; // 8.333...%

// Rounding, bounds, powers and roots all live here too
$rounded: math.round(4.7); // 5
$minimum: math.min(1px, 2px, 3px); // 1px
$squared: math.pow(2, 3); // 8
$percent: math.percentage(0.5); // 50%

// Constants are read-only
$pi: math.$pi;
```

```scss
// Bad Example - the deprecated operator
$half: 100px / 2;
$ratio: 16 / 9;
```

**Why bad:** `/` already means "separator" in CSS (`grid-template: 1fr / 2fr`, `font: 16px/1.5`), so Sass cannot tell the two uses apart from syntax alone. `math.div()` says which one is meant. Inside `calc()`, `/` is still division and is unaffected.

#### sass:color

```scss
@use "sass:color";

$primary: #3b82f6;

// color.scale() replaces the whole family of global functions:
// darken / lighten -> $lightness, saturate / desaturate -> $saturation,
// transparentize / opacify -> $alpha
$darker: color.scale($primary, $lightness: -20%);
$transparent: color.scale($primary, $alpha: -50%);

// The two adjusters differ, and the difference matters near the ends of a range
$adjusted: color.adjust($primary, $lightness: -10%); // subtract 10 points
$scaled: color.scale($primary, $lightness: -10%); // move 10% toward 0%

$mixed: color.mix($primary, white, 50%);
```

**Why good:** `scale()` moves a channel a proportion of its remaining range, so it cannot overshoot and flatten to black or white the way a fixed subtraction can.

**These are build-time only.** A colour that a runtime theme must be able to change belongs in a custom property, mixed with `color-mix()` or relative colour syntax — a Sass function has already resolved to a literal by the time the browser sees it.

#### Other Built-in Modules

Sass provides `sass:string`, `sass:list`, `sass:map`, and `sass:selector` modules. These follow the same namespaced pattern. Consult the [Sass built-in modules documentation](https://sass-lang.com/documentation/modules/) for full API reference.

---

### Migration from @import

`sass-migrator` does most of this mechanically — the commands are in [reference.md](../reference.md). What it cannot decide for you is the namespace each file should take, so read the diff for `as *` it introduced on a module that deserved a name.

#### What the Conversion Looks Like

```scss
// Before (deprecated @import)
@import "variables";
@import "mixins";
@import "reset";

.button {
  padding: $space-md;
  @include focus-ring;
  color: darken($primary, 10%);
}
```

```scss
// After (@use module system)
@use "variables" as *;
@use "mixins" as m;
@use "sass:color";
@use "reset";

.button {
  padding: $space-md;
  @include m.focus-ring;
  color: color.scale($primary, $lightness: -10%);
}
```

---

### File Structure with Modules

```
styles/
  _index.scss           # Entry point with @forward
  _design-tokens.scss   # Token declarations
  _mixins.scss          # Reusable mixins
  _reset.scss           # CSS reset
  _layers.scss          # Layer declarations

components/
  button/
    button.module.scss  # Component styles
```

#### Entry Point Pattern

```scss
// styles/_index.scss
@forward "layers";
@forward "design-tokens";
@forward "mixins";
```

```scss
// components/button/button.module.scss
@use "../../styles" as s;

@layer components {
  .button {
    padding: s.$space-md;
    @include s.focus-ring;
  }
}
```

**Why good:** every module reaches the shared Sass through one path, so moving a partial is one edit in `_index.scss` rather than one per consumer, and the `_` prefix keeps the partials from being compiled as stylesheets of their own.

---

> Warnings coming from a dependency you do not control can be quieted while your own tree is converted — see [reference.md](../reference.md) for the flags.
