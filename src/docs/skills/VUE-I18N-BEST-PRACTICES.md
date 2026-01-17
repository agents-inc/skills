# Vue I18n v9+ Best Practices Research (2025/2026)

> **Research Summary:** Comprehensive research on vue-i18n v9+ patterns for Vue 3 applications using Composition API, TypeScript integration, lazy loading, and modern translation workflows.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Essential Patterns (Composition API)](#essential-patterns-composition-api)
3. [Message Format Syntax](#message-format-syntax)
4. [Pluralization](#pluralization)
5. [DateTime and Number Formatting](#datetime-and-number-formatting)
6. [Component Interpolation](#component-interpolation)
7. [TypeScript Integration](#typescript-integration)
8. [Lazy Loading Translations](#lazy-loading-translations)
9. [Performance Optimization](#performance-optimization)
10. [SSR with Nuxt 3](#ssr-with-nuxt-3)
11. [Translation Workflow](#translation-workflow)
12. [Testing Approaches](#testing-approaches)
13. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
14. [Migration Notes (v8 to v9)](#migration-notes-v8-to-v9)

---

## Core Concepts

### Global vs Local Scope

Vue I18n supports two scoping modes for translations:

**Global Scope:**
- Shared across the entire application
- Default when no local scope is defined
- Access via `useI18n({ useScope: 'global' })`
- Best for app-wide translations (navigation, common buttons, error messages)

**Local Scope:**
- Component-specific translations
- Defined via `<i18n>` custom blocks or `useI18n` options
- Isolated from global scope
- Best for feature-specific translations

```typescript
// Global scope - shared across app
const { t } = useI18n({ useScope: 'global' })

// Local scope - component-specific
const { t } = useI18n({
  locale: 'en',
  messages: {
    en: { greeting: 'Hello from component' },
    ja: { greeting: 'コンポーネントからこんにちは' }
  }
})
```

### API Modes

**Composition API Mode (Recommended):**
- Set `legacy: false` in `createI18n`
- Use `useI18n()` composable
- Returns `Composer` instance
- Legacy API is deprecated in v11 and will be removed in v12

**Legacy API Mode (Deprecated):**
- Default in older versions
- Uses `this.$t()`, `this.$i18n`
- For backward compatibility only

---

## Essential Patterns (Composition API)

### Basic Setup

```typescript
// i18n.ts
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ja from './locales/ja.json'

export const i18n = createI18n({
  legacy: false, // REQUIRED for Composition API
  locale: 'en',
  fallbackLocale: 'en',
  globalInjection: true, // Injects $t, $d, $n into templates
  messages: {
    en,
    ja
  }
})
```

### Using useI18n in Components

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Destructure all needed functions from a single call
const { t, d, n, locale, tm } = useI18n()

// Change locale
const switchLocale = (newLocale: string) => {
  locale.value = newLocale
}
</script>

<template>
  <h1>{{ t('greeting') }}</h1>
  <p>{{ t('messages.welcome', { name: 'Vue' }) }}</p>
  <p>{{ d(new Date(), 'long') }}</p>
  <p>{{ n(1000, 'currency') }}</p>
</template>
```

### Available Functions from useI18n

| Function | Purpose | Example |
|----------|---------|---------|
| `t(key, params?)` | Translate message | `t('hello', { name: 'World' })` |
| `d(value, format?)` | Format datetime | `d(new Date(), 'short')` |
| `n(value, format?)` | Format number | `n(1000, 'currency')` |
| `tm(key)` | Get raw message object | `tm('nested.object')` |
| `rt(message, params?)` | Resolve translation | `rt(tm('key'), { val: 1 })` |
| `te(key)` | Check if key exists | `te('maybe.exists')` |
| `locale` | Current locale ref | `locale.value = 'ja'` |
| `availableLocales` | List of loaded locales | `['en', 'ja']` |

---

## Message Format Syntax

### Named Interpolation

```json
{
  "greeting": "Hello, {name}!",
  "items": "You have {count} items in your cart."
}
```

```typescript
t('greeting', { name: 'John' }) // "Hello, John!"
t('items', { count: 5 }) // "You have 5 items in your cart."
```

### List Interpolation

```json
{
  "address": "{0}, {1}, {2}"
}
```

```typescript
t('address', ['123 Main St', 'City', 'Country'])
// "123 Main St, City, Country"
```

### Literal Interpolation

Use single quotes for literal characters that would otherwise be interpreted:

```json
{
  "email": "{account}{'@'}{domain}"
}
```

```typescript
t('email', { account: 'user', domain: 'example.com' })
// "user@example.com"
```

### Linked Messages

Reference other translation keys with `@:`:

```json
{
  "app": {
    "name": "My App"
  },
  "welcome": "Welcome to @:app.name!"
}
```

### Linked Messages with Modifiers

```json
{
  "brand": "vue i18n",
  "message": {
    "upper": "@.upper:brand",
    "lower": "@.lower:brand",
    "capitalize": "@.capitalize:brand"
  }
}
```

```typescript
t('message.upper') // "VUE I18N"
t('message.lower') // "vue i18n"
t('message.capitalize') // "Vue i18n"
```

### Custom Modifiers

```typescript
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  modifiers: {
    snakeCase: (str: string) => str.replace(/\s+/g, '_').toLowerCase()
  },
  messages: {
    en: {
      greeting: 'hello world',
      formatted: '@.snakeCase:greeting'
    }
  }
})
// t('formatted') => "hello_world"
```

---

## Pluralization

### Basic Plural Syntax

Use pipe `|` to separate plural forms:

```json
{
  "car": "car | cars",
  "apple": "no apples | one apple | {count} apples"
}
```

```typescript
t('car', 1)  // "car"
t('car', 2)  // "cars"

t('apple', 0)  // "no apples"
t('apple', 1)  // "one apple"
t('apple', 10) // "10 apples" ({count} auto-injected)
```

### Implicit Arguments

The variables `{count}` and `{n}` are automatically injected with the plural value:

```json
{
  "items": "no items | {n} item | {n} items"
}
```

```typescript
t('items', 5) // "5 items"
```

### Custom Pluralization Rules

For languages with complex plural rules (Slavic, Arabic, etc.):

```typescript
const i18n = createI18n({
  legacy: false,
  locale: 'ru',
  pluralRules: {
    ru: (choice: number, choicesLength: number) => {
      // Russian plural rules
      if (choice === 0) return 0

      const teen = choice > 10 && choice < 20
      const endsWithOne = choice % 10 === 1

      if (!teen && endsWithOne) return 1
      if (!teen && choice % 10 >= 2 && choice % 10 <= 4) return 2
      return choicesLength < 4 ? 2 : 3
    }
  },
  messages: {
    ru: {
      apple: 'нет яблок | {n} яблоко | {n} яблока | {n} яблок'
    }
  }
})
```

---

## DateTime and Number Formatting

### DateTime Format Configuration

```typescript
const datetimeFormats = {
  'en-US': {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric'
    },
    time: {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    }
  },
  'ja-JP': {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    long: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  datetimeFormats // Note: camelCase, not dateTimeFormats
})
```

### DateTime Usage

```typescript
const { d } = useI18n()

d(new Date(), 'short')     // "Apr 19, 2024"
d(new Date(), 'long')      // "Friday, April 19, 2024 at 2:30 PM"
d(new Date(), 'time')      // "2:30:45 PM"
```

### Number Format Configuration

```typescript
const numberFormats = {
  'en-US': {
    currency: {
      style: 'currency',
      currency: 'USD',
      notation: 'standard'
    },
    decimal: {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    },
    percent: {
      style: 'percent',
      useGrouping: false
    },
    compact: {
      notation: 'compact',
      compactDisplay: 'short'
    }
  },
  'ja-JP': {
    currency: {
      style: 'currency',
      currency: 'JPY',
      useGrouping: true,
      currencyDisplay: 'symbol'
    }
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  numberFormats
})
```

### Number Usage

```typescript
const { n } = useI18n()

n(10000, 'currency')  // "$10,000.00"
n(0.15, 'percent')    // "15%"
n(1234567, 'compact') // "1.2M"
```

---

## Component Interpolation

### Basic i18n-t Component

Use when translations contain HTML or Vue components:

```json
{
  "tos": "I agree to the {terms}.",
  "termsLink": "Terms of Service"
}
```

```vue
<template>
  <i18n-t keypath="tos" tag="p">
    <template #terms>
      <a href="/terms">{{ t('termsLink') }}</a>
    </template>
  </i18n-t>
</template>
```

### Pluralization with i18n-t

```json
{
  "items": "no items | {n} item | {n} items"
}
```

```vue
<template>
  <i18n-t keypath="items" :plural="count" tag="p">
    <template #n>
      <strong>{{ count }}</strong>
    </template>
  </i18n-t>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const count = ref(5)
</script>
```

### DateTime Component (i18n-d)

For styled datetime parts:

```vue
<template>
  <i18n-d :value="date" format="long" tag="time">
    <template #month="{ month }">
      <span class="month">{{ month }}</span>
    </template>
    <template #day="{ day }">
      <span class="day">{{ day }}</span>
    </template>
  </i18n-d>
</template>
```

### Number Component (i18n-n)

For styled number parts:

```vue
<template>
  <i18n-n :value="price" format="currency" tag="span">
    <template #currency="{ currency }">
      <span class="currency-symbol">{{ currency }}</span>
    </template>
    <template #integer="{ integer }">
      <span class="integer">{{ integer }}</span>
    </template>
    <template #fraction="{ fraction }">
      <span class="fraction">.{{ fraction }}</span>
    </template>
  </i18n-n>
</template>
```

---

## TypeScript Integration

### Type-Safe Message Schema

```typescript
// locales/en.json
{
  "greeting": "Hello, {name}!",
  "nav": {
    "home": "Home",
    "about": "About"
  }
}
```

```typescript
// i18n.ts
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ja from './locales/ja.json'

type MessageSchema = typeof en

const i18n = createI18n<[MessageSchema], 'en' | 'ja'>({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    ja
  }
})

export { i18n }
export type { MessageSchema }
```

### Global Type Declaration

```typescript
// vue-i18n.d.ts
import en from './locales/en.json'

type MessageSchema = typeof en

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}

  export interface DefineDateTimeFormat {
    short: {
      year: 'numeric'
      month: 'short'
      day: 'numeric'
    }
    long: {
      year: 'numeric'
      month: 'long'
      day: 'numeric'
      weekday: 'long'
      hour: 'numeric'
      minute: 'numeric'
    }
  }

  export interface DefineNumberFormat {
    currency: {
      style: 'currency'
      currency: string
    }
    decimal: {
      style: 'decimal'
      minimumFractionDigits: number
      maximumFractionDigits: number
    }
  }
}
```

### Type-Safe useI18n in Components

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MessageSchema } from '@/i18n'

const { t } = useI18n<{ message: MessageSchema }>()

// TypeScript will catch invalid keys
t('greeting', { name: 'World' }) // OK
t('invalid.key') // TypeScript error
</script>
```

### Typed Number and DateTime Formats

```typescript
type NumberSchema = {
  currency: {
    style: 'currency'
    currency: string
  }
}

type DateTimeSchema = {
  short: Intl.DateTimeFormatOptions
  long: Intl.DateTimeFormatOptions
}

const { n, d } = useI18n<{
  message: MessageSchema
  number: NumberSchema
  datetime: DateTimeSchema
}>()
```

---

## Lazy Loading Translations

### Basic Lazy Loading Setup

```typescript
// i18n.ts
import { createI18n, type I18n } from 'vue-i18n'

export const SUPPORTED_LOCALES = ['en', 'ja', 'fr', 'de'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {} // Start empty, load dynamically
})

export async function loadLocaleMessages(
  locale: SupportedLocale
): Promise<void> {
  // Check if already loaded
  if (i18n.global.availableLocales.includes(locale)) {
    return
  }

  // Dynamic import with webpack chunk naming
  const messages = await import(
    /* webpackChunkName: "locale-[request]" */
    `./locales/${locale}.json`
  )

  i18n.global.setLocaleMessage(locale, messages.default)
}

export async function setLocale(locale: SupportedLocale): Promise<void> {
  await loadLocaleMessages(locale)
  i18n.global.locale.value = locale

  // Update HTML lang attribute
  document.documentElement.setAttribute('lang', locale)

  // Persist preference
  localStorage.setItem('user-locale', locale)
}

export { i18n }
```

### Router Integration

```typescript
// router.ts
import { createRouter, createWebHistory } from 'vue-router'
import { setLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/:locale',
      children: [
        { path: '', name: 'home', component: () => import('./views/Home.vue') },
        { path: 'about', name: 'about', component: () => import('./views/About.vue') }
      ]
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const paramsLocale = to.params.locale as string

  // Check if locale is supported
  if (!SUPPORTED_LOCALES.includes(paramsLocale as SupportedLocale)) {
    return next({ path: `/${navigator.language.split('-')[0] || 'en'}${to.path}` })
  }

  // Load and set locale
  await setLocale(paramsLocale as SupportedLocale)

  next()
})

export { router }
```

### Preloading Critical Locale

```typescript
// main.ts
import { createApp } from 'vue'
import { i18n, loadLocaleMessages } from '@/i18n'
import App from './App.vue'

async function bootstrap() {
  // Preload default locale before app mounts
  await loadLocaleMessages('en')

  const app = createApp(App)
  app.use(i18n)
  app.mount('#app')
}

bootstrap()
```

---

## Performance Optimization

### Pre-Compilation with unplugin-vue-i18n

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      include: resolve(__dirname, './src/locales/**'),
      // Use runtime-only build (smaller bundle)
      runtimeOnly: true,
      // Pre-compile locale messages
      compositionOnly: true,
      // Enable strict message format
      strictMessage: true
    })
  ]
})
```

### Build Feature Flags

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    // Drop legacy API support
    __VUE_I18N_LEGACY_API__: false,
    // Drop full install (smaller bundle)
    __VUE_I18N_FULL_INSTALL__: false,
    // Enable production devtools (set false for production)
    __VUE_I18N_PROD_DEVTOOLS__: false
  }
})
```

### JIT Compilation (v9.3+)

For dynamic translations (from API/database):

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __INTLIFY_JIT_COMPILATION__: true // Default in v10+
  }
})
```

### Bundle Size Comparison

| Build Type | Size |
|------------|------|
| Full build | ~15KB gzipped |
| Runtime only | ~8KB gzipped |
| With feature flags | ~6KB gzipped |

---

## SSR with Nuxt 3

### Recommended: @nuxtjs/i18n Module

```bash
npm install @nuxtjs/i18n
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],

  i18n: {
    locales: [
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'ja', file: 'ja.json', name: '日本語' }
    ],
    lazy: true,
    langDir: 'locales',
    defaultLocale: 'en',
    strategy: 'prefix_except_default',

    // Use Composition API
    vueI18n: './i18n.config.ts'
  }
})
```

```typescript
// i18n.config.ts
export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en'
}))
```

### Using in Nuxt Components

```vue
<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
</script>

