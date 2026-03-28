# Vuetify -- Layout & Navigation

> v-app structure, app bar, navigation drawer, grid system, responsive patterns. See [SKILL.md](../SKILL.md) for overview.

**Related examples:**

- [core.md](core.md) -- Plugin setup, theming, defaults
- [data-tables.md](data-tables.md) -- Data table patterns
- [forms.md](forms.md) -- Input components, validation

---

## Application Shell

Every Vuetify app uses `v-app` as the root element. Layout components (`v-app-bar`, `v-navigation-drawer`, `v-footer`) register with `v-app` to coordinate spacing.

```vue
<template>
  <v-app>
    <v-app-bar title="My App" density="comfortable">
      <template v-slot:prepend>
        <v-app-bar-nav-icon @click="drawer = !drawer" />
      </template>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer">
      <v-list density="compact" nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.title"
          :prepend-icon="item.icon"
          :title="item.title"
          :value="item.title"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container>
        <!-- Page content -->
      </v-container>
    </v-main>

    <v-footer app>
      <span>&copy; 2026</span>
    </v-footer>
  </v-app>
</template>

<script setup>
import { ref } from "vue";

const drawer = ref(true);

const navItems = [
  { title: "Dashboard", icon: "mdi-view-dashboard" },
  { title: "Users", icon: "mdi-account-group" },
  { title: "Settings", icon: "mdi-cog" },
];
</script>
```

**Key points:**

- `v-app` is required -- it manages the application layout coordinate system
- `v-main` wraps the scrollable content area and auto-adjusts for app bars and drawers
- Layout components self-register with `v-app` -- no manual padding needed on `v-main`
- `v-app-bar-nav-icon` is a pre-styled hamburger icon button

---

## Navigation Drawer Variants

### Permanent Sidebar (Desktop)

```vue
<v-navigation-drawer permanent>
  <v-list nav>
    <v-list-item prepend-icon="mdi-home" title="Home" />
    <v-list-item prepend-icon="mdi-chart-bar" title="Analytics" />
  </v-list>
</v-navigation-drawer>
```

### Rail (Mini) Sidebar

```vue
<script setup>
import { ref } from "vue";

const rail = ref(true);
</script>

<template>
  <v-navigation-drawer :rail="rail" permanent @click="rail = false">
    <v-list density="compact" nav>
      <v-list-item prepend-icon="mdi-home" title="Home" :active="false" />
      <v-list-item
        prepend-icon="mdi-chart-bar"
        title="Analytics"
        :active="false"
      />
    </v-list>

    <template v-slot:append>
      <v-btn
        :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
        variant="text"
        @click.stop="rail = !rail"
      />
    </template>
  </v-navigation-drawer>
</template>
```

**Key points:**

- `rail` collapses the drawer to icon-only width (~56px)
- `permanent` keeps the drawer visible (it does not overlay content)
- `v-slot:append` places content at the bottom of the drawer

### Temporary (Mobile) Drawer

```vue
<v-navigation-drawer v-model="drawer" temporary>
  <!-- Shows as overlay, closes on outside click -->
</v-navigation-drawer>
```

### Responsive Pattern

```vue
<script setup>
import { ref } from "vue";
import { useDisplay } from "vuetify";

const { mdAndUp } = useDisplay();
const drawer = ref(true);
</script>

<template>
  <v-navigation-drawer
    v-model="drawer"
    :permanent="mdAndUp"
    :temporary="!mdAndUp"
  >
    <!-- Permanent on desktop, overlay on mobile -->
  </v-navigation-drawer>
</template>
```

---

## Grid System

Vuetify uses a 12-column flexbox grid: `v-container` > `v-row` > `v-col`.

```vue
<template>
  <v-container>
    <!-- Equal columns -->
    <v-row>
      <v-col cols="12" md="4">Sidebar</v-col>
      <v-col cols="12" md="8">Main Content</v-col>
    </v-row>

    <!-- Auto-sized columns -->
    <v-row>
      <v-col>Auto 1</v-col>
      <v-col>Auto 2</v-col>
      <v-col>Auto 3</v-col>
    </v-row>

    <!-- With spacing and alignment -->
    <v-row dense align="center" justify="space-between">
      <v-col cols="auto">
        <v-btn>Left</v-btn>
      </v-col>
      <v-col cols="auto">
        <v-btn>Right</v-btn>
      </v-col>
    </v-row>

    <!-- Offset -->
    <v-row>
      <v-col cols="6" offset="3">Centered 50% width</v-col>
    </v-row>
  </v-container>
</template>
```

**Key points:**

