---
name: web-styling-tailwind
description: Tailwind CSS v4 - utility-first CSS framework with CSS-first configuration
---

# Tailwind CSS v4+ Patterns

> **Quick Guide:** v4 is configured in CSS, not JavaScript: `@import "tailwindcss"` replaces the three `@tailwind` directives, and `@theme` replaces `tailwind.config.js` — each variable in it generates utility classes _and_ a real CSS custom property. Custom utilities come from `@utility` and custom variants from `@custom-variant`; the v3 plugin API and `@layer utilities` no longer reach the variant system. Source files are detected automatically, so there is no `content` array. Several defaults moved: borders are `currentColor`, `ring` is 1px, the shadow and radius scales shifted one step, and the important modifier trails (`flex!`).

**Detailed Resources:**

- [examples/core.md](examples/core.md) — setup and source detection, responsive design, the three dark-mode strategies, state variants, `@theme` customisation
- [examples/advanced.md](examples/advanced.md) — `@utility`, `@custom-variant`, container queries, 3D transforms, `@starting-style`, masks, class composition
- [reference.md](reference.md) — `@theme` namespace table, v3-to-v4 differences, renamed utilities, browser support

---

## Which path applies

- **A new project** — install the package for your bundler, add `@import "tailwindcss"`, and put every token in `@theme`. Start at [examples/core.md](examples/core.md).
- **A v3 project being upgraded** — run `npx @tailwindcss/upgrade` first; it converts the config, the directives and most renamed utilities. The tables in [reference.md](reference.md) cover what it leaves, and custom plugins have to become `@utility` and `@custom-variant` by hand — see [examples/advanced.md](examples/advanced.md).

---

<critical_requirements>

## Before writing Tailwind code

**Configure in CSS: `@import "tailwindcss"` and `@theme`.** v4 does not look for `tailwind.config.js` at all unless a `@config` directive points at it, and the three `@tailwind` directives no longer exist.

**Declare custom utilities with `@utility`.** That registers them with the variant system, so `hover:` and `lg:` reach them — a `@layer utilities` block produces plain classes that no variant can prefix.

**Install the package that matches the bundler** — `@tailwindcss/vite`, `@tailwindcss/postcss`, `@tailwindcss/webpack` or `@tailwindcss/cli`. `tailwindcss` itself is no longer a PostCSS plugin, and vendor prefixing and import inlining are built in, so `autoprefixer` and `postcss-import` come out.

**Give `@theme` colours a wide-gamut value such as `oklch()`.** The default palette is oklch, so a hex brand colour is clamped to sRGB and reads as flat beside it.

**State border and ring values explicitly.** v4 defaults a border to `currentColor` and a ring to 1px, so markup carried over from v3 renders with the text colour and a thinner ring than it asked for.

</critical_requirements>

---

**Auto-detection:** `@import "tailwindcss"`, `@theme`, `@theme inline`, `@utility`, `@custom-variant`, `@variant`, `@source`, `@reference`, `@slot`, `--value()`, `--modifier()`, `--spacing()`, `@tailwindcss/vite`, `@tailwindcss/postcss`, `@tailwindcss/cli`, `tailwind-merge`, `@container`, `dark:`, `group-hover:`, `peer-checked:`, `data-[state=…]:`

**Applies to:**

- Styling with utility classes directly in markup
- Declaring theme tokens in CSS so they generate both classes and custom properties
- Responsive layout with viewport breakpoints and with container queries
- Dark mode by media query, class, or data attribute
- Adding utilities and variants the framework does not ship
- Migrating a v3 project to v4

**Handled elsewhere:**

- The token architecture behind the theme entries — how values are tiered, named and generated for other platforms. `@theme` is where a token becomes a _class_, not where the set is designed
- How a theme is chosen, persisted and applied before first paint — the `dark` variant decides what a theme looks like, not which one is active
- Turning a component's props into a table of class combinations — `cn()` composes a list; where the list is defined is a separate concern
- Scoped hand-written stylesheets — `@reference` makes the theme reachable from inside one, and the scoping mechanism itself is settled elsewhere

---

<philosophy>

Utility-first, and in v4 also CSS-native. Styles are composed from single-purpose classes in the markup, and the design decisions those classes encode live in CSS rather than in a JavaScript config — which means the theme is readable by the browser as well as by the build, since every `@theme` entry emits a custom property alongside the classes it generates.

That dual role is the thing to hold on to. `--color-brand-500` in `@theme` is simultaneously a token any stylesheet can read through `var()` and the source of `bg-brand-500`, `text-brand-500` and the rest of the namespace. Most of v4's sharper edges — why `inline` exists, why `@theme` cannot be nested, why a bare channel triplet breaks opacity modifiers — follow from that one variable serving both purposes.

</philosophy>

---

<decision_framework>

## Decision framework

### Dark mode strategy

