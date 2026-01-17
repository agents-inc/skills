# Internationalization (i18n) Best Practices Research

> **Purpose:** Comprehensive research for creating atomic i18n skills covering react-intl, next-intl, i18next, and related patterns.

---

## Table of Contents

1. [react-intl (FormatJS) Patterns](#1-react-intl-formatjs-patterns)
2. [next-intl Patterns (Next.js App Router)](#2-next-intl-patterns-nextjs-app-router)
3. [i18next Patterns](#3-i18next-patterns)
4. [Message Extraction Workflows](#4-message-extraction-workflows)
5. [Pluralization Patterns (ICU)](#5-pluralization-patterns-icu)
6. [Date/Number Formatting Patterns](#6-datenumber-formatting-patterns)
7. [RTL Support Patterns](#7-rtl-support-patterns)
8. [Dynamic Locale Switching](#8-dynamic-locale-switching)
9. [Type-Safe Translations](#9-type-safe-translations)
10. [Translation Management Integration](#10-translation-management-integration)

---

## 1. react-intl (FormatJS) Patterns

### Core Patterns

react-intl is part of the FormatJS ecosystem, providing component-based i18n built on ICU MessageFormat.

#### Provider Setup

```typescript
// app/providers/intl-provider.tsx
import { IntlProvider } from "react-intl";
import type { ReactNode } from "react";

import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";

const MESSAGES_BY_LOCALE: Record<string, Record<string, string>> = {
  en: enMessages,
  fr: frMessages,
};

type IntlProviderWrapperProps = {
  locale: string;
  children: ReactNode;
};

export function IntlProviderWrapper({ locale, children }: IntlProviderWrapperProps) {
  const messages = MESSAGES_BY_LOCALE[locale] ?? enMessages;

  return (
    <IntlProvider
      locale={locale}
      messages={messages}
      defaultLocale="en"
      onError={(err) => {
        // Ignore missing translation errors in development
        if (err.code !== "MISSING_TRANSLATION") {
          console.error(err);
        }
      }}
    >
      {children}
    </IntlProvider>
  );
}
```

#### FormattedMessage Component

```typescript
// components/greeting.tsx
import { FormattedMessage } from "react-intl";

export function Greeting({ name }: { name: string }) {
  return (
    <h1>
      <FormattedMessage
        id="greeting.hello"
        defaultMessage="Hello, {name}!"
        values={{ name }}
        description="Greeting message with user name"
      />
    </h1>
  );
}
```

#### useIntl Hook (Imperative API)

```typescript
// components/product-card.tsx
import { useIntl } from "react-intl";

const PRICE_CURRENCY = "USD";

export function ProductCard({ price, name }: { price: number; name: string }) {
  const intl = useIntl();

  // Imperative API for attributes, non-React contexts
  const formattedPrice = intl.formatNumber(price, {
    style: "currency",
    currency: PRICE_CURRENCY,
  });

  const ariaLabel = intl.formatMessage(
    { id: "product.addToCart", defaultMessage: "Add {name} to cart for {price}" },
    { name, price: formattedPrice }
  );

  return (
    <button aria-label={ariaLabel}>
      {formattedPrice}
    </button>
  );
}
```

#### Rich Text Formatting

```typescript
// components/terms.tsx
import { FormattedMessage } from "react-intl";

export function Terms() {
  return (
    <p>
      <FormattedMessage
        id="terms.agreement"
        defaultMessage="By signing up, you agree to our <link>Terms of Service</link> and <bold>Privacy Policy</bold>."
        values={{
          link: (chunks) => <a href="/terms">{chunks}</a>,
          bold: (chunks) => <strong>{chunks}</strong>,
        }}
      />
    </p>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Destructuring formatMessage breaks extraction
const { formatMessage: f } = intl;
f({ id: "greeting" }); // Extraction tools cannot find this

// BAD: Dynamic message IDs prevent static analysis
const messageId = `error.${errorCode}`;
intl.formatMessage({ id: messageId }); // Cannot extract

// BAD: Concatenating translated strings
const fullName = intl.formatMessage({ id: "firstName" }) + " " + intl.formatMessage({ id: "lastName" });
// Different languages have different name orders

// GOOD: Use ICU message format with placeholders
intl.formatMessage(
  { id: "fullName", defaultMessage: "{firstName} {lastName}" },
  { firstName, lastName }
);
```

### When to Use

**Use react-intl when:**
- Building React applications with complex formatting needs (plurals, dates, numbers)
- Using ICU MessageFormat standard
- Need automatic message extraction workflow
- Using FormatJS ecosystem (babel plugin, CLI, ESLint plugin)

**Do NOT use when:**
- Simple apps with < 50 translations (overhead not justified)
- Server-side only applications (use Node.js Intl APIs directly)
- Next.js App Router (prefer next-intl for better RSC support)

---

## 2. next-intl Patterns (Next.js App Router)

### Core Patterns

next-intl is purpose-built for Next.js with first-class App Router and Server Components support.

#### Routing Configuration

```typescript
// src/i18n/routing.ts
import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["en", "fr", "de", "ar"],
  defaultLocale: "en",
  localePrefix: "as-needed", // Only prefix non-default locales
});

// Type-safe navigation APIs
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
```

#### Middleware Setup

```typescript
// middleware.ts
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except static files and API routes
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

#### Server Components (Async API)

```typescript
// app/[locale]/page.tsx
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("HomePage");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
    </main>
  );
}

// Generate static params for all locales
export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "fr" }, { locale: "de" }];
}
```

#### Client Components (Hook API)

```typescript
// components/language-switcher.tsx
"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";

const SUPPORTED_LOCALES = ["en", "fr", "de", "ar"] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <select value={locale} onChange={(e) => handleChange(e.target.value)}>
      {SUPPORTED_LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {loc.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
```

#### Keeping Translations on Server (Performance Pattern)

```typescript
// components/order-select.tsx (Server Component)
import { getTranslations } from "next-intl/server";
import { OrderSelectClient } from "./order-select-client";

export async function OrderSelect() {
  const t = await getTranslations("OrderSelect");

  // Pre-render options on server, pass to client
  const options = [
    { value: "newest", label: t("newest") },
    { value: "oldest", label: t("oldest") },
    { value: "popular", label: t("popular") },
  ];

  return <OrderSelectClient options={options} />;
}

// components/order-select-client.tsx (Client Component)
"use client";

type OrderSelectClientProps = {
  options: Array<{ value: string; label: string }>;
};

export function OrderSelectClient({ options }: OrderSelectClientProps) {
  return (
    <select>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Using useTranslations in async server components
export default async function Page() {
  const t = useTranslations("Page"); // Throws "Expected a suspended thenable"
  return <h1>{t("title")}</h1>;
}

// GOOD: Use getTranslations for async components
export default async function Page() {
  const t = await getTranslations("Page");
  return <h1>{t("title")}</h1>;
}

// BAD: Passing all messages to client
<NextIntlClientProvider messages={messages}>
  {children}
</NextIntlClientProvider>

// GOOD: Pass only required namespaces
import { pick } from "lodash";
<NextIntlClientProvider messages={pick(messages, ["common", "navigation"])}>
  {children}
</NextIntlClientProvider>
```

### When to Use

**Use next-intl when:**
- Building Next.js App Router applications
- Need React Server Components support
- Want type-safe message keys with autocomplete
- Using static rendering with `generateStaticParams`

**Do NOT use when:**
- Not using Next.js (use react-intl or i18next)
- Pages Router legacy apps (consider next-i18next)
- Simple static sites without dynamic content

---

## 3. i18next Patterns

### Core Patterns

i18next is the most flexible i18n framework with plugins for React, Vue, Node.js, and more.

#### Configuration

```typescript
// src/i18n/config.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";

const FALLBACK_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "fr", "de", "ar", "ja"];
const NAMESPACE_LOAD_DELAY_MS = 50;

i18n
  .use(Backend) // Load translations from /public/locales
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // React bindings
  .init({
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: "common",
    ns: ["common", "auth", "dashboard"],

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ["querystring", "cookie", "localStorage", "navigator"],
      caches: ["cookie", "localStorage"],
    },

    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },

    react: {
      useSuspense: true,
    },
  });

export { i18n };
```

#### useTranslation Hook

```typescript
// components/dashboard.tsx
import { useTranslation } from "react-i18next";

export function Dashboard() {
  const { t, i18n } = useTranslation("dashboard");

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div>
      <h1>{t("title")}</h1>
      <p>{t("welcome", { name: "User" })}</p>

      <button onClick={() => changeLanguage("fr")}>
        Francais
      </button>
    </div>
  );
}
```

#### Namespace Loading

```typescript
// components/settings.tsx
import { useTranslation } from "react-i18next";
import { Suspense } from "react";

function SettingsContent() {
  // Load 'settings' namespace on demand
  const { t } = useTranslation("settings");

  return <div>{t("privacySettings.title")}</div>;
}

export function Settings() {
  return (
    <Suspense fallback={<div>Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
```

#### Trans Component for Rich Text

```typescript
// components/help.tsx
import { Trans } from "react-i18next";

export function HelpText() {
  return (
    <p>
      <Trans i18nKey="help.contact">
        Need help? <a href="/contact">Contact us</a> or check our{" "}
        <a href="/faq">FAQ</a>.
      </Trans>
    </p>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Hardcoding locale in configuration
i18n.init({
  lng: "en", // Forces English, ignores detection
});

// BAD: Missing namespace in useTranslation
const { t } = useTranslation(); // Uses default namespace only

// BAD: Not handling loading states
function Component() {
  const { t, ready } = useTranslation();
  return <h1>{t("title")}</h1>; // May show key before ready
}

// GOOD: Handle loading state or use Suspense
function Component() {
  const { t, ready } = useTranslation();
  if (!ready) return <Skeleton />;
  return <h1>{t("title")}</h1>;
}
```

### When to Use

**Use i18next when:**
- Need maximum flexibility across frameworks
- Building non-React applications (Vue, Node.js, vanilla JS)
- Need lazy-loading of translation namespaces
- Have complex backend loading requirements

**Do NOT use when:**
- Building Next.js App Router apps (next-intl has better RSC support)
- Need static extraction for TMS (FormatJS has better tooling)
- Simple apps where bundle size is critical

---

## 4. Message Extraction Workflows

### Core Patterns

Message extraction automates collecting translatable strings from source code.

#### FormatJS CLI Setup

```bash
# Install dependencies
npm install -D @formatjs/cli babel-plugin-formatjs
```

```json
// package.json
{
  "scripts": {
    "i18n:extract": "formatjs extract 'src/**/*.{ts,tsx}' --out-file lang/en.json --id-interpolation-pattern '[sha512:contenthash:base64:6]'",
    "i18n:compile": "formatjs compile lang/en.json --out-file src/messages/en.json"
  }
}
```

#### Babel Configuration for Auto-IDs

```json
// babel.config.json
{
  "plugins": [
    [
      "formatjs",
      {
        "idInterpolationPattern": "[sha512:contenthash:base64:6]",
        "ast": true,
        "removeDefaultMessage": false
      }
    ]
  ]
}
```

#### TypeScript Extraction (Alternative)

```bash
# Using @formatjs/ts-transformer
npm install -D @formatjs/ts-transformer
```

```typescript
// scripts/extract.ts
import { extract } from "@formatjs/cli-lib";
import { glob } from "glob";
import { writeFileSync } from "fs";

async function extractMessages() {
  const files = await glob("src/**/*.{ts,tsx}");

  const messages = await extract(files, {
    idInterpolationPattern: "[sha512:contenthash:base64:6]",
    throws: true,
  });

  writeFileSync("lang/extracted.json", JSON.stringify(messages, null, 2));
}

extractMessages();
```

#### i18next-parser Setup

```javascript
// i18next-parser.config.js
module.exports = {
  locales: ["en", "fr", "de"],
  output: "public/locales/$LOCALE/$NAMESPACE.json",
  input: ["src/**/*.{ts,tsx}"],
  keySeparator: ".",
  namespaceSeparator: ":",
  defaultNamespace: "common",
  defaultValue: (locale, namespace, key) => {
    return locale === "en" ? key : "";
  },
};
```

```bash
# Extract translations
npx i18next-parser
```

### Anti-Patterns

```typescript
// BAD: Dynamic keys prevent extraction
t(`error.${code}`); // Extractor cannot find these keys

// BAD: Computed template literals
t(`${prefix}.${suffix}`);

// BAD: Variables as message IDs
const key = condition ? "yes" : "no";
t(key);

// GOOD: Use explicit keys with context
t(code === "404" ? "error.notFound" : "error.generic");

// GOOD: If dynamic keys needed, declare all possible keys
// translations/en.json
{
  "error.400": "Bad request",
  "error.401": "Unauthorized",
  "error.404": "Not found",
  "error.500": "Server error"
}
```

### CI Integration

```yaml
# .github/workflows/i18n.yml
name: i18n Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Extract messages
        run: npm run i18n:extract

      - name: Check for new translations
        run: |
          git diff --exit-code lang/en.json || \
          (echo "New translations detected. Please update translation files." && exit 1)

      - name: Validate all locales have translations
        run: npm run i18n:validate
```

### When to Use

**Use message extraction when:**
- Working with professional translators (need file handoff)
- Application has 100+ translatable strings
- Using a Translation Management System (TMS)
- Need to track untranslated strings

**Do NOT use when:**
- Single developer managing all translations
- Very small app (< 50 strings)
- Translations change frequently without TMS

---

## 5. Pluralization Patterns (ICU)

### Core Patterns

ICU MessageFormat handles complex pluralization rules across 100+ languages.

#### Basic Pluralization

```json
// messages/en.json
{
  "cart.items": "{count, plural, =0 {Your cart is empty} one {# item in cart} other {# items in cart}}"
}

// messages/ru.json (Russian has different plural forms)
{
  "cart.items": "{count, plural, =0 {Корзина пуста} one {# товар} few {# товара} many {# товаров} other {# товара}}"
}
```

```typescript
// components/cart-badge.tsx
import { FormattedMessage } from "react-intl";

export function CartBadge({ count }: { count: number }) {
  return (
    <span>
      <FormattedMessage id="cart.items" values={{ count }} />
    </span>
  );
}
```

#### Ordinal Numbers

```json
// messages/en.json
{
  "ranking.position": "You finished in {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place"
}
```

#### Select (Gender/Category)

```json
// messages/en.json
{
  "profile.greeting": "{gender, select, male {He liked your post} female {She liked your post} other {They liked your post}}"
}
```

#### Nested Pluralization

```json
{
  "hosting": "{hostCount, plural, one {{guestCount, plural, one {{host} invited {guest}} other {{host} invited {guests}}}} other {{guestCount, plural, one {{hosts} invited {guest}} other {{hosts} invited {guests}}}}}"
}
```

#### i18next Pluralization

```json
// locales/en/common.json
{
  "items_zero": "No items",
  "items_one": "{{count}} item",
  "items_other": "{{count}} items"
}

// locales/ar/common.json (Arabic - 6 plural forms)
{
  "items_zero": "لا توجد عناصر",
  "items_one": "عنصر واحد",
  "items_two": "عنصران",
  "items_few": "{{count}} عناصر",
  "items_many": "{{count}} عنصرًا",
  "items_other": "{{count}} عنصر"
}
```

```typescript
// component.tsx
const { t } = useTranslation();
t("items", { count: 5 }); // Automatically selects correct form
```

### Anti-Patterns

```typescript
// BAD: Hardcoding plural logic
const label = count === 1 ? "item" : "items";

// BAD: Concatenating translations
t("you.have") + " " + count + " " + t("items");

// BAD: Assuming only singular/plural exists
const forms = { 1: "one", default: "many" };

// GOOD: Use ICU plural syntax
t("cart.items", { count }); // Handles all CLDR plural categories
```

### CLDR Plural Categories Reference

| Language | Categories |
|----------|-----------|
| English  | one, other |
| French   | one, other |
| Russian  | one, few, many, other |
| Arabic   | zero, one, two, few, many, other |
| Japanese | other (no plural forms) |
| Polish   | one, few, many, other |

### When to Use

**Always use ICU pluralization when:**
- Displaying counts (items, notifications, results)
- User-facing numbers that form sentences
- Supporting languages with complex plural rules (Slavic, Arabic)

**Simple number display (no pluralization needed):**
- Displaying raw counts without text context
- Tables/charts where format is obvious
- API responses not shown directly to users

---

## 6. Date/Number Formatting Patterns

### Core Patterns

#### Intl.DateTimeFormat (Native)

```typescript
// utils/format-date.ts
const DATE_FORMAT_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  short: { dateStyle: "short" },
  long: { dateStyle: "long" },
  full: { dateStyle: "full", timeStyle: "long" },
  relative: { year: "numeric", month: "short", day: "numeric" },
};

export function formatDate(
  date: Date,
  locale: string,
  format: keyof typeof DATE_FORMAT_OPTIONS = "short"
): string {
  return new Intl.DateTimeFormat(locale, DATE_FORMAT_OPTIONS[format]).format(date);
}

// Usage
formatDate(new Date(), "de-DE", "long"); // "15. Januar 2026"
formatDate(new Date(), "ja-JP", "short"); // "2026/01/15"
```

#### react-intl FormattedDate

```typescript
// components/event-date.tsx
import { FormattedDate, FormattedTime } from "react-intl";

export function EventDate({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()}>
      <FormattedDate
        value={date}
        year="numeric"
        month="long"
        day="numeric"
        weekday="long"
      />
      {" at "}
      <FormattedTime value={date} hour="numeric" minute="numeric" />
    </time>
  );
}
```

#### Number Formatting

```typescript
// utils/format-number.ts
type NumberFormat = "decimal" | "currency" | "percent" | "compact";

const DEFAULT_CURRENCY = "USD";

export function formatNumber(
  value: number,
  locale: string,
  format: NumberFormat = "decimal",
  currency: string = DEFAULT_CURRENCY
): string {
  const options: Intl.NumberFormatOptions = {
    decimal: {},
    currency: { style: "currency", currency },
    percent: { style: "percent", minimumFractionDigits: 1 },
    compact: { notation: "compact" },
  }[format];

  return new Intl.NumberFormat(locale, options).format(value);
}

// Usage
formatNumber(1234567.89, "en-US", "currency");  // "$1,234,567.89"
formatNumber(1234567.89, "de-DE", "currency", "EUR"); // "1.234.567,89 €"
formatNumber(1234567, "en-US", "compact"); // "1.2M"
```

#### react-intl FormattedNumber

```typescript
// components/price.tsx
import { FormattedNumber } from "react-intl";

type PriceProps = {
  amount: number;
  currency: string;
};

export function Price({ amount, currency }: PriceProps) {
  return (
    <FormattedNumber
      value={amount}
      style="currency"
      currency={currency}
      minimumFractionDigits={2}
      maximumFractionDigits={2}
    />
  );
}
```

#### Relative Time Formatting

```typescript
// hooks/use-relative-time.ts
import { useIntl } from "react-intl";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

export function useRelativeTime(date: Date): string {
  const intl = useIntl();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const rtf = new Intl.RelativeTimeFormat(intl.locale, { numeric: "auto" });

  if (diffMs < MINUTE_MS) {
    return rtf.format(-Math.floor(diffMs / SECOND_MS), "second");
  }
  if (diffMs < HOUR_MS) {
    return rtf.format(-Math.floor(diffMs / MINUTE_MS), "minute");
  }
  if (diffMs < DAY_MS) {
    return rtf.format(-Math.floor(diffMs / HOUR_MS), "hour");
  }
  if (diffMs < WEEK_MS) {
    return rtf.format(-Math.floor(diffMs / DAY_MS), "day");
  }
  if (diffMs < MONTH_MS) {
    return rtf.format(-Math.floor(diffMs / WEEK_MS), "week");
  }
  if (diffMs < YEAR_MS) {
    return rtf.format(-Math.floor(diffMs / MONTH_MS), "month");
  }
  return rtf.format(-Math.floor(diffMs / YEAR_MS), "year");
}
```

### Anti-Patterns

```typescript
// BAD: Hardcoding date format
const formatted = `${date.getMonth()}/${date.getDate()}/${date.getFullYear()}`;
// Different countries expect different formats (DD/MM vs MM/DD)

// BAD: Manual number formatting
const price = "$" + amount.toFixed(2);
// Currency symbol position varies (100 € vs $100)

// BAD: Assuming decimal separator
const input = parseFloat(value.replace(",", "."));
// German uses comma as decimal separator

// GOOD: Use Intl APIs
new Intl.DateTimeFormat(locale).format(date);
new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
```

### When to Use

**Always use Intl formatting when:**
- Displaying dates, times, or numbers to users
- Handling currency amounts
- Showing percentages or compact numbers
- Relative time displays ("2 hours ago")

**Raw formatting acceptable when:**
- Internal logging/debugging
- API serialization (use ISO 8601)
- Developer-facing tools

---

## 7. RTL Support Patterns

### Core Patterns

#### Document Direction Setup

```typescript
// app/[locale]/layout.tsx
import { getLocale } from "next-intl/server";

const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

#### CSS Logical Properties

```scss
// styles/components/card.module.scss

// BAD: Physical properties (breaks in RTL)
.card {
  margin-left: 1rem;
  padding-right: 2rem;
  text-align: left;
  border-left: 3px solid blue;
}

// GOOD: Logical properties (works in LTR and RTL)
.card {
  margin-inline-start: 1rem;
  padding-inline-end: 2rem;
  text-align: start;
  border-inline-start: 3px solid blue;
}
```

#### Logical Property Reference

| Physical | Logical (Inline) | Logical (Block) |
|----------|-----------------|-----------------|
| `left` | `inline-start` | - |
| `right` | `inline-end` | - |
| `top` | - | `block-start` |
| `bottom` | - | `block-end` |
| `margin-left` | `margin-inline-start` | - |
| `padding-right` | `padding-inline-end` | - |
| `border-left` | `border-inline-start` | - |
| `text-align: left` | `text-align: start` | - |

#### PostCSS RTL Plugin

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-rtlcss": {
      mode: "override", // Generate [dir="rtl"] overrides
      safeBothPrefix: true,
    },
  },
};
```

```css
/* Input */
.icon { margin-left: 8px; }

/* Output */
.icon { margin-left: 8px; }
[dir="rtl"] .icon { margin-right: 8px; margin-left: 0; }
```

#### Flexbox/Grid Auto-Flip

```scss
// Flexbox automatically respects direction
.nav {
  display: flex;
  gap: 1rem;
  // Items flow start-to-end in both LTR and RTL
}

// Grid with logical properties
.layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  // Sidebar on inline-start in both directions
}
```

#### Icon Mirroring

```scss
// icons.module.scss
.icon-arrow {
  // Flip directional icons in RTL
  [dir="rtl"] & {
    transform: scaleX(-1);
  }
}

// DO NOT flip non-directional icons:
// - Checkmarks, X marks
// - Play/pause buttons (video controls)
// - Clocks
// - Search magnifying glass
```

### Anti-Patterns

```typescript
// BAD: Using physical positioning
<div style={{ marginLeft: "1rem" }}>Content</div>

// BAD: Conditional RTL styling
<div style={{ marginLeft: isRTL ? undefined : "1rem", marginRight: isRTL ? "1rem" : undefined }}>

// BAD: Hardcoded left/right in Tailwind
<div className="ml-4 text-left">

// GOOD: Use logical Tailwind classes
<div className="ms-4 text-start">

// GOOD: CSS logical properties in style
<div style={{ marginInlineStart: "1rem" }}>
```

### When to Use

**Always implement RTL support when:**
- App targets Arabic, Hebrew, Farsi, or Urdu speakers
- Building a product for global markets
- Creating a component library

**Minimal RTL needed when:**
- App only supports LTR languages
- Internal tools for specific regions
- MVP without RTL market plans

---

## 8. Dynamic Locale Switching

### Core Patterns

#### i18next Language Change

```typescript
// components/language-switcher.tsx
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "Francais" },
  { code: "de", name: "Deutsch" },
  { code: "ar", name: "العربية", dir: "rtl" },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleChange = async (langCode: string) => {
    await i18n.changeLanguage(langCode);

    // Persist preference
    localStorage.setItem("preferred-language", langCode);

    // Update document direction for RTL languages
    const lang = LANGUAGES.find((l) => l.code === langCode);
    document.documentElement.dir = lang?.dir ?? "ltr";
    document.documentElement.lang = langCode;
  };

  return (
    <select
      value={i18n.language}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Select language"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
}
```

#### next-intl with Router Navigation

```typescript
// components/locale-switcher.tsx
"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTransition } from "react";

const LOCALES = ["en", "fr", "de", "ar"] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleChange = (newLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      aria-label="Select language"
    >
      {LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {new Intl.DisplayNames([loc], { type: "language" }).of(loc)}
        </option>
      ))}
    </select>
  );
}
```

#### Cookie-Based Persistence

```typescript
// utils/locale-cookie.ts
const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
const COOKIE_MAX_AGE_DAYS = 365;
const SECONDS_PER_DAY = 86400;

