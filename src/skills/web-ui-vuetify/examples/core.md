# Vuetify -- Setup, Theming & Defaults

> Core setup, theme configuration, SASS variables, blueprints, defaults system, and composables. See [SKILL.md](../SKILL.md) for pattern overview.

**Related examples:**

- [data-tables.md](data-tables.md) -- v-data-table headers, slots, server-side
- [forms.md](forms.md) -- v-form, validation rules, useRules
- [layout.md](layout.md) -- v-app, navigation drawers, grid system

---

## Production-Ready Plugin Setup

```typescript
// plugins/vuetify.ts
import { createVuetify } from "vuetify";
import { md3 } from "vuetify/blueprints";
import { mdi } from "vuetify/iconsets/mdi";

const vuetify = createVuetify({
  blueprint: md3,
  theme: {
    defaultTheme: "light",
    themes: {
      light: {
        dark: false,
        colors: {
          primary: "#1867C0",
          secondary: "#5CBBF6",
          accent: "#82B1FF",
          error: "#FF5252",
          info: "#2196F3",
          success: "#4CAF50",
          warning: "#FFC107",
          background: "#FAFAFA",
          surface: "#FFFFFF",
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: "#2196F3",
          secondary: "#424242",
          accent: "#FF4081",
          error: "#FF5252",
          info: "#2196F3",
          success: "#4CAF50",
          warning: "#FB8C00",
          background: "#121212",
          surface: "#212121",
        },
      },
    },
    variations: {
      colors: ["primary", "secondary"],
      lighten: 2,
      darken: 2,
    },
  },
  defaults: {
    VBtn: { variant: "flat", rounded: "lg" },
    VCard: { elevation: 2, rounded: "lg" },
    VTextField: { variant: "outlined", density: "comfortable" },
    VSelect: { variant: "outlined", density: "comfortable" },
    VAutocomplete: { variant: "outlined", density: "comfortable" },
  },
  icons: {
    defaultSet: "mdi",
    sets: { mdi },
  },
});

export { vuetify };
```

```typescript
// main.ts
import { createApp } from "vue";
import { vuetify } from "./plugins/vuetify";
import App from "./App.vue";

import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

const app = createApp(App);
app.use(vuetify);
app.mount("#app");
```

**Key points:**

- `blueprint: md3` applies Material Design 3 defaults (rounded shapes, tonal buttons, comfortable density)
- `variations` auto-generates `primary-lighten-1`, `primary-darken-2`, etc.
- `defaults` eliminate prop repetition -- every `VTextField` gets `outlined` + `comfortable` without specifying it
- Icon font import is required when using `@mdi/font` -- without it, icons render as blank squares
- `"vuetify/styles"` import is required when NOT using `vite-plugin-vuetify` with `autoImport`

---

## Vite Plugin Configuration

```typescript
// vite.config.ts
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";

export default {
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
    }),
  ],
};
```

With `autoImport: true`, you do not need to import components or `"vuetify/styles"` manually. Components used in templates are auto-resolved and tree-shaken.

### With SASS Variable Customization

```typescript
export default {
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
      styles: {
        configFile: "src/styles/vuetify-settings.scss",
      },
    }),
  ],
};
```

The `configFile` path is relative to the project root. SASS customization requires the `sass` package as a dev dependency.

---

## SASS Variable Customization

```scss
// src/styles/vuetify-settings.scss
@use "vuetify/settings" with (
    // Global
    $body-font-family: "Inter",
    sans-serif,
    $heading-font-family: "Poppins",
    sans-serif,
    $border-radius-root: 8px,

    // Buttons
    $button-height: 44px,
    $button-border-radius: 8px,
    $button-text-transform: none,
    $button-font-weight: 600,
    $button-letter-spacing: 0,

    // Cards
    $card-border-radius: 12px,
    $card-elevation: 2,

    // Inputs
    $text-field-border-radius: 8px,

    // Navigation
    $navigation-drawer-border-radius: 0 16px 16px 0,

    // Chips
    $chip-border-radius: 16px
  );
```

**When to use SASS vs theme vs defaults:**

- SASS variables: compile-time CSS changes (font family, border radius, element heights). These cannot change at runtime.
- Theme colors: runtime color palette, dark mode. Theme values become CSS custom properties.
- Defaults: runtime prop values. Changes component behavior, not just styling.

---

## Custom Theme with Brand Colors

```typescript
const vuetify = createVuetify({
  theme: {
    defaultTheme: "brandLight",
    themes: {
      brandLight: {
        dark: false,
        colors: {
          primary: "#6200EE",
          "primary-darken-1": "#3700B3",
          secondary: "#03DAC6",
          "secondary-darken-1": "#018786",
          background: "#FAFAFA",
          surface: "#FFFFFF",
          error: "#B00020",
          "on-primary": "#FFFFFF",
          "on-secondary": "#000000",
          "on-background": "#1C1B1F",
          "on-surface": "#1C1B1F",
          "on-error": "#FFFFFF",
        },
      },
      brandDark: {
        dark: true,
        colors: {
          primary: "#BB86FC",
          "primary-darken-1": "#3700B3",
          secondary: "#03DAC6",
          background: "#121212",
          surface: "#1E1E1E",
          error: "#CF6679",
          "on-primary": "#000000",
          "on-secondary": "#000000",
          "on-background": "#E6E1E5",
          "on-surface": "#E6E1E5",
          "on-error": "#000000",
        },
      },
    },
  },
});
```

