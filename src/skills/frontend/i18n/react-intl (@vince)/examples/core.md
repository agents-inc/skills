# React-Intl Core Examples

> Core code examples for react-intl internationalization. See other files in this folder for formatting and pluralization patterns.

---

## Setup Examples

### Good Example - Complete IntlProvider Setup

```typescript
// src/i18n/config.ts
export const SUPPORTED_LOCALES = ["en", "de", "fr", "es"] as const;
export const DEFAULT_LOCALE = "en";

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}
```

```typescript
// src/providers/intl-provider.tsx
import { IntlProvider } from "react-intl";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";

type Props = {
  children: ReactNode;
  locale: Locale;
  messages: Record<string, string>;
};

const DEFAULT_RICH_TEXT_ELEMENTS = {
  b: (chunks: ReactNode) => <strong>{chunks}</strong>,
  i: (chunks: ReactNode) => <em>{chunks}</em>,
  br: () => <br />,
};

export function AppIntlProvider({ children, locale, messages }: Props) {
  return (
    <IntlProvider
      locale={locale}
      defaultLocale={DEFAULT_LOCALE}
      messages={messages}
      defaultRichTextElements={DEFAULT_RICH_TEXT_ELEMENTS}
      onError={(err) => {
        if (err.code === "MISSING_TRANSLATION") {
          console.warn(`Missing translation: ${err.message}`);
          return;
        }
        throw err;
      }}
    >
      {children}
    </IntlProvider>
  );
}

export { AppIntlProvider };
```

```typescript
// src/app.tsx
import { useState, useEffect } from "react";
import { AppIntlProvider } from "./providers/intl-provider";
import { loadMessages } from "./utils/load-messages";
import { DEFAULT_LOCALE, isValidLocale, type Locale } from "./i18n/config";

export function App() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMessages(locale).then((msgs) => {
      setMessages(msgs);
      setIsLoading(false);
    });
  }, [locale]);

  const handleLocaleChange = (newLocale: string) => {
    if (isValidLocale(newLocale)) {
      setIsLoading(true);
      setLocale(newLocale);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AppIntlProvider locale={locale} messages={messages}>
      <main>
        {/* Your app content */}
      </main>
    </AppIntlProvider>
  );
}

export { App };
```

**Why good:** modular configuration with named constants, locale validation function prevents invalid locales, error handler distinguishes missing translations from errors, default rich text elements provide consistent markup handling, lazy loading prevents loading all locales upfront

### Bad Example - Inline Configuration

```typescript
// WRONG - Hardcoded values, no error handling
import { IntlProvider } from "react-intl";
import messages from "./messages/en.json";

function App({ children }) {
  return (
    <IntlProvider locale="en" messages={messages}>
      {children}
    </IntlProvider>
  );
}
```

**Why bad:** hardcoded locale string prevents type safety and reuse, no defaultLocale means missing messages show raw IDs, no onError causes console noise, no locale switching capability, loads all messages synchronously

---

## FormattedMessage Examples

### Good Example - Basic Usage with Values

```typescript
// src/components/welcome-banner.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  userName: string;
  lastLoginDate: Date;
};

export function WelcomeBanner({ userName, lastLoginDate }: Props) {
  return (
    <section aria-labelledby="welcome-heading">
      <h1 id="welcome-heading">
        <FormattedMessage
          id="welcome.heading"
          defaultMessage="Welcome back, {name}!"
          values={{ name: userName }}
        />
      </h1>
      <p>
        <FormattedMessage
          id="welcome.lastLogin"
          defaultMessage="Your last login was on {date, date, long}"
          values={{ date: lastLoginDate }}
        />
      </p>
    </section>
  );
}

export { WelcomeBanner };
```

```json
// messages/en.json
{
  "welcome.heading": "Welcome back, {name}!",
  "welcome.lastLogin": "Your last login was on {date, date, long}"
}
```

**Why good:** semantic HTML with aria-labelledby, named placeholders are explicit and refactorable, date formatting uses ICU syntax for locale-aware output

### Good Example - Rich Text with Links

```typescript
// src/components/legal-notice.tsx
import { FormattedMessage } from "react-intl";

export function LegalNotice() {
  return (
    <p>
      <FormattedMessage
        id="legal.consent"
        defaultMessage="By continuing, you agree to our <terms>Terms of Service</terms> and acknowledge our <privacy>Privacy Policy</privacy>. See <faq>FAQ</faq> for more information."
        values={{
          terms: (chunks) => <a href="/terms">{chunks}</a>,
          privacy: (chunks) => <a href="/privacy">{chunks}</a>,
          faq: (chunks) => <a href="/faq">{chunks}</a>,
        }}
      />
    </p>
  );
}

export { LegalNotice };
```

