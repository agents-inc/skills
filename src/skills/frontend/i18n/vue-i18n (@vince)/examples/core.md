# vue-i18n Examples

> Core code examples for vue-i18n internationalization. See other files in this folder for advanced patterns.

---

## Setup Examples

### Good Example - Complete Project Setup

```typescript
// src/i18n/index.ts
import { createI18n } from "vue-i18n";
import en from "../locales/en.json";

export const SUPPORTED_LOCALES = ["en", "ja", "fr", "de"] as const;
export const DEFAULT_LOCALE = "en";

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const i18n = createI18n({
  legacy: false, // REQUIRED for Composition API
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  globalInjection: true,
  messages: {
    en,
  },
});

export { i18n };
```

```typescript
// main.ts
import { createApp } from "vue";
import { i18n } from "./i18n";
import App from "./App.vue";

const app = createApp(App);
app.use(i18n);
app.mount("#app");
```

**Why good:** legacy: false enables Composition API mode, named constants for locales enable type safety, fallbackLocale prevents errors on missing keys, single export point for i18n configuration

### Bad Example - Legacy Mode Without Constants

```typescript
// main.ts
import { createI18n } from "vue-i18n";

const i18n = createI18n({
  locale: "en", // Magic string, not reusable
  messages: {
    en: { greeting: "Hello" },
    ja: { greeting: "こんにちは" },
  },
});
// Missing legacy: false - defaults to legacy mode!
```

**Why bad:** no `legacy: false` means Options API mode (deprecated in v11), locale strings are duplicated, no fallbackLocale causes errors, messages inline instead of separate files

---

## useI18n Examples

### Good Example - Single Composable Call

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { SupportedLocale } from "@/i18n";

// CRITICAL: Single call, destructure everything needed
const { t, d, n, locale, availableLocales, tm, te } = useI18n();

const switchLocale = (newLocale: SupportedLocale) => {
  locale.value = newLocale;
  document.documentElement.setAttribute("lang", newLocale);
};
</script>

<template>
  <main>
    <h1>{{ t("dashboard.title") }}</h1>
    <p>{{ t("dashboard.welcome", { name: userName }) }}</p>

    <section>
      <h2>{{ t("dashboard.stats.heading") }}</h2>
      <p>{{ d(lastUpdated, "long") }}</p>
      <p>{{ n(totalItems, "decimal") }}</p>
    </section>

    <select
      :value="locale"
      aria-label="Select language"
      @change="switchLocale($event.target.value as SupportedLocale)"
    >
      <option v-for="loc in availableLocales" :key="loc" :value="loc">
        {{ loc }}
      </option>
    </select>
  </main>
</template>
```

**Why good:** single useI18n call avoids sync issues, locale.value is reactive, document.lang updated for accessibility, aria-label on select for screen readers

### Bad Example - Multiple useI18n Calls

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";

// WRONG: Multiple calls create separate instances
const { t } = useI18n();
const { locale } = useI18n();
const { d } = useI18n();

// These may not stay synchronized!
</script>
```

**Why bad:** multiple useI18n calls may return different instances, locale changes in one don't propagate to others, causes subtle bugs that are hard to debug

---

## Interpolation Examples

### Good Example - Named Interpolation

```typescript
// locales/en.json
{
  "Profile": {
    "greeting": "Welcome back, {name}!",
    "accountInfo": "Signed in as {name} ({email})",
    "passwordHint": "Password must be at least {minLength} characters",
    "lastLogin": "Last login: {date} from {location}"
  }
}
```

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";

const MIN_PASSWORD_LENGTH = 8;

const { t } = useI18n();

const user = {
  name: "Jane",
  email: "jane@example.com",
};
</script>

<template>
  <div>
    <h1>{{ t("Profile.greeting", { name: user.name }) }}</h1>
    <p>{{ t("Profile.accountInfo", { name: user.name, email: user.email }) }}</p>
    <p>{{ t("Profile.passwordHint", { minLength: MIN_PASSWORD_LENGTH }) }}</p>
  </div>