export function setLocaleCookie(locale: string): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE_DAYS * SECONDS_PER_DAY}; SameSite=Lax`;
}

export function getLocaleCookie(): string | undefined {
  const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}
```

#### Suspense for Async Loading

```typescript
// app/layout.tsx
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Suspense fallback={<LoadingSpinner />}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Full page reload on language change
const changeLanguage = (lang: string) => {
  window.location.href = `/${lang}${pathname}`;
};

// BAD: Not persisting preference
i18n.changeLanguage(lang); // Lost on page refresh

// BAD: Not updating document direction
i18n.changeLanguage("ar"); // RTL not applied

// BAD: Blocking UI during language load
const [loading, setLoading] = useState(false);
// Instead use React transitions or Suspense
```

### When to Use

**Client-side switching when:**
- Single-page applications (SPAs)
- User preferences stored locally
- Real-time language preview needed

**Server-side (URL-based) switching when:**
- SEO important (different URLs per language)
- Next.js App Router applications
- Content differs significantly by locale
- Need browser back/forward to work with locales

---

## 9. Type-Safe Translations

### Core Patterns

#### i18next Type Augmentation

```typescript
// src/types/i18next.d.ts
import "i18next";
import type common from "@/locales/en/common.json";
import type auth from "@/locales/en/auth.json";
import type dashboard from "@/locales/en/dashboard.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      auth: typeof auth;
      dashboard: typeof dashboard;
    };
  }
}
```

