# vue-i18n Reference

> Decision frameworks, anti-patterns, and red flags for vue-i18n internationalization. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Global vs Local Scope

```
Is the translation shared across the app?
├─ YES → Global scope (default)
│   └─ Access via useI18n({ useScope: 'global' })
└─ NO → Is it component-specific?
    ├─ YES → Local scope with component messages
    │   └─ useI18n({ messages: { en: {...} } })
    └─ NO → Consider if it should be a prop instead
```

### When to Use t() vs Component Interpolation

```
Does the translation contain placeholders?
├─ YES → Do placeholders need Vue components?
│   ├─ YES → Use <i18n-t> component
│   │   └─ Named slots for component insertion
│   └─ NO → Use t() with interpolation
│       └─ t('key', { name: value })
└─ NO → Does it need styled parts?
    ├─ YES → Is it a date/time?
    │   ├─ YES → Use <i18n-d> with scoped slots
    │   └─ NO → Is it a number/currency?
    │       ├─ YES → Use <i18n-n> with scoped slots
    │       └─ NO → Use t() with CSS
    └─ NO → Use t() for plain text
```

### When to Use Pluralization

```
Does the message depend on a count?
├─ YES → Does the language have complex plural rules?
│   ├─ YES → Configure custom pluralRules
│   │   └─ Languages: Russian, Polish, Arabic, etc.
│   └─ NO → Use pipe syntax
│       └─ "none | one | {n} many"
└─ NO → Does the message vary by enum/type?
    ├─ YES → Consider separate translation keys
    │   └─ status.pending, status.approved, etc.
    └─ NO → Use simple interpolation
```

### Lazy Loading Decision

```
Is the app multi-locale?
├─ YES → Are translations large (> 50KB per locale)?
│   ├─ YES → Use lazy loading
│   │   ├─ Route-based loading
│   │   ├─ Feature-based splitting
│   │   └─ Preload on hover
│   └─ NO → Consider bundling all locales
│       └─ Simpler, no loading states
└─ NO → Bundle the single locale
    └─ No i18n complexity needed
```

---

## RED FLAGS

### High Priority Issues

- **Missing `legacy: false` in createI18n** - Defaults to deprecated Options API mode, will be removed in v12
- **Multiple `useI18n()` calls in same component** - Creates separate instances that may desync, always destructure from one call
- **Hardcoded locale strings** - Use named constants from config for type safety and single source of truth
- **Missing `fallbackLocale` configuration** - Missing translations cause visible errors instead of graceful fallback
- **Using v-html with translations** - XSS vulnerability, use `<i18n-t>` component interpolation instead

### Medium Priority Issues

- **Missing `globalInjection: true`** - Templates can't use `$t`, `$d`, `$n` shorthand
- **Inline datetime/number format options** - Define named formats in config for consistency
- **Not updating `document.documentElement.lang`** - Accessibility and SEO issue when locale changes
- **Loading all locales upfront** - Poor performance for apps with many locales
- **Concatenating translated strings** - Word order varies by language, use single complete messages

### Common Mistakes

- Forgetting to await locale loading before using translations
- Using `dateTimeFormats` instead of `datetimeFormats` (lowercase 't')
- Not handling loading states during lazy locale loading
- Expecting `t()` to return ReactNode (it returns string, use `<i18n-t>` for components)
- Using `$tc` (deprecated in v10, removed in v11) instead of `t()` with count parameter

### Gotchas & Edge Cases

- `locale.value` from `useI18n()` is a ref - assign with `.value`, not direct assignment
- Custom `pluralRules` function receives `choicesLength` - return index into array, not the form itself
- `@:linked.message` syntax doesn't work with local scope - only global messages
- `datetimeFormats` uses camelCase in config, but `dateTimeFormats` is a common typo
- Legacy API mode is deprecated in v11 and will be removed in v12 - always use Composition API with `legacy: false`
- `v-t` directive is deprecated in v11 and will be removed in v12 - use `t()` or `<i18n-t>` instead

---

## Anti-Patterns

### Multiple useI18n Calls

Each `useI18n()` call may create a separate composer instance. Always destructure all needed functions from a single call.

```typescript
// WRONG - Multiple calls may desync
const { t } = useI18n();
const { locale } = useI18n(); // Separate instance!
const { d } = useI18n(); // Another instance!

// CORRECT - Single call, destructure all
const { t, locale, d, n, availableLocales } = useI18n();
```

### Hardcoded Locale Strings

Never hardcode locale strings. Use named constants for type safety.

```typescript
// WRONG - Magic strings
if (locale.value === "en") { ... }
const locales = ["en", "ja", "fr"];

// CORRECT - Named constants
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/i18n";

if (locale.value === DEFAULT_LOCALE) { ... }
const locales = SUPPORTED_LOCALES;
```

### String Concatenation in Translations

Word order varies dramatically between languages. Never concatenate translated strings.

```typescript
// WRONG - Concatenation breaks in most languages
t("you.have") + " " + count + " " + t("items");
// English: "You have 5 items"
// German expects: "Sie haben 5 Elemente" (different word order)
// Japanese expects: "5個のアイテムがあります" (count before noun)

// CORRECT - Complete sentence with interpolation
t("items.count", { count: 5 });
// Message: "You have {count} items"
// Translators handle word order per language
```