</template>
```

**Why good:** named placeholders are explicit, named constant for magic number, TypeScript can validate placeholder names with augmentation

### Good Example - Linked Messages

```json
{
  "app": {
    "name": "TaskMaster",
    "tagline": "Get things done"
  },
  "header": {
    "title": "Welcome to @:app.name",
    "subtitle": "@:app.tagline - better than ever"
  },
  "footer": {
    "copyright": "Copyright 2024 @:app.name. All rights reserved."
  }
}
```

```vue
<template>
  <header>
    <h1>{{ t("header.title") }}</h1>
    <!-- Output: "Welcome to TaskMaster" -->
    <p>{{ t("header.subtitle") }}</p>
    <!-- Output: "Get things done - better than ever" -->
  </header>
  <footer>
    <small>{{ t("footer.copyright") }}</small>
    <!-- Output: "Copyright 2024 TaskMaster. All rights reserved." -->
  </footer>
</template>
```

**Why good:** app name defined once via `@:app.name` reference, changing app.name updates all references, reduces duplication and translation errors

---

## Pluralization Examples

### Good Example - Complete Plural Forms

```json
{
  "Notifications": {
    "unreadCount": "no notifications | {n} notification | {n} notifications",
    "messages": "no messages | one message | {count} messages",
    "files": "no files | {n} file | {n} files"
  }
}
```

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed } from "vue";

const { t } = useI18n();

const unreadCount = 5;
const messageCount = 1;
const fileCount = 0;
</script>

<template>
  <div>
    <span>{{ t("Notifications.unreadCount", unreadCount) }}</span>
    <!-- Output: "5 notifications" -->

    <span>{{ t("Notifications.messages", messageCount) }}</span>
    <!-- Output: "one message" -->

    <span>{{ t("Notifications.files", fileCount) }}</span>
    <!-- Output: "no files" -->
  </div>
</template>
```

**Why good:** three forms handle zero/one/many cases, `{n}` is auto-injected, zero case provides friendly "no X" message

### Bad Example - Concatenating Instead of Pluralizing

```vue
<script setup lang="ts">
const { t } = useI18n();
const count = 5;
</script>

<template>
  <!-- WRONG: Concatenation breaks in many languages -->
  <span>{{ t("you.have") }} {{ count }} {{ t("items") }}</span>
  <!-- WRONG: No zero/one handling -->
  <span>{{ count }} {{ t("notifications") }}</span>
</template>
```

**Why bad:** word order varies by language (German: "Sie haben 5 Elemente"), no special handling for 0 or 1 count, results in awkward "0 notifications" or "1 notifications"

---

## Component Interpolation Examples

### Good Example - i18n-t with Links

```json
{
  "Legal": {
    "tos": "By signing up, you agree to our {terms} and {privacy}.",
    "termsLink": "Terms of Service",
    "privacyLink": "Privacy Policy"
  }
}
```

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <i18n-t keypath="Legal.tos" tag="p">
    <template #terms>
      <a href="/terms">{{ t("Legal.termsLink") }}</a>
    </template>
    <template #privacy>
      <a href="/privacy">{{ t("Legal.privacyLink") }}</a>
    </template>
  </i18n-t>
</template>
```

**Why good:** translation stays complete and translatable, Vue components inserted via named slots, `tag="p"` wraps in semantic element

### Good Example - i18n-t with Styled Plurals

```json
{
  "Cart": {
    "itemCount": "no items in cart | {n} item in cart | {n} items in cart"
  }
}
```

```vue
<script setup lang="ts">
import { ref } from "vue";

const cartItems = ref(3);
</script>

<template>
  <i18n-t keypath="Cart.itemCount" :plural="cartItems" tag="p">
    <template #n>
      <strong class="count">{{ cartItems }}</strong>
    </template>
  </i18n-t>
  <!-- Output: <p><strong class="count">3</strong> items in cart</p> -->
</template>
```

**Why good:** `:plural` prop determines which form to use, `#n` slot allows styling the number, pluralization logic stays in translation file

### Good Example - i18n-d with Scoped Slots

```vue
<script setup lang="ts">
import { ref } from "vue";

const eventDate = ref(new Date("2024-12-25T14:30:00"));
</script>

<template>
  <i18n-d :value="eventDate" format="long" tag="time">
    <template #month="{ month }">
      <span class="month">{{ month }}</span>
    </template>
    <template #day="{ day }">
      <span class="day">{{ day }}</span>
    </template>
    <template #weekday="{ weekday }">
      <span class="weekday">{{ weekday }}</span>
    </template>
  </i18n-d>
</template>

<style scoped>
.month {
  color: var(--color-primary);
  font-weight: bold;
}
.day {
  font-size: 2rem;
}
.weekday {
  text-transform: uppercase;
  font-size: 0.875rem;
}
</style>
```