```typescript
// Now t() has autocomplete and type checking
const { t } = useTranslation("common");
t("header.title"); // OK
t("header.nonexistent"); // TypeScript error
t("header.greeting", { name: "Alice" }); // Interpolation values typed
```

#### react-intl Type Augmentation

```typescript
// src/types/react-intl.d.ts
import type messages from "@/messages/en.json";

declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: keyof typeof messages;
    }
  }
}

export {};
```

```typescript
// Now message IDs are type-checked
<FormattedMessage id="greeting.hello" /> // OK
<FormattedMessage id="nonexistent.key" /> // TypeScript error
```

#### next-intl Type Safety

```typescript
// src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
```

```typescript
// messages/en.json structure enables autocomplete
// t("HomePage.title") - autocomplete for namespaces and keys
```

#### Generated Types from JSON

```typescript
// scripts/generate-i18n-types.ts
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

function generateTypes(messagesPath: string, outputPath: string): void {
  const messages = JSON.parse(readFileSync(messagesPath, "utf-8"));

  function extractKeys(obj: Record<string, unknown>, prefix = ""): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null) {
        return extractKeys(value as Record<string, unknown>, fullKey);
      }
      return [fullKey];
    });
  }

  const keys = extractKeys(messages);
  const typeContent = `// Auto-generated - do not edit