<template>
  <NuxtLink :to="localePath('/')">{{ t('nav.home') }}</NuxtLink>

  <select @change="setLocale($event.target.value)">
    <option v-for="loc in ['en', 'ja']" :key="loc" :value="loc">
      {{ loc }}
    </option>
  </select>
</template>
```

### Direct Vue I18n Integration (Without @nuxtjs/i18n)

```typescript
// plugins/i18n.ts
import { createI18n } from 'vue-i18n'

export default defineNuxtPlugin(({ vueApp }) => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: { hello: 'Hello' },
      ja: { hello: 'こんにちは' }
    }
  })

  vueApp.use(i18n)
})
```

---

## Translation Workflow

### File Organization

```
src/
├── locales/
│   ├── en.json          # English (source)
│   ├── ja.json          # Japanese
│   ├── fr.json          # French
│   └── de.json          # German
├── i18n/
│   ├── index.ts         # Main i18n configuration
│   ├── types.ts         # TypeScript types
│   └── utils.ts         # Helper functions
```

### Message Key Conventions

```json
{
  "common": {
    "buttons": {
      "submit": "Submit",
      "cancel": "Cancel",
      "save": "Save"
    },
    "errors": {
      "required": "This field is required",
      "invalidEmail": "Invalid email address"
    }
  },
  "pages": {
    "home": {
      "title": "Welcome",
      "description": "Welcome to our app"
    },
    "profile": {
      "title": "Profile",
      "greeting": "Hello, {name}"
    }
  },
  "components": {
    "header": {
      "nav": {
        "home": "Home",
        "about": "About"
      }
    }
  }
}
```

### Message Extraction with vue-i18n-extract

```bash
npm install -D vue-i18n-extract
```

```json
// package.json
{
  "scripts": {
    "i18n:report": "vue-i18n-extract report -v './src/**/*.{vue,ts}' -l './src/locales/*.json'",
    "i18n:add": "vue-i18n-extract report -v './src/**/*.{vue,ts}' -l './src/locales/*.json' --add",
    "i18n:remove": "vue-i18n-extract report -v './src/**/*.{vue,ts}' -l './src/locales/*.json' --remove",
    "i18n:ci": "vue-i18n-extract report -v './src/**/*.{vue,ts}' -l './src/locales/*.json' --ci"
  }
}
```

### CI Integration

```yaml
# .github/workflows/i18n.yml
name: I18n Check

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run i18n:ci
```

### Translation Management Platforms

| Platform | Features |
|----------|----------|
| **Lokalise** | GitHub Actions, CLI, over-the-air updates |
| **Phrase** | In-context editor, smart suggestions |
| **POEditor** | Team collaboration, API access |
| **Crowdin** | GitHub integration, machine translation |

---

## Testing Approaches

### Mocking useI18n in Vitest

```typescript
// vitest.setup.ts
import { vi } from 'vitest'
import { ref } from 'vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    d: (date: Date) => date.toISOString(),
    n: (num: number) => num.toString(),
    locale: ref('en'),
    availableLocales: ['en', 'ja']
  }),
  createI18n: () => ({
    install: () => {},
    global: {
      t: (key: string) => key
    }
  })
}))
```

### Component Testing with Real i18n

```typescript
// test-utils.ts
import { mount, type MountingOptions } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { Component } from 'vue'

