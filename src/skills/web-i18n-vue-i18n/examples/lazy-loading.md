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
  locale: SupportedLocale,
): Promise<void> {
  // Skip if already loaded
  if (loadedLocales.has(locale)) {
    return;
  }

  try {
    // Dynamic import for code splitting
    const messages = await import(`../locales/${locale}.json`);

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

## Loading Before a View Renders

Putting the locale in the URL is what makes a translated page shareable and separately indexable per
language. It also means the messages have to be registered before the view that reads them renders —
otherwise the first paint shows raw keys. Whatever owns routing supplies the before-navigation hook;
these functions are the i18n half of it, and take the locale segment as a plain string.

### Good Example - Resolve and Load the Segment

```typescript
// src/i18n/route-locale.ts
import {
  setLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "./index";

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

/** The locale to use when the URL segment names one that does not exist. */
export function fallbackForUnknownSegment(): SupportedLocale {
  const browserLang = navigator.language.split("-")[0];
  return isSupportedLocale(browserLang) ? browserLang : DEFAULT_LOCALE;
}

/**
 * Call before the target view renders. Resolves to the locale that was applied,
 * which differs from the segment when the segment was unsupported.
 */
export async function applyRouteLocale(
  segment: string,
): Promise<SupportedLocale> {
  const locale = isSupportedLocale(segment)
    ? segment
    : fallbackForUnknownSegment();

  await setLocale(locale);
  return locale;
}
```

```typescript
// Wired into whatever runs before navigation completes. `targetLocaleSegment`
// is the locale segment of the URL being navigated to.
const applied = await applyRouteLocale(targetLocaleSegment);

if (applied !== targetLocaleSegment) {
  // Redirect to the same path under `applied`, carrying the query string over.
  // A locale change should leave the reader on the page they asked for, with
  // their filters and pagination intact.
}
```

**Why good:** messages are registered before the view renders, an unsupported segment resolves to a locale that exists rather than erroring, and the caller decides how to redirect — so this works under any routing approach

### Good Example - Switcher That Reports the Chosen Locale

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SUPPORTED_LOCALES, type SupportedLocale } from "../i18n";

const { locale } = useI18n();

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  ja: "日本語",
  fr: "Français",
  de: "Deutsch",
};

// The parent navigates; this component only reports the choice, so the
// before-navigation hook stays the single place that loads messages.
defineEmits<{ select: [locale: SupportedLocale] }>();
</script>

<template>
  <nav aria-label="Language selection">
    <select
      :value="locale"
      aria-label="Select language"
      @change="
        $emit(
          'select',
          ($event.target as HTMLSelectElement).value as SupportedLocale,
        )
      "
    >
      <option v-for="loc in SUPPORTED_LOCALES" :key="loc" :value="loc">
        {{ LOCALE_NAMES[loc] }}
      </option>
    </select>
  </nav>
</template>
```

**Why good:** message loading stays in one place rather than being duplicated between the switcher and the navigation hook; the component works whether the locale lives in the URL or in storage; and because the parent navigates, it can preserve the current path and query rather than dropping the reader at the site root

---

## Performance Optimization

### Good Example - Build Plugin and Feature Flags

Use `@intlify/unplugin-vue-i18n` for message pre-compilation. Key options:

```typescript
// unplugin options (adapt to your bundler)
VueI18nPlugin({
  include: resolve(__dirname, "./src/locales/**"),
  runtimeOnly: true, // Smaller bundle (~7KB savings)
  compositionOnly: true, // Drop legacy API support
  strictMessage: true, // Catch format errors at build
  dropMessageCompiler: true, // Drop compiler in production
});
```

Define feature flags to tree-shake unused code:

```typescript
// In your bundler's define/DefinePlugin config
{
  __VUE_I18N_LEGACY_API__: false,     // Drop legacy API (~7KB)
  __VUE_I18N_FULL_INSTALL__: false,   // Drop full install
  __VUE_I18N_PROD_DEVTOOLS__: false,  // Disable prod devtools
}
```

**Why good:** pre-compiles messages at build time, runtimeOnly reduces bundle, feature flags tree-shake unused code, strictMessage catches errors early

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
  feature: string,
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
  routeName: string,
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
    features.map((feature) => loadFeatureMessages(locale, feature)),
  );
}
```

**Why good:** feature-based splitting reduces initial bundle, common messages shared across features, parallel loading with Promise.all, cache prevents duplicate imports

### Good Example - Preload on Hover

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { loadLocaleMessages, type SupportedLocale } from "../i18n";

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
  locale: SupportedLocale,
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
        error,
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
  locale: SupportedLocale,
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
  cookieLocale?: string,
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

  // navigator.language stands in for the Accept-Language header on the client,
  // so the same priority order applies on both sides
  const browserLang = navigator.language.split("-")[0];

  return detectLocale(browserLang, cookieLocale);
}
```

**Why good:** works on both server and client, cookie takes priority (user choice), Accept-Language parsed correctly, SSR-safe with typeof window check

---

_For basic setup and translations, see [core.md](core.md)._
