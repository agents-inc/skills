---
name: web-ui-vuetify
description: Material Design component library for Vue 3
---

# Vuetify Patterns

> **Quick Guide:** Vuetify ships eighty-odd pre-styled Vue 3 components implementing Material Design,
> configured through a single `createVuetify()` call. The thing to learn first is that it has three
> customisation layers — theme, defaults and SASS — and they are not interchangeable. Customisation
> goes through whichever layer owns the property; reaching for CSS overrides usually means the wrong
> layer was chosen. Vuetify is template-driven throughout — named
> slots replace internal markup, so a wrapper `div` is rarely the answer. Current major: v3.x, with
> `useRules` for validation and `v-defaults-provider` for scoped prop cascading.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — plugin setup, themes, defaults, SASS, blueprints, icons, SSR
- [examples/data-tables.md](examples/data-tables.md) — headers, column slots, server-side, virtual, grouping
- [examples/forms.md](examples/forms.md) — `v-form`, rules, `useRules`, input components
- [examples/layout.md](examples/layout.md) — `v-app`, app bar, drawers, grid, dialogs, snackbars
- [reference.md](reference.md) — component tables, breakpoints, density and variant values, anti-patterns

---

## Which path applies

**Whether the build plugin is installed changes what you write in two files.**

- **With `vite-plugin-vuetify` or `webpack-plugin-vuetify`.** Components resolve and tree-shake
  automatically, so nothing is imported by hand and `"vuetify/styles"` is not imported at all. SASS
  variable overrides are only available on this path, through `styles.configFile`. See
  [examples/core.md](examples/core.md).
- **Without it.** Import `vuetify/components` and `vuetify/directives` and register them, and import
  `"vuetify/styles"` in the entry file. Everything ships, so the bundle carries every component.

---

<critical_requirements>

## Before writing Vuetify code

**Register the plugin with `app.use(vuetify)`.** Every component resolves through it, so without the
registration Vue treats `<v-btn>` as an unknown element and renders an empty custom tag rather than
raising an error.

**Wrap the application in `v-app`.** It is the coordinate system the layout components register with,
which is how an app bar and a drawer know to inset `v-main` instead of covering it.

**Set repeated props once, in `defaults` or `v-defaults-provider`.** A `variant` restated on every
instance is a decision re-made at every call site, and the two mechanisms cover the global and the
sectional case without a stylesheet.

**Customise through slots before reaching for CSS.** Every internal element of a component has a
named slot, so replacing one is a `<template v-slot:…>` rather than a selector that a version bump
can break.

**Define `v-data-table` headers outside the template.** An array literal in the template is a new
identity on every parent render, which re-renders the whole table each time.

**Use the composables, not `this.$vuetify`.** `useTheme()`, `useDisplay()`, `useDate()` and
`useLocale()` are the Composition API surface; the instance property belongs to the Options API and
is not available in `<script setup>`.

</critical_requirements>

---

**Auto-detection:** vuetify, createVuetify, vuetify/styles, vuetify/blueprints, vuetify/settings,
vuetify/iconsets, vite-plugin-vuetify, webpack-plugin-vuetify, v-app, v-main, v-btn, v-card,
v-data-table, v-data-table-server, v-data-table-virtual, v-text-field, v-select, v-autocomplete,
v-dialog, v-navigation-drawer, v-app-bar, v-snackbar, v-form, v-defaults-provider,
v-theme-provider, useTheme, useDisplay, useDate, useRules, useLocale, mdi-, `$vuetify`

**Applies to:**

- Configuring the library: themes, blueprints, defaults, icon sets, SSR
- Choosing which customisation layer a change belongs in
- Composing the shipped components — layout, inputs, data tables, overlays, feedback
- Slot-based customisation of a component's internals
- Form validation through `rules` arrays and `useRules`
- Responsive behaviour through the grid props and `useDisplay`

**Handled elsewhere:**

