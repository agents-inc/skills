# React-Intl (FormatJS) Best Practices Research

> **Research Date:** January 2026
> **Library Version:** react-intl 8.x (FormatJS)
> **Sources:** Official FormatJS documentation, Testing Library, community best practices

---

## Executive Summary

React-intl is the React binding for FormatJS, providing internationalization through the ICU Message Format standard. It offers both declarative components (`FormattedMessage`, `FormattedNumber`, etc.) and an imperative API (`useIntl` hook) for formatting messages, dates, numbers, and pluralization. The library is built on native `Intl` APIs and supports TypeScript with type-safe message IDs.

**Key Differentiators:**
- ICU Message Format standard for industry-compatible translations
- Built on browser-native `Intl` APIs for optimal performance
- Declarative components and imperative hooks for flexible usage
- CLI tooling for message extraction and compilation
- TypeScript support with augmentable types for message ID safety

---

## 1. Core Concepts

### ICU Message Format

React-intl uses ICU (International Components for Unicode) Message Format, an industry standard for i18n that enables:

- **Simple Arguments:** `{name}` - Direct variable interpolation
- **Formatted Arguments:** `{date, date, long}` - Type-aware formatting
- **Pluralization:** `{count, plural, one {# item} other {# items}}`
- **Selection:** `{gender, select, male {He} female {She} other {They}}`
- **Rich Text:** `<bold>emphasized</bold>` with tag handlers

### Message Descriptor

```typescript
type MessageDescriptor = {
  id: string;                     // Unique identifier for the message
  defaultMessage?: string;        // English fallback/template
  description?: string | object;  // Context for translators
};
```

### IntlShape

The core object providing all formatting methods, accessible via `useIntl()` hook:

```typescript
interface IntlShape {
  locale: string;
  messages: Record<string, string>;
  formatMessage: (descriptor: MessageDescriptor, values?: object) => string;
  formatDate: (value: Date | number, options?: DateTimeFormatOptions) => string;
  formatTime: (value: Date | number, options?: DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: NumberFormatOptions) => string;
  formatPlural: (value: number, options?: PluralFormatOptions) => string;
  formatRelativeTime: (value: number, unit: RelativeTimeUnit, options?: RelativeTimeFormatOptions) => string;
  formatList: (values: string[], options?: ListFormatOptions) => string;
  formatDisplayName: (value: string, options?: DisplayNameOptions) => string;
}
```

---

## 2. Essential Patterns

### Pattern 1: IntlProvider Setup

Wrap your application root with `IntlProvider` to establish i18n context.

```typescript
// src/app.tsx
import { IntlProvider } from "react-intl";
import type { ReactNode } from "react";

const SUPPORTED_LOCALES = ["en", "de", "fr", "es"] as const;
const DEFAULT_LOCALE = "en";

type Locale = (typeof SUPPORTED_LOCALES)[number];

type Props = {
  children: ReactNode;
  locale: Locale;
  messages: Record<string, string>;
};

export function AppProviders({ children, locale, messages }: Props) {
  return (
    <IntlProvider
      locale={locale}
      defaultLocale={DEFAULT_LOCALE}
      messages={messages}
      onError={(err) => {
        // Log missing translations in development
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

export { AppProviders };
```

**Why this pattern:**
- Named constants for locales enable type-safe locale handling
- Custom `onError` distinguishes missing translations from actual errors
- `defaultLocale` provides fallback for missing messages

### Pattern 2: FormattedMessage Component (Declarative)

Use `FormattedMessage` for rendering translated text directly in JSX.

```typescript
// src/components/greeting.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  userName: string;
  unreadCount: number;
};

export function Greeting({ userName, unreadCount }: Props) {
  return (
    <div>
      <h1>
        <FormattedMessage
          id="greeting.welcome"
          defaultMessage="Welcome back, {name}!"
          values={{ name: userName }}
        />
      </h1>
      <p>
        <FormattedMessage
          id="greeting.unread"
          defaultMessage="You have {count, plural, =0 {no unread messages} one {# unread message} other {# unread messages}}"
          values={{ count: unreadCount }}
        />
      </p>
    </div>
  );
}

export { Greeting };
```

