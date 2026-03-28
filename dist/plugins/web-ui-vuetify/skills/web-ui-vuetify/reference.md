# Vuetify Reference

> Decision frameworks, component quick reference, and anti-patterns for Vuetify 3.x. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for practical code. **Current: v3.8.x**

---

## Quick Reference: Component Categories

### Layout

| Component     | Purpose                    | Key Props                                 |
| ------------- | -------------------------- | ----------------------------------------- |
| `v-app`       | Root application wrapper   | `theme` (scoped theme name)               |
| `v-container` | Centered content wrapper   | `fluid`, `class`                          |
| `v-row`       | Grid row (flexbox wrapper) | `dense`, `no-gutters`, `align`, `justify` |
| `v-col`       | Grid column                | `cols`, `sm`, `md`, `lg`, `xl`, `offset`  |
| `v-spacer`    | Flex spacer                | (none -- expands to fill space)           |

### Navigation

| Component             | Purpose              | Key Props                                   |
| --------------------- | -------------------- | ------------------------------------------- |
| `v-app-bar`           | Top navigation bar   | `density`, `elevation`, `scroll-behavior`   |
| `v-toolbar`           | Generic toolbar      | `density`, `color`, `title`                 |
| `v-navigation-drawer` | Side navigation      | `v-model`, `permanent`, `temporary`, `rail` |
| `v-bottom-navigation` | Mobile bottom nav    | `v-model`, `grow`, `color`                  |
| `v-tabs` / `v-tab`    | Tab navigation       | `v-model`, `align-tabs`, `color`            |
| `v-breadcrumbs`       | Location breadcrumbs | `items`, `divider`                          |
| `v-menu`              | Popup menu           | `v-model`, `activator`, `location`          |

### Inputs

| Component        | Purpose               | Key Props                                       |
| ---------------- | --------------------- | ----------------------------------------------- |
| `v-text-field`   | Text input with label | `v-model`, `variant`, `density`, `rules`        |
| `v-textarea`     | Multi-line input      | `v-model`, `auto-grow`, `rows`                  |
| `v-select`       | Dropdown select       | `v-model`, `items`, `multiple`, `chips`         |
| `v-autocomplete` | Searchable dropdown   | `v-model`, `items`, `multiple`, `return-object` |
| `v-combobox`     | Free-text + dropdown  | `v-model`, `items`, `multiple`                  |
| `v-checkbox`     | Boolean input         | `v-model`, `color`, `indeterminate`             |
| `v-switch`       | Toggle switch         | `v-model`, `color`, `inset`                     |
| `v-radio-group`  | Single-select options | `v-model`, `inline`                             |
| `v-slider`       | Range input           | `v-model`, `min`, `max`, `step`, `thumb-label`  |
| `v-file-input`   | File upload           | `v-model`, `accept`, `multiple`, `chips`        |

### Data Display

| Component   | Purpose               | Key Props                                  |
| ----------- | --------------------- | ------------------------------------------ |
| `v-card`    | Content container     | `title`, `subtitle`, `text`, `variant`     |
| `v-list`    | Vertical list         | `items`, `density`, `lines`                |
| `v-chip`    | Tag / badge           | `color`, `closable`, `variant`, `size`     |
| `v-avatar`  | User photo / initials | `image`, `icon`, `color`, `size`           |
| `v-badge`   | Notification count    | `content`, `color`, `dot`, `location`      |
| `v-tooltip` | Hover hint            | `text`, `location`                         |
| `v-icon`    | Material Design icon  | `icon`, `size`, `color`                    |
| `v-img`     | Lazy-loading image    | `src`, `lazy-src`, `aspect-ratio`, `cover` |

### Feedback

| Component             | Purpose             | Key Props                                          |
| --------------------- | ------------------- | -------------------------------------------------- |
| `v-dialog`            | Modal dialog        | `v-model`, `max-width`, `persistent`, `fullscreen` |
| `v-snackbar`          | Toast notification  | `v-model`, `timeout`, `location`, `color`          |
| `v-alert`             | Status message      | `type`, `variant`, `closable`, `title`             |
| `v-progress-linear`   | Progress bar        | `v-model`, `color`, `indeterminate`                |
| `v-progress-circular` | Loading spinner     | `size`, `width`, `color`, `indeterminate`          |
| `v-skeleton-loader`   | Loading placeholder | `type`, `loading`                                  |
| `v-overlay`           | Full-screen overlay | `v-model`, `persistent`, `scrim`                   |

