# vue-i18n Lazy Loading Examples

> Lazy loading translation files for better performance. See [core.md](core.md) for basic setup.

---

## Basic Lazy Loading

### Good Example - Dynamic Import Setup

```typescript
// src/i18n/index.ts
import { createI18n, type I18n } from "vue-i18n";

export const SUPPORTED_LOCALES = ["en", "ja", "fr", "de"] as const;
export const DEFAULT_LOCALE = "en";

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Start with empty messages - load dynamically
export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {},
});

const loadedLocales: Set<SupportedLocale> = new Set();

export async function loadLocaleMessages(
  locale: SupportedLocale
): Promise<void> {
  // Skip if already loaded
  if (loadedLocales.has(locale)) {
    return;
  }

  try {
    // Dynamic import with webpack/vite chunk naming
    const messages = await import(
      /* webpackChunkName: "locale-[request]" */
      `../locales/${locale}.json`
    );

    i18n.global.setLocaleMessage(locale, messages.default);
    loadedLocales.add(locale);
  } catch (error) {
    console.error(`Failed to load locale: ${locale}`, error);
    throw error;
  }
}

export async function setLocale(locale: SupportedLocale): Promise<void> {
  await loadLocaleMessages(locale);
  i18n.global.locale.value = locale;

  // Update HTML lang attribute for accessibility
  document.documentElement.setAttribute("lang", locale);

  // Persist preference
  localStorage.setItem("user-locale", locale);
}

export function getPersistedLocale(): SupportedLocale {
  const stored = localStorage.getItem("user-locale");
  if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
    return stored as SupportedLocale;
  }

  // Try browser language
  const browserLang = navigator.language.split("-")[0];
  if (SUPPORTED_LOCALES.includes(browserLang as SupportedLocale)) {
    return browserLang as SupportedLocale;
  }

  return DEFAULT_LOCALE;
}

export { i18n };
```

**Why good:** messages loaded only when needed, loadedLocales Set prevents duplicate loads, chunk naming enables code splitting, localStorage persists preference, browser language detection as fallback

### Good Example - App Bootstrap with Preloading

```typescript
// main.ts
import { createApp } from "vue";
import { i18n, loadLocaleMessages, getPersistedLocale } from "./i18n";
import App from "./App.vue";

async function bootstrap() {
  // Determine locale before mounting
  const locale = getPersistedLocale();

  // Preload the initial locale messages
  await loadLocaleMessages(locale);

  // Set as current locale
  i18n.global.locale.value = locale;
  document.documentElement.setAttribute("lang", locale);

  // Mount app
  const app = createApp(App);
  app.use(i18n);
  app.mount("#app");
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap app:", error);
});
```

**Why good:** locale determined before render prevents flash of untranslated content, async bootstrap pattern, error handling for failed loads

---

## Router Integration

### Good Example - Locale-Based Routing

```typescript
// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import {
  setLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/i18n";

const routes: RouteRecordRaw[] = [
  {
    path: "/:locale",
    children: [
      {
        path: "",
        name: "home",
        component: () => import("../views/HomeView.vue"),
      },
      {
        path: "about",
        name: "about",
        component: () => import("../views/AboutView.vue"),
      },
      {
        path: "products",
        name: "products",
        component: () => import("../views/ProductsView.vue"),
      },
    ],
  },
  {
    // Redirect root to default locale
    path: "/",
    redirect: `/${DEFAULT_LOCALE}`,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard for locale handling
router.beforeEach(async (to, from, next) => {
  const paramsLocale = to.params.locale as string;

  // Check if locale is supported
  if (!SUPPORTED_LOCALES.includes(paramsLocale as SupportedLocale)) {
    // Redirect to browser locale or default
    const browserLang = navigator.language.split("-")[0];
    const fallbackLocale = SUPPORTED_LOCALES.includes(
      browserLang as SupportedLocale
    )
      ? browserLang
      : DEFAULT_LOCALE;

    return next({
      path: `/${fallbackLocale}${to.path}`,
      query: to.query,
    });
  }

  // Load and set locale
  await setLocale(paramsLocale as SupportedLocale);

  next();
});

export { router };
```

