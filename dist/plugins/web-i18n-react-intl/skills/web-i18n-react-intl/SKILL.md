---
name: web-i18n-react-intl
description: ICU message format internationalization for React — FormattedMessage, useIntl, defineMessages, and the FormatJS extraction workflow. Load when a project imports react-intl.
---

# React-Intl (FormatJS) Internationalization Patterns

> **Quick Guide:** `FormattedMessage` renders translated text in JSX, `useIntl` returns strings for
> attributes and programmatic use, and `defineMessages` produces descriptors the FormatJS CLI can
> extract. `IntlProvider` supplies the context, and its `onError` is what separates a missing
> translation from a real failure. Every `plural` and `select` needs an `other` branch. Version
> boundary: v7.x runs on React 16.6 through 19; v8 and later require React 19.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — provider setup, FormattedMessage, useIntl, defineMessages, `createIntl`, locale switching, types, lazy loading
- [examples/formatting.md](examples/formatting.md) — date, time, number, currency, relative time, list and display-name formatting
- [examples/pluralization.md](examples/pluralization.md) — plural, ordinal, select, nested patterns, per-language categories, ICU escaping
- [reference.md](reference.md) — decision trees, ICU syntax tables, API tables, anti-pattern code, checklists

---

## Which path applies

- **Text rendered inside JSX** — `FormattedMessage`, including rich text with tag values. Follow
  [examples/core.md](examples/core.md).
- **A string is needed** — an attribute, a document title, a value passed to a third-party
  component, or a comparison — `useIntl().formatMessage()`. Also in
  [examples/core.md](examples/core.md).
- **Outside a React tree** — a server render or a plain module — `createIntl` from
  `@formatjs/intl`, optionally re-supplied through `RawIntlProvider`. In
  [examples/core.md](examples/core.md).

---

<critical_requirements>

## Before writing react-intl code

**Wrap the tree in `IntlProvider` with `locale`, `messages` and `defaultLocale`.** Every
`FormattedMessage` and `useIntl` call reads that context, and `defaultLocale` is what a missing
translation falls back to instead of surfacing the raw ID.

**Give every `plural` and `select` an `other` branch.** ICU requires it, and a message without one
throws when formatted rather than when authored.

**Match the major version to the React version in the project.** v7.x covers React 16.6 through 19;
v8 and later dropped everything before React 19.

</critical_requirements>

---

**Auto-detection:** react-intl, FormatJS, FormattedMessage, useIntl, IntlProvider, RawIntlProvider,
defineMessages, defineMessage, createIntl, formatMessage, FormattedDate, FormattedNumber,
FormattedRelativeTime, ICU message format

**Applies to:**

- Rendering messages with ICU interpolation, pluralization, select and rich text
- Formatting dates, numbers, currency, relative time, lists and display names per locale
- Structuring messages as descriptors so the CLI can extract and compile them
- Typing message IDs so a typo fails at compile time
- Loading a locale's messages on demand rather than bundling all of them

**Handled elsewhere:**

- Where the locale value comes from and how it is persisted — this skill consumes a locale and
  settles nothing about detection, routing or storage
- A framework's own built-in i18n — a framework that resolves locale and messages per request will
  do that better than a client-side provider, and this skill does not compete with it
- Translation vendor workflow — the CLI produces and consumes JSON, and what happens to it in
  between is not this skill's concern
- Rendering and state — components receive messages through context and are otherwise ordinary

---

<philosophy>

ICU Message Format is the point: it is what translation vendors already speak, so a message written
in it moves through a professional workflow without a conversion step. Everything else follows.
Formatting is delegated to the browser's own `Intl` APIs rather than reimplemented, which is why
locale-specific behaviour is correct for locales nobody tested. And the API is deliberately doubled —
a component for JSX and a hook for strings — because a `ReactNode` cannot be put in an attribute.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: IntlProvider setup

`onError` is where a missing translation is separated from a real failure, and
`defaultRichTextElements` gives `<b>`, `<i>` and `<br>` one definition for the whole app.

```typescript
<IntlProvider
  locale={locale}
  defaultLocale={DEFAULT_LOCALE}
  messages={messages}
  defaultRichTextElements={DEFAULT_RICH_TEXT_ELEMENTS}
  onError={(err) => {
    if (err.code === "MISSING_TRANSLATION") return;
    throw err;
  }}
>
  {children}
</IntlProvider>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: FormattedMessage

For text rendered directly in JSX, including messages carrying ICU syntax.

```typescript
<FormattedMessage
  id="greeting.unread"
  defaultMessage="{count, plural, =0 {No messages} one {# message} other {# messages}}"
  values={{ count: unreadCount }}
