# Pinia - State Persistence Examples

> Extended examples for Pinia state persistence with pinia-plugin-persistedstate. See [core.md](core.md) for core patterns.

**Prerequisites**: Understand Pattern 2 (Options Store) from core examples first.

---

## Selective Persistence

> **Note:** This pattern builds on [Pattern 2: Options Store Definition](core.md#pattern-2-options-store-definition).

### Good Example - Selective Persistence

```typescript
// stores/user-preferences-store.ts
import { defineStore } from 'pinia';

const DEFAULT_THEME = 'system' as const;
const DEFAULT_LOCALE = 'en';
const DEFAULT_SIDEBAR_COLLAPSED = false;
const PREFERENCES_STORAGE_KEY = 'user-preferences';

type Theme = 'light' | 'dark' | 'system';

interface PreferencesState {
  theme: Theme;
  locale: string;
  sidebarCollapsed: boolean;
  lastVisitedPage: string;  // Transient - should NOT persist
}

export const usePreferencesStore = defineStore('preferences', {
  state: (): PreferencesState => ({
    theme: DEFAULT_THEME,
    locale: DEFAULT_LOCALE,
    sidebarCollapsed: DEFAULT_SIDEBAR_COLLAPSED,
    lastVisitedPage: '/',
  }),

  actions: {
    setTheme(theme: Theme): void {
      this.theme = theme;
    },

    setLocale(locale: string): void {
      this.locale = locale;
    },

    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
  },

  // Using pinia-plugin-persistedstate
  persist: {
    key: PREFERENCES_STORAGE_KEY,
    storage: localStorage,
    // Only persist user preferences, NOT transient state
    paths: ['theme', 'locale', 'sidebarCollapsed'],
  },
});
```

**Why good:** Named constants for defaults and storage key, `paths` option only persists preferences not transient state, TypeScript types throughout

---

## Plugin Setup

### Plugin Setup Example

```typescript
// main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import App from './App.vue';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
app.use(pinia);
app.mount('#app');
```

---

## Anti-Patterns

### Bad Example - Persisting Server Data

```typescript
// Bad Example - Persisting server data
export const useBadStore = defineStore('bad', {
  state: () => ({
    users: [],  // Server data - should NOT persist!
    products: [],  // Server data - should NOT persist!
    theme: 'light',
  }),

  persist: true,  // Persists EVERYTHING including stale server data!
});
```

**Why bad:** Persists server data that will become stale, no storage key specified, no selective persistence with paths