const messages = {
  en: {
    greeting: 'Hello, {name}!',
    button: { submit: 'Submit' }
  }
}

export function mountWithI18n(
  component: Component,
  options: MountingOptions<unknown> = {}
) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages
  })

  return mount(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [...(options.global?.plugins || []), i18n]
    }
  })
}
```

### Testing Translation Keys Exist

```typescript
// i18n.test.ts
import { describe, it, expect } from 'vitest'
import en from '@/locales/en.json'
import ja from '@/locales/ja.json'

function flattenKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null) {
      return flattenKeys(value, path)
    }
    return [path]
  })
}

describe('i18n', () => {
  it('all locales have same keys', () => {
    const enKeys = flattenKeys(en).sort()
    const jaKeys = flattenKeys(ja).sort()

    expect(jaKeys).toEqual(enKeys)
  })

  it('no empty translations', () => {
    const checkEmpty = (obj: object, locale: string, path = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullPath = path ? `${path}.${key}` : key
        if (typeof value === 'string') {
          expect(value.trim(), `${locale}:${fullPath} is empty`).not.toBe('')
        } else if (typeof value === 'object') {
          checkEmpty(value, locale, fullPath)
        }
      })
    }

    checkEmpty(en, 'en')
    checkEmpty(ja, 'ja')
  })
})
```

### Testing Pluralization

```typescript
import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'

