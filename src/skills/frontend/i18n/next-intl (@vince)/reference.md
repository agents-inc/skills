# next-intl Reference

> Decision frameworks, anti-patterns, and red flags for next-intl internationalization. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use useTranslations vs getTranslations

```
Are you in a React component?
├─ YES → Is it a Server Component?
│   ├─ YES → useTranslations (sync) ✓
│   └─ NO → useTranslations (via NextIntlClientProvider) ✓
└─ NO → Is it async context (generateMetadata, Server Action)?
    ├─ YES → getTranslations (async) ✓
    └─ NO → Not supported outside React/async contexts
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

### When to Use t.rich vs t.markup

```
Do you need React components in translation?
├─ YES → Use t.rich() ✓ (returns ReactNode)
└─ NO → Do you need HTML string output?
    ├─ YES → Use t.markup() ✓ (returns string)
    └─ NO → Use t() for plain text ✓
```

### When to Use useFormatter

```
Are you formatting a value?
├─ YES → Is it a date or time?
│   ├─ YES → format.dateTime() ✓
│   └─ NO → Is it a relative time ("2 hours ago")?
│       ├─ YES → format.relativeTime() with useNow() ✓
│       └─ NO → Is it a number or currency?
│           ├─ YES → format.number() ✓
│           └─ NO → Is it a list?
│               ├─ YES → format.list() ✓
│               └─ NO → Consider t() interpolation
└─ NO → Use t() for messages
```

### Static vs Dynamic Rendering

```
Do you need static generation (SSG)?
├─ YES → Have you added generateStaticParams?
│   ├─ YES → Have you called setRequestLocale(locale)?
│   │   ├─ YES → Static rendering enabled ✓
│   │   └─ NO → Add setRequestLocale() at top of component
│   └─ NO → Add generateStaticParams() to layout/page
└─ NO → Dynamic rendering (no changes needed)
```

---

## RED FLAGS

### High Priority Issues

- **Missing `setRequestLocale(locale)` in page/layout components** - Breaks static rendering, next-intl cannot determine locale
- **Not awaiting `params` in App Router** - params is a Promise in Next.js 15+, causes runtime errors
- **Missing `NextIntlClientProvider` in root layout** - Client Components cannot access translations
- **Hardcoded locale strings** - Use named constants from routing.ts for type safety
- **Not validating locale against routing.locales** - Invalid locales cause cryptic errors
- **Using middleware.ts on Next.js 16+** - Must rename to proxy.ts (see Next.js 16 migration)

### Medium Priority Issues

- **Missing `generateStaticParams` for static routes** - Forces dynamic rendering, worse performance
- **Using t() instead of t.rich() for messages with markup** - Returns string, not ReactNode
- **Missing namespace in useTranslations** - All keys become global, conflicts likely
- **Inline format options repeated** - Define formats in request.ts for consistency
- **Missing aria-label on locale switcher** - Accessibility violation

### Common Mistakes

- Forgetting to call `setRequestLocale` before using any next-intl hooks
- Using `useTranslations` in `generateMetadata` (use `getTranslations` instead)
- Not passing locale to `getTranslations` in async contexts
- Using browser APIs without checking for SSR
- Missing `html lang` attribute in layout

### Gotchas & Edge Cases

- `setRequestLocale(locale)` must be called at the TOP of components, before any hooks
- `generateMetadata` runs outside the component tree - requires explicit locale param
- `t.rich()` tag functions receive `chunks` (ReactNode[]), not a single element
- `useNow()` only updates on client - SSR shows initial value until hydration
- Proxy/middleware runs on every request - keep it lightweight
- **v4.0+ GDPR cookie changes**: Locale cookies now expire when browser closes (session cookies) and are only set when user switches to a locale different from Accept-Language header. Customize with `localeCookie` config if needed.
- **Next.js 16 proxy.ts**: `middleware.ts` was renamed to `proxy.ts` - runs on Node.js runtime, not Edge

---

## Anti-Patterns

### Missing Locale Validation

Components MUST validate the locale parameter before using it. Invalid locales cause silent failures or cryptic errors.

```typescript
// WRONG - No validation
export default async function Layout({ params }) {
  const { locale } = await params;
  setRequestLocale(locale); // May be invalid!
  return <div>...</div>;
}

// CORRECT - Validate and 404 for invalid
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function Layout({ params }) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  return <div>...</div>;
}
```

### Hardcoded Locale Strings

Never hardcode locale strings. Use named constants from routing.ts for type safety and single source of truth.

```typescript
// WRONG - Hardcoded strings
if (locale === "en") { ... }
const locales = ["en", "de", "fr"];