**Why good:** complete sentence stays in one translation unit, translators can reorder tags per language grammar, each tag maps to a React component

---

## useIntl Hook Examples

### Good Example - String Attributes

```typescript
// src/components/search-form.tsx
import { useIntl } from "react-intl";
import { useState } from "react";

const MIN_SEARCH_LENGTH = 2;

export function SearchForm({ onSearch }: { onSearch: (query: string) => void }) {
  const intl = useIntl();
  const [query, setQuery] = useState("");

  const placeholder = intl.formatMessage({
    id: "search.placeholder",
    defaultMessage: "Search for products, categories...",
  });

  const ariaLabel = intl.formatMessage({
    id: "search.ariaLabel",
    defaultMessage: "Search the product catalog",
  });

  const submitLabel = intl.formatMessage({
    id: "search.submit",
    defaultMessage: "Search",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length >= MIN_SEARCH_LENGTH) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} role="search">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        minLength={MIN_SEARCH_LENGTH}
      />
      <button type="submit">{submitLabel}</button>
    </form>
  );
}

export { SearchForm };
```

**Why good:** useIntl returns strings for HTML attributes, named constant for min length, accessible with aria-label and role, separate message for each translatable string

### Good Example - Conditional Messages

```typescript
// src/components/status-badge.tsx
import { useIntl, defineMessages } from "react-intl";

type Status = "pending" | "approved" | "rejected";

const statusMessages = defineMessages({
  pending: {
    id: "status.pending",
    defaultMessage: "Pending Review",
  },
  approved: {
    id: "status.approved",
    defaultMessage: "Approved",
  },
  rejected: {
    id: "status.rejected",
    defaultMessage: "Rejected",
  },
});

export function StatusBadge({ status }: { status: Status }) {
  const intl = useIntl();

  const label = intl.formatMessage(statusMessages[status]);

  return (
    <span data-status={status} role="status">
      {label}
    </span>
  );
}

export { StatusBadge };
```

**Why good:** defineMessages enables CLI extraction, status maps directly to message descriptor, data-status attribute for styling, role="status" for accessibility

---

## defineMessages Examples

### Good Example - Organized Message Definitions

```typescript
// src/messages/checkout.messages.ts
import { defineMessages } from "react-intl";

export const checkoutMessages = defineMessages({
  pageTitle: {
    id: "checkout.pageTitle",
    defaultMessage: "Checkout",
    description: "Page title for checkout flow",
  },
  cartSummary: {
    id: "checkout.cartSummary",
    defaultMessage: "Cart Summary ({itemCount, plural, one {# item} other {# items}})",
    description: "Summary heading with item count",
  },
  shippingAddress: {
    id: "checkout.shippingAddress",
    defaultMessage: "Shipping Address",
    description: "Section heading for shipping address form",
  },
  paymentMethod: {
    id: "checkout.paymentMethod",
    defaultMessage: "Payment Method",
    description: "Section heading for payment method selection",
  },
  placeOrder: {
    id: "checkout.placeOrder",
    defaultMessage: "Place Order",
    description: "Button text for submitting order",
  },
  orderTotal: {
    id: "checkout.orderTotal",
    defaultMessage: "Total: {amount}",
    description: "Order total with formatted currency",
  },
  processingOrder: {
    id: "checkout.processingOrder",
    defaultMessage: "Processing your order...",
    description: "Loading message while order is being processed",
  },
  orderSuccess: {
    id: "checkout.orderSuccess",
    defaultMessage: "Order placed successfully! Your order number is {orderNumber}.",
    description: "Success message after order completion",
  },
});
```

**Why good:** grouped by feature/page, descriptions provide translator context, IDs follow namespace.key pattern, all placeholders documented in defaultMessage

### Good Example - Using Defined Messages

```typescript
// src/pages/checkout.tsx
import { useIntl, FormattedMessage } from "react-intl";
import { checkoutMessages } from "../messages/checkout.messages";

export function CheckoutPage({ cart }: { cart: Cart }) {
  const intl = useIntl();

  // For document title (string needed)
  document.title = intl.formatMessage(checkoutMessages.pageTitle);

  return (
    <main>
      <h1>
        <FormattedMessage {...checkoutMessages.pageTitle} />
      </h1>

      <section aria-labelledby="cart-summary">
        <h2 id="cart-summary">
          <FormattedMessage
            {...checkoutMessages.cartSummary}
            values={{ itemCount: cart.items.length }}
          />
        </h2>
        {/* Cart content */}
      </section>

      <section aria-labelledby="shipping-section">
        <h2 id="shipping-section">
          <FormattedMessage {...checkoutMessages.shippingAddress} />
        </h2>
        {/* Shipping form */}
      </section>

      <button type="submit">
        <FormattedMessage {...checkoutMessages.placeOrder} />
      </button>
    </main>
  );
}

export { CheckoutPage };
```