export type TranslationKey =
  | ${keys.map((k) => `"${k}"`).join("\n  | ")};
`;

  writeFileSync(outputPath, typeContent);
}

generateTypes(
  join(__dirname, "../messages/en.json"),
  join(__dirname, "../src/types/translations.ts")
);
```

### Anti-Patterns

```typescript
// BAD: Type assertion to bypass checking
t("possibly.wrong.key" as any);

// BAD: Not updating types when adding translations
// Types generated from en.json, but new key only in fr.json

// BAD: Loose string typing
function translate(key: string) { // Loses type safety
  return t(key);
}

// GOOD: Preserve type information
function translate<K extends TranslationKey>(key: K) {
  return t(key);
}
```

### When to Use

**Always use type-safe translations when:**
- Working in TypeScript projects
- Team has multiple developers
- Refactoring translations frequently
- Using IDE with TypeScript support

**Type safety optional when:**
- Prototype/MVP stage
- Very small translation files (< 20 keys)
- Non-TypeScript JavaScript projects

---

## 10. Translation Management Integration

### Core Patterns

#### TMS Selection Criteria

| Platform | Best For | Key Features |
|----------|----------|--------------|
| **Lokalise** | Developer teams | GitHub sync, CLI, branching |
| **Phrase** | Large enterprises | Complex workflows, CAT tools |
| **Crowdin** | Open source | Community translations, 600+ integrations |
| **Transifex** | Agile teams | Over-the-air updates, webhooks |