**When to use FormattedMessage:**
- Text content rendered directly in JSX
- Rich text with embedded formatting
- When the translation is the primary content of an element

### Pattern 3: useIntl Hook (Imperative)

Use `useIntl` when you need formatted strings for attributes, props, or programmatic use.

```typescript
// src/components/search-input.tsx
import { useIntl } from "react-intl";

export function SearchInput() {
  const intl = useIntl();

  const placeholder = intl.formatMessage({
    id: "search.placeholder",
    defaultMessage: "Search products...",
  });

  const ariaLabel = intl.formatMessage({
    id: "search.aria-label",
    defaultMessage: "Search for products in the catalog",
  });

  return (
    <input
      type="search"
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}

export { SearchInput };
```

**When to use useIntl:**
- Input placeholders and ARIA labels (string attributes)
- Passing translated strings to third-party components
- Conditional rendering based on formatted values
- Programmatic string manipulation

### Pattern 4: defineMessages for Static Extraction

Use `defineMessages` to declare messages that the CLI can extract.

```typescript
// src/messages/product.messages.ts
import { defineMessages } from "react-intl";

export const productMessages = defineMessages({
  title: {
    id: "product.title",
    defaultMessage: "Product Details",
    description: "Page title for product detail page",
  },
  addToCart: {
    id: "product.addToCart",
    defaultMessage: "Add to Cart",
    description: "Button text for adding product to shopping cart",
  },
  outOfStock: {
    id: "product.outOfStock",
    defaultMessage: "Out of Stock",
    description: "Badge text when product is unavailable",
  },
  priceLabel: {
    id: "product.priceLabel",
    defaultMessage: "Price: {price}",
    description: "Price display with formatted currency",
  },
  reviewCount: {
    id: "product.reviewCount",
    defaultMessage: "{count, plural, =0 {No reviews} one {# review} other {# reviews}}",
    description: "Number of product reviews with pluralization",
  },
});
```

**Benefits:**
- Centralizes related messages in one file
- Descriptions provide context for translators
- CLI extracts these automatically
- IDE autocomplete for message references

---

## 3. ICU Message Format Syntax

### Simple Arguments

```
Hello, {name}!
```

### Number Formatting

```
{count, number}                    // Basic number: 1,234
{percent, number, percent}         // Percentage: 45%
{price, number, ::currency/USD}    // Currency: $99.99
{value, number, ::.00}             // Fixed decimals: 3.14
```

### Date and Time Formatting

