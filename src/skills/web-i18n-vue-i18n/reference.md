# vue-i18n Reference

> Decision trees, anti-pattern code, checklists, plural-rule tables and migration notes. Red flags
> and pattern guidance live in [SKILL.md](SKILL.md); runnable code lives in [examples/](examples/).

---

## Decision Framework

### Global vs local scope

```
Is the message shared across the app?
├─ YES → global scope (the default) — useI18n()
└─ NO  → component-specific → useI18n({ messages: { en: { ... } } })
         Note: @:linked keys resolve against global messages only
```

### t() vs component interpolation

```
Does the message carry placeholders?
├─ YES → Do they need to be Vue components?  → yes → <i18n-t> with named slots
│                                              no  → t("key", { name: value })
└─ NO  → Do individual formatted parts need styling?
         Date/time → <i18n-d> with scoped slots
         Number    → <i18n-n> with scoped slots
         Neither   → t("key")
```

### Pluralization

```
Does the message depend on a count?
├─ YES → Language with more than three forms (Russian, Polish, Arabic)?
│        → yes → configure pluralRules for that locale
│        → no  → pipe syntax: "none | one | {n} many"
└─ NO  → Varies by enum value? → separate keys (status.pending, status.approved)
         Otherwise             → plain interpolation
```

### Lazy loading

```
Multi-locale app?
├─ YES → Translations over ~50KB per locale?
│        → yes → lazy load: per route, per feature, preload on hover
│        → no  → bundle them all; simpler, and there is no loading state to handle
└─ NO  → bundle the single locale
```

---

## Anti-Patterns

### Multiple useI18n calls

Separate calls can resolve to separate composer instances holding separate locale refs.

```typescript
// WRONG - three instances that can disagree
const { t } = useI18n();
const { locale } = useI18n();
const { d } = useI18n();

// CORRECT - one call
const { t, locale, d, n, availableLocales } = useI18n();
```

### Hardcoded locale strings

```typescript
// WRONG - the locale list now exists in two places
if (locale.value === "en") { ... }
const locales = ["en", "ja", "fr"];

// CORRECT
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../i18n";

if (locale.value === DEFAULT_LOCALE) { ... }
const locales = SUPPORTED_LOCALES;
```

### String concatenation

Word order is not shared between languages, so a sentence assembled from fragments can only be
correct in the one it was assembled for.

```typescript
// WRONG
t("you.have") + " " + count + " " + t("items");
// English: "You have 5 items"
// German:  "Sie haben 5 Elemente"          (verb placement differs)
// Japanese: "5個のアイテムがあります"        (count precedes the noun)

// CORRECT - one message, interpolated
t("items.count", { count: 5 });
// "You have {count} items" — the translator moves the placeholder
```

### v-html on a translation

```vue
<!-- WRONG - whatever the message contains reaches the DOM as markup -->
<p v-html="t('userMessage')"></p>

<!-- CORRECT - component interpolation -->
<i18n-t keypath="termsMessage" tag="p">
  <template #link>
    <a href="/terms">{{ t("termsLink") }}</a>
  </template>
</i18n-t>
```

### Missing legacy: false

```typescript
// WRONG - Options API mode, removed in v12; useI18n() is unavailable
const i18n = createI18n({ locale: "en", messages });

// CORRECT
const i18n = createI18n({ legacy: false, locale: "en", messages });
```

### Asserting on translated copy

Copy changes without the behaviour changing, so an assertion on the rendered text reddens for
reasons that are not defects. Assert that the key was requested, or that it exists.

```typescript
// WRONG - reddens on any copy edit
expect(wrapper.text()).toContain("Welcome to My App");

// CORRECT - stub the composable so t returns its own key, and assert on the key.
// `translate` is that stub, built with whatever your test runner spies with.
expect(translate).toHaveBeenCalledWith("welcome.title");

// Or assert the key is present in the message file
import en from "../locales/en.json";
expect(en.welcome.title).toBeDefined();
```

---

## Checklists

### createI18n configuration

- [ ] `legacy: false`
- [ ] `locale` set to the default or detected locale
- [ ] `fallbackLocale` set
- [ ] `globalInjection` left at its default of `true` unless `$t`/`$d`/`$n` are unwanted in templates
- [ ] `datetimeFormats` configured (lowercase `t`)
- [ ] `numberFormats` configured
- [ ] `pluralRules` supplied for any locale with more than three plural forms

### Component

