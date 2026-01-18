# next-intl Examples

> Core code examples for next-intl internationalization. See other files in this folder for advanced patterns.

---

## Setup Examples

### Good Example - Complete Project Setup

```typescript
// src/i18n/routing.ts
import { defineRouting } from "next-intl/routing";

export const SUPPORTED_LOCALES = ["en", "de", "fr", "es"] as const;
export const DEFAULT_LOCALE = "en";

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
});

export type Locale = (typeof routing.locales)[number];
```

```typescript
// src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

```typescript
// src/i18n/navigation.ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

```typescript
// src/proxy.ts (Next.js 16+) or src/middleware.ts (Next.js 15 and earlier)
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
```

**Why good:** modular file structure separates concerns, named constants for locales enable type safety, Locale type exported for use throughout app, proxy/middleware matcher excludes appropriate routes including tRPC

### Bad Example - Inline Configuration

```typescript
// src/proxy.ts (or middleware.ts)
import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["en", "de"], // Magic strings, not reusable
  defaultLocale: "en",
});

export const config = {
  matcher: ["/"], // Incomplete matcher
};
```

**Why bad:** locale strings are duplicated if used elsewhere, no type safety for locale values, incomplete matcher will miss nested routes, configuration not reusable in navigation.ts

---

## Layout Examples

### Good Example - Root Layout with Validation

```typescript
// src/app/[locale]/layout.tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Why good:** validates locale and returns 404 for invalid values, setRequestLocale called before any hooks, generateStaticParams enables SSG, messages passed to client provider explicitly

---

## useTranslations Examples

### Good Example - Namespaced Translations

```typescript
// src/app/[locale]/dashboard/page.tsx
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = useTranslations("Dashboard");

  return (
    <main>
      <h1>{t("title")}</h1>
      <section>
        <h2>{t("stats.heading")}</h2>
        <p>{t("stats.description")}</p>
      </section>
    </main>
  );
}
```

```json
{
  "Dashboard": {
    "title": "Dashboard",
    "stats": {
      "heading": "Your Statistics",
      "description": "View your performance metrics."
    }
  }
}
```

**Why good:** namespace ("Dashboard") groups related translations, nested keys (stats.heading) organize complex pages, setRequestLocale at top enables static rendering

### Good Example - Interpolation with Type Safety

```typescript
import { useTranslations } from "next-intl";

const MIN_PASSWORD_LENGTH = 8;

function WelcomeMessage({ user }: { user: { name: string; email: string } }) {
  const t = useTranslations("Welcome");

  return (
    <div>
      <h1>{t("greeting", { name: user.name })}</h1>
      <p>{t("accountInfo", { name: user.name, email: user.email })}</p>
      <p>{t("passwordHint", { minLength: MIN_PASSWORD_LENGTH })}</p>
    </div>
  );
}
```

```json
{
  "Welcome": {
    "greeting": "Welcome back, {name}!",
    "accountInfo": "Signed in as {name} ({email})",
    "passwordHint": "Password must be at least {minLength} characters"
  }
}
```

**Why good:** placeholder names are explicit and refactorable, named constant avoids magic number in translation, TypeScript augmentation validates placeholder names

---

## Pluralization Examples

### Good Example - Cardinal Plurals

```typescript
import { useTranslations } from "next-intl";

function NotificationBadge({ count }: { count: number }) {
  const t = useTranslations("Notifications");

  return (
    <span aria-label={t("unreadLabel", { count })}>
      {t("unreadCount", { count })}
    </span>
  );
}
```

```json
{
  "Notifications": {
    "unreadCount": "{count, plural, =0 {No notifications} one {# notification} other {# notifications}}",
    "unreadLabel": "{count, plural, =0 {No unread notifications} one {# unread notification} other {# unread notifications}}"
  }
}
```

**Why good:** ICU plural syntax handles all cases, `=0` provides zero-specific message, `#` formats the count with locale-appropriate separators, aria-label improves accessibility

### Good Example - Select for Enum Values

```typescript
import { useTranslations } from "next-intl";

type Status = "pending" | "approved" | "rejected";

function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations("Status");

  return <span>{t("label", { status })}</span>;
}
```

```json
{
  "Status": {
    "label": "{status, select, pending {Pending Review} approved {Approved} rejected {Rejected} other {Unknown}}"
  }
}
```

**Why good:** select handles enum-like values cleanly, other case handles unexpected values, all variants in single translation string

> **Advanced:** For ordinal plurals (1st, 2nd, 3rd), see [pluralization.md](pluralization.md).

---

## Rich Text Examples

### Good Example - Rich Text with Components

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

function TermsNotice() {
  const t = useTranslations("Legal");

  return (
    <p>
      {t.rich("termsAgreement", {
        terms: (chunks) => <Link href="/terms">{chunks}</Link>,
        privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
        bold: (chunks) => <strong>{chunks}</strong>,
      })}
    </p>
  );
}
```

```json
{
  "Legal": {
    "termsAgreement": "By continuing, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>. <bold>Your data is protected.</bold>"
  }
}
```

**Why good:** translation string stays translatable with complete sentences, markup tags are developer-defined, Link component is locale-aware from next-intl/navigation

> **Advanced:** For raw HTML markup (email templates, RSS feeds), see [markup.md](markup.md).

---

## useFormatter Examples

### Good Example - Date Formatting

```typescript
import { useFormatter } from "next-intl";