describe('pluralization', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        items: 'no items | {n} item | {n} items'
      }
    }
  })

  it('handles zero', () => {
    expect(i18n.global.t('items', 0)).toBe('no items')
  })

  it('handles singular', () => {
    expect(i18n.global.t('items', 1)).toBe('1 item')
  })

  it('handles plural', () => {
    expect(i18n.global.t('items', 5)).toBe('5 items')
  })
})
```

---

## Anti-Patterns to Avoid

### 1. Calling useI18n Multiple Times

```typescript
// BAD - Multiple calls cause sync issues
const { t } = useI18n()
const { locale } = useI18n() // Second call!

// GOOD - Single call, destructure all
const { t, locale, d, n } = useI18n()
```

### 2. Using v-html for Translations

```vue
<!-- BAD - XSS vulnerability -->
<p v-html="$t('richContent')"></p>

<!-- GOOD - Use component interpolation -->
<i18n-t keypath="richContent" tag="p">
  <template #link>
    <a href="/page">{{ $t('linkText') }}</a>
  </template>
</i18n-t>
```

### 3. Hardcoding Strings in Components

```vue
<!-- BAD -->
<button>Submit</button>
<p>Welcome to our app!</p>

<!-- GOOD -->
<button>{{ t('buttons.submit') }}</button>
<p>{{ t('welcome') }}</p>
```

### 4. Testing Actual Translations

```typescript
// BAD - Translations change frequently
expect(wrapper.text()).toContain('Welcome to My App')

