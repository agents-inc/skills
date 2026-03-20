# React-Intl Reference

> Decision frameworks, ICU syntax reference, and API tables. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use FormattedMessage vs useIntl

```
Are you rendering in JSX?
├─ YES → Is it text content in an element?
│   ├─ YES → Use FormattedMessage
│   └─ NO → Is it for an attribute (placeholder, aria-label, title)?
│       ├─ YES → Use useIntl.formatMessage()
│       └─ NO → Is it for a third-party component prop?
│           ├─ YES → Use useIntl.formatMessage()
│           └─ NO → FormattedMessage
└─ NO → Is it for programmatic use (document.title, analytics)?
    ├─ YES → Use useIntl.formatMessage()
    └─ NO → Not applicable
```

### When to Use defineMessages

```
Are you defining multiple related messages?
├─ YES → Use defineMessages()
└─ NO → Is the message inline in JSX?
    ├─ YES → Inline in FormattedMessage is fine
    └─ NO → Use defineMessage() for single message
```

### When to Use ICU Pluralization

```
Does the message include a count?
├─ YES → Is it a cardinal number (1, 2, 3...)?
│   ├─ YES → Use {count, plural, ...}
│   └─ NO → Is it an ordinal (1st, 2nd, 3rd...)?
│       ├─ YES → Use {count, selectordinal, ...}
│       └─ NO → Use simple interpolation {count}
└─ NO → Does the message vary by enum value?
    ├─ YES → Use {value, select, ...}
    └─ NO → Use simple interpolation or static text
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

| Method                              | Returns                                       | Use Case                 |
| ----------------------------------- | --------------------------------------------- | ------------------------ |
| `formatMessage(descriptor, values)` | string (or ReactNode[] with rich text values) | Attributes, programmatic |
| `formatDate(value, options)`        | string                                        | Date formatting          |
| `formatTime(value, options)`        | string                                        | Time formatting          |
| `formatNumber(value, options)`      | string                                        | Number/currency          |
| `formatRelativeTime(value, unit)`   | string                                        | Relative time            |
| `formatList(values, options)`       | string                                        | List formatting          |
| `formatDisplayName(code, options)`  | string                                        | Language/region names    |

### Formatting Components

| Component                | Output    | Use Case                     |
| ------------------------ | --------- | ---------------------------- |
| `FormattedMessage`       | ReactNode | Translated text in JSX       |
| `FormattedDate`          | ReactNode | Locale-aware dates           |
| `FormattedTime`          | ReactNode | Locale-aware times           |
| `FormattedDateTimeRange` | ReactNode | Date/time ranges "Jan 15-20" |
| `FormattedNumber`        | ReactNode | Numbers/currency             |
| `FormattedRelativeTime`  | ReactNode | "5 minutes ago"              |
| `FormattedList`          | ReactNode | "A, B, and C"                |
| `FormattedDisplayName`   | ReactNode | Language/region names        |
| `FormattedPlural`        | ReactNode | Plural category selection    |

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
