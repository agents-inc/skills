# Vuetify Reference

> Component tables, prop value enumerations and anti-patterns with code. See [SKILL.md](SKILL.md) for
> the decisions and [examples/](examples/) for working configuration. Targets v3.x.

---

## Components by Category

### Layout

| Component     | Purpose                 | Key props                                 |
| ------------- | ----------------------- | ----------------------------------------- |
| `v-app`       | Root wrapper            | `theme` (scoped theme name)               |
| `v-main`      | Content area            | (insets itself from registered bars)      |
| `v-container` | Centred content wrapper | `fluid`                                   |
| `v-row`       | Grid row                | `dense`, `no-gutters`, `align`, `justify` |
| `v-col`       | Grid column             | `cols`, `sm`, `md`, `lg`, `xl`, `offset`  |
| `v-spacer`    | Flex spacer             | (none — expands to fill)                  |

### Navigation

| Component             | Purpose         | Key props                                   |
| --------------------- | --------------- | ------------------------------------------- |
| `v-app-bar`           | Top bar         | `density`, `elevation`, `scroll-behavior`   |
| `v-toolbar`           | Generic toolbar | `density`, `color`, `title`                 |
| `v-navigation-drawer` | Side navigation | `v-model`, `permanent`, `temporary`, `rail` |
| `v-bottom-navigation` | Bottom bar      | `v-model`, `grow`, `color`                  |
| `v-tabs` / `v-tab`    | Tabs            | `v-model`, `align-tabs`, `color`            |
| `v-breadcrumbs`       | Location trail  | `items`, `divider`                          |
| `v-menu`              | Popup menu      | `v-model`, `activator`, `location`          |

### Inputs

| Component        | Purpose             | Key props                                       |
| ---------------- | ------------------- | ----------------------------------------------- |
| `v-text-field`   | Single-line text    | `v-model`, `variant`, `density`, `rules`        |
| `v-textarea`     | Multi-line text     | `v-model`, `auto-grow`, `rows`                  |
| `v-select`       | Fixed list          | `v-model`, `items`, `multiple`, `chips`         |
| `v-autocomplete` | List with filtering | `v-model`, `items`, `multiple`, `return-object` |
| `v-combobox`     | List plus free text | `v-model`, `items`, `multiple`                  |
| `v-checkbox`     | Boolean             | `v-model`, `color`, `indeterminate`             |
| `v-switch`       | Boolean, immediate  | `v-model`, `color`, `inset`                     |
| `v-radio-group`  | One of a few        | `v-model`, `inline`                             |
| `v-slider`       | Numeric range       | `v-model`, `min`, `max`, `step`, `thumb-label`  |
| `v-file-input`   | File upload         | `v-model`, `accept`, `multiple`, `chips`        |
| `v-date-picker`  | Date                | `v-model` (lab component)                       |

### Data display

| Component   | Purpose            | Key props                                  |
| ----------- | ------------------ | ------------------------------------------ |
| `v-card`    | Content container  | `title`, `subtitle`, `text`, `variant`     |
| `v-list`    | Vertical list      | `items`, `density`, `lines`                |
| `v-chip`    | Tag or badge       | `color`, `closable`, `variant`, `size`     |
| `v-avatar`  | Photo or initials  | `image`, `icon`, `color`, `size`           |
| `v-badge`   | Count marker       | `content`, `color`, `dot`, `location`      |
| `v-tooltip` | Hover hint         | `text`, `location`                         |
| `v-icon`    | Icon               | `icon`, `size`, `color`                    |
| `v-img`     | Lazy-loading image | `src`, `lazy-src`, `aspect-ratio`, `cover` |

### Feedback

| Component             | Purpose             | Key props                                          |
| --------------------- | ------------------- | -------------------------------------------------- |
| `v-dialog`            | Modal               | `v-model`, `max-width`, `persistent`, `fullscreen` |
| `v-snackbar`          | Toast               | `v-model`, `timeout`, `location`, `color`          |
| `v-alert`             | Status message      | `type`, `variant`, `closable`, `title`             |
| `v-progress-linear`   | Progress bar        | `v-model`, `color`, `indeterminate`                |
| `v-progress-circular` | Spinner             | `size`, `width`, `color`, `indeterminate`          |
| `v-skeleton-loader`   | Loading placeholder | `type`, `loading`                                  |
| `v-overlay`           | Scrim               | `v-model`, `persistent`, `scrim`                   |

---

## Theme Colour Keys

The keys a theme's `colors` object is expected to carry. Any additional key works and is usable as
`color="myKey"` — the set below is what the components themselves reference.

| Key                                                        | Used for                               |
| ---------------------------------------------------------- | -------------------------------------- |
| `background`, `surface`                                    | Page and component surfaces            |
| `primary`, `secondary`                                     | Brand and action colours               |
| `error`, `info`, `success`, `warning`                      | Status colours, and `v-alert`'s `type` |
| `on-primary`, `on-surface`, `on-background`, `on-error`, … | Text drawn _on_ the matching surface   |

`variations: { colors: [...], lighten: n, darken: n }` generates `primary-lighten-1`,
`primary-darken-2` and so on. Full configuration: [examples/core.md](examples/core.md).

---

## Display Breakpoints

| Breakpoint | Min width | Typical          |
| ---------- | --------- | ---------------- |
| `xs`       | 0px       | Phone, portrait  |
| `sm`       | 600px     | Phone, landscape |
| `md`       | 960px     | Tablet           |
| `lg`       | 1280px    | Desktop          |
| `xl`       | 1920px    | Large desktop    |
| `xxl`      | 2560px    | Ultra-wide       |