- [ ] One `useI18n()` call, everything destructured from it
- [ ] `document.documentElement.lang` updated when the locale changes
- [ ] A loading state covering the gap while a locale's messages load
- [ ] `<i18n-t>` for messages containing components
- [ ] `<i18n-d>` / `<i18n-n>` where individual formatted parts need styling

### Message files

- [ ] Nested structure
- [ ] Pipe syntax for plurals (`none | one | {n} many`)
- [ ] Named interpolation (`{name}`), not positional
- [ ] Complete sentences per key, never split across keys
- [ ] `@:linked.key` for values repeated across messages
- [ ] The same key structure in every locale file

### Performance

- [ ] `@intlify/unplugin-vue-i18n` for message pre-compilation
- [ ] `runtimeOnly: true` in the plugin options
- [ ] `__VUE_I18N_LEGACY_API__: false` and the sibling flags defined, to drop unused code
- [ ] Non-default locales loaded on demand
- [ ] Large message files split by feature
- [ ] Locales preloaded on hover where the switch is user-initiated

---

## Pluralization Reference

### Plural form count by language

| Forms                                | Languages                                     |
| ------------------------------------ | --------------------------------------------- |
| 1 (other only)                       | Chinese, Japanese, Korean, Vietnamese         |
| 2 (one, other)                       | English, German, Italian, Spanish, Portuguese |
| 3 (one, few, other)                  | French, Brazilian Portuguese                  |
| 4 (one, few, many, other)            | Russian, Ukrainian, Polish, Czech             |
| 6 (zero, one, two, few, many, other) | Arabic                                        |

### Pipe syntax

```
Two forms:   "car | cars"
Three forms: "no items | one item | {n} items"
Four forms:  "нет | {n} яблоко | {n} яблока | {n} яблок"

{n}     - the value passed as the second argument
{count} - an alias for {n}
```

### Custom plural rule

```typescript
pluralRules: {
  ru: (choice: number, choicesLength: number) => {
    // return the INDEX of the form, in 0..choicesLength-1
    if (choice === 0) return 0;
    if (choice === 1) return 1;
    if (choice >= 2 && choice <= 4) return 2;
    return 3;
  };
}
```

---

## Message Format Reference

### Interpolation

```
Named:     {name}
List:      {0}, {1}
Literal:   {'@'}          escapes @
Linked:    @:path.to.key
Modifiers: @.upper:key, @.lower:key, @.capitalize:key
```

### DateTime format options

```typescript
{
  year: "numeric" | "2-digit",
  month: "numeric" | "2-digit" | "narrow" | "short" | "long",
  day: "numeric" | "2-digit",
  weekday: "narrow" | "short" | "long",
  hour: "numeric" | "2-digit",
  minute: "numeric" | "2-digit",
  second: "numeric" | "2-digit",
  hour12: boolean,
  timeZone: string,
  timeZoneName: "short" | "long"
}
```

### Number format options

```typescript
{
  style: "decimal" | "currency" | "percent" | "unit",
  currency: string,           // "USD", "EUR", "JPY"
  currencyDisplay: "symbol" | "narrowSymbol" | "code" | "name",
  notation: "standard" | "scientific" | "engineering" | "compact",
  compactDisplay: "short" | "long",
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  useGrouping: boolean
}
```

---

## Migration

### v8 → v9

| v8                   | v9                   | Note                          |
| -------------------- | -------------------- | ----------------------------- |
| `new VueI18n()`      | `createI18n()`       | function-based creation       |
| `dateTimeFormats`    | `datetimeFormats`    | lowercase `t`                 |
| `$tc(key, n)`        | `$t(key, n)`         | pluralization moved into `t`  |
| `<i18n>` component   | `<i18n-t>` component | renamed to avoid SFC conflict |
| `path` prop          | `keypath` prop       | on `<i18n-t>`                 |
| `place` attribute    | named slots          | for component interpolation   |
| `getChoiceIndex`     | `pluralRules` option | custom plural rules           |
| returns object/array | returns string only  | use `tm()` for objects        |

### Deprecated in v11, removed in v12

- Legacy API mode (`legacy: true`)
- The `v-t` directive
- Rails i18n format (`%{variable}`) — use `{variable}`

### Already removed in v10/v11

- `$tc()`
- Custom formatter support
- `allowComposition`
- `vue-i18n-bridge` (Vue 2 is end-of-life)
- Modulo `%` syntax for named interpolation
- `preserveDirectiveContent`, and the `preserve` modifier on `v-t`