```
{date, date}                       // Default date format
{date, date, short}                // Short: 1/2/23
{date, date, medium}               // Medium: Jan 2, 2023
{date, date, long}                 // Long: January 2, 2023
{date, date, full}                 // Full: Monday, January 2, 2023

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

**Plural categories by language:**

| Language | Categories |
|----------|------------|
| English | `one`, `other` |
| French | `one`, `other` |
| Russian | `one`, `few`, `many`, `other` |
| Arabic | `zero`, `one`, `two`, `few`, `many`, `other` |
| Japanese | `other` (no plural forms) |

**Important:** The `other` category is **required** - omitting it causes runtime errors.

### Ordinal Pluralization

```
{position, selectordinal,
  one {#st}
  two {#nd}
  few {#rd}
  other {#th}
}
```

Example output: "1st", "2nd", "3rd", "4th", "21st"

### Select (Gender/Enum)

```
{gender, select,
  male {He}
  female {She}
  other {They}
} liked your post.
```

**Important:** The `other` category is **required** as a fallback.

### Nested Formatting

```
{gender, select,
  male {He has {count, plural, one {# friend} other {# friends}}}
  female {She has {count, plural, one {# friend} other {# friends}}}
  other {They have {count, plural, one {# friend} other {# friends}}}
}
```

### Escaping

- Single quotes `'` escape syntax characters: `'{' displays {`
- Double single quotes `''` produce a literal single quote
- Use curly quotes `'` (U+2019) for apostrophes in text

```
You have '{count}' new messages.  // Literal: You have {count} new messages.
It''s a nice day!                  // Literal: It's a nice day!
```

---

## 4. Rich Text Formatting

React-intl supports embedding markup in translations using XML-like tags.

### Basic Rich Text

```typescript
import { FormattedMessage } from "react-intl";

function TermsNotice() {
  return (
    <p>
      <FormattedMessage
        id="terms.notice"
        defaultMessage="By signing up, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>."
        values={{
          terms: (chunks) => <a href="/terms">{chunks}</a>,
          privacy: (chunks) => <a href="/privacy">{chunks}</a>,
        }}
      />
    </p>
  );
}
```

### With useIntl (Returns Array)

```typescript
import { useIntl } from "react-intl";

function RichMessage() {
  const intl = useIntl();

  const message = intl.formatMessage(
    {
      id: "important.notice",
      defaultMessage: "This is <bold>very important</bold> information.",
    },
    {
      bold: (chunks) => <strong>{chunks}</strong>,
    }
  );

  // Returns: Array<string | ReactElement>
  return <p>{message}</p>;
}
```

### Default Rich Text Tags

Configure global tag handlers in `IntlProvider` for consistent styling:

```typescript
import { IntlProvider } from "react-intl";
import type { ReactNode } from "react";

const DEFAULT_RICH_TEXT_ELEMENTS = {
  b: (chunks: ReactNode) => <strong>{chunks}</strong>,
  i: (chunks: ReactNode) => <em>{chunks}</em>,
  link: (chunks: ReactNode) => <a href="#">{chunks}</a>,
  br: () => <br />,
};

function Providers({ children }: { children: ReactNode }) {
  return (
    <IntlProvider
      locale="en"
      messages={messages}
      defaultRichTextElements={DEFAULT_RICH_TEXT_ELEMENTS}
    >
      {children}
    </IntlProvider>
  );
}
```

---

## 5. Date, Time, and Number Components

### FormattedDate

```typescript
import { FormattedDate } from "react-intl";

function EventDate({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()}>
      <FormattedDate
        value={date}
        year="numeric"
        month="long"
        day="numeric"
        weekday="long"
      />
    </time>
  );
}

// Output (en-US): "Monday, January 15, 2024"
// Output (de-DE): "Montag, 15. Januar 2024"
```

### FormattedTime

```typescript
import { FormattedTime } from "react-intl";

function MeetingTime({ time }: { time: Date }) {
  return (
    <FormattedTime
      value={time}
      hour="numeric"
      minute="numeric"
      timeZoneName="short"
    />
  );
}

// Output (en-US): "3:30 PM EST"
// Output (de-DE): "15:30 MEZ"
```

### FormattedNumber

```typescript
import { FormattedNumber } from "react-intl";

function ProductPrice({ amount, currency }: { amount: number; currency: string }) {
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

// Output (en-US, USD): "$1,234.56"
// Output (de-DE, EUR): "1.234,56 €"
```

### FormattedRelativeTime

```typescript
import { FormattedRelativeTime } from "react-intl";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const AUTO_UPDATE_INTERVAL = 10;

function TimeAgo({ timestamp }: { timestamp: Date }) {
  const deltaSeconds = Math.round((timestamp.getTime() - Date.now()) / 1000);

  // Choose appropriate unit
  let value: number;
  let unit: "second" | "minute" | "hour" | "day";

  if (Math.abs(deltaSeconds) < SECONDS_PER_MINUTE) {
    value = deltaSeconds;
    unit = "second";
  } else if (Math.abs(deltaSeconds) < SECONDS_PER_HOUR) {
    value = Math.round(deltaSeconds / SECONDS_PER_MINUTE);
    unit = "minute";
  } else if (Math.abs(deltaSeconds) < SECONDS_PER_DAY) {
    value = Math.round(deltaSeconds / SECONDS_PER_HOUR);
    unit = "hour";
  } else {
    value = Math.round(deltaSeconds / SECONDS_PER_DAY);
    unit = "day";
  }

  return (
    <FormattedRelativeTime
      value={value}
      unit={unit}
      updateIntervalInSeconds={AUTO_UPDATE_INTERVAL}
    />
  );
}

// Output: "5 minutes ago", "in 2 hours", "3 days ago"
```

### FormattedList

```typescript
import { FormattedList } from "react-intl";

function Contributors({ names }: { names: string[] }) {
  return (
    <FormattedList
      type="conjunction"
      value={names}
    />
  );
}

// Output (en): "Alice, Bob, and Charlie"
// Output (es): "Alice, Bob y Charlie"
```

---

## 6. Message Extraction Workflow

### CLI Installation

```bash
npm install --save-dev @formatjs/cli
```

### Package.json Scripts

```json
{
  "scripts": {
    "intl:extract": "formatjs extract 'src/**/*.{ts,tsx}' --ignore='**/*.d.ts' --out-file lang/en.json --id-interpolation-pattern '[sha512:contenthash:base64:6]'",
    "intl:compile": "formatjs compile lang/en.json --out-file src/compiled-lang/en.json --ast",
    "intl:compile:all": "formatjs compile-folder --ast lang src/compiled-lang"
  }
}
```

### Extraction Process

1. **Extract messages from source:**
   ```bash
   npm run intl:extract
   ```

   Output (`lang/en.json`):
   ```json
   {
     "greeting.welcome": {
       "defaultMessage": "Welcome back, {name}!",
       "description": "Greeting shown to returning users"
     },
     "greeting.unread": {
       "defaultMessage": "You have {count, plural, =0 {no unread messages} one {# unread message} other {# unread messages}}"
     }
   }
   ```

2. **Send to translation service (TMS)**

3. **Compile translations for runtime:**
   ```bash
   npm run intl:compile:all
   ```

   Compiled output uses AST format for faster runtime parsing.

### ID Generation Strategies

**Explicit IDs (Recommended for large projects):**
```typescript
<FormattedMessage
  id="product.addToCart"
  defaultMessage="Add to Cart"
/>
```

**Auto-generated IDs (Content hash):**
```typescript
// With --id-interpolation-pattern '[sha512:contenthash:base64:6]'
<FormattedMessage
  defaultMessage="Add to Cart"
/>
// Generated ID: "abc123" (hash of defaultMessage)
```

**Trade-offs:**
- Explicit IDs: More readable, prevents accidental duplicate messages
- Auto-generated IDs: Less manual work, but changing message changes ID

### Custom Formatters for TMS

```javascript
// formatters/crowdin.js
export function format(msgs) {
  return Object.entries(msgs).reduce((acc, [id, msg]) => {
    acc[id] = msg.defaultMessage;
    return acc;
  }, {});
}

export function parse(msgs) {
  return Object.entries(msgs).reduce((acc, [id, msg]) => {
    acc[id] = { defaultMessage: msg };
    return acc;
  }, {});
}
```

```bash
formatjs extract 'src/**/*.tsx' --out-file lang/en.json --format formatters/crowdin.js
```

---

## 7. TypeScript Integration

### Type-Safe Message IDs

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
```

This enables:
- Autocomplete for message IDs
- Compile-time errors for typos
- Refactoring support

### Type-Safe Locale Configuration

```typescript
// src/types/intl.d.ts
declare global {
  namespace FormatjsIntl {
    interface IntlConfig {
      locale: "en" | "de" | "fr" | "es";
    }
  }
}
```

### TypeScript Config Requirements

```json
// tsconfig.json
{
  "compilerOptions": {
    "lib": ["esnext.intl", "es2017.intl", "es2018.intl"]
  }
}
```

### Type-Safe useIntl Wrapper

```typescript
// src/hooks/use-translations.ts
import { useIntl } from "react-intl";
import type { MessageDescriptor } from "react-intl";

type TranslationValues = Record<string, string | number | boolean | Date>;

export function useTranslations() {
  const intl = useIntl();

  return {
    t: (descriptor: MessageDescriptor, values?: TranslationValues) =>
      intl.formatMessage(descriptor, values),
    formatDate: intl.formatDate.bind(intl),
    formatNumber: intl.formatNumber.bind(intl),
    formatRelativeTime: intl.formatRelativeTime.bind(intl),
    locale: intl.locale,
  };
}

export { useTranslations };
```

---

## 8. SSR/SSG Considerations

### Next.js Pages Router

```typescript
// pages/_app.tsx
import { IntlProvider } from "react-intl";
import { useRouter } from "next/router";
import type { AppProps } from "next/app";

type Messages = Record<string, Record<string, string>>;

const messages: Messages = {
  en: require("../lang/en.json"),
  de: require("../lang/de.json"),
};

export default function App({ Component, pageProps }: AppProps) {
  const { locale = "en", defaultLocale = "en" } = useRouter();

  return (
    <IntlProvider
      locale={locale}
      defaultLocale={defaultLocale}
      messages={messages[locale]}
    >
      <Component {...pageProps} />
    </IntlProvider>
  );
}
```

### Server-Side Message Loading

```typescript
// pages/index.tsx
import type { GetStaticProps } from "next";

type Props = {
  messages: Record<string, string>;
};

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => {
  const messages = (await import(`../lang/${locale}.json`)).default;

  return {
    props: {
      messages,
    },
  };
};
```

### Using createIntl for Server Components

```typescript
// For non-React contexts (Node.js, Server Components without context)
import { createIntl, createIntlCache } from "@formatjs/intl";

// Cache is optional but recommended for performance
const cache = createIntlCache();

export async function getServerIntl(locale: string) {
  const messages = (await import(`../lang/${locale}.json`)).default;

  return createIntl(
    {
      locale,
      messages,
    },
    cache
  );
}

// Usage in Server Component or API route
const intl = await getServerIntl("en");
const greeting = intl.formatMessage({ id: "greeting" });
```

### RawIntlProvider for Performance

Use `RawIntlProvider` with `createIntl` to avoid recreating the intl object:

```typescript
import { createIntl, createIntlCache, RawIntlProvider } from "react-intl";
import type { ReactNode } from "react";

const cache = createIntlCache();

type Props = {
  locale: string;
  messages: Record<string, string>;
  children: ReactNode;
};

export function OptimizedIntlProvider({ locale, messages, children }: Props) {
  const intl = createIntl({ locale, messages }, cache);

  return <RawIntlProvider value={intl}>{children}</RawIntlProvider>;
}
```

---

## 9. Performance Optimization

### Message Compilation (AST Pre-parsing)

Compile messages to AST format at build time to skip runtime parsing:

```bash
formatjs compile lang/en.json --out-file compiled/en.json --ast
```

```typescript
// Load compiled messages instead of raw JSON
import compiledMessages from "./compiled/en.json";

<IntlProvider locale="en" messages={compiledMessages}>
```

**Impact:** 30-50% faster initial render for large message catalogs.

### Lazy Loading Locale Data

```typescript
// src/utils/load-messages.ts
const messageLoaders: Record<string, () => Promise<Record<string, string>>> = {
  en: () => import("../lang/compiled/en.json").then((m) => m.default),
  de: () => import("../lang/compiled/de.json").then((m) => m.default),
  fr: () => import("../lang/compiled/fr.json").then((m) => m.default),
};

const messageCache = new Map<string, Record<string, string>>();

export async function loadMessages(locale: string): Promise<Record<string, string>> {
  if (messageCache.has(locale)) {
    return messageCache.get(locale)!;
  }

  const loader = messageLoaders[locale] ?? messageLoaders.en;
  const messages = await loader();

  messageCache.set(locale, messages);
  return messages;
}

export { loadMessages };
```

### Selective Polyfills

Only load polyfills for browsers that need them:

```typescript
// src/utils/intl-polyfills.ts
export async function loadIntlPolyfills(locale: string) {
  const polyfills: Promise<void>[] = [];

  if (!Intl.PluralRules) {
    polyfills.push(
      import("@formatjs/intl-pluralrules/polyfill").then(() =>
        import(`@formatjs/intl-pluralrules/locale-data/${locale}`)
      )
    );
  }

  if (!Intl.RelativeTimeFormat) {
    polyfills.push(
      import("@formatjs/intl-relativetimeformat/polyfill").then(() =>
        import(`@formatjs/intl-relativetimeformat/locale-data/${locale}`)
      )
    );
  }

  await Promise.all(polyfills);
}
```

### Avoid Inline Message Objects

```typescript
// Bad: Creates new object on every render
function Bad() {
  return (
    <FormattedMessage
      id="greeting"
      defaultMessage="Hello!"
      description="Greeting message"
    />
  );
}

// Good: Define messages outside component
const messages = defineMessages({
  greeting: {
    id: "greeting",
    defaultMessage: "Hello!",
    description: "Greeting message",
  },
});

function Good() {
  return <FormattedMessage {...messages.greeting} />;
}
```

---

## 10. Testing

### Custom Render with IntlProvider

```typescript
// src/test/test-utils.tsx
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import type { ReactElement, ReactNode } from "react";

import messages from "../lang/en.json";

type CustomRenderOptions = RenderOptions & {
  locale?: string;
  messages?: Record<string, string>;
};

function render(
  ui: ReactElement,
  {
    locale = "en",
    messages: customMessages = messages,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <IntlProvider locale={locale} messages={customMessages}>
        {children}
      </IntlProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything
export * from "@testing-library/react";
export { render };
```

### Testing Translated Components

```typescript
// src/components/greeting.test.tsx
import { screen } from "@testing-library/react";
import { render } from "../test/test-utils";
import { Greeting } from "./greeting";

describe("Greeting", () => {
  it("renders personalized greeting", () => {
    render(<Greeting userName="Alice" unreadCount={5} />);

    expect(screen.getByRole("heading")).toHaveTextContent("Welcome back, Alice!");
    expect(screen.getByText(/5 unread messages/)).toBeInTheDocument();
  });

  it("handles zero unread messages", () => {
    render(<Greeting userName="Bob" unreadCount={0} />);

    expect(screen.getByText(/no unread messages/)).toBeInTheDocument();
  });

  it("handles singular unread message", () => {
    render(<Greeting userName="Carol" unreadCount={1} />);

    expect(screen.getByText(/1 unread message[^s]/)).toBeInTheDocument();
  });
});
```

### Testing with Different Locales

```typescript
import { render, screen } from "../test/test-utils";
import { FormattedDate } from "react-intl";

describe("FormattedDate", () => {
  const testDate = new Date("2024-01-15T12:00:00Z");

  it("formats date in US English", () => {
    render(
      <FormattedDate value={testDate} month="long" day="numeric" year="numeric" />,
      { locale: "en-US" }
    );

    expect(screen.getByText("January 15, 2024")).toBeInTheDocument();
  });

  it("formats date in German", () => {
    render(
      <FormattedDate value={testDate} month="long" day="numeric" year="numeric" />,
      { locale: "de-DE" }
    );

    expect(screen.getByText("15. Januar 2024")).toBeInTheDocument();
  });
});
```

### Mocking Date for Deterministic Tests

```typescript
// vitest.setup.ts or jest.setup.ts
const FIXED_DATE = new Date("2024-01-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_DATE);
});

afterEach(() => {
  vi.useRealTimers();
});
```

### Testing useIntl Hook

```typescript
import { renderHook } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { useTranslations } from "../hooks/use-translations";

describe("useTranslations", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <IntlProvider locale="en" messages={{ "test.message": "Hello, {name}!" }}>
      {children}
    </IntlProvider>
  );

  it("formats messages with values", () => {
    const { result } = renderHook(() => useTranslations(), { wrapper });

    const formatted = result.current.t(
      { id: "test.message", defaultMessage: "Hello, {name}!" },
      { name: "World" }
    );

    expect(formatted).toBe("Hello, World!");
  });
});
```

---

## 11. Anti-Patterns to Avoid

### 1. Hardcoding Text Without Translation Wrapping

```typescript
// Bad: Text will not be translated
function BadButton() {
  return <button>Add to Cart</button>;
}

// Good: Wrapped for translation
function GoodButton() {
  return (
    <button>
      <FormattedMessage id="cart.add" defaultMessage="Add to Cart" />
    </button>
  );
}
```

### 2. Applying English Grammar in Code

```typescript
// Bad: English possessive applied programmatically
function BadMessage({ name }: { name: string }) {
  return <p>{name}'s profile</p>;  // Won't work in other languages
}

// Good: Possessive is part of the translation
function GoodMessage({ name }: { name: string }) {
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

// messages/de.json: "Profil von {name}"
// messages/ja.json: "{name}のプロフィール"
```

### 3. Concatenating Translated Strings

```typescript
// Bad: Word order varies between languages
function BadGreeting({ name, time }: { name: string; time: string }) {
  const intl = useIntl();
  const hello = intl.formatMessage({ id: "hello" });
  const at = intl.formatMessage({ id: "at" });

  return <p>{hello} {name} {at} {time}</p>;
}

// Good: Complete sentence as single message
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

### 4. Using Array Index for Keys in Repeated FormattedMessage

```typescript
// Bad: Changing list order causes key issues
function BadList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>
          <FormattedMessage id={`item.${index}`} />
        </li>
      ))}
    </ul>
  );
}

// Good: Use stable identifiers
function GoodList({ items }: { items: Array<{ id: string; labelKey: string }> }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <FormattedMessage id={item.labelKey} />
        </li>
      ))}
    </ul>
  );
}
```

### 5. Ignoring Pluralization Rules

```typescript
// Bad: Only handles English singular/plural
function BadCount({ count }: { count: number }) {
  return <p>{count} item{count !== 1 ? "s" : ""}</p>;
}

// Good: Uses ICU plural syntax for all languages
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

### 6. Missing `other` Category in Plural/Select

```typescript
// Bad: Missing required 'other' category
const badMessage = "{count, plural, one {# item}}";  // Runtime error!

// Good: Always include 'other' as fallback
const goodMessage = "{count, plural, one {# item} other {# items}}";
```

### 7. Not Providing Fallback for Missing Translations

```typescript
// Bad: No fallback, shows raw ID
<IntlProvider locale={locale} messages={messages}>

// Good: Provide defaultLocale and onError handling
<IntlProvider
  locale={locale}
  defaultLocale="en"
  messages={messages}
  onError={(err) => {
    if (err.code !== "MISSING_TRANSLATION") throw err;
  }}
>
```

### 8. Formatting Dates/Numbers in Messages Instead of Components

```typescript
// Bad: Hardcoded date format in message
const badMessage = "Created on {date}";  // What format is date?

// Good: Use formatting components or explicit format
function GoodCreatedDate({ date }: { date: Date }) {
  return (
    <p>
      <FormattedMessage
        id="created.on"
        defaultMessage="Created on {date, date, long}"
        values={{ date }}
      />
    </p>
  );
}
```

---

## 12. Integration with React Query

```typescript
// src/hooks/use-translated-error.ts
import { useIntl } from "react-intl";
import type { UseQueryResult } from "@tanstack/react-query";

const ERROR_MESSAGE_IDS: Record<string, string> = {
  NETWORK_ERROR: "error.network",
  NOT_FOUND: "error.notFound",
  UNAUTHORIZED: "error.unauthorized",
  DEFAULT: "error.generic",
};

export function useTranslatedError<T>(query: UseQueryResult<T>) {
  const intl = useIntl();

  if (!query.error) return null;

  const errorCode = (query.error as { code?: string }).code ?? "DEFAULT";
  const messageId = ERROR_MESSAGE_IDS[errorCode] ?? ERROR_MESSAGE_IDS.DEFAULT;

  return intl.formatMessage({ id: messageId });
}
```

---

## Research Sources

- [FormatJS Official Documentation](https://formatjs.github.io/docs/react-intl/)
- [React Intl API Reference](https://formatjs.github.io/docs/react-intl/api/)
- [FormatJS Components](https://formatjs.github.io/docs/react-intl/components/)
- [ICU Message Syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax/)
- [FormatJS CLI Documentation](https://formatjs.github.io/docs/tooling/cli/)
- [Testing Library - React Intl Example](https://testing-library.com/docs/example-react-intl/)
- [ICU Message Format Guide - Phrase](https://phrase.com/blog/posts/guide-to-the-icu-message-format/)
- [Common i18n Mistakes - InfiniteJS](https://infinitejs.com/posts/common-mistakes-i18n-react)
- [react-intl npm package](https://www.npmjs.com/package/react-intl)
- [FormatJS GitHub Repository](https://github.com/formatjs/formatjs)