- Vue itself — reactivity, component authoring, lifecycle and the composables you write
- Routing, and what a navigation item links to
- Application state beyond a component's own — the components take values and emit changes
- Data fetching. `v-data-table-server` reports what the user asked for and renders what arrives
- General CSS technique. Vuetify's own three layers are in scope; a stylesheet architecture around
  them is not

---

<philosophy>

Vuetify is opinionated on purpose. It is not a set of primitives you assemble a design system from —
it is a design system, already assembled, that you adjust. Fighting that is the single largest source
of trouble with it.

**The adjustment happens in three layers, and picking the right one is most of the skill:**

1. **Theme** — colours and dark mode, resolved at runtime into CSS custom properties. Everything
   inherits automatically, and a theme switch is reactive across the whole tree.
2. **Defaults** — prop values, globally in `createVuetify()` or scoped by `v-defaults-provider`.
   This is the layer people underuse: it changes behaviour as well as appearance, it nests and
   cascades like CSS scoping, and it costs nothing at runtime.
3. **SASS** — compile-time CSS variables for the things props do not expose: font families, base
   radius, element heights. Fixed at build time, and only available with the build plugin.

A property belongs to exactly one of these. Reaching for a stylesheet override, and especially for
`!important`, almost always means the property was available a layer up.

</philosophy>

---

<decision_framework>

## Which layer to customise in

| What you are changing                       | Layer                                               |
| ------------------------------------------- | --------------------------------------------------- |
| Colours, or dark mode                       | `theme` in `createVuetify()`, read via `useTheme()` |
| Default props everywhere                    | `defaults` in `createVuetify()`                     |
| Default props for one part of the page      | `v-defaults-provider`                               |
| Radius, heights, fonts — anything CSS-level | SASS variables via `@use "vuetify/settings"`        |
| One internal element of a component         | Its named slot                                      |
| The arrangement of several components       | Ordinary template composition                       |

## Which table component

```
Static rows, no interaction        → v-table          (a styled HTML table)
Sorting, filtering, paging locally → v-data-table
The server does the sorting/paging → v-data-table-server   (separate component, not a prop)
Thousands of rows, no paging       → v-data-table-virtual  (height is required)
Rows grouped under headings        → v-data-table with group-by
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Plugin setup

One `createVuetify()` call carries the theme, the defaults, the icon set and the locale, and every
component reads from it.

```typescript
import { createVuetify } from "vuetify";

const vuetify = createVuetify({
  theme: {
    defaultTheme: "light",
    themes: { light: { colors: { primary: "#1867C0" } } },
  },
  defaults: {
    VBtn: { variant: "flat", rounded: "lg" },
    VTextField: { variant: "outlined", density: "comfortable" },
  },
});

createApp(App).use(vuetify).mount("#app");
```

Blueprints, SASS overrides, TypeScript augmentation, SSR and the SVG icon set are in
[examples/core.md](examples/core.md).

### Pattern 2: Theming and dark mode

Themes become CSS custom properties, so switching one updates every component reactively without a
re-render of your own.

```vue
<script setup>
import { useTheme } from "vuetify";

const theme = useTheme();

function toggleTheme() {
  theme.global.name.value = theme.global.current.value.dark ? "light" : "dark";
}
</script>
```

`theme.global.name` is a ref — assign to `.value`. Colours are also reachable in CSS as
`rgb(var(--v-theme-primary))`.

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Global and scoped defaults

`defaults` sets prop values for a component type. `v-defaults-provider` does the same for a subtree,
merging with whatever is already in scope.

```vue
<v-defaults-provider
  :defaults="{
    VBtn: { color: 'secondary', variant: 'tonal' },
    VCard: { elevation: 0, border: true },
  }"
>
  <v-card>
    <v-btn>Tonal and secondary, with no props of its own</v-btn>
  </v-card>
</v-defaults-provider>
```

Explicit props on an instance always win over a default, so this narrows the baseline rather than
overriding anything.

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Slot-based customisation

Every internal element has a named slot. Replacing one keeps the component's behaviour, its
accessibility wiring and its density handling, all of which a wrapper `div` would sit outside of.

```vue
<v-text-field label="Amount" type="number">
  <template v-slot:prepend-inner>
    <v-icon>mdi-currency-usd</v-icon>
  </template>