**Why good:** scoped slots expose individual date parts, each part can be styled independently, locale-aware formatting preserved

---

## TypeScript Examples

### Good Example - Type-Safe Messages

```typescript
// src/i18n/types.ts
import type en from "../locales/en.json";

type MessageSchema = typeof en;

declare module "vue-i18n" {
  export interface DefineLocaleMessage extends MessageSchema {}
}

export type { MessageSchema };
```

```typescript
// src/i18n/index.ts
import { createI18n } from "vue-i18n";
import en from "../locales/en.json";
import ja from "../locales/ja.json";

type MessageSchema = typeof en;

export const i18n = createI18n<[MessageSchema], "en" | "ja">({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: {
    en,
    ja,
  },
});
```

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { MessageSchema } from "@/i18n/types";

const { t } = useI18n<{ message: MessageSchema }>();

// TypeScript catches invalid keys
t("dashboard.title"); // OK
// @ts-expect-error - "nonexistent" key doesn't exist
t("nonexistent.key"); // TypeScript error
</script>
```

**Why good:** message type inferred from JSON structure, invalid keys cause compile-time errors, IDE autocomplete for translation keys

### Good Example - Typed Format Options

```typescript
// src/i18n/types.ts
import type en from "../locales/en.json";

type MessageSchema = typeof en;

declare module "vue-i18n" {
  export interface DefineLocaleMessage extends MessageSchema {}

  export interface DefineDateTimeFormat {
    short: {
      year: "numeric";
      month: "short";
      day: "numeric";
    };
    long: {
      year: "numeric";
      month: "long";
      day: "numeric";
      weekday: "long";
      hour: "numeric";
      minute: "numeric";
    };
  }

  export interface DefineNumberFormat {
    currency: {
      style: "currency";
      currency: string;
    };
    decimal: {
      style: "decimal";
      minimumFractionDigits: number;
      maximumFractionDigits: number;
    };
  }
}
```

**Why good:** format names become type-safe, `d(date, "invalid")` causes TypeScript error, IDE autocomplete shows available formats

---

## Locale Switching Examples

### Good Example - Accessible Locale Switcher

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n";

const { locale, t } = useI18n();

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  ja: "日本語",
  fr: "Français",
  de: "Deutsch",
};

const handleLocaleChange = (newLocale: SupportedLocale) => {
  locale.value = newLocale;
  document.documentElement.setAttribute("lang", newLocale);
  localStorage.setItem("user-locale", newLocale);
};
</script>

<template>
  <div role="group" :aria-labelledby="'locale-switcher-label'">
    <span id="locale-switcher-label" class="sr-only">
      {{ t("LocaleSwitcher.label") }}
    </span>
    <select
      :value="locale"
      :aria-label="t('LocaleSwitcher.selectLabel')"
      @change="handleLocaleChange($event.target.value as SupportedLocale)"
    >
      <option v-for="loc in SUPPORTED_LOCALES" :key="loc" :value="loc">
        {{ LOCALE_NAMES[loc] }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
```

**Why good:** accessible with aria attributes, persists preference to localStorage, updates document lang for screen readers, type-safe locale handling

### Good Example - Link-Based Locale Switcher

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n";

const { locale } = useI18n();

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  ja: "日本語",
  fr: "Français",
  de: "Deutsch",
};

const switchLocale = (newLocale: SupportedLocale) => {
  locale.value = newLocale;
  document.documentElement.setAttribute("lang", newLocale);
};
</script>

<template>
  <nav aria-label="Language selection">
    <ul>
      <li v-for="loc in SUPPORTED_LOCALES" :key="loc">
        <button
          type="button"
          :aria-current="loc === locale ? 'true' : undefined"
          :class="{ active: loc === locale }"
          @click="switchLocale(loc)"
        >
          {{ LOCALE_NAMES[loc] }}
        </button>
      </li>
    </ul>
  </nav>
</template>
```

**Why good:** semantic nav and list structure, aria-current indicates active locale, button elements for interactivity

---

_For advanced patterns, see other files in this folder: [formatting.md](formatting.md), [lazy-loading.md](lazy-loading.md)._