---

## Theme Configuration Reference

```typescript
createVuetify({
  theme: {
    defaultTheme: "light", // "light" | "dark" | custom name
    themes: {
      light: {
        dark: false,
        colors: {
          background: "#FFFFFF",
          surface: "#FFFFFF",
          primary: "#1867C0",
          secondary: "#5CBBF6",
          error: "#FF5252",
          info: "#2196F3",
          success: "#4CAF50",
          warning: "#FFC107",
          // "on-*" colors for contrast text
          "on-primary": "#FFFFFF",
          "on-secondary": "#000000",
        },
      },
      dark: {
        dark: true,
        colors: {
          background: "#121212",
          surface: "#212121",
          primary: "#2196F3",
          // ...
        },
      },
    },
    variations: {
      colors: ["primary", "secondary"],
      lighten: 2, // generates primary-lighten-1, primary-lighten-2
      darken: 2, // generates primary-darken-1, primary-darken-2
    },
  },
});
```

---

## Display Breakpoints Reference

| Breakpoint | Default Min-Width | Typical Use      |
| ---------- | ----------------- | ---------------- |
| `xs`       | 0px               | Mobile portrait  |
| `sm`       | 600px             | Mobile landscape |
| `md`       | 960px             | Tablet           |
| `lg`       | 1280px            | Desktop          |
| `xl`       | 1920px            | Large desktop    |
| `xxl`      | 2560px            | Ultra-wide       |

**In templates:** `<v-col cols="12" md="6" lg="4">`

**In script:** `const { mobile, mdAndUp, lgAndUp, name } = useDisplay()`

**Note:** Vuetify breakpoints differ from common CSS frameworks (md is 960px, not 768px).

---

## Density Reference

| Value           | Effect           | Use Case               |
| --------------- | ---------------- | ---------------------- |
| `"default"`     | Standard spacing | General-purpose UI     |
| `"comfortable"` | Slightly reduced | Data-dense views       |
| `"compact"`     | Minimum spacing  | Admin tables, toolbars |

Applies to: `v-btn`, `v-text-field`, `v-select`, `v-data-table`, `v-list`, `v-tabs`, and most input/display components.

Set globally: `defaults: { global: { density: "comfortable" } }`

---

## Variant Reference

| Value             | Effect            | Components                             |
| ----------------- | ----------------- | -------------------------------------- |
| `"elevated"`      | Shadow (default)  | `v-btn`, `v-card`                      |
| `"flat"`          | No shadow         | `v-btn`, `v-card`, `v-alert`           |
| `"tonal"`         | Muted background  | `v-btn`, `v-chip`, `v-alert`           |
| `"outlined"`      | Border only       | `v-btn`, `v-card`, `v-chip`, `v-alert` |
| `"text"`          | No background     | `v-btn`, `v-chip`                      |
| `"plain"`         | Transparent + dim | `v-btn`, `v-chip`                      |
| `"filled"`        | Filled background | `v-text-field`, `v-select`             |
| `"solo"`          | Elevated input    | `v-text-field`, `v-select`             |
| `"solo-filled"`   | Filled + solo     | `v-text-field`, `v-select`             |
| `"solo-inverted"` | Inverted solo     | `v-text-field`, `v-select`             |
| `"underlined"`    | Bottom border     | `v-text-field`, `v-select`             |

---

## Decision Frameworks

### Customization Approach

```
What do you need to customize?
+-- Default props for all instances --> defaults in createVuetify()
+-- Props for a section of the page --> v-defaults-provider
+-- Runtime colors/dark mode --> theme in createVuetify() + useTheme()
+-- CSS-level changes (radius, height, font) --> SASS variables
+-- Specific internal element --> Named slot (v-slot:prepend, v-slot:item)
+-- Component structure/layout --> Template composition
```

### Data Table Selection

```
What kind of data display?
+-- Simple static table --> v-table (HTML table wrapper)
+-- Client-side sort/filter/paginate --> v-data-table
+-- Server-side sort/filter/paginate --> v-data-table-server
+-- Large dataset (1000+ rows, no pagination) --> v-data-table-virtual
+-- Grouped data --> v-data-table with group-by prop
```

### Input Component Selection