### Using v-html with Translations

User-generated content in translations can lead to XSS attacks.

```vue
<!-- WRONG - XSS vulnerability -->
<p v-html="t('userMessage')"></p>
<!-- If translation contains <script>, it executes! -->

<!-- CORRECT - Component interpolation -->
<i18n-t keypath="termsMessage" tag="p">
  <template #link>
    <a href="/terms">{{ t("termsLink") }}</a>
  </template>
</i18n-t>
```

### Missing Legacy False

Without `legacy: false`, vue-i18n uses the deprecated Options API mode.

```typescript
// WRONG - Defaults to legacy mode
const i18n = createI18n({
  locale: "en",
  messages,
});
// Uses this.$t() instead of useI18n()
// Will break when v12 removes legacy support

// CORRECT - Composition API mode
const i18n = createI18n({
  legacy: false, // Required for useI18n()
  locale: "en",
  messages,
});
```

### Testing Actual Translation Text

Translations change frequently. Test keys exist, not content.

```typescript
// WRONG - Brittle test
expect(wrapper.text()).toContain("Welcome to My App");
// Breaks when translation changes

// CORRECT - Test translation key is called
const t = vi.fn((key) => key);
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t }),
}));
expect(t).toHaveBeenCalledWith("welcome.title");

// Or verify the key exists in your translation files
import en from "@/locales/en.json";
expect(en.welcome.title).toBeDefined();
```

---

## Quick Reference

### createI18n Configuration Checklist

- [ ] Set `legacy: false` for Composition API mode
- [ ] Set `locale` to default/detected locale
- [ ] Set `fallbackLocale` for missing translation fallback
- [ ] Set `globalInjection: true` for template shorthand
- [ ] Configure `datetimeFormats` for date formatting (camelCase!)
- [ ] Configure `numberFormats` for currency/number formatting
- [ ] Set `pluralRules` for languages with complex plural forms

### Component Checklist

- [ ] Single `useI18n()` call, destructure all needed functions
- [ ] Use named constants for locale values
- [ ] Update `document.documentElement.lang` when locale changes
- [ ] Handle loading state during lazy locale loading
- [ ] Use `<i18n-t>` for translations with components
- [ ] Use `<i18n-d>` / `<i18n-n>` for styled date/number parts

### Message File Checklist

- [ ] Use nested structure for organization
- [ ] Use pipe syntax for pluralization (`none | one | {n} many`)
- [ ] Use named interpolation (`{name}`) not positional
- [ ] Keep sentences complete - don't split across keys
- [ ] Use `@:linked.key` for shared values like app name
- [ ] Match structure across all locale files

### Performance Checklist

- [ ] Use `@intlify/unplugin-vue-i18n` for message pre-compilation
- [ ] Set `runtimeOnly: true` in Vite plugin
- [ ] Define feature flags to drop unused code
- [ ] Lazy load non-default locales
- [ ] Split large translation files by feature
- [ ] Preload locales on hover for perceived performance

---

## Pluralization Rules Reference

### Languages by Plural Category Count

| Categories | Languages |
|------------|-----------|
| 1 (other only) | Chinese, Japanese, Korean, Vietnamese |
| 2 (one, other) | English, German, Italian, Spanish, Portuguese |
| 3 (one, few, other) | French, Brazilian Portuguese |
| 4 (one, few, many, other) | Russian, Ukrainian, Polish, Czech |
| 6 (zero, one, two, few, many, other) | Arabic |

### Pipe Syntax Quick Reference

```
Two forms:     "car | cars"
Three forms:   "no items | one item | {n} items"
Four forms:    "нет | {n} яблоко | {n} яблока | {n} яблок"

{n} - Auto-injected count value
{count} - Alias for {n}
```

### Custom Plural Rule Template

```typescript
pluralRules: {
  // Language code
  ru: (choice: number, choicesLength: number) => {
    // Return index (0 to choicesLength-1) based on choice value
    if (choice === 0) return 0;          // First form
    if (choice === 1) return 1;          // Second form
    if (choice >= 2 && choice <= 4) return 2;  // Third form
    return 3;                            // Fourth form
  }
}
```

---

## Message Format Quick Reference

### Interpolation Syntax

```
Named:       {name}
List:        {0}, {1}
Literal:     {'@'} (escapes @)
Linked:      @:path.to.key
Modifiers:   @.upper:key, @.lower:key, @.capitalize:key
```

### Plural Syntax

```
Two forms:   "singular | plural"
N forms:     "zero | one | few | many | other"
With count:  "no items | {n} item | {n} items"
```

### DateTime Format Options

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

### Number Format Options

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

### Deprecated in v11 (Will Be Removed in v12)

- Legacy API mode (`legacy: true`) - use Composition API with `legacy: false`
- `v-t` directive - use `t()` function or `<i18n-t>` component
- Rails i18n format (`%{variable}`) - use named interpolation `{variable}`

### Already Removed in v10/v11

- `$tc()` function - use `$t()` or `t()` with count parameter
- Custom formatter support
- `allowComposition` option
- `vue-i18n-bridge` (Vue 2 EOL)
- Modulo `%` syntax for named interpolation
- `preserveDirectiveContent` option
- `preserve` modifier on `v-t` directive