#### GitHub Integration (Lokalise)

```yaml
# .github/workflows/i18n-sync.yml
name: Sync Translations

on:
  push:
    branches: [main]
    paths:
      - "src/messages/en.json"

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Upload source translations
        uses: lokalise/lokalise-cli-2-action@v2
        with:
          args: |
            file upload
            --project-id ${{ secrets.LOKALISE_PROJECT_ID }}
            --file src/messages/en.json
            --lang-iso en
        env:
          LOKALISE_API_TOKEN: ${{ secrets.LOKALISE_API_TOKEN }}

  download:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download translations
        uses: lokalise/lokalise-cli-2-action@v2
        with:
          args: |
            file download
            --project-id ${{ secrets.LOKALISE_PROJECT_ID }}
            --format json
            --dest src/messages/
        env:
          LOKALISE_API_TOKEN: ${{ secrets.LOKALISE_API_TOKEN }}

      - name: Create PR with translations
        uses: peter-evans/create-pull-request@v5
        with:
          title: "i18n: Update translations"
          branch: i18n/update-translations
          commit-message: "chore(i18n): update translations from Lokalise"
```

#### Crowdin CLI Integration

```yaml
# crowdin.yml
project_id: "project-id"
api_token_env: CROWDIN_TOKEN
base_path: "./"

files:
  - source: /src/messages/en.json
    translation: /src/messages/%locale%.json

# Pull translations
# crowdin download

# Push source
# crowdin upload sources
```