**Why good:** locale in URL path for SEO and shareability, navigation guard loads locale before route renders, unsupported locales redirect gracefully, browser language detection

### Good Example - Locale Switcher with Router

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n";

const { locale } = useI18n();
const router = useRouter();
const route = useRoute();

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  ja: "日本語",
  fr: "Français",
  de: "Deutsch",
};

const switchLocale = (newLocale: SupportedLocale) => {
  // Navigate to same path with new locale
  const currentPath = route.path.replace(`/${locale.value}`, "");
  router.push({
    path: `/${newLocale}${currentPath}`,
    query: route.query,
  });
};
</script>

<template>
  <nav aria-label="Language selection">
    <select
      :value="locale"
      aria-label="Select language"
      @change="switchLocale($event.target.value as SupportedLocale)"
    >
      <option v-for="loc in SUPPORTED_LOCALES" :key="loc" :value="loc">
        {{ LOCALE_NAMES[loc] }}
      </option>
    </select>
  </nav>
</template>
```

**Why good:** preserves current path and query when switching, router handles locale loading via navigation guard, URL updates for bookmarkability

---

## Performance Optimization

### Good Example - Vite Plugin Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      // Locale message files
      include: resolve(__dirname, "./src/locales/**"),
      // Use runtime-only build (smaller bundle)
      runtimeOnly: true,
      // Pre-compile locale messages
      compositionOnly: true,
      // Enable strict message format checking
      strictMessage: true,
      // Drop console warnings in production
      dropMessageCompiler: true,
    }),
  ],
  define: {
    // Drop legacy API support (reduces bundle size)
    __VUE_I18N_LEGACY_API__: false,
    // Drop full install (smaller bundle)
    __VUE_I18N_FULL_INSTALL__: false,
    // Disable production devtools
    __VUE_I18N_PROD_DEVTOOLS__: false,
  },
});
```

**Why good:** pre-compiles messages at build time, runtimeOnly reduces bundle by ~7KB, feature flags drop unused code, strictMessage catches errors early

### Good Example - Split Messages by Feature

```
src/
  locales/
    en/
      common.json       # Shared translations
      auth.json         # Authentication feature
      dashboard.json    # Dashboard feature
      settings.json     # Settings feature
    ja/
      common.json
      auth.json
      dashboard.json
      settings.json
```

```typescript
// src/i18n/loader.ts
import type { SupportedLocale } from "./index";

const loadedModules: Map<string, Set<string>> = new Map();

export async function loadFeatureMessages(
  locale: SupportedLocale,
  feature: string
): Promise<Record<string, unknown>> {
  const key = `${locale}:${feature}`;

  // Check cache
  if (!loadedModules.has(locale)) {
    loadedModules.set(locale, new Set());
  }

  const localeModules = loadedModules.get(locale)!;
  if (localeModules.has(feature)) {
    return {}; // Already loaded
  }

  const messages = await import(`../locales/${locale}/${feature}.json`);
  localeModules.add(feature);

  return messages.default;
}

export async function loadRouteMessages(
  locale: SupportedLocale,
  routeName: string
): Promise<void> {
  const ROUTE_FEATURE_MAP: Record<string, string[]> = {
    home: ["common"],
    login: ["common", "auth"],
    register: ["common", "auth"],
    dashboard: ["common", "dashboard"],
    settings: ["common", "settings"],
  };

  const features = ROUTE_FEATURE_MAP[routeName] || ["common"];

  await Promise.all(
    features.map((feature) => loadFeatureMessages(locale, feature))
  );
}
```

**Why good:** feature-based splitting reduces initial bundle, common messages shared across features, parallel loading with Promise.all, cache prevents duplicate imports

### Good Example - Preload on Hover

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { loadLocaleMessages, type SupportedLocale } from "@/i18n";

const { locale } = useI18n();

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  ja: "日本語",
  fr: "Français",
  de: "Deutsch",
};

const preloadLocale = async (targetLocale: SupportedLocale) => {
  // Preload on hover to reduce switch latency
  if (targetLocale !== locale.value) {
    await loadLocaleMessages(targetLocale);
  }
};
</script>

