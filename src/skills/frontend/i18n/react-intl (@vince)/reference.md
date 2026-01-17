# React-Intl Reference

> Decision frameworks, anti-patterns, and red flags for react-intl internationalization. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use FormattedMessage vs useIntl

```
Are you rendering in JSX?
├─ YES → Is it text content in an element?
│   ├─ YES → Use FormattedMessage ✓
│   └─ NO → Is it for an attribute (placeholder, aria-label, title)?
│       ├─ YES → Use useIntl.formatMessage() ✓
│       └─ NO → Is it for a third-party component prop?
│           ├─ YES → Use useIntl.formatMessage() ✓
│           └─ NO → FormattedMessage ✓
└─ NO → Is it for programmatic use (document.title, analytics)?
    ├─ YES → Use useIntl.formatMessage() ✓
    └─ NO → Not applicable
```

### When to Use defineMessages

```
Are you defining multiple related messages?
├─ YES → Use defineMessages() ✓
└─ NO → Is the message inline in JSX?
    ├─ YES → Inline in FormattedMessage is fine ✓
    └─ NO → Use defineMessage() for single message ✓
```

### When to Use ICU Pluralization

```
Does the message include a count?
├─ YES → Is it a cardinal number (1, 2, 3...)?
│   ├─ YES → Use {count, plural, ...} ✓
│   └─ NO → Is it an ordinal (1st, 2nd, 3rd...)?
│       ├─ YES → Use {count, selectordinal, ...} ✓
│       └─ NO → Use simple interpolation {count}
└─ NO → Does the message vary by enum value?
    ├─ YES → Use {value, select, ...} ✓
    └─ NO → Use simple interpolation or static text
```

### When to Use Formatting Components vs useIntl

```
Are you formatting a value in JSX?
├─ YES → Use FormattedDate, FormattedNumber, FormattedTime ✓
└─ NO → Need string for attribute/programmatic use?
    ├─ YES → Use useIntl.formatDate(), formatNumber() ✓
    └─ NO → Use components for JSX output
```

### When to Compile Messages to AST

```
Is your message catalog large (100+ messages)?
├─ YES → Compile to AST for 30-50% faster initial render ✓
└─ NO → Are you optimizing bundle size?
    ├─ YES → Keep raw JSON (smaller bundle, slower parse)
    └─ NO → Either approach works ✓
```

---

## RED FLAGS

### High Priority Issues

- **Missing `IntlProvider` wrapper** - All useIntl and FormattedMessage calls fail without context
- **Missing `other` category in plural/select** - Runtime error: "other" is REQUIRED in ICU syntax
- **Hardcoded locale strings** - Use named constants from config for type safety
- **Using FormattedMessage for attributes** - Returns ReactNode, not string; breaks placeholder, aria-label, title
- **Empty `messages` prop on IntlProvider** - Shows raw message IDs instead of translations

### Medium Priority Issues

- **Missing `defaultLocale` on IntlProvider** - No fallback for missing translations
- **No `onError` handler** - Console noise for every missing translation
- **Inline message objects in render** - Creates new object on every render, performance issue
- **Missing description in defineMessages** - Translators lack context for accurate translation
- **Flat keys with dots instead of nested objects** - Harder to organize and maintain

### Common Mistakes

- Forgetting to wrap app root with IntlProvider
- Using `{count}` instead of `{count, plural, ...}` for countable items
- Concatenating translated strings instead of single message with placeholders
- Applying English grammar rules programmatically (possessives, plurals)
- Missing `#` in plural branches (shows nothing instead of count)

### Gotchas & Edge Cases

- `FormatMessage` returns `ReactNode`, not `string` - cannot use for HTML attributes
- Rich text tag functions receive `chunks` array, not single element
- `formatNumber` with `style: "percent"` expects decimal (0.25 for 25%), not percentage
- `formatRelativeTime` value is relative to NOW - negative for past, positive for future
- ICU escaping: single quote `'` escapes, double single quote `''` produces literal apostrophe
- Browser Intl support varies - consider polyfills for older browsers

---

## Anti-Patterns

### Concatenating Translated Strings

Word order varies between languages. Keep complete sentences together.

