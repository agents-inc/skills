# Vue 3 Composition API - Provide/Inject Examples

> Type-safe dependency injection and context patterns. See [SKILL.md](../SKILL.md) for concepts.

---

## Type-Safe Injection Key

### Good Example - Typed injection key definition

```typescript
// contexts/theme.ts
import type { InjectionKey, Ref, ComputedRef } from "vue";

export type Theme = "light" | "dark" | "system";

export interface ThemeContext {
  theme: Ref<Theme>;
  resolvedTheme: ComputedRef<"light" | "dark">;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const THEME_INJECTION_KEY: InjectionKey<ThemeContext> = Symbol("theme");
```

**Why good:** InjectionKey provides full type safety, Symbol prevents collisions, clear context interface definition

---

## Provider Component

### Good Example - Theme provider with system preference

```vue
<!-- ThemeProvider.vue -->
<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted } from "vue";
import {
  THEME_INJECTION_KEY,
  type Theme,
  type ThemeContext,
} from "@/contexts/theme";

const STORAGE_KEY = "app-theme";

const theme = ref<Theme>(
  (localStorage.getItem(STORAGE_KEY) as Theme) || "system",
);

// Resolve 'system' to actual theme
const resolvedTheme = computed<"light" | "dark">(() => {
  if (theme.value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme.value;
});

function setTheme(newTheme: Theme) {
  theme.value = newTheme;
  localStorage.setItem(STORAGE_KEY, newTheme);
}

function toggleTheme() {
  const newTheme = resolvedTheme.value === "light" ? "dark" : "light";
  setTheme(newTheme);
}

// Listen for system preference changes
let mediaQuery: MediaQueryList | null = null;
let mediaQueryHandler: (() => void) | null = null;

onMounted(() => {
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQueryHandler = () => {
    if (theme.value === "system") {
      // Trigger computed recalculation by reassigning
      theme.value = "system";
    }
  };
  mediaQuery.addEventListener("change", mediaQueryHandler);
});

onUnmounted(() => {
  if (mediaQuery && mediaQueryHandler) {
    mediaQuery.removeEventListener("change", mediaQueryHandler);
    mediaQuery = null;
    mediaQueryHandler = null;
  }
});

const context: ThemeContext = {
  theme,
  resolvedTheme,
  setTheme,
  toggleTheme,
};

provide(THEME_INJECTION_KEY, context);
</script>

<template>
  <div :data-theme="resolvedTheme">
    <slot />
  </div>
</template>
```

**Why good:** Persists to localStorage, resolves 'system' preference, listens for system changes, provides complete context to descendants

---

## Consumer Component

### Good Example - Using injected context

```vue
<!-- ThemeToggle.vue -->
<script setup lang="ts">
import { inject } from "vue";
import { THEME_INJECTION_KEY } from "@/contexts/theme";

const themeContext = inject(THEME_INJECTION_KEY);

if (!themeContext) {
  throw new Error("ThemeToggle must be used within ThemeProvider");
}

const { resolvedTheme, toggleTheme } = themeContext;
</script>

<template>
  <button @click="toggleTheme">
    {{ resolvedTheme === "light" ? "Switch to Dark" : "Switch to Light" }}
  </button>
</template>
```

**Why good:** Explicit error for missing provider, destructures only needed values, clean template binding

---

## App Composition Root

### Usage Pattern - Wrapping the app

```vue
<!-- App.vue -->
<script setup lang="ts">
import ThemeProvider from "@/components/ThemeProvider.vue";
import AppHeader from "@/components/AppHeader.vue";
import AppMain from "@/components/AppMain.vue";
</script>

<template>
  <ThemeProvider>
    <AppHeader />
    <AppMain />
  </ThemeProvider>
</template>
```

---

## Pattern Summary

1. **Define typed injection key** with Symbol in separate file
2. **Create provider component** that provides context via `provide()`
3. **Consumer components** inject and use context via `inject()`
4. **Wrap app/section** with provider at composition root

---

## When to Use Provide/Inject

**Use provide/inject for:**

- Theme configuration
- User authentication context
- Feature flags
- Locale/i18n settings
- Layout configuration
- Deeply nested component communication

**Avoid provide/inject for:**

- Frequently changing state (use Pinia/Zustand)
- Data that should flow via props
- Global state that could use a store

---

## See Also

- [core.md](core.md) - Component composition basics
- [composables.md](composables.md) - Composable patterns
