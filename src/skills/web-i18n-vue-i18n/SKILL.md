---
name: web-i18n-vue-i18n
description: Type-safe i18n for Vue 3 Composition API — useI18n, pipe-syntax plurals, i18n-t/d/n components, lazy-loaded locales. Load when a project imports vue-i18n.
---

# vue-i18n Internationalization Patterns

> **Quick Guide:** `createI18n({ legacy: false })` selects Composition API mode, and `useI18n()`
> returns `t` for messages, `d` for dates, `n` for numbers and `locale` as a writable ref. Plurals
> are pipe-separated rather than ICU. `<i18n-t>`, `<i18n-d>` and `<i18n-n>` put components and
> styling inside a formatted result. Version boundary: Legacy API mode, the `v-t` directive and the
> Rails `%{var}` format are deprecated in v11 and removed in v12; `$tc()` is already gone.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — setup, useI18n, interpolation, linked messages, plurals, `<i18n-t>`/`<i18n-d>`, types, locale switching
- [examples/formatting.md](examples/formatting.md) — datetime and number format configuration, `<i18n-d>`/`<i18n-n>` scoped slots, dynamic currency
- [examples/lazy-loading.md](examples/lazy-loading.md) — dynamic imports, loading before render, feature splitting, retry and fallback, SSR-safe detection
- [reference.md](reference.md) — decision trees, anti-pattern code, checklists, plural-rule tables, v8→v9 migration and v11/v12 removals

---

## Which path applies

- **Messages shared across the app** — global scope, the default. `useI18n()` reads the instance
  created by `createI18n`. Follow [examples/core.md](examples/core.md).
- **Messages belonging to one component** — local scope, `useI18n({ messages: { en: { ... } } })`.
  Linked messages (`@:key`) resolve against global messages only, so a locally-scoped message cannot
  reference one.
- **Locales loaded on demand rather than bundled** — `setLocaleMessage` after a dynamic import, and
  the locale is not switched until the import resolves. Follow
  [examples/lazy-loading.md](examples/lazy-loading.md).

---

<critical_requirements>

## Before writing vue-i18n code

**Set `legacy: false` in `createI18n`.** It is what enables `useI18n()`; the default is the Options
API mode that v11 deprecates and v12 removes.

**Take everything from one `useI18n()` call per component.** Destructure `t`, `d`, `n` and `locale`
together — separate calls can resolve to separate composer instances that then disagree about the
current locale.

**Await the message load before assigning `locale.value`.** Switching first renders the raw keys
until the import resolves.

**Set `fallbackLocale`.** Without it a key missing from the active locale renders as the key rather
than as the default locale's text.

</critical_requirements>

---

**Auto-detection:** vue-i18n, useI18n, createI18n, legacy: false, setLocaleMessage, i18n-t, i18n-d,
i18n-n, keypath, pluralRules, datetimeFormats, numberFormats, fallbackLocale, globalInjection

**Applies to:**

- Message rendering with named interpolation, linked messages and pipe-syntax pluralization
- Locale-aware date and number formatting through named format definitions
- Putting components or per-part styling inside a formatted result
- Loading and swapping locale message sets at runtime
- Typing message keys and format names so a wrong one fails at compile time

**Handled elsewhere:**

- Locale-aware routing — this skill settles loading messages before a view renders, not how URLs map
  to locales; the hook shape is in [examples/lazy-loading.md](examples/lazy-loading.md)
- Component authoring and reactivity — `locale` is an ordinary ref and needs nothing special
- Where the preferred locale is stored and how it is detected — this skill consumes a locale code
- Bundling and build configuration, beyond the message pre-compilation options in
  [reference.md](reference.md)

---

<philosophy>

Messages are plain JSON resolved through a reactive locale ref, so a locale change re-renders every
component that read a message — no subscription, no invalidation step. Two consequences shape the
API. Because the composer holds that ref, one component wants one composer, which is why repeated
`useI18n()` calls are the recurring bug. And because `t()` returns a string rather than a VNode,
anything needing markup inside a translation goes through `<i18n-t>` instead — which is also what
keeps `v-html` out of translated content.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Project setup

One instance, registered once on the app.

```typescript
export const i18n = createI18n({
  legacy: false, // enables useI18n()
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en },
});

app.use(i18n);
```

`globalInjection` defaults to `true`, which is what puts `$t`, `$d` and `$n` in templates.

Full code: [examples/core.md](examples/core.md)