```typescript
// WRONG - Word order varies between languages
function BadGreeting({ name, time }: { name: string; time: string }) {
  const intl = useIntl();
  const hello = intl.formatMessage({ id: "hello" });
  const at = intl.formatMessage({ id: "at" });

  return <p>{hello} {name} {at} {time}</p>;
}

// CORRECT - Complete sentence as single message
function GoodGreeting({ name, time }: { name: string; time: string }) {
  return (
    <p>
      <FormattedMessage
        id="greeting.withTime"
        defaultMessage="Hello {name} at {time}"
        values={{ name, time }}
      />
    </p>
  );
}
```

### Applying English Grammar in Code

```typescript
// WRONG - English possessive applied programmatically
function BadProfile({ name }: { name: string }) {
  return <p>{name}'s profile</p>;
}

// CORRECT - Possessive is part of the translation
function GoodProfile({ name }: { name: string }) {
  return (
    <p>
      <FormattedMessage
        id="profile.title"
        defaultMessage="{name}'s profile"
        values={{ name }}
      />
    </p>
  );
}

// In German: "Profil von {name}"
// In Japanese: "{name}のプロフィール"
```

### Manual Pluralization Logic

```typescript
// WRONG - Only handles English singular/plural
function BadCount({ count }: { count: number }) {
  return <p>{count} item{count !== 1 ? "s" : ""}</p>;
}

// CORRECT - Uses ICU plural syntax for all languages
function GoodCount({ count }: { count: number }) {
  return (
    <p>
      <FormattedMessage
        id="items.count"
        defaultMessage="{count, plural, one {# item} other {# items}}"
        values={{ count }}
      />
    </p>
  );
}
```

### Missing Other Category

```typescript
// WRONG - Missing required 'other' category
const badMessage = "{count, plural, one {# item}}"; // Runtime error!

// CORRECT - Always include 'other' as fallback
const goodMessage = "{count, plural, one {# item} other {# items}}";

// WRONG - Missing 'other' in select
const badSelect = "{gender, select, male {He} female {She}}"; // Runtime error!

// CORRECT - Always include 'other' in select
const goodSelect = "{gender, select, male {He} female {She} other {They}}";
```

### Using FormattedMessage for Attributes

```typescript
// WRONG - FormattedMessage returns ReactNode, not string
function BadInput() {
  return (
    <input
      placeholder={<FormattedMessage id="search.placeholder" />} // Type error!
    />
  );
}

// CORRECT - useIntl returns string
function GoodInput() {
  const intl = useIntl();
  return (
    <input
      placeholder={intl.formatMessage({ id: "search.placeholder" })}
    />
  );
}
```

### Hardcoded Locale Strings

```typescript
// WRONG - Hardcoded strings scattered throughout app
if (locale === "en") { ... }
const locales = ["en", "de", "fr"];

// CORRECT - Use constants from config
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "../i18n/config";

if (locale === DEFAULT_LOCALE) { ... }
const locales = SUPPORTED_LOCALES;
```

### Inline Message Objects in Render

```typescript
// WRONG - Creates new object on every render
function BadComponent() {
  return (
    <FormattedMessage
      id="greeting"
      defaultMessage="Hello!"
      description="Greeting message"
    />
  );
}

// CORRECT - Define messages outside component
const messages = defineMessages({
  greeting: {
    id: "greeting",
    defaultMessage: "Hello!",
    description: "Greeting message",
  },
});

function GoodComponent() {
  return <FormattedMessage {...messages.greeting} />;
}
```

### Missing Error Handling

```typescript
// WRONG - No error handling, console noise
<IntlProvider locale={locale} messages={messages}>

// CORRECT - Handle missing translations gracefully
<IntlProvider
  locale={locale}
  defaultLocale={DEFAULT_LOCALE}
  messages={messages}
  onError={(err) => {
    if (err.code === "MISSING_TRANSLATION") {
      console.warn(`Missing: ${err.message}`);
      return;
    }
    throw err;
  }}
>
```

---

## Quick Reference

### IntlProvider Checklist