```
What kind of user input?
+-- Free text (single line) --> v-text-field
+-- Free text (multi line) --> v-textarea
+-- Select from fixed list --> v-select
+-- Select with search/filter --> v-autocomplete
+-- Select or create new --> v-combobox
+-- Boolean toggle --> v-switch or v-checkbox
+-- Single choice from few options --> v-radio-group
+-- Numeric range --> v-slider or v-range-slider
+-- File upload --> v-file-input
+-- Date/time --> v-date-picker (lab component)
```

### Navigation Layout

```
What navigation pattern?
+-- Persistent sidebar --> v-navigation-drawer permanent
+-- Collapsible sidebar --> v-navigation-drawer with v-model
+-- Mini sidebar (icons only) --> v-navigation-drawer rail
+-- Mobile bottom nav --> v-bottom-navigation
+-- Top tabs --> v-tabs
+-- Breadcrumb trail --> v-breadcrumbs
```

---

## Composables Reference

| Composable     | Returns                                         | Purpose                       |
| -------------- | ----------------------------------------------- | ----------------------------- |
| `useTheme()`   | `global.name`, `global.current`, theme methods  | Read/toggle theme             |
| `useDisplay()` | `mobile`, `smAndUp`, `mdAndUp`, `name`, `width` | Reactive breakpoint state     |
| `useDate()`    | Date adapter methods                            | Date formatting/parsing       |
| `useRules()`   | `required()`, `email()`, `minLength()`, etc.    | Form validation rule builders |
| `useLocale()`  | `current`, `fallback`, `t()`                    | i18n access                   |
| `useLayout()`  | Layout measurements                             | Read app layout dimensions    |

**Import:** All from `"vuetify"` except `useRules` from `"vuetify/labs/rules"`.

---

## SASS Variables Quick Reference

```scss
@use "vuetify/settings" with (
    $body-font-family: "Inter",
    sans-serif,
    $heading-font-family: "Poppins",
    sans-serif,
    $border-radius-root: 8px,
    $button-height: 44px,
    $button-border-radius: 8px,
    $button-text-transform: none,
    $button-font-weight: 600,
    $card-border-radius: 12px,
    $card-elevation: 2,
    $text-field-border-radius: 8px
  );
```

**Requires build plugin configuration:**

```typescript
// vite.config.ts
import vuetify from "vite-plugin-vuetify";

export default {
  plugins: [
    vuetify({
      autoImport: true,
      styles: { configFile: "src/styles/vuetify-settings.scss" },
    }),
  ],
};
```

---

## Anti-Patterns

### Using Options API Patterns in Composition API

```typescript
// WRONG: Options API access
this.$vuetify.theme.global.name = "dark";

// CORRECT: Composable access
const theme = useTheme();
theme.global.name.value = "dark";
```

### Importing Everything Without Tree-Shaking

```typescript
// WRONG: Imports all components (~500KB+)
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

// CORRECT: Use vite-plugin-vuetify for automatic imports
// Components are tree-shaken -- only used ones are bundled
```

### Overriding Styles with !important

```scss
// WRONG: Fragile, breaks on version updates
.v-btn {
  border-radius: 8px !important;
}

// CORRECT: Use SASS variables (compile-time)
// @use 'vuetify/settings' with ($button-border-radius: 8px);

// CORRECT: Or use defaults (runtime)
// defaults: { VBtn: { rounded: "lg" } }
```

### Repeating Props Instead of Using Defaults

```vue
<!-- WRONG: Same props on every instance -->
<v-btn variant="outlined" density="compact" rounded="lg">Save</v-btn>
<v-btn variant="outlined" density="compact" rounded="lg">Cancel</v-btn>

<!-- CORRECT: Set once in defaults, use clean templates -->
<!-- In createVuetify: defaults: { VBtn: { variant: "outlined", density: "compact", rounded: "lg" } } -->
<v-btn>Save</v-btn>
<v-btn>Cancel</v-btn>
```

---

## Installation Reference

### Core (Vite -- recommended)

```bash
npm i vuetify vite-plugin-vuetify @mdi/font
```

### Core (Webpack)

```bash
npm i vuetify webpack-plugin-vuetify @mdi/font
```

### With SASS Customization

```bash
npm i vuetify vite-plugin-vuetify @mdi/font sass
```

### Icon Sets

```bash
# Material Design Icons (default, font-based)
npm i @mdi/font

# Material Design Icons (SVG, tree-shakeable)
npm i @mdi/js

# Font Awesome
npm i @fortawesome/fontawesome-free
```