**Key points:**

- `"on-*"` colors set contrast text for their counterpart (e.g., `on-primary` is the text color used on primary-colored backgrounds)
- Custom theme names must be referenced in `defaultTheme` or `useTheme().global.name.value`
- Theme colors are accessible in templates via `color="primary"` or in CSS via `rgb(var(--v-theme-primary))`

---

## Theme Toggle Component

```vue
<script setup>
import { useTheme } from "vuetify";

const theme = useTheme();

function toggleTheme() {
  const isDark = theme.global.current.value.dark;
  theme.global.name.value = isDark ? "light" : "dark";
}
</script>

<template>
  <v-btn
    :icon="
      theme.global.current.value.dark
        ? 'mdi-weather-sunny'
        : 'mdi-weather-night'
    "
    @click="toggleTheme"
    variant="text"
  />
</template>
```

**Key points:**

- `theme.global.name` is a `Ref<string>` -- assign to `.value` to switch themes
- `theme.global.current.value.dark` returns `boolean` for the active theme
- Theme switch is reactive -- all components update immediately

---

## Scoped Defaults with v-defaults-provider

```vue
<template>
  <v-container>
    <!-- Admin section: compact, outlined inputs -->
    <v-defaults-provider
      :defaults="{
        VBtn: { variant: 'tonal', density: 'compact' },
        VTextField: {
          variant: 'outlined',
          density: 'compact',
          hideDetails: 'auto',
        },
        VSelect: {
          variant: 'outlined',
          density: 'compact',
          hideDetails: 'auto',
        },
      }"
    >
      <v-card title="Admin Panel">
        <v-card-text>
          <!-- These inherit compact + outlined without explicit props -->
          <v-text-field label="Search" />
          <v-select label="Filter" :items="['All', 'Active', 'Archived']" />
          <v-btn>Apply</v-btn>
        </v-card-text>
      </v-card>
    </v-defaults-provider>

    <!-- Marketing section: elevated, large inputs -->
    <v-defaults-provider
      :defaults="{
        VBtn: { variant: 'elevated', size: 'large', rounded: 'xl' },
        VTextField: { variant: 'solo', density: 'default' },
      }"
    >
      <v-card title="Subscribe">
        <v-card-text>
          <v-text-field label="Your email" />
          <v-btn color="primary">Subscribe</v-btn>
        </v-card-text>
      </v-card>
    </v-defaults-provider>
  </v-container>
</template>
```

**Key points:**

- Scoped defaults cascade: nested `v-defaults-provider` merges with parent, later values win
- Props set explicitly on a component always override defaults
- Use scoped defaults to create visually distinct sections without CSS

---

## TypeScript Theme Augmentation

```typescript
// types/vuetify.d.ts
import "vuetify";

declare module "vuetify" {
  interface ThemeDefinition {
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      // Add custom color names for type safety
      brand?: string;
      neutral?: string;
    };
  }
}
```

**Note:** Vuetify's theme system is more flexible than MUI's -- you can add arbitrary color keys to `colors` without augmentation and use them via `color="brand"`. TypeScript augmentation adds autocomplete but is not strictly required for functionality.

---

## SSR Configuration

```typescript
const vuetify = createVuetify({
  ssr: true,
  theme: {
    defaultTheme: "light",
    themes: {
      light: {
        /* ... */
      },
      dark: {
        /* ... */
      },
    },
  },
});
```

When `ssr: true`:

- Theme CSS is inlined during server render (no flash of unstyled content)
- `useDisplay()` returns server-safe defaults until hydration
- `useTheme()` is available in both server and client contexts

---

## SVG Icon Set (Tree-Shakeable)

```typescript
import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import { mdiAccount, mdiHome, mdiMagnify } from "@mdi/js";

const vuetify = createVuetify({
  icons: {
    defaultSet: "mdi",
    aliases: {
      ...aliases,
      account: mdiAccount,
      home: mdiHome,
      search: mdiMagnify,
    },
    sets: { mdi },
  },
});
```

```vue
<template>
  <!-- Use alias -->
  <v-icon icon="$account" />
  <!-- Use raw SVG path -->
  <v-icon :icon="mdiHome" />
</template>

<script setup>
import { mdiHome } from "@mdi/js";
</script>
```

**When to use SVG vs font icons:**

- Font (`@mdi/font`): simpler setup, all 7000+ icons available, ~250KB added to bundle
- SVG (`@mdi/js`): tree-shakeable, only used icons bundled, slightly more verbose imports