// GOOD - Test translation keys
expect(wrapper.text()).toContain('home.welcome')
// Or use real i18n but check structure, not content
```

### 5. Loading All Translations Upfront

```typescript
// BAD - Large initial bundle
import en from './locales/en.json'
import ja from './locales/ja.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
// ... 20 more languages

// GOOD - Lazy load
const messages = await import(`./locales/${locale}.json`)
```

### 6. Forgetting Fallback Locale

```typescript
// BAD - Missing translations crash
const i18n = createI18n({
  locale: 'ja',
  messages: { ja }
})

// GOOD - Always set fallbackLocale
const i18n = createI18n({
  locale: 'ja',
  fallbackLocale: 'en', // Falls back if key missing
  messages: { ja, en }
})
```

### 7. Using Legacy API in New Projects

```typescript
// BAD - Deprecated, will be removed in v12
const i18n = createI18n({
  locale: 'en',
  messages
})

// GOOD - Composition API mode
const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: 'en',
  messages
})
```

### 8. Concatenating Translations

```typescript
// BAD - Breaks in many languages
t('hello') + ', ' + t('name') + '!'

// GOOD - Use interpolation
// Message: "Hello, {name}!"
t('greeting', { name: userName })
```

### 9. Splitting Sentences

```json
// BAD - Word order varies by language
{
  "prefix": "You have",
  "suffix": "items"
}