</v-text-field>
```

Full code: [examples/data-tables.md](examples/data-tables.md) for the per-column slots,
[examples/layout.md](examples/layout.md) for activator and append slots.

### Pattern 5: Data tables

`v-data-table` handles sorting, paging, searching and selection. Columns are customised with
`v-slot:item.<key>`, matching the header's `key`.

```vue
<script setup>
const headers = [
  { title: "Name", key: "name" },
  { title: "Status", key: "status" },
  { title: "Actions", key: "actions", sortable: false },
];
</script>

<template>
  <v-data-table :items="items" :headers="headers" item-value="id">
    <template v-slot:item.status="{ item }">
      <v-chip
        :color="item.status === 'active' ? 'success' : 'error'"
        size="small"
      >
        {{ item.status }}
      </v-chip>
    </template>
  </v-data-table>
</template>
```

Full code: [examples/data-tables.md](examples/data-tables.md)

### Pattern 6: Form validation

Rules are plain functions returning `true` or an error string. `useRules` supplies the common ones
already written.

```vue
<script setup>
import { useRules } from "vuetify/labs/rules";

const rules = useRules();
</script>

<template>
  <v-form ref="form" validate-on="submit" @submit.prevent="onSubmit">
    <v-text-field
      v-model="email"
      label="Email"
      :rules="[rules.required(), rules.email()]"
    />
    <v-btn type="submit" color="primary">Submit</v-btn>
  </v-form>
</template>
```

`validate-on` decides when rules run — `"submit"` keeps a form quiet until the user is finished,
where the default validates on every keystroke.

Full code: [examples/forms.md](examples/forms.md)

### Pattern 7: Responsive behaviour with `useDisplay`

The grid props cover responsive _layout_. `useDisplay` covers responsive _logic_ — deciding which
component to render, not how wide it is.

```vue
<script setup>
import { useDisplay } from "vuetify";

const { mobile, mdAndUp } = useDisplay();
</script>

<template>
  <v-navigation-drawer :permanent="mdAndUp" :temporary="!mdAndUp" />
  <v-app-bar :density="mobile ? 'compact' : 'default'" />
</template>
```

Full code: [examples/layout.md](examples/layout.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- No `app.use(vuetify)` — Vue does not recognise the components, so they render as empty custom
  elements with no error to explain it
- No `import "vuetify/styles"` on the manual-import path — every component mounts and none is styled
- `this.$vuetify` inside `<script setup>` — there is no component instance there; use the composables
- `v-col` without a `v-row` parent, or `v-row` outside `v-container` — the grid depends on the full
  nesting and silently collapses without it
- Header or column arrays written inline on `v-data-table` — a new identity per parent render, so the
  whole table re-renders every time
- `v-data-table` with hand-rolled server paging — `v-data-table-server` is a separate component, and
  the client-side one will page the page it was given
- `v-data-table-virtual` without `height` — the virtual scroller has no viewport to measure and
  renders nothing

**Surprising behaviour:**

- `density` takes `"default"`, `"comfortable"` or `"compact"` — it is not numeric
- Vuetify's breakpoints are not the common CSS ones: `md` starts at 960px, not 768px
- `v-defaults-provider` merges with the provider above it rather than replacing it, and the innermost
  value wins
- `theme.variations` generates `primary-lighten-1`, `primary-darken-2` and so on automatically —
  declaring them by hand shadows the generated set
- `v-if` on a dialog or drawer destroys it instead of closing it, losing the transition and any
  internal state; `v-model` is what toggles visibility
- SASS variable overrides need the build plugin with `styles.configFile` — without it the file is
  never compiled and the overrides silently do nothing
- `"on-primary"` is the text colour used _on_ a primary background, not a primary-tinted text
- `v-select` and `v-autocomplete` bind `item-value` unless `return-object` is set, so the model holds
  a key rather than the object it came from

</red_flags>