```
Should the theme follow the operating system and nothing else?
|-- YES --> Nothing to configure. `dark:` already means prefers-color-scheme: dark.
|-- NO  --> A user-facing toggle is needed. What carries the state?
    |-- A class on <html>          --> @custom-variant dark (&:where(.dark, .dark *))
    |-- A data attribute on <html> --> @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))
```

### Where a design decision goes

```
Should it produce a utility class?
|-- YES --> @theme. Reference another variable? Then @theme inline.
|-- NO  --> Is it a whole declaration block reused across components?
    |-- YES --> @utility, so variants can still prefix it
    |-- NO  --> :root, read directly with var() — no class is generated
```

### Responsive to what?

```
The viewport      --> sm: md: lg: breakpoint variants
The element's own container --> @container on the parent, then @sm: @md: on the child
Neither           --> unprefixed utilities
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: CSS-first setup

One import, one theme block, and the bundler's own plugin. There is no `content` array — source files are detected automatically, respecting `.gitignore`.

```css
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.7 0.15 250);
  --font-display: "Satoshi", "sans-serif";
}
```

`@source` adds a path automatic detection misses (`node_modules` is skipped by default), `@source not` excludes one, and `@source inline("…")` safelists classes assembled at runtime that no scan can find. `@reference "../app.css"` makes the theme available inside a scoped stylesheet without duplicating its output.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Responsive design

Mobile-first: unprefixed utilities apply everywhere, and each breakpoint variant adds an override above its width. Custom breakpoints are `@theme` entries.

```html
<div
  class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
></div>
```

```css
@theme {
  --breakpoint-3xl: 120rem;
}
```

Stack variants for a range (`md:max-lg:hidden`), and use a `max-*` variant where a rule genuinely applies below a width rather than above one. Reaching for `max-*` throughout is desktop-first, which needs an override per breakpoint instead of one.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Dark mode

`dark:` follows `prefers-color-scheme` with no configuration. A user-facing toggle means overriding the variant so it reads a class or an attribute instead.

```css
@import "tailwindcss";

/* Class-based toggle */
@custom-variant dark (&:where(.dark, .dark *));

/* Or attribute-based */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

For a large surface, semantic theme entries beat a `dark:` pair on every utility: the components name a role, and the mode swap happens once in the stylesheet.

```css
@theme inline {
  --color-surface: var(--surface);
}
:root {
  --surface: oklch(0.99 0 0);
}
.dark {
  --surface: oklch(0.15 0 0);
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: State variants

Pseudo-class variants style the element itself; `group-*` styles a child from an ancestor's state and `peer-*` from a sibling's; `data-[…]` styles from an attribute the component sets.

```html
<div class="group rounded-lg p-4 hover:shadow-lg">
  <h3 class="text-gray-900 group-hover:text-blue-600">Title</h3>
</div>

<input class="peer" />
<p class="hidden peer-invalid:block">Please enter a valid email</p>

<button data-state="active" class="data-[state=active]:border-b-2">Tab</button>
```

Name a group or peer (`group/card`, `group-hover/card:`) wherever they nest, or the inner one silently answers to the outer. `not-*` inverts a condition — `not-hover:opacity-75` replaces a base value plus a hover override.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Theme customisation with @theme

Every entry generates utilities in its namespace _and_ a custom property. `--color-*: initial` clears one namespace before yours; `--*: initial` clears the whole default theme.

```css
@theme {
  --color-brand-500: oklch(0.55 0.2 250);
  --font-display: "Satoshi", sans-serif;
  --radius-card: 1rem;
  --shadow-card: 0 2px 8px oklch(0 0 0 / 0.08);
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
}
```

`@theme inline` resolves a referenced variable into each generated utility, which is what lets a value reassigned on `.dark` or `[data-theme]` reach the classes. `@theme static` emits the custom properties even for utilities nobody used. The namespace-to-utility table is in [reference.md](reference.md).

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Custom utilities with @utility

`@utility` registers a utility with the variant system. A trailing `-*` makes it functional, and `--value()` decides what it accepts — theme entries, bare values, or bracketed arbitrary ones, in cascade order.

```css
@utility content-auto {
  content-visibility: auto;
}

@utility tab-* {
  tab-size: --value(--tab-size-*); /* a theme entry */
  tab-size: --value(integer); /* a bare value: tab-4 */
  tab-size: --value([integer]); /* arbitrary: tab-[6] */
}
```

`--modifier()` handles the optional `/…` suffix, and an omitted modifier drops its declaration entirely. `--spacing()` multiplies the theme's spacing unit.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 7: Custom variants with @custom-variant

The shorthand takes a selector; the block form takes rules with `@slot` marking where the utility's own declarations land.

```css
@custom-variant theme-ocean (&:where([data-theme="ocean"] *));

@custom-variant any-hover {
  @media (any-hover: hover) {
    &:hover {
      @slot;
    }
  }
}
```

`&:where()` keeps the variant's specificity at zero, so a variant never wins on specificity alone. Inside hand-written CSS, `@variant dark { … }` applies an existing variant without `@apply`.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 8: Container queries

Built in, no plugin. `@container` makes an element a query container, and `@sm:`, `@md:` on its descendants respond to _its_ width rather than the viewport's.

```html
<div class="@container">
  <div class="flex flex-col gap-4 @sm:flex-row @lg:gap-6">…</div>