**Why good:** spreads message descriptor with values, useIntl for document.title (string context), FormattedMessage for JSX content, semantic sections with aria-labelledby

---

## RawIntlProvider Examples

### Good Example - Performance Optimization with createIntl

```typescript
// src/providers/optimized-intl-provider.tsx
import { createIntl, createIntlCache, RawIntlProvider } from "react-intl";
import type { ReactNode } from "react";
import { useMemo } from "react";

const intlCache = createIntlCache();

type Props = {
  locale: string;
  messages: Record<string, string>;
  children: ReactNode;
};

export function OptimizedIntlProvider({ locale, messages, children }: Props) {
  const intl = useMemo(
    () => createIntl({ locale, messages }, intlCache),
    [locale, messages]
  );

  return <RawIntlProvider value={intl}>{children}</RawIntlProvider>;
}

export { OptimizedIntlProvider };
```

**Why good:** createIntlCache prevents recreating formatter caches, useMemo prevents unnecessary intl object recreation, RawIntlProvider accepts pre-created intl object

---

## Locale Switching Examples

### Good Example - Locale Switcher Component

```typescript
// src/components/locale-switcher.tsx
import { useIntl, defineMessages } from "react-intl";
import { SUPPORTED_LOCALES, type Locale } from "../i18n/config";

const messages = defineMessages({
  label: {
    id: "localeSwitcher.label",
    defaultMessage: "Select language",
  },
});

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Francais",
  es: "Espanol",
};

type Props = {
  currentLocale: Locale;
  onLocaleChange: (locale: Locale) => void;
};

export function LocaleSwitcher({ currentLocale, onLocaleChange }: Props) {
  const intl = useIntl();

  return (
    <div role="group" aria-label={intl.formatMessage(messages.label)}>
      <select
        value={currentLocale}
        onChange={(e) => onLocaleChange(e.target.value as Locale)}
        aria-label={intl.formatMessage(messages.label)}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_NAMES[locale]}
          </option>
        ))}
      </select>
    </div>
  );
}

export { LocaleSwitcher };
```

**Why good:** uses SUPPORTED_LOCALES constant, type-safe locale handling, accessible with aria-label, native language names for each locale

---

## TypeScript Integration Examples

### Good Example - Type-Safe Message IDs

```typescript
// src/types/intl.d.ts
import type messages from "../lang/en.json";

type MessageIds = keyof typeof messages;

declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: MessageIds;
    }
  }
}

export {};
```

```typescript
// src/components/typed-component.tsx
import { FormattedMessage, useIntl } from "react-intl";

export function TypedComponent() {
  const intl = useIntl();

  // TypeScript validates message IDs
  const title = intl.formatMessage({ id: "home.title" });

  return (
    <div>
      <h1>{title}</h1>
      <p>
        <FormattedMessage id="home.description" />
      </p>
      {/* @ts-expect-error - "nonexistent.key" doesn't exist in messages */}
      <span>{intl.formatMessage({ id: "nonexistent.key" })}</span>
    </div>
  );
}
```

**Why good:** Messages type inferred from JSON structure, invalid IDs cause compile-time errors, IDE autocomplete for all message IDs

---

## Lazy Loading Examples

### Good Example - Dynamic Message Loading

```typescript
// src/utils/load-messages.ts
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";

const messageLoaders: Record<Locale, () => Promise<Record<string, string>>> = {
  en: () => import("../lang/compiled/en.json").then((m) => m.default),
  de: () => import("../lang/compiled/de.json").then((m) => m.default),
  fr: () => import("../lang/compiled/fr.json").then((m) => m.default),
  es: () => import("../lang/compiled/es.json").then((m) => m.default),
};

const messageCache = new Map<Locale, Record<string, string>>();

export async function loadMessages(locale: Locale): Promise<Record<string, string>> {
  const cached = messageCache.get(locale);
  if (cached) {
    return cached;
  }

  const loader = messageLoaders[locale] ?? messageLoaders[DEFAULT_LOCALE];
  const messages = await loader();

  messageCache.set(locale, messages);
  return messages;
}

export { loadMessages };
```

**Why good:** dynamic imports for code splitting, in-memory cache prevents duplicate loads, fallback to default locale, type-safe locale parameter

---

_For formatting patterns (dates, numbers, currency), see [formatting.md](formatting.md). For pluralization and select patterns, see [pluralization.md](pluralization.md)._