- [ ] Wrap application root with IntlProvider
- [ ] Set `locale` prop to current locale
- [ ] Set `defaultLocale` prop for fallback
- [ ] Pass `messages` object with translations
- [ ] Configure `onError` to handle missing translations
- [ ] Set `defaultRichTextElements` for common markup tags

### Message Definition Checklist

- [ ] Use unique, namespaced IDs (`feature.action`)
- [ ] Always include `defaultMessage` (English fallback)
- [ ] Add `description` for translator context
- [ ] Use ICU syntax for plurals (`{count, plural, ...}`)
- [ ] Always include `other` category in plural/select
- [ ] Use `#` to display formatted count in plural branches

### Testing Checklist

- [ ] Create custom render wrapper with IntlProvider
- [ ] Test all plural branches (zero, one, other)
- [ ] Test with different locales
- [ ] Mock date/time for deterministic tests
- [ ] Verify accessibility (aria-labels translated)

### Message Extraction Workflow

1. **Extract**: `formatjs extract 'src/**/*.tsx' --out-file lang/en.json`
2. **Translate**: Send to TMS, receive translated files
3. **Compile**: `formatjs compile lang/en.json --out-file compiled/en.json --ast`
4. **Load**: Import compiled messages in app

---

## ICU Syntax Quick Reference

### Simple Interpolation

```
Hello, {name}!
```

### Number Formatting

```
{count, number}                    // Basic: 1,234
{percent, number, percent}         // Percentage: 45%
{price, number, ::currency/USD}    // Currency: $99.99
{value, number, ::.00}             // Fixed decimals: 3.14
```

### Date and Time Formatting

```
{date, date}                       // Default date format
{date, date, short}                // Short: 1/2/24
{date, date, medium}               // Medium: Jan 2, 2024
{date, date, long}                 // Long: January 2, 2024
{date, date, full}                 // Full: Monday, January 2, 2024

{time, time}                       // Default time format
{time, time, short}                // Short: 3:30 PM
{time, time, long}                 // Long: 3:30:00 PM EST
```

### Pluralization

```
{count, plural,
  =0 {No items}
  one {# item}
  other {# items}
}
```

### Ordinal Pluralization

```
{position, selectordinal,
  one {#st}
  two {#nd}
  few {#rd}
  other {#th}
}
```

### Select (Gender/Enum)

```
{gender, select,
  male {He}
  female {She}
  other {They}
} liked your post.
```

### Rich Text Tags

```
<bold>important</bold> and <link>click here</link>
```

### Escaping

```
'{' displays literal {
'' displays literal '
```

---

## Plural Categories by Language

| Language | Categories |
|----------|------------|
| English | one, other |
| German | one, other |
| French | one, many, other |
| Russian | one, few, many, other |
| Arabic | zero, one, two, few, many, other |
| Polish | one, few, many, other |
| Japanese | other (no plural forms) |
| Chinese | other (no plural forms) |
| Korean | other (no plural forms) |

---

## API Quick Reference

### IntlProvider Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `locale` | string | Yes | Current locale code |
| `messages` | object | No | Translation messages |
| `defaultLocale` | string | No | Fallback locale |
| `defaultRichTextElements` | object | No | Default tag handlers |
| `onError` | function | No | Error handler |

### useIntl Methods

| Method | Returns | Use Case |
|--------|---------|----------|
| `formatMessage(descriptor, values)` | string | Attributes, programmatic |
| `formatDate(value, options)` | string | Date formatting |
| `formatTime(value, options)` | string | Time formatting |
| `formatNumber(value, options)` | string | Number/currency |
| `formatRelativeTime(value, unit)` | string | Relative time |
| `formatList(values, options)` | string | List formatting |
| `formatDisplayName(code, options)` | string | Language/region names |

### Formatting Components

| Component | Output | Use Case |
|-----------|--------|----------|
| `FormattedMessage` | ReactNode | Translated text in JSX |
| `FormattedDate` | ReactNode | Locale-aware dates |
| `FormattedTime` | ReactNode | Locale-aware times |
| `FormattedNumber` | ReactNode | Numbers/currency |
| `FormattedRelativeTime` | ReactNode | "5 minutes ago" |
| `FormattedList` | ReactNode | "A, B, and C" |
