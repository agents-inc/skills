# React-Intl Reference

> Decision trees, ICU syntax tables, API tables, anti-pattern code and checklists. Red flags and
> pattern guidance live in [SKILL.md](SKILL.md); runnable code lives in [examples/](examples/).

---

## Decision Framework

### FormattedMessage vs useIntl

```
Text rendered inside a JSX element → FormattedMessage
A string is needed                 → useIntl().formatMessage()
  — an attribute: placeholder, aria-label, title
  — a third-party component's prop
  — programmatic use: document.title, an analytics payload
```

### Which defineMessages form

```
Several related messages     → defineMessages()
One message, outside JSX     → defineMessage()
One message, inline in JSX   → id and defaultMessage props on FormattedMessage
```

### Which ICU construct

```
Message includes a count?
├─ YES → Cardinal (1, 2, 3) → {count, plural, ...}
│        Ordinal (1st, 2nd)  → {count, selectordinal, ...}
│        Neither             → plain {count}
└─ NO  → Varies by enum value → {value, select, ...}
         Otherwise            → plain interpolation
```

### When to Compile Messages to AST

```
Is your message catalog large (100+ messages)?
├─ YES → Compile to AST for 30-50% faster initial render
└─ NO → Are you optimizing bundle size?
    ├─ YES → Keep raw JSON (smaller bundle, slower parse)
    └─ NO → Either approach works
```

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

| Language | Categories                       |
| -------- | -------------------------------- |
| English  | one, other                       |
| German   | one, other                       |
| French   | one, many, other                 |
| Russian  | one, few, many, other            |
| Arabic   | zero, one, two, few, many, other |
| Polish   | one, few, many, other            |
| Japanese | other (no plural forms)          |
| Chinese  | other (no plural forms)          |
| Korean   | other (no plural forms)          |

---

## API Quick Reference

### IntlProvider Props

| Prop                      | Type     | Required | Description          |
| ------------------------- | -------- | -------- | -------------------- |
| `locale`                  | string   | Yes      | Current locale code  |
| `messages`                | object   | No       | Translation messages |
| `defaultLocale`           | string   | No       | Fallback locale      |
| `defaultRichTextElements` | object   | No       | Default tag handlers |
| `onError`                 | function | No       | Error handler        |
| `onWarn`                  | function | No       | Warning handler      |

### useIntl Methods

| Method                              | Use case                        |
| ----------------------------------- | ------------------------------- |
| `formatMessage(descriptor, values)` | Attributes and programmatic use |
| `formatDate(value, options)`        | Dates                           |
| `formatTime(value, options)`        | Times                           |
| `formatNumber(value, options)`      | Numbers and currency            |
| `formatRelativeTime(value, unit)`   | Relative time                   |
| `formatList(values, options)`       | Lists                           |
| `formatDisplayName(code, options)`  | Language and region names       |

Every one returns `string`, except `formatMessage`, which returns `ReactNode[]` as soon as any value
is a rich text tag function.

### Formatting Components

| Component                | Renders                      |
| ------------------------ | ---------------------------- |
| `FormattedMessage`       | Translated text in JSX       |
| `FormattedDate`          | Locale-aware dates           |
| `FormattedTime`          | Locale-aware times           |
| `FormattedDateTimeRange` | Date/time ranges "Jan 15-20" |
| `FormattedNumber`        | Numbers and currency         |
| `FormattedRelativeTime`  | "5 minutes ago"              |
| `FormattedList`          | "A, B, and C"                |
| `FormattedDisplayName`   | Language and region names    |
| `FormattedPlural`        | Plural category selection    |

Every one returns a `ReactNode`, so none of them can go in an attribute.

---

## Anti-Patterns

### Concatenating Translated Strings

Word order varies between languages. Keep complete sentences together.

```typescript
// WRONG - Word order varies between languages
const hello = intl.formatMessage({ id: "hello" });
const at = intl.formatMessage({ id: "at" });
return <p>{hello} {name} {at} {time}</p>;

// CORRECT - Complete sentence as single message
<FormattedMessage
  id="greeting.withTime"
  defaultMessage="Hello {name} at {time}"
  values={{ name, time }}
/>
```

### Applying English Grammar in Code

```typescript
// WRONG - English possessive applied programmatically
<p>{name}'s profile</p>

// CORRECT - Possessive is part of the translation
<FormattedMessage
  id="profile.title"
  defaultMessage="{name}'s profile"
  values={{ name }}
/>
// German: "Profil von {name}", Japanese: "{name}のプロフィール"
```

### Manual Pluralization Logic

```typescript
// WRONG - Only handles English singular/plural
<p>{count} item{count !== 1 ? "s" : ""}</p>

// CORRECT - Uses ICU plural syntax for all languages
<FormattedMessage
  id="items.count"
  defaultMessage="{count, plural, one {# item} other {# items}}"
  values={{ count }}
/>
```

### Using FormattedMessage for Attributes

```typescript
// WRONG - FormattedMessage returns ReactNode, not string
<input placeholder={<FormattedMessage id="search.placeholder" />} />

// CORRECT - useIntl returns string
const intl = useIntl();
<input placeholder={intl.formatMessage({ id: "search.placeholder" })} />
```

---

## Checklists

### IntlProvider Setup

- [ ] Wrap application root with IntlProvider
- [ ] Set `locale` prop to current locale
- [ ] Set `defaultLocale` prop for fallback
- [ ] Pass `messages` object with translations
- [ ] Configure `onError` to handle missing translations
- [ ] Set `defaultRichTextElements` for common markup tags

### Message Definition

- [ ] Use unique, namespaced IDs (`feature.action`)
- [ ] Always include `defaultMessage` (English fallback)
- [ ] Add `description` for translator context
- [ ] Use ICU syntax for plurals (`{count, plural, ...}`)
- [ ] Always include `other` category in plural/select
- [ ] Use `#` to display formatted count in plural branches

### Testing

- [ ] Create custom render wrapper with IntlProvider
- [ ] Test all plural branches (zero, one, other)
- [ ] Test with different locales
- [ ] Mock date/time for deterministic tests
- [ ] Verify accessibility (aria-labels translated)