<template>
  <nav aria-label="Language selection">
    <button
      v-for="loc in Object.keys(LOCALE_NAMES) as SupportedLocale[]"
      :key="loc"
      type="button"
      :aria-current="loc === locale ? 'true' : undefined"
      @mouseenter="preloadLocale(loc)"
      @focus="preloadLocale(loc)"
      @click="$emit('change-locale', loc)"
    >
      {{ LOCALE_NAMES[loc] }}
    </button>
  </nav>
</template>
```

**Why good:** preloads messages on hover/focus before click, eliminates perceived latency when switching, loadLocaleMessages handles deduplication

---

## Error Handling

### Good Example - Fallback Chain with Error Recovery

```typescript
// src/i18n/loader.ts
import { i18n, DEFAULT_LOCALE, type SupportedLocale } from "./index";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadLocaleWithRetry(
  locale: SupportedLocale
): Promise<boolean> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const messages = await import(`../locales/${locale}.json`);
      i18n.global.setLocaleMessage(locale, messages.default);
      return true;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Failed to load locale ${locale} (attempt ${attempt}/${MAX_RETRIES}):`,
        error
      );

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.error(`All attempts to load locale ${locale} failed:`, lastError);

  // Fallback to default locale if not already trying to load it
  if (locale !== DEFAULT_LOCALE) {
    console.warn(`Falling back to ${DEFAULT_LOCALE}`);
    return loadLocaleWithRetry(DEFAULT_LOCALE);
  }

  return false;
}

export async function setLocaleWithFallback(
  locale: SupportedLocale
): Promise<void> {
  const success = await loadLocaleWithRetry(locale);

  if (success) {
    i18n.global.locale.value = locale;
    document.documentElement.setAttribute("lang", locale);
  } else {
    // Critical: couldn't load any locale
    console.error("Failed to load any locale messages");
    // App should still work with message keys displayed
  }
}
```

**Why good:** retry logic for network failures, exponential backoff with sleep, fallback to default locale, graceful degradation if all loads fail, named constants for retry config

### Good Example - Missing Translation Handler

```typescript
// src/i18n/index.ts
import { createI18n } from "vue-i18n";

export const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  missingWarn: process.env.NODE_ENV === "development",
  fallbackWarn: process.env.NODE_ENV === "development",
  missing: (locale, key, vm, type) => {
    // Custom handler for missing translations
    if (process.env.NODE_ENV === "development") {
      console.warn(`[i18n] Missing: ${locale}/${key}`);
    }

    // Return key as fallback (default behavior)
    return key;
  },
});
```

**Why good:** warnings only in development, custom missing handler for logging/tracking, returns key as visible fallback, vm parameter available for component context

---

## SSR Considerations

### Good Example - SSR-Safe Locale Detection

```typescript
// src/i18n/ssr.ts
import type { SupportedLocale } from "./index";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./index";

export function detectLocale(
  acceptLanguage?: string,
  cookieLocale?: string
): SupportedLocale {
  // Priority 1: Cookie preference (user's explicit choice)
  if (
    cookieLocale &&
    SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale)
  ) {
    return cookieLocale as SupportedLocale;
  }

  // Priority 2: Accept-Language header
  if (acceptLanguage) {
    const preferredLanguages = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim().split("-")[0])
      .filter((lang) => SUPPORTED_LOCALES.includes(lang as SupportedLocale));

    if (preferredLanguages.length > 0) {
      return preferredLanguages[0] as SupportedLocale;
    }
  }

  // Priority 3: Default locale
  return DEFAULT_LOCALE;
}

export function isServer(): boolean {
  return typeof window === "undefined";
}

export function getInitialLocale(): SupportedLocale {
  if (isServer()) {
    return DEFAULT_LOCALE; // Server will get locale from request
  }

  // Client-side detection
  const cookieLocale = document.cookie
    .split("; ")
    .find((row) => row.startsWith("locale="))
    ?.split("=")[1];

  const browserLang = navigator.language.split("-")[0];

  return detectLocale(undefined, cookieLocale) || browserLang !== undefined
    ? (browserLang as SupportedLocale)
    : DEFAULT_LOCALE;
}
```

**Why good:** works on both server and client, cookie takes priority (user choice), Accept-Language parsed correctly, SSR-safe with typeof window check

---

_For basic setup and translations, see [core.md](core.md)._
