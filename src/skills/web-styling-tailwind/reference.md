# Tailwind CSS v4 Reference

> Namespace lookup, v3-to-v4 differences, and migration tables. Decision guidance and red flags are in [SKILL.md](SKILL.md).

---

## `@theme` Namespaces

Each namespace decides which utilities an entry generates. Every entry also emits a CSS custom property of the same name.

| Namespace          | Generates                | Example class                    |
| ------------------ | ------------------------ | -------------------------------- |
| `--color-*`        | Colour utilities         | `bg-brand-500`, `text-brand-500` |
| `--font-*`         | Font family              | `font-display`                   |
| `--font-weight-*`  | Font weight              | `font-bold`                      |
| `--text-*`         | Font size                | `text-display`                   |
| `--tracking-*`     | Letter spacing           | `tracking-wide`                  |
| `--leading-*`      | Line height              | `leading-tight`                  |
| `--spacing-*`      | Spacing and sizing       | `px-compact`, `max-h-16`         |
| `--breakpoint-*`   | Responsive variants      | `3xl:flex`                       |
| `--container-*`    | Container query variants | `@sm:*`, `max-w-md`              |
| `--radius-*`       | Border radius            | `rounded-card`                   |
| `--shadow-*`       | Box shadows              | `shadow-card`                    |
| `--inset-shadow-*` | Inset box shadows        | `inset-shadow-xs`                |
| `--drop-shadow-*`  | Drop shadow filters      | `drop-shadow-md`                 |
| `--ease-*`         | Timing functions         | `ease-fluid`                     |
| `--animate-*`      | Animations               | `animate-fade-in`                |
| `--blur-*`         | Blur filters             | `blur-card`                      |
| `--perspective-*`  | 3D perspective           | `perspective-card`               |
| `--aspect-*`       | Aspect ratios            | `aspect-cinema`                  |

**Modifiers on the block:** `@theme inline` resolves a referenced variable into each generated utility. `@theme static` emits the custom properties even where no utility used them. `@keyframes` may be declared inside `@theme` beside the `--animate-*` entry that uses it.

**Clearing defaults:** `--color-*: initial` empties one namespace, `--*: initial` empties the whole default theme. Declare replacements after the reset, in the same or a later block.

---

## v3 versus v4

| Aspect             | v3                                    | v4                      |
| ------------------ | ------------------------------------- | ----------------------- |
| Config             | `tailwind.config.js`                  | `@theme` in CSS         |
| Import             | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| Custom utilities   | `@layer utilities {}`                 | `@utility name {}`      |
| Custom variants    | `addVariant()` plugin                 | `@custom-variant`       |
| Content detection  | Manual `content: []`                  | Automatic               |
| Colours            | sRGB hex/rgb                          | oklch (P3 gamut)        |
| Border default     | `gray-200`                            | `currentColor`          |
| Ring default       | `3px blue-500`                        | `1px currentColor`      |
| Important modifier | `!flex`                               | `flex!`                 |
| Arbitrary vars     | `bg-[--var]`                          | `bg-(--var)`            |
| Variant stacking   | Right to left                         | Left to right           |
| Container queries  | Plugin required                       | Built in                |
| 3D transforms      | Not available                         | Built in                |
| Text shadows       | Not available                         | Built in (v4.1)         |
| Masks              | Not available                         | Built in (v4.1)         |

---

## Renamed Utilities

| v3              | v4               | Note                           |
| --------------- | ---------------- | ------------------------------ |
| `shadow-sm`     | `shadow-xs`      | Scale shifted one step         |
| `shadow`        | `shadow-sm`      | Scale shifted one step         |
| `rounded-sm`    | `rounded-xs`     | Scale shifted one step         |
| `rounded`       | `rounded-sm`     | Scale shifted one step         |
| `blur-sm`       | `blur-xs`        | Scale shifted one step         |
| `blur`          | `blur-sm`        | Scale shifted one step         |
| `ring`          | `ring-3`         | Default width moved 3px to 1px |
| `outline-none`  | `outline-hidden` | Accessibility change           |
| `!flex`         | `flex!`          | Important modifier now trails  |
| `bg-[--var]`    | `bg-(--var)`     | Parentheses for a CSS variable |
| `bg-opacity-50` | `bg-black/50`    | Opacity modifier syntax        |
| `flex-shrink`   | `shrink`         | Renamed                        |
| `flex-grow`     | `grow`           | Renamed                        |

---

## Migration

```bash
npx @tailwindcss/upgrade
```

**Handles:** dependency updates, config conversion into CSS, the directive change, and most of the renamed utilities in templates.

**Leaves for you:** custom plugin logic, which becomes `@utility` and `@custom-variant` by hand; anything a JavaScript config computed rather than declared; and third-party plugin compatibility.

---

## Source Detection Directives

| Directive              | Does                                                      |
| ---------------------- | --------------------------------------------------------- |
| (none)                 | Scans the project automatically, respecting `.gitignore`  |
| `@source "path"`       | Adds a path — needed for `node_modules`, which is skipped |
| `@source not "path"`   | Excludes a path (v4.1)                                    |
| `@source inline("…")`  | Safelists classes assembled at runtime (v4.1)             |
| `@reference "app.css"` | Makes the theme reachable inside a scoped stylesheet      |

---

## Build Integration

| Setup            | Package                |
| ---------------- | ---------------------- |
| Vite             | `@tailwindcss/vite`    |
| Webpack          | `@tailwindcss/webpack` |
| Any PostCSS host | `@tailwindcss/postcss` |
| Standalone       | `@tailwindcss/cli`     |

`autoprefixer` and `postcss-import` are redundant — both are built in.

---

## Browser Support

Safari 16.4+, Chrome 111+, Firefox 128+. The framework leans on cascade layers, `@property` and `color-mix()`, none of which have a build-time fallback, so there is no configuration that reaches an older engine.