// GOOD - Complete sentences
{
  "items": "You have {count} items"
}
```

### 10. Ignoring Plural Rules

```json
// BAD - Only works for English
{
  "items": "{count} items"
}

// GOOD - Proper pluralization
{
  "items": "no items | {n} item | {n} items"
}
```

---

## Migration Notes (v8 to v9)

### Breaking Changes

| v8 | v9 | Notes |
|----|-----|-------|
| `new VueI18n()` | `createI18n()` | Function-based creation |
| `dateTimeFormats` | `datetimeFormats` | Lowercase 't' |
| `$tc(key, n)` | `$t(key, n)` | Pluralization in `t()` |
| `<i18n>` component | `<i18n-t>` component | Renamed to avoid SFC conflict |
| `path` prop | `keypath` prop | In `<i18n-t>` component |
| `place` attribute | Named slots | For component interpolation |
| `getChoiceIndex` | `pluralRules` option | Custom plural rules |
| Returns object/array | Returns string only | Use `tm()` for objects |

### Migration Example

```typescript
// v8
new VueI18n({
  locale: 'en',
  dateTimeFormats: { /* ... */ },
  messages
})

// In component
this.$tc('items', count)

// v9
createI18n({
  legacy: false,
  locale: 'en',
  datetimeFormats: { /* ... */ }, // Note: lowercase 't'
  messages
})

// In component
const { t } = useI18n()
t('items', count)
```

### Deprecated Features (Remove in v12)

- Legacy API mode (`legacy: true`)
- `$tc()` function (use `$t()` with number)
- Rails i18n format (`%{variable}`)
- Custom formatter support

---

## Sources

- [Vue I18n Official Documentation](https://vue-i18n.intlify.dev/)
- [Vue I18n Composition API Guide](https://vue-i18n.intlify.dev/guide/advanced/composition)
- [Vue I18n Message Format Syntax](https://vue-i18n.intlify.dev/guide/essentials/syntax)
- [Vue I18n Pluralization](https://vue-i18n.intlify.dev/guide/essentials/pluralization)
- [Vue I18n DateTime Formatting](https://vue-i18n.intlify.dev/guide/essentials/datetime)
- [Vue I18n Number Formatting](https://vue-i18n.intlify.dev/guide/essentials/number)
- [Vue I18n TypeScript Support](https://vue-i18n.intlify.dev/guide/advanced/typescript)
- [Vue I18n Lazy Loading](https://vue-i18n.intlify.dev/guide/advanced/lazy)
- [Vue I18n Optimization](https://vue-i18n.intlify.dev/guide/advanced/optimization)
- [Vue I18n Component Interpolation](https://vue-i18n.intlify.dev/guide/advanced/component)
- [Vue I18n Breaking Changes v9](https://vue-i18n.intlify.dev/guide/migration/breaking)
- [@nuxtjs/i18n Documentation](https://i18n.nuxtjs.org/)
- [vue-i18n-extract GitHub](https://github.com/Spittal/vue-i18n-extract)
- [Implementing i18n in Vue 3 with TypeScript](https://yundrox.dev/posts/claritybox/implementing-i18n-in-vue3-with-typescript-a-complete-guide/)
- [Mocking translations with vue3, vue-i18n and vitest](https://medium.com/@guillaume.bretou/mocking-translations-with-vue3-components-vue-i18n-vitest-87976f1894fc)