/>
```

It returns a `ReactNode`, so an attribute — `placeholder`, `aria-label`, `title` — needs Pattern 3
instead.

Full code: [examples/core.md](examples/core.md)

### Pattern 3: useIntl

For any context that needs a string: attributes, document titles, third-party props, or a value the
code then compares.

```typescript
const intl = useIntl();

const placeholder = intl.formatMessage({
  id: "search.placeholder",
  defaultMessage: "Search products...",
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 4: defineMessages

Descriptors the CLI can find statically. `description` is the only channel a translator has for
context.

```typescript
export const productMessages = defineMessages({
  reviewCount: {
    id: "product.reviewCount",
    defaultMessage:
      "{count, plural, =0 {No reviews} one {# review} other {# reviews}}",
    description: "Number of product reviews with pluralization",
  },
});
```

Spread a descriptor into `FormattedMessage`, or pass it to `intl.formatMessage`.

Full code: [examples/core.md](examples/core.md)

### Pattern 5: Rich text

Tags in the message map to values, so the sentence stays in one translation unit and the translator
can reorder the tags to fit the target grammar.

```typescript
<FormattedMessage
  id="terms.notice"
  defaultMessage="You agree to our <terms>Terms</terms> and <privacy>Privacy Policy</privacy>."
  values={{
    terms: (chunks) => <a href="/terms">{chunks}</a>,
    privacy: (chunks) => <a href="/privacy">{chunks}</a>,
  }}
/>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 6: Formatting

A component per value kind, each with an imperative twin on `useIntl` for string contexts.

```typescript
<FormattedDate value={date} year="numeric" month="long" day="numeric" />
<FormattedNumber value={amount} style="currency" currency={currency} />
<FormattedList type="conjunction" value={names} />
```

Full code: [examples/formatting.md](examples/formatting.md)

### Pattern 7: Type-safe message IDs

Augment the `FormatjsIntl.Message` interface and a wrong ID becomes a compile error.

```typescript
declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: keyof typeof messages;
    }
  }
}
```

Add `"esnext.intl"` to `compilerOptions.lib`.

Full code: [examples/core.md](examples/core.md)

### Pattern 8: Extraction workflow

Extract descriptors, send the JSON out for translation, compile what comes back.

```bash
formatjs extract 'src/**/*.{ts,tsx}' --out-file lang/en.json
formatjs compile lang/en.json --out-file compiled/en.json --ast
```

Compiling to AST skips parsing at runtime — 30-50% off first render for a large catalog.

### Pattern 9: ICU pluralization

Plural category counts differ by language: English has `one`/`other`, Russian adds `few` and `many`,
Arabic adds `zero` and `two`.

```
{count, plural, =0 {No items} one {# item} other {# items}}
{position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}
{gender, select, male {He} female {She} other {They}} liked your post.
```

Full code: [examples/pluralization.md](examples/pluralization.md)

</patterns>

---

<performance>

## Performance

**Compile to AST at build time** — Pattern 8's `formatjs compile --ast` step, which is where the
largest single win is.

**Load one locale at a time** with dynamic imports, and cache what comes back so a switch back is
free. Implementation in [examples/core.md](examples/core.md).

**Define messages outside the component.** An object literal passed inline to `FormattedMessage` is
a new reference every render, which defeats memoization.

**`createIntl` + `createIntlCache` + `RawIntlProvider`** puts the intl object under explicit control
when you want to memoize it yourself.

</performance>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A `plural` or `select` with no `other` branch — ICU requires it and formatting throws
- Any `useIntl` or `FormattedMessage` outside `IntlProvider` — there is no context to read
- `FormattedMessage` in an attribute — it is a `ReactNode`, so `placeholder`, `aria-label` and
  `title` receive an object
- `injectIntl` — removed in v10; `useIntl` replaces it

**Surprising behaviour:**

- `formatMessage` returns `string` normally, but `string | ReactNode[]` as soon as a value is a rich
  text tag function
- Rich text tag functions receive `chunks` as an array, not a single element
- `formatNumber` with `style: "percent"` expects a fraction — `0.25` renders as 25%
- `formatRelativeTime` is relative to now: negative is past, positive is future
- ICU escaping runs on single quotes — `'` escapes the next special character and `''` produces a
  literal apostrophe, so an unescaped apostrophe in an English message can swallow the rest of it
- Without `defaultLocale`, a missing translation renders the raw message ID
- Without `onError`, every missing translation writes to the console
- Concatenating two translated strings assumes English word order, which most languages do not share
- `{count}` on its own never pluralizes, and a plural branch without `#` renders no number at all
- `onWarn` on `IntlProvider` is what quiets `defaultRichTextElements` warnings when messages are not
  pre-compiled

Anti-patterns with the code that fixes them: [reference.md](reference.md).

</red_flags>