// CORRECT - Use routing constants
import { routing, type Locale } from "@/i18n/routing";

if (locale === routing.defaultLocale) { ... }
const locales = routing.locales;
```

### setRequestLocale Called After Hooks

`setRequestLocale` must be called before any next-intl hooks. Calling it after causes the hooks to fail.

```typescript
// WRONG - Called after useTranslations
export default async function Page({ params }) {
  const { locale } = await params;
  const t = useTranslations("Page"); // Fails! Locale not set
  setRequestLocale(locale);
  return <h1>{t("title")}</h1>;
}

// CORRECT - Called first
export default async function Page({ params }) {
  const { locale } = await params;
  setRequestLocale(locale); // Set locale first
  const t = useTranslations("Page"); // Now works
  return <h1>{t("title")}</h1>;
}
```

### Using t() for Messages with Markup

`t()` returns a string. For messages containing markup, use `t.rich()` which returns ReactNode.

```typescript
// WRONG - Returns string, markup not rendered
const message = t("terms"); // "<link>Terms</link>" as string

// CORRECT - Returns ReactNode with rendered components
const message = t.rich("terms", {
  link: (chunks) => <a href="/terms">{chunks}</a>,
});
```

### Flat Translation Keys with Dots

Avoid dots in translation keys. Use nested objects for organization.

```json
// WRONG - Flat keys with dots
{
  "Dashboard.title": "Dashboard",
  "Dashboard.stats.count": "5 items"
}

// CORRECT - Nested structure
{
  "Dashboard": {
    "title": "Dashboard",
    "stats": {
      "count": "5 items"
    }
  }
}
```

### Missing Error Handling for Message Loading

Message loading can fail. Handle errors gracefully.

```typescript
// WRONG - No error handling
export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

// CORRECT - With fallback
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch {
    messages = (await import(`../../messages/${routing.defaultLocale}.json`)).default;
  }

  return { locale, messages };
});
```

---

## Quick Reference

### Page Component Checklist

- [ ] Await `params` (Promise in Next.js 15+)
- [ ] Validate locale with `hasLocale(routing.locales, locale)`
- [ ] Return `notFound()` for invalid locales
- [ ] Call `setRequestLocale(locale)` before any hooks
- [ ] Add `generateStaticParams()` for static rendering
- [ ] Use namespace in `useTranslations("Namespace")`

### Layout Component Checklist

- [ ] Wrap children with `NextIntlClientProvider`
- [ ] Set `<html lang={locale}>` attribute
- [ ] Include `generateStaticParams()` for all locales
- [ ] Call `setRequestLocale(locale)` before hooks

### Message File Checklist

- [ ] Use nested structure, not flat keys with dots
- [ ] Use ICU syntax for pluralization
- [ ] Keep markup tags translatable (`<link>text</link>`)
- [ ] Include all locales defined in routing.ts
- [ ] Match structure across all locale files

### Proxy/Middleware Checklist

- [ ] File is named `proxy.ts` (Next.js 16+) or `middleware.ts` (Next.js 15 and earlier)
- [ ] Import `createMiddleware` from `next-intl/middleware`
- [ ] Pass `routing` configuration
- [ ] Configure matcher to exclude:
  - `/api` routes
  - `/trpc` routes
  - `/_next` system files
  - `/_vercel` system files
  - Files with extensions (`.*\\..*)`)
- [ ] If using Next.js 16+, ensure file is `proxy.ts` not `middleware.ts`

---

## Message Format Reference

### ICU Plural Categories by Language

| Language | Categories |
|----------|------------|
| English | one, other |
| German | one, other |
| French | one, many, other |
| Russian | one, few, many, other |
| Arabic | zero, one, two, few, many, other |
| Polish | one, few, many, other |
| Japanese | other (no plural forms) |

### ICU Syntax Quick Reference

```
Simple interpolation:   {name}
Plural (cardinal):      {count, plural, =0 {none} one {# item} other {# items}}
Plural (ordinal):       {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}
Select (enum):          {gender, select, male {He} female {She} other {They}}
Number format:          {amount, number, currency}
Date format:            {date, date, medium}
Rich text:              <tag>content</tag>
```

### Format Options Reference

**Date/Time Formats:**
- `short`: "12/31/2024"
- `medium`: "Dec 31, 2024"
- `long`: "December 31, 2024"
- `full`: "Tuesday, December 31, 2024"

**Number Styles:**
- `decimal`: "1,234.56"
- `currency`: "$1,234.56"
- `percent`: "12%"
- `unit`: "5 kilometers"