function EventDetails({ event }: { event: { date: Date; endDate: Date } }) {
  const format = useFormatter();

  return (
    <dl>
      <dt>Date</dt>
      <dd>
        <time dateTime={event.date.toISOString()}>
          {format.dateTime(event.date, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
      </dd>

      <dt>Duration</dt>
      <dd>
        {format.dateTimeRange(event.date, event.endDate, {
          month: "short",
          day: "numeric",
          hour: "numeric",
        })}
      </dd>
    </dl>
  );
}
```

**Why good:** time element with dateTime attribute improves semantics and SEO, dateTimeRange formats ranges appropriately per locale, explicit format options ensure consistent display

### Good Example - Number and Currency Formatting

```typescript
import { useFormatter } from "next-intl";

type Product = {
  price: number;
  currency: string;
  quantity: number;
  discount: number;
};

function ProductPrice({ product }: { product: Product }) {
  const format = useFormatter();

  return (
    <div>
      <span>
        {format.number(product.price, {
          style: "currency",
          currency: product.currency,
        })}
      </span>
      <span>Qty: {format.number(product.quantity)}</span>
      <span>
        {format.number(product.discount, {
          style: "percent",
          maximumFractionDigits: 0,
        })}
        {" off"}
      </span>
    </div>
  );
}
```

**Why good:** currency formatting handles symbols and positions per locale, percent style handles conversion automatically, locale-specific thousand separators

> **Advanced:** For relative time with auto-update and list formatting, see [formatting.md](formatting.md).

---

## Static Rendering Examples

### Good Example - Page with Static Generation

```typescript
// src/app/[locale]/blog/[slug]/page.tsx
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  const slugs = ["getting-started", "advanced-guide", "api-reference"];

  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug }))
  );
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = useTranslations("Blog");

  return (
    <article>
      <h1>{t("title")}</h1>
    </article>
  );
}
```

**Why good:** generateStaticParams creates all locale+slug combinations, setRequestLocale enables next-intl in static context, called before hooks

### Good Example - Metadata with Translations

```typescript
// src/app/[locale]/products/page.tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Products.Metadata" });

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
    },
  };
}

export default async function ProductsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Products");

  return <h1>{t("heading")}</h1>;
}
```

```json
{
  "Products": {
    "heading": "Our Products",
    "Metadata": {
      "title": "Products | MyStore",
      "description": "Browse our product catalog",
      "ogTitle": "Shop Our Products",
      "ogDescription": "Discover amazing products at great prices"
    }
  }
}
```

**Why good:** getTranslations with locale param works in generateMetadata, nested namespace for metadata keys, Open Graph tags localized for SEO

---

## Locale Switching Examples

### Good Example - Accessible Locale Switcher

```typescript
"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Francais",
  es: "Espanol",
};

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div role="group" aria-labelledby="locale-switcher-label">
      <span id="locale-switcher-label" className="sr-only">
        {t("label")}
      </span>
      <select
        value={locale}
        onChange={(e) => handleLocaleChange(e.target.value as Locale)}
        aria-label={t("selectLabel")}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_NAMES[loc]}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Why good:** uses next-intl navigation for locale-aware routing, type-safe locale handling, accessible with aria attributes, preserves current pathname

### Good Example - Link-Based Locale Switcher

```typescript
"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Francais",
  es: "Espanol",
};

export function LocaleLinks() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label="Language selection">
      <ul>
        {routing.locales.map((loc) => (
          <li key={loc}>
            <Link
              href={pathname}
              locale={loc}
              aria-current={loc === locale ? "page" : undefined}
            >
              {LOCALE_NAMES[loc]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

**Why good:** Link components are prefetchable, aria-current indicates active locale, semantic nav and list structure

---

## TypeScript Examples

### Good Example - Full Type Safety Setup (next-intl v4.0+)

```typescript
// src/i18n/types.ts (or global.d.ts)
import type en from "../../messages/en.json";
import { routing } from "./routing";
import type { formats } from "./request";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof en;
    Formats: typeof formats;
  }
}

export type Messages = typeof en;
```

```typescript
// src/components/typed-translations.tsx
import { useTranslations } from "next-intl";

function TypedComponent() {
  const t = useTranslations("Dashboard");

  // TypeScript error if key doesn't exist
  return (
    <div>
      <h1>{t("title")}</h1>
      {/* @ts-expect-error - "nonexistent" key doesn't exist */}
      <p>{t("nonexistent")}</p>
    </div>
  );
}
```

**Why good:** Messages type inferred from JSON structure, invalid keys cause compile-time errors, IDE autocomplete for all translation keys

---

_For advanced patterns, see other files in this folder: [formatting.md](formatting.md), [pluralization.md](pluralization.md), [markup.md](markup.md)._