- `cols` sets the default (xs) column span; `sm`, `md`, `lg`, `xl`, `xxl` set responsive overrides
- `v-col` without `cols` auto-sizes to fill available space equally
- `cols="auto"` sizes to content width
- `dense` on `v-row` reduces gutter spacing
- `no-gutters` on `v-row` removes gutters entirely
- `v-col` MUST be a direct child of `v-row`, and `v-row` MUST be inside `v-container` (or `v-col` for nesting)

---

## App Bar with Scroll Behavior

```vue
<template>
  <v-app-bar
    scroll-behavior="hide elevate"
    scroll-threshold="100"
    color="surface"
    density="comfortable"
  >
    <v-app-bar-nav-icon @click="drawer = !drawer" />
    <v-app-bar-title>Dashboard</v-app-bar-title>
    <v-spacer />
    <v-btn icon="mdi-magnify" />
    <v-btn icon="mdi-bell" />
    <v-avatar image="/avatar.jpg" size="32" class="me-2" />
  </v-app-bar>
</template>
```

**Scroll behavior values:**

| Value          | Effect                                     |
| -------------- | ------------------------------------------ |
| `"hide"`       | Hides on scroll down, shows on scroll up   |
| `"elevate"`    | Adds shadow after scrolling past threshold |
| `"collapse"`   | Collapses to a smaller bar on scroll       |
| `"fade-image"` | Fades app bar image on scroll              |
| `"inverted"`   | Reverses the behavior direction            |

Combine with spaces: `"hide elevate"` hides AND elevates.

---

## Tabs with Dynamic Content

```vue
<script setup>
import { ref } from "vue";

const activeTab = ref("overview");

const tabs = [
  { value: "overview", title: "Overview", icon: "mdi-view-dashboard" },
  { value: "details", title: "Details", icon: "mdi-text" },
  { value: "settings", title: "Settings", icon: "mdi-cog" },
];
</script>

<template>
  <v-card>
    <v-tabs v-model="activeTab" color="primary" align-tabs="start">
      <v-tab
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :prepend-icon="tab.icon"
      >
        {{ tab.title }}
      </v-tab>
    </v-tabs>

    <v-card-text>
      <v-tabs-window v-model="activeTab">
        <v-tabs-window-item value="overview">
          Overview content
        </v-tabs-window-item>
        <v-tabs-window-item value="details">
          Details content
        </v-tabs-window-item>
        <v-tabs-window-item value="settings">
          Settings content
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>
  </v-card>
</template>
```

**Key points:**

- `v-tabs` + `v-tabs-window` share the same `v-model` for synchronization
- `v-tabs-window-item` lazily mounts content by default (use `eager` prop to pre-render)
- `align-tabs`: `"start"`, `"center"`, `"end"`, or `"title"` (flush with toolbar title)

---

## Dialog Patterns

```vue
<script setup>
import { ref } from "vue";

const dialog = ref(false);
const confirmDialog = ref(false);

function handleConfirm() {
  // Perform action
  confirmDialog.value = false;
}
</script>

<template>
  <!-- Basic dialog -->
  <v-dialog v-model="dialog" max-width="600">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" color="primary">Open Dialog</v-btn>
    </template>
    <v-card title="Dialog Title">
      <v-card-text>Dialog content goes here.</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="dialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Confirmation dialog (persistent -- no close on outside click) -->
  <v-dialog v-model="confirmDialog" max-width="400" persistent>
    <v-card>
      <v-card-title>Confirm Deletion</v-card-title>
      <v-card-text>This action cannot be undone.</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmDialog = false">Cancel</v-btn>
        <v-btn color="error" variant="flat" @click="handleConfirm"
          >Delete</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
```

**Key points:**

- `v-slot:activator="{ props }"` + `v-bind="props"` auto-wires open/close without manual `v-model` toggling
- `persistent` prevents closing on backdrop click or Escape key
- `max-width` constrains dialog size -- use `fullscreen` prop for mobile full-screen dialogs
- Always use `v-model` for dialog visibility, not `v-if` (preserves transition animations)

---

## Snackbar (Toast Notifications)

```vue
<script setup>
import { ref } from "vue";

const SNACKBAR_TIMEOUT_MS = 4000;
const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref("");

function showNotification(text: string, color: string) {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
}
</script>

<template>
  <v-snackbar
    v-model="snackbar"
    :timeout="SNACKBAR_TIMEOUT_MS"
    :color="snackbarColor"
    location="bottom end"
  >
    {{ snackbarText }}
    <template v-slot:actions>
      <v-btn variant="text" @click="snackbar = false">Close</v-btn>
    </template>
  </v-snackbar>
</template>
```

**`location` values:** `"top"`, `"bottom"`, `"top start"`, `"top end"`, `"bottom start"`, `"bottom end"`.