#### Webhook Handler (Phrase)

```typescript
// pages/api/webhooks/phrase.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const PHRASE_WEBHOOK_SECRET = process.env.PHRASE_WEBHOOK_SECRET ?? "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify webhook signature
  const signature = req.headers["x-phrase-signature"];
  const expectedSignature = crypto
    .createHmac("sha256", PHRASE_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { event_name, project } = req.body;

  if (event_name === "translations.completed") {
    // Trigger download and rebuild
    await execAsync("npm run i18n:download && npm run build");
  }

  return res.status(200).json({ received: true });
}
```

#### Custom Formatter for TMS

```javascript
// scripts/formatters/custom-tms.js
// FormatJS custom formatter for specific TMS requirements
exports.format = function (msgs) {
  // Transform FormatJS format to TMS-specific format
  return Object.entries(msgs).reduce((acc, [key, msg]) => {
    acc[key] = {
      text: msg.defaultMessage,
      description: msg.description,
      // TMS-specific fields
      max_length: 200,
      context: msg.description,
    };
    return acc;
  }, {});
};

exports.compile = function (msgs) {
  // Transform TMS format back to FormatJS format
  return Object.entries(msgs).reduce((acc, [key, msg]) => {
    acc[key] = msg.text;
    return acc;
  }, {});
};
```