</div>
```

Name the container (`@container/sidebar`, then `@sm/sidebar:`) wherever containers nest. `@max-*` queries a maximum width and `@min-md:@max-xl:` a range.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 9: Modern CSS the framework exposes

v4 puts a set of platform features behind ordinary utilities, so they compose with every variant.

```html
<!-- 3D: perspective on the parent, transform-3d on the child -->
<div class="perspective-distant">
  <div
    class="transform-3d transition-transform hover:rotate-x-2 hover:rotate-y-3"
  >
    …
  </div>
</div>

<!-- @starting-style, for an entrance with no JavaScript -->
<div
  popover="auto"
  class="transition-all open:opacity-100 starting:open:opacity-0"
>
  …
</div>

<!-- A textarea that grows with its content -->
<textarea class="field-sizing-content"></textarea>
```

`bg-linear-45` and `/oklch` cover angled gradients and perceptual interpolation; `mask-*` covers gradient masking; `text-shadow-*` covers text shadows; `pointer-coarse:` and `pointer-fine:` size controls for the input device.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 10: Composing a class list

`cn()` — conditional joining plus conflict resolution — lets a component expose a `className` that can genuinely override its own utilities.

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

```typescript
// The caller's className goes last, so it wins the merge
className={cn("rounded-lg px-4 py-2", VARIANT_CLASSES[variant], className)}
```

Prefer this to `@apply`, which moves the utilities out of the markup into a CSS layer that is then harder to override than the classes it replaced.

Full code: [examples/advanced.md](examples/advanced.md)

</patterns>

---

<red_flags>

## Red flags

**v3 syntax that silently produces nothing:**

- **`@tailwind base; @tailwind components; @tailwind utilities;`** — the directives are gone. `@import "tailwindcss"` is the one replacement.
- **`tailwind.config.js` with no `@config`** — v4 does not look for it, so the file reads as configured while none of it applies.
- **`@layer utilities { .foo { … } }`** — produces a class, but the variant system never sees it, so `hover:foo` and `lg:foo` do not exist.
- **`tailwindcss` as a PostCSS plugin** — moved to `@tailwindcss/postcss`. Alongside it, `autoprefixer` and `postcss-import` are now redundant.
- **`addVariant()` through the plugin API** — replaced by `@custom-variant`.
- **`!flex`** and **`bg-[--var]`** — the important modifier trails now (`flex!`) and a CSS variable takes parentheses (`bg-(--var)`).

**Breaks the theme:**

- **`@theme` nested inside a selector or a media query** — it is top-level only, because the classes it generates are emitted at build time and cannot be conditional on a runtime scope. Mode-conditional values go in `:root` and `[data-theme]`; only the alias goes in `@theme`.
- **Omitting `inline` on an aliasing theme entry** — the generated utility carries a chained reference resolved where the theme entry was declared, not where the class is used, so the `[data-theme="dark"]` reassignment never reaches it. No build warning, no console message, and the page stays in light mode.
- **A bare channel triplet as a theme colour** (`0 0% 100%`) — an opacity modifier compiles to `color-mix(in oklab, var(--color-x) 50%, transparent)`, which needs a real colour, so the declaration is dropped and only the modified utilities break.
- **The same value typed in `:root` and in `@theme`** — two copies of one decision, free to drift, with the mismatch showing as a subtle colour difference between utility-styled and directly-styled elements.
- **Hex colours in `@theme`** — clamped to sRGB beside an oklch default palette.

**Changed defaults that look like a regression:**

- `border` alone is `currentColor`, not a grey. State the colour.
- `ring` is 1px; the v3 default is `ring-3`.
- The shadow, radius and blur scales each shifted a step: v3's `shadow` is v4's `shadow-sm`, and v3's `shadow-sm` is `shadow-xs`.
- `outline-none` became `outline-hidden`.
- Variant stacking reads left to right, following the cascade — the reverse of v3.
- `hover:` only applies where the device actually has hover, so a touch device no longer keeps a hover state after a tap.
- `space-y-*` and `divide-*` changed selector: `gap-*` with flex or grid is the more predictable choice.

**Surprising behaviour:**

- Automatic source detection skips `node_modules`, so classes inside an installed component library need an explicit `@source`.
- A class assembled at runtime is invisible to detection. `@source inline("…")` is the safelist.
- Grid template values separate with underscores, not commas: `grid-cols-[max-content_auto]`.
- `@apply` inside a scoped stylesheet needs `@reference` first, or the theme is not in scope.
- v4 needs Safari 16.4+, Chrome 111+ and Firefox 128+; there is no build target that reaches older engines.
- Sass, Less and Stylus are not supported — v4 is itself the preprocessor.

</red_flags>