### Pattern 2: useI18n

One call, everything destructured from it.

```vue
<script setup lang="ts">
const { t, d, n, locale, availableLocales } = useI18n();
</script>

<template>
  <h1>{{ t("dashboard.title") }}</h1>
  <p>{{ d(updatedAt, "long") }} · {{ n(total, "currency") }}</p>
</template>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Interpolation and linked messages

Named placeholders, `{'@'}` to escape a literal, and `@:key` to reference another message with an
optional case modifier.

```json
{
  "app": { "name": "My App" },
  "greeting": "Hello, {name}!",
  "welcome": "Welcome to @:app.name!",
  "shout": "@.upper:app.name"
}
```

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Pluralization

Pipe-separated forms rather than ICU. `{n}` and `{count}` both resolve to the value passed as the
second argument.

```json
{
  "car": "car | cars",
  "apple": "no apples | one apple | {count} apples"
}
```

Languages needing more than three forms take a `pluralRules` function per locale, which returns the
index of the form to use.

Full code: [examples/core.md](examples/core.md)

### Pattern 5: Component interpolation

`<i18n-t>` puts components into a message through named slots, keeping the sentence whole.

```vue
<i18n-t keypath="tos" tag="p">
  <template #terms>
    <a href="/terms">{{ t("termsLink") }}</a>
  </template>
</i18n-t>
```

`:plural` selects the form, and `<i18n-d>` / `<i18n-n>` expose each formatted part — `month`, `day`,
`currency`, `integer` — as its own scoped slot.

Full code: [examples/core.md](examples/core.md), scoped-slot styling in
[examples/formatting.md](examples/formatting.md)

### Pattern 6: Named datetime and number formats

Define the formats per locale once and refer to them by name, so a change lands everywhere.

```typescript
createI18n({
  legacy: false,
  locale: "en-US",
  datetimeFormats, // note the lowercase 't'
  numberFormats,
});

d(new Date(), "long"); // "Friday, April 19, 2024 at 2:30 PM"
n(10000, "currency"); // "$10,000.00"
```

Full code: [examples/formatting.md](examples/formatting.md)

### Pattern 7: Lazy-loaded locales

Register the messages, then move the locale — never the other way round.

```typescript
export async function setLocale(locale: SupportedLocale): Promise<void> {
  const messages = await import(`../locales/${locale}.json`);
  i18n.global.setLocaleMessage(locale, messages.default);
  i18n.global.locale.value = locale;
  document.documentElement.setAttribute("lang", locale);
}
```

Full code: [examples/lazy-loading.md](examples/lazy-loading.md)

### Pattern 8: Type-safe keys and formats

Augment `DefineLocaleMessage` with the shape of a message file, and `DefineDateTimeFormat` /
`DefineNumberFormat` with the format names.

```typescript
declare module "vue-i18n" {
  export interface DefineLocaleMessage extends MessageSchema {}
}
```

A wrong key, or a format name that was never defined, then fails at compile time.

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `createI18n` without `legacy: false` — `useI18n()` is unavailable, and the Options API mode it
  falls back to is removed in v12
- Assigning `locale` directly instead of `locale.value` — it is a ref, so the assignment does nothing
- `$tc()` — removed in v11; `t(key, count)` replaces it
- The `v-t` directive — deprecated in v11 and removed in v12; use `t()` or `<i18n-t>`
- `dateTimeFormats` as the config key — the option is `datetimeFormats`, and the misspelled key is
  silently ignored, so every named format resolves to nothing

**Surprising behaviour:**

- Two `useI18n()` calls in one component can yield two composers, and a locale change in one is
  invisible to the other
- Setting `locale.value` before the messages load renders the raw keys until the import resolves
- Without `fallbackLocale`, a key missing from the active locale renders as the key itself
- `@:linked.key` resolves against global messages only — it finds nothing from a locally-scoped
  `useI18n({ messages })`
- A `pluralRules` function returns the index of the form, not the form
- `t()` returns a string, so markup in a message needs `<i18n-t>`; reaching for `v-html` instead puts
  whatever is in the message straight into the DOM
- The document's `lang` attribute does not follow `locale` — update it on every switch; screen
  readers choose their pronunciation from it, and crawlers read it as the page's language
- Concatenating translated fragments assumes English word order, which most languages do not share

Anti-patterns with the code that fixes them, and the full v8→v9 and v11/v12 migration tables:
[reference.md](reference.md).

</red_flags>