### Anti-Patterns

```yaml
# BAD: Manual file sync
# Downloading files manually and committing

# BAD: No version control on translations
# Editing directly in TMS without file backup

# BAD: Pushing translations to main without review
# Auto-merge translation updates

# GOOD: PR-based translation workflow
# Bot creates PR, team reviews, then merges
```

### When to Use

**Use TMS integration when:**
- Working with professional translators
- Supporting 5+ languages
- Need translation memory and glossaries
- Require approval workflows

**Skip TMS when:**
- Developer-managed translations (1-2 languages)
- Very small project (< 100 strings)
- Budget constraints for paid TMS

---

## Summary Decision Matrix

| Scenario | Recommended Library | Key Consideration |
|----------|-------------------|-------------------|
| Next.js App Router | next-intl | Best RSC support |
| React SPA | react-intl | ICU MessageFormat |
| Multi-framework | i18next | Maximum flexibility |
| Simple React app | react-intl | Lighter than i18next |
| Node.js server | i18next | Works without React |

---

## Sources

### react-intl
- [FormatJS Documentation](https://formatjs.github.io/docs/react-intl/)
- [FormatJS Components](https://formatjs.github.io/docs/react-intl/components/)
- [FormatJS API Reference](https://formatjs.github.io/docs/react-intl/api/)
- [React Localization with FormatJS - Phrase](https://phrase.com/blog/posts/react-i18n-format-js/)
- [React-Intl TypeScript - Medium](https://medium.com/weekly-webtips/react-intl-translations-done-properly-with-typescript-3d901ca1b77f)

### next-intl
- [next-intl Documentation](https://next-intl.dev/docs/getting-started/app-router)
- [Next.js i18n Guide - Build with Matija](https://www.buildwithmatija.com/blog/nextjs-internationalization-guide-next-intl-2025)
- [Next.js Localization with next-intl - Phrase](https://phrase.com/blog/posts/next-js-app-router-localization-next-intl/)
- [next-intl 3.0 Blog](https://next-intl.dev/blog/next-intl-3-0)
- [Server & Client Components - next-intl](https://next-intl.dev/docs/environments/server-client-components)

### i18next
- [i18next TypeScript Documentation](https://www.i18next.com/overview/typescript)
- [Type-Safe i18next - DEV Community](https://dev.to/adrai/supercharge-your-typescript-app-mastering-i18next-for-type-safe-translations-2idp)
- [Type-Safe Translations - Zwyx](https://zwyx.dev/blog/typesafe-translations)
- [react-i18next TypeScript](https://react.i18next.com/latest/typescript)
- [i18next Plurals Documentation](https://www.i18next.com/translation-function/plurals)

### Message Extraction
- [FormatJS Message Extraction](https://formatjs.github.io/docs/getting-started/message-extraction/)
- [FormatJS Application Workflow](https://formatjs.github.io/docs/getting-started/application-workflow/)
- [FormatJS Babel Plugin](https://formatjs.github.io/docs/tooling/babel-plugin/)

### Pluralization
- [Using ICU Format - react-i18next](https://react.i18next.com/misc/using-with-icu-format)
- [Pluralization Guide - Localazy](https://localazy.com/blog/pluralization-in-software-localization-beginners-guide)
- [Pluralization with i18next - Medium](https://medium.com/@meleklassoued/implementing-pluralization-with-i18next-in-react-a-complete-guide-79fdf2418b38)
- [ICU Pluralization Guide - Phrase](https://phrase.com/blog/posts/pluralization/)

### Date/Number Formatting
- [Intl.DateTimeFormat - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [FormatJS Intl](https://formatjs.github.io/docs/intl/)

### RTL Support
- [Right to Left in React - LeanCode](https://leancode.co/blog/right-to-left-in-react)
- [RTL Languages - Next.js i18n - Lingo](https://lingo.dev/en/nextjs-i18n/right-to-left-languages)
- [React Aria Internationalization](https://react-spectrum.adobe.com/react-aria/internationalization.html)
- [I18nManager - React Native](https://reactnative.dev/docs/i18nmanager)

### Translation Management
- [Best Translation Management Systems - Lokalise](https://lokalise.com/blog/best-translation-management-systems/)
- [Crowdin Platform](https://crowdin.com/)
- [TMS Overview - Crowdin Blog](https://crowdin.com/blog/translation-management-system)

---

_Last updated: 2026-01-15_
