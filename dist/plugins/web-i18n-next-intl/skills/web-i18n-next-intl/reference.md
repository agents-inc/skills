# next-intl Reference

> Decision trees, anti-pattern code, ICU syntax tables and setup checklists. Red flags and pattern
> guidance live in [SKILL.md](SKILL.md); runnable code lives in [examples/](examples/).

---

## Decision Framework

### useTranslations vs getTranslations

```
Are you in a React component?
├─ YES → Server Component → useTranslations (sync)
│        Client Component → useTranslations, under NextIntlClientProvider
└─ NO  → Async context (generateMetadata, Server Action) → getTranslations, with an explicit locale
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

### t vs t.rich vs t.markup

```
React components inside the message?  → t.rich()   (ReactNode)
An HTML string?                       → t.markup() (string)
Plain text?                           → t()        (string)
```

### Which formatter

```
Date or time                 → format.dateTime()
Relative time ("2 hours ago")→ format.relativeTime(), with useNow() to keep it live
Number or currency           → format.number()
List                         → format.list()
```

### Static vs dynamic rendering

```
Want SSG?
├─ YES → generateStaticParams present?  → no  → add it to the layout or page
│        setRequestLocale(locale) called? → no → add it above every hook
│        Both present → statically rendered
└─ NO  → nothing to do; dynamic is the default
```

---

## Anti-Patterns

### Missing locale validation

An unvalidated segment reaches the message loader and fails there.

```typescript
// WRONG - no validation
export default async function Layout({ params }) {
  const { locale } = await params;
  setRequestLocale(locale); // may be anything the URL contained
  return <div>...</div>;
}

// CORRECT - validate, then 404
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "../i18n/routing";

export default async function Layout({ params }) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  return <div>...</div>;
}
```

### Hardcoded locale strings

`routing` is the single source of truth for which locales exist.

```typescript
// WRONG
if (locale === "en") { ... }
const locales = ["en", "de", "fr"];

// CORRECT
import { routing } from "../i18n/routing";

if (locale === routing.defaultLocale) { ... }
const locales = routing.locales;
```

### setRequestLocale called after a hook

```typescript
// WRONG - the hook runs with no locale set
const t = useTranslations("Page");
setRequestLocale(locale);

// CORRECT
setRequestLocale(locale);
const t = useTranslations("Page");
```

### t() on a message with markup

`t()` cannot format tags. Development reports a `FORMATTING_ERROR` and returns the `namespace.key`
fallback; in production a call without values returns the tags as literal text.

```typescript
// WRONG
const message = t("terms");

// CORRECT
const message = t.rich("terms", {
  link: (chunks) => <a href="/terms">{chunks}</a>,
});
```

### Flat keys with dots

Dots are the namespace separator, so a key containing one is ambiguous.

```json
// WRONG
{
  "Dashboard.title": "Dashboard",
  "Dashboard.stats.count": "5 items"
}

// CORRECT
{
  "Dashboard": {
    "title": "Dashboard",
    "stats": { "count": "5 items" }
  }
}
```

### No fallback when a message file fails to load

```typescript
// CORRECT - validated locale, and a fallback if the import still fails
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../../messages/${routing.defaultLocale}.json`))
      .default;
  }

  return { locale, messages };
});
```

---

## Checklists

### Page component

- [ ] `params` awaited
- [ ] Locale validated with `hasLocale(routing.locales, locale)`, `notFound()` otherwise
- [ ] `setRequestLocale(locale)` above every hook
- [ ] `generateStaticParams()` present if the route should be static
- [ ] `useTranslations("Namespace")` rather than an unnamespaced call

### Layout component

- [ ] Children wrapped in `NextIntlClientProvider`
- [ ] `<html lang={locale}>` set
- [ ] `generateStaticParams()` covering every locale
- [ ] `setRequestLocale(locale)` above every hook

### Message files

- [ ] Nested structure rather than flat dotted keys
- [ ] ICU syntax for anything count-dependent
- [ ] Markup tags left inside the translated string
- [ ] Same key structure in every locale file listed in `routing.locales`

### Proxy / middleware

- [ ] Named `proxy.ts` on Next.js 16+, `middleware.ts` before that
- [ ] `createMiddleware` imported from `next-intl/middleware` and passed `routing`
- [ ] Matcher excludes API routes, `/_next`, `/_vercel`, anything with a file extension, and any
      other server-route prefix the project serves — everything the matcher admits runs the proxy on
      every request for it, so the exclusions are what keep it off the hot path

---

## Message Format Reference

### ICU plural categories by language

| Language | Categories                       |
| -------- | -------------------------------- |
| English  | one, other                       |
| German   | one, other                       |
| French   | one, many, other                 |
| Russian  | one, few, many, other            |
| Arabic   | zero, one, two, few, many, other |
| Polish   | one, few, many, other            |
| Japanese | other (no plural forms)          |

### ICU syntax

```
Interpolation:     {name}
Plural (cardinal): {count, plural, =0 {none} one {# item} other {# items}}
Plural (ordinal):  {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}
Select (enum):     {gender, select, male {He} female {She} other {They}}
Number:            {amount, number, currency}
Date:              {date, date, medium}
Rich text:         <tag>content</tag>
```

### Named format output

**Date/time:** `short` "12/31/2024" · `medium` "Dec 31, 2024" · `long` "December 31, 2024" ·
`full` "Tuesday, December 31, 2024"

**Number styles:** `decimal` "1,234.56" · `currency` "$1,234.56" · `percent` "12%" ·
`unit` "5 kilometers"
