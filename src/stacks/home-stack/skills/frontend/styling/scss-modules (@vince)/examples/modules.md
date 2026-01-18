# SCSS Modules - Sass Module System Examples

> Sass module system patterns using @use and @forward. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for foundational patterns.

---

## Pattern 14: Sass Module System (@use and @forward)

### Overview

The Sass module system (`@use` and `@forward`) is the modern way to organize Sass code. `@import` is **deprecated as of Dart Sass 1.80.0** and will be **removed in Dart Sass 3.0.0**. All new SCSS code should use the module system.

### Key Differences from @import

| Feature | @import (Deprecated) | @use (Recommended) |
|---------|---------------------|-------------------|
| Scope | Global (pollutes namespace) | Namespaced (explicit) |
| Loading | Loads multiple times | Loads once per compilation |
| Private members | Not supported | `_` or `-` prefix = private |
| Configuration | Implicit via global vars | Explicit via `with` clause |
| Built-in functions | Global (`darken()`) | Namespaced (`color.scale()`) |

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
  padding: $space-md;  // Direct access
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
@import "variables";  // DEPRECATED
$primary-color: #ff6600;  // Overwrites globally - dangerous!
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
@mixin input-base { }

// _buttons.scss
$border-width: 2px !default;
@mixin button-base { }

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

// Division (/ operator is deprecated for division)
$half-width: math.div(100%, 2);  // 50%
$column: math.div(1, 12) * 100%; // 8.333...%

// Math functions
$rounded: math.round(4.7);  // 5
$ceiling: math.ceil(4.1);   // 5
$floor: math.floor(4.9);    // 4
$absolute: math.abs(-10);   // 10
$minimum: math.min(1px, 2px, 3px);  // 1px
$maximum: math.max(1px, 2px, 3px);  // 3px

// Constants
$pi: math.$pi;  // 3.14159...
$e: math.$e;    // 2.71828...

// Powers and roots
$squared: math.pow(2, 3);   // 8
$root: math.sqrt(16);       // 4

// Percentages
$percent: math.percentage(0.5);  // 50%
```

**Why good:** Explicit math operations, no ambiguity with CSS `/` separator, access to constants

```scss
// Bad Example - Deprecated / operator
$half: 100px / 2;  // DEPRECATED - ambiguous with CSS separator
$ratio: 16 / 9;    // DEPRECATED
```

**Why bad:** `/` is deprecated for division, ambiguous with CSS grid syntax (`1fr / 2fr`)

#### sass:color

```scss
@use "sass:color";

$primary: #3b82f6;

// Modern alternatives to deprecated functions
// Instead of darken($color, 10%):
$darker: color.scale($primary, $lightness: -20%);

// Instead of lighten($color, 10%):
$lighter: color.scale($primary, $lightness: 20%);

// Instead of saturate($color, 10%):
$saturated: color.scale($primary, $saturation: 20%);

// Instead of desaturate($color, 10%):
$desaturated: color.scale($primary, $saturation: -20%);

// Instead of transparentize($color, 0.5):
$transparent: color.scale($primary, $alpha: -50%);

// Instead of opacify($color, 0.2):
$opaque: color.scale($primary, $alpha: 20%);

// Get color channels
$hue: color.hue($primary);
$saturation: color.saturation($primary);
$lightness: color.lightness($primary);
$alpha: color.alpha($primary);

// Adjust (fixed amount) vs Scale (relative)
$adjusted: color.adjust($primary, $lightness: -10%);  // Fixed: subtract 10%
$scaled: color.scale($primary, $lightness: -10%);     // Relative: 10% toward 0%

// Mix colors
$mixed: color.mix($primary, white, 50%);

// Complement
$complement: color.complement($primary);

// Grayscale
$gray: color.grayscale($primary);
```

**Why good:** `color.scale()` is more intuitive (relative adjustments), explicit function names, works with modern color spaces

**NOTE:** For runtime theming, prefer CSS color functions like `color-mix()` and relative color syntax. Use Sass color functions only for build-time calculations.

#### sass:string

```scss
@use "sass:string";

$class-name: "button";

$upper: string.to-upper-case($class-name);  // "BUTTON"
$lower: string.to-lower-case($class-name);  // "button"
$length: string.length($class-name);        // 6
$slice: string.slice($class-name, 1, 4);    // "butt"
$index: string.index($class-name, "tt");    // 3
$insert: string.insert($class-name, "-lg", 7);  // "button-lg"
$quoted: string.quote(button);              // "button"
$unquoted: string.unquote("button");        // button
```

#### sass:list

```scss
@use "sass:list";

$sizes: sm, md, lg, xl;

$first: list.nth($sizes, 1);       // sm
$length: list.length($sizes);       // 4
$appended: list.append($sizes, xxl); // sm, md, lg, xl, xxl
$joined: list.join($sizes, (xxs, xs)); // sm, md, lg, xl, xxs, xs
$index: list.index($sizes, lg);     // 3
$has-md: list.index($sizes, md) != null;  // true
```

#### sass:map

```scss
@use "sass:map";

$breakpoints: (
  sm: 640px,
  md: 768px,
  lg: 1024px,
  xl: 1280px
);

$value: map.get($breakpoints, md);  // 768px
$has-key: map.has-key($breakpoints, md);  // true
$keys: map.keys($breakpoints);      // sm, md, lg, xl
$values: map.values($breakpoints);  // 640px, 768px, 1024px, 1280px
$merged: map.merge($breakpoints, (xxl: 1536px));
$removed: map.remove($breakpoints, sm);
$deep: map.deep-get($nested-map, key1, key2);  // For nested maps
```

---

### Migration from @import

#### Using the Sass Migrator

```bash
# Install the migrator
npm install -g sass-migrator

# Migrate all files (updates @import to @use)
sass-migrator module --migrate-deps your-entrypoint.scss

# Migrate built-in functions only (keep @import for now)
sass-migrator module --migrate-deps --built-in-only your-entrypoint.scss
```

#### Manual Migration Pattern

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
packages/ui/src/styles/
  _index.scss           # Entry point with @forward
  _design-tokens.scss   # Token definitions
  _mixins.scss          # Reusable mixins
  _reset.scss           # CSS reset
  _layers.scss          # Layer declarations

components/
  button/
    _button.module.scss # Component styles
```

#### Entry Point Pattern

```scss
// packages/ui/src/styles/_index.scss
@forward "layers";
@forward "design-tokens";
@forward "mixins";
```

```scss
// packages/ui/src/components/button/button.module.scss
@use "../../styles" as s;

@layer components {
  .button {
    padding: s.$space-md;
    @include s.focus-ring;
  }
}
```

---

### Silencing Deprecation Warnings

During migration, you may need to silence warnings from dependencies:

```bash
# CLI flag
sass --quiet-deps input.scss output.css

# Or silence specific deprecation
sass --silence-deprecation=import input.scss output.css
```

```javascript
// JavaScript API (webpack, vite, etc.)
{
  sassOptions: {
    quietDeps: true,
    silenceDeprecations: ['import']
  }
}
```

**Note:** These are temporary measures. Plan to fully migrate before Dart Sass 3.0.0.