These are not the values most CSS frameworks use — `md` begins at 960px, not 768px.

In templates: `<v-col cols="12" md="6" lg="4">`. In script:
`const { mobile, mdAndUp, name } = useDisplay()`.

---

## Density

| Value           | Effect           | Typical use            |
| --------------- | ---------------- | ---------------------- |
| `"default"`     | Standard spacing | General UI             |
| `"comfortable"` | Slightly reduced | Data-dense views       |
| `"compact"`     | Minimum spacing  | Admin tables, toolbars |

Accepted by `v-btn`, `v-text-field`, `v-select`, `v-data-table`, `v-list`, `v-tabs` and most other
input and display components. Set for everything at once with
`defaults: { global: { density: "comfortable" } }`.

---

## Variant

| Value             | Effect            | Components                             |
| ----------------- | ----------------- | -------------------------------------- |
| `"elevated"`      | Shadow (default)  | `v-btn`, `v-card`                      |
| `"flat"`          | No shadow         | `v-btn`, `v-card`, `v-alert`           |
| `"tonal"`         | Muted background  | `v-btn`, `v-chip`, `v-alert`           |
| `"outlined"`      | Border only       | `v-btn`, `v-card`, `v-chip`, `v-alert` |
| `"text"`          | No background     | `v-btn`, `v-chip`                      |
| `"plain"`         | Transparent, dim  | `v-btn`, `v-chip`                      |
| `"filled"`        | Filled background | `v-text-field`, `v-select`             |
| `"solo"`          | Elevated input    | `v-text-field`, `v-select`             |
| `"solo-filled"`   | Filled and solo   | `v-text-field`, `v-select`             |
| `"solo-inverted"` | Inverted solo     | `v-text-field`, `v-select`             |
| `"underlined"`    | Bottom border     | `v-text-field`, `v-select`             |

---

## Composables

| Composable     | Returns                                         | Purpose                   |
| -------------- | ----------------------------------------------- | ------------------------- |
| `useTheme()`   | `global.name`, `global.current`, theme methods  | Read and switch the theme |
| `useDisplay()` | `mobile`, `smAndUp`, `mdAndUp`, `name`, `width` | Reactive breakpoint state |
| `useDate()`    | Date adapter methods                            | Formatting and parsing    |
| `useRules()`   | `required()`, `email()`, `minLength()`, …       | Validation rule builders  |
| `useLocale()`  | `current`, `fallback`, `t()`                    | Translation access        |
| `useLayout()`  | Layout measurements                             | App layout dimensions     |

All import from `"vuetify"` except `useRules`, which is `"vuetify/labs/rules"`.

---

## Commonly Overridden SASS Variables

Set through `@use "vuetify/settings" with (...)`, which requires the build plugin and its
`styles.configFile` option. Syntax and setup: [examples/core.md](examples/core.md).

| Variable                                                                                                             | Controls                            |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `$body-font-family`, `$heading-font-family`                                                                          | Typefaces                           |
| `$border-radius-root`                                                                                                | Base radius everything derives from |
| `$button-height`, `$button-border-radius`, `$button-text-transform`, `$button-font-weight`, `$button-letter-spacing` | Button geometry and label           |
| `$card-border-radius`, `$card-elevation`                                                                             | Card shape and shadow               |
| `$text-field-border-radius`                                                                                          | Input shape                         |
| `$navigation-drawer-border-radius`                                                                                   | Drawer shape                        |
| `$chip-border-radius`                                                                                                | Chip shape                          |

These are compile-time only — nothing here can change at runtime, which is what separates this layer
from `theme` and `defaults`.

---

## Anti-Patterns

### Options API access inside the Composition API

```typescript
// WRONG — there is no component instance in <script setup>
this.$vuetify.theme.global.name = "dark";

// CORRECT
const theme = useTheme();
theme.global.name.value = "dark";
```

### Importing everything

```typescript
// WRONG — pulls in every component, whether used or not
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

// CORRECT — install the build plugin with autoImport, and import nothing:
// components used in templates are resolved and tree-shaken
```

### `!important` where a layer exists

```scss
// WRONG — fragile against any version that changes the internal markup
.v-btn {
  border-radius: 8px !important;
}

// CORRECT (compile-time)
// @use "vuetify/settings" with ($button-border-radius: 8px);

// CORRECT (runtime)
// defaults: { VBtn: { rounded: "lg" } }
```

### Props repeated per instance

```vue
<!-- WRONG — the same decision, made again at every call site -->
<v-btn variant="outlined" density="compact" rounded="lg">Save</v-btn>
<v-btn variant="outlined" density="compact" rounded="lg">Cancel</v-btn>

<!-- CORRECT — once in defaults: { VBtn: { variant: "outlined", density: "compact", rounded: "lg" } } -->
<v-btn>Save</v-btn>
<v-btn>Cancel</v-btn>
```

---

## Installation

```bash
# With the Vite build plugin
npm i vuetify vite-plugin-vuetify @mdi/font

# With the Webpack build plugin
npm i vuetify webpack-plugin-vuetify @mdi/font

# SASS variable overrides additionally need the compiler
npm i sass
```

Icon sets: `@mdi/font` for the font-based set (simplest, roughly 250KB), `@mdi/js` for the
tree-shakeable SVG set. Vuetify also ships adapters for other icon libraries under
`vuetify/iconsets/`.
